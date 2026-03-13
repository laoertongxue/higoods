'use client'

import { useState, useMemo } from 'react'
import { useRouter } from '@/lib/navigation'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { 
  Search, RefreshCw, FileText, Eye, History, ExternalLink, Download,
  MoreHorizontal, LayoutGrid, TableIcon, ChevronLeft, ChevronRight,
  AlertTriangle, Clock, Factory, Gavel, Send,
} from 'lucide-react'

import { useAppShell } from '@/components/app-shell/app-shell-context'
import { 
  productionOrders, 
  type ProductionOrder, 
  type AuditLog,
  type RiskFlag,
  productionOrderStatusConfig,
  assignmentProgressStatusConfig,
  techPackStatusConfig,
  riskFlagConfig,
} from '@/lib/fcs/production-orders'
import { getTechPackBySpuCode } from '@/lib/fcs/tech-packs'
import { tierLabels, typeLabels } from '@/lib/fcs/indonesia-factories'

// 分配模式
type AssignmentMode = 'ALL' | 'DIRECT_ONLY' | 'BIDDING_ONLY' | 'MIXED'
// 竞价风险
type BiddingRisk = 'ALL' | 'OVERDUE' | 'NEAR_DEADLINE' | 'NONE'

const PAGE_SIZE = 10

