// 成衣仓 PDA — 手持终端作业主页

import type { AppState } from '../../../state/store';
import { escapeHtml, localDateTimeText } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'

const EVENT_PREFIX = 'wls-finished-pda'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

const state: { scan: string; feedback: string; feedbackTone: 'ok' | 'error' } = {
  scan: '',
  feedback: '',
  feedbackTone: 'ok',
}

interface PdaMenuItem {
  key: string;
  title: string;
  desc: string;
  icon: string;
  badge?: number;
}

interface PdaMenuGroup {
  groupTitle: string;
  items: PdaMenuItem[];
}

const MENU_GROUPS: PdaMenuGroup[] = [
  {
    groupTitle: '入库作业',
    items: [
      { key: 'receive-scan', title: '收货扫描', desc: '扫描单据或条码收货', icon: '📦', badge: 3 },
      { key: 'putaway', title: '上架', desc: '将货物放到指定库位', icon: '📤', badge: 5 },
    ],
  },
  {
    groupTitle: '出库作业',
    items: [
      { key: 'picking', title: '拣货', desc: '按出库单拣选货物', icon: '🛒', badge: 8 },
      { key: 'ship-scan', title: '发货扫描', desc: '扫描确认发货', icon: '🚚' },
    ],
  },
  {
    groupTitle: '库存作业',
    items: [
      { key: 'transfer', title: '移库', desc: '库位之间移动货物', icon: '🔄' },
      { key: 'stocktake', title: '盘点', desc: '库存数量核对', icon: '📋' },
    ],
  },
  {
    groupTitle: '退货作业',
    items: [
      { key: 'return-receive', title: '退货收货', desc: '接收退回货物', icon: '↩️', badge: 2 },
    ],
  },
];

const PENDING_SUMMARY = [
  { label: '待上架', count: 3, tone: 'bg-amber-500' },
  { label: '待拣货', count: 5, tone: 'bg-blue-500' },
  { label: '待收货', count: 2, tone: 'bg-rose-500' },
];

function renderPdaWorkspace(): string {
  const pendingTotal = PENDING_SUMMARY.reduce((s, p) => s + p.count, 0);

  const pendingBanner = `
    <div class="mx-4 mt-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-white shadow-sm">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm font-bold">${pendingTotal}</span>
          <span class="text-sm font-medium">待处理任务</span>
        </div>
        <span class="text-xs text-blue-100">点击菜单开始作业</span>
      </div>
      <div class="mt-2.5 flex gap-2">
        ${PENDING_SUMMARY.map(
          (p) => `
          <span class="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs">
            <span class="h-1.5 w-1.5 rounded-full ${p.tone}"></span>
            ${p.count} ${p.label}
          </span>`,
        ).join('')}
      </div>
    </div>`;

  const renderMenuItem = (item: PdaMenuItem): string => `
    <button
      class="pda-menu-card group flex flex-col items-center rounded-xl bg-white p-3 shadow-sm active:scale-[0.97] active:bg-slate-50 transition-all duration-100"
      data-${EVENT_PREFIX}-action="open-task" data-${EVENT_PREFIX}-task="${escapeHtml(item.key)}" data-${EVENT_PREFIX}-title="${escapeHtml(item.title)}"
    >
      <div class="relative mb-1.5 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-2xl">
        ${item.icon}
        ${item.badge ? `<span class="absolute -right-1 -top-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white leading-none">${item.badge}</span>` : ''}
      </div>
      <span class="text-[13px] font-semibold text-slate-800 leading-tight">${item.title}</span>
      <span class="mt-0.5 text-[10px] text-slate-400 leading-tight text-center line-clamp-1">${item.desc}</span>
    </button>`;

  const menuGroupsHtml = MENU_GROUPS.map(
    (group) => `
    <div class="mx-4 mt-4">
      <h3 class="mb-2 text-xs font-semibold text-slate-500 tracking-wide">${group.groupTitle}</h3>
      <div class="grid grid-cols-4 gap-2.5">
        ${group.items.map(renderMenuItem).join('')}
      </div>
    </div>`,
  ).join('');

  const scanArea = `
    <div class="fixed bottom-0 left-1/2 w-[470px] -translate-x-1/2 border-t border-slate-200 bg-white px-4 pb-5 pt-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">⎚</span>
          <input
            type="text"
            placeholder="扫码输入 — 请扫描条码或单据号"
            value="${escapeHtml(state.scan)}"
            data-${EVENT_PREFIX}-field="scan"
            data-scan-enter="true"
            data-skip-page-rerender="true"
            class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-300 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
            autocomplete="off"
          />
        </div>
        <button
          data-${EVENT_PREFIX}-action="submit-scan"
          class="flex h-[42px] items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white active:bg-blue-700 transition"
        >
          确认
        </button>
      </div>
      ${state.feedback ? `<p class="mt-1.5 text-xs text-center ${state.feedbackTone === 'error' ? 'text-rose-500' : 'text-emerald-600'}">${escapeHtml(state.feedback)}</p>` : ''}
    </div>`;

  const operatorBar = `
    <div class="mx-4 mt-6 mb-28 flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
      <div class="flex items-center gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">张</span>
        <div>
          <p class="text-xs font-semibold text-slate-700 leading-none">张伟</p>
          <p class="mt-0.5 text-[10px] text-slate-400">OP-001</p>
        </div>
      </div>
      <div class="flex items-center gap-3 text-slate-400">
        <button type="button" class="text-xs text-slate-500 active:text-slate-700" data-${EVENT_PREFIX}-action="refresh">刷新</button>
        <span class="h-3 w-px bg-slate-200"></span>
        <button type="button" class="text-xs text-slate-500 active:text-slate-700" data-${EVENT_PREFIX}-action="logout">退出</button>
      </div>
    </div>`;

  return `
    <div class="min-h-screen bg-slate-100" style="padding-bottom: env(safe-area-inset-bottom, 0);">
      <div class="relative mx-auto min-h-screen max-w-[470px] bg-slate-100">

        <!-- Top Bar -->
        <div class="sticky top-0 z-20 flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 shadow-md">
          <div class="flex items-center gap-2.5">
            <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-base">🏭</span>
            <div>
              <h1 class="text-sm font-bold text-white leading-none">成衣仓 PDA</h1>
              <p class="mt-0.5 text-[10px] text-slate-400">手持终端作业中心</p>
            </div>
          </div>
          <button class="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white active:bg-white/20 transition" data-${EVENT_PREFIX}-action="focus-scan" title="扫码">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
              <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
              <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              <line x1="7" y1="12" x2="17" y2="12"/>
              <line x1="7" y1="8" x2="9" y2="8"/>
              <line x1="7" y1="16" x2="9" y2="16"/>
              <line x1="11" y1="8" x2="13" y2="8"/>
              <line x1="11" y1="16" x2="13" y2="16"/>
              <line x1="15" y1="8" x2="17" y2="8"/>
              <line x1="15" y1="16" x2="17" y2="16"/>
            </svg>
          </button>
        </div>

        <!-- Pending Tasks Banner -->
        ${pendingBanner}

        <!-- Menu Groups -->
        ${menuGroupsHtml}

        <!-- Operator Info -->
        ${operatorBar}

        <!-- Scan Input Area (fixed bottom) -->
        ${scanArea}

      </div>

    </div>`;
}

