import type { AppState } from '../../../state/store'

type FlowRecord = {
  id: string; time: string; warehouse: string; spu: string; sku: string
  packageUnit: string; productName: string; bizNo: string; docType: string
  actionType: string; totalChange: string; totalBefore: string; totalAfter: string
  spotChange: string; spotBefore: string; spotAfter: string
  location: string; operator: string; operateTime: string; remark: string
}

const seedFlows: FlowRecord[] = [
  { id: 'FL-001', time: '2026-05-30 14:20', warehouse: '中央总仓-面料仓', spu: 'SPU-FAB-1001', sku: 'SKU-FAB-50001', packageUnit: '卷', productName: '莫代尔打底面料', bizNo: 'YRK-FAB-20260530-103', docType: '收货单', actionType: '收货入库', totalChange: '+12 卷', totalBefore: '88 卷', totalAfter: '100 卷', spotChange: '+12 卷', spotBefore: '88 卷', spotAfter: '100 卷', location: 'FAB-A-01', operator: 'Rina', operateTime: '2026-05-30 14:20', remark: '' },
  { id: 'FL-002', time: '2026-05-30 14:30', warehouse: '中央总仓-面料仓', spu: 'SPU-FAB-1001', sku: 'SKU-FAB-50001', packageUnit: '卷', productName: '莫代尔打底面料', bizNo: 'SJ-FAB-20260530-001', docType: '上架单', actionType: '上架入库', totalChange: '+12 卷', totalBefore: '100 卷', totalAfter: '112 卷', spotChange: '+12 卷', spotBefore: '100 卷', spotAfter: '112 卷', location: 'FAB-A-01', operator: 'Rina', operateTime: '2026-05-30 14:30', remark: '' },
  { id: 'FL-003', time: '2026-05-30 15:00', warehouse: '中央总仓-面料仓', spu: 'SPU-FAB-1002', sku: 'SKU-FAB-50003', packageUnit: '卷', productName: '精梳棉T恤面料', bizNo: 'JHD-FAB-20260530-002', docType: '拣货单', actionType: '销售出库', totalChange: '-5 卷', totalBefore: '45 卷', totalAfter: '40 卷', spotChange: '-5 卷', spotBefore: '45 卷', spotAfter: '40 卷', location: 'FAB-A-03', operator: 'Dian', operateTime: '2026-05-30 15:00', remark: '领料出库' },
  { id: 'FL-004', time: '2026-05-30 15:10', warehouse: '中央总仓-辅料仓', spu: 'SPU-TRM-1001', sku: 'SKU-TRM-50001', packageUnit: '包', productName: '树脂纽扣-12mm', bizNo: 'YRK-TRM-20260530-103', docType: '收货单', actionType: '收货入库', totalChange: '+6 包', totalBefore: '24 包', totalAfter: '30 包', spotChange: '+6 包', spotBefore: '24 包', spotAfter: '30 包', location: 'TRM-A-01', operator: 'VM', operateTime: '2026-05-30 15:10', remark: '' },
  { id: 'FL-005', time: '2026-05-30 15:20', warehouse: '中央总仓-辅料仓', spu: 'SPU-TRM-1002', sku: 'SKU-TRM-50002', packageUnit: '包', productName: '金属拉链-20cm', bizNo: 'PD-TRM-20260530-001', docType: '盘点单', actionType: '盘盈', totalChange: '+2 包', totalBefore: '16 包', totalAfter: '18 包', spotChange: '+2 包', spotBefore: '16 包', spotAfter: '18 包', location: 'TRM-A-02', operator: 'Rina', operateTime: '2026-05-30 15:20', remark: '盘点差异' },
  { id: 'FL-006', time: '2026-05-30 15:30', warehouse: '中央总仓-耗材仓', spu: 'SPU-CON-1001', sku: 'SKU-CON-50001', packageUnit: '箱', productName: '缝纫线-白色', bizNo: 'DB-CON-20260530-001', docType: '移货单', actionType: '移货', totalChange: '0 箱', totalBefore: '24 箱', totalAfter: '24 箱', spotChange: '0 箱', spotBefore: '24 箱', spotAfter: '24 箱', location: 'CON-A-01 → CON-A-03', operator: 'Dian', operateTime: '2026-05-30 15:30', remark: '库位调整' },
  { id: 'FL-007', time: '2026-05-30 15:40', warehouse: '中央总仓-包材仓', spu: 'SPU-PKG-1001', sku: 'SKU-PKG-50001', packageUnit: '包', productName: '快递袋-中号', bizNo: 'YCK-PKG-20260530-001', docType: '出库单', actionType: '销售出库', totalChange: '-10 包', totalBefore: '50 包', totalAfter: '40 包', spotChange: '-10 包', spotBefore: '50 包', spotAfter: '40 包', location: 'PKG-A-01', operator: 'VM', operateTime: '2026-05-30 15:40', remark: '领料出库' },
  { id: 'FL-008', time: '2026-05-30 16:00', warehouse: '中央总仓-纱线仓', spu: 'SPU-YRN-1001', sku: 'SKU-YRN-50001', packageUnit: '卷', productName: '涤纶缝纫线-40S', bizNo: 'TZ-20260530-001', docType: '调整单', actionType: '手工调整', totalChange: '-1 卷', totalBefore: '16 卷', totalAfter: '15 卷', spotChange: '-1 卷', spotBefore: '16 卷', spotAfter: '15 卷', location: 'YRN-A-01', operator: '仓库主管', operateTime: '2026-05-30 16:00', remark: '破损报废' },
  { id: 'FL-009', time: '2026-05-30 16:10', warehouse: '中央总仓-面料仓', spu: 'SPU-FAB-1003', sku: 'SKU-FAB-50004', packageUnit: '卷', productName: '磨毛保暖面料', bizNo: 'TH-FAB-20260530-001', docType: '收货单', actionType: '退货入库', totalChange: '+3 卷', totalBefore: '17 卷', totalAfter: '20 卷', spotChange: '+3 卷', spotBefore: '17 卷', spotAfter: '20 卷', location: 'FAB-B-01', operator: 'Rina', operateTime: '2026-05-30 16:10', remark: '生产退料' },
  { id: 'FL-010', time: '2026-05-30 16:20', warehouse: '中央总仓-面料仓', spu: 'SPU-FAB-1001', sku: 'SKU-FAB-50001', packageUnit: '卷', productName: '莫代尔打底面料', bizNo: 'JHD-FAB-20260530-003', docType: '拣货单', actionType: '销售出库', totalChange: '-8 卷', totalBefore: '112 卷', totalAfter: '104 卷', spotChange: '-8 卷', spotBefore: '112 卷', spotAfter: '104 卷', location: 'FAB-A-01', operator: 'Dian', operateTime: '2026-05-30 16:20', remark: '领料出库' },
]

