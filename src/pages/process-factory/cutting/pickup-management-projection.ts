import type {
  PickupNodeProjection,
  PickupNodeSourceLocation,
  PickupSession,
} from '../../../data/fcs/cutting/pickup-node-domain.ts'
import {
  buildPickupDemandFactsFromProjections,
  type MaterialPrepOrderProjection,
  type MaterialPrepLine,
  type PickupRecord,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import {
  buildPickupDemandFacts,
  derivePickupProcessRoute as deriveSharedPickupProcessRoute,
  resolveNormalProcessResult as resolveSharedNormalProcessResult,
  resolvePickupRequiredQty as resolveSharedPickupRequiredQty,
  type PickupDemandFact,
  type PickupDemandSource,
  type PickupNormalDemandInput,
  type PickupProcessRoute,
} from '../../../data/fcs/cutting/pickup-demand-domain.ts'
import type { PlatformProcessResultView } from '../../../data/fcs/platform-process-result-view.ts'
import type { SupplementRecord } from '../../../data/fcs/cutting/supplement-records.ts'
import { buildPickupRuntimeContext } from '../../../runtime/fcs/cutting/pickup-management-runtime.ts'

export type PickupListKind = 'READY' | 'INCOMPLETE' | 'HISTORY'
export type { PickupDemandSource, PickupProcessRoute }
export type PickupCarrierType = 'WAREHOUSE_LOCATIONS' | 'PALLET'
export type PickupReadySource = 'DIRECT_READY' | 'UPGRADED_FROM_INCOMPLETE'
export type PickupHistoryPath = 'READY_PICKUP' | 'INCOMPLETE_PICKUP'
export type PickupFinalResult = 'ALL_PICKED' | 'NOT_ALL_PICKED' | 'NEW_SUPPLEMENT_WAIT_PICKUP'

export interface PickupMaterialDemandRow {
  rowKey: string
  demandLineId: string
  demandSource: PickupDemandSource
  demandSourceNo: string
  demandSequence: number
  demandCreatedAt: string
  supplementReason: string
  materialSku: string
  materialName: string
  materialImageUrl: string
  materialType: string
  color: string
  spec: string
  unit: string
  processRoute: PickupProcessRoute
  processBasisLabel: string
  processComplete: boolean
  requiredQty: number
  preparedQty: number
  pickedQty: number
  remainingPickupQty: number
  currentAvailableQty: number
  afterCurrentPickupRemainingQty: number
  currentLocations: PickupNodeSourceLocation[]
}

export interface PickupOrderGroup {
  groupKey: string
  productionOrderId: string
  productionOrderNo: string
  prepOrderId: string
  prepOrderNo: string
  styleNo: string
  styleName: string
  spu: string
  listKind: PickupListKind
  materialRows: PickupMaterialDemandRow[]
  carrierType: PickupCarrierType
  palletId: string
  palletDisplayLabel: string
  readySource: PickupReadySource | null
  historyPath: PickupHistoryPath | null
  finalResult: PickupFinalResult | null
  pickupSessionCount: number
  pickupSessions: PickupSession[]
  latestPickerName: string
  latestPickedAt: string
  currentNodeUpdatedAt: string
  currentNodeState: string
  pickupNodeId: string
  pickupNodeVersion: number
}

function roundQty(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : 0
}

export function derivePickupProcessRoute(input: {
  upstreamSourceType?: string
  printRequired?: boolean
  dyeRequired?: boolean
}): PickupProcessRoute {
  return deriveSharedPickupProcessRoute(input)
}

export type ProcessResultCandidate = Pick<
  PlatformProcessResultView,
  'completedObjectQty' | 'qtyUnit' | 'platformStatusCode'
>

export interface PickupProcessResults {
  dyeResults: PlatformProcessResultView[]
  printResults: PlatformProcessResultView[]
}

export function resolvePickupRequiredQty(input: {
  plannedQty: number
  unit: string
  processRoute: PickupProcessRoute
  dyeResult?: ProcessResultCandidate
  printResult?: ProcessResultCandidate
}): { qty: number; basisLabel: string } {
  return resolveSharedPickupRequiredQty(input)
}

export function resolveNormalProcessResult(
  line: MaterialPrepLine,
  productionOrderNo: string,
  processType: 'DYE' | 'PRINT',
  results: PlatformProcessResultView[],
): PlatformProcessResultView | undefined {
  const demand: PickupNormalDemandInput = {
    prepOrderId: line.prepOrderId,
    productionOrderId: '',
    productionOrderNo,
    demandLineId: line.prepLineId,
    demandSourceNo: line.cutOrderNo,
    demandCreatedAt: '',
    materialSku: line.materialSku,
    materialName: line.materialName,
    materialImageUrl: line.materialImageUrl,
    materialType: line.materialType,
    color: line.color,
    spec: line.spec,
    unit: line.unit,
    plannedQty: line.requiredQty,
    pickedQty: roundQty(Math.max(line.pickedQty - line.returnedQty, 0)),
    upstreamSourceType: processType === 'DYE' ? '染色' : '印花',
    upstreamDocumentNo: line.upstreamDocumentNo,
    taskRefs: line.taskLinks.map((task) => ({ taskId: task.taskId, taskNo: task.taskNo })),
  }
  return resolveSharedNormalProcessResult(demand, processType, results).result as
    | PlatformProcessResultView
    | undefined
}

export function buildSupplementMaterialRows(
  records: SupplementRecord[],
  processResults: PickupProcessResults,
  validatedSessionsByProductionOrder: ReadonlyMap<string, ValidatedPickupSession[]> = new Map(),
): Map<string, PickupMaterialDemandRow[]> {
  const rowsByProductionOrder = new Map<string, PickupMaterialDemandRow[]>()
  const pickedFacts = Array.from(validatedSessionsByProductionOrder.entries()).flatMap(
    ([, sessions]) => Array.from(sumValidatedPickedByLineAndUnit(sessions), ([key, effectivePickedQty]) => {
      const [demandLineId, unit] = key.split('\u0000')
      return { demandLineId, unit, effectivePickedQty }
    }),
  )
  const facts = buildPickupDemandFacts({
    normalDemands: [],
    supplementDemands: records.map((record) => ({
      id: record.id,
      recordNo: record.recordNo,
      status: record.status,
      createdAt: record.createdAt,
      productionOrderId: record.draft.productionOrderId,
      productionOrderNo: record.draft.productionOrderNo,
      reason: record.draft.reason,
      reasonDetail: record.draft.reasonDetail,
      processWorkOrderRefs: record.processWorkOrderRefs,
      materialDemands: record.draft.materialDemands,
    })),
    pickedFacts,
    dyeResults: processResults.dyeResults,
    printResults: processResults.printResults,
  })
  for (const fact of facts) {
    const rows = rowsByProductionOrder.get(fact.productionOrderId) ?? []
    rows.push({
      ...buildPickupMaterialDemandRow(fact, null, null, false),
      color: fact.color,
      spec: fact.spec,
    })
    rowsByProductionOrder.set(fact.productionOrderId, rows)
  }
  return rowsByProductionOrder
}

function buildPickupMaterialDemandRow(
  fact: PickupDemandFact,
  projection: MaterialPrepOrderProjection | null,
  activeNode: PickupNodeProjection | null,
  includeCurrentLocations = true,
): PickupMaterialDemandRow {
  const line = projection?.lines.find((candidate) => candidate.prepLineId === fact.demandLineId)
  const nodeItem = activeNode?.items.find((item) =>
    item.prepLineId === fact.demandLineId && item.unit === fact.unit
  )
  return {
    rowKey: '',
    demandLineId: fact.demandLineId,
    demandSource: fact.demandSource,
    demandSourceNo: fact.demandSourceNo,
    demandSequence: fact.demandSequence,
    demandCreatedAt: fact.demandCreatedAt,
    supplementReason: fact.supplementReason,
    materialSku: fact.materialSku,
    materialName: fact.materialName,
    materialImageUrl: fact.materialImageUrl,
    materialType: fact.materialType,
    color: fact.color || nodeItem?.color || '未标注颜色',
    spec: fact.spec || nodeItem?.spec || '未标注规格',
    unit: fact.unit,
    processRoute: fact.processRoute,
    processBasisLabel: fact.processBasisLabel,
    processComplete: fact.processComplete,
    requiredQty: fact.requiredQty,
    preparedQty: roundQty(Math.max(line?.confirmedPrepQty ?? nodeItem?.currentAvailableQty ?? 0, 0)),
    pickedQty: fact.pickedQty,
    remainingPickupQty: roundQty(Math.max(fact.requiredQty - fact.pickedQty, 0)),
    currentAvailableQty: roundQty(Math.max(nodeItem?.currentAvailableQty ?? 0, 0)),
    afterCurrentPickupRemainingQty: roundQty(Math.max(
      fact.requiredQty - fact.pickedQty - (nodeItem?.currentAvailableQty ?? 0),
      0,
    )),
    currentLocations: includeCurrentLocations
      ? nodeItem?.sourceLocations.map((location) => ({
          ...location,
          sourcePrepRecordIds: [...location.sourcePrepRecordIds],
        })) ?? []
      : [],
  }
}

function scopeMaterialRows(
  listKind: PickupListKind,
  productionOrderId: string,
  rows: PickupMaterialDemandRow[],
): PickupMaterialDemandRow[] {
  return rows.map((row) => ({
    ...row,
    rowKey: `${listKind}:${productionOrderId}:${row.demandLineId}`,
  }))
}

function latestSession(sessions: PickupSession[]): PickupSession | null {
  return [...sessions].sort((left, right) =>
    right.pickedAt.localeCompare(left.pickedAt)
    || right.pickupSessionId.localeCompare(left.pickupSessionId)
  )[0] ?? null
}

export function derivePickupHistoryPath(
  nodeTypes: ReadonlyArray<PickupSession['nodeType']>,
): PickupHistoryPath | null {
  if (!nodeTypes.length) return null
  return nodeTypes.some((nodeType) => nodeType === 'INCOMPLETE_PICKABLE')
    ? 'INCOMPLETE_PICKUP'
    : 'READY_PICKUP'
}

function sessionSnapshotIdentityMatches(
  session: PickupSession,
): boolean {
  const snapshot = session.pickupNodeSnapshot
  if (!snapshot) return false
  return snapshot.nodeId === session.pickupNodeId
    && snapshot.version === session.pickupNodeVersion
    && snapshot.nodeType === session.nodeType
    && snapshot.productionOrderId === session.productionOrderId
    && snapshot.prepOrderId === session.prepOrderId
}

export interface ValidatedPickupRecordFact {
  record: PickupRecord
  unit: string | null
}

function closeSessionPickupRecords(
  session: PickupSession,
  pickupRecords: PickupRecord[],
): ValidatedPickupRecordFact[] | null {
  const recordIds = [...session.pickupRecordIds]
  if (!recordIds.length || new Set(recordIds).size !== recordIds.length) return null
  const recordsOwnedBySession = pickupRecords.filter((record) =>
    record.pickupSessionId === session.pickupSessionId
  )
  if (
    recordsOwnedBySession.length !== recordIds.length
    || recordsOwnedBySession.some((record) => !recordIds.includes(record.pickupRecordId))
  ) return null

  const closedFacts: ValidatedPickupRecordFact[] = []
  for (const pickupRecordId of recordIds) {
    const matches = pickupRecords.filter((record) => record.pickupRecordId === pickupRecordId)
    if (matches.length !== 1) return null
    const record = matches[0]
    if (
      record.pickupSessionId !== session.pickupSessionId
      || record.pickupNodeId !== session.pickupNodeId
      || record.productionOrderId !== session.productionOrderId
      || record.prepOrderId !== session.prepOrderId
      || record.pickedAt !== session.pickedAt
      || !record.prepLineId
      || !Number.isFinite(record.pickedQty)
      || record.pickedQty < 0
    ) return null
    if (
      (record.returnQty !== undefined
        && (!Number.isFinite(record.returnQty) || record.returnQty < 0 || record.returnQty > record.pickedQty))
      || (record.waitProcessAvailableQty !== undefined
        && (
          !Number.isFinite(record.waitProcessAvailableQty)
          || record.waitProcessAvailableQty < 0
          || record.waitProcessAvailableQty > record.pickedQty
        ))
      || (
        record.returnQty !== undefined
        && record.waitProcessAvailableQty !== undefined
        && roundQty(record.waitProcessAvailableQty)
          !== roundQty(Math.max(record.pickedQty - record.returnQty, 0))
      )
    ) return null
    const allocations = record.sourceAllocations ?? []
    if (!allocations.length) {
      if (!session.migrationEvidence) return null
      closedFacts.push({ record, unit: null })
      continue
    }
    const units = new Set(allocations.map((allocation) => allocation.unit).filter(Boolean))
    if (
      units.size !== 1
      || allocations.some((allocation) =>
        allocation.prepLineId !== record.prepLineId
        || !allocation.unit
        || !Number.isFinite(allocation.pickedQty)
        || allocation.pickedQty < 0
      )
      || roundQty(allocations.reduce((sum, allocation) => sum + allocation.pickedQty, 0))
        !== roundQty(record.pickedQty)
    ) return null
    closedFacts.push({
      record,
      unit: Array.from(units)[0],
    })
  }
  return closedFacts
}

export interface ValidatedPickupSession {
  session: PickupSession
  recordFacts: ValidatedPickupRecordFact[]
}

function listValidatedPickupSessions(
  matchingProjections: MaterialPrepOrderProjection[],
  productionOrderId: string,
): ValidatedPickupSession[] {
  const prepOrderIds = new Set(
    matchingProjections.map((projection) => projection.order.prepOrderId),
  )
  const pickupRecords = matchingProjections.flatMap((projection) => projection.pickupRecords)
  const sessionsById = new Map<string, PickupSession[]>()
  matchingProjections.flatMap((projection) => projection.pickupSessions).forEach((session) => {
    const sessions = sessionsById.get(session.pickupSessionId) ?? []
    sessions.push(session)
    sessionsById.set(session.pickupSessionId, sessions)
  })

  return Array.from(sessionsById.values()).flatMap((sessions) => {
    if (sessions.length !== 1) return []
    const session = sessions[0]
    if (
      !session.pickupSessionId
      || !session.pickupNodeId
      || !session.pickedAt
      || session.productionOrderId !== productionOrderId
      || !prepOrderIds.has(session.prepOrderId)
    ) return []
    const recordFacts = closeSessionPickupRecords(session, pickupRecords)
    return recordFacts ? [{ session, recordFacts }] : []
  })
}

function effectivePickupRecordQty(record: PickupRecord): number {
  if (Number.isFinite(record.waitProcessAvailableQty)) {
    return roundQty(Math.max(record.waitProcessAvailableQty ?? 0, 0))
  }
  if (Number.isFinite(record.returnQty)) {
    return roundQty(Math.max(record.pickedQty - (record.returnQty ?? 0), 0))
  }
  return roundQty(Math.max(record.pickedQty, 0))
}

function sumValidatedPickedByLineAndUnit(
  validatedSessions: ValidatedPickupSession[],
): Map<string, number> {
  const pickedByLineAndUnit = new Map<string, number>()
  const countedRecordIds = new Set<string>()
  validatedSessions.flatMap(({ recordFacts }) => recordFacts).forEach(({ record, unit }) => {
    if (!unit || countedRecordIds.has(record.pickupRecordId)) return
    countedRecordIds.add(record.pickupRecordId)
    const key = `${record.prepLineId}\u0000${unit}`
    pickedByLineAndUnit.set(
      key,
      roundQty((pickedByLineAndUnit.get(key) ?? 0) + effectivePickupRecordQty(record)),
    )
  })
  return pickedByLineAndUnit
}

function sessionHasReliableAllPickedEvidence(
  candidate: ValidatedPickupSession,
  materialRows: PickupMaterialDemandRow[],
  validatedSessions: ValidatedPickupSession[],
): boolean {
  const candidateSession = candidate.session
  if (
    candidateSession.nodeType !== 'READY_TO_PICKUP'
    || !sessionSnapshotIdentityMatches(candidateSession)
    || candidate.recordFacts.some(({ unit }) => !unit)
  ) return false
  const existingRows = materialRows.filter((row) =>
    Boolean(row.demandCreatedAt)
    && comparePickupDemandEventTime(row.demandCreatedAt, candidateSession.pickedAt) !== 'AFTER'
  )
  if (!existingRows.length) return false

  const cumulativePickedByLineAndUnit = new Map<string, number>()
  validatedSessions
    .filter(({ session }) => session.pickedAt <= candidateSession.pickedAt)
    .flatMap(({ recordFacts }) => recordFacts)
    .forEach(({ record, unit }) => {
      if (!unit) return
      const key = `${record.prepLineId}\u0000${unit}`
      cumulativePickedByLineAndUnit.set(
        key,
        roundQty(
          (cumulativePickedByLineAndUnit.get(key) ?? 0) + effectivePickupRecordQty(record),
        ),
      )
    })
  return existingRows.every((row) =>
    row.processComplete
    && (cumulativePickedByLineAndUnit.get(`${row.demandLineId}\u0000${row.unit}`) ?? 0)
      >= row.requiredQty
  )
}

export type PickupDemandEventTimeOrder = 'BEFORE' | 'AFTER' | 'UNKNOWN'

function parseBusinessEventTimeRange(value: string): { start: number; end: number } | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
  )
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match
  const start = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? 0),
  )
  const date = new Date(start)
  if (
    date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() !== Number(month) - 1
    || date.getUTCDate() !== Number(day)
    || date.getUTCHours() !== Number(hour)
    || date.getUTCMinutes() !== Number(minute)
    || date.getUTCSeconds() !== Number(second ?? 0)
  ) return null
  return {
    start,
    end: start + (second === undefined ? 59_999 : 999),
  }
}

