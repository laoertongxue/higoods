// @page-pattern: list
import type { AppState } from '../../../state/store'

type RawArrivalOrder = {
  id: string; inboundOrderNo: string; relatedOrderNo: string; deliveryUnit: string
  inboundWarehouse: string; materialCategories: string; skuCount: number
  deliveryQty: string; receivedQty: string
  status: '待收货' | '收货中' | '部分收货' | '全部收货'
}

const statusBadge: Record<string, string> = {
  '待收货': 'background:#F2F4F7;color:#475467',
  '收货中': 'background:#EEF4FF;color:#175CD3',
  '部分收货': 'background:#FFEAD5;color:#B54708',
  '全部收货': 'background:#D1FADF;color:#067647',
}

const seedOrders: RawArrivalOrder[] = [
  { id: 'PI-FAB-101', inboundOrderNo: 'YRK-FAB-20260528-101', relatedOrderNo: 'CG-FAB-20260528-101', deliveryUnit: '万隆面料供应链有限公司', inboundWarehouse: '中央总仓-面料仓', materialCategories: '面料', skuCount: 2, deliveryQty: '960 米', receivedQty: '0 米', status: '待收货' },
  { id: 'PI-FAB-102', inboundOrderNo: 'YRK-FAB-20260529-102', relatedOrderNo: 'CG-FAB-20260529-102', deliveryUnit: '万隆面料供应链有限公司', inboundWarehouse: '中央总仓-面料仓', materialCategories: '面料', skuCount: 1, deliveryQty: '1280 米', receivedQty: '560 米', status: '部分收货' },
  { id: 'PI-FAB-103', inboundOrderNo: 'YRK-FAB-20260530-103', relatedOrderNo: 'CG-FAB-20260530-103', deliveryUnit: '万隆面料供应链有限公司', inboundWarehouse: '中央总仓-面料仓', materialCategories: '面料', skuCount: 1, deliveryQty: '720 米', receivedQty: '720 米', status: '全部收货' },
  { id: 'PI-TRM-101', inboundOrderNo: 'YRK-TRM-20260528-101', relatedOrderNo: 'CG-TRM-20260528-101', deliveryUnit: '雅加达辅料贸易有限公司', inboundWarehouse: '中央总仓-辅料仓', materialCategories: '辅料', skuCount: 3, deliveryQty: '6000 颗', receivedQty: '0 颗', status: '待收货' },
  { id: 'PI-TRM-102', inboundOrderNo: 'YRK-TRM-20260529-102', relatedOrderNo: 'CG-TRM-20260529-102', deliveryUnit: '雅加达辅料贸易有限公司', inboundWarehouse: '中央总仓-辅料仓', materialCategories: '辅料', skuCount: 2, deliveryQty: '8000 颗', receivedQty: '3500 颗', status: '部分收货' },
  { id: 'PI-TRM-103', inboundOrderNo: 'YRK-TRM-20260530-103', relatedOrderNo: 'CG-TRM-20260530-103', deliveryUnit: '雅加达辅料贸易有限公司', inboundWarehouse: '中央总仓-辅料仓', materialCategories: '辅料', skuCount: 1, deliveryQty: '1800 颗', receivedQty: '1800 颗', status: '全部收货' },
  { id: 'PI-CON-101', inboundOrderNo: 'YRK-CON-20260528-101', relatedOrderNo: 'CG-CON-20260528-101', deliveryUnit: '泗水耗材供应中心', inboundWarehouse: '中央总仓-耗材仓', materialCategories: '耗材', skuCount: 2, deliveryQty: '1440 个', receivedQty: '0 个', status: '待收货' },
  { id: 'PI-CON-102', inboundOrderNo: 'YRK-CON-20260529-102', relatedOrderNo: 'CG-CON-20260529-102', deliveryUnit: '泗水耗材供应中心', inboundWarehouse: '中央总仓-耗材仓', materialCategories: '耗材', skuCount: 1, deliveryQty: '960 个', receivedQty: '480 个', status: '部分收货' },
  { id: 'PI-PKG-101', inboundOrderNo: 'YRK-PKG-20260528-101', relatedOrderNo: 'CG-PKG-20260528-101', deliveryUnit: '万隆包装材料有限公司', inboundWarehouse: '中央总仓-包材仓', materialCategories: '包材', skuCount: 2, deliveryQty: '3600 个', receivedQty: '0 个', status: '待收货' },
  { id: 'PI-PKG-102', inboundOrderNo: 'YRK-PKG-20260529-102', relatedOrderNo: 'CG-PKG-20260529-102', deliveryUnit: '万隆包装材料有限公司', inboundWarehouse: '中央总仓-包材仓', materialCategories: '包材', skuCount: 1, deliveryQty: '1800 个', receivedQty: '1800 个', status: '全部收货' },
  { id: 'PI-RAW-0001', inboundOrderNo: 'YRK-20260512-3001', relatedOrderNo: 'CG-20260512-9001', deliveryUnit: '万隆纺织供应链有限公司', inboundWarehouse: '原料仓', materialCategories: '面料 / 辅料', skuCount: 2, deliveryQty: '5275', receivedQty: '4080', status: '部分收货' },
  { id: 'PI-RAW-0002', inboundOrderNo: 'YRK-20260512-3002', relatedOrderNo: 'CG-20260512-9002', deliveryUnit: '泗水针织原料有限公司', inboundWarehouse: '原料仓', materialCategories: '包材 / 纱线', skuCount: 2, deliveryQty: '2600', receivedQty: '2600', status: '全部收货' },
]

