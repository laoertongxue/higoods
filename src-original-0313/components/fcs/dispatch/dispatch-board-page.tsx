'use client'

import { useState, useMemo } from 'react'
import { useRouter } from '@/lib/navigation'
import {
  Search, RefreshCw, LayoutGrid, List,
  AlertTriangle, CheckCircle2, ChevronRight, Eye, Clock, TrendingUp, TrendingDown, Minus,
  ExternalLink, Plus, FileText, X, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAppShell } from '@/components/app-shell/app-shell-context'
import { useFcs } from '@/lib/fcs/fcs-store'
import type { ProcessTask } from '@/lib/fcs/process-tasks'

// ─── 分配路径（三种） ─────────────────────────────────────────────
type AssignPath = 'DIRECT' | 'BIDDING' | 'HOLD' | 'NONE'
const pathZh: Record<AssignPath, string> = {
  DIRECT:  '直接派单',
  BIDDING: '竞价',
  HOLD:    '暂不分配',
  NONE:    '—',
}

// ─── 分配结果（七种）──────────────────────────────────────────────
type AssignResult =
  | 'UNASSIGNED'      // 未分配
  | 'DIRECT_ASSIGNED' // 已直接派单
  | 'BIDDING'         // 招标中
  | 'AWAIT_AWARD'     // 待定标
  | 'AWARDED'         // 已定标
  | 'HOLD'            // 暂不分配
  | 'EXCEPTION'       // 异常

const resultZh: Record<AssignResult, string> = {
  UNASSIGNED:      '未分配',
  DIRECT_ASSIGNED: '已直接派单',
  BIDDING:         '招标中',
  AWAIT_AWARD:     '待定标',
  AWARDED:         '已定标',
  HOLD:            '暂不分配',
  EXCEPTION:       '异常',
}
const resultBadgeClass: Record<AssignResult, string> = {
  UNASSIGNED:      'bg-gray-100 text-gray-700 border-gray-200',
  DIRECT_ASSIGNED: 'bg-blue-100 text-blue-700 border-blue-200',
  BIDDING:         'bg-orange-100 text-orange-700 border-orange-200',
  AWAIT_AWARD:     'bg-purple-100 text-purple-700 border-purple-200',
  AWARDED:         'bg-green-100 text-green-700 border-green-200',
  HOLD:            'bg-slate-100 text-slate-600 border-slate-200',
  EXCEPTION:       'bg-red-100 text-red-700 border-red-200',
}

const taskStatusZh: Record<string, string> = {
  NOT_STARTED: '待开始', PENDING: '待开始', IN_PROGRESS: '进行中',
  COMPLETED: '已完成', DONE: '已完成', BLOCKED: '阻塞', CANCELLED: '已取消',
}

// ─── 看板列（新口径）─────────────────────────────────────────────
type KanbanCol = 'UNASSIGNED' | 'BIDDING' | 'AWAIT_AWARD' | 'AWARDED' | 'DIRECT_ASSIGNED' | 'HOLD' | 'EXCEPTION'
const colLabel: Record<KanbanCol, string> = {
  UNASSIGNED:      '未分配',
  BIDDING:         '招标中',
  AWAIT_AWARD:     '待定标',
  AWARDED:         '已定标',
  DIRECT_ASSIGNED: '已直接派单',
  HOLD:            '暂不分配',
  EXCEPTION:       '异常',
}
const colHeaderColor: Record<KanbanCol, string> = {
  UNASSIGNED:      'text-gray-600',
  BIDDING:         'text-orange-700',
  AWAIT_AWARD:     'text-purple-700',
  AWARDED:         'text-green-700',
  DIRECT_ASSIGNED: 'text-blue-700',
  HOLD:            'text-slate-600',
  EXCEPTION:       'text-red-700',
}
const colBg: Record<KanbanCol, string> = {
  UNASSIGNED:      'bg-gray-50 border-gray-200',
  BIDDING:         'bg-orange-50 border-orange-200',
  AWAIT_AWARD:     'bg-purple-50 border-purple-200',
  AWARDED:         'bg-green-50 border-green-200',
  DIRECT_ASSIGNED: 'bg-blue-50 border-blue-200',
  HOLD:            'bg-slate-50 border-slate-200',
  EXCEPTION:       'bg-red-50 border-red-200',
}

// ─── 从任务推导分配路径与分配结果 ───────────────────────────────────
function deriveAssignPath(task: ProcessTask): AssignPath {
  if (task.assignmentMode === 'DIRECT') return 'DIRECT'
  if (task.assignmentMode === 'BIDDING') return 'BIDDING'
  const lastLog = task.auditLogs[task.auditLogs.length - 1]
  if (lastLog?.action === 'SET_ASSIGN_MODE' && lastLog.detail === '设为暂不分配') return 'HOLD'
  return 'NONE'
}

function deriveAssignResult(task: ProcessTask, hasException: boolean, tenderState: TenderState): AssignResult {
  if (hasException) return 'EXCEPTION'
  const { assignmentMode, assignmentStatus } = task
  const lastLog = task.auditLogs[task.auditLogs.length - 1]

  if (lastLog?.action === 'SET_ASSIGN_MODE' && lastLog.detail === '设为暂不分配') return 'HOLD'

  // 竞价路径：先看本地 tenderState
  if (assignmentMode === 'BIDDING') {
    const localTender = tenderState[task.taskId]
    if (localTender) return localTender.tenderStatus
    // 回退到 mock
    const mock = getMockTender(task)
    if (mock) return mock.status
    return 'BIDDING'
  }

  if (assignmentStatus === 'AWARDED') return 'AWARDED'
  if (assignmentStatus === 'ASSIGNING') return 'AWAIT_AWARD'
  if (assignmentStatus === 'BIDDING') return 'BIDDING'
  if (assignmentStatus === 'ASSIGNED' && assignmentMode === 'DIRECT') return 'DIRECT_ASSIGNED'
  if (assignmentStatus === 'ASSIGNED') return 'DIRECT_ASSIGNED'
  return 'UNASSIGNED'
}

function deriveKanbanCol(task: ProcessTask, hasException: boolean, tenderState: TenderState): KanbanCol {
  const result = deriveAssignResult(task, hasException, tenderState)
  const map: Record<AssignResult, KanbanCol> = {
    UNASSIGNED:      'UNASSIGNED',
    DIRECT_ASSIGNED: 'DIRECT_ASSIGNED',
    BIDDING:         'BIDDING',
    AWAIT_AWARD:     'AWAIT_AWARD',
    AWARDED:         'AWARDED',
    HOLD:            'HOLD',
    EXCEPTION:       'EXCEPTION',
  }
  return map[result]
}

// ─── Mock 招标单数据（预置三条有招标单的竞价任务）─────────────────────
interface MockTender {
  tenderId: string
  taskId: string
  status: 'BIDDING' | 'AWAIT_AWARD' | 'AWARDED'
  factoryPoolCount: number
  quotedCount: number       // 已报价工厂数
  currentMaxPrice?: number  // 当前最高报价（已报价工厂中）
  currentMinPrice?: number  // 当前最低报价（已报价工厂中）
  biddingDeadline: string
  taskDeadline: string
  minPrice: number
  maxPrice: number
  currency: string
  unit: string
  awardedFactoryName?: string
  awardedPrice?: number
}

const mockTenders: MockTender[] = [
  {
    tenderId: 'TENDER-0002-001',
    taskId: 'TASK-0002-002',
    status: 'BIDDING',
    factoryPoolCount: 4,
    quotedCount: 2,
    currentMaxPrice: 14200,
    currentMinPrice: 13800,
    biddingDeadline: '2026-03-20 18:00:00',
    taskDeadline: '2026-04-10 18:00:00',
    minPrice: 12000,
    maxPrice: 16000,
    currency: 'IDR',
    unit: '件',
  },
  {
    tenderId: 'TENDER-0003-001',
    taskId: 'TASK-0003-002',
    status: 'AWAIT_AWARD',
    factoryPoolCount: 5,
    quotedCount: 5,
    currentMaxPrice: 16200,
    currentMinPrice: 10200,
    biddingDeadline: '2026-03-10 18:00:00',
    taskDeadline: '2026-04-05 18:00:00',
    minPrice: 11000,
    maxPrice: 15500,
    currency: 'IDR',
    unit: '件',
  },
  {
    tenderId: 'TENDER-0004-001',
    taskId: 'TASK-0004-002',
    status: 'AWARDED',
    factoryPoolCount: 3,
    quotedCount: 3,
    currentMaxPrice: 14100,
    currentMinPrice: 13200,
    biddingDeadline: '2026-03-08 18:00:00',
    taskDeadline: '2026-04-01 18:00:00',
    minPrice: 11500,
    maxPrice: 15000,
    currency: 'IDR',
    unit: '件',
    awardedFactoryName: '万隆车缝厂',
    awardedPrice: 13200,
  },
]

