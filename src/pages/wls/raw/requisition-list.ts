// @page-pattern: list
import type { AppState } from '../../../state/store'

type RawRequisitionOrder = {
  id: string; outboundOrderNo: string; pickOrderNo: string; relatedOrderNo: string
  outboundType: string; outboundWarehouse: string; receivingUnit: string; requisitionMethod: string
  materialCategory: string; unit: string; plannedQty: string; stockStatus: string
  availableRatio: string; factoryConfirm: string; pickingStatus: string; pdVisible: string
  hasOutbound: string; pickedQty: string; owner: string; status: string; time: string
}

const stockStatusClass: Record<string, string> = {
  '库存充足': 'bg-emerald-50 text-emerald-700',
  '库存部分充足': 'bg-orange-50 text-orange-700',
  '库存不足': 'bg-red-50 text-red-700',
}

const factoryConfirmClass: Record<string, string> = {
  '工厂确认领取': 'bg-emerald-50 text-emerald-700',
  '待工厂确认': 'bg-orange-50 text-orange-700',
  '无需确认': 'bg-slate-100 text-slate-500',
  '工厂拒绝领取': 'bg-red-50 text-red-700',
}

const statusClass: Record<string, string> = {
  '待配料': 'bg-orange-50 text-orange-700',
  '配料中': 'bg-blue-50 text-blue-700',
  '待出库': 'bg-blue-50 text-blue-700',
  '部分出库': 'bg-blue-50 text-blue-700',
  '已出库': 'bg-emerald-50 text-emerald-700',
}

const categoryClass: Record<string, string> = {
  '面料': 'bg-indigo-50 text-indigo-700',
  '辅料': 'bg-teal-50 text-teal-700',
  '耗材': 'bg-amber-50 text-amber-700',
  '包材': 'bg-pink-50 text-pink-700',
  '纱线': 'bg-violet-50 text-violet-700',
}

