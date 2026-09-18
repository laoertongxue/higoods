import type { AppState } from '../../../state/store'

type FabricTransfer = {
  id: string; transferNo: string; fromWarehouse: string; toWarehouse: string
  material: string; spu: string; sku: string; productName: string; qty: string
  status: '待调出' | '调拨中' | '待调入确认' | '已完成' | '已取消'
  creator: string; createTime: string; completeTime: string
}

const statusClass: Record<string, string> = {
  '待调出': 'bg-orange-50 text-orange-700',
  '调拨中': 'bg-blue-50 text-blue-700',
  '待调入确认': 'bg-yellow-50 text-yellow-700',
  '已完成': 'bg-emerald-50 text-emerald-700',
  '已取消': 'bg-slate-100 text-slate-400',
}

const seedTransfers: FabricTransfer[] = [
  { id: 'TF-FAB-001', transferNo: 'DB-FAB-20260528-001', fromWarehouse: '中央总仓-面料仓', toWarehouse: '生产车间面料暂存区', material: '面料', spu: 'SPU-FAB-1001', sku: 'SKU-FAB-50001', productName: '莫代尔打底面料', qty: '20 卷 / 1600 米', status: '已完成', creator: 'VM', createTime: '2026-05-28 09:10', completeTime: '2026-05-28 14:30' },
  { id: 'TF-FAB-002', transferNo: 'DB-FAB-20260529-002', fromWarehouse: '中央总仓-面料仓', toWarehouse: '生产车间面料暂存区', material: '面料', spu: 'SPU-FAB-1002', sku: 'SKU-FAB-50003', productName: '精梳棉T恤面料', qty: '10 卷 / 800 米', status: '调拨中', creator: 'Rina', createTime: '2026-05-29 10:20', completeTime: '' },
  { id: 'TF-FAB-003', transferNo: 'DB-FAB-20260529-003', fromWarehouse: '中央总仓-面料仓', toWarehouse: '中转仓-面料区', material: '面料', spu: 'SPU-FAB-1003', sku: 'SKU-FAB-50004', productName: '磨毛保暖面料', qty: '15 卷 / 1200 米', status: '待调出', creator: 'VM', createTime: '2026-05-29 11:30', completeTime: '' },
  { id: 'TF-FAB-004', transferNo: 'DB-FAB-20260530-004', fromWarehouse: '中央总仓-面料仓', toWarehouse: '生产车间面料暂存区', material: '面料', spu: 'SPU-FAB-1001', sku: 'SKU-FAB-50002', productName: '莫代尔打底面料B', qty: '8 卷 / 640 米', status: '待调入确认', creator: 'Rina', createTime: '2026-05-30 09:00', completeTime: '' },
  { id: 'TF-FAB-005', transferNo: 'DB-FAB-20260530-005', fromWarehouse: '中央总仓-面料仓', toWarehouse: '中转仓-面料区', material: '面料', spu: 'SPU-FAB-1004', sku: 'SKU-FAB-50005', productName: '莱赛尔垂感面料', qty: '12 卷 / 960 米', status: '已完成', creator: 'VM', createTime: '2026-05-30 10:00', completeTime: '2026-05-30 15:20' },
  { id: 'TF-FAB-006', transferNo: 'DB-FAB-20260530-006', fromWarehouse: '中央总仓-面料仓', toWarehouse: '生产车间面料暂存区', material: '面料', spu: 'SPU-FAB-1005', sku: 'SKU-FAB-50006', productName: '空气层卫衣面料', qty: '6 卷 / 480 米', status: '已取消', creator: 'Rina', createTime: '2026-05-30 11:00', completeTime: '' },
  { id: 'TF-FAB-007', transferNo: 'DB-FAB-20260530-007', fromWarehouse: '中央总仓-面料仓', toWarehouse: '中转仓-面料区', material: '面料', spu: 'SPU-FAB-1006', sku: 'SKU-FAB-50007', productName: '高弹坑条内搭面料', qty: '18 卷 / 1440 米', status: '待调出', creator: 'VM', createTime: '2026-05-30 13:00', completeTime: '' },
  { id: 'TF-FAB-008', transferNo: 'DB-FAB-20260530-008', fromWarehouse: '中央总仓-面料仓', toWarehouse: '生产车间面料暂存区', material: '面料', spu: 'SPU-FAB-1001', sku: 'SKU-FAB-50001', productName: '莫代尔打底面料', qty: '5 卷 / 400 米', status: '调拨中', creator: 'Dian', createTime: '2026-05-30 14:00', completeTime: '' },
]

