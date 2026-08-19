import { OWN_WOOL_FACTORY_ID } from '../data/fcs/factory-mock-data.ts'
import { KOL_GOTO_FACTORY_ID } from '../data/fcs/factory-mock-data.ts'
import { isKolGotoFactory } from '../data/fcs/kol-goto-special-flow.ts'
import { ensureKolGotoPdaScenarios } from '../data/fcs/kol-goto-pda-domain.ts'
import { getFactoryMasterRecordById } from '../data/fcs/factory-master-store.ts'
import { getFactoryMobileTodos, type FactoryMobileTodoType } from '../data/fcs/factory-mobile-todos.ts'
import {
  getMobileWarehouseRuntimeContext,
  renderMobileWarehouseLoginRedirect,
} from './pda-warehouse-shared'
import { getPdaCuttingWaitHandoverActions } from './pda-cutting-wait-handover-actions.ts'
import { renderPdaFrame } from './pda-shell'
import { escapeHtml, toClassName } from '../utils'
import {
  findFactoryInternalWarehouseByFactoryAndKind,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseOutboundRecords,
} from '../data/fcs/factory-internal-warehouse.ts'

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
  return getFactoryMobileTodos(runtime.factoryId, runtime.roleId).filter(
    (todo) => typeSet.has(todo.todoType) && (todo.status === '待处理' || todo.status === '处理中'),
  ).length
}

function buildPendingTone(count: number, tone: WarehouseActionTone = 'primary'): Pick<WarehouseShortcut, 'pendingCount' | 'tone'> {
  return count > 0 ? { pendingCount: count, tone } : {}
}

function renderWaitProcessActions(runtime: NonNullable<ReturnType<typeof getMobileWarehouseRuntimeContext>>): string {
  if (isWoolWarehouseRuntime(runtime) || isCraftWarehouseRuntime(runtime)) return ''
  const pickupCount = getActiveTodoCount(runtime, ['待接收'])
  let waitProcessActions: WarehouseShortcut[]
  if (isCuttingWarehouseRuntime(runtime)) {
    waitProcessActions = [
        {
          title: '中转仓接收',
          subtitle: '从中转仓领取待加工物并确认库位。',
          route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-process', runtime, { view: 'pickup' }),
          ...buildPendingTone(pickupCount),
        },
        {
          title: '加工接收',
          subtitle: '从待加工仓领出使用。',
          route: resolveWarehouseRoute('/fcs/pda/warehouse/wait-process', runtime, { action: 'issue' }),
        },
        {
          title: '回收入仓',
          subtitle: '剩余物料回到库位。',
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
  if (isWoolWarehouseRuntime(runtime) || isCraftWarehouseRuntime(runtime)) return ''
  const handoverCount = getActiveTodoCount(runtime, ['待交出'])
  let waitHandoverActions: WarehouseShortcut[]
  if (isCuttingWarehouseRuntime(runtime)) {
    waitHandoverActions = getPdaCuttingWaitHandoverActions()
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
      subtitle: '按物料码、生产单、中转袋、菲票码、库位码或加工单号查询。',
      route: resolveWarehouseRoute('/fcs/pda/warehouse/stocktake', runtime, { mode: 'search' }),
    },
    {
      title: '扫码查询',
      subtitle: '扫物料码、生产单、中转袋、菲票码、库位码或加工单号。',
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

  if (isKolGotoFactory(runtime.factoryId)) {
    ensureKolGotoPdaScenarios()
    const warehouse = findFactoryInternalWarehouseByFactoryAndKind(KOL_GOTO_FACTORY_ID, 'WAIT_PROCESS')
    const area = warehouse?.areaList[0]
    const shelf = area?.shelfList[0]
    const location = shelf?.locationList[0]
    const inboundCount = listFactoryWarehouseInboundRecords().filter((item) => item.factoryId === KOL_GOTO_FACTORY_ID).length
    const outboundCount = listFactoryWarehouseOutboundRecords().filter((item) => item.factoryId === KOL_GOTO_FACTORY_ID).length
    const content = `
      <div class="space-y-4 px-4 pb-5 pt-4">
        <section class="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><h1 class="font-semibold">KOL-GOTO 待加工仓</h1><p class="mt-1 text-xs text-blue-700">本工厂只有一个待加工仓和一个默认库位。加工领料提交后，系统按每条领料明细成对写入入库和出库记录。</p></section>
        <section class="rounded-2xl border bg-card p-4"><div class="flex items-center justify-between"><div><div class="font-semibold">${escapeHtml(warehouse?.warehouseName || '待加工仓')}</div><div class="mt-1 text-xs text-muted-foreground">默认库位：${escapeHtml([area?.areaName, shelf?.shelfNo, location?.locationNo].filter(Boolean).join(' / ') || '未配置')}</div></div><span class="rounded-full bg-green-50 px-2 py-1 text-xs text-green-700">唯一库位</span></div><button class="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground" data-nav="/fcs/pda/warehouse/wait-process">查看待加工仓</button></section>
        <section class="grid grid-cols-2 gap-3"><button class="rounded-2xl border bg-card p-4 text-left" data-nav="/fcs/pda/warehouse/inbound-records"><div class="text-sm font-semibold">入库记录</div><div class="mt-2 text-xl font-bold">${inboundCount}</div><div class="mt-1 text-xs text-muted-foreground">加工领料自动写入</div></button><button class="rounded-2xl border bg-card p-4 text-left" data-nav="/fcs/pda/warehouse/outbound-records"><div class="text-sm font-semibold">出库记录</div><div class="mt-2 text-xl font-bold">${outboundCount}</div><div class="mt-1 text-xs text-muted-foreground">同次领料自动出库</div></button></section>
      </div>`
    return renderPdaFrame(content, 'warehouse', { headerTitle: '仓管', disableTodoAutoOpen: true })
  }

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