const categoryColors: Record<string, string> = {
  '面料': 'bg-blue-50 text-blue-700',
  '辅料': 'bg-purple-50 text-purple-700',
  '耗材': 'bg-amber-50 text-amber-700',
  '包材': 'bg-teal-50 text-teal-700',
  '纱线': 'bg-pink-50 text-pink-700',
  '面料 / 辅料': 'bg-blue-50 text-blue-700',
  '包材 / 纱线': 'bg-teal-50 text-teal-700',
}

export function renderRawArrivalList(_state: AppState): string {
  const statusCounts = { '待收货': 0, '收货中': 0, '部分收货': 0, '全部收货': 0 }
  seedOrders.forEach(o => { statusCounts[o.status]++ })

  const pills = [
    { label: '待收货', count: statusCounts['待收货'] },
    { label: '收货中', count: statusCounts['收货中'] },
    { label: '部分收货', count: statusCounts['部分收货'] },
    { label: '全部收货', count: statusCounts['全部收货'] },
  ]

  return `
  <div class="space-y-4">
    <div>
      <h1 class="text-lg font-semibold text-slate-800">原料到货列表</h1>
      <p class="mt-1 text-xs text-slate-400">用于查看入库前置单据，包含单号、商品、送货单位与发货时间等信息。</p>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input id="rawArrivalSearch" type="text" placeholder="搜索入库单号 / 关联单号 / 送货单位 / 状态" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-80 focus:border-blue-400 focus:outline-none">
        <div class="flex items-center gap-1.5" id="rawArrivalPills">
          ${pills.map((p, i) => `
            <button data-status="${p.label}" class="raw-arrival-pill rounded-full px-3 py-1 text-xs border transition-colors ${i === 0 ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}">${p.label}(${p.count})</button>
          `).join('')}
        </div>
        <button id="rawArrivalClear" class="rounded-lg bg-slate-100 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200">清除</button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedOrders.length} 条记录</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1200px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">入库单号</th>
            <th class="px-3 py-2 text-left font-medium">采购单号/到货单号</th>
            <th class="px-3 py-2 text-left font-medium">供应商</th>
            <th class="px-3 py-2 text-left font-medium">入库仓库</th>
            <th class="px-3 py-2 text-left font-medium">到货单类型</th>
            <th class="px-3 py-2 text-right font-medium">SKU种类数</th>
            <th class="px-3 py-2 text-right font-medium">发货数量汇总</th>
            <th class="px-3 py-2 text-right font-medium">已收货数量汇总</th>
            <th class="px-3 py-2 text-left font-medium">状态</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody id="rawArrivalBody">
            ${seedOrders.map(o => `
              <tr class="border-t border-slate-100 hover:bg-slate-50 raw-arrival-row" data-status="${o.status}" data-keyword="${o.inboundOrderNo} ${o.relatedOrderNo} ${o.deliveryUnit} ${o.status}">
                <td class="px-3 py-2 text-slate-700 font-mono text-xs" title="${o.inboundOrderNo}">${o.inboundOrderNo}</td>
                <td class="px-3 py-2 text-slate-700 font-mono text-xs" title="${o.relatedOrderNo}">${o.relatedOrderNo}</td>
                <td class="px-3 py-2 text-slate-600">${o.deliveryUnit}</td>
                <td class="px-3 py-2 text-slate-500">${o.inboundWarehouse}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${categoryColors[o.materialCategories] || 'bg-slate-50 text-slate-600'}">${o.materialCategories}</span></td>
                <td class="px-3 py-2 text-right text-slate-600">${o.skuCount}</td>
                <td class="px-3 py-2 text-right text-slate-600">${o.deliveryQty}</td>
                <td class="px-3 py-2 text-right text-slate-700 font-medium">${o.receivedQty}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs" style="${statusBadge[o.status]}">${o.status}</span></td>
                <td class="px-3 py-2 sticky right-0 bg-white">
                  <div class="flex items-center gap-1.5">
                    <button class="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">查看详情</button>
                    <button class="rounded-lg bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 ${o.status === '全部收货' ? 'opacity-40 cursor-not-allowed' : ''}" ${o.status === '全部收货' ? 'disabled' : ''}>开始收货</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <script>
    window.__wlsRawArrival = {
      activeStatus: null,
      init() {
        const self = this;
        const pills = document.querySelectorAll('.raw-arrival-pill');
        const search = document.getElementById('rawArrivalSearch');
        const clearBtn = document.getElementById('rawArrivalClear');

        pills.forEach(function(pill) {
          pill.addEventListener('click', function() {
            const status = pill.getAttribute('data-status');
            if (self.activeStatus === status) {
              self.activeStatus = null;
              pills.forEach(function(p) { p.className = p.className.replace(/border-blue-300 bg-blue-50 text-blue-700/g, 'border-slate-200 bg-white text-slate-500'); });
            } else {
              self.activeStatus = status;
              pills.forEach(function(p) { p.className = p.className.replace(/border-blue-300 bg-blue-50 text-blue-700/g, 'border-slate-200 bg-white text-slate-500'); });
              pill.className = pill.className.replace(/border-slate-200 bg-white text-slate-500/g, 'border-blue-300 bg-blue-50 text-blue-700');
            }
            self.filter();
          });
        });

        if (search) search.addEventListener('input', function() { self.filter(); });
        if (clearBtn) clearBtn.addEventListener('click', function() {
          self.activeStatus = null;
          if (search) search.value = '';
          pills.forEach(function(p) { p.className = p.className.replace(/border-blue-300 bg-blue-50 text-blue-700/g, 'border-slate-200 bg-white text-slate-500'); });
          self.filter();
        });
      },
      filter() {
        const rows = document.querySelectorAll('.raw-arrival-row');
        const keyword = (document.getElementById('rawArrivalSearch') || {}).value || '';
        const status = this.activeStatus;
        rows.forEach(function(row) {
          var matchKw = !keyword || (row.getAttribute('data-keyword') || '').toLowerCase().indexOf(keyword.toLowerCase()) !== -1;
          var matchStatus = !status || row.getAttribute('data-status') === status;
          row.style.display = matchKw && matchStatus ? '' : 'none';
        });
      }
    };
    window.__wlsRawArrival.init();
  </script>`
}
