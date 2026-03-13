'use client'

import { useState, useMemo } from 'react'
import Link from '@/components/spa-link'
import { Search, RotateCcw, Eye, Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useFcs } from '@/lib/fcs/fcs-store'
import type { DeductionBasisSourceType, DeductionBasisStatus } from '@/lib/fcs/fcs-store'
import { t } from '@/lib/i18n'

// ── badge helpers ──────────────────────────────────────────────────────────
const SOURCE_TYPE_LABEL: Record<string, string> = {
  QC_FAIL: '质检不合格',
  QC_DEFECT_ACCEPT: '瑕疵接受',
  HANDOVER_DIFF: '交接差异',
}
const sourceTypeBadgeClass: Partial<Record<DeductionBasisSourceType, string>> = {
  QC_FAIL: 'bg-red-100 text-red-700 border-red-200',
  HANDOVER_DIFF: 'bg-orange-100 text-orange-700 border-orange-200',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿', CONFIRMED: '已确认', DISPUTED: '争议中', VOID: '已作废',
}
const statusBadgeClass: Record<DeductionBasisStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  CONFIRMED: 'bg-green-100 text-green-700 border-green-200',
  DISPUTED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  VOID: 'bg-slate-100 text-slate-500 border-slate-200',
}

export default function DeductionCalcPage() {
  const { state } = useFcs()
  const items = state.deductionBasisItems

  const [keyword, setKeyword] = useState('')
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [factoryFilter, setFactoryFilter] = useState<string>('ALL')
  const [sourceProcessFilter, setSourceProcessFilter] = useState<string>('ALL')
  const [settlementFilter, setSettlementFilter] = useState<string>('ALL')

  // unique factory options from items
  const factoryOptions = useMemo(() => {
    const ids = Array.from(new Set(items.map(i => i.factoryId)))
    return ids.map(id => {
      const f = state.factories.find(f => f.id === id)
      return { id, label: f ? f.name : id }
    })
  }, [items, state.factories])

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (sourceTypeFilter !== 'ALL' && item.sourceType !== sourceTypeFilter) return false
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false
      if (factoryFilter !== 'ALL' && item.factoryId !== factoryFilter) return false
      if (sourceProcessFilter === 'DYE_PRINT' && item.sourceProcessType !== 'DYE_PRINT') return false
      if (settlementFilter === 'READY' && item.settlementReady !== true) return false
      if (settlementFilter === 'FROZEN' && item.settlementReady === true) return false
      if (keyword.trim()) {
        const kw = keyword.toLowerCase()
        if (
          !item.basisId.toLowerCase().includes(kw) &&
          !item.productionOrderId.toLowerCase().includes(kw) &&
          !(item.taskId ?? '').toLowerCase().includes(kw) &&
          !item.sourceRefId.toLowerCase().includes(kw)
        ) return false
      }
      return true
    })
  }, [items, sourceTypeFilter, statusFilter, factoryFilter, sourceProcessFilter, settlementFilter, keyword])

  const handleReset = () => {
    setKeyword('')
    setSourceTypeFilter('ALL')
    setStatusFilter('ALL')
    setFactoryFilter('ALL')
    setSourceProcessFilter('ALL')
    setSettlementFilter('ALL')
  }

  const resolveFactory = (factoryId: string) => {
    const f = state.factories.find(f => f.id === factoryId)
    return f ? f.name : factoryId
  }

  const resolveReasonCode = (code: string) => {
    const map: Record<string, string> = {
      QUALITY_FAIL: '质量不合格',
      QC_FAIL_DEDUCTION: '质检扣款',
      HANDOVER_SHORTAGE: '交接短缺',
      HANDOVER_OVERAGE: '交接溢出',
      HANDOVER_DAMAGE: '交接破损',
      HANDOVER_MIXED_BATCH: '交接混批',
      HANDOVER_DIFF: '交接差异',
    }
    return map[code] ?? code
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('quality.deductionCalc.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('quality.deductionCalc.subtitle')}</p>
      </div>

      <Tabs defaultValue="basis">
        <TabsList>
          <TabsTrigger value="basis">{t('quality.deductionCalc.tabs.basis')}</TabsTrigger>
          <TabsTrigger value="trial">{t('quality.deductionCalc.tabs.trial')}</TabsTrigger>
          <TabsTrigger value="output">{t('quality.deductionCalc.tabs.output')}</TabsTrigger>
        </TabsList>

        {/* Tab1: 扣款依据 */}
        <TabsContent value="basis" className="space-y-4 mt-4">
          {/* Read-only notice */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm text-muted-foreground">
              {t('quality.deductionCalc.readonly')}
            </AlertDescription>
          </Alert>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('quality.deductionCalc.filters.keyword')}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={sourceProcessFilter} onValueChange={setSourceProcessFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="来源流程" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部来源</SelectItem>
                <SelectItem value="DYE_PRINT">染印加工单</SelectItem>
              </SelectContent>
            </Select>

            <Select value={settlementFilter} onValueChange={setSettlementFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="结算状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部结算状态</SelectItem>
                <SelectItem value="READY">可进入结算</SelectItem>
                <SelectItem value="FROZEN">冻结中</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder={t('quality.deductionCalc.filters.sourceType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('quality.deductionCalc.filters.allSourceType')}</SelectItem>
                <SelectItem value="QC_FAIL">质检不合格</SelectItem>
                <SelectItem value="HANDOVER_DIFF">交接差异</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder={t('quality.deductionCalc.filters.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('quality.deductionCalc.filters.allStatus')}</SelectItem>
                {(['DRAFT', 'CONFIRMED', 'DISPUTED', 'VOID'] as DeductionBasisStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={factoryFilter} onValueChange={setFactoryFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('quality.deductionCalc.filters.factory')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('quality.deductionCalc.filters.allFactory')}</SelectItem>
                {factoryOptions.map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>

            <span className="ml-auto text-sm text-muted-foreground">
              共 {filtered.length} 条
            </span>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed py-16 text-center">
              <p className="text-sm font-medium text-muted-foreground">{t('quality.deductionCalc.noData')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('quality.deductionCalc.noDataHint')}</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('quality.deductionCalc.columns.basisId')}</TableHead>
                    <TableHead>来源类型</TableHead>
                    <TableHead>来源流程</TableHead>
                    <TableHead>{t('quality.deductionCalc.columns.productionOrderId')}</TableHead>
                    <TableHead>{t('quality.deductionCalc.columns.taskId')}</TableHead>
                    <TableHead>{t('quality.deductionCalc.columns.factory')}</TableHead>
                    <TableHead>原因</TableHead>
                    <TableHead>{t('quality.deductionCalc.columns.qty')}</TableHead>
                    <TableHead>依据状态</TableHead>
                    <TableHead>结算状态</TableHead>
                    <TableHead>冻结原因</TableHead>
                    <TableHead className="text-center">证据</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(item => (
                    <TableRow key={item.basisId}>
                      <TableCell className="font-mono text-xs">
                        <Link
                          href={`/fcs/quality/deduction-calc/${item.basisId}`}
                          className="text-primary hover:underline"
                        >
                          {item.basisId}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={sourceTypeBadgeClass[item.sourceType] ?? 'bg-gray-100 text-gray-700 border-gray-200'}>
                          {SOURCE_TYPE_LABEL[item.sourceType] ?? item.sourceType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.sourceProcessType === 'DYE_PRINT'
                          ? <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">染印加工单</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>
                        }
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.productionOrderId}</TableCell>
                      <TableCell className="font-mono text-xs">{item.taskId ?? '—'}</TableCell>
                      <TableCell className="text-sm">{resolveFactory(item.factoryId)}</TableCell>
                      <TableCell className="text-sm">{resolveReasonCode(item.reasonCode)}</TableCell>
                      <TableCell className="text-sm">
                        {item.qty} {item.uom}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadgeClass[item.status]}>
                          {STATUS_LABEL[item.status] ?? item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.settlementReady !== undefined
                          ? (
                            <Badge variant="outline" className={item.settlementReady
                              ? 'bg-green-50 text-green-700 border-green-200 text-xs'
                              : 'bg-orange-50 text-orange-700 border-orange-200 text-xs'
                            }>
                              {item.settlementReady ? '可进入结算' : '冻结中'}
                            </Badge>
                          )
                          : <span className="text-xs text-muted-foreground">—</span>
                        }
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                        {item.settlementFreezeReason || '—'}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {item.evidenceRefs.length}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {item.updatedAt ?? item.createdAt}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/fcs/quality/deduction-calc/${item.basisId}`}>
                              <Eye className="mr-1 h-4 w-4" />
                              详情
                            </Link>
                          </Button>
                          {item.sourceProcessType === 'DYE_PRINT' && (
                            <Button variant="ghost" size="sm" asChild className="text-indigo-600 hover:text-indigo-700">
                              <Link href="/fcs/process/dye-print-orders">
                                查看加工单
                              </Link>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Tab2: 规则试算 placeholder */}
        <TabsContent value="trial" className="mt-4">
          <div className="rounded-lg border border-dashed py-24 text-center">
            <p className="text-sm text-muted-foreground">{t('quality.deductionCalc.placeholder.trial')}</p>
          </div>
        </TabsContent>

        {/* Tab3: 生成扣款结果 placeholder */}
        <TabsContent value="output" className="mt-4">
          <div className="rounded-lg border border-dashed py-24 text-center">
            <p className="text-sm text-muted-foreground">{t('quality.deductionCalc.placeholder.output')}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
