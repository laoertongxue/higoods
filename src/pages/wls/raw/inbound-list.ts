// @page-pattern: list
import type { AppState } from '../../../state/store'

type RawPutawayOrder = {
  id: string; inboundOrderNo: string; paNo: string; relatedOrderNo: string
  warehouse: string; status: '待上架' | '部分上架' | '上架完成'
  putawayMode: string; materialCategory: string
  inboundQty: string; putawayQty: string; pendingQty: string
  spu: string; sku: string; packageDetail: string; location: string
}

const statusBadge: Record<string, string> = {
  '待上架': 'background:#FFEAD5;color:#B54708',
  '部分上架': 'background:#FEF0C7;color:#B54708',
  '上架完成': 'background:#D1FADF;color:#067647',
}

const categoryColors: Record<string, string> = {
  '面料': 'bg-blue-50 text-blue-700',
  '辅料': 'bg-purple-50 text-purple-700',
  '耗材': 'bg-amber-50 text-amber-700',
  '包材': 'bg-teal-50 text-teal-700',
  '纱线': 'bg-pink-50 text-pink-700',
  '面料 / 辅料': 'bg-blue-50 text-blue-700',
  '包材 / 纱线': 'bg-teal-50 text-teal-700',
}

const seedPutawayOrders: RawPutawayOrder[] = [
  { id: 'PA-FAB-001', inboundOrderNo: 'YRK-FAB-20260529-102', paNo: 'SJ-FAB-20260529-001', relatedOrderNo: 'CG-FAB-20260529-102', warehouse: '中央总仓-面料仓', status: '待上架', putawayMode: '包装编码上架', materialCategory: '面料', inboundQty: '16 卷 / 1280 米', putawayQty: '0 卷 / 0 米', pendingQty: '16 卷 / 1280 米', spu: 'SPU-FAB-1001', sku: 'SKU-FAB-50001', packageDetail: '16 卷', location: '-' },
  { id: 'PA-FAB-002', inboundOrderNo: 'YRK-FAB-20260530-103', paNo: 'SJ-FAB-20260530-001', relatedOrderNo: 'CG-FAB-20260530-103', warehouse: '中央总仓-面料仓', status: '部分上架', putawayMode: '包装编码上架', materialCategory: '面料', inboundQty: '9 卷 / 720 米', putawayQty: '5 卷 / 400 米', pendingQty: '4 卷 / 320 米', spu: 'SPU-FAB-1002', sku: 'SKU-FAB-50002', packageDetail: '9 卷', location: 'FAB-A-01 ~ FAB-A-05' },
  { id: 'PA-FAB-003', inboundOrderNo: 'YRK-FAB-20260530-104', paNo: 'SJ-FAB-20260530-002', relatedOrderNo: 'CG-FAB-20260530-104', warehouse: '中央总仓-面料仓', status: '上架完成', putawayMode: '包装编码上架', materialCategory: '面料', inboundQty: '12 卷 / 960 米', putawayQty: '12 卷 / 960 米', pendingQty: '0 卷 / 0 米', spu: 'SPU-FAB-1003', sku: 'SKU-FAB-50003', packageDetail: '12 卷', location: 'FAB-B-01 ~ FAB-B-12' },
  { id: 'PA-TRM-001', inboundOrderNo: 'YRK-TRM-20260529-102', paNo: 'SJ-TRM-20260529-001', relatedOrderNo: 'CG-TRM-20260529-102', warehouse: '中央总仓-辅料仓', status: '待上架', putawayMode: '包装编码上架', materialCategory: '辅料', inboundQty: '14 包 / 7000 颗', putawayQty: '0 包 / 0 颗', pendingQty: '14 包 / 7000 颗', spu: 'SPU-TRM-1001', sku: 'SKU-TRM-50001', packageDetail: '14 包', location: '-' },
  { id: 'PA-TRM-002', inboundOrderNo: 'YRK-TRM-20260530-103', paNo: 'SJ-TRM-20260530-001', relatedOrderNo: 'CG-TRM-20260530-103', warehouse: '中央总仓-辅料仓', status: '上架完成', putawayMode: '包装编码上架', materialCategory: '辅料', inboundQty: '6 包 / 3000 颗', putawayQty: '6 包 / 3000 颗', pendingQty: '0 包 / 0 颗', spu: 'SPU-TRM-1002', sku: 'SKU-TRM-50002', packageDetail: '6 包', location: 'TRM-A-01 ~ TRM-A-06' },
  { id: 'PA-CON-001', inboundOrderNo: 'YRK-CON-20260529-102', paNo: 'SJ-CON-20260529-001', relatedOrderNo: 'CG-CON-20260529-102', warehouse: '中央总仓-耗材仓', status: '待上架', putawayMode: '包装编码上架', materialCategory: '耗材', inboundQty: '8 箱 / 960 个', putawayQty: '0 箱 / 0 个', pendingQty: '8 箱 / 960 个', spu: 'SPU-CON-1001', sku: 'SKU-CON-50001', packageDetail: '8 箱', location: '-' },
  { id: 'PA-PKG-001', inboundOrderNo: 'YRK-PKG-20260529-102', paNo: 'SJ-PKG-20260529-001', relatedOrderNo: 'CG-PKG-20260529-102', warehouse: '中央总仓-包材仓', status: '部分上架', putawayMode: '包装编码上架', materialCategory: '包材', inboundQty: '10 包 / 2000 个', putawayQty: '6 包 / 1200 个', pendingQty: '4 包 / 800 个', spu: 'SPU-PKG-1001', sku: 'SKU-PKG-50001', packageDetail: '10 包', location: 'PKG-A-01 ~ PKG-A-06' },
  { id: 'PA-RAW-001', inboundOrderNo: 'YRK-20260512-3001', paNo: 'SJ-RAW-20260512-001', relatedOrderNo: 'CG-20260512-9001', warehouse: '原料仓', status: '待上架', putawayMode: '包装编码上架', materialCategory: '面料 / 辅料', inboundQty: '混合', putawayQty: '4 卷 + 4 包', pendingQty: '1 卷 + 4 包', spu: '多SKU', sku: '多SKU', packageDetail: '混合', location: '-' },
]

