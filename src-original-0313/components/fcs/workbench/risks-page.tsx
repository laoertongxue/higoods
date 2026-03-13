'use client'

import { useMemo } from 'react'
import Link from '@/components/spa-link'
import { Card, CardContent } from '@/components/ui/card'
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

type RiskKind =
  | 'GATE_BLOCKED'
  | 'DISPUTE_FROZEN'
  | 'QC_OVERDUE'
  | 'REWORK_PENDING'
  | 'STATEMENT_STALE'

interface RiskItem {
  id: string
  kind: RiskKind
  kindZh: string
  title: string
  relatedObj: string
  note: string
  updatedAt: string
  href: string
  actionLabel: string
}

const KIND_BADGE: Record<RiskKind, string> = {
  GATE_BLOCKED:    'bg-red-50 text-red-700 border-red-200',
  DISPUTE_FROZEN:  'bg-orange-50 text-orange-700 border-orange-200',
  QC_OVERDUE:      'bg-amber-50 text-amber-700 border-amber-200',
  REWORK_PENDING:  'bg-blue-50 text-blue-700 border-blue-200',
  STATEMENT_STALE: 'bg-slate-100 text-slate-700 border-slate-200',
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

function isOlderThan3Days(dateStr: string) {
  if (!dateStr) return false
  try {
    return Date.now() - new Date(dateStr).getTime() > THREE_DAYS_MS
  } catch {
    return false
  }
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

export function RisksPage() {
  const {
    state: { processTasks, qcRecords, deductionBasisItems, statementDrafts },
  } = useFcs()

  const risks = useMemo<RiskItem[]>(() => {
    const items: RiskItem[] = []

    // 门禁阻塞风险
    processTasks
      .filter(t => t.status === 'BLOCKED' && t.blockReason === 'ALLOCATION_GATE')
      .forEach(t => items.push({
        id: `gate-${t.taskId}`,
        kind: 'GATE_BLOCKED',
        kindZh: '门禁阻塞',
        title: `任务 ${t.taskId} 门禁阻塞`,
        relatedObj: t.productionOrderId ?? t.taskId,
        note: (t as any).blockNoteZh ?? '配货门禁未放行，任务无法继续',
        updatedAt: t.updatedAt ?? t.createdAt ?? '',
        href: '/fcs/process/task-breakdown',
        actionLabel: '查看拆解任务',
      }))

    // 争议冻结结算风险
    deductionBasisItems
      .filter(b => b.status === 'DISPUTED' || (b.settlementFreezeReason && b.settlementFreezeReason.includes('争议')))
      .forEach(b => items.push({
        id: `dispute-${b.basisId}`,
        kind: 'DISPUTE_FROZEN',
        kindZh: '争议冻结',
        title: `扣款依据 ${b.basisId} 争议冻结`,
        relatedObj: b.basisId,
        note: b.settlementFreezeReason ?? '扣款依据存在争议，结算冻结',
        updatedAt: b.updatedAt ?? b.createdAt,
        href: '/fcs/quality/arbitration',
        actionLabel: '查看仲裁',
      }))

    // 质检超期未结案风险（SUBMITTED 且超过 3 天）
    qcRecords
      .filter(q => q.status === 'SUBMITTED' && isOlderThan3Days(q.createdAt))
      .forEach(q => items.push({
        id: `qc-overdue-${q.qcId}`,
        kind: 'QC_OVERDUE',
        kindZh: '质检超期未结案',
        title: `QC ${q.qcId} 超期未结案`,
        relatedObj: q.productionOrderId ?? q.qcId,
        note: `创建于 ${q.createdAt.slice(0, 10)}，已超过 3 天未处理`,
        updatedAt: q.updatedAt ?? q.createdAt,
        href: `/fcs/quality/qc-records/${q.qcId}`,
        actionLabel: '查看质检',
      }))

    // 返工/重做未完成风险
    processTasks
      .filter(t => (t.taskKind === 'REWORK' || t.taskKind === 'REMAKE') && t.status !== 'DONE')
      .forEach(t => items.push({
        id: `rework-${t.taskId}`,
        kind: 'REWORK_PENDING',
        kindZh: '返工未完成',
        title: `${t.taskKind === 'REWORK' ? '返工' : '重做'}任务 ${t.taskId} 未完成`,
        relatedObj: t.productionOrderId ?? t.taskId,
        note: `任务状态：${t.status === 'NOT_STARTED' ? '未开始' : t.status === 'IN_PROGRESS' ? '进行中' : t.status === 'BLOCKED' ? '阻塞' : t.status}`,
        updatedAt: t.updatedAt ?? t.createdAt ?? '',
        href: '/fcs/quality/rework',
        actionLabel: '查看返工任务',
      }))

    // 对账单长期未处理风险（DRAFT 且超过 3 天）
    statementDrafts
      .filter(s => s.status === 'DRAFT' && isOlderThan3Days(s.createdAt))
      .forEach(s => items.push({
        id: `stmt-stale-${s.statementId}`,
        kind: 'STATEMENT_STALE',
        kindZh: '对账单滞留',
        title: `对账单 ${s.statementId} 草稿滞留`,
        relatedObj: s.statementId,
        note: `创建于 ${s.createdAt.slice(0, 10)}，已超过 3 天未确认`,
        updatedAt: s.updatedAt ?? s.createdAt,
        href: '/fcs/settlement/statements',
        actionLabel: '查看对账单',
      }))

    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 20)
  }, [processTasks, qcRecords, deductionBasisItems, statementDrafts])

  const counts = useMemo(() => ({
    gate:      risks.filter(r => r.kind === 'GATE_BLOCKED').length,
    dispute:   risks.filter(r => r.kind === 'DISPUTE_FROZEN').length,
    qcOverdue: risks.filter(r => r.kind === 'QC_OVERDUE').length,
    rework:    risks.filter(r => r.kind === 'REWORK_PENDING').length,
    stale:     risks.filter(r => r.kind === 'STATEMENT_STALE').length,
  }), [risks])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">风险提醒</h1>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="门禁阻塞风险数" value={counts.gate} color={counts.gate > 0 ? 'text-red-600' : undefined} />
        <StatCard label="争议冻结风险数" value={counts.dispute} color={counts.dispute > 0 ? 'text-orange-600' : undefined} />
        <StatCard label="质检超期风险数" value={counts.qcOverdue} color={counts.qcOverdue > 0 ? 'text-amber-600' : undefined} />
        <StatCard label="返工未完成风险数" value={counts.rework} color={counts.rework > 0 ? 'text-blue-600' : undefined} />
        <StatCard label="对账单滞留风险数" value={counts.stale} color={counts.stale > 0 ? 'text-slate-600' : undefined} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>风险类型</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>关联对象</TableHead>
                <TableHead>风险说明</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {risks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    暂无风险提醒
                  </TableCell>
                </TableRow>
              ) : risks.map(item => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant="outline" className={KIND_BADGE[item.kind]}>
                      {item.kindZh}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{item.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{item.relatedObj}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{item.note}</TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">{item.updatedAt.slice(0, 16)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={item.href}>{item.actionLabel}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
