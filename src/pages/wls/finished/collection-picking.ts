import type { AppState } from '../../../state/store'

type WaveLine = { location: string; zone: string; sku: string; name: string; available: number; qty: number; picked: number; short: number; status: string }
type Wave = { id: string; zone: string; orderIds: string[]; status: string; operator?: string; receiveTime?: string; creator: string; created: string; frame?: string; lines: WaveLine[] }

const statusLabel: Record<string, string> = {
  WAIT_RECEIVE: '待领取', PICKING: '拣货中', WAIT_HANDOVER: '待交接', COMPLETED: '已完成', CANCELLED: '已作废'
}

function badgeClass(s: string): string {
  if (s === 'COMPLETED') return 'bg-emerald-50 text-emerald-700'
  if (s === 'PICKING') return 'bg-blue-50 text-blue-700'
  if (s === 'WAIT_HANDOVER') return 'bg-amber-50 text-amber-700'
  if (s === 'CANCELLED') return 'bg-gray-100 text-gray-500'
  return 'bg-blue-50 text-blue-700'
}

const seedWaves: Wave[] = [
  { id: 'JH-WAVE-20260829-001', zone: 'A区', orderIds: ['JH-20260829-001', 'JH-20260829-002'], status: 'WAIT_RECEIVE', creator: '仓库主管-王敏', created: '2026-08-29 10:20', lines: [
    { location: 'A01-01', zone: 'A区', sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', available: 8, qty: 5, picked: 0, short: 0, status: '待拣' },
    { location: 'A02-03', zone: 'A区', sku: 'SKU-TEE-WHT-M', name: '白色短袖 M', available: 4, qty: 1, picked: 0, short: 0, status: '待拣' },
  ]},
  { id: 'JH-WAVE-20260829-002', zone: 'B区', orderIds: ['JH-20260829-002'], status: 'WAIT_RECEIVE', creator: '仓库主管-王敏', created: '2026-08-29 10:20', lines: [
    { location: 'B03-01', zone: 'B区', sku: 'SKU-JEAN-BLU-L', name: '蓝色牛仔裤 L', available: 5, qty: 2, picked: 0, short: 0, status: '待拣' },
  ]},
  { id: 'JH-WAVE-20260829-003', zone: 'C区', orderIds: ['JH-20260829-003'], status: 'PICKING', operator: 'PDA操作员-张伟', receiveTime: '2026-08-29 10:35', frame: 'PF-004', creator: '仓库主管-王敏', created: '2026-08-29 10:25', lines: [
    { location: 'C01-01', zone: 'C区', sku: 'SKU-JACKET-KHA-S', name: '卡其夹克 S', available: 6, qty: 2, picked: 1, short: 0, status: '拣货中' },
  ]},
  { id: 'JH-WAVE-20260829-004', zone: 'A区', orderIds: ['JH-20260820-018'], status: 'WAIT_HANDOVER', operator: 'PDA操作员-张伟', receiveTime: '2026-08-29 09:10', frame: 'PF-001', creator: '仓库主管-王敏', created: '2026-08-29 09:00', lines: [
    { location: 'A03-08', zone: 'A区', sku: 'SKU-CARD-WHT-M', name: '针织开衫 米白 M', available: 5, qty: 1, picked: 1, short: 0, status: '已拣' },
  ]},
  { id: 'JH-WAVE-20260828-020', zone: 'A区', orderIds: ['JH-20260828-020'], status: 'COMPLETED', operator: 'PDA操作员-张伟', receiveTime: '2026-08-28 14:10', frame: 'PF-001', creator: '仓库主管-王敏', created: '2026-08-28 14:00', lines: [
    { location: 'A01-05', zone: 'A区', sku: 'SKU-HOOD-BLK-M', name: '黑色连帽卫衣 M', available: 10, qty: 3, picked: 3, short: 0, status: '已拣' },
  ]},
]

export function renderCollectionPicking(_state: AppState): string {
  const rows = seedWaves.map(w => {
    const totalQty = w.lines.reduce((s, l) => s + l.qty, 0)
    const totalPicked = w.lines.reduce((s, l) => s + l.picked, 0)
    const statusCls = badgeClass(w.status)
    const label = statusLabel[w.status] || w.status
    const canVoid = w.status === 'WAIT_RECEIVE'
    const canHandover = w.status === 'WAIT_HANDOVER'
    return `
      <tr class="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
        <td class="px-3 py-4 font-medium text-[var(--link)]">${w.id}</td>
        <td class="px-3 py-3">${w.zone}</td>
        <td class="px-3 py-3 font-medium text-blue-700">${w.frame || '-'}</td>
        <td class="px-3 py-3 text-center">${w.orderIds.length}</td>
        <td class="px-3 py-3 text-center">${w.lines.length}</td>
        <td class="px-3 py-3 text-center">${totalQty}</td>
        <td class="px-3 py-3 text-center">${totalPicked}</td>
        <td class="px-3 py-3">${w.operator || '-'}</td>
        <td class="px-3 py-3"><span class="rounded-full px-2 py-0.5 text-xs ${statusCls}">${label}</span></td>
        <td class="px-3 py-3">${w.creator}</td>
        <td class="px-3 py-3 whitespace-nowrap">${w.created}</td>
        <td class="px-3 py-3">
          <div class="flex gap-1.5">
            <button class="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]" onclick="window.__wlsCollectionPicking?.viewDetail('${w.id}')">查看详情</button>
            <button class="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">打印</button>
            <button class="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-40" ${canVoid ? '' : 'disabled'}>作废</button>
            ${canHandover ? `<button class="rounded-md border border-[var(--link)] bg-[var(--link)] px-3 py-1.5 text-xs font-medium text-white" onclick="window.__wlsCollectionPicking?.handover('${w.id}')">确认交接</button>` : ''}
          </div>
        </td>
      </tr>
    `
  }).join('')

  return `
    <div class="space-y-4">
      <div>
        <h2 class="text-[20px] font-semibold text-[var(--text-primary)]">集货拣货波次</h2>
        <p class="mt-1 text-[13px] text-[var(--text-muted)]">成衣仓预售订单提前集货流程 · 管理拣货波次与交接</p>
      </div>

      <div class="overflow-auto rounded-lg border border-[var(--border-default)] bg-white">
        <table class="min-w-[1200px] w-full text-[13px]">
          <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <tr>
              <th class="px-3 py-3 text-left font-medium">波次号</th>
              <th class="px-3 py-3 text-left font-medium">库区</th>
              <th class="px-3 py-3 text-left font-medium">拣货框</th>
              <th class="px-3 py-3 text-center font-medium">关联订单数</th>
              <th class="px-3 py-3 text-center font-medium">SKU数</th>
              <th class="px-3 py-3 text-center font-medium">应拣数量</th>
              <th class="px-3 py-3 text-center font-medium">已拣数量</th>
              <th class="px-3 py-3 text-left font-medium">领取人</th>
              <th class="px-3 py-3 text-left font-medium">状态</th>
              <th class="px-3 py-3 text-left font-medium">创建人</th>
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
            <tr class="border-t border-[var(--border-subtle)]"><td class="w-36 py-3 font-medium text-[var(--text-primary)]">页面定位</td><td class="py-3 text-[var(--text-muted)]">管理由集货订单人工创建的拣货波次，跟踪PDA领取、拣货、短拣、交接和完成状态。</td></tr>
            <tr class="border-t border-[var(--border-subtle)]"><td class="py-3 font-medium text-[var(--text-primary)]">波次拆分</td><td class="py-3 text-[var(--text-muted)]">波次唯一拆分维度为库区。同库区、同SKU合并应拣数量，PDA无需按订单拣货。</td></tr>
            <tr class="border-t border-[var(--border-subtle)]"><td class="py-3 font-medium text-[var(--text-primary)]">PDA领取</td><td class="py-3 text-[var(--text-muted)]">待领取波次可由一名主要操作员领取，重复领取会被阻止。</td></tr>
            <tr class="border-t border-[var(--border-subtle)]"><td class="py-3 font-medium text-[var(--text-primary)]">待交接</td><td class="py-3 text-[var(--text-muted)]">完成拣货后进入待交接，此时现场货物虽离架，系统仍不增加集货区可分配库存。</td></tr>
            <tr class="border-t border-[var(--border-subtle)]"><td class="py-3 font-medium text-[var(--text-primary)]">确认交接</td><td class="py-3 text-[var(--text-muted)]">确认后减少来源库存、释放实际交接数量的波次占用、增加集货区待分配库存，并保证重复提交幂等。</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <script>
      window.__wlsCollectionPicking = {
        viewDetail(id) { console.log('查看波次详情', id) },
        handover(id) { console.log('确认交接', id) }
      }
    </script>
  `
}
