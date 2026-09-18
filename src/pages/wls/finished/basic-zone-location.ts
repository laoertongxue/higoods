import type { AppState } from '../../../state/store'

type ZoneLocation = { warehouseCode: string; warehouseName: string; zoneName: string; zoneId: string; locationName: string; locationId: string; enabled: boolean }

const seedData: ZoneLocation[] = [
  { warehouseCode: 'WH-FINISHED', warehouseName: '成衣仓', zoneName: 'A区', zoneId: 'ZONE-A', locationName: 'A01-01', locationId: 'LOC-A01-01', enabled: true },
  { warehouseCode: 'WH-FINISHED', warehouseName: '成衣仓', zoneName: 'A区', zoneId: 'ZONE-A', locationName: 'A01-02', locationId: 'LOC-A01-02', enabled: true },
  { warehouseCode: 'WH-FINISHED', warehouseName: '成衣仓', zoneName: 'A区', zoneId: 'ZONE-A', locationName: 'A02-01', locationId: 'LOC-A02-01', enabled: true },
  { warehouseCode: 'WH-FINISHED', warehouseName: '成衣仓', zoneName: 'B区', zoneId: 'ZONE-B', locationName: 'B01-01', locationId: 'LOC-B01-01', enabled: true },
  { warehouseCode: 'WH-FINISHED', warehouseName: '成衣仓', zoneName: 'B区', zoneId: 'ZONE-B', locationName: 'B01-02', locationId: 'LOC-B01-02', enabled: true },
  { warehouseCode: 'WH-FINISHED', warehouseName: '成衣仓', zoneName: 'C区-大件', zoneId: 'ZONE-C', locationName: 'C01-01', locationId: 'LOC-C01-01', enabled: true },
  { warehouseCode: 'WH-FINISHED', warehouseName: '成衣仓', zoneName: 'D区-瑕疵', zoneId: 'ZONE-D', locationName: 'D01-01', locationId: 'LOC-D01-01', enabled: true },
  { warehouseCode: 'WH-FINISHED', warehouseName: '成衣仓', zoneName: 'E区-报损', zoneId: 'ZONE-E', locationName: 'E01-01', locationId: 'LOC-E01-01', enabled: false },
]

export function renderBasicZoneLocation(_state: AppState): string {
  const warehouses = [...new Set(seedData.map(d => d.warehouseName))]
  const zones = [...new Set(seedData.map(d => d.zoneId))]
  const locations = seedData.length

  const rows = seedData.map(d => `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
    <td class="px-3 py-2 text-xs text-slate-700">${d.warehouseName}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${d.warehouseCode}</td>
    <td class="px-3 py-2 text-xs text-slate-700">${d.zoneName}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${d.zoneId}</td>
    <td class="px-3 py-2 text-xs text-slate-700">${d.locationName}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded-full px-2 py-0.5 text-xs ${d.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${d.enabled ? '启用' : '停用'}</span></td>
    <td class="px-3 py-2 text-xs space-x-2">
      <button class="text-[var(--link)] hover:underline">编辑</button>
      <button class="text-red-500 hover:underline">删除库位</button>
      <button class="text-red-500 hover:underline">删除库区</button>
    </td>
  </tr>`).join('')

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">库区库位管理</h1>
      <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">添加库区库位</button>
    </div>
    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">仓库数</div>
        <div class="mt-1 text-xl font-semibold text-slate-700">${warehouses.length}</div>
      </div>
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">库区数</div>
        <div class="mt-1 text-xl font-semibold text-blue-600">${zones.length}</div>
      </div>
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">库位数</div>
        <div class="mt-1 text-xl font-semibold text-emerald-600">${locations}</div>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <div class="flex items-center gap-3">
        <select class="w-[220px] rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          ${warehouses.map(w => `<option>${w}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">共 ${locations} 条记录</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[980px] text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2">仓库名称</th><th class="px-3 py-2">仓库编码</th><th class="px-3 py-2">库区名称</th>
              <th class="px-3 py-2">库区ID</th><th class="px-3 py-2">库位名称</th><th class="px-3 py-2">启用状态</th><th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>
  <script>window.__wlsBasicZoneLocation = {};</script>`
}
