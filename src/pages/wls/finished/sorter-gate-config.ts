import type { AppState } from '../../../state/store'

type SorterGate = { machineCode: string; gateCode: string; gateName: string; usage: string; matchValue: string; isException: boolean; status: '启用' | '停用' }

const seedGates: SorterGate[] = [
  { machineCode: 'SORTER-001', gateCode: 'GATE-01', gateName: '顺丰格口', usage: '快递公司匹配', matchValue: '顺丰速运', isException: false, status: '启用' },
  { machineCode: 'SORTER-001', gateCode: 'GATE-02', gateName: '中通格口', usage: '快递公司匹配', matchValue: '中通快递', isException: false, status: '启用' },
  { machineCode: 'SORTER-001', gateCode: 'GATE-03', gateName: '圆通格口', usage: '快递公司匹配', matchValue: '圆通速递', isException: false, status: '启用' },
  { machineCode: 'SORTER-001', gateCode: 'GATE-04', gateName: '韵达格口', usage: '快递公司匹配', matchValue: '韵达快递', isException: false, status: '启用' },
  { machineCode: 'SORTER-001', gateCode: 'GATE-EX-01', gateName: '异常口', usage: '异常兜底', matchValue: '-', isException: true, status: '启用' },
  { machineCode: 'SORTER-002', gateCode: 'GATE-01', gateName: '可售退货', usage: '质检结果匹配', matchValue: '可售', isException: false, status: '启用' },
  { machineCode: 'SORTER-002', gateCode: 'GATE-02', gateName: '瑕疵退货', usage: '质检结果匹配', matchValue: '瑕疵', isException: false, status: '启用' },
  { machineCode: 'SORTER-002', gateCode: 'GATE-EX-02', gateName: '异常口', usage: '异常兜底', matchValue: '-', isException: true, status: '启用' },
]

export function renderSorterGateConfig(_state: AppState): string {
  const rows = seedGates.map(g => `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
    <td class="px-3 py-2 text-xs font-medium text-slate-700">${g.gateCode}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${g.gateName}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${g.usage}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${g.matchValue}</td>
    <td class="px-3 py-2 text-xs">${g.isException ? '<span class="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">是</span>' : '<span class="text-slate-400">否</span>'}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded-full px-2 py-0.5 text-xs ${g.status === '启用' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${g.status}</span></td>
    <td class="px-3 py-2 text-xs space-x-2">
      <button class="text-[var(--link)] hover:underline">编辑</button>
      <button class="text-red-500 hover:underline">${g.isException ? '禁用' : '删除'}</button>
    </td>
  </tr>`).join('')

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">格口配置</h1>
      <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">新增格口</button>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <div class="flex items-center gap-3">
        <span class="text-xs text-slate-500">选择分拣机：</span>
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>SORTER-001 快递分拣机 01</option>
          <option>SORTER-002 拒收分拣机 01</option>
          <option>SORTER-003 快递分拣机 02</option>
        </select>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">共 ${seedGates.length} 个格口</div>
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2">格口编号</th><th class="px-3 py-2">格口名称</th><th class="px-3 py-2">格口用途</th>
              <th class="px-3 py-2">匹配值</th><th class="px-3 py-2">是否异常口</th><th class="px-3 py-2">状态</th><th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>
  <script>window.__wlsSorterGate = {};</script>`
}
