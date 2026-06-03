import { OWN_WOOL_FACTORY_ID } from '../data/fcs/factory-mock-data.ts'
import { getFactoryMasterRecordById } from '../data/fcs/factory-master-store.ts'
import { getFactoryMobileTodos, type FactoryMobileTodoType } from '../data/fcs/factory-mobile-todos.ts'
import {
  getMobileWarehouseRuntimeContext,
  renderMobileWarehouseLoginRedirect,
} from './pda-warehouse-shared'
import { renderPdaFrame } from './pda-shell'
import { escapeHtml, toClassName } from '../utils'

type WarehouseActionTone = 'primary' | 'normal' | 'warning' | 'danger'

interface WarehouseShortcut {
  title: string
  subtitle?: string
  route: string
  pendingCount?: number
  tone?: WarehouseActionTone
}

function withQuery(route: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const queryString = params.toString()
  return queryString ? `${route}?${queryString}` : route
}

function isCuttingWarehouseRuntime(runtime: NonNullable<ReturnType<typeof getMobileWarehouseRuntimeContext>>): boolean {
  const factory = getFactoryMasterRecordById(runtime.factoryId)
  return factory?.factoryType === 'CENTRAL_CUTTING' || runtime.factoryName.includes('裁')
}

function isWoolWarehouseRuntime(runtime: NonNullable<ReturnType<typeof getMobileWarehouseRuntimeContext>>): boolean {
  const factory = getFactoryMasterRecordById(runtime.factoryId)
  return runtime.factoryId === OWN_WOOL_FACTORY_ID || factory?.factoryType === 'CENTRAL_WOOL' || runtime.factoryName.includes('毛织')
}

function isCraftWarehouseRuntime(runtime: NonNullable<ReturnType<typeof getMobileWarehouseRuntimeContext>>): boolean {
  const factory = getFactoryMasterRecordById(runtime.factoryId)
  return factory?.factoryType === 'CENTRAL_AUX' || factory?.factoryType === 'CENTRAL_SPECIAL'
}

function getWaitHandoverInboundShortcut(runtime: NonNullable<ReturnType<typeof getMobileWarehouseRuntimeContext>>): Pick<WarehouseShortcut, 'title' | 'subtitle'> {
  const factory = getFactoryMasterRecordById(runtime.factoryId)
  if (isCuttingWarehouseRuntime(runtime)) {
    return {
      title: '入仓暂存装袋',
      subtitle: '扫中转袋和菲票，确认库区库位。',
    }
  }
  if (isWoolWarehouseRuntime(runtime)) {
    return {
      title: '完工入仓',
      subtitle: '整件毛织按件、部位毛织片按片入待交出仓。',
    }
  }
  if (factory?.factoryType === 'CENTRAL_PRINT' || factory?.factoryType === 'CENTRAL_DYE') {
    return {
      title: '加工物料入仓',
      subtitle: '加工完成后扫码入待交出仓。',
    }
  }
  return {
    title: '完工入仓',
    subtitle: '加工完成后扫码入待交出仓。',
  }
}

function resolveWarehouseRoute(
  route: '/fcs/pda/warehouse/wait-process' | '/fcs/pda/warehouse/wait-handover' | '/fcs/pda/warehouse/stocktake',
  runtime: ReturnType<typeof getMobileWarehouseRuntimeContext>,
  extraQuery: Record<string, string | undefined> = {},
): string {
  if (!runtime) return route
  const scope = isCuttingWarehouseRuntime(runtime) ? 'cutting' : undefined
  return withQuery(route, { scope, ...extraQuery })
}

