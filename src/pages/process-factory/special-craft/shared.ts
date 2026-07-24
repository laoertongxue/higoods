import { getFactoryMasterRecordById } from '../../../data/fcs/factory-master-store.ts'
import { formatFactoryDisplayName } from '../../../data/fcs/factory-mock-data.ts'
import type { ProcessWebAction } from '../../../data/fcs/process-web-status-actions.ts'
import {
  canFactorySeeSpecialCraftOperation,
  type SpecialCraftOperationDefinition,
} from '../../../data/fcs/special-craft-operations.ts'
import type { SpecialCraftTaskOrder } from '../../../data/fcs/special-craft-task-orders.ts'
import { productionOrders } from '../../../data/fcs/production-orders.ts'
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
    label.includes('待领料')
      ? 'amber'
      : label.includes('加工中')
        ? 'blue'
        : label.includes('已完结')
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
    </div>
  `
}

const spuImageByCode: Record<string, string> = {
  tdv_demand_SPU_2024_004: '/tshirt-sample.jpg',
  tdv_demand_SPU_2024_005: '/jacket-sample.jpg',
  tdv_demand_SPU_2024_010: '/pants-sample.jpg',
  tdv_demand_SPU_2024_012: '/cardigan-sample.jpg',
  tdv_demand_SPU_2024_013: '/dress-sample-1.jpg',
}

export function resolveSpuImageUrl(taskOrder: SpecialCraftTaskOrder): string {
  const po = productionOrders.find((p) => p.productionOrderId === taskOrder.productionOrderId)
  const spuCode = po?.demandSnapshot?.spuCode
  if (spuCode && spuImageByCode[spuCode]) return spuImageByCode[spuCode]
  return '/tshirt-sample.jpg'
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
  const actionDefs: Array<{
    actionCode: string
    actionLabel: string
    fromStatuses: string[]
    toStatus: string
    requiredFields: string[]
    optionalFields?: string[]
  }> = [
    {
      actionCode: 'SPECIAL_CRAFT_CONFIRM_RECEIVE',
      actionLabel: '确认接收',
      fromStatuses: ['待领料', '加工中'],
      toStatus: '加工中',
      requiredFields: ['接收人', '接收时间'],
      optionalFields: ['备注'],
    },
    {
      actionCode: 'SPECIAL_CRAFT_PROCESS_REPORT',
      actionLabel: '加工填报',
      fromStatuses: ['加工中'],
      toStatus: '加工中',
      requiredFields: ['操作人', '填报时间'],
      optionalFields: ['备注'],
    },
    {
      actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
      actionLabel: '发起交出',
      fromStatuses: ['加工中'],
      toStatus: '加工中',
      requiredFields: ['交出人', '交出时间'],
      optionalFields: ['备注'],
    },
    {
      actionCode: 'SPECIAL_CRAFT_COMPLETE_ORDER',
      actionLabel: '完成加工单',
      fromStatuses: ['加工中'],
      toStatus: '已完结',
      requiredFields: ['操作人', '完成时间'],
      optionalFields: ['备注'],
    },
  ]

  const matched = actionDefs.filter((def) => {
    if (!def.fromStatuses.includes(status)) return false
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

export function renderGarmentSkuConfirmDialog(
  taskOrderId: string,
  actionCode: string,
  title: string,
  demandLines: Array<{ colorName: string; sizeCode: string; planPieceQty: number; skuCode: string }>,
  defaultQtyField: 'planPieceQty',
): string {
  const skuRows = new Map<string, { colorName: string; sizeCode: string; planQty: number; defaultQty: number }>()
  demandLines.forEach((line) => {
    const key = `${line.colorName}::${line.sizeCode}`
    const existing = skuRows.get(key)
    if (existing) {
      existing.planQty += line.planPieceQty
      existing.defaultQty += Number(line[defaultQtyField]) || 0
    } else {
      skuRows.set(key, {
        colorName: line.colorName,
        sizeCode: line.sizeCode,
        planQty: line.planPieceQty,
        defaultQty: Number(line[defaultQtyField]) || 0,
      })
    }
  })

  const tbody = [...skuRows.entries()].map(([key, row]) => {
    const safeKey = key.replace(/[^A-Za-z0-9]/g, '-')
    return `<tr>
      <td class="px-3 py-2 text-sm">${escapeHtml(row.colorName)}</td>
      <td class="px-3 py-2 text-sm">${escapeHtml(row.sizeCode)}</td>
      <td class="px-3 py-2 text-right text-sm tabular-nums">${formatQty(row.planQty)}</td>
      <td class="px-3 py-2"><input type="number" class="w-24 rounded border px-2 py-1 text-sm text-right tabular-nums" name="sku-qty-${safeKey}" value="${row.defaultQty}" min="0" max="${row.planQty}" /></td>
    </tr>`
  }).join('')

  return `
    <div id="special-craft-garment-sku-dialog" class="fixed inset-0 z-[150] flex items-center justify-center bg-black/40">
      <div class="w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl">
        <h3 class="mb-4 text-base font-semibold">${escapeHtml(title)}</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted text-muted-foreground">
              <tr><th class="px-3 py-2 text-left text-xs font-medium">颜色</th><th class="px-3 py-2 text-left text-xs font-medium">尺码</th><th class="px-3 py-2 text-right text-xs font-medium">计划件数</th><th class="px-3 py-2 text-right text-xs font-medium">实收件数</th></tr>
            </thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" onclick="document.getElementById('special-craft-garment-sku-dialog')?.remove()">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700" data-special-craft-sku-confirm="submit" data-task-id="${escapeHtml(taskOrderId)}" data-action-code="${escapeHtml(actionCode)}">确认接收</button>
        </div>
      </div>
    </div>
  `
}

export function renderCutPieceFeiTicketConfirmDialog(
  taskOrderId: string,
  actionCode: string,
  title: string,
  feiTicketGroups: Array<{ feiTicketNo: string; partName: string; colorName: string; sizeCode: string; planQty: number; defaultQty: number }>,
): string {
  const tbody = feiTicketGroups.map((group) => {
    const safeKey = group.feiTicketNo.replace(/[^A-Za-z0-9]/g, '-')
    return `<tr>
      <td class="px-3 py-2 font-mono text-xs">${escapeHtml(group.feiTicketNo)}</td>
      <td class="px-3 py-2 text-sm">${escapeHtml(group.partName)}</td>
      <td class="px-3 py-2 text-sm">${escapeHtml(group.colorName)}</td>
      <td class="px-3 py-2 text-sm">${escapeHtml(group.sizeCode)}</td>
      <td class="px-3 py-2 text-right text-sm tabular-nums">${formatQty(group.planQty)}</td>
      <td class="px-3 py-2"><input type="number" class="w-24 rounded border px-2 py-1 text-sm text-right tabular-nums" name="fei-qty-${safeKey}" value="${group.defaultQty}" min="0" max="${group.planQty}" /></td>
    </tr>`
  }).join('')

  return `
    <div id="special-craft-fei-ticket-dialog" class="fixed inset-0 z-[150] flex items-center justify-center bg-black/40">
      <div class="w-full max-w-2xl rounded-lg border bg-card p-6 shadow-xl">
        <h3 class="mb-4 text-base font-semibold">${escapeHtml(title)}</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted text-muted-foreground">
              <tr><th class="px-3 py-2 text-left text-xs font-medium">菲票号</th><th class="px-3 py-2 text-left text-xs font-medium">部位</th><th class="px-3 py-2 text-left text-xs font-medium">颜色</th><th class="px-3 py-2 text-left text-xs font-medium">尺码</th><th class="px-3 py-2 text-right text-xs font-medium">计划数量</th><th class="px-3 py-2 text-right text-xs font-medium">实收数量</th></tr>
            </thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" onclick="document.getElementById('special-craft-fei-ticket-dialog')?.remove()">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700" data-special-craft-fei-confirm="submit" data-task-id="${escapeHtml(taskOrderId)}" data-action-code="${escapeHtml(actionCode)}">确认接收</button>
        </div>
      </div>
    </div>
  `
}
