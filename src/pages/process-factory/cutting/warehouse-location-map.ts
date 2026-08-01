import {
  listFactoryInternalWarehouses,
  listFactoryWaitProcessStockItems,
  type FactoryInternalWarehouse,
  type FactoryInternalWarehouseKind,
  type FactoryWarehouseArea,
  type FactoryWarehouseLocation,
} from '../../../data/fcs/factory-internal-warehouse.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  renderWarehouseLocationMap,
  renderWarehouseLocationMapOccupancyOverlay,
  renderWarehouseLocationMapSummarySection,
  renderWarehouseLocationMapUnlocatedSection,
  type WarehouseLocationMapMode,
} from '../../../components/ui/warehouse-location-map.ts'
import {
  buildWarehouseLocationMapProjection,
  listWarehouseLocationMapShelfCells,
  listStableWarehouseLocationRefs,
  resolveStableWarehouseLocationRef,
  type WarehouseLocationMapProjection,
  type WarehouseLocationOccupancy,
} from './warehouse-location-map-model.ts'
import {
  loadWarehouseLayoutSnapshot,
  saveWarehouseLayoutSnapshot,
  resetWarehouseLayoutSnapshot,
  appendWarehouseArea,
  appendWarehouseLocation,
  applyWarehouseLayoutSnapshot,
  reorderWarehouseAreas,
  reorderWarehouseLocations,
  reorderWarehouseShelves,
  type FactoryWarehouseLayoutSnapshot,
} from './warehouse-location-layout-store.ts'
import {
  buildWaitHandoverLocationOccupancyStates,
  listWaitHandoverRuntimeEvents,
} from './wait-handover-runtime.ts'
import { listSpreadingResultGeneratedFeiTickets } from '../../../data/fcs/cutting/generated-fei-tickets.ts'
import {
  listCuttingRuntimeEventsByInventoryScope,
  type CuttingRuntimeEvent,
} from '../../../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { getProductionOrderTechPackSnapshot } from '../../../data/fcs/production-order-tech-pack-runtime.ts'

export type CuttingWarehouseMapKind = Extract<FactoryInternalWarehouseKind, 'WAIT_PROCESS' | 'WAIT_HANDOVER'>