function renderShortcutButton(shortcut: WarehouseShortcut, className = ''): string {
  const tone = shortcut.tone ?? 'normal'
  const toneClass =
    tone === 'primary'
      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
      : tone === 'danger'
        ? 'border-destructive/30 bg-destructive/5 text-destructive'
        : tone === 'warning'
          ? 'border-amber-300 bg-amber-50 text-amber-800'
          : 'border bg-card text-foreground'
  return `
    <button
      type="button"
      class="min-h-[56px] rounded-2xl px-3 py-3 text-left transition active:scale-[0.99] ${toClassName(toneClass)} ${className}"
      data-nav="${escapeHtml(shortcut.route)}"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="truncate text-sm font-semibold">${escapeHtml(shortcut.title)}</div>
        ${
          shortcut.pendingCount && shortcut.pendingCount > 0
            ? `<span class="shrink-0 rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-medium text-foreground">${escapeHtml(shortcut.pendingCount)}</span>`
            : ''
        }
      </div>
      ${shortcut.subtitle ? `<div class="mt-1 line-clamp-2 text-xs leading-5 opacity-75">${escapeHtml(shortcut.subtitle)}</div>` : ''}
    </button>
  `
}

function renderWarehouseActionGroup(title: string, actions: WarehouseShortcut[]): string {
  if (!actions.length) return ''
  return `
    <section class="space-y-2">
      <div class="px-1 text-base font-semibold text-foreground">${escapeHtml(title)}</div>
      <div class="grid ${actions.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-3">
        ${actions.map((action) => renderShortcutButton(action)).join('')}
      </div>
    </section>
  `
}

function getActiveTodoCount(
  runtime: NonNullable<ReturnType<typeof getMobileWarehouseRuntimeContext>>,
  types: FactoryMobileTodoType[],
): number {
  const typeSet = new Set(types)
  return getFactoryMobileTodos(runtime.factoryId).filter(
    (todo) => typeSet.has(todo.todoType) && (todo.status === '待处理' || todo.status === '处理中'),
  ).length
}

function buildPendingTone(count: number, tone: WarehouseActionTone = 'primary'): Pick<WarehouseShortcut, 'pendingCount' | 'tone'> {
  return count > 0 ? { pendingCount: count, tone } : {}
}

function renderWaitProcessActions(runtime: NonNullable<ReturnType<typeof getMobileWarehouseRuntimeContext>>): string {
  const pickupCount = getActiveTodoCount(runtime, ['待领料'])
  let waitProcessActions: WarehouseShortcut[]
  if (isCuttingWarehouseRuntime(runtime)) {
    waitProcessActions = [
        {
          title: '中转仓领料',
          subtitle: '从中转仓领取待加工物并确认库位。',
          route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-process', runtime, { view: 'pickup' }),
          ...buildPendingTone(pickupCount),
        },
        {
          title: '加工领料',
          subtitle: '从待加工仓领出使用。',
          route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-process', runtime, { action: 'issue' }),
        },
        {
          title: '回收入仓',
          subtitle: '剩余物料回到库位。',
          route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-process', runtime, { action: 'return' }),
        },
      ]
  } else if (isCraftWarehouseRuntime(runtime)) {
    waitProcessActions = [
      {
        title: '接收入仓',
        subtitle: '扫交接单或加工单，确认数量和库位。',
        route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-process', runtime, { action: 'receive' }),
        ...buildPendingTone(pickupCount),
      },
      {
        title: '加工领料',
        subtitle: '从待加工仓领出给工序使用。',
        route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-process', runtime, { action: 'issue' }),
      },
      {
        title: '回收入仓',
        subtitle: '未加工完或退回物回到库位。',
        route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-process', runtime, { action: 'return' }),
      },
    ]
  } else if (isWoolWarehouseRuntime(runtime)) {
    waitProcessActions = [
      {
        title: '领料入仓',
        subtitle: '确认纱线重量和库区库位。',
        route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-process', runtime, { action: 'receive' }),
        ...buildPendingTone(pickupCount),
      },
      {
        title: '加工领料',
        subtitle: '从待加工仓领出纱线给横机使用。',
        route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-process', runtime, { action: 'issue' }),
      },
      {
        title: '回收入仓',
        subtitle: '毛织剩余纱线回收入仓。',
        route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-process', runtime, { action: 'return' }),
      },
    ]
  } else {
    waitProcessActions = [
        {
          title: '查看待加工仓',
          subtitle: '查看当前待加工库存和流水。',
          route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-process', runtime),
        },
      ]
  }
  return renderWarehouseActionGroup('待加工仓', waitProcessActions)
}

