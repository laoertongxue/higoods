import type { AppState } from '../../../state/store'

type DetailRecord = { scanTime: string; packageNo: string; shipNo: string; orderNo: string; sku: string; name: string; qty: number; result: '成功' | '异常'; exceptionReason?: string }
type ScanBatch = {
  id: string; batchNo: string; warehouse: string; express: string; operator: string
  status: string; created: string; completed: string; totalQty: number; successQty: number; exceptionQty: number
  details: DetailRecord[]
}

const exceptionLabels: Record<string, string> = {
  NOT_FOUND: '面单不存在', WRONG_WAREHOUSE: '不属于当前仓库', STATUS_DENIED: '状态不允许出库',
  ALREADY_SHIPPED: '已出库', DUPLICATE: '重复扫描', EXPRESS_MISMATCH: '快递公司不匹配',
  ORDER_CANCELLED: '订单已取消', NON_FINISHED: '非成衣仓出库', OTHER: '其他',
}

const statusLabel: Record<string, string> = {
  COMPLETED: '已完成', EXCEPTION: '有异常', IN_PROGRESS: '扫码中',
}

function badgeClass(s: string): string {
  if (s === 'COMPLETED') return 'bg-emerald-50 text-emerald-700'
  if (s === 'EXCEPTION') return 'bg-orange-50 text-orange-700'
  return 'bg-blue-50 text-blue-700'
}

