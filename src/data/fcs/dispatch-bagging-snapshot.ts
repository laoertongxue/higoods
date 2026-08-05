import { listCuttingRuntimeEvents, type CuttingRuntimeEvent, type TransferBagTicketFactSnapshot } from './cutting/cutting-runtime-event-ledger.ts'
import { resolveTransferBagCurrentUsesFromEvents } from './cutting/transfer-bag-operations.ts'
import type { RuntimeProcessTask, RuntimeTaskSkuLine } from './runtime-process-tasks.ts'

export interface DispatchBagTicketView {
  feiTicketId: string
  feiTicketNo: string
  productionOrderNo: string
  skuCode: string
  color: string
  size: string
  partName: string
  pieceQty: number
  taskEquivalentQty: number | null
  inTaskScope: boolean
}

export interface DispatchBagView {
  bagCode: string
  status: '菲票已装袋' | '入仓暂存中' | '待交出' | '已交出待回收'
  location: string
  updatedAt: string
  tickets: DispatchBagTicketView[]
  mixedProductionOrders: boolean
  handedOver: boolean
}

export interface DispatchBagSkuView extends RuntimeTaskSkuLine {
  baggedPieceQty: number
  coveredTaskQty: number | null
  unbaggedQty: number | null
  bagCodes: string[]
  hasQuantityMismatch: boolean
}

export interface DispatchBagRecommendationGroup {
  groupId: string
  skuCodes: string[]
  bagCodes: string[]
  taskQty: number
  baggedPieceQty: number
  coveredTaskQty: number | null
  unbaggedQty: number | null
  intactBagCount: number
  note: string
}

export interface DispatchBagSelectionImpact {
  intactBagCodes: string[]
  affectedBagCodes: string[]
  abnormalBagCodes: string[]
  handedOverBagCodes: string[]
}

export interface DispatchBaggingSnapshot {
  source: '现场事件账' | '演示快照' | '暂无装袋记录'
  updatedAt: string
  taskSkuCount: number
  taskQty: number
  validBagCount: number
  baggedPieceQty: number
  coveredTaskQty: number | null
  unbaggedQty: number | null
  intactBagCount: number
  crossBagSkuCount: number
  bags: DispatchBagView[]
  skuViews: DispatchBagSkuView[]
  recommendationGroups: DispatchBagRecommendationGroup[]
  warnings: string[]
}

export interface DispatchBaggingSourceBag {
  bagCode: string
  status: DispatchBagView['status']
  location: string
  updatedAt: string
  tickets: Array<TransferBagTicketFactSnapshot & { skuCode?: string; taskEquivalentQty?: number }>
}

const DEMO_BAGS: Record<string, DispatchBaggingSourceBag[]> = {
  'PO-202603-0003': [
    {
      bagCode: 'BAG-CT-260805-021', status: '待交出', location: '裁片待交出仓 A区 / A-021', updatedAt: '2026-08-05 15:42',
      tickets: [
        demoTicket('FT-260805-021-S', 'SKU-009-S-WHT', 'White', 'S', 1200),
        demoTicket('FT-260805-021-M1', 'SKU-009-M-WHT', 'White', 'M', 600),
      ],
    },
    {
      bagCode: 'BAG-CT-260805-022', status: '入仓暂存中', location: '裁片待交出仓 A区 / A-022', updatedAt: '2026-08-05 15:46',
      tickets: [
        demoTicket('FT-260805-022-M2', 'SKU-009-M-WHT', 'White', 'M', 1200),
        demoTicket('FT-260805-022-L', 'SKU-009-L-WHT', 'White', 'L', 1800),
      ],
    },
    {
      bagCode: 'BAG-CT-260805-023', status: '菲票已装袋', location: '裁床装袋区 / 03号台', updatedAt: '2026-08-05 15:51',
      tickets: [demoTicket('FT-260805-023-XL', 'SKU-009-XL-WHT', 'White', 'XL', 900)],
    },
  ],
}

