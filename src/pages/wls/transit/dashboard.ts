import type { AppState } from '../../../state/store'

const quickLinks = [
  { label: '预入库单管理', desc: '查看和管理中转仓预入库单', href: '/wls/transit/receive-manage', icon: '📋', count: 3, countLabel: '待收货' },
  { label: '收货单管理', desc: '扫码收货、批量收货、打印单据', href: '/wls/transit/inbound-manage', icon: '📦', count: 1, countLabel: '收货中' },
  { label: '齐套校验中心', desc: '查看物料齐套状态与缺口', href: '/wls/transit/kit-center', icon: '✅', count: 2, countLabel: '差异待处理' },
  { label: '配料任务管理', desc: '配料任务打印、配料与确认', href: '/wls/transit/allocation-manage', icon: '🔧', count: 3, countLabel: '待配齐' },
  { label: '上架任务管理', desc: '物料上架到货架库位', href: '/wls/transit/putaway-manage', icon: '📤', count: 3, countLabel: '待上架' },
  { label: '作业区管理', desc: '收货作业区物料明细', href: '/wls/transit/work-area-manage', icon: '🏭', count: 36, countLabel: '作业区剩余' },
  { label: '出库单管理', desc: '确认出库与裁厂接收', href: '/wls/transit/outbound-manage', icon: '🚚', count: 4, countLabel: '待出库' },
  { label: '中转仓库存', desc: '货架区与作业区实时库存', href: '/wls/transit/inventory', icon: '📊', count: 15, countLabel: '库存记录' },
  { label: '中转仓库位', desc: '库位绑定与释放管理', href: '/wls/transit/location', icon: '📍', count: 5, countLabel: '已绑定' },
  { label: '数据总览', desc: '中转仓运营数据汇总', href: '/wls/transit/overview', icon: '📈', count: 0, countLabel: '' },
]

const recentActivities = [
  { time: '2026-07-16 15:21', action: '上架任务已生成', target: 'TR-PW-20260716-011', detail: 'PO14964 未配齐物料待上架' },
  { time: '2026-07-16 15:13', action: '齐套校验完成', target: 'PO14963', detail: '已配齐（需配货），推荐库位 TR-A-04' },
  { time: '2026-07-16 15:06', action: '配料任务已完成', target: 'TR-AL-20260716-009', detail: 'PO14962 全部物料已配齐' },
  { time: '2026-07-16 14:50', action: '收货完成', target: 'TR-RC-20260716-005', detail: '3 条预入库单全部收货完成' },
  { time: '2026-07-16 11:21', action: '上架任务已生成', target: 'TR-PW-20260716-003', detail: 'PO14956 未配齐物料待上架' },
  { time: '2026-07-16 10:46', action: '齐套校验完成', target: 'PO14955', detail: '未配齐，推荐库位 TR-A-01' },
  { time: '2026-07-16 10:10', action: '领料通知已发送', target: 'TR-RC-20260716-001', detail: 'PO14957 齐套领料通知' },
  { time: '2026-07-16 09:43', action: '收货完成', target: 'TR-RC-20260716-001', detail: 'PO14954/PO14957/PO14958 收货完成' },
]

export function renderTransitDashboard(_state: AppState): string {
  return `
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold text-slate-800">中转仓工作台</h1>
      <p class="mt-1 text-xs text-slate-400">中转仓收货、齐套校验、配料、上架与出库一站式管理</p>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="rounded-xl border border-orange-200 bg-orange-50 p-4">
        <div class="text-xs text-orange-600">待收货</div>
        <div class="text-2xl font-bold text-orange-700 mt-1">3</div>
        <div class="text-[10px] text-orange-500 mt-1">收货单组</div>
      </div>
      <div class="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div class="text-xs text-blue-600">待上架</div>
        <div class="text-2xl font-bold text-blue-700 mt-1">3</div>
        <div class="text-[10px] text-blue-500 mt-1">上架任务</div>
      </div>
      <div class="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <div class="text-xs text-indigo-600">待配齐</div>
        <div class="text-2xl font-bold text-indigo-700 mt-1">3</div>
        <div class="text-[10px] text-indigo-500 mt-1">配料任务</div>
      </div>
      <div class="rounded-xl border border-red-200 bg-red-50 p-4">
        <div class="text-xs text-red-600">差异待处理</div>
        <div class="text-2xl font-bold text-red-700 mt-1">2</div>
        <div class="text-[10px] text-red-500 mt-1">齐套差异</div>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      ${quickLinks.map(l => `
        <a href="${l.href}" class="block rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
          <div class="text-xl mb-2">${l.icon}</div>
          <div class="text-sm font-medium text-slate-700">${l.label}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">${l.desc}</div>
          ${l.count > 0 ? `<div class="mt-2"><span class="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px]">${l.count} ${l.countLabel}</span></div>` : ''}
        </a>
      `).join('')}
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <div class="px-4 py-3 border-b border-slate-100">
        <h3 class="text-sm font-semibold text-slate-700">最近动态</h3>
      </div>
      <div class="divide-y divide-slate-100">
        ${recentActivities.map(a => `
          <div class="flex items-start gap-3 px-4 py-3">
            <div class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm text-slate-700">${a.action}</span>
                <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">${a.target}</span>
              </div>
              <div class="text-xs text-slate-400 mt-0.5">${a.detail}</div>
            </div>
            <span class="text-xs text-slate-400 shrink-0">${a.time}</span>
          </div>
        `).join('')}
      </div>
    </div>
  </div>`
}