function renderWaitHandoverActions(runtime: NonNullable<ReturnType<typeof getMobileWarehouseRuntimeContext>>): string {
  const handoverCount = getActiveTodoCount(runtime, ['待交出'])
  const inboundShortcut = getWaitHandoverInboundShortcut(runtime)
  let waitHandoverActions: WarehouseShortcut[]
  if (isCuttingWarehouseRuntime(runtime)) {
    waitHandoverActions = [
    {
      title: inboundShortcut.title,
      subtitle: inboundShortcut.subtitle,
      route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-handover', runtime, { action: 'inbound' }),
    },
    {
      title: '交出装袋确认',
      subtitle: '扫中转袋和菲票，确认装袋并形成交出记录。',
      route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-handover', runtime, { action: 'handover-bagging-confirm' }),
      ...buildPendingTone(handoverCount),
    },
  ]
  } else if (isCraftWarehouseRuntime(runtime)) {
    waitHandoverActions = [
      {
        title: '完工入仓',
        subtitle: '加工完成后确认数量和库位。',
        route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-handover', runtime, { action: 'finish-inbound' }),
      },
      {
        title: '交出确认',
        subtitle: '确认接收方和数量，形成交出记录。',
        route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-handover', runtime, { action: 'handover-confirm' }),
        ...buildPendingTone(handoverCount),
      },
    ]
  } else if (isWoolWarehouseRuntime(runtime)) {
    waitHandoverActions = [
      {
        title: inboundShortcut.title,
        subtitle: inboundShortcut.subtitle,
        route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-handover', runtime, { action: 'finish-inbound' }),
      },
      {
        title: '交出确认',
        subtitle: '确认接收方和数量，形成毛织交出记录。',
        route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-handover', runtime, { action: 'handover-confirm' }),
        ...buildPendingTone(handoverCount),
      },
    ]
  } else {
    waitHandoverActions = [
    {
      title: '查看待交出仓',
      subtitle: '查看完工入仓、待交出库存和交出流水。',
      route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-handover', runtime),
      ...buildPendingTone(handoverCount),
    },
  ]
  }
  return renderWarehouseActionGroup('待交出仓', waitHandoverActions)
}

function renderInventoryActions(runtime: NonNullable<ReturnType<typeof getMobileWarehouseRuntimeContext>>): string {
  const actions: WarehouseShortcut[] = [
    {
      title: '查库存',
      subtitle: '按物料、菲票、载具或库位查询。',
      route: resolveWarehouseRoute('/fcs/pda/warehouse/stocktake', runtime, { mode: 'search' }),
    },
    {
      title: '扫码查询',
      subtitle: '扫物料码、菲票码、载具码、库位码。',
      route: resolveWarehouseRoute('/fcs/pda/warehouse/stocktake', runtime, { mode: 'scan' }),
    },
    {
      title: '库存盘点',
      subtitle: '按库位核对实物数量。',
      route: resolveWarehouseRoute('/fcs/pda/warehouse/stocktake', runtime, { mode: 'stocktake' }),
    },
  ]
  return renderWarehouseActionGroup('库存与盘点', actions)
}

export function renderPdaWarehousePage(): string {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return renderMobileWarehouseLoginRedirect()

  const content = `
    <div class="space-y-3 px-4 pb-5 pt-4">
      ${renderWaitProcessActions(runtime)}
      ${renderWaitHandoverActions(runtime)}
      ${renderInventoryActions(runtime)}
    </div>
  `

  return renderPdaFrame(content, 'warehouse', { headerTitle: '仓管', disableTodoAutoOpen: true })
}

export function handlePdaWarehouseEvent(_target: HTMLElement): boolean {
  return false
}
