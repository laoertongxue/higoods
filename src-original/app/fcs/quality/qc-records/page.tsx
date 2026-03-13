'use client'

import { useMemo, useState } from 'react'
import { useRouter } from '@/lib/navigation'
import { useFcs, type QualityInspection, type QcResult, type QcStatus, type QcDisposition } from '@/lib/fcs/fcs-store'
import { t } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, RotateCcw } from 'lucide-react'

type ResultFilter = 'ALL' | QcResult
type StatusFilter = 'ALL' | QcStatus
type DispositionFilter = 'ALL' | QcDisposition

export default function QcRecordsPage() {
  const router = useRouter()
  const { state } = useFcs()

  const [filterResult, setFilterResult] = useState<ResultFilter>('ALL')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('ALL')
  const [filterDisposition, setFilterDisposition] = useState<DispositionFilter>('ALL')
  const [filterFactory, setFilterFactory] = useState<string>('ALL')
  const [keyword, setKeyword] = useState('')

  // 聚合工厂列表（从 processTasks 的 assignedFactoryId）
  const factoryOptions = useMemo(() => {
    const ids = new Set<string>()
    state.processTasks.forEach(t => { if (t.assignedFactoryId) ids.add(t.assignedFactoryId) })
    return Array.from(ids)
  }, [state.processTasks])

  // 筛选后的质检记录
  const filtered = useMemo(() => {
    return state.qualityInspections.filter(qc => {
      if (filterResult !== 'ALL' && qc.result !== filterResult) return false
      if (filterStatus !== 'ALL' && qc.status !== filterStatus) return false
      if (filterDisposition !== 'ALL' && qc.disposition !== filterDisposition) return false
      if (filterFactory !== 'ALL') {
        const task = state.processTasks.find(t => t.taskId === qc.refId)
        if (!task || task.assignedFactoryId !== filterFactory) return false
      }
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase()
        if (
          !qc.qcId.toLowerCase().includes(kw) &&
          !qc.refId.toLowerCase().includes(kw) &&
          !qc.productionOrderId.toLowerCase().includes(kw)
        ) return false
      }
      return true
    }).sort((a, b) => new Date(b.inspectedAt).getTime() - new Date(a.inspectedAt).getTime())
  }, [state.qualityInspections, state.processTasks, filterResult, filterStatus, filterDisposition, filterFactory, keyword])

  const handleReset = () => {
    setFilterResult('ALL')
    setFilterStatus('ALL')
    setFilterDisposition('ALL')
    setFilterFactory('ALL')
    setKeyword('')
  }

  const getResultBadge = (result: QcResult) => {
    return result === 'PASS'
      ? <Badge className="bg-green-100 text-green-700 border-green-300">合格</Badge>
      : <Badge className="bg-red-100 text-red-700 border-red-300">不合格</Badge>
  }

  const getDispositionBadge = (disposition?: QcDisposition) => {
    if (!disposition) return <span className="text-muted-foreground">-</span>
    const map: Record<QcDisposition, string> = {
      ACCEPT: 'bg-green-50 text-green-700 border-green-200',
      REWORK: 'bg-amber-50 text-amber-700 border-amber-200',
      REMAKE: 'bg-orange-50 text-orange-700 border-orange-200',
      SCRAP: 'bg-red-50 text-red-700 border-red-200',
    }
    const labelMap: Record<QcDisposition, string> = {
      ACCEPT: t('pda.quality.disposition.accept'),
      REWORK: t('pda.quality.disposition.rework'),
      REMAKE: t('pda.quality.disposition.remake'),
      SCRAP: t('pda.quality.disposition.scrap'),
    }
    return <Badge className={map[disposition]}>{labelMap[disposition]}</Badge>
  }

  const getBlockStatusBadge = (qc: QualityInspection) => {
    const task = state.processTasks.find(t => t.taskId === qc.refId)
    if (!task) return <Badge variant="outline" className="text-muted-foreground">{t('quality.qcRecords.blockStatus.unknown')}</Badge>
    if (task.status === 'BLOCKED' && task.blockReason === 'QUALITY') {
      return <Badge className="bg-red-100 text-red-700 border-red-300">{t('quality.qcRecords.blockStatus.blocked')}</Badge>
    }
    return <Badge className="bg-green-50 text-green-700 border-green-200">{t('quality.qcRecords.blockStatus.normal')}</Badge>
  }

  return (
    <div>
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t('quality.qcRecords.title')}</h1>
        <span className="text-sm text-muted-foreground">
          {t('quality.qcRecords.count', { count: filtered.length })}
        </span>
      </div>

      {/* 筛选栏 */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* 关键词 */}
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t('quality.qcRecords.filters.keyword')}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
            </div>

            {/* 结果 */}
            <div className="w-32">
              <Select value={filterResult} onValueChange={v => setFilterResult(v as ResultFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('quality.qcRecords.filters.result')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('common.all')}</SelectItem>
                  <SelectItem value="PASS">合格</SelectItem>
                  <SelectItem value="FAIL">不合格</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 状态 */}
            <div className="w-36">
              <Select value={filterStatus} onValueChange={v => setFilterStatus(v as StatusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('quality.qcRecords.filters.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('common.all')}</SelectItem>
                  <SelectItem value="DRAFT">{t('pda.quality.status.DRAFT')}</SelectItem>
                  <SelectItem value="SUBMITTED">{t('pda.quality.status.SUBMITTED')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 处置 */}
            <div className="w-36">
              <Select value={filterDisposition} onValueChange={v => setFilterDisposition(v as DispositionFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('quality.qcRecords.filters.disposition')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('common.all')}</SelectItem>
                  <SelectItem value="ACCEPT">{t('pda.quality.disposition.accept')}</SelectItem>
                  <SelectItem value="REWORK">{t('pda.quality.disposition.rework')}</SelectItem>
                  <SelectItem value="REMAKE">{t('pda.quality.disposition.remake')}</SelectItem>
                  <SelectItem value="SCRAP">{t('pda.quality.disposition.scrap')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 工厂 */}
            {factoryOptions.length > 0 && (
              <div className="w-40">
                <Select value={filterFactory} onValueChange={setFilterFactory}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('quality.qcRecords.filters.factory')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{t('common.all')}</SelectItem>
                    {factoryOptions.map(id => (
                      <SelectItem key={id} value={id}>{id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 重置 */}
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              {t('common.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {t('quality.qcRecords.empty')}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('quality.qcRecords.columns.qcId')}</TableHead>
                  <TableHead>{t('quality.qcRecords.columns.taskId')}</TableHead>
                  <TableHead>{t('quality.qcRecords.columns.poId')}</TableHead>
                  <TableHead>{t('quality.qcRecords.columns.processName')}</TableHead>
                  <TableHead>{t('quality.qcRecords.columns.result')}</TableHead>
                  <TableHead>{t('quality.qcRecords.columns.disposition')}</TableHead>
                  <TableHead className="text-right">{t('quality.qcRecords.columns.affectedQty')}</TableHead>
                  <TableHead className="text-right">{t('quality.qcRecords.columns.reworkCount')}</TableHead>
                  <TableHead>{t('quality.qcRecords.columns.blockStatus')}</TableHead>
                  <TableHead>{t('quality.qcRecords.columns.inspectedAt')}</TableHead>
                  <TableHead>{t('quality.qcRecords.columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(qc => {
                  const task = state.processTasks.find(t => t.taskId === qc.refId)
                  return (
                    <TableRow
                      key={qc.qcId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/fcs/quality/qc-records/${qc.qcId}`)}
                    >
                      <TableCell className="font-mono text-sm text-primary font-medium">
                        {qc.qcId}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {qc.refId}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {qc.productionOrderId}
                      </TableCell>
                      <TableCell>
                        {task?.processNameZh ?? '-'}
                      </TableCell>
                      <TableCell>{getResultBadge(qc.result)}</TableCell>
                      <TableCell>{getDispositionBadge(qc.disposition)}</TableCell>
                      <TableCell className="text-right">
                        {qc.affectedQty != null ? qc.affectedQty : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {qc.generatedTaskIds?.length ?? 0}
                      </TableCell>
                      <TableCell>{getBlockStatusBadge(qc)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {qc.inspectedAt || qc.updatedAt}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation()
                            router.push(`/fcs/quality/qc-records/${qc.qcId}`)
                          }}
                        >
                          {t('common.view')}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
