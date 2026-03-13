'use client'

import { Wallet, TrendingUp, Clock, Minus, CheckCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

// ── Mock 摘要数据 ──
const SUMMARY = [
  {
    key: 'estimated',
    label: '预计收入',
    value: '¥ 68,400',
    icon: TrendingUp,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    key: 'pending',
    label: '待结算金额',
    value: '¥ 32,200',
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    key: 'deduction',
    label: '扣款金额',
    value: '¥ 1,560',
    icon: Minus,
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  {
    key: 'paid',
    label: '已付金额',
    value: '¥ 28,640',
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
]

// ── Mock 结算周期列表 ──
const SETTLEMENT_CYCLES = [
  {
    cycle: '2026-02',
    taskCount: 8,
    shouldPay: '¥ 28,640',
    deduction: '¥ 960',
    paid: '¥ 28,640',
    status: '已结算',
  },
  {
    cycle: '2026-03',
    taskCount: 5,
    shouldPay: '¥ 19,800',
    deduction: '¥ 600',
    paid: '-',
    status: '待结算',
  },
  {
    cycle: '2026-04（预计）',
    taskCount: 3,
    shouldPay: '¥ 12,400',
    deduction: '-',
    paid: '-',
    status: '进行中',
  },
]

const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  '已结算': 'default',
  '待结算': 'outline',
  '进行中': 'secondary',
}

export default function SettlementPage() {
  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-40 bg-background border-b px-4 py-3">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          结算与扣款
        </h1>
      </header>

      <div className="p-4 space-y-4">
        {/* 摘要卡 */}
        <div className="grid grid-cols-2 gap-3">
          {SUMMARY.map(item => {
            const Icon = item.icon
            return (
              <Card key={item.key}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${item.bg}`}>
                    <Icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground leading-tight">{item.label}</p>
                    <p className="text-base font-bold tabular-nums">{item.value}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* 结算周期列表 */}
        <div>
          <h2 className="text-sm font-semibold mb-2 text-foreground">结算周期列表</h2>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs whitespace-nowrap">结算周期</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">任务数</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">应结金额</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">扣款</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">已付</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SETTLEMENT_CYCLES.map(row => (
                    <TableRow key={row.cycle}>
                      <TableCell className="text-xs font-medium whitespace-nowrap">{row.cycle}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{row.taskCount}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{row.shouldPay}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-red-600">{row.deduction}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-green-600">{row.paid}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[row.status] || 'outline'} className="text-[10px] px-1.5 py-0">
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-2 text-center">结算数据每日同步，仅供参考。</p>
        </div>
      </div>
    </div>
  )
}