const seedOrders: RawRequisitionOrder[] = [
  { id: 'PO-MAT-REQ-001', outboundOrderNo: 'YCK-MAT-REQ-20260520-001', pickOrderNo: 'JHD-MAT-REQ-20260520-001', relatedOrderNo: 'YL-MAT-REQ-20260520-001', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-面料仓', receivingUnit: '生产车间A', requisitionMethod: '工厂到仓自提', materialCategory: '面料', unit: '米', plannedQty: '80 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '配料完成', pdVisible: '是', hasOutbound: '是', pickedQty: '80 米', owner: '印尼万隆主体', status: '待出库', time: '2026-05-20 09:10' },
  { id: 'PO-MAT-REQ-002', outboundOrderNo: 'YCK-MAT-REQ-20260521-002', pickOrderNo: 'JHD-MAT-REQ-20260521-002', relatedOrderNo: 'YL-MAT-REQ-20260521-002', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-面料仓', receivingUnit: '生产车间B', requisitionMethod: '仓库配送到厂', materialCategory: '面料', unit: '米', plannedQty: '160 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '待工厂确认', pickingStatus: '配料中', pdVisible: '是', hasOutbound: '否', pickedQty: '80 米', owner: '印尼万隆主体', status: '配料中', time: '2026-05-21 09:20' },
  { id: 'PO-MAT-REQ-003', outboundOrderNo: 'YCK-MAT-REQ-20260522-003', pickOrderNo: 'JHD-MAT-REQ-20260522-003', relatedOrderNo: 'YL-MAT-REQ-20260522-003', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-辅料仓', receivingUnit: '生产车间A', requisitionMethod: '工厂到仓自提', materialCategory: '辅料', unit: '颗', plannedQty: '2000 颗', stockStatus: '库存部分充足', availableRatio: '72%', factoryConfirm: '无需确认', pickingStatus: '草稿', pdVisible: '否', hasOutbound: '否', pickedQty: '0 颗', owner: '雅加达电商主体', status: '待配料', time: '2026-05-22 09:30' },
  { id: 'PO-MAT-REQ-004', outboundOrderNo: 'YCK-MAT-REQ-20260523-004', pickOrderNo: 'JHD-MAT-REQ-20260523-004', relatedOrderNo: 'YL-MAT-REQ-20260523-004', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-辅料仓', receivingUnit: '生产车间C', requisitionMethod: '仓库配送到厂', materialCategory: '辅料', unit: '颗', plannedQty: '3000 颗', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '配料完成', pdVisible: '是', hasOutbound: '是', pickedQty: '3000 颗', owner: '印尼万隆主体', status: '已出库', time: '2026-05-23 09:40' },
  { id: 'PO-MAT-REQ-005', outboundOrderNo: 'YCK-MAT-REQ-20260524-005', pickOrderNo: 'JHD-MAT-REQ-20260524-005', relatedOrderNo: 'YL-MAT-REQ-20260524-005', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-耗材仓', receivingUnit: '生产车间B', requisitionMethod: '工厂到仓自提', materialCategory: '耗材', unit: '个', plannedQty: '480 个', stockStatus: '库存不足', availableRatio: '35%', factoryConfirm: '待工厂确认', pickingStatus: '草稿', pdVisible: '否', hasOutbound: '否', pickedQty: '0 个', owner: '印尼万隆主体', status: '待配料', time: '2026-05-24 09:50' },
  { id: 'PO-MAT-REQ-006', outboundOrderNo: 'YCK-MAT-REQ-20260525-006', pickOrderNo: 'JHD-MAT-REQ-20260525-006', relatedOrderNo: 'YL-MAT-REQ-20260525-006', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-包材仓', receivingUnit: '生产车间D', requisitionMethod: '仓库配送到厂', materialCategory: '包材', unit: '个', plannedQty: '1200 个', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '无需确认', pickingStatus: '配料完成', pdVisible: '是', hasOutbound: '是', pickedQty: '1200 个', owner: '雅加达电商主体', status: '部分出库', time: '2026-05-25 10:00' },
  { id: 'PO-MAT-REQ-007', outboundOrderNo: 'YCK-MAT-REQ-20260526-007', pickOrderNo: 'JHD-MAT-REQ-20260526-007', relatedOrderNo: 'YL-MAT-REQ-20260526-007', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-面料仓', receivingUnit: '生产车间A', requisitionMethod: '工厂到仓自提', materialCategory: '面料', unit: '米', plannedQty: '240 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '配料完成', pdVisible: '是', hasOutbound: '是', pickedQty: '240 米', owner: '印尼万隆主体', status: '已出库', time: '2026-05-26 10:10' },
  { id: 'PO-MAT-REQ-008', outboundOrderNo: 'YCK-MAT-REQ-20260527-008', pickOrderNo: 'JHD-MAT-REQ-20260527-008', relatedOrderNo: 'YL-MAT-REQ-20260527-008', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-纱线仓', receivingUnit: '生产车间C', requisitionMethod: '仓库配送到厂', materialCategory: '纱线', unit: '米', plannedQty: '500 米', stockStatus: '库存部分充足', availableRatio: '60%', factoryConfirm: '待工厂确认', pickingStatus: '草稿', pdVisible: '否', hasOutbound: '否', pickedQty: '0 米', owner: '印尼万隆主体', status: '待配料', time: '2026-05-27 10:20' },
  { id: 'PO-MAT-REQ-901', outboundOrderNo: 'YCK-MAT-REQ-20260528-901', pickOrderNo: 'JHD-MAT-REQ-20260528-901', relatedOrderNo: 'YL-MAT-REQ-20260528-901', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-面料仓', receivingUnit: '生产车间B', requisitionMethod: '工厂到仓自提', materialCategory: '面料', unit: '米', plannedQty: '320 米', stockStatus: '库存不足', availableRatio: '25%', factoryConfirm: '工厂拒绝领取', pickingStatus: '草稿', pdVisible: '否', hasOutbound: '否', pickedQty: '0 米', owner: '雅加达电商主体', status: '待配料', time: '2026-05-28 10:30' },
  { id: 'PO-MAT-REQ-902', outboundOrderNo: 'YCK-MAT-REQ-20260528-902', pickOrderNo: 'JHD-MAT-REQ-20260528-902', relatedOrderNo: 'YL-MAT-REQ-20260528-902', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-面料仓', receivingUnit: '生产车间A', requisitionMethod: '仓库配送到厂', materialCategory: '面料', unit: '米', plannedQty: '160 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '配料完成', pdVisible: '是', hasOutbound: '是', pickedQty: '80 米', owner: '印尼万隆主体', status: '部分出库', time: '2026-05-28 10:40' },
]

export function renderRawRequisitionList(_state: AppState): string {
  const statusCounts: Record<string, number> = {}
  seedOrders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1 })

  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-slate-800">原料领料单列表</h1>
        <p class="text-sm text-slate-500 mt-0.5">用于查看出库前置单据，包含单号、商品、收货单位、货主与时间的信息。</p>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input id="wlsRawReqKeyword" type="text" placeholder="搜索出库单号 / 复核单号 / 配料单号 / 关联单号 / 状态" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-96 focus:border-blue-400 focus:outline-none">
        <div id="wlsRawReqPills" class="flex items-center gap-1.5">
          <button data-status="待配料" class="wls-req-pill rounded-full px-3 py-1 text-xs bg-orange-50 text-orange-700 border border-orange-200">待配料(${statusCounts['待配料'] || 0})</button>
          <button data-status="配料中" class="wls-req-pill rounded-full px-3 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200">配料中(${statusCounts['配料中'] || 0})</button>
          <button data-status="待出库" class="wls-req-pill rounded-full px-3 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200">待出库(${statusCounts['待出库'] || 0})</button>
          <button data-status="部分出库" class="wls-req-pill rounded-full px-3 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200">部分出库(${statusCounts['部分出库'] || 0})</button>
          <button data-status="已出库" class="wls-req-pill rounded-full px-3 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">已出库(${statusCounts['已出库'] || 0})</button>
        </div>
        <button id="wlsRawReqReset" class="rounded-lg bg-slate-100 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200">重置</button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedOrders.length} 条记录</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1680px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">单号</th>
            <th class="px-3 py-2 text-left font-medium">领料单类型</th>
            <th class="px-3 py-2 text-left font-medium">出库仓库</th>
            <th class="px-3 py-2 text-left font-medium">收货单位</th>
            <th class="px-3 py-2 text-left font-medium">领料方式</th>
            <th class="px-3 py-2 text-right font-medium">计划领料数量</th>
            <th class="px-3 py-2 text-left font-medium">库存状态</th>
            <th class="px-3 py-2 text-right font-medium">整单可配比例</th>
            <th class="px-3 py-2 text-left font-medium">工厂确认状态</th>
            <th class="px-3 py-2 text-left font-medium">配料单状态</th>
            <th class="px-3 py-2 text-right font-medium">已配料数量</th>
            <th class="px-3 py-2 text-left font-medium">货主</th>
            <th class="px-3 py-2 text-left font-medium">状态</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody id="wlsRawReqTbody">
            ${seedOrders.map(o => `
              <tr class="border-t border-slate-100 hover:bg-slate-50 wls-req-row" data-status="${o.status}">
                <td class="px-3 py-2">
                  <div class="text-slate-700 font-mono text-xs">${o.outboundOrderNo}</div>
                  <div class="text-slate-400 font-mono text-xs">${o.pickOrderNo}</div>
                  <div class="text-slate-400 font-mono text-xs">${o.relatedOrderNo}</div>
                </td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${categoryClass[o.materialCategory] || 'bg-slate-100 text-slate-600'}">${o.materialCategory}</span></td>
                <td class="px-3 py-2 text-slate-600">${o.outboundWarehouse}</td>
                <td class="px-3 py-2 text-slate-600">${o.receivingUnit}</td>
                <td class="px-3 py-2 text-slate-500">${o.requisitionMethod}</td>
                <td class="px-3 py-2 text-right text-slate-700 font-medium">${o.plannedQty}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${stockStatusClass[o.stockStatus] || 'bg-slate-100 text-slate-500'}">${o.stockStatus}</span></td>
                <td class="px-3 py-2 text-right text-slate-600">${o.availableRatio}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${factoryConfirmClass[o.factoryConfirm] || 'bg-slate-100 text-slate-500'}">${o.factoryConfirm}</span></td>
                <td class="px-3 py-2 text-slate-500">${o.pickingStatus}</td>
                <td class="px-3 py-2 text-right text-slate-600">${o.pickedQty}</td>
                <td class="px-3 py-2 text-slate-600">${o.owner}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${statusClass[o.status] || 'bg-slate-100 text-slate-500'}">${o.status}</span></td>
                <td class="px-3 py-2 sticky right-0 bg-white">
                  <button class="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">查看</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <script>
    window.__wlsRawRequisition = {
      activeStatus: null,
      init() {
        const self = this;
        document.querySelectorAll('.wls-req-pill').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var st = btn.getAttribute('data-status');
            if (self.activeStatus === st) {
              self.activeStatus = null;
              btn.classList.remove('ring-2', 'ring-blue-400');
            } else {
              self.activeStatus = st;
              document.querySelectorAll('.wls-req-pill').forEach(function(b) { b.classList.remove('ring-2', 'ring-blue-400'); });
              btn.classList.add('ring-2', 'ring-blue-400');
            }
            self.filter();
          });
        });
        var resetBtn = document.getElementById('wlsRawReqReset');
        if (resetBtn) resetBtn.addEventListener('click', function() {
          self.activeStatus = null;
          document.querySelectorAll('.wls-req-pill').forEach(function(b) { b.classList.remove('ring-2', 'ring-blue-400'); });
          var kw = document.getElementById('wlsRawReqKeyword');
          if (kw) kw.value = '';
          self.filter();
        });
        var kwInput = document.getElementById('wlsRawReqKeyword');
        if (kwInput) kwInput.addEventListener('input', function() { self.filter(); });
      },
      filter() {
        var keyword = (document.getElementById('wlsRawReqKeyword') || {}).value || '';
        var kw = keyword.toLowerCase();
        var active = this.activeStatus;
        document.querySelectorAll('.wls-req-row').forEach(function(row) {
          var text = row.textContent.toLowerCase();
          var matchKw = !kw || text.indexOf(kw) !== -1;
          var matchSt = !active || row.getAttribute('data-status') === active;
          row.style.display = matchKw && matchSt ? '' : 'none';
        });
      }
    };
    window.__wlsRawRequisition.init();
  </script>`
}