function getSearchParams(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function listCuttingWarehouses(kind: CuttingWarehouseMapKind): FactoryInternalWarehouse[] {
  return Array.from(new Map(listFactoryInternalWarehouses()
    .filter((warehouse) => warehouse.factoryKind === 'CENTRAL_CUTTING' && warehouse.warehouseKind === kind && warehouse.isEnabled)
    .map((warehouse) => [warehouse.warehouseId, warehouse])).values())
    .sort((left, right) => left.factoryName.localeCompare(right.factoryName, 'zh-CN'))
}

function getCurrentWarehouse(kind: CuttingWarehouseMapKind): FactoryInternalWarehouse | null {
  const warehouses = listCuttingWarehouses(kind)
  const warehouseId = getSearchParams().get('warehouseId')
  const factoryId = getSearchParams().get('factoryId')
  return warehouses.find((warehouse) => warehouse.warehouseId === warehouseId)
    ?? warehouses.find((warehouse) => warehouse.factoryId === factoryId)
    ?? warehouses[0]
    ?? null
}

export function resolveCurrentCuttingWarehouseLocationRef(
  kind: CuttingWarehouseMapKind,
  areaName: string,
  locationNo: string,
) {
  const warehouse = getCurrentWarehouse(kind)
  if (!warehouse) return null
  const { snapshot } = loadWarehouseLayoutSnapshot(warehouse)
  return resolveStableWarehouseLocationRef(warehouse, { areaName, locationNo }, snapshot)
}

function runtimeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function runtimeString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function resolveOccupancyImages(productionOrderId: string | undefined): {
  styleImageUrl?: string
  materialImageUrl?: string
} {
  const snapshot = productionOrderId ? getProductionOrderTechPackSnapshot(productionOrderId) : null
  return {
    styleImageUrl: snapshot?.imageSnapshot.productImages[0]
      || snapshot?.imageSnapshot.styleImages[0]
      || snapshot?.imageSnapshot.sampleImages[0],
    materialImageUrl: snapshot?.imageSnapshot.materialImages[0]
      || snapshot?.imageSnapshot.patternImages[0],
  }
}

function buildRollDetails(totalQty: number, unit: string, locationNos: string[], prefix: string, rollCount: number): Array<{ rollNo: string; yard: number; meter: number; locationNo: string }> {
  const normalizedUnit = unit.trim().toLowerCase()
  const isYard = ['yard', 'yards', 'yd', '码'].includes(normalizedUnit)
  const isMeter = ['m', 'meter', 'meters', '米'].includes(normalizedUnit)
  const count = Math.max(0, Math.round(rollCount))
  if ((!isYard && !isMeter) || count === 0) return []
  const totalYard = isMeter ? totalQty / 0.9144 : totalQty
  const baseYard = Number((totalYard / count).toFixed(2))
  return Array.from({ length: count }, (_, index) => {
    const yard = index === count - 1
      ? Number((totalYard - baseYard * (count - 1)).toFixed(2))
      : baseYard
    return {
    rollNo: `${prefix}-${String(index + 1).padStart(3, '0')}`,
    yard,
    meter: Number((yard * 0.9144).toFixed(2)),
    locationNo: locationNos[index % Math.max(locationNos.length, 1)] || '待确认',
    }
  })
}

function readRuntimeRollDetails(
  payload: Record<string, unknown>,
  totalQty: number,
  unit: string,
  locationNos: string[],
  prefix: string,
  rollCount: number,
): { rows: Array<{ rollNo: string; yard: number; meter: number; locationNo: string }>; isDemo: boolean } {
  const rawRows = Array.isArray(payload.rollDetails) ? payload.rollDetails : []
  const rows = rawRows.map((raw, index) => {
    const row = runtimeRecord(raw)
    const yard = Number(row.yard || row.lengthYard || 0)
    const meter = Number(row.meter || row.lengthMeter || (yard > 0 ? yard * 0.9144 : 0))
    const rollNo = runtimeString(row.rollNo) || runtimeString(row.fabricRollNo)
    if (!rollNo || (!yard && !meter)) return null
    return {
      rollNo,
      yard: Number((yard || meter / 0.9144).toFixed(2)),
      meter: Number((meter || yard * 0.9144).toFixed(2)),
      locationNo: runtimeString(row.locationNo) || locationNos[index % Math.max(locationNos.length, 1)] || '待确认',
    }
  }).filter((row): row is NonNullable<typeof row> => Boolean(row))
  if (rows.length) {
    const normalizedUnit = unit.trim().toLowerCase()
    const expectedYard = ['m', 'meter', 'meters', '米'].includes(normalizedUnit) ? totalQty / 0.9144 : totalQty
    const rowYard = rows.reduce((sum, row) => sum + row.yard, 0)
    const complete = rows.length === Math.max(0, Math.round(rollCount)) && Math.abs(rowYard - expectedYard) <= 0.05
    return complete ? { rows, isDemo: false } : { rows: [], isDemo: false }
  }
  return { rows: buildRollDetails(totalQty, unit, locationNos, prefix, rollCount), isDemo: rollCount > 0 }
}

export function buildWaitProcessRuntimeOccupancies(
  warehouse: FactoryInternalWarehouse,
  snapshot: FactoryWarehouseLayoutSnapshot,
  events: CuttingRuntimeEvent[],
  options: { excludePickupSessionId?: string } = {},
): WarehouseLocationOccupancy[] {
  const classifyPayloadWarehouseScope = (payload: Record<string, unknown>): {
    belongs: boolean
    forceUnresolved: boolean
  } => {
    const explicitFactoryId = runtimeString(payload.factoryId)
    const explicitWarehouseId = runtimeString(payload.warehouseId)
    const explicitWarehouseKind = runtimeString(payload.warehouseKind)
    if (explicitFactoryId || explicitWarehouseId || explicitWarehouseKind) {
      return {
        belongs: explicitFactoryId === warehouse.factoryId
          && explicitWarehouseId === warehouse.warehouseId
          && explicitWarehouseKind === warehouse.warehouseKind,
        forceUnresolved: false,
      }
    }
    const refs = Array.isArray(payload.locationRefs) ? payload.locationRefs.map(runtimeRecord) : []
    const hasMatchingStableRef = refs.some((ref) => runtimeString(ref.factoryId) === warehouse.factoryId
      && runtimeString(ref.warehouseId) === warehouse.warehouseId
      && runtimeString(ref.warehouseKind) === warehouse.warehouseKind)
    if (hasMatchingStableRef) return { belongs: true, forceUnresolved: false }
    const legacyRefs = refs.filter((ref) => !runtimeString(ref.factoryId)
      && !runtimeString(ref.warehouseId)
      && !runtimeString(ref.warehouseKind)
      && Boolean(runtimeString(ref.locationNo) || runtimeString(ref.areaName)))
    if (!legacyRefs.length) return { belongs: false, forceUnresolved: false }
    const candidateWarehouses = listCuttingWarehouses('WAIT_PROCESS').filter((candidate) =>
      legacyRefs.some((ref) => {
        const candidateSnapshot = candidate.warehouseId === warehouse.warehouseId
          ? snapshot
          : loadWarehouseLayoutSnapshot(candidate).snapshot
        return resolveStableWarehouseLocationRef(candidate, {
          areaName: runtimeString(ref.areaName),
          shelfNo: runtimeString(ref.shelfNo),
          locationNo: runtimeString(ref.locationNo),
        }, candidateSnapshot)
      }))
    if (candidateWarehouses.length === 1) {
      return { belongs: candidateWarehouses[0].warehouseId === warehouse.warehouseId, forceUnresolved: false }
    }
    return { belongs: false, forceUnresolved: true }
  }
  const latestAdjustmentBySessionId = new Map<string, Record<string, unknown>>()
  const latestAdjustmentAtBySessionId = new Map<string, string>()
  events
    .filter((event) => event.eventType === '待加工仓位置调整' && event.eventStatus !== '已取消')
    .filter((event) => {
      const scope = classifyPayloadWarehouseScope(runtimeRecord(event.payload))
      return scope.belongs && !scope.forceUnresolved
    })
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt, 'zh-CN'))
    .forEach((event) => {
      const payload = runtimeRecord(event.payload)
      const pickupSessionId = runtimeString(payload.pickupSessionId)
      if (pickupSessionId) {
        latestAdjustmentBySessionId.set(pickupSessionId, payload)
        latestAdjustmentAtBySessionId.set(pickupSessionId, event.occurredAt)
      }
    })
  const sourceEvents = events
    .filter((event) =>
      event.eventStatus !== '已取消'
      && (event.eventType === '中转仓领料' || event.eventType === '待加工仓回收入仓')
      && event.inventoryEffect?.direction === 'IN',
    )
    .filter((event) => classifyPayloadWarehouseScope(runtimeRecord(event.payload)).belongs)
  const originalQtyBySessionUnit = new Map<string, number>()
  const sourceEventsBySessionUnit = new Map<string, CuttingRuntimeEvent[]>()
  const outQtyBySessionUnit = new Map<string, number>()
  const outRowsByMaterialLocation: Array<{ key: string; qty: number; occurredAt: string }> = []
  events
    .filter((event) => event.eventStatus !== '已取消' && event.inventoryEffect?.direction === 'OUT')
    .forEach((event) => {
      const payload = runtimeRecord(event.payload)
      const locationRef = runtimeRecord(payload.locationRef)
      const hasLocationScope = Boolean(runtimeString(locationRef.factoryId) || runtimeString(locationRef.warehouseId) || runtimeString(locationRef.warehouseKind))
      const belongs = hasLocationScope
        ? runtimeString(locationRef.factoryId) === warehouse.factoryId
          && runtimeString(locationRef.warehouseId) === warehouse.warehouseId
          && runtimeString(locationRef.warehouseKind) === warehouse.warehouseKind
        : classifyPayloadWarehouseScope(payload).belongs
      if (!belongs) return
      const sessionId = runtimeString(payload.pickupSessionId) || event.refs.handoverRecordId || ''
      const unit = (event.inventoryEffect?.unit || event.material?.unit || '').trim().toLowerCase()
      const qty = Number(payload.issuedQty || payload.pickupQty || event.inventoryEffect?.qty || 0)
      if (sessionId) {
        const key = `${sessionId}:${unit}`
        const adjustmentAt = latestAdjustmentAtBySessionId.get(sessionId)
        if (!adjustmentAt || event.occurredAt > adjustmentAt) {
          outQtyBySessionUnit.set(key, (outQtyBySessionUnit.get(key) || 0) + qty)
        }
      }
      const materialSku = runtimeString(payload.materialSku) || event.material?.materialSku || ''
      const locationId = runtimeString(locationRef.locationId)
      if (!materialSku || !locationId) return
      const key = `${materialSku}:${unit}:${locationId}`
      outRowsByMaterialLocation.push({ key, qty, occurredAt: event.occurredAt })
    })
  sourceEvents.forEach((event) => {
    const payload = runtimeRecord(event.payload)
    const sessionId = runtimeString(payload.pickupSessionId) || event.refs.handoverRecordId || event.eventId
    const unit = (event.inventoryEffect?.unit || event.material?.unit || '').trim().toLowerCase()
    const key = `${sessionId}:${unit}`
    originalQtyBySessionUnit.set(key, (originalQtyBySessionUnit.get(key) || 0)
      + Number(payload.pickupQty || payload.returnedQty || event.inventoryEffect?.qty || 0))
    const rows = sourceEventsBySessionUnit.get(key) ?? []
    rows.push(event)
    sourceEventsBySessionUnit.set(key, rows)
  })
  const adjustedQtyByEventId = new Map<string, number>()
  sourceEventsBySessionUnit.forEach((rows, key) => {
    const sessionId = key.slice(0, key.lastIndexOf(':'))
    const unit = key.slice(key.lastIndexOf(':') + 1)
    const adjustment = latestAdjustmentBySessionId.get(sessionId)
    if (!adjustment) return
    const remainingRows = Array.isArray(adjustment.remainingByUnit) ? adjustment.remainingByUnit.map(runtimeRecord) : []
    const remainingRow = remainingRows.find((item) => runtimeString(item.unit).trim().toLowerCase() === unit)
      ?? (remainingRows.length === 1 ? remainingRows[0] : undefined)
    const remainingQty = Number(remainingRow?.remainingQty || 0)
    const originalTotal = originalQtyBySessionUnit.get(key) || 0
    const totalHundredths = Math.max(0, Math.round(remainingQty * 100))
    const shares = rows.map((event, index) => {
      const payload = runtimeRecord(event.payload)
      const originalQty = Number(payload.pickupQty || payload.returnedQty || event.inventoryEffect?.qty || 0)
      const rawHundredths = originalTotal > 0 ? totalHundredths * originalQty / originalTotal : 0
      return { event, index, hundredths: Math.floor(rawHundredths), remainder: rawHundredths - Math.floor(rawHundredths) }
    })
    const undistributed = totalHundredths - shares.reduce((sum, share) => sum + share.hundredths, 0)
    const byRemainder = [...shares].sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    for (let index = 0; index < undistributed; index += 1) {
      byRemainder[index % Math.max(byRemainder.length, 1)]!.hundredths += 1
    }
    shares.forEach((share) => adjustedQtyByEventId.set(share.event.eventId, share.hundredths / 100))
  })
  return sourceEvents
    .flatMap((event) => {
      const payload = runtimeRecord(event.payload)
      const payloadScope = classifyPayloadWarehouseScope(payload)
      const pickupSessionId = runtimeString(payload.pickupSessionId) || event.refs.handoverRecordId || event.eventId
      const adjustment = latestAdjustmentBySessionId.get(pickupSessionId)
      const rawRefs = Array.isArray(adjustment?.locationRefs)
        ? adjustment.locationRefs
        : Array.isArray(payload.locationRefs) ? payload.locationRefs : []
      const locationRefs = rawRefs
        .map((rawRef) => {
          if (payloadScope.forceUnresolved) return null
          const ref = runtimeRecord(rawRef)
          const hasStableScope = Boolean(runtimeString(ref.factoryId) || runtimeString(ref.warehouseId) || runtimeString(ref.warehouseKind))
          if (hasStableScope && (runtimeString(ref.factoryId) !== warehouse.factoryId
            || runtimeString(ref.warehouseId) !== warehouse.warehouseId
            || runtimeString(ref.warehouseKind) !== warehouse.warehouseKind)) return null
          return resolveStableWarehouseLocationRef(warehouse, {
            locationId: runtimeString(ref.locationId),
            areaName: runtimeString(ref.areaName),
            shelfNo: runtimeString(ref.shelfNo),
            locationNo: runtimeString(ref.locationNo),
          }, snapshot)
        })
        .filter((ref): ref is NonNullable<typeof ref> => Boolean(ref))
      if (pickupSessionId === options.excludePickupSessionId) return []
      const occupancyLocations = locationRefs.length
        ? locationRefs.map((ref) => ({ locationId: ref.locationId, locationNo: ref.locationNo }))
        : rawRefs.length
          ? [{
              locationId: `unresolved:${event.eventId}`,
              locationNo: runtimeString(runtimeRecord(rawRefs[0]).locationNo) || '历史库位待确认',
            }]
          : []
      if (!occupancyLocations.length) return []
      const prepLineId = runtimeString(payload.prepLineId) || event.material?.materialSku || event.eventId
      const eventUnit = event.inventoryEffect?.unit || event.material?.unit || ''
      const originalQty = Number(payload.pickupQty || payload.returnedQty || event.inventoryEffect?.qty || 0)
      const sessionUnitKey = `${pickupSessionId}:${eventUnit.trim().toLowerCase()}`
      const originalSessionUnitQty = originalQtyBySessionUnit.get(sessionUnitKey) || originalQty
      const materialSku = event.material?.materialSku || runtimeString(payload.materialSku)
      const adjustmentAt = latestAdjustmentAtBySessionId.get(pickupSessionId)
      const locationOutQty = Array.from(new Set(rawRefs.map((ref) => runtimeString(runtimeRecord(ref).locationId)).filter(Boolean)))
        .reduce((sum, locationId) => sum + outRowsByMaterialLocation
          .filter((row) => row.key === `${materialSku}:${eventUnit.trim().toLowerCase()}:${locationId}`)
          .filter((row) => !adjustmentAt || row.occurredAt > adjustmentAt)
          .reduce((qty, row) => qty + row.qty, 0), 0)
      const totalOutQty = Math.max(outQtyBySessionUnit.get(sessionUnitKey) || 0, locationOutQty)
      const totalQty = adjustment
        ? Number(Math.max(0, (adjustedQtyByEventId.get(event.eventId) || 0)
          - totalOutQty * originalQty / Math.max(originalSessionUnitQty, 1)).toFixed(2))
        : Number(Math.max(0, originalQty - totalOutQty
          * originalQty / Math.max(originalSessionUnitQty, 1)).toFixed(2))
      if (totalQty <= 0) return []
      const footprintLocationNos = occupancyLocations.map((ref) => ref.locationNo)
      const rollPayload = adjustment ?? payload
      const rollCount = Number(rollPayload.rollCount || (adjustment ? 0 : event.inventoryEffect?.rollCount) || 0)
      const rollDetails = readRuntimeRollDetails(
        rollPayload,
        totalQty,
        eventUnit,
        footprintLocationNos,
        `ROLL-${event.eventId}`,
        rollCount,
      )
      const images = resolveOccupancyImages(event.refs.productionOrderId)
      return occupancyLocations.map((ref) => ({
        occupancyId: `wait-process-runtime:${event.eventId}:${ref.locationId}`,
        footprintId: `pickup-session:${pickupSessionId}:${prepLineId}`,
        locationId: ref.locationId,
        productionOrderNo: event.refs.productionOrderNo || event.refs.cutOrderNo || '',
        objectNo: event.material?.materialSku || prepLineId,
        objectName: event.material?.materialName || event.material?.materialAlias || '待加工物料',
         qty: totalQty,
         unit: eventUnit,
        inboundAt: runtimeString(payload.pickupAt) || event.occurredAt,
        inboundBy: runtimeString(payload.pickupBy) || event.operatorName,
        materialColor: event.material?.materialColor,
        materialSpec: event.material?.materialSpec,
        footprintLocationNos,
        remainingQty: totalQty,
        partialOccupancyNote: locationRefs.length > 1
          ? `本批物料存放于 ${locationRefs.length} 个库位；每个库位显示同批总量，汇总按占用对象去重。`
          : locationRefs.length ? undefined : '历史事件缺少稳定仓库身份或库位无法唯一匹配，请主管确认。',
         cutOrderNo: event.refs.cutOrderNo,
         styleName: '裁床生产单款式',
         styleImageUrl: images.styleImageUrl,
          materialImageUrl: images.materialImageUrl,
         rollDetails: rollDetails.rows,
         rollCount,
         rollDetailsAreDemo: rollDetails.isDemo,
       }))
    })
}

