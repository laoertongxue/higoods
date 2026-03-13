'use client'

import { useState, useMemo, useEffect } from 'react'
import { useFcs, type Notification } from '@/lib/fcs/fcs-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Bell, ClipboardList, ArrowLeftRight, Trophy,
  Package, CheckCheck, ChevronRight, AlertTriangle,
  Inbox, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

// Mock 竞价招标单数据（同 dispatch-board 口径）
const MOCK_TENDERS_BIDDING = [
  { tenderId: 'TENDER-0002-001', taskId: 'TASK-0002-002', processName: '裁剪', qty: 800, biddingDeadline: '2026-03-20 18:00' },
]
const MOCK_AWARDED = [
  { tenderId: 'TENDER-0004-001', taskId: 'TASK-0004-002', processName: '车缝', qty: 1200, notifiedAt: '2026-03-09 10:00', awardedPrice: 13200 },
]

export default function PdaNotifyPage() {
  const { toast } = useToast()
  const { state, markNotificationRead, markAllNotificationsRead } = useFcs()

  const [selectedFactoryId, setSelectedFactoryId] = useState<string>('')
  const [activeView, setActiveView] = useState<'todo' | 'inbox'>('todo')
  const [inboxFilter, setInboxFilter] = useState<'unread' | 'all'>('unread')

  useEffect(() => {
    const saved = localStorage.getItem('fcs_pda_factory_id')
    if (saved) setSelectedFactoryId(saved)
  }, [])

  // ── 待接单任务 ──
  const pendingAcceptTasks = useMemo(() => {
    if (!selectedFactoryId) return []
    return state.processTasks.filter(t =>
      t.assignedFactoryId === selectedFactoryId &&
      t.assignmentMode === 'DIRECT' &&
      (!t.acceptanceStatus || t.acceptanceStatus === 'PENDING')
    )
  }, [selectedFactoryId, state.processTasks])

  // ── 待领料 ──
  const pendingMaterialTasks = useMemo(() => {
    if (!selectedFactoryId) return []
    return state.processTasks.filter(t =>
      t.assignedFactoryId === selectedFactoryId &&
      t.acceptanceStatus === 'ACCEPTED' &&
      (!t.status || t.status === 'NOT_STARTED')
    )
  }, [selectedFactoryId, state.processTasks])

  // ── 待接收（handover 待确认） ──
  const pendingHandoverEvents = useMemo(() => {
    if (!selectedFactoryId) return []
    return state.handoverEvents.filter(e =>
      e.toParty.kind === 'FACTORY' &&
      e.toParty.id === selectedFactoryId &&
      e.status === 'PENDING_CONFIRM'
    )
  }, [selectedFactoryId, state.handoverEvents])

  // ── 待交出（进行中任务，可完工） ──
  const inProgressTasks = useMemo(() => {
    if (!selectedFactoryId) return []
    return state.processTasks.filter(t =>
      t.assignedFactoryId === selectedFactoryId &&
      t.acceptanceStatus === 'ACCEPTED' &&
      t.status === 'IN_PROGRESS'
    )
  }, [selectedFactoryId, state.processTasks])

  // ── 未读通知 ──
  const unreadNotifications = useMemo(() => {
    if (!selectedFactoryId) return []
    return state.notifications.filter(n =>
      n.recipientType === 'FACTORY' &&
      n.recipientId === selectedFactoryId &&
      !n.readAt
    )
  }, [selectedFactoryId, state.notifications])

  // ── 所有通知（inbox） ──
  const factoryNotifications = useMemo(() => {
    if (!selectedFactoryId) return []
    return state.notifications
      .filter(n =>
        n.recipientType === 'FACTORY' &&
        n.recipientId === selectedFactoryId &&
        (inboxFilter === 'all' || !n.readAt)
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [selectedFactoryId, state.notifications, inboxFilter])

  const handleNotificationClick = (n: Notification) => {
    if (!n.readAt) markNotificationRead(n.notificationId)
    if (n.deepLink?.path) {
      const q = n.deepLink.query
      const qs = q ? '?' + Object.entries(q).map(([k, v]) => `${k}=${v}`).join('&') : ''
      window.location.href = n.deepLink.path + qs
    } else if (n.related?.taskId) {
      window.location.href = `/fcs/pda/exec/${n.related.taskId}`
    }
  }

  const handleMarkAllRead = () => {
    markAllNotificationsRead()
    toast({ title: '已将所有通知标记为已读' })
  }

  // ── 聚合卡片数据 ──
  const summaryCards = [
    {
      key: 'pendingAccept',
      label: '待接单任务',
      count: pendingAcceptTasks.length,
      icon: ClipboardList,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      href: '/fcs/pda/task-receive?tab=pending-accept',
    },
    {
      key: 'pendingQuote',
      label: '待报价招标单',
      count: MOCK_TENDERS_BIDDING.length,
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/fcs/pda/task-receive?tab=pending-quote',
    },
    {
      key: 'awarded',
      label: '已中标任务',
      count: MOCK_AWARDED.length,
      icon: Trophy,
      color: 'text-green-600',
      bg: 'bg-green-50',
      href: '/fcs/pda/task-receive?tab=awarded',
    },
    {
      key: 'pendingMaterial',
      label: '待领料',
      count: pendingMaterialTasks.length,
      icon: Package,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      href: '/fcs/pda/exec',
    },
    {
      key: 'pendingReceive',
      label: '待接收',
      count: pendingHandoverEvents.length,
      icon: ArrowLeftRight,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      href: '/fcs/pda/handover',
    },
    {
      key: 'pendingHandout',
      label: '待交出',
      count: inProgressTasks.length,
      icon: ArrowLeftRight,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      href: '/fcs/pda/exec',
    },
    {
      key: 'unreadNotify',
      label: '未读通知',
      count: unreadNotifications.length,
      icon: Bell,
      color: 'text-red-600',
      bg: 'bg-red-50',
      href: '#inbox',
      onClick: () => setActiveView('inbox'),
    },
  ]

  const totalTodo = summaryCards.slice(0, 6).reduce((s, c) => s + c.count, 0)

  if (!selectedFactoryId) {
    return (
      <div className="p-4">
        <h1 className="text-lg font-semibold mb-4">待办</h1>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            请先登录工厂账号
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* 顶部 Tab 切换 */}
      <header className="sticky top-0 z-40 bg-background border-b px-4 pt-3 pb-0">
        <h1 className="text-lg font-semibold mb-3">待办工作台</h1>
        <div className="flex gap-0">
          <button
            onClick={() => setActiveView('todo')}
            className={cn(
              'flex-1 py-2 text-sm font-medium border-b-2 transition-colors',
              activeView === 'todo'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground'
            )}
          >
            待办
            {totalTodo > 0 && (
              <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-[10px]">{totalTodo}</Badge>
            )}
          </button>
          <button
            onClick={() => setActiveView('inbox')}
            className={cn(
              'flex-1 py-2 text-sm font-medium border-b-2 transition-colors',
              activeView === 'inbox'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground'
            )}
          >
            通知
            {unreadNotifications.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-[10px]">{unreadNotifications.length}</Badge>
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 p-4 space-y-4">
        {/* ── 待办视图 ── */}
        {activeView === 'todo' && (
          <>
            {totalTodo === 0 && unreadNotifications.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Check className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">暂无待办事项</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {summaryCards.map(card => {
                  const Icon = card.icon
                  const handleClick = card.onClick
                    ? card.onClick
                    : () => { window.location.href = card.href }
                  return (
                    <button
                      key={card.key}
                      onClick={handleClick}
                      className="text-left"
                    >
                      <Card className={cn(
                        'hover:border-primary transition-colors',
                        card.count > 0 ? 'border-current' : ''
                      )}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className={cn('p-2 rounded-lg shrink-0', card.bg)}>
                            <Icon className={cn('h-4 w-4', card.color)} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground leading-tight truncate">{card.label}</p>
                            <p className={cn(
                              'text-xl font-bold tabular-nums leading-tight',
                              card.count > 0 ? card.color : 'text-foreground'
                            )}>
                              {card.count}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                        </CardContent>
                      </Card>
                    </button>
                  )
                })}
              </div>
            )}

            {/* 快速入口 */}
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">快捷入口</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '接单与报价', href: '/fcs/pda/task-receive', icon: ClipboardList },
                  { label: '生产执行', href: '/fcs/pda/exec', icon: Package },
                  { label: '交接确认', href: '/fcs/pda/handover', icon: ArrowLeftRight },
                ].map(item => {
                  const Icon = item.icon
                  return (
                    <a key={item.href} href={item.href}>
                      <Card className="hover:border-primary transition-colors">
                        <CardContent className="p-3 flex flex-col items-center gap-1.5 text-center">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{item.label}</span>
                        </CardContent>
                      </Card>
                    </a>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ── 通知视图 ── */}
        {activeView === 'inbox' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {(['unread', 'all'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setInboxFilter(f)}
                    className={cn(
                      'text-sm px-3 py-1 rounded-full border transition-colors',
                      inboxFilter === f
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'text-muted-foreground border-border'
                    )}
                  >
                    {f === 'unread' ? '未读' : '全部'}
                  </button>
                ))}
              </div>
              {unreadNotifications.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                  <CheckCheck className="h-4 w-4 mr-1" />
                  全部已读
                </Button>
              )}
            </div>

            {factoryNotifications.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Inbox className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无通知</p>
              </div>
            ) : (
              factoryNotifications.map(n => (
                <Card
                  key={n.notificationId}
                  className={cn(
                    'cursor-pointer hover:border-primary transition-colors',
                    !n.readAt && 'border-l-4 border-l-primary'
                  )}
                  onClick={() => handleNotificationClick(n)}
                >
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {n.level === 'CRITICAL' && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">紧急</Badge>}
                        {n.level === 'WARN' && <Badge className="bg-amber-500 text-[10px] px-1.5 py-0">警告</Badge>}
                        {n.level === 'INFO' && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">通知</Badge>}
                        {!n.readAt && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{n.createdAt.slice(0, 16)}</span>
                    </div>
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                    {n.deepLink?.path && (
                      <p className="text-xs text-primary">点击查看详情</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
