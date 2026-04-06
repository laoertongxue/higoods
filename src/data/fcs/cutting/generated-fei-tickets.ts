import {
  getTechPackBySpuCode,
  listTechPackProcessEntries,
} from '../tech-packs.ts'
import {
  listGeneratedOriginalCutOrderSourceRecords,
  type GeneratedOriginalCutOrderPieceRow,
  type GeneratedOriginalCutOrderSkuScopeLine,
  type GeneratedOriginalCutOrderSourceRecord,
} from './generated-original-cut-orders.ts'
import { encodeFeiTicketQr } from './qr-codes.ts'
import type { FeiTicketQrPayload } from './qr-payload.ts'
import { readMarkerSpreadingPrototypeData } from '../../../pages/process-factory/cutting/marker-spreading-utils.ts'
import type { SpreadingSession } from '../../../pages/process-factory/cutting/marker-spreading-model.ts'

export interface GeneratedFeiTicketSourceRecord {
  feiTicketId: string
  feiTicketNo: string
  sourceSpreadingSessionId: string
  sourceSpreadingSessionNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  sourceMergeBatchId: string
  sourceMergeBatchNo: string
  materialSku: string
  pieceScope: string[]
  pieceGroup: string
  bundleScope: string
  skuCode: string
  skuColor: string
  skuSize: string
  partCode: string
  partName: string
  qty: number
  garmentQty: number
  sourceTraceCompleteness: 'COMPLETE' | 'FALLBACK_INCOMPLETE'
  secondaryCrafts: string[]
  craftSequenceVersion: string
  currentCraftStage: string
  sourceTechPackSpuCode: string
  sourceBasisType: 'SPREADING_RESULT' | 'THEORETICAL_FALLBACK'
  issuedAt: string
  qrPayload: FeiTicketQrPayload
  qrValue: string
}

export interface GeneratedFeiTicketTraceMatrixRow {
  feiTicketId: string
  feiTicketNo: string
  sourceSpreadingSessionId: string
  sourceSpreadingSessionNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  sourceMergeBatchId: string
  sourceMergeBatchNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  materialSku: string
  color: string
  size: string
  garmentQty: number
  sourceBasisType: 'SPREADING_RESULT' | 'THEORETICAL_FALLBACK'
  sourceTraceCompleteness: 'COMPLETE' | 'FALLBACK_INCOMPLETE'
  sourceWritebackId: string
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim()
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function compareFeiRecords(left: GeneratedFeiTicketSourceRecord, right: GeneratedFeiTicketSourceRecord): number {
  const orderCompare = left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN')
  if (orderCompare !== 0) return orderCompare
  const sessionCompare = left.sourceSpreadingSessionNo.localeCompare(right.sourceSpreadingSessionNo, 'zh-CN')
  if (sessionCompare !== 0) return sessionCompare
  return left.feiTicketNo.localeCompare(right.feiTicketNo, 'zh-CN')
}

function resolveSecondaryCrafts(spuCode: string): {
  secondaryCrafts: string[]
  craftSequenceVersion: string
} {
  const techPack = getTechPackBySpuCode(spuCode)
  const processEntries = listTechPackProcessEntries(spuCode)
  const secondaryCrafts = unique(
    processEntries
      .filter((entry) => entry.isSpecialCraft)
      .map((entry) => normalizeText(entry.craftName) || normalizeText(entry.processName))
      .filter(Boolean),
  )

  return {
    secondaryCrafts,
    craftSequenceVersion: `${normalizeText(techPack?.versionLabel) || 'v0'}:${secondaryCrafts.length || 0}`,
  }
}

function makeBundleScope(index: number): string {
  return `BUNDLE-${String(index + 1).padStart(3, '0')}`
}

function buildFallbackSkuScope(record: GeneratedOriginalCutOrderSourceRecord): GeneratedOriginalCutOrderSkuScopeLine[] {
  if (record.skuScopeLines.length) return record.skuScopeLines
  return [
    {
      skuCode: record.originalCutOrderNo,
      color: record.colorScope[0] || '待补颜色',
      size: '均码',
      plannedQty: Math.max(record.requiredQty, 1),
    },
  ]
}

function buildFallbackPieceRows(record: GeneratedOriginalCutOrderSourceRecord): GeneratedOriginalCutOrderPieceRow[] {
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

function selectApplicableSkuLines(
  skuScopeLines: GeneratedOriginalCutOrderSkuScopeLine[],
  pieceRow: GeneratedOriginalCutOrderPieceRow,
): GeneratedOriginalCutOrderSkuScopeLine[] {
  if (!pieceRow.applicableSkuCodes.length) return skuScopeLines
  const matched = skuScopeLines.filter((line) => pieceRow.applicableSkuCodes.includes(line.skuCode))
  return matched.length ? matched : skuScopeLines
}

function buildFeiTicketNo(originalCutOrderNo: string, sequenceNo: number): string {
  return `FT-${originalCutOrderNo}-${String(sequenceNo).padStart(3, '0')}`
}

function toIssuedAt(record: GeneratedOriginalCutOrderSourceRecord): string {
  return `${record.originalCutOrderNo.slice(4, 10).replace(/(\d{2})(\d{2})(\d{2})/, '20$1-$2-$3')} 08:00`
}

function buildSourceRecordKey(record: Pick<GeneratedOriginalCutOrderSourceRecord, 'originalCutOrderId' | 'materialSku'>): string {
  return `${record.originalCutOrderId}::${record.materialSku}`
}

function buildFallbackSkuCoverageKey(options: {
  originalCutOrderId: string
  materialSku: string
  color: string
  size: string
}): string {
  return [
    options.originalCutOrderId,
    normalizeText(options.materialSku),
    normalizeText(options.color) || '待补颜色',
    normalizeText(options.size) || '均码',
  ].join('::')
}

function buildCoveredFallbackSkuKeySet(spreadingDrivenFeiTickets: GeneratedFeiTicketSourceRecord[]): Set<string> {
  return new Set(
    spreadingDrivenFeiTickets
      .filter((record) => record.sourceBasisType === 'SPREADING_RESULT')
      .map((record) =>
        buildFallbackSkuCoverageKey({
          originalCutOrderId: record.originalCutOrderId,
          materialSku: record.materialSku,
          color: record.skuColor,
          size: record.skuSize,
        }),
      ),
  )
}

function resolveUncoveredFallbackSkuKeys(
  record: GeneratedOriginalCutOrderSourceRecord,
  coveredSkuKeys: Set<string>,
): Set<string> {
  return new Set(
    buildFallbackSkuScope(record)
      .map((line) =>
        buildFallbackSkuCoverageKey({
          originalCutOrderId: record.originalCutOrderId,
          materialSku: record.materialSku,
          color: line.color,
          size: line.size,
        }),
      )
      .filter((key) => !coveredSkuKeys.has(key)),
  )
}

function filterFallbackSourceRecordsBySpreadingCoverage(
  sourceRecords: GeneratedOriginalCutOrderSourceRecord[],
  spreadingDrivenFeiTickets: GeneratedFeiTicketSourceRecord[],
): GeneratedOriginalCutOrderSourceRecord[] {
  const coveredSourceKeys = new Set(spreadingDrivenFeiTickets.map((record) => buildSourceRecordKey(record)))
  return sourceRecords.filter((record) => !coveredSourceKeys.has(buildSourceRecordKey(record)))
}

function normalizePositiveInteger(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(Math.round(value), 0)
}

function isReadyForFeiGeneration(session: SpreadingSession): boolean {
  if (session.status !== 'DONE') return false
  const warning = session.replenishmentWarning
  if (!warning) return true
  if (warning.suggestedAction === '无需补料') return true
  return Boolean(warning.handled)
}

function resolveSourceRecordForLine(
  sourceRecords: GeneratedOriginalCutOrderSourceRecord[],
  line: {
    originalCutOrderId: string
    materialSku: string
  },
): GeneratedOriginalCutOrderSourceRecord | null {
  return (
    sourceRecords.find(
      (record) =>
        record.originalCutOrderId === line.originalCutOrderId &&
        normalizeText(record.materialSku) === normalizeText(line.materialSku),
    ) ||
    sourceRecords.find((record) => record.originalCutOrderId === line.originalCutOrderId) ||
    null
  )
}

function resolveColorScopedSkuLines(
  sourceRecord: GeneratedOriginalCutOrderSourceRecord,
  color: string,
): GeneratedOriginalCutOrderSkuScopeLine[] {
  const scoped = buildFallbackSkuScope(sourceRecord).filter((line) => normalizeText(line.color) === normalizeText(color))
  return scoped.length ? scoped : buildFallbackSkuScope(sourceRecord)
}

function splitGarmentQtyBySize(
  skuScopeLines: GeneratedOriginalCutOrderSkuScopeLine[],
  targetGarmentQty: number,
): Array<{ skuCode: string; color: string; size: string; garmentQty: number }> {
  const normalizedTarget = normalizePositiveInteger(targetGarmentQty)
  if (!normalizedTarget) return []

  const normalizedLines = (skuScopeLines.length ? skuScopeLines : buildFallbackSkuScope({
    originalCutOrderId: '',
    originalCutOrderNo: '',
    productionOrderId: '',
    productionOrderNo: '',
    materialSku: '',
    colorScope: ['待补颜色'],
    skuScopeLines: [],
    pieceRows: [],
    requiredQty: normalizedTarget,
    pieceSummary: '',
    sourceTechPackSpuCode: '',
  } as GeneratedOriginalCutOrderSourceRecord)).map((line, index) => ({
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

interface SpreadingFeiSeed {
  sourceRecordKey: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  sourceSpreadingSessionId: string
  sourceSpreadingSessionNo: string
  sourceMarkerId: string
  sourceMarkerNo: string
  sourceMergeBatchId: string
  sourceMergeBatchNo: string
  materialSku: string
  skuCode: string
  skuColor: string
  skuSize: string
  garmentQty: number
  secondaryCrafts: string[]
  craftSequenceVersion: string
  currentCraftStage: string
  sourceTechPackSpuCode: string
  issuedAt: string
}

function buildSpreadingFeiSeeds(
  sourceRecords: GeneratedOriginalCutOrderSourceRecord[],
): SpreadingFeiSeed[] {
  const { store } = readMarkerSpreadingPrototypeData()
  const seeds: SpreadingFeiSeed[] = []

  store.sessions
    .filter(isReadyForFeiGeneration)
    .forEach((session) => {
      const warningLines = session.replenishmentWarning?.lines || []
      const issuedAt = session.completionLinkage?.completedAt || session.updatedAt || ''

      warningLines.forEach((line) => {
        const actualCutGarmentQty = normalizePositiveInteger(line.actualCutGarmentQty)
        if (!actualCutGarmentQty) return
        const sourceRecord = resolveSourceRecordForLine(sourceRecords, line)
        if (!sourceRecord) return

        const { secondaryCrafts, craftSequenceVersion } = resolveSecondaryCrafts(sourceRecord.sourceTechPackSpuCode)
        splitGarmentQtyBySize(resolveColorScopedSkuLines(sourceRecord, line.color), actualCutGarmentQty).forEach((sizeLine) => {
          seeds.push({
            sourceRecordKey: buildSourceRecordKey(sourceRecord),
            originalCutOrderId: sourceRecord.originalCutOrderId,
            originalCutOrderNo: sourceRecord.originalCutOrderNo,
            productionOrderId: sourceRecord.productionOrderId,
            productionOrderNo: sourceRecord.productionOrderNo,
            sourceSpreadingSessionId: session.spreadingSessionId,
            sourceSpreadingSessionNo: session.sessionNo || session.spreadingSessionId,
            sourceMarkerId: session.sourceMarkerId || session.markerId || '',
            sourceMarkerNo: session.sourceMarkerNo || session.markerNo || '',
            sourceMergeBatchId: session.mergeBatchId || '',
            sourceMergeBatchNo: session.mergeBatchNo || '',
            materialSku: normalizeText(line.materialSku) || sourceRecord.materialSku,
            skuCode: sizeLine.skuCode,
            skuColor: sizeLine.color,
            skuSize: sizeLine.size,
            garmentQty: sizeLine.garmentQty,
            secondaryCrafts,
            craftSequenceVersion,
            currentCraftStage: secondaryCrafts[0] || '',
            sourceTechPackSpuCode: sourceRecord.sourceTechPackSpuCode,
            issuedAt,
          })
        })
      })
    })

  return seeds
}

function buildFeiRecordsFromSpreadingSessions(
  sourceRecords: GeneratedOriginalCutOrderSourceRecord[],
): GeneratedFeiTicketSourceRecord[] {
  const seedsByOriginalCutOrderId = buildSpreadingFeiSeeds(sourceRecords).reduce<Record<string, SpreadingFeiSeed[]>>((acc, seed) => {
    if (!acc[seed.originalCutOrderId]) acc[seed.originalCutOrderId] = []
    acc[seed.originalCutOrderId].push(seed)
    return acc
  }, {})

  return Object.values(seedsByOriginalCutOrderId).flatMap((seeds) =>
    seeds
      .slice()
      .sort(
        (left, right) =>
          left.sourceSpreadingSessionNo.localeCompare(right.sourceSpreadingSessionNo, 'zh-CN') ||
          left.materialSku.localeCompare(right.materialSku, 'zh-CN') ||
          left.skuColor.localeCompare(right.skuColor, 'zh-CN') ||
          left.skuSize.localeCompare(right.skuSize, 'zh-CN'),
      )
      .map((seed, index) => {
        const sequenceNo = index + 1
        const feiTicketId = `${seed.sourceSpreadingSessionId}::${String(sequenceNo).padStart(3, '0')}`
        const feiTicketNo = buildFeiTicketNo(seed.originalCutOrderNo, sequenceNo)
        const pieceScope = unique([seed.materialSku, seed.skuColor, seed.skuSize])
        const pieceGroup = seed.skuColor || '待补颜色'
        const bundleScope = `${seed.skuColor || '待补颜色'}-${seed.skuSize || '均码'}`
        const qty = Math.max(seed.garmentQty, 1)
        const encoded = encodeFeiTicketQr({
          feiTicketId,
          feiTicketNo,
          originalCutOrderId: seed.originalCutOrderId,
          originalCutOrderNo: seed.originalCutOrderNo,
          productionOrderId: seed.productionOrderId,
          productionOrderNo: seed.productionOrderNo,
          materialSku: seed.materialSku,
          pieceScope,
          pieceGroup,
          bundleScope,
          skuColor: seed.skuColor || '待补颜色',
          skuSize: seed.skuSize || '均码',
          partName: '整包裁片',
          qty,
          secondaryCrafts: seed.secondaryCrafts,
          craftSequenceVersion: seed.craftSequenceVersion,
          currentCraftStage: seed.currentCraftStage,
          issuedAt: seed.issuedAt,
        })

        return {
          feiTicketId,
          feiTicketNo,
          sourceSpreadingSessionId: seed.sourceSpreadingSessionId,
          sourceSpreadingSessionNo: seed.sourceSpreadingSessionNo,
          sourceMarkerId: seed.sourceMarkerId,
          sourceMarkerNo: seed.sourceMarkerNo,
          originalCutOrderId: seed.originalCutOrderId,
          originalCutOrderNo: seed.originalCutOrderNo,
          productionOrderId: seed.productionOrderId,
          productionOrderNo: seed.productionOrderNo,
          sourceMergeBatchId: seed.sourceMergeBatchId,
          sourceMergeBatchNo: seed.sourceMergeBatchNo,
          materialSku: seed.materialSku,
          pieceScope,
          pieceGroup,
          bundleScope,
          skuCode: seed.skuCode,
          skuColor: seed.skuColor || '待补颜色',
          skuSize: seed.skuSize || '均码',
          partCode: `${seed.materialSku}-${seed.skuColor || '待补颜色'}-${seed.skuSize || '均码'}`,
          partName: '整包裁片',
          qty,
          garmentQty: qty,
          secondaryCrafts: seed.secondaryCrafts,
          craftSequenceVersion: seed.craftSequenceVersion,
          currentCraftStage: seed.currentCraftStage,
          sourceTechPackSpuCode: seed.sourceTechPackSpuCode,
          sourceBasisType: 'SPREADING_RESULT',
          issuedAt: seed.issuedAt,
          qrPayload: encoded.payload,
          qrValue: encoded.qrValue,
        }
      }),
  )
}

function buildFeiRecordsForOriginalOrder(
  record: GeneratedOriginalCutOrderSourceRecord,
  uncoveredFallbackSkuKeys?: Set<string>,
): GeneratedFeiTicketSourceRecord[] {
  const skuScopeLines = buildFallbackSkuScope(record)
  const pieceRows = buildFallbackPieceRows(record)
  const { secondaryCrafts, craftSequenceVersion } = resolveSecondaryCrafts(record.sourceTechPackSpuCode)
  const issuedAt = toIssuedAt(record)
  const results: GeneratedFeiTicketSourceRecord[] = []
  let sequenceNo = 1
  const restrictToUncoveredSkuKeys = Boolean(uncoveredFallbackSkuKeys && uncoveredFallbackSkuKeys.size > 0)

  pieceRows.forEach((pieceRow) => {
    const applicableSkuLines = selectApplicableSkuLines(skuScopeLines, pieceRow).filter((skuLine) => {
      if (!restrictToUncoveredSkuKeys) return true
      return uncoveredFallbackSkuKeys!.has(
        buildFallbackSkuCoverageKey({
          originalCutOrderId: record.originalCutOrderId,
          materialSku: record.materialSku,
          color: skuLine.color,
          size: skuLine.size,
        }),
      )
    })
    applicableSkuLines.forEach((skuLine) => {
      const feiTicketId = `${record.originalCutOrderId}::${String(sequenceNo).padStart(3, '0')}`
      const feiTicketNo = buildFeiTicketNo(record.originalCutOrderNo, sequenceNo)
      const pieceScope = unique([pieceRow.partCode, pieceRow.partName].filter(Boolean))
      const pieceGroup = normalizeText(pieceRow.partName) || normalizeText(pieceRow.partCode) || '整单裁片'
      const bundleScope = makeBundleScope(sequenceNo - 1)
      const qty = Math.max(Number(pieceRow.pieceCountPerUnit || 0), 1)
      const encoded = encodeFeiTicketQr({
        feiTicketId,
        feiTicketNo,
        originalCutOrderId: record.originalCutOrderId,
        originalCutOrderNo: record.originalCutOrderNo,
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        materialSku: record.materialSku,
        pieceScope,
        pieceGroup,
        bundleScope,
        skuColor: normalizeText(skuLine.color) || '待补颜色',
        skuSize: normalizeText(skuLine.size) || '均码',
        partName: normalizeText(pieceRow.partName) || '整单裁片',
          qty,
          sourceTraceCompleteness: 'COMPLETE',
          secondaryCrafts,
        craftSequenceVersion,
        currentCraftStage: secondaryCrafts[0] || '',
        issuedAt,
      })

      results.push({
        feiTicketId,
        feiTicketNo,
        sourceSpreadingSessionId: '',
        sourceSpreadingSessionNo: '',
        sourceMarkerId: '',
        sourceMarkerNo: '',
        originalCutOrderId: record.originalCutOrderId,
        originalCutOrderNo: record.originalCutOrderNo,
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        sourceMergeBatchId: record.mergeBatchId || '',
        sourceMergeBatchNo: record.mergeBatchNo || '',
        materialSku: record.materialSku,
        pieceScope,
        pieceGroup,
        bundleScope,
        skuCode: normalizeText(skuLine.skuCode),
        skuColor: normalizeText(skuLine.color) || '待补颜色',
        skuSize: normalizeText(skuLine.size) || '均码',
        partCode: normalizeText(pieceRow.partCode) || normalizeText(pieceRow.partName),
        partName: normalizeText(pieceRow.partName) || '整单裁片',
        qty,
        garmentQty: qty,
        sourceTraceCompleteness: 'FALLBACK_INCOMPLETE',
        secondaryCrafts,
        craftSequenceVersion,
        currentCraftStage: secondaryCrafts[0] || '',
        sourceTechPackSpuCode: record.sourceTechPackSpuCode,
        sourceBasisType: 'THEORETICAL_FALLBACK',
        issuedAt,
        qrPayload: encoded.payload,
        qrValue: encoded.qrValue,
      })
      sequenceNo += 1
    })
  })

  return results
}

interface GeneratedFeiTicketDataset {
  generatedFeiTickets: GeneratedFeiTicketSourceRecord[]
  feiTicketsById: Record<string, GeneratedFeiTicketSourceRecord>
  feiTicketsByNo: Record<string, GeneratedFeiTicketSourceRecord>
  feiTicketsByOriginalCutOrderId: Record<string, GeneratedFeiTicketSourceRecord[]>
  feiTicketsBySpreadingSessionId: Record<string, GeneratedFeiTicketSourceRecord[]>
}

function buildGeneratedFeiTicketDataset(records: GeneratedFeiTicketSourceRecord[]): GeneratedFeiTicketDataset {
  const generatedFeiTickets = [...records].sort(compareFeiRecords)
  return {
    generatedFeiTickets,
    feiTicketsById: Object.fromEntries(generatedFeiTickets.map((record) => [record.feiTicketId, record])),
    feiTicketsByNo: Object.fromEntries(generatedFeiTickets.map((record) => [record.feiTicketNo, record])),
    feiTicketsByOriginalCutOrderId: generatedFeiTickets.reduce<Record<string, GeneratedFeiTicketSourceRecord[]>>((acc, record) => {
      if (!acc[record.originalCutOrderId]) acc[record.originalCutOrderId] = []
      acc[record.originalCutOrderId].push(record)
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

function buildFallbackFeiTickets(sourceRecords: GeneratedOriginalCutOrderSourceRecord[]): GeneratedFeiTicketSourceRecord[] {
  return sourceRecords.flatMap((record) => buildFeiRecordsForOriginalOrder(record))
}

let generatedFeiTicketDatasetCache: GeneratedFeiTicketDataset | null = null
let computingGeneratedFeiTicketDataset = false

function getGeneratedFeiTicketDataset(): GeneratedFeiTicketDataset {
  if (generatedFeiTicketDatasetCache) return generatedFeiTicketDatasetCache

  const sourceRecords = listGeneratedOriginalCutOrderSourceRecords()
  const fallbackDataset = buildGeneratedFeiTicketDataset(buildFallbackFeiTickets(sourceRecords))
  if (computingGeneratedFeiTicketDataset) return fallbackDataset

  computingGeneratedFeiTicketDataset = true
  try {
    const spreadingDrivenFeiTickets = buildFeiRecordsFromSpreadingSessions(sourceRecords)
    const coveredFallbackSkuKeys = buildCoveredFallbackSkuKeySet(spreadingDrivenFeiTickets)
    const fallbackFeiTickets = sourceRecords.flatMap((record) => {
      const sourceKeyCovered = !filterFallbackSourceRecordsBySpreadingCoverage([record], spreadingDrivenFeiTickets).length
      const uncoveredFallbackSkuKeys = resolveUncoveredFallbackSkuKeys(record, coveredFallbackSkuKeys)
      if (sourceKeyCovered && uncoveredFallbackSkuKeys.size === 0) return []
      return buildFeiRecordsForOriginalOrder(record, sourceKeyCovered ? uncoveredFallbackSkuKeys : undefined)
    })
    generatedFeiTicketDatasetCache = buildGeneratedFeiTicketDataset([...spreadingDrivenFeiTickets, ...fallbackFeiTickets])
    return generatedFeiTicketDatasetCache
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

export function listGeneratedFeiTicketsByOriginalCutOrderId(originalCutOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return (getGeneratedFeiTicketDataset().feiTicketsByOriginalCutOrderId[originalCutOrderId] || []).map((record) => cloneGeneratedFeiRecord(record))
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

export function getGeneratedFeiTicketMapByOriginalCutOrderId(): Record<string, GeneratedFeiTicketSourceRecord[]> {
  return Object.fromEntries(
    Object.entries(getGeneratedFeiTicketDataset().feiTicketsByOriginalCutOrderId).map(([key, records]) => [
      key,
      records.map((record) => cloneGeneratedFeiRecord(record)),
    ]),
  )
}

export function listGeneratedFeiTicketsByProductionOrderId(productionOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return getGeneratedFeiTicketDataset().generatedFeiTickets
    .filter((record) => record.productionOrderId === productionOrderId)
    .map((record) => cloneGeneratedFeiRecord(record))
}

export function buildGeneratedFeiTicketTraceMatrix(
  records: GeneratedFeiTicketSourceRecord[] = listGeneratedFeiTickets(),
): GeneratedFeiTicketTraceMatrixRow[] {
  const { store } = readMarkerSpreadingPrototypeData()
  const sessionById = Object.fromEntries(store.sessions.map((session) => [session.spreadingSessionId, session]))
  return records
    .map((record) => {
      const session = sessionById[record.sourceSpreadingSessionId]
      return {
        feiTicketId: record.feiTicketId,
        feiTicketNo: record.feiTicketNo,
        sourceSpreadingSessionId: record.sourceSpreadingSessionId,
        sourceSpreadingSessionNo: record.sourceSpreadingSessionNo,
        sourceMarkerId: record.sourceMarkerId,
        sourceMarkerNo: record.sourceMarkerNo,
        sourceMergeBatchId: record.sourceMergeBatchId,
        sourceMergeBatchNo: record.sourceMergeBatchNo,
        originalCutOrderId: record.originalCutOrderId,
        originalCutOrderNo: record.originalCutOrderNo,
        materialSku: record.materialSku,
        color: record.skuColor,
        size: record.skuSize,
        garmentQty: record.garmentQty,
        sourceBasisType: record.sourceBasisType,
        sourceTraceCompleteness: record.sourceTraceCompleteness,
        sourceWritebackId: session?.sourceWritebackId || '',
      }
    })
    .sort(
      (left, right) =>
        left.sourceSpreadingSessionNo.localeCompare(right.sourceSpreadingSessionNo, 'zh-CN')
        || left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN')
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
