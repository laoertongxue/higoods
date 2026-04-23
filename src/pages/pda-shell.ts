import { getFactoryMobileTodoActionRoute, getFactoryMobileTodoCount, getFactoryMobileTodos } from '../data/fcs/factory-mobile-todos.ts'
import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { getPdaRuntimeContext } from './pda-runtime'

export type PdaTabKey = 'task-receive' | 'exec' | 'handover' | 'warehouse' | 'settlement'

interface PdaTabConfig {
  key: PdaTabKey
  label: string
  href: string
  icon: string
}

interface PdaFrameOptions {
  headerTitle?: string
}

const MOBILE_APP_TABS: PdaTabConfig[] = [
  { key: 'task-receive', label: '接单', href: '/fcs/pda/task-receive', icon: 'clipboard-list' },
  { key: 'exec', label: '执行', href: '/fcs/pda/exec', icon: 'play' },
  { key: 'handover', label: '交接', href: '/fcs/pda/handover', icon: 'arrow-left-right' },
  { key: 'warehouse', label: '仓管', href: '/fcs/pda/warehouse', icon: 'warehouse' },
  { key: 'settlement', label: '结算', href: '/fcs/pda/settlement', icon: 'wallet' },
]

let todoModalOpen = false
let shownTodoSessionKey: string | null = null
let currentTodoSessionKey: string | null = null

function getSessionKey(): string | null {
  const runtime = getPdaRuntimeContext()
  if (!runtime) return null
  return [runtime.factoryId, runtime.loginId, runtime.userId].join(':')
}

function syncTodoModalAutoOpen(): void {
  const runtime = getPdaRuntimeContext()
  const sessionKey = getSessionKey()
  if (sessionKey !== currentTodoSessionKey) {
    currentTodoSessionKey = sessionKey
    todoModalOpen = false
  }
  if (!runtime || !sessionKey) return
  if (shownTodoSessionKey === sessionKey) return
  if (getFactoryMobileTodoCount(runtime.factoryId) <= 0) return
  todoModalOpen = true
  shownTodoSessionKey = sessionKey
}

function getTabTitle(activeTab: PdaTabKey | null, headerTitle?: string): string {
  if (headerTitle) return headerTitle
  if (!activeTab) return '工厂端移动应用'
  return MOBILE_APP_TABS.find((tab) => tab.key === activeTab)?.label ?? '工厂端移动应用'
}

function renderTodoTrigger(activeCount: number): string {
  return `
    <button
      type="button"
      class="relative inline-flex h-9 items-center justify-center rounded-full border bg-background px-3 text-foreground transition hover:bg-muted"
      data-pda-shell-action="open-todo-modal"
      data-pda-todo-trigger="true"
      aria-label="打开当前待办"
      title="当前待办"
    >
      <i data-lucide="bell" class="h-4 w-4"></i>
      <span class="ml-1 text-xs font-medium">待办</span>
      ${
        activeCount > 0
          ? `<span class="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">${activeCount}</span>`
          : ''
      }
    </button>
  `
}

function renderPdaTopBar(activeTab: PdaTabKey | null, headerTitle?: string): string {
  const runtime = getPdaRuntimeContext()
  const todoCount = runtime ? getFactoryMobileTodoCount(runtime.factoryId) : 0
  return `
    <header class="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
      <div class="flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold text-foreground">${escapeHtml(runtime?.factoryName || '工厂端移动应用')}</div>
          <div class="truncate text-[11px] text-muted-foreground">${escapeHtml(getTabTitle(activeTab, headerTitle))}</div>
        </div>
        ${renderTodoTrigger(todoCount)}
      </div>
    </header>
  `
}

function renderTodoModal(): string {
  const runtime = getPdaRuntimeContext()
  if (!runtime || !todoModalOpen) return ''
  const todoItems = getFactoryMobileTodos(runtime.factoryId).slice(0, 5)
  return `
    <div class="fixed inset-0 z-[120]" data-pda-todo-modal="true">
      <button
        type="button"
        class="absolute inset-0 bg-black/45"
        data-pda-shell-action="close-todo-modal"
        aria-label="关闭当前待办"
      ></button>
      <section class="absolute bottom-[72px] left-0 right-0 rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-foreground">当前待办</h2>
            <p class="mt-1 text-xs text-muted-foreground">优先处理待接单、待领料、待交出和差异项。</p>
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

export function renderPdaBottomNav(activeTab: PdaTabKey | null): string {
  return `
    <nav class="absolute bottom-0 left-0 right-0 z-10 flex h-[72px] items-center justify-around border-t bg-background px-1" data-pda-bottom-nav="true">
      ${MOBILE_APP_TABS.map((tab) => {
        const active = tab.key === activeTab
        return `
          <button
            type="button"
            class="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 transition-colors ${toClassName(
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}"
            data-nav="${tab.href}"
            data-pda-tab="${tab.key}"
          >
            <i data-lucide="${tab.icon}" class="h-5 w-5 shrink-0"></i>
            <span class="text-center text-[10px] font-medium leading-tight">${escapeHtml(tab.label)}</span>
          </button>
        `
      }).join('')}
    </nav>
  `
}

export function renderPdaFrame(content: string, activeTab: PdaTabKey | null, options: PdaFrameOptions = {}): string {
  syncTodoModalAutoOpen()
  return `
    <section class="relative flex min-h-[760px] flex-col overflow-hidden bg-background">
      ${renderPdaTopBar(activeTab, options.headerTitle)}
      <div class="min-h-0 flex-1 overflow-y-auto pb-[72px]">
        ${content}
      </div>
      ${renderPdaBottomNav(activeTab)}
      ${renderTodoModal()}
    </section>
  `
}

export function handlePdaShellEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-shell-action]')
  const action = actionNode?.dataset.pdaShellAction
  if (!action) return false

  if (action === 'open-todo-modal') {
    todoModalOpen = true
    return true
  }

  if (action === 'close-todo-modal') {
    todoModalOpen = false
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
  if (!todoModalOpen) return false
  todoModalOpen = false
  return true
}
