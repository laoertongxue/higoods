import type { AppState } from '../../../state/store'

type ExceptionRecord = {
  id: string; time: string; machineCode: string; machineName: string; machineType: string
  scanCode: string; identifyType: string; matchValue: string; targetGate: string
  exceptionType: string; reason: string; weight: string; handled: boolean; handler?: string; handleTime?: string
}

const exceptionTypeLabel: Record<string, string> = {
  NO_MATCH: '无匹配格口', CODE_INVALID: '编码格式无效', DUPLICATE: '重复扫描',
  WEIGHT_OVER: '超重', MULTI_MATCH: '多格口匹配', GATE_FULL: '格口已满',
  NETWORK_ERROR: '网络异常', OTHER: '其他',
}

const seedRecords: ExceptionRecord[] = [
  { id: 'EX-001', time: '2026-08-29 09:15:30', machineCode: 'SORTER-001', machineName: '快递分拣机 01', machineType: '快递分拣', scanCode: 'SF2026082900001', identifyType: '运单号', matchValue: '-', targetGate: 'GATE-EX-01', exceptionType: 'NO_MATCH', reason: '快递公司不在格口配置中', weight: '1.2kg', handled: true, handler: '张伟', handleTime: '2026-08-29 09:20:00' },
  { id: 'EX-002', time: '2026-08-29 10:02:15', machineCode: 'SORTER-001', machineName: '快递分拣机 01', machineType: '快递分拣', scanCode: 'INVALID-CODE', identifyType: '运单号', matchValue: '-', targetGate: 'GATE-EX-01', exceptionType: 'CODE_INVALID', reason: '条码无法识别', weight: '0.8kg', handled: false },
  { id: 'EX-003', time: '2026-08-29 10:30:00', machineCode: 'SORTER-002', machineName: '拒收分拣机 01', machineType: '退货拒收分拣', scanCode: 'RET-20260829-005', identifyType: '退货单号', matchValue: '-', targetGate: 'GATE-EX-02', exceptionType: 'WEIGHT_OVER', reason: '包裹重量超出格口承载', weight: '12.5kg', handled: false },
  { id: 'EX-004', time: '2026-08-28 16:45:00', machineCode: 'SORTER-001', machineName: '快递分拣机 01', machineType: '快递分拣', scanCode: 'ZT2026082800055', identifyType: '运单号', matchValue: '中通快递', targetGate: 'GATE-02', exceptionType: 'GATE_FULL', reason: '中通格口已满，需人工清口', weight: '0.5kg', handled: true, handler: '李娜', handleTime: '2026-08-28 16:50:00' },
]

export function renderSorterRecords(_state: AppState): string {
  const rows = seedRecords.map(r => `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
    <td class="px-3 py-2 text-xs text-slate-500">${r.time}</td>
    <td class="px-3 py-2 text-xs font-medium text-slate-700">${r.machineCode}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${r.machineName}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${r.machineType}</td>
    <td class="px-3 py-2 text-xs text-slate-600 font-mono">${r.scanCode}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${r.identifyType}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${r.targetGate}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">${exceptionTypeLabel[r.exceptionType] || r.exceptionType}</span></td>
    <td class="px-3 py-2 text-xs text-slate-600">${r.reason}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${r.weight}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded-full px-2 py-0.5 text-xs ${r.handled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${r.handled ? '已处理' : '未处理'}</span></td>
    <td class="px-3 py-2 text-xs space-x-2">
      <button class="text-[var(--link)] hover:underline">查看详情</button>
      ${!r.handled ? `<button class="text-[var(--link)] hover:underline">标记已处理</button>` : ''}
    </td>
  </tr>`).join('')

  const unhandled = seedRecords.filter(r => !r.handled).length

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">分拣异常记录</h1>
    </div>
    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">总异常数</div>
        <div class="mt-1 text-xl font-semibold text-slate-700">${seedRecords.length}</div>
      </div>
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">未处理</div>
        <div class="mt-1 text-xl font-semibold text-orange-600">${unhandled}</div>
      </div>
      <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <div class="text-xs text-slate-500">已处理</div>
        <div class="mt-1 text-xl font-semibold text-emerald-600">${seedRecords.length - unhandled}</div>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="搜索扫描号码 / 机器编号…" class="w-[300px] rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部机器类型</option><option>快递分拣</option><option>退货拒收分拣</option>
        </select>
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部异常类型</option>
          ${Object.values(exceptionTypeLabel).map(v => `<option>${v}</option>`).join('')}
        </select>
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部处理状态</option><option>已处理</option><option>未处理</option>
        </select>
        <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">查询</button>
        <button class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600 hover:bg-[var(--bg-hover)]">重置</button>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">共 ${seedRecords.length} 条记录</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1400px] text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2">异常时间</th><th class="px-3 py-2">机器编号</th><th class="px-3 py-2">机器名称</th>
              <th class="px-3 py-2">机器类型</th><th class="px-3 py-2">扫描号码</th><th class="px-3 py-2">识别类型</th>
              <th class="px-3 py-2">目标异常口</th><th class="px-3 py-2">异常类型</th><th class="px-3 py-2">异常原因</th>
              <th class="px-3 py-2">重量</th><th class="px-3 py-2">处理状态</th><th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>
  <script>window.__wlsSorterRecords = {};</script>`
}
