import type { AppState } from '../../../state/store'

type OutboundRow = {
  outboundNo: string; taskNo: string; productionNo: string; sku: string; name: string
  processorName: string; outboundType: string; cutterReceived: boolean; allocationDone: boolean
  plannedQty: number; allocatedQty: number; actualOutboundQty: number
  sourceArea: string; outboundStatus: '已完成' | '待出库'
}

const seedRows: OutboundRow[] = [
  { outboundNo: 'TR-OUT-20260716-001', taskNo: 'TR-AL-20260716-004', productionNo: 'PO14957', sku: 'FAB-PO14957-A', name: '主身面料', processorName: '自有工厂A组', outboundType: '齐套出库', cutterReceived: true, allocationDone: true, plannedQty: 5, allocatedQty: 5, actualOutboundQty: 5, sourceArea: '货架库位', outboundStatus: '已完成' },
  { outboundNo: 'TR-OUT-20260716-001', taskNo: 'TR-AL-20260716-004', productionNo: 'PO14957', sku: 'ACC-PO14957-B', name: '辅料包', processorName: '自有工厂A组', outboundType: '齐套出库', cutterReceived: true, allocationDone: true, plannedQty: 2, allocatedQty: 2, actualOutboundQty: 2, sourceArea: '货架库位', outboundStatus: '已完成' },
  { outboundNo: 'TR-OUT-20260716-002', taskNo: 'TR-AL-20260716-009', productionNo: 'PO14962', sku: 'FAB-PO14962-A', name: '主身面料', processorName: '自有工厂D组', outboundType: '齐套出库', cutterReceived: true, allocationDone: true, plannedQty: 6, allocatedQty: 6, actualOutboundQty: 6, sourceArea: '货架库位', outboundStatus: '已完成' },
  { outboundNo: 'TR-OUT-20260716-002', taskNo: 'TR-AL-20260716-009', productionNo: 'PO14962', sku: 'ACC-PO14962-B', name: '辅料包', processorName: '自有工厂D组', outboundType: '齐套出库', cutterReceived: true, allocationDone: true, plannedQty: 2, allocatedQty: 2, actualOutboundQty: 2, sourceArea: '货架库位', outboundStatus: '已完成' },
  { outboundNo: '—', taskNo: 'TR-AL-20260716-001', productionNo: 'PO14954', sku: 'FAB-PO14954-A', name: '主身面料', processorName: '自有工厂A组', outboundType: '齐套出库', cutterReceived: false, allocationDone: false, plannedQty: 6, allocatedQty: 0, actualOutboundQty: 0, sourceArea: '待领料区/隔离区', outboundStatus: '待出库' },
  { outboundNo: '—', taskNo: 'TR-AL-20260716-001', productionNo: 'PO14954', sku: 'ACC-PO14954-B', name: '辅料包', processorName: '自有工厂A组', outboundType: '齐套出库', cutterReceived: false, allocationDone: false, plannedQty: 2, allocatedQty: 0, actualOutboundQty: 0, sourceArea: '待领料区/隔离区', outboundStatus: '待出库' },
  { outboundNo: '—', taskNo: 'TR-AL-20260716-005', productionNo: 'PO14958', sku: 'FAB-PO14958-A', name: '主身面料', processorName: '第三方工厂-恒盛', outboundType: '自有工厂部分出库', cutterReceived: false, allocationDone: false, plannedQty: 7, allocatedQty: 0, actualOutboundQty: 0, sourceArea: '待领料区/隔离区', outboundStatus: '待出库' },
  { outboundNo: '—', taskNo: 'TR-AL-20260716-010', productionNo: 'PO14963', sku: 'FAB-PO14963-A', name: '主身面料', processorName: '自有工厂D组', outboundType: '自有工厂部分出库', cutterReceived: false, allocationDone: false, plannedQty: 7, allocatedQty: 0, actualOutboundQty: 0, sourceArea: '待领料区/隔离区', outboundStatus: '待出库' },
]

