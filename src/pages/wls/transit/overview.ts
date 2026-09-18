import type { AppState } from '../../../state/store'

type MetricCard = { label: string; value: number; unit: string; scope: string; scopeClass: string; target: string }

const metrics: MetricCard[] = [
  { label: '待完成收货单数', value: 3, unit: '单', scope: '当前存量', scopeClass: 'bg-orange-50 text-orange-700', target: '/wls/transit/receive-manage' },
  { label: '期间已收货单数', value: 5, unit: '单', scope: '期间完成', scopeClass: 'bg-emerald-50 text-emerald-700', target: '/wls/transit/inbound-manage' },
  { label: '期间实收卷数', value: 38, unit: '卷', scope: '期间完成', scopeClass: 'bg-emerald-50 text-emerald-700', target: '/wls/transit/inbound-manage' },
  { label: '待上架任务数', value: 3, unit: '个', scope: '当前存量', scopeClass: 'bg-orange-50 text-orange-700', target: '/wls/transit/putaway-manage' },
  { label: '待配齐任务数', value: 4, unit: '个', scope: '当前存量', scopeClass: 'bg-orange-50 text-orange-700', target: '/wls/transit/allocation-manage' },
  { label: '期间已上架任务数', value: 2, unit: '个', scope: '期间完成', scopeClass: 'bg-emerald-50 text-emerald-700', target: '/wls/transit/putaway-manage' },
  { label: '期间已配齐任务数', value: 3, unit: '个', scope: '期间完成', scopeClass: 'bg-emerald-50 text-emerald-700', target: '/wls/transit/allocation-manage' },
  { label: '配料差异待处理数', value: 2, unit: '条', scope: '当前存量', scopeClass: 'bg-red-50 text-red-700', target: '/wls/transit/kit-center' },
]

const trendData = [
  { date: '2026-07-14', receipts: 2, rolls: 14 },
  { date: '2026-07-15', receipts: 3, rolls: 22 },
  { date: '2026-07-16', receipts: 5, rolls: 38 },
]

const taskDistribution = [
  { label: '待上架', value: 3, color: 'bg-orange-100 text-orange-700' },
  { label: '已上架', value: 2, color: 'bg-emerald-100 text-emerald-700' },
  { label: '待配齐', value: 4, color: 'bg-indigo-100 text-indigo-700' },
  { label: '已配齐', value: 3, color: 'bg-emerald-100 text-emerald-700' },
]

const productionStatus = [
  { label: '缺货', value: 1, color: 'bg-red-500' },
  { label: '未收齐', value: 3, color: 'bg-amber-500' },
  { label: '已收齐', value: 5, color: 'bg-emerald-500' },
]

const allocationTypes = [
  { label: '已收齐配料', value: 4, color: 'bg-emerald-100 text-emerald-700' },
  { label: '未收齐配料', value: 3, color: 'bg-amber-100 text-amber-700' },
]

const anomalyRows = [
  { exceptionNo: 'EX-20260716-001', productionNo: 'PO14958', allocationNo: 'TR-AL-20260716-005', sku: 'FAB-PO14958-A', plannedQty: 7, actualQty: 6, diffQty: 1, unit: 'Y', status: '待处理', time: '2026-07-16 09:43' },
  { exceptionNo: 'EX-20260716-002', productionNo: 'PO14956', allocationNo: 'TR-PW-20260716-003', sku: 'FAB-PO14956-A', plannedQty: 10, actualQty: 4, diffQty: 6, unit: 'Y', status: '待处理', time: '2026-07-16 11:21' },
]

const maxRolls = Math.max(...trendData.map(d => d.rolls), 1)

