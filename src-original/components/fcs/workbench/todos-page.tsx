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

type TodoKind =
  | 'PENDING_LIABILITY'
  | 'PENDING_CLOSE'
  | 'PENDING_ARBITRATION'
  | 'PENDING_STATEMENT'
  | 'PENDING_GATE'

interface TodoItem {
  id: string
  kind: TodoKind
  kindZh: string
  title: string
  relatedObj: string
  note: string
  updatedAt: string
  href: string
  actionLabel: string
}

const KIND_BADGE: Record<TodoKind, string> = {
  PENDING_LIABILITY:  'bg-amber-50 text-amber-700 border-amber-200',
  PENDING_CLOSE:      'bg-blue-50 text-blue-700 border-blue-200',
  PENDING_ARBITRATION:'bg-orange-50 text-orange-700 border-orange-200',
  PENDING_STATEMENT:  'bg-green-50 text-green-700 border-green-200',
  PENDING_GATE:       'bg-red-50 text-red-700 border-red-200',
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

export function TodosPage() {
  const {
    state: { processTasks, qcRecords, deductionBasisItems, statementDrafts },
  } = useFcs()

  const todos = useMemo<TodoItem[]>(() => {
    const items: TodoItem[] = []

    // 待判责：SUBMITTED 且 liabilityStatus 为空或 DRAFT
    qcRecords
      .filter(q => q.status === 'SUBMITTED' && (!q.liabilityStatus || q.liabilityStatus === 'DRAFT'))
      .forEach(q => items.push({
        id: q.qcId,
        kind: 'PENDING_LIABILITY',
        kindZh: '待判责',
        title: `QC ${q.qcId} 待判责`,
        relatedObj: q.productionOrderId ?? q.qcId,
        note: `质检结果：${q.result === 'PASS' ? '合格' : q.result === 'FAIL' ? '不合格' : '-'}`,
        updatedAt: q.updatedAt ?? q.createdAt,
        href: `/fcs/quality/qc-records/${q.qcId}`,
        actionLabel: '查看质检',
      }))

    // 待结案：SUBMITTED 且 liabilityStatus === CONFIRMED
    qcRecords
      .filter(q => q.status === 'SUBMITTED' && q.liabilityStatus === 'CONFIRMED')
      .forEach(q => items.push({
        id: `close-${q.qcId}`,
        kind: 'PENDING_CLOSE',
        kindZh: '待结案',
        title: `QC ${q.qcId} 待结案`,
        relatedObj: q.productionOrderId ?? q.qcId,
        note: '责任已确认，可进行结案',
        updatedAt: q.updatedAt ?? q.createdAt,
        href: `/fcs/quality/qc-records/${q.qcId}`,
        actionLabel: '查看质检',
      }))

    // 待仲裁
    qcRecords
      .filter(q => q.liabilityStatus === 'DISPUTED')
      .forEach(q => items.push({
        id: `arb-${q.qcId}`,
        kind: 'PENDING_ARBITRATION',
        kindZh: '待仲裁',
        title: `QC ${q.qcId} 待仲裁`,
        relatedObj: q.productionOrderId ?? q.qcId,
        note: '质检结果存在争议，需仲裁处理',
        updatedAt: q.updatedAt ?? q.createdAt,
        href: '/fcs/quality/arbitration',
        actionLabel: '查看仲裁',
      }))

    // 待生成对账单：settlementReady 且未被未关闭 statement 占用
    const occupiedIds = new Set(
      statementDrafts
        .filter(s => s.status !== 'CLOSED')
        .flatMap(s => s.itemBasisIds),
    )
    deductionBasisItems
      .filter(b => b.settlementReady === true && !occupiedIds.has(b.basisId))
      .forEach(b => items.push({
        id: `stmt-${b.basisId}`,
        kind: 'PENDING_STATEMENT',
        kindZh: '待生成对账单',
        title: '扣款依据待生成对账单',
        relatedObj: b.basisId,
        note: `结算对象：${b.settlementPartyId ?? '-'}`,
        updatedAt: b.updatedAt ?? b.createdAt,
        href: '/fcs/settlement/statements',
        actionLabel: '查看对账单生成',
      }))

    // 待处理开始条件暂不能继续
    processTasks
      .filter(t => t.status === 'BLOCKED' && t.blockReason === 'ALLOCATION_GATE')
      .forEach(t => items.push({
        id: `gate-${t.taskId}`,
        kind: 'PENDING_GATE',
        kindZh: '待处理开始条件暂不能继续',
        title: `任务 ${t.taskId} 开始条件暂不能继续`,
        relatedObj: t.productionOrderId ?? t.taskId,
        note: (t as any).blockNoteZh ?? '配货开始条件未可继续，任务暂不能继续',
        updatedAt: t.updatedAt ?? t.createdAt ?? '',
        href: '/fcs/process/task-breakdown',
        actionLabel: '查看拆解任务',
      }))

    // 按更新时间倒序，最多 20 条
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 20)
  }, [qcRecords, deductionBasisItems, statementDrafts, processTasks])

  const counts = useMemo(() => ({
    liability:   todos.filter(t => t.kind === 'PENDING_LIABILITY').length,
    close:       todos.filter(t => t.kind === 'PENDING_CLOSE').length,
    arbitration: todos.filter(t => t.kind === 'PENDING_ARBITRATION').length,
    statement:   todos.filter(t => t.kind === 'PENDING_STATEMENT').length,
    gate:        todos.filter(t => t.kind === 'PENDING_GATE').length,
  }), [todos])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">我的待办</h1>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="待判责数" value={counts.liability} color={counts.liability > 0 ? 'text-amber-600' : undefined} />
        <StatCard label="待结案数" value={counts.close} color={counts.close > 0 ? 'text-blue-600' : undefined} />
        <StatCard label="待仲裁数" value={counts.arbitration} color={counts.arbitration > 0 ? 'text-orange-600' : undefined} />
        <StatCard label="待生成对账单数" value={counts.statement} color={counts.statement > 0 ? 'text-green-600' : undefined} />
        <StatCard label="待处理开始条件暂不能继续数" value={counts.gate} color={counts.gate > 0 ? 'text-red-600' : undefined} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>待办类型</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>关联对象</TableHead>
                <TableHead>说明</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    暂无待办事项
                  </TableCell>
                </TableRow>
              ) : todos.map(item => (
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
