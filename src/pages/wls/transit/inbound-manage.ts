import type { AppState } from '../../../state/store'

type InboundGroup = {
  receiveNo: string; processorType: '自有工厂' | '第三方工厂'; processorName: string
  receiveStatus: '待收货' | '收货中' | '已收货'
  orders: { inboundNo: string; productionNo: string; skuCount: number; expectedQty: number; receivedQty: number; kitType: string; taskStatus: string; workAreaQty: number }[]
}

const receiveStatusClass: Record<string, string> = {
  '待收货': 'bg-orange-50 text-orange-700', '收货中': 'bg-blue-50 text-blue-700', '已收货': 'bg-emerald-50 text-emerald-700',
}

const seedGroups: InboundGroup[] = [
  { receiveNo: 'TR-RC-20260716-001', processorType: '自有工厂', processorName: '自有工厂A组', receiveStatus: '已收货', orders: [
    { inboundNo: 'TR-IN-20260716-001', productionNo: 'PO14954', skuCount: 2, expectedQty: 8, receivedQty: 8, kitType: '已配齐', taskStatus: '待配齐', workAreaQty: 8 },
    { inboundNo: 'TR-IN-20260716-004', productionNo: 'PO14957', skuCount: 2, expectedQty: 7, receivedQty: 7, kitType: '已配齐', taskStatus: '已配齐', workAreaQty: 0 },
  ]},
  { receiveNo: 'TR-RC-20260716-002', processorType: '第三方工厂', processorName: '第三方工厂-恒盛', receiveStatus: '已收货', orders: [
    { inboundNo: 'TR-IN-20260716-002', productionNo: 'PO14955', skuCount: 2, expectedQty: 11, receivedQty: 8, kitType: '未配齐', taskStatus: '待上架', workAreaQty: 8 },
  ]},
  { receiveNo: 'TR-RC-20260716-003', processorType: '自有工厂', processorName: '自有工厂B组', receiveStatus: '收货中', orders: [
    { inboundNo: 'TR-IN-20260716-003', productionNo: 'PO14956', skuCount: 3, expectedQty: 13, receivedQty: 5, kitType: '未配齐', taskStatus: '待上架', workAreaQty: 5 },
  ]},
  { receiveNo: 'TR-RC-20260716-004', processorType: '自有工厂', processorName: '自有工厂C组', receiveStatus: '待收货', orders: [
    { inboundNo: 'TR-IN-20260716-006', productionNo: 'PO14959', skuCount: 2, expectedQty: 8, receivedQty: 0, kitType: '—', taskStatus: '—', workAreaQty: 0 },
    { inboundNo: 'TR-IN-20260716-007', productionNo: 'PO14960', skuCount: 2, expectedQty: 10, receivedQty: 0, kitType: '—', taskStatus: '—', workAreaQty: 0 },
    { inboundNo: 'TR-IN-20260716-008', productionNo: 'PO14961', skuCount: 2, expectedQty: 6, receivedQty: 0, kitType: '—', taskStatus: '—', workAreaQty: 0 },
  ]},
  { receiveNo: 'TR-RC-20260716-005', processorType: '自有工厂', processorName: '自有工厂D组', receiveStatus: '已收货', orders: [
    { inboundNo: 'TR-IN-20260716-009', productionNo: 'PO14962', skuCount: 2, expectedQty: 8, receivedQty: 8, kitType: '已配齐', taskStatus: '已配齐', workAreaQty: 0 },
    { inboundNo: 'TR-IN-20260716-010', productionNo: 'PO14963', skuCount: 2, expectedQty: 9, receivedQty: 8, kitType: '已配齐（需配货）', taskStatus: '待配齐', workAreaQty: 6 },
    { inboundNo: 'TR-IN-20260716-011', productionNo: 'PO14964', skuCount: 2, expectedQty: 13, receivedQty: 5, kitType: '未配齐', taskStatus: '待上架', workAreaQty: 5 },
  ]},
]

const boardCards = [
  { label: '待收货', value: 1, scope: '实时', scopeClass: 'bg-orange-50 text-orange-600' },
  { label: '收货中', value: 1, scope: '实时', scopeClass: 'bg-orange-50 text-orange-600' },
  { label: '期间已收货', value: 3, scope: '期间', scopeClass: 'bg-emerald-50 text-emerald-600' },
  { label: '待上架任务数', value: 3, scope: '实时', scopeClass: 'bg-orange-50 text-orange-600' },
  { label: '待配齐任务数', value: 2, scope: '实时', scopeClass: 'bg-orange-50 text-orange-600' },
  { label: '期间已上架任务数', value: 2, scope: '期间', scopeClass: 'bg-emerald-50 text-emerald-600' },
  { label: '期间已配齐任务数', value: 3, scope: '期间', scopeClass: 'bg-emerald-50 text-emerald-600' },
]

