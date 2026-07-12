import { Type } from '@google/genai'
import type { AnalogyCardData, AnalogyLanguage } from '@/lib/analogies/concepts'
import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'
import { awardXp } from '@/lib/gamification/award'
import { getSetting } from '@/lib/admin/settings'
import { isSuspended } from '@/lib/admin/suspension'
import { generateStructured } from '@/lib/hive/providers'

// Generates a culturally-native "rickshaw" analogy for a concept and saves it as
// a shareable card. Uses a standard text model with a responseSchema so the card
// always has the fields the UI needs.
//
// Goes through the shared failover engine (src/lib/hive/providers.ts): it rotates
// across every Gemini key, falls back to Ollama/Groq, and writes the usage rows.

function startOfTodayUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Punchy name for the analogy, e.g. "The Rickshaw Queue".' },
    scene: { type: Type.STRING, description: '2-3 sentence everyday scene from daily life in Bangladesh/South Asia.' },
    mapping: {
      type: Type.ARRAY,
      description: '3-5 rows mapping a technical part to its everyday counterpart.',
      items: {
        type: Type.OBJECT,
        properties: {
          concept: { type: Type.STRING, description: 'The technical part.' },
          everyday: { type: Type.STRING, description: 'The everyday counterpart in the analogy.' },
        },
        required: ['concept', 'everyday'],
        propertyOrdering: ['concept', 'everyday'],
      },
    },
    soBasically: { type: Type.STRING, description: 'One-line "so basically…" takeaway.' },
    techNote: { type: Type.STRING, description: 'Short, accurate technical explanation so the analogy stays honest.' },
    emoji: { type: Type.STRING, description: 'A single emoji that fits the analogy.' },
  },
  required: ['title', 'scene', 'mapping', 'soBasically', 'techNote', 'emoji'],
  propertyOrdering: ['title', 'scene', 'mapping', 'soBasically', 'techNote', 'emoji'],
}

function langInstruction(language: AnalogyLanguage): string {
  if (language === 'bn') return 'Write ALL text (title, scene, mapping, soBasically, techNote) in Bengali (Bangla). Technical terms and code keywords may stay in English where natural.'
  if (language === 'both') return 'Write the scene and soBasically in Bengali (Bangla) followed by an English version in parentheses. Keep title in English. Technical terms may stay in English.'
  return 'Write all text in clear, simple English.'
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  if (!(await getSetting('flag.lab.analogies.enabled'))) return errorResponse('LAB_DISABLED')
  if (await isSuspended(user.id)) return errorResponse('SUSPENDED')

  let concept = ''
  let language: AnalogyLanguage = 'en'
  try {
    const body = await request.json()
    if (typeof body?.concept === 'string') concept = body.concept.trim().slice(0, 120)
    if (body?.language === 'bn' || body?.language === 'both') language = body.language
  } catch {
    return errorResponse('SERVER_ERROR', 'Invalid JSON body.')
  }
  if (!concept) return errorResponse('SERVER_ERROR', 'Please enter a concept to explain.')

  const todayCount = await prisma.analogyCard.count({
    where: { userId: user.id, createdAt: { gte: startOfTodayUTC() } },
  })
  if (todayCount >= (await getSetting('lab.analogies.dailyLimit'))) return errorResponse('DAILY_LIMIT')

  const prompt = [
    `Explain the programming concept "${concept}" using a vivid, culturally-native everyday analogy from daily life in Bangladesh / South Asia (rickshaws, tea stalls, tiffin boxes, bazaars, buses, queues, etc.).`,
    'Make it accurate, memorable and a little fun. The mapping rows should tie specific parts of the concept to specific parts of the everyday scene.',
    langInstruction(language),
  ].join('\n')

  // Analogies have no session row, so sessionId stays null. The engine records
  // one usage row per attempt and fails over on its own.
  let card: Omit<AnalogyCardData, 'concept' | 'language' | 'id'>
  try {
    card = await generateStructured<Omit<AnalogyCardData, 'concept' | 'language' | 'id'>>(prompt, SCHEMA, {
      feature: 'ANALOGIES',
      task: 'GENERATE',
      userId: user.id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('SERVER_ERROR', `Failed to generate analogy: ${message}`)
  }

  const saved = await prisma.analogyCard.create({
    data: {
      userId: user.id,
      concept,
      language,
      title: card.title,
      scene: card.scene,
      mapping: (card.mapping ?? []) as unknown as object,
      soBasically: card.soBasically,
      techNote: card.techNote,
      emoji: card.emoji || '🛺',
    },
  })

  // Award a little XP for creating an analogy (idempotent per card).
  try {
    await awardXp({ userId: user.id, reason: 'analogy_created', sourceId: saved.id, amount: 15, meta: { concept } })
  } catch {
    // ignore — XP is best-effort
  }

  const result: AnalogyCardData = {
    id: saved.id,
    concept,
    language,
    title: saved.title,
    scene: saved.scene,
    mapping: saved.mapping as unknown as AnalogyCardData['mapping'],
    soBasically: saved.soBasically,
    techNote: saved.techNote,
    emoji: saved.emoji,
  }
  return Response.json(result)
}
