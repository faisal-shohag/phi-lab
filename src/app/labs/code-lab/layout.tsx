import type { ReactNode } from 'react'
import { JetBrains_Mono, Fira_Code, Source_Code_Pro, IBM_Plex_Mono } from 'next/font/google'

// Curated coding fonts, self-hosted by next/font (no runtime Google fetch). Each
// exposes a CSS variable the editor-settings picker maps to — see
// lib/code-lab/settings.ts CODING_FONTS.
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' })
const fira = Fira_Code({ subsets: ['latin'], variable: '--font-fira-code', display: 'swap' })
const source = Source_Code_Pro({ subsets: ['latin'], variable: '--font-source-code-pro', display: 'swap' })
const ibm = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-ibm-plex-mono', display: 'swap' })

export default function CodeLabLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${jetbrains.variable} ${fira.variable} ${source.variable} ${ibm.variable}`}>
      {children}
    </div>
  )
}
