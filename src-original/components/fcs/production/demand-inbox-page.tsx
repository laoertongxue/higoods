'use client'

import { useState, useMemo } from 'react'
import { useRouter } from '@/lib/navigation'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { 
  Search, Copy, RefreshCw, Plus,
  FileText, AlertTriangle, Check, ExternalLink,
} from 'lucide-react'

import { useAppShell } from '@/components/app-shell/app-shell-context'
import { productionDemands, type ProductionDemand } from '@/lib/fcs/production-demands'
import { productionOrders, type ProductionOrder } from '@/lib/fcs/production-orders'
import { indonesiaFactories } from '@/lib/fcs/indonesia-factories'
import { factoryTierConfig, factoryTypeConfig, typesByTier, type FactoryTier, type FactoryType } from '@/lib/fcs/factory-types'
import { getTechPackBySpuCode, type TechPack } from '@/lib/fcs/tech-packs'
import { legalEntities } from '@/lib/fcs/legal-entities'

// 当前用户 Mock
const currentUser = {
  id: 'U001',
  name: 'Budi Santoso',
  role: 'ADMIN' as const,
}

// 状态配置
const demandStatusConfig: Record<string, { label: string; className: string }> = {
  PENDING_CONVERT: { label: '待转单', className: 'bg-blue-100 text-blue-700' },
  CONVERTED:       { label: '已转单', className: 'bg-green-100 text-green-700' },
  HOLD:            { label: '已挂起', className: 'bg-yellow-100 text-yellow-700' },
  CANCELLED:       { label: '已取消', className: 'bg-gray-100 text-gray-500' },
}

const techPackStatusConfig: Record<string, { label: string; className: string }> = {
  INCOMPLETE: { label: '待完善', className: 'bg-orange-100 text-orange-700' },
  RELEASED:   { label: '已发布', className: 'bg-green-100 text-green-700' },
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  URGENT: { label: '紧急', className: 'bg-red-100 text-red-700' },
  HIGH:   { label: '高',   className: 'bg-orange-100 text-orange-700' },
  NORMAL: { label: '普通', className: 'bg-blue-100 text-blue-700' },
}