export function OrdersPage() {
  const router = useRouter()
  const { addTab } = useAppShell()

  // 筛选状态
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [techPackFilter, setTechPackFilter] = useState<string>('ALL')
  const [breakdownFilter, setBreakdownFilter] = useState<string>('ALL')
  const [assignmentProgressFilter, setAssignmentProgressFilter] = useState<string>('ALL')
  const [assignmentModeFilter, setAssignmentModeFilter] = useState<AssignmentMode>('ALL')
  const [biddingRiskFilter, setBiddingRiskFilter] = useState<BiddingRisk>('ALL')
  const [tierFilter, setTierFilter] = useState<string>('ALL')
  
  // 分页
  const [currentPage, setCurrentPage] = useState(1)

  // 选中行
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  // 弹窗状态
  const [demandSnapshotOrder, setDemandSnapshotOrder] = useState<ProductionOrder | null>(null)
  const [logsOrder, setLogsOrder] = useState<ProductionOrder | null>(null)

  // 视图模式
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table')

  // 筛选数据
  const filteredOrders = useMemo(() => {
    let result = [...productionOrders]
    
    // 关键词筛选
    if (keyword) {
      const kw = keyword.toLowerCase()
      result = result.filter(o =>
        o.productionOrderId.toLowerCase().includes(kw) ||
        o.legacyOrderNo.toLowerCase().includes(kw) ||
        o.demandSnapshot.spuCode.toLowerCase().includes(kw) ||
        o.demandSnapshot.spuName.toLowerCase().includes(kw) ||
        o.mainFactorySnapshot.name.toLowerCase().includes(kw)
      )
    }
    
    // 状态筛选（多选）
    if (statusFilter.length > 0) {
      result = result.filter(o => statusFilter.includes(o.status))
    }
    
    // 技术包状态
    if (techPackFilter !== 'ALL') {
      result = result.filter(o => o.techPackSnapshot.status === techPackFilter)
    }
    
    // 是否已拆解
    if (breakdownFilter !== 'ALL') {
      const isBrokenDown = breakdownFilter === 'YES'
      result = result.filter(o => o.taskBreakdownSummary.isBrokenDown === isBrokenDown)
    }
    
    // 分配进度
    if (assignmentProgressFilter !== 'ALL') {
      result = result.filter(o => o.assignmentProgress.status === assignmentProgressFilter)
    }
    
    // 分配模式
    if (assignmentModeFilter !== 'ALL') {
      result = result.filter(o => {
        const { directCount, biddingCount } = o.assignmentSummary
        if (assignmentModeFilter === 'DIRECT_ONLY') return directCount > 0 && biddingCount === 0
        if (assignmentModeFilter === 'BIDDING_ONLY') return biddingCount > 0 && directCount === 0
        if (assignmentModeFilter === 'MIXED') return directCount > 0 && biddingCount > 0
        return true
      })
    }
    
    // 竞价风险
    if (biddingRiskFilter !== 'ALL') {
      result = result.filter(o => {
        if (biddingRiskFilter === 'OVERDUE') return o.biddingSummary.overdueTenderCount > 0
        if (biddingRiskFilter === 'NEAR_DEADLINE') return o.riskFlags.includes('TENDER_NEAR_DEADLINE')
        if (biddingRiskFilter === 'NONE') return o.biddingSummary.activeTenderCount === 0 && o.biddingSummary.overdueTenderCount === 0
        return true
      })
    }
    
    // 主工厂层级
    if (tierFilter !== 'ALL') {
      result = result.filter(o => o.mainFactorySnapshot.tier === tierFilter)
    }
    
    return result
  }, [keyword, statusFilter, techPackFilter, breakdownFilter, assignmentProgressFilter, assignmentModeFilter, biddingRiskFilter, tierFilter])

  // 分页数据
  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE)
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // 获取技术包最新信息
  const getTechPackInfo = (order: ProductionOrder) => {
    const techPack = getTechPackBySpuCode(order.demandSnapshot.spuCode)
    return {
      snapshotStatus: order.techPackSnapshot.status,
      snapshotVersion: order.techPackSnapshot.versionLabel,
      currentStatus: techPack?.status || order.techPackSnapshot.status,
      currentVersion: techPack?.versionLabel || order.techPackSnapshot.versionLabel,
      completenessScore: techPack?.completenessScore || 0,
      missingChecklist: techPack?.missingChecklist || [],
    }
  }

  // 打开生产单详情
  const openOrderDetail = (orderId: string) => {
    addTab({
      key: `po-${orderId}`,
      title: `${t('orders.title')} ${orderId}`,
      href: `/fcs/production/orders/${orderId}`,
      closable: true,
    })
    router.push(`/fcs/production/orders/${orderId}`)
  }

  // 打开技术包页面
  const openTechPackPage = (spuCode: string) => {
    addTab({
      key: `tech-pack-${spuCode}`,
      title: `${t('techPack.title')} - ${spuCode}`,
      href: `/fcs/tech-pack/${spuCode}`,
      closable: true,
    })
    router.push(`/fcs/tech-pack/${spuCode}`)
  }

  // 占位跳转
  const openPlaceholderTab = (title: string, href: string) => {
    addTab({ key: href, title, href, closable: true })
    router.push(href)
  }

  // 重置筛选
  const handleReset = () => {
    setKeyword('')
    setStatusFilter([])
    setTechPackFilter('ALL')
    setBreakdownFilter('ALL')
    setAssignmentProgressFilter('ALL')
    setAssignmentModeFilter('ALL')
    setBiddingRiskFilter('ALL')
    setTierFilter('ALL')
    setCurrentPage(1)
  }

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(paginatedOrders.map(o => o.productionOrderId)))
    } else {
      setSelectedRows(new Set())
    }
  }

  // 选中单行
  const handleSelectRow = (orderId: string, checked: boolean) => {
    const newSet = new Set(selectedRows)
    if (checked) newSet.add(orderId)
    else newSet.delete(orderId)
    setSelectedRows(newSet)
  }

  // 渲染风险标签
  const renderRiskFlags = (flags: RiskFlag[]) => {
    if (flags.length === 0) return <span className="text-muted-foreground">-</span>
    const displayFlags = flags.slice(0, 3)
    const remainingCount = flags.length - 3
    return (
      <div className="flex flex-wrap gap-1">
        {displayFlags.map(flag => (
          <Badge key={flag} className={cn('text-xs', riskFlagConfig[flag]?.color)}>
            {riskFlagConfig[flag]?.label}
          </Badge>
        ))}
        {remainingCount > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs">+{remainingCount}</Badge>
              </TooltipTrigger>
              <TooltipContent>
                {flags.slice(3).map(flag => (
                  <div key={flag}>{riskFlagConfig[flag]?.label}</div>
                ))}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    )
  }

  // 渲染分配模式概览
  const renderAssignmentOverview = (order: ProductionOrder) => {
    const { directCount, biddingCount, totalTasks } = order.assignmentSummary
    if (totalTasks === 0) return <span className="text-muted-foreground">-</span>
    return (
      <div className="text-xs space-y-0.5">
        <div className="flex items-center gap-1">
          <Send className="h-3 w-3 text-blue-500" />
          <span>派单: {directCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <Gavel className="h-3 w-3 text-purple-500" />
          <span>竞价: {biddingCount}</span>
        </div>
        <div className="text-muted-foreground">总计: {totalTasks}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('orders.title')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => alert('从需求生成 - 占位')}>
            <FileText className="mr-1 h-4 w-4" />
            从需求生成
          </Button>
          <Button variant="outline" size="sm" onClick={() => alert('导出 - 占位')}>
            <Download className="mr-1 h-4 w-4" />
            {t('common.export')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-1 h-4 w-4" />
            刷新
          </Button>
          <div className="flex border rounded-md">
            <Button 
              variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('table')}
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'board' ? 'secondary' : 'ghost'} 
              size="sm"
              className="rounded-l-none"
              onClick={() => { setViewMode('board'); alert('Board视图 - 占位') }}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* FilterBar */}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {/* 关键词 */}
          <div>
            <Label className="text-xs text-muted-foreground">关键词</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="单号/旧单号/SPU/工厂"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          
          {/* 生产单状态 */}
          <div>
            <Label className="text-xs text-muted-foreground">生产单状态</Label>
            <Select 
              value={statusFilter.length === 0 ? 'ALL' : statusFilter.join(',')}
              onValueChange={v => setStatusFilter(v === 'ALL' ? [] : v.split(','))}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue placeholder={t('common.all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="DRAFT">草稿</SelectItem>
                <SelectItem value="WAIT_TECH_PACK_RELEASE">等待技术包发布</SelectItem>
                <SelectItem value="READY_FOR_BREAKDOWN">待拆解</SelectItem>
                <SelectItem value="WAIT_ASSIGNMENT">待分配</SelectItem>
                <SelectItem value="ASSIGNING">分配中</SelectItem>
                <SelectItem value="EXECUTING">生产执行中</SelectItem>
                <SelectItem value="COMPLETED">已完成</SelectItem>
                <SelectItem value="CANCELLED">已取消</SelectItem>
                <SelectItem value="ON_HOLD">已挂起</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* 技术包状态 */}
          <div>
            <Label className="text-xs text-muted-foreground">技术包状态</Label>
            <Select value={techPackFilter} onValueChange={setTechPackFilter}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="MISSING">缺失</SelectItem>
                <SelectItem value="BETA">测试版</SelectItem>
                <SelectItem value="RELEASED">已发布</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* 是否已拆解 */}
          <div>
            <Label className="text-xs text-muted-foreground">是否已拆解</Label>
            <Select value={breakdownFilter} onValueChange={setBreakdownFilter}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="YES">已拆解</SelectItem>
                <SelectItem value="NO">未拆解</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* 分配进度 */}
          <div>
            <Label className="text-xs text-muted-foreground">分配进度</Label>
            <Select value={assignmentProgressFilter} onValueChange={setAssignmentProgressFilter}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="NOT_READY">未就绪</SelectItem>
                <SelectItem value="PENDING">待分配</SelectItem>
                <SelectItem value="IN_PROGRESS">分配中</SelectItem>
                <SelectItem value="DONE">已完成</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* 分配模式 */}
          <div>
            <Label className="text-xs text-muted-foreground">分配模式</Label>
            <Select value={assignmentModeFilter} onValueChange={(v) => setAssignmentModeFilter(v as AssignmentMode)}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="DIRECT_ONLY">仅派单</SelectItem>
                <SelectItem value="BIDDING_ONLY">仅竞价</SelectItem>
                <SelectItem value="MIXED">混合模式</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* 竞价风险 */}
          <div>
            <Label className="text-xs text-muted-foreground">竞价风险</Label>
            <Select value={biddingRiskFilter} onValueChange={(v) => setBiddingRiskFilter(v as BiddingRisk)}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="OVERDUE">有过期</SelectItem>
                <SelectItem value="NEAR_DEADLINE">临近截止(&lt;24h)</SelectItem>
                <SelectItem value="NONE">无竞价</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* 主工厂层级 */}
          <div>
            <Label className="text-xs text-muted-foreground">主工厂层级</Label>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="CENTRAL">核心工厂</SelectItem>
                <SelectItem value="SATELLITE">卫星工厂</SelectItem>
                <SelectItem value="THIRD_PARTY">第三方</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* 操作按钮 */}
          <div className="flex items-end gap-2">
            <Button size="sm" className="h-9">{t('common.search')}</Button>
            <Button size="sm" variant="outline" className="h-9" onClick={handleReset}>{t('common.reset')}</Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedRows.size === paginatedOrders.length && paginatedOrders.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="min-w-[140px]">生产单号</TableHead>
                <TableHead className="min-w-[80px]">旧单号</TableHead>
                <TableHead className="min-w-[180px]">SPU</TableHead>
                <TableHead className="min-w-[100px]">状态</TableHead>
                <TableHead className="min-w-[100px]">技术包</TableHead>
                <TableHead className="min-w-[120px]">拆解状态</TableHead>
                <TableHead className="min-w-[100px]">分配概览</TableHead>
                <TableHead className="min-w-[90px]">分配进度</TableHead>
                <TableHead className="min-w-[130px]">竞价摘要</TableHead>
                <TableHead className="min-w-[130px]">派单摘要</TableHead>
                <TableHead className="min-w-[180px]">主工厂</TableHead>
                <TableHead className="min-w-[150px]">风险</TableHead>
                <TableHead className="min-w-[100px]">最近更新</TableHead>
                <TableHead className="min-w-[160px] sticky right-0 bg-muted/50">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="h-32 text-center text-muted-foreground">
                    {t('common.noData')}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOrders.map(order => {
                  const techPackInfo = getTechPackInfo(order)
                  const lastLog = order.auditLogs[order.auditLogs.length - 1]

                  return (
                    <TableRow 
                      key={order.productionOrderId}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => openOrderDetail(order.productionOrderId)}
                    >
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedRows.has(order.productionOrderId)}
                          onCheckedChange={(checked) => handleSelectRow(order.productionOrderId, !!checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          className="h-auto p-0 text-primary font-mono text-sm"
                          onClick={(e) => { e.stopPropagation(); openOrderDetail(order.productionOrderId) }}
                        >
                          {order.productionOrderId}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {order.legacyOrderNo}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-mono">{order.demandSnapshot.spuCode}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[150px]" title={order.demandSnapshot.spuName}>
                            {order.demandSnapshot.spuName}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={productionOrderStatusConfig[order.status]?.color}>
                          {productionOrderStatusConfig[order.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={techPackStatusConfig[techPackInfo.currentStatus]?.color}>
                            {techPackStatusConfig[techPackInfo.currentStatus]?.label}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {techPackInfo.currentVersion}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {order.taskBreakdownSummary.isBrokenDown ? (
                            <>
                              <Badge variant="outline" className="bg-green-50 text-green-700">已拆解</Badge>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {order.taskBreakdownSummary.lastBreakdownAt?.split(' ')[0]}
                              </div>
                            </>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50">未拆解</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {renderAssignmentOverview(order)}
                      </TableCell>
                      <TableCell>
                        <Badge className={assignmentProgressStatusConfig[order.assignmentProgress.status]?.color}>
                          {assignmentProgressStatusConfig[order.assignmentProgress.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {order.biddingSummary.activeTenderCount > 0 || order.biddingSummary.overdueTenderCount > 0 ? (
                          <div className="text-xs space-y-0.5">
                            <div>活跃: {order.biddingSummary.activeTenderCount}</div>
                            {order.biddingSummary.nearestDeadline && (
                              <div className="flex items-center gap-1 text-yellow-600">
                                <Clock className="h-3 w-3" />
                                {order.biddingSummary.nearestDeadline.split(' ')[0]}
                              </div>
                            )}
                            {order.biddingSummary.overdueTenderCount > 0 && (
                              <div className="text-red-600">过期: {order.biddingSummary.overdueTenderCount}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.directDispatchSummary.assignedFactoryCount > 0 || order.directDispatchSummary.rejectedCount > 0 || order.directDispatchSummary.overdueAckCount > 0 ? (
                          <div className="text-xs space-y-0.5">
                            <div>已分配: {order.directDispatchSummary.assignedFactoryCount}</div>
                            {order.directDispatchSummary.rejectedCount > 0 && (
                              <div className="text-orange-600">拒单: {order.directDispatchSummary.rejectedCount}</div>
                            )}
                            {order.directDispatchSummary.overdueAckCount > 0 && (
                              <div className="text-red-600">超时: {order.directDispatchSummary.overdueAckCount}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium truncate max-w-[150px]" title={order.mainFactorySnapshot.name}>
                            {order.mainFactorySnapshot.name}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Badge variant="outline" className="text-xs">
                              {tierLabels[order.mainFactorySnapshot.tier as keyof typeof tierLabels] || order.mainFactorySnapshot.tier}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {typeLabels[order.mainFactorySnapshot.type as keyof typeof typeLabels] || order.mainFactorySnapshot.type}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {renderRiskFlags(order.riskFlags)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lastLog?.at.split(' ')[0] || order.updatedAt.split(' ')[0]}
                      </TableCell>
                      <TableCell className="sticky right-0 bg-background" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openOrderDetail(order.productionOrderId)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDemandSnapshotOrder(order)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLogsOrder(order)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openTechPackPage(order.demandSnapshot.spuCode)}>
                                <FileText className="mr-2 h-4 w-4" />
                                完善技术包
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openPlaceholderTab('任务分配', `/fcs/dispatch/board?po=${order.productionOrderId}`)}>
                                <Send className="mr-2 h-4 w-4" />
                                去分配中心
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openPlaceholderTab('分配看板', `/fcs/dispatch/board?po=${order.productionOrderId}`)}>
                                <LayoutGrid className="mr-2 h-4 w-4" />
                                去分配看板
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          {t('common.total')} {filteredOrders.length} {t('common.records')}
          {selectedRows.size > 0 && (
            <span className="ml-2">，已选 {selectedRows.size} 项</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>{currentPage} / {totalPages || 1}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 需求快照 Sheet */}
      <Sheet open={!!demandSnapshotOrder} onOpenChange={() => setDemandSnapshotOrder(null)}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          {demandSnapshotOrder && (
            <>
              <SheetHeader>
                <SheetTitle>需求快照</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* 基本信息 */}
                <div>
                  <h4 className="font-medium mb-3">基本信息</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">需求编号</Label>
                      <p className="font-mono">{demandSnapshotOrder.demandSnapshot.demandId}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">SPU编码</Label>
                      <p className="font-mono">{demandSnapshotOrder.demandSnapshot.spuCode}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">SPU名称</Label>
                      <p>{demandSnapshotOrder.demandSnapshot.spuName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">优先级</Label>
                      <p>{demandSnapshotOrder.demandSnapshot.priority}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">交付日期</Label>
                      <p>{demandSnapshotOrder.demandSnapshot.requiredDeliveryDate || '-'}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* SKU明细 */}
                <div>
                  <h4 className="font-medium mb-3">SKU明细</h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>尺码</TableHead>
                          <TableHead>颜色</TableHead>
                          <TableHead className="text-right">数量</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {demandSnapshotOrder.demandSnapshot.skuLines.map((sku, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{sku.skuCode}</TableCell>
                            <TableCell>{sku.size}</TableCell>
                            <TableCell>{sku.color}</TableCell>
                            <TableCell className="text-right">{sku.qty}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* 约束条件 */}
                {demandSnapshotOrder.demandSnapshot.constraintsNote && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-3">约束条件</h4>
                      <p className="text-sm text-muted-foreground">
                        {demandSnapshotOrder.demandSnapshot.constraintsNote}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 日志 Dialog */}
      <Dialog open={!!logsOrder} onOpenChange={() => setLogsOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>操作日志</DialogTitle>
          </DialogHeader>
          {logsOrder && (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>详情</TableHead>
                    <TableHead>操作人</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsOrder.auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        {t('common.noData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    logsOrder.auditLogs.map((log: AuditLog) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {log.at}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.detail}</TableCell>
                        <TableCell className="text-sm">{log.by}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
