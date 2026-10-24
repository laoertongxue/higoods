import { getFactoryMobileTodoActionRoute, getFactoryMobileTodoCount, getFactoryMobileTodos } from '../data/fcs/factory-mobile-todos.ts'
import { getFactoryMasterRecordById } from '../data/fcs/factory-master-store.ts'
import { formatFactoryDisplayName } from '../data/fcs/factory-mock-data.ts'
import { isKolGotoFactory } from '../data/fcs/kol-goto-special-flow.ts'
import { ensurePdaAccessForRoute, logoutPdaAccess } from '../data/fcs/factory-onboarding-flow.ts'
import { findFactoryPdaRoleById } from '../data/fcs/store-domain-pda.ts'
import {
  PDA_SEWING_SELF_RETURN_MODE_ROUTE,
  shouldBlockPdaRouteBySewingSelfReturnMode,
} from '../data/fcs/pda-sewing-self-return-mode.ts'
import { renderRouteRedirect } from '../router/route-utils'
import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { getPdaRuntimeContext } from './pda-runtime'
import { isCurrentPdaExperienceRouteAllowed } from './pda-runtime'
import { isThirdPartyPdaFactory } from '../data/fcs/pda-experience-scope.ts'

export type PdaTabKey = 'task-receive' | 'exec' | 'handover' | 'warehouse' | 'settlement'

interface PdaTabConfig {
  key: PdaTabKey
  label: string
  href: string
  icon: string
}

interface PdaFrameOptions {
  headerTitle?: string
  disableTodoAutoOpen?: boolean
  hideBottomNav?: boolean
}

const MOBILE_APP_TABS: PdaTabConfig[] = [
  { key: 'task-receive', label: '接单', href: '/fcs/pda/task-receive', icon: 'clipboard-list' },
  { key: 'exec', label: '执行', href: '/fcs/pda/exec', icon: 'play' },
  { key: 'handover', label: '交接', href: '/fcs/pda/handover', icon: 'arrow-left-right' },
  { key: 'warehouse', label: '仓管', href: '/fcs/pda/warehouse', icon: 'warehouse' },
  { key: 'settlement', label: '结算', href: '/fcs/pda/settlement', icon: 'wallet' },
]

function getVisibleMobileAppTabs(): PdaTabConfig[] {
  const runtime = getPdaRuntimeContext()
  const factory = runtime ? getFactoryMasterRecordById(runtime.factoryId) : undefined
  if (isThirdPartyPdaFactory(factory)) {
    return MOBILE_APP_TABS.filter((tab) => tab.key !== 'warehouse'
      && (!isKolGotoFactory(runtime?.factoryId) || tab.key !== 'settlement' || runtime?.roleId === 'ROLE_ADMIN'))
  }
  if (isKolGotoFactory(runtime?.factoryId)) {
    return MOBILE_APP_TABS.filter((tab) => tab.key !== 'settlement' || runtime?.roleId === 'ROLE_ADMIN')
  }
  return MOBILE_APP_TABS
}

let todoModalOpen = false
let accountModalOpen = false
let logoutConfirmOpen = false
let shownTodoSessionKey: string | null = null
let currentTodoSessionKey: string | null = null
let currentPdaPathKey: string | null = null

function getSessionKey(): string | null {
  const runtime = getPdaRuntimeContext()
  if (!runtime) return null
  return [runtime.factoryId, runtime.loginId, runtime.userId].join(':')
}

function syncTodoModalAutoOpen(disableAutoOpen = false): void {
  const runtime = getPdaRuntimeContext()
  const sessionKey = getSessionKey()
  const pathname = appStore.getState().pathname || ''
  if (sessionKey !== currentTodoSessionKey) {
    currentTodoSessionKey = sessionKey
    todoModalOpen = false
    accountModalOpen = false
    logoutConfirmOpen = false
  }
  if (pathname !== currentPdaPathKey) {
    currentPdaPathKey = pathname
    todoModalOpen = false
    accountModalOpen = false
    logoutConfirmOpen = false
  }
  if (disableAutoOpen) return
  if (!runtime || !sessionKey) return
  shownTodoSessionKey = sessionKey
}


