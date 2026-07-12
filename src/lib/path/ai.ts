// Server-only. The one recurring AI cost The Path carries: a weekly re-plan +
// report card. Everything else (progress, gating, the daily quest) is derived
// from evidence with zero model calls — so this single call, cached one row per
// ISO week, is the whole AI budget for a learner's path.
//
// The report is deliberately bilingual. The audience is a Bangladesh bootcamp:
// comprehension lands hardest in Bangla, but the interview vocabulary they are
// being hired on is English. So we always produce both, and the UI shows Bangla
// when the learner is struggling and English when they are cruising.
//
// Follows the Hive convention: a Gemini-dialect responseSchema is the single
// source of truth, generateStructured translates it for the other providers and
// handles failover, and every call is stamped onto AiUsageEvent (feature PATH,
// task PLAN).

import { Type } from '@google/genai'
import { generateStructured } from '@/lib/hive/providers'
import { nodeById, moduleOfNode } from './curriculum'
import type { NodeProgress, WeeklyReport } from './types'

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING, description: 'A short, warm, specific one-line summary of the week. Max 12 words.' },
    summaryEn: { type: Type.STRING, description: '2-3 sentences in English: what they worked on and how it went.' },
    summaryBn: { type: Type.STRING, description: 'The same summary in natural Bangla. Keep code/technical terms in English.' },
    wins: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Up to 3 concrete wins this week, each one short line.' },
    struggles: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Up to 3 honest, kind observations about what is hard right now.' },
    focus: {
      type: Type.ARRAY,
      description: 'Up to 3 node ids to focus on next week, each with a one-line reason. Choose ONLY from the provided candidate node ids.',
      items: {
        type: Type.OBJECT,
        properties: {
          nodeId: { type: Type.STRING },
          why: { type: Type.STRING, description: 'One short line on why this node next.' },
        },
        required: ['nodeId', 'why'],
      },
    },
    encouragementEn: { type: Type.STRING, description: 'One genuine, non-cheesy line of encouragement in English.' },
    encouragementBn: { type: Type.STRING, description: 'The same encouragement in natural Bangla.' },
    dailyMinutes: { type: Type.INTEGER, description: 'Realistic minutes/day this learner can sustain next week, 10-60, based on their recent pace.' },
  },
  required: ['headline', 'summaryEn', 'summaryBn', 'wins', 'struggles', 'focus', 'encouragementEn', 'encouragementBn', 'dailyMinutes'],
  propertyOrdering: ['headline', 'summaryEn', 'summaryBn', 'wins', 'struggles', 'focus', 'encouragementEn', 'encouragementBn', 'dailyMinutes'],
}

/** A compact, model-friendly digest of the learner's week — no PII beyond the name. */
export interface WeekDigest {
  name: string
  level: number
  levelTitle: string
  masteredThisWeek: string[]
  strugglingNodes: string[]
  questsCompleted: number
  questsMissed: number
  /** The nodes currently open or next-available — the only legal focus targets. */
  candidates: { nodeId: string; title: string; module: string; state: string }[]
}

export function buildDigest(
  name: string,
  level: number,
  levelTitle: string,
  nodes: NodeProgress[],
  masteredThisWeek: string[],
  quests: { completed: number; missed: number },
): WeekDigest {
  const struggling = nodes.filter((n) => n.struggling).map((n) => n.nodeId)
  const candidates = nodes
    .filter((n) => n.state === 'in-progress' || n.state === 'available')
    .slice(0, 8)
    .map((n) => ({
      nodeId: n.nodeId,
      title: nodeById(n.nodeId)?.title ?? n.nodeId,
      module: moduleOfNode(n.nodeId)?.title ?? '',
      state: n.state,
    }))
  return {
    name,
    level,
    levelTitle,
    masteredThisWeek: masteredThisWeek.map((id) => nodeById(id)?.title ?? id),
    strugglingNodes: struggling.map((id) => nodeById(id)?.title ?? id),
    questsCompleted: quests.completed,
    questsMissed: quests.missed,
    candidates,
  }
}

const PERSONA = [
  'You are the personal learning coach on Phi Lab, a web development bootcamp in Bangladesh.',
  'The learner is a beginner-to-intermediate coder working toward their first developer job.',
  'Be warm, specific, and honest — never generic hype. Name what actually happened.',
  'When you point out a struggle, frame it as the next thing to master, not a failure.',
].join(' ')

/**
 * Generate the weekly report. `weekOf` (the Monday) is threaded into the usage
 * row's context so the call is attributable. Focus ids are filtered to the
 * candidate set on the way out — the model is told to stay inside it, but we
 * never trust that.
 */
export async function generateWeeklyReport(
  digest: WeekDigest,
  weekOf: string,
  scope: { userId?: string } = {},
): Promise<WeeklyReport> {
  const legalIds = new Set(digest.candidates.map((c) => c.nodeId))

  const prompt = [
    PERSONA,
    '',
    `Learner: ${digest.name}, level ${digest.level} (${digest.levelTitle}).`,
    `Mastered this week: ${digest.masteredThisWeek.join(', ') || 'nothing new'}.`,
    `Struggling with: ${digest.strugglingNodes.join(', ') || 'nothing flagged'}.`,
    `Daily quests: ${digest.questsCompleted} completed, ${digest.questsMissed} missed.`,
    '',
    'Candidate nodes to focus on next week (choose focus ONLY from these ids):',
    ...digest.candidates.map((c) => `  - ${c.nodeId} — "${c.title}" (${c.module}, ${c.state})`),
    '',
    'Write the weekly report card. Bilingual fields must carry the same meaning, not a literal transliteration.',
  ].join('\n')

  const data = await generateStructured<Omit<WeeklyReport, 'weekOf'>>(prompt, REPORT_SCHEMA, {
    feature: 'PATH',
    task: 'PLAN',
    userId: scope.userId,
  })

  return {
    weekOf,
    headline: data.headline,
    summaryEn: data.summaryEn,
    summaryBn: data.summaryBn,
    wins: (data.wins ?? []).slice(0, 3),
    struggles: (data.struggles ?? []).slice(0, 3),
    focus: (data.focus ?? []).filter((f) => legalIds.has(f.nodeId)).slice(0, 3),
    encouragementEn: data.encouragementEn,
    encouragementBn: data.encouragementBn,
    dailyMinutes: Math.max(10, Math.min(60, data.dailyMinutes || 25)),
  }
}
