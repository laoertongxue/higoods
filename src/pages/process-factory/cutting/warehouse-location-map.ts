import {
  listFactoryInternalWarehouses,
  listFactoryWaitProcessStockItems,
  type FactoryInternalWarehouse,
  type FactoryInternalWarehouseKind,
} from '../../../data/fcs/factory-internal-warehouse.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderFormDialog } from '../../../components/ui/dialog.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import {
  renderWarehouseLocationMap,
  handleWarehouseLocationMapViewportEvent,
  renderWarehouseLocationMapOccupancyOverlay,
  renderWarehouseLocationMapSummarySection,
  renderWarehouseLocationMapUnlocatedSection,
  type WarehouseLocationMapMode,
} from '../../../components/ui/warehouse-location-map.ts'
import {
  buildWarehouseLocationMapProjection,
  listWarehouseLocationMapShelfCells,
  resolveStableWarehouseLocationRef,
  type WarehouseLocationMapProjection,
  type WarehouseLocationOccupancy,
} from './warehouse-location-map-model.ts'
import {
  loadWarehouseLayoutSnapshot,
  saveWarehouseLayoutSnapshot,
  resetWarehouseLayoutSnapshot,
  applyWarehouseLayoutSnapshot,
  createWarehouseArea,
  createWarehouseShelfInBatches,
  updateWarehouseArea,
  updateWarehouseShelf,
  updateWarehouseLocation,
  reorderWarehouseAreas,
  reorderWarehouseLocations,
  reorderWarehouseShelves,
  type FactoryWarehouseLayoutSnapshot,
} from './warehouse-location-layout-store.ts'
import {
  buildWaitHandoverLocationOccupancyStates,
  listWaitHandoverRuntimeEvents,
  type WaitHandoverLocationOccupancyState,
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
    const refs = Array.isArray(payload.warehouseLocations)
      ? payload.warehouseLocations.map(runtimeRecord)
      : Array.isArray(payload.locationRefs) ? payload.locationRefs.map(runtimeRecord) : []
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
  const allSourceEvents = events
    .filter((event) =>
      event.eventStatus !== '已取消'
      && (event.eventType === '中转仓领料' || event.eventType === '待加工仓回收入仓')
      && event.inventoryEffect?.direction === 'IN',
    )
  const sourceEvents = allSourceEvents
    .filter((event) => classifyPayloadWarehouseScope(runtimeRecord(event.payload)).belongs)
  const originalQtyBySessionUnit = new Map<string, number>()
  const sourceEventsBySessionUnit = new Map<string, CuttingRuntimeEvent[]>()
  const outQtyBySourceEventId = new Map<string, number>()
  const sourceEventIds = new Set(sourceEvents.map((event) => event.eventId))
  const eventSessionId = (event: CuttingRuntimeEvent): string => {
    const payload = runtimeRecord(event.payload)
    return runtimeString(payload.pickupSessionId) || event.refs.handoverRecordId?.split(':')[0] || event.eventId
  }
  const eventUnit = (event: CuttingRuntimeEvent): string =>
    (event.inventoryEffect?.unit || event.material?.unit || '').trim().toLowerCase()
  const eventMaterialSku = (event: CuttingRuntimeEvent): string =>
    runtimeString(runtimeRecord(event.payload).materialSku) || event.material?.materialSku || ''
  const eventLocationIds = (event: CuttingRuntimeEvent): string[] => {
    const payload = runtimeRecord(event.payload)
    const rows = Array.isArray(payload.warehouseLocations)
      ? payload.warehouseLocations
      : Array.isArray(payload.locationRefs)
        ? payload.locationRefs
        : payload.locationRef ? [payload.locationRef] : []
    return rows.map((row) => runtimeString(runtimeRecord(row).locationId)).filter(Boolean)
  }
  sourceEvents.forEach((event) => {
    const payload = runtimeRecord(event.payload)
    const key = `${eventSessionId(event)}:${eventUnit(event)}`
    originalQtyBySessionUnit.set(key, (originalQtyBySessionUnit.get(key) || 0)
      + Number(payload.pickupQty || payload.returnedQty || event.inventoryEffect?.qty || 0))
    const rows = sourceEventsBySessionUnit.get(key) ?? []
    rows.push(event)
    sourceEventsBySessionUnit.set(key, rows)
  })
  events
    .filter((event) => event.eventStatus !== '已取消' && event.inventoryEffect?.direction === 'OUT')
    .forEach((event) => {
      const payload = runtimeRecord(event.payload)
      const locationRef = runtimeRecord(payload.locationRef)
      const warehouseLocations = Array.isArray(payload.warehouseLocations)
        ? payload.warehouseLocations.map(runtimeRecord)
        : []
      const hasLocationScope = Boolean(runtimeString(locationRef.factoryId) || runtimeString(locationRef.warehouseId) || runtimeString(locationRef.warehouseKind))
      const hasWarehouseLocationScope = warehouseLocations.some((ref) =>
        runtimeString(ref.factoryId) === warehouse.factoryId
        && runtimeString(ref.warehouseId) === warehouse.warehouseId
        && runtimeString(ref.warehouseKind) === warehouse.warehouseKind)
      const belongs = hasWarehouseLocationScope || (hasLocationScope
        ? runtimeString(locationRef.factoryId) === warehouse.factoryId
          && runtimeString(locationRef.warehouseId) === warehouse.warehouseId
          && runtimeString(locationRef.warehouseKind) === warehouse.warehouseKind
        : classifyPayloadWarehouseScope(payload).belongs)
      if (!belongs) return
      const qty = Number(payload.issuedQty || payload.pickupQty || event.inventoryEffect?.qty || 0)
      if (!(qty > 0)) return
      const explicitSourceIds = Array.isArray(payload.sourceInboundEventIds)
        ? payload.sourceInboundEventIds.map(runtimeString).filter(Boolean)
        : runtimeString(payload.sourceInboundEventId) ? [runtimeString(payload.sourceInboundEventId)] : []
      const pickupSessionId = runtimeString(payload.pickupSessionId)
      let candidates = explicitSourceIds.length
        ? sourceEvents.filter((source) => explicitSourceIds.includes(source.eventId))
        : pickupSessionId
          ? sourceEvents.filter((source) => eventSessionId(source) === pickupSessionId && eventUnit(source) === eventUnit(event))
          : []
      if (!candidates.length && !explicitSourceIds.length && !pickupSessionId) {
        const materialSku = eventMaterialSku(event)
        const outLocationIds = new Set(eventLocationIds(event))
        const legacyCandidates = allSourceEvents.filter((source) =>
          eventMaterialSku(source) === materialSku
          && eventUnit(source) === eventUnit(event)
          && (!outLocationIds.size || eventLocationIds(source).some((id) => outLocationIds.has(id))))
        candidates = legacyCandidates.length === 1 && sourceEventIds.has(legacyCandidates[0].eventId)
          ? [legacyCandidates[0]]
          : []
      }
      if (!candidates.length) return
      const activeCandidates = candidates.filter((source) => {
        const adjustmentAt = latestAdjustmentAtBySessionId.get(eventSessionId(source))
        return !adjustmentAt || event.occurredAt > adjustmentAt
      })
      const originalTotal = activeCandidates.reduce((sum, source) => {
        const sourcePayload = runtimeRecord(source.payload)
        return sum + Number(sourcePayload.pickupQty || sourcePayload.returnedQty || source.inventoryEffect?.qty || 0)
      }, 0)
      let allocated = 0
      activeCandidates.forEach((source, index) => {
        const sourcePayload = runtimeRecord(source.payload)
        const original = Number(sourcePayload.pickupQty || sourcePayload.returnedQty || source.inventoryEffect?.qty || 0)
        const share = index === activeCandidates.length - 1
          ? qty - allocated
          : Number((qty * original / Math.max(originalTotal, 1)).toFixed(2))
        allocated += share
        outQtyBySourceEventId.set(source.eventId, (outQtyBySourceEventId.get(source.eventId) || 0) + share)
      })
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
      const rawRefs = Array.isArray(adjustment?.warehouseLocations)
        ? adjustment.warehouseLocations
        : Array.isArray(adjustment?.locationRefs)
          ? adjustment.locationRefs
          : Array.isArray(payload.warehouseLocations)
            ? payload.warehouseLocations
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
      const effectiveOutQty = outQtyBySourceEventId.get(event.eventId) || 0
      const totalQty = adjustment
        ? Number(Math.max(0, (adjustedQtyByEventId.get(event.eventId) || 0)
          - effectiveOutQty).toFixed(2))
        : Number(Math.max(0, originalQty - effectiveOutQty).toFixed(2))
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
        sourceEventId: event.eventId,
        sourceSessionId: pickupSessionId,
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

export function buildWaitHandoverStorageFootprintId(state: WaitHandoverLocationOccupancyState): string {
  const scope = `${state.locationRef.factoryId}:${state.locationRef.warehouseKind}:${state.locationRef.warehouseId}`
  return `bag:${scope}:${state.bagCode}:${state.usageCycleId || 'legacy-cycle'}`
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
      const resolvedTickets = state.feiTicketIds
        .filter((ticketId) => Number(state.feiTicketQtyById[ticketId] || 0) > 0)
        .map((ticketId) => ticketById.get(ticketId))
        .filter(Boolean)
      const ticketDetails = resolvedTickets.map((ticket) => ({
        feiTicketNo: ticket!.feiTicketNo,
        partName: ticket!.partName,
        size: ticket!.skuSize || '未标记',
        pieceQty: Number(state.feiTicketQtyById[ticket!.feiTicketId] || 0),
        specialCraftText: ticket!.hasSpecialCraft ? ticket!.specialCraftDisplayLabel : undefined,
      }))
      const images = resolveOccupancyImages(resolvedTickets[0]?.productionOrderId)
      return {
        occupancyId: `wait-handover:${state.sourceEventId}:${state.locationRef.locationId}`,
        footprintId: buildWaitHandoverStorageFootprintId(state),
        locationId: state.locationRef.locationId,
        productionOrderNo: state.productionOrderNo,
        objectNo: state.objectNo || state.bagCode,
        objectName: state.objectName || `中转袋 ${state.bagCode}`,
        qty: state.totalPieceQty,
        unit: '片',
        inboundAt: state.inboundAt,
        inboundBy: state.inboundBy,
        ticketNos: state.feiTicketIds.map((ticketId) => ticketById.get(ticketId)?.feiTicketNo || ticketId),
        footprintLocationNos: state.warehouseLocations.map((location) => location.locationNo),
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
          ${!current.persistenceAvailable ? '' : mode === 'LAYOUT'
            ? `<button type="button" class="min-h-11 rounded-md border px-4 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="open-create-area">新增库区</button>
               <button type="button" class="min-h-11 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-skip-page-rerender="true" data-warehouse-map-action="finish-maintenance">完成维护</button>`
            : `<button type="button" class="min-h-11 rounded-md border px-4 text-sm" data-skip-page-rerender="true" data-warehouse-map-action="enter-maintenance" data-warehouse-kind="${kind}" data-warehouse-id="${escapeHtml(current.warehouse.warehouseId)}">维护库位图</button>`}
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

type MaintenanceDialog =
  | { type: 'create-area' }
  | { type: 'create-shelf'; areaId: string }
  | { type: 'edit-area'; areaId: string }
  | { type: 'edit-shelf'; shelfId: string }
  | { type: 'edit-location'; locationId: string }

function removeCuttingWarehouseLocationMapModal(modal?: HTMLElement | null): void {
  if (typeof document === 'undefined') return
  const target = modal ?? document.getElementById(CUTTING_WAREHOUSE_MODAL_ID)
  if (!target) return
  maintenanceOperations.get(target)?.controller.abort()
  maintenanceOperations.delete(target)
  shelfDraftStates.delete(target)
  target.remove()
}

function field(label: string, name: string, value = '', options: { type?: string; disabled?: boolean; placeholder?: string } = {}): string {
  return `<label class="block text-sm"><span class="font-medium">${escapeHtml(label)}</span><input name="${name}" type="${options.type || 'text'}" value="${escapeHtml(value)}" ${options.disabled ? 'disabled' : ''} ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ''} class="mt-1 h-10 w-full rounded-md border px-3 disabled:cursor-not-allowed disabled:bg-muted" /></label>`
}

function remarkField(value = ''): string {
  return `<label class="block text-sm"><span class="font-medium">备注</span><textarea name="remark" class="mt-1 h-20 w-full rounded-md border px-3 py-2" placeholder="可选">${escapeHtml(value)}</textarea></label>`
}

function statusField(enabled: boolean, disabled = false): string {
  return `<label class="block text-sm"><span class="font-medium">启用状态</span><select name="enabled" ${disabled ? 'disabled' : ''} class="mt-1 h-10 w-full rounded-md border bg-background px-3 disabled:cursor-not-allowed disabled:bg-muted"><option value="true" ${enabled ? 'selected' : ''}>启用</option><option value="false" ${enabled ? '' : 'selected'}>停用</option></select></label>`
}

function statusChangeRow(currentEnabled: boolean, nextEnabled: boolean): { before: string; after: string } {
  return { before: currentEnabled ? '启用' : '停用', after: nextEnabled ? '启用' : '停用' }
}

const LEVEL_EDITOR_PAGE_SIZE = 20
const LOCATION_PREVIEW_PAGE_SIZE = 40
const MAINTENANCE_RESOURCE_LIMIT_MESSAGE = '当前设备可用资源不足，建议拆分货架/减少单次生成。'
const LEGACY_MAINTENANCE_RESOURCE_LIMIT_MESSAGE = '本次规模超出当前设备可处理能力，建议拆分货架/减少单次生成。'

interface MaintenanceRuntimeOverrides {
  yieldDelayMs?: number
  resourceEstimate?: { storageAvailableBytes?: number; heapAvailableBytes?: number }
}

let maintenanceRuntimeOverrides: MaintenanceRuntimeOverrides = {}

export function configureCuttingWarehouseMaintenanceRuntimeForTest(overrides: MaintenanceRuntimeOverrides = {}): void {
  maintenanceRuntimeOverrides = overrides
}

interface MaintenanceOperation {
  token: string
  controller: AbortController
  saving: boolean
}

const maintenanceOperations = new WeakMap<HTMLElement, MaintenanceOperation>()

interface ShelfDraftState {
  levelCount: number
  defaultPositionCountRaw: string
  positionCountOverrides: Map<number, string>
  editorPage: number
  previewPage: number
}

const shelfDraftStates = new WeakMap<HTMLElement, ShelfDraftState>()

function paginationButton(label: string, action: string, pageAction: 'first' | 'previous' | 'next' | 'last', disabled: boolean): string {
  return `<button type="button" class="h-8 rounded border px-2 text-xs disabled:cursor-not-allowed disabled:opacity-40" data-skip-page-rerender="true" data-warehouse-map-action="${action}" data-${action === 'change-level-editor-page' ? 'level-editor' : 'location-preview'}-page="${pageAction}" ${disabled ? 'disabled' : ''}>${label}</button>`
}

function renderLocationNumberChangePreview(rows: Array<{ before?: string; after: string }>, message = '完整编号预览', requestedPage = 1): string {
  const totalPages = Math.max(1, Math.ceil(rows.length / LOCATION_PREVIEW_PAGE_SIZE))
  const page = Math.min(Math.max(1, requestedPage), totalPages)
  const visibleRows = rows.slice((page - 1) * LOCATION_PREVIEW_PAGE_SIZE, page * LOCATION_PREVIEW_PAGE_SIZE)
  return `<section class="rounded-md border bg-muted/20 p-3" data-location-number-preview data-preview-page="${page}"><div class="flex flex-wrap items-center justify-between gap-2"><h3 class="text-sm font-medium">${escapeHtml(message)}</h3><span class="text-xs text-muted-foreground">共 ${rows.length} 个完整编号｜第 ${page}/${totalPages} 页</span></div><div class="mt-2 max-h-48 space-y-1 overflow-y-auto font-mono text-xs">${visibleRows.length ? visibleRows.map((row) => `<div data-location-preview-row>${row.before ? `${escapeHtml(row.before)} → ` : ''}${escapeHtml(row.after)}</div>`).join('') : '<div class="text-muted-foreground">暂无受影响库位</div>'}</div><div class="mt-2 flex flex-wrap items-center justify-end gap-2" data-location-preview-pagination>${paginationButton('首页', 'change-location-preview-page', 'first', page === 1)}${paginationButton('上一页', 'change-location-preview-page', 'previous', page === 1)}${paginationButton('下一页', 'change-location-preview-page', 'next', page === totalPages)}${paginationButton('末页', 'change-location-preview-page', 'last', page === totalPages)}</div></section>`
}

function renderLevelPositionEditor(levelCount: number, valueAt: (levelNo: number) => string, requestedPage = 1): string {
  const totalPages = Math.max(1, Math.ceil(levelCount / LEVEL_EDITOR_PAGE_SIZE))
  const page = Math.min(Math.max(1, requestedPage), totalPages)
  const firstLevel = (page - 1) * LEVEL_EDITOR_PAGE_SIZE + 1
  const lastLevel = Math.min(levelCount, page * LEVEL_EDITOR_PAGE_SIZE)
  const fields: string[] = []
  for (let levelNo = firstLevel; levelNo <= lastLevel; levelNo += 1) {
    fields.push(field(`L${String(levelNo).padStart(2, '0')} 位置数`, `positionCount-${levelNo}`, valueAt(levelNo), { type: 'number' }))
  }
  return `<section data-level-position-editor class="rounded-md border p-3"><div class="flex flex-wrap items-center justify-between gap-2"><div class="text-sm font-medium">逐层位置数</div><span class="text-xs text-muted-foreground">共 ${levelCount} 层｜第 ${page}/${totalPages} 页</span></div><div class="mt-2 max-h-72 overflow-y-auto pr-1"><div class="grid gap-2 sm:grid-cols-2">${fields.join('')}</div></div><div class="mt-3 flex flex-wrap items-center justify-end gap-2" data-level-editor-pagination>${paginationButton('首页', 'change-level-editor-page', 'first', page === 1)}${paginationButton('上一页', 'change-level-editor-page', 'previous', page === 1)}${paginationButton('下一页', 'change-level-editor-page', 'next', page === totalPages)}${paginationButton('末页', 'change-level-editor-page', 'last', page === totalPages)}</div></section>`
}

function dialogShell(kind: CuttingWarehouseMapKind, snapshot: FactoryWarehouseLayoutSnapshot, dialog: MaintenanceDialog, title: string, content: string): string {
  const formId = 'cutting-warehouse-maintenance-form'
  const titleId = 'cutting-warehouse-maintenance-title'
  const html = renderFormDialog({
    title,
    description: kind === 'WAIT_PROCESS' ? '当前维护：待加工仓' : '当前维护：待交出仓',
    closeAction: { prefix: 'warehouse-map', action: 'close-maintenance-dialog' },
    submitAction: { prefix: 'warehouse-map', action: 'submit-maintenance', label: '保存' },
    width: 'lg',
  }, `<form id="${formId}" class="space-y-4" data-cutting-warehouse-maintenance-form><button type="submit" class="hidden" tabindex="-1" aria-hidden="true"></button><div class="max-h-[calc(100vh-14rem)] space-y-4 overflow-y-auto pr-1" data-maintenance-dialog-body>${content}<div class="hidden rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert" data-maintenance-error></div></div></form>`)
    .replace('<div class="relative bg-background', `<div role="dialog" aria-modal="true" aria-labelledby="${titleId}" class="relative max-h-[calc(100vh-2rem)] bg-background`)
    .replace('<h2 class="text-lg font-semibold">', `<h2 id="${titleId}" class="text-lg font-semibold">`)
    .replace('<button class="p-1 hover:bg-muted rounded-md -mr-2 -mt-2"', '<button type="button" aria-label="关闭维护弹窗" class="p-1 hover:bg-muted rounded-md -mr-2 -mt-2"')
  return `<div id="${CUTTING_WAREHOUSE_MODAL_ID}" class="fixed inset-0 z-[140]" data-cutting-warehouse-modal data-warehouse-kind="${kind}" data-maintenance-dialog="${dialog.type}" data-area-id="${'areaId' in dialog ? escapeHtml(dialog.areaId) : ''}" data-shelf-id="${'shelfId' in dialog ? escapeHtml(dialog.shelfId) : ''}" data-location-id="${'locationId' in dialog ? escapeHtml(dialog.locationId) : ''}" data-layout-version="${snapshot.layoutVersion}">${html}</div>`
}

function renderCreateAreaDialog(kind: CuttingWarehouseMapKind, snapshot: FactoryWarehouseLayoutSnapshot): string {
  return dialogShell(kind, snapshot, { type: 'create-area' }, '新增库区', `${field('库区编码', 'areaCode', '', { placeholder: 'A 到 Z' })}${field('库区名称', 'areaName')}${remarkField()}${renderLocationNumberChangePreview([], '创建后为空库区，不自动生成货架或库位')}`)
}

function renderCreateShelfDialog(kind: CuttingWarehouseMapKind, snapshot: FactoryWarehouseLayoutSnapshot, areaId: string, values = { shelfSequence: 1, levelCount: 1, defaultPositionCount: 1, positionCounts: [1], remark: '' }): string {
  const area = snapshot.areaList.find((item) => item.areaId === areaId)
  if (!area) return ''
  const defaultValue = String(values.defaultPositionCount)
  const rows = values.positionCounts.flatMap((count, levelIndex) => Array.from({ length: count }, (_, positionIndex) => ({ after: `${area.code}-R${String(values.shelfSequence).padStart(2, '0')}-L${String(levelIndex + 1).padStart(2, '0')}-P${String(positionIndex + 1).padStart(2, '0')}` })))
  return dialogShell(kind, snapshot, { type: 'create-shelf', areaId }, `在 ${area.code} 区新增货架`, `${field('货架序号', 'shelfSequence', String(values.shelfSequence), { type: 'number' })}${field('层数', 'levelCount', String(values.levelCount), { type: 'number' })}${field('默认每层位置数', 'defaultPositionCount', defaultValue, { type: 'number' })}${renderLevelPositionEditor(values.levelCount, (levelNo) => String(values.positionCounts[levelNo - 1] ?? defaultValue))}${remarkField(values.remark)}${renderLocationNumberChangePreview(rows)}`)
}

function occupiedDescendants(current: NonNullable<ReturnType<typeof buildCurrentCuttingWarehouseMapProjection>>, locationIds: string[]): string[] {
  const ids = new Set(locationIds)
  return current.projection.areas.flatMap((area) => area.shelves.flatMap((shelf) => listWarehouseLocationMapShelfCells(shelf))).filter((cell) => ids.has(cell.locationId) && cell.businessStatus === 'OCCUPIED').map((cell) => cell.locationNo)
}

function affectedNotice(nos: string[]): string {
  return nos.length ? `<div class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">占用库位 ${nos.map(escapeHtml).join('、')} 的结构不能修改；请先完成出库或移库。本弹窗仍可修改备注。</div>` : ''
}

function renderEditAreaDialog(kind: CuttingWarehouseMapKind, current: NonNullable<ReturnType<typeof buildCurrentCuttingWarehouseMapProjection>>, areaId: string): string {
  const area = current.snapshot.areaList.find((item) => item.areaId === areaId)
  if (!area) return ''
  const occupied = occupiedDescendants(current, area.shelfList.flatMap((shelf) => shelf.locationList.map((location) => location.locationId)))
  const rows = area.shelfList.flatMap((shelf) => shelf.locationList.map((location) => ({ before: location.locationNo, after: location.locationNo })))
  const enabled = area.status === 'AVAILABLE'
  return dialogShell(kind, current.snapshot, { type: 'edit-area', areaId }, '编辑库区', `${affectedNotice(occupied)}${field('库区编码', 'areaCode', area.code || '', { disabled: Boolean(occupied.length) })}${field('库区名称', 'areaName', area.areaName, { disabled: Boolean(occupied.length) })}${statusField(enabled, Boolean(occupied.length) && enabled)}${remarkField(area.remark)}${renderLocationNumberChangePreview([...rows, statusChangeRow(enabled, enabled)], '编号与状态：原 → 新（输入后实时更新）')}`)
}

function renderEditShelfDialog(kind: CuttingWarehouseMapKind, current: NonNullable<ReturnType<typeof buildCurrentCuttingWarehouseMapProjection>>, shelfId: string): string {
  const area = current.snapshot.areaList.find((item) => item.shelfList.some((shelf) => shelf.shelfId === shelfId))
  const shelf = area?.shelfList.find((item) => item.shelfId === shelfId)
  if (!area || !shelf) return ''
  const occupied = occupiedDescendants(current, shelf.locationList.map((location) => location.locationId))
  const enabled = shelf.status === 'AVAILABLE'
  return dialogShell(kind, current.snapshot, { type: 'edit-shelf', shelfId }, '编辑货架', `${affectedNotice(occupied)}${field('货架序号', 'shelfSequence', String(shelf.shelfSequence || 1), { type: 'number', disabled: Boolean(occupied.length) })}${statusField(enabled, Boolean(occupied.length) && enabled)}${remarkField(shelf.remark)}${renderLocationNumberChangePreview([...shelf.locationList.map((location) => ({ before: location.locationNo, after: location.locationNo })), statusChangeRow(enabled, enabled)], '编号与状态：原 → 新（输入后实时更新）')}`)
}

function renderEditLocationDialog(kind: CuttingWarehouseMapKind, current: NonNullable<ReturnType<typeof buildCurrentCuttingWarehouseMapProjection>>, locationId: string): string {
  const location = current.snapshot.areaList.flatMap((area) => area.shelfList.flatMap((shelf) => shelf.locationList)).find((item) => item.locationId === locationId)
  if (!location) return ''
  const occupied = occupiedDescendants(current, [locationId])
  const enabled = location.status === 'AVAILABLE'
  return dialogShell(kind, current.snapshot, { type: 'edit-location', locationId }, '编辑库位', `${affectedNotice(occupied)}${field('层号（L）', 'levelNo', String(location.levelNo || 1), { type: 'number', disabled: Boolean(occupied.length) })}${field('层内位置号（P）', 'positionNo', String(location.positionNo || 1), { type: 'number', disabled: Boolean(occupied.length) })}${statusField(enabled, Boolean(occupied.length) && enabled)}${remarkField(location.remark)}${renderLocationNumberChangePreview([{ before: location.locationNo, after: location.locationNo }, statusChangeRow(enabled, enabled)], '编号与状态：原 → 新（输入后实时更新）')}`)
}

function renderCuttingWarehouseLocationMapModal(kind: CuttingWarehouseMapKind, dialog: MaintenanceDialog): string {
  const current = buildCurrentCuttingWarehouseMapProjection(kind, { includeDemoOccupancies: getSearchParams().get('demo') === '1' })
  if (!current) return ''
  if (dialog.type === 'create-area') return renderCreateAreaDialog(kind, current.snapshot)
  if (dialog.type === 'create-shelf') return renderCreateShelfDialog(kind, current.snapshot, dialog.areaId)
  if (dialog.type === 'edit-area') return renderEditAreaDialog(kind, current, dialog.areaId)
  if (dialog.type === 'edit-shelf') return renderEditShelfDialog(kind, current, dialog.shelfId)
  return renderEditLocationDialog(kind, current, dialog.locationId)
}

export function openCuttingWarehouseLocationMapModal(kind: CuttingWarehouseMapKind, dialog: MaintenanceDialog): void {
  if (typeof document === 'undefined') return
  removeCuttingWarehouseLocationMapModal()
  const section = document.querySelector<HTMLElement>(`[data-cutting-warehouse-map-section][data-warehouse-kind="${kind}"]`)
  section?.insertAdjacentHTML('beforeend', renderCuttingWarehouseLocationMapModal(kind, dialog))
  const modal = document.getElementById(CUTTING_WAREHOUSE_MODAL_ID)
  if (modal) {
    const token = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`
    modal.setAttribute('data-maintenance-instance-token', token)
    maintenanceOperations.set(modal, { token, controller: new AbortController(), saving: false })
    modal.querySelectorAll<HTMLElement>('[data-warehouse-map-action]').forEach((item) => { item.dataset.skipPageRerender = 'true' })
    hydrateIcons(modal)
    if (dialog.type === 'create-shelf') {
      shelfDraftStates.set(modal, {
        levelCount: Number(formValue(modal, 'levelCount')) || 1,
        defaultPositionCountRaw: formValue(modal, 'defaultPositionCount') || '1',
        positionCountOverrides: new Map(),
        editorPage: 1,
        previewPage: 1,
      })
    }
  }
  modal?.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : event.target instanceof Node ? event.target.parentElement : null
    if (!target?.closest('[data-warehouse-map-action]')) return
    if (handleCuttingWarehouseLocationMapEvent(target, event)) event.stopPropagation()
  })
  modal?.addEventListener('change', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : event.target instanceof Node ? event.target.parentElement : null
    if (target instanceof HTMLSelectElement && target.name === 'enabled') {
      updateMaintenancePreview(modal, kind)
      return
    }
    if (!target?.closest('[data-warehouse-map-action]')) return
    if (handleCuttingWarehouseLocationMapEvent(target, event)) event.stopPropagation()
  })
  modal?.addEventListener('input', (event) => {
    const target = event.target instanceof HTMLInputElement ? event.target : null
    if (!target) return
    if (modal.dataset.maintenanceDialog === 'create-shelf') {
      const draft = requireShelfDraftState(modal)
      if (target.name === 'defaultPositionCount') {
        draft.defaultPositionCountRaw = target.value
        draft.positionCountOverrides.clear()
        replaceLevelPositionEditor(modal, draft)
      } else if (target.name === 'levelCount') {
        const parsed = Number(target.value)
        if (Number.isSafeInteger(parsed) && parsed > 0) {
          draft.levelCount = parsed
          draft.positionCountOverrides.forEach((_, levelNo) => {
            if (levelNo > parsed) draft.positionCountOverrides.delete(levelNo)
          })
          draft.editorPage = Math.min(draft.editorPage, Math.max(1, Math.ceil(parsed / LEVEL_EDITOR_PAGE_SIZE)))
          draft.previewPage = 1
          replaceLevelPositionEditor(modal, draft)
        }
      } else {
        const match = target.name.match(/^positionCount-(\d+)$/)
        if (match) draft.positionCountOverrides.set(Number(match[1]), target.value)
      }
    }
    updateMaintenancePreview(modal, kind)
  })
  modal?.addEventListener('submit', (event) => {
    event.preventDefault()
    modal.querySelector<HTMLButtonElement>('[data-warehouse-map-action="submit-maintenance"]')?.click()
  })
}

function formValue(form: ParentNode, name: string): string {
  return form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${name}"]`)?.value.trim() || ''
}

function parseRequiredPositiveInteger(value: string, label: string): number {
  const parsed = Number(value)
  if (!value || !Number.isFinite(parsed) || !Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${label}必须是有限正整数。`)
  return parsed
}

function requireShelfDraftState(modal: HTMLElement): ShelfDraftState {
  const existing = shelfDraftStates.get(modal)
  if (existing) return existing
  const state: ShelfDraftState = {
    levelCount: parseRequiredPositiveInteger(formValue(modal, 'levelCount'), '层数'),
    defaultPositionCountRaw: formValue(modal, 'defaultPositionCount'),
    positionCountOverrides: new Map(),
    editorPage: 1,
    previewPage: 1,
  }
  shelfDraftStates.set(modal, state)
  return state
}

function shelfDraftValue(state: ShelfDraftState, levelNo: number): string {
  return state.positionCountOverrides.get(levelNo) ?? state.defaultPositionCountRaw
}

function captureVisibleShelfDraftValues(modal: HTMLElement, state: ShelfDraftState): void {
  modal.querySelectorAll<HTMLInputElement>('[data-level-position-editor] input').forEach((input) => {
    const match = input.name.match(/^positionCount-(\d+)$/)
    if (match) state.positionCountOverrides.set(Number(match[1]), input.value)
  })
}

function replaceLevelPositionEditor(modal: HTMLElement, state: ShelfDraftState): void {
  const editor = modal.querySelector<HTMLElement>('[data-level-position-editor]')
  if (!editor) return
  const template = document.createElement('template')
  template.innerHTML = renderLevelPositionEditor(state.levelCount, (levelNo) => shelfDraftValue(state, levelNo), state.editorPage).trim()
  const next = template.content.firstElementChild
  if (next) editor.replaceWith(next)
}

function parseShelfDraftSummary(state: ShelfDraftState): { defaultCount: number; overrides: Map<number, number>; totalCount: number } {
  const defaultCount = parseRequiredPositiveInteger(state.defaultPositionCountRaw, '默认每层位置数')
  const overrides = new Map<number, number>()
  let totalCount = defaultCount * state.levelCount
  if (!Number.isSafeInteger(totalCount)) throw new Error('本次生成库位总数超出语言可安全表示范围，请调整输入后重试。')
  state.positionCountOverrides.forEach((raw, levelNo) => {
    if (levelNo < 1 || levelNo > state.levelCount) return
    const count = parseRequiredPositiveInteger(raw, `第 ${levelNo} 层位置数`)
    overrides.set(levelNo, count)
    totalCount += count - defaultCount
  })
  if (!Number.isSafeInteger(totalCount)) throw new Error('本次生成库位总数超出语言可安全表示范围，请调整输入后重试。')
  return { defaultCount, overrides, totalCount }
}

function resolveShelfPreviewLocation(state: ShelfDraftState, summary: ReturnType<typeof parseShelfDraftSummary>, offset: number): { levelNo: number; positionNo: number } {
  let nextLevel = 1
  let remaining = offset
  const sortedOverrides = [...summary.overrides.entries()].sort(([left], [right]) => left - right)
  for (const [overrideLevel, overrideCount] of sortedOverrides) {
    const uniformLevels = overrideLevel - nextLevel
    const uniformCount = uniformLevels * summary.defaultCount
    if (remaining < uniformCount) return { levelNo: nextLevel + Math.floor(remaining / summary.defaultCount), positionNo: remaining % summary.defaultCount + 1 }
    remaining -= uniformCount
    if (remaining < overrideCount) return { levelNo: overrideLevel, positionNo: remaining + 1 }
    remaining -= overrideCount
    nextLevel = overrideLevel + 1
  }
  return { levelNo: nextLevel + Math.floor(remaining / summary.defaultCount), positionNo: remaining % summary.defaultCount + 1 }
}

function renderCreateShelfPreview(areaCode: string, shelfSequence: number, state: ShelfDraftState): string {
  const summary = parseShelfDraftSummary(state)
  const totalPages = Math.max(1, Math.ceil(summary.totalCount / LOCATION_PREVIEW_PAGE_SIZE))
  state.previewPage = Math.min(Math.max(1, state.previewPage), totalPages)
  const start = (state.previewPage - 1) * LOCATION_PREVIEW_PAGE_SIZE
  const end = Math.min(summary.totalCount, start + LOCATION_PREVIEW_PAGE_SIZE)
  const rows: Array<{ after: string }> = []
  for (let offset = start; offset < end; offset += 1) {
    const { levelNo, positionNo } = resolveShelfPreviewLocation(state, summary, offset)
    rows.push({ after: `${areaCode}-R${String(shelfSequence).padStart(2, '0')}-L${String(levelNo).padStart(2, '0')}-P${String(positionNo).padStart(2, '0')}` })
  }
  const visible = renderLocationNumberChangePreview(rows, '完整编号实时预览')
  return visible
    .replace(`共 ${rows.length} 个完整编号｜第 1/1 页`, `共 ${summary.totalCount} 个完整编号｜第 ${state.previewPage}/${totalPages} 页`)
    .replace('data-preview-page="1"', `data-preview-page="${state.previewPage}"`)
    .replace(/data-location-preview-page="first" disabled/, `data-location-preview-page="first" ${state.previewPage === 1 ? 'disabled' : ''}`)
    .replace(/data-location-preview-page="previous" disabled/, `data-location-preview-page="previous" ${state.previewPage === 1 ? 'disabled' : ''}`)
    .replace(/data-location-preview-page="next" disabled/, `data-location-preview-page="next" ${state.previewPage === totalPages ? 'disabled' : ''}`)
    .replace(/data-location-preview-page="last" disabled/, `data-location-preview-page="last" ${state.previewPage === totalPages ? 'disabled' : ''}`)
}

function replaceMaintenancePreviewHtml(modal: HTMLElement, html: string): void {
  const currentPreview = modal.querySelector<HTMLElement>('[data-location-number-preview], [data-maintenance-preview-error]')
  if (!currentPreview) return
  const template = document.createElement('template')
  template.innerHTML = html.trim()
  const nextPreview = template.content.firstElementChild
  if (nextPreview) currentPreview.replaceWith(nextPreview)
}

function replaceMaintenancePreview(modal: HTMLElement, rows: Array<{ before?: string; after: string }>): void {
  const page = Number(modal.querySelector<HTMLElement>('[data-location-number-preview]')?.dataset.previewPage) || 1
  replaceMaintenancePreviewHtml(modal, renderLocationNumberChangePreview(rows, '编号与状态：原 → 新（实时预览）', page))
}

function replaceMaintenancePreviewError(modal: HTMLElement, message: string): void {
  replaceMaintenancePreviewHtml(modal, `<section class="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800" data-maintenance-preview-error>${escapeHtml(message)}</section>`)
}

function updateMaintenancePreview(modal: HTMLElement, kind: CuttingWarehouseMapKind): void {
  const current = buildCurrentCuttingWarehouseMapProjection(kind, { includeDemoOccupancies: getSearchParams().get('demo') === '1' })
  if (!current) return
  const type = modal.dataset.maintenanceDialog
  try {
  if (type === 'create-shelf') {
    const levelCount = parseRequiredPositiveInteger(formValue(modal, 'levelCount'), '层数')
    const draft = requireShelfDraftState(modal)
    draft.levelCount = levelCount
    const area = current.snapshot.areaList.find((item) => item.areaId === modal.dataset.areaId)
    replaceMaintenancePreviewHtml(modal, renderCreateShelfPreview(area?.code || '', parseRequiredPositiveInteger(formValue(modal, 'shelfSequence'), '货架序号'), draft))
    return
  }
  if (type === 'edit-area') {
    const area = current.snapshot.areaList.find((item) => item.areaId === modal.dataset.areaId)
    if (!area) return
    const code = formValue(modal, 'areaCode') || area.code || ''
    const nextEnabled = formValue(modal, 'enabled') === 'true'
    replaceMaintenancePreview(modal, [...area.shelfList.flatMap((shelf) => shelf.locationList.map((location) => ({ before: location.locationNo, after: `${code}-R${String(shelf.shelfSequence).padStart(2, '0')}-L${String(location.levelNo).padStart(2, '0')}-P${String(location.positionNo).padStart(2, '0')}` }))), statusChangeRow(area.status === 'AVAILABLE', nextEnabled)])
    return
  }
  if (type === 'edit-shelf') {
    const area = current.snapshot.areaList.find((item) => item.shelfList.some((shelf) => shelf.shelfId === modal.dataset.shelfId))
    const shelf = area?.shelfList.find((item) => item.shelfId === modal.dataset.shelfId)
    if (!area || !shelf) return
    const sequence = parseRequiredPositiveInteger(formValue(modal, 'shelfSequence'), '货架序号')
    const nextEnabled = formValue(modal, 'enabled') === 'true'
    replaceMaintenancePreview(modal, [...shelf.locationList.map((location) => ({ before: location.locationNo, after: `${area.code}-R${String(sequence).padStart(2, '0')}-L${String(location.levelNo).padStart(2, '0')}-P${String(location.positionNo).padStart(2, '0')}` })), statusChangeRow(shelf.status === 'AVAILABLE', nextEnabled)])
    return
  }
  if (type === 'edit-location') {
    for (const area of current.snapshot.areaList) for (const shelf of area.shelfList) {
      const location = shelf.locationList.find((item) => item.locationId === modal.dataset.locationId)
      if (!location) continue
      const levelNo = parseRequiredPositiveInteger(formValue(modal, 'levelNo'), '层号')
      const positionNo = parseRequiredPositiveInteger(formValue(modal, 'positionNo'), '层内位置号')
      const nextEnabled = formValue(modal, 'enabled') === 'true'
      replaceMaintenancePreview(modal, [{ before: location.locationNo, after: `${area.code}-R${String(shelf.shelfSequence).padStart(2, '0')}-L${String(levelNo).padStart(2, '0')}-P${String(positionNo).padStart(2, '0')}` }, statusChangeRow(location.status === 'AVAILABLE', nextEnabled)])
    }
  }
  } catch (error) {
    replaceMaintenancePreviewError(modal, error instanceof Error ? error.message : '无法生成预览，请检查输入。')
  }
}

function updateUrlParam(name: string, value: string | null): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  value ? url.searchParams.set(name, value) : url.searchParams.delete(name)
  window.history.replaceState({}, '', `${url.pathname}${url.search}`)
}

function refreshMapSection(kind: CuttingWarehouseMapKind): void {
  if (typeof document === 'undefined') return
  const scrollX = typeof window === 'undefined' ? 0 : window.scrollX
  const scrollY = typeof window === 'undefined' ? 0 : window.scrollY
  const region = document.querySelector<HTMLElement>(`[data-cutting-warehouse-map-section][data-warehouse-kind="${kind}"]`)
  if (!region) return
  const template = document.createElement('template')
  template.innerHTML = renderCuttingWarehouseLocationMapSection(kind).trim()
  const nextSection = template.content.firstElementChild
  const currentToolbar = region.querySelector<HTMLElement>('[data-warehouse-map-toolbar]')
  const nextToolbar = nextSection?.querySelector<HTMLElement>('[data-warehouse-map-toolbar]')
  if (currentToolbar && nextToolbar) {
    currentToolbar.replaceWith(nextToolbar)
    hydrateIcons(nextToolbar)
  }
  const currentMap = region.querySelector<HTMLElement>('[data-warehouse-map-root]')
  const nextMap = nextSection?.querySelector<HTMLElement>('[data-warehouse-map-root]')
  if (currentMap && nextMap) {
    currentMap.replaceWith(nextMap)
    hydrateIcons(nextMap)
  }
  if (typeof window !== 'undefined') window.scrollTo(scrollX, scrollY)
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

function movePaginationPage(currentPage: number, totalPages: number, action: string | undefined): number {
  if (action === 'first') return 1
  if (action === 'previous') return Math.max(1, currentPage - 1)
  if (action === 'next') return Math.min(totalPages, currentPage + 1)
  if (action === 'last') return totalPages
  return currentPage
}

function yieldMaintenanceWork(): Promise<void> {
  return new Promise((resolve) => {
    const delay = maintenanceRuntimeOverrides.yieldDelayMs ?? 0
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(resolve, delay))
    else setTimeout(resolve, delay)
  })
}

function abortMaintenanceIfNeeded(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('已取消生成。', 'AbortError')
}

async function collectShelfPositionCounts(state: ShelfDraftState, signal: AbortSignal): Promise<number[]> {
  const counts: number[] = []
  for (let levelNo = 1; levelNo <= state.levelCount; levelNo += 1) {
    abortMaintenanceIfNeeded(signal)
    counts.push(parseRequiredPositiveInteger(shelfDraftValue(state, levelNo), `第 ${levelNo} 层位置数`))
    if (levelNo % 200 === 0) {
      await yieldMaintenanceWork()
      abortMaintenanceIfNeeded(signal)
    }
  }
  return counts
}

async function estimateMaintenanceAvailableBytes(): Promise<number | undefined> {
  if (maintenanceRuntimeOverrides.resourceEstimate) {
    const values = [
      maintenanceRuntimeOverrides.resourceEstimate.storageAvailableBytes,
      maintenanceRuntimeOverrides.resourceEstimate.heapAvailableBytes,
    ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0)
    return values.length ? Math.min(...values) : undefined
  }
  const values: number[] = []
  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      if (typeof estimate.quota === 'number') values.push(Math.max(0, estimate.quota - (estimate.usage ?? 0)))
    }
  } catch { /* Browser capacity API is optional. */ }
  const memory = (performance as Performance & { memory?: { jsHeapSizeLimit: number; usedJSHeapSize: number } }).memory
  if (memory && Number.isFinite(memory.jsHeapSizeLimit) && Number.isFinite(memory.usedJSHeapSize)) {
    values.push(Math.max(0, memory.jsHeapSizeLimit - memory.usedJSHeapSize))
  }
  return values.length ? Math.min(...values) : undefined
}

async function assertMaintenanceResourceCapacity(snapshot: FactoryWarehouseLayoutSnapshot, totalLocationCount: number, signal: AbortSignal): Promise<void> {
  abortMaintenanceIfNeeded(signal)
  const availableBytes = await estimateMaintenanceAvailableBytes()
  abortMaintenanceIfNeeded(signal)
  if (availableBytes === undefined) return
  const encoder = new TextEncoder()
  const snapshotBytes = encoder.encode(JSON.stringify(snapshot)).byteLength
  const sampleLocationBytes = encoder.encode(JSON.stringify({ locationId: 'SHELF-X-L100-P100', locationNo: 'Z-R100-L100-P100', locationName: 'Z-R100-L100-P100', levelNo: 100, positionNo: 100, status: 'AVAILABLE', remark: '', layoutCreatedInVersion: snapshot.layoutVersion + 1 })).byteLength
  const requiredBytes = snapshotBytes * 3 + sampleLocationBytes * totalLocationCount * 4
  if (!Number.isSafeInteger(requiredBytes) || requiredBytes > availableBytes) throw new RangeError(MAINTENANCE_RESOURCE_LIMIT_MESSAGE)
}

function maintenanceErrorMessage(error: unknown): string {
  if (error instanceof RangeError) return MAINTENANCE_RESOURCE_LIMIT_MESSAGE
  const name = error instanceof DOMException ? error.name : ''
  const message = error instanceof Error ? error.message : ''
  if (name === 'QuotaExceededError' || message === LEGACY_MAINTENANCE_RESOURCE_LIMIT_MESSAGE || /quota|memory|array length|call stack/i.test(message)) return MAINTENANCE_RESOURCE_LIMIT_MESSAGE
  return message || '保存失败，请检查输入后重试。'
}

function setMaintenanceSaving(modal: HTMLElement, saving: boolean): void {
  const operation = maintenanceOperations.get(modal)
  if (operation) operation.saving = saving
  const button = modal.querySelector<HTMLButtonElement>('[data-warehouse-map-action="submit-maintenance"]')
  if (button) {
    button.disabled = saving
    button.textContent = saving ? '正在生成并保存…' : '保存'
    if (saving) button.setAttribute('data-maintenance-saving', 'true')
    else button.removeAttribute('data-maintenance-saving')
  }
  const closeButtons = modal.querySelectorAll<HTMLButtonElement>('[data-warehouse-map-action="close-maintenance-dialog"]')
  closeButtons.forEach((closeButton) => {
    if (closeButton.getAttribute('aria-label')) {
      closeButton.setAttribute('aria-label', saving ? '取消生成' : '关闭维护弹窗')
      closeButton.title = saving ? '取消生成' : '关闭维护弹窗'
    } else {
      closeButton.textContent = saving ? '取消生成' : '取消'
    }
  })
}

export function handleCuttingWarehouseLocationMapEvent(target: HTMLElement, event?: Event): boolean {
  const node = target.closest<HTMLElement>('[data-warehouse-map-action]')
  if (!node) return false
  const modal = node.closest<HTMLElement>('[data-cutting-warehouse-modal]')
  if (modal) {
    const kind = modal.dataset.warehouseKind as CuttingWarehouseMapKind | undefined
    if (!kind) return false
    const action = node.dataset.warehouseMapAction
    if (action === 'close-maintenance-dialog') {
      removeCuttingWarehouseLocationMapModal(modal)
      return true
    }
    if (action === 'change-level-editor-page') {
      const draft = requireShelfDraftState(modal)
      captureVisibleShelfDraftValues(modal, draft)
      const totalPages = Math.max(1, Math.ceil(draft.levelCount / LEVEL_EDITOR_PAGE_SIZE))
      draft.editorPage = movePaginationPage(draft.editorPage, totalPages, node.dataset.levelEditorPage)
      replaceLevelPositionEditor(modal, draft)
      updateMaintenancePreview(modal, kind)
      return true
    }
    if (action === 'change-location-preview-page') {
      if (modal.dataset.maintenanceDialog === 'create-shelf') {
        const draft = requireShelfDraftState(modal)
        const totalCount = parseShelfDraftSummary(draft).totalCount
        const totalPages = Math.max(1, Math.ceil(totalCount / LOCATION_PREVIEW_PAGE_SIZE))
        draft.previewPage = movePaginationPage(draft.previewPage, totalPages, node.dataset.locationPreviewPage)
      } else {
        const preview = modal.querySelector<HTMLElement>('[data-location-number-preview]')
        const currentPage = Number(preview?.dataset.previewPage) || 1
        const summary = preview?.querySelector('span')?.textContent || ''
        const totalPages = Number(summary.match(/\/(\d+) 页/)?.[1]) || 1
        if (preview) preview.dataset.previewPage = String(movePaginationPage(currentPage, totalPages, node.dataset.locationPreviewPage))
      }
      updateMaintenancePreview(modal, kind)
      return true
    }
    if (action === 'submit-maintenance') {
      if (event?.type === 'click' && node instanceof HTMLButtonElement) event.preventDefault()
      const operation = maintenanceOperations.get(modal)
      if (!operation || operation.saving) return true
      const { token, controller } = operation
      const { signal } = controller
      const isActive = () => !signal.aborted
        && modal.isConnected
        && modal.dataset.maintenanceInstanceToken === token
        && maintenanceOperations.get(modal)?.token === token
      const showError = (message: string) => {
        if (!isActive()) return
        const error = modal.querySelector<HTMLElement>('[data-maintenance-error]')
        if (!error) return
        error.textContent = message
        error.classList.remove('hidden')
      }
      setMaintenanceSaving(modal, true)
      void (async () => {
      await yieldMaintenanceWork()
      try {
        abortMaintenanceIfNeeded(signal)
        const current = buildCurrentCuttingWarehouseMapProjection(kind)
        if (!current) throw new Error('当前仓库库位图不可用，请刷新后重试。')
        const expectedVersion = Number(modal.dataset.layoutVersion)
        const occupiedIds = new Set(current.projection.areas.flatMap((area) => area.shelves.flatMap((shelf) => listWarehouseLocationMapShelfCells(shelf))).filter((cell) => cell.businessStatus === 'OCCUPIED').map((cell) => cell.locationId))
        let next = current.snapshot
        const type = modal.dataset.maintenanceDialog
        if (type === 'create-area') {
          next = createWarehouseArea(next, {
            areaId: `AREA-${current.warehouse.warehouseId}-${Date.now()}`,
            code: formValue(modal, 'areaCode').toUpperCase(),
            areaName: formValue(modal, 'areaName'),
            remark: formValue(modal, 'remark'),
            updatedBy: '当前用户',
          })
        } else if (type === 'create-shelf') {
          const draft = requireShelfDraftState(modal)
          const levelCount = parseRequiredPositiveInteger(formValue(modal, 'levelCount'), '层数')
          draft.levelCount = levelCount
          parseRequiredPositiveInteger(formValue(modal, 'defaultPositionCount'), '默认每层位置数')
          const sequence = parseRequiredPositiveInteger(formValue(modal, 'shelfSequence'), '货架序号')
          captureVisibleShelfDraftValues(modal, draft)
          const summary = parseShelfDraftSummary(draft)
          await assertMaintenanceResourceCapacity(current.snapshot, summary.totalCount, signal)
          const positionCounts = await collectShelfPositionCounts(draft, signal)
          next = await createWarehouseShelfInBatches(next, {
            areaId: modal.dataset.areaId || '',
            shelfId: `SHELF-${modal.dataset.areaId}-${Date.now()}`,
            shelfSequence: sequence,
            positionCounts,
            remark: formValue(modal, 'remark'),
            updatedBy: '当前用户',
          }, { yieldControl: yieldMaintenanceWork, signal })
        } else if (type === 'edit-area') {
          next = updateWarehouseArea(next, { areaId: modal.dataset.areaId || '', code: formValue(modal, 'areaCode') || undefined, areaName: formValue(modal, 'areaName') || undefined, enabled: formValue(modal, 'enabled') === 'true', remark: formValue(modal, 'remark'), updatedBy: '当前用户' }, occupiedIds)
        } else if (type === 'edit-shelf') {
          const sequence = parseRequiredPositiveInteger(formValue(modal, 'shelfSequence'), '货架序号')
          next = updateWarehouseShelf(next, { shelfId: modal.dataset.shelfId || '', shelfSequence: sequence, enabled: formValue(modal, 'enabled') === 'true', remark: formValue(modal, 'remark'), updatedBy: '当前用户' }, occupiedIds)
        } else if (type === 'edit-location') {
          const levelNo = parseRequiredPositiveInteger(formValue(modal, 'levelNo'), '层号')
          const positionNo = parseRequiredPositiveInteger(formValue(modal, 'positionNo'), '层内位置号')
          const locationId = modal.dataset.locationId || ''
          next = updateWarehouseLocation(current.snapshot, { locationId, levelNo, positionNo, enabled: formValue(modal, 'enabled') === 'true', remark: formValue(modal, 'remark'), updatedBy: '当前用户' }, occupiedIds)
        }
        await yieldMaintenanceWork()
        abortMaintenanceIfNeeded(signal)
        const saved = saveWarehouseLayoutSnapshot(next, expectedVersion)
        if (!saved.ok) throw new Error(saved.message)
        abortMaintenanceIfNeeded(signal)
        if (!isActive()) return
        removeCuttingWarehouseLocationMapModal(modal)
        refreshMapSection(kind)
      } catch (error) {
        if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return
        showError(maintenanceErrorMessage(error))
        if (isActive()) setMaintenanceSaving(modal, false)
      }
      })()
      return true
    }
    return false
  }
  const section = node.closest<HTMLElement>('[data-cutting-warehouse-map-section]')
  const kind = section?.dataset.warehouseKind as CuttingWarehouseMapKind | undefined
  if (!kind) return false
  const viewportCurrent = buildCurrentCuttingWarehouseMapProjection(kind, { includeDemoOccupancies: getSearchParams().get('demo') === '1' })
  if (viewportCurrent && handleWarehouseLocationMapViewportEvent(node, viewportCurrent.projection)) return true
  const action = node.dataset.warehouseMapAction
  if (action === 'open-create-area') {
    openCuttingWarehouseLocationMapModal(kind, { type: 'create-area' })
    return true
  }
  if (action === 'open-create-shelf') {
    openCuttingWarehouseLocationMapModal(kind, { type: 'create-shelf', areaId: node.dataset.areaId || '' })
    return true
  }
  if (action === 'change-factory' && target instanceof HTMLSelectElement) {
    updateUrlParam('warehouseId', target.value)
    updateUrlParam('factoryId', null)
    updateUrlParam('locationId', null)
    refreshMapSection(kind)
    return true
  }
  if (action === 'enter-maintenance' || action === 'finish-maintenance') {
    updateUrlParam('layout', action === 'enter-maintenance' ? '1' : null)
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
    openCuttingWarehouseLocationMapModal(kind, { type: 'edit-location', locationId: node.dataset.locationId || '' })
    return true
  }
  if (action === 'rename-area') {
    openCuttingWarehouseLocationMapModal(kind, { type: 'edit-area', areaId: node.dataset.areaId || '' })
    return true
  }
  if (action === 'rename-shelf') {
    openCuttingWarehouseLocationMapModal(kind, { type: 'edit-shelf', shelfId: node.dataset.shelfId || '' })
    return true
  }
  return false
}
