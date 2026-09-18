import type { AppState } from '../../../state/store'

type Basket = { code: string; qrCode: string; name: string; type: string; warehouse: string; status: 'IDLE' | 'DISABLED' | 'IN_USE'; currentWave?: string; currentOutbound?: string; currentTask?: string; lastBind?: string; lastRelease?: string }

const statusLabel: Record<string, string> = { IDLE: '空闲', DISABLED: '已禁用', IN_USE: '使用中' }
function statusClass(s: string): string {
  if (s === 'IDLE') return 'bg-emerald-50 text-emerald-700'
  if (s === 'IN_USE') return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-500'
}

const seedBaskets: Basket[] = [
  { code: 'WH-FINISHED-BK-001', qrCode: 'QR-BK-001', name: 'A区拣货篮 01', type: '标准篮', warehouse: '成衣仓', status: 'IN_USE', currentWave: 'JH-WAVE-20260829-004', currentOutbound: 'SO-20260820-018', currentTask: 'PK-20260829-010', lastBind: '2026-08-29 09:10', lastRelease: '2026-08-28 17:30' },
  { code: 'WH-FINISHED-BK-002', qrCode: 'QR-BK-002', name: 'A区拣货篮 02', type: '标准篮', warehouse: '成衣仓', status: 'IDLE', lastBind: '2026-08-28 16:00', lastRelease: '2026-08-28 16:45' },
  { code: 'WH-FINISHED-BK-003', qrCode: 'QR-BK-003', name: 'B区拣货篮 03', type: '标准篮', warehouse: '成衣仓', status: 'IDLE', lastBind: '2026-08-28 15:00', lastRelease: '2026-08-28 15:40' },
  { code: 'WH-FINISHED-BK-004', qrCode: 'QR-BK-004', name: 'C区拣货篮 04', type: '大篮', warehouse: '成衣仓', status: 'IN_USE', currentWave: 'JH-WAVE-20260829-003', currentOutbound: 'SO-20260829-005', currentTask: 'PK-20260829-008', lastBind: '2026-08-29 10:25', lastRelease: '2026-08-28 18:00' },
  { code: 'WH-FINISHED-BK-005', qrCode: 'QR-BK-005', name: '备用拣货篮 05', type: '标准篮', warehouse: '成衣仓', status: 'DISABLED', lastRelease: '2026-08-27 12:00' },
]

export function renderBasicBasket(_state: AppState): string {
  const rows = seedBaskets.map(b => `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
    <td class="px-3 py-2 text-xs font-medium text-slate-700">${b.code}</td>
    <td class="px-3 py-2 text-xs text-slate-500 font-mono">${b.qrCode}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${b.name}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${b.type}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${b.warehouse}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded-full px-2 py-0.5 text-xs ${statusClass(b.status)}">${statusLabel[b.status]}</span></td>
    <td class="px-3 py-2 text-xs text-slate-600">${b.currentWave || '-'}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${b.currentOutbound || '-'}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${b.currentTask || '-'}</td>
    <td class="px-3 py-2 text-xs text-slate-500">${b.lastBind || '-'}</td>
    <td class="px-3 py-2 text-xs text-slate-500">${b.lastRelease || '-'}</td>
    <td class="px-3 py-2 text-xs space-x-2">
      <button class="text-[var(--link)] hover:underline">打印</button>
      <button class="${b.status === 'IN_USE' ? 'text-slate-300 cursor-not-allowed' : 'text-[var(--link)] hover:underline'}">${b.status === 'DISABLED' ? '启用' : '禁用'}</button>
    </td>
  </tr>`).join('')

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">拣货篮管理</h1>
      <div class="flex gap-2">
        <button class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600 hover:bg-[var(--bg-hover)]">批量打印二维码</button>
        <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">新增拣货篮</button>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <div class="flex items-center gap-3">
        <input type="text" placeholder="搜索篮号 / 二维码 / 当前波次 / 当前出库单" class="w-[360px] rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <button class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600 hover:bg-[var(--bg-hover)]">重置</button>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">共 ${seedBaskets.length} 条记录</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1180px] text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2">拣货篮编号</th><th class="px-3 py-2">二维码</th><th class="px-3 py-2">名称</th>
              <th class="px-3 py-2">类型</th><th class="px-3 py-2">所属仓库</th><th class="px-3 py-2">状态</th>
              <th class="px-3 py-2">当前波次</th><th class="px-3 py-2">当前出库单</th><th class="px-3 py-2">当前拣货任务</th>
              <th class="px-3 py-2">最近绑定</th><th class="px-3 py-2">最近释放</th><th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>
  <script>window.__wlsBasicBasket = {};</script>`
}
