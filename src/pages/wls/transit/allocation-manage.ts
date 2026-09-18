import type { AppState } from '../../../state/store'

type AllocationOrder = {
  taskNo: string; productionNo: string; receiveNo: string; inboundNo: string
  processorName: string; kitMethod: string; skuCount: number; needLocationCount: number
  needQty: number; workAreaQty: number; shelfQty: number; warehouseQty: number
  allocationType: '已收齐配料' | '未收齐配料'; cutterReceiveStatus: '已接收' | '未接收'
  taskStatus: string; generatedTime: string
}

const seedOrders: AllocationOrder[] = [
  { taskNo: 'TR-AL-20260716-001', productionNo: 'PO14954', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-001', processorName: '自有工厂A组', kitMethod: '已配齐', skuCount: 2, needLocationCount: 0, needQty: 8, workAreaQty: 8, shelfQty: 0, warehouseQty: 8, allocationType: '已收齐配料', cutterReceiveStatus: '未接收', taskStatus: '待配齐', generatedTime: '2026-07-16 09:36' },
  { taskNo: 'TR-AL-20260716-004', productionNo: 'PO14957', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-004', processorName: '自有工厂A组', kitMethod: '已配齐', skuCount: 2, needLocationCount: 0, needQty: 0, workAreaQty: 0, shelfQty: 0, warehouseQty: 0, allocationType: '已收齐配料', cutterReceiveStatus: '已接收', taskStatus: '已配齐', generatedTime: '2026-07-16 09:39' },
  { taskNo: 'TR-AL-20260716-005', productionNo: 'PO14958', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-005', processorName: '第三方工厂-恒盛', kitMethod: '已配齐（需配货）', skuCount: 2, needLocationCount: 1, needQty: 1, workAreaQty: 8, shelfQty: 1, warehouseQty: 9, allocationType: '未收齐配料', cutterReceiveStatus: '未接收', taskStatus: '待配齐', generatedTime: '2026-07-16 09:43' },
  { taskNo: 'TR-AL-20260716-009', productionNo: 'PO14962', receiveNo: 'TR-RC-20260716-005', inboundNo: 'TR-IN-20260716-009', processorName: '自有工厂D组', kitMethod: '已配齐', skuCount: 2, needLocationCount: 0, needQty: 0, workAreaQty: 0, shelfQty: 0, warehouseQty: 0, allocationType: '已收齐配料', cutterReceiveStatus: '已接收', taskStatus: '已配齐', generatedTime: '2026-07-16 15:06' },
  { taskNo: 'TR-AL-20260716-010', productionNo: 'PO14963', receiveNo: 'TR-RC-20260716-005', inboundNo: 'TR-IN-20260716-010', processorName: '自有工厂D组', kitMethod: '已配齐（需配货）', skuCount: 2, needLocationCount: 1, needQty: 1, workAreaQty: 8, shelfQty: 1, warehouseQty: 9, allocationType: '未收齐配料', cutterReceiveStatus: '未接收', taskStatus: '待配齐', generatedTime: '2026-07-16 15:13' },
]

const typeClass: Record<string, string> = { '已收齐配料': 'bg-emerald-50 text-emerald-700', '未收齐配料': 'bg-amber-50 text-amber-700' }

export function renderTransitAllocationManage(_state: AppState): string {
  const waitPrint = seedOrders.filter(o => o.taskStatus === '待配齐').length
  const directKit = seedOrders.filter(o => o.kitMethod === '已配齐').length
  const combinedKit = seedOrders.filter(o => o.kitMethod === '已配齐（需配货）').length
  const totalNeed = seedOrders.reduce((s, o) => s + o.needQty, 0)

  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-slate-800">中转仓 · 配料任务管理</h1>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">配料任务数</div><div class="text-2xl font-bold text-slate-800 mt-1">${seedOrders.length}</div></div>
      <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">待打印</div><div class="text-2xl font-bold text-orange-600 mt-1">${waitPrint}</div></div>
      <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">已配齐</div><div class="text-2xl font-bold text-emerald-600 mt-1">${directKit}</div></div>
      <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">已配齐需配货</div><div class="text-2xl font-bold text-indigo-600 mt-1">${combinedKit}</div></div>
      <div class="rounded-xl border border-slate-200 bg-white p-4"><div class="text-xs text-slate-500">应取总数</div><div class="text-2xl font-bold text-slate-800 mt-1">${totalNeed}</div></div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <select class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">全部配料类型</option><option>已收齐配料</option><option>未收齐配料</option>
        </select>
        <select class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">全部任务状态</option><option>待配齐</option><option>已配齐</option><option>期间已配齐</option>
        </select>
        <button class="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200">清除筛选</button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedOrders.length} 条配料任务</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1740px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">配料任务号</th>
            <th class="px-3 py-2 text-left font-medium">需求单</th>
            <th class="px-3 py-2 text-left font-medium">来源单</th>
            <th class="px-3 py-2 text-left font-medium">预入库单号</th>
            <th class="px-3 py-2 text-left font-medium">领料对象</th>
            <th class="px-3 py-2 text-left font-medium">齐套方式</th>
            <th class="px-3 py-2 text-right font-medium">本批SKU数</th>
            <th class="px-3 py-2 text-right font-medium">需取库位数</th>
            <th class="px-3 py-2 text-right font-medium">应取数量</th>
            <th class="px-3 py-2 text-right font-medium">作业区数量</th>
            <th class="px-3 py-2 text-right font-medium">货架数量</th>
            <th class="px-3 py-2 text-right font-medium">仓库已有</th>
            <th class="px-3 py-2 text-left font-medium">配料类型</th>
            <th class="px-3 py-2 text-left font-medium">裁厂接收</th>
            <th class="px-3 py-2 text-left font-medium">任务状态</th>
            <th class="px-3 py-2 text-left font-medium">生成时间</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody>
            ${seedOrders.map(o => `
              <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-3 py-2 font-mono text-xs text-blue-600">${o.taskNo}</td>
                <td class="px-3 py-2 text-slate-700">${o.productionNo}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-500">${o.receiveNo}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-500">${o.inboundNo}</td>
                <td class="px-3 py-2 text-slate-600">${o.processorName}</td>
                <td class="px-3 py-2 text-xs text-slate-600">${o.kitMethod}</td>
                <td class="px-3 py-2 text-right text-slate-600">${o.skuCount}</td>
                <td class="px-3 py-2 text-right text-slate-600">${o.needLocationCount}</td>
                <td class="px-3 py-2 text-right text-slate-700 font-medium">${o.needQty}</td>
                <td class="px-3 py-2 text-right text-slate-600">${o.workAreaQty}</td>
                <td class="px-3 py-2 text-right text-slate-600">${o.shelfQty}</td>
                <td class="px-3 py-2 text-right text-slate-600">${o.warehouseQty}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${typeClass[o.allocationType]}">${o.allocationType}</span></td>
                <td class="px-3 py-2 text-xs ${o.cutterReceiveStatus === '已接收' ? 'text-emerald-600' : 'text-slate-400'}">${o.cutterReceiveStatus}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${o.taskStatus === '已配齐' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}">${o.taskStatus}</span></td>
                <td class="px-3 py-2 text-slate-400 text-xs">${o.generatedTime}</td>
                <td class="px-3 py-2 sticky right-0 bg-white">
                  <div class="flex items-center gap-1">
                    ${o.cutterReceiveStatus === '未接收' ? '<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700">裁厂接收</button>' : ''}
                    <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">查看详情</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <script>window.__wlsTransitAllocation = { init() {} }; window.__wlsTransitAllocation.init();</script>`
}