function getMockTender(task: ProcessTask): MockTender | undefined {
  return mockTenders.find(t => t.taskId === task.taskId || (task.tenderId && t.tenderId === task.tenderId))
}

// ─── 时间剩余工具 ─────────────────────────────────────────────────
function calcRemaining(deadline: string): string {
  const now = Date.now()
  const end = new Date(deadline.replace(' ', 'T')).getTime()
  const diff = end - now
  if (diff <= 0) return '已截止'
  const days = Math.floor(diff / 86400000)
  if (days >= 1) return `还剩 ${days} 天`
  const hours = Math.floor(diff / 3600000)
  if (hours >= 1) return `还剩 ${hours} 小时`
  const mins = Math.floor(diff / 60000)
  return `还剩 ${mins} 分钟`
}

// ─── 本地新建招标单状态（模拟创建后 tenderState）─────────────────────
interface LocalTender {
  tenderId: string
  tenderStatus: 'BIDDING' | 'AWAIT_AWARD' | 'AWARDED'
  factoryPool: string[]  // 工厂ID列表
  factoryPoolNames: string[]
  minPrice: number
  maxPrice: number
  currency: string
  unit: string
  biddingDeadline: string
  taskDeadline: string
  standardPrice: number
  remark: string
  createdAt: string
  awardedFactoryName?: string
  awardedPrice?: number
}
type TenderState = Record<string, LocalTender>  // taskId → LocalTender

// ─── 候选工厂（Mock）─────────────────────────────────────────────
interface CandidateFactory {
  id: string
  name: string
  processTags: string[]
  currentStatus: string
  capacitySummary: string
  performanceSummary: string
  settlementStatus: string
}

const candidateFactories: CandidateFactory[] = [
  { id: 'ID-F002', name: '泗水裁片厂',     processTags: ['裁片', '裁剪'], currentStatus: '正常',   capacitySummary: '日产能 800件',   performanceSummary: '近3月良品率 97%', settlementStatus: '结算正常' },
  { id: 'ID-F003', name: '万隆车缝厂',     processTags: ['车缝', '后整'], currentStatus: '正常',   capacitySummary: '日产能 1200件',  performanceSummary: '近3月良品率 96%', settlementStatus: '结算正常' },
  { id: 'ID-F004', name: '三宝垄整烫厂',   processTags: ['后整', '整烫'], currentStatus: '正常',   capacitySummary: '日产能 600件',   performanceSummary: '近3月良品率 98%', settlementStatus: '结算正常' },
  { id: 'ID-F005', name: '日惹包装厂',     processTags: ['包装', '成衣'], currentStatus: '产能偏紧', capacitySummary: '日产能 500件（80%占用）', performanceSummary: '近3月良品率 95%', settlementStatus: '结算正常' },
  { id: 'ID-F006', name: '棉兰卫星工厂',   processTags: ['车缝', '裁片'], currentStatus: '正常',   capacitySummary: '日产能 900件',   performanceSummary: '近3月良品率 94%', settlementStatus: '结算正常' },
  { id: 'ID-F007', name: '玛琅精工车缝',   processTags: ['精品车缝'],     currentStatus: '正常',   capacitySummary: '日产能 400件',   performanceSummary: '近3月良品率 99%', settlementStatus: '结算正常' },
  { id: 'ID-F010', name: '雅加达绣花专工厂', processTags: ['刺绣', '特种工艺'], currentStatus: '正常', capacitySummary: '日产能 300件', performanceSummary: '近3月良品率 98%', settlementStatus: '有待确认结算单' },
]

// ─── 当前卡点（具体问题文案）────────────────────────────────────────
function currentCheckpoint(
  task: ProcessTask,
  result: AssignResult,
  tender: MockTender | LocalTender | undefined,
  dyePendingIds: Set<string>,
  qcPendingOrderIds: Set<string>,
  hasException: boolean,
): string {
  if (task.status === 'DONE' || task.status === 'COMPLETED' || task.status === 'CANCELLED') return '任务已结束'
  if (hasException) return '存在分配异常，需人工处理'
  if (result === 'HOLD') {
    const lastLog = task.auditLogs[task.auditLogs.length - 1]
    if (lastLog?.detail) return lastLog.detail.replace('设为', '') + '，待复核'
    return '暂不分配，待复核'
  }
  if (result === 'BIDDING') {
    if (!tender) return '未创建招标单，请点击创建招标单'
    const deadline = new Date((tender as MockTender).biddingDeadline ?? (tender as LocalTender).biddingDeadline).getTime()
    if (Date.now() > deadline) return '报价已截止，待定标'
    const hoursLeft = (deadline - Date.now()) / (1000 * 60 * 60)
    if (hoursLeft < 4) return `竞价截止时间临近（剩余${Math.ceil(hoursLeft)}h）`
    return '招标进行中'
  }
  if (result === 'AWAIT_AWARD') return '报价已截止，等待定标'
  if (result === 'AWARDED') return '已定标，等待派单接单'
  if (result === 'DIRECT_ASSIGNED') {
    if (task.acceptanceStatus !== 'ACCEPTED' && task.acceptDeadline) {
      const deadlineMs = new Date(task.acceptDeadline).getTime()
      if (Date.now() > deadlineMs) return '接单截止时间已过，工厂未确认接单'
      const hoursLeft = (deadlineMs - Date.now()) / (1000 * 60 * 60)
      if (hoursLeft < 4) return `接单截止时间临近（剩余${Math.ceil(hoursLeft)}h）`
    }
    if (task.taskDeadline) {
      const deadlineMs = new Date(task.taskDeadline).getTime()
      if (Date.now() > deadlineMs) return '任务截止时间已过，执行逾期'
      const hoursLeft = (deadlineMs - Date.now()) / (1000 * 60 * 60)
      if (hoursLeft < 8) return `已接单但任务即将逾期（剩余${Math.ceil(hoursLeft)}h）`
    }
    return '任务正常推进中'
  }
  if (dyePendingIds.has(task.taskId)) return '受染印回货影响，待确认'
  if (qcPendingOrderIds.has(task.productionOrderId)) return '存在待质检项，暂不可分配'
  const depIds = task.dependsOnTaskIds ?? []
  if (depIds.length > 0) return '前序任务未完成，等待解锁'
  return '待分配，可立即处理'
}

// ─── 时限状态 ────────────────────────────────────────────────────
type DeadlineStatus = 'ACCEPT_OVERDUE' | 'TASK_OVERDUE' | 'NEAR_DEADLINE' | 'NORMAL' | 'NONE'

function getDeadlineStatus(task: ProcessTask): DeadlineStatus {
  if (task.assignmentMode !== 'DIRECT' || task.assignmentStatus !== 'ASSIGNED') return 'NONE'
  if (task.status === 'DONE' || task.status === 'COMPLETED' || task.status === 'CANCELLED') return 'NONE'
  const now = Date.now()
  if (task.acceptanceStatus !== 'ACCEPTED' && task.acceptDeadline) {
    if (now > new Date(task.acceptDeadline).getTime()) return 'ACCEPT_OVERDUE'
  }
  if (task.taskDeadline) {
    const deadline = new Date(task.taskDeadline).getTime()
    if ((task.acceptanceStatus === 'ACCEPTED' || task.status === 'IN_PROGRESS') && now > deadline) return 'TASK_OVERDUE'
    if (deadline - now < 24 * 60 * 60 * 1000 && deadline > now) return 'NEAR_DEADLINE'
  }
  return 'NORMAL'
}

function formatDeadlineBadge(status: DeadlineStatus, task: ProcessTask): { label: string; className: string } | null {
  if (status === 'NONE' || status === 'NORMAL') return null
  if (status === 'ACCEPT_OVERDUE') return { label: '接单逾期', className: 'bg-red-100 text-red-700 border-red-200' }
  if (status === 'TASK_OVERDUE') {
    const days = task.taskDeadline
      ? Math.floor((Date.now() - new Date(task.taskDeadline).getTime()) / (1000 * 60 * 60 * 24))
      : 0
    return { label: `执行逾期${days > 0 ? ' ' + days + '天' : ''}`, className: 'bg-red-100 text-red-700 border-red-200' }
  }
  if (status === 'NEAR_DEADLINE') {
    const hours = task.taskDeadline
      ? Math.ceil((new Date(task.taskDeadline).getTime() - Date.now()) / (1000 * 60 * 60))
      : 0
    return { label: `即将逾期 ${hours}h`, className: 'bg-amber-100 text-amber-700 border-amber-200' }
  }
  return null
}

