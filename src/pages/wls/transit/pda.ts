import type { AppState } from '../../../state/store'

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

interface RecentTask {
  id: string
  type: '调拨拣货' | '确认发出' | '收货确认' | '异常登记'
  title: string
  subtitle: string
  status: '已完成' | '进行中' | '待处理'
  statusClass: string
  time: string
}

const recentTasks: RecentTask[] = [
  {
    id: 'TP-20260916-001',
    type: '调拨拣货',
    title: '调拨单 TR-AL-0916-003',
    subtitle: '面料 FAB-PO14958-A × 7Y → 缝制车间 A3 库位',
    status: '进行中',
    statusClass: 'bg-blue-100 text-blue-700',
    time: '10 分钟前',
  },
  {
    id: 'TP-20260916-002',
    type: '收货确认',
    title: '收货单 RC-0916-005',
    subtitle: '生产单 PO14960 · 辅料 12 卷已扫码确认',
    status: '已完成',
    statusClass: 'bg-emerald-100 text-emerald-700',
    time: '32 分钟前',
  },
  {
    id: 'TP-20260916-003',
    type: '确认发出',
    title: '发出单 SD-0916-002',
    subtitle: '调拨 TR-AL-0915-007 · 8 袋已装车确认发出',
    status: '已完成',
    statusClass: 'bg-emerald-100 text-emerald-700',
    time: '1 小时前',
  },
  {
    id: 'TP-20260916-004',
    type: '异常登记',
    title: '异常单 EX-0916-001',
    subtitle: 'PO14956 少收 6Y，已拍照上报待主管确认',
    status: '待处理',
    statusClass: 'bg-amber-100 text-amber-700',
    time: '2 小时前',
  },
]

interface MenuItem {
  icon: string
  title: string
  desc: string
  badge?: string
  badgeClass?: string
  route: string
}

interface MenuGroup {
  label: string
  items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
  {
    label: '调拨作业',
    items: [
      {
        icon: '📦',
        title: '调拨拣货',
        desc: '按调拨单扫码拣货',
        badge: '2',
        badgeClass: 'bg-orange-100 text-orange-700',
        route: '/wls/transit/pda?picking',
      },
      {
        icon: '🚚',
        title: '确认发出',
        desc: '核对袋数确认发出',
        route: '/wls/transit/pda?dispatch',
      },
    ],
  },
  {
    label: '收货作业',
    items: [
      {
        icon: '✅',
        title: '收货确认',
        desc: '扫码收货并确认数量',
        badge: '3',
        badgeClass: 'bg-blue-100 text-blue-700',
        route: '/wls/transit/pda?receive',
      },
    ],
  },
  {
    label: '异常处理',
    items: [
      {
        icon: '⚠️',
        title: '异常登记',
        desc: '登记差异、破损等异常',
        route: '/wls/transit/pda?exception',
      },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Render helpers                                                     */
/* ------------------------------------------------------------------ */

function renderTopBar(): string {
  return `
    <div class="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
      <div class="flex items-center gap-2">
        <span class="text-base font-bold text-slate-800">中转仓</span>
        <span class="text-[10px] text-slate-400">PDA</span>
      </div>
      <div class="flex items-center gap-3">
        <button type="button" class="text-slate-500 hover:text-slate-700" aria-label="扫码">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 7h10v10H7z"/>
          </svg>
        </button>
        <div class="flex items-center gap-1 text-slate-400">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.24 4.24 0 00-6 0zm-4-4l2 2a7.07 7.07 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.34C7 21.4 7.6 22 8.33 22h7.34c.73 0 1.33-.6 1.33-1.33V5.33C17 4.6 16.4 4 15.67 4zM13 18h-2v-2h2v2zm0-4h-2V9h2v5z"/></svg>
        </div>
      </div>
    </div>
  `
}

function renderPendingBanner(): string {
  return `
    <div class="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 px-4 py-3">
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 text-sm font-bold">5</div>
      <div class="flex-1 text-sm text-slate-700">
        待处理任务
      </div>
      <div class="flex items-center gap-2 text-xs">
        <span class="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700 font-medium">2 个待拣货</span>
        <span class="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 font-medium">3 个待收货</span>
      </div>
    </div>
  `
}

function renderMenuGroup(group: MenuGroup): string {
  return `
    <section class="space-y-2">
      <div class="px-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">${group.label}</div>
      <div class="grid ${group.items.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-3">
        ${group.items.map(renderMenuItem).join('')}
      </div>
    </section>
  `
}

function renderMenuItem(item: MenuItem): string {
  return `
    <button type="button" class="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition active:scale-[0.98] hover:shadow-sm" data-nav="${item.route}">
      <span class="text-2xl leading-none mt-0.5">${item.icon}</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-slate-800">${item.title}</span>
          ${item.badge ? `<span class="rounded-full px-1.5 py-0.5 text-[10px] font-medium ${item.badgeClass ?? 'bg-slate-100 text-slate-600'}">${item.badge}</span>` : ''}
        </div>
        <div class="mt-1 text-xs text-slate-400 truncate">${item.desc}</div>
      </div>
    </button>
  `
}

function renderRecentTasks(): string {
  return `
    <section class="space-y-2">
      <div class="flex items-center justify-between px-1">
        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">最近任务</span>
        <button type="button" class="text-xs text-blue-600 hover:text-blue-700">查看全部</button>
      </div>
      <div class="space-y-2">
        ${recentTasks.map(renderTaskCard).join('')}
      </div>
    </section>
  `
}

function renderTaskCard(task: RecentTask): string {
  return `
    <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-slate-800">${task.title}</span>
          <span class="rounded-full px-2 py-0.5 text-[10px] font-medium ${task.statusClass}">${task.status}</span>
        </div>
        <span class="text-[10px] text-slate-400 shrink-0">${task.time}</span>
      </div>
      <div class="mt-1.5 text-xs text-slate-500 truncate">${task.subtitle}</div>
      <div class="mt-2 flex items-center justify-between">
        <span class="text-[10px] text-slate-400">${task.type} · ${task.id}</span>
        ${task.status === '进行中' ? '<button type="button" class="rounded-lg bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-700">继续</button>' : ''}
        ${task.status === '待处理' ? '<button type="button" class="rounded-lg bg-amber-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-amber-600">去处理</button>' : ''}
      </div>
    </div>
  `
}

function renderScanBar(): string {
  return `
    <div class="sticky bottom-0 bg-white border-t border-slate-200 px-4 py-3 space-y-2">
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 7h10v10H7z"/>
          </svg>
          <input
            id="wls-transit-scan-input"
            type="text"
            placeholder="扫码输入或手动输入编号..."
            class="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          id="wls-transit-scan-confirm"
          type="button"
          class="shrink-0 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 active:scale-[0.98] transition"
        >
          确认
        </button>
      </div>
      <div class="flex items-center justify-between text-[10px] text-slate-400">
        <span>操作员: 李强 | 工号: OP-003</span>
        <span>中转仓 PDA v1.0</span>
      </div>
    </div>
  `
}

/* ------------------------------------------------------------------ */
/*  Page entry                                                         */
/* ------------------------------------------------------------------ */

export function renderTransitPda(): string {
  return `
  <div class="max-w-[470px] mx-auto min-h-screen bg-slate-100 flex flex-col">
    ${renderTopBar()}
    ${renderPendingBanner()}

    <div class="flex-1 space-y-4 px-4 py-4 pb-28">
      ${menuGroups.map(renderMenuGroup).join('')}
      ${renderRecentTasks()}
    </div>

    ${renderScanBar()}

    <script>
      (function () {
        if (window.__wlsTransitPda) return;
        window.__wlsTransitPda = {
          scanInput: document.getElementById('wls-transit-scan-input'),
          confirmBtn: document.getElementById('wls-transit-scan-confirm'),

          init: function () {
            var self = this;
            if (self.confirmBtn) {
              self.confirmBtn.addEventListener('click', function () {
                var value = (self.scanInput && self.scanInput.value || '').trim();
                if (!value) {
                  alert('请先扫码或输入编号');
                  return;
                }
                alert('已提交: ' + value);
                if (self.scanInput) self.scanInput.value = '';
              });
            }
            if (self.scanInput) {
              self.scanInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (self.confirmBtn) self.confirmBtn.click();
                }
              });
            }
          }
        };
        window.__wlsTransitPda.init();
      })();
    </script>
  </div>
  `
}