/**
 * 补料与领料域没有共享的单调事件序列，且旧事实可能只有分钟精度。
 * 因此只有两个时间区间完全分离时才能证明先后，重叠一律保守为 UNKNOWN。
 */
export function comparePickupDemandEventTime(
  demandCreatedAt: string,
  pickedAt: string,
): PickupDemandEventTimeOrder {
  const demandRange = parseBusinessEventTimeRange(demandCreatedAt)
  const pickupRange = parseBusinessEventTimeRange(pickedAt)
  if (!demandRange || !pickupRange) return 'UNKNOWN'
  if (demandRange.end < pickupRange.start) return 'BEFORE'
  if (demandRange.start > pickupRange.end) return 'AFTER'
  return 'UNKNOWN'
}

export function deriveLatestAllPickedAt(
  materialRows: PickupMaterialDemandRow[],
  validatedSessions: ValidatedPickupSession[],
): string {
  return validatedSessions
    .filter((candidate) =>
      sessionHasReliableAllPickedEvidence(candidate, materialRows, validatedSessions)
    )
    .sort((left, right) =>
      right.session.pickedAt.localeCompare(left.session.pickedAt)
      || right.session.pickupSessionId.localeCompare(left.session.pickupSessionId)
    )[0]?.session.pickedAt ?? ''
}