function buildWaitProcessOccupancies(
  warehouse: FactoryInternalWarehouse,
  snapshot: FactoryWarehouseLayoutSnapshot,
  includeDemoOccupancies: boolean,
): WarehouseLocationOccupancy[] {
  const runtimeOccupancies = buildWaitProcessRuntimeOccupancies(
    warehouse,
    snapshot,
    listCuttingRuntimeEventsByInventoryScope('裁床待加工仓'),
  )
  const runtimeKeys = new Set(runtimeOccupancies.map((item) =>
    `${item.productionOrderNo}:${item.objectNo}:${item.locationId}`))
  const stockOccupancies = listFactoryWaitProcessStockItems()
    .filter((item) => item.warehouseId === warehouse.warehouseId && item.factoryId === warehouse.factoryId)
    .filter((item) => Number(item.availableQty ?? item.receivedQty - Number(item.issuedQty || 0)) > 0)
    .map((item) => {
      const ref = resolveStableWarehouseLocationRef(warehouse, {
        areaName: item.areaName,
        shelfNo: item.shelfNo,
        locationNo: item.locationNo,
      }, snapshot)
      const images = resolveOccupancyImages(item.productionOrderId)
      return {
        occupancyId: `wait-process:${item.stockItemId}`,
        footprintId: `wait-process:${item.sourceRecordId}`,
        locationId: ref?.locationId ?? `unresolved:${item.stockItemId}`,
        productionOrderNo: item.productionOrderNo || item.taskNo || '',
        objectNo: item.materialSku || item.sourceRecordNo,
        objectName: item.stockMaterialName || item.itemName,
        qty: Number(item.availableQty ?? item.receivedQty - Number(item.issuedQty || 0)),
        unit: item.unit,
        inboundAt: item.receivedAt,
        inboundBy: item.receiverName || item.operatorRoleName || '仓管员',
        materialColor: item.fabricColor,
        taskNo: item.taskNo,
         cutOrderNo: item.sourceRecordNo,
         styleName: '裁床生产单款式',
         styleImageUrl: images.styleImageUrl,
          materialImageUrl: images.materialImageUrl || item.photoList[0],
          rollDetails: item.fabricRollNo
            ? buildRollDetails(Number(item.availableQty ?? item.receivedQty - Number(item.issuedQty || 0)), item.unit, [ref?.locationNo || item.locationNo], item.fabricRollNo, 1)
            : [],
          rollDetailsAreDemo: false,
          rollCount: item.fabricRollNo ? 1 : undefined,
       }
    })
    .filter((item) => !runtimeKeys.has(`${item.productionOrderNo}:${item.objectNo}:${item.locationId}`))
  const occupancies = [...runtimeOccupancies, ...stockOccupancies]
  if (!includeDemoOccupancies) return occupancies
  const occupiedLocationIds = new Set(occupancies.map((occupancy) => occupancy.locationId))
  return [...occupancies, ...buildWaitProcessDemoOccupancies(warehouse, snapshot, occupiedLocationIds)]
}

