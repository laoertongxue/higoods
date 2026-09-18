import type { AppState } from '../../../state/store'

type Subject = { id: string; name: string; type: string; taxNo: string; bankAccount: string; contact: string; phone: string }

const seedSubjects: Subject[] = [
  { id: 'SUB-001', name: 'HiGood 中国', type: '企业', taxNo: '91310000MA1FL8XX2N', bankAccount: '招商银行 1219XXXX1234', contact: '张总', phone: '138-0000-0001' },
  { id: 'SUB-002', name: 'PT HiGood Indonesia', type: '企业', taxNo: 'NPWP-01.234.567.8-901.000', bankAccount: 'BCA 1234567890', contact: 'Budi', phone: '+62-21-555-0001' },
  { id: 'SUB-003', name: '顺达物流', type: '企业', taxNo: '91440300MA5FXX123A', bankAccount: '工商银行 4000XXXX5678', contact: '李经理', phone: '139-0000-0002' },
]

export function renderBasicSubject(_state: AppState): string {
  const rows = seedSubjects.map(s => `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
    <td class="px-3 py-2 text-xs font-medium text-slate-700">${s.id}</td>
    <td class="px-3 py-2 text-xs text-slate-700">${s.name}</td>
    <td class="px-3 py-2 text-xs"><span class="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">${s.type}</span></td>
    <td class="px-3 py-2 text-xs text-slate-600 font-mono">${s.taxNo}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${s.bankAccount}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${s.contact}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${s.phone}</td>
    <td class="px-3 py-2 text-xs space-x-2">
      <button class="text-[var(--link)] hover:underline">修改</button>
      <button class="text-red-500 hover:underline">删除</button>
    </td>
  </tr>`).join('')

  return `<div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-base font-semibold text-slate-800">主体管理</h1>
      <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">新增主体</button>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">共 ${seedSubjects.length} 条记录</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[900px] text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2">主体ID</th><th class="px-3 py-2">主体名称</th><th class="px-3 py-2">类型</th>
              <th class="px-3 py-2">税号</th><th class="px-3 py-2">银行账号</th><th class="px-3 py-2">联系人</th>
              <th class="px-3 py-2">电话</th><th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>
  <script>window.__wlsBasicSubject = {};</script>`
}
