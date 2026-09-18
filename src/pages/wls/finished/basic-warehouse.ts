import type { AppState } from '../../../state/store'

type Warehouse = { code: string; name: string; type: '自建' | '合作'; businessType: string; contact: string; country: string; timezone: string; manager: string; enabled: boolean; subjects: string[] }

const seedWarehouses: Warehouse[] = [
  { code: 'WH-FINISHED', name: '成衣仓', type: '自建', businessType: '成衣仓储', contact: '王仓管', country: '中国', timezone: 'Asia/Shanghai (UTC+8)', manager: '王敏', enabled: true, subjects: ['HiGood 中国'] },
  { code: 'WH-TRANSIT', name: '中转仓', type: '合作', businessType: '中转仓储', contact: '李经理', country: '中国', timezone: 'Asia/Shanghai (UTC+8)', manager: '李强', enabled: true, subjects: ['HiGood 中国', '顺达物流'] },
  { code: 'WH-RAW', name: '原料仓', type: '自建', businessType: '原料仓储', contact: '赵主管', country: '中国', timezone: 'Asia/Shanghai (UTC+8)', manager: '赵刚', enabled: true, subjects: ['HiGood 中国'] },
  { code: 'WH-ID', name: '印尼成品仓', type: '合作', businessType: '成衣仓储', contact: 'Budi', country: '印度尼西亚', timezone: 'Asia/Jakarta (UTC+7)', manager: 'Budi Santoso', enabled: false, subjects: ['PT HiGood Indonesia'] },
]

export function renderBasicWarehouse(_state: AppState): string {
  const rows = seedWarehouses.map(w => `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
    <td class="px-3 py-2 text-xs font-medium text-[var(--link)]">${w.code}</td>
    <td class="px-3 py-2 text-xs text-slate-700">${w.name}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">${w.type}</span></td>
    <td class="px-3 py-2 text-xs text-slate-600">${w.businessType}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${w.subjects.join(', ')}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${w.contact}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${w.country}</td>
    <td class="px-3 py-2 text-xs text-slate-500">${w.timezone}</td>
    <td class="px-3 py-2 text-xs">
      <label class="relative inline-flex cursor-items-center">
        <input type="checkbox" ${w.enabled ? 'checked' : ''} class="peer sr-only" />
        <span class="h-5 w-9 rounded-full bg-slate-200 peer-checked:bg-[var(--link)] after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"></span>
      </label>
    </td>
    <td class="px-3 py-2 text-xs space-x-2">
      <button class="text-[var(--link)] hover:underline">修改</button>
      <button class="text-red-500 hover:underline">删除</button>
    </td>
  </tr>`).join('')

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">仓库管理</h1>
      <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">新增仓库</button>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <div class="flex items-center gap-3">
        <input type="text" placeholder="按仓库编码 / 名称搜索" class="w-[300px] rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部类型</option><option>自建</option><option>合作</option>
        </select>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">共 ${seedWarehouses.length} 条记录</div>
      <div class="overflow-x-auto">
        <table class="w-full table-fixed text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2">仓库编码</th><th class="px-3 py-2">仓库名称</th><th class="px-3 py-2">类型</th>
              <th class="px-3 py-2">属性</th><th class="px-3 py-2">所属主体</th><th class="px-3 py-2">联系人</th>
              <th class="px-3 py-2">国家</th><th class="px-3 py-2">时区</th><th class="px-3 py-2">启用</th><th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>
  <script>window.__wlsBasicWarehouse = {};</script>`
}