function buildWaitHandoverOccupancies(warehouse: FactoryInternalWarehouse, includeDemoOccupancies: boolean): WarehouseLocationOccupancy[] {
  const tickets = listSpreadingResultGeneratedFeiTickets()
  const ticketById = new Map(tickets.map((ticket) => [ticket.feiTicketId, ticket]))
  const occupancies = buildWaitHandoverLocationOccupancyStates(listWaitHandoverRuntimeEvents())
    .filter((state) =>
      state.locationRef.factoryId === warehouse.factoryId
      && state.locationRef.warehouseKind === warehouse.warehouseKind
      && state.locationRef.warehouseId === warehouse.warehouseId,
    )
    .map((state) => {
      const resolvedTickets = state.feiTicketIds.map((ticketId) => ticketById.get(ticketId)).filter(Boolean)
      const ticketDetails = resolvedTickets.map((ticket) => ({
        feiTicketNo: ticket!.feiTicketNo,
        partName: ticket!.partName,
        size: ticket!.skuSize || '未标记',
        pieceQty: Number(ticket!.actualCutPieceQty || ticket!.qty || 0),
        specialCraftText: ticket!.hasSpecialCraft ? ticket!.specialCraftDisplayLabel : undefined,
      }))
      const images = resolveOccupancyImages(resolvedTickets[0]?.productionOrderId)
      return {
        occupancyId: `wait-handover:${state.sourceEventId}`,
        footprintId: `bag:${state.bagCode}`,
        locationId: state.locationRef.locationId,
        productionOrderNo: state.productionOrderNo,
        objectNo: state.objectNo || state.bagCode,
        objectName: state.objectName || `中转袋 ${state.bagCode}`,
        qty: state.totalPieceQty,
        unit: '片',
        inboundAt: state.inboundAt,
        inboundBy: state.inboundBy,
        ticketNos: state.feiTicketIds.map((ticketId) => ticketById.get(ticketId)?.feiTicketNo || ticketId),
        styleName: '裁片生产单款式',
        styleImageUrl: images.styleImageUrl,
        bagCode: state.bagCode,
        packed: state.feiTicketIds.length > 0,
        ticketDetails,
        unresolvedTicketCount: state.feiTicketIds.length - resolvedTickets.length,
      }
    })
  return occupancies.length || !includeDemoOccupancies ? occupancies : buildWaitHandoverDemoOccupancies(warehouse)
}

function listDemoLocationRefs(warehouse: FactoryInternalWarehouse, snapshot?: FactoryWarehouseLayoutSnapshot) {
  const applied = applyWarehouseLayoutSnapshot(warehouse, snapshot || loadWarehouseLayoutSnapshot(warehouse).snapshot).warehouse
  return applied.areaList
    .filter((area) => area.status === 'AVAILABLE')
    .flatMap((area) => area.shelfList
      .filter((shelf) => shelf.status === 'AVAILABLE')
      .flatMap((shelf) => shelf.locationList
        .filter((location) => location.status === 'AVAILABLE')
        .map((location) => ({ area, shelf, location }))))
}

function buildWaitProcessDemoOccupancies(
  warehouse: FactoryInternalWarehouse,
  snapshot: FactoryWarehouseLayoutSnapshot,
  excludedLocationIds: Set<string> = new Set(),
): WarehouseLocationOccupancy[] {
  const refs = listDemoLocationRefs(warehouse, snapshot)
    .filter((ref) => !excludedLocationIds.has(ref.location.locationId))
    .slice(0, 2)
  if (!refs.length) return []
  const locationIds = refs.map((ref) => ref.location.locationId)
  const rolls = [
    { rollNo: 'ROLL-DEMO-001', yard: 120, meter: 109.73, locationNo: refs[0].location.locationNo },
    { rollNo: 'ROLL-DEMO-002', yard: 98, meter: 89.61, locationNo: refs[0].location.locationNo },
    { rollNo: 'ROLL-DEMO-003', yard: 86, meter: 78.64, locationNo: refs[1]?.location.locationNo || refs[0].location.locationNo },
  ]
  return refs.map((ref, index) => ({
    occupancyId: `wait-process-demo:${warehouse.factoryId}:${ref.location.locationId}`,
    footprintId: `wait-process-demo-footprint:${warehouse.factoryId}`,
    locationId: ref.location.locationId,
    productionOrderNo: 'PO-DEMO-CUTTING-001',
    objectNo: 'FAB-DEMO-MAIN',
    objectName: '主身梭织面料',
     qty: 304,
    unit: 'yard',
    inboundAt: '2026-07-31 08:30',
    inboundBy: '演示仓管员',
    materialColor: '深海蓝',
    materialSpec: '150cm / 主面料',
    footprintLocationNos: refs.map((item) => item.location.locationNo),
    remainingQty: 304,
    cutOrderNo: 'CUT-DEMO-001',
    styleName: '春季休闲印花短袖',
    styleImageUrl: '/pants-sample.jpg',
    materialImageUrl: '/materials/fabric-main.jpg',
    rollDetails: rolls,
    rollCount: rolls.length,
    rollDetailsAreDemo: true,
  }))
}