function renderTodoTrigger(activeCount: number): string {
  return `
    <button
      type="button"
      class="relative flex min-h-12 min-w-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[12px] font-medium leading-4 text-[#2458aa] transition hover:bg-[#e9f0fd]"
      data-pda-shell-action="open-todo-modal"
      data-pda-todo-trigger="true"
      aria-label="打开当前待办"
      title="当前待办"
    >
      <span class="relative flex items-center justify-center">
        <i data-lucide="bell" class="h-5 w-5"></i>
        ${
          activeCount > 0
            ? `<span class="absolute -right-2 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#e23b3b] px-1 text-[10px] font-semibold leading-[18px] text-white">${activeCount}</span>`
            : ''
        }
      </span>
      <span>待办</span>
    </button>
  `
}

function getPdaRoleDisplayName(roleId: string, factoryId: string): string {
  return findFactoryPdaRoleById(roleId, factoryId)?.roleName || '仓管'
}

function renderAccountTrigger(): string {
  const runtime = getPdaRuntimeContext()
  if (!runtime) return ''
  return `
    <button
      type="button"
      class="flex min-h-12 min-w-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[12px] font-medium leading-4 text-[#2458aa] transition hover:bg-[#e9f0fd]"
      data-pda-shell-action="open-account-modal"
      aria-label="打开账号信息"
      title="${escapeHtml(`${runtime.userName} / ${runtime.loginId}`)}"
    >
      <i data-lucide="user-round" class="h-5 w-5"></i>
      <span>账号</span>
    </button>
  `
}

function renderPdaTopBar(headerTitle?: string): string {
  const runtime = getPdaRuntimeContext()
  let todoTrigger = renderTodoTrigger(0)
  if (runtime) {
    try { todoTrigger = renderTodoTrigger(getFactoryMobileTodoCount(runtime.factoryId, runtime.roleId)) }
    catch {
      // 待办汇总还包含未迁移模块；来源不可读不能伪装成0，也不阻断已保存的交接详情。
      todoTrigger = '<span role="status" class="max-w-[112px] text-xs text-amber-800" title="待办来源暂不可读，请恢复浏览器存储访问后刷新。">待办暂不可用</span>'
    }
  }
  const factoryTitle = runtime?.factoryName || '工厂端移动应用'
  const identity = factoryTitle
  const accountName = runtime?.userName.trim() || ''
  const context = [accountName, headerTitle].filter(Boolean).join(' · ')
  return `
    <header class="sticky top-0 z-20 border-b border-[#dce4ed] bg-white px-3 py-2">
      <div class="flex items-center gap-2">
        <div class="min-w-0 flex-1 leading-tight">
          <div class="truncate text-[15px] font-bold text-[#1c2c40]" title="${escapeHtml(identity)}">${escapeHtml(identity)}</div>
          <div class="truncate text-[12px] text-[#52667d]" title="${escapeHtml(context)}">${escapeHtml(context)}</div>
        </div>
        ${todoTrigger}
        ${renderAccountTrigger()}
      </div>
    </header>
  `
}

