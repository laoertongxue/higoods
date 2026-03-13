import { renderPdaFrame } from './pda-shell'
import { escapeHtml, toClassName } from '../utils'

interface SettlementSummaryItem {
  key: string
  label: string
  value: string
  icon: string
  color: string
  bg: string
}

interface SettlementCycleItem {
  cycle: string
  taskCount: number
  shouldPay: string
  deduction: string
  paid: string
  status: '已结算' | '待结算' | '进行中'
}

const SUMMARY: SettlementSummaryItem[] = [
  {
    key: 'estimated',
    label: '预计收入',
    value: '¥ 68,400',
    icon: 'trending-up',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    key: 'pending',
    label: '待结算金额',
    value: '¥ 32,200',
    icon: 'clock',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    key: 'deduction',
    label: '扣款金额',
    value: '¥ 1,560',
    icon: 'minus',
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  {
    key: 'paid',
    label: '已付金额',
    value: '¥ 28,640',
    icon: 'check-circle',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
]

const SETTLEMENT_CYCLES: SettlementCycleItem[] = [
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

function getStatusBadgeClass(status: SettlementCycleItem['status']): string {
  if (status === '已结算') return 'border-primary/20 bg-primary text-primary-foreground'
  if (status === '进行中') return 'border-border bg-muted text-muted-foreground'
  return 'border-border bg-background text-foreground'
}

export function renderPdaSettlementPage(): string {
  const content = `
    <div class="flex min-h-[760px] flex-col bg-background">
      <header class="sticky top-0 z-40 border-b bg-background px-4 py-3">
        <h1 class="flex items-center gap-2 text-lg font-semibold">
          <i data-lucide="wallet" class="h-5 w-5"></i>
          结算与扣款
        </h1>
      </header>

      <div class="space-y-4 p-4">
        <div class="grid grid-cols-2 gap-3">
          ${SUMMARY.map(
            (item) => `
              <article class="rounded-lg border bg-card">
                <div class="flex items-center gap-3 p-3">
                  <div class="shrink-0 rounded-lg p-2 ${item.bg}">
                    <i data-lucide="${item.icon}" class="h-4 w-4 ${item.color}"></i>
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs leading-tight text-muted-foreground">${escapeHtml(item.label)}</p>
                    <p class="text-base font-bold tabular-nums">${escapeHtml(item.value)}</p>
                  </div>
                </div>
              </article>
            `,
          ).join('')}
        </div>

        <section>
          <h2 class="mb-2 text-sm font-semibold text-foreground">结算周期列表</h2>
          <article class="rounded-lg border bg-card">
            <div class="overflow-x-auto">
              <table class="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr class="border-b bg-muted/30">
                    <th class="px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground">结算周期</th>
                    <th class="px-3 py-2 text-right text-xs font-medium whitespace-nowrap text-muted-foreground">任务数</th>
                    <th class="px-3 py-2 text-right text-xs font-medium whitespace-nowrap text-muted-foreground">应结金额</th>
                    <th class="px-3 py-2 text-right text-xs font-medium whitespace-nowrap text-muted-foreground">扣款</th>
                    <th class="px-3 py-2 text-right text-xs font-medium whitespace-nowrap text-muted-foreground">已付</th>
                    <th class="px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground">状态</th>
                  </tr>
                </thead>
                <tbody>
                  ${SETTLEMENT_CYCLES.map(
                    (row) => `
                      <tr class="${toClassName(
                        'border-b last:border-b-0',
                        row.status === '进行中' ? 'bg-muted/10' : '',
                      )}">
                        <td class="whitespace-nowrap px-3 py-2 text-xs font-medium">${escapeHtml(row.cycle)}</td>
                        <td class="px-3 py-2 text-right text-xs tabular-nums">${row.taskCount}</td>
                        <td class="px-3 py-2 text-right text-xs tabular-nums">${escapeHtml(row.shouldPay)}</td>
                        <td class="px-3 py-2 text-right text-xs tabular-nums text-red-600">${escapeHtml(row.deduction)}</td>
                        <td class="px-3 py-2 text-right text-xs tabular-nums text-green-600">${escapeHtml(row.paid)}</td>
                        <td class="px-3 py-2">
                          <span class="inline-flex items-center rounded border px-1.5 py-0 text-[10px] ${getStatusBadgeClass(
                            row.status,
                          )}">
                            ${escapeHtml(row.status)}
                          </span>
                        </td>
                      </tr>
                    `,
                  ).join('')}
                </tbody>
              </table>
            </div>
          </article>
          <p class="mt-2 text-center text-xs text-muted-foreground">结算数据每日同步，仅供参考。</p>
        </section>
      </div>
    </div>
  `

  return renderPdaFrame(content, 'settlement')
}

export function handlePdaSettlementEvent(_target: HTMLElement): boolean {
  return false
}
