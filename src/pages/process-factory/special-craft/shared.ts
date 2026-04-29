import { getFactoryMasterRecordById } from '../../../data/fcs/factory-master-store.ts'
import { formatFactoryDisplayName } from '../../../data/fcs/factory-mock-data.ts'
import {
  canFactorySeeSpecialCraftOperation,
  type SpecialCraftOperationDefinition,
} from '../../../data/fcs/special-craft-operations.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml, formatDateTime } from '../../../utils.ts'

type MetricCard = {
  label: string
  value: string
  tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'violet'
}

type SubNavKey = 'tasks' | 'wait-process' | 'wait-handover' | 'statistics'

interface SpecialCraftFactoryContextGuard {
  factoryId: string | null
  factoryName: string
  blocked: boolean
}

function toneClass(tone: MetricCard['tone']): string {
  if (tone === 'green') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (tone === 'blue') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (tone === 'red') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (tone === 'violet') return 'border-violet-200 bg-violet-50 text-violet-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

export function formatQty(value: number | undefined): string {
  const safeValue = Number.isFinite(value) ? Number(value) : 0
  return safeValue.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

export function formatSpecialCraftFactoryLabel(factoryName?: string, factoryId?: string | null): string {
  return formatFactoryDisplayName(factoryName, factoryId || undefined)
}

export function renderStatusBadge(label: string): string {
  const tone =
    label.includes('差异') || label.includes('异议') || label.includes('异常')
      ? 'red'
      : label.includes('待领料') || label.includes('待交出')
        ? 'amber'
        : label.includes('加工中')
          ? 'blue'
          : label.includes('已完成') || label.includes('已回写') || label.includes('已入')
            ? 'green'
            : 'slate'
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(tone)}">${escapeHtml(label)}</span>`
}

export function renderMetricCards(cards: MetricCard[]): string {
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${cards
        .map(
          (card) => `
            <article class="rounded-2xl border bg-white p-4 shadow-sm">
              <div class="text-sm text-muted-foreground">${escapeHtml(card.label)}</div>
              <div class="mt-2 text-2xl font-semibold ${toneClass(card.tone).split(' ').at(-1)}">${escapeHtml(card.value)}</div>
            </article>
          `,
        )
        .join('')}
    </section>
  `
}

export function renderFilterGrid(items: Array<{ label: string; value: string }>): string {
  return `
    <section class="rounded-2xl border bg-white p-4 shadow-sm">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${items
          .map(
            (item) => `
              <div class="space-y-1">
                <div class="text-xs font-medium text-muted-foreground">${escapeHtml(item.label)}</div>
                <div class="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-foreground">${escapeHtml(item.value)}</div>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

export function renderTable(headers: string[], rows: string, minWidthClass = 'min-w-[1520px]'): string {
  return `
    <div class="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table class="w-full ${minWidthClass} table-auto border-collapse text-sm">
        <thead class="bg-slate-50 text-left text-slate-600">
          <tr>
            ${headers.map((header) => `<th class="px-3 py-3 font-medium">${escapeHtml(header)}</th>`).join('')}
          </tr>
        </thead>
        <tbody class="divide-y">${rows}</tbody>
      </table>
    </div>
  `
}

export function renderEmptyState(message = '暂无数据'): string {
  return `
    <div class="rounded-2xl border border-dashed bg-white px-6 py-10 text-center text-sm text-muted-foreground">
      ${escapeHtml(message)}
    </div>
  `
}

function getSpecialCraftFactoryContextFactoryId(): string | null {
  const pathname = appStore.getState().pathname || ''
  const [, queryString = ''] = pathname.split('?')
  const params = new URLSearchParams(queryString)
  return params.get('factoryId') || params.get('currentFactoryId') || params.get('pdaFactoryId')
}

export function resolveSpecialCraftFactoryContextGuard(
  operation: Pick<SpecialCraftOperationDefinition, 'operationId'>,
): SpecialCraftFactoryContextGuard {
  const factoryId = getSpecialCraftFactoryContextFactoryId()
  if (!factoryId) {
    return {
      factoryId: null,
      factoryName: '',
      blocked: false,
    }
  }

  const factory = getFactoryMasterRecordById(factoryId)
  const factoryName = formatFactoryDisplayName(factory?.name || factoryId, factory?.code || factoryId)

  return {
    factoryId,
    factoryName,
    blocked: !canFactorySeeSpecialCraftOperation(factoryId, operation.operationId),
  }
}

export function renderSpecialCraftFactoryContextBlockedLayout(input: {
  operation: SpecialCraftOperationDefinition
  title: string
  description: string
  activeSubNav: SubNavKey
  factoryName?: string
}): string {
  return renderSpecialCraftPageLayout({
    operation: input.operation,
    title: input.title,
    description: input.description,
    activeSubNav: input.activeSubNav,
    content: renderEmptyState(
      input.factoryName
        ? `${input.factoryName}当前无该特殊工艺入口`
        : '当前工厂无该特殊工艺入口',
    ),
  })
}

export function renderSpecialCraftPageLayout(input: {
  operation: SpecialCraftOperationDefinition
  title: string
  description: string
  activeSubNav: SubNavKey
  content: string
}): string {
  const { title, content } = input

  return `
    <div class="space-y-4">
      <header class="rounded-2xl border bg-white p-5 shadow-sm">
        <h1 class="text-2xl font-semibold text-foreground">${escapeHtml(title)}</h1>
      </header>
      ${content}
    </div>
  `
}

export function renderLinkedRecord(recordNo: string | undefined, href: string | undefined, fallback = '—'): string {
  if (!recordNo || !href) return fallback
  return `<button type="button" class="text-left text-blue-700 hover:underline" data-nav="${escapeHtml(href)}">${escapeHtml(recordNo)}</button>`
}

export function renderDateTime(value: string | undefined): string {
  if (!value) return '—'
  return escapeHtml(formatDateTime(value))
}
