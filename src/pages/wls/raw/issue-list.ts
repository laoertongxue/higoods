// @page-pattern: list
import type { AppState } from '../../../state/store'

type RawIssueOrder = {
  id: string; outboundOrderNo: string; pickOrderNo: string; relatedOrderNo: string
  trackingNo: string; materialCategory: string; unit: string; outboundWarehouse: string
  outboundType: string; receivingUnit: string; plannedQty: string; stockStatus: string
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
  '草稿': 'bg-slate-100 text-slate-500',
  '待配料': 'bg-orange-50 text-orange-700',
  '配料中': 'bg-blue-50 text-blue-700',
  '配料完成': 'bg-emerald-50 text-emerald-700',
  '已出库': 'bg-emerald-50 text-emerald-700',
  '已完结': 'bg-emerald-50 text-emerald-700',
  '少拣待确认': 'bg-orange-50 text-orange-700',
  '工厂拒绝领取': 'bg-red-50 text-red-700',
}

const categoryClass: Record<string, string> = {
  '面料': 'bg-indigo-50 text-indigo-700',
  '辅料': 'bg-teal-50 text-teal-700',
  '耗材': 'bg-amber-50 text-amber-700',
  '包材': 'bg-pink-50 text-pink-700',
  '纱线': 'bg-violet-50 text-violet-700',
}

