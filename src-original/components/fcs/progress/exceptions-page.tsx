'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from '@/lib/navigation'
import { 
  Search, RefreshCw, Download, Plus, X, ExternalLink, MoreHorizontal,
  AlertTriangle, Clock, CheckCircle2, XCircle, Pause, Play, AlertCircle,
  Factory, FileText, Layers, ArrowRight, ChevronRight, Eye, Bell,
  Send, Gavel, Package, ScanLine, FileWarning,
} from 'lucide-react'

import { useAppShell } from '@/components/app-shell/app-shell-context'
import { useFcs, type ExceptionCase, type CaseStatus, type Severity, type ExceptionCategory, type ReasonCode, generateCaseId, mockInternalUsers } from '@/lib/fcs/fcs-store'
import { t } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { processTypes, getProcessTypeByCode } from '@/lib/fcs/process-types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// 颜色映射
const severityColors: Record<Severity, string> = {
  S1: 'bg-red-100 text-red-700 border-red-200',
  S2: 'bg-orange-100 text-orange-700 border-orange-200',
  S3: 'bg-gray-100 text-gray-600 border-gray-200',
}

const statusColors: Record<CaseStatus, string> = {
  OPEN: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  WAITING_EXTERNAL: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
}

const statusIcons: Record<CaseStatus, React.ReactNode> = {
  OPEN: <AlertCircle className="h-3 w-3" />,
  IN_PROGRESS: <Play className="h-3 w-3" />,
  WAITING_EXTERNAL: <Pause className="h-3 w-3" />,
  RESOLVED: <CheckCircle2 className="h-3 w-3" />,
  CLOSED: <XCircle className="h-3 w-3" />,
}

// 用户列表
const mockUsers = [
  { id: 'U002', name: '跟单A' },
  { id: 'U003', name: '跟单B' },
  { id: 'U004', name: '运营' },
  { id: 'U005', name: '管理员' },
]

