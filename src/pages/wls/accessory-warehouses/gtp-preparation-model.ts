import type { MaterialPrepOrderProjection } from '../../../data/fcs/cutting/production-material-prep.ts'
import type { ProductionOrder } from '../../../data/fcs/production-orders.ts'
import type { ProductionDemand } from '../../../data/fcs/production-demands.ts'
import type { RuntimeProcessTask } from '../../../data/fcs/runtime-process-tasks.ts'
import type { AccessoryLine, AccessoryPickup, AccessoryPreparation, AccessoryTransfer } from '../../../data/wls/accessory-warehouse-flow.ts'

/** 页面只读组合；单据数量和状态仍由原业务记录拥有。 */
export interface GtpPreparationSheet {
  preparation: AccessoryPreparation
  projection?: MaterialPrepOrderProjection
  order?: ProductionOrder
  demand?: ProductionDemand
  tasks: RuntimeProcessTask[]
  transfers: AccessoryTransfer[]
  pickups: AccessoryPickup[]
  number: string
  spu: string
  saleType: string
  createdAt: string
  demandCreatedAt: string
  orderCreatedAt: string
  firstPreparedAt: string
  firstPickedAt: string
  lastPickedAt: string
  pickupStatus: '待领料' | '领料中' | '已领料'
  stockFull: boolean
}
export interface GtpPreparationFilters {
  keyword: string
  searchField: string
  factory: string
  status: string
  pickupStatus: string
  saleType: string
  stockFull: string
  breakdown: string
  dateField: string
  from: string
  to: string
}
export const emptyGtpPreparationFilters = (): GtpPreparationFilters => ({
  keyword: '', searchField: 'all', factory: '', status: '', pickupStatus: '', saleType: '',
  stockFull: '', breakdown: '', dateField: 'createdAt', from: '', to: '',
})
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000
const first = (values: string[]) => values.filter(Boolean).sort()[0] || ''
const last = (values: string[]) => values.filter(Boolean).sort().at(-1) || ''

export function gtpLineProgress(sheet: Pick<GtpPreparationSheet, 'preparation' | 'projection' | 'transfers' | 'pickups'>, line: AccessoryLine) {
  const related = (candidate: { id: string; sourceLineId?: string; materialSku: string; unit: string }) =>
    candidate.sourceLineId ? candidate.sourceLineId === line.id : candidate.materialSku === line.materialSku && candidate.unit === line.unit
  const dispatched = sheet.transfers.filter(row => row.kind === 'GTP_TO_SITE' && ['已出库待收货', '已收货'].includes(row.status))
    .flatMap(row => row.lines).filter(related).reduce((sum, row) => sum + row.qty, 0)
  const picked = sheet.pickups.filter(row => row.status !== '已失效').flatMap(row => row.lines).filter(related).reduce((sum, row) => sum + row.handedQty, 0)
  const legacyPicked = sheet.projection?.lines.find(row => row.prepLineId === line.id)?.pickedQty || 0
  return { required: line.requiredQty, prepared: line.preparedQty, remaining: round(Math.max(0, line.requiredQty - line.preparedQty)),
    dispatched: round(dispatched), picked: round(picked + legacyPicked) }
}

