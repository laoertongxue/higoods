'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from '@/lib/navigation'
import { PackageSearch, ArrowLeft, X, ChevronRight, AlertTriangle, Check, Package, Loader2, Search, RotateCcw } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { t } from '@/lib/i18n'
import { parseQuery, buildQuery } from '@/lib/query'
import {
  getPickingOrdersByPo,
  getPickingLinesByPickId,
  getPoSummaryById,
  getShortageSummaryByPo,
  getPickingOrderById,
  getPoList,
  getMaterialProgressByPo,
  type PickingOrder,
  type PickingLine,
  type PoSummary,
  type MaterialProgress,
} from '@/lib/mocks/legacyWmsPicking'

// 状态颜色映射
const statusVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  NOT_CREATED: 'outline',
  CREATED: 'secondary',
  PICKING: 'default',
  PARTIAL: 'destructive',
  COMPLETED: 'default',
  CANCELLED: 'outline',
}

const materialStatusVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  NOT_CREATED: 'outline',
  CREATED: 'secondary',
  PICKING: 'default',
  PARTIAL: 'destructive',
  COMPLETED: 'default',
}

// 物料就绪状态选项
const getReadinessStatusOptions = () => [
  { value: 'ALL', label: t('common.all') },
  { value: 'NOT_CREATED', label: t('materialReadyStatus.NOT_CREATED') },
  { value: 'CREATED', label: t('materialReadyStatus.CREATED') },
  { value: 'PICKING', label: t('materialReadyStatus.PICKING') },
  { value: 'PARTIAL', label: t('materialReadyStatus.PARTIAL') },
  { value: 'COMPLETED', label: t('materialReadyStatus.COMPLETED') },
]

// 是否有缺口选项
const getHasShortageOptions = () => [
  { value: 'ALL', label: t('progress.material.list.filters.hasShortage.all') },
  { value: 'YES', label: t('progress.material.list.filters.hasShortage.yes') },
  { value: 'NO', label: t('progress.material.list.filters.hasShortage.no') },
]

// 列表行数据类型
interface PoListRow extends PoSummary {
  progress: MaterialProgress
}

