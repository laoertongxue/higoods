import type { AppState } from '../../../state/store'

type SorterMachine = {
  code: string; name: string; type: 'EXPRESS_SORT' | 'RETURN_REJECT_SORT'
  warehouse: string; identifyType: string; defaultExceptionGate: string
  gateCount: number; status: '启用' | '停用'
}

const typeLabel: Record<string, string> = { EXPRESS_SORT: '快递分拣', RETURN_REJECT_SORT: '退货拒收分拣' }

const seedMachines: SorterMachine[] = [
  { code: 'SORTER-001', name: '快递分拣机 01', type: 'EXPRESS_SORT', warehouse: '成衣仓', identifyType: 'TRACKING_NO', defaultExceptionGate: 'GATE-EX-01', gateCount: 12, status: '启用' },
  { code: 'SORTER-002', name: '拒收分拣机 01', type: 'RETURN_REJECT_SORT', warehouse: '成衣仓', identifyType: 'RETURN_NO', defaultExceptionGate: 'GATE-EX-02', gateCount: 8, status: '启用' },
  { code: 'SORTER-003', name: '快递分拣机 02', type: 'EXPRESS_SORT', warehouse: '成衣仓', identifyType: 'ORDER_NO', defaultExceptionGate: 'GATE-EX-01', gateCount: 10, status: '停用' },
]

export function renderSorterMachineConfig(_state: AppState): string {
  const rows = seedMachines.map(m => `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
    <td class="px-3 py-2 text-xs font-medium text-slate-700">${m.code}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${m.name}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">${typeLabel[m.type]}</span></td>
    <td class="px-3 py-2 text-xs text-slate-600">${m.warehouse}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${m.identifyType}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${m.defaultExceptionGate}</td>
    <td class="px-3 py-2 text-xs text-right text-slate-600">${m.gateCount}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded-full px-2 py-0.5 text-xs ${m.status === '启用' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${m.status}</span></td>
    <td class="px-3 py-2 text-xs space-x-2">
      <button class="text-[var(--link)] hover:underline">编辑</button>
      <button onclick="window.__wlsSorterMachine?.goGateConfig('${m.code}')" class="text-[var(--link)] hover:underline">格口配置</button>
      <button onclick="window.__wlsSorterMachine?.goRecords('${m.code}')" class="text-[var(--link)] hover:underline">查看记录</button>
    </td>
  </tr>`).join('')

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">分拣机配置</h1>
      <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">新增分拣机</button>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2">机器编号</th><th class="px-3 py-2">机器名称</th><th class="px-3 py-2">机器类型</th>
              <th class="px-3 py-2">所属仓库</th><th class="px-3 py-2">识别号码类型</th><th class="px-3 py-2">默认异常口</th>
              <th class="px-3 py-2 text-right">格口数量</th><th class="px-3 py-2">状态</th><th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <h3 class="mb-2 text-sm font-semibold text-slate-700">业务逻辑说明</h3>
      <table class="w-full text-xs text-slate-600">
        <thead class="bg-slate-50"><tr><th class="px-3 py-1.5 text-left">配置项</th><th class="px-3 py-1.5 text-left">说明</th></tr></thead>
        <tbody>
          <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-1.5 font-medium">识别号码类型</td><td class="px-3 py-1.5">支持运单号、订单号、出库单号、退货单号、自定义编码，决定分拣机扫码时以哪个字段匹配格口</td></tr>
          <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-1.5 font-medium">默认异常口</td><td class="px-3 py-1.5">无法匹配到任何格口时，包裹自动落入异常口等待人工处理</td></tr>
          <tr class="border-t border-[var(--border-subtle)]"><td class="px-3 py-1.5 font-medium">格口数量</td><td class="px-3 py-1.5">分拣机物理格口总数，含 1 个异常口；格口配置页面管理每个格口的匹配规则</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <script>window.__wlsSorterMachine = { goGateConfig(c) { console.log('gate config:', c); }, goRecords(c) { console.log('records:', c); } };</script>`
}
