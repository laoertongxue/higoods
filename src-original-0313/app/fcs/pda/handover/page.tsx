'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowRight, Package, ChevronRight, Warehouse, Factory } from 'lucide-react'
import { getPdaSession } from '@/lib/fcs/fcs-store'
import { cn } from '@/lib/utils'

// ─── Mock 数据类型 ────────────────────────────────────────────────
type HandoverAction = 'PICKUP' | 'RECEIVE' | 'HANDOUT'
type HandoverStatus = 'PENDING' | 'CONFIRMED' | 'DISPUTED'

interface HandoverEvent {
  eventId: string
  action: HandoverAction
  taskId: string
  productionOrderId: string
  currentProcess: string
  prevProcess?: string       // 非首道工序才有
  isFirstProcess: boolean
  fromPartyKind: 'WAREHOUSE' | 'FACTORY'
  fromPartyName: string
  toPartyKind: 'WAREHOUSE' | 'FACTORY'
  toPartyName: string
  qtyExpected: number
  qtyActual?: number
  qtyUnit: string
  qtyDiff?: number           // 差异数量
  diffReason?: string        // 差异原因
  deadlineTime: string
  status: HandoverStatus
  confirmedAt?: string
  qcResult?: 'PASS' | 'FAIL'
  qcDefectQty?: number
  qcProblemType?: string     // 问题类型
  qcProblemDesc?: string     // 问题说明
  factoryId: string          // 操作方工厂ID，用于过滤
}

