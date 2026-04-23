import { appStore } from '../state/store'
import {
  getFactoryMobileTodoActionRoute,
  getFactoryMobileTodoSummary,
  getFactoryMobileTodos,
  type FactoryMobileTodo,
  type FactoryMobileTodoType,
} from '../data/fcs/factory-mobile-todos.ts'
import { escapeHtml, toClassName } from '../utils'
import { renderPdaFrame } from './pda-shell'
import {
  ensurePdaSessionForAction,
  getPdaRuntimeContext,
  renderPdaLoginRedirect,
} from './pda-runtime'

type TodoFilter = '全部' | FactoryMobileTodoType

interface NotifyState {
  filter: TodoFilter
}

const state: NotifyState = {
  filter: '全部',
}

const FILTERS: Array<{ value: TodoFilter; label: string }> = [
  { value: '全部', label: '全部' },
  { value: '待接单', label: '待接单' },
  { value: '待领料', label: '待领料' },
  { value: '待开工', label: '待开工' },
  { value: '待完工', label: '待完工' },
  { value: '待交出', label: '待交出' },
  { value: '差异待处理', label: '差异待处理' },
  { value: '异常待处理', label: '异常待处理' },
  { value: '对账待确认', label: '对账待确认' },
]

function getCurrentFactoryTodos(): FactoryMobileTodo[] {
  const runtime = getPdaRuntimeContext()
  if (!runtime) return []
  return getFactoryMobileTodos(runtime.factoryId).filter((item) => (state.filter === '全部' ? true : item.todoType === state.filter))
}

function renderFilterChips(): string {
  return `
    <div class="flex gap-2 overflow-x-auto pb-1">
      ${FILTERS.map(
        (item) => `
          <button
            type="button"
            class="whitespace-nowrap rounded-full border px-3 py-1.5 text-xs ${toClassName(
              state.filter === item.value ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground',
            )}"
            data-pda-notify-field="filter"
            data-value="${escapeHtml(item.value)}"
          >
            ${escapeHtml(item.label)}
          </button>
        `,
      ).join('')}
    </div>
  `
}

function renderSummaryCards(factoryId: string): string {
  const summary = getFactoryMobileTodoSummary(factoryId)
  return `
    <section class="grid grid-cols-2 gap-3">
      ${[
        { label: '全部待办', value: summary.total, tone: 'text-foreground' },
        { label: '紧急', value: summary.urgent, tone: 'text-destructive' },
        { label: '今日到期', value: summary.dueToday, tone: 'text-amber-700' },
        { label: '差异', value: summary.difference, tone: 'text-destructive' },
        { label: '对账', value: summary.settlement, tone: 'text-primary' },
      ]
        .map(
          (card) => `
            <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
              <div class="text-xs text-muted-foreground">${escapeHtml(card.label)}</div>
              <div class="mt-2 text-xl font-semibold ${card.tone}">${card.value}</div>
            </article>
          `,
        )
        .join('')}
    </section>
  `
}

function renderTodoCard(todo: FactoryMobileTodo): string {
  return `
    <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm" data-pda-todo-card-id="${escapeHtml(todo.todoId)}">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">${escapeHtml(todo.todoType)}</span>
            <span class="rounded-full px-2 py-0.5 text-[11px] ${toClassName(
              todo.priority === '紧急'
                ? 'bg-destructive/10 text-destructive'
                : todo.priority === '加急'
                  ? 'bg-amber-500/10 text-amber-700'
                  : 'bg-primary/10 text-primary',
            )}">${escapeHtml(todo.priority)}</span>
            <span class="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">${escapeHtml(todo.status)}</span>
          </div>
          <button type="button" class="mt-3 text-left text-sm font-semibold text-foreground hover:text-primary" data-nav="${escapeHtml(todo.detailRoute)}">
            ${escapeHtml(todo.todoTitle)}
          </button>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(todo.todoNo)} · ${escapeHtml(todo.todoSubtitle)}</div>
          <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>关联单号：${escapeHtml(todo.relatedTaskNo || todo.relatedHandoverOrderId || todo.relatedSettlementId || '-')}</div>
            <div>工厂：${escapeHtml(todo.factoryName)}</div>
            <div>到期时间：${escapeHtml(todo.dueAt || '-')}</div>
            <div>操作：${escapeHtml(todo.actionLabel)}</div>
          </div>
        </div>
      </div>
      <div class="mt-4 flex gap-2">
        <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-nav="${escapeHtml(getFactoryMobileTodoActionRoute(todo))}">去处理</button>
        <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-nav="${escapeHtml(todo.detailRoute)}">查看详情</button>
      </div>
    </article>
  `
}

export function renderPdaNotifyPage(): string {
  const runtime = getPdaRuntimeContext()
  if (!runtime) return renderPdaLoginRedirect()

  const todos = getCurrentFactoryTodos()
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="text-lg font-semibold text-foreground">待办汇总</div>
        <div class="mt-1 text-xs text-muted-foreground">按待办类型汇总接单、执行、交接、仓管和结算处理项。</div>
      </section>
      ${renderSummaryCards(runtime.factoryId)}
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        ${renderFilterChips()}
      </section>
      <section class="space-y-3">
        ${
          todos.length > 0
            ? todos.map((todo) => renderTodoCard(todo)).join('')
            : '<div class="rounded-2xl border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">暂无待办</div>'
        }
      </section>
    </div>
  `
  return renderPdaFrame(content, null, { headerTitle: '待办汇总' })
}

export function handlePdaNotifyEvent(target: HTMLElement): boolean {
  if (!ensurePdaSessionForAction()) return true
  const fieldNode = target.closest<HTMLElement>('[data-pda-notify-field]')
  if (!fieldNode) return false
  if (fieldNode.dataset.pdaNotifyField === 'filter' && fieldNode.dataset.value) {
    state.filter = fieldNode.dataset.value as TodoFilter
    return true
  }
  return false
}