const seedBatches: ScanBatch[] = [
  { id: 'SB-001', batchNo: 'SCAN-20260829-001', warehouse: '成衣仓', express: '顺丰速运', operator: '张伟', status: 'COMPLETED', created: '2026-08-29 09:00', completed: '2026-08-29 09:15', totalQty: 8, successQty: 8, exceptionQty: 0, details: [
    { scanTime: '09:01:12', packageNo: 'PKG-001', shipNo: 'SF-20260828-001', orderNo: 'SO-20260828-001', sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', qty: 2, result: '成功' },
    { scanTime: '09:02:30', packageNo: 'PKG-002', shipNo: 'SF-20260828-002', orderNo: 'SO-20260828-002', sku: 'SKU-TEE-WHT-M', name: '白色短袖 M', qty: 1, result: '成功' },
    { scanTime: '09:04:05', packageNo: 'PKG-003', shipNo: 'SF-20260828-003', orderNo: 'SO-20260828-003', sku: 'SKU-JEAN-BLU-L', name: '蓝色牛仔裤 L', qty: 3, result: '成功' },
    { scanTime: '09:06:22', packageNo: 'PKG-004', shipNo: 'SF-20260828-004', orderNo: 'SO-20260828-004', sku: 'SKU-JACKET-KHA-S', name: '卡其夹克 S', qty: 2, result: '成功' },
  ]},
  { id: 'SB-002', batchNo: 'SCAN-20260829-002', warehouse: '成衣仓', express: '中通快递', operator: '李娜', status: 'EXCEPTION', created: '2026-08-29 09:30', completed: '-', totalQty: 5, successQty: 3, exceptionQty: 2, details: [
    { scanTime: '09:31:10', packageNo: 'PKG-005', shipNo: 'ZT-20260828-001', orderNo: 'SO-20260828-005', sku: 'SKU-HOOD-BLK-M', name: '黑色连帽卫衣 M', qty: 1, result: '成功' },
    { scanTime: '09:32:45', packageNo: 'PKG-006', shipNo: 'ZT-20260828-002', orderNo: 'SO-20260828-006', sku: 'SKU-SKIRT-GRY-M', name: '灰色百褶裙 M', qty: 2, result: '异常', exceptionReason: 'NOT_FOUND' },
    { scanTime: '09:34:20', packageNo: 'PKG-007', shipNo: 'ZT-20260828-003', orderNo: 'SO-20260828-007', sku: 'SKU-CARD-WHT-M', name: '针织开衫 米白 M', qty: 1, result: '异常', exceptionReason: 'ORDER_CANCELLED' },
    { scanTime: '09:36:00', packageNo: 'PKG-008', shipNo: 'ZT-20260828-004', orderNo: 'SO-20260828-008', sku: 'SKU-VEST-BLK-M', name: '黑色马甲 M', qty: 1, result: '成功' },
  ]},
  { id: 'SB-003', batchNo: 'SCAN-20260829-003', warehouse: '成衣仓', express: '圆通速递', operator: '张伟', status: 'IN_PROGRESS', created: '2026-08-29 10:00', completed: '-', totalQty: 3, successQty: 2, exceptionQty: 1, details: [
    { scanTime: '10:01:30', packageNo: 'PKG-009', shipNo: 'YT-20260829-001', orderNo: 'SO-20260829-001', sku: 'SKU-DRESS-RED-M', name: '红色连衣裙 M', qty: 1, result: '成功' },
    { scanTime: '10:03:15', packageNo: 'PKG-010', shipNo: 'YT-20260829-002', orderNo: 'SO-20260829-002', sku: 'SKU-PANTS-BLK-L', name: '黑色休闲裤 L', qty: 1, result: '异常', exceptionReason: 'EXPRESS_MISMATCH' },
    { scanTime: '10:05:00', packageNo: 'PKG-011', shipNo: 'YT-20260829-003', orderNo: 'SO-20260829-003', sku: 'SKU-BLOUSE-WHT-S', name: '白色衬衫 S', qty: 1, result: '成功' },
  ]},
  { id: 'SB-004', batchNo: 'SCAN-20260828-010', warehouse: '成衣仓', express: '顺丰速运', operator: '王敏', status: 'COMPLETED', created: '2026-08-28 16:00', completed: '2026-08-28 16:20', totalQty: 12, successQty: 12, exceptionQty: 0, details: [
    { scanTime: '16:01:00', packageNo: 'PKG-020', shipNo: 'SF-20260827-010', orderNo: 'SO-20260827-010', sku: 'SKU-COAT-NAVY-L', name: '藏青大衣 L', qty: 1, result: '成功' },
    { scanTime: '16:03:30', packageNo: 'PKG-021', shipNo: 'SF-20260827-011', orderNo: 'SO-20260827-011', sku: 'SKU-SHIRT-BLU-M', name: '蓝色衬衫 M', qty: 2, result: '成功' },
  ]},
  { id: 'SB-005', batchNo: 'SCAN-20260828-011', warehouse: '成衣仓', express: '韵达快递', operator: '李娜', status: 'COMPLETED', created: '2026-08-28 17:00', completed: '2026-08-28 17:10', totalQty: 6, successQty: 6, exceptionQty: 0, details: [] },
]

export function renderShipScan(_state: AppState): string {
  const todayBatches = seedBatches.length
  const todayQty = seedBatches.reduce((s, b) => s + b.totalQty, 0)
  const successQty = seedBatches.reduce((s, b) => s + b.successQty, 0)
  const exceptionQty = seedBatches.reduce((s, b) => s + b.exceptionQty, 0)

  const rows = seedBatches.map(b => `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
    <td class="px-3 py-2 text-xs font-medium text-[var(--link)]">${b.batchNo}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${b.warehouse}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${b.express}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${b.operator}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded-full px-2 py-0.5 text-xs ${badgeClass(b.status)}">${statusLabel[b.status] || b.status}</span></td>
    <td class="px-3 py-2 text-xs text-right text-slate-600">${b.totalQty}</td>
    <td class="px-3 py-2 text-xs text-right text-emerald-600">${b.successQty}</td>
    <td class="px-3 py-2 text-xs text-right ${b.exceptionQty > 0 ? 'text-orange-600 font-medium' : 'text-slate-600'}">${b.exceptionQty}</td>
    <td class="px-3 py-2 text-xs text-slate-500">${b.created}</td>
    <td class="px-3 py-2 text-xs text-slate-500">${b.completed}</td>
    <td class="px-3 py-2 text-xs">
      <button onclick="window.__wlsShipScan?.viewDetail('${b.id}')" class="rounded border border-[var(--border-subtle)] px-2 py-0.5 text-xs text-[var(--link)] hover:bg-[var(--bg-hover)]">查看详情</button>
    </td>
  </tr>`).join('')

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">扫码出库</h1>
      <div class="flex gap-2">
        <button class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600 hover:bg-[var(--bg-hover)]">新建扫码批次</button>
        <button class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600 hover:bg-[var(--bg-hover)]">导出</button>
      </div>
    </div>

    <div class="grid grid-cols-4 gap-3">
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">今日扫码批次</div>
        <div class="mt-1 text-xl font-semibold text-slate-700">${todayBatches}</div>
      </div>
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">今日扫码件数</div>
        <div class="mt-1 text-xl font-semibold text-blue-600">${todayQty}</div>
      </div>
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">成功出库</div>
        <div class="mt-1 text-xl font-semibold text-emerald-600">${successQty}</div>
      </div>
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">异常数量</div>
        <div class="mt-1 text-xl font-semibold text-orange-600">${exceptionQty}</div>
      </div>
    </div>

    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="搜索批次号 / 运单号 / 包裹号…" class="w-[360px] rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部仓库</option><option>成衣仓</option>
        </select>
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部快递</option><option>顺丰速运</option><option>中通快递</option><option>圆通速递</option><option>韵达快递</option>
        </select>
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部状态</option><option>已完成</option><option>有异常</option><option>扫码中</option>
        </select>
        <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">查询</button>
        <button class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600 hover:bg-[var(--bg-hover)]">重置</button>
      </div>
    </div>

    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">共 ${seedBatches.length} 条记录</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1320px] text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2">批次号</th>
              <th class="px-3 py-2">仓库</th>
              <th class="px-3 py-2">快递公司</th>
              <th class="px-3 py-2">操作人</th>
              <th class="px-3 py-2">状态</th>
              <th class="px-3 py-2 text-right">总件数</th>
              <th class="px-3 py-2 text-right">成功</th>
              <th class="px-3 py-2 text-right">异常</th>
              <th class="px-3 py-2">创建时间</th>
              <th class="px-3 py-2">完成时间</th>
              <th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>

    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <h3 class="mb-2 text-sm font-semibold text-slate-700">异常类型说明</h3>
      <div class="grid grid-cols-3 gap-x-6 gap-y-1 text-xs text-slate-600">
        ${Object.entries(exceptionLabels).map(([k, v]) => `<div><span class="font-medium text-slate-700">${v}</span>：${exceptionDesc(k)}</div>`).join('')}
      </div>
    </div>
  </div>
  <script>
    window.__wlsShipScan = {
      viewDetail(id) { console.log('view ship scan batch detail:', id); },
    };
  </script>`
}

function exceptionDesc(key: string): string {
  const map: Record<string, string> = {
    NOT_FOUND: '扫码面单号在系统中不存在',
    WRONG_WAREHOUSE: '该包裹不属于当前仓库',
    STATUS_DENIED: '订单状态不允许出库操作',
    ALREADY_SHIPPED: '该包裹已经完成出库',
    DUPLICATE: '同一包裹在本批次中重复扫描',
    EXPRESS_MISMATCH: '包裹快递公司与选择的不一致',
    ORDER_CANCELLED: '对应订单已被取消',
    NON_FINISHED: '非成衣仓出库的包裹',
    OTHER: '其他未分类异常',
  }
  return map[key] || ''
}