function buildWaitHandoverDemoOccupancies(warehouse: FactoryInternalWarehouse): WarehouseLocationOccupancy[] {
  const refs = listDemoLocationRefs(warehouse).slice(0, 2)
  if (!refs.length) return []
  const ticketDetails = [
    { feiTicketNo: 'FEI-DEMO-001', partName: '前幅', size: 'M', pieceQty: 24 },
    { feiTicketNo: 'FEI-DEMO-002', partName: '后幅', size: 'M', pieceQty: 24 },
    { feiTicketNo: 'FEI-DEMO-003', partName: '袖子', size: 'M', pieceQty: 24 },
  ]
  const demoBags = [
    { bagCode: 'BAG-DEMO-001', tickets: ticketDetails.slice(0, 2) },
    { bagCode: 'BAG-DEMO-002', tickets: ticketDetails.slice(2) },
  ]
  return refs.map((ref, index) => ({
    occupancyId: `wait-handover-demo:${warehouse.factoryId}:${ref.location.locationId}`,
    footprintId: `bag:${warehouse.factoryId}:${demoBags[index]?.bagCode || `BAG-DEMO-${index + 1}`}`,
    locationId: ref.location.locationId,
    productionOrderNo: 'PO-DEMO-CUTTING-002',
    objectNo: demoBags[index]?.bagCode || `BAG-DEMO-${index + 1}`,
    objectName: '已装菲票中转袋',
    qty: (demoBags[index]?.tickets || []).reduce((sum, ticket) => sum + ticket.pieceQty, 0),
    unit: '片',
    inboundAt: '2026-07-31 09:10',
    inboundBy: '演示裁片仓管',
    footprintLocationNos: [ref.location.locationNo],
    remainingQty: (demoBags[index]?.tickets || []).reduce((sum, ticket) => sum + ticket.pieceQty, 0),
    ticketNos: (demoBags[index]?.tickets || []).map((ticket) => ticket.feiTicketNo),
    styleName: '户外轻量夹克',
    styleImageUrl: '/jacket-sample.jpg',
    bagCode: demoBags[index]?.bagCode || `BAG-DEMO-${index + 1}`,
    packed: true,
    ticketDetails: demoBags[index]?.tickets || [],
  }))
}

export function buildCurrentCuttingWarehouseMapProjection(
  kind: CuttingWarehouseMapKind,
  options: { includeDemoOccupancies?: boolean } = {},
): {
  warehouse: FactoryInternalWarehouse
  snapshot: FactoryWarehouseLayoutSnapshot
  projection: WarehouseLocationMapProjection
  warningMessage: string
  persistenceAvailable: boolean
} | null {
  const warehouse = getCurrentWarehouse(kind)
  if (!warehouse) return null
  const loaded = loadWarehouseLayoutSnapshot(warehouse)
  const occupancies = kind === 'WAIT_PROCESS'
    ? buildWaitProcessOccupancies(warehouse, loaded.snapshot, options.includeDemoOccupancies === true)
    : buildWaitHandoverOccupancies(warehouse, options.includeDemoOccupancies === true)
  const applied = applyWarehouseLayoutSnapshot(warehouse, loaded.snapshot)
  return {
    warehouse,
    snapshot: loaded.snapshot,
    projection: buildWarehouseLocationMapProjection(warehouse, loaded.snapshot, occupancies),
    warningMessage: [loaded.warningMessage, ...applied.warningMessages].filter(Boolean).join('；'),
    persistenceAvailable: loaded.persistenceAvailable,
  }
}

function renderFactorySelector(kind: CuttingWarehouseMapKind, current: FactoryInternalWarehouse): string {
  return `
    <label class="flex items-center gap-2 text-sm">
      <span class="text-muted-foreground">裁床仓库</span>
      <select class="h-10 rounded-md border bg-background px-3" data-skip-page-rerender="true" data-warehouse-map-action="change-factory" data-warehouse-kind="${kind}">
        ${listCuttingWarehouses(kind).map((warehouse) => `
          <option value="${escapeHtml(warehouse.warehouseId)}" data-factory-id="${escapeHtml(warehouse.factoryId)}" ${warehouse.warehouseId === current.warehouseId ? 'selected' : ''}>${escapeHtml(warehouse.factoryName)} / ${escapeHtml(warehouse.warehouseName)}</option>
        `).join('')}
      </select>
    </label>
  `
}

export function renderCuttingWarehouseLocationMapSection(
  kind: CuttingWarehouseMapKind,
  requestedMode?: WarehouseLocationMapMode,
): string {
  const current = buildCurrentCuttingWarehouseMapProjection(kind, { includeDemoOccupancies: getSearchParams().get('demo') === '1' })
  if (!current) {
    return '<div class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">当前没有可用的裁床仓库库位主数据。</div>'
  }
  const mode = current.persistenceAvailable
    ? (requestedMode ?? (getSearchParams().get('layout') === '1' ? 'LAYOUT' : 'VIEW'))
    : 'VIEW'
  const addButtons = mode === 'VIEW' && current.persistenceAvailable
    ? `
      <button type="button" class="min-h-11 rounded-md border px-4 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="open-add-area" data-warehouse-kind="${kind}" data-warehouse-id="${escapeHtml(current.warehouse.warehouseId)}">新增库区</button>
      <button type="button" class="min-h-11 rounded-md border px-4 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="open-add-location" data-warehouse-kind="${kind}" data-warehouse-id="${escapeHtml(current.warehouse.warehouseId)}">新增库位</button>
    `
    : ''
  return `
    <section class="space-y-4" data-cutting-warehouse-map-section data-warehouse-kind="${kind}">
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4" data-warehouse-map-toolbar>
        <div class="flex flex-wrap items-center gap-3">
          ${renderFactorySelector(kind, current.warehouse)}
          <span class="text-xs text-muted-foreground">编排版本 v${current.snapshot.layoutVersion} · ${escapeHtml(current.snapshot.updatedBy)} · ${escapeHtml(current.snapshot.updatedAt)}</span>
        </div>
        <div class="flex gap-2">
          ${current.persistenceAvailable ? '' : '<span class="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">当前仅可查看，无法保存</span>'}
          ${current.warningMessage.includes('无法恢复') ? '<button type="button" class="min-h-11 rounded-md border border-amber-300 px-4 text-sm text-amber-800" data-skip-page-rerender="true" data-warehouse-map-action="reset-layout">恢复默认编排</button>' : ''}
          ${addButtons}
          ${!current.persistenceAvailable ? '' : mode === 'LAYOUT'
            ? '<button type="button" class="min-h-11 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-skip-page-rerender="true" data-warehouse-map-action="finish-layout">完成编排</button>'
            : '<button type="button" class="min-h-11 rounded-md border px-4 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="enter-layout">编排库位图</button>'}
        </div>
      </div>
      ${renderWarehouseLocationMap({
        projection: current.projection,
        mode,
        factoryName: current.warehouse.factoryName,
        feedbackMessage: current.warningMessage,
      })}
    </section>
  `
}

const CUTTING_WAREHOUSE_MODAL_ID = 'cutting-warehouse-location-map-modal'

function removeCuttingWarehouseLocationMapModal(): void {
  if (typeof document === 'undefined') return
  document.getElementById(CUTTING_WAREHOUSE_MODAL_ID)?.remove()
}

function renderCuttingWarehouseLocationMapModal(
  kind: CuttingWarehouseMapKind,
  action: 'area' | 'location',
): string {
  const current = buildCurrentCuttingWarehouseMapProjection(kind, { includeDemoOccupancies: getSearchParams().get('demo') === '1' })
  if (!current) return ''
  const areas = current.projection.areas
  const defaultAreaId = areas[0]?.areaId || ''
  const areaOptions = areas.map((area) => `<option value="${escapeHtml(area.areaId)}">${escapeHtml(area.areaName)}</option>`).join('')
  const shelfOptions = areas.flatMap((area) => area.shelves.map((shelf) =>
    `<option value="${escapeHtml(shelf.shelfId)}" data-area-id="${escapeHtml(area.areaId)}" ${area.areaId === defaultAreaId ? '' : 'hidden disabled'}>${escapeHtml(area.areaName)} / ${escapeHtml(shelf.shelfNo)}</option>`)).join('')
  return `
    <div id="${CUTTING_WAREHOUSE_MODAL_ID}" class="fixed inset-0 z-[140]" data-cutting-warehouse-modal data-warehouse-kind="${kind}" data-warehouse-modal-action="${action}" data-layout-version="${current.snapshot.layoutVersion}">
      <button type="button" class="absolute inset-0 bg-black/45" data-skip-page-rerender="true" data-warehouse-map-action="close-add-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background shadow-2xl">
        <header class="flex items-center justify-between border-b px-5 py-4">
          <h2 class="text-base font-semibold">${action === 'area' ? '新增库区' : '新增库位'}</h2>
          <button type="button" class="min-h-11 rounded-md border px-3 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="close-add-dialog">关闭</button>
        </header>
        <form class="space-y-4 p-5" data-cutting-warehouse-create-form>
          ${action === 'area' ? `
            <label class="block text-sm"><span class="font-medium">库区名称</span><input name="areaName" required class="mt-1 h-10 w-full rounded-md border px-3" placeholder="例如 主身扩展区" /></label>
            <label class="block text-sm"><span class="font-medium">备注</span><textarea name="remark" class="mt-1 h-20 w-full rounded-md border px-3 py-2" placeholder="可选"></textarea></label>
          ` : `
            <label class="block text-sm"><span class="font-medium">目标库区</span><select name="areaId" required class="mt-1 h-10 w-full rounded-md border px-3" data-skip-page-rerender="true" data-warehouse-map-action="change-add-area">${areaOptions}</select></label>
            <label class="block text-sm"><span class="font-medium">目标货架</span><select name="shelfId" required class="mt-1 h-10 w-full rounded-md border px-3">${shelfOptions}</select></label>
            <label class="block text-sm"><span class="font-medium">库位编号</span><input name="locationNo" class="mt-1 h-10 w-full rounded-md border px-3" placeholder="留空自动生成" /></label>
            <label class="block text-sm"><span class="font-medium">备注</span><textarea name="remark" class="mt-1 h-20 w-full rounded-md border px-3 py-2" placeholder="可选"></textarea></label>
          `}
          <div class="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">新增后会进入当前${kind === 'WAIT_PROCESS' ? '待加工仓' : '待交出仓'}库位图，并保留编排版本。</div>
          <div class="flex justify-end gap-2">
            <button type="button" class="min-h-11 rounded-md border px-4 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="close-add-dialog">取消</button>
            <button type="button" class="min-h-11 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-skip-page-rerender="true" data-warehouse-map-action="submit-add-${action}">保存</button>
          </div>
        </form>
      </section>
    </div>
  `
}

function openCuttingWarehouseLocationMapModal(kind: CuttingWarehouseMapKind, action: 'area' | 'location'): void {
  if (typeof document === 'undefined') return
  removeCuttingWarehouseLocationMapModal()
  const section = document.querySelector<HTMLElement>(`[data-cutting-warehouse-map-section][data-warehouse-kind="${kind}"]`)
  section?.insertAdjacentHTML('beforeend', renderCuttingWarehouseLocationMapModal(kind, action))
  const modal = document.getElementById(CUTTING_WAREHOUSE_MODAL_ID)
  modal?.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null
    if (!target?.closest('[data-warehouse-map-action]')) return
    if (handleCuttingWarehouseLocationMapEvent(target, event)) event.stopPropagation()
  })
  modal?.addEventListener('change', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null
    if (!target?.closest('[data-warehouse-map-action]')) return
    if (handleCuttingWarehouseLocationMapEvent(target, event)) event.stopPropagation()
  })
}

