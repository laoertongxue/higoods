import type { AppState } from '../../../state/store'

type Processor = { code: string; name: string; processTypes: string[]; address: string; contact: string; phone: string; capacity: string; enabled: boolean; cooperationSince: string }

const seedProcessors: Processor[] = [
  { code: 'PROC-001', name: '东莞鑫达制衣', processTypes: ['车缝', '组装'], address: '广东省东莞市长安镇', contact: '刘厂长', phone: '0769-8101-xxxx', capacity: '日产 3000 件', enabled: true, cooperationSince: '2023-02-10' },
  { code: 'PROC-002', name: '顺德永盛印染', processTypes: ['染色', '印花'], address: '广东省佛山市顺德区', contact: '何经理', phone: '0757-2601-xxxx', capacity: '日染 5000 kg', enabled: true, cooperationSince: '2023-05-18' },
  { code: 'PROC-003', name: 'PT Garment Jaya', processTypes: ['裁剪', '车缝'], address: 'Jl. Industri No.12, Bandung', contact: 'Hendra', phone: '+62-22-7101-xxxx', capacity: '日产 2000 件', enabled: true, cooperationSince: '2024-03-01' },
  { code: 'PROC-004', name: '中山利达后整', processTypes: ['后整', '包装'], address: '广东省中山市沙溪镇', contact: '郭经理', phone: '0760-8801-xxxx', capacity: '日整 4000 件', enabled: true, cooperationSince: '2023-08-22' },
  { code: 'PROC-005', name: '苏州恒力绣花', processTypes: ['绣花', '印花'], address: '江苏省苏州市吴江区', contact: '沈总', phone: '0512-6301-xxxx', capacity: '日绣 8000 片', enabled: true, cooperationSince: '2024-01-15' },
  { code: 'PROC-006', name: 'PT Washindo Pratama', processTypes: ['水洗', '后整'], address: 'Kawasan Industri, Semarang', contact: 'Bambang', phone: '+62-24-7501-xxxx', capacity: '日洗 3000 件', enabled: false, cooperationSince: '2024-06-08' },
]

export function renderBasicProcessor(_state: AppState): string {
  const rows = seedProcessors.map(p => `<tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
    <td class="px-3 py-2 text-xs font-medium text-[var(--link)]">${p.code}</td>
    <td class="px-3 py-2 text-xs text-slate-700">${p.name}</td>
    <td class="px-3 py-2 text-xs">${p.processTypes.map(t => `<span class="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">${t}</span>`).join('')}</td>
    <td class="px-3 py-2 text-xs text-slate-500">${p.address}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${p.contact}</td>
    <td class="px-3 py-2 text-xs text-slate-500">${p.phone}</td>
    <td class="px-3 py-2 text-xs text-slate-600">${p.capacity}</td>
    <td class="px-3 py-2 text-xs text-slate-500">${p.cooperationSince}</td>
    <td class="px-3 py-2 text-xs">
      <label class="relative inline-flex cursor-items-center">
        <input type="checkbox" ${p.enabled ? 'checked' : ''} class="peer sr-only" />
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
      <h1 class="text-base font-semibold text-slate-800">加工方管理</h1>
      <button class="rounded-md bg-[var(--link)] px-3 py-1.5 text-xs text-white">新增加工方</button>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white p-4">
      <div class="flex items-center gap-3">
        <input type="text" placeholder="按编码 / 名称搜索" class="w-[300px] rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs" />
        <select class="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-slate-600">
          <option>全部工序</option><option>裁剪</option><option>车缝</option><option>染色</option><option>印花</option><option>绣花</option><option>后整</option><option>包装</option><option>水洗</option>
        </select>
      </div>
    </div>
    <div class="rounded-lg border border-[var(--border-subtle)] bg-white">
      <div class="border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-slate-500">共 ${seedProcessors.length} 条记录</div>
      <div class="overflow-x-auto">
        <table class="w-full table-fixed text-left">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2">编码</th><th class="px-3 py-2">名称</th><th class="px-3 py-2">工序类型</th>
              <th class="px-3 py-2">地址</th><th class="px-3 py-2">联系人</th><th class="px-3 py-2">电话</th>
              <th class="px-3 py-2">产能</th><th class="px-3 py-2">合作起始</th><th class="px-3 py-2">启用</th><th class="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`
}
