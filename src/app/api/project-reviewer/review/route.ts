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

type RepoMeta = {
    full_name?: string
    description?: string | null
    homepage?: string | null
    default_branch?: string
    language?: string | null
    stargazers_count?: number
    forks_count?: number
    open_issues_count?: number
}

type BranchData = {
    commit?: {
        commit?: {
            tree?: {
                sha?: string
            }
        }
    }
}

type TreeData = {
    tree?: TreeEntry[]
}

type PublicRepoSnapshot = {
    repoMeta: RepoMeta
    treePaths: string[]
    snippets: { path: string; excerpt: string }[]
    liveSnapshot: {
        available: boolean
        finalUrl: string
        title: string | null
        description: string | null
        ogTitle: string | null
        h1: string[]
        h2: string[]
        bodyPreview: string
        error?: string
    }
}

function getGitHubHeaders() {
    const headers: HeadersInit = {
        accept: 'application/vnd.github+json',
        'user-agent': 'phi-lab-project-reviewer',
    }

    const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_API_TOKEN
    if (token) headers.authorization = `Bearer ${token}`

    return headers
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

function parseBranchFromHtml(html: string): string | null {
    const branchMatch = html.match(/data-default-branch="([^"]+)"/i)
    if (branchMatch?.[1]) return branchMatch[1]

    const branchPathMatch = html.match(/\/branches\/([A-Za-z0-9_.\-/]+)/i)
    if (branchPathMatch?.[1]) return branchPathMatch[1].split(/["'/?#&]/)[0] ?? null

    return null
}

function parseRepoMetaFromHtml(html: string): RepoMeta {
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null
    const description = extractMeta(html, 'description') ?? extractMeta(html, 'og:description')
    return {
        full_name: title?.replace(/^[^/]+\//, '').replace(/\s*\u00b7.*$/, '') ?? undefined,
        description,
        homepage: null,
        language: null,
    }
}

function extractGithubPathsFromHtml(html: string, owner: string, repo: string, branch: string): string[] {
    const paths = new Set<string>()
    const blobPattern = new RegExp(`/${owner}/${repo}/blob/${branch}/([^"?#]+)`, 'g')
    const treePattern = new RegExp(`/${owner}/${repo}/tree/${branch}/([^"?#]+)`, 'g')

    for (const match of html.matchAll(blobPattern)) {
        if (match[1]) paths.add(decodeURIComponent(match[1]))
    }

    for (const match of html.matchAll(treePattern)) {
        if (match[1]) paths.add(decodeURIComponent(match[1]).replace(/\/$/, ''))
    }

    return [...paths]
}

async function fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, {
        headers: {
            accept: 'text/html,application/xhtml+xml',
            'user-agent': 'phi-lab-project-reviewer',
        },
        redirect: 'follow',
    })
    if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`)
    return res.text()
}

async function fetchRawFile(owner: string, repo: string, branch: string, path: string): Promise<string | null> {
    const encoded = path.split('/').map(encodeURIComponent).join('/')
    const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encoded}`, {
        headers: { 'user-agent': 'phi-lab-project-reviewer' },
        redirect: 'follow',
    })
    if (!res.ok) return null
    return res.text()
}

async function buildEvidenceFromPublicPages(repo: { owner: string; repo: string }): Promise<PublicRepoSnapshot> {
    const repoHtml = await fetchHtml(`https://github.com/${repo.owner}/${repo.repo}`)
    const branch = parseBranchFromHtml(repoHtml) ?? 'main'
    const repoMeta = parseRepoMetaFromHtml(repoHtml)

    const seenPages = new Set<string>()
    const treePaths = new Set<string>()
    const queue = [`https://github.com/${repo.owner}/${repo.repo}/tree/${branch}`]
    const maxPages = 8

    while (queue.length > 0 && seenPages.size < maxPages) {
        const pageUrl = queue.shift()!
        if (seenPages.has(pageUrl)) continue
        seenPages.add(pageUrl)

        let pageHtml: string
        try {
            pageHtml = await fetchHtml(pageUrl)
        } catch {
            continue
        }

        const parsedPaths = extractGithubPathsFromHtml(pageHtml, repo.owner, repo.repo, branch)
        for (const path of parsedPaths) {
            if (path && !path.endsWith('/')) treePaths.add(path)
            if (path && !path.includes('.') && !path.startsWith('README')) {
                queue.push(`https://github.com/${repo.owner}/${repo.repo}/tree/${branch}/${path}`)
            }
        }
    }

    const allPaths = [...treePaths]
    const interestingPaths = pickInterestingPaths(allPaths.length > 0 ? allPaths : ['README.md'])
    const snippets: { path: string; excerpt: string }[] = []

    for (const path of interestingPaths) {
        const content = await fetchRawFile(repo.owner, repo.repo, branch, path)
        if (!content) continue
        snippets.push({ path, excerpt: content.slice(0, 2400) })
        if (snippets.length >= 8) break
    }

    const readme = snippets.find((entry) => /readme\.md$/i.test(entry.path))
    const bodyPreview = readme?.excerpt ?? cleanHtml(repoHtml).slice(0, 2400)

    return {
        repoMeta,
        treePaths: allPaths.slice(0, 120),
        snippets,
        liveSnapshot: {
            available: true,
            finalUrl: `https://github.com/${repo.owner}/${repo.repo}`,
            title: repoMeta.full_name ?? `${repo.owner}/${repo.repo}`,
            description: repoMeta.description ?? null,
            ogTitle: repoMeta.full_name ?? null,
            h1: [],
            h2: [],
            bodyPreview,
        },
    }
}