function renderTodoModal(): string {
  const runtime = getPdaRuntimeContext()
  if (!runtime || !todoModalOpen) return ''
  const todoItems = getFactoryMobileTodos(runtime.factoryId, runtime.roleId).slice(0, 5)
  const todoHint = isKolGotoFactory(runtime.factoryId)
    ? '优先处理加工领料、交出和可完成任务。'
    : '优先处理待接单、待接收、待交出和差异项。'
  return `
    <div class="fixed inset-0 z-[120]" data-pda-todo-modal="true">
      <button
        type="button"
        class="absolute inset-0 bg-black/45"
        data-pda-shell-action="close-todo-modal"
        aria-label="关闭当前待办"
      ></button>
      <section class="absolute bottom-16 left-0 right-0 rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-foreground">当前待办</h2>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(todoHint)}</p>
          </div>
          <button
            type="button"
            class="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            data-pda-shell-action="close-todo-modal"
          >
            关闭
          </button>
        </div>

        <div class="mt-4 space-y-3">
          ${
            todoItems.length > 0
              ? todoItems
                  .map(
                    (todo) => `
                      <article class="rounded-2xl border bg-card px-3 py-3 shadow-sm">
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0 flex-1">
                            <button
                              type="button"
                              class="text-left text-sm font-semibold text-foreground hover:text-primary"
                              data-pda-shell-action="open-todo-route"
                              data-href="${escapeHtml(todo.detailRoute)}"
                            >
                              ${escapeHtml(todo.todoTitle)}
                            </button>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(todo.todoType)} · ${escapeHtml(todo.todoNo)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(todo.todoSubtitle)}</div>
                            <div class="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span class="rounded-full bg-muted px-2 py-0.5">${escapeHtml(todo.priority)}</span>
                              <span>到期：${escapeHtml(todo.dueAt || '待安排')}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            class="inline-flex h-8 items-center justify-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground"
                            data-pda-shell-action="open-todo-route"
                            data-href="${escapeHtml(getFactoryMobileTodoActionRoute(todo))}"
                          >
                            ${escapeHtml(todo.actionLabel)}
                          </button>
                        </div>
                      </article>
                    `,
                  )
                  .join('')
              : '<div class="rounded-2xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">暂无待办</div>'
          }
        </div>

        <div class="mt-4 flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-xl border px-3 py-2.5 text-sm hover:bg-muted"
            data-pda-shell-action="open-todo-route"
            data-href="/fcs/pda/notify"
          >
            查看全部
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl border px-3 py-2.5 text-sm hover:bg-muted"
            data-pda-shell-action="close-todo-modal"
          >
            关闭
          </button>
        </div>
      </section>
    </div>
  `
}

function renderAccountModal(): string {
  const runtime = getPdaRuntimeContext()
  if (!runtime || !accountModalOpen) return ''
  const roleName = getPdaRoleDisplayName(runtime.roleId, runtime.factoryId)
  const factoryLabel = formatFactoryDisplayName(runtime.factoryName, runtime.factoryId)
  return `
    <div class="fixed inset-0 z-[125]" data-pda-account-modal="true">
      <button
        type="button"
        class="absolute inset-0 bg-black/45"
        data-pda-shell-action="close-account-modal"
        aria-label="关闭账号信息"
      ></button>
      <section class="absolute bottom-16 left-0 right-0 rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-foreground">当前账号</h2>
            <p class="mt-1 text-xs text-muted-foreground">账号信息只用于现场确认身份。</p>
          </div>
          <button
            type="button"
            class="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            data-pda-shell-action="close-account-modal"
          >
            关闭
          </button>
        </div>

        <div class="mt-4 rounded-2xl border bg-card px-4 py-4">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
              ${escapeHtml(runtime.userName.trim().slice(0, 1) || runtime.loginId.slice(0, 1))}
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold text-foreground">${escapeHtml(runtime.userName)}</div>
              <div class="truncate text-xs text-muted-foreground">账号：${escapeHtml(runtime.loginId)}</div>
            </div>
          </div>
          <div class="mt-4 grid grid-cols-1 gap-2 text-xs">
            <div class="rounded-xl bg-muted/60 px-3 py-2">
              <div class="text-muted-foreground">角色</div>
              <div class="mt-1 font-medium text-foreground">${escapeHtml(roleName)}</div>
            </div>
            <div class="rounded-xl bg-muted/60 px-3 py-2">
              <div class="text-muted-foreground">工厂</div>
              <div class="mt-1 font-medium text-foreground">${escapeHtml(factoryLabel)}</div>
            </div>
          </div>
        </div>

        ${
          logoutConfirmOpen
            ? `
              <div class="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4">
                <div class="text-sm font-semibold text-destructive">确认退出当前账号？</div>
                <div class="mt-1 text-xs leading-5 text-muted-foreground">退出后需要重新登录才能继续使用 PDA。</div>
                <div class="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    class="rounded-xl border bg-background px-3 py-2.5 text-sm"
                    data-pda-shell-action="cancel-logout"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    class="rounded-xl bg-destructive px-3 py-2.5 text-sm font-medium text-destructive-foreground"
                    data-pda-shell-action="confirm-logout"
                  >
                    退出登录
                  </button>
                </div>
              </div>
            `
            : `
              <button
                type="button"
                class="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive"
                data-pda-shell-action="request-logout"
              >
                退出登录
              </button>
            `
        }
      </section>
    </div>
  `
}

