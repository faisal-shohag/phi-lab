import { ImageResponse } from 'next/og'
import QRCode from 'qrcode'
import { getSharedWin } from '@/lib/visualizer/challenge-share'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Challenge victory — Js Motion Lab'

const DIFF_LABEL: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
const MODE_LABEL: Record<string, string> = { oneshot: 'One-shot', retries: 'Retries', timed: 'Timed' }

function baseUrl(): string {
  return process.env.BETTER_AUTH_URL || 'http://localhost:3000'
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const win = await getSharedWin(id)

  const shareUrl = `${baseUrl()}/labs/js-motion/challenge/${id}`
  const qr = await QRCode.toDataURL(shareUrl, { margin: 1, width: 180, color: { dark: '#0a0a0a', light: '#ffffff' } })

  if (!win) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#18181b', color: '#fff', fontSize: 48 }}>
          Js Motion Lab
        </div>
      ),
      size,
    )
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 64,
          background: 'linear-gradient(135deg, #4c0519 0%, #18181b 55%, #431407 100%)', color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 26, fontWeight: 800, letterSpacing: 2, color: '#fda4af', textTransform: 'uppercase' }}>
          <div>⚔ Js Motion Lab</div>
          <div style={{ color: '#71717a', fontSize: 22 }}>· PhiLab</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 90 }}>🏆</div>
          <div style={{ display: 'flex', fontSize: 60, fontWeight: 900, marginTop: 8 }}>{win.name} won a challenge</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
            <div style={{ display: 'flex', background: 'rgba(244,63,94,0.25)', color: '#fecdd3', padding: '10px 22px', borderRadius: 999, fontSize: 30, fontWeight: 700 }}>
              {DIFF_LABEL[win.difficulty] ?? win.difficulty}
            </div>
            <div style={{ display: 'flex', background: 'rgba(249,115,22,0.25)', color: '#fed7aa', padding: '10px 22px', borderRadius: 999, fontSize: 30, fontWeight: 700 }}>
              {MODE_LABEL[win.mode] ?? win.mode}
            </div>
            {win.winStreak > 1 && (
              <div style={{ display: 'flex', background: 'rgba(250,204,21,0.2)', color: '#fde68a', padding: '10px 22px', borderRadius: 999, fontSize: 30, fontWeight: 700 }}>
                🔥 {win.winStreak}-win streak
              </div>
            )}
          </div>
          <div style={{ display: 'flex', fontSize: 76, fontWeight: 900, color: '#34d399', marginTop: 26 }}>+{win.wonXp} XP</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 28, color: '#e4e4e7' }}>Take your own challenge →</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={140} height={140} alt="" style={{ borderRadius: 12, background: '#fff', padding: 6 }} />
        </div>
      </div>
    ),
    size,
  )
}
