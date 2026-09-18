import type { AppState } from '../../../state/store'

type InboundLine = { sku: string; name: string; spec: string; qty: number; qualityResult: '可售' | '瑕疵' | '报废'; stockDest: string; putawayQty: number; targetLocation: string }
type InboundOrder = {
  id: string; returnNo: string; orderNo: string; customer: string; reason: string
  status: string; created: string; qcTime: string; totalQty: number; putawayQty: number; lines: InboundLine[]
}

const statusLabel: Record<string, string> = {
  WAIT_INBOUND: '待入库', WAIT_PUTAWAY: '待上架', PARTIAL_PUTAWAY: '部分上架', COMPLETED: '上架完成',
}

function badgeClass(s: string): string {
  if (s === 'COMPLETED') return 'bg-emerald-50 text-emerald-700'
  if (['WAIT_PUTAWAY', 'PARTIAL_PUTAWAY'].includes(s)) return 'bg-amber-50 text-amber-700'
  return 'bg-blue-50 text-blue-700'
}

function qualityTag(r: string): string {
  if (r === '可售') return 'bg-emerald-50 text-emerald-700'
  if (r === '瑕疵') return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-700'
}

function stockDest(r: string): string {
  if (r === '可售') return '现货库存'
  if (r === '瑕疵') return '瑕疵库存'
  return '破损库存'
}

const seedOrders: InboundOrder[] = [
  { id: 'RI-001', returnNo: 'RET-20260828-003', orderNo: 'SO-20260822-015', customer: '王五', reason: '不喜欢', status: 'WAIT_PUTAWAY', created: '2026-08-28 11:00', qcTime: '2026-08-28 15:00', totalQty: 1, putawayQty: 0, lines: [
    { sku: 'SKU-SKIRT-GRY-M', name: '灰色百褶裙 M', spec: '灰色/M', qty: 1, qualityResult: '可售', stockDest: stockDest('可售'), putawayQty: 0, targetLocation: 'A01-05' },
  ]},
  { id: 'RI-002', returnNo: 'RET-20260828-004', orderNo: 'SO-20260823-003', customer: '赵六', reason: '发错商品', status: 'WAIT_PUTAWAY', created: '2026-08-28 13:00', qcTime: '2026-08-28 16:30', totalQty: 4, putawayQty: 0, lines: [
    { sku: 'SKU-HOOD-BLK-M', name: '黑色连帽卫衣 M', spec: '黑色/M', qty: 2, qualityResult: '可售', stockDest: stockDest('可售'), putawayQty: 0, targetLocation: 'A02-01' },
    { sku: 'SKU-JEAN-BLU-L', name: '蓝色牛仔裤 L', spec: '蓝色/L', qty: 2, qualityResult: '瑕疵', stockDest: stockDest('瑕疵'), putawayQty: 0, targetLocation: 'D01-03' },
  ]},
  { id: 'RI-003', returnNo: 'RET-20260827-011', orderNo: 'SO-20260819-025', customer: '周八', reason: '质量问题', status: 'PARTIAL_PUTAWAY', created: '2026-08-27 09:30', qcTime: '2026-08-27 14:00', totalQty: 3, putawayQty: 1, lines: [
    { sku: 'SKU-DRESS-BLK-S', name: '黑色连衣裙 S', spec: '黑色/S', qty: 1, qualityResult: '瑕疵', stockDest: stockDest('瑕疵'), putawayQty: 1, targetLocation: 'D01-05' },
    { sku: 'SKU-TEE-WHT-M', name: '白色短袖 M', spec: '白色/M', qty: 2, qualityResult: '报废', stockDest: stockDest('报废'), putawayQty: 0, targetLocation: 'E02-01' },
  ]},
  { id: 'RI-004', returnNo: 'RET-20260827-010', orderNo: 'SO-20260819-022', customer: '孙七', reason: '尺码不符', status: 'COMPLETED', created: '2026-08-27 08:00', qcTime: '2026-08-27 11:00', totalQty: 2, putawayQty: 2, lines: [
    { sku: 'SKU-CARD-WHT-M', name: '针织开衫 米白 M', spec: '米白/M', qty: 1, qualityResult: '可售', stockDest: stockDest('可售'), putawayQty: 1, targetLocation: 'A03-02' },
    { sku: 'SKU-VEST-BLK-M', name: '黑色马甲 M', spec: '黑色/M', qty: 1, qualityResult: '可售', stockDest: stockDest('可售'), putawayQty: 1, targetLocation: 'A03-04' },
  ]},
  { id: 'RI-005', returnNo: 'RET-20260827-014', orderNo: 'SO-20260821-040', customer: '林三三', reason: '线头多', status: 'WAIT_INBOUND', created: '2026-08-27 15:00', qcTime: '2026-08-27 17:30', totalQty: 2, putawayQty: 0, lines: [
    { sku: 'SKU-SHIRT-BLU-M', name: '蓝色衬衫 M', spec: '蓝色/M', qty: 1, qualityResult: '可售', stockDest: stockDest('可售'), putawayQty: 0, targetLocation: 'A04-01' },
    { sku: 'SKU-SHIRT-BLU-L', name: '蓝色衬衫 L', spec: '蓝色/L', qty: 1, qualityResult: '可售', stockDest: stockDest('可售'), putawayQty: 0, targetLocation: 'A04-02' },
  ]},
]