// ─── Mock 数据 — 全部指向 ID-F001 (PT Sinar Garment Indonesia) ────
const MOCK_EVENTS: HandoverEvent[] = [
  // ═══════════ 待领料 (PICKUP / PENDING) — 首道工序从仓库领取 ═══════════
  {
    eventId: 'EV-PK-001',
    action: 'PICKUP',
    taskId: 'PDA-EXEC-001',
    productionOrderId: 'PO-2024-0012',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'WAREHOUSE',
    fromPartyName: '雅加达中央面料仓',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 1800,
    qtyUnit: '件',
    deadlineTime: '2026-03-14 10:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-PK-002',
    action: 'PICKUP',
    taskId: 'PDA-EXEC-002',
    productionOrderId: 'PO-2024-0013',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'WAREHOUSE',
    fromPartyName: '泗水辅料仓',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 2200,
    qtyUnit: '件',
    deadlineTime: '2026-03-16 09:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-PK-003',
    action: 'PICKUP',
    taskId: 'PDA-EXEC-005',
    productionOrderId: 'PO-2024-0015',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'WAREHOUSE',
    fromPartyName: '雅加达中央面料仓',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 900,
    qtyUnit: '件',
    deadlineTime: '2026-03-15 14:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-PK-004',
    action: 'PICKUP',
    taskId: 'PDA-EXEC-007',
    productionOrderId: 'PO-2024-0017',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'WAREHOUSE',
    fromPartyName: '万隆织带辅料仓',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 2500,
    qtyUnit: '件',
    qtyDiff: 50,
    diffReason: '仓库库存不足，差 50 件待补货',
    deadlineTime: '2026-03-13 16:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
  },

  // ═══════════ 待接收 (RECEIVE / PENDING) — 非首道工序从上游工厂接收 ═══════════
  {
    eventId: 'EV-RC-001',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-003',
    productionOrderId: 'PO-2024-0012',
    currentProcess: '车缝',
    prevProcess: '裁片',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '泗水裁片厂',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 1800,
    qtyUnit: '件',
    deadlineTime: '2026-03-15 14:00',
    status: 'PENDING',
    qcResult: 'PASS',
    qcDefectQty: 0,
    qcProblemType: '',
    qcProblemDesc: '',
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-RC-002',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-004',
    productionOrderId: 'PO-2024-0014',
    currentProcess: '整烫',
    prevProcess: '车缝',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '万隆车缝厂',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 1200,
    qtyUnit: '件',
    deadlineTime: '2026-03-14 10:00',
    status: 'PENDING',
    qcResult: 'PASS',
    qcDefectQty: 0,
    qcProblemType: '',
    qcProblemDesc: '',
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-RC-003',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-006',
    productionOrderId: 'PO-2024-0016',
    currentProcess: '车缝',
    prevProcess: '裁片',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '棉兰卫星工厂',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 1500,
    qtyUnit: '件',
    deadlineTime: '2026-03-17 11:00',
    status: 'PENDING',
    qcResult: 'FAIL',
    qcDefectQty: 45,
    qcProblemType: '裁片尺寸偏差',
    qcProblemDesc: '前片肩宽偏大 1.5cm，45 件超差需退回重裁',
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-RC-004',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-010',
    productionOrderId: 'PO-2024-0020',
    currentProcess: '车缝',
    prevProcess: '裁片',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '日惹裁片分厂',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 3000,
    qtyUnit: '件',
    deadlineTime: '2026-03-16 09:00',
    status: 'PENDING',
    qcResult: 'FAIL',
    qcDefectQty: 82,
    qcProblemType: '布料色差',
    qcProblemDesc: '第 3 批次面料色差明显（浅色偏黄），82 件需隔离复检',
    factoryId: 'ID-F001',
  },

  // ═══════════ 待交出 (HANDOUT / PENDING) — 当前工厂完工后交出 ═══════════
  // 交给下一道工序工厂
  {
    eventId: 'EV-HO-001',
    action: 'HANDOUT',
    taskId: 'PDA-EXEC-014',
    productionOrderId: 'PO-2024-0024',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'FACTORY',
    fromPartyName: 'PT Sinar Garment Indonesia',
    toPartyKind: 'FACTORY',
    toPartyName: '万隆车缝厂',
    qtyExpected: 2000,
    qtyUnit: '件',
    deadlineTime: '2026-03-16 18:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-HO-002',
    action: 'HANDOUT',
    taskId: 'PDA-EXEC-016',
    productionOrderId: 'PO-2024-0026',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'FACTORY',
    fromPartyName: 'PT Sinar Garment Indonesia',
    toPartyKind: 'FACTORY',
    toPartyName: '泗水车缝厂',
    qtyExpected: 1100,
    qtyUnit: '件',
    deadlineTime: '2026-03-14 18:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
  },
  // 交给仓库
  {
    eventId: 'EV-HO-003',
    action: 'HANDOUT',
    taskId: 'PDA-EXEC-015',
    productionOrderId: 'PO-2024-0025',
    currentProcess: '包装',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: 'PT Sinar Garment Indonesia',
    toPartyKind: 'WAREHOUSE',
    toPartyName: '雅加达成品仓库',
    qtyExpected: 1500,
    qtyUnit: '件',
    deadlineTime: '2026-03-15 17:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-HO-004',
    action: 'HANDOUT',
    taskId: 'PDA-EXEC-017',
    productionOrderId: 'PO-2024-0027',
    currentProcess: '包装',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: 'PT Sinar Garment Indonesia',
    toPartyKind: 'WAREHOUSE',
    toPartyName: '泗水成品仓库',
    qtyExpected: 950,
    qtyUnit: '件',
    deadlineTime: '2026-03-13 17:00',
    status: 'PENDING',
    factoryId: 'ID-F001',
  },

  // ═══════════ 已处理 / 争议 (CONFIRMED / DISPUTED) ═══════════
  // 已确认领料 x2
  {
    eventId: 'EV-PK-DONE-001',
    action: 'PICKUP',
    taskId: 'PDA-EXEC-007',
    productionOrderId: 'PO-2024-0017',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'WAREHOUSE',
    fromPartyName: '雅加达中央面料仓',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 2500,
    qtyActual: 2500,
    qtyUnit: '件',
    deadlineTime: '2026-03-09 10:00',
    status: 'CONFIRMED',
    confirmedAt: '2026-03-09 09:15',
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-PK-DONE-002',
    action: 'PICKUP',
    taskId: 'PDA-EXEC-011',
    productionOrderId: 'PO-2024-0021',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'WAREHOUSE',
    fromPartyName: '泗水辅料仓',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 1300,
    qtyActual: 1300,
    qtyUnit: '件',
    deadlineTime: '2026-03-08 14:00',
    status: 'CONFIRMED',
    confirmedAt: '2026-03-08 11:30',
    factoryId: 'ID-F001',
  },
  // 已确认接收 x2
  {
    eventId: 'EV-RC-DONE-001',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-008',
    productionOrderId: 'PO-2024-0018',
    currentProcess: '车缝',
    prevProcess: '裁片',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '泗水裁片厂',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 1600,
    qtyActual: 1600,
    qtyUnit: '件',
    deadlineTime: '2026-03-08 14:00',
    status: 'CONFIRMED',
    confirmedAt: '2026-03-08 13:20',
    qcResult: 'PASS',
    qcDefectQty: 0,
    factoryId: 'ID-F001',
  },
  {
    eventId: 'EV-RC-DONE-002',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-009',
    productionOrderId: 'PO-2024-0019',
    currentProcess: '整烫',
    prevProcess: '车缝',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '万隆车缝厂',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 800,
    qtyActual: 795,
    qtyUnit: '件',
    qtyDiff: 5,
    diffReason: '运输破损 5 件，已拍照存档',
    deadlineTime: '2026-03-07 16:00',
    status: 'CONFIRMED',
    confirmedAt: '2026-03-07 15:10',
    qcResult: 'PASS',
    qcDefectQty: 0,
    factoryId: 'ID-F001',
  },
  // 已确认交出 x1
  {
    eventId: 'EV-HO-DONE-001',
    action: 'HANDOUT',
    taskId: 'PDA-EXEC-016',
    productionOrderId: 'PO-2024-0026',
    currentProcess: '裁片',
    isFirstProcess: true,
    fromPartyKind: 'FACTORY',
    fromPartyName: 'PT Sinar Garment Indonesia',
    toPartyKind: 'FACTORY',
    toPartyName: '泗水车缝厂',
    qtyExpected: 1100,
    qtyActual: 1100,
    qtyUnit: '件',
    deadlineTime: '2026-03-09 18:00',
    status: 'CONFIRMED',
    confirmedAt: '2026-03-09 16:40',
    factoryId: 'ID-F001',
  },
  // 争议中 — 数量差异
  {
    eventId: 'EV-RC-DISP-001',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-012',
    productionOrderId: 'PO-2024-0022',
    currentProcess: '车缝',
    prevProcess: '裁片',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '棉兰卫星工厂',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 1000,
    qtyActual: 965,
    qtyUnit: '件',
    qtyDiff: 35,
    diffReason: '实收少 35 件，上游称已全数发出，正在核查物流记录',
    deadlineTime: '2026-03-10 14:00',
    status: 'DISPUTED',
    qcResult: 'FAIL',
    qcDefectQty: 35,
    qcProblemType: '数量短缺',
    qcProblemDesc: '实收 965 件，应收 1000 件，差 35 件。上游坚称全数发出，需核对物流签收单',
    factoryId: 'ID-F001',
  },
  // 争议中 — 质量不合格
  {
    eventId: 'EV-RC-DISP-002',
    action: 'RECEIVE',
    taskId: 'PDA-EXEC-013',
    productionOrderId: 'PO-2024-0023',
    currentProcess: '整烫',
    prevProcess: '车缝',
    isFirstProcess: false,
    fromPartyKind: 'FACTORY',
    fromPartyName: '日惹车缝分厂',
    toPartyKind: 'FACTORY',
    toPartyName: 'PT Sinar Garment Indonesia',
    qtyExpected: 700,
    qtyActual: 700,
    qtyUnit: '件',
    deadlineTime: '2026-03-11 10:00',
    status: 'DISPUTED',
    qcResult: 'FAIL',
    qcDefectQty: 48,
    qcProblemType: '缝制质量不合格',
    qcProblemDesc: '48 件车缝线迹不均匀、跳针严重，需退回返工。上游工厂不认可质检结论，要求第三方复检',
    factoryId: 'ID-F001',
  },
]