function formatRemainingTime(taskDeadline: string | undefined): string {
  if (!taskDeadline) return '—'
  const diff = new Date(taskDeadline).getTime() - Date.now()
  if (diff < 0) {
    const days = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24))
    const hours = Math.floor((Math.abs(diff) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    return `已逾期${days > 0 ? ' ' + days + '天' : ''}${hours}h`
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  return days > 0 ? `剩余 ${days}天${hours}h` : `剩余 ${hours}h`
}

// ─── 价格状态 ────────────────────────────────────────────────────
type PriceStatus = 'AT_STANDARD' | 'ABOVE_STANDARD' | 'BELOW_STANDARD' | 'NO_STANDARD'

function getPriceStatus(task: ProcessTask): PriceStatus {
  if (task.standardPrice == null || task.dispatchPrice == null) return 'NO_STANDARD'
  const diff = task.dispatchPrice - task.standardPrice
  if (Math.abs(diff) < 0.001) return 'AT_STANDARD'
  return diff > 0 ? 'ABOVE_STANDARD' : 'BELOW_STANDARD'
}

const priceStatusLabel: Record<PriceStatus, string> = {
  AT_STANDARD:    '按标准价派单',
  ABOVE_STANDARD: '高于标准价',
  BELOW_STANDARD: '低于标准价',
  NO_STANDARD:    '—',
}
const priceStatusClass: Record<PriceStatus, string> = {
  AT_STANDARD:    'bg-green-50 text-green-700 border-green-200',
  ABOVE_STANDARD: 'bg-amber-50 text-amber-700 border-amber-200',
  BELOW_STANDARD: 'bg-blue-50 text-blue-700 border-blue-200',
  NO_STANDARD:    '',
}

const mockStandardPrices: Record<string, number> = {
  PROC_CUT: 8500, PROC_SEW: 14500, PROC_DYE: 12000, PROC_POST: 6000,
  PROC_PACK: 3500, PROC_QC: 5000, PROC_IRON: 4500, PROC_DATIAO: 9800,
  CUT: 8500, SEW: 14500, DYE: 12000, POST: 6000, PACK: 3500, QC: 5000,
}

function getStandardPrice(task: ProcessTask): { price: number; currency: string; unit: string } {
  return {
    price:    task.standardPrice ?? mockStandardPrices[task.processCode] ?? 10000,
    currency: task.standardPriceCurrency ?? 'IDR',
    unit:     task.standardPriceUnit ?? '件',
  }
}

function makeFallbackTasks(orderIds: string[]): ProcessTask[] {
  const pairs = [
    { processCode: 'CUT',  processNameZh: '裁剪',    mode: 'DIRECT' as const,  status: 'NOT_STARTED' as const, assignmentStatus: 'UNASSIGNED' as const },
    { processCode: 'SEW',  processNameZh: '车缝',    mode: 'BIDDING' as const, status: 'NOT_STARTED' as const, assignmentStatus: 'BIDDING' as const },
    { processCode: 'DYE',  processNameZh: '染印',    mode: 'BIDDING' as const, status: 'NOT_STARTED' as const, assignmentStatus: 'ASSIGNING' as const },
    { processCode: 'POST', processNameZh: '后整',    mode: 'DIRECT' as const,  status: 'NOT_STARTED' as const, assignmentStatus: 'UNASSIGNED' as const },
    { processCode: 'PACK', processNameZh: '包装',    mode: 'DIRECT' as const,  status: 'IN_PROGRESS' as const, assignmentStatus: 'ASSIGNED' as const },
    { processCode: 'QC',   processNameZh: '质检终检', mode: 'DIRECT' as const,  status: 'NOT_STARTED' as const, assignmentStatus: 'AWARDED' as const },
  ]
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const result: ProcessTask[] = []
  orderIds.slice(0, 2).forEach((orderId, oi) => {
    pairs.forEach((p, pi) => {
      const taskId = `FB-${orderId}-${p.processCode}`
      result.push({
        taskId,
        productionOrderId: orderId,
        seq: pi + 1,
        processCode: p.processCode,
        processNameZh: p.processNameZh,
        stage: 'SEWING' as any,
        status: p.status,
        assignmentMode: p.mode,
        assignmentStatus: p.assignmentStatus,
        dependsOnTaskIds: pi === 0 ? [] : [`FB-${orderId}-${pairs[pi - 1].processCode}`],
        ownerSuggestion: { kind: 'MAIN_FACTORY' as any },
        qty: 100 + oi * 50,
        qtyUnit: 'PIECE' as any,
        qcPoints: [],
        attachments: [],
        auditLogs: p.assignmentStatus === 'ASSIGNED'
          ? [{ id: `AL-${taskId}-ASSIGN`, action: 'DISPATCH', detail: `派单至工厂`, at: now, by: 'Admin' }]
          : [],
        assignedFactoryName: p.assignmentStatus === 'ASSIGNED' ? '雅加达主工厂' : undefined,
        assignedFactoryId:   p.assignmentStatus === 'ASSIGNED' ? 'ID-F001' : undefined,
        dispatchPrice:       p.assignmentStatus === 'ASSIGNED' ? (mockStandardPrices[p.processCode] ?? 10000) : undefined,
        taskDeadline:        p.assignmentStatus === 'ASSIGNED' ? '2026-04-15 18:00:00' : undefined,
        acceptDeadline:      p.assignmentStatus === 'ASSIGNED' ? '2026-03-25 18:00:00' : undefined,
        createdAt: now,
        updatedAt: now,
      })
    })
  })
  return result
}

// ─── 直接派单弹窗 ─────────────────────────────────────────────────
interface DirectDispatchDialogProps {
  tasks: ProcessTask[]
  factories: { id: string; name: string }[]
  onConfirm: (factoryId: string, factoryName: string, acceptDeadline: string, taskDeadline: string, remark: string, dispatchPrice: number, dispatchPriceCurrency: string, dispatchPriceUnit: string, priceDiffReason: string) => void
  onCancel: () => void
}

function DirectDispatchDialog({ tasks, factories, onConfirm, onCancel }: DirectDispatchDialogProps) {
  const [factoryId, setFactoryId] = useState('')
  const [factoryName, setFactoryName] = useState('')
  const [acceptDeadline, setAcceptDeadline] = useState('')
  const [taskDeadline, setTaskDeadline] = useState('')
  const [remark, setRemark] = useState('')
  const [dispatchPriceStr, setDispatchPriceStr] = useState('')
  const [priceDiffReason, setPriceDiffReason] = useState('')

  const isBatch = tasks.length > 1
  const refTask = tasks[0]
  const std = getStandardPrice(refTask)
  const dispatchPrice = dispatchPriceStr !== '' ? parseFloat(dispatchPriceStr) : undefined
  const priceDiff = dispatchPrice != null ? dispatchPrice - std.price : undefined
  const priceDiffPct = priceDiff != null && std.price !== 0 ? ((priceDiff / std.price) * 100).toFixed(2) : null
  const priceChanged = dispatchPrice != null && Math.abs(dispatchPrice - std.price) >= 0.001
  const needDiffReason = priceChanged
  const valid = factoryId && acceptDeadline && taskDeadline && dispatchPriceStr !== '' && !isNaN(Number(dispatchPriceStr)) && (!needDiffReason || priceDiffReason.trim() !== '')

  const handleFactoryChange = (val: string) => {
    setFactoryId(val)
    setFactoryName(factories.find(f => f.id === val)?.name ?? '')
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onCancel() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isBatch ? '批量直接派单' : '直接派单'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {isBatch ? (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              已选择 <span className="font-semibold">{tasks.length}</span> 个任务
            </div>
          ) : (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
              {[
                ['任务编号', tasks[0].taskId],
                ['生产单号', tasks[0].productionOrderId],
                ['工序', tasks[0].processNameZh],
                ['数量', tasks[0].qty + ' 件'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-mono text-xs">{v}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">承接工厂 <span className="text-red-500">*</span></Label>
            <Select value={factoryId} onValueChange={handleFactoryChange}>
              <SelectTrigger><SelectValue placeholder="请选择承接工厂" /></SelectTrigger>
              <SelectContent>
                {factories.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">接单截止时间 <span className="text-red-500">*</span></Label>
            <Input type="datetime-local" value={acceptDeadline} onChange={e => setAcceptDeadline(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">任务截止时间 <span className="text-red-500">*</span></Label>
            <Input type="datetime-local" value={taskDeadline} onChange={e => setTaskDeadline(e.target.value)} />
          </div>

          {/* 价格信息区 */}
          <div className="rounded-md border bg-muted/20 p-3 space-y-3">
            <p className="text-sm font-medium">价格信息</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">工序标准价</span>
              <span className="text-sm font-medium tabular-nums">{std.price.toLocaleString()} {std.currency}/{std.unit}</span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">直接派单价 <span className="text-red-500">*</span></Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} step={100} placeholder={String(std.price)}
                  value={dispatchPriceStr} onChange={e => setDispatchPriceStr(e.target.value)} className="flex-1" />
                <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">{std.currency}/{std.unit}</span>
              </div>
            </div>
            {dispatchPrice != null && priceDiffPct != null && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">价格偏差</span>
                <span className={`text-sm font-medium tabular-nums flex items-center gap-1 ${!priceChanged ? 'text-green-700' : priceDiff! > 0 ? 'text-amber-700' : 'text-blue-700'}`}>
                  {!priceChanged ? <><Minus className="h-3.5 w-3.5" />0（0%）</>
                    : priceDiff! > 0
                      ? <><TrendingUp className="h-3.5 w-3.5" />+{priceDiff!.toLocaleString()} {std.currency}/{std.unit}（+{priceDiffPct}%）</>
                      : <><TrendingDown className="h-3.5 w-3.5" />{priceDiff!.toLocaleString()} {std.currency}/{std.unit}（{priceDiffPct}%）</>}
                </span>
              </div>
            )}
            {needDiffReason && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">价格偏差原因 <span className="text-red-500">*</span></Label>
                <Textarea placeholder="请说明偏差原因，如：急单加价、特殊工艺、产能紧张、历史协议价等"
                  value={priceDiffReason} onChange={e => setPriceDiffReason(e.target.value)} rows={2} className="resize-none" />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">派单备注 <span className="text-muted-foreground text-xs">（选填）</span></Label>
            <Textarea placeholder="填写派单说明、注意事项等..."
              value={remark} onChange={e => setRemark(e.target.value)} rows={2} className="resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button disabled={!valid}
            onClick={() => onConfirm(factoryId, factoryName, acceptDeadline, taskDeadline, remark, dispatchPrice!, std.currency, std.unit, priceDiffReason)}>
            确认派单
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── 创建招标单抽屉 ────────────────────────────────────────────────
interface CreateTenderSheetProps {
  task: ProcessTask
  onConfirm: (tender: LocalTender) => void
  onClose: () => void
}

function CreateTenderSheet({ task, onConfirm, onClose }: CreateTenderSheetProps) {
  const std = getStandardPrice(task)
  const autoId = `TENDER-${task.taskId.replace(/[^A-Z0-9]/gi, '').slice(-8)}-${Date.now().toString().slice(-4)}`

  const [minPriceStr, setMinPriceStr] = useState('')
  const [maxPriceStr, setMaxPriceStr] = useState('')
  const [biddingDeadline, setBiddingDeadline] = useState('')
  const [taskDeadline, setTaskDeadline] = useState('')
  const [remark, setRemark] = useState('')
  const [selectedPool, setSelectedPool] = useState<Set<string>>(new Set())

  const togglePool = (id: string) => {
    setSelectedPool(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  const selectAll = () => setSelectedPool(new Set(candidateFactories.map(f => f.id)))
  const clearAll = () => setSelectedPool(new Set())

  const minPrice = parseFloat(minPriceStr)
  const maxPrice = parseFloat(maxPriceStr)
  const valid =
    selectedPool.size > 0 &&
    minPriceStr !== '' && !isNaN(minPrice) && minPrice > 0 &&
    maxPriceStr !== '' && !isNaN(maxPrice) && maxPrice >= minPrice &&
    biddingDeadline !== '' &&
    taskDeadline !== ''

  const handleConfirm = () => {
    if (!valid) return
    const poolIds = Array.from(selectedPool)
    const poolNames = poolIds.map(id => candidateFactories.find(f => f.id === id)?.name ?? id)
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    onConfirm({
      tenderId: autoId,
      tenderStatus: 'BIDDING',
      factoryPool: poolIds,
      factoryPoolNames: poolNames,
      minPrice,
      maxPrice,
      currency: std.currency,
      unit: std.unit,
      biddingDeadline: biddingDeadline.replace('T', ' '),
      taskDeadline: taskDeadline.replace('T', ' '),
      standardPrice: std.price,
      remark,
      createdAt: now,
    })
  }

  return (
    <Sheet open onOpenChange={open => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>创建招标单</SheetTitle>
          <p className="text-xs text-muted-foreground">一个竞价任务对应一个招标单</p>
        </SheetHeader>

        <div className="space-y-5">
          {/* 招标单号（只读） */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">招标单号</Label>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-mono text-muted-foreground">
              {autoId}
            </div>
          </div>

          {/* 任务基础信息（只读） */}
          <div className="rounded-md border bg-muted/20 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">任务基础信息</p>
            {[
              ['任务编号', task.taskId],
              ['生产单号', task.productionOrderId],
              ['工序', task.processNameZh],
              ['数量', `${task.qty} ${task.qtyUnit === 'PIECE' ? '件' : task.qtyUnit}`],
              ['工序标准价', `${std.price.toLocaleString()} ${std.currency}/${std.unit}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono text-xs">{v}</span>
              </div>
            ))}
          </div>

          <Separator />

          {/* 工厂池区 */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">工厂池</p>

            {/* 候选工厂区 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">候选工厂</p>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={selectAll}>全选</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={clearAll}>清空</Button>
                </div>
              </div>
              <div className="rounded-md border divide-y max-h-56 overflow-y-auto">
                {candidateFactories.map(f => {
                  const inPool = selectedPool.has(f.id)
                  return (
                    <label
                      key={f.id}
                      className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${inPool ? 'bg-orange-50' : 'hover:bg-muted/40'}`}
                    >
                      <Checkbox
                        checked={inPool}
                        onCheckedChange={() => togglePool(f.id)}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium">{f.name}</span>
                          {f.processTags.map(tag => (
                            <span key={tag} className="inline-flex text-[10px] px-1.5 py-0 rounded bg-blue-50 text-blue-700 border border-blue-200">{tag}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                          <span>{f.currentStatus}</span>
                          <span>{f.capacitySummary}</span>
                          <span>{f.performanceSummary}</span>
                          <span className={f.settlementStatus !== '结算正常' ? 'text-amber-600' : ''}>{f.settlementStatus}</span>
                        </div>
                      </div>
                      {inPool && <Check className="h-3.5 w-3.5 text-orange-600 shrink-0 mt-0.5" />}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* 本次招标工厂池 */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                本次招标工厂池 <span className="text-red-500">*</span>
                <span className="ml-1 text-muted-foreground">（已选 {selectedPool.size} 家）</span>
              </p>
              {selectedPool.size === 0 ? (
                <p className="text-xs text-muted-foreground rounded-md border border-dashed px-3 py-3 text-center">
                  请在上方勾选工厂加入招标工厂池
                </p>
              ) : (
                <div className="flex gap-1.5 flex-wrap rounded-md border px-3 py-2">
                  {Array.from(selectedPool).map(id => {
                    const f = candidateFactories.find(cf => cf.id === id)
                    return (
                      <span key={id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                        {f?.name ?? id}
                        <button type="button" onClick={() => togglePool(id)} className="ml-0.5 hover:text-red-600">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* 价格参考区（平台内部可见，工厂不可见） */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">价格参考区</p>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                以下价格信息仅供平台定标参考，工厂不可见
              </span>
            </div>
            <div className="rounded-md border bg-muted/20 px-3 py-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">工序标准价</span>
              <span className="font-medium tabular-nums">{std.price.toLocaleString()} {std.currency}/{std.unit}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">最低限价 <span className="text-red-500">*</span></Label>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min={0} step={100} placeholder="最低限价"
                    value={minPriceStr} onChange={e => setMinPriceStr(e.target.value)} />
                </div>
                <p className="text-[10px] text-muted-foreground">{std.currency}/{std.unit}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">最高限价 <span className="text-red-500">*</span></Label>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min={0} step={100} placeholder="最高限价"
                    value={maxPriceStr} onChange={e => setMaxPriceStr(e.target.value)} />
                </div>
                <p className="text-[10px] text-muted-foreground">{std.currency}/{std.unit}</p>
              </div>
            </div>
            {minPriceStr && maxPriceStr && !isNaN(minPrice) && !isNaN(maxPrice) && maxPrice < minPrice && (
              <p className="text-xs text-red-600">最高限价不得低于最低限价</p>
            )}
          </div>

          <Separator />

          {/* 时间要求 */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">时间要求</p>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">竞价截止时间 <span className="text-red-500">*</span></Label>
              <Input type="datetime-local" value={biddingDeadline} onChange={e => setBiddingDeadline(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">任务截止时间 <span className="text-red-500">*</span></Label>
              <Input type="datetime-local" value={taskDeadline} onChange={e => setTaskDeadline(e.target.value)} />
            </div>
          </div>

          <Separator />

          {/* 招标备注 */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">招标备注 <span className="text-muted-foreground text-xs">（选填）</span></Label>
            <Textarea placeholder="填写招标说明、特殊要求等..."
              value={remark} onChange={e => setRemark(e.target.value)} rows={2} className="resize-none" />
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-2 pb-6">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button disabled={!valid} onClick={handleConfirm}>
              确认创建招标单
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── 查看招标单抽屉 ───────────────────────────────────────────────
interface ViewTenderSheetProps {
  task: ProcessTask
  tender: MockTender | LocalTender
  onClose: () => void
}

function ViewTenderSheet({ task, tender, onClose }: ViewTenderSheetProps) {
  const std = getStandardPrice(task)
  const tenderId = (tender as MockTender).tenderId ?? (tender as LocalTender).tenderId
  const biddingDeadline = (tender as MockTender).biddingDeadline ?? (tender as LocalTender).biddingDeadline
  const tenderTaskDeadline = (tender as MockTender).taskDeadline ?? (tender as LocalTender).taskDeadline
  const factoryPoolCount = (tender as MockTender).factoryPoolCount ?? (tender as LocalTender).factoryPool?.length ?? 0
  const minPrice = (tender as MockTender).minPrice ?? (tender as LocalTender).minPrice
  const maxPrice = (tender as MockTender).maxPrice ?? (tender as LocalTender).maxPrice
  const currency = (tender as MockTender).currency ?? (tender as LocalTender).currency ?? 'IDR'
  const unit = (tender as MockTender).unit ?? (tender as LocalTender).unit ?? '件'
  const awardedFactory = (tender as MockTender).awardedFactoryName ?? undefined
  const awardedPrice = (tender as MockTender).awardedPrice ?? undefined
  const status = (tender as MockTender).status ?? (tender as LocalTender).tenderStatus
  const poolNames: string[] = (tender as LocalTender).factoryPoolNames ?? []

  const statusZh: Record<string, string> = { BIDDING: '招标中', AWAIT_AWARD: '待定标', AWARDED: '已定标' }
  const statusClass: Record<string, string> = {
    BIDDING:     'bg-orange-100 text-orange-700 border-orange-200',
    AWAIT_AWARD: 'bg-purple-100 text-purple-700 border-purple-200',
    AWARDED:     'bg-green-100 text-green-700 border-green-200',
  }

  return (
    <Sheet open onOpenChange={open => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>招标单详情</SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* 招标单号 + 状态 */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold">{tenderId}</span>
            <span className={`inline-flex text-xs px-2 py-0.5 rounded border font-medium ${statusClass[status] ?? 'bg-gray-100 text-gray-700'}`}>
              {statusZh[status] ?? status}
            </span>
          </div>

          {/* 任务基础信息 */}
          <div className="rounded-md border bg-muted/20 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">关联任务</p>
            {[
              ['任务编号', task.taskId],
              ['生产单号', task.productionOrderId],
              ['工序', task.processNameZh],
              ['数量', `${task.qty} 件`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono text-xs">{v}</span>
              </div>
            ))}
          </div>

          {/* 工厂池 */}
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">工厂池（{factoryPoolCount} 家）</p>
            {poolNames.length > 0 ? (
              <div className="flex gap-1.5 flex-wrap rounded-md border px-3 py-2">
                {poolNames.map(name => (
                  <span key={name} className="inline-flex text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-800 border border-orange-200">
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">（Mock 数据，共 {factoryPoolCount} 家）</p>
            )}
          </div>

          {/* 价格参考区 */}
          <div className="rounded-md border bg-amber-50/60 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-amber-800 mb-1">价格参考区（仅平台可见，工厂不可见）</p>
            {[
              ['工序标准价', `${std.price.toLocaleString()} ${currency}/${unit}`],
              ['最低限价', minPrice != null ? `${minPrice.toLocaleString()} ${currency}/${unit}` : '—'],
              ['最高限价', maxPrice != null ? `${maxPrice.toLocaleString()} ${currency}/${unit}` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium tabular-nums">{v}</span>
              </div>
            ))}
          </div>

          {/* 时间信息 */}
          <div className="rounded-md border p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">时间要求</p>
            {[
              ['竞价截止时间', biddingDeadline ?? '—'],
              ['任务截止时间', tenderTaskDeadline ?? '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono text-xs">{v}</span>
              </div>
            ))}
          </div>

          {/* 定标结果（若已定标） */}
          {awardedFactory && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-2">定标结果</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">中标工厂</span>
                <span className="font-medium text-green-700">{awardedFactory}</span>
              </div>
              {awardedPrice != null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">中标价</span>
                  <span className="font-medium tabular-nums">{awardedPrice.toLocaleString()} {currency}/{unit}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2 pb-6">
            <Button variant="outline" onClick={onClose}>关闭</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── 主组件 ─────────────────────────────────────────────────────
export function DispatchBoardPage() {
  const router = useRouter()
  const { addTab } = useAppShell()
  const { state, setTaskAssignMode, batchSetTaskAssignMode, batchDispatch } = useFcs()
  const allProcessTasks = state.processTasks ?? []
  const productionOrders = state.productionOrders ?? []
  const dyePrintOrders = state.dyePrintOrders ?? []
  const qualityInspections = state.qualityInspections ?? []
  const exceptions = state.exceptions ?? []
  const allocationByTaskId = (state as any)?.allocationByTaskId ?? {}
  const factories = (state.factories ?? []).filter((f: any) => f.status === 'ACTIVE')

  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [autoAssignDone, setAutoAssignDone] = useState(false)
  const [dispatchDialog, setDispatchDialog] = useState<{ taskIds: string[] } | null>(null)
  const [priceSnapshotTask, setPriceSnapshotTask] = useState<ProcessTask | null>(null)

  // 招标单本地状态（taskId → LocalTender）
  const [tenderState, setTenderState] = useState<TenderState>({})
  // 创建招标单抽屉
  const [createTenderTask, setCreateTenderTask] = useState<ProcessTask | null>(null)
  // 查看招标单抽屉
  const [viewTenderTask, setViewTenderTask] = useState<ProcessTask | null>(null)

  const effectiveTasks = useMemo(() => {
    if (allProcessTasks.length >= 10) return allProcessTasks
    const orderIds = productionOrders.map((o: any) => o.productionOrderId)
    return [...allProcessTasks, ...makeFallbackTasks(orderIds)]
  }, [allProcessTasks, productionOrders])

  const dyePendingTaskIds = useMemo(() => {
    const s = new Set<string>()
    dyePrintOrders.forEach((d: any) => {
      if (d.status === 'COMPLETED' || d.status === 'CLOSED') return
      const id = d.relatedTaskId || d.taskId
      if (id) s.add(id)
    })
    return s
  }, [dyePrintOrders])

  const qcPendingOrderIds = useMemo(() => {
    const s = new Set<string>()
    qualityInspections.forEach((q: any) => { if (q.status === 'SUBMITTED') s.add(q.productionOrderId) })
    return s
  }, [qualityInspections])

  const exceptionTaskIds = useMemo(() => {
    const s = new Set<string>()
    const active = new Set(['OPEN', 'IN_PROGRESS', 'WAITING_EXTERNAL'])
    exceptions.forEach((e: any) => {
      if (!active.has(e.caseStatus ?? e.status)) return
      const ids: string[] = e.relatedTaskIds ?? []
      if (ids.length > 0) ids.forEach(id => s.add(id))
      else if (e.sourceType === 'TASK' && e.sourceId) s.add(e.sourceId)
    })
    return s
  }, [exceptions])

  const allRows = useMemo(() => effectiveTasks.filter(t => {
    if (!keyword) return true
    const kw = keyword.toLowerCase()
    const order = productionOrders.find((o: any) => o.productionOrderId === t.productionOrderId)
    return (
      t.taskId.toLowerCase().includes(kw) ||
      t.processNameZh.toLowerCase().includes(kw) ||
      t.productionOrderId.toLowerCase().includes(kw) ||
      (order?.legacyOrderNo ?? '').toLowerCase().includes(kw)
    )
  }), [effectiveTasks, productionOrders, keyword])

  const kanbanCols = useMemo(() => {
    const cols: Record<KanbanCol, ProcessTask[]> = {
      UNASSIGNED: [], BIDDING: [], AWAIT_AWARD: [], AWARDED: [],
      DIRECT_ASSIGNED: [], HOLD: [], EXCEPTION: [],
    }
    allRows.forEach(t => cols[deriveKanbanCol(t, exceptionTaskIds.has(t.taskId), tenderState)].push(t))
    return cols
  }, [allRows, exceptionTaskIds, tenderState])

  const stats = useMemo(() => ({
    unassigned:      kanbanCols.UNASSIGNED.length,
    directAssigned:  kanbanCols.DIRECT_ASSIGNED.length,
    bidding:         kanbanCols.BIDDING.length,
    awaitAward:      kanbanCols.AWAIT_AWARD.length,
    awarded:         kanbanCols.AWARDED.length,
    hold:            kanbanCols.HOLD.length,
    exception:       kanbanCols.EXCEPTION.length,
  }), [kanbanCols])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const toggleAll = () => {
    setSelectedIds(selectedIds.size === allRows.length ? new Set() : new Set(allRows.map(t => t.taskId)))
  }

  const openDirectDispatch = (taskIds: string[]) => { if (taskIds.length > 0) setDispatchDialog({ taskIds }) }

  const handleDispatchConfirm = (factoryId: string, factoryName: string, acceptDeadline: string, taskDeadline: string, remark: string, dispatchPrice: number, dispatchPriceCurrency: string, dispatchPriceUnit: string, priceDiffReason: string) => {
    if (!dispatchDialog) return
    batchDispatch?.(dispatchDialog.taskIds, factoryId, factoryName, acceptDeadline, taskDeadline, remark, '跟单A', dispatchPrice, dispatchPriceCurrency, dispatchPriceUnit, priceDiffReason)
    setDispatchDialog(null)
    setSelectedIds(new Set())
  }

  const handleBatchOther = (mode: 'BIDDING' | 'HOLD') => {
    if (selectedIds.size === 0) return
    batchSetTaskAssignMode?.(Array.from(selectedIds), mode, '跟单A')
    setSelectedIds(new Set())
  }

  const handleSingleMode = (taskId: string, mode: 'DIRECT' | 'BIDDING' | 'HOLD') => {
    if (mode === 'DIRECT') openDirectDispatch([taskId])
    else setTaskAssignMode?.(taskId, mode, '跟单A')
  }

  const navToOrder = (orderId: string) => {
    addTab({ key: `order-${orderId}`, title: `生产单 ${orderId}`, href: `/fcs/production/orders/${orderId}`, closable: true })
    router.push(`/fcs/production/orders/${orderId}`)
  }

  const factoryOptions = useMemo(() => {
    if (factories.length > 0) return factories.map((f: any) => ({ id: f.id, name: f.name }))
    return [
      { id: 'ID-F001', name: '雅加达主工厂' },
      { id: 'ID-F002', name: '泗水裁片厂' },
      { id: 'ID-F003', name: '万隆车缝厂' },
      { id: 'ID-F004', name: '三宝垄整烫厂' },
      { id: 'ID-F005', name: '日惹包装厂' },
      { id: 'ID-F006', name: '棉兰卫星工厂' },
      { id: 'ID-F007', name: '玛琅精工车缝' },
      { id: 'ID-F010', name: '雅加达绣花专工厂' },
    ]
  }, [factories])

  const dispatchDialogTasks = useMemo(() => {
    if (!dispatchDialog) return []
    return effectiveTasks.filter(t => dispatchDialog.taskIds.includes(t.taskId))
  }, [dispatchDialog, effectiveTasks])

  // 获取任务的招标单（优先本地，次 mock）
  const getEffectiveTender = (task: ProcessTask): MockTender | LocalTender | undefined => {
    const local = tenderState[task.taskId]
    if (local) return local
    return getMockTender(task)
  }

  // 判断某竞价任务是否已有招标单
  const hasTender = (task: ProcessTask) => !!(tenderState[task.taskId] || getMockTender(task))

  // 处理创建招标单确认
  const handleTenderCreated = (tender: LocalTender) => {
    if (!createTenderTask) return
    setTenderState(prev => ({ ...prev, [createTenderTask.taskId]: tender }))
    // 同时确保任务 assignmentMode 是 BIDDING
    setTaskAssignMode?.(createTenderTask.taskId, 'BIDDING', '跟单A')
    setCreateTenderTask(null)
  }

  // ─── 看板卡片渲染 ───────────────────────────────────────────
  const renderCard = (task: ProcessTask) => {
    const hasExc = exceptionTaskIds.has(task.taskId)
    const assignPath  = deriveAssignPath(task)
    const assignResult = deriveAssignResult(task, hasExc, tenderState)
    const tender = getEffectiveTender(task)
    const deadlineBadge = formatDeadlineBadge(getDeadlineStatus(task), task)
    const checkpoint = currentCheckpoint(task, assignResult, tender, dyePendingTaskIds, qcPendingOrderIds, hasExc)
    const order = productionOrders.find((o: any) => o.productionOrderId === task.productionOrderId)
    const isBid = assignResult === 'BIDDING' || assignResult === 'AWAIT_AWARD' || assignResult === 'AWARDED'
    const alreadyHasTender = hasTender(task)

    return (
      <Card key={task.taskId} className={`text-sm border ${hasExc ? 'border-red-200' : ''}`}>
        <CardContent className="p-3 space-y-1.5">
          {/* 头部 */}
          <div className="flex items-start justify-between gap-1">
            <span className="font-mono text-xs text-muted-foreground">{task.taskId}</span>
            {hasExc && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
          </div>
          <p className="font-medium leading-tight">{task.processNameZh}</p>
          <p className="text-xs text-muted-foreground">{task.productionOrderId} · {task.qty} 件</p>

          {/* 分配路径 + 分配结果 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {assignPath !== 'NONE' && (
              <Badge variant="outline" className="text-[10px] py-0">{pathZh[assignPath]}</Badge>
            )}
            <span className={`inline-flex text-[10px] px-1.5 py-0 rounded border font-medium ${resultBadgeClass[assignResult]}`}>
              {resultZh[assignResult]}
            </span>
            {deadlineBadge && (
              <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 rounded border font-medium ${deadlineBadge.className}`}>
                <Clock className="h-2.5 w-2.5" />{deadlineBadge.label}
              </span>
            )}
          </div>

          {/* 直接派单额外信息 */}
          {assignResult === 'DIRECT_ASSIGNED' && (
            <div className="rounded border bg-background px-2 py-1 space-y-0.5">
              {task.assignedFactoryName && (
                <p className="text-[10px] text-green-700 font-medium">{task.assignedFactoryName}</p>
              )}
              {task.acceptDeadline && (
                <p className="text-[10px] text-muted-foreground">接单截止：{task.acceptDeadline.slice(0, 16)}</p>
              )}
              {task.taskDeadline && (
                <p className="text-[10px] text-muted-foreground">任务截止：{task.taskDeadline.slice(0, 10)}</p>
              )}
              {task.dispatchPrice != null && (() => {
                const ps = getPriceStatus(task)
                return (
                  <>
                    <p className="text-[10px] tabular-nums">
                      派单价：{task.dispatchPrice.toLocaleString()} {task.dispatchPriceCurrency ?? 'IDR'}/{task.dispatchPriceUnit ?? '件'}
                    </p>
                    {ps !== 'NO_STANDARD' && (
                      <span className={`inline-flex text-[10px] px-1 py-0 rounded border font-medium ${priceStatusClass[ps]}`}>
                        {priceStatusLabel[ps]}
                      </span>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* 竞价额外信息 */}
          {isBid && (
            <div className="rounded border bg-background px-2 py-1 space-y-0.5">
              {tender ? (
                <>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {(tender as MockTender).tenderId ?? (tender as LocalTender).tenderId}
                  </p>
                  {/* 报价进度摘要 */}
                  {(() => {
                    const mt = tender as MockTender
                    const lt = tender as LocalTender
                    const poolCount = mt.factoryPoolCount ?? lt.factoryPool?.length ?? 0
                    const quotedCount = mt.quotedCount ?? 0
                    const maxP = mt.currentMaxPrice
                    const minP = mt.currentMinPrice
                    const cur = mt.currency ?? lt.currency ?? 'IDR'
                    const unt = mt.unit ?? lt.unit ?? '件'
                    const deadline = mt.biddingDeadline ?? lt.biddingDeadline ?? ''
                    const remaining = deadline ? calcRemaining(deadline) : '—'
                    return (
                      <>
                        <p className="text-[10px] text-muted-foreground">
                          工厂池：{poolCount} 家
                          · 报价进度：<span className="text-blue-700 font-medium">{quotedCount} / {poolCount}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          最高：{maxP != null ? <span className="text-red-700">{maxP.toLocaleString()} {cur}/{unt}</span> : '暂无报价'}
                          {' · '}最低：{minP != null ? <span className="text-blue-700">{minP.toLocaleString()} {cur}/{unt}</span> : '暂无报价'}
                        </p>
                        <p className="text-[10px]">
                          <span className={remaining === '已截止' ? 'text-red-600 font-medium' : 'text-orange-700'}>
                            {remaining}
                          </span>
                          <span className="text-muted-foreground"> · 任务截止 {((mt.taskDeadline ?? lt.taskDeadline ?? '').slice(0, 10))}</span>
                        </p>
                      </>
                    )
                  })()}
                  {assignResult === 'AWARDED' && (tender as MockTender).awardedFactoryName && (
                    <>
                      <p className="text-[10px] text-green-700 font-medium">中标：{(tender as MockTender).awardedFactoryName}</p>
                      {(tender as MockTender).awardedPrice != null && (
                        <p className="text-[10px] tabular-nums">
                          中标价：{(tender as MockTender).awardedPrice!.toLocaleString()} {(tender as MockTender).currency ?? 'IDR'}/{(tender as MockTender).unit ?? '件'}
                        </p>
                      )}
                    </>
                  )}
                  {assignResult === 'AWARDED' && !(tender as MockTender).awardedFactoryName && (tender as LocalTender).awardedFactoryName && (
                    <>
                      <p className="text-[10px] text-green-700 font-medium">中标：{(tender as LocalTender).awardedFactoryName}</p>
                      {(tender as LocalTender).awardedPrice != null && (
                        <p className="text-[10px] tabular-nums">
                          中标价：{(tender as LocalTender).awardedPrice!.toLocaleString()} {(tender as LocalTender).currency ?? 'IDR'}/{(tender as LocalTender).unit ?? '件'}
                        </p>
                      )}
                    </>
                  )}
                </>
              ) : (
                <p className="text-[10px] text-amber-600">未创建招标单</p>
              )}
            </div>
          )}

          {/* 暂不分配原因 */}
          {assignResult === 'HOLD' && (() => {
            const lastLog = task.auditLogs[task.auditLogs.length - 1]
            const reason = lastLog?.detail ?? '—'
            return <p className="text-[10px] text-slate-500">原因：{reason}</p>
          })()}

          {/* 当前卡点 */}
          <p className="text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">{checkpoint}</p>

          {/* 操作按钮 */}
          <div className="flex gap-1 pt-1 flex-wrap">
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
              onClick={() => openDirectDispatch([task.taskId])}>直接派单</Button>
            {isBid && alreadyHasTender ? (
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-0.5 text-orange-700 border-orange-200"
                onClick={() => setViewTenderTask(task)}>
                <FileText className="h-3 w-3" />查看招标单
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-0.5"
                onClick={() => {
                  handleSingleMode(task.taskId, 'BIDDING')
                  setCreateTenderTask(task)
                }}>
                <Plus className="h-3 w-3" />创建招标单
              </Button>
            )}
            {assignResult === 'AWAIT_AWARD' && (
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-purple-700 border-purple-200"
                onClick={() => router.push('/fcs/dispatch/award')}>
                前往定标
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
              onClick={() => handleSingleMode(task.taskId, 'HOLD')}>暂不分配</Button>
            {order && (
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1"
                onClick={() => navToOrder(task.productionOrderId)}>
                <Eye className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const colOrder: KanbanCol[] = ['UNASSIGNED', 'DIRECT_ASSIGNED', 'BIDDING', 'AWAIT_AWARD', 'AWARDED', 'HOLD', 'EXCEPTION']

  return (
    <div className="space-y-4">
      {/* 直接派单弹窗 */}
      {dispatchDialog && (
        <DirectDispatchDialog
          tasks={dispatchDialogTasks}
          factories={factoryOptions}
          onConfirm={handleDispatchConfirm}
          onCancel={() => setDispatchDialog(null)}
        />
      )}

      {/* 创建招标单抽屉 */}
      {createTenderTask && (
        <CreateTenderSheet
          task={createTenderTask}
          onConfirm={handleTenderCreated}
          onClose={() => setCreateTenderTask(null)}
        />
      )}

      {/* 查看招标单抽屉 */}
      {viewTenderTask && (() => {
        const t = getEffectiveTender(viewTenderTask)
        if (!t) return null
        return (
          <ViewTenderSheet
            task={viewTenderTask}
            tender={t}
            onClose={() => setViewTenderTask(null)}
          />
        )
      })()}

      {/* 价格快照抽屉 */}
      <Sheet open={!!priceSnapshotTask} onOpenChange={open => { if (!open) setPriceSnapshotTask(null) }}>
        <SheetContent side="right" className="w-[360px] sm:max-w-[360px]">
          <SheetHeader><SheetTitle>价格快照</SheetTitle></SheetHeader>
          {priceSnapshotTask && (() => {
            const t = priceSnapshotTask
            const std = getStandardPrice(t)
            const ps = t.dispatchPrice != null ? getPriceStatus(t) : 'NO_STANDARD'
            const diff = t.dispatchPrice != null ? t.dispatchPrice - std.price : null
            const diffPct = diff != null && std.price !== 0 ? ((diff / std.price) * 100).toFixed(2) : null
            return (
              <div className="mt-4 space-y-4">
                <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
                  {[['任务编号', t.taskId], ['工序', t.processNameZh], ['承接工厂', t.assignedFactoryName ?? '—']].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{k}</span>
                      <span className={k === '承接工厂' ? 'text-green-700 font-medium' : 'font-mono text-xs'}>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">工序标准价</p>
                  <p className="text-lg font-semibold tabular-nums">{std.price.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{std.currency}/{std.unit}</span></p>
                  <p className="text-xs text-muted-foreground">来源：生产需求接收对应工序标准价快照</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">直接派单价</p>
                  {t.dispatchPrice != null
                    ? <p className="text-lg font-semibold tabular-nums">{t.dispatchPrice.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{t.dispatchPriceCurrency ?? 'IDR'}/{t.dispatchPriceUnit ?? '件'}</span></p>
                    : <p className="text-sm text-muted-foreground">暂未录入</p>}
                </div>
                {diff != null && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">价格偏差</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {ps !== 'NO_STANDARD' && (
                        <span className={`inline-flex text-xs px-2 py-0.5 rounded border font-medium ${priceStatusClass[ps]}`}>{priceStatusLabel[ps]}</span>
                      )}
                      <span className={`text-sm font-medium tabular-nums flex items-center gap-1 ${!diff ? 'text-green-700' : diff > 0 ? 'text-amber-700' : 'text-blue-700'}`}>
                        {diff === 0 ? '0（0%）' : `${diff > 0 ? '+' : ''}${diff.toLocaleString()} ${std.currency}/${std.unit}（${diff > 0 ? '+' : ''}${diffPct}%）`}
                      </span>
                    </div>
                  </div>
                )}
                {t.priceDiffReason && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">价格偏差原因</p>
                    <p className="text-sm rounded-md border bg-muted/30 px-3 py-2">{t.priceDiffReason}</p>
                  </div>
                )}
                {t.dispatchRemark && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">派单备注</p>
                    <p className="text-sm rounded-md border bg-muted/30 px-3 py-2">{t.dispatchRemark}</p>
                  </div>
                )}
              </div>
            )
          })()}
        </SheetContent>
      </Sheet>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">任务分配</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          对任务进行直接派单、竞价或暂不分配处理，支持看板视图与列表视图，分别承接运营推进与批量处理。
        </p>
      </div>

      {/* 统计卡（7个状态） */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
        {[
          { label: '未分配',    value: stats.unassigned,     color: 'text-gray-700' },
          { label: '已直接派单', value: stats.directAssigned, color: 'text-blue-600' },
          { label: '招标中',    value: stats.bidding,        color: 'text-orange-600' },
          { label: '待定标',    value: stats.awaitAward,     color: 'text-purple-600' },
          { label: '已定标',    value: stats.awarded,        color: 'text-green-600' },
          { label: '暂不分配',  value: stats.hold,           color: 'text-slate-600' },
          { label: '异常',      value: stats.exception,      color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="关键词（任务ID / 任务名 / 生产单号）"
            value={keyword} onChange={e => setKeyword(e.target.value)} className="pl-8 h-9" />
        </div>
        <Button variant="ghost" size="icon" onClick={() => setKeyword('')}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <p className="text-sm text-muted-foreground ml-auto">共 {allRows.length} 条任务</p>
      </div>

      {/* 自动分配入口区 */}
      <div className="rounded-lg border bg-muted/40 px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">自动分配</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            根据当前任务约束与规则，系统会推荐每个待分配任务走以下路径之一：
            <span className="font-medium">直接派单</span>（最终需确认工厂、时间、价格）、
            <span className="font-medium">竞价</span>（按"一任务一招标单"进入招标流程）、
            <span className="font-medium">暂不分配</span>（存在上游阻塞或异常）。
            仅对尚未明确设置分配路径的任务生效。
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {autoAssignDone && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />已执行自动分配
            </span>
          )}
          <Button size="sm" onClick={() => {
            const unset = allRows.filter(t => {
              const last = t.auditLogs[t.auditLogs.length - 1]
              return !(last?.action === 'SET_ASSIGN_MODE') && t.assignmentStatus === 'UNASSIGNED'
            })
            const bid = unset.filter(t => {
              const alloc = allocationByTaskId[t.taskId]
              return dyePendingTaskIds.has(t.taskId) || qcPendingOrderIds.has(t.productionOrderId) || (!!alloc && (alloc?.availableQty ?? 1) <= 0)
            }).map(t => t.taskId)
            const hold = unset.filter(t => t.status === 'BLOCKED' || exceptionTaskIds.has(t.taskId)).map(t => t.taskId)
            if (bid.length) batchSetTaskAssignMode?.(bid, 'BIDDING', '自动分配')
            if (hold.length) batchSetTaskAssignMode?.(hold, 'HOLD', '自动分配')
            setAutoAssignDone(true)
          }}>
            执行自动分配
          </Button>
        </div>
      </div>

      {/* 双视图 Tabs */}
      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban" className="gap-1.5"><LayoutGrid className="h-4 w-4" />看板视图</TabsTrigger>
          <TabsTrigger value="list" className="gap-1.5"><List className="h-4 w-4" />列表视图</TabsTrigger>
        </TabsList>

        {/* ── 看板视图 ── */}
        <TabsContent value="kanban">
          <div className="flex gap-3 overflow-x-auto pb-4 pt-2">
            {colOrder.map(col => (
              <div key={col} className={`flex-none w-[230px] rounded-lg border ${colBg[col]}`}>
                <div className="px-3 py-2 border-b flex items-center justify-between">
                  <span className={`text-sm font-medium ${colHeaderColor[col]}`}>{colLabel[col]}</span>
                  <Badge variant="secondary" className="text-xs">{kanbanCols[col].length}</Badge>
                </div>
                <ScrollArea className="h-[calc(100vh-440px)]">
                  <div className="p-2 space-y-2">
                    {kanbanCols[col].length === 0
                      ? <p className="text-xs text-muted-foreground text-center py-3">暂无任务</p>
                      : kanbanCols[col].map(renderCard)}
                  </div>
                </ScrollArea>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── 列表视图 ── */}
        <TabsContent value="list">
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">已选 {selectedIds.size} 条</span>
              <Button size="sm" variant="outline" disabled={selectedIds.size === 0}
                onClick={() => openDirectDispatch(Array.from(selectedIds))}>批量直接派单</Button>
              <Button size="sm" variant="outline" disabled={selectedIds.size === 0}
                onClick={() => handleBatchOther('BIDDING')}>批量发起竞价</Button>
              <Button size="sm" variant="ghost" disabled={selectedIds.size === 0}
                onClick={() => handleBatchOther('HOLD')}>批量设为暂不分配</Button>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-10">
                      <Checkbox checked={selectedIds.size === allRows.length && allRows.length > 0} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead>任务ID</TableHead>
                    <TableHead>任务名称</TableHead>
                    <TableHead>生产单号</TableHead>
                    <TableHead>分配路径</TableHead>
                    <TableHead>分配结果</TableHead>
                    {/* 直接派单列 */}
                    <TableHead>承接工厂</TableHead>
                    <TableHead>接单截止</TableHead>
                    <TableHead>任务截止</TableHead>
                    <TableHead>时限状态</TableHead>
                    <TableHead>剩余/逾期</TableHead>
                    <TableHead>工序标准价</TableHead>
                    <TableHead>直接派单价</TableHead>
                    <TableHead>价格状态</TableHead>
                    {/* 竞价列 */}
                    <TableHead>招标单号</TableHead>
                    <TableHead>工厂池</TableHead>
                    <TableHead>竞价截止</TableHead>
                    <TableHead>任务截止（招标）</TableHead>
                    <TableHead>中标工厂</TableHead>
                    <TableHead>中标价</TableHead>
                    {/* 通用 */}
                    <TableHead>当前卡点</TableHead>
                    <TableHead>任务状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={23} className="text-center text-muted-foreground py-8">
                        暂无任务数据
                      </TableCell>
                    </TableRow>
                  )}
                  {allRows.map(task => {
                    const hasExc = exceptionTaskIds.has(task.taskId)
                    const assignPath  = deriveAssignPath(task)
                    const assignResult = deriveAssignResult(task, hasExc, tenderState)
                    const tender = getEffectiveTender(task)
                    const deadlineStatus = getDeadlineStatus(task)
                    const deadlineBadge = formatDeadlineBadge(deadlineStatus, task)
                    const checkpoint = currentCheckpoint(task, assignResult, tender, dyePendingTaskIds, qcPendingOrderIds, hasExc)
                    const order = productionOrders.find((o: any) => o.productionOrderId === task.productionOrderId)
                    const std = getStandardPrice(task)
                    const isDirect = assignResult === 'DIRECT_ASSIGNED'
                    const isBid = assignResult === 'BIDDING' || assignResult === 'AWAIT_AWARD' || assignResult === 'AWARDED'
                    const alreadyHasTender = hasTender(task)
                    const tenderBiddingDeadline = tender ? ((tender as MockTender).biddingDeadline ?? (tender as LocalTender).biddingDeadline ?? '') : ''
                    const tenderTaskDeadline = tender ? ((tender as MockTender).taskDeadline ?? (tender as LocalTender).taskDeadline ?? '') : ''
                    const tenderPoolCount = tender ? ((tender as MockTender).factoryPoolCount ?? (tender as LocalTender).factoryPool?.length ?? 0) : 0

                    return (
                      <TableRow key={task.taskId} className={hasExc ? 'bg-red-50' : undefined}>
                        <TableCell>
                          <Checkbox checked={selectedIds.has(task.taskId)} onCheckedChange={() => toggleSelect(task.taskId)} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{task.taskId}</TableCell>
                        <TableCell className="text-sm font-medium">{task.processNameZh}</TableCell>
                        <TableCell className="font-mono text-xs">{task.productionOrderId}</TableCell>

                        {/* 分配路径 */}
                        <TableCell>
                          {assignPath !== 'NONE'
                            ? <Badge variant="outline" className="text-xs">{pathZh[assignPath]}</Badge>
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>

                        {/* 分配结果 */}
                        <TableCell>
                          <span className={`inline-flex text-xs px-1.5 py-0.5 rounded border font-medium ${resultBadgeClass[assignResult]}`}>
                            {resultZh[assignResult]}
                          </span>
                        </TableCell>

                        {/* 直接派单列 */}
                        <TableCell className="text-xs">
                          {isDirect && task.assignedFactoryName
                            ? <span className="text-green-700 font-medium">{task.assignedFactoryName}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {isDirect && task.acceptDeadline ? task.acceptDeadline.slice(0, 16).replace('T', ' ') : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {isDirect && task.taskDeadline ? task.taskDeadline.slice(0, 16).replace('T', ' ') : '—'}
                        </TableCell>
                        <TableCell>
                          {isDirect && deadlineBadge ? (
                            <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded border font-medium ${deadlineBadge.className}`}>
                              <Clock className="h-3 w-3" />{deadlineBadge.label}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {isDirect ? '正常' : '—'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {isDirect ? formatRemainingTime(task.taskDeadline) : '—'}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                          {isDirect ? `${std.price.toLocaleString()} ${std.currency}/${std.unit}` : '—'}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">
                          {isDirect && task.dispatchPrice != null
                            ? <span className="font-medium">{task.dispatchPrice.toLocaleString()} {task.dispatchPriceCurrency ?? 'IDR'}/{task.dispatchPriceUnit ?? '件'}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {isDirect && task.dispatchPrice != null ? (() => {
                            const ps = getPriceStatus(task)
                            return (
                              <span className={`inline-flex text-xs px-1.5 py-0.5 rounded border font-medium ${priceStatusClass[ps]}`}>
                                {priceStatusLabel[ps]}
                              </span>
                            )
                          })() : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>

                        {/* 竞价列 */}
                        <TableCell className="font-mono text-xs">
                          {isBid && tender
                            ? <span className="text-orange-700">{(tender as MockTender).tenderId ?? (tender as LocalTender).tenderId}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {isBid && tender ? `${tenderPoolCount} 家` : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {isBid && tender ? tenderBiddingDeadline.slice(0, 16) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {isBid && tender ? tenderTaskDeadline.slice(0, 10) : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {assignResult === 'AWARDED' && (tender as MockTender)?.awardedFactoryName
                            ? <span className="text-green-700 font-medium">{(tender as MockTender).awardedFactoryName}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">
                          {assignResult === 'AWARDED' && (tender as MockTender)?.awardedPrice != null
                            ? <span className="font-medium">{(tender as MockTender).awardedPrice!.toLocaleString()} {(tender as MockTender).currency ?? 'IDR'}/{(tender as MockTender).unit ?? '件'}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>

                        {/* 当前卡点 */}
                        <TableCell className="text-xs max-w-[160px]">
                          <span className="text-amber-700">{checkpoint}</span>
                        </TableCell>

                        {/* 任务状态 */}
                        <TableCell>
                          <Badge variant={task.status === 'BLOCKED' ? 'destructive' : 'outline'} className="text-xs">
                            {taskStatusZh[task.status] ?? task.status}
                          </Badge>
                        </TableCell>

                        {/* 操作 */}
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" className="h-7 text-xs px-2">
                                操作 <ChevronRight className="ml-1 h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDirectDispatch([task.taskId])}>直接派单</DropdownMenuItem>
                              {isBid && alreadyHasTender ? (
                                <DropdownMenuItem onClick={() => setViewTenderTask(task)}>
                                  <FileText className="h-3.5 w-3.5 mr-1.5" />查看招标单
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => {
                                  handleSingleMode(task.taskId, 'BIDDING')
                                  setCreateTenderTask(task)
                                }}>
                                  <Plus className="h-3.5 w-3.5 mr-1.5" />创建招标单
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleSingleMode(task.taskId, 'HOLD')}>设为暂不分配</DropdownMenuItem>
                              {task.dispatchPrice != null && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setPriceSnapshotTask(task)}>查看价格快照</DropdownMenuItem>
                                </>
                              )}
                              {order && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => navToOrder(task.productionOrderId)}>
                                    <ExternalLink className="h-3 w-3 mr-1" />查看生产单
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