export function renderTransitOutboundManage(_state: AppState): string {
  const completed = seedRows.filter(r => r.outboundStatus === '已完成').length
  const pending = seedRows.filter(r => r.outboundStatus === '待出库').length

  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-slate-800">中转仓 · 出库单管理</h1>
      <div class="flex items-center gap-3 text-xs text-slate-500">
        <span>已完成: <strong class="text-emerald-600">${completed}</strong></span>
        <span>待出库: <strong class="text-orange-600">${pending}</strong></span>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedRows.length} 条出库记录</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1540px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">出库单号</th>
            <th class="px-3 py-2 text-left font-medium">配料单</th>
            <th class="px-3 py-2 text-left font-medium">生产单号</th>
            <th class="px-3 py-2 text-left font-medium">SKU</th>
            <th class="px-3 py-2 text-left font-medium">物料名称</th>
            <th class="px-3 py-2 text-left font-medium">加工方</th>
            <th class="px-3 py-2 text-left font-medium">出库类型</th>
            <th class="px-3 py-2 text-left font-medium">裁厂接收</th>
            <th class="px-3 py-2 text-left font-medium">配料状态</th>
            <th class="px-3 py-2 text-right font-medium">计划出库</th>
            <th class="px-3 py-2 text-right font-medium">配料数量</th>
            <th class="px-3 py-2 text-right font-medium">实际出库</th>
            <th class="px-3 py-2 text-left font-medium">来源区域</th>
            <th class="px-3 py-2 text-left font-medium">出库状态</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody>
            ${seedRows.map(r => {
              const canConfirm = r.cutterReceived && r.allocationDone && r.outboundStatus === '待出库'
              return `
              <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-3 py-2 font-mono text-xs ${r.outboundNo !== '—' ? 'text-blue-600' : 'text-slate-400'}">${r.outboundNo}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-500">${r.taskNo}</td>
                <td class="px-3 py-2 text-slate-700">${r.productionNo}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-600">${r.sku}</td>
                <td class="px-3 py-2 text-slate-600">${r.name}</td>
                <td class="px-3 py-2 text-slate-600">${r.processorName}</td>
                <td class="px-3 py-2 text-xs text-slate-500">${r.outboundType}</td>
                <td class="px-3 py-2 text-xs ${r.cutterReceived ? 'text-emerald-600' : 'text-slate-400'}">${r.cutterReceived ? '已接收' : '未接收'}</td>
                <td class="px-3 py-2 text-xs ${r.allocationDone ? 'text-emerald-600' : 'text-orange-600'}">${r.allocationDone ? '已配料' : '待配料'}</td>
                <td class="px-3 py-2 text-right text-slate-600">${r.plannedQty}</td>
                <td class="px-3 py-2 text-right text-slate-600">${r.allocatedQty}</td>
                <td class="px-3 py-2 text-right font-medium ${r.actualOutboundQty > 0 ? 'text-emerald-600' : 'text-slate-400'}">${r.actualOutboundQty}</td>
                <td class="px-3 py-2 text-xs text-slate-500">${r.sourceArea}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${r.outboundStatus === '已完成' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}">${r.outboundStatus}</span></td>
                <td class="px-3 py-2 sticky right-0 bg-white">
                  ${canConfirm
                    ? '<button class="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">确认出库</button>'
                    : r.outboundStatus === '已完成'
                      ? '<span class="text-xs text-slate-400">已完成</span>'
                      : '<button class="rounded bg-blue-600 px-3 py-1 text-xs text-white opacity-40 cursor-not-allowed" disabled>确认出库</button>'}
                </td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <h3 class="text-sm font-semibold text-slate-700 mb-2">出库条件说明</h3>
      <table class="w-full text-xs text-slate-600">
        <thead><tr class="bg-slate-50"><th class="px-3 py-2 text-left font-medium">条件</th><th class="px-3 py-2 text-left font-medium">要求</th></tr></thead>
        <tbody>
          <tr class="border-t border-slate-100"><td class="px-3 py-2">裁厂接收</td><td class="px-3 py-2">裁床工厂已确认接收，方可执行出库</td></tr>
          <tr class="border-t border-slate-100"><td class="px-3 py-2">配料完成</td><td class="px-3 py-2">配料任务已完成，物料已备齐到作业区</td></tr>
          <tr class="border-t border-slate-100"><td class="px-3 py-2">齐套出库</td><td class="px-3 py-2">全部物料齐套后一次性出库给加工方</td></tr>
          <tr class="border-t border-slate-100"><td class="px-3 py-2">部分出库</td><td class="px-3 py-2">自有工厂允许部分物料先出库，需主管确认</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <script>window.__wlsTransitOutbound = { init() {} }; window.__wlsTransitOutbound.init();</script>`
}
