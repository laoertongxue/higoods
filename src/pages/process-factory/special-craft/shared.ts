import { getFactoryMasterRecordById } from '../../../data/fcs/factory-master-store.ts'
import { formatFactoryDisplayName } from '../../../data/fcs/factory-mock-data.ts'
import type { ProcessWebAction } from '../../../data/fcs/process-web-status-actions.ts'
import {
  canFactorySeeSpecialCraftOperation,
  type SpecialCraftOperationDefinition,
} from '../../../data/fcs/special-craft-operations.ts'
import type { SpecialCraftTaskOrder } from '../../../data/fcs/special-craft-task-orders.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml, formatDateTime } from '../../../utils.ts'

type MetricCard = {
  label: string
  value: string
  tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'violet'
}

type SubNavKey = 'tasks' | 'wait-process' | 'wait-handover'

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
  actionsHtml?: string
}): string {
  const { operation, title, description, content, actionsHtml } = input

  return `
    <div class="space-y-4">
      <nav aria-label="面包屑" class="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <span>${escapeHtml(operation.managementDomainName)}</span>
        <span aria-hidden="true">/</span>
        <span>${escapeHtml(operation.operationName)}</span>
        <span aria-hidden="true">/</span>
        <span class="text-foreground">${escapeHtml(title)}</span>
      </nav>
      <header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="space-y-1">
          <h1 class="text-2xl font-semibold text-foreground">${escapeHtml(title)}</h1>
          ${description ? `<p class="text-sm text-muted-foreground">${escapeHtml(description)}</p>` : ''}
        </div>
        ${actionsHtml ? `<div class="shrink-0">${actionsHtml}</div>` : ''}
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

export function getFastSpecialCraftWebActions(taskOrder: SpecialCraftTaskOrder): ProcessWebAction[] {
  const status = taskOrder.status
  const objectType = taskOrder.targetObject
  const actionDefs: Array<{
    actionCode: string
    actionLabel: string
    fromStatuses: string[]
    toStatus: string
    requiredFields: string[]
    optionalFields?: string[]
  }> = [
    {
      actionCode: 'SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND',
      actionLabel: '成衣仓出库',
      fromStatuses: ['待领料'],
      toStatus: '成衣仓已出库待收货',
      requiredFields: ['出库人', '出库时间', '逐 SKU 实出件数'],
      optionalFields: ['备注'],
    },
    {
      actionCode: 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
      actionLabel: '确认接收裁片',
      fromStatuses: ['待接收', '待领料', '成衣仓已出库待收货'],
      toStatus: '已入待加工仓',
      requiredFields: ['接收人', '接收时间', '接收裁片数量', '关联菲票'],
      optionalFields: ['备注'],
    },
    {
      actionCode: 'SPECIAL_CRAFT_START_PROCESS',
      actionLabel: '开始加工',
      fromStatuses: ['已接收', '待加工', '已入待加工仓'],
      toStatus: '加工中',
      requiredFields: ['操作人', '开始时间'],
    },
    {
      actionCode: 'SPECIAL_CRAFT_FINISH_PROCESS',
      actionLabel: '完成加工',
      fromStatuses: ['加工中'],
      toStatus: '待交出',
      requiredFields: ['操作人', '完成时间', '加工完成裁片数量'],
    },
    {
      actionCode: 'SPECIAL_CRAFT_REPORT_DIFFERENCE',
      actionLabel: '上报差异',
      fromStatuses: ['已接收', '已入待加工仓', '加工中', '加工完成', '待交出'],
      toStatus: '差异',
      requiredFields: ['上报人', '差异类型', '应收裁片数量', '实收裁片数量', '差异裁片数量', '关联菲票', '原因'],
      optionalFields: ['证据'],
    },
    {
      actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
      actionLabel: '发起交出',
      fromStatuses: ['加工完成', '待交出'],
      toStatus: '交出待收货',
      requiredFields: ['交出人', '交出时间', '交出裁片数量', '关联菲票'],
      optionalFields: ['备注'],
    },
    {
      actionCode: 'SPECIAL_CRAFT_REWORK_AFTER_REJECT',
      actionLabel: '差异后重交',
      fromStatuses: ['差异', '异议中', '异常', '交出待收货', '收货差异'],
      toStatus: '待交出',
      requiredFields: ['操作人', '重交裁片数量', '备注'],
    },
  ]

  const matched = actionDefs.filter((def) => {
    if (!def.fromStatuses.includes(status)) return false
    if (def.actionCode === 'SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND') return objectType === '成衣'
    if (objectType === '成衣' && status === '待领料' && def.actionCode === 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES') return false
    return true
  })

  return matched.map((def) => ({
    actionCode: def.actionCode,
    actionLabel: def.actionLabel as ProcessWebAction['actionLabel'],
    processType: 'SPECIAL_CRAFT' as const,
    fromStatus: status,
    toStatus: def.toStatus,
    requiredFields: def.requiredFields,
    optionalFields: def.optionalFields || [],
    confirmText: `确认${def.actionLabel}`,
    disabledReason: matched.length ? undefined : '当前状态暂无可执行动作',
    writebackHandler: '',
    affectsWarehouse: false,
    affectsHandover: false,
    affectsReview: false,
    affectsDifference: false,
    affectsPlatformStatus: false,
  }))
}

export function renderWebActionPanel(
  taskOrderId: string,
  currentStatus: string,
  actions: ProcessWebAction[],
  objectQty: number,
  objectMeta: { objectType: string; objectLabel: string; qtyUnit: string; qtyRule: string },
): string {
  const actionable = actions.filter((a) => !a.disabledReason)
  const disabledReason = actions.find((a) => a.disabledReason)?.disabledReason

  const localizedText = (text: string) => {
    if (objectMeta.objectType === '裁片') return text
    return text.replaceAll('裁片', objectMeta.objectLabel)
  }

  return `
    <div class="space-y-3" data-testid="web-status-action-area">
      <div class="grid gap-2 text-sm">
        <div class="flex justify-between gap-3">
          <span class="text-muted-foreground">当前状态</span>
          <span class="font-medium text-foreground">${escapeHtml(currentStatus)}</span>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-muted-foreground">数量口径</span>
          <span class="font-medium text-foreground">${escapeHtml(objectMeta.objectLabel)} / ${escapeHtml(objectMeta.qtyUnit)}</span>
        </div>
      </div>
      ${actionable.length
        ? `<div class="grid gap-2">
            ${actionable.map((action) => {
              const actionLabel = localizedText(action.actionLabel)
              const requiredFields = action.requiredFields.map(localizedText)
              const optionalFields = action.optionalFields.map(localizedText)
              const confirmText = localizedText(action.confirmText)
              if (action.actionCode === 'SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND') {
                return `<button type="button" class="w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                  data-special-craft-web-action="confirm-garment-warehouse-outbound"
                  data-source-id="${escapeHtml(taskOrderId)}">成衣仓逐 SKU 出库确认</button>
                  <p class="text-xs text-muted-foreground">逐 SKU 实出件数必须完整确认，提交后等待辅助工艺收货。</p>`
              }
              return `<button type="button" class="w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                data-special-craft-web-action="open-web-status-action-dialog"
                data-source-id="${escapeHtml(taskOrderId)}"
                data-action-code="${escapeHtml(action.actionCode)}"
                data-action-label="${escapeHtml(actionLabel)}"
                data-from-status="${escapeHtml(action.fromStatus)}"
                data-to-status="${escapeHtml(action.toStatus)}"
                data-required-fields="${escapeHtml(requiredFields.join('|'))}"
                data-optional-fields="${escapeHtml(optionalFields.join('|'))}"
                data-confirm-text="${escapeHtml(confirmText)}"
                data-object-type="${escapeHtml(objectMeta.objectType)}"
                data-object-qty="${escapeHtml(String(objectQty || 1))}"
                data-qty-unit="${escapeHtml(objectMeta.qtyUnit)}">${escapeHtml(actionLabel)}</button>`
            }).join('')}
          </div>`
        : `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">${escapeHtml(disabledReason || '当前状态暂无可执行动作')}</div>`
      }
    </div>
  `
}
