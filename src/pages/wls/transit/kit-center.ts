import type { AppState } from '../../../state/store'

type KitLine = {
  productionNo: string; receiveNo: string; inboundNo: string; sku: string; name: string
  requiredQty: number; workQty: number; shelfQty: number; availableQty: number
  missingQty: number; outboundQty: number; remainNeed: number
  receiveStatus: '缺货' | '未收齐' | '已收齐'; pickupStatus: string
}

const receiveStatusClass: Record<string, string> = {
  '缺货': 'bg-red-50 text-red-700', '未收齐': 'bg-amber-50 text-amber-700', '已收齐': 'bg-emerald-50 text-emerald-700',
}

const seedLines: KitLine[] = [
  { productionNo: 'PO14954', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-001', sku: 'FAB-PO14954-A', name: '主身面料', requiredQty: 6, workQty: 6, shelfQty: 0, availableQty: 6, missingQty: 0, outboundQty: 0, remainNeed: 6, receiveStatus: '已收齐', pickupStatus: '待领料' },
  { productionNo: 'PO14954', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-001', sku: 'ACC-PO14954-B', name: '辅料包', requiredQty: 2, workQty: 2, shelfQty: 0, availableQty: 2, missingQty: 0, outboundQty: 0, remainNeed: 2, receiveStatus: '已收齐', pickupStatus: '待领料' },
  { productionNo: 'PO14957', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-004', sku: 'FAB-PO14957-A', name: '主身面料', requiredQty: 5, workQty: 5, shelfQty: 0, availableQty: 5, missingQty: 0, outboundQty: 5, remainNeed: 0, receiveStatus: '已收齐', pickupStatus: '已领料' },
  { productionNo: 'PO14957', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-004', sku: 'ACC-PO14957-B', name: '辅料包', requiredQty: 2, workQty: 2, shelfQty: 0, availableQty: 2, missingQty: 0, outboundQty: 2, remainNeed: 0, receiveStatus: '已收齐', pickupStatus: '已领料' },
  { productionNo: 'PO14958', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-005', sku: 'FAB-PO14958-A', name: '主身面料', requiredQty: 7, workQty: 6, shelfQty: 1, availableQty: 7, missingQty: 0, outboundQty: 0, remainNeed: 7, receiveStatus: '未收齐', pickupStatus: '待领料' },
  { productionNo: 'PO14958', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-005', sku: 'ACC-PO14958-B', name: '辅料包', requiredQty: 2, workQty: 2, shelfQty: 0, availableQty: 2, missingQty: 0, outboundQty: 0, remainNeed: 2, receiveStatus: '已收齐', pickupStatus: '待领料' },
  { productionNo: 'PO14955', receiveNo: 'TR-RC-20260716-002', inboundNo: 'TR-IN-20260716-002', sku: 'FAB-PO14955-A', name: '主身面料', requiredQty: 8, workQty: 5, shelfQty: 0, availableQty: 5, missingQty: 3, outboundQty: 0, remainNeed: 8, receiveStatus: '未收齐', pickupStatus: '待领料' },
  { productionNo: 'PO14955', receiveNo: 'TR-RC-20260716-002', inboundNo: 'TR-IN-20260716-002', sku: 'ACC-PO14955-B', name: '辅料包', requiredQty: 3, workQty: 3, shelfQty: 0, availableQty: 3, missingQty: 0, outboundQty: 0, remainNeed: 3, receiveStatus: '已收齐', pickupStatus: '待领料' },
  { productionNo: 'PO14956', receiveNo: 'TR-RC-20260716-003', inboundNo: 'TR-IN-20260716-003', sku: 'FAB-PO14956-A', name: '主身面料', requiredQty: 10, workQty: 4, shelfQty: 0, availableQty: 4, missingQty: 6, outboundQty: 0, remainNeed: 10, receiveStatus: '缺货', pickupStatus: '待领料' },
  { productionNo: 'PO14956', receiveNo: 'TR-RC-20260716-003', inboundNo: 'TR-IN-20260716-003', sku: 'ACC-PO14956-B', name: '辅料包', requiredQty: 3, workQty: 1, shelfQty: 0, availableQty: 1, missingQty: 2, outboundQty: 0, remainNeed: 3, receiveStatus: '缺货', pickupStatus: '待领料' },
  { productionNo: 'PO14962', receiveNo: 'TR-RC-20260716-005', inboundNo: 'TR-IN-20260716-009', sku: 'FAB-PO14962-A', name: '主身面料', requiredQty: 6, workQty: 6, shelfQty: 0, availableQty: 6, missingQty: 0, outboundQty: 6, remainNeed: 0, receiveStatus: '已收齐', pickupStatus: '已领料' },
  { productionNo: 'PO14962', receiveNo: 'TR-RC-20260716-005', inboundNo: 'TR-IN-20260716-009', sku: 'ACC-PO14962-B', name: '辅料包', requiredQty: 2, workQty: 2, shelfQty: 0, availableQty: 2, missingQty: 0, outboundQty: 2, remainNeed: 0, receiveStatus: '已收齐', pickupStatus: '已领料' },
]

const productionNos = [...new Set(seedLines.map(l => l.productionNo))]

export function renderTransitKitCenter(_state: AppState): string {
  const statusCounts = { '缺货': 0, '未收齐': 0, '已收齐': 0 }
  seedLines.forEach(l => { statusCounts[l.receiveStatus as keyof typeof statusCounts]++ })

  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-slate-800">中转仓 · 齐套校验中心</h1>
      <button class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-40" disabled>批量确认已收齐</button>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="生产单号 / 收货单号 / SKU" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-72 focus:border-blue-400 focus:outline-none">
        <select class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">全部收货状态</option>
          <option value="SHORTAGE">缺货 (${statusCounts['缺货']})</option>
          <option value="PARTIAL">未收齐 (${statusCounts['未收齐']})</option>
          <option value="COMPLETE">已收齐 (${statusCounts['已收齐']})</option>
        </select>
        <button class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">查询</button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-1.5 text-xs text-slate-500"><input type="checkbox" class="rounded"> 全选</label>
          <span class="text-sm text-slate-500">共 ${productionNos.length} 个生产单 / ${seedLines.length} 条物料</span>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1480px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-2 py-2 w-8"></th>
            <th class="px-3 py-2 text-left font-medium">生产单号</th>
            <th class="px-3 py-2 text-left font-medium">收货单号</th>
            <th class="px-3 py-2 text-left font-medium">预入库单号</th>
            <th class="px-3 py-2 text-left font-medium">SKU</th>
            <th class="px-3 py-2 text-left font-medium">物料信息</th>
            <th class="px-3 py-2 text-right font-medium">原始需求</th>
            <th class="px-3 py-2 text-right font-medium">本批作业区</th>
            <th class="px-3 py-2 text-right font-medium">货架可用</th>
            <th class="px-3 py-2 text-right font-medium">合计可用</th>
            <th class="px-3 py-2 text-right font-medium">缺口数量</th>
            <th class="px-3 py-2 text-right font-medium">已出库</th>
            <th class="px-3 py-2 text-right font-medium">未出库</th>
            <th class="px-3 py-2 text-left font-medium">收货状态</th>
            <th class="px-3 py-2 text-left font-medium">领料状态</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody>
            ${seedLines.map(l => `
              <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-2 py-2 text-center"><input type="checkbox" class="rounded"></td>
                <td class="px-3 py-2 text-slate-700 font-medium">${l.productionNo}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-500">${l.receiveNo}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-500">${l.inboundNo}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-600">${l.sku}</td>
                <td class="px-3 py-2 text-slate-600">${l.name}</td>
                <td class="px-3 py-2 text-right text-slate-600">${l.requiredQty}</td>
                <td class="px-3 py-2 text-right text-slate-600">${l.workQty}</td>
                <td class="px-3 py-2 text-right text-slate-600">${l.shelfQty}</td>
                <td class="px-3 py-2 text-right text-slate-700 font-medium">${l.availableQty}</td>
                <td class="px-3 py-2 text-right ${l.missingQty > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}">${l.missingQty > 0 ? l.missingQty : '—'}</td>
                <td class="px-3 py-2 text-right text-slate-600">${l.outboundQty}</td>
                <td class="px-3 py-2 text-right text-slate-600">${l.remainNeed}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${receiveStatusClass[l.receiveStatus]}">${l.receiveStatus}</span></td>
                <td class="px-3 py-2 text-xs text-slate-500">${l.pickupStatus}</td>
                <td class="px-3 py-2 sticky right-0 bg-white">
                  <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">出入库详情</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <h3 class="text-sm font-semibold text-slate-700 mb-2">齐套校验逻辑</h3>
      <table class="w-full text-xs text-slate-600">
        <thead><tr class="bg-slate-50"><th class="px-3 py-2 text-left font-medium">场景</th><th class="px-3 py-2 text-left font-medium">判定规则</th></tr></thead>
        <tbody>
          <tr class="border-t border-slate-100"><td class="px-3 py-2">已配齐（DIRECT_KITTED）</td><td class="px-3 py-2">作业区数量已满足全部物料需求，可直接生成配料任务</td></tr>
          <tr class="border-t border-slate-100"><td class="px-3 py-2">已配齐需配货（COMBINABLE）</td><td class="px-3 py-2">本批+货架可用满足需求，但需从货架库位拣取补充</td></tr>
          <tr class="border-t border-slate-100"><td class="px-3 py-2">未配齐（NOT_KITTED）</td><td class="px-3 py-2">可用数量不足，先生成上架任务，等待后续到货补齐</td></tr>
          <tr class="border-t border-slate-100"><td class="px-3 py-2">缺货（SHORTAGE）</td><td class="px-3 py-2">实收数量为0，物料完全未到</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <script>window.__wlsTransitKit = { init() {} }; window.__wlsTransitKit.init();</script>`
}
