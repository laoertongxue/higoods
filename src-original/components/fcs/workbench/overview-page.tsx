'use client'

import { useMemo } from 'react'
import Link from '@/components/spa-link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useFcs } from '@/lib/fcs/fcs-store'

const QC_STATUS_ZH: Record<string, string> = {
  DRAFT: '草稿',
  SUBMITTED: '待处理',
  CLOSED: '已结案',
}

const LIABILITY_STATUS_ZH: Record<string, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  DISPUTED: '争议中',
  VOID: '已作废',
}

const STATEMENT_STATUS_ZH: Record<string, string> = {
  DRAFT: '草稿',
  CONFIRMED: '已确认',
  CLOSED: '已关闭',
}

const BATCH_STATUS_ZH: Record<string, string> = {
  PENDING: '待提交',
  PROCESSING: '处理中',
  COMPLETED: '已完成',
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-semibold tabular-nums ${color ?? 'text-foreground'}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

export function OverviewPage() {
  const {
    state: {
      processTasks,
      qcRecords,
      deductionBasisItems,
      dyePrintOrders,
      statementDrafts,
      settlementBatches,
    },
  } = useFcs()

  const stats = useMemo(() => {
    const blockedTasks = processTasks.filter(t => t.status === 'BLOCKED' && t.blockReason === 'ALLOCATION_GATE')
    const openQc = qcRecords.filter(q => q.status !== 'CLOSED')
    const disputedQc = qcRecords.filter(q => q.liabilityStatus === 'DISPUTED')
    const disputedBasis = deductionBasisItems.filter(b => b.status === 'DISPUTED')
    const readyBasis = deductionBasisItems.filter(b => b.settlementReady === true)
    const frozenBasis = deductionBasisItems.filter(b => !b.settlementReady && b.status !== 'VOID')
    const draftStatements = statementDrafts.filter(s => s.status === 'DRAFT')
    const processingBatches = settlementBatches.filter(b => b.status === 'PROCESSING')
    const dpTotal = dyePrintOrders.length
    const dpAvailable = dyePrintOrders.filter(d => d.availableQty > 0).length
    const dpFail = dyePrintOrders.filter(d => d.returnedFailQty > 0).length
    const disputedCount = new Set([...disputedQc.map(q => q.qcId), ...disputedBasis.map(b => b.basisId)]).size

    return {
      taskTotal: processTasks.length,
      blockedCount: blockedTasks.length,
      openQcCount: openQc.length,
      disputedCount,
      readyBasisCount: readyBasis.length,
      frozenBasisCount: frozenBasis.length,
      draftStatementCount: draftStatements.length,
      processingBatchCount: processingBatches.length,
      dpTotal,
      dpAvailable,
      dpFail,
      returnBatchCount: dyePrintOrders.reduce((s, d) => s + d.returnBatches.length, 0),
    }
  }, [processTasks, qcRecords, deductionBasisItems, dyePrintOrders, statementDrafts, settlementBatches])

  const recentQc = useMemo(() =>
    [...qcRecords]
      .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
      .slice(0, 5),
    [qcRecords])

  const recentSettlement = useMemo(() => {
    const stmts = [...statementDrafts]
      .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
      .slice(0, 3)
      .map(s => ({ id: s.statementId, amount: s.totalAmount, statusZh: STATEMENT_STATUS_ZH[s.status] ?? s.status, kind: 'statement' as const }))
    const batches = [...settlementBatches]
      .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
      .slice(0, 2)
      .map(b => ({ id: b.batchId, amount: b.totalAmount, statusZh: BATCH_STATUS_ZH[b.status] ?? b.status, kind: 'batch' as const }))
    return [...stmts, ...batches].slice(0, 5)
  }, [statementDrafts, settlementBatches])

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-xl font-semibold">概览看板</h1>

      {/* 区块 1：核心概览卡片 */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">核心运营</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="生产任务总数" value={stats.taskTotal} />
          <StatCard label="开始条件暂不能继续任务数" value={stats.blockedCount} color={stats.blockedCount > 0 ? 'text-red-600' : undefined} />
          <StatCard label="质检未结案数" value={stats.openQcCount} color={stats.openQcCount > 0 ? 'text-amber-600' : undefined} />
          <StatCard label="争议中数" value={stats.disputedCount} color={stats.disputedCount > 0 ? 'text-orange-600' : undefined} />
          <StatCard label="可进入结算依据数" value={stats.readyBasisCount} color="text-green-600" />
          <StatCard label="冻结中依据数" value={stats.frozenBasisCount} color={stats.frozenBasisCount > 0 ? 'text-amber-600' : undefined} />
          <StatCard label="对账单草稿数" value={stats.draftStatementCount} color={stats.draftStatementCount > 0 ? 'text-blue-600' : undefined} />
          <StatCard label="处理中结算批次数" value={stats.processingBatchCount} color={stats.processingBatchCount > 0 ? 'text-blue-600' : undefined} />
        </div>
      </section>

      {/* 区块 2：相关流程进度卡片 */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">染印加工</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="染印加工单总数" value={stats.dpTotal} />
          <StatCard label="染印可可继续工单数" value={stats.dpAvailable} color="text-green-600" />
          <StatCard label="染印不合格处理中数" value={stats.dpFail} color={stats.dpFail > 0 ? 'text-red-600' : undefined} />
          <StatCard label="回货批次数" value={stats.returnBatchCount} />
        </div>
      </section>

      {/* 区块 3：轻量明细表 */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">最近质检事项</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>QC单号</TableHead>
                  <TableHead>生产单</TableHead>
                  <TableHead>QC结果</TableHead>
                  <TableHead>判责状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentQc.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">暂无质检记录</TableCell></TableRow>
                ) : recentQc.map(qc => (
                  <TableRow key={qc.qcId}>
                    <TableCell className="font-mono text-xs">{qc.qcId}</TableCell>
                    <TableCell className="text-xs">{qc.productionOrderId ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={qc.result === 'PASS' ? 'bg-green-50 text-green-700 border-green-200' : qc.result === 'FAIL' ? 'bg-red-50 text-red-700 border-red-200' : ''}>
                        {qc.result === 'PASS' ? '合格' : qc.result === 'FAIL' ? '不合格' : (QC_STATUS_ZH[qc.status] ?? qc.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={qc.liabilityStatus === 'DISPUTED' ? 'bg-orange-50 text-orange-700 border-orange-200' : qc.liabilityStatus === 'CONFIRMED' ? 'bg-green-50 text-green-700' : ''}>
                        {LIABILITY_STATUS_ZH[qc.liabilityStatus ?? 'DRAFT'] ?? qc.liabilityStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/fcs/quality/qc-records/${qc.qcId}`}>查看质检</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">最近结算事项</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>单号</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSettlement.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">暂无结算记录</TableCell></TableRow>
                ) : recentSettlement.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.id}</TableCell>
                    <TableCell className="text-xs">{item.kind === 'statement' ? '对账单' : '结算批次'}</TableCell>
                    <TableCell className="tabular-nums">¥{item.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.statusZh}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={item.kind === 'statement' ? '/fcs/settlement/statements' : '/fcs/settlement/batches'}>
                          {item.kind === 'statement' ? '查看对账单' : '查看批次'}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
