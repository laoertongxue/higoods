'use client'

import { useEffect, useMemo, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ClipboardList, ArrowLeftRight, Bell, Play, LogOut, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { getPdaSession, clearPdaSession, useFcs } from '@/lib/fcs/fcs-store'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface PdaLayoutProps {
  children: ReactNode
}

export default function PdaLayout({ children }: PdaLayoutProps) {
  const pathname = usePathname()
  const { toast } = useToast()
  const { state } = useFcs()

  // 开始条件：非 login 页面检查会话
  useEffect(() => {
    if (pathname === '/fcs/pda/login') return
    const session = getPdaSession()
    if (!session.userId || !session.factoryId) {
      window.location.replace('/fcs/pda/login')
    }
  }, [pathname])

  const session = getPdaSession()
  const currentUser = useMemo(
    () => state.factoryUsers.find(u => u.userId === session.userId),
    [state.factoryUsers, session.userId]
  )
  const currentFactory = useMemo(
    () => state.factories.find(f => f.id === session.factoryId),
    [state.factories, session.factoryId]
  )

  const handleLogout = () => {
    clearPdaSession()
    toast({ title: t('pda.auth.login.logout') })
    window.location.replace('/fcs/pda/login')
  }

  const tabs = [
    {
      id: 'tasks',
      label: t('pda.tabBar.tasks'),
      href: '/fcs/pda/task-receive',
      icon: ClipboardList,
      isActive: pathname.startsWith('/fcs/pda/task-receive'),
    },
    {
      id: 'exec',
      label: t('pda.tabBar.exec'),
      href: '/fcs/pda/exec',
      icon: Play,
      isActive: pathname.startsWith('/fcs/pda/exec'),
    },
    {
      id: 'handover',
      label: t('pda.tabBar.handover'),
      href: '/fcs/pda/handover',
      icon: ArrowLeftRight,
      isActive: pathname.startsWith('/fcs/pda/handover'),
    },
    {
      id: 'notify',
      label: t('pda.tabBar.notify'),
      href: '/fcs/pda/notify',
      icon: Bell,
      isActive: pathname.startsWith('/fcs/pda/notify'),
    },
  ]

  // login 页不渲染 TabBar 和身份栏
  const isLoginPage = pathname === '/fcs/pda/login'

  return (
    <div className="relative h-full flex flex-col bg-background overflow-hidden">
      {/* 顶部身份栏 - login 页隐藏 */}
      {!isLoginPage && currentUser && (
        <header className="flex items-center justify-between px-4 py-2 border-b bg-background text-sm shrink-0">
          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
            <User className="h-4 w-4 shrink-0" />
            <span className="font-medium text-foreground truncate">{currentUser.name}</span>
            {currentFactory && (
              <span className="truncate hidden sm:inline">· {currentFactory.name}</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground shrink-0"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-1" />
            {t('pda.auth.login.logout')}
          </Button>
        </header>
      )}

      {/* 主内容区 */}
      <main className={cn('flex-1 overflow-y-auto overflow-x-hidden', !isLoginPage && 'pb-[72px]')}>
        {children}
      </main>

      {/* 底部 TabBar - login 页隐藏 */}
      {!isLoginPage && (
        <nav className="absolute bottom-0 left-0 right-0 h-16 bg-background border-t flex items-center justify-around px-4 z-10">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <a
                key={tab.id}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors',
                  tab.isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{tab.label}</span>
              </a>
            )
          })}
        </nav>
      )}
    </div>
  )
}
