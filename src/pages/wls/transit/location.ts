import type { AppState } from '../../../state/store'

type LocationRecord = {
  locationCode: string; zone: string; status: string; bindProductionNo: string
  skuCount: number; materialQty: number; capacity: number
  lastBindTime: string; lastReleaseTime: string
}

const statusClass: Record<string, string> = {
  '空闲': 'bg-slate-100 text-slate-500', '已绑定': 'bg-blue-50 text-blue-700',
  '部分取用': 'bg-amber-50 text-amber-700', '已释放': 'bg-emerald-50 text-emerald-700', '禁用': 'bg-red-50 text-red-700',
}

const seedLocations: LocationRecord[] = [
  { locationCode: 'TR-A-01', zone: '中转仓货架区', status: '已绑定', bindProductionNo: 'PO14955', skuCount: 1, materialQty: 3, capacity: 17, lastBindTime: '2026-07-12 16:30', lastReleaseTime: '—' },
  { locationCode: 'TR-A-02', zone: '中转仓货架区', status: '已绑定', bindProductionNo: 'PO14956', skuCount: 1, materialQty: 1, capacity: 19, lastBindTime: '2026-07-13 14:10', lastReleaseTime: '—' },
  { locationCode: 'TR-A-03', zone: '中转仓货架区', status: '已绑定', bindProductionNo: 'PO14958', skuCount: 1, materialQty: 1, capacity: 19, lastBindTime: '2026-07-12 17:10', lastReleaseTime: '—' },
  { locationCode: 'TR-A-04', zone: '中转仓货架区', status: '已绑定', bindProductionNo: 'PO14963', skuCount: 1, materialQty: 1, capacity: 19, lastBindTime: '2026-07-15 16:20', lastReleaseTime: '—' },
  { locationCode: 'TR-A-05', zone: '中转仓货架区', status: '已绑定', bindProductionNo: 'PO14964', skuCount: 1, materialQty: 1, capacity: 19, lastBindTime: '2026-07-15 16:45', lastReleaseTime: '—' },
  ...Array.from({ length: 10 }, (_, i) => ({
    locationCode: `TR-B-${String(i + 1).padStart(2, '0')}`, zone: '中转仓货架区', status: '空闲',
    bindProductionNo: '—', skuCount: 0, materialQty: 0, capacity: 20,
    lastBindTime: '—', lastReleaseTime: '—',
  })),
]

export function renderTransitLocation(_state: AppState): string {
  const bound = seedLocations.filter(l => l.status === '已绑定').length
  const empty = seedLocations.filter(l => l.status === '空闲').length
  const totalQty = seedLocations.reduce((s, l) => s + l.materialQty, 0)

  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-slate-800">中转仓 · 库位管理</h1>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">库位总数</div><div class="text-2xl font-bold text-slate-800 mt-1">${seedLocations.length}</div></div>
      <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">已绑定</div><div class="text-2xl font-bold text-blue-600 mt-1">${bound}</div></div>
      <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">空闲</div><div class="text-2xl font-bold text-emerald-600 mt-1">${empty}</div></div>
      <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">库存总量</div><div class="text-2xl font-bold text-slate-800 mt-1">${totalQty}</div></div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedLocations.length} 个库位</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1080px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">库位编号</th>
            <th class="px-3 py-2 text-left font-medium">所属库区</th>
            <th class="px-3 py-2 text-left font-medium">库位状态</th>
            <th class="px-3 py-2 text-left font-medium">绑定生产单</th>
            <th class="px-3 py-2 text-right font-medium">SKU数</th>
            <th class="px-3 py-2 text-right font-medium">库存数量</th>
            <th class="px-3 py-2 text-right font-medium">可用容量</th>
            <th class="px-3 py-2 text-left font-medium">最后绑定</th>
            <th class="px-3 py-2 text-left font-medium">最后释放</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody>
            ${seedLocations.map(l => `
              <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-3 py-2 font-mono text-xs text-slate-700 font-medium">${l.locationCode}</td>
                <td class="px-3 py-2 text-slate-500 text-xs">${l.zone}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${statusClass[l.status]}">${l.status}</span></td>
                <td class="px-3 py-2 text-slate-600">${l.bindProductionNo}</td>
                <td class="px-3 py-2 text-right text-slate-600">${l.skuCount}</td>
                <td class="px-3 py-2 text-right text-slate-600">${l.materialQty}</td>
                <td class="px-3 py-2 text-right text-slate-600">${l.capacity}</td>
                <td class="px-3 py-2 text-xs text-slate-400">${l.lastBindTime}</td>
                <td class="px-3 py-2 text-xs text-slate-400">${l.lastReleaseTime}</td>
                <td class="px-3 py-2 sticky right-0 bg-white">
                  <div class="flex items-center gap-1">
                    <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 ${l.materialQty > 0 ? 'opacity-40 cursor-not-allowed' : ''}" ${l.materialQty > 0 ? 'disabled' : ''}>释放</button>
                    <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">禁用</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <script>window.__wlsTransitLocation = { init() {} }; window.__wlsTransitLocation.init();</script>`
}
