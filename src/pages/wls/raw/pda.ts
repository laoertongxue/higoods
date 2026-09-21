import { escapeHtml } from '../../../utils.ts'
import { appStore } from '../../../state/store.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'

const EVENT_PREFIX = 'wls-raw-pda'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

type RecentTask = { code: string; action: string; status: '已完成' | '进行中' | '待拣货'; time: string }

const menuGroups = [
  {
    title: '入库作业',
    items: [
      { name: '到货收货', desc: '扫描原料条码收货' },
      { name: '织带产出收货', desc: '核对长度、端头及实收数量' },
      { name: '上架', desc: '扫码确认库位上架' },
    ],
  },
  {
    title: '出库作业',
    items: [
      { name: '领料拣货', desc: '按领料单拣货' },
      { name: '配料拣货', desc: '按配料单拣货' },
    ],
  },
  {
    title: '库存作业',
    items: [
      { name: '移库', desc: '库位间调拨' },
      { name: '盘点', desc: '库存盘点录入' },
    ],
  },
]

const pendingTasks = [
  { type: '待收货', count: 4, color: 'bg-blue-50 text-blue-700' },
  { type: '待拣货', count: 6, color: 'bg-amber-50 text-amber-700' },
  { type: '异常', count: 1, color: 'bg-red-50 text-red-700' },
]

const state: { activeTask: string; scan: string; recentTasks: RecentTask[] } = {
  activeTask: '',
  scan: '',
  recentTasks: [
    { code: 'MRL-20260918-001', action: '领料拣货', status: '进行中', time: '10 分钟前' },
    { code: 'PIN-20260918-003', action: '到货收货', status: '已完成', time: '25 分钟前' },
    { code: 'MPL-20260918-002', action: '配料拣货', status: '待拣货', time: '1 小时前' },
  ],
}

function statusColor(status: RecentTask['status']): string {
  if (status === '已完成') return 'text-emerald-600'
  if (status === '进行中') return 'text-blue-600'
  return 'text-amber-600'
}

function renderRawPdaWorkspace(): string {
  const menuHtml = menuGroups.map((group) => `
    <div class="mb-3">
      <div class="mb-1.5 px-1 text-[11px] font-medium text-slate-400">${group.title}</div>
      <div class="grid grid-cols-2 gap-2">
        ${group.items.map((item) => {
          const active = state.activeTask === item.name
          return `
          <button type="button" class="flex items-center gap-2 rounded-lg p-3 text-left shadow-sm ${active ? 'bg-blue-50 ring-1 ring-blue-400' : 'bg-white active:bg-slate-50'}" data-${EVENT_PREFIX}-action="select-task" data-${EVENT_PREFIX}-task="${escapeHtml(item.name)}">
            <div class="text-left">
              <div class="text-xs font-medium text-slate-700">${escapeHtml(item.name)}</div>
              <div class="text-[10px] text-slate-400">${escapeHtml(item.desc)}</div>
            </div>
          </button>
        `}).join('')}
      </div>
    </div>
  `).join('')

  const pendingHtml = pendingTasks.map((task) =>
    `<span class="rounded-full px-2 py-0.5 text-[11px] ${task.color}">${task.count} ${task.type}</span>`
  ).join('')

  const recentHtml = state.recentTasks.length === 0
    ? `<div class="py-3 text-center text-[11px] text-slate-400">本班次还没有作业记录</div>`
    : state.recentTasks.map((task) => `
      <div class="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
        <div>
          <div class="text-xs font-medium text-slate-700">${escapeHtml(task.code)}</div>
          <div class="text-[10px] text-slate-400">${escapeHtml(task.action)} · ${escapeHtml(task.time)}</div>
        </div>
        <span class="text-[11px] ${statusColor(task.status)}">${escapeHtml(task.status)}</span>
      </div>`).join('')

  return `<div class="mx-auto max-w-[470px] min-h-screen bg-slate-100">
    <div class="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-white">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-semibold">原料仓</div>
          <div class="text-[10px] text-blue-200">PDA 作业终端</div>
        </div>
        <div class="text-[10px] text-blue-200">${escapeHtml(state.activeTask || '请选择作业')}</div>
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
      <div class="mb-2 text-[10px] text-slate-400">操作员: 赵刚 | 工号: OP-005${state.activeTask ? ` | 当前作业: ${escapeHtml(state.activeTask)}` : ''}</div>
      <div class="flex gap-2">
        <input type="text" placeholder="扫码输入..." value="${escapeHtml(state.scan)}" class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" data-${EVENT_PREFIX}-field="scan" data-scan-enter="true" data-skip-page-rerender="true" />
        <button type="button" class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white active:bg-blue-700" data-${EVENT_PREFIX}-action="submit-scan">确认</button>
      </div>
    </div>
    <div class="h-20"></div>
  </div>`
}

function pdaRoot(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-root]`)
}

function refreshPda(): void {
  const host = document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-workspace]`)
  if (!host) return
  host.innerHTML = renderRawPdaWorkspace()
  hydrateIcons(host)
  host.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="scan"]`)?.focus()
}

function readScanValue(): string {
  const input = pdaRoot()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="scan"]`)
  return input ? input.value.trim() : state.scan.trim()
}

function submitScan(): void {
  const code = readScanValue()
  if (!state.activeTask) {
    showListFeedback('请先在上方选择要执行的作业类型', 'warning')
    return
  }
  if (!code) {
    showListFeedback(`请扫描${state.activeTask}的条码或袋号`, 'warning')
    return
  }
  state.recentTasks.unshift({ code, action: state.activeTask, status: '已完成', time: '刚刚' })
  state.scan = ''
  showListFeedback(`${state.activeTask}已记录：${code}`)
  refreshPda()
}

export function renderRawPda(): string {
  return `<div data-${EVENT_PREFIX}-root><div data-${EVENT_PREFIX}-workspace>${renderRawPdaWorkspace()}</div></div>`
}

export function handleRawPdaEvent(target: HTMLElement, event?: Event): boolean {
  if (!pdaRoot()) return false

  const field = target.closest<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="scan"]`)
  if (field) {
    if (event?.type === 'keydown') { submitScan(); return true }
    state.scan = field.value
    return true
  }

  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset[`${DATASET_PREFIX}Action`]
  if (!actionNode || !action) return false

  if (action === 'select-task') {
    if (actionNode.dataset[`${DATASET_PREFIX}Task`] === '织带产出收货') {
      appStore.navigate('/wls/raw/pda/tmf-output-receipts')
      return true
    }
    state.activeTask = actionNode.dataset[`${DATASET_PREFIX}Task`] || ''
    showListFeedback(`已进入${state.activeTask}，请扫描条码`, 'info')
    refreshPda()
    return true
  }
  if (action === 'submit-scan') {
    submitScan()
    return true
  }
  return false
}
