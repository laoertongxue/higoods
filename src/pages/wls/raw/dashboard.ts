
const alertCards = [
  { label: '待收货', count: 3, color: 'amber', sub: '到货单' },
  { label: '待上架', count: 5, color: 'blue', sub: '上架任务' },
  { label: '库存不足', count: 2, color: 'red', sub: '缺料预警' },
  { label: '盘点待审', count: 1, color: 'purple', sub: '盘点差异' },
]

const colorMap: Record<string, { border: string; bg: string; text: string; sub: string }> = {
  amber: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', sub: 'text-amber-500' },
  blue: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-700', sub: 'text-blue-500' },
  red: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-700', sub: 'text-red-500' },
  purple: { border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-700', sub: 'text-purple-500' },
}

const quickLinks = [
  { label: '面料到货列表', desc: '查看面料类预入库单与收货进度', href: '/wls/raw/arrival-list', icon: '🧵', count: 3, countLabel: '待收货' },
  { label: '辅料到货列表', desc: '查看辅料类预入库单与收货进度', href: '/wls/raw/arrival-list', icon: '🪡', count: 2, countLabel: '待收货' },
  { label: '入库单管理', desc: '查看并执行上架任务', href: '/wls/raw/inbound-list', icon: '📦', count: 5, countLabel: '待上架' },
  { label: '领料单列表', desc: '生产领料单查看与出库确认', href: '/wls/raw/requisition-list', icon: '📋', count: 4, countLabel: '待出库' },
  { label: '配料单列表', desc: '配料任务查看与执行', href: '/wls/raw/allocation-list', icon: '🔧', count: 3, countLabel: '待配齐' },
  { label: '出库单列表', desc: '出库单查看与物流跟踪', href: '/wls/raw/outbound-list', icon: '🚚', count: 2, countLabel: '待出库' },
  { label: '即时库存', desc: '面料、辅料、耗材、包材实时库存', href: '/wls/raw/inventory', icon: '📊', count: 15, countLabel: '库存记录' },
  { label: '面料评分', desc: '面料质量评分与供应商评估', href: '/wls/raw/fabric-score', icon: '⭐', count: 8, countLabel: '待评分' },
]

const recentActivities = [
  { time: '2026-05-30 14:35', action: '入库收货完成', target: 'YRK-FAB-20260530-103', detail: '面料 720 米已收货，等待上架' },
  { time: '2026-05-30 11:20', action: '上架任务已生成', target: 'SJ-FAB-20260530-002', detail: 'CG-FAB-20260530-104 面料 12 卷待上架' },
  { time: '2026-05-29 16:48', action: '领料出库完成', target: 'CK-TRM-20260529-002', detail: '辅料 3000 颗已出库至生产车间' },
  { time: '2026-05-29 14:10', action: '到货部分收货', target: 'YRK-FAB-20260529-102', detail: '面料应收 1280 米，已收 560 米' },
  { time: '2026-05-28 17:30', action: '盘点差异待审', target: 'PD-RAW-20260528-001', detail: '辅料仓盘亏 120 颗，待主管审核' },
  { time: '2026-05-28 09:15', action: '入库收货完成', target: 'YRK-CON-20260528-101', detail: '耗材 1440 个已收货，等待上架' },
]

export function renderRawDashboard(): string {
  return `
  <div class="space-y-5">
    <div>
      <h1 class="text-lg font-semibold text-slate-800">原料仓工作台</h1>
      <p class="mt-1 text-xs text-slate-400">原料仓作业总览，覆盖面料、辅料、耗材、包材与纱线。</p>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${alertCards.map(c => {
        const cm = colorMap[c.color]
        return `
        <div class="rounded-xl border ${cm.border} ${cm.bg} p-4">
          <div class="text-xs ${cm.sub}">${c.label}</div>
          <div class="text-2xl font-bold ${cm.text} mt-1">${c.count}</div>
          <div class="text-[10px] ${cm.sub} mt-1">${c.sub}</div>
        </div>`
      }).join('')}
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
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
