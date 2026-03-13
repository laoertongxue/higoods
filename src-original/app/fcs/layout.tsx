'use client'

import { usePathname } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { FcsProvider } from '@/lib/fcs/fcs-store'

export default function FCSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  // PDA 路由有自己完整的布局，跳过 AppShell 直接渲染
  if (pathname.startsWith('/fcs/pda')) {
    return <FcsProvider>{children}</FcsProvider>
  }

  return (
    <AppShell systemId="fcs">
      <FcsProvider>
        {children}
      </FcsProvider>
    </AppShell>
  )
}
