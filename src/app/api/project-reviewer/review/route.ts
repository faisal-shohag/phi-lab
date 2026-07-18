import { Type } from '@google/genai'

import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { generateStructured } from '@/lib/hive/providers'

type ReviewScores = {
    folderStructure: number
    componentSeparation: number
    namingConvention: number
    responsiveness: number
    seo: number
    accessibility: number
    performance: number
}

type TreeEntry = {
    path?: string
    type?: string
}

export interface ProjectReviewResult {
    overallScore: number
    verdict: string
    scores: ReviewScores
    strengths: string[]
    weaknesses: string[]
    summary: string
}

const REVIEW_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        overallScore: { type: Type.INTEGER, description: 'Overall project quality 0-100.' },
        verdict: { type: Type.STRING, description: 'Short verdict, e.g. "Strong submission" or "Needs more polish".' },
        scores: {
            type: Type.OBJECT,
            properties: {
                folderStructure: { type: Type.INTEGER, description: '0-10: folder and file organization.' },
                componentSeparation: { type: Type.INTEGER, description: '0-10: component boundaries and prop flow.' },
                namingConvention: { type: Type.INTEGER, description: '0-10: naming consistency and clarity.' },
                responsiveness: { type: Type.INTEGER, description: '0-10: mobile/adaptive behavior.' },
                seo: { type: Type.INTEGER, description: '0-10: metadata, semantics, discoverability.' },
                accessibility: { type: Type.INTEGER, description: '0-10: labels, semantics, keyboard support, contrast.' },
                performance: { type: Type.INTEGER, description: '0-10: rendering efficiency and perceived speed.' },
            },
            required: [
                'folderStructure',
                'componentSeparation',
                'namingConvention',
                'responsiveness',
                'seo',
                'accessibility',
                'performance',
            ],
            propertyOrdering: [
                'folderStructure',
                'componentSeparation',
                'namingConvention',
                'responsiveness',
                'seo',
                'accessibility',
                'performance',
            ],
        },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Short strengths grounded in the supplied evidence.' },
        weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Short weaknesses grounded in the supplied evidence.' },
        summary: { type: Type.STRING, description: 'One short paragraph summarising the review.' },
    },
    required: ['overallScore', 'verdict', 'scores', 'strengths', 'weaknesses', 'summary'],
    propertyOrdering: ['overallScore', 'verdict', 'scores', 'strengths', 'weaknesses', 'summary'],
}

function parseGithubRepo(input: string): { owner: string; repo: string } | null {
    try {
        const url = new URL(input)
        if (!url.hostname.includes('github.com')) return null
        const [owner, repo] = url.pathname.split('/').filter(Boolean)
        if (!owner || !repo) return null
        return { owner, repo: repo.replace(/\.git$/, '') }
    } catch {
        return null
    }
}

