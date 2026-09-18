import type { AppState } from '../../../state/store'

type QcLine = { sku: string; name: string; spec: string; receivedQty: number; qualityResult: '可售' | '瑕疵' | '报废' | null }
type QcOrder = {
  id: string; returnNo: string; orderNo: string; customer: string; reason: string
  created: string; receivedTime: string; totalQty: number; qcDone: number; lines: QcLine[]
}

function qualityBadge(r: string | null): string {
  if (r === '可售') return '<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">可售</span>'
  if (r === '瑕疵') return '<span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">瑕疵</span>'
  if (r === '报废') return '<span class="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">报废</span>'
  return '<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">待选择</span>'
}

const seedOrders: QcOrder[] = [
  { id: 'QC-001', returnNo: 'RET-20260828-002', orderNo: 'SO-20260821-008', customer: '李四', reason: '质量问题', created: '2026-08-28 10:30', receivedTime: '2026-08-28 14:20', totalQty: 2, qcDone: 0, lines: [
    { sku: 'SKU-JACKET-KHA-S', name: '卡其夹克 S', spec: '卡其/S', receivedQty: 1, qualityResult: null },
    { sku: 'SKU-PANTS-BLK-M', name: '黑色休闲裤 M', spec: '黑色/M', receivedQty: 1, qualityResult: null },
  ]},
  { id: 'QC-002', returnNo: 'RET-20260828-006', orderNo: 'SO-20260823-011', customer: '吴九', reason: '色差严重', created: '2026-08-28 15:00', receivedTime: '2026-08-28 16:30', totalQty: 3, qcDone: 1, lines: [
    { sku: 'SKU-DRESS-RED-M', name: '红色连衣裙 M', spec: '红色/M', receivedQty: 2, qualityResult: '瑕疵' },
    { sku: 'SKU-BLOUSE-WHT-S', name: '白色衬衫 S', spec: '白色/S', receivedQty: 1, qualityResult: null },
  ]},
  { id: 'QC-003', returnNo: 'RET-20260828-007', orderNo: 'SO-20260824-002', customer: '郑十', reason: '面料破损', created: '2026-08-28 16:00', receivedTime: '2026-08-28 17:10', totalQty: 1, qcDone: 0, lines: [
    { sku: 'SKU-COAT-NAVY-L', name: '藏青大衣 L', spec: '藏青/L', receivedQty: 1, qualityResult: null },
  ]},
  { id: 'QC-004', returnNo: 'RET-20260827-012', orderNo: 'SO-20260820-030', customer: '陈一一', reason: '尺码发错', created: '2026-08-27 11:00', receivedTime: '2026-08-27 15:40', totalQty: 2, qcDone: 2, lines: [
    { sku: 'SKU-TEE-BLU-M', name: '蓝色短袖 M', spec: '蓝色/M', receivedQty: 1, qualityResult: '可售' },
    { sku: 'SKU-TEE-BLU-L', name: '蓝色短袖 L', spec: '蓝色/L', receivedQty: 1, qualityResult: '可售' },
  ]},
  { id: 'QC-005', returnNo: 'RET-20260827-013', orderNo: 'SO-20260820-033', customer: '黄二二', reason: '脱线', created: '2026-08-27 14:00', receivedTime: '2026-08-27 16:50', totalQty: 4, qcDone: 2, lines: [
    { sku: 'SKU-SKIRT-PNK-S', name: '粉色半裙 S', spec: '粉色/S', receivedQty: 2, qualityResult: '报废' },
    { sku: 'SKU-CARD-BEI-M', name: '米色开衫 M', spec: '米色/M', receivedQty: 2, qualityResult: '可售' },
  ]},
]

export function renderReturnQuality(_state: AppState): string {
  const rows = seedOrders.map(o => {
    const lineResults = o.lines.map(l => qualityBadge(l.qualityResult)).join(' ')
    return `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
      <td class="px-3 py-2 text-xs text-slate-500"><input type="checkbox" class="rounded" data-id="${o.id}"/></td>
      <td class="px-3 py-2 text-xs font-medium text-[var(--link)]">${o.returnNo}</td>
      <td class="px-3 py-2 text-xs text-slate-600">${o.orderNo}</td>
      <td class="px-3 py-2 text-xs text-slate-600">${o.customer}</td>
      <td class="px-3 py-2 text-xs text-slate-600">${o.reason}</td>
      <td class="px-3 py-2 text-xs text-slate-600">${o.totalQty}</td>
      <td class="px-3 py-2 text-xs text-slate-600">${o.qcDone} / ${o.lines.length}</td>
      <td class="px-3 py-2 text-xs">${lineResults}</td>
      <td class="px-3 py-2 text-xs text-slate-500">${o.receivedTime}</td>
      <td class="px-3 py-2 text-xs">
        <button onclick="window.__wlsReturnQuality?.submitQc('${o.id}')" class="rounded border border-[var(--border-subtle)] px-2 py-0.5 text-xs text-[var(--link)] hover:bg-[var(--bg-hover)]">提交质检</button>
      </td>
    </tr>`
  }).join('')

  const pending = seedOrders.filter(o => o.qcDone < o.lines.length).length
  const done = seedOrders.filter(o => o.qcDone >= o.lines.length).length

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">退货质检列表</h1>
      <div class="flex gap-2">
        <button class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600 hover:bg-[var(--bg-hover)]">导出</button>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">待质检</div>
        <div class="mt-1 text-xl font-semibold text-blue-600">${pending}</div>
      </div>
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">已完成质检</div>
        <div class="mt-1 text-xl font-semibold text-emerald-600">${done}</div>
      </div>
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">总退货单</div>
        <div class="mt-1 text-xl font-semibold text-slate-700">${seedOrders.length}</div>
      </div>
    </div>

    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">共 ${seedOrders.length} 条记录</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1220px] text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2 w-8"></th>
              <th class="px-3 py-2">退货单号</th>
              <th class="px-3 py-2">原订单号</th>
              <th class="px-3 py-2">客户</th>
              <th class="px-3 py-2">退货原因</th>
              <th class="px-3 py-2 text-right">退货数量</th>
              <th class="px-3 py-2 text-right">质检进度</th>
              <th class="px-3 py-2">质检结果</th>
              <th class="px-3 py-2">收货时间</th>
              <th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>

    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <h3 class="mb-2 text-sm font-semibold text-slate-700">质检规则说明</h3>
      <table class="w-full text-xs text-slate-600">
        <thead class="bg-slate-50"><tr><th class="px-3 py-1.5 text-left">结果</th><th class="px-3 py-1.5 text-left">库存去向</th><th class="px-3 py-1.5 text-left">说明</th></tr></thead>
        <tbody>
          <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-1.5"><span class="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">可售</span></td><td class="px-3 py-1.5">可售库存</td><td class="px-3 py-1.5">商品完好，可直接重新入库销售</td></tr>
          <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-1.5"><span class="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">瑕疵</span></td><td class="px-3 py-1.5">瑕疵库存</td><td class="px-3 py-1.5">存在轻微瑕疵，进入瑕疵库存单独管理</td></tr>
          <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-1.5"><span class="rounded-full bg-red-50 px-2 py-0.5 text-red-700">报废</span></td><td class="px-3 py-1.5">破损库存</td><td class="px-3 py-1.5">严重损坏无法销售，进入报损流程</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <script>
    window.__wlsReturnQuality = {
      submitQc(id) { console.log('submit quality check:', id); },
    };
  </script>`
}
