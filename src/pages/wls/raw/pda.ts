import type { AppState } from '../../../state/store'

export function renderRawPda(_state: AppState): string {
  const menuGroups = [
    {
      title: '入库作业',
      items: [
        { icon: '📦', name: '到货收货', desc: '扫描原料条码收货' },
        { icon: '📤', name: '上架', desc: '扫码确认库位上架' },
      ],
    },
    {
      title: '出库作业',
      items: [
        { icon: '📋', name: '领料拣货', desc: '按领料单拣货' },
        { icon: '🧪', name: '配料拣货', desc: '按配料单拣货' },
      ],
    },
    {
      title: '库存作业',
      items: [
        { icon: '🔄', name: '移库', desc: '库位间调拨' },
        { icon: '📊', name: '盘点', desc: '库存盘点录入' },
      ],
    },
  ]

  const pendingTasks = [
    { type: '待收货', count: 4, color: 'bg-blue-50 text-blue-700' },
    { type: '待拣货', count: 6, color: 'bg-amber-50 text-amber-700' },
    { type: '异常', count: 1, color: 'bg-red-50 text-red-700' },
  ]

  const recentTasks = [
    { code: 'MRL-20260918-001', action: '领料拣货', status: '拣货中', time: '10 分钟前' },
    { code: 'PIN-20260918-003', action: '到货收货', status: '已完成', time: '25 分钟前' },
    { code: 'MPL-20260918-002', action: '配料拣货', status: '待拣货', time: '1 小时前' },
  ]

  const menuHtml = menuGroups.map(g => `
    <div class="mb-3">
      <div class="mb-1.5 px-1 text-[11px] font-medium text-slate-400">${g.title}</div>
      <div class="grid grid-cols-2 gap-2">
        ${g.items.map(i => `
          <button class="flex items-center gap-2 rounded-lg bg-white p-3 shadow-sm active:bg-slate-50">
            <span class="text-xl">${i.icon}</span>
            <div class="text-left">
              <div class="text-xs font-medium text-slate-700">${i.name}</div>
              <div class="text-[10px] text-slate-400">${i.desc}</div>
            </div>
          </button>
        `).join('')}
      </div>
    </div>
  `).join('')

  const pendingHtml = pendingTasks.map(t =>
    `<span class="rounded-full px-2 py-0.5 text-[11px] ${t.color}">${t.count} ${t.type}</span>`
  ).join('')

  const recentHtml = recentTasks.map(t => {
    const statusColor = t.status === '已完成' ? 'text-emerald-600' : t.status === '拣货中' ? 'text-blue-600' : 'text-amber-600'
    return `<div class="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
      <div>
        <div class="text-xs font-medium text-slate-700">${t.code}</div>
        <div class="text-[10px] text-slate-400">${t.action} · ${t.time}</div>
      </div>
      <span class="text-[11px] ${statusColor}">${t.status}</span>
    </div>`
  }).join('')

  return `<div class="mx-auto max-w-[470px] min-h-screen bg-slate-100">
    <div class="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-white">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-semibold">原料仓</div>
          <div class="text-[10px] text-blue-200">PDA 作业终端</div>
        </div>
        <div class="flex items-center gap-2 text-[10px] text-blue-200">
          <span>📶</span><span>🔋 86%</span>
        </div>
      </div>
    </div>

    <div class="px-4 pt-3">
      <div class="rounded-lg bg-white p-3 shadow-sm">
        <div class="mb-2 text-[11px] font-medium text-slate-500">待处理任务</div>
        <div class="flex flex-wrap gap-2">${pendingHtml}</div>
      </div>
    </div>

    <div class="px-4 pt-3">${menuHtml}</div>

    <div class="px-4 pt-1">
      <div class="rounded-lg bg-white p-3 shadow-sm">
        <div class="mb-2 text-[11px] font-medium text-slate-500">最近任务</div>
        ${recentHtml}
      </div>
    </div>

    <div class="fixed bottom-0 left-1/2 w-full max-w-[470px] -translate-x-1/2 border-t border-slate-200 bg-white px-4 py-3">
      <div class="mb-2 text-[10px] text-slate-400">操作员: 赵刚 | 工号: OP-005</div>
      <div class="flex gap-2">
        <input type="text" placeholder="扫码输入..." class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        <button class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white active:bg-blue-700">确认</button>
      </div>
    </div>
    <div class="h-20"></div>
  </div>
  <script>
    window.__wlsRawPda = {
      init() {
        const input = document.querySelector('[placeholder="扫码输入..."]');
        if (input) input.focus();
      }
    };
    window.__wlsRawPda.init();
  </script>`
}