// ─── 辅助函数 ────────────────────────────────────────────────────
const ACTION_LABELS: Record<HandoverAction, string> = {
  PICKUP: '领料',
  RECEIVE: '接收',
  HANDOUT: '交出',
}

const STATUS_LABELS: Record<HandoverStatus, string> = {
  PENDING: '待处理',
  CONFIRMED: '已确认',
  DISPUTED: '争议中',
}

function deadlineBadge(deadline: string, status: HandoverStatus) {
  if (status !== 'PENDING') return null
  const diff = new Date(deadline.replace(' ', 'T')).getTime() - Date.now()
  const hours = diff / 3600000
  if (diff < 0) return { label: '已逾期', className: 'border-destructive text-destructive' }
  if (hours < 4) return { label: '即将逾期', className: 'border-amber-400 text-amber-600' }
  return null
}

function PartyChip({ kind, name }: { kind: 'WAREHOUSE' | 'FACTORY'; name: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      {kind === 'WAREHOUSE'
        ? <Warehouse className="h-3 w-3 text-muted-foreground shrink-0" />
        : <Factory className="h-3 w-3 text-muted-foreground shrink-0" />}
      <span>{name}</span>
    </span>
  )
}

interface EventCardProps {
  event: HandoverEvent
  onAction?: () => void
  actionLabel?: string
}