const seedIssues: RawIssueOrder[] = [
  { id: 'PK-001', outboundOrderNo: 'YCK-FAB-REQ-20260521-001', pickOrderNo: 'JHD-FAB-REQ-20260521-001', relatedOrderNo: 'YL-FAB-REQ-20260521-001', trackingNo: 'MATWB-FAB-001', materialCategory: '面料', unit: '米', outboundWarehouse: '中央总仓-面料仓', outboundType: '原料领料出库', receivingUnit: '生产车间A', plannedQty: '160 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '配料中', pdVisible: '是', hasOutbound: '否', pickedQty: '80 米', owner: '印尼万隆主体', status: '配料中', time: '2026-05-21 11:20' },
  { id: 'PK-002', outboundOrderNo: 'YCK-FAB-REQ-20260522-002', pickOrderNo: 'JHD-FAB-REQ-20260522-002', relatedOrderNo: 'YL-FAB-REQ-20260522-002', trackingNo: 'MATWB-FAB-002', materialCategory: '面料', unit: '米', outboundWarehouse: '中央总仓-面料仓', outboundType: '原料领料出库', receivingUnit: '生产车间B', plannedQty: '240 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '配料完成', pdVisible: '是', hasOutbound: '是', pickedQty: '240 米', owner: '印尼万隆主体', status: '配料完成', time: '2026-05-22 11:30' },
  { id: 'PK-003', outboundOrderNo: 'YCK-TRM-REQ-20260523-003', pickOrderNo: 'JHD-TRM-REQ-20260523-003', relatedOrderNo: 'YL-TRM-REQ-20260523-003', trackingNo: 'MATWB-TRM-003', materialCategory: '辅料', unit: '颗', outboundWarehouse: '中央总仓-辅料仓', outboundType: '原料领料出库', receivingUnit: '生产车间A', plannedQty: '3000 颗', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '无需确认', pickingStatus: '待配料', pdVisible: '是', hasOutbound: '否', pickedQty: '0 颗', owner: '雅加达电商主体', status: '待配料', time: '2026-05-23 11:40' },
  { id: 'PK-004', outboundOrderNo: 'YCK-TRM-REQ-20260524-004', pickOrderNo: 'JHD-TRM-REQ-20260524-004', relatedOrderNo: 'YL-TRM-REQ-20260524-004', trackingNo: 'MATWB-TRM-004', materialCategory: '辅料', unit: '颗', outboundWarehouse: '中央总仓-辅料仓', outboundType: '原料领料出库', receivingUnit: '生产车间C', plannedQty: '1500 颗', stockStatus: '库存部分充足', availableRatio: '68%', factoryConfirm: '待工厂确认', pickingStatus: '草稿', pdVisible: '否', hasOutbound: '否', pickedQty: '0 颗', owner: '印尼万隆主体', status: '草稿', time: '2026-05-24 11:50' },
  { id: 'PK-005', outboundOrderNo: 'YCK-CON-REQ-20260525-005', pickOrderNo: 'JHD-CON-REQ-20260525-005', relatedOrderNo: 'YL-CON-REQ-20260525-005', trackingNo: 'MATWB-CON-005', materialCategory: '耗材', unit: '个', outboundWarehouse: '中央总仓-耗材仓', outboundType: '原料领料出库', receivingUnit: '生产车间B', plannedQty: '480 个', stockStatus: '库存不足', availableRatio: '35%', factoryConfirm: '无需确认', pickingStatus: '少拣待确认', pdVisible: '是', hasOutbound: '否', pickedQty: '168 个', owner: '印尼万隆主体', status: '少拣待确认', time: '2026-05-25 12:00' },
  { id: 'PK-006', outboundOrderNo: 'YCK-PKG-REQ-20260526-006', pickOrderNo: 'JHD-PKG-REQ-20260526-006', relatedOrderNo: 'YL-PKG-REQ-20260526-006', trackingNo: 'MATWB-PKG-006', materialCategory: '包材', unit: '个', outboundWarehouse: '中央总仓-包材仓', outboundType: '原料领料出库', receivingUnit: '生产车间D', plannedQty: '2000 个', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '已出库', pdVisible: '是', hasOutbound: '是', pickedQty: '2000 个', owner: '雅加达电商主体', status: '已出库', time: '2026-05-26 12:10' },
  { id: 'PK-007', outboundOrderNo: 'YCK-YRN-REQ-20260527-007', pickOrderNo: 'JHD-YRN-REQ-20260527-007', relatedOrderNo: 'YL-YRN-REQ-20260527-007', trackingNo: 'MATWB-YRN-007', materialCategory: '纱线', unit: '米', outboundWarehouse: '中央总仓-纱线仓', outboundType: '原料领料出库', receivingUnit: '生产车间A', plannedQty: '600 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂拒绝领取', pickingStatus: '草稿', pdVisible: '否', hasOutbound: '否', pickedQty: '0 米', owner: '印尼万隆主体', status: '工厂拒绝领取', time: '2026-05-27 12:20' },
  { id: 'PK-008', outboundOrderNo: 'YCK-FAB-REQ-20260528-008', pickOrderNo: 'JHD-FAB-REQ-20260528-008', relatedOrderNo: 'YL-FAB-REQ-20260528-008', trackingNo: 'MATWB-FAB-008', materialCategory: '面料', unit: '米', outboundWarehouse: '中央总仓-面料仓', outboundType: '原料领料出库', receivingUnit: '生产车间C', plannedQty: '320 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '已完结', pdVisible: '是', hasOutbound: '是', pickedQty: '320 米', owner: '印尼万隆主体', status: '已完结', time: '2026-05-28 12:30' },
]

export function renderRawIssueList(_state: AppState): string {
  const statusCounts: Record<string, number> = {}
  seedIssues.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1 })

  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-slate-800">原料配料单列表</h1>
        <p class="text-sm text-slate-500 mt-0.5">用于查看配料任务执行状态，包含配料单号、商品、收货单位与配料进度。</p>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input id="wlsRawIssueKeyword" type="text" placeholder="搜索出库单号 / 配料单号 / 跟踪单号 / 状态" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-80 focus:border-blue-400 focus:outline-none">
        <select id="wlsRawIssueStatusSelect" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">全部</option>
          <option value="草稿">草稿 (${statusCounts['草稿'] || 0})</option>
          <option value="待配料">待配料 (${statusCounts['待配料'] || 0})</option>
          <option value="配料中">配料中 (${statusCounts['配料中'] || 0})</option>
          <option value="配料完成">配料完成 (${statusCounts['配料完成'] || 0})</option>
          <option value="已出库">已出库 (${statusCounts['已出库'] || 0})</option>
          <option value="已完结">已完结 (${statusCounts['已完结'] || 0})</option>
          <option value="少拣待确认">少拣待确认 (${statusCounts['少拣待确认'] || 0})</option>
          <option value="工厂拒绝领取">工厂拒绝领取 (${statusCounts['工厂拒绝领取'] || 0})</option>
        </select>
        <button id="wlsRawIssueReset" class="rounded-lg bg-slate-100 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200">重置</button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedIssues.length} 条记录</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1520px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">单号</th>
            <th class="px-3 py-2 text-left font-medium">配料单类型</th>
            <th class="px-3 py-2 text-left font-medium">出库仓库</th>
            <th class="px-3 py-2 text-left font-medium">收货单位</th>
            <th class="px-3 py-2 text-right font-medium">计划配料数量</th>
            <th class="px-3 py-2 text-left font-medium">库存状态</th>
            <th class="px-3 py-2 text-right font-medium">整单可配比例</th>
            <th class="px-3 py-2 text-left font-medium">工厂确认状态</th>
            <th class="px-3 py-2 text-right font-medium">已配料数量</th>
            <th class="px-3 py-2 text-left font-medium">货主</th>
            <th class="px-3 py-2 text-left font-medium">状态</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody id="wlsRawIssueTbody">
            ${seedIssues.map(o => `
              <tr class="border-t border-slate-100 hover:bg-slate-50 wls-issue-row" data-status="${o.status}" data-picking="${o.pickingStatus}">
                <td class="px-3 py-2">
                  <div class="text-slate-700 font-mono text-xs">${o.outboundOrderNo}</div>
                  <div class="text-slate-400 font-mono text-xs">${o.pickOrderNo}</div>
                  <div class="text-slate-400 font-mono text-xs">${o.trackingNo}</div>
                </td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${categoryClass[o.materialCategory] || 'bg-slate-100 text-slate-600'}">${o.materialCategory}</span></td>
                <td class="px-3 py-2 text-slate-600">${o.outboundWarehouse}</td>
                <td class="px-3 py-2 text-slate-600">${o.receivingUnit}</td>
                <td class="px-3 py-2 text-right text-slate-700 font-medium">${o.plannedQty}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${stockStatusClass[o.stockStatus] || 'bg-slate-100 text-slate-500'}">${o.stockStatus}</span></td>
                <td class="px-3 py-2 text-right text-slate-600">${o.availableRatio}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${factoryConfirmClass[o.factoryConfirm] || 'bg-slate-100 text-slate-500'}">${o.factoryConfirm}</span></td>
                <td class="px-3 py-2 text-right text-slate-600">${o.pickedQty}</td>
                <td class="px-3 py-2 text-slate-600">${o.owner}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${statusClass[o.status] || 'bg-slate-100 text-slate-500'}">${o.status}</span></td>
                <td class="px-3 py-2 sticky right-0 bg-white whitespace-nowrap">
                  <button class="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">查看</button>
                  ${o.pickingStatus === '草稿' ? `
                    <button class="rounded-lg border border-emerald-300 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-50 ml-1">工厂确认</button>
                    <button class="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50 ml-1">工厂拒绝</button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <script>
    window.__wlsRawIssue = {
      init() {
        var self = this;
        var select = document.getElementById('wlsRawIssueStatusSelect');
        if (select) select.addEventListener('change', function() { self.filter(); });
        var kwInput = document.getElementById('wlsRawIssueKeyword');
        if (kwInput) kwInput.addEventListener('input', function() { self.filter(); });
        var resetBtn = document.getElementById('wlsRawIssueReset');
        if (resetBtn) resetBtn.addEventListener('click', function() {
          var s = document.getElementById('wlsRawIssueStatusSelect');
          if (s) s.value = '';
          var kw = document.getElementById('wlsRawIssueKeyword');
          if (kw) kw.value = '';
          self.filter();
        });
      },
      filter() {
        var keyword = ((document.getElementById('wlsRawIssueKeyword') || {}) as HTMLInputElement).value || '';
        var kw = keyword.toLowerCase();
        var sel = document.getElementById('wlsRawIssueStatusSelect') as HTMLSelectElement;
        var active = sel ? sel.value : '';
        document.querySelectorAll('.wls-issue-row').forEach(function(row) {
          var text = row.textContent.toLowerCase();
          var matchKw = !kw || text.indexOf(kw) !== -1;
          var matchSt = !active || row.getAttribute('data-status') === active;
          row.style.display = matchKw && matchSt ? '' : 'none';
        });
      }
    };
    window.__wlsRawIssue.init();
  </script>`
}