const actionTypeClass: Record<string, string> = {
  '收货入库': 'bg-emerald-50 text-emerald-700',
  '上架入库': 'bg-blue-50 text-blue-700',
  '销售出库': 'bg-orange-50 text-orange-700',
  '盘盈': 'bg-teal-50 text-teal-700',
  '移货': 'bg-slate-100 text-slate-600',
  '手工调整': 'bg-purple-50 text-purple-700',
  '退货入库': 'bg-cyan-50 text-cyan-700',
}

export function renderRawStockFlow(_state: AppState): string {
  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-slate-800">库存流水查询</h1>
        <p class="text-sm text-slate-500 mt-0.5">用于追溯每次库存变动来源、前后数量及即时库存快照。</p>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div class="flex flex-wrap items-center gap-3">
        <input id="wlsRawFlowSearch" type="text" placeholder="搜索单号 / SPU / SKU / 商品名称 / 操作人" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-72 focus:border-blue-400 focus:outline-none">
        <div class="flex items-center gap-1" id="wlsRawFlowPills">
          <button data-type="全部" class="wls-flow-pill rounded-full px-3 py-1 text-xs bg-blue-600 text-white">全部</button>
          <button data-type="入库" class="wls-flow-pill rounded-full px-3 py-1 text-xs bg-slate-100 text-slate-600 hover:bg-slate-200">入库</button>
          <button data-type="上架" class="wls-flow-pill rounded-full px-3 py-1 text-xs bg-slate-100 text-slate-600 hover:bg-slate-200">上架</button>
          <button data-type="库内调拨" class="wls-flow-pill rounded-full px-3 py-1 text-xs bg-slate-100 text-slate-600 hover:bg-slate-200">库内调拨</button>
          <button data-type="拣货" class="wls-flow-pill rounded-full px-3 py-1 text-xs bg-slate-100 text-slate-600 hover:bg-slate-200">拣货</button>
          <button data-type="出库" class="wls-flow-pill rounded-full px-3 py-1 text-xs bg-slate-100 text-slate-600 hover:bg-slate-200">出库</button>
        </div>
        <label class="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" id="wlsRawFlowScrap" class="rounded border-slate-300">
          <span>仅看报废上架</span>
        </label>
        <button class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">导出Excel</button>
        <button id="wlsRawFlowToggle" class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">展开筛选</button>
      </div>
      <div id="wlsRawFlowAdvanced" class="hidden">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <select class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
            <option value="">全部仓库</option>
            <option>中央总仓-面料仓</option>
            <option>中央总仓-辅料仓</option>
            <option>中央总仓-耗材仓</option>
            <option>中央总仓-包材仓</option>
            <option>中央总仓-纱线仓</option>
          </select>
          <input type="text" placeholder="商品SPU" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <input type="text" placeholder="商品SKU" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <input type="text" placeholder="商品名称" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <input type="text" placeholder="业务单号" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <select class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
            <option value="">全部单据类型</option>
            <option>收货单</option><option>上架单</option><option>拣货单</option><option>盘点单</option><option>移货单</option><option>出库单</option><option>调整单</option>
          </select>
          <select class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
            <option value="">全部动作类型</option>
            <option>收货入库</option><option>上架入库</option><option>销售出库</option><option>盘盈</option><option>移货</option><option>手工调整</option><option>退货入库</option>
          </select>
          <input type="text" placeholder="操作人" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <input type="date" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <input type="date" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
        </div>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedFlows.length} 条记录</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1800px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium sticky left-0 bg-slate-50 z-10">发生时间</th>
            <th class="px-3 py-2 text-left font-medium sticky left-[140px] bg-slate-50 z-10">仓库名称</th>
            <th class="px-3 py-2 text-left font-medium sticky left-[260px] bg-slate-50 z-10">商品SPU</th>
            <th class="px-3 py-2 text-left font-medium sticky left-[370px] bg-slate-50 z-10">商品SKU</th>
            <th class="px-3 py-2 text-left font-medium sticky left-[480px] bg-slate-50 z-10">包装单位</th>
            <th class="px-3 py-2 text-left font-medium">商品名称</th>
            <th class="px-3 py-2 text-left font-medium">业务单号</th>
            <th class="px-3 py-2 text-left font-medium">单据类型</th>
            <th class="px-3 py-2 text-left font-medium">动作类型</th>
            <th class="px-3 py-2 text-right font-medium">总库存变动</th>
            <th class="px-3 py-2 text-right font-medium">总库存变动前</th>
            <th class="px-3 py-2 text-right font-medium">总库存变动后</th>
            <th class="px-3 py-2 text-left font-medium">库位</th>
            <th class="px-3 py-2 text-left font-medium">操作人</th>
          </tr></thead>
          <tbody>
            ${seedFlows.map(f => {
              const changeColor = f.totalChange.startsWith('+') ? 'text-emerald-600' : f.totalChange.startsWith('-') ? 'text-red-600' : 'text-slate-500'
              return `
              <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-3 py-2 text-slate-400 text-xs sticky left-0 bg-white z-10 whitespace-nowrap">${f.time}</td>
                <td class="px-3 py-2 text-slate-600 text-xs sticky left-[140px] bg-white z-10 whitespace-nowrap">${f.warehouse}</td>
                <td class="px-3 py-2 font-mono text-xs text-blue-600 sticky left-[260px] bg-white z-10">${f.spu}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-600 sticky left-[370px] bg-white z-10">${f.sku}</td>
                <td class="px-3 py-2 text-slate-500 text-xs sticky left-[480px] bg-white z-10">${f.packageUnit}</td>
                <td class="px-3 py-2 text-slate-700">${f.productName}</td>
                <td class="px-3 py-2"><a href="javascript:void(0)" class="text-blue-600 hover:underline text-xs font-mono">${f.bizNo}</a></td>
                <td class="px-3 py-2 text-slate-500 text-xs">${f.docType}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${actionTypeClass[f.actionType] || 'bg-slate-100 text-slate-600'}">${f.actionType}</span></td>
                <td class="px-3 py-2 text-right font-medium whitespace-nowrap ${changeColor}">${f.totalChange}</td>
                <td class="px-3 py-2 text-right text-slate-500 whitespace-nowrap">${f.totalBefore}</td>
                <td class="px-3 py-2 text-right text-slate-700 font-medium whitespace-nowrap">${f.totalAfter}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-600">${f.location}</td>
                <td class="px-3 py-2 text-slate-600 text-xs">${f.operator}</td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <script>
    window.__wlsRawStockFlow = {
      init() {
        const toggle = document.getElementById('wlsRawFlowToggle');
        const advanced = document.getElementById('wlsRawFlowAdvanced');
        if (toggle && advanced) {
          toggle.addEventListener('click', () => {
            const hidden = advanced.classList.toggle('hidden');
            toggle.textContent = hidden ? '展开筛选' : '收起筛选';
          });
        }
        const pills = document.querySelectorAll('.wls-flow-pill');
        pills.forEach(pill => {
          pill.addEventListener('click', () => {
            pills.forEach(p => { p.className = p.className.replace('bg-blue-600 text-white', 'bg-slate-100 text-slate-600 hover:bg-slate-200'); });
            pill.className = pill.className.replace('bg-slate-100 text-slate-600 hover:bg-slate-200', 'bg-blue-600 text-white');
          });
        });
      }
    };
    window.__wlsRawStockFlow.init();
  </script>`
}
