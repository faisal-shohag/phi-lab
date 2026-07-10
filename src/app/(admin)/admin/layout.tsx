import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/hive/roles'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { AdminBreadcrumb } from '@/components/admin/admin-breadcrumb'

export const metadata: Metadata = {
  title: 'Admin — Phi Lab',
  robots: { index: false, follow: false },
}

// Deliberately NOT wrapped in `data-theme="hive"`: this is a platform-wide
// surface, not a Hive one, so it inherits the default brand from globals.css.
//
// This gate protects the *pages*. It does not protect the API — every route
// under /api/admin re-checks requireAdmin() for itself, because a layout has no
// say over what a fetch can reach.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, error } = await requireAdmin()
  if (error === 'AUTH_REQUIRED') redirect('/sign-in?redirect=/admin')
  if (error || !user) redirect('/')

  return (
    <SidebarProvider>
      <AdminSidebar user={{ name: user.name, email: user.email, image: user.image }} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <AdminBreadcrumb />
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 pt-6 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