function EventCard({ event, onAction, actionLabel }: EventCardProps) {
  const dl = deadlineBadge(event.deadlineTime, event.status)
  return (
    <Card
      className="cursor-pointer hover:border-primary transition-colors"
      onClick={() => window.location.href = `/fcs/pda/handover/${event.eventId}`}
    >
      <CardContent className="p-3 space-y-2">
        {/* 头部行 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="font-mono text-xs text-muted-foreground truncate">{event.eventId}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
              {ACTION_LABELS[event.action]}
            </Badge>
            {dl && (
              <Badge variant="outline" className={cn('text-[10px] px-1.5 shrink-0', dl.className)}>
                {dl.label}
              </Badge>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>

        {/* 字段 */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <div><span className="text-muted-foreground">任务编号：</span>{event.taskId}</div>
          <div><span className="text-muted-foreground">生产单号：</span>{event.productionOrderId}</div>
          {event.prevProcess && (
            <div><span className="text-muted-foreground">上一道工序：</span>{event.prevProcess}</div>
          )}
          <div><span className="text-muted-foreground">当前工序：</span>{event.currentProcess}</div>
        </div>

        {/* 来源方 → 去向方 */}
        <div className="flex items-center gap-2 text-xs py-0.5">
          <span className="text-muted-foreground shrink-0">来源方：</span>
          <PartyChip kind={event.fromPartyKind} name={event.fromPartyName} />
          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground shrink-0">去向方：</span>
          <PartyChip kind={event.toPartyKind} name={event.toPartyName} />
        </div>

        {/* 数量 + 截止 */}
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3 text-muted-foreground" />
            {event.action === 'PICKUP' ? '应领' : event.action === 'RECEIVE' ? '应收' : '应交'}：
            <span className="font-medium">{event.qtyExpected} {event.qtyUnit}</span>
          </span>
          {event.qtyActual != null && (
            <span>
              实际：<span className="font-medium">{event.qtyActual} {event.qtyUnit}</span>
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground">
          要求时间：{event.deadlineTime}
        </div>

        {/* 差异提示 */}
        {event.qtyDiff != null && event.qtyDiff > 0 && (
          <div className="rounded bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-700 space-y-0.5">
            <div className="font-medium">{'差异数量：'}{event.qtyDiff} {event.qtyUnit}</div>
            {event.diffReason && <div>{event.diffReason}</div>}
          </div>
        )}

        {/* 质检结果（接收类） */}
        {event.action === 'RECEIVE' && event.qcResult && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">质检结论：</span>
              <Badge variant={event.qcResult === 'PASS' ? 'default' : 'destructive'} className="text-[10px] px-1.5">
                {event.qcResult === 'PASS' ? '合格' : '不合格'}
              </Badge>
              {event.qcDefectQty != null && event.qcDefectQty > 0 && (
                <span className="text-destructive">不合格 {event.qcDefectQty} {event.qtyUnit}</span>
              )}
            </div>
            {event.qcProblemType && (
              <div className="text-xs text-muted-foreground">
                {'问题类型：'}{event.qcProblemType}
              </div>
            )}
            {event.qcProblemDesc && (
              <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                {event.qcProblemDesc}
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        {onAction && actionLabel && (
          <Button
            size="sm"
            className="w-full h-8 text-xs mt-1"
            onClick={e => { e.stopPropagation(); onAction() }}
          >
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// ─── 主页面 ──────────────────────────────────────────────────────
export default function PdaHandoverPage() {
  const [activeTab, setActiveTab] = useState('pickup')
  const [mounted, setMounted] = useState(false)
  const [factoryId, setFactoryId] = useState('')

  useEffect(() => {
    setMounted(true)
    const session = getPdaSession()
    if (session.factoryId) setFactoryId(session.factoryId)
    else {
      const stored = localStorage.getItem('fcs_pda_factory_id')
      if (stored) setFactoryId(stored)
    }
  }, [])

  // 按工厂和动作类型过滤
  // 所有 mock 数据均指向 ID-F001，未登录时也显示全部以便演示
  const matchFactory = (e: HandoverEvent) =>
    !factoryId || e.factoryId === factoryId

  const pickupEvents = MOCK_EVENTS.filter(e =>
    e.action === 'PICKUP' && e.status === 'PENDING' && matchFactory(e))
  const receiveEvents = MOCK_EVENTS.filter(e =>
    e.action === 'RECEIVE' && e.status === 'PENDING' && matchFactory(e))
  const handoutEvents = MOCK_EVENTS.filter(e =>
    e.action === 'HANDOUT' && e.status === 'PENDING' && matchFactory(e))
  const doneEvents = MOCK_EVENTS.filter(e =>
    (e.status === 'CONFIRMED' || e.status === 'DISPUTED') && matchFactory(e))

  const tabCounts = {
    pickup: pickupEvents.length,
    receive: receiveEvents.length,
    handout: handoutEvents.length,
    done: doneEvents.length,
  }

  const EmptyState = ({ message }: { message: string }) => (
    <div className="py-10 text-center text-sm text-muted-foreground">{message}</div>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2 shrink-0">
        <h1 className="text-lg font-semibold mb-3">交接</h1>

        {/* 摘要卡 */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {[
            { key: 'pickup', label: '待领料', count: tabCounts.pickup },
            { key: 'receive', label: '待接收', count: tabCounts.receive },
            { key: 'handout', label: '待交出', count: tabCounts.handout },
            { key: 'done', label: '已处理', count: tabCounts.done },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={cn(
                'rounded-lg p-2 text-center border transition-colors',
                activeTab === item.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/40 border-transparent'
              )}
            >
              <p className="text-base font-bold tabular-nums">{item.count}</p>
              <p className="text-[9px] leading-tight mt-0.5 opacity-80">{item.label}</p>
            </button>
          ))}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 shrink-0 grid grid-cols-4 h-9">
          <TabsTrigger value="pickup" className="text-xs">待领料</TabsTrigger>
          <TabsTrigger value="receive" className="text-xs">待接收</TabsTrigger>
          <TabsTrigger value="handout" className="text-xs">待交出</TabsTrigger>
          <TabsTrigger value="done" className="text-xs">已处理/争议</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 space-y-3">
          <TabsContent value="pickup" className="mt-0 space-y-3">
            <p className="text-xs text-muted-foreground">
              首道工序工厂从仓库领取面辅料。领料完成后，具备开工条件。
            </p>
            {pickupEvents.length === 0
              ? <EmptyState message="暂无待领料事项" />
              : pickupEvents.map(e => (
                <EventCard
                  key={e.eventId}
                  event={e}
                  actionLabel="确认领料"
                  onAction={() => window.location.href = `/fcs/pda/handover/${e.eventId}`}
                />
              ))
            }
          </TabsContent>

          <TabsContent value="receive" className="mt-0 space-y-3">
            <p className="text-xs text-muted-foreground">
              非首道工序工厂接收上一道工序的半成品。接收须完成数量确认与到货质检，接收完成后具备开工条件。
            </p>
            {receiveEvents.length === 0
              ? <EmptyState message="暂无待接收事项" />
              : receiveEvents.map(e => (
                <EventCard
                  key={e.eventId}
                  event={e}
                  actionLabel="进入接收确认"
                  onAction={() => window.location.href = `/fcs/pda/handover/${e.eventId}`}
                />
              ))
            }
          </TabsContent>

          <TabsContent value="handout" className="mt-0 space-y-3">
            <p className="text-xs text-muted-foreground">
              当前工厂完成本道工序后，将半成品交给下一节点（工厂或仓库）。
            </p>
            {handoutEvents.length === 0
              ? <EmptyState message="暂无待交出事项" />
              : handoutEvents.map(e => (
                <EventCard
                  key={e.eventId}
                  event={e}
                  actionLabel="确认交出"
                  onAction={() => window.location.href = `/fcs/pda/handover/${e.eventId}`}
                />
              ))
            }
          </TabsContent>

          <TabsContent value="done" className="mt-0 space-y-3">
            {doneEvents.length === 0
              ? <EmptyState message="暂无已处理记录" />
              : doneEvents.map(e => (
                <Card
                  key={e.eventId}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => window.location.href = `/fcs/pda/handover/${e.eventId}`}
                >
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{e.eventId}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5">{ACTION_LABELS[e.action]}</Badge>
                        <Badge
                          variant={e.status === 'DISPUTED' ? 'destructive' : 'default'}
                          className="text-[10px] px-1.5"
                        >
                          {STATUS_LABELS[e.status]}
                        </Badge>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <PartyChip kind={e.fromPartyKind} name={e.fromPartyName} />
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <PartyChip kind={e.toPartyKind} name={e.toPartyName} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>数量：{e.qtyActual ?? e.qtyExpected} {e.qtyUnit}</span>
                      {e.qtyDiff != null && e.qtyDiff > 0 && (
                        <span className="text-amber-600">差异 {e.qtyDiff} {e.qtyUnit}</span>
                      )}
                      {e.action === 'RECEIVE' && e.qcResult && (
                        <span>
                          质检：
                          <span className={e.qcResult === 'PASS' ? 'text-green-600' : 'text-destructive'}>
                            {e.qcResult === 'PASS' ? '合格' : '不合格'}
                          </span>
                          {e.qcDefectQty != null && e.qcDefectQty > 0 && (
                            <span className="text-destructive ml-1">({e.qcDefectQty} {e.qtyUnit})</span>
                          )}
                        </span>
                      )}
                      {e.confirmedAt && <span>确认于 {e.confirmedAt}</span>}
                    </div>
                    {e.status === 'DISPUTED' && e.qcProblemDesc && (
                      <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mt-1">
                        {e.qcProblemDesc}
                      </div>
                    )}
                    {e.status === 'DISPUTED' && e.diffReason && (
                      <div className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1">
                        {e.diffReason}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            }
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