async function fetchJson<T = unknown>(url: string): Promise<T> {
    const res = await fetch(url, {
        headers: getGitHubHeaders(),
    })
    if (!res.ok) {
        if (res.status === 403) {
            const detail = process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN
                ? 'GitHub API denied this request. Check that the token has access to the repository.'
                : 'GitHub API rate limited the request. Set GITHUB_TOKEN in the server environment to avoid anonymous rate limits.'
            throw new Error(`${detail} (${url})`)
        }
        throw new Error(`Failed to fetch ${url} (${res.status})`)
    }
    return res.json() as Promise<T>
}

async function readGithubFile(owner: string, repo: string, path: string): Promise<string | null> {
    const encoded = path.split('/').map(encodeURIComponent).join('/')
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encoded}`, {
        headers: getGitHubHeaders(),
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

    let repoMeta: RepoMeta
    let treePaths: string[]
    let snippets: { path: string; excerpt: string }[]

    try {
        repoMeta = await fetchJson<RepoMeta>(`https://api.github.com/repos/${repo.owner}/${repo.repo}`)
        const defaultBranch = typeof repoMeta?.default_branch === 'string' ? repoMeta.default_branch : 'main'
        const branchData = await fetchJson<BranchData>(`https://api.github.com/repos/${repo.owner}/${repo.repo}/branches/${encodeURIComponent(defaultBranch)}`)
        const treeSha = typeof branchData?.commit?.commit?.tree?.sha === 'string' ? branchData.commit.commit.tree.sha : null
        if (!treeSha) throw new Error('Could not resolve the repository tree SHA.')
        const treeData = await fetchJson<TreeData>(`https://api.github.com/repos/${repo.owner}/${repo.repo}/git/trees/${treeSha}?recursive=1`)
        const treeEntries = Array.isArray(treeData?.tree) ? treeData.tree : []
        treePaths = treeEntries.filter((entry) => entry.type === 'blob' && typeof entry.path === 'string').map((entry) => entry.path as string)
        const interestingPaths = pickInterestingPaths(treePaths)
        snippets = []
        for (const path of interestingPaths) {
            const content = await readGithubFile(repo.owner, repo.repo, path)
            if (!content) continue
            snippets.push({ path, excerpt: content.slice(0, 2400) })
            if (snippets.length >= 8) break
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : ''
        if (!message.includes('rate limited') && !message.includes('GitHub API denied')) throw err

        const fallback = await buildEvidenceFromPublicPages(repo)
        repoMeta = fallback.repoMeta
        treePaths = fallback.treePaths
        snippets = fallback.snippets
    }

    const defaultBranch = typeof repoMeta.default_branch === 'string' ? repoMeta.default_branch : 'main'
    let liveSnapshot: PublicRepoSnapshot['liveSnapshot']

    try {
        const siteRes = await fetch(liveLink, {
            headers: { 'user-agent': 'phi-lab-project-reviewer' },
            redirect: 'follow',
        })

        if (!siteRes.ok) {
            liveSnapshot = {
                available: false,
                finalUrl: siteRes.url || liveLink,
                title: null,
                description: null,
                ogTitle: null,
                h1: [],
                h2: [],
                bodyPreview: '',
                error: `Live site returned ${siteRes.status}`,
            }
        } else {
            const siteHtml = await siteRes.text()
            liveSnapshot = {
                available: true,
                finalUrl: siteRes.url,
                title: siteHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null,
                description: extractMeta(siteHtml, 'description') ?? extractMeta(siteHtml, 'og:description'),
                ogTitle: extractMeta(siteHtml, 'og:title'),
                h1: extractHeadings(siteHtml, 'h1'),
                h2: extractHeadings(siteHtml, 'h2'),
                bodyPreview: cleanHtml(siteHtml).slice(0, 2400),
            }
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown live site error'
        liveSnapshot = {
            available: false,
            finalUrl: liveLink,
            title: null,
            description: null,
            ogTitle: null,
            h1: [],
            h2: [],
            bodyPreview: '',
            error: message,
        }
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

    let evidence
    try {
        evidence = await buildEvidence(github, liveLink)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return errorResponse('SERVER_ERROR', `Failed to inspect the repository or live site: ${message}`)
    }
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