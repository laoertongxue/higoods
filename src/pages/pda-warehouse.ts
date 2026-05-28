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

function getWaitHandoverInboundShortcut(runtime: NonNullable<ReturnType<typeof getMobileWarehouseRuntimeContext>>): Pick<WarehouseShortcut, 'title' | 'subtitle'> {
  const factory = getFactoryMasterRecordById(runtime.factoryId)
  if (isCuttingWarehouseRuntime(runtime)) {
    return {
      title: '菲票入仓',
      subtitle: '扫暂存袋和菲票，进入裁床待交出仓。',
    }
  }
  if (isWoolWarehouseRuntime(runtime)) {
    return {
      title: '整件入仓',
      subtitle: '整件毛织完成后扫码入待交出仓。',
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
  return `
    <section class="space-y-2">
      <div class="px-1 text-base font-semibold text-foreground">${escapeHtml(title)}</div>
      <div class="grid grid-cols-2 gap-3">
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
  const waitProcessActions: WarehouseShortcut[] = [
    {
      title: '待领料',
      subtitle: '查看按裁片任务生成的配料通知。',
      route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-process', runtime, { view: 'pickup' }),
      ...buildPendingTone(pickupCount),
    },
    {
      title: '扫码入仓',
      subtitle: '扫码确认库区库位。',
      route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-process', runtime, { action: 'receive' }),
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
  return renderWarehouseActionGroup('待加工仓', waitProcessActions)
}

function renderWaitHandoverActions(runtime: NonNullable<ReturnType<typeof getMobileWarehouseRuntimeContext>>): string {
  const handoverCount = getActiveTodoCount(runtime, ['待交出'])
  const inboundShortcut = getWaitHandoverInboundShortcut(runtime)
  const waitHandoverActions: WarehouseShortcut[] = [
    {
      title: inboundShortcut.title,
      subtitle: inboundShortcut.subtitle,
      route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-handover', runtime, { action: 'inbound' }),
    },
    {
      title: '二次分拣',
      subtitle: '按下游任务拣菲票。',
      route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-handover', runtime, { action: 'sorting' }),
    },
    {
      title: '重新装袋',
      subtitle: '把分拣结果装入载具。',
      route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-handover', runtime, { action: 'rebagging' }),
    },
    {
      title: '交出',
      subtitle: '提交给下游工厂或仓库。',
      route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-handover', runtime, { action: 'handover' }),
      ...buildPendingTone(handoverCount),
    },
    {
      title: '接收回写',
      subtitle: '查看接收数量和差异。',
      route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-handover', runtime, { action: 'writeback' }),
    },
  ]
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
