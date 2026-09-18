// @page-pattern: list
import type { AppState } from '../../../state/store'

type RawOutboundOrder = {
  id: string; outboundOrderNo: string; pickOrderNo: string; relatedOrderNo: string
  trackingNo: string; materialCategory: string; unit: string; outboundWarehouse: string
  outboundType: string; receivingUnit: string; requisitionMethod: string; plannedQty: string
  stockStatus: string; pickedQty: string; owner: string; status: string; time: string
}

const stockStatusClass: Record<string, string> = {
  '库存充足': 'bg-emerald-50 text-emerald-700',
  '库存部分充足': 'bg-orange-50 text-orange-700',
  '库存不足': 'bg-red-50 text-red-700',
}

const statusClass: Record<string, string> = {
  '待出库': 'bg-orange-50 text-orange-700',
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

const seedOutbounds: RawOutboundOrder[] = [
  { id: 'OB-FAB-001', outboundOrderNo: 'YCK-FAB-REQ-20260521-001', pickOrderNo: 'JHD-FAB-REQ-20260521-001', relatedOrderNo: 'YL-FAB-REQ-20260521-001', trackingNo: 'MATWB-FAB-001', materialCategory: '面料', unit: '米', outboundWarehouse: '中央总仓-面料仓', outboundType: '原料领料出库', receivingUnit: '生产车间A', requisitionMethod: '工厂到仓自提', plannedQty: '160 米', stockStatus: '库存充足', pickedQty: '160 米', owner: '印尼万隆主体', status: '待出库', time: '2026-05-21 14:20' },
  { id: 'OB-FAB-002', outboundOrderNo: 'YCK-FAB-REQ-20260522-002', pickOrderNo: 'JHD-FAB-REQ-20260522-002', relatedOrderNo: 'YL-FAB-REQ-20260522-002', trackingNo: 'MATWB-FAB-002', materialCategory: '面料', unit: '米', outboundWarehouse: '中央总仓-面料仓', outboundType: '原料领料出库', receivingUnit: '生产车间B', requisitionMethod: '仓库配送到厂', plannedQty: '240 米', stockStatus: '库存充足', pickedQty: '240 米', owner: '印尼万隆主体', status: '已出库', time: '2026-05-22 14:30' },
  { id: 'OB-TRM-001', outboundOrderNo: 'YCK-TRM-REQ-20260523-001', pickOrderNo: 'JHD-TRM-REQ-20260523-001', relatedOrderNo: 'YL-TRM-REQ-20260523-001', trackingNo: 'MATWB-TRM-001', materialCategory: '辅料', unit: '颗', outboundWarehouse: '中央总仓-辅料仓', outboundType: '原料领料出库', receivingUnit: '生产车间A', requisitionMethod: '工厂到仓自提', plannedQty: '3000 颗', stockStatus: '库存充足', pickedQty: '1500 颗', owner: '雅加达电商主体', status: '部分出库', time: '2026-05-23 14:40' },
  { id: 'OB-TRM-002', outboundOrderNo: 'YCK-TRM-REQ-20260524-002', pickOrderNo: 'JHD-TRM-REQ-20260524-002', relatedOrderNo: 'YL-TRM-REQ-20260524-002', trackingNo: 'MATWB-TRM-002', materialCategory: '辅料', unit: '颗', outboundWarehouse: '中央总仓-辅料仓', outboundType: '原料领料出库', receivingUnit: '生产车间C', requisitionMethod: '仓库配送到厂', plannedQty: '1500 颗', stockStatus: '库存充足', pickedQty: '1500 颗', owner: '印尼万隆主体', status: '已出库', time: '2026-05-24 14:50' },
  { id: 'OB-CON-001', outboundOrderNo: 'YCK-CON-REQ-20260525-001', pickOrderNo: 'JHD-CON-REQ-20260525-001', relatedOrderNo: 'YL-CON-REQ-20260525-001', trackingNo: 'MATWB-CON-001', materialCategory: '耗材', unit: '个', outboundWarehouse: '中央总仓-耗材仓', outboundType: '原料领料出库', receivingUnit: '生产车间B', requisitionMethod: '工厂到仓自提', plannedQty: '480 个', stockStatus: '库存不足', pickedQty: '0 个', owner: '印尼万隆主体', status: '待出库', time: '2026-05-25 15:00' },
  { id: 'OB-PKG-001', outboundOrderNo: 'YCK-PKG-REQ-20260526-001', pickOrderNo: 'JHD-PKG-REQ-20260526-001', relatedOrderNo: 'YL-PKG-REQ-20260526-001', trackingNo: 'MATWB-PKG-001', materialCategory: '包材', unit: '个', outboundWarehouse: '中央总仓-包材仓', outboundType: '原料领料出库', receivingUnit: '生产车间D', requisitionMethod: '仓库配送到厂', plannedQty: '2000 个', stockStatus: '库存充足', pickedQty: '2000 个', owner: '雅加达电商主体', status: '已出库', time: '2026-05-26 15:10' },
  { id: 'OB-YRN-001', outboundOrderNo: 'YCK-YRN-REQ-20260527-001', pickOrderNo: 'JHD-YRN-REQ-20260527-001', relatedOrderNo: 'YL-YRN-REQ-20260527-001', trackingNo: 'MATWB-YRN-001', materialCategory: '纱线', unit: '米', outboundWarehouse: '中央总仓-纱线仓', outboundType: '原料领料出库', receivingUnit: '生产车间A', requisitionMethod: '工厂到仓自提', plannedQty: '600 米', stockStatus: '库存部分充足', pickedQty: '360 米', owner: '印尼万隆主体', status: '部分出库', time: '2026-05-27 15:20' },
  { id: 'OB-FAB-003', outboundOrderNo: 'YCK-FAB-REQ-20260528-003', pickOrderNo: 'JHD-FAB-REQ-20260528-003', relatedOrderNo: 'YL-FAB-REQ-20260528-003', trackingNo: 'MATWB-FAB-003', materialCategory: '面料', unit: '米', outboundWarehouse: '中央总仓-面料仓', outboundType: '原料领料出库', receivingUnit: '生产车间C', requisitionMethod: '仓库配送到厂', plannedQty: '320 米', stockStatus: '库存充足', pickedQty: '0 米', owner: '印尼万隆主体', status: '待出库', time: '2026-05-28 15:30' },
]

export function renderRawOutboundList(_state: AppState): string {
  const statusCounts: Record<string, number> = {}
  seedOutbounds.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1 })

  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-slate-800">原料出库单列表</h1>
        <p class="text-sm text-slate-500 mt-0.5">用于查看出库执行信息，包含出库单号、商品、收货单位与出库进度。</p>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input id="wlsRawObKeyword" type="text" placeholder="搜索出库单号 / 配料单号 / 跟踪单号 / 状态" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-80 focus:border-blue-400 focus:outline-none">
        <div id="wlsRawObPills" class="flex items-center gap-1.5">
          <button data-status="待出库" class="wls-ob-pill rounded-full px-3 py-1 text-xs bg-orange-50 text-orange-700 border border-orange-200">待出库(${statusCounts['待出库'] || 0})</button>
          <button data-status="部分出库" class="wls-ob-pill rounded-full px-3 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200">部分出库(${statusCounts['部分出库'] || 0})</button>
          <button data-status="已出库" class="wls-ob-pill rounded-full px-3 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">已出库(${statusCounts['已出库'] || 0})</button>
        </div>
        <button id="wlsRawObReset" class="rounded-lg bg-slate-100 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200">重置</button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedOutbounds.length} 条记录</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1540px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">单号</th>
            <th class="px-3 py-2 text-left font-medium">出库单类型</th>
            <th class="px-3 py-2 text-left font-medium">出库仓库</th>
            <th class="px-3 py-2 text-left font-medium">出库类型</th>
            <th class="px-3 py-2 text-left font-medium">收货单位</th>
            <th class="px-3 py-2 text-left font-medium">领料方式</th>
            <th class="px-3 py-2 text-right font-medium">计划出库数量</th>
            <th class="px-3 py-2 text-left font-medium">库存状态</th>
            <th class="px-3 py-2 text-right font-medium">已配料数量</th>
            <th class="px-3 py-2 text-left font-medium">货主</th>
            <th class="px-3 py-2 text-left font-medium">状态</th>
            <th class="px-3 py-2 text-left font-medium">时间</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody id="wlsRawObTbody">
            ${seedOutbounds.map(o => `
              <tr class="border-t border-slate-100 hover:bg-slate-50 wls-ob-row" data-status="${o.status}">
                <td class="px-3 py-2">
                  <div class="text-slate-700 font-mono text-xs">${o.outboundOrderNo}</div>
                  <div class="text-slate-400 font-mono text-xs">${o.pickOrderNo}</div>
                  <div class="text-slate-400 font-mono text-xs">${o.trackingNo}</div>
                </td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${categoryClass[o.materialCategory] || 'bg-slate-100 text-slate-600'}">${o.materialCategory}</span></td>
                <td class="px-3 py-2 text-slate-600">${o.outboundWarehouse}</td>
                <td class="px-3 py-2 text-slate-500">${o.outboundType}</td>
                <td class="px-3 py-2 text-slate-600">${o.receivingUnit}</td>
                <td class="px-3 py-2 text-slate-500">${o.requisitionMethod}</td>
                <td class="px-3 py-2 text-right text-slate-700 font-medium">${o.plannedQty}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${stockStatusClass[o.stockStatus] || 'bg-slate-100 text-slate-500'}">${o.stockStatus}</span></td>
                <td class="px-3 py-2 text-right text-slate-600">${o.pickedQty}</td>
                <td class="px-3 py-2 text-slate-600">${o.owner}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${statusClass[o.status] || 'bg-slate-100 text-slate-500'}">${o.status}</span></td>
                <td class="px-3 py-2 text-slate-400 text-xs">${o.time}</td>
                <td class="px-3 py-2 sticky right-0 bg-white">
                  ${o.status === '待出库'
                    ? '<button class="rounded-lg bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">确认出库</button>'
                    : '<button class="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-400 cursor-not-allowed" disabled>确认出库</button>'
                  }
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <script>
    window.__wlsRawOutbound = {
      activeStatus: null,
      init() {
        var self = this;
        document.querySelectorAll('.wls-ob-pill').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var st = btn.getAttribute('data-status');
            if (self.activeStatus === st) {
              self.activeStatus = null;
              btn.classList.remove('ring-2', 'ring-blue-400');
            } else {
              self.activeStatus = st;
              document.querySelectorAll('.wls-ob-pill').forEach(function(b) { b.classList.remove('ring-2', 'ring-blue-400'); });
              btn.classList.add('ring-2', 'ring-blue-400');
            }
            self.filter();
          });
        });
        var resetBtn = document.getElementById('wlsRawObReset');
        if (resetBtn) resetBtn.addEventListener('click', function() {
          self.activeStatus = null;
          document.querySelectorAll('.wls-ob-pill').forEach(function(b) { b.classList.remove('ring-2', 'ring-blue-400'); });
          var kw = document.getElementById('wlsRawObKeyword');
          if (kw) kw.value = '';
          self.filter();
        });
        var kwInput = document.getElementById('wlsRawObKeyword');
        if (kwInput) kwInput.addEventListener('input', function() { self.filter(); });
      },
      filter() {
        var keyword = (document.getElementById('wlsRawObKeyword') || {}).value || '';
        var kw = keyword.toLowerCase();
        var active = this.activeStatus;
        document.querySelectorAll('.wls-ob-row').forEach(function(row) {
          var text = row.textContent.toLowerCase();
          var matchKw = !kw || text.indexOf(kw) !== -1;
          var matchSt = !active || row.getAttribute('data-status') === active;
          row.style.display = matchKw && matchSt ? '' : 'none';
        });
      }
    };
    window.__wlsRawOutbound.init();
  </script>`
}
