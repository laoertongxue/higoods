import type { AppState } from '../../../state/store'

type CollectionBox = { code: string; name: string; qrCode: string; warehouse: string; type: string; businessStatus: string; creator: string; created: string; updated: string; enabled: boolean }

const statusClass = (s: string) => {
  if (s === '已集齐') return 'bg-emerald-50 text-emerald-700'
  if (s === '移出中') return 'bg-amber-50 text-amber-700'
  if (s === '集货中') return 'bg-blue-50 text-blue-700'
  return 'bg-slate-100 text-slate-500'
}

const seedBoxes: CollectionBox[] = [
  { code: 'BOX-001', name: '集货周转箱 001', qrCode: 'QR-BOX-001', warehouse: '成衣仓', type: '普通集货箱', businessStatus: '集货中', creator: '系统管理员', created: '2026-08-20 09:00', updated: '2026-08-20 09:00', enabled: true },
  { code: 'BOX-002', name: '集货周转箱 002', qrCode: 'QR-BOX-002', warehouse: '成衣仓', type: '普通集货箱', businessStatus: '已集齐', creator: '系统管理员', created: '2026-08-20 09:02', updated: '2026-08-20 09:02', enabled: true },
  { code: 'BOX-003', name: '备用集货箱 003', qrCode: 'QR-BOX-003', warehouse: '成衣仓', type: '普通集货箱', businessStatus: '移出中', creator: '王敏', created: '2026-08-20 09:05', updated: '2026-08-28 15:30', enabled: false },
  { code: 'BOX-004', name: '大件集货箱 004', qrCode: 'QR-BOX-004', warehouse: '成衣仓', type: '大箱', businessStatus: '空闲', creator: '王敏', created: '2026-08-20 09:08', updated: '2026-08-20 09:08', enabled: true },
  { code: 'BOX-005', name: '集货周转箱 005', qrCode: 'QR-BOX-005', warehouse: '成衣仓', type: '普通集货箱', businessStatus: '空闲', creator: '系统管理员', created: '2026-08-20 09:10', updated: '2026-08-20 09:10', enabled: true },
  { code: 'BOX-006', name: '集货周转箱 006', qrCode: 'QR-BOX-006', warehouse: '成衣仓', type: '普通集货箱', businessStatus: '集货中', creator: '系统管理员', created: '2026-08-20 09:12', updated: '2026-08-20 09:12', enabled: true },
]

export function renderBasicCollectionBox(_state: AppState): string {
  const rows = seedBoxes.map(b => `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
    <td class="px-3 py-2 text-xs font-medium text-slate-700">${b.code}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${b.name}</td>
    <td class="px-3 py-2 text-xs text-slate-500 font-mono">${b.qrCode}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${b.warehouse}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded-full px-2 py-0.5 text-xs ${statusClass(b.businessStatus)}">${b.businessStatus}</span></td>
    <td class="px-3 py-2 text-xs text-slate-600">${b.creator}</td>
    <td class="px-3 py-2 text-xs text-slate-500">${b.created}</td>
    <td class="px-3 py-2 text-xs text-slate-500">${b.updated}</td>
    <td class="px-3 py-2 text-xs space-x-2">
      <button class="text-[var(--link)] hover:underline">编辑</button>
      <button class="text-[var(--link)] hover:underline">打印二维码</button>
      <button class="${b.businessStatus !== '空闲' ? 'text-slate-300 cursor-not-allowed' : 'text-[var(--link)] hover:underline'}">${b.enabled ? '禁用' : '启用'}</button>
    </td>
  </tr>`).join('')

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">集货箱管理</h1>
      <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">新增集货箱</button>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="集货箱号" class="w-[180px] rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <input type="text" placeholder="集货箱名称" class="w-[180px] rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部仓库</option><option>成衣仓</option>
        </select>
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部类型</option><option>普通集货箱</option><option>大箱</option>
        </select>
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部状态</option><option>空闲</option><option>集货中</option><option>已集齐</option><option>移出中</option>
        </select>
        <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">查询</button>
        <button class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600 hover:bg-[var(--bg-hover)]">重置</button>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">共 ${seedBoxes.length} 条记录</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1200px] text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2">集货箱号</th><th class="px-3 py-2">集货箱名称</th><th class="px-3 py-2">二维码</th>
              <th class="px-3 py-2">所属仓库</th><th class="px-3 py-2">业务状态</th><th class="px-3 py-2">创建人</th>
              <th class="px-3 py-2">创建时间</th><th class="px-3 py-2">最后修改</th><th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>
  <script>window.__wlsBasicCollectionBox = {};</script>`
}