export function ExceptionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addTab } = useAppShell()
  const { toast } = useToast()
  const { 
    state, 
    getOrderById, 
    getFactoryById,
    updateException,
    updateTaskStatus,
    extendTenderDeadline,
    createOrUpdateExceptionFromSignal,
    createUrge,
  } = useFcs()
  
  // 从 URL 读取预筛选
  const queryTaskId = searchParams.get('taskId')
  const queryPo = searchParams.get('po')
  const queryTenderId = searchParams.get('tenderId')
  const queryReasonCode = searchParams.get('reasonCode')
  const querySeverity = searchParams.get('severity')
  const queryCaseId = searchParams.get('caseId')
  
  const hasUpstreamFilter = !!(queryTaskId || queryPo || queryTenderId || queryReasonCode || querySeverity || queryCaseId)
  const [showUpstreamHint, setShowUpstreamHint] = useState(hasUpstreamFilter)
  
  // 筛选状态
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>(hasUpstreamFilter ? [] : ['OPEN', 'IN_PROGRESS', 'WAITING_EXTERNAL'])
  const [severityFilter, setSeverityFilter] = useState<string>(querySeverity || 'ALL')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [reasonCodeFilter, setReasonCodeFilter] = useState<string>(queryReasonCode || 'ALL')
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL')
  const [slaFilter, setSlaFilter] = useState<string>('ALL')
  
  // 聚合筛选
  const [aggregateFilter, setAggregateFilter] = useState<{ type: string; value: string } | null>(null)
  
  // UI 状态
  const [detailCase, setDetailCase] = useState<ExceptionCase | null>(null)
  const [unblockDialog, setUnblockDialog] = useState<ExceptionCase | null>(null)
  const [unblockRemark, setUnblockRemark] = useState('')
  const [extendDialog, setExtendDialog] = useState<ExceptionCase | null>(null)
  
  // 当前时间
  const now = new Date()
  
  // 初始化：如果有 caseId 参数，直接打开详情
  useEffect(() => {
    if (queryCaseId) {
      const found = state.exceptions.find(e => e.caseId === queryCaseId)
      if (found) setDetailCase(found)
    }
  }, [queryCaseId, state.exceptions])
  
  // 计算筛选结果
  const filteredCases = useMemo(() => {
    return state.exceptions.filter(exc => {
      // 上一步筛选
      if (queryTaskId && !exc.relatedTaskIds.includes(queryTaskId)) return false
      if (queryPo && !exc.relatedOrderIds.includes(queryPo)) return false
      if (queryTenderId && !exc.relatedTenderIds.includes(queryTenderId)) return false
      if (queryCaseId && exc.caseId !== queryCaseId) return false
      
      // 关键词
      if (keyword) {
        const kw = keyword.toLowerCase()
        const order = exc.relatedOrderIds.length > 0 ? getOrderById(exc.relatedOrderIds[0]) : null
        const spuCode = order?.demandSnapshot.spuCode || ''
        const matchKeyword = 
          exc.caseId.toLowerCase().includes(kw) ||
          exc.relatedOrderIds.some(id => id.toLowerCase().includes(kw)) ||
          exc.relatedTaskIds.some(id => id.toLowerCase().includes(kw)) ||
          spuCode.toLowerCase().includes(kw) ||
          exc.summary.toLowerCase().includes(kw)
        if (!matchKeyword) return false
      }
      
      // 状态
      if (statusFilter.length > 0 && !statusFilter.includes(exc.caseStatus)) return false
      
      // 严重度
      if (severityFilter !== 'ALL' && exc.severity !== severityFilter) return false
      
      // 分类
      if (categoryFilter !== 'ALL' && exc.category !== categoryFilter) return false
      
      // 原因码
      if (reasonCodeFilter !== 'ALL' && exc.reasonCode !== reasonCodeFilter) return false
      
      // 责任人
      if (ownerFilter !== 'ALL' && exc.ownerUserId !== ownerFilter) return false
      
      // SLA
      if (slaFilter === 'OVERDUE') {
        if (new Date(exc.slaDueAt.replace(' ', 'T')) > now || exc.caseStatus === 'CLOSED') return false
      } else if (slaFilter === 'NEAR_DUE') {
        const dueTime = new Date(exc.slaDueAt.replace(' ', 'T'))
        const diffHours = (dueTime.getTime() - now.getTime()) / (1000 * 60 * 60)
        if (diffHours < 0 || diffHours > 8 || exc.caseStatus === 'CLOSED') return false
      }
      
      // 聚合筛选
      if (aggregateFilter) {
        if (aggregateFilter.type === 'reason' && exc.reasonCode !== aggregateFilter.value) return false
        if (aggregateFilter.type === 'factory') {
          const hasFactory = exc.relatedTaskIds.some(tid => {
            const task = state.processTasks.find(t => t.taskId === tid)
            return task?.assignedFactoryId === aggregateFilter.value
          })
          if (!hasFactory) return false
        }
        if (aggregateFilter.type === 'process') {
          const hasProcess = exc.relatedTaskIds.some(tid => {
            const task = state.processTasks.find(t => t.taskId === tid)
            return task?.processCode === aggregateFilter.value
          })
          if (!hasProcess) return false
        }
      }
      
      return true
    }).sort((a, b) => {
      // 按严重度、状态、更新时间排序
      const sevOrder = { S1: 0, S2: 1, S3: 2 }
      const statOrder = { OPEN: 0, IN_PROGRESS: 1, WAITING_EXTERNAL: 2, RESOLVED: 3, CLOSED: 4 }
      if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity]
      if (statOrder[a.caseStatus] !== statOrder[b.caseStatus]) return statOrder[a.caseStatus] - statOrder[b.caseStatus]
      return new Date(b.updatedAt.replace(' ', 'T')).getTime() - new Date(a.updatedAt.replace(' ', 'T')).getTime()
    })
  }, [state.exceptions, state.processTasks, keyword, statusFilter, severityFilter, categoryFilter, reasonCodeFilter, ownerFilter, slaFilter, aggregateFilter, queryTaskId, queryPo, queryTenderId, queryCaseId, getOrderById, now])
  
  // KPI 计算
  const kpis = useMemo(() => {
    const all = state.exceptions
    const open = all.filter(e => e.caseStatus === 'OPEN').length
    const s1 = all.filter(e => e.severity === 'S1' && e.caseStatus !== 'CLOSED').length
    const overdue = all.filter(e => new Date(e.slaDueAt.replace(' ', 'T')) < now && e.caseStatus !== 'CLOSED').length
    const today = now.toISOString().slice(0, 10)
    const todayNew = all.filter(e => e.createdAt.slice(0, 10) === today).length
    const todayClosed = all.filter(e => e.caseStatus === 'CLOSED' && e.updatedAt.slice(0, 10) === today).length
    return { open, s1, overdue, todayNew, todayClosed }
  }, [state.exceptions, now])
  
  // 聚合统计
  const aggregates = useMemo(() => {
    const activeCases = state.exceptions.filter(e => e.caseStatus !== 'CLOSED')
    
    // Top 原因
    const reasonCounts: Record<string, number> = {}
    activeCases.forEach(e => {
      reasonCounts[e.reasonCode] = (reasonCounts[e.reasonCode] || 0) + 1
    })
    const topReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    
    // Top 工厂
    const factoryCounts: Record<string, number> = {}
    activeCases.forEach(e => {
      e.relatedTaskIds.forEach(tid => {
        const task = state.processTasks.find(t => t.taskId === tid)
        if (task?.assignedFactoryId) {
          factoryCounts[task.assignedFactoryId] = (factoryCounts[task.assignedFactoryId] || 0) + 1
        }
      })
    })
    const topFactories = Object.entries(factoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    
    // Top 工艺
    const processCounts: Record<string, number> = {}
    activeCases.forEach(e => {
      e.relatedTaskIds.forEach(tid => {
        const task = state.processTasks.find(t => t.taskId === tid)
        if (task?.processCode) {
          processCounts[task.processCode] = (processCounts[task.processCode] || 0) + 1
        }
      })
    })
    const topProcesses = Object.entries(processCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    
    return { topReasons, topFactories, topProcesses }
  }, [state.exceptions, state.processTasks])
  
  // 打开 Tab 的辅助函数
  const openPlaceholderTab = (title: string, href: string) => {
    addTab({
      id: `tab-${Date.now()}`,
      title,
      href,
      closeable: true,
    })
    router.push(href)
  }
  
  // 处置动作
  const handleUnblock = () => {
    if (!unblockDialog || !unblockRemark.trim()) {
      toast({ title: t('common.error'), description: t('exceptionAction.remarkRequired'), variant: 'destructive' })
      return
    }
    
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19)
    
    // 解除相关任务的暂不能继续状态
    unblockDialog.relatedTaskIds.forEach(taskId => {
      const task = state.processTasks.find(t => t.taskId === taskId)
      if (task?.status === 'BLOCKED') {
        updateTaskStatus(taskId, 'IN_PROGRESS', undefined, undefined, 'Admin')
      }
    })
    
    // 更新异常单
    const updated: ExceptionCase = {
      ...unblockDialog,
      caseStatus: 'IN_PROGRESS',
      updatedAt: nowStr,
      actions: [
        ...unblockDialog.actions,
        { id: `EA-${Date.now()}`, actionType: 'UNBLOCK', actionDetail: `解除暂不能继续：${unblockRemark}`, at: nowStr, by: 'Admin' },
      ],
      auditLogs: [
        ...unblockDialog.auditLogs,
        { id: `EAL-${Date.now()}`, action: 'UNBLOCK', detail: `执行解除暂不能继续，备注：${unblockRemark}`, at: nowStr, by: 'Admin' },
      ],
    }
    updateException(updated)
    
    toast({ title: t('common.success'), description: '已解除暂不能继续' })
    setUnblockDialog(null)
    setUnblockRemark('')
    if (detailCase?.caseId === updated.caseId) setDetailCase(updated)
  }
  
  const handleExtendTender = () => {
    if (!extendDialog) return
    
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19)
    
    // 延长竞价
    extendDialog.relatedTenderIds.forEach(tenderId => {
      extendTenderDeadline(tenderId, 24)
    })
    
    // 更新异常单
    const updated: ExceptionCase = {
      ...extendDialog,
      caseStatus: 'IN_PROGRESS',
      updatedAt: nowStr,
      actions: [
        ...extendDialog.actions,
        { id: `EA-${Date.now()}`, actionType: 'EXTEND_TENDER', actionDetail: '延长竞价截止时间24小时', at: nowStr, by: 'Admin' },
      ],
      auditLogs: [
        ...extendDialog.auditLogs,
        { id: `EAL-${Date.now()}`, action: 'EXTEND_TENDER', detail: '执行延长竞价24小时', at: nowStr, by: 'Admin' },
      ],
    }
    updateException(updated)
    
    toast({ title: t('common.success'), description: '已延长竞价24小时' })
    setExtendDialog(null)
    if (detailCase?.caseId === updated.caseId) setDetailCase(updated)
  }
  
  // 状态流转
  const handleStatusChange = (exc: ExceptionCase, newStatus: CaseStatus) => {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const updated: ExceptionCase = {
      ...exc,
      caseStatus: newStatus,
      updatedAt: nowStr,
      auditLogs: [
        ...exc.auditLogs,
        { id: `EAL-${Date.now()}`, action: 'STATUS_CHANGE', detail: `${exc.caseStatus} -> ${newStatus}`, at: nowStr, by: 'Admin' },
      ],
    }
    updateException(updated)
    if (detailCase?.caseId === updated.caseId) setDetailCase(updated)
    toast({ title: t('common.success'), description: `状态已更新为 ${t(`caseStatus.${newStatus}`)}` })
  }
  
  // 指派责任人
  const handleAssign = (exc: ExceptionCase, userId: string, userName: string) => {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const updated: ExceptionCase = {
      ...exc,
      ownerUserId: userId,
      ownerUserName: userName,
      updatedAt: nowStr,
      auditLogs: [
        ...exc.auditLogs,
        { id: `EAL-${Date.now()}`, action: 'ASSIGN', detail: `指派给 ${userName}`, at: nowStr, by: 'Admin' },
      ],
    }
    updateException(updated)
    if (detailCase?.caseId === updated.caseId) setDetailCase(updated)
    toast({ title: t('common.success'), description: `已指派给 ${userName}` })
  }
  
  // 清除筛选
  const clearFilters = () => {
    setKeyword('')
    setStatusFilter(['OPEN', 'IN_PROGRESS', 'WAITING_EXTERNAL'])
    setSeverityFilter('ALL')
    setCategoryFilter('ALL')
    setReasonCodeFilter('ALL')
    setOwnerFilter('ALL')
    setSlaFilter('ALL')
    setAggregateFilter(null)
    setShowUpstreamHint(false)
    router.push('/fcs/progress/exceptions')
  }
  
  // 获取 SPU
  const getSpuFromCase = (exc: ExceptionCase): string => {
    if (exc.relatedOrderIds.length === 0) return '-'
    const order = getOrderById(exc.relatedOrderIds[0])
    return order?.demandSnapshot.spuCode || '-'
  }
  
  // 判断是否逾期
  const isOverdue = (exc: ExceptionCase): boolean => {
    return new Date(exc.slaDueAt.replace(' ', 'T')) < now && exc.caseStatus !== 'CLOSED'
  }
  
  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('exceptions.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('exceptions.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast({ title: '刷新完成' })}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            {t('exceptions.refresh')}
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Download className="mr-1.5 h-4 w-4" />
            {t('exceptions.export')}
          </Button>
        </div>
      </div>
      
      {/* 上一步筛选提示 */}
      {showUpstreamHint && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <AlertCircle className="h-4 w-4" />
            <span>{t('exceptions.fromUpstream')}：</span>
            {queryTaskId && <Badge variant="outline">任务: {queryTaskId}</Badge>}
            {queryPo && <Badge variant="outline">生产单: {queryPo}</Badge>}
            {queryTenderId && <Badge variant="outline">招标单: {queryTenderId}</Badge>}
            {queryReasonCode && <Badge variant="outline">原因: {t(`reasonCode.${queryReasonCode}`)}</Badge>}
            {querySeverity && <Badge variant="outline">严重度: {querySeverity}</Badge>}
            {queryCaseId && <Badge variant="outline">异常号: {queryCaseId}</Badge>}
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4" />
            {t('exceptions.clearFilter')}
          </Button>
        </div>
      )}
      
      {/* KPI 卡片 */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setStatusFilter(['OPEN']); setAggregateFilter(null) }}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('exceptions.kpi.open')}</p>
                <p className="text-2xl font-bold text-red-600">{kpis.open}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setSeverityFilter('S1'); setStatusFilter([]); setAggregateFilter(null) }}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('exceptions.kpi.s1')}</p>
                <p className="text-2xl font-bold text-red-600">{kpis.s1}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setSlaFilter('OVERDUE'); setStatusFilter([]); setAggregateFilter(null) }}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('exceptions.kpi.overdue')}</p>
                <p className="text-2xl font-bold text-orange-600">{kpis.overdue}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('exceptions.kpi.todayNew')}</p>
                <p className="text-2xl font-bold">{kpis.todayNew}</p>
              </div>
              <Plus className="h-8 w-8 text-gray-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('exceptions.kpi.todayClosed')}</p>
                <p className="text-2xl font-bold text-green-600">{kpis.todayClosed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* 聚合定位区 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">{t('exceptions.aggregate.topReason')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {aggregates.topReasons.map(([code, count]) => (
                <div 
                  key={code} 
                  className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted rounded px-2 py-1"
                  onClick={() => setAggregateFilter({ type: 'reason', value: code })}
                >
                  <span className="truncate">{t(`reasonCode.${code}`)}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
              {aggregates.topReasons.length === 0 && <p className="text-sm text-muted-foreground">{t('common.noData')}</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">{t('exceptions.aggregate.topFactory')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {aggregates.topFactories.map(([fid, count]) => {
                const factory = getFactoryById(fid)
                return (
                  <div 
                    key={fid} 
                    className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted rounded px-2 py-1"
                    onClick={() => setAggregateFilter({ type: 'factory', value: fid })}
                  >
                    <span className="truncate">{factory?.name || fid}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                )
              })}
              {aggregates.topFactories.length === 0 && <p className="text-sm text-muted-foreground">{t('common.noData')}</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">{t('exceptions.aggregate.topProcess')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {aggregates.topProcesses.map(([code, count]) => {
                const proc = getProcessTypeByCode(code)
                return (
                  <div 
                    key={code} 
                    className="flex items-center justify-between text-sm cursor-pointer hover:bg-muted rounded px-2 py-1"
                    onClick={() => setAggregateFilter({ type: 'process', value: code })}
                  >
                    <span className="truncate">{proc?.nameZh || code}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                )
              })}
              {aggregates.topProcesses.length === 0 && <p className="text-sm text-muted-foreground">{t('common.noData')}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* 筛选栏 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t('exceptions.filter.keyword')}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                className="h-9"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder={t('exceptions.filter.severity')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="S1">{t('severity.S1')}</SelectItem>
                <SelectItem value="S2">{t('severity.S2')}</SelectItem>
                <SelectItem value="S3">{t('severity.S3')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder={t('exceptions.filter.category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="PRODUCTION_BLOCK">{t('category.PRODUCTION_BLOCK')}</SelectItem>
                <SelectItem value="ASSIGNMENT">{t('category.ASSIGNMENT')}</SelectItem>
                <SelectItem value="TECH_PACK">{t('category.TECH_PACK')}</SelectItem>
                <SelectItem value="HANDOVER">{t('category.HANDOVER')}</SelectItem>
                <SelectItem value="MATERIAL">{t('category.MATERIAL')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={slaFilter} onValueChange={setSlaFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder={t('exceptions.filter.sla')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('exceptions.filter.sla.all')}</SelectItem>
                <SelectItem value="OVERDUE">{t('exceptions.filter.sla.overdueOnly')}</SelectItem>
                <SelectItem value="NEAR_DUE">{t('exceptions.filter.sla.nearDue')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder={t('exceptions.filter.owner')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                {mockUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              {t('common.reset')}
            </Button>
          </div>
          {aggregateFilter && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">聚合筛选：</span>
              <Badge variant="secondary">
                {aggregateFilter.type === 'reason' && t(`reasonCode.${aggregateFilter.value}`)}
                {aggregateFilter.type === 'factory' && (getFactoryById(aggregateFilter.value)?.name || aggregateFilter.value)}
                {aggregateFilter.type === 'process' && (getProcessTypeByCode(aggregateFilter.value)?.nameZh || aggregateFilter.value)}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setAggregateFilter(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* 表格 */}
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground mb-2">
            {t('common.total')} {filteredCases.length} {t('common.records')}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]">{t('exceptions.table.caseId')}</TableHead>
                <TableHead className="w-[80px]">{t('exceptions.table.severity')}</TableHead>
                <TableHead className="w-[100px]">{t('exceptions.table.status')}</TableHead>
                <TableHead className="w-[100px]">{t('exceptions.table.category')}</TableHead>
                <TableHead>{t('exceptions.table.reasonCode')}</TableHead>
                <TableHead>{t('exceptions.table.relatedObjects')}</TableHead>
                <TableHead className="w-[100px]">{t('exceptions.table.spu')}</TableHead>
                <TableHead className="w-[80px]">{t('exceptions.table.owner')}</TableHead>
                <TableHead className="w-[150px]">{t('exceptions.table.slaDue')}</TableHead>
                <TableHead className="w-[80px]">{t('common.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCases.slice(0, 20).map(exc => (
                <TableRow key={exc.caseId} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailCase(exc)}>
                  <TableCell className="font-mono text-xs">{exc.caseId}</TableCell>
                  <TableCell>
                    <Badge className={severityColors[exc.severity]}>{exc.severity}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[exc.caseStatus]}>
                      <span className="flex items-center gap-1">
                        {statusIcons[exc.caseStatus]}
                        {t(`caseStatus.${exc.caseStatus}`)}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{t(`category.${exc.category}`)}</TableCell>
                  <TableCell className="text-xs">{t(`reasonCode.${exc.reasonCode}`)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {exc.relatedOrderIds.slice(0, 1).map(id => (
                        <Badge key={id} variant="outline" className="text-xs cursor-pointer" onClick={e => { e.stopPropagation(); openPlaceholderTab(`生产单 ${id}`, `/fcs/production/orders/${id}`) }}>
                          {id}
                        </Badge>
                      ))}
                      {exc.relatedTaskIds.slice(0, 1).map(id => (
                        <Badge key={id} variant="outline" className="text-xs cursor-pointer" onClick={e => { e.stopPropagation(); openPlaceholderTab('任务进度', `/fcs/progress/board?taskId=${id}`) }}>
                          {id}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{getSpuFromCase(exc)}</TableCell>
                  <TableCell className="text-xs">{exc.ownerUserName || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-xs">{exc.slaDueAt.slice(5, 16)}</span>
                      {isOverdue(exc) && <Badge variant="destructive" className="text-xs">逾期</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={e => { e.stopPropagation(); setDetailCase(exc) }}>
                          <Eye className="mr-2 h-4 w-4" />
                          {t('common.view')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {exc.reasonCode.startsWith('BLOCKED_') && (
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); setUnblockDialog(exc) }}>
                            <Play className="mr-2 h-4 w-4" />
                            {t('exceptionAction.unblock')}
                          </DropdownMenuItem>
                        )}
                        {['TENDER_OVERDUE', 'TENDER_NEAR_DEADLINE'].includes(exc.reasonCode) && exc.relatedTenderIds.length > 0 && (
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); setExtendDialog(exc) }}>
                            <Clock className="mr-2 h-4 w-4" />
                            {t('exceptionAction.extendTender')}
                          </DropdownMenuItem>
                        )}
                        {['TENDER_OVERDUE', 'NO_BID', 'DISPATCH_REJECTED', 'ACK_TIMEOUT'].includes(exc.reasonCode) && (
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); openPlaceholderTab('任务分配', `/fcs/dispatch/board?taskId=${exc.relatedTaskIds[0] || ''}&po=${exc.relatedOrderIds[0] || ''}`) }}>
                            <Send className="mr-2 h-4 w-4" />
                            {t('exceptionAction.reassign')}
                          </DropdownMenuItem>
                        )}
                        {exc.reasonCode === 'TECH_PACK_NOT_RELEASED' && (
                          <DropdownMenuItem onClick={e => { 
                            e.stopPropagation()
                            const order = exc.relatedOrderIds.length > 0 ? getOrderById(exc.relatedOrderIds[0]) : null
                            if (order) openPlaceholderTab('技术包', `/fcs/tech-pack/${order.demandSnapshot.spuCode}`)
                          }}>
                            <FileText className="mr-2 h-4 w-4" />
                            {t('exceptionAction.goTechPack')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={e => {
                          e.stopPropagation()
                          const po = exc.relatedOrderIds[0] || ''
                          const title = po ? `${t('common.materialProgress')}-${po}` : t('common.materialProgress')
                          const href = `/fcs/progress/material${po ? `?po=${po}` : ''}`
                          openPlaceholderTab(title, href)
                        }}>
                          <Package className="mr-2 h-4 w-4" />
                          {t('exceptions.action.viewMaterial')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    {t('common.noData')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* 异常详情 Drawer */}
      <Sheet open={!!detailCase} onOpenChange={() => setDetailCase(null)}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {detailCase && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {t('exceptionDrawer.title')} - {detailCase.caseId}
                  <Badge className={severityColors[detailCase.severity]}>{detailCase.severity}</Badge>
                  <Badge className={statusColors[detailCase.caseStatus]}>{t(`caseStatus.${detailCase.caseStatus}`)}</Badge>
                </SheetTitle>
              </SheetHeader>
              
              <Tabs defaultValue="basic" className="mt-4">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="basic">{t('exceptionDrawer.basicInfo')}</TabsTrigger>
                  <TabsTrigger value="related">{t('exceptionDrawer.relatedObjects')}</TabsTrigger>
                  <TabsTrigger value="actions">{t('exceptionDrawer.actions')}</TabsTrigger>
                  <TabsTrigger value="assign">{t('exceptionDrawer.assignment')}</TabsTrigger>
                  <TabsTrigger value="timeline">{t('exceptionDrawer.timeline')}</TabsTrigger>
                </TabsList>
                
                {/* 基本信息 */}
                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">{t('exceptions.table.category')}</Label>
                      <p className="font-medium">{t(`category.${detailCase.category}`)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">{t('exceptions.table.reasonCode')}</Label>
                      <p className="font-medium">{t(`reasonCode.${detailCase.reasonCode}`)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">{t('exceptions.table.slaDue')}</Label>
                      <p className="font-medium flex items-center gap-2">
                        {detailCase.slaDueAt}
                        {isOverdue(detailCase) && <Badge variant="destructive">逾期</Badge>}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">{t('common.time')}</Label>
                      <p className="text-sm">创建: {detailCase.createdAt}</p>
                      <p className="text-sm">更新: {detailCase.updatedAt}</p>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground">摘要</Label>
                    <p className="font-medium">{detailCase.summary}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">详情</Label>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailCase.detail}</p>
                  </div>
                  {detailCase.tags.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">标签</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {detailCase.tags.map(tag => (
                          <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 物料相关异常的建议处理区域 */}
                  {(detailCase.reasonCode.startsWith('MATERIAL_') || detailCase.reasonCode === 'BLOCKED_MATERIAL') && (
                    <div className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                      <div className="flex items-center gap-2 text-teal-700">
                        <Package className="h-4 w-4" />
                        <span className="text-sm font-medium">{t('material.suggestForBlocked')}</span>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => {
                          const po = detailCase.relatedOrderIds[0] || ''
                          const title = po ? `${t('common.materialProgress')}-${po}` : t('common.materialProgress')
                          const href = `/fcs/progress/material${po ? `?po=${po}` : ''}`
                          openPlaceholderTab(title, href)
                        }}
                      >
                        <Package className="mr-1.5 h-4 w-4" />
                        {t('exceptions.action.viewMaterial')}
                      </Button>
                    </div>
                  )}
                </TabsContent>
                
                {/* 关联对象 */}
                <TabsContent value="related" className="space-y-4 mt-4">
                  {detailCase.relatedOrderIds.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">关联生产单</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {detailCase.relatedOrderIds.map(id => (
                          <Button 
                            key={id} 
                            variant="outline" 
                            size="sm"
                            onClick={() => openPlaceholderTab(`生产单 ${id}`, `/fcs/production/orders/${id}`)}
                          >
                            {id}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailCase.relatedTaskIds.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">关联任务</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {detailCase.relatedTaskIds.map(id => (
                          <Button 
                            key={id} 
                            variant="outline" 
                            size="sm"
                            onClick={() => openPlaceholderTab('任务进度', `/fcs/progress/board?taskId=${id}`)}
                          >
                            {id}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailCase.relatedTenderIds.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">关联招标单</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {detailCase.relatedTenderIds.map(id => (
                          <Button 
                            key={id} 
                            variant="outline" 
                            size="sm"
                            onClick={() => openPlaceholderTab('任务分配', `/fcs/dispatch/board?tenderId=${id}`)}
                          >
                            {id}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground">快捷跳转</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {detailCase.relatedOrderIds.length > 0 && (() => {
                        const order = getOrderById(detailCase.relatedOrderIds[0])
                        return order ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openPlaceholderTab('技术包', `/fcs/tech-pack/${order.demandSnapshot.spuCode}`)}
                          >
                            <FileText className="mr-1 h-4 w-4" />
                            技术包
                          </Button>
                        ) : null
                      })()}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => openPlaceholderTab('交接链路', `/fcs/progress/handover?po=${detailCase.relatedOrderIds[0] || ''}&taskId=${detailCase.relatedTaskIds[0] || ''}`)}
                      >
                        <ScanLine className="mr-1 h-4 w-4" />
                        交接链路
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const po = detailCase.relatedOrderIds[0] || ''
                          const title = po ? `${t('common.materialProgress')}-${po}` : t('common.materialProgress')
                          openPlaceholderTab(title, `/fcs/progress/material${po ? `?po=${po}` : ''}`)
                        }}
                      >
                        <Package className="mr-1 h-4 w-4" />
                        {t('exceptions.action.viewMaterial')}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                
                {/* 处置动作 */}
                <TabsContent value="actions" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    {detailCase.reasonCode.startsWith('BLOCKED_') && (
                      <Card className="cursor-pointer hover:border-primary" onClick={() => setUnblockDialog(detailCase)}>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2">
                            <Play className="h-5 w-5 text-green-600" />
                            <div>
                              <p className="font-medium">{t('exceptionAction.unblock')}</p>
                              <p className="text-xs text-muted-foreground">{t('exceptionAction.unblock.desc')}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {['TENDER_OVERDUE', 'TENDER_NEAR_DEADLINE'].includes(detailCase.reasonCode) && detailCase.relatedTenderIds.length > 0 && (
                      <Card className="cursor-pointer hover:border-primary" onClick={() => setExtendDialog(detailCase)}>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-blue-600" />
                            <div>
                              <p className="font-medium">{t('exceptionAction.extendTender')}</p>
                              <p className="text-xs text-muted-foreground">{t('exceptionAction.extendTender.desc')}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {['TENDER_OVERDUE', 'NO_BID', 'DISPATCH_REJECTED', 'ACK_TIMEOUT'].includes(detailCase.reasonCode) && (
                      <Card className="cursor-pointer hover:border-primary" onClick={() => openPlaceholderTab('任务分配', `/fcs/dispatch/board?taskId=${detailCase.relatedTaskIds[0] || ''}&po=${detailCase.relatedOrderIds[0] || ''}`)}>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2">
                            <Send className="h-5 w-5 text-orange-600" />
                            <div>
                              <p className="font-medium">{t('exceptionAction.reassign')}</p>
                              <p className="text-xs text-muted-foreground">{t('exceptionAction.reassign.desc')}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {detailCase.reasonCode === 'TECH_PACK_NOT_RELEASED' && (
                      <Card className="cursor-pointer hover:border-primary" onClick={() => {
                        const order = detailCase.relatedOrderIds.length > 0 ? getOrderById(detailCase.relatedOrderIds[0]) : null
                        if (order) openPlaceholderTab('技术包', `/fcs/tech-pack/${order.demandSnapshot.spuCode}`)
                      }}>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-purple-600" />
                            <div>
                              <p className="font-medium">{t('exceptionAction.goTechPack')}</p>
                              <p className="text-xs text-muted-foreground">{t('exceptionAction.goTechPack.desc')}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {['HANDOVER_DIFF', 'BLOCKED_MATERIAL'].includes(detailCase.reasonCode) && (
                      <Card className="cursor-pointer hover:border-primary" onClick={() => openPlaceholderTab('交接链路', `/fcs/progress/handover?po=${detailCase.relatedOrderIds[0] || ''}&taskId=${detailCase.relatedTaskIds[0] || ''}`)}>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2">
                            <ScanLine className="h-5 w-5 text-cyan-600" />
                            <div>
                              <p className="font-medium">{t('exceptionAction.viewHandover')}</p>
                              <p className="text-xs text-muted-foreground">{t('exceptionAction.viewHandover.desc')}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    {['MATERIAL_NOT_READY', 'BLOCKED_MATERIAL'].includes(detailCase.reasonCode) && (
                      <Card className="cursor-pointer hover:border-primary" onClick={() => {
                        const po = detailCase.relatedOrderIds[0] || ''
                        const title = po ? `${t('common.materialProgress')}-${po}` : t('common.materialProgress')
                        openPlaceholderTab(title, `/fcs/progress/material${po ? `?po=${po}` : ''}`)
                      }}>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-teal-600" />
                            <div>
                              <p className="font-medium">{t('exceptionAction.viewMaterial')}</p>
                              <p className="text-xs text-muted-foreground">{t('exceptionAction.viewMaterial.desc')}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>
                
                {/* 指派与状态 */}
                <TabsContent value="assign" className="space-y-4 mt-4">
                  <div>
                    <Label>{t('exception.assign')}</Label>
                    <Select 
                      value={detailCase.ownerUserId || ''} 
                      onValueChange={val => {
                        const user = mockUsers.find(u => u.id === val)
                        if (user) handleAssign(detailCase, user.id, user.name)
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="选择责任人" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockUsers.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div>
                    <Label>{t('exception.statusFlow')}</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {detailCase.caseStatus === 'OPEN' && (
                        <Button size="sm" onClick={() => handleStatusChange(detailCase, 'IN_PROGRESS')}>
                          {t('exception.toInProgress')}
                        </Button>
                      )}
                      {detailCase.caseStatus === 'IN_PROGRESS' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(detailCase, 'WAITING_EXTERNAL')}>
                            {t('exception.toWaitingExternal')}
                          </Button>
                          <Button size="sm" onClick={() => handleStatusChange(detailCase, 'RESOLVED')}>
                            {t('exception.toResolved')}
                          </Button>
                        </>
                      )}
                      {detailCase.caseStatus === 'WAITING_EXTERNAL' && (
                        <Button size="sm" onClick={() => handleStatusChange(detailCase, 'IN_PROGRESS')}>
                          {t('exception.toInProgress')}
                        </Button>
                      )}
                      {detailCase.caseStatus === 'RESOLVED' && (
                        <Button size="sm" onClick={() => handleStatusChange(detailCase, 'CLOSED')}>
                          {t('exception.toClosed')}
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* 催办责任人 */}
                  {detailCase.ownerUserId && !['RESOLVED', 'CLOSED'].includes(detailCase.caseStatus) && (
                    <>
                      <Separator />
                      <div>
                        <Label>{t('urge.action.urgeOwner')}</Label>
                        <div className="mt-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              const owner = mockInternalUsers.find(u => u.id === detailCase.ownerUserId)
                              if (owner) {
                                createUrge({
                                  urgeType: 'URGE_CASE_HANDLE',
                                  fromType: 'INTERNAL_USER',
                                  fromId: 'U001',
                                  fromName: '管理员',
                                  toType: 'INTERNAL_USER',
                                  toId: owner.id,
                                  toName: owner.name,
                                  targetType: 'CASE',
                                  targetId: detailCase.caseId,
                                  message: `请尽快处理异常单 ${detailCase.caseId}`,
                                  deepLink: { path: '/fcs/progress/exceptions', query: { caseId: detailCase.caseId } },
                                })
                                toast({ title: t('urge.tip.sendSuccess') })
                              }
                            }}
                          >
                            <Bell className="mr-1.5 h-4 w-4" />
                            {t('urge.action.urgeOwner')}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>
                
                {/* 时间线 */}
                <TabsContent value="timeline" className="space-y-4 mt-4">
                  {detailCase.actions.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">{t('timeline.actions')}</Label>
                      <ScrollArea className="h-[200px] mt-2">
                        <div className="space-y-2">
                          {detailCase.actions.map(a => (
                            <div key={a.id} className="flex items-start gap-2 text-sm border-l-2 border-blue-200 pl-3 py-1">
                              <div>
                                <p className="font-medium">{a.actionType}</p>
                                <p className="text-muted-foreground">{a.actionDetail}</p>
                                <p className="text-xs text-muted-foreground">{a.at} by {a.by}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground">{t('timeline.auditLogs')}</Label>
                    <ScrollArea className="h-[200px] mt-2">
                      <div className="space-y-2">
                        {detailCase.auditLogs.map(log => (
                          <div key={log.id} className="flex items-start gap-2 text-sm border-l-2 border-gray-200 pl-3 py-1">
                            <div>
                              <p className="font-medium">{log.action}</p>
                              <p className="text-muted-foreground">{log.detail}</p>
                              <p className="text-xs text-muted-foreground">{log.at} by {log.by}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
      
      {/* 解除暂不能继续对话框 */}
      <Dialog open={!!unblockDialog} onOpenChange={() => { setUnblockDialog(null); setUnblockRemark('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('exceptionAction.confirmUnblock')}</DialogTitle>
            <DialogDescription>
              {t('exceptionAction.unblock.desc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('common.remark')} *</Label>
              <Textarea 
                value={unblockRemark} 
                onChange={e => setUnblockRemark(e.target.value)}
                placeholder="请填写处理备注..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUnblockDialog(null); setUnblockRemark('') }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUnblock} disabled={!unblockRemark.trim()}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 延长竞价对话框 */}
      <AlertDialog open={!!extendDialog} onOpenChange={() => setExtendDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('exceptionAction.confirmExtend')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('exceptionAction.extendTender.desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleExtendTender}>{t('common.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