export function derivePickupFinalResult(
  materialRows: PickupMaterialDemandRow[],
  validatedSessions: ValidatedPickupSession[],
): PickupFinalResult {
  const latestAllPickedAt = deriveLatestAllPickedAt(materialRows, validatedSessions)
  if (
    latestAllPickedAt
    && materialRows.some((row) =>
      row.demandSource === 'SUPPLEMENT'
      && comparePickupDemandEventTime(row.demandCreatedAt, latestAllPickedAt) === 'AFTER'
      && row.pickedQty < row.requiredQty
    )
  ) return 'NEW_SUPPLEMENT_WAIT_PICKUP'
  return materialRows.every((row) =>
    row.processComplete && row.pickedQty >= row.requiredQty
  )
    ? 'ALL_PICKED'
    : 'NOT_ALL_PICKED'
}

function groupProjectionsByProductionOrder(
  projections: MaterialPrepOrderProjection[],
): Map<string, MaterialPrepOrderProjection[]> {
  const grouped = new Map<string, MaterialPrepOrderProjection[]>()
  projections.forEach((projection) => {
    const existing = grouped.get(projection.order.productionOrderId)
    if (existing) existing.push(projection)
    else grouped.set(projection.order.productionOrderId, [projection])
  })
  return grouped
}

function sortGroups(groups: PickupOrderGroup[]): PickupOrderGroup[] {
  return groups.sort((left, right) =>
    left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN')
    || left.productionOrderId.localeCompare(right.productionOrderId, 'zh-CN')
  )
}