function pdaRoot(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-root]`)
}

function refreshPda(): void {
  const host = document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-workspace]`)
  if (!host) return
  host.innerHTML = renderPdaWorkspace()
  hydrateIcons(host)
}

function readScanValue(): string {
  const input = pdaRoot()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="scan"]`)
  return input ? input.value.trim() : state.scan.trim()
}

function submitScan(): void {
  const code = readScanValue()
  if (!code) {
    state.feedback = '请先扫描或输入条码号'
    state.feedbackTone = 'error'
    showListFeedback('请先扫描或输入条码号', 'warning')
    refreshPda()
    return
  }
  state.feedback = `已识别 ${code}，请进入对应作业继续处理`
  state.feedbackTone = 'ok'
  state.scan = ''
  showListFeedback(`已识别 ${code}`)
  refreshPda()
}

export function renderFinishedPda(): string {
  return `<div data-${EVENT_PREFIX}-root><div data-${EVENT_PREFIX}-workspace>${renderPdaWorkspace()}</div></div>`
}

export function handleFinishedPdaEvent(target: HTMLElement, event?: Event): boolean {
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

  if (action === 'open-task') {
    const title = actionNode.dataset[`${DATASET_PREFIX}Title`] || actionNode.dataset[`${DATASET_PREFIX}Task`] || ''
    state.feedback = `已进入 ${title}，请扫描条码或单据号`
    state.feedbackTone = 'ok'
    showListFeedback(`已进入 ${title}`, 'info')
    refreshPda()
    return true
  }
  if (action === 'submit-scan') { submitScan(); return true }
  if (action === 'focus-scan') {
    state.feedback = '请扫描条码'
    state.feedbackTone = 'ok'
    refreshPda()
    pdaRoot()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="scan"]`)?.focus()
    return true
  }
  if (action === 'refresh') {
    state.feedback = `数据已刷新 ${localDateTimeText()}`
    state.feedbackTone = 'ok'
    showListFeedback('数据已刷新')
    refreshPda()
    return true
  }
  if (action === 'logout') {
    showListFeedback('原型演示：退出登录不改变当前账号', 'info')
    return true
  }
  return false
}
