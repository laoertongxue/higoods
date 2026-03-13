'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import {
  ClipboardList, ArrowLeftRight, Play, LogOut, User, Wallet, Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPdaSession, clearPdaSession, useFcs } from '@/lib/fcs/fcs-store'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

const TABS = [
  { id: 'notify',       label: '待办', href: '/fcs/pda/notify',      icon: Bell },
  { id: 'task-receive', label: '接单', href: '/fcs/pda/task-receive', icon: ClipboardList },
  { id: 'exec',         label: '执行', href: '/fcs/pda/exec',         icon: Play },
  { id: 'handover',     label: '交接', href: '/fcs/pda/handover',     icon: ArrowLeftRight },
  { id: 'settlement',   label: '结算', href: '/fcs/pda/settlement',   icon: Wallet },
] as const

export default function PdaWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { toast } = useToast()
  const { state } = useFcs()
  const isLoginPage = pathname === '/fcs/pda/login'

  // Hydration guard: getPdaSession() reads localStorage which only exists
  // on the client. Without this guard, the server renders without <header>
  // (no session) but the client renders WITH <header> (has session),
  // causing the hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Auth guard
  useEffect(() => {
    if (isLoginPage) return
    const s = getPdaSession()
    if (!s.userId || !s.factoryId) {
      window.location.replace('/fcs/pda/login')
    }
  }, [isLoginPage])

  // Only read session after mount to avoid server/client divergence
  const session = useMemo(
    () => mounted ? getPdaSession() : { userId: '', factoryId: '' },
    [mounted],
  )
  const currentUser = useMemo(
    () => session.userId ? state.factoryUsers.find(u => u.userId === session.userId) : undefined,
    [state.factoryUsers, session.userId],
  )
  const currentFactory = useMemo(
    () => session.factoryId ? state.factories.find(f => f.id === session.factoryId) : undefined,
    [state.factories, session.factoryId],
  )

  const handleLogout = () => {
    clearPdaSession()
    toast({ title: '已退出登录' })
    window.location.replace('/fcs/pda/login')
  }

  if (isLoginPage) {
    return (
      <div className="relative h-full flex flex-col bg-background overflow-hidden">
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="relative h-full flex flex-col bg-background overflow-hidden">
      {/* Header — only render after mount so server & client initial render match */}
      {mounted && currentUser && (
        <header className="flex items-center justify-between px-4 py-2 border-b bg-background text-sm shrink-0">
          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
            <User className="h-4 w-4 shrink-0" />
            <span className="font-medium text-foreground truncate">{currentUser.name}</span>
            {currentFactory && (
              <span className="truncate hidden sm:inline">· {currentFactory.name}</span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground shrink-0" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" />
            退出
          </Button>
        </header>
      )}

      {/* Page content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-[72px]">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="absolute bottom-0 left-0 right-0 h-[72px] bg-background border-t flex items-center justify-around px-1 z-10">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive =
            tab.id === 'notify'
              ? pathname.startsWith('/fcs/pda/notify') || pathname === '/fcs/pda'
              : pathname.startsWith(tab.href)
          return (
            <a
              key={tab.id}
              href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 px-1 py-2 rounded-lg transition-colors min-w-0 flex-1',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-[10px] font-medium leading-tight text-center">{tab.label}</span>
            </a>
          )
        })}
      </nav>
    </div>
  )
}