export function renderTransitInboundManage(_state: AppState): string {
  const totalOrders = seedGroups.reduce((s, g) => s + g.orders.length, 0)

  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-slate-800">中转仓 · 收货单管理</h1>
      <div class="flex items-center gap-2">
        <button class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">手动创建收货单</button>
        <button class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">批量收货</button>
        <button class="rounded-lg border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">打印收货单</button>
        <button class="rounded-lg border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">打印收货后任务单</button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center gap-3 mb-3">
        <input type="text" placeholder="收货单号 / 预入库单号 / 生产单号" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-72 focus:border-blue-400 focus:outline-none">
        <select class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">全部状态</option><option>待收货</option><option>收货中</option><option>已收货</option>
        </select>
        <input type="date" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
        <input type="date" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
        <button class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">查询</button>
        <button class="rounded-lg bg-slate-100 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200">重置</button>
      </div>
      <div class="grid grid-cols-4 md:grid-cols-7 gap-2">
        ${boardCards.map(c => `
          <div class="rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:border-blue-400 transition-colors">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-500">${c.label}</span>
              <span class="rounded-full px-1.5 py-0.5 text-[10px] ${c.scopeClass}">${c.scope}</span>
            </div>
            <div class="text-xl font-bold text-slate-800 mt-1">${c.value}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-1.5 text-xs text-slate-500"><input type="checkbox" class="rounded"> 全选</label>
          <span class="text-sm text-slate-500">共 ${seedGroups.length} 组收货单 / ${totalOrders} 条预入库单</span>
        </div>
        <div class="flex items-center gap-2">
          <button class="rounded-lg bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-40" disabled>上架完成</button>
          <button class="rounded-lg bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-40" disabled>配料完成</button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1540px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-2 py-2 w-8"></th>
            <th class="px-3 py-2 text-left font-medium">收货单号</th>
            <th class="px-3 py-2 text-left font-medium">预入库单号</th>
            <th class="px-3 py-2 text-left font-medium">生产单号</th>
            <th class="px-3 py-2 text-left font-medium">加工方类型</th>
            <th class="px-3 py-2 text-left font-medium">加工方名称</th>
            <th class="px-3 py-2 text-right font-medium">应收SKU数</th>
            <th class="px-3 py-2 text-right font-medium">应收数量</th>
            <th class="px-3 py-2 text-right font-medium">累计实收</th>
            <th class="px-3 py-2 text-left font-medium">收货状态</th>
            <th class="px-3 py-2 text-left font-medium">齐套类型</th>
            <th class="px-3 py-2 text-left font-medium">任务状态</th>
            <th class="px-3 py-2 text-right font-medium">作业区剩余</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody>
            ${seedGroups.map(g => g.orders.map((o, i) => `
              <tr class="border-t border-slate-100 hover:bg-slate-50">
                ${i === 0 ? `<td class="px-2 py-2 text-center" rowspan="${g.orders.length}"><input type="checkbox" class="rounded"></td>
                <td class="px-3 py-2 font-mono text-xs text-blue-600" rowspan="${g.orders.length}" title="${g.receiveNo}">${g.receiveNo}</td>` : ''}
                <td class="px-3 py-2 font-mono text-xs text-slate-600">${o.inboundNo}</td>
                <td class="px-3 py-2 text-slate-700">${o.productionNo}</td>
                ${i === 0 ? `<td class="px-3 py-2 text-slate-500" rowspan="${g.orders.length}">${g.processorType}</td>
                <td class="px-3 py-2 text-slate-600" rowspan="${g.orders.length}">${g.processorName}</td>` : ''}
                <td class="px-3 py-2 text-right text-slate-600">${o.skuCount}</td>
                <td class="px-3 py-2 text-right text-slate-600">${o.expectedQty}</td>
                <td class="px-3 py-2 text-right text-slate-700 font-medium">${o.receivedQty}</td>
                ${i === 0 ? `<td class="px-3 py-2" rowspan="${g.orders.length}"><span class="rounded-full px-2 py-0.5 text-xs ${receiveStatusClass[g.receiveStatus]}">${g.receiveStatus}</span></td>` : ''}
                <td class="px-3 py-2 text-slate-600 text-xs">${o.kitType}</td>
                <td class="px-3 py-2 text-slate-600 text-xs">${o.taskStatus}</td>
                <td class="px-3 py-2 text-right text-slate-600">${o.workAreaQty}</td>
                <td class="px-3 py-2 sticky right-0 bg-white">
                  <div class="flex items-center gap-1">
                    <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">查看明细</button>
                    ${g.receiveStatus !== '已收货' ? '<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700">收货</button>' : ''}
                  </div>
                </td>
              </tr>
            `).join('')).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <script>
    window.__wlsTransitInbound = {
      init() {
        const cards = document.querySelectorAll('[data-board-card]');
        cards.forEach(c => c.addEventListener('click', () => {}));
      }
    };
    window.__wlsTransitInbound.init();
  </script>`
}
