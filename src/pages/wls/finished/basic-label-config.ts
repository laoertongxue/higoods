import type { AppState } from '../../../state/store'

type LabelTemplate = { name: string; sourceSystem: string; scene: string; processType: string; materialType: string; factoryType: string; size: string; qrRule: string; packageRule: string; status: 'ENABLED' | 'DISABLED'; updated: string }

const seedTemplates: LabelTemplate[] = [
  { name: '成衣出库标签', sourceSystem: 'WMS', scene: '出库', processType: '打包', materialType: '成衣', factoryType: '成衣仓', size: '100×150mm', qrRule: '{shipNo}|{orderNo}', packageRule: 'PKG-{YYYYMMDD}-{SEQ4}', status: 'ENABLED', updated: '2026-08-20 10:00' },
  { name: '退货收货标签', sourceSystem: 'WMS', scene: '退货', processType: '收货', materialType: '成衣', factoryType: '成衣仓', size: '100×150mm', qrRule: '{returnNo}|{lineSku}', packageRule: 'RET-{YYYYMMDD}-{SEQ3}', status: 'ENABLED', updated: '2026-08-22 14:00' },
  { name: '中转仓入库标签', sourceSystem: 'WMS-TRANSIT', scene: '入库', processType: '收货', materialType: '面辅料', factoryType: '中转仓', size: '80×120mm', qrRule: '{inboundNo}', packageRule: 'TR-IN-{YYYYMMDD}-{SEQ3}', status: 'ENABLED', updated: '2026-08-25 09:00' },
  { name: '原料仓领料标签', sourceSystem: 'WMS-RAW', scene: '领料', processType: '发料', materialType: '面料', factoryType: '原料仓', size: '80×120mm', qrRule: '{reqNo}|{sku}', packageRule: 'RAW-REQ-{YYYYMMDD}-{SEQ3}', status: 'DISABLED', updated: '2026-08-26 11:00' },
]

export function renderBasicLabelConfig(_state: AppState): string {
  const rows = seedTemplates.map(t => `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
    <td class="px-3 py-2 text-xs font-medium text-slate-700">${t.name}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${t.sourceSystem}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">${t.scene}</span></td>
    <td class="px-3 py-2 text-xs text-slate-600">${t.processType}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${t.materialType}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${t.factoryType}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${t.size}</td>
    <td class="px-3 py-2 text-xs font-mono text-slate-500">${t.qrRule}</td>
    <td class="px-3 py-2 text-xs font-mono text-slate-500">${t.packageRule}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded-full px-2 py-0.5 text-xs ${t.status === 'ENABLED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}">${t.status === 'ENABLED' ? '启用' : '停用'}</span></td>
    <td class="px-3 py-2 text-xs text-slate-500">${t.updated}</td>
    <td class="px-3 py-2 text-xs space-x-2">
      <button class="text-[var(--link)] hover:underline">编辑</button>
      <button class="text-[var(--link)] hover:underline">预览</button>
    </td>
  </tr>`).join('')

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">标签配置</h1>
      <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">新增模板</button>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <div class="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="搜索模板名称…" class="w-[240px] rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部来源系统</option><option>WMS</option><option>WMS-TRANSIT</option><option>WMS-RAW</option>
        </select>
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部业务场景</option><option>出库</option><option>入库</option><option>退货</option><option>领料</option>
        </select>
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部状态</option><option>启用</option><option>停用</option>
        </select>
        <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">查询</button>
        <button class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600 hover:bg-[var(--bg-hover)]">重置</button>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">标签模板 · 共 ${seedTemplates.length} 条</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1500px] text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2">模板名称</th><th class="px-3 py-2">来源系统</th><th class="px-3 py-2">业务场景</th>
              <th class="px-3 py-2">工序类型</th><th class="px-3 py-2">物料类型</th><th class="px-3 py-2">工厂类型</th>
              <th class="px-3 py-2">标签尺寸</th><th class="px-3 py-2">二维码规则</th><th class="px-3 py-2">包装号规则</th>
              <th class="px-3 py-2">状态</th><th class="px-3 py-2">更新时间</th><th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>
  <script>window.__wlsBasicLabelConfig = {};</script>`
}