function readCreateFormValue(form: ParentNode, name: string): string {
  return form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`)?.value.trim() || ''
}

function buildCustomAreaId(warehouseId: string): string {
  const randomSuffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `AREA-${warehouseId}-CUSTOM-${Date.now()}-${randomSuffix}`
}

function buildCustomLocationId(shelfId: string): string {
  const randomSuffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `LOC-${shelfId}-CUSTOM-${Date.now()}-${randomSuffix}`
}

function cleanWarehouseNumberLabel(value: string): string {
  return value.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || '库区'
}

function normalizeWarehouseIdentifier(value: string): string {
  return value.normalize('NFKC').trim().toUpperCase().replace(/[‐‑‒–—−\s]+/gu, '-')
}

function buildUniqueAreaName(projection: WarehouseLocationMapProjection, requestedName: string): string {
  const names = new Set(projection.areas.map((area) => normalizeWarehouseIdentifier(area.areaName)))
  if (!names.has(normalizeWarehouseIdentifier(requestedName))) return requestedName
  let sequence = 2
  while (names.has(normalizeWarehouseIdentifier(`${requestedName}-${sequence}`))) sequence += 1
  return `${requestedName}-${sequence}`
}

function buildInitialAreaNumbers(allLocations: Array<{ shelfNo: string; locationNo: string }>, areaName: string): {
  shelfNo: string
  locationNo: string
} {
  const shelfNos = new Set(allLocations.map((location) => normalizeWarehouseIdentifier(location.shelfNo)))
  const locationNos = new Set(allLocations.map((location) => normalizeWarehouseIdentifier(location.locationNo)))
  let sequence = 1
  while (true) {
    const shelfNo = `${cleanWarehouseNumberLabel(areaName)}-${String(sequence).padStart(2, '0')}`
    const locationNo = `${shelfNo}-01`
    if (!shelfNos.has(normalizeWarehouseIdentifier(shelfNo)) && !locationNos.has(normalizeWarehouseIdentifier(locationNo))) return { shelfNo, locationNo }
    sequence += 1
  }
}

function saveCreatedWarehouseStructure(
  kind: CuttingWarehouseMapKind,
  mutate: (snapshot: FactoryWarehouseLayoutSnapshot) => FactoryWarehouseLayoutSnapshot,
  expectedVersion: number,
): boolean {
  const current = buildCurrentCuttingWarehouseMapProjection(kind, { includeDemoOccupancies: getSearchParams().get('demo') === '1' })
  if (!current) return false
  let nextSnapshot: FactoryWarehouseLayoutSnapshot
  try {
    nextSnapshot = mutate(structuredClone(current.snapshot))
  } catch (error) {
    if (typeof window !== 'undefined') window.alert(error instanceof Error ? error.message : '新增结构失败，请检查后重试。')
    return false
  }
  const saved = saveWarehouseLayoutSnapshot({ ...nextSnapshot, updatedBy: '当前用户' }, expectedVersion)
  if (!saved.ok) {
    if (typeof window !== 'undefined') window.alert(saved.message)
    return false
  }
  removeCuttingWarehouseLocationMapModal()
  refreshMapSection(kind)
  return true
}

function updateUrlParam(name: string, value: string | null): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  value ? url.searchParams.set(name, value) : url.searchParams.delete(name)
  window.history.replaceState({}, '', `${url.pathname}${url.search}`)
}

function refreshMapSection(kind: CuttingWarehouseMapKind): void {
  if (typeof document === 'undefined') return
  const region = document.querySelector<HTMLElement>(`[data-cutting-warehouse-map-section][data-warehouse-kind="${kind}"]`)
  if (!region) return
  const template = document.createElement('template')
  template.innerHTML = renderCuttingWarehouseLocationMapSection(kind).trim()
  const nextSection = template.content.firstElementChild
  const currentToolbar = region.querySelector<HTMLElement>('[data-warehouse-map-toolbar]')
  const nextToolbar = nextSection?.querySelector<HTMLElement>('[data-warehouse-map-toolbar]')
  if (currentToolbar && nextToolbar) currentToolbar.replaceWith(nextToolbar)
  const currentMap = region.querySelector<HTMLElement>('[data-warehouse-map-root]')
  const nextMap = nextSection?.querySelector<HTMLElement>('[data-warehouse-map-root]')
  if (currentMap && nextMap) currentMap.replaceWith(nextMap)
}

function refreshOccupancyOverlay(kind: CuttingWarehouseMapKind): void {
  if (typeof document === 'undefined') return
  const currentMap = document.querySelector<HTMLElement>(`[data-cutting-warehouse-map-section][data-warehouse-kind="${kind}"] [data-warehouse-map-root]`)
  if (!currentMap) return
  const current = buildCurrentCuttingWarehouseMapProjection(kind, { includeDemoOccupancies: getSearchParams().get('demo') === '1' })
  if (!current) return
  const template = document.createElement('template')
  template.innerHTML = renderWarehouseLocationMapOccupancyOverlay(current.projection).trim()
  currentMap.querySelectorAll('[data-warehouse-map-occupancy-overlay]').forEach((node) => node.remove())
  Array.from(template.content.children).forEach((node) => currentMap.append(node))
}

function refreshUnlocatedSection(kind: CuttingWarehouseMapKind): void {
  if (typeof document === 'undefined') return
  const currentMap = document.querySelector<HTMLElement>(`[data-cutting-warehouse-map-section][data-warehouse-kind="${kind}"] [data-warehouse-map-root]`)
  if (!currentMap) return
  const current = buildCurrentCuttingWarehouseMapProjection(kind, { includeDemoOccupancies: getSearchParams().get('demo') === '1' })
  if (!current) return
  const template = document.createElement('template')
  template.innerHTML = renderWarehouseLocationMapUnlocatedSection(current.projection).trim()
  currentMap.querySelector('[data-warehouse-map-unlocated-section]')?.replaceWith(template.content)
}

function refreshSummarySection(kind: CuttingWarehouseMapKind): void {
  if (typeof document === 'undefined') return
  const currentMap = document.querySelector<HTMLElement>(`[data-cutting-warehouse-map-section][data-warehouse-kind="${kind}"] [data-warehouse-map-root]`)
  if (!currentMap) return
  const current = buildCurrentCuttingWarehouseMapProjection(kind, { includeDemoOccupancies: getSearchParams().get('demo') === '1' })
  if (!current) return
  const template = document.createElement('template')
  template.innerHTML = renderWarehouseLocationMapSummarySection(current.projection).trim()
  currentMap.querySelector('[data-warehouse-map-summary-section]')?.replaceWith(template.content)
}

function moveId(ids: string[], id: string, direction: -1 | 1): string[] {
  const next = [...ids]
  const index = next.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

function persistSnapshot(
  kind: CuttingWarehouseMapKind,
  mutate: (snapshot: FactoryWarehouseLayoutSnapshot) => FactoryWarehouseLayoutSnapshot,
): void {
  const current = buildCurrentCuttingWarehouseMapProjection(kind)
  if (!current) return
  if (!current.persistenceAvailable) {
    if (typeof window !== 'undefined') window.alert('当前仅可查看，无法保存。')
    return
  }
  const next = mutate(current.snapshot)
  if (next === current.snapshot) return
  const result = saveWarehouseLayoutSnapshot(
    { ...next, updatedBy: '当前用户' },
    current.snapshot.layoutVersion,
  )
  if (!result.ok && typeof window !== 'undefined') window.alert(result.message)
  refreshMapSection(kind)
}

export function handleCuttingWarehouseLocationMapEvent(target: HTMLElement, event?: Event): boolean {
  const node = target.closest<HTMLElement>('[data-warehouse-map-action]')
  if (!node) return false
  const modal = node.closest<HTMLElement>('[data-cutting-warehouse-modal]')
  if (modal) {
    const kind = modal.dataset.warehouseKind as CuttingWarehouseMapKind | undefined
    if (!kind) return false
    const action = node.dataset.warehouseMapAction
    if (action === 'close-add-dialog') {
      removeCuttingWarehouseLocationMapModal()
      return true
    }
    if (action === 'change-add-area' && node instanceof HTMLSelectElement) {
      const shelfSelect = modal.querySelector<HTMLSelectElement>('[name="shelfId"]')
      if (!shelfSelect) return true
      let firstAvailable = ''
      Array.from(shelfSelect.options).forEach((option) => {
        const available = option.dataset.areaId === node.value
        option.hidden = !available
        option.disabled = !available
        if (available && !firstAvailable) firstAvailable = option.value
      })
      shelfSelect.value = firstAvailable
      return true
    }
    if (action === 'submit-add-area' || action === 'submit-add-location') {
      if (event?.type === 'click' && node instanceof HTMLButtonElement) event.preventDefault()
      const form = modal.querySelector<HTMLElement>('[data-cutting-warehouse-create-form]')
      if (!form) return true
      const current = buildCurrentCuttingWarehouseMapProjection(kind)
      if (!current) return true
      const expectedVersion = Number(modal.dataset.layoutVersion)
      if (action === 'submit-add-area') {
        const requestedAreaName = readCreateFormValue(form, 'areaName')
        if (!requestedAreaName) {
          window.alert('请输入库区名称。')
          return true
        }
        const areaName = buildUniqueAreaName(current.projection, requestedAreaName)
        const initialNumbers = buildInitialAreaNumbers(
          listStableWarehouseLocationRefs(current.warehouse, current.snapshot),
          areaName,
        )
        const areaId = buildCustomAreaId(current.warehouse.warehouseId)
        const area: FactoryWarehouseArea = {
          areaId,
          areaName,
          shelfList: [{
            shelfId: `SHELF-${areaId}-01`,
            shelfNo: initialNumbers.shelfNo,
            shelfName: initialNumbers.shelfNo,
            locationList: [{
              locationId: `LOC-${areaId}-01-01`,
              locationNo: initialNumbers.locationNo,
              locationName: initialNumbers.locationNo,
              status: 'AVAILABLE',
              remark: readCreateFormValue(form, 'remark'),
            }],
            status: 'AVAILABLE',
            remark: readCreateFormValue(form, 'remark'),
          }],
          status: 'AVAILABLE',
          remark: readCreateFormValue(form, 'remark'),
        }
        saveCreatedWarehouseStructure(kind, (snapshot) => appendWarehouseArea(snapshot, area), expectedVersion)
        return true
      }
      const areaId = readCreateFormValue(form, 'areaId')
      const shelfId = readCreateFormValue(form, 'shelfId')
      const area = current.projection.areas.find((item) => item.areaId === areaId)
      const shelf = area?.shelves.find((item) => item.shelfId === shelfId)
      if (!area || !shelf) {
        window.alert('请选择有效的库区和货架。')
        return true
      }
      const requestedNo = readCreateFormValue(form, 'locationNo')
      const locationNos = new Set(listStableWarehouseLocationRefs(current.warehouse, current.snapshot)
        .map((item) => normalizeWarehouseIdentifier(item.locationNo)))
      let locationNo = requestedNo
      if (!locationNo) {
        let sequence = listWarehouseLocationMapShelfCells(shelf).length + 1
        do {
          locationNo = `${shelf.shelfNo}-${String(sequence).padStart(2, '0')}`
          sequence += 1
        } while (locationNos.has(normalizeWarehouseIdentifier(locationNo)))
      }
      if (locationNos.has(normalizeWarehouseIdentifier(locationNo))) {
        window.alert('库位编号已存在，请更换后重试。')
        return true
      }
      const location: FactoryWarehouseLocation = {
        locationId: buildCustomLocationId(shelfId),
        locationNo,
        locationName: locationNo,
        status: 'AVAILABLE',
        remark: readCreateFormValue(form, 'remark'),
      }
      saveCreatedWarehouseStructure(kind, (snapshot) => appendWarehouseLocation(snapshot, areaId, shelfId, location), expectedVersion)
      return true
    }
    return false
  }
  const section = node.closest<HTMLElement>('[data-cutting-warehouse-map-section]')
  const kind = section?.dataset.warehouseKind as CuttingWarehouseMapKind | undefined
  if (!kind) return false
  const action = node.dataset.warehouseMapAction
  if (action === 'open-add-area' || action === 'open-add-location') {
    openCuttingWarehouseLocationMapModal(kind, action === 'open-add-area' ? 'area' : 'location')
    return true
  }
  if (action === 'change-factory' && target instanceof HTMLSelectElement) {
    updateUrlParam('warehouseId', target.value)
    updateUrlParam('factoryId', null)
    updateUrlParam('locationId', null)
    refreshMapSection(kind)
    return true
  }
  if (action === 'enter-layout' || action === 'finish-layout') {
    updateUrlParam('layout', action === 'enter-layout' ? '1' : null)
    refreshMapSection(kind)
    return true
  }
  if (action === 'reset-layout') {
    const warehouse = getCurrentWarehouse(kind)
    if (!warehouse || !window.confirm('确认清除损坏的本地编排并恢复默认布局吗？')) return true
    const reset = resetWarehouseLayoutSnapshot(warehouse, '当前用户')
    if (!reset.ok) window.alert(reset.message)
    refreshMapSection(kind)
    return true
  }
  if (action === 'open-occupancy') {
    updateUrlParam('locationId', node.dataset.locationId || null)
    updateUrlParam('occupancyPage', null)
    updateUrlParam('occupancyDetailPage', null)
    updateUrlParam('occupancyDetailId', null)
    refreshOccupancyOverlay(kind)
    return true
  }
  if (action === 'close-occupancy') {
    updateUrlParam('locationId', null)
    updateUrlParam('occupancyPage', null)
    updateUrlParam('occupancyDetailPage', null)
    updateUrlParam('occupancyDetailId', null)
    refreshOccupancyOverlay(kind)
    return true
  }
  if (action === 'occupancy-page') {
    updateUrlParam('occupancyPage', node.dataset.page || '1')
    updateUrlParam('occupancyDetailPage', null)
    updateUrlParam('occupancyDetailId', null)
    refreshOccupancyOverlay(kind)
    return true
  }
  if (action === 'occupancy-detail-page') {
    updateUrlParam('occupancyDetailPage', node.dataset.page || '1')
    updateUrlParam('occupancyDetailId', node.dataset.occupancyId || null)
    refreshOccupancyOverlay(kind)
    return true
  }
  if (action === 'unlocated-page') {
    updateUrlParam('unlocatedPage', node.dataset.page || '1')
    refreshUnlocatedSection(kind)
    return true
  }
  if (action === 'summary-page') {
    updateUrlParam('summaryPage', node.dataset.page || '1')
    refreshSummarySection(kind)
    return true
  }
  if (action === 'move-area-left' || action === 'move-area-right') {
    persistSnapshot(kind, (snapshot) => reorderWarehouseAreas(
      snapshot,
      moveId(snapshot.areaList.map((area) => area.areaId), node.dataset.areaId || '', action.endsWith('left') ? -1 : 1),
      '当前用户',
    ))
    return true
  }
  if (action === 'move-shelf-up' || action === 'move-shelf-down') {
    const areaId = node.dataset.areaId || ''
    persistSnapshot(kind, (snapshot) => {
      const area = snapshot.areaList.find((item) => item.areaId === areaId)
      if (!area) return snapshot
      return reorderWarehouseShelves(
        snapshot,
        areaId,
        moveId(area.shelfList.map((shelf) => shelf.shelfId), node.dataset.shelfId || '', action.endsWith('up') ? -1 : 1),
        '当前用户',
      )
    })
    return true
  }
  if (action === 'move-location-left' || action === 'move-location-right') {
    const shelfId = node.dataset.shelfId || ''
    persistSnapshot(kind, (snapshot) => {
      const shelf = snapshot.areaList.flatMap((area) => area.shelfList).find((item) => item.shelfId === shelfId)
      if (!shelf) return snapshot
      return reorderWarehouseLocations(
        snapshot,
        shelfId,
        moveId(shelf.locationList.map((location) => location.locationId), node.dataset.locationId || '', action.endsWith('left') ? -1 : 1),
        '当前用户',
      )
    })
    return true
  }
  if (action === 'rename-location') {
    window.alert('库位完整编号由库区代码、货架序号、层号和层内位置号自动生成，请在后续层级维护入口调整。')
    return true
  }
  if (action === 'rename-area') {
    window.alert('库区名称和代码请在后续层级维护入口调整，系统将先检查占用库位再生成编号。')
    return true
  }
  if (action === 'rename-shelf') {
    window.alert('货架名称和序号请在后续层级维护入口调整，系统将先检查占用库位再生成编号。')
    return true
  }
  return false
}
