'use client'

import { useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, AlertTriangle, FileText, Lock, ExternalLink, Send, Gavel, Bell,
  Clock, Factory, LayoutGrid, History, Settings, Truck, Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useAppShell } from '@/components/app-shell/app-shell-context'
import {
  productionOrders,
  type ProductionOrder,
  type ProductionOrderStatus,
  type RiskFlag,
  productionOrderStatusConfig,
  assignmentProgressStatusConfig,
  techPackStatusConfig,
  riskFlagConfig,
} from '@/lib/fcs/production-orders'
import { getTechPackBySpuCode } from '@/lib/fcs/tech-packs'
import { tierLabels, typeLabels } from '@/lib/fcs/indonesia-factories'
import { legalEntities } from '@/lib/fcs/legal-entities'

// 当前用户 Mock
const currentUser = {
  id: 'U001',
  name: 'Budi Santoso',
  role: 'ADMIN' as const,
}

interface OrderDetailPageProps {
  orderId: string
}

export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const router = useRouter()
  const { addTab, closeTab } = useAppShell()

  // 本地订单数据（用于模拟状态变更）
  const [localOrders, setLocalOrders] = useState(productionOrders)

  // 模拟状态 Dialog
  const [simulateOpen, setSimulateOpen] = useState(false)
  const [simulateStatus, setSimulateStatus] = useState<ProductionOrderStatus>('DRAFT')
  const [confirmSimulateOpen, setConfirmSimulateOpen] = useState(false)

  // 日志 Dialog
  const [logsDialogOpen, setLogsDialogOpen] = useState(false)

  // 获取当前订单
  const order = localOrders.find(o => o.productionOrderId === orderId)

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p>未找到生产单：{orderId}</p>
        <Button
          variant="link"
          onClick={() => {
            closeTab(`po-${orderId}`)
            router.push('/fcs/production/orders')
          }}
        >
          {t('common.back')}
        </Button>
      </div>
    )
  }

  // 获取技术包信息
  const getTechPackInfo = () => {
    const techPack = getTechPackBySpuCode(order.demandSnapshot.spuCode)
    return {
      snapshotStatus: order.techPackSnapshot.status,
      snapshotVersion: order.techPackSnapshot.versionLabel,
      snapshotAt: order.techPackSnapshot.snapshotAt,
      currentStatus: techPack?.status || order.techPackSnapshot.status,
      currentVersion: techPack?.versionLabel || order.techPackSnapshot.versionLabel,
      completenessScore: techPack?.completenessScore || 0,
      missingChecklist: techPack?.missingChecklist || [],
      isOutOfSync: techPack && (techPack.status !== order.techPackSnapshot.status || techPack.versionLabel !== order.techPackSnapshot.versionLabel),
    }
  }

  const techPackInfo = getTechPackInfo()

  // 开始条件判断
  const canBreakdown = order.techPackSnapshot.status === 'RELEASED' && order.status === 'READY_FOR_BREAKDOWN'
  const canAssign = order.taskBreakdownSummary.isBrokenDown && ['WAIT_ASSIGNMENT', 'ASSIGNING'].includes(order.status)
  const canImproveTechPack = !!order.demandSnapshot.spuCode

  // 开始条件原因
  const getBreakdownDisabledReason = () => {
    if (order.techPackSnapshot.status !== 'RELEASED') return '技术包未发布，无法拆解'
    if (order.status !== 'READY_FOR_BREAKDOWN') return '当前状态不支持拆解'
    return ''
  }
  const getAssignDisabledReason = () => {
    if (!order.taskBreakdownSummary.isBrokenDown) return '请先完成工艺任务拆解'
    if (!['WAIT_ASSIGNMENT', 'ASSIGNING'].includes(order.status)) return '当前状态不支持分配'
    return ''
  }

  // 货权主体显示
  const getOwnerDisplay = () => {
    if (order.ownerPartyType === 'FACTORY') {
      if (order.ownerPartyId === order.mainFactoryId) {
        return { text: '主工厂', detail: order.mainFactorySnapshot.name, isAdjusted: false }
      }
      return { text: '工厂（已调整）', detail: order.ownerPartyId, isAdjusted: true }
    }
    const le = legalEntities.find(l => l.id === order.ownerPartyId)
    return { 
      text: le ? le.name : '法人实体', 
      detail: order.ownerReason || '', 
      isAdjusted: true 
    }
  }

  const ownerDisplay = getOwnerDisplay()

  // 打开技术包页面
  const openTechPackPage = () => {
    addTab({
      key: `tech-pack-${order.demandSnapshot.spuCode}`,
      title: `${t('techPack.title')} - ${order.demandSnapshot.spuCode}`,
      href: `/fcs/tech-pack/${order.demandSnapshot.spuCode}`,
      closable: true,
    })
    router.push(`/fcs/tech-pack/${order.demandSnapshot.spuCode}`)
  }

  // 占位跳转
  const openPlaceholderTab = (title: string, href: string) => {
    addTab({ key: href, title, href, closable: true })
    router.push(href)
  }

  // 打开模拟状态
  const openSimulate = () => {
    setSimulateStatus(order.status)
    setSimulateOpen(true)
  }

  // 提交模拟状态
  const handleSimulate = () => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const lockedStatuses: ProductionOrderStatus[] = ['EXECUTING', 'COMPLETED', 'CANCELLED']
    const newLockedLegacy = lockedStatuses.includes(simulateStatus)

    setLocalOrders(prev => prev.map(o =>
      o.productionOrderId === order.productionOrderId
        ? {
            ...o,
            status: simulateStatus,
            lockedLegacy: newLockedLegacy,
            updatedAt: now,
            auditLogs: [
              ...o.auditLogs,
              {
                id: `LOG-${Date.now()}`,
                action: 'STATUS_SIMULATE',
                detail: `状态模拟从 ${productionOrderStatusConfig[o.status].label} 变更为 ${productionOrderStatusConfig[simulateStatus].label}`,
                at: now,
                by: currentUser.name,
              },
            ],
          }
        : o
    ))

    setConfirmSimulateOpen(false)
    setSimulateOpen(false)
  }

  const totalQty = order.demandSnapshot.skuLines.reduce((sum, sku) => sum + sku.qty, 0)

  // 渲染风险标签
  const renderRiskFlags = (flags: RiskFlag[]) => {
    if (flags.length === 0) return null
    return (
      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
        <h3 className="font-medium text-orange-800 mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          风险提示
        </h3>
        <div className="flex flex-wrap gap-2">
          {flags.map(flag => (
            <Badge key={flag} className={cn('text-sm', riskFlagConfig[flag]?.color)}>
              {riskFlagConfig[flag]?.label}
            </Badge>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold font-mono">{order.productionOrderId}</h1>
            <Badge className={productionOrderStatusConfig[order.status]?.color}>
              {productionOrderStatusConfig[order.status]?.label}
            </Badge>
            {order.lockedLegacy && (
              <Badge className="bg-red-100 text-red-700">
                <Lock className="mr-1 h-3 w-3" />
                已锁单
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground ml-10 space-y-0.5">
            <p>关联需求：{order.demandId} | 旧单号：{order.legacyOrderNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* 拆解任务按钮 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    disabled={!canBreakdown}
                    onClick={() => openPlaceholderTab('工艺任务拆解', `/fcs/process/task-breakdown?po=${order.productionOrderId}`)}
                  >
                    拆解任务
                  </Button>
                </span>
              </TooltipTrigger>
              {!canBreakdown && (
                <TooltipContent>{getBreakdownDisabledReason()}</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {/* 去分配按钮 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    disabled={!canAssign}
                    onClick={() => openPlaceholderTab('任务分配', `/fcs/dispatch/board?po=${order.productionOrderId}`)}
                  >
                    去分配
                  </Button>
                </span>
              </TooltipTrigger>
              {!canAssign && (
                <TooltipContent>{getAssignDisabledReason()}</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {/* 完善技术包 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    disabled={!canImproveTechPack}
                    onClick={openTechPackPage}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    完善技术包
                  </Button>
                </span>
              </TooltipTrigger>
              {!canImproveTechPack && (
                <TooltipContent>SPU编码缺失</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {/* 查看日志 */}
          <Button variant="outline" onClick={() => setLogsDialogOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            查看日志
          </Button>

          {/* 催办与通知 */}
          <Button variant="outline" onClick={() => openPlaceholderTab('催办与通知', `/fcs/progress/urge?po=${order.productionOrderId}`)}>
            <Bell className="mr-2 h-4 w-4" />
            催办通知
          </Button>

          {/* 管理员工具 */}
          {currentUser.role === 'ADMIN' && (
            <Button variant="secondary" onClick={openSimulate}>
              <Settings className="mr-2 h-4 w-4" />
              模拟状态流转
            </Button>
          )}
        </div>
      </div>

      {/* 快照/当前不一致提示 */}
      {techPackInfo.isOutOfSync && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-800">技术包快照与当前版本不一致</span>
          </div>
          <p className="mt-1 text-sm text-blue-700">
            快照版本���{techPackInfo.snapshotVersion} ({techPackStatusConfig[techPackInfo.snapshotStatus]?.label}) | 
            当前版本：{techPackInfo.currentVersion} ({techPackStatusConfig[techPackInfo.currentStatus]?.label})
          </p>
        </div>
      )}

      {/* 技术包开始条件 Banner */}
      {order.techPackSnapshot.status !== 'RELEASED' && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="font-medium text-yellow-800">技术包未发布，无法拆解</span>
          </div>
          <p className="mt-1 text-sm text-yellow-700">
            当前技术包状态为 {techPackStatusConfig[order.techPackSnapshot.status]?.label}，请先完善技术包并发布为正式版本。
          </p>
          <Button variant="link" className="mt-2 p-0 h-auto" onClick={openTechPackPage}>
            <ExternalLink className="mr-1 h-4 w-4" />
            完善技术包
          </Button>
        </div>
      )}

      {/* 风险提示 */}
      {renderRiskFlags(order.riskFlags)}

      {/* Header 关键信息卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 主工厂 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Factory className="h-4 w-4" />
              主工厂
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-medium">{order.mainFactorySnapshot.name}</div>
            <div className="text-sm text-muted-foreground">{order.mainFactorySnapshot.code}</div>
            <div className="flex gap-1 mt-1">
              <Badge variant="outline" className="text-xs">
                {tierLabels[order.mainFactorySnapshot.tier as keyof typeof tierLabels]}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {typeLabels[order.mainFactorySnapshot.type as keyof typeof typeLabels]}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 拆解摘要 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">拆解摘要</CardTitle>
          </CardHeader>
          <CardContent>
            {order.taskBreakdownSummary.isBrokenDown ? (
              <>
                <Badge className="bg-green-100 text-green-700 mb-2">已拆解</Badge>
                <div className="text-sm text-muted-foreground">
                  {order.taskBreakdownSummary.taskTypesTop3.join('、')}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {order.taskBreakdownSummary.lastBreakdownAt} by {order.taskBreakdownSummary.lastBreakdownBy}
                </div>
              </>
            ) : (
              <Badge variant="outline">未拆解</Badge>
            )}
          </CardContent>
        </Card>

        {/* 分配摘要 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">分配摘要</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-1">
                <Send className="h-3 w-3 text-blue-500" />
                派单: {order.assignmentSummary.directCount}
              </div>
              <div className="flex items-center gap-1">
                <Gavel className="h-3 w-3 text-purple-500" />
                竞价: {order.assignmentSummary.biddingCount}
              </div>
              <div>总任务: {order.assignmentSummary.totalTasks}</div>
              <div className="text-orange-600">未分配: {order.assignmentSummary.unassignedCount}</div>
            </div>
          </CardContent>
        </Card>

        {/* 分配进度 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">分配进度</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={assignmentProgressStatusConfig[order.assignmentProgress.status]?.color}>
              {assignmentProgressStatusConfig[order.assignmentProgress.status]?.label}
            </Badge>
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              <div>已派单: {order.assignmentProgress.directAssignedCount}</div>
              <div>已发起竞价: {order.assignmentProgress.biddingLaunchedCount}</div>
              <div>已中标: {order.assignmentProgress.biddingAwardedCount}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="demand-snapshot">需求快照</TabsTrigger>
          <TabsTrigger value="tech-pack">技术包</TabsTrigger>
          <TabsTrigger value="assignment">分配概览</TabsTrigger>
          <TabsTrigger value="handover" className="flex items-center gap-1">
            <Truck className="h-3 w-3" />
            交接链路
          </TabsTrigger>
          <TabsTrigger value="logs">日志</TabsTrigger>
        </TabsList>

        {/* 概览 Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">基本信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">生产单号</Label>
                    <p className="font-mono">{order.productionOrderId}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">需求编号</Label>
                    <p className="font-mono">{order.demandId}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">旧单号</Label>
                    <p className="font-mono">{order.legacyOrderNo}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">SPU编码</Label>
                    <p className="font-mono">{order.demandSnapshot.spuCode}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">SPU名称</Label>
                    <p>{order.demandSnapshot.spuName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">总数量</Label>
                    <p className="font-medium">{totalQty.toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">交付日期</Label>
                    <p>{order.demandSnapshot.requiredDeliveryDate || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">创建时间</Label>
                    <p>{order.createdAt}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">最后更新</Label>
                    <p>{order.updatedAt}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 货权与工厂 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">货权与工厂</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">货权主体</Label>
                    <p className={cn(ownerDisplay.isAdjusted && 'text-orange-600 font-medium')}>
                      {ownerDisplay.text}
                    </p>
                    {ownerDisplay.detail && (
                      <p className="text-xs text-muted-foreground">{ownerDisplay.detail}</p>
                    )}
                    {order.ownerReason && (
                      <p className="text-xs text-muted-foreground mt-1">原因：{order.ownerReason}</p>
                    )}
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">工厂名称</Label>
                      <p className="font-medium">{order.mainFactorySnapshot.name}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">工厂编码</Label>
                      <p className="font-mono">{order.mainFactorySnapshot.code}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">层级</Label>
                      <p>{tierLabels[order.mainFactorySnapshot.tier as keyof typeof tierLabels]}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">类型</Label>
                      <p>{typeLabels[order.mainFactorySnapshot.type as keyof typeof typeLabels]}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">位置</Label>
                      <p>{order.mainFactorySnapshot.city}, {order.mainFactorySnapshot.province}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">工厂状态</Label>
                      <Badge variant="outline">{order.mainFactorySnapshot.status}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 需求快照 Tab */}
        <TabsContent value="demand-snapshot" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">需求快照</CardTitle>
              <CardDescription>生产单创建时的需求信息快照</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 基本信息 */}
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">需求编号</Label>
                  <p className="font-mono">{order.demandSnapshot.demandId}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">SPU编码</Label>
                  <p className="font-mono">{order.demandSnapshot.spuCode}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">优先级</Label>
                  <Badge variant="outline">{order.demandSnapshot.priority}</Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">交付日期</Label>
                  <p>{order.demandSnapshot.requiredDeliveryDate || '-'}</p>
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
                        <TableHead>SKU编码</TableHead>
                        <TableHead>尺码</TableHead>
                        <TableHead>颜色</TableHead>
                        <TableHead className="text-right">数量</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.demandSnapshot.skuLines.map((sku, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{sku.skuCode}</TableCell>
                          <TableCell>{sku.size}</TableCell>
                          <TableCell>{sku.color}</TableCell>
                          <TableCell className="text-right">{sku.qty}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} className="font-medium">合计</TableCell>
                        <TableCell className="text-right font-medium">{totalQty.toLocaleString()}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* 约束条件 */}
              {order.demandSnapshot.constraintsNote && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">约束条件</h4>
                    <p className="text-sm text-muted-foreground">{order.demandSnapshot.constraintsNote}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 技术包 Tab */}
        <TabsContent value="tech-pack" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">技术包信息</CardTitle>
              <CardDescription>技术包快照与当前状态对比</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-8">
                {/* 快照信息 */}
                <div>
                  <h4 className="font-medium mb-3">快照信息</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">状态</Label>
                      <div className="mt-1">
                        <Badge className={techPackStatusConfig[techPackInfo.snapshotStatus]?.color}>
                          {techPackStatusConfig[techPackInfo.snapshotStatus]?.label}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">版本</Label>
                      <p>{techPackInfo.snapshotVersion}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">快照时间</Label>
                      <p>{techPackInfo.snapshotAt}</p>
                    </div>
                  </div>
                </div>

                {/* 当前信息 */}
                <div>
                  <h4 className="font-medium mb-3">当前信息</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">状态</Label>
                      <div className="mt-1">
                        <Badge className={techPackStatusConfig[techPackInfo.currentStatus]?.color}>
                          {techPackStatusConfig[techPackInfo.currentStatus]?.label}
                        </Badge>
                        {techPackInfo.isOutOfSync && (
                          <Badge variant="outline" className="ml-2 text-orange-600">不一致</Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">版本</Label>
                      <p>{techPackInfo.currentVersion}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">完整度</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={techPackInfo.completenessScore} className="h-2 flex-1" />
                        <span className="text-sm">{techPackInfo.completenessScore}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 缺口清单 */}
              {techPackInfo.missingChecklist.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">缺口清单</h4>
                  <div className="flex flex-wrap gap-2">
                    {techPackInfo.missingChecklist.map((item, i) => (
                      <Badge key={i} variant="outline" className="bg-red-50 text-red-700">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Button onClick={openTechPackPage}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  完善技术包
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 分配概览 Tab */}
        <TabsContent value="assignment" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* 分配摘要 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">分配摘要</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1">
                      <Send className="h-4 w-4 text-blue-500" />
                      派单任务
                    </span>
                    <span className="font-medium">{order.assignmentSummary.directCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1">
                      <Gavel className="h-4 w-4 text-purple-500" />
                      竞价任务
                    </span>
                    <span className="font-medium">{order.assignmentSummary.biddingCount}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span>总任务数</span>
                    <span className="font-medium">{order.assignmentSummary.totalTasks}</span>
                  </div>
                  <div className="flex justify-between text-orange-600">
                    <span>未分配</span>
                    <span className="font-medium">{order.assignmentSummary.unassignedCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 竞价摘要 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-purple-500" />
                  竞价摘要
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span>活跃竞价</span>
                    <span className="font-medium">{order.biddingSummary.activeTenderCount}</span>
                  </div>
                  {order.biddingSummary.nearestDeadline && (
                    <div className="flex justify-between text-yellow-600">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        最近截止
                      </span>
                      <span className="font-medium">{order.biddingSummary.nearestDeadline.split(' ')[0]}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-red-600">
                    <span>已过期</span>
                    <span className="font-medium">{order.biddingSummary.overdueTenderCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 派单摘要 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="h-4 w-4 text-blue-500" />
                  派单摘要
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span>已分配工厂</span>
                    <span className="font-medium">{order.directDispatchSummary.assignedFactoryCount}</span>
                  </div>
                  <div className="flex justify-between text-orange-600">
                    <span>拒单数</span>
                    <span className="font-medium">{order.directDispatchSummary.rejectedCount}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>确认超时</span>
                    <span className="font-medium">{order.directDispatchSummary.overdueAckCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 分配操作入口 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Button 
                  onClick={() => openPlaceholderTab('任务分配', `/fcs/dispatch/board?po=${order.productionOrderId}`)}
                >
                  <Send className="mr-2 h-4 w-4" />
                  去分配中心
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => openPlaceholderTab('分配看板', `/fcs/dispatch/board?po=${order.productionOrderId}`)}
                >
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  分配看板
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 日志 Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">操作日志</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
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
                    {order.auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          {t('common.noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      [...order.auditLogs].reverse().map((log) => (
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* 交接链路 Tab */}
        <TabsContent value="handover" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  交接链路
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => openPlaceholderTab('交接链路追踪', `/fcs/progress/handover?po=${order.productionOrderId}`)}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  打开交接页面
                </Button>
              </div>
              <CardDescription>该生产单相关的交接事件</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 交接摘要提示 */}
                <div className="flex items-center gap-4 rounded-lg bg-muted p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">待确认: -</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm">争议/差异: -</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-green-500" />
                    <span className="text-sm">已确认: -</span>
                  </div>
                </div>

                {/* 风险提示 */}
                {order.riskFlags.includes('HANDOVER_DIFF' as RiskFlag) && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-800">存在交接差异异常</span>
                    </div>
                    <p className="mt-1 text-sm text-red-700">
                      该生产单存在交接数��差异���请查看交接链路追踪处理
                    </p>
                    <Button
                      variant="link"
                      className="mt-2 p-0 h-auto text-red-700"
                      onClick={() => {
                        const params = new URLSearchParams()
                        params.set('po', order.productionOrderId)
                        params.set('reasonCode', 'HANDOVER_DIFF')
                        openPlaceholderTab('异常定位', `/fcs/progress/exceptions?${params.toString()}`)
                      }}
                    >
                      <ExternalLink className="mr-1 h-4 w-4" />
                      查看交接异常
                    </Button>
                  </div>
                )}

                {/* 快速操作 */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => openPlaceholderTab('交接链路追踪', `/fcs/progress/handover?po=${order.productionOrderId}`)}
                  >
                    <Truck className="mr-2 h-4 w-4" />
                    查看完整交接链路
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const params = new URLSearchParams()
                      params.set('po', order.productionOrderId)
                      params.set('reasonCode', 'HANDOVER_DIFF')
                      openPlaceholderTab('异常定位', `/fcs/progress/exceptions?${params.toString()}`)
                    }}
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    查看交接异常
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                  点击上方按钮查看完整的交接事件列表与时间线
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 日志 Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>操作日志</DialogTitle>
          </DialogHeader>
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
                {order.auditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t('common.noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  [...order.auditLogs].reverse().map((log) => (
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
        </DialogContent>
      </Dialog>

      {/* 模拟状态 Dialog */}
      <Dialog open={simulateOpen} onOpenChange={setSimulateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>模拟状态流转</DialogTitle>
            <DialogDescription>
              仅限管理员使用，用于测试不同状态下的页面表现
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>选择目标状态</Label>
            <Select value={simulateStatus} onValueChange={(v) => setSimulateStatus(v as ProductionOrderStatus)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
            <p className="text-xs text-muted-foreground mt-2">
              当状态为 生产执行中/已完成/已取消 时，订单将被锁定
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSimulateOpen(false)}>
              取消
            </Button>
            <Button onClick={() => setConfirmSimulateOpen(true)}>
              确认变更
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认模拟状态 */}
      <AlertDialog open={confirmSimulateOpen} onOpenChange={setConfirmSimulateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认状态变更</AlertDialogTitle>
            <AlertDialogDescription>
              确定将状态从「{productionOrderStatusConfig[order.status].label}」变更为「{productionOrderStatusConfig[simulateStatus].label}」吗？
              此操作将记录到审计日志。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleSimulate}>确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
