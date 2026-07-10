'use client'

import { usePathname } from 'next/navigation'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { navItemFor } from './nav'

export function AdminBreadcrumb() {
  const pathname = usePathname()
  const item = navItemFor(pathname)
  const onOverview = pathname === '/admin'

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          {onOverview ? <BreadcrumbPage>Admin</BreadcrumbPage> : <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>}
        </BreadcrumbItem>
        {!onOverview && item ? (
          <>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{item.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