export function renderRawFabricTransfer(_state: AppState): string {
  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-slate-800">面料调拨</h1>
        <p class="text-xs text-slate-400 mt-0.5">管理面料仓间调拨，跟踪调出、在途与调入确认状态。</p>
      </div>
      <button class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">新增调拨单</button>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="搜索调拨单号 / 调出仓 / 调入仓 / 商品SKU" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-80 focus:border-blue-400 focus:outline-none">
        <select class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">全部状态</option>
          <option>待调出(2)</option><option>调拨中(2)</option><option>待调入确认(1)</option><option>已完成(2)</option><option>已取消(1)</option>
        </select>
        <select class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">全部调出仓库</option><option>中央总仓-面料仓</option>
        </select>
        <select class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">全部调入仓库</option><option>生产车间面料暂存区</option><option>中转仓-面料区</option>
        </select>
        <button class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">查询</button>
        <button class="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200">重置</button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedTransfers.length} 条调拨单</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1480px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">调拨单号</th>
            <th class="px-3 py-2 text-left font-medium">调出仓库</th>
            <th class="px-3 py-2 text-left font-medium">调入仓库</th>
            <th class="px-3 py-2 text-left font-medium">物料类型</th>
            <th class="px-3 py-2 text-left font-medium">商品SPU</th>
            <th class="px-3 py-2 text-left font-medium">商品SKU</th>
            <th class="px-3 py-2 text-left font-medium">商品名称</th>
            <th class="px-3 py-2 text-left font-medium">调拨数量</th>
            <th class="px-3 py-2 text-left font-medium">状态</th>
            <th class="px-3 py-2 text-left font-medium">创建人</th>
            <th class="px-3 py-2 text-left font-medium">创建时间</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody>
            ${seedTransfers.map(o => `
              <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-3 py-2 font-mono text-xs text-blue-600 cursor-pointer">${o.transferNo}</td>
                <td class="px-3 py-2 text-slate-600">${o.fromWarehouse}</td>
                <td class="px-3 py-2 text-slate-600">${o.toWarehouse}</td>
                <td class="px-3 py-2"><span class="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs">${o.material}</span></td>
                <td class="px-3 py-2 font-mono text-xs text-slate-600">${o.spu}</td>
                <td class="px-3 py-2 font-mono text-xs text-slate-600">${o.sku}</td>
                <td class="px-3 py-2 text-slate-700">${o.productName}</td>
                <td class="px-3 py-2 text-slate-600">${o.qty}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${statusClass[o.status]}">${o.status}</span></td>
                <td class="px-3 py-2 text-xs text-slate-500">${o.creator}</td>
                <td class="px-3 py-2 text-xs text-slate-400">${o.createTime}</td>
                <td class="px-3 py-2 sticky right-0 bg-white">
                  <div class="flex items-center gap-1">
                    ${o.status === '待调出' ? '<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700">确认调出</button>' : ''}
                    ${o.status === '调拨中' ? '<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">查看物流</button>' : ''}
                    ${o.status === '待调入确认' ? '<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700">确认调入</button>' : ''}
                    ${o.status === '已完成' ? '<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">查看</button>' : ''}
                    ${o.status === '已取消' ? '<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">查看</button>' : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <h3 class="text-sm font-semibold text-slate-700 mb-2">调拨流程说明</h3>
      <div class="flex items-center gap-2 text-xs text-slate-500">
        <span class="rounded bg-orange-50 px-2 py-1 text-orange-700">待调出</span><span>→</span>
        <span class="rounded bg-blue-50 px-2 py-1 text-blue-700">调拨中</span><span>→</span>
        <span class="rounded bg-yellow-50 px-2 py-1 text-yellow-700">待调入确认</span><span>→</span>
        <span class="rounded bg-emerald-50 px-2 py-1 text-emerald-700">已完成</span>
      </div>
    </div>
  </div>
  <script>window.__wlsRawFabricTransfer = { init() {} }; window.__wlsRawFabricTransfer.init();</script>`
}