export function renderTransitOverview(): string {
  return `
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-slate-800">中转仓 · 数据总览</h1>
        <p class="mt-1 text-xs text-slate-400">当前账号有权限的中转仓数据汇总</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex rounded-lg border border-slate-200 text-xs">
          <button class="px-3 py-1.5 rounded-l-lg bg-blue-600 text-white">今天</button>
          <button class="px-3 py-1.5 border-l border-slate-200 text-slate-600 hover:bg-slate-50">近7天</button>
          <button class="px-3 py-1.5 border-l border-slate-200 text-slate-600 hover:bg-slate-50">近30天</button>
          <button class="px-3 py-1.5 border-l border-slate-200 rounded-r-lg text-slate-600 hover:bg-slate-50">自定义</button>
        </div>
        <button class="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200">重置</button>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${metrics.map(m => `
        <a href="${m.target}" class="block rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow cursor-pointer">
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-500">${m.label}</span>
            <span class="rounded-full px-2 py-0.5 text-[10px] ${m.scopeClass}">${m.scope}</span>
          </div>
          <div class="mt-2 flex items-baseline gap-1">
            <span class="text-2xl font-bold text-slate-800">${m.value}</span>
            <span class="text-xs text-slate-400">${m.unit}</span>
          </div>
        </a>
      `).join('')}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <h3 class="text-sm font-semibold text-slate-700 mb-3">收货趋势</h3>
        <div class="space-y-2">
          ${trendData.map(d => `
            <div class="flex items-center gap-3">
              <span class="w-20 text-xs text-slate-500 shrink-0">${d.date.slice(5)}</span>
              <div class="flex-1 space-y-1">
                <div class="flex items-center gap-2">
                  <div class="h-4 rounded bg-blue-500" style="width:${(d.receipts / 5) * 100}%"></div>
                  <span class="text-xs text-slate-500">${d.receipts} 单</span>
                </div>
                <div class="flex items-center gap-2">
                  <div class="h-4 rounded bg-emerald-500" style="width:${(d.rolls / maxRolls) * 100}%"></div>
                  <span class="text-xs text-slate-500">${d.rolls} 卷</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <h3 class="text-sm font-semibold text-slate-700 mb-3">任务分布</h3>
        <div class="grid grid-cols-2 gap-3">
          ${taskDistribution.map(t => `
            <div class="rounded-lg ${t.color} p-4 text-center">
              <div class="text-2xl font-bold">${t.value}</div>
              <div class="text-xs mt-1">${t.label}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <h3 class="text-sm font-semibold text-slate-700 mb-3">生产单收货状态</h3>
        <div class="space-y-2">
          ${productionStatus.map(p => `
            <div class="flex items-center gap-3">
              <span class="w-16 text-xs text-slate-500">${p.label}</span>
              <div class="flex-1 h-6 rounded bg-slate-100 overflow-hidden">
                <div class="h-full ${p.color} rounded flex items-center justify-center text-white text-xs font-medium" style="width:${(p.value / 9) * 100}%">${p.value}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <h3 class="text-sm font-semibold text-slate-700 mb-3">配料类型分布</h3>
        <div class="grid grid-cols-2 gap-3">
          ${allocationTypes.map(a => `
            <div class="rounded-lg ${a.color} p-4 text-center">
              <div class="text-2xl font-bold">${a.value}</div>
              <div class="text-xs mt-1">${a.label}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-slate-700">异常待办</h3>
          <span class="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px]">${anomalyRows.length} 条待处理</span>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="min-width:900px">
          <thead><tr class="bg-slate-50 text-slate-500 text-xs">
            <th class="px-3 py-2 text-left font-medium">异常单号</th>
            <th class="px-3 py-2 text-left font-medium">生产单号</th>
            <th class="px-3 py-2 text-left font-medium">配料单号</th>
            <th class="px-3 py-2 text-left font-medium">SKU</th>
            <th class="px-3 py-2 text-right font-medium">计划数量</th>
            <th class="px-3 py-2 text-right font-medium">实际数量</th>
            <th class="px-3 py-2 text-right font-medium">差异数量</th>
            <th class="px-3 py-2 text-left font-medium">状态</th>
            <th class="px-3 py-2 text-left font-medium">发生时间</th>
          </tr></thead>
          <tbody>
            ${anomalyRows.map(r => `
              <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-3 py-2 text-blue-600 cursor-pointer">${r.exceptionNo}</td>
                <td class="px-3 py-2 text-slate-700">${r.productionNo}</td>
                <td class="px-3 py-2 text-slate-500">${r.allocationNo}</td>
                <td class="px-3 py-2 text-slate-500 font-mono text-xs">${r.sku}</td>
                <td class="px-3 py-2 text-right text-slate-600">${r.plannedQty} ${r.unit}</td>
                <td class="px-3 py-2 text-right text-slate-600">${r.actualQty} ${r.unit}</td>
                <td class="px-3 py-2 text-right text-red-600 font-medium">-${r.diffQty} ${r.unit}</td>
                <td class="px-3 py-2"><span class="rounded-full bg-orange-50 text-orange-700 px-2 py-0.5 text-xs">${r.status}</span></td>
                <td class="px-3 py-2 text-slate-400 text-xs">${r.time}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`
}
