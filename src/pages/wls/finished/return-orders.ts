import type { AppState } from '../../../state/store'

type ReturnLine = { sku: string; name: string; spec: string; qty: number; receivedQty: number; defectQty: number }
type ReturnOrder = {
  id: string; returnNo: string; orderNo: string; shipNo: string; platform: string; customer: string
  status: string; reason: string; created: string; deadline: string; warehouse: string
  totalQty: number; receivedQty: number; defectQty: number; lines: ReturnLine[]
}

const statusLabel: Record<string, string> = {
  WAIT_RECEIVE: '待收货', WAIT_QC: '待质检', WAIT_INBOUND: '待入库',
  WAIT_PUTAWAY: '待上架', PARTIAL_PUTAWAY: '部分上架', COMPLETED: '已完成',
}

function badgeClass(s: string): string {
  if (['COMPLETED'].includes(s)) return 'bg-emerald-50 text-emerald-700'
  if (['WAIT_PUTAWAY', 'PARTIAL_PUTAWAY'].includes(s)) return 'bg-amber-50 text-amber-700'
  if (['WAIT_RECEIVE', 'WAIT_QC'].includes(s)) return 'bg-blue-50 text-blue-700'
  return 'bg-slate-50 text-slate-600'
}

const seedOrders: ReturnOrder[] = [
  { id: 'RO-001', returnNo: 'RET-20260828-001', orderNo: 'SO-20260820-012', shipNo: 'SF-20260825-001', platform: 'TikTok', customer: '张三', status: 'WAIT_RECEIVE', reason: '尺码不符', created: '2026-08-28 09:00', deadline: '2026-08-30 18:00', warehouse: '成衣仓', totalQty: 3, receivedQty: 0, defectQty: 0, lines: [
    { sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', spec: '黑色/M', qty: 2, receivedQty: 0, defectQty: 0 },
    { sku: 'SKU-TEE-WHT-L', name: '白色短袖 L', spec: '白色/L', qty: 1, receivedQty: 0, defectQty: 0 },
  ]},
  { id: 'RO-002', returnNo: 'RET-20260828-002', orderNo: 'SO-20260821-008', shipNo: 'SF-20260825-002', platform: 'Shopee', customer: '李四', status: 'WAIT_QC', reason: '质量问题', created: '2026-08-28 10:30', deadline: '2026-08-30 12:00', warehouse: '成衣仓', totalQty: 2, receivedQty: 2, defectQty: 0, lines: [
    { sku: 'SKU-JACKET-KHA-S', name: '卡其夹克 S', spec: '卡其/S', qty: 1, receivedQty: 1, defectQty: 0 },
    { sku: 'SKU-PANTS-BLK-M', name: '黑色休闲裤 M', spec: '黑色/M', qty: 1, receivedQty: 1, defectQty: 0 },
  ]},
  { id: 'RO-003', returnNo: 'RET-20260828-003', orderNo: 'SO-20260822-015', shipNo: 'SF-20260826-001', platform: '独立站', customer: '王五', status: 'WAIT_INBOUND', reason: '不喜欢', created: '2026-08-28 11:00', deadline: '2026-08-31 18:00', warehouse: '成衣仓', totalQty: 1, receivedQty: 1, defectQty: 0, lines: [
    { sku: 'SKU-SKIRT-GRY-M', name: '灰色百褶裙 M', spec: '灰色/M', qty: 1, receivedQty: 1, defectQty: 0 },
  ]},
  { id: 'RO-004', returnNo: 'RET-20260828-004', orderNo: 'SO-20260823-003', shipNo: 'SF-20260826-002', platform: 'TikTok', customer: '赵六', status: 'WAIT_PUTAWAY', reason: '发错商品', created: '2026-08-28 13:00', deadline: '2026-08-31 10:00', warehouse: '成衣仓', totalQty: 4, receivedQty: 4, defectQty: 1, lines: [
    { sku: 'SKU-HOOD-BLK-M', name: '黑色连帽卫衣 M', spec: '黑色/M', qty: 2, receivedQty: 2, defectQty: 0 },
    { sku: 'SKU-JEAN-BLU-L', name: '蓝色牛仔裤 L', spec: '蓝色/L', qty: 2, receivedQty: 2, defectQty: 1 },
  ]},
  { id: 'RO-005', returnNo: 'RET-20260827-010', orderNo: 'SO-20260819-022', shipNo: 'SF-20260824-005', platform: 'Shopee', customer: '孙七', status: 'COMPLETED', reason: '尺码不符', created: '2026-08-27 08:00', deadline: '2026-08-29 18:00', warehouse: '成衣仓', totalQty: 2, receivedQty: 2, defectQty: 0, lines: [
    { sku: 'SKU-CARD-WHT-M', name: '针织开衫 米白 M', spec: '米白/M', qty: 1, receivedQty: 1, defectQty: 0 },
    { sku: 'SKU-VEST-BLK-M', name: '黑色马甲 M', spec: '黑色/M', qty: 1, receivedQty: 1, defectQty: 0 },
  ]},
  { id: 'RO-006', returnNo: 'RET-20260827-011', orderNo: 'SO-20260819-025', shipNo: 'SF-20260824-008', platform: '独立站', customer: '周八', status: 'PARTIAL_PUTAWAY', reason: '质量问题', created: '2026-08-27 09:30', deadline: '2026-08-30 12:00', warehouse: '成衣仓', totalQty: 3, receivedQty: 3, defectQty: 2, lines: [
    { sku: 'SKU-DRESS-BLK-S', name: '黑色连衣裙 S', spec: '黑色/S', qty: 1, receivedQty: 1, defectQty: 1 },
    { sku: 'SKU-TEE-WHT-M', name: '白色短袖 M', spec: '白色/M', qty: 2, receivedQty: 2, defectQty: 1 },
  ]},
]

const statusFilters = ['WAIT_RECEIVE', 'WAIT_QC', 'WAIT_INBOUND', 'WAIT_PUTAWAY']

export function renderReturnOrders(_state: AppState): string {
  const rows = seedOrders.map(o => {
    const linesSummary = o.lines.map(l => `${l.name} ×${l.qty}`).join('、')
    return `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
      <td class="px-3 py-2 text-xs text-slate-500"><input type="checkbox" class="rounded" data-id="${o.id}"/></td>
      <td class="px-3 py-2 text-xs font-medium text-[var(--link)]">${o.returnNo}</td>
      <td class="px-3 py-2 text-xs text-slate-600">${o.orderNo}</td>
      <td class="px-3 py-2 text-xs text-slate-600">${o.shipNo}</td>
      <td class="px-3 py-2 text-xs"><span class="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">${o.platform}</span></td>
      <td class="px-3 py-2 text-xs text-slate-600">${o.customer}</td>
      <td class="px-3 py-2 text-xs"><span class="rounded-full px-2 py-0.5 text-xs ${badgeClass(o.status)}">${statusLabel[o.status] || o.status}</span></td>
      <td class="px-3 py-2 text-xs text-slate-600">${o.reason}</td>
      <td class="px-3 py-2 text-xs text-slate-600">${o.totalQty}</td>
      <td class="px-3 py-2 text-xs text-slate-600">${o.receivedQty}</td>
      <td class="px-3 py-2 text-xs ${o.defectQty > 0 ? 'text-orange-600 font-medium' : 'text-slate-600'}">${o.defectQty}</td>
      <td class="px-3 py-2 text-xs text-slate-500">${o.created}</td>
      <td class="px-3 py-2 text-xs">
        <button onclick="window.__wlsReturnOrders?.viewDetail('${o.id}')" class="rounded border border-[var(--border-subtle)] px-2 py-0.5 text-xs text-[var(--link)] hover:bg-[var(--bg-hover)]">开始收货</button>
      </td>
    </tr>`
  }).join('')

  const filterBtns = statusFilters.map(s =>
    `<button class="rounded-md border px-3 py-1 text-xs ${s === 'WAIT_RECEIVE' ? 'border-[var(--link)] bg-[var(--link)] text-white' : 'border-[var(--border-subtle)] text-slate-600 hover:bg-[var(--bg-hover)]'}">${statusLabel[s]}</button>`
  ).join('')

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">退货收货列表</h1>
      <div class="flex gap-2">
        <button class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600 hover:bg-[var(--bg-hover)]">导出</button>
      </div>
    </div>

    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="搜索退货单号 / 原订单号 / 发货单号 / 客户…" class="w-[480px] rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <div class="flex gap-1">${filterBtns}</div>
        <button class="text-xs text-slate-400 hover:text-slate-600">清除筛选</button>
      </div>
    </div>

    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">共 ${seedOrders.length} 条记录</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1500px] text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2 w-8"></th>
              <th class="px-3 py-2">退货单号</th>
              <th class="px-3 py-2">原订单号</th>
              <th class="px-3 py-2">发货单号</th>
              <th class="px-3 py-2">平台</th>
              <th class="px-3 py-2">客户</th>
              <th class="px-3 py-2">状态</th>
              <th class="px-3 py-2">退货原因</th>
              <th class="px-3 py-2 text-right">应退数量</th>
              <th class="px-3 py-2 text-right">已收数量</th>
              <th class="px-3 py-2 text-right">不良数量</th>
              <th class="px-3 py-2">创建时间</th>
              <th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>

    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <h3 class="mb-2 text-sm font-semibold text-slate-700">业务逻辑说明</h3>
      <table class="w-full text-xs text-slate-600">
        <thead class="bg-slate-50"><tr><th class="px-3 py-1.5 text-left">环节</th><th class="px-3 py-1.5 text-left">说明</th></tr></thead>
        <tbody>
          <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-1.5 font-medium">待收货</td><td class="px-3 py-1.5">退货快递到达，仓管扫码确认收货，逐行录入实收数量与不良数量</td></tr>
          <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-1.5 font-medium">待质检</td><td class="px-3 py-1.5">收货完成后自动流转到质检环节，质检员逐件判定可售 / 瑕疵 / 报废</td></tr>
          <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-1.5 font-medium">待入库</td><td class="px-3 py-1.5">质检完成后生成入库任务，按质检结果分配到可售 / 瑕疵 / 破损库存</td></tr>
          <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-1.5 font-medium">待上架 → 已完成</td><td class="px-3 py-1.5">仓管按推荐库位上架，全部上架完成即流转为已完成</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <script>
    window.__wlsReturnOrders = {
      viewDetail(id) { console.log('view return order detail:', id); },
    };
  </script>`
}