export interface PickupOrderGroupProjectionInput {
  listKind: PickupListKind
  projections: MaterialPrepOrderProjection[]
  activeNodes: PickupNodeProjection[]
  supplementRecords: SupplementRecord[]
  processResults: PickupProcessResults
}

export function buildPickupOrderGroups(
  input: PickupOrderGroupProjectionInput,
): PickupOrderGroup[] {
  const {
    listKind,
    projections,
    activeNodes,
    supplementRecords,
    processResults,
  } = input
  const projectionsByProductionOrder = groupProjectionsByProductionOrder(projections)
  const demandFacts = buildPickupDemandFactsFromProjections({
    projections,
    supplementRecords,
    dyeResults: processResults.dyeResults,
    printResults: processResults.printResults,
  })
  const validatedSessionsByProductionOrder = new Map<string, ValidatedPickupSession[]>()
  projectionsByProductionOrder.forEach((matchingProjections, productionOrderId) => {
    validatedSessionsByProductionOrder.set(
      productionOrderId,
      listValidatedPickupSessions(matchingProjections, productionOrderId),
    )
  })
  if (listKind !== 'HISTORY') {
    const expectedNodeType = listKind === 'READY' ? 'READY_TO_PICKUP' : 'INCOMPLETE_PICKABLE'
    const groups = activeNodes
      .filter((node) => node.nodeType === expectedNodeType)
      .flatMap((node): PickupOrderGroup[] => {
        const matchingProjections = projectionsByProductionOrder.get(node.productionOrderId) ?? []
        const projection = matchingProjections.find((row) => row.order.prepOrderId === node.prepOrderId)
        if (!projection) return []
        const validatedSessions = validatedSessionsByProductionOrder.get(node.productionOrderId) ?? []
        const sessions = validatedSessions.map(({ session }) => session)
        const latest = latestSession(sessions)
        return [{
          groupKey: `${listKind}:${node.productionOrderId}`,
          productionOrderId: node.productionOrderId,
          productionOrderNo: node.productionOrderNo,
          prepOrderId: node.prepOrderId,
          prepOrderNo: node.prepOrderNo,
          styleNo: projection.order.styleNo,
          styleName: projection.order.styleName,
          spu: projection.order.spu,
          listKind,
          materialRows: scopeMaterialRows(
            listKind,
            node.productionOrderId,
            demandFacts
              .filter((fact) => fact.productionOrderId === node.productionOrderId)
              .map((fact) => buildPickupMaterialDemandRow(
                fact,
                projection,
                node,
                node.carrierType === 'WAREHOUSE_LOCATIONS',
              )),
          ),
          carrierType: node.carrierType,
          palletId: node.palletId,
          palletDisplayLabel: node.palletDisplayLabel,
          readySource: node.readySource,
          historyPath: null,
          finalResult: null,
          pickupSessionCount: sessions.length,
          pickupSessions: sessions,
          latestPickerName: latest?.receiverName ?? '',
          latestPickedAt: latest?.pickedAt ?? '',
          currentNodeUpdatedAt: node.updatedAt,
          currentNodeState: node.nodeType === 'READY_TO_PICKUP' ? '已配齐待领' : '未配齐可领',
          pickupNodeId: node.nodeId,
          pickupNodeVersion: node.version,
        }]
      })
    return sortGroups(Array.from(
      new Map(groups.map((group) => [group.productionOrderId, group])).values(),
    ))
  }

  const activeNodeByProductionOrder = new Map(
    activeNodes.map((node) => [node.productionOrderId, node]),
  )
  const historyGroups: PickupOrderGroup[] = []
  projectionsByProductionOrder.forEach((matchingProjections, productionOrderId) => {
    const validatedSessions = validatedSessionsByProductionOrder.get(productionOrderId) ?? []
    if (!validatedSessions.length) return
    const sessions = validatedSessions.map(({ session }) => session)
    const latest = latestSession(sessions)
    if (!latest) return
    const firstProjection = matchingProjections[0]
    const activeNode = activeNodeByProductionOrder.get(productionOrderId) ?? null
    const carrierType = activeNode?.carrierType
      ?? latest.pickupNodeSnapshot?.carrierType
      ?? (latest.nodeType === 'READY_TO_PICKUP' ? 'PALLET' : 'WAREHOUSE_LOCATIONS')
    const materialRows = scopeMaterialRows(
      listKind,
      productionOrderId,
      demandFacts
        .filter((fact) => fact.productionOrderId === productionOrderId)
        .map((fact) => buildPickupMaterialDemandRow(
          fact,
          matchingProjections.find((projection) =>
            projection.order.prepOrderId === fact.prepOrderId
          ) ?? firstProjection,
          activeNode,
          Boolean(activeNode && activeNode.carrierType === 'WAREHOUSE_LOCATIONS'),
        )),
    )
    historyGroups.push({
      groupKey: `${listKind}:${productionOrderId}`,
      productionOrderId,
      productionOrderNo: firstProjection.order.productionOrderNo,
      prepOrderId: firstProjection.order.prepOrderId,
      prepOrderNo: firstProjection.order.prepOrderNo,
      styleNo: firstProjection.order.styleNo,
      styleName: firstProjection.order.styleName,
      spu: firstProjection.order.spu,
      listKind,
      materialRows,
      carrierType,
      palletId: activeNode?.palletId ?? latest.pickupNodeSnapshot?.palletId ?? '',
      palletDisplayLabel: activeNode?.palletDisplayLabel
        ?? latest.pickupNodeSnapshot?.palletDisplayLabel
        ?? (latest.nodeType === 'READY_TO_PICKUP' ? '待领托盘（暂未编号）' : ''),
      readySource: activeNode
        ? activeNode.readySource
        : latest.pickupNodeSnapshot?.readySource ?? null,
      historyPath: derivePickupHistoryPath(sessions.map((session) => session.nodeType)),
      finalResult: derivePickupFinalResult(materialRows, validatedSessions),
      pickupSessionCount: sessions.length,
      pickupSessions: sessions,
      latestPickerName: latest.receiverName,
      latestPickedAt: latest.pickedAt,
      currentNodeUpdatedAt: activeNode?.updatedAt ?? '',
      currentNodeState: activeNode
        ? activeNode.nodeType === 'READY_TO_PICKUP' ? '当前已配齐待领' : '当前未配齐可领'
        : '当前无待领节点',
      pickupNodeId: activeNode?.nodeId ?? '',
      pickupNodeVersion: activeNode?.version ?? 0,
    })
  })
  return sortGroups(historyGroups)
}

export function listPickupOrderGroups(
  listKind: PickupListKind,
  storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage,
): PickupOrderGroup[] {
  const context = buildPickupRuntimeContext(storage)
  return buildPickupOrderGroups({
    listKind,
    projections: context.projections,
    activeNodes: context.activeNodes,
    supplementRecords: context.supplementRecords,
    processResults: {
      dyeResults: context.dyeResults,
      printResults: context.printResults,
    },
  })
}