export function DemandInboxPage() {
  const router = useRouter()
  const { addTab } = useAppShell()

  // 筛选状态
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [techPackFilter, setTechPackFilter] = useState<string>('ALL')
  const [hasOrderFilter, setHasOrderFilter] = useState<string>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')
  const [onlyUngenerated, setOnlyUngenerated] = useState(false)

  // 选择状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // 本地数据状态
  const [localDemands, setLocalDemands] = useState(productionDemands)
  const [localOrders, setLocalOrders] = useState(productionOrders)

  // 弹窗状态
  const [detailDemand, setDetailDemand] = useState<ProductionDemand | null>(null)
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  const [singleGenerateDemand, setSingleGenerateDemand] = useState<ProductionDemand | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  // 生成表单
  const [selectedFactoryId, setSelectedFactoryId] = useState('')
  const [tierFilter, setTierFilter] = useState<FactoryTier | 'ALL'>('ALL')
  const [typeFilter, setTypeFilter] = useState<FactoryType | 'ALL'>('ALL')
  const [factorySearch, setFactorySearch] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [ownerPartyManual, setOwnerPartyManual] = useState(false)
  const [ownerPartyType, setOwnerPartyType] = useState<'FACTORY' | 'LEGAL_ENTITY'>('FACTORY')
  const [ownerPartyId, setOwnerPartyId] = useState('')
  const [ownerReason, setOwnerReason] = useState('')

  // 筛选数据
  const filteredDemands = useMemo(() => {
    let result = [...localDemands]
    if (keyword) {
      const kw = keyword.toLowerCase()
      result = result.filter(d =>
        d.demandId.toLowerCase().includes(kw) ||
        d.spuCode.toLowerCase().includes(kw) ||
        d.spuName.toLowerCase().includes(kw) ||
        d.legacyOrderNo.toLowerCase().includes(kw)
      )
    }
    if (statusFilter !== 'ALL') result = result.filter(d => d.demandStatus === statusFilter)
    if (techPackFilter !== 'ALL') result = result.filter(d => d.techPackStatus === techPackFilter)
    if (hasOrderFilter === 'YES') result = result.filter(d => d.hasProductionOrder)
    if (hasOrderFilter === 'NO') result = result.filter(d => !d.hasProductionOrder)
    if (priorityFilter !== 'ALL') result = result.filter(d => d.priority === priorityFilter)
    if (onlyUngenerated) result = result.filter(d => !d.hasProductionOrder)
    return result
  }, [localDemands, keyword, statusFilter, techPackFilter, hasOrderFilter, priorityFilter, onlyUngenerated])

  // 可批量生成的需求（已选 + 待转单 + 未生成）
  const canBatchGenerate = useMemo(() => {
    return Array.from(selectedIds).filter(id => {
      const demand = localDemands.find(d => d.demandId === id)
      return demand && demand.demandStatus === 'PENDING_CONVERT' && !demand.hasProductionOrder
    })
  }, [selectedIds, localDemands])

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDemands.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredDemands.map(d => d.demandId)))
    }
  }

  // 单选
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  // 本地状态操作
  const holdDemand = (demandId: string) => {
    setLocalDemands(prev => prev.map(d =>
      d.demandId === demandId ? { ...d, demandStatus: 'HOLD' } : d
    ))
  }

  const unholdDemand = (demandId: string) => {
    setLocalDemands(prev => prev.map(d =>
      d.demandId === demandId ? { ...d, demandStatus: 'PENDING_CONVERT' } : d
    ))
  }

  const cancelDemand = (demandId: string) => {
    setLocalDemands(prev => prev.map(d =>
      d.demandId === demandId ? { ...d, demandStatus: 'CANCELLED' } : d
    ))
  }

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // 获取技术包信息
  const getTechPackInfo = (demand: ProductionDemand) => {
    const techPack = getTechPackBySpuCode(demand.spuCode)
    return {
      status: techPack?.status || demand.techPackStatus,
      versionLabel: techPack?.versionLabel || demand.techPackVersionLabel,
      missingChecklist: techPack?.missingChecklist || [],
    }
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

  // 工厂选项（支持层级/类型/关键字筛选）
  const factoryOptions = useMemo(() => {
    let factories = indonesiaFactories.filter(f => f.status === 'ACTIVE')
    if (tierFilter !== 'ALL') factories = factories.filter(f => f.tier === tierFilter)
    if (typeFilter !== 'ALL') factories = factories.filter(f => f.type === typeFilter)
    if (factorySearch.trim()) {
      const kw = factorySearch.toLowerCase()
      factories = factories.filter(f =>
        f.code.toLowerCase().includes(kw) || f.name.toLowerCase().includes(kw)
      )
    }
    return factories.sort((a, b) => {
      const tierOrder: Record<string, number> = { SATELLITE: 0, THIRD_PARTY: 1, CENTRAL: 2 }
      return (tierOrder[a.tier] || 2) - (tierOrder[b.tier] || 2)
    })
  }, [tierFilter, typeFilter, factorySearch])

  // 当前层级下可选类型
  const availableTypes = useMemo<FactoryType[]>(() => {
    if (tierFilter === 'ALL') return Object.keys(factoryTypeConfig) as FactoryType[]
    return typesByTier[tierFilter as FactoryTier] || []
  }, [tierFilter])

  // 重置生成表单
  const resetGenerateForm = () => {
    setSelectedFactoryId('')
    setTierFilter('ALL')
    setTypeFilter('ALL')
    setFactorySearch('')
    setShowAdvanced(false)
    setOwnerPartyManual(false)
    setOwnerPartyType('FACTORY')
    setOwnerPartyId('')
    setOwnerReason('')
  }

  // 打开单条生成
  const openSingleGenerate = (demand: ProductionDemand) => {
    resetGenerateForm()
    setSingleGenerateDemand(demand)
  }

  // 打开批量生成
  const openBatchGenerate = () => {
    resetGenerateForm()
    setBatchDialogOpen(true)
  }

  // 执行生成
  const handleGenerate = (demandIds: string[]) => {
    if (!selectedFactoryId) return

    const factory = indonesiaFactories.find(f => f.id === selectedFactoryId)
    if (!factory) return

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const newOrders: ProductionOrder[] = []

    demandIds.forEach((demandId, index) => {
      const demand = localDemands.find(d => d.demandId === demandId)
      if (!demand || demand.hasProductionOrder) return

      const newOrderId = `PO-202603-${String(localOrders.length + newOrders.length + 1).padStart(4, '0')}`
      const initialStatus = demand.techPackStatus === 'RELEASED' ? 'READY_FOR_BREAKDOWN' : 'WAIT_TECH_PACK_RELEASE'

      const finalOwnerPartyType = ownerPartyManual ? ownerPartyType : 'FACTORY'
      const finalOwnerPartyId = (ownerPartyManual && ownerPartyType === 'LEGAL_ENTITY') ? ownerPartyId : selectedFactoryId

      newOrders.push({
        productionOrderId: newOrderId,
        demandId: demand.demandId,
        legacyOrderNo: demand.legacyOrderNo,
        status: initialStatus,
        lockedLegacy: false,
        mainFactoryId: selectedFactoryId,
        mainFactorySnapshot: {
          id: factory.id,
          code: factory.code,
          name: factory.name,
          tier: factory.tier,
          type: factory.type,
          status: factory.status,
          province: factory.province,
          city: factory.city,
          tags: factory.tags,
        },
        ownerPartyType: finalOwnerPartyType,
        ownerPartyId: finalOwnerPartyId,
        ownerReason: ownerReason || undefined,
        techPackSnapshot: {
          status: demand.techPackStatus,
          versionLabel: demand.techPackVersionLabel,
          snapshotAt: now,
        },
        demandSnapshot: {
          demandId: demand.demandId,
          spuCode: demand.spuCode,
          spuName: demand.spuName,
          priority: demand.priority,
          requiredDeliveryDate: demand.requiredDeliveryDate,
          constraintsNote: demand.constraintsNote,
          skuLines: demand.skuLines,
        },
        auditLogs: [{
          id: `LOG-${Date.now()}-${index}`,
          action: 'CREATE',
          detail: `从需求 ${demand.demandId} 生成生产单`,
          at: now,
          by: currentUser.name,
        }],
        createdAt: now,
        updatedAt: now,
      })
    })

    // 更新本地状态
    setLocalOrders(prev => [...prev, ...newOrders])
    setLocalDemands(prev => prev.map(d => {
      const newOrder = newOrders.find(o => o.demandId === d.demandId)
      if (newOrder) {
          return { ...d, hasProductionOrder: true, productionOrderId: newOrder.productionOrderId, demandStatus: 'CONVERTED', updatedAt: now }
        }
      return d
    }))

    // 关闭弹窗
    setConfirmDialogOpen(false)
    setBatchDialogOpen(false)
    setSingleGenerateDemand(null)
    setSelectedIds(new Set())

    // 如果是单条生成，跳转到详情
    if (newOrders.length === 1) {
      const order = newOrders[0]
      addTab({
        key: `po-${order.productionOrderId}`,
        title: `${t('orders.title')} ${order.productionOrderId}`,
        href: `/fcs/production/orders/${order.productionOrderId}`,
        closable: true,
      })
      router.push(`/fcs/production/orders/${order.productionOrderId}`)
    }
  }

  // 确认生成
  const handleConfirmGenerate = () => {
    if (singleGenerateDemand) {
      handleGenerate([singleGenerateDemand.demandId])
    } else {
      handleGenerate(canBatchGenerate)
    }
  }

  // 重置筛选
  const handleReset = () => {
    setKeyword('')
    setStatusFilter('ALL')
    setTechPackFilter('ALL')
    setHasOrderFilter('ALL')
    setPriorityFilter('ALL')
    setOnlyUngenerated(false)
  }

  // 查看生产单
  const viewProductionOrder = (orderId: string) => {
    addTab({
      key: `po-${orderId}`,
      title: `${t('orders.title')} ${orderId}`,
      href: `/fcs/production/orders/${orderId}`,
      closable: true,
    })
    router.push(`/fcs/production/orders/${orderId}`)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('demandInbox.title')}</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="only-ungenerated"
              checked={onlyUngenerated}
              onCheckedChange={setOnlyUngenerated}
            />
            <Label htmlFor="only-ungenerated" className="text-sm">只看未生成</Label>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={openBatchGenerate}
            disabled={canBatchGenerate.length === 0}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t('demandInbox.batchGenerate')} ({canBatchGenerate.length})
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-1 h-4 w-4" />
            {t('common.reset')}
          </Button>
        </div>
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '待转单', value: localDemands.filter(d => d.demandStatus === 'PENDING_CONVERT').length },
          { label: '已转单', value: localDemands.filter(d => d.demandStatus === 'CONVERTED').length },
          { label: '已挂起', value: localDemands.filter(d => d.demandStatus === 'HOLD').length },
        ].map(card => (
          <div key={card.label} className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* FilterBar */}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
          <div>
            <Label className="text-xs text-muted-foreground">{t('demandInbox.filter.keyword')}</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('demandInbox.filter.keyword')}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('demandInbox.filter.status')}</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="PENDING_CONVERT">待转单</SelectItem>
                <SelectItem value="CONVERTED">已转单</SelectItem>
                <SelectItem value="HOLD">已挂起</SelectItem>
                <SelectItem value="CANCELLED">已取消</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('demandInbox.filter.techPackStatus')}</Label>
            <Select value={techPackFilter} onValueChange={setTechPackFilter}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="INCOMPLETE">待完善</SelectItem>
                <SelectItem value="RELEASED">已发布</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('demandInbox.filter.generated')}</Label>
            <Select value={hasOrderFilter} onValueChange={setHasOrderFilter}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="YES">{t('demandInbox.table.generated')}</SelectItem>
                <SelectItem value="NO">{t('demandInbox.table.notGenerated')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('demandInbox.filter.priority')}</Label>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="URGENT">紧急</SelectItem>
                <SelectItem value="HIGH">高</SelectItem>
                <SelectItem value="NORMAL">普通</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm">{t('common.search')}</Button>
            <Button size="sm" variant="outline" onClick={handleReset}>{t('common.reset')}</Button>
          </div>
        </div>
      </div>

      {/* 已选信息 */}
      {selectedIds.size > 0 && (
        <div className="text-sm text-muted-foreground">
          {t('common.selected')} {selectedIds.size} {t('common.items')}，
          可生成 {canBatchGenerate.length} {t('common.items')}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={filteredDemands.length > 0 && selectedIds.size === filteredDemands.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>需求编号</TableHead>
              <TableHead>来源单号</TableHead>
              <TableHead>SPU</TableHead>
              <TableHead>{t('demandInbox.table.priority')}</TableHead>
              <TableHead>{t('demandInbox.table.status')}</TableHead>
              <TableHead>{t('demandInbox.table.techPack')}</TableHead>
              <TableHead className="text-right">{t('demandInbox.table.totalQty')}</TableHead>
              <TableHead>{t('demandInbox.table.deliveryDate')}</TableHead>
              <TableHead>生产单</TableHead>
              <TableHead>{t('common.action')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDemands.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                  {t('common.noData')}
                </TableCell>
              </TableRow>
            ) : (
              filteredDemands.map(demand => {
                const isSelected = selectedIds.has(demand.demandId)
                const techPackInfo = getTechPackInfo(demand)

                return (
                  <TableRow key={demand.demandId} className={cn(isSelected && 'bg-muted/30')}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(demand.demandId)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {demand.demandId}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-1">
                        {demand.legacyOrderNo}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-50 hover:opacity-100"
                          onClick={() => copyToClipboard(demand.legacyOrderNo)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-mono text-xs text-muted-foreground">{demand.spuCode}</div>
                        <div className="text-sm font-medium truncate max-w-[140px]" title={demand.spuName}>
                          {demand.spuName}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={priorityConfig[demand.priority]?.className}>
                        {priorityConfig[demand.priority]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={demandStatusConfig[demand.demandStatus]?.className}>
                        {demandStatusConfig[demand.demandStatus]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge className={techPackStatusConfig[techPackInfo.status]?.className}>
                          {techPackStatusConfig[techPackInfo.status]?.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({techPackInfo.versionLabel})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {demand.requiredQtyTotal.toLocaleString()}
                    </TableCell>
                    <TableCell>{demand.requiredDeliveryDate || '-'}</TableCell>
                    <TableCell>
                      {demand.hasProductionOrder ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-primary"
                          onClick={() => demand.productionOrderId && viewProductionOrder(demand.productionOrderId)}
                        >
                          {demand.productionOrderId}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button variant="ghost" size="sm" onClick={() => setDetailDemand(demand)}>
                          {t('demandInbox.viewDetail')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openTechPackPage(demand.spuCode)}>
                          <FileText className="h-4 w-4 mr-1" />
                          {t('demandInbox.improveTechPack')}
                        </Button>
                        {demand.demandStatus === 'PENDING_CONVERT' && !demand.hasProductionOrder && (
                          <Button variant="outline" size="sm" onClick={() => openSingleGenerate(demand)}>
                            {t('demandInbox.generate')}
                          </Button>
                        )}
                        {demand.demandStatus === 'PENDING_CONVERT' && (
                          <Button variant="ghost" size="sm" onClick={() => holdDemand(demand.demandId)}>
                            挂起
                          </Button>
                        )}
                        {demand.demandStatus === 'HOLD' && (
                          <Button variant="ghost" size="sm" onClick={() => unholdDemand(demand.demandId)}>
                            取消挂起
                          </Button>
                        )}
                        {(demand.demandStatus === 'PENDING_CONVERT' || demand.demandStatus === 'HOLD') && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => cancelDemand(demand.demandId)}>
                            取消
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页信息 */}
      <div className="text-sm text-muted-foreground">
        {t('common.total')} {filteredDemands.length} {t('common.records')}
      </div>

      {/* 需求详情 Sheet */}
      <Sheet open={!!detailDemand} onOpenChange={() => setDetailDemand(null)}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          {detailDemand && (
            <>
              <SheetHeader>
                <SheetTitle>{t('demandInbox.detail.title')}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* 基本信息 */}
                <div>
                  <h4 className="font-medium mb-3">{t('demandInbox.detail.basicInfo')}</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('demandInbox.table.demandId')}</Label>
                      <p className="font-mono">{detailDemand.demandId}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">旧单号</Label>
                      <p className="font-mono">{detailDemand.legacyOrderNo}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('demandInbox.table.spuCode')}</Label>
                      <p className="font-mono">{detailDemand.spuCode}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('demandInbox.table.spuName')}</Label>
                      <p>{detailDemand.spuName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('demandInbox.table.totalQty')}</Label>
                      <p className="font-medium">{detailDemand.requiredQtyTotal.toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('demandInbox.table.deliveryDate')}</Label>
                      <p>{detailDemand.requiredDeliveryDate || '-'}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 技术包信息 */}
                <div>
                  <h4 className="font-medium mb-3">{t('demandInbox.detail.techPackInfo')}</h4>
                  {(() => {
                    const techPackInfo = getTechPackInfo(detailDemand)
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge className={techPackStatusConfig[techPackInfo.status]?.className}>
                            {techPackStatusConfig[techPackInfo.status]?.label}
                          </Badge>
                          <span className="text-sm">版本: {techPackInfo.versionLabel}</span>
                        </div>
                        {techPackInfo.missingChecklist.length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">{t('demandInbox.detail.missingChecklist')}</Label>
                            <div className="mt-1 space-y-1">
                              {techPackInfo.missingChecklist.map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-orange-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            openTechPackPage(detailDemand.spuCode)
                            setDetailDemand(null)
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          {t('demandInbox.improveTechPack')}
                        </Button>
                      </div>
                    )
                  })()}
                </div>

                <Separator />

                {/* SKU明细 */}
                <div>
                  <h4 className="font-medium mb-3">{t('demandInbox.detail.skuLines')}</h4>
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
                        {detailDemand.skuLines.map((sku, i) => (
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
                {detailDemand.constraintsNote && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-3">{t('demandInbox.detail.constraints')}</h4>
                      <p className="text-sm text-muted-foreground">{detailDemand.constraintsNote}</p>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 批量生成 Dialog */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('demandInbox.batchGenerate.title')}</DialogTitle>
            <DialogDescription>{t('demandInbox.batchGenerate.desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 已选需求清单 */}
            <div className="rounded-md border max-h-[200px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('demandInbox.table.demandId')}</TableHead>
                    <TableHead>{t('demandInbox.table.spuCode')}</TableHead>
                    <TableHead>{t('demandInbox.table.techPack')}</TableHead>
                    <TableHead className="text-right">{t('demandInbox.table.totalQty')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {canBatchGenerate.map(id => {
                    const demand = localDemands.find(d => d.demandId === id)!
                    const techPackInfo = getTechPackInfo(demand)
                    return (
                      <TableRow key={id}>
                        <TableCell className="font-mono text-sm">{demand.demandId}</TableCell>
                        <TableCell className="font-mono text-sm">{demand.spuCode}</TableCell>
                        <TableCell>
                          <Badge className={techPackStatusConfig[techPackInfo.status]?.className}>
                            {techPackStatusConfig[techPackInfo.status]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{demand.requiredQtyTotal.toLocaleString()}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* 选择主工厂 */}
            <div className="space-y-2">
              <Label>{t('demandInbox.batchGenerate.selectFactory')} *</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">组织层级</Label>
                  <Select value={tierFilter} onValueChange={v => { setTierFilter(v as any); setTypeFilter('ALL'); setSelectedFactoryId('') }}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部层级" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">全部层级</SelectItem>
                      {(Object.keys(factoryTierConfig) as FactoryTier[]).map(tier => (
                        <SelectItem key={tier} value={tier}>{factoryTierConfig[tier].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">工厂类型</Label>
                  <Select value={typeFilter} onValueChange={v => { setTypeFilter(v as any); setSelectedFactoryId('') }}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">全部类型</SelectItem>
                      {availableTypes.map(type => (
                        <SelectItem key={type} value={type}>{factoryTypeConfig[type]?.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">搜索工厂</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="输入工厂代码或名称搜索"
                    value={factorySearch}
                    onChange={e => setFactorySearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={selectedFactoryId} onValueChange={setSelectedFactoryId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('demandInbox.batchGenerate.factoryRequired')} />
                </SelectTrigger>
                <SelectContent>
                  {factoryOptions.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      [{factoryTierConfig[f.tier as FactoryTier]?.label}] {f.code} - {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 高级设置 */}
            <div>
              <Button variant="ghost" size="sm" onClick={() => setShowAdvanced(!showAdvanced)}>
                {showAdvanced ? '收起高级设置' : '展开高级设置'}
              </Button>
              {showAdvanced && (
                <div className="mt-2 space-y-3 p-3 rounded border bg-muted/30">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">货权主体类型</Label>
                      <Select
                        value={ownerPartyManual ? ownerPartyType : 'FACTORY'}
                        onValueChange={(v) => {
                          setOwnerPartyManual(true)
                          setOwnerPartyType(v as 'FACTORY' | 'LEGAL_ENTITY')
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FACTORY">工厂（默认）</SelectItem>
                          <SelectItem value="LEGAL_ENTITY">法务主体</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {ownerPartyManual && ownerPartyType === 'LEGAL_ENTITY' && (
                      <div className="space-y-2">
                        <Label className="text-xs">法务主体</Label>
                        <Select value={ownerPartyId} onValueChange={setOwnerPartyId}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择法务主体" />
                          </SelectTrigger>
                          <SelectContent>
                            {legalEntities.map(e => (
                              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">变更原因</Label>
                    <Textarea
                      value={ownerReason}
                      onChange={e => setOwnerReason(e.target.value)}
                      placeholder="如需变更货权主体，请填写原因"
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => setConfirmDialogOpen(true)}
              disabled={!selectedFactoryId}
            >
              {t('demandInbox.batchGenerate.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 单条生成 Dialog */}
      <Dialog open={!!singleGenerateDemand} onOpenChange={() => setSingleGenerateDemand(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('demandInbox.generate')}</DialogTitle>
            {singleGenerateDemand && (
              <DialogDescription>
                为需求 {singleGenerateDemand.demandId} ({singleGenerateDemand.spuCode}) 生成生产单
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('demandInbox.batchGenerate.selectFactory')} *</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">组织层级</Label>
                  <Select value={tierFilter} onValueChange={v => { setTierFilter(v as any); setTypeFilter('ALL'); setSelectedFactoryId('') }}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部层级" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">全部层级</SelectItem>
                      {(Object.keys(factoryTierConfig) as FactoryTier[]).map(tier => (
                        <SelectItem key={tier} value={tier}>{factoryTierConfig[tier].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">工厂类型</Label>
                  <Select value={typeFilter} onValueChange={v => { setTypeFilter(v as any); setSelectedFactoryId('') }}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">全部类型</SelectItem>
                      {availableTypes.map(type => (
                        <SelectItem key={type} value={type}>{factoryTypeConfig[type]?.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">搜索工厂</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="输入工厂代码或名称搜索"
                    value={factorySearch}
                    onChange={e => setFactorySearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={selectedFactoryId} onValueChange={setSelectedFactoryId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('demandInbox.batchGenerate.factoryRequired')} />
                </SelectTrigger>
                <SelectContent>
                  {factoryOptions.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      [{factoryTierConfig[f.tier as FactoryTier]?.label}] {f.code} - {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSingleGenerateDemand(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => setConfirmDialogOpen(true)}
              disabled={!selectedFactoryId}
            >
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认弹窗 */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              确认生成生产单？技术包待完善的需求可先转单，但后续任务拆解需待技术包发布后进行。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmGenerate}>
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
