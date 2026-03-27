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

export interface GeneratedFeiTicketSourceRecord {
  feiTicketId: string
  feiTicketNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
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
  secondaryCrafts: string[]
  craftSequenceVersion: string
  currentCraftStage: string
  sourceTechPackSpuCode: string
  issuedAt: string
  qrPayload: FeiTicketQrPayload
  qrValue: string
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

function buildFeiRecordsForOriginalOrder(record: GeneratedOriginalCutOrderSourceRecord): GeneratedFeiTicketSourceRecord[] {
  const skuScopeLines = buildFallbackSkuScope(record)
  const pieceRows = buildFallbackPieceRows(record)
  const { secondaryCrafts, craftSequenceVersion } = resolveSecondaryCrafts(record.sourceTechPackSpuCode)
  const issuedAt = toIssuedAt(record)
  const results: GeneratedFeiTicketSourceRecord[] = []
  let sequenceNo = 1

  pieceRows.forEach((pieceRow) => {
    const applicableSkuLines = selectApplicableSkuLines(skuScopeLines, pieceRow)
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
        secondaryCrafts,
        craftSequenceVersion,
        currentCraftStage: secondaryCrafts[0] || '',
        issuedAt,
      })

      results.push({
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
        skuCode: normalizeText(skuLine.skuCode),
        skuColor: normalizeText(skuLine.color) || '待补颜色',
        skuSize: normalizeText(skuLine.size) || '均码',
        partCode: normalizeText(pieceRow.partCode) || normalizeText(pieceRow.partName),
        partName: normalizeText(pieceRow.partName) || '整单裁片',
        qty,
        secondaryCrafts,
        craftSequenceVersion,
        currentCraftStage: secondaryCrafts[0] || '',
        sourceTechPackSpuCode: record.sourceTechPackSpuCode,
        issuedAt,
        qrPayload: encoded.payload,
        qrValue: encoded.qrValue,
      })
      sequenceNo += 1
    })
  })

  return results
}

const generatedFeiTickets: GeneratedFeiTicketSourceRecord[] = listGeneratedOriginalCutOrderSourceRecords()
  .flatMap((record) => buildFeiRecordsForOriginalOrder(record))
  .sort(compareFeiRecords)

const feiTicketsById = Object.fromEntries(generatedFeiTickets.map((record) => [record.feiTicketId, record]))
const feiTicketsByNo = Object.fromEntries(generatedFeiTickets.map((record) => [record.feiTicketNo, record]))
const feiTicketsByOriginalCutOrderId = generatedFeiTickets.reduce<Record<string, GeneratedFeiTicketSourceRecord[]>>((acc, record) => {
  if (!acc[record.originalCutOrderId]) acc[record.originalCutOrderId] = []
  acc[record.originalCutOrderId].push(record)
  return acc
}, {})

export function listGeneratedFeiTickets(): GeneratedFeiTicketSourceRecord[] {
  return generatedFeiTickets.map((record) => ({
    ...record,
    pieceScope: [...record.pieceScope],
    secondaryCrafts: [...record.secondaryCrafts],
    qrPayload: {
      ...record.qrPayload,
      pieceScope: [...record.qrPayload.pieceScope],
      secondaryCrafts: [...record.qrPayload.secondaryCrafts],
    },
  }))
}

export function listGeneratedFeiTicketsByOriginalCutOrderId(originalCutOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return (feiTicketsByOriginalCutOrderId[originalCutOrderId] || []).map((record) => ({
    ...record,
    pieceScope: [...record.pieceScope],
    secondaryCrafts: [...record.secondaryCrafts],
    qrPayload: {
      ...record.qrPayload,
      pieceScope: [...record.qrPayload.pieceScope],
      secondaryCrafts: [...record.qrPayload.secondaryCrafts],
    },
  }))
}

export function getFeiTicketById(feiTicketId: string): GeneratedFeiTicketSourceRecord | null {
  const record = feiTicketsById[feiTicketId]
  return record
    ? {
        ...record,
        pieceScope: [...record.pieceScope],
        secondaryCrafts: [...record.secondaryCrafts],
        qrPayload: {
          ...record.qrPayload,
          pieceScope: [...record.qrPayload.pieceScope],
          secondaryCrafts: [...record.qrPayload.secondaryCrafts],
        },
      }
    : null
}

export function getFeiTicketByNo(feiTicketNo: string): GeneratedFeiTicketSourceRecord | null {
  const record = feiTicketsByNo[feiTicketNo]
  return record
    ? {
        ...record,
        pieceScope: [...record.pieceScope],
        secondaryCrafts: [...record.secondaryCrafts],
        qrPayload: {
          ...record.qrPayload,
          pieceScope: [...record.qrPayload.pieceScope],
          secondaryCrafts: [...record.qrPayload.secondaryCrafts],
        },
      }
    : null
}

export function getGeneratedFeiTicketMapByOriginalCutOrderId(): Record<string, GeneratedFeiTicketSourceRecord[]> {
  return Object.fromEntries(
    Object.entries(feiTicketsByOriginalCutOrderId).map(([key, records]) => [
      key,
      records.map((record) => ({
        ...record,
        pieceScope: [...record.pieceScope],
        secondaryCrafts: [...record.secondaryCrafts],
        qrPayload: {
          ...record.qrPayload,
          pieceScope: [...record.qrPayload.pieceScope],
          secondaryCrafts: [...record.qrPayload.secondaryCrafts],
        },
      })),
    ]),
  )
}

export function listGeneratedFeiTicketsByProductionOrderId(productionOrderId: string): GeneratedFeiTicketSourceRecord[] {
  return generatedFeiTickets
    .filter((record) => record.productionOrderId === productionOrderId)
    .map((record) => ({
      ...record,
      pieceScope: [...record.pieceScope],
      secondaryCrafts: [...record.secondaryCrafts],
      qrPayload: {
        ...record.qrPayload,
        pieceScope: [...record.qrPayload.pieceScope],
        secondaryCrafts: [...record.qrPayload.secondaryCrafts],
      },
    }))
}
