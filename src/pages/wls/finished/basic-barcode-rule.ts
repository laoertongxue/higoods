import type { AppState } from '../../../state/store'

type BarcodeRule = { id: string; name: string; objectType: string; prefix: string; dateFormat: string; serialLength: number; enabled: boolean; example: string }

const seedRules: BarcodeRule[] = [
  { id: 'BR-001', name: '出库单号规则', objectType: '出库单', prefix: 'SO', dateFormat: 'YYYYMMDD', serialLength: 4, enabled: true, example: 'SO-20260829-0001' },
  { id: 'BR-002', name: '入库单号规则', objectType: '入库单', prefix: 'SI', dateFormat: 'YYYYMMDD', serialLength: 4, enabled: true, example: 'SI-20260829-0001' },
  { id: 'BR-003', name: '波次号规则', objectType: '波次', prefix: 'WV', dateFormat: 'YYYYMMDD', serialLength: 3, enabled: true, example: 'WV-20260829-001' },
  { id: 'BR-004', name: '拣货篮编号规则', objectType: '拣货篮', prefix: 'BK', dateFormat: 'NONE', serialLength: 5, enabled: true, example: 'BK-00001' },
  { id: 'BR-005', name: '集货箱编号规则', objectType: '集货箱', prefix: 'BOX', dateFormat: 'NONE', serialLength: 3, enabled: true, example: 'BOX-001' },
  { id: 'BR-006', name: '退货单号规则', objectType: '退货单', prefix: 'RET', dateFormat: 'YYYYMMDD', serialLength: 3, enabled: false, example: 'RET-20260829-001' },
]

export function renderBasicBarcodeRule(_state: AppState): string {
  const rows = seedRules.map(r => `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
    <td class="px-3 py-2 text-xs text-slate-700">${r.name}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${r.objectType}</td>
    <td class="px-3 py-2 text-xs font-mono text-slate-600">${r.prefix}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${r.dateFormat}</td>
    <td class="px-3 py-2 text-xs text-right text-slate-600">${r.serialLength}</td>
    <td class="px-3 py-2 text-xs font-mono text-slate-500">${r.example}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded-full px-2 py-0.5 text-xs ${r.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${r.enabled ? '启用' : '停用'}</span></td>
    <td class="px-3 py-2 text-xs space-x-2">
      <button class="text-[var(--link)] hover:underline">编辑</button>
      <button class="text-[var(--link)] hover:underline">${r.enabled ? '停用' : '启用'}</button>
    </td>
  </tr>`).join('')

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">条码规则管理</h1>
      <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">新增规则</button>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部条码对象</option><option>出库单</option><option>入库单</option><option>波次</option><option>拣货篮</option><option>集货箱</option><option>退货单</option>
        </select>
        <input type="text" placeholder="规则名称" class="w-[200px] rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部状态</option><option>启用</option><option>停用</option>
        </select>
        <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">查询</button>
        <button class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600 hover:bg-[var(--bg-hover)]">重置</button>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">共 ${seedRules.length} 条记录</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1100px] text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2">规则名称</th><th class="px-3 py-2">条码对象</th><th class="px-3 py-2">编码前缀</th>
              <th class="px-3 py-2">日期格式</th><th class="px-3 py-2 text-right">流水位数</th><th class="px-3 py-2">示例编码</th>
              <th class="px-3 py-2">状态</th><th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <h3 class="mb-2 text-sm font-semibold text-slate-700">条码识别测试</h3>
      <div class="flex items-center gap-3">
        <input type="text" placeholder="输入或扫描条码…" class="w-[360px] rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-mono" />
        <button class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600 hover:bg-[var(--bg-hover)]">解析扫码</button>
      </div>
    </div>
  </div>
  <script>window.__wlsBasicBarcodeRule = {};</script>`
}
