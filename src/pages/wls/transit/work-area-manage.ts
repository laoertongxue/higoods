import type { AppState } from '../../../state/store'

type WorkAreaRow = {
  inboundNo: string; productionNo: string; sourceNo: string; sku: string; name: string
  receivedQty: number; allocatedQty: number; putawayQty: number; outboundQty: number
  exceptionQty: number; remainQty: number; flowStatus: string; clearStatus: '已清空' | '未清空'
}

const seedRows: WorkAreaRow[] = [
  { inboundNo: 'TR-IN-20260716-001', productionNo: 'PO14954', sourceNo: 'TR-RC-20260716-001', sku: 'FAB-PO14954-A', name: '主身面料', receivedQty: 6, allocatedQty: 0, putawayQty: 0, outboundQty: 0, exceptionQty: 0, remainQty: 6, flowStatus: '待上架', clearStatus: '未清空' },
  { inboundNo: 'TR-IN-20260716-001', productionNo: 'PO14954', sourceNo: 'TR-RC-20260716-001', sku: 'ACC-PO14954-B', name: '辅料包', receivedQty: 2, allocatedQty: 0, putawayQty: 0, outboundQty: 0, exceptionQty: 0, remainQty: 2, flowStatus: '待上架', clearStatus: '未清空' },
  { inboundNo: 'TR-IN-20260716-004', productionNo: 'PO14957', sourceNo: 'TR-RC-20260716-001', sku: 'FAB-PO14957-A', name: '主身面料', receivedQty: 5, allocatedQty: 5, putawayQty: 0, outboundQty: 5, exceptionQty: 0, remainQty: 0, flowStatus: '已出库', clearStatus: '已清空' },
  { inboundNo: 'TR-IN-20260716-004', productionNo: 'PO14957', sourceNo: 'TR-RC-20260716-001', sku: 'ACC-PO14957-B', name: '辅料包', receivedQty: 2, allocatedQty: 2, putawayQty: 0, outboundQty: 2, exceptionQty: 0, remainQty: 0, flowStatus: '已出库', clearStatus: '已清空' },
  { inboundNo: 'TR-IN-20260716-005', productionNo: 'PO14958', sourceNo: 'TR-RC-20260716-001', sku: 'FAB-PO14958-A', name: '主身面料', receivedQty: 6, allocatedQty: 0, putawayQty: 0, outboundQty: 0, exceptionQty: 0, remainQty: 6, flowStatus: '待出库', clearStatus: '未清空' },
  { inboundNo: 'TR-IN-20260716-005', productionNo: 'PO14958', sourceNo: 'TR-RC-20260716-001', sku: 'ACC-PO14958-B', name: '辅料包', receivedQty: 2, allocatedQty: 0, putawayQty: 0, outboundQty: 0, exceptionQty: 0, remainQty: 2, flowStatus: '待出库', clearStatus: '未清空' },
  { inboundNo: 'TR-IN-20260716-002', productionNo: 'PO14955', sourceNo: 'TR-RC-20260716-002', sku: 'FAB-PO14955-A', name: '主身面料', receivedQty: 5, allocatedQty: 0, putawayQty: 0, outboundQty: 0, exceptionQty: 0, remainQty: 5, flowStatus: '待上架', clearStatus: '未清空' },
  { inboundNo: 'TR-IN-20260716-002', productionNo: 'PO14955', sourceNo: 'TR-RC-20260716-002', sku: 'ACC-PO14955-B', name: '辅料包', receivedQty: 3, allocatedQty: 0, putawayQty: 0, outboundQty: 0, exceptionQty: 0, remainQty: 3, flowStatus: '待上架', clearStatus: '未清空' },
  { inboundNo: 'TR-IN-20260716-003', productionNo: 'PO14956', sourceNo: 'TR-RC-20260716-003', sku: 'FAB-PO14956-A', name: '主身面料', receivedQty: 4, allocatedQty: 0, putawayQty: 0, outboundQty: 0, exceptionQty: 0, remainQty: 4, flowStatus: '待上架', clearStatus: '未清空' },
  { inboundNo: 'TR-IN-20260716-009', productionNo: 'PO14962', sourceNo: 'TR-RC-20260716-005', sku: 'FAB-PO14962-A', name: '主身面料', receivedQty: 6, allocatedQty: 6, putawayQty: 0, outboundQty: 6, exceptionQty: 0, remainQty: 0, flowStatus: '已出库', clearStatus: '已清空' },
]

const flowStatusClass: Record<string, string> = {
  '已出库': 'bg-emerald-50 text-emerald-700', '待出库': 'bg-orange-50 text-orange-700',
  '已上架': 'bg-blue-50 text-blue-700', '待上架': 'bg-amber-50 text-amber-700', '-': 'bg-slate-100 text-slate-400',
}

export function renderTransitWorkAreaManage(_state: AppState): string {
  const totalRemain = seedRows.reduce((s, r) => s + r.remainQty, 0)
  const cleared = seedRows.filter(r => r.clearStatus === '已清空').length

  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-slate-800">中转仓 · 作业区管理</h1>
      <div class="flex items-center gap-3 text-xs text-slate-500">
        <span>作业区剩余总量: <strong class="text-slate-700">${totalRemain}</strong></span>
        <span>已清空: <strong class="text-emerald-600">${cleared}</strong> / ${seedRows.length}</span>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedRows.length} 条物料记录</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1360px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">入库单号</th>
            <th class="px-3 py-2 text-left font-medium">需求单</th>
            <th class="px-3 py-2 text-left font-medium">来源单</th>
            <th class="px-3 py-2 text-left font-medium">SKU</th>
            <th class="px-3 py-2 text-right font-medium">收货数量</th>
            <th class="px-3 py-2 text-right font-medium">已配料</th>
            <th class="px-3 py-2 text-right font-medium">已上架</th>
            <th class="px-3 py-2 text-right font-medium">已出库</th>
            <th class="px-3 py-2 text-right font-medium">异常暂存</th>
            <th class="px-3 py-2 text-right font-medium">作业区剩余</th>
            <th class="px-3 py-2 text-left font-medium">状态</th>
            <th class="px-3 py-2 text-left font-medium">清空状态</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody>
            ${seedRows.map(r => `
              <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-3 py-2 font-mono text-xs text-slate-600">${r.inboundNo}</td>
                <td class="px-3 py-2 text-slate-700">${r.productionNo}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-500">${r.sourceNo}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-600">${r.sku}</td>
                <td class="px-3 py-2 text-right text-slate-600">${r.receivedQty}</td>
                <td class="px-3 py-2 text-right text-slate-600">${r.allocatedQty}</td>
                <td class="px-3 py-2 text-right text-slate-600">${r.putawayQty}</td>
                <td class="px-3 py-2 text-right text-slate-600">${r.outboundQty}</td>
                <td class="px-3 py-2 text-right ${r.exceptionQty > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}">${r.exceptionQty > 0 ? r.exceptionQty : '—'}</td>
                <td class="px-3 py-2 text-right font-medium ${r.remainQty > 0 ? 'text-orange-600' : 'text-slate-400'}">${r.remainQty}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${flowStatusClass[r.flowStatus] || flowStatusClass['-']}">${r.flowStatus}</span></td>
                <td class="px-3 py-2"><span class="text-xs ${r.clearStatus === '已清空' ? 'text-emerald-600' : 'text-orange-600'}">${r.clearStatus}</span></td>
                <td class="px-3 py-2 sticky right-0 bg-white">
                  <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">查看去向</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <script>window.__wlsTransitWorkArea = { init() {} }; window.__wlsTransitWorkArea.init();</script>`
}