export function renderPdaBottomNav(activeTab: PdaTabKey | null): string {
  return `
    <nav class="absolute bottom-0 left-0 right-0 z-10 flex min-h-16 items-stretch border-t border-[#dfe6ee] bg-white px-1 pb-[env(safe-area-inset-bottom)]" data-pda-bottom-nav="true">
      ${getVisibleMobileAppTabs().map((tab) => {
        const active = tab.key === activeTab
        return `
          <button
            type="button"
            class="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-[11px] leading-4 transition-colors ${toClassName(
              active ? 'font-semibold text-[#2461ed]' : 'text-[#738198] hover:text-[#1a293c]',
            )}"
            data-nav="${tab.href}"
            data-pda-tab="${tab.key}"
          >
            ${active ? '<span class="absolute top-0 h-[3px] w-7 rounded-full bg-[#2461ed]" aria-hidden="true"></span>' : ''}
            <i data-lucide="${tab.icon}" class="h-[22px] w-[22px] shrink-0"></i>
            <span class="text-center font-medium leading-tight">${escapeHtml(tab.label)}</span>
          </button>
        `
      }).join('')}
    </nav>
  `
}

export function renderPdaFrame(content: string, activeTab: PdaTabKey | null, options: PdaFrameOptions = {}): string {
  const currentPath = appStore.getState().pathname || '/fcs/pda/exec'
  if (!isCurrentPdaExperienceRouteAllowed(currentPath)) return renderRouteRedirect('/fcs/pda/exec', '执行')
  const access = ensurePdaAccessForRoute(currentPath)
  if (!access.allowed) {
    return renderRouteRedirect(access.redirectPath || '/fcs/pda/auth/login', access.reasonLabel || '工厂入驻&登录')
  }
  if (shouldBlockPdaRouteBySewingSelfReturnMode(currentPath)) {
    return renderRouteRedirect(PDA_SEWING_SELF_RETURN_MODE_ROUTE, '车缝现场交货登记模式')
  }

  syncTodoModalAutoOpen(Boolean(options.disableTodoAutoOpen))
  return `
    <section class="relative flex h-screen min-h-0 flex-col overflow-hidden bg-[#f2f5f9]">
      ${renderPdaTopBar(options.headerTitle)}
      <div class="min-h-0 flex-1 overflow-y-auto bg-[#f2f5f9] ${options.hideBottomNav ? '' : 'pb-16'}" data-pda-scroll-container="true">
        ${content}
      </div>
      ${options.hideBottomNav ? '' : renderPdaBottomNav(activeTab)}
      ${renderTodoModal()}
      ${renderAccountModal()}
    </section>
  `
}

export function handlePdaShellEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-shell-action]')
  const action = actionNode?.dataset.pdaShellAction
  if (!action) return false

  if (action === 'open-todo-modal') {
    todoModalOpen = true
    accountModalOpen = false
    logoutConfirmOpen = false
    return true
  }

  if (action === 'close-todo-modal') {
    todoModalOpen = false
    return true
  }

  if (action === 'open-account-modal') {
    accountModalOpen = true
    todoModalOpen = false
    logoutConfirmOpen = false
    return true
  }

  if (action === 'close-account-modal') {
    accountModalOpen = false
    logoutConfirmOpen = false
    return true
  }

  if (action === 'request-logout') {
    logoutConfirmOpen = true
    return true
  }

  if (action === 'cancel-logout') {
    logoutConfirmOpen = false
    return true
  }

  if (action === 'confirm-logout') {
    logoutPdaAccess()
    todoModalOpen = false
    accountModalOpen = false
    logoutConfirmOpen = false
    appStore.navigate('/fcs/pda/auth/login', { historyMode: 'replace' })
    return true
  }

  if (action === 'open-todo-route' && actionNode.dataset.href) {
    appStore.navigate(actionNode.dataset.href)
    todoModalOpen = false
    return true
  }

  return false
}

export function closePdaShellDialogsOnEscape(): boolean {
  if (!todoModalOpen && !accountModalOpen) return false
  todoModalOpen = false
  accountModalOpen = false
  logoutConfirmOpen = false
  return true
}