function demoTicket(feiTicketNo: string, skuCode: string, color: string, size: string, pieceQty: number): TransferBagTicketFactSnapshot & { skuCode: string; taskEquivalentQty: number } {
  return {
    feiTicketId: feiTicketNo, feiTicketNo, productionOrderId: 'PO-202603-0003', productionOrderNo: 'PO-202603-0003',
    cutOrderId: 'CUT-PO-202603-0003', cutOrderNo: 'CUT-PO-202603-0003', color, size, partCode: 'BUNDLE', partName: '整扎裁片', pieceQty,
    sewingTaskId: 'TASKGEN-202603-0003-002__ORDER', sewingTaskNo: 'TASKGEN-202603-0003-002', receiverFactoryId: '', receiverFactoryName: '', skuCode, taskEquivalentQty: pieceQty,
  }
}

function taskSkuLines(task: RuntimeProcessTask): RuntimeTaskSkuLine[] {
  return task.scopeSkuLines.length ? task.scopeSkuLines : [{ skuCode: task.skuCode || 'SKU-ALL', color: task.skuColor || '混色', size: task.skuSize || '混码', qty: task.scopeQty }]
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function matchSkuCode(ticket: TransferBagTicketFactSnapshot & { skuCode?: string }, lines: RuntimeTaskSkuLine[]): string {
  if (ticket.skuCode && lines.some((line) => line.skuCode === ticket.skuCode)) return ticket.skuCode
  const size = normalizeText(ticket.size)
  const color = normalizeText(ticket.color)
  const matches = lines.filter((line) => normalizeText(line.size) === size && (!color || normalizeText(line.color) === color))
  if (matches.length === 1) return matches[0].skuCode
  const sizeMatches = lines.filter((line) => normalizeText(line.size) === size)
  return sizeMatches.length === 1 ? sizeMatches[0].skuCode : ''
}

function bagCodesFromEvents(events: CuttingRuntimeEvent[]): string[] {
  const codes = events.flatMap((event) => [event.refs.transferBagCode || '', ...(event.refs.transferBagCodes || [])])
  return [...new Set(codes.filter(Boolean))]
}

function statusLabel(flowStage: string | null): DispatchBagView['status'] {
  if (flowStage === 'INBOUND_STORED') return '入仓暂存中'
  if (flowStage === 'READY_HANDOVER') return '待交出'
  if (flowStage === 'HANDED_OVER_WAITING_RETURN') return '已交出待回收'
  return '菲票已装袋'
}

function eventLocation(event: CuttingRuntimeEvent): string {
  const payload = event.payload as Record<string, unknown>
  const area = String(payload.warehouseArea || event.inventoryEffect?.toWarehouseArea || '')
  const code = String(payload.locationCode || event.inventoryEffect?.toLocationCode || '')
  return [area, code].filter(Boolean).join(' / ') || '位置待更新'
}

function liveSourceBags(task: RuntimeProcessTask, events: CuttingRuntimeEvent[]): DispatchBaggingSourceBag[] {
  const currentUses = resolveTransferBagCurrentUsesFromEvents(bagCodesFromEvents(events), events)
  return [...currentUses.values()].flatMap((use) => {
    if (!use.tickets.some((ticket) => ticket.productionOrderId === task.productionOrderId || ticket.productionOrderNo === task.productionOrderNo)) return []
    const relatedEvents = events.filter((event) => event.refs.transferBagCode === use.bagCode || event.refs.transferBagCodes?.includes(use.bagCode))
    const latest = relatedEvents.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
    return [{
      bagCode: use.bagCode,
      status: statusLabel(use.flowStage),
      location: latest ? eventLocation(latest) : '位置待更新',
      updatedAt: latest?.occurredAt || '',
      tickets: use.tickets,
    }]
  })
}

function buildGroups(skuViews: DispatchBagSkuView[], bags: DispatchBagView[]): DispatchBagRecommendationGroup[] {
  const eligibleBags = bags.filter((bag) => !bag.mixedProductionOrders && !bag.handedOver)
  const skuToBags = new Map<string, Set<string>>()
  eligibleBags.forEach((bag) => bag.tickets.filter((ticket) => ticket.inTaskScope).forEach((ticket) => {
    if (!skuToBags.has(ticket.skuCode)) skuToBags.set(ticket.skuCode, new Set())
    skuToBags.get(ticket.skuCode)?.add(bag.bagCode)
  }))
  const bagToSkus = new Map(eligibleBags.map((bag) => [bag.bagCode, new Set(bag.tickets.filter((ticket) => ticket.inTaskScope).map((ticket) => ticket.skuCode))]))
  const unvisited = new Set(skuViews.map((item) => item.skuCode))
  const groups: DispatchBagRecommendationGroup[] = []
  while (unvisited.size) {
    const start = [...unvisited][0]
    const skuCodes = new Set<string>([start])
    const bagCodes = new Set<string>()
    const queue = [start]
    while (queue.length) {
      const skuCode = queue.shift() || ''
      for (const bagCode of skuToBags.get(skuCode) || []) {
        if (bagCodes.has(bagCode)) continue
        bagCodes.add(bagCode)
        for (const nextSku of bagToSkus.get(bagCode) || []) {
          if (!skuCodes.has(nextSku)) { skuCodes.add(nextSku); queue.push(nextSku) }
        }
      }
    }
    skuCodes.forEach((skuCode) => unvisited.delete(skuCode))
    const views = skuViews.filter((item) => skuCodes.has(item.skuCode))
    groups.push({
      groupId: `GROUP-${groups.length + 1}`,
      skuCodes: [...skuCodes], bagCodes: [...bagCodes],
      taskQty: views.reduce((sum, item) => sum + item.qty, 0),
      baggedPieceQty: views.reduce((sum, item) => sum + item.baggedPieceQty, 0),
      coveredTaskQty: views.every((item) => item.coveredTaskQty != null) ? views.reduce((sum, item) => sum + (item.coveredTaskQty || 0), 0) : null,
      unbaggedQty: views.every((item) => item.unbaggedQty != null) ? views.reduce((sum, item) => sum + (item.unbaggedQty || 0), 0) : null,
      intactBagCount: bagCodes.size,
      note: bagCodes.size ? '同袋或跨袋关联，整组选择可尽量保持现有袋装关系。' : '该SKU暂无有效装袋记录，仍可按完整SKU分配。',
    })
  }
  return groups
}

export function buildDispatchBaggingSnapshotFromSourceBags(task: RuntimeProcessTask, sourceBags: DispatchBaggingSourceBag[], source: DispatchBaggingSnapshot['source']): DispatchBaggingSnapshot {
  const lines = taskSkuLines(task)
  const lineCodes = new Set(lines.map((line) => line.skuCode))
  const bags: DispatchBagView[] = sourceBags.map((bag) => {
    const productionOrders = new Set(bag.tickets.map((ticket) => ticket.productionOrderNo).filter(Boolean))
    return {
      bagCode: bag.bagCode, status: bag.status, location: bag.location, updatedAt: bag.updatedAt,
      mixedProductionOrders: productionOrders.size > 1,
      handedOver: bag.status === '已交出待回收',
      tickets: bag.tickets.map((ticket) => {
        const skuCode = matchSkuCode(ticket, lines)
        return { ...ticket, skuCode, taskEquivalentQty: ticket.taskEquivalentQty ?? null, inTaskScope: lineCodes.has(skuCode) }
      }),
    }
  })
  const validBags = bags.filter((bag) => !bag.mixedProductionOrders && !bag.handedOver)
  const skuViews = lines.map((line) => {
    const ticketRows = validBags.flatMap((bag) => bag.tickets.filter((ticket) => ticket.skuCode === line.skuCode).map((ticket) => ({ bagCode: bag.bagCode, qty: ticket.pieceQty, taskEquivalentQty: ticket.taskEquivalentQty })))
    const baggedPieceQty = ticketRows.reduce((sum, item) => sum + item.qty, 0)
    const coveredTaskQty = ticketRows.every((item) => item.taskEquivalentQty != null) ? ticketRows.reduce((sum, item) => sum + (item.taskEquivalentQty || 0), 0) : null
    return { ...line, baggedPieceQty, coveredTaskQty, unbaggedQty: coveredTaskQty == null ? null : Math.max(0, line.qty - coveredTaskQty), bagCodes: [...new Set(ticketRows.map((item) => item.bagCode))], hasQuantityMismatch: coveredTaskQty != null && coveredTaskQty !== line.qty }
  })
  const recommendationGroups = buildGroups(skuViews, bags)
  const warnings: string[] = []
  if (!sourceBags.length) warnings.push('当前没有菲票装袋记录；不阻断派单，可继续按完整SKU分配。')
  if (bags.some((bag) => bag.mixedProductionOrders)) warnings.push('存在跨生产单混装袋，已从装袋推荐中排除；任务分配不受阻断。')
  if (bags.some((bag) => bag.handedOver)) warnings.push('存在已交出袋，不能作为当前装袋推荐依据；如需改派须由现场按最新任务处理。')
  if (validBags.some((bag) => bag.tickets.some((ticket) => ticket.inTaskScope && ticket.taskEquivalentQty == null))) warnings.push('当前菲票只有裁片“片数”，缺少齐套换算为任务“件数”的依据；未覆盖任务显示“待齐套换算”，不阻断分配。')
  if (skuViews.some((item) => item.hasQuantityMismatch)) warnings.push('任务数量与当前装袋可换算的任务覆盖数量不完全一致；数量差异仅提示，不阻断分配。')
  return {
    source,
    updatedAt: bags.map((bag) => bag.updatedAt).filter(Boolean).sort().at(-1) || '—',
    taskSkuCount: lines.length,
    taskQty: lines.reduce((sum, line) => sum + line.qty, 0),
    validBagCount: validBags.length,
    baggedPieceQty: skuViews.reduce((sum, item) => sum + item.baggedPieceQty, 0),
    coveredTaskQty: skuViews.every((item) => item.coveredTaskQty != null) ? skuViews.reduce((sum, item) => sum + (item.coveredTaskQty || 0), 0) : null,
    unbaggedQty: skuViews.every((item) => item.unbaggedQty != null) ? skuViews.reduce((sum, item) => sum + (item.unbaggedQty || 0), 0) : null,
    intactBagCount: validBags.length,
    crossBagSkuCount: skuViews.filter((item) => item.bagCodes.length > 1).length,
    bags, skuViews, recommendationGroups, warnings,
  }
}

export function buildDispatchBaggingSnapshot(task: RuntimeProcessTask, events = listCuttingRuntimeEvents()): DispatchBaggingSnapshot {
  const live = liveSourceBags(task, events)
  const sourceBags = live.length ? live : (DEMO_BAGS[task.productionOrderId || ''] || [])
  const source: DispatchBaggingSnapshot['source'] = live.length ? '现场事件账' : sourceBags.length ? '演示快照' : '暂无装袋记录'
  return buildDispatchBaggingSnapshotFromSourceBags(task, sourceBags, source)
}

export function evaluateDispatchBagSelection(snapshot: DispatchBaggingSnapshot, selectedSkuCodes: ReadonlySet<string>): DispatchBagSelectionImpact {
  const impact: DispatchBagSelectionImpact = { intactBagCodes: [], affectedBagCodes: [], abnormalBagCodes: [], handedOverBagCodes: [] }
  snapshot.bags.forEach((bag) => {
    if (bag.mixedProductionOrders) { impact.abnormalBagCodes.push(bag.bagCode); return }
    if (bag.handedOver) { impact.handedOverBagCodes.push(bag.bagCode); return }
    const taskSkuCodes = [...new Set(bag.tickets.filter((ticket) => ticket.inTaskScope).map((ticket) => ticket.skuCode))]
    if (!taskSkuCodes.length) return
    const selectedCount = taskSkuCodes.filter((skuCode) => selectedSkuCodes.has(skuCode)).length
    if (selectedCount === taskSkuCodes.length) impact.intactBagCodes.push(bag.bagCode)
    else if (selectedCount > 0) impact.affectedBagCodes.push(bag.bagCode)
  })
  return impact
}

export function selectionMatchesRecommendationGroups(snapshot: DispatchBaggingSnapshot, selectedSkuCodes: ReadonlySet<string>): boolean {
  return snapshot.recommendationGroups.every((group) => {
    const count = group.skuCodes.filter((skuCode) => selectedSkuCodes.has(skuCode)).length
    return count === 0 || count === group.skuCodes.length
  })
}
