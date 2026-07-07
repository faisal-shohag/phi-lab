// Renders an analogy card to a PNG on a <canvas>, independent of the DOM/theme,
// so the downloaded/shared image always looks the same. No external deps.
import type { AnalogyCardData } from './concepts'

const W = 1080
const PAD = 72
const CONTENT_W = W - PAD * 2

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/)
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    }
    lines.push(line)
  }
  return lines
}

const FONT = (size: number, weight = 400) =>
  `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Bengali", sans-serif`

/** Draw the card and return a PNG blob. */
export async function drawAnalogyCard(data: AnalogyCardData): Promise<Blob> {
  // First pass: measure total height with an offscreen context.
  const measure = document.createElement('canvas').getContext('2d')!

  const HEADER_H = 300
  let bodyH = 48 // top padding inside body

  measure.font = FONT(30)
  const sceneLines = wrapText(measure, data.scene, CONTENT_W)
  bodyH += sceneLines.length * 42 + 28

  const rowH = 74
  bodyH += data.mapping.length * (rowH + 12)
  bodyH += 20

  measure.font = FONT(30, 700)
  const soLines = wrapText(measure, `So basically — ${data.soBasically}`, CONTENT_W - 48)
  bodyH += soLines.length * 40 + 48

  measure.font = FONT(26)
  const techLines = wrapText(measure, data.techNote, CONTENT_W - 48)
  bodyH += techLines.length * 36 + 60

  bodyH += 60 // watermark row

  const H = HEADER_H + bodyH

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Body background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // Header gradient
  const grad = ctx.createLinearGradient(0, 0, W, HEADER_H)
  grad.addColorStop(0, '#f59e0b')
  grad.addColorStop(0.5, '#f97316')
  grad.addColorStop(1, '#f43f5e')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, HEADER_H)

  ctx.textBaseline = 'alphabetic'
  ctx.font = FONT(96)
  ctx.fillText(data.emoji || '🛺', PAD, 130)

  ctx.fillStyle = '#ffffff'
  ctx.font = FONT(54, 800)
  const titleLines = wrapText(ctx, data.title, CONTENT_W)
  let ty = 200
  for (const l of titleLines.slice(0, 2)) { ctx.fillText(l, PAD, ty); ty += 58 }

  ctx.font = FONT(24, 600)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(data.concept.toUpperCase(), PAD, HEADER_H - 30)

  // Body
  let y = HEADER_H + 60
  ctx.fillStyle = '#0f172a'
  ctx.font = FONT(30)
  for (const l of sceneLines) { ctx.fillText(l, PAD, y); y += 42 }
  y += 20

  // Mapping rows
  for (const m of data.mapping) {
    ctx.fillStyle = '#f8fafc'
    roundRect(ctx, PAD, y, CONTENT_W, rowH, 16)
    ctx.fill()
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    roundRect(ctx, PAD, y, CONTENT_W, rowH, 16)
    ctx.stroke()

    ctx.fillStyle = '#e11d48'
    ctx.font = FONT(26, 700)
    const cLabel = m.concept
    ctx.fillText(cLabel, PAD + 24, y + 46)
    const cW = ctx.measureText(cLabel).width

    ctx.fillStyle = '#94a3b8'
    ctx.font = FONT(24, 400)
    ctx.fillText('→', PAD + 24 + cW + 16, y + 46)

    ctx.fillStyle = '#0f172a'
    ctx.font = FONT(26, 400)
    const everydayX = PAD + 24 + cW + 52
    const everyday = truncateToWidth(ctx, m.everyday, CONTENT_W - (everydayX - PAD) - 24)
    ctx.fillText(everyday, everydayX, y + 46)

    y += rowH + 12
  }
  y += 20

  // So basically
  const soBoxTop = y
  ctx.font = FONT(30, 700)
  const soFull = `So basically — ${data.soBasically}`
  const soWrapped = wrapText(ctx, soFull, CONTENT_W - 48)
  const soBoxH = soWrapped.length * 40 + 36
  const soGrad = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
  soGrad.addColorStop(0, 'rgba(245,158,11,0.12)')
  soGrad.addColorStop(1, 'rgba(244,63,94,0.12)')
  ctx.fillStyle = soGrad
  roundRect(ctx, PAD, soBoxTop, CONTENT_W, soBoxH, 16)
  ctx.fill()
  ctx.fillStyle = '#0f172a'
  let sy = soBoxTop + 44
  for (const l of soWrapped) { ctx.fillText(l, PAD + 24, sy); sy += 40 }
  y = soBoxTop + soBoxH + 28

  // Tech note
  ctx.fillStyle = '#64748b'
  ctx.font = FONT(20, 700)
  ctx.fillText('THE REAL THING', PAD, y)
  y += 32
  ctx.font = FONT(26, 400)
  for (const l of techLines) { ctx.fillText(l, PAD, y); y += 36 }
  y += 24

  // Watermark
  ctx.fillStyle = '#0f172a'
  ctx.font = FONT(24, 700)
  ctx.fillText('🛺 Made with Phi Lab', PAD, H - 40)

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), 'image/png'),
  )
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return t + '…'
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Trigger a browser download of the card PNG. */
export async function downloadAnalogyCard(data: AnalogyCardData) {
  const blob = await drawAnalogyCard(data)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `phi-lab-${data.concept.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'analogy'}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
