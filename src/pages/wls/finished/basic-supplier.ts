import type { AppState } from '../../../state/store'

type Supplier = { code: string; name: string; category: '面料' | '辅料' | '纱线' | '包材' | '耗材'; contact: string; phone: string; country: string; rating: 'A' | 'B' | 'C'; enabled: boolean; cooperationSince: string }

const seedSuppliers: Supplier[] = [
  { code: 'SUP-001', name: '绍兴华纺纺织', category: '面料', contact: '陈经理', phone: '0575-8801-xxxx', country: '中国', rating: 'A', enabled: true, cooperationSince: '2023-03-15' },
  { code: 'SUP-002', name: '东莞永达辅料', category: '辅料', contact: '林总', phone: '0769-2203-xxxx', country: '中国', rating: 'A', enabled: true, cooperationSince: '2023-06-01' },
  { code: 'SUP-003', name: '苏州盛虹纱线', category: '纱线', contact: '吴经理', phone: '0512-6601-xxxx', country: '中国', rating: 'B', enabled: true, cooperationSince: '2024-01-10' },
  { code: 'SUP-004', name: 'PT Tekstil Indonesia', category: '面料', contact: 'Agus', phone: '+62-21-xxxx', country: '印度尼西亚', rating: 'B', enabled: true, cooperationSince: '2024-04-20' },
  { code: 'SUP-005', name: '广州利达包装', category: '包材', contact: '黄经理', phone: '020-3801-xxxx', country: '中国', rating: 'A', enabled: true, cooperationSince: '2023-09-05' },
  { code: 'SUP-006', name: '佛山顺源耗材', category: '耗材', contact: '梁总', phone: '0757-8301-xxxx', country: '中国', rating: 'C', enabled: false, cooperationSince: '2022-11-18' },
  { code: 'SUP-007', name: '杭州宏远纺织', category: '面料', contact: '张经理', phone: '0571-8701-xxxx', country: '中国', rating: 'A', enabled: true, cooperationSince: '2023-01-08' },
  { code: 'SUP-008', name: 'PT Benang Nusantara', category: '纱线', contact: 'Siti', phone: '+62-22-xxxx', country: '印度尼西亚', rating: 'B', enabled: true, cooperationSince: '2024-07-12' },
]

export function renderBasicSupplier(_state: AppState): string {
  const rows = seedSuppliers.map(s => {
    const ratingColor = s.rating === 'A' ? 'bg-emerald-50 text-emerald-700' : s.rating === 'B' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
    return `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
    <td class="px-3 py-2 text-xs font-medium text-[var(--link)]">${s.code}</td>
    <td class="px-3 py-2 text-xs text-slate-700">${s.name}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">${s.category}</span></td>
    <td class="px-3 py-2 text-xs text-slate-600">${s.contact}</td>
    <td class="px-3 py-2 text-xs text-slate-500">${s.phone}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${s.country}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded px-1.5 py-0.5 ${ratingColor}">${s.rating}级</span></td>
    <td class="px-3 py-2 text-xs text-slate-500">${s.cooperationSince}</td>
    <td class="px-3 py-2 text-xs">
      <label class="relative inline-flex cursor-items-center">
        <input type="checkbox" ${s.enabled ? 'checked' : ''} class="peer sr-only" />
        <span class="h-5 w-9 rounded-full bg-slate-200 peer-checked:bg-[var(--link)] after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"></span>
      </label>
    </td>
    <td class="px-3 py-2 text-xs space-x-2">
      <button class="text-[var(--link)] hover:underline">修改</button>
      <button class="text-red-500 hover:underline">删除</button>
    </td>
  </tr>`
  }).join('')

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">供应商管理</h1>
      <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">新增供应商</button>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <div class="flex items-center gap-3">
        <input type="text" placeholder="按编码 / 名称搜索" class="w-[300px] rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部品类</option><option>面料</option><option>辅料</option><option>纱线</option><option>包材</option><option>耗材</option>
        </select>
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部评级</option><option>A级</option><option>B级</option><option>C级</option>
        </select>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">共 ${seedSuppliers.length} 条记录</div>
      <div class="overflow-x-auto">
        <table class="w-full table-fixed text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2">编码</th><th class="px-3 py-2">名称</th><th class="px-3 py-2">品类</th>
              <th class="px-3 py-2">联系人</th><th class="px-3 py-2">电话</th><th class="px-3 py-2">国家</th>
              <th class="px-3 py-2">评级</th><th class="px-3 py-2">合作起始</th><th class="px-3 py-2">启用</th><th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`
}