// =============================================
// 列表视图组件
// =============================================
function MaterialListView({ onSelectPo }: { onSelectPo: (poId: string) => void }) {
  // 筛选状态
  const [keyword, setKeyword] = useState('')
  const [readinessStatus, setReadinessStatus] = useState('ALL')
  const [hasShortage, setHasShortage] = useState('ALL')
  const [deliveryDateFrom, setDeliveryDateFrom] = useState('')
  const [deliveryDateTo, setDeliveryDateTo] = useState('')
  
  // 获取 PO 列表并计算进度
  const poListWithProgress: PoListRow[] = useMemo(() => {
    const poList = getPoList()
    return poList.map(po => ({
      ...po,
      progress: getMaterialProgressByPo(po.poId),
    }))
  }, [])
  
  // 应用筛选
  const filteredList = useMemo(() => {
    return poListWithProgress.filter(row => {
      // 关键词筛选
      if (keyword) {
        const kw = keyword.toLowerCase()
        const match = 
          row.poId.toLowerCase().includes(kw) ||
          row.spuCode.toLowerCase().includes(kw) ||
          row.spuName.toLowerCase().includes(kw) ||
          row.mainFactoryName.toLowerCase().includes(kw)
        if (!match) return false
      }
      
      // 物料就绪状态筛选
      if (readinessStatus !== 'ALL' && row.progress.readinessStatus !== readinessStatus) {
        return false
      }
      
      // 是否有缺口筛选
      if (hasShortage === 'YES' && row.progress.shortLineCount === 0) return false
      if (hasShortage === 'NO' && row.progress.shortLineCount > 0) return false
      
      // 交付期范围筛选
      if (deliveryDateFrom && row.requiredDeliveryDate < deliveryDateFrom) return false
      if (deliveryDateTo && row.requiredDeliveryDate > deliveryDateTo) return false
      
      return true
    })
  }, [poListWithProgress, keyword, readinessStatus, hasShortage, deliveryDateFrom, deliveryDateTo])
  
  // 重置筛选
  const handleReset = () => {
    setKeyword('')
    setReadinessStatus('ALL')
    setHasShortage('ALL')
    setDeliveryDateFrom('')
    setDeliveryDateTo('')
  }
  
  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="flex items-center gap-4">
        <Link href="/fcs/progress/board">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t('common.back')}
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <PackageSearch className="h-5 w-5" />
            {t('progress.material.list.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('progress.material.list.subtitle')}</p>
        </div>
      </div>
      
      {/* 筛选条 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* 关键词 */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">{t('progress.material.list.filters.keyword')}</label>
              <Input
                placeholder={t('progress.material.list.filters.keywordPlaceholder')}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                className="h-9"
              />
            </div>
            
            {/* 物料就绪状态 */}
            <div className="w-[150px]">
              <label className="text-xs text-muted-foreground mb-1 block">{t('progress.material.list.filters.readinessStatus')}</label>
              <Select value={readinessStatus} onValueChange={setReadinessStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getReadinessStatusOptions().map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* 是否有缺口 */}
            <div className="w-[120px]">
              <label className="text-xs text-muted-foreground mb-1 block">{t('progress.material.list.filters.hasShortage')}</label>
              <Select value={hasShortage} onValueChange={setHasShortage}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getHasShortageOptions().map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* 交付期从 */}
            <div className="w-[140px]">
              <label className="text-xs text-muted-foreground mb-1 block">{t('progress.material.list.filters.deliveryDateFrom')}</label>
              <Input
                type="date"
                value={deliveryDateFrom}
                onChange={e => setDeliveryDateFrom(e.target.value)}
                className="h-9"
              />
            </div>
            
            {/* 交付期至 */}
            <div className="w-[140px]">
              <label className="text-xs text-muted-foreground mb-1 block">{t('progress.material.list.filters.deliveryDateTo')}</label>
              <Input
                type="date"
                value={deliveryDateTo}
                onChange={e => setDeliveryDateTo(e.target.value)}
                className="h-9"
              />
            </div>
            
            {/* 重置按钮 */}
            <Button variant="outline" size="sm" onClick={handleReset} className="h-9">
              <RotateCcw className="mr-1.5 h-4 w-4" />
              {t('progress.material.list.filters.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* 列表表格 */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('progress.material.list.columns.poId')}</TableHead>
                <TableHead>{t('progress.material.list.columns.legacyOrderNo')}</TableHead>
                <TableHead>{t('progress.material.list.columns.spu')}</TableHead>
                <TableHead>{t('progress.material.list.columns.mainFactory')}</TableHead>
                <TableHead>{t('progress.material.list.columns.deliveryDate')}</TableHead>
                <TableHead>{t('progress.material.list.columns.readinessStatus')}</TableHead>
                <TableHead>{t('progress.material.list.columns.fulfillmentRate')}</TableHead>
                <TableHead>{t('progress.material.list.columns.shortLineCount')}</TableHead>
                <TableHead>{t('progress.material.list.columns.latestPickStatus')}</TableHead>
                <TableHead>{t('progress.material.list.columns.latestUpdatedAt')}</TableHead>
                <TableHead className="text-right">{t('progress.material.list.columns.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    {t('progress.material.list.noData')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredList.map(row => (
                  <TableRow 
                    key={row.poId} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onSelectPo(row.poId)}
                  >
                    <TableCell className="font-medium text-primary">{row.poId}</TableCell>
                    <TableCell className="text-muted-foreground">{row.legacyOrderNo}</TableCell>
                    <TableCell>
                      <div className="text-sm">{row.spuCode}</div>
                      <div className="text-xs text-muted-foreground">{row.spuName}</div>
                    </TableCell>
                    <TableCell>{row.mainFactoryName}</TableCell>
                    <TableCell>{row.requiredDeliveryDate}</TableCell>
                    <TableCell>
                      <Badge variant={materialStatusVariantMap[row.progress.readinessStatus] || 'secondary'}>
                        {t(`materialReadyStatus.${row.progress.readinessStatus}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={row.progress.fulfillmentRate} className="w-12 h-2" />
                        <span className="text-sm">{row.progress.fulfillmentRate}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.progress.shortLineCount > 0 ? (
                        <Badge variant="destructive">{row.progress.shortLineCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.progress.latestPickStatus ? (
                        <Badge variant={statusVariantMap[row.progress.latestPickStatus] || 'secondary'}>
                          {t(`pickingStatus.${row.progress.latestPickStatus}`)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.progress.latestUpdatedAt || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={e => {
                          e.stopPropagation()
                          onSelectPo(row.poId)
                        }}
                      >
                        {t('progress.material.action.viewDetail')}
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================
// 详情视图组件
// =============================================
function MaterialDetailView({ 
  poId, 
  pickIdFromQuery,
  onBackToList 
}: { 
  poId: string
  pickIdFromQuery?: string
  onBackToList: () => void
}) {
  // 状态
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedPickId, setSelectedPickId] = useState<string | null>(null)
  const [shortageReasonFilter, setShortageReasonFilter] = useState<string>('all')
  const [notFoundPickId, setNotFoundPickId] = useState<string | null>(null)
  
  // 数据
  const poSummary: PoSummary | null = useMemo(() => getPoSummaryById(poId), [poId])
  const pickingOrders: PickingOrder[] = useMemo(() => getPickingOrdersByPo(poId), [poId])
  const shortageLines: PickingLine[] = useMemo(() => getShortageSummaryByPo(poId), [poId])
  
  // 筛选后的缺口行
  const filteredShortageLines = useMemo(() => {
    if (shortageReasonFilter === 'all') return shortageLines
    return shortageLines.filter(l => l.reasonCode === shortageReasonFilter)
  }, [shortageLines, shortageReasonFilter])
  
  // 获取选中配料单的明细
  const selectedPickingLines: PickingLine[] = useMemo(() => {
    if (!selectedPickId) return []
    return getPickingLinesByPickId(selectedPickId)
  }, [selectedPickId])
  
  // 获取选中配料单信息
  const selectedPickingOrder: PickingOrder | undefined = useMemo(() => {
    if (!selectedPickId) return undefined
    return getPickingOrderById(selectedPickId, poId)
  }, [selectedPickId, poId])
  
  // 自动打开 pickId 对应的抽屉
  useEffect(() => {
    if (pickIdFromQuery) {
      const order = getPickingOrderById(pickIdFromQuery, poId)
      if (order) {
        setSelectedPickId(pickIdFromQuery)
        setDrawerOpen(true)
        setNotFoundPickId(null)
      } else {
        setNotFoundPickId(pickIdFromQuery)
      }
    }
  }, [pickIdFromQuery, poId])
  
  // 打开配料单详情
  const handleViewDetail = (pickId: string) => {
    setSelectedPickId(pickId)
    setDrawerOpen(true)
  }
  
  // 缺口原因选项
  const reasonOptions: { value: string; label: string }[] = [
    { value: 'all', label: t('common.all') },
    { value: 'INSUFFICIENT_STOCK', label: t('shortageReason.INSUFFICIENT_STOCK') },
    { value: 'NOT_RECEIVED', label: t('shortageReason.NOT_RECEIVED') },
    { value: 'QC_FAILED', label: t('shortageReason.QC_FAILED') },
    { value: 'FROZEN', label: t('shortageReason.FROZEN') },
    { value: 'UNKNOWN', label: t('shortageReason.UNKNOWN') },
  ]
  
  if (!poSummary) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <AlertTriangle className="mr-2 h-4 w-4" />
        {t('progress.material.drawer.notFound')}
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBackToList}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t('progress.material.action.backToList')}
          </Button>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <PackageSearch className="h-5 w-5" />
            {t('progress.material.title')}
          </h1>
        </div>
      </div>
      
      {/* 当前筛选条 */}
      <div className="flex items-center justify-between bg-muted/50 border rounded-lg px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('progress.material.currentFilter')}:</span>
          <Badge variant="secondary">{t('progress.material.summary.poId')}: {poId}</Badge>
          {pickIdFromQuery && (
            <Badge variant="outline">{t('progress.material.pickingOrders.pickId')}: {pickIdFromQuery}</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onBackToList}>
          <X className="mr-1.5 h-4 w-4" />
          {t('progress.material.clearFilter')}
        </Button>
      </div>
      
      {/* 配料单不存在提示 */}
      {notFoundPickId && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>{t('progress.material.drawer.notFound')}: {notFoundPickId}</span>
        </div>
      )}
      
      {/* 主内容区域 */}
      <div className="grid gap-4">
        {/* 1. 生产单摘要卡片 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t('progress.material.summary.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">{t('progress.material.summary.poId')}</div>
                <div className="font-medium">{poSummary.poId}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t('progress.material.summary.legacyOrderNo')}</div>
                <div className="font-medium">{poSummary.legacyOrderNo}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t('progress.material.summary.spu')}</div>
                <div className="font-medium">{poSummary.spuCode}</div>
                <div className="text-xs text-muted-foreground">{poSummary.spuName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t('progress.material.summary.mainFactory')}</div>
                <div className="font-medium">{poSummary.mainFactoryName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t('progress.material.summary.deliveryDate')}</div>
                <div className="font-medium">{poSummary.requiredDeliveryDate}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t('progress.material.summary.materialStatus')}</div>
                <Badge variant={materialStatusVariantMap[poSummary.materialReadyStatus] || 'secondary'}>
                  {t(`materialReadyStatus.${poSummary.materialReadyStatus}`)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* 2. 配料单列表 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('progress.material.pickingOrders.title')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('progress.material.pickingOrders.pickId')}</TableHead>
                  <TableHead>{t('progress.material.pickingOrders.warehouse')}</TableHead>
                  <TableHead>{t('progress.material.pickingOrders.status')}</TableHead>
                  <TableHead>{t('progress.material.pickingOrders.fulfillmentRate')}</TableHead>
                  <TableHead>{t('progress.material.pickingOrders.shortLineCount')}</TableHead>
                  <TableHead>{t('progress.material.pickingOrders.updatedAt')}</TableHead>
                  <TableHead className="text-right">{t('common.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pickingOrders.map(order => (
                  <TableRow key={order.pickId}>
                    <TableCell className="font-medium">{order.pickId}</TableCell>
                    <TableCell>{order.warehouseName}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariantMap[order.status] || 'secondary'}>
                        {t(`pickingStatus.${order.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={order.fulfillmentRate} className="w-16 h-2" />
                        <span className="text-sm">{order.fulfillmentRate}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.shortLineCount > 0 ? (
                        <Badge variant="destructive">{order.shortLineCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{order.updatedAt}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetail(order.pickId)}>
                        {t('progress.material.pickingOrders.viewDetail')}
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* 3. 缺口汇总 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                {t('progress.material.shortage.title')}
              </CardTitle>
              <Select value={shortageReasonFilter} onValueChange={setShortageReasonFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('progress.material.shortage.filterByReason')} />
                </SelectTrigger>
                <SelectContent>
                  {reasonOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredShortageLines.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Check className="mr-2 h-4 w-4" />
                {t('progress.material.shortage.noShortage')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('progress.material.shortage.materialCode')}</TableHead>
                    <TableHead>{t('progress.material.shortage.materialName')}</TableHead>
                    <TableHead className="text-right">{t('progress.material.shortage.requiredQty')}</TableHead>
                    <TableHead className="text-right">{t('progress.material.shortage.pickedQty')}</TableHead>
                    <TableHead className="text-right">{t('progress.material.shortage.shortQty')}</TableHead>
                    <TableHead>{t('progress.material.shortage.reasonCode')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShortageLines.map((line, idx) => (
                    <TableRow key={`${line.lineId}-${idx}`}>
                      <TableCell className="font-mono text-sm">{line.materialCode}</TableCell>
                      <TableCell>{line.materialName}</TableCell>
                      <TableCell className="text-right">{line.requiredQty}</TableCell>
                      <TableCell className="text-right">{line.pickedQty}</TableCell>
                      <TableCell className="text-right">
                        <span className="text-destructive font-medium">{line.shortQty}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {line.reasonCode ? t(`shortageReason.${line.reasonCode}`) : '-'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* 配料单详情抽屉 */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('progress.material.drawer.title')}</SheetTitle>
          </SheetHeader>
          
          {selectedPickingOrder ? (
            <div className="mt-6 space-y-6">
              {/* 配料单头信息 */}
              <div>
                <h4 className="text-sm font-medium mb-3">{t('progress.material.drawer.header')}</h4>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <div className="text-xs text-muted-foreground">{t('progress.material.pickingOrders.pickId')}</div>
                    <div className="font-medium">{selectedPickingOrder.pickId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t('progress.material.summary.poId')}</div>
                    <div className="font-medium">{selectedPickingOrder.poId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t('progress.material.pickingOrders.warehouse')}</div>
                    <div className="font-medium">{selectedPickingOrder.warehouseName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t('progress.material.pickingOrders.status')}</div>
                    <Badge variant={statusVariantMap[selectedPickingOrder.status] || 'secondary'}>
                      {t(`pickingStatus.${selectedPickingOrder.status}`)}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t('progress.material.pickingOrders.fulfillmentRate')}</div>
                    <div className="flex items-center gap-2">
                      <Progress value={selectedPickingOrder.fulfillmentRate} className="w-16 h-2" />
                      <span className="font-medium">{selectedPickingOrder.fulfillmentRate}%</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t('progress.material.pickingOrders.shortLineCount')}</div>
                    <div className="font-medium">
                      {selectedPickingOrder.shortLineCount > 0 ? (
                        <Badge variant="destructive">{selectedPickingOrder.shortLineCount}</Badge>
                      ) : (
                        <span>0</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 明细行表格 */}
              <div>
                <h4 className="text-sm font-medium mb-3">{t('progress.material.drawer.lines')}</h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('progress.material.shortage.materialCode')}</TableHead>
                        <TableHead>{t('progress.material.shortage.materialName')}</TableHead>
                        <TableHead>{t('progress.material.drawer.uom')}</TableHead>
                        <TableHead className="text-right">{t('progress.material.shortage.requiredQty')}</TableHead>
                        <TableHead className="text-right">{t('progress.material.shortage.pickedQty')}</TableHead>
                        <TableHead className="text-right">{t('progress.material.shortage.shortQty')}</TableHead>
                        <TableHead>{t('progress.material.shortage.reasonCode')}</TableHead>
                        <TableHead>{t('progress.material.drawer.location')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPickingLines.map(line => (
                        <TableRow key={line.lineId}>
                          <TableCell className="font-mono text-xs">{line.materialCode}</TableCell>
                          <TableCell>
                            <div>{line.materialName}</div>
                            <div className="text-xs text-muted-foreground">{line.specification}</div>
                          </TableCell>
                          <TableCell>{line.uom}</TableCell>
                          <TableCell className="text-right">{line.requiredQty}</TableCell>
                          <TableCell className="text-right">{line.pickedQty}</TableCell>
                          <TableCell className="text-right">
                            {line.shortQty > 0 ? (
                              <span className="text-destructive font-medium">{line.shortQty}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {line.reasonCode ? (
                              <Badge variant="outline" className="text-xs">
                                {t(`shortageReason.${line.reasonCode}`)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{line.location || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// =============================================
// 主组件：根据 URL 参数切换列表/详情视图
// =============================================
function MaterialContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const query = parseQuery(searchParams)
  const poId = query.po
  const pickIdFromQuery = query.pickId
  
  // 选择生产单（进入详情视图）
  const handleSelectPo = (newPoId: string) => {
    router.push(`/fcs/progress/material${buildQuery({ po: newPoId })}`)
  }
  
  // 返回列表
  const handleBackToList = () => {
    router.push('/fcs/progress/material')
  }
  
  // 根据 URL 参数决定显示列表还是详情
  if (poId) {
    return (
      <MaterialDetailView 
        poId={poId} 
        pickIdFromQuery={pickIdFromQuery}
        onBackToList={handleBackToList}
      />
    )
  }
  
  return <MaterialListView onSelectPo={handleSelectPo} />
}

export default function MaterialPage() {
  return (
    <Suspense fallback={<div className="p-4">{t('common.loading')}</div>}>
      <MaterialContent />
    </Suspense>
  )
}