export function buildGtpPreparationSheets(input: {
  preparations: AccessoryPreparation[]
  projections: MaterialPrepOrderProjection[]
  orders: ProductionOrder[]
  demands: ProductionDemand[]
  tasks: RuntimeProcessTask[]
  transfers: AccessoryTransfer[]
  pickups: AccessoryPickup[]
}): GtpPreparationSheet[] {
  const orders = new Map(input.orders.map(row => [row.productionOrderId, row]))
  const demands = new Map(input.demands.map(row => [row.demandId, row]))
  const projections = new Map(input.projections.map(row => [row.order.prepOrderId, row]))
  return input.preparations.map(preparation => {
    const order = orders.get(preparation.productionOrderId), projection = projections.get(preparation.id)
    const demand = demands.get(order?.demandId || '')
    const tasks = input.tasks.filter(row => row.productionOrderId === preparation.productionOrderId && row.executionEnabled !== false && !row.mergedIntoTaskId && !row.isSplitSource
      && (['SEW', 'SEWING'].includes(row.processBusinessCode || row.processCode) || ['SEW_IRON_PACK', 'CUTTING_SEWING_IRON_PACK'].includes(row.mergedTaskType || '')))
    const transfers = input.transfers.filter(row => row.preparationId === preparation.id)
    const pickups = input.pickups.filter(row => row.preparationId === preparation.id && row.status !== '已失效')
    const handed = pickups.flatMap(row => row.history.filter(entry => entry.action === '车缝领料实交').map(entry => entry.at))
    const sheet: GtpPreparationSheet = {
      preparation, projection, order, demand, tasks, transfers, pickups,
      number: projection?.order.prepOrderNo || preparation.productionOrderNo,
      spu: order?.demandSnapshot?.spuCode || projection?.order.spu || '', saleType: order?.demandSnapshot?.saleType || demand?.saleType || '',
      createdAt: projection?.order.createdAt || '', demandCreatedAt: demand?.createdAt || '', orderCreatedAt: order?.createdAt || '',
      firstPreparedAt: first(preparation.history.filter(row => row.action.includes('配料')).map(row => row.at)),
      firstPickedAt: first(handed), lastPickedAt: last(handed), pickupStatus: '待领料',
      stockFull: preparation.lines.every(line => line.availableQty + 0.000001 >= Math.max(0, line.requiredQty - line.preparedQty)),
    }
    // 独立车缝的其余辅料会调往后道，不能把这部分计作车缝待领。
    // 领料单拥有任务分摊后的应领数量；没有领料单时只展示旧实领进度。
    const pickupLines = pickups.flatMap(row => row.lines)
    if (pickupLines.some(line => line.handedQty > 0)) sheet.pickupStatus = pickupLines.every(line => line.handedQty + 0.000001 >= line.requiredQty) ? '已领料' : '领料中'
    else if (preparation.lines.some(line => gtpLineProgress(sheet, line).picked > 0)) sheet.pickupStatus = '领料中'
    return sheet
  })
}

export function filterGtpPreparationSheets(rows: GtpPreparationSheet[], filter: GtpPreparationFilters): GtpPreparationSheet[] {
  const keyword = filter.keyword.trim().toLocaleLowerCase()
  return rows.filter(sheet => {
    const p = sheet.preparation
    const searchable: Record<string, string> = {
      order: p.productionOrderNo, preparation: sheet.number, task: sheet.tasks.map(task => task.taskNo).join(' '),
      demand: sheet.order?.demandId || '', spu: sheet.spu, material: p.lines.map(line => `${line.materialSku} ${line.materialName}`).join(' '),
    }
    const haystack = filter.searchField === 'all' ? [...Object.values(searchable), p.styleName].join(' ') : searchable[filter.searchField] || ''
    const factory = p.cuttingFactoryName || '待分配'
    const date = ({ createdAt: sheet.createdAt, orderCreatedAt: sheet.orderCreatedAt, demandCreatedAt: sheet.demandCreatedAt,
      firstPreparedAt: sheet.firstPreparedAt, firstPickedAt: sheet.firstPickedAt } as Record<string, string>)[filter.dateField]?.slice(0, 10) || ''
    return (!keyword || haystack.toLocaleLowerCase().includes(keyword))
      && (!filter.factory || factory === filter.factory) && (!filter.status || p.status === filter.status)
      && (!filter.pickupStatus || sheet.pickupStatus === filter.pickupStatus) && (!filter.saleType || sheet.saleType === filter.saleType)
      && (!filter.stockFull || sheet.stockFull === (filter.stockFull === 'yes'))
      && (!filter.breakdown || Boolean(sheet.order?.taskBreakdownSummary?.isBrokenDown) === (filter.breakdown === 'yes'))
      && (!filter.from || Boolean(date) && date >= filter.from) && (!filter.to || Boolean(date) && date <= filter.to)
  })
}
