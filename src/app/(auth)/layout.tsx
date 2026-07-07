import { BrandPanel } from '@/components/auth/brand-panel'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 lg:grid lg:grid-cols-[1.1fr_1fr] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <BrandPanel />
      <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        {children}
      </div>
    </div>
  )
}
