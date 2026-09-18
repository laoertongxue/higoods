import type { AppState } from '../../../state/store'

type PutawayTask = {
  taskNo: string; productionNo: string; receiveNo: string; inboundNo: string
  sku: string; pendingQty: number; recommendedLocation: string; recommendType: string
  taskStatus: '待上架' | '已上架'
}

const seedTasks: PutawayTask[] = [
  { taskNo: 'TR-PW-20260716-002', productionNo: 'PO14955', receiveNo: 'TR-RC-20260716-002', inboundNo: 'TR-IN-20260716-002', sku: 'FAB-PO14955-A', pendingQty: 5, recommendedLocation: 'TR-A-01', recommendType: '同生产单库位', taskStatus: '待上架' },
  { taskNo: 'TR-PW-20260716-003', productionNo: 'PO14956', receiveNo: 'TR-RC-20260716-003', inboundNo: 'TR-IN-20260716-003', sku: 'FAB-PO14956-A', pendingQty: 4, recommendedLocation: 'TR-A-02', recommendType: '同生产单库位', taskStatus: '待上架' },
  { taskNo: 'TR-PW-20260716-011', productionNo: 'PO14964', receiveNo: 'TR-RC-20260716-005', inboundNo: 'TR-IN-20260716-011', sku: 'FAB-PO14964-A', pendingQty: 4, recommendedLocation: 'TR-A-05', recommendType: '空闲库位', taskStatus: '待上架' },
  { taskNo: 'TR-PW-20260715-010', productionNo: 'PO14940', receiveNo: 'TR-RC-20260715-001', inboundNo: 'TR-IN-20260715-010', sku: 'FAB-PO14940-A', pendingQty: 0, recommendedLocation: 'TR-B-03', recommendType: '空闲库位', taskStatus: '已上架' },
]

export function renderTransitPutawayManage(_state: AppState): string {
  const pending = seedTasks.filter(t => t.taskStatus === '待上架').length
  const done = seedTasks.filter(t => t.taskStatus === '已上架').length

  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-slate-800">中转仓 · 上架任务管理</h1>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">上架任务总数</div><div class="text-2xl font-bold text-slate-800 mt-1">${seedTasks.length}</div></div>
      <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">待上架</div><div class="text-2xl font-bold text-orange-600 mt-1">${pending}</div></div>
      <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">已上架</div><div class="text-2xl font-bold text-emerald-600 mt-1">${done}</div></div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <select class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">全部任务状态</option><option>待上架</option><option>已上架</option><option>期间已上架</option>
        </select>
        <button class="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200">清除筛选</button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedTasks.length} 条上架任务</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1260px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">上架任务号</th>
            <th class="px-3 py-2 text-left font-medium">需求单</th>
            <th class="px-3 py-2 text-left font-medium">来源单</th>
            <th class="px-3 py-2 text-left font-medium">入库单号</th>
            <th class="px-3 py-2 text-left font-medium">SKU</th>
            <th class="px-3 py-2 text-right font-medium">待上架数量</th>
            <th class="px-3 py-2 text-left font-medium">推荐库位</th>
            <th class="px-3 py-2 text-left font-medium">推荐类型</th>
            <th class="px-3 py-2 text-left font-medium">任务状态</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody>
            ${seedTasks.map(t => `
              <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-3 py-2 font-mono text-xs text-blue-600">${t.taskNo}</td>
                <td class="px-3 py-2 text-slate-700">${t.productionNo}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-500">${t.receiveNo}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-500">${t.inboundNo}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-600">${t.sku}</td>
                <td class="px-3 py-2 text-right text-slate-700 font-medium">${t.pendingQty}</td>
                <td class="px-3 py-2"><span class="rounded bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-mono">${t.recommendedLocation}</span></td>
                <td class="px-3 py-2 text-xs text-slate-500">${t.recommendType}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${t.taskStatus === '已上架' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}">${t.taskStatus}</span></td>
                <td class="px-3 py-2 sticky right-0 bg-white">
                  ${t.taskStatus === '待上架'
                    ? '<button class="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">一键完成上架</button>'
                    : '<span class="text-xs text-slate-400">已完成</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <h3 class="text-sm font-semibold text-slate-700 mb-2">上架推荐逻辑</h3>
      <table class="w-full text-xs text-slate-600">
        <thead><tr class="bg-slate-50"><th class="px-3 py-2 text-left font-medium">推荐类型</th><th class="px-3 py-2 text-left font-medium">规则</th></tr></thead>
        <tbody>
          <tr class="border-t border-slate-100"><td class="px-3 py-2">同生产单库位</td><td class="px-3 py-2">该生产单已有绑定库位，优先推荐到同一库位集中存放</td></tr>
          <tr class="border-t border-slate-100"><td class="px-3 py-2">空闲库位</td><td class="px-3 py-2">无绑定库位时，按库区就近推荐一个空闲库位</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <script>window.__wlsTransitPutaway = { init() {} }; window.__wlsTransitPutaway.init();</script>`
}
