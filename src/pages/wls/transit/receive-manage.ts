import type { AppState } from '../../../state/store'

type PreInboundOrder = {
  inboundNo: string; productionNo: string; processorName: string; source: string
  expectedRolls: number; requiredQty: number; receivedQty: number
  status: '待收货' | '部分收货' | '已收货' | '已失效'; createTime: string
}

const statusClass: Record<string, string> = {
  '待收货': 'bg-orange-50 text-orange-700', '部分收货': 'bg-blue-50 text-blue-700',
  '已收货': 'bg-emerald-50 text-emerald-700', '已失效': 'bg-slate-100 text-slate-400',
}

const seedOrders: PreInboundOrder[] = [
  { inboundNo: 'TR-IN-20260716-001', productionNo: 'PO14954', processorName: '自有工厂A组', source: '印花厂', expectedRolls: 6, requiredQty: 8, receivedQty: 8, status: '已收货', createTime: '2026-07-16 09:36' },
  { inboundNo: 'TR-IN-20260716-004', productionNo: 'PO14957', processorName: '自有工厂A组', source: '印花厂', expectedRolls: 7, requiredQty: 7, receivedQty: 7, status: '已收货', createTime: '2026-07-16 09:39' },
  { inboundNo: 'TR-IN-20260716-005', productionNo: 'PO14958', processorName: '第三方工厂-恒盛', source: '染色厂', expectedRolls: 9, requiredQty: 9, receivedQty: 8, status: '部分收货', createTime: '2026-07-16 09:43' },
  { inboundNo: 'TR-IN-20260716-002', productionNo: 'PO14955', processorName: '第三方工厂-恒盛', source: '染色厂', expectedRolls: 8, requiredQty: 11, receivedQty: 8, status: '已收货', createTime: '2026-07-16 10:46' },
  { inboundNo: 'TR-IN-20260716-003', productionNo: 'PO14956', processorName: '自有工厂B组', source: '异地中央仓', expectedRolls: 10, requiredQty: 13, receivedQty: 5, status: '部分收货', createTime: '2026-07-16 11:21' },
  { inboundNo: 'TR-IN-20260716-006', productionNo: 'PO14959', processorName: '自有工厂C组', source: '印花厂', expectedRolls: 8, requiredQty: 8, receivedQty: 0, status: '待收货', createTime: '2026-07-16 13:10' },
  { inboundNo: 'TR-IN-20260716-007', productionNo: 'PO14960', processorName: '第三方工厂-恒盛', source: '染色厂', expectedRolls: 10, requiredQty: 10, receivedQty: 0, status: '待收货', createTime: '2026-07-16 13:25' },
  { inboundNo: 'TR-IN-20260716-008', productionNo: 'PO14961', processorName: '自有工厂C组', source: '其他', expectedRolls: 6, requiredQty: 6, receivedQty: 0, status: '待收货', createTime: '2026-07-16 13:40' },
  { inboundNo: 'TR-IN-20260716-009', productionNo: 'PO14962', processorName: '自有工厂D组', source: '印花厂', expectedRolls: 8, requiredQty: 8, receivedQty: 8, status: '已收货', createTime: '2026-07-16 15:06' },
  { inboundNo: 'TR-IN-20260716-010', productionNo: 'PO14963', processorName: '自有工厂D组', source: '染色厂', expectedRolls: 9, requiredQty: 9, receivedQty: 8, status: '部分收货', createTime: '2026-07-16 15:13' },
  { inboundNo: 'TR-IN-20260715-020', productionNo: 'PO14940', processorName: '自有工厂A组', source: '印花厂', expectedRolls: 5, requiredQty: 5, receivedQty: 5, status: '已失效', createTime: '2026-07-15 08:30' },
]

export function renderTransitReceiveManage(_state: AppState): string {
  const statusCounts = { '待收货': 0, '部分收货': 0, '已收货': 0, '已失效': 0 }
  seedOrders.forEach(o => { statusCounts[o.status as keyof typeof statusCounts]++ })

  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-slate-800">中转仓 · 预入库单管理</h1>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="预入库单号 / 来源单 / 加工方" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-72 focus:border-blue-400 focus:outline-none">
        <select class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">全部状态</option>
          <option value="待收货">待收货 (${statusCounts['待收货']})</option>
          <option value="部分收货">部分收货 (${statusCounts['部分收货']})</option>
          <option value="已收货">已收货 (${statusCounts['已收货']})</option>
          <option value="已失效">已失效 (${statusCounts['已失效']})</option>
        </select>
        <button class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">查询</button>
        <button class="rounded-lg bg-slate-100 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200">重置</button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedOrders.length} 条记录</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1120px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">预入库单号</th>
            <th class="px-3 py-2 text-left font-medium">来源单</th>
            <th class="px-3 py-2 text-left font-medium">来源</th>
            <th class="px-3 py-2 text-left font-medium">加工方</th>
            <th class="px-3 py-2 text-right font-medium">应收卷数</th>
            <th class="px-3 py-2 text-right font-medium">应收数量</th>
            <th class="px-3 py-2 text-right font-medium">实收数量</th>
            <th class="px-3 py-2 text-left font-medium">状态</th>
            <th class="px-3 py-2 text-left font-medium">创建时间</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody>
            ${seedOrders.map(o => `
              <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-3 py-2 text-slate-700 font-mono text-xs" title="${o.inboundNo}">${o.inboundNo}</td>
                <td class="px-3 py-2 text-slate-700">${o.productionNo}</td>
                <td class="px-3 py-2 text-slate-500">${o.source}</td>
                <td class="px-3 py-2 text-slate-600">${o.processorName}</td>
                <td class="px-3 py-2 text-right text-slate-600">${o.expectedRolls}</td>
                <td class="px-3 py-2 text-right text-slate-600">${o.requiredQty}</td>
                <td class="px-3 py-2 text-right text-slate-700 font-medium">${o.receivedQty}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${statusClass[o.status]}">${o.status}</span></td>
                <td class="px-3 py-2 text-slate-400 text-xs">${o.createTime}</td>
                <td class="px-3 py-2 sticky right-0 bg-white">
                  <button class="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">查看详情</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <h3 class="text-sm font-semibold text-slate-700 mb-2">功能逻辑说明</h3>
      <table class="w-full text-xs text-slate-600">
        <thead><tr class="bg-slate-50"><th class="px-3 py-2 text-left font-medium">状态</th><th class="px-3 py-2 text-left font-medium">含义</th></tr></thead>
        <tbody>
          <tr class="border-t border-slate-100"><td class="px-3 py-2">待收货</td><td class="px-3 py-2">预入库单已创建，等待实物到达中转仓</td></tr>
          <tr class="border-t border-slate-100"><td class="px-3 py-2">部分收货</td><td class="px-3 py-2">部分物料已扫码收货，仍有物料未收齐</td></tr>
          <tr class="border-t border-slate-100"><td class="px-3 py-2">已收货</td><td class="px-3 py-2">全部物料已收货完成，进入后续齐套判断</td></tr>
          <tr class="border-t border-slate-100"><td class="px-3 py-2">已失效</td><td class="px-3 py-2">预入库单已被作废，不再参与收货流程</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <script>
    window.__wlsTransitReceive = {
      init() {
        const select = document.querySelector('select');
        if (select) select.addEventListener('change', () => {});
      }
    };
    window.__wlsTransitReceive.init();
  </script>`
}
