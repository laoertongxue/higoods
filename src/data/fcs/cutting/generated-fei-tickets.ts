import {
  getProductionOrderTechPackSnapshot,
} from '../production-orders.ts'
import {
  listGeneratedCutOrderSourceRecords,
  type GeneratedCutOrderPieceRow,
  type GeneratedCutOrderSkuScopeLine,
  type GeneratedCutOrderSourceRecord,
} from './generated-cut-orders.ts'
import { encodeFeiTicketQr } from './qr-codes.ts'
import type { FeiTicketQrPayload } from './qr-payload.ts'
import {
  createEmptyStore,
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  deserializeMarkerSpreadingStorage,
  type MarkerSpreadingStore,
  type SpreadingSession,
} from '../../../pages/process-factory/cutting/marker-spreading-model.ts'

export interface SpreadingPieceOutputLine {
  outputLineId: string
  spreadingSessionId: string
  sourceSpreadingSessionNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  sourceMarkerLineItemId: string
  cutOrderId: string
  cutOrderNo: string
  markerPlanId?: string
  markerPlanNo?: string
  productionOrderId: string
  productionOrderNo: string
  fabricRollId: string
  fabricRollNo: string
  fabricColor: string
  materialSku: string
  garmentSkuId: string
  garmentColor: string
  sizeCode: string
  partCode: string
  partName: string
  pieceCountPerGarment: number
  bundleNo: string
  bundleQty: number
  pieceSetNoStart: number
  pieceSetNoEnd: number
  pieceSetNoRange: string
  bundleTicketType: string
  layerCount: number
  actualCutPieceQty: number
  actualCutGarmentQty: number
  sourceBasisType: 'SPREADING_RESULT'
  createdBy: string
  createdAt: string
}

export interface GeneratedFeiTicketSourceRecord {
  feiTicketId: string
  feiTicketNo: string
  sourceOutputLineId: string
  sourceSpreadingSessionId: string
  sourceSpreadingSessionNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  sourceMarkerPlanId: string
  sourceMarkerPlanNo: string
  fabricRollId: string
  fabricRollNo: string
  fabricColor: string
  materialSku: string
  garmentSkuId: string
  garmentColor: string
  pieceScope: string[]
  pieceGroup: string
  bundleScope: string
  skuCode: string
  skuColor: string
  skuSize: string
  partCode: string
  partName: string
  bundleNo: string
  bundleQty: number
  pieceSetNoStart: number
  pieceSetNoEnd: number
  pieceSetNoRange: string
  bundleTicketType: string
  actualCutPieceQty: number
  printStatus: 'WAIT_PRINT' | 'PRINTED' | 'REPRINTED' | 'VOIDED'
  qty: number
  garmentQty: number
  sourceTraceCompleteness: 'COMPLETE'
  secondaryCrafts: string[]
  craftSequenceVersion: string
  currentCraftStage: string
  sourceTechPackSpuCode: string
  sourceBasisType: 'SPREADING_RESULT'
  issuedAt: string
  qrPayload: FeiTicketQrPayload
  qrValue: string
}

