// Renders a shareable profile card to a PNG on a <canvas>, independent of the
// DOM/theme, so the downloaded image always looks the same. Modeled on the
// analogies card drawer. No external deps.

export interface ProfileCardData {
  name: string
  headline: string | null
  /** 1-2 letter avatar fallback. */
  initials: string
  level: number
  title: string
  xp: number
  badgeCount: number
  /** Public profile URL, drawn as a footer watermark. */
  url: string
}

const W = 1080
const H = 566
const PAD = 72

const FONT = (size: number, weight = 400) =>
  `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Bengali", sans-serif`

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return t + '…'
}

/** Draw the profile card and return a PNG blob. */
export async function drawProfileCard(data: ProfileCardData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Background: brand gradient (amber → fuchsia → violet).
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#f59e0b')
  grad.addColorStop(0.5, '#d946ef')
  grad.addColorStop(1, '#7c3aed')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  ctx.textBaseline = 'alphabetic'

  // Avatar circle with initials.
  const avX = PAD + 70
  const avY = PAD + 70
  const avR = 70
  ctx.beginPath()
  ctx.arc(avX, avY, avR, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = FONT(56, 800)
  ctx.textAlign = 'center'
  ctx.fillText(data.initials, avX, avY + 20)
  ctx.textAlign = 'left'

  // Name + headline, right of the avatar.
  const textX = avX + avR + 36
  ctx.fillStyle = '#ffffff'
  ctx.font = FONT(52, 800)
  ctx.fillText(truncateToWidth(ctx, data.name, W - textX - PAD), textX, avY - 6)
  if (data.headline) {
    ctx.font = FONT(28, 500)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillText(truncateToWidth(ctx, data.headline, W - textX - PAD), textX, avY + 40)
  }

  // Stat tiles row.
  const tiles = [
    { big: String(data.level), small: data.title.toUpperCase() },
    { big: data.xp.toLocaleString(), small: 'TOTAL XP' },
    { big: String(data.badgeCount), small: 'BADGES' },
  ]
  const tileTop = 260
  const gap = 24
  const tileW = (W - PAD * 2 - gap * (tiles.length - 1)) / tiles.length
  const tileH = 150
  tiles.forEach((t, i) => {
    const x = PAD + i * (tileW + gap)
    roundRect(ctx, x, tileTop, tileW, tileH, 24)
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = FONT(60, 800)
    ctx.textAlign = 'center'
    ctx.fillText(truncateToWidth(ctx, t.big, tileW - 24), x + tileW / 2, tileTop + 78)
    ctx.font = FONT(20, 700)
    ctx.fillStyle = 'rgba(255,255,255,0.82)'
    ctx.fillText(truncateToWidth(ctx, t.small, tileW - 24), x + tileW / 2, tileTop + 116)
    ctx.textAlign = 'left'
  })

  // Footer watermark.
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = FONT(26, 700)
  ctx.fillText('φ  Phi Lab', PAD, H - 44)
  ctx.font = FONT(22, 500)
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.textAlign = 'right'
  ctx.fillText(truncateToWidth(ctx, data.url.replace(/^https?:\/\//, ''), 560), W - PAD, H - 44)
  ctx.textAlign = 'left'

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), 'image/png'),
  )
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

/** Trigger a browser download of the profile card PNG. */
export async function downloadProfileCard(data: ProfileCardData) {
  const blob = await drawProfileCard(data)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `phi-lab-${data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'profile'}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
