import type { AppState } from '../../../state/store'

type DistributionLine = { sku: string; name: string; handover: number; distributed: number; exception: number }
type DistributionAllocation = { sku: string; order: string; ship: string; box: string; qty: number; operator: string; time: string }
type DistributionTask = { id: string; wave: string; area: string; frame: string; status: 'WAIT_DISTRIBUTION' | 'DISTRIBUTING' | 'COMPLETED' | 'EXCEPTION'; operator: string; created: string; started: string; completed: string; lines: DistributionLine[]; allocations: DistributionAllocation[]; exceptionNote?: string }

const statusLabel: Record<string, string> = {
  WAIT_DISTRIBUTION: '待二次分拨', DISTRIBUTING: '分拨中', COMPLETED: '已完成', EXCEPTION: '异常'
}

function badgeClass(s: string): string {
  if (s === 'COMPLETED') return 'bg-emerald-50 text-emerald-700'
  if (s === 'EXCEPTION') return 'bg-red-50 text-red-700'
  if (s === 'DISTRIBUTING') return 'bg-blue-50 text-blue-700'
  return 'bg-amber-50 text-amber-700'
}

const seedTasks: DistributionTask[] = [
  { id: 'FB-20260829-001', wave: 'JH-WAVE-20260829-004', area: 'A区', frame: 'PF-001', status: 'WAIT_DISTRIBUTION', operator: '-', created: '2026-08-29 09:45', started: '-', completed: '-', lines: [{ sku: 'SKU-CARD-WHT-M', name: '针织开衫 米白 M', handover: 4, distributed: 0, exception: 0 }], allocations: [] },
  { id: 'FB-20260829-002', wave: 'JH-WAVE-20260829-006', area: 'B区', frame: 'PF-003', status: 'WAIT_DISTRIBUTION', operator: '-', created: '2026-08-29 10:05', started: '-', completed: '-', lines: [{ sku: 'SKU-SKIRT-GRY-M', name: '灰色百褶裙 M', handover: 3, distributed: 0, exception: 0 }], allocations: [] },
  { id: 'FB-20260829-003', wave: 'JH-WAVE-20260829-007', area: 'A区', frame: 'PF-002', status: 'DISTRIBUTING', operator: '张伟', created: '2026-08-29 10:20', started: '2026-08-29 10:28', completed: '-', lines: [
    { sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', handover: 6, distributed: 4, exception: 0 },
    { sku: 'SKU-TEE-WHT-M', name: '白色短袖 M', handover: 2, distributed: 1, exception: 0 },
  ], allocations: [
    { sku: 'SKU-DRESS-BLK-M', order: 'JH-20260829-001', ship: 'SO-20260829-001', box: 'BOX-001', qty: 2, operator: '张伟', time: '10:31' },
    { sku: 'SKU-DRESS-BLK-M', order: 'JH-20260829-002', ship: 'SO-20260829-004', box: 'BOX-002', qty: 2, operator: '张伟', time: '10:33' },
    { sku: 'SKU-TEE-WHT-M', order: 'JH-20260829-001', ship: 'SO-20260829-001', box: 'BOX-001', qty: 1, operator: '张伟', time: '10:35' },
  ]},
  { id: 'FB-20260829-004', wave: 'JH-WAVE-20260829-008', area: 'C区', frame: 'PF-004', status: 'DISTRIBUTING', operator: '李娜', created: '2026-08-29 10:40', started: '2026-08-29 10:48', completed: '-', lines: [{ sku: 'SKU-JACKET-KHA-S', name: '卡其夹克 S', handover: 5, distributed: 3, exception: 0 }], allocations: [
    { sku: 'SKU-JACKET-KHA-S', order: 'JH-20260829-003', ship: 'SO-20260829-005', box: 'BOX-006', qty: 3, operator: '李娜', time: '10:52' },
  ]},
  { id: 'FB-20260829-005', wave: 'JH-WAVE-20260828-021', area: 'A区', frame: 'PF-001', status: 'COMPLETED', operator: '张伟', created: '2026-08-28 16:10', started: '2026-08-28 16:18', completed: '2026-08-28 16:42', lines: [{ sku: 'SKU-HOOD-BLK-M', name: '黑色连帽卫衣 M', handover: 5, distributed: 5, exception: 0 }], allocations: [
    { sku: 'SKU-HOOD-BLK-M', order: 'JH-20260828-021', ship: 'SO-20260828-021', box: 'BOX-008', qty: 3, operator: '张伟', time: '16:30' },
    { sku: 'SKU-HOOD-BLK-M', order: 'JH-20260828-022', ship: 'SO-20260828-022', box: 'BOX-009', qty: 2, operator: '张伟', time: '16:42' },
  ]},
  { id: 'FB-20260829-006', wave: 'JH-WAVE-20260828-024', area: 'B区', frame: 'PF-003', status: 'COMPLETED', operator: '王敏', created: '2026-08-28 17:00', started: '2026-08-28 17:06', completed: '2026-08-28 17:25', lines: [{ sku: 'SKU-JEAN-BLU-L', name: '蓝色牛仔裤 L', handover: 4, distributed: 4, exception: 0 }], allocations: [
    { sku: 'SKU-JEAN-BLU-L', order: 'JH-20260828-024', ship: 'SO-20260828-024', box: 'BOX-010', qty: 4, operator: '王敏', time: '17:25' },
  ]},
  { id: 'FB-20260829-007', wave: 'JH-WAVE-20260829-009', area: 'C区', frame: 'PF-004', status: 'EXCEPTION', operator: '李娜', created: '2026-08-29 11:00', started: '2026-08-29 11:08', completed: '-', lines: [{ sku: 'SKU-VEST-BLK-M', name: '黑色马甲 M', handover: 3, distributed: 1, exception: 2 }], allocations: [
    { sku: 'SKU-VEST-BLK-M', order: 'JH-20260829-004', ship: 'SO-20260829-003', box: 'BOX-011', qty: 1, operator: '李娜', time: '11:12' },
  ], exceptionNote: '剩余 2 件暂无有效集货订单可匹配' },
]

export function renderCollectionSorting(_state: AppState): string {
  const stats = [
    { label: '待二次分拨', count: seedTasks.filter(t => t.status === 'WAIT_DISTRIBUTION').length, color: 'bg-amber-50 text-amber-700' },
    { label: '分拨中', count: seedTasks.filter(t => t.status === 'DISTRIBUTING').length, color: 'bg-blue-50 text-blue-700' },
    { label: '已完成', count: seedTasks.filter(t => t.status === 'COMPLETED').length, color: 'bg-emerald-50 text-emerald-700' },
    { label: '异常', count: seedTasks.filter(t => t.status === 'EXCEPTION').length, color: 'bg-red-50 text-red-700' },
  ]

  const statsHtml = stats.map(s => `
    <div class="rounded-lg border border-[var(--border-default)] bg-white p-4">
      <div class="text-xs text-[var(--text-muted)]">${s.label}</div>
      <div class="mt-1 text-2xl font-semibold ${s.color.split(' ')[1]}">${s.count}</div>
    </div>
  `).join('')

  const rows = seedTasks.map(t => {
    const handover = t.lines.reduce((s, l) => s + l.handover, 0)
    const distributed = t.lines.reduce((s, l) => s + l.distributed, 0)
    const exception = t.lines.reduce((s, l) => s + l.exception, 0)
    const pending = Math.max(0, handover - distributed - exception)
    const orderCount = new Set(t.allocations.map(a => a.order)).size
    const boxCount = new Set(t.allocations.map(a => a.box)).size
    const label = statusLabel[t.status] || t.status
    const cls = badgeClass(t.status)
    return `
      <tr class="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
        <td class="px-3 py-4 font-medium text-[var(--link)]">${t.id}</td>
        <td class="px-3 py-3">${t.wave}</td>
        <td class="px-3 py-3 font-medium text-blue-700">${t.frame}</td>
        <td class="px-3 py-3 text-center">${t.lines.length}</td>
        <td class="px-3 py-3 text-center">${handover}</td>
        <td class="px-3 py-3 text-center">${distributed}</td>
        <td class="px-3 py-3 text-center">${pending}</td>
        <td class="px-3 py-3 text-center">${exception}</td>
        <td class="px-3 py-3 text-center">${orderCount}</td>
        <td class="px-3 py-3 text-center">${boxCount}</td>
        <td class="px-3 py-3"><span class="rounded-full px-2 py-0.5 text-xs ${cls}">${label}</span></td>
        <td class="px-3 py-3">${t.operator}</td>
        <td class="px-3 py-3 whitespace-nowrap">${t.started}</td>
        <td class="px-3 py-3 whitespace-nowrap">${t.completed}</td>
        <td class="px-3 py-3 whitespace-nowrap">${t.created}</td>
        <td class="px-3 py-3">
          <button class="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]" onclick="window.__wlsCollectionSorting?.viewDetail('${t.id}')">查看详情</button>
        </td>
      </tr>
    `
  }).join('')

  return `
    <div class="space-y-4">
      <div>
        <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">二次分拨列表</h2>
        <p class="mt-1 text-[13px] text-[var(--text-muted)]">成衣仓预售订单提前集货流程 · 集货拣货波次交接后的二次分拨管理</p>
      </div>

      <div class="grid grid-cols-4 gap-3">
        ${statsHtml}
      </div>

      <div class="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-default)] bg-white p-4">
        <input placeholder="二次分拨任务号" class="h-9 w-44 rounded-md border border-[var(--border-default)] px-3 text-sm" />
        <input placeholder="集货拣货波次号" class="h-9 w-44 rounded-md border border-[var(--border-default)] px-3 text-sm" />
        <select class="h-9 rounded-md border border-[var(--border-default)] px-3 text-sm">
          <option>全部来源库区</option><option>A区</option><option>B区</option><option>C区</option>
        </select>
        <input placeholder="SKU / 操作人" class="h-9 w-36 rounded-md border border-[var(--border-default)] px-3 text-sm" />
        <select class="h-9 rounded-md border border-[var(--border-default)] px-3 text-sm">
          <option>全部分拨状态</option><option>待二次分拨</option><option>分拨中</option><option>已完成</option><option>异常</option>
        </select>
        <input type="date" class="h-9 rounded-md border border-[var(--border-default)] px-3 text-sm" />
        <input type="date" class="h-9 rounded-md border border-[var(--border-default)] px-3 text-sm" />
        <button class="rounded-md border border-[var(--link)] bg-[var(--link)] px-3 py-1.5 text-xs font-medium text-white">查询</button>
        <button class="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">重置</button>
      </div>

      <div class="overflow-auto rounded-lg border border-[var(--border-default)] bg-white">
        <table class="min-w-[1750px] w-full text-[13px]">
          <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th class="px-3 py-3 text-left font-medium">二次分拨任务号</th>
              <th class="px-3 py-3 text-left font-medium">关联拣货波次</th>
              <th class="px-3 py-3 text-left font-medium">拣货框</th>
              <th class="px-3 py-3 text-center font-medium">SKU数</th>
              <th class="px-3 py-3 text-center font-medium">交接总数量</th>
              <th class="px-3 py-3 text-center font-medium">已分拨数量</th>
              <th class="px-3 py-3 text-center font-medium">待分拨数量</th>
              <th class="px-3 py-3 text-center font-medium">异常数量</th>
              <th class="px-3 py-3 text-center font-medium">涉及订单数</th>
              <th class="px-3 py-3 text-center font-medium">涉及集货箱数</th>
              <th class="px-3 py-3 text-left font-medium">分拨状态</th>
              <th class="px-3 py-3 text-left font-medium">操作人</th>
              <th class="px-3 py-3 text-left font-medium">开始时间</th>
              <th class="px-3 py-3 text-left font-medium">完成时间</th>
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
        <div class="mt-4 space-y-4 text-[var(--text-muted)]">
          <section>
            <b class="text-[var(--text-secondary)]">1. 页面说明</b>
            <p class="mt-1">用于查看集货拣货波次完成交接后的二次分拨任务及进度；Web 仅查询管理，现场操作由 PDA【二次分拨】完成。</p>
          </section>
          <section>
            <b class="text-[var(--text-secondary)]">2. 任务生成</b>
            <p class="mt-1 rounded bg-blue-50 px-3 py-2 text-blue-700">拣货波次确认交接 → 自动生成任务 → 待二次分拨 → PDA 分拨中 → 全部处理完成</p>
          </section>
          <section>
            <b class="text-[var(--text-secondary)]">3. 页面联动</b>
            <p class="mt-1">任务与完成交接的拣货波次 1:1；PDA 更新分拨数量，集货订单和集货箱同步更新，订单集齐后进入多件打包。</p>
          </section>
        </div>
      </div>
    </div>

    <script>
      window.__wlsCollectionSorting = {
        viewDetail(id) { console.log('查看分拨任务详情', id) }
      }
    </script>
  `
}