export interface GeneratedFeiTicketTraceMatrixRow {
  feiTicketId: string
  feiTicketNo: string
  sourceOutputLineId: string
  sourceSpreadingSessionId: string
  sourceSpreadingSessionNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  sourceMarkerPlanId: string
  sourceMarkerPlanNo: string
  cutOrderId: string
  cutOrderNo: string
  fabricRollNo: string
  fabricColor: string
  materialSku: string
  color: string
  size: string
  partName: string
  bundleNo: string
  bundleQty: number
  pieceSetNoStart: number
  pieceSetNoEnd: number
  pieceSetNoRange: string
  bundleTicketType: string
  garmentQty: number
  sourceBasisType: 'SPREADING_RESULT'
  sourceTraceCompleteness: 'COMPLETE'
  sourceWritebackId: string
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim()
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeBusinessText(value: string | null | undefined, defaultText: string): string {
  return normalizeText(value) || defaultText
}

function formatPieceSetRange(start: number, end: number): string {
  const safeStart = Math.max(Math.floor(start || 1), 1)
  const safeEnd = Math.max(Math.floor(end || safeStart), safeStart)
  return safeStart === safeEnd ? String(safeStart) : `${safeStart}-${safeEnd}`
}

function compareFeiRecords(left: GeneratedFeiTicketSourceRecord, right: GeneratedFeiTicketSourceRecord): number {
  const orderCompare = left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
  if (orderCompare !== 0) return orderCompare
  const sessionCompare = left.sourceSpreadingSessionNo.localeCompare(right.sourceSpreadingSessionNo, 'zh-CN')
  if (sessionCompare !== 0) return sessionCompare
  return left.feiTicketNo.localeCompare(right.feiTicketNo, 'zh-CN')
}

function compareOutputLines(left: SpreadingPieceOutputLine, right: SpreadingPieceOutputLine): number {
  return (
    left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
    || left.fabricRollNo.localeCompare(right.fabricRollNo, 'zh-CN')
    || left.fabricColor.localeCompare(right.fabricColor, 'zh-CN')
    || left.sizeCode.localeCompare(right.sizeCode, 'zh-CN')
    || left.bundleNo.localeCompare(right.bundleNo, 'zh-CN')
    || left.partName.localeCompare(right.partName, 'zh-CN')
  )
}

function resolveSecondaryCrafts(productionOrderId: string): {
  secondaryCrafts: string[]
  craftSequenceVersion: string
} {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  const processEntries = snapshot?.processEntries || []
  const secondaryCrafts = unique(
    processEntries
      .filter((entry) => entry.isSpecialCraft)
      .map((entry) => normalizeText(entry.craftName) || normalizeText(entry.processName))
      .filter(Boolean),
  )

  return {
    secondaryCrafts,
    craftSequenceVersion: `${normalizeText(snapshot?.sourceTechPackVersionLabel) || 'v0'}:${secondaryCrafts.length || 0}`,
  }
}

function buildFallbackSkuScope(record: GeneratedCutOrderSourceRecord): GeneratedCutOrderSkuScopeLine[] {
  if (record.skuScopeLines.length) return record.skuScopeLines
  return [
    {
      skuCode: record.cutOrderNo,
      color: record.colorScope[0] || '待补颜色',
      size: '均码',
      plannedQty: Math.max(record.requiredQty, 1),
    },
  ]
}

function buildFallbackPieceRows(record: GeneratedCutOrderSourceRecord): GeneratedCutOrderPieceRow[] {
  if (record.pieceRows.length) return record.pieceRows
  return [
    {
      partCode: record.materialSku,
      partName: record.pieceSummary || '整单裁片',
      pieceCountPerUnit: 1,
      patternId: '',
      patternName: '',
      applicableSkuCodes: [],
    },
  ]
}

function buildFeiTicketNo(cutOrderNo: string, sequenceNo: number): string {
  return `FT-${cutOrderNo}-${String(sequenceNo).padStart(3, '0')}`
}

function normalizePositiveInteger(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(Math.round(value), 0)
}

function hasActualCutOutput(session: SpreadingSession): boolean {
  const sessionActual = normalizePositiveInteger((session.actualCutGarmentQty ?? session.actualCutPieceQty) || 0)
  if (sessionActual > 0) return true
  return (session.rolls || []).some((roll) =>
    normalizePositiveInteger((roll.actualCutGarmentQty ?? roll.actualCutPieceQty) || 0) > 0 ||
    normalizePositiveInteger(roll.layerCount || 0) > 0,
  )
}

function isReadyForFeiGeneration(session: SpreadingSession): boolean {
  if (session.status !== 'DONE') return false
  if (session.cuttingStatus !== 'CUTTING_DONE') return false
  if (!hasActualCutOutput(session)) return false
  const warning = session.replenishmentWarning
  if (!warning) return true
  if (warning.suggestedAction === '无需补料') return true
  return Boolean(warning.handled)
}

function resolveSourceRecordForLine(
  sourceRecords: GeneratedCutOrderSourceRecord[],
  line: {
    cutOrderId: string
    materialSku: string
  },
): GeneratedCutOrderSourceRecord | null {
  return (
    sourceRecords.find(
      (record) =>
        record.cutOrderId === line.cutOrderId &&
        normalizeText(record.materialSku) === normalizeText(line.materialSku),
    ) ||
    sourceRecords.find((record) => record.cutOrderId === line.cutOrderId) ||
    null
  )
}

function resolveColorScopedSkuLines(
  sourceRecord: GeneratedCutOrderSourceRecord,
  color: string,
): GeneratedCutOrderSkuScopeLine[] {
  const scoped = buildFallbackSkuScope(sourceRecord).filter((line) => normalizeText(line.color) === normalizeText(color))
  return scoped.length ? scoped : buildFallbackSkuScope(sourceRecord)
}

function splitGarmentQtyBySize(
  skuScopeLines: GeneratedCutOrderSkuScopeLine[],
  targetGarmentQty: number,
): Array<{ skuCode: string; color: string; size: string; garmentQty: number }> {
  const normalizedTarget = normalizePositiveInteger(targetGarmentQty)
  if (!normalizedTarget) return []

  const normalizedLines = (skuScopeLines.length ? skuScopeLines : buildFallbackSkuScope({
    cutOrderId: '',
    cutOrderNo: '',
    productionOrderId: '',
    productionOrderNo: '',
    materialSku: '',
    colorScope: ['待补颜色'],
    skuScopeLines: [],
    pieceRows: [],
    requiredQty: normalizedTarget,
    pieceSummary: '',
    sourceTechPackSpuCode: '',
  } as GeneratedCutOrderSourceRecord)).map((line, index) => ({
    skuCode: normalizeText(line.skuCode) || `SKU-${index + 1}`,
    color: normalizeText(line.color) || '待补颜色',
    size: normalizeText(line.size) || '均码',
    plannedQty: Math.max(Number(line.plannedQty || 0), 0),
  }))

  const plannedTotal = normalizedLines.reduce((sum, line) => sum + line.plannedQty, 0)
  if (plannedTotal <= 0) {
    return [
      {
        skuCode: normalizedLines[0]?.skuCode || 'SKU-001',
        color: normalizedLines[0]?.color || '待补颜色',
        size: normalizedLines[0]?.size || '均码',
        garmentQty: normalizedTarget,
      },
    ]
  }

  const rawRows = normalizedLines.map((line, index) => {
    const rawQty = (line.plannedQty / plannedTotal) * normalizedTarget
    const floorQty = Math.floor(rawQty)
    return {
      index,
      skuCode: line.skuCode,
      color: line.color,
      size: line.size,
      floorQty,
      fraction: rawQty - floorQty,
    }
  })

  let remainder = normalizedTarget - rawRows.reduce((sum, row) => sum + row.floorQty, 0)
  rawRows
    .slice()
    .sort((left, right) => right.fraction - left.fraction || right.floorQty - left.floorQty || left.index - right.index)
    .forEach((row) => {
      if (remainder <= 0) return
      rawRows[row.index] = {
        ...rawRows[row.index],
        floorQty: rawRows[row.index].floorQty + 1,
      }
      remainder -= 1
    })

  return rawRows
    .filter((row) => row.floorQty > 0)
    .map((row) => ({
      skuCode: row.skuCode,
      color: row.color,
      size: row.size,
      garmentQty: row.floorQty,
    }))
}

function buildBundleNo(index: number): string {
  return `BUNDLE-${String(index + 1).padStart(3, '0')}`
}

function readStoredMarkerSpreadingStore(): MarkerSpreadingStore {
  const storage = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
    ? localStorage
    : null
  if (!storage) return createEmptyStore()
  const raw = storage.getItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY)
  if (!raw) return createEmptyStore()
  try {
    return deserializeMarkerSpreadingStorage(raw)
  } catch {
    return createEmptyStore()
  }
}

function buildCompletedSpreadingSeedStore(sourceRecords: GeneratedCutOrderSourceRecord[]): MarkerSpreadingStore {
  const seedRecords = ['CUT-260307-102-01', 'CUT-260307-102-02']
    .map((cutOrderId) => sourceRecords.find((record) => record.cutOrderId === cutOrderId))
    .filter((record): record is GeneratedCutOrderSourceRecord => Boolean(record))
  if (!seedRecords.length) return createEmptyStore()

  const sessionId = 'spreading-session-marker-plan-ref-marker-plan-ref-mb-030102-02-planned-100-actual-80-c'
  const sessionNo = 'PB-2440'
  const markerPlanId = seedRecords[0]?.markerPlanId || 'marker-plan-ref:MB-030102-02'
  const markerPlanNo = seedRecords[0]?.markerPlanNo || 'MB-030102-02'
  const completedAt = '2026-03-14 20:00'
  const actualCutQuantities = [557, 613]
  const rolls = seedRecords.map((record, index) => {
    const color = record.colorScope[0] || (index === 0 ? 'Navy' : 'Khaki')
    const layerCount = index === 0 ? 50 : 30
    return {
      rollRecordId: `roll-step12-${record.cutOrderId}`,
      rollNo: `ROLL-STEP12-${index + 1}`,
      materialSku: record.materialSku,
      color,
      planUnitId: `plan-unit-step12-${record.cutOrderId}`,
      layerCount,
      actualCutGarmentQty: actualCutQuantities[index] || 0,
      actualCutPieceQty: actualCutQuantities[index] || 0,
      actualLength: index === 0 ? 35 : 31,
    }
  })
  const session = {
    spreadingSessionId: sessionId,
    sessionNo,
    status: 'DONE',
    cuttingStatus: 'CUTTING_DONE',
    cutOrderIds: seedRecords.map((record) => record.cutOrderId),
    cutOrderNos: seedRecords.map((record) => record.cutOrderNo),
    contextType: 'marker-plan-ref',
    markerPlanId,
    markerPlanNo,
    sourceMarkerId: 'seed-marker-marker-plan-ref-marker-plan-ref:MB-030102-02',
    sourceMarkerNo: 'A-1',
    markerId: 'seed-marker-marker-plan-ref-marker-plan-ref:MB-030102-02',
    markerNo: 'A-1',
    plannedLayers: 100,
    actualLayers: 80,
    actualCutPieceQty: actualCutQuantities.reduce((sum, value) => sum + value, 0),
    actualCutGarmentQty: actualCutQuantities.reduce((sum, value) => sum + value, 0),
    planUnits: seedRecords.map((record, index) => ({
      planUnitId: `plan-unit-step12-${record.cutOrderId}`,
      materialSku: record.materialSku,
      color: record.colorScope[0] || '',
      garmentQtyPerUnit: index === 0 ? 18 : 9,
      plannedRepeatCount: 100,
      plannedCutGarmentQty: index === 0 ? 1800 : 900,
    })),
    rolls,
    completionLinkage: {
      linkedCutOrderIds: seedRecords.map((record) => record.cutOrderId),
      linkedCutOrderNos: seedRecords.map((record) => record.cutOrderNo),
      completedAt,
      completedBy: '现场主管',
      generatedWarning: false,
    },
    replenishmentWarning: {
      warningId: `warning-${sessionId}`,
      spreadingSessionId: sessionId,
      sessionNo,
      cutOrderNos: seedRecords.map((record) => record.cutOrderNo),
      productionOrderNos: unique(seedRecords.map((record) => record.productionOrderNo)),
      materialSku: seedRecords.map((record) => record.materialSku).join(' / '),
      materialAttr: '',
      requiredQty: 0,
      actualCutQty: actualCutQuantities.reduce((sum, value) => sum + value, 0),
      actualCutGarmentQty: actualCutQuantities.reduce((sum, value) => sum + value, 0),
      shortageQty: 0,
      varianceLength: 0,
      warningLevel: '低',
      suggestedAction: '无需补料',
      handled: true,
      lines: seedRecords.map((record, index) => ({
        lineId: `spread-warning-line-step12-${index + 1}`,
        cutOrderId: record.cutOrderId,
        cutOrderNo: record.cutOrderNo,
        materialSku: record.materialSku,
        color: record.colorScope[0] || '',
        actualCutGarmentQty: actualCutQuantities[index] || 0,
      })),
      createdAt: completedAt,
      note: 'prototype：计划 100 层，按实际实铺 80 层完成裁剪。',
    },
    completedAt,
    completedBy: '现场主管',
    updatedAt: completedAt,
    updatedBy: '现场主管',
  } as unknown as SpreadingSession

  return {
    markers: [],
    sessions: [session],
  }
}

function readMarkerSpreadingStoreForFeiTickets(sourceRecords: GeneratedCutOrderSourceRecord[]): MarkerSpreadingStore {
  const store = readStoredMarkerSpreadingStore()
  const prototypeStore = buildCompletedSpreadingSeedStore(sourceRecords)
  const markersById = new Map<string, MarkerSpreadingStore['markers'][number]>()
  prototypeStore.markers.forEach((marker) => markersById.set(marker.markerId, marker))
  store.markers.forEach((marker) => markersById.set(marker.markerId, marker))

  const sessionsById = new Map<string, SpreadingSession>()
  prototypeStore.sessions.forEach((session) => sessionsById.set(session.spreadingSessionId, session))
  store.sessions.forEach((session) => sessionsById.set(session.spreadingSessionId, session))

  return {
    markers: Array.from(markersById.values()),
    sessions: Array.from(sessionsById.values()),
  }
}

type SpreadingOutputSourceLine = {
  cutOrderId: string
  cutOrderNo?: string
  materialSku: string
  color: string
  actualCutGarmentQty: number
  rollRecordId?: string
}

function findPieceRowsForSku(
  sourceRecord: GeneratedCutOrderSourceRecord,
  skuCode: string,
): GeneratedCutOrderPieceRow[] {
  const pieceRows = buildFallbackPieceRows(sourceRecord)
  const matched = pieceRows.filter((pieceRow) => {
    if (!pieceRow.applicableSkuCodes.length) return true
    return pieceRow.applicableSkuCodes.includes(skuCode)
  })
  return matched.length ? matched : pieceRows
}

function listSessionSourceRecords(
  session: SpreadingSession,
  sourceRecords: GeneratedCutOrderSourceRecord[],
): GeneratedCutOrderSourceRecord[] {
  const cutOrderIds = new Set([
    ...(session.cutOrderIds || []),
    ...(session.completionLinkage?.linkedCutOrderIds || []),
  ].map(normalizeText).filter(Boolean))
  const cutOrderNos = new Set((session.completionLinkage?.linkedCutOrderNos || []).map(normalizeText).filter(Boolean))

  const matched = sourceRecords.filter((record) =>
    cutOrderIds.has(record.cutOrderId) ||
    cutOrderNos.has(record.cutOrderNo),
  )
  if (matched.length) return matched

  const sessionMaterialSkus = new Set([
    ...(session.planUnits || []).map((unit) => unit.materialSku),
    ...(session.rolls || []).map((roll) => roll.materialSku),
    session.materialSkuSummary || '',
  ].map(normalizeText).filter(Boolean))
  const sessionColors = new Set([
    ...(session.planUnits || []).map((unit) => unit.color),
    ...(session.rolls || []).map((roll) => roll.color || ''),
    ...(session.colorSummary || '').split('/'),
  ].map(normalizeText).filter(Boolean))

  return sourceRecords.filter((record) => {
    const materialMatched = sessionMaterialSkus.has(normalizeText(record.materialSku))
    const colorMatched = record.colorScope.some((color) => sessionColors.has(normalizeText(color)))
    return materialMatched && colorMatched
  })
}

function findSourceRecordForRoll(
  session: SpreadingSession,
  sourceRecords: GeneratedCutOrderSourceRecord[],
  roll: SpreadingSession['rolls'][number],
): GeneratedCutOrderSourceRecord | null {
  const candidates = listSessionSourceRecords(session, sourceRecords)
  if (!candidates.length) return null

  const rollMaterialSku = normalizeText(roll.materialSku)
  const rollColor = normalizeText(roll.color || '')
  return (
    candidates.find(
      (record) =>
        normalizeText(record.materialSku) === rollMaterialSku &&
        record.colorScope.some((color) => normalizeText(color) === rollColor),
    ) ||
    candidates.find((record) => normalizeText(record.materialSku) === rollMaterialSku) ||
    candidates.find((record) => record.colorScope.some((color) => normalizeText(color) === rollColor)) ||
    candidates[0] ||
    null
  )
}

function deriveRollActualGarmentQty(session: SpreadingSession, roll: SpreadingSession['rolls'][number]): number {
  const explicitQty = normalizePositiveInteger((roll.actualCutGarmentQty ?? roll.actualCutPieceQty) || 0)
  if (explicitQty > 0) return explicitQty
  const planUnit = (session.planUnits || []).find((unit) => unit.planUnitId === roll.planUnitId) || session.planUnits?.[0] || null
  return normalizePositiveInteger(Number(roll.layerCount || 0) * Number(planUnit?.garmentQtyPerUnit || 0))
}

function buildFallbackOutputSourceLines(
  session: SpreadingSession,
  sourceRecords: GeneratedCutOrderSourceRecord[],
): SpreadingOutputSourceLine[] {
  return (session.rolls || [])
    .map((roll) => {
      const sourceRecord = findSourceRecordForRoll(session, sourceRecords, roll)
      const actualCutGarmentQty = deriveRollActualGarmentQty(session, roll)
      if (!sourceRecord || !actualCutGarmentQty) return null
      return {
        cutOrderId: sourceRecord.cutOrderId,
        cutOrderNo: sourceRecord.cutOrderNo,
        materialSku: normalizeText(roll.materialSku) || sourceRecord.materialSku,
        color: normalizeText(roll.color || '') || sourceRecord.colorScope[0] || '待补颜色',
        actualCutGarmentQty,
        rollRecordId: roll.rollRecordId,
      }
    })
    .filter((line): line is SpreadingOutputSourceLine => Boolean(line))
}

function listOutputSourceLinesForSession(
  session: SpreadingSession,
  sourceRecords: GeneratedCutOrderSourceRecord[],
): SpreadingOutputSourceLine[] {
  const warningLines = (session.replenishmentWarning?.lines || [])
    .map((line) => ({
      cutOrderId: line.cutOrderId,
      cutOrderNo: line.cutOrderNo,
      materialSku: line.materialSku,
      color: line.color,
      actualCutGarmentQty: normalizePositiveInteger(line.actualCutGarmentQty || 0),
    }))
    .filter((line) => line.actualCutGarmentQty > 0)
  return warningLines.length ? warningLines : buildFallbackOutputSourceLines(session, sourceRecords)
}

function buildSpreadingPieceOutputLinesFromSessions(
  sourceRecords: GeneratedCutOrderSourceRecord[],
): SpreadingPieceOutputLine[] {
  const store = readMarkerSpreadingStoreForFeiTickets(sourceRecords)
  const outputLines: SpreadingPieceOutputLine[] = []

  store.sessions
    .filter(isReadyForFeiGeneration)
    .forEach((session) => {
      const outputSourceLines = listOutputSourceLinesForSession(session, sourceRecords)
      outputSourceLines.forEach((line, lineIndex) => {
        const sourceRecord = resolveSourceRecordForLine(sourceRecords, line)
        const roll =
          (line.rollRecordId ? session.rolls.find((item) => item.rollRecordId === line.rollRecordId) : null) ||
          session.rolls.find(
            (item) =>
              normalizeText(item.materialSku) === normalizeText(line.materialSku)
              && normalizeText(item.color) === normalizeText(line.color),
          ) || session.rolls[0] || null
        if (!sourceRecord || !roll) return

        const splitRows = splitGarmentQtyBySize(resolveColorScopedSkuLines(sourceRecord, line.color), line.actualCutGarmentQty)
        splitRows.forEach((sizeRow, sizeIndex) => {
          const bundleNo = buildBundleNo(sizeIndex)
          const pieceSetNoStart = 1
          const pieceSetNoEnd = Math.max(sizeRow.garmentQty, 1)
          const pieceSetNoRange = formatPieceSetRange(pieceSetNoStart, pieceSetNoEnd)
          findPieceRowsForSku(sourceRecord, sizeRow.skuCode).forEach((pieceRow, partIndex) => {
            outputLines.push({
              outputLineId: [
                session.spreadingSessionId,
                normalizeText(roll.rollRecordId) || `roll-${lineIndex + 1}`,
                normalizeText(sizeRow.size) || `size-${sizeIndex + 1}`,
                normalizeText(pieceRow.partCode) || `part-${partIndex + 1}`,
                bundleNo,
              ].join('__'),
              spreadingSessionId: session.spreadingSessionId,
              sourceSpreadingSessionNo: session.sessionNo || session.spreadingSessionId,
              sourceMarkerId: session.sourceMarkerId || session.markerId || '',
              sourceMarkerNo: session.sourceMarkerNo || session.markerNo || session.sourceBedNo || session.sourceSchemeNo || session.markerId || '',
              sourceMarkerLineItemId: `${session.spreadingSessionId}-${lineIndex + 1}`,
              cutOrderId: sourceRecord.cutOrderId,
              cutOrderNo: sourceRecord.cutOrderNo,
              markerPlanId: session.markerPlanId || sourceRecord.markerPlanId || '',
              markerPlanNo: session.markerPlanNo || sourceRecord.markerPlanNo || '',
              productionOrderId: sourceRecord.productionOrderId,
              productionOrderNo: sourceRecord.productionOrderNo,
              fabricRollId: roll.rollRecordId,
              fabricRollNo: normalizeBusinessText(roll.rollNo, '待补卷号'),
              fabricColor: normalizeBusinessText(line.color || roll.color, '待补颜色'),
              materialSku: normalizeBusinessText(line.materialSku, sourceRecord.materialSku),
              garmentSkuId: normalizeBusinessText(sizeRow.skuCode, sourceRecord.cutOrderNo),
              garmentColor: normalizeBusinessText(sizeRow.color, line.color || roll.color || '待补颜色'),
              sizeCode: normalizeBusinessText(sizeRow.size, '均码'),
              partCode: normalizeBusinessText(pieceRow.partCode, pieceRow.partName),
              partName: normalizeBusinessText(pieceRow.partName, '整单裁片'),
              pieceCountPerGarment: Math.max(Number(pieceRow.pieceCountPerUnit || 0), 1),
              bundleNo,
              bundleQty: Math.max(sizeRow.garmentQty, 1),
              pieceSetNoStart,
              pieceSetNoEnd,
              pieceSetNoRange,
              bundleTicketType: '扎束菲票',
              layerCount: Math.max(Number(roll.layerCount || 0), 1),
              actualCutPieceQty: Math.max(sizeRow.garmentQty, 1) * Math.max(Number(pieceRow.pieceCountPerUnit || 0), 1),
              actualCutGarmentQty: Math.max(sizeRow.garmentQty, 1),
              sourceBasisType: 'SPREADING_RESULT',
              createdBy: session.completedBy || session.updatedBy || '裁床组长',
              createdAt: session.completedAt || session.updatedAt || '',
            })
          })
        })
      })
    })

  return outputLines
}

function buildFeiRecordsFromSpreadingSessions(
  sourceRecords: GeneratedCutOrderSourceRecord[],
): GeneratedFeiTicketSourceRecord[] {
  const outputLines = listSpreadingPieceOutputLines(sourceRecords)
  const secondaryCraftMetaByProductionOrderId = new Map<string, ReturnType<typeof resolveSecondaryCrafts>>()

  const records = outputLines.map((line, index) => {
    const sourceRecord =
      sourceRecords.find((item) => item.cutOrderId === line.cutOrderId && item.productionOrderId === line.productionOrderId)
      || sourceRecords.find((item) => item.cutOrderId === line.cutOrderId)
      || null
    const sourceTechPackSpuCode = sourceRecord?.sourceTechPackSpuCode || ''
    const secondaryCraftMeta =
      secondaryCraftMetaByProductionOrderId.get(line.productionOrderId)
      || resolveSecondaryCrafts(line.productionOrderId)
    secondaryCraftMetaByProductionOrderId.set(line.productionOrderId, secondaryCraftMeta)

    const sequenceNo = index + 1
    const feiTicketId = line.outputLineId
    const feiTicketNo = buildFeiTicketNo(line.cutOrderNo, sequenceNo)
    const pieceScope = unique([line.fabricRollNo, line.fabricColor, line.sizeCode, line.partName])
    const pieceGroup = normalizeText(line.partName) || normalizeText(line.partCode) || '整单裁片'
    const bundleScope = `${line.fabricRollNo}-${line.fabricColor}-${line.sizeCode}-${line.bundleNo}`
    const qty = Math.max(line.bundleQty, 1)
    const encoded = encodeFeiTicketQr({
      feiTicketId,
      feiTicketNo,
      cutOrderId: line.cutOrderId,
      cutOrderNo: line.cutOrderNo,
      productionOrderId: line.productionOrderId,
      productionOrderNo: line.productionOrderNo,
      sourceOutputLineId: line.outputLineId,
      fabricRollId: line.fabricRollId,
      fabricRollNo: line.fabricRollNo,
      fabricColor: line.fabricColor,
      materialSku: line.materialSku,
      garmentSkuId: line.garmentSkuId,
      garmentColor: line.garmentColor,
      pieceScope,
      pieceGroup,
      bundleScope,
      skuColor: line.fabricColor,
      skuSize: line.sizeCode,
      partCode: line.partCode,
      partName: line.partName,
      bundleNo: line.bundleNo,
      bundleQty: line.bundleQty,
      pieceSetNoStart: line.pieceSetNoStart,
      pieceSetNoEnd: line.pieceSetNoEnd,
      pieceSetNoRange: line.pieceSetNoRange,
      bundleTicketType: line.bundleTicketType,
      actualCutPieceQty: line.actualCutPieceQty,
      qty,
      secondaryCrafts: secondaryCraftMeta.secondaryCrafts,
      craftSequenceVersion: secondaryCraftMeta.craftSequenceVersion,
      currentCraftStage: secondaryCraftMeta.secondaryCrafts[0] || '',
      issuedAt: line.createdAt,
    })

    return {
      feiTicketId,
      feiTicketNo,
      sourceOutputLineId: line.outputLineId,
      sourceSpreadingSessionId: line.spreadingSessionId,
      sourceSpreadingSessionNo: line.sourceSpreadingSessionNo,
      sourceMarkerId: line.sourceMarkerId,
      sourceMarkerNo: line.sourceMarkerNo,
      cutOrderId: line.cutOrderId,
      cutOrderNo: line.cutOrderNo,
      productionOrderId: line.productionOrderId,
      productionOrderNo: line.productionOrderNo,
      sourceMarkerPlanId: line.markerPlanId || '',
      sourceMarkerPlanNo: line.markerPlanNo || '',
      fabricRollId: line.fabricRollId,
      fabricRollNo: line.fabricRollNo,
      fabricColor: line.fabricColor,
      materialSku: line.materialSku,
      garmentSkuId: line.garmentSkuId,
      garmentColor: line.garmentColor,
      pieceScope,
      pieceGroup,
      bundleScope,
      skuCode: line.garmentSkuId,
      skuColor: line.fabricColor,
      skuSize: line.sizeCode,
      partCode: line.partCode,
      partName: line.partName,
      bundleNo: line.bundleNo,
      bundleQty: line.bundleQty,
      pieceSetNoStart: line.pieceSetNoStart,
      pieceSetNoEnd: line.pieceSetNoEnd,
      pieceSetNoRange: line.pieceSetNoRange,
      bundleTicketType: line.bundleTicketType,
      actualCutPieceQty: line.actualCutPieceQty,
      printStatus: 'WAIT_PRINT',
      qty,
      garmentQty: Math.max(line.actualCutGarmentQty, 1),
      sourceTraceCompleteness: 'COMPLETE',
      secondaryCrafts: secondaryCraftMeta.secondaryCrafts,
      craftSequenceVersion: secondaryCraftMeta.craftSequenceVersion,
      currentCraftStage: secondaryCraftMeta.secondaryCrafts[0] || '',
      sourceTechPackSpuCode,
      sourceBasisType: 'SPREADING_RESULT',
      issuedAt: line.createdAt,
      qrPayload: encoded.payload,
      qrValue: encoded.qrValue,
    } satisfies GeneratedFeiTicketSourceRecord
  })

  return records
}

interface GeneratedFeiTicketDataset {
  generatedFeiTickets: GeneratedFeiTicketSourceRecord[]
  feiTicketsById: Record<string, GeneratedFeiTicketSourceRecord>
  feiTicketsByNo: Record<string, GeneratedFeiTicketSourceRecord>
  feiTicketsByProductionOrderId: Record<string, GeneratedFeiTicketSourceRecord[]>
  spreadingResultFeiTicketsByProductionOrderId: Record<string, GeneratedFeiTicketSourceRecord[]>
  feiTicketsByCutOrderId: Record<string, GeneratedFeiTicketSourceRecord[]>
  feiTicketsBySpreadingSessionId: Record<string, GeneratedFeiTicketSourceRecord[]>
}

function buildGeneratedFeiTicketDataset(records: GeneratedFeiTicketSourceRecord[]): GeneratedFeiTicketDataset {
  const generatedFeiTickets = [...records].sort(compareFeiRecords)
  return {
    generatedFeiTickets,
    feiTicketsById: Object.fromEntries(generatedFeiTickets.map((record) => [record.feiTicketId, record])),
    feiTicketsByNo: Object.fromEntries(generatedFeiTickets.map((record) => [record.feiTicketNo, record])),
    feiTicketsByProductionOrderId: generatedFeiTickets.reduce<Record<string, GeneratedFeiTicketSourceRecord[]>>((acc, record) => {
      if (!acc[record.productionOrderId]) acc[record.productionOrderId] = []
      acc[record.productionOrderId].push(record)
      return acc
    }, {}),
    spreadingResultFeiTicketsByProductionOrderId: generatedFeiTickets.reduce<Record<string, GeneratedFeiTicketSourceRecord[]>>((acc, record) => {
      if (record.sourceBasisType !== 'SPREADING_RESULT') return acc
      if (!acc[record.productionOrderId]) acc[record.productionOrderId] = []
      acc[record.productionOrderId].push(record)
      return acc
    }, {}),
    feiTicketsByCutOrderId: generatedFeiTickets.reduce<Record<string, GeneratedFeiTicketSourceRecord[]>>((acc, record) => {
      if (!acc[record.cutOrderId]) acc[record.cutOrderId] = []
      acc[record.cutOrderId].push(record)
      return acc
    }, {}),
    feiTicketsBySpreadingSessionId: generatedFeiTickets.reduce<Record<string, GeneratedFeiTicketSourceRecord[]>>((acc, record) => {
      if (!record.sourceSpreadingSessionId) return acc
      if (!acc[record.sourceSpreadingSessionId]) acc[record.sourceSpreadingSessionId] = []
      acc[record.sourceSpreadingSessionId].push(record)
      return acc
    }, {}),
  }
}

export function listSpreadingPieceOutputLines(
  sourceRecords: GeneratedCutOrderSourceRecord[] = listGeneratedCutOrderSourceRecords(),
): SpreadingPieceOutputLine[] {
  const generatedLines = buildSpreadingPieceOutputLinesFromSessions(sourceRecords)
  const lineMap = new Map<string, SpreadingPieceOutputLine>()
  generatedLines.forEach((line) => {
    if (!lineMap.has(line.outputLineId)) {
      lineMap.set(line.outputLineId, line)
    }
  })
  return Array.from(lineMap.values()).sort(compareOutputLines)
}

let computingGeneratedFeiTicketDataset = false
const EMPTY_GENERATED_FEI_TICKET_DATASET = buildGeneratedFeiTicketDataset([])
let generatedFeiTicketDatasetCache: {
  signature: string
  dataset: GeneratedFeiTicketDataset
} | null = null

function getGeneratedFeiTicketRuntimeSignature(): string {
  const storage = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
    ? localStorage
    : null
  if (!storage) return ''
  return [
    'cuttingMarkerSpreadingLedger',
    'cuttingMarkerPlanRefLedger',
  ]
    .map((key) => `${key}:${storage.getItem(key) || ''}`)
    .join('\n')
}

function buildGeneratedFeiTicketDatasetSignature(sourceRecords: GeneratedCutOrderSourceRecord[]): string {
  const sourceSignature = sourceRecords
    .map((record) => [
      record.cutOrderId,
      record.cutOrderNo,
      record.productionOrderNo,
      record.materialSku,
      record.requiredQty,
    ].join(':'))
    .join('|')

  return `${sourceSignature}\n${getGeneratedFeiTicketRuntimeSignature()}`
}

function getGeneratedFeiTicketDataset(): GeneratedFeiTicketDataset {
  const sourceRecords = listGeneratedCutOrderSourceRecords()
  if (computingGeneratedFeiTicketDataset) return EMPTY_GENERATED_FEI_TICKET_DATASET

  const signature = buildGeneratedFeiTicketDatasetSignature(sourceRecords)
  if (generatedFeiTicketDatasetCache?.signature === signature) {
    return generatedFeiTicketDatasetCache.dataset
  }

  computingGeneratedFeiTicketDataset = true
  try {
    const spreadingDrivenFeiTickets = buildFeiRecordsFromSpreadingSessions(sourceRecords)
    const dataset = buildGeneratedFeiTicketDataset(spreadingDrivenFeiTickets)
    generatedFeiTicketDatasetCache = { signature, dataset }
    return dataset
  } finally {
    computingGeneratedFeiTicketDataset = false
  }
}

function cloneGeneratedFeiRecord(record: GeneratedFeiTicketSourceRecord): GeneratedFeiTicketSourceRecord {
  return {
    ...record,
    pieceScope: [...record.pieceScope],
    secondaryCrafts: [...record.secondaryCrafts],
    qrPayload: {
      ...record.qrPayload,
      pieceScope: [...record.qrPayload.pieceScope],
      secondaryCrafts: [...record.qrPayload.secondaryCrafts],
    },
  }
}

export function listGeneratedFeiTickets(): GeneratedFeiTicketSourceRecord[] {
  return getGeneratedFeiTicketDataset().generatedFeiTickets.map((record) => cloneGeneratedFeiRecord(record))
}

export function listSpreadingResultGeneratedFeiTickets(): GeneratedFeiTicketSourceRecord[] {
  return listGeneratedFeiTickets().filter((record) => record.sourceBasisType === 'SPREADING_RESULT')
}

export function listGeneratedFeiTicketsByCutOrderId(cutOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return (getGeneratedFeiTicketDataset().feiTicketsByCutOrderId[cutOrderId] || []).map((record) => cloneGeneratedFeiRecord(record))
}

export function listSpreadingResultGeneratedFeiTicketsByCutOrderId(cutOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return listGeneratedFeiTicketsByCutOrderId(cutOrderId).filter((record) => record.sourceBasisType === 'SPREADING_RESULT')
}

export function listGeneratedFeiTicketsBySpreadingSessionId(spreadingSessionId: string): GeneratedFeiTicketSourceRecord[] {
  return (getGeneratedFeiTicketDataset().feiTicketsBySpreadingSessionId[spreadingSessionId] || []).map((record) => cloneGeneratedFeiRecord(record))
}

export function getFeiTicketById(feiTicketId: string): GeneratedFeiTicketSourceRecord | null {
  const record = getGeneratedFeiTicketDataset().feiTicketsById[feiTicketId]
  return record ? cloneGeneratedFeiRecord(record) : null
}

export function getFeiTicketByNo(feiTicketNo: string): GeneratedFeiTicketSourceRecord | null {
  const record = getGeneratedFeiTicketDataset().feiTicketsByNo[feiTicketNo]
  return record ? cloneGeneratedFeiRecord(record) : null
}

export function getGeneratedFeiTicketMapByCutOrderId(): Record<string, GeneratedFeiTicketSourceRecord[]> {
  return Object.fromEntries(
    Object.entries(getGeneratedFeiTicketDataset().feiTicketsByCutOrderId).map(([key, records]) => [
      key,
      records.map((record) => cloneGeneratedFeiRecord(record)),
    ]),
  )
}

export function listGeneratedFeiTicketsByProductionOrderId(productionOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return (getGeneratedFeiTicketDataset().feiTicketsByProductionOrderId[productionOrderId] || [])
    .map((record) => cloneGeneratedFeiRecord(record))
}

export function listSpreadingResultGeneratedFeiTicketsByProductionOrderId(productionOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return (getGeneratedFeiTicketDataset().spreadingResultFeiTicketsByProductionOrderId[productionOrderId] || [])
    .map((record) => cloneGeneratedFeiRecord(record))
}

export function buildGeneratedFeiTicketTraceMatrix(
  records: GeneratedFeiTicketSourceRecord[] = listGeneratedFeiTickets(),
): GeneratedFeiTicketTraceMatrixRow[] {
  const store = readMarkerSpreadingStoreForFeiTickets(listGeneratedCutOrderSourceRecords())
  const sessionById = Object.fromEntries(store.sessions.map((session) => [session.spreadingSessionId, session]))
  return records
    .map((record) => {
      const session = sessionById[record.sourceSpreadingSessionId]
      return {
        feiTicketId: record.feiTicketId,
        feiTicketNo: record.feiTicketNo,
        sourceOutputLineId: record.sourceOutputLineId,
        sourceSpreadingSessionId: record.sourceSpreadingSessionId,
        sourceSpreadingSessionNo: record.sourceSpreadingSessionNo,
        sourceMarkerId: record.sourceMarkerId,
        sourceMarkerNo: record.sourceMarkerNo,
        sourceMarkerPlanId: record.sourceMarkerPlanId,
        sourceMarkerPlanNo: record.sourceMarkerPlanNo,
        cutOrderId: record.cutOrderId,
        cutOrderNo: record.cutOrderNo,
        fabricRollNo: record.fabricRollNo,
        fabricColor: record.fabricColor,
        materialSku: record.materialSku,
        color: record.skuColor,
        size: record.skuSize,
        partName: record.partName,
        bundleNo: record.bundleNo,
        bundleQty: record.bundleQty,
        pieceSetNoStart: record.pieceSetNoStart,
        pieceSetNoEnd: record.pieceSetNoEnd,
        pieceSetNoRange: record.pieceSetNoRange,
        bundleTicketType: record.bundleTicketType,
        garmentQty: record.garmentQty,
        sourceBasisType: record.sourceBasisType,
        sourceTraceCompleteness: record.sourceTraceCompleteness,
        sourceWritebackId: session?.sourceWritebackId || '',
      }
    })
    .sort(
      (left, right) =>
        left.sourceSpreadingSessionNo.localeCompare(right.sourceSpreadingSessionNo, 'zh-CN')
        || left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
        || left.color.localeCompare(right.color, 'zh-CN')
        || left.size.localeCompare(right.size, 'zh-CN'),
    )
}

export function buildSpreadingDrivenFeiTicketTraceMatrix(
  records: GeneratedFeiTicketSourceRecord[] = listGeneratedFeiTickets(),
): GeneratedFeiTicketTraceMatrixRow[] {
  return buildGeneratedFeiTicketTraceMatrix(records).filter(
    (record) => record.sourceBasisType === 'SPREADING_RESULT' && Boolean(record.sourceSpreadingSessionId),
  )
}
