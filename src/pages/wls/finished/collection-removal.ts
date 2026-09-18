import type { AppState } from '../../../state/store'

type RemovalLine = { sku: string; name: string; qty: number; removed: number; origin: string; recommend: string }
type RemovalTask = { id: string; orderId: string; box: string; reason: string; status: '待移出' | '移出中' | '已完成'; created: string; lines: RemovalLine[] }

const seedTasks: RemovalTask[] = [
  { id: 'CR-20260829-001', orderId: 'JH-CANCEL-001', box: 'BOX-003', reason: '订单取消', status: '待移出', created: '2026-08-29 11:10', lines: [
    { sku: 'SKU-HOOD-BLK-L', name: '黑色连帽卫衣 L', qty: 1, removed: 0, origin: 'A05-01', recommend: 'A05-01' },
    { sku: 'SKU-PANTS-BLK-L', name: '黑色休闲裤 L', qty: 1, removed: 0, origin: 'A05-02', recommend: 'A05-02' },
  ]},
  { id: 'CR-20260829-002', orderId: 'JH-TIMEOUT-002', box: 'BOX-005', reason: '集货超时', status: '待移出', created: '2026-08-29 11:30', lines: [
    { sku: 'SKU-TEE-GRY-M', name: '灰色短袖 M', qty: 2, removed: 0, origin: 'A03-04（不可用）', recommend: 'A03-06' },
  ]},
  { id: 'CR-20260828-003', orderId: 'JH-20260828-015', box: 'BOX-007', reason: '订单取消', status: '移出中', created: '2026-08-28 15:20', lines: [
    { sku: 'SKU-DRESS-RED-S', name: '红色连衣裙 S', qty: 1, removed: 1, origin: 'B02-03', recommend: 'B02-03' },
    { sku: 'SKU-SKIRT-WHT-M', name: '白色半裙 M', qty: 1, removed: 0, origin: 'B02-05', recommend: 'B02-05' },
  ]},
  { id: 'CR-20260828-004', orderId: 'JH-20260828-018', box: 'BOX-009', reason: '商品破损', status: '已完成', created: '2026-08-28 10:00', lines: [
    { sku: 'SKU-JACKET-NAV-L', name: '藏蓝夹克 L', qty: 1, removed: 1, origin: 'C03-02', recommend: 'C03-02' },
  ]},
]

function badgeClass(s: string): string {
  if (s === '已完成') return 'bg-emerald-50 text-emerald-700'
  if (s === '移出中') return 'bg-blue-50 text-blue-700'
  return 'bg-amber-50 text-amber-700'
}

export function renderCollectionRemoval(_state: AppState): string {
  const stats = (['待移出', '移出中', '已完成'] as const).map(s => {
    const count = seedTasks.filter(t => t.status === s).length
    return `
      <div class="rounded-lg border border-[var(--border-default)] bg-white p-4">
        <div class="text-xs text-[var(--text-muted)]">${s}</div>
        <div class="mt-1 text-2xl font-semibold">${count}</div>
      </div>
    `
  }).join('')

  const rows = seedTasks.map(t => {
    const total = t.lines.reduce((s, l) => s + l.qty, 0)
    const removed = t.lines.reduce((s, l) => s + l.removed, 0)
    const cls = badgeClass(t.status)
    return `
      <tr class="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
        <td class="px-3 py-4 font-medium text-[var(--link)]">${t.id}</td>
        <td class="px-3 py-3">${t.orderId}</td>
        <td class="px-3 py-3">${t.orderId.replace('JH-', 'SO-')}</td>
        <td class="px-3 py-3 font-medium text-blue-700">${t.box}</td>
        <td class="px-3 py-3 text-center">${t.lines.length}</td>
        <td class="px-3 py-3 text-center">${total}</td>
        <td class="px-3 py-3 text-center">${removed}</td>
        <td class="px-3 py-3">${t.reason}</td>
        <td class="px-3 py-3"><span class="rounded-full px-2 py-0.5 text-xs ${cls}">${t.status}</span></td>
        <td class="px-3 py-3 whitespace-nowrap">${t.created}</td>
        <td class="px-3 py-3">
          <button class="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]" onclick="window.__wlsCollectionRemoval?.viewDetail('${t.id}')">查看详情</button>
        </td>
      </tr>
    `
  }).join('')

  return `
    <div class="space-y-4">
      <div>
        <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">移出集货</h2>
        <p class="mt-1 text-[13px] text-[var(--text-muted)]">成衣仓预售订单提前集货流程 · 集货箱商品移出回库管理</p>
      </div>

      <div class="grid grid-cols-3 gap-3">
        ${stats}
      </div>

      <div class="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-default)] bg-white p-4">
        <input placeholder="移出任务号 / 订单号 / 集货箱号" class="h-9 w-72 rounded-md border border-[var(--border-default)] px-3 text-sm" />
        <select class="h-9 rounded-md border border-[var(--border-default)] px-3 text-sm">
          <option>全部移出状态</option><option>待移出</option><option>移出中</option><option>已完成</option>
        </select>
        <button class="rounded-md border border-[var(--link)] bg-[var(--link)] px-3 py-1.5 text-xs font-medium text-white">查询</button>
        <button class="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">重置</button>
      </div>

      <div class="overflow-auto rounded-lg border border-[var(--border-default)] bg-white">
        <table class="min-w-[1200px] w-full text-[13px]">
          <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th class="px-3 py-3 text-left font-medium">移出任务号</th>
              <th class="px-3 py-3 text-left font-medium">订单号</th>
              <th class="px-3 py-3 text-left font-medium">发货单号</th>
              <th class="px-3 py-3 text-left font-medium">集货箱号</th>
              <th class="px-3 py-3 text-center font-medium">箱内 SKU</th>
              <th class="px-3 py-3 text-center font-medium">箱内商品</th>
              <th class="px-3 py-3 text-center font-medium">已回库</th>
              <th class="px-3 py-3 text-left font-medium">移出原因</th>
              <th class="px-3 py-3 text-left font-medium">状态</th>
              <th class="px-3 py-3 text-left font-medium">创建时间</th>
              <th class="px-3 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <div class="rounded-lg border border-[var(--border-default)] bg-white p-5 text-sm">
        <h3 class="font-semibold text-[var(--text-primary)]">功能逻辑说明</h3>
        <table class="mt-3 w-full text-[13px]">
          <tbody>
            <tr class="border-t border-[var(--border-subtle)]"><td class="w-36 py-3 font-medium text-[var(--text-primary)]">页面定位</td><td class="py-3 text-[var(--text-muted)]">管理集货箱内商品的移出回库任务，支持订单取消、集货超时、商品破损等场景。</td></tr>
            <tr class="border-t border-[var(--border-subtle)]"><td class="py-3 font-medium text-[var(--text-primary)]">作业流程</td><td class="py-3 text-[var(--text-muted)]">选择 Web 移出任务 → PDA 扫集货箱 → 逐件扫 SKU → 扫推荐库位 → 确认回库。</td></tr>
            <tr class="border-t border-[var(--border-subtle)]"><td class="py-3 font-medium text-[var(--text-primary)]">释放规则</td><td class="py-3 text-[var(--text-muted)]">箱内实际库存清零后才解除订单绑定并释放集货箱。</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <script>
      window.__wlsCollectionRemoval = {
        viewDetail(id) { console.log('查看移出任务详情', id) }
      }
    </script>
  `
}
