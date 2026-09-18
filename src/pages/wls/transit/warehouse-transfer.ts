import type { AppState } from '../../../state/store'

type TransferOrder = {
  transferNo: string; fromWarehouse: string; toWarehouse: string
  materialCount: number; packageQty: number; pickedQty: number
  sentQty: number; signedQty: number
  status: '草稿' | '待拣货' | '待发出' | '运输中' | '待签收' | '已签收' | '已取消'
  creator: string; createTime: string
}

const statusClass: Record<string, string> = {
  '草稿': 'bg-slate-100 text-slate-500', '待拣货': 'bg-blue-50 text-blue-700',
  '待发出': 'bg-indigo-50 text-indigo-700', '运输中': 'bg-amber-50 text-amber-700',
  '待签收': 'bg-orange-50 text-orange-700', '已签收': 'bg-emerald-50 text-emerald-700',
  '已取消': 'bg-slate-100 text-slate-400',
}

const seedOrders: TransferOrder[] = [
  { transferNo: 'TR-TF-20260716-001', fromWarehouse: '中央中转仓', toWarehouse: '自有工厂A组', materialCount: 3, packageQty: 12, pickedQty: 12, sentQty: 12, signedQty: 12, status: '已签收', creator: '中转仓文员-小林', createTime: '2026-07-16 08:30' },
  { transferNo: 'TR-TF-20260716-002', fromWarehouse: '中央中转仓', toWarehouse: '第三方工厂-恒盛', materialCount: 2, packageQty: 8, pickedQty: 8, sentQty: 8, signedQty: 0, status: '运输中', creator: '中转仓文员-小林', createTime: '2026-07-16 09:15' },
  { transferNo: 'TR-TF-20260716-003', fromWarehouse: '中央中转仓', toWarehouse: '自有工厂D组', materialCount: 4, packageQty: 15, pickedQty: 15, sentQty: 0, signedQty: 0, status: '待发出', creator: '中转仓文员-小张', createTime: '2026-07-16 10:00' },
  { transferNo: 'TR-TF-20260716-004', fromWarehouse: '中央中转仓', toWarehouse: '自有工厂B组', materialCount: 2, packageQty: 6, pickedQty: 0, sentQty: 0, signedQty: 0, status: '待拣货', creator: '中转仓文员-小张', createTime: '2026-07-16 11:30' },
  { transferNo: 'TR-TF-20260716-005', fromWarehouse: '中央中转仓', toWarehouse: '自有工厂C组', materialCount: 1, packageQty: 3, pickedQty: 0, sentQty: 0, signedQty: 0, status: '草稿', creator: '中转仓文员-小林', createTime: '2026-07-16 13:00' },
  { transferNo: 'TR-TF-20260715-010', fromWarehouse: '中央中转仓', toWarehouse: '第三方工厂-恒盛', materialCount: 3, packageQty: 10, pickedQty: 0, sentQty: 0, signedQty: 0, status: '已取消', creator: '中转仓文员-小林', createTime: '2026-07-15 14:20' },
]

export function renderTransitWarehouseTransfer(_state: AppState): string {
  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold text-slate-800">中转仓 · 调拨管理</h1>
      <button class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">新增调拨单</button>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="搜索调拨单号 / 调出仓 / 调入仓 / 物料SKU" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-80 focus:border-blue-400 focus:outline-none">
        <select class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">全部状态</option>
          <option>草稿</option><option>待拣货</option><option>待发出</option><option>运输中</option><option>待签收</option><option>已签收</option><option>已取消</option>
        </select>
        <select class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
          <option value="">全部仓库</option><option>中央中转仓</option>
        </select>
        <button class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">查询</button>
        <button class="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200">清除</button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span class="text-sm text-slate-500">共 ${seedOrders.length} 条调拨单</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:1280px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">调拨单号</th>
            <th class="px-3 py-2 text-left font-medium">调出仓库</th>
            <th class="px-3 py-2 text-left font-medium">调入仓库</th>
            <th class="px-3 py-2 text-right font-medium">物料种类</th>
            <th class="px-3 py-2 text-right font-medium">调拨数量</th>
            <th class="px-3 py-2 text-right font-medium">已拣数量</th>
            <th class="px-3 py-2 text-right font-medium">已发出</th>
            <th class="px-3 py-2 text-right font-medium">已签收</th>
            <th class="px-3 py-2 text-left font-medium">状态</th>
            <th class="px-3 py-2 text-left font-medium">创建人</th>
            <th class="px-3 py-2 text-left font-medium">创建时间</th>
            <th class="px-3 py-2 text-left font-medium sticky right-0 bg-slate-50">操作</th>
          </tr></thead>
          <tbody>
            ${seedOrders.map(o => `
              <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-3 py-2 font-mono text-xs text-blue-600 cursor-pointer">${o.transferNo}</td>
                <td class="px-3 py-2 text-slate-600">${o.fromWarehouse}</td>
                <td class="px-3 py-2 text-slate-600">${o.toWarehouse}</td>
                <td class="px-3 py-2 text-right text-slate-600">${o.materialCount}</td>
                <td class="px-3 py-2 text-right text-slate-600">${o.packageQty}</td>
                <td class="px-3 py-2 text-right text-slate-600">${o.pickedQty}</td>
                <td class="px-3 py-2 text-right text-slate-600">${o.sentQty}</td>
                <td class="px-3 py-2 text-right ${o.signedQty > 0 ? 'text-emerald-600 font-medium' : 'text-slate-400'}">${o.signedQty}</td>
                <td class="px-3 py-2"><span class="rounded-full px-2 py-0.5 text-xs ${statusClass[o.status]}">${o.status}</span></td>
                <td class="px-3 py-2 text-xs text-slate-500">${o.creator}</td>
                <td class="px-3 py-2 text-xs text-slate-400">${o.createTime}</td>
                <td class="px-3 py-2 sticky right-0 bg-white">
                  <div class="flex items-center gap-1">
                    <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">查看</button>
                    ${o.status === '草稿' ? '<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700">提交</button>' : ''}
                    ${o.status === '待发出' ? '<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700">确认发出</button>' : ''}
                    ${o.status === '运输中' ? '<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700">确认收货</button>' : ''}
                    ${['草稿', '待拣货'].includes(o.status) ? '<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">取消</button>' : ''}
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
        <span class="rounded bg-slate-100 px-2 py-1">草稿</span><span>→</span>
        <span class="rounded bg-blue-50 px-2 py-1 text-blue-700">待拣货</span><span>→</span>
        <span class="rounded bg-indigo-50 px-2 py-1 text-indigo-700">待发出</span><span>→</span>
        <span class="rounded bg-amber-50 px-2 py-1 text-amber-700">运输中</span><span>→</span>
        <span class="rounded bg-orange-50 px-2 py-1 text-orange-700">待签收</span><span>→</span>
        <span class="rounded bg-emerald-50 px-2 py-1 text-emerald-700">已签收</span>
      </div>
    </div>
  </div>
  <script>window.__wlsTransitTransfer = { init() {} }; window.__wlsTransitTransfer.init();</script>`
}