export function renderReturnInbound(_state: AppState): string {
  const rows = seedOrders.map(o => {
    const linesHtml = o.lines.map(l =>
      `<div class="flex items-center gap-2 text-xs">
        <span class="text-slate-600">${l.name} ×${l.qty}</span>
        <span class="rounded-full px-1.5 py-0.5 text-[10px] ${qualityTag(l.qualityResult)}">${l.qualityResult}</span>
        <span class="text-slate-400">→ ${l.stockDest}</span>
      </div>`
    ).join('')
    return `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
      <td class="px-3 py-2 text-xs text-slate-500"><input type="checkbox" class="rounded" data-id="${o.id}"/></td>
      <td class="px-3 py-2 text-xs font-medium text-[var(--link)]">${o.returnNo}</td>
      <td class="px-3 py-2 text-xs text-slate-600">${o.orderNo}</td>
      <td class="px-3 py-2 text-xs text-slate-600">${o.customer}</td>
      <td class="px-3 py-2 text-xs"><span class="rounded-full px-2 py-0.5 text-xs ${badgeClass(o.status)}">${statusLabel[o.status] || o.status}</span></td>
      <td class="px-3 py-2 text-xs text-slate-600">${o.totalQty}</td>
      <td class="px-3 py-2 text-xs text-slate-600">${o.putawayQty} / ${o.totalQty}</td>
      <td class="px-3 py-2 text-xs space-y-1">${linesHtml}</td>
      <td class="px-3 py-2 text-xs text-slate-500">${o.qcTime}</td>
      <td class="px-3 py-2 text-xs">
        ${o.status !== 'COMPLETED' ? `<button onclick="window.__wlsReturnInbound?.putaway('${o.id}')" class="rounded border border-[var(--border-subtle)] px-2 py-0.5 text-xs text-[var(--link)] hover:bg-[var(--bg-hover)]">上架</button>` : '<span class="text-slate-400">—</span>'}
      </td>
    </tr>`
  }).join('')

  const pending = seedOrders.filter(o => ['WAIT_INBOUND', 'WAIT_PUTAWAY'].includes(o.status)).length
  const putting = seedOrders.filter(o => o.status === 'PARTIAL_PUTAWAY').length
  const done = seedOrders.filter(o => o.status === 'COMPLETED').length

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">退货入库列表</h1>
      <div class="flex gap-2">
        <button class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600 hover:bg-[var(--bg-hover)]">导出</button>
      </div>
    </div>

    <div class="grid grid-cols-4 gap-3">
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">待入库</div>
        <div class="mt-1 text-xl font-semibold text-blue-600">${pending}</div>
      </div>
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">部分上架</div>
        <div class="mt-1 text-xl font-semibold text-amber-600">${putting}</div>
      </div>
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">上架完成</div>
        <div class="mt-1 text-xl font-semibold text-emerald-600">${done}</div>
      </div>
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">总入库单</div>
        <div class="mt-1 text-xl font-semibold text-slate-700">${seedOrders.length}</div>
      </div>
    </div>

    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">共 ${seedOrders.length} 条记录</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1460px] text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2 w-8"></th>
              <th class="px-3 py-2">退货单号</th>
              <th class="px-3 py-2">原订单号</th>
              <th class="px-3 py-2">客户</th>
              <th class="px-3 py-2">状态</th>
              <th class="px-3 py-2 text-right">总数量</th>
              <th class="px-3 py-2 text-right">上架进度</th>
              <th class="px-3 py-2">库存去向</th>
              <th class="px-3 py-2">质检时间</th>
              <th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>

    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <h3 class="mb-2 text-sm font-semibold text-slate-700">上架规则说明</h3>
      <table class="w-full text-xs text-slate-600">
        <thead class="bg-slate-50"><tr><th class="px-3 py-1.5 text-left">质检结果</th><th class="px-3 py-1.5 text-left">库存去向</th><th class="px-3 py-1.5 text-left">推荐库位规则</th></tr></thead>
        <tbody>
          <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-1.5">可售</td><td class="px-3 py-1.5">现货库存</td><td class="px-3 py-1.5">优先推荐原出库位，其次同 SKU 最近空库位</td></tr>
          <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-1.5">瑕疵</td><td class="px-3 py-1.5">瑕疵库存</td><td class="px-3 py-1.5">统一放入瑕疵专区 D 区</td></tr>
          <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-1.5">报废</td><td class="px-3 py-1.5">破损库存</td><td class="px-3 py-1.5">统一放入报损专区 E 区，等待后续处理</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <script>
    window.__wlsReturnInbound = {
      putaway(id) { console.log('putaway return inbound:', id); },
    };
  </script>`
}