export function renderRawInboundList(_state: AppState): string {
  const statusCounts = { '待上架': 0, '上架中': 0, '部分上架': 0, '上架完成': 0 }
  seedPutawayOrders.forEach(o => {
    if (o.status === '待上架') statusCounts['待上架']++
    else if (o.status === '部分上架') statusCounts['部分上架']++
    else if (o.status === '上架完成') statusCounts['上架完成']++
  })

  const statusOptions = [
    { label: '全部', value: '' },
    { label: `待上架(${statusCounts['待上架']})`, value: '待上架' },
    { label: `上架中(${statusCounts['上架中']})`, value: '上架中' },
    { label: `部分上架(${statusCounts['部分上架']})`, value: '部分上架' },
    { label: `上架完成(${statusCounts['上架完成']})`, value: '上架完成' },
  ]

  return `
  <div class="space-y-4">
    <div>
      <h1 class="text-lg font-semibold text-slate-800">原料入库单列表</h1>
      <p class="mt-1 text-xs text-slate-400">基于原料到货单的实际收货自动生成，用于查看并执行上架任务。</p>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input id="rawInboundSearch" type="text" placeholder="搜索入库单号 / 上架单号 / 关联单号" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-72 focus:border-blue-400 focus:outline-none">
        <select id="rawInboundStatus" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          ${statusOptions.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
        </select>
        <button id="rawInboundClear" class="rounded-lg bg-slate-100 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200">清除</button>
        <button id="rawInboundExport" class="rounded-lg border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">导出Excel</button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedPutawayOrders.length} 条记录</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1600px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">单号</th>
            <th class="px-3 py-2 text-left font-medium">入库仓库</th>
            <th class="px-3 py-2 text-left font-medium">状态</th>
            <th class="px-3 py-2 text-left font-medium">上架方式</th>
            <th class="px-3 py-2 text-left font-medium">入库单类型</th>
            <th class="px-3 py-2 text-left font-medium">入库数量</th>
            <th class="px-3 py-2 text-left font-medium">已上架数量</th>
            <th class="px-3 py-2 text-left font-medium">待上架数量</th>
            <th class="px-3 py-2 text-left font-medium">SPU编码</th>
            <th class="px-3 py-2 text-left font-medium">SKU编码</th>
            <th class="px-3 py-2 text-left font-medium">包装明细</th>
            <th class="px-3 py-2 text-left font-medium">库区/库位</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody id="rawInboundBody">
            ${seedPutawayOrders.map(o => {
              const isCompleted = o.status === '上架完成'
              const hasNoPending = o.pendingQty.startsWith('0')
              const disabled = isCompleted || hasNoPending
              return `
              <tr class="border-t border-slate-100 hover:bg-slate-50 raw-inbound-row" data-status="${o.status}" data-keyword="${o.inboundOrderNo} ${o.paNo} ${o.relatedOrderNo}">
                <td class="px-3 py-2">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-slate-700 font-mono text-xs" title="${o.inboundOrderNo}">${o.inboundOrderNo}</span>
                    <span class="text-slate-500 font-mono text-[10px]" title="${o.paNo}">${o.paNo}</span>
                    <span class="text-slate-400 font-mono text-[10px]" title="${o.relatedOrderNo}">${o.relatedOrderNo}</span>
                  </div>
                </td>
                <td class="px-3 py-2 text-slate-500">${o.warehouse}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs" style="${statusBadge[o.status]}">${o.status}</span></td>
                <td class="px-3 py-2"><span class="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs">${o.putawayMode}</span></td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${categoryColors[o.materialCategory] || 'bg-slate-50 text-slate-600'}">${o.materialCategory}</span></td>
                <td class="px-3 py-2 text-slate-600">${o.inboundQty}</td>
                <td class="px-3 py-2 text-slate-600">${o.putawayQty}</td>
                <td class="px-3 py-2 text-slate-700 font-medium">${o.pendingQty}</td>
                <td class="px-3 py-2 text-slate-500 font-mono text-xs">${o.spu}</td>
                <td class="px-3 py-2 text-slate-500 font-mono text-xs">${o.sku}</td>
                <td class="px-3 py-2 text-slate-600">${o.packageDetail}</td>
                <td class="px-3 py-2 text-slate-500 font-mono text-xs">${o.location}</td>
                <td class="px-3 py-2 sticky right-0 bg-white">
                  <button class="rounded-lg bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}" ${disabled ? 'disabled' : ''}>上架</button>
                </td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <script>
    window.__wlsRawInbound = {
      init() {
        var self = this;
        var search = document.getElementById('rawInboundSearch');
        var statusSel = document.getElementById('rawInboundStatus');
        var clearBtn = document.getElementById('rawInboundClear');
        var exportBtn = document.getElementById('rawInboundExport');

        if (search) search.addEventListener('input', function() { self.filter(); });
        if (statusSel) statusSel.addEventListener('change', function() { self.filter(); });
        if (clearBtn) clearBtn.addEventListener('click', function() {
          if (search) search.value = '';
          if (statusSel) statusSel.value = '';
          self.filter();
        });
        if (exportBtn) exportBtn.addEventListener('click', function() {
          alert('导出功能为原型演示，实际导出将在后续版本实现。');
        });
      },
      filter() {
        var rows = document.querySelectorAll('.raw-inbound-row');
        var keyword = (document.getElementById('rawInboundSearch') || {}).value || '';
        var status = (document.getElementById('rawInboundStatus') || {}).value || '';
        rows.forEach(function(row) {
          var matchKw = !keyword || (row.getAttribute('data-keyword') || '').toLowerCase().indexOf(keyword.toLowerCase()) !== -1;
          var matchStatus = !status || row.getAttribute('data-status') === status;
          row.style.display = matchKw && matchStatus ? '' : 'none';
        });
      }
    };
    window.__wlsRawInbound.init();
  </script>`
}