function cleanHtml(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--([\s\S]*?)-->/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function extractMeta(html: string, name: string): string | null {
    const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')
    return html.match(pattern)?.[1]?.trim() ?? null
}

function extractHeadings(html: string, tag: 'h1' | 'h2' | 'h3'): string[] {
    const out = [] as string[]
    const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
    for (const match of html.matchAll(pattern)) {
        const text = cleanHtml(match[1] ?? '')
        if (text) out.push(text)
        if (out.length >= 6) break
    }
    return out
}

function pickInterestingPaths(paths: string[]): string[] {
    const wanted = [
        'package.json',
        'README.md',
        'next.config.ts',
        'tsconfig.json',
        'src/app/layout.tsx',
        'src/app/page.tsx',
    ]
    const selected = wanted.filter((path) => paths.includes(path))
    const extras = paths.filter((path) => {
        return (
            /^(src\/app\/.*\.(ts|tsx|js|jsx)|src\/components\/.*\.(ts|tsx|js|jsx)|src\/lib\/.*\.(ts|tsx|js|jsx))$/.test(path) &&
            /(page|layout|route|page)\.(ts|tsx|js|jsx)$/.test(path)
        )
    })
    return [...selected, ...extras].slice(0, 12)
}

async function fetchJson<T = unknown>(url: string): Promise<T> {
    const res = await fetch(url, {
        headers: {
            accept: 'application/vnd.github+json',
            'user-agent': 'phi-lab-project-reviewer',
        },
    })
    if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`)
    return res.json() as Promise<T>
}

async function readGithubFile(owner: string, repo: string, path: string): Promise<string | null> {
    const encoded = path.split('/').map(encodeURIComponent).join('/')
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encoded}`, {
        headers: {
            accept: 'application/vnd.github+json',
            'user-agent': 'phi-lab-project-reviewer',
        },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    if (typeof data.content !== 'string') return null
    const content = data.content.replace(/\n/g, '')
    try {
        return Buffer.from(content, 'base64').toString('utf8')
    } catch {
        return null
    }
}

async function buildEvidence(github: string, liveLink: string) {
    const repo = parseGithubRepo(github)
    if (!repo) return null

    const repoMeta = await fetchJson(`https://api.github.com/repos/${repo.owner}/${repo.repo}`)
    const defaultBranch = typeof repoMeta?.default_branch === 'string' ? repoMeta.default_branch : 'main'
    const branchData = await fetchJson(`https://api.github.com/repos/${repo.owner}/${repo.repo}/branches/${encodeURIComponent(defaultBranch)}`)
    const treeSha = typeof branchData?.commit?.commit?.tree?.sha === 'string' ? branchData.commit.commit.tree.sha : null
    if (!treeSha) throw new Error('Could not resolve the repository tree SHA.')
    const treeData = await fetchJson(`https://api.github.com/repos/${repo.owner}/${repo.repo}/git/trees/${treeSha}?recursive=1`)
    const treeEntries = Array.isArray(treeData?.tree) ? (treeData.tree as TreeEntry[]) : []
    const treePaths = treeEntries.filter((entry) => entry.type === 'blob' && typeof entry.path === 'string').map((entry) => entry.path as string)
    const interestingPaths = pickInterestingPaths(treePaths)
    const snippets: { path: string; excerpt: string }[] = []
    for (const path of interestingPaths) {
        const content = await readGithubFile(repo.owner, repo.repo, path)
        if (!content) continue
        snippets.push({ path, excerpt: content.slice(0, 2400) })
        if (snippets.length >= 8) break
    }

    const siteRes = await fetch(liveLink, {
        headers: { 'user-agent': 'phi-lab-project-reviewer' },
        redirect: 'follow',
    })
    if (!siteRes.ok) throw new Error(`Live site returned ${siteRes.status}`)
    const siteHtml = await siteRes.text()
    const liveSnapshot = {
        finalUrl: siteRes.url,
        title: siteHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null,
        description: extractMeta(siteHtml, 'description') ?? extractMeta(siteHtml, 'og:description'),
        ogTitle: extractMeta(siteHtml, 'og:title'),
        h1: extractHeadings(siteHtml, 'h1'),
        h2: extractHeadings(siteHtml, 'h2'),
        bodyPreview: cleanHtml(siteHtml).slice(0, 2400),
    }

    return {
        repoMeta: {
            full_name: repoMeta?.full_name,
            description: repoMeta?.description,
            homepage: repoMeta?.homepage,
            default_branch: defaultBranch,
            language: repoMeta?.language,
            stars: repoMeta?.stargazers_count,
            forks: repoMeta?.forks_count,
            openIssues: repoMeta?.open_issues_count,
        },
        treePaths: treePaths.slice(0, 120),
        snippets,
        liveSnapshot,
    }
}

export async function POST(request: Request) {
    const user = await requireUser()
    if (!user) return errorResponse('AUTH_REQUIRED')

    let github = ''
    let liveLink = ''
    try {
        const body = await request.json()
        if (typeof body?.github === 'string') github = body.github.trim()
        if (typeof body?.liveLink === 'string') liveLink = body.liveLink.trim()
    } catch {
        return errorResponse('SERVER_ERROR', 'Invalid JSON body.')
    }

    if (!github || !liveLink) return errorResponse('SERVER_ERROR', 'Please submit both a GitHub repo and a live link.')

    const evidence = await buildEvidence(github, liveLink)
    if (!evidence) return errorResponse('NOT_FOUND', 'Could not read the GitHub repository. Make sure it is public and the URL is correct.')

    const prompt = [
        'You are a senior product-and-frontend reviewer. Review the project using only the evidence below. Do not invent code you did not see.',
        'Judge these categories: folder structure, component separation, naming convention, responsiveness, SEO, accessibility, performance.',
        'Return an honest release-style review. The weaknesses should be short, concrete, and grounded in the evidence. Highlight strengths only when the evidence supports them.',
        'Calibrate as if this is a student project that should be launch-ready, not enterprise perfect.',
        'OverallScore must be 0-100. Each category score must be 0-10. Keep the verdict concise.',
        '',
        `GitHub repo: ${github}`,
        `Live link: ${liveLink}`,
        '',
        'Repository metadata:',
        JSON.stringify(evidence.repoMeta, null, 2),
        '',
        'Repository tree (first 120 paths):',
        evidence.treePaths.join('\n'),
        '',
        'Relevant file snippets:',
        JSON.stringify(evidence.snippets, null, 2),
        '',
        'Live site snapshot:',
        JSON.stringify(evidence.liveSnapshot, null, 2),
    ].join('\n')

    try {
        const report = await generateStructured<ProjectReviewResult>(prompt, REVIEW_SCHEMA, {
            feature: 'HIVE',
            task: 'GENERATE',
            userId: user.id,
        })
        return Response.json(report)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return errorResponse('SERVER_ERROR', `Failed to generate project review: ${message}`)
    }
}