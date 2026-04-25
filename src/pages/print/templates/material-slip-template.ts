import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  createPrintDocumentId,
  formatPrintQty,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
  type PrintDocumentType,
  type PrintField,
  type PrintSourceType,
} from '../../../data/fcs/print-service.ts'
import { buildMaterialPrepProjection } from '../../process-factory/cutting/material-prep-projection.ts'
import {
  commonPickupPrintVersions,
  commonPickupScanRecords,
  commonPickupSlips,
  cuttingPickupPrintVersions,
  cuttingPickupScanRecords,
  cuttingPickupSlips,
} from '../../../domain/pickup/mock.ts'
import type { PickupQtySummary, PickupSlip } from '../../../domain/pickup/types.ts'
import {
  listCuttingSewingDispatchBatches,
  listCuttingSewingDispatchOrders,
} from '../../../data/fcs/cutting/sewing-dispatch.ts'
import { replenishmentSuggestionRecords } from '../../../data/fcs/cutting/replenishment.ts'

type MaterialSlipKind = 'prep' | 'pickup' | 'issue' | 'supplement'

const TEMPLATE_BY_KIND: Record<MaterialSlipKind, string> = {
  prep: 'MATERIAL_PREP_SLIP',
  pickup: 'PICKUP_SLIP',
  issue: 'ISSUE_SLIP',
  supplement: 'SUPPLEMENT_MATERIAL_SLIP',
}

const TITLE_BY_KIND: Record<MaterialSlipKind, string> = {
  prep: '配料单',
  pickup: '领料单',
  issue: '发料单',
  supplement: '补料单',
}

const SOURCE_TYPE_BY_KIND: Record<MaterialSlipKind, PrintSourceType> = {
  prep: 'MATERIAL_PREP_RECORD',
  pickup: 'PICKUP_SLIP_RECORD',
  issue: 'ISSUE_SLIP_RECORD',
  supplement: 'SUPPLEMENT_MATERIAL_RECORD',
}

function toText(value: string | number | undefined | null, fallback = '—'): string {
  if (value === undefined || value === null) return fallback
  const text = String(value).trim()
  return text || fallback
}

function mapFields(rows: Array<{ label: string; value: string; emphasis?: boolean }>): PrintField[] {
  return rows.map((row) => ({ label: row.label, value: row.value, emphasis: row.emphasis }))
}

function now(): string {
  return getPrintGeneratedAt()
}

function materialQty(value: number | undefined | null): string {
  return formatPrintQty(value, '米')
}

function garmentQty(value: number | undefined | null): string {
  return formatPrintQty(value, '件')
}

function rollQty(value: number | undefined | null): string {
  return formatPrintQty(value, '卷')
}

function objectQtyText(summary: PickupQtySummary | undefined, noun: string): string {
  if (!summary) return '待确认'
  if (noun === '面料米数' && Number.isFinite(summary.length)) {
    const rollText = Number.isFinite(summary.rollCount) ? `${summary.rollCount} 卷 / ` : ''
    return `${rollText}${materialQty(summary.length)}`
  }
  return formatPrintQty(summary.itemCount, summary.unitLabel)
}

function objectQtyDiff(expected: PickupQtySummary | undefined, actual: PickupQtySummary | undefined, noun: string): string {
  if (!expected || !actual) return '待确认'
  if (noun === '面料米数' && Number.isFinite(expected.length) && Number.isFinite(actual.length)) {
    return materialQty((actual.length || 0) - (expected.length || 0))
  }
  return formatPrintQty((actual.itemCount || 0) - (expected.itemCount || 0), expected.unitLabel)
}

function pickupObjectNoun(slip: PickupSlip): string {
  if (slip.plannedQtySummary.length !== undefined || slip.configuredQtySummary.length !== undefined) return '面料米数'
  if (slip.materialType === 'GENERAL') return '辅料数量'
  if (slip.boundObjectType === 'CUT_PIECE_ORDER') return '裁片数量'
  return slip.plannedQtySummary.unitLabel === '件' ? '成衣件数' : '对象数量'
}

function makeQrValue(input: {
  documentType: PrintDocumentType
  sourceId: string
  slipNo: string
  sourceProductionOrderNo: string
  targetRoute: string
}): string {
  return new URLSearchParams({
    documentType: input.documentType,
    sourceId: input.sourceId,
    slipNo: input.slipNo,
    sourceProductionOrderNo: input.sourceProductionOrderNo,
    targetRoute: input.targetRoute,
  }).toString()
}

function buildBaseDocument(input: {
  buildInput: PrintDocumentBuildInput
  kind: MaterialSlipKind
  sourceId: string
  title: string
  subtitle: string
  headerFields: PrintField[]
  sections: PrintDocument['sections']
  tables: PrintDocument['tables']
  qrDescription: string
  qrValue: string
  signatureBlocks: PrintDocument['signatureBlocks']
  footerFields: PrintField[]
  returnHref: string
  imageLabel?: string
  imageSourceLabel?: string
}): PrintDocument {
  const generatedAt = now()
  const templateCode = TEMPLATE_BY_KIND[input.kind]
  return {
    printDocumentId: createPrintDocumentId(input.buildInput, templateCode),
    documentType: input.buildInput.documentType,
    documentTitle: input.title,
    sourceType: input.buildInput.sourceType,
    sourceId: input.sourceId,
    templateCode,
    paperType: 'A4',
    orientation: 'portrait',
    printTitle: input.title,
    printSubtitle: input.subtitle,
    headerFields: input.headerFields,
    imageBlocks: [
      {
        title: '款式信息',
        imageUrl: '',
        imageLabel: input.imageLabel || '暂无商品图',
        sourceLabel: input.imageSourceLabel || '无业务图片',
        fallbackLabel: '暂无商品图',
      },
    ],
    qrCodes: [
      {
        title: `${input.title}二维码`,
        value: input.qrValue,
        description: input.qrDescription,
        sizeMm: 30,
      },
    ],
    barcodes: [],
    sections: input.sections,
    tables: input.tables,
    differenceBlocks: [],
    signatureBlocks: input.signatureBlocks,
    footerFields: [
      ...input.footerFields,
      { label: '打印时间', value: generatedAt },
      { label: '统一打印服务', value: 'PrintDocument' },
    ],
    printMeta: {
      generatedAt,
      generatedBy: '系统自动生成',
      printNotice: '打印前请在浏览器打印设置中关闭页眉和页脚',
      returnHref: input.returnHref,
    },
  }
}

export function buildMaterialPrepSlipPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const projection = buildMaterialPrepProjection()
  const row = projection.rowsById[input.sourceId]
    || projection.rows.find((item) => item.originalCutOrderId === input.sourceId || item.originalCutOrderNo === input.sourceId)
    || projection.rows[0]
  if (!row) throw new Error('缺少配料单来源数据')

  const slipNo = `PL-${row.originalCutOrderNo}`
  const targetRoute = `/fcs/craft/cutting/material-prep?originalCutOrderId=${encodeURIComponent(row.originalCutOrderId)}`
  const generatedAt = now()

  return buildBaseDocument({
    buildInput: input,
    kind: 'prep',
    sourceId: row.id,
    title: '配料单',
    subtitle: '用于仓库按原始裁片单准备面料、复核配料缺口并衔接裁床领料。',
    headerFields: mapFields([
      { label: '配料单号', value: slipNo, emphasis: true },
      { label: '来源生产单', value: row.productionOrderNo },
      { label: '原始裁片单', value: row.originalCutOrderNo },
      { label: '裁片单二维码', value: row.shouldPrintQr ? '已生成' : row.qrHiddenHint || '待生成' },
      { label: '配料状态', value: row.materialPrepStatus.label },
      { label: '打印时间', value: generatedAt },
      { label: '打印人', value: row.printedBy || '仓库配料员' },
    ]),
    sections: [
      {
        sectionId: 'base',
        title: '基础信息区',
        fields: mapFields([
          { label: '款号', value: row.styleCode },
          { label: 'SPU', value: row.spuCode },
          { label: '面料 SKU', value: row.materialSkuSummary },
          { label: '面料名称', value: row.materialLineItems.map((item) => item.materialName).join('、') || '待确认' },
          { label: '面料类型', value: row.materialLineItems.map((item) => item.materialTypeName).join('、') || '待确认' },
          { label: '面料颜色', value: row.color || '按裁片单颜色' },
          { label: '布料属性', value: row.materialLineItems.map((item) => item.materialAttr || item.materialCategory).join('、') || '待确认' },
          { label: '需求来源', value: '原始裁片单配料' },
          { label: '交期', value: row.plannedShipDate || '待确认' },
          { label: '目标裁床 / 裁床组', value: row.assignedCuttingGroup || '待排单' },
        ]),
      },
    ],
    tables: [
      {
        tableId: 'material-prep-lines',
        title: '配料明细表',
        headers: ['面料 SKU', '面料名称', '面料颜色', '批次号', '卷号', '应配面料米数', '已配面料米数', '缺口面料米数', '配置卷数', '单卷长度', '仓位', '备注'],
        rows: row.materialLineItems.map((line, index) => {
          const singleRollLength = line.configuredRollCount > 0 ? line.configuredQty / line.configuredRollCount : line.requiredQty
          return [
            line.materialSku,
            line.materialName,
            row.color || '按裁片单颜色',
            `${row.originalCutOrderNo}-B${index + 1}`,
            `${row.originalCutOrderNo}-R${index + 1}`,
            materialQty(line.requiredQty),
            materialQty(line.configuredQty),
            materialQty(line.shortageQty),
            rollQty(line.configuredRollCount),
            materialQty(singleRollLength),
            `仓位-${index + 1}`,
            line.note || line.latestActionText || '按仓库批次配置',
          ]
        }),
        minRows: 6,
      },
      {
        tableId: 'cut-order-qr',
        title: '裁片单二维码区',
        headers: ['二维码对象', '二维码说明', '二维码值'],
        rows: [['原始裁片单二维码', '扫码查看裁片单配料与领料信息', row.qrCodeValue || row.cutOrderQrValue]],
        minRows: 1,
      },
    ],
    qrDescription: '扫码查看裁片单配料与领料信息',
    qrValue: makeQrValue({
      documentType: 'MATERIAL_PREP_SLIP',
      sourceId: row.id,
      slipNo,
      sourceProductionOrderNo: row.productionOrderNo,
      targetRoute,
    }),
    signatureBlocks: [
      { label: '配料人签字', signerRole: '配料人' },
      { label: '复核人签字', signerRole: '复核人' },
      { label: '领料人签字', signerRole: '领料人' },
      { label: '备注', signerRole: '现场备注' },
    ],
    footerFields: [
      { label: '配料单号', value: slipNo },
      { label: '原始裁片单', value: row.originalCutOrderNo },
    ],
    returnHref: targetRoute,
  })
}

function allPickupSlips(): PickupSlip[] {
  return [...commonPickupSlips, ...cuttingPickupSlips]
}

export function buildPickupSlipPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const slip = allPickupSlips().find((item) => item.pickupSlipNo === input.sourceId || item.sourceTaskNo === input.sourceId || item.boundObjectNo === input.sourceId)
    || allPickupSlips()[0]
  if (!slip) throw new Error('缺少领料单来源数据')

  const printVersion = [...commonPickupPrintVersions, ...cuttingPickupPrintVersions]
    .find((item) => item.pickupSlipNo === slip.pickupSlipNo && item.isLatestVersion)
  const scanRecord = [...commonPickupScanRecords, ...cuttingPickupScanRecords].find((item) => item.pickupSlipNo === slip.pickupSlipNo)
  const noun = pickupObjectNoun(slip)
  const targetRoute = slip.scenarioType === 'CUTTING'
    ? `/fcs/pda/cutting/pickup/${encodeURIComponent(slip.sourceTaskNo)}`
    : `/fcs/pda/exec/${encodeURIComponent(slip.sourceTaskNo)}`
  const expectedQty = objectQtyText(slip.configuredQtySummary, noun)
  const actualQty = objectQtyText(slip.receivedQtySummary, noun)

  return buildBaseDocument({
    buildInput: input,
    kind: 'pickup',
    sourceId: slip.pickupSlipNo,
    title: '领料单',
    subtitle: '用于工厂或裁床从仓库领取面料、裁片、辅料或成衣，并完成扫码确认。',
    headerFields: mapFields([
      { label: '领料单号', value: slip.pickupSlipNo, emphasis: true },
      { label: '来源生产单', value: slip.productionOrderNo },
      { label: '来源任务', value: slip.sourceTaskNo },
      { label: '领料工厂', value: slip.factoryName },
      { label: '发料仓库', value: '仓库发料区' },
      { label: '领料状态', value: slip.currentStatus === 'READY_TO_PICKUP' ? '待领料' : slip.currentStatus === 'RECEIVED' ? '已领料' : '待复核' },
      { label: '打印版本', value: printVersion?.printVersionNo || slip.latestPrintVersionNo },
      { label: '打印时间', value: printVersion?.printedAt || now() },
      { label: '打印人', value: printVersion?.printedBy || '仓库管理员' },
    ]),
    sections: [
      {
        sectionId: 'base',
        title: '基础信息区',
        fields: mapFields([
          { label: '款号', value: '随生产单' },
          { label: '商品名称', value: slip.sourceTaskType || '生产任务物料' },
          { label: '工序 / 工艺', value: slip.sourceTaskType },
          { label: '领料对象类型', value: noun.replace('数量', '').replace('米数', '面料').replace('件数', '成衣') },
          { label: '计划领料对象数量', value: objectQtyText(slip.plannedQtySummary, noun) },
          { label: '已领对象数量', value: actualQty },
          { label: '差异对象数量', value: objectQtyDiff(slip.configuredQtySummary, slip.receivedQtySummary, noun) },
          { label: `应领${noun}`, value: expectedQty },
          { label: `实领${noun}`, value: actualQty },
          { label: `差异${noun}`, value: objectQtyDiff(slip.configuredQtySummary, slip.receivedQtySummary, noun) },
        ]),
      },
    ],
    tables: [
      {
        tableId: 'pickup-lines',
        title: '领料明细表',
        headers: ['对象类型', '物料 / 裁片 / 辅料说明', '编码 / SKU', '颜色', '尺码', '部位', '批次号', '卷号 / 菲票号 / 包号', '应领对象数量', '实领对象数量', '差异对象数量', '单位', '备注'],
        rows: [[
          noun,
          slip.sourceTaskType,
          slip.materialSku,
          '按生产单',
          '按生产单',
          slip.boundObjectType === 'CUT_PIECE_ORDER' ? '裁片单' : '任务物料',
          slip.boundObjectNo,
          slip.latestQrCodeValue,
          expectedQty,
          actualQty,
          objectQtyDiff(slip.configuredQtySummary, slip.receivedQtySummary, noun),
          slip.plannedQtySummary.unitLabel,
          scanRecord?.note || '扫码确认领料',
        ]],
        minRows: 5,
      },
    ],
    qrDescription: '扫码确认领料',
    qrValue: makeQrValue({
      documentType: 'PICKUP_SLIP',
      sourceId: slip.pickupSlipNo,
      slipNo: slip.pickupSlipNo,
      sourceProductionOrderNo: slip.productionOrderNo,
      targetRoute,
    }),
    signatureBlocks: [
      { label: '发料人签字', signerRole: '发料人' },
      { label: '领料人签字', signerRole: '领料人' },
      { label: '复核人签字', signerRole: '复核人' },
      { label: '备注', signerRole: '现场备注' },
    ],
    footerFields: [
      { label: '领料单号', value: slip.pickupSlipNo },
      { label: '打印版本', value: printVersion?.printVersionNo || slip.latestPrintVersionNo },
    ],
    returnHref: targetRoute,
  })
}

export function buildIssueSlipPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const orders = listCuttingSewingDispatchOrders()
  const order = orders.find((item) => item.dispatchOrderId === input.sourceId || item.dispatchOrderNo === input.sourceId) || orders[0]
  if (!order) throw new Error('缺少发料单来源数据')

  const batches = listCuttingSewingDispatchBatches().filter((batch) => batch.dispatchOrderId === order.dispatchOrderId)
  const targetRoute = `/fcs/craft/cutting/sewing-dispatch?dispatchOrderId=${encodeURIComponent(order.dispatchOrderId)}`
  const diffQty = order.differenceQty || order.remainingGarmentQty || 0

  return buildBaseDocument({
    buildInput: input,
    kind: 'issue',
    sourceId: order.dispatchOrderId,
    title: '发料单',
    subtitle: '用于仓库或裁床向工厂、工序或生产任务发出物料并完成签收。',
    headerFields: mapFields([
      { label: '发料单号', value: order.dispatchOrderNo, emphasis: true },
      { label: '来源生产单', value: order.productionOrderNo },
      { label: '来源任务', value: order.cuttingOrderNos.join('、') || '裁片发料任务' },
      { label: '发料仓库', value: order.cuttingFactoryName },
      { label: '接收工厂', value: order.sewingFactoryName },
      { label: '发料状态', value: order.status },
      { label: '打印时间', value: now() },
      { label: '打印人', value: '仓库发料员' },
    ]),
    sections: [
      {
        sectionId: 'base',
        title: '基础信息区',
        fields: mapFields([
          { label: '款号', value: '随生产单' },
          { label: '商品名称', value: '裁片发车缝' },
          { label: '工序 / 工艺', value: '裁片发料 / 车缝接收' },
          { label: '发料对象类型', value: '成衣' },
          { label: '计划发料对象数量', value: garmentQty(order.plannedDispatchGarmentQty) },
          { label: '已发对象数量', value: garmentQty(order.cumulativeDispatchedGarmentQty) },
          { label: '差异对象数量', value: garmentQty(diffQty) },
          { label: '应发成衣件数', value: garmentQty(order.plannedDispatchGarmentQty) },
          { label: '实发成衣件数', value: garmentQty(order.cumulativeDispatchedGarmentQty) },
          { label: '差异成衣件数', value: garmentQty(diffQty) },
        ]),
      },
    ],
    tables: [
      {
        tableId: 'issue-lines',
        title: '发料明细表',
        headers: ['对象类型', '物料 / 裁片 / 辅料说明', '编码 / SKU', '颜色', '尺码', '部位', '批次号', '卷号 / 菲票号 / 包号', '应发对象数量', '实发对象数量', '差异对象数量', '单位', '仓位', '备注'],
        rows: (batches.length ? batches : [{ dispatchBatchNo: order.dispatchOrderNo, plannedGarmentQty: order.plannedDispatchGarmentQty, plannedSkuQtyLines: [], feiTicketNos: [], status: order.status }] as any[])
          .flatMap((batch) => (batch.plannedSkuQtyLines?.length ? batch.plannedSkuQtyLines : [{ colorName: '按生产单', sizeCode: '汇总', plannedGarmentQty: batch.plannedGarmentQty, dispatchedGarmentQty: batch.plannedGarmentQty, remainingGarmentQty: 0 }]).map((line: any) => [
            '成衣',
            '车缝裁片包',
            order.cuttingOrderNos.join('、') || order.dispatchOrderNo,
            line.colorName || '按生产单',
            line.sizeCode || '按生产单',
            '成衣裁片',
            batch.dispatchBatchNo || order.dispatchOrderNo,
            order.feiTicketNos.slice(0, 3).join('、') || '按中转袋',
            garmentQty(line.plannedGarmentQty),
            garmentQty(line.dispatchedGarmentQty ?? line.plannedGarmentQty),
            garmentQty(line.remainingGarmentQty || 0),
            '件',
            '裁床发料区',
            batch.status || order.status,
          ])),
        minRows: 5,
      },
    ],
    qrDescription: '扫码查看发料记录',
    qrValue: makeQrValue({
      documentType: 'ISSUE_SLIP',
      sourceId: order.dispatchOrderId,
      slipNo: order.dispatchOrderNo,
      sourceProductionOrderNo: order.productionOrderNo,
      targetRoute,
    }),
    signatureBlocks: [
      { label: '发料人签字', signerRole: '发料人' },
      { label: '接收人签字', signerRole: '接收人' },
      { label: '复核人签字', signerRole: '复核人' },
      { label: '备注', signerRole: '现场备注' },
    ],
    footerFields: [
      { label: '发料单号', value: order.dispatchOrderNo },
      { label: '生产单', value: order.productionOrderNo },
    ],
    returnHref: targetRoute,
  })
}

export function buildSupplementMaterialSlipPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const record = replenishmentSuggestionRecords.find((item) => item.id === input.sourceId || item.replenishmentNo === input.sourceId)
    || replenishmentSuggestionRecords[0]
  if (!record) throw new Error('缺少补料单来源数据')

  const targetRoute = `/fcs/craft/cutting/replenishment?suggestionId=${encodeURIComponent(record.id)}`
  const approvedQty = record.reviewStatus === 'APPROVED' ? record.suggestedReplenishLength : 0

  return buildBaseDocument({
    buildInput: input,
    kind: 'supplement',
    sourceId: record.id,
    title: '补料单',
    subtitle: '用于记录因计划不足、损耗差异或执行异常产生的补料申请、审核和补发。',
    headerFields: mapFields([
      { label: '补料单号', value: record.replenishmentNo, emphasis: true },
      { label: '来源生产单', value: record.productionOrderNo },
      { label: '来源任务', value: record.cutPieceOrderNo },
      { label: '补料类型', value: record.materialLabel },
      { label: '补料状态', value: record.configStatus === 'CONFIGURED' ? '已补配' : '待补配' },
      { label: '审核状态', value: record.reviewStatus === 'APPROVED' ? '审核通过' : record.reviewStatus === 'REJECTED' ? '审核驳回' : '待审核' },
      { label: '打印时间', value: now() },
      { label: '打印人', value: '补料专员' },
    ]),
    sections: [
      {
        sectionId: 'reason',
        title: '补料原因区',
        fields: mapFields([
          { label: '补料原因', value: record.shortageReasonType === 'LENGTH_SHORTAGE' ? '面料长度缺口' : record.shortageReasonType === 'YIELD_RISK' ? '裁剪产出风险' : '现场差异复核' },
          { label: '原需求对象数量', value: garmentQty(record.requiredQty) },
          { label: '已配 / 已领 / 已用对象数量', value: `${materialQty(record.configuredLength)} / ${materialQty(record.receivedLength)} / ${materialQty(record.totalSpreadLength)}` },
          { label: '缺口对象数量', value: `${garmentQty(record.gapQty)} / ${materialQty(record.suggestedReplenishLength)}` },
          { label: '申请补料对象数量', value: materialQty(record.suggestedReplenishLength) },
          { label: '审核通过对象数量', value: record.reviewStatus === 'APPROVED' ? materialQty(approvedQty) : '待审核' },
          { label: '实发补料对象数量', value: record.configStatus === 'CONFIGURED' ? materialQty(record.configuredLength) : '待发料' },
          { label: '责任说明', value: record.impactPreview.impactDescription },
          { label: '备注', value: record.reviewComment || record.note },
          { label: '缺口面料米数', value: materialQty(record.suggestedReplenishLength) },
          { label: '申请补料面料米数', value: materialQty(record.suggestedReplenishLength) },
          { label: '审核通过面料米数', value: record.reviewStatus === 'APPROVED' ? materialQty(approvedQty) : '待审核' },
        ]),
      },
    ],
    tables: [
      {
        tableId: 'supplement-lines',
        title: '补料明细表',
        headers: ['对象类型', '物料 / 裁片 / 辅料说明', '编码 / SKU', '颜色', '尺码', '部位', '批次号', '卷号 / 菲票号 / 包号', '申请补料对象数量', '审核通过对象数量', '实发补料对象数量', '单位', '仓位', '备注'],
        rows: [[
          '面料',
          record.materialLabel,
          record.materialSku,
          record.markerSizeMixSummary,
          '按唛架配比',
          '裁片补料',
          record.cutPieceOrderNo,
          `${record.suggestedReplenishRollCount} 卷`,
          materialQty(record.suggestedReplenishLength),
          record.reviewStatus === 'APPROVED' ? materialQty(approvedQty) : '待审核',
          record.configStatus === 'CONFIGURED' ? materialQty(record.configuredLength) : '待发料',
          '米',
          '补料待配区',
          record.impactPreview.nextSuggestedActionText,
        ]],
        minRows: 5,
      },
    ],
    qrDescription: '扫码查看补料申请与发料记录',
    qrValue: makeQrValue({
      documentType: 'SUPPLEMENT_MATERIAL_SLIP',
      sourceId: record.id,
      slipNo: record.replenishmentNo,
      sourceProductionOrderNo: record.productionOrderNo,
      targetRoute,
    }),
    signatureBlocks: [
      { label: '申请人签字', signerRole: '申请人' },
      { label: '审核人签字', signerRole: '审核人' },
      { label: '发料人签字', signerRole: '发料人' },
      { label: '接收人签字', signerRole: '接收人' },
      { label: '备注', signerRole: '现场备注' },
    ],
    footerFields: [
      { label: '补料单号', value: record.replenishmentNo },
      { label: '来源裁片单', value: record.cutPieceOrderNo },
    ],
    returnHref: targetRoute,
  })
}

function renderFieldGrid(fields: PrintField[]): string {
  return `
    <div class="print-field-grid">
      ${fields.map((field) => `
        <div class="print-field ${field.emphasis ? 'print-field-emphasis' : ''}">
          <div class="print-field-label">${escapeHtml(field.label)}</div>
          <div class="print-field-value">${escapeHtml(field.value || '—')}</div>
        </div>
      `).join('')}
    </div>
  `
}

function renderTable(table: PrintDocument['tables'][number]): string {
  const rows = [...table.rows]
  while (rows.length < (table.minRows || 0)) {
    rows.push(Array.from({ length: table.headers.length }, () => ''))
  }

  return `
    <section class="print-section">
      <div class="print-section-title">${escapeHtml(table.title)}</div>
      <table class="print-table">
        <thead><tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${table.headers.map((_, index) => `<td>${escapeHtml(row[index] || '')}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </section>
  `
}

function renderSignatureBlocks(blocks: PrintDocument['signatureBlocks']): string {
  return `
    <section class="print-section print-avoid-break">
      <div class="print-section-title">签字区</div>
      <div class="print-signature-grid">
        ${blocks.map((block) => `
          <div class="print-signature-cell">
            <div class="print-signature-label">${escapeHtml(block.label)}</div>
            <div class="print-signature-role">${escapeHtml(block.signerRole)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

export function renderMaterialSlipTemplate(doc: PrintDocument): string {
  const image = doc.imageBlocks[0]
  const qr = doc.qrCodes[0]

  return `
    <article class="print-paper-a4">
      <div class="print-card-sheet">
        <header>
          <div class="print-card-title">${escapeHtml(doc.printTitle)}</div>
          <div class="print-card-subtitle">${escapeHtml(doc.printSubtitle)}</div>
        </header>

        <div class="print-main-grid">
          <section class="print-image-box">
            <div class="print-section-title">${escapeHtml(image?.title || '款式信息')}</div>
            ${
              image?.imageUrl
                ? `<div class="print-image-frame"><img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageLabel)}"></div>`
                : `<div class="print-image-placeholder">${escapeHtml(image?.fallbackLabel || '暂无商品图')}</div>`
            }
            <div class="print-note">${escapeHtml(image?.sourceLabel || '图片信息')}</div>
          </section>
          <section>
            <div class="print-section-title">页头区</div>
            ${renderFieldGrid(doc.headerFields)}
          </section>
          <section class="print-qr-box">
            <div class="print-section-title">${escapeHtml(qr?.title || '二维码区')}</div>
            <div class="print-qr-inner">
              ${qr ? renderRealQrPlaceholder({
                value: qr.value,
                size: 112,
                title: qr.title,
                label: qr.title,
              }) : ''}
            </div>
            <div class="print-note">${escapeHtml(qr?.description || '扫码查看单据')}</div>
          </section>
        </div>

        ${doc.sections.map((section) => `
          <section class="print-section">
            <div class="print-section-title">${escapeHtml(section.title)}</div>
            ${renderFieldGrid(section.fields)}
            ${section.note ? `<div class="print-note">${escapeHtml(section.note)}</div>` : ''}
          </section>
        `).join('')}

        ${doc.tables.map(renderTable).join('')}
        ${renderSignatureBlocks(doc.signatureBlocks)}

        <footer class="print-footer-fields">
          ${doc.footerFields.map((field) => `<span>${escapeHtml(field.label)}：${escapeHtml(field.value || '—')}</span>`).join('')}
        </footer>
      </div>
    </article>
  `
}

export const MaterialPrepSlipTemplate = renderMaterialSlipTemplate
export const PickupSlipTemplate = renderMaterialSlipTemplate
export const IssueSlipTemplate = renderMaterialSlipTemplate
export const SupplementMaterialSlipTemplate = renderMaterialSlipTemplate
export const MaterialTransferSlipTemplate = renderMaterialSlipTemplate

