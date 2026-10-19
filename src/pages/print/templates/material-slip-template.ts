import {
  formatPrintQty,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
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
import { getSewingPickupSlipVersion } from '../../../data/fcs/sewing-pickup-slips.ts'

import { buildBaseDocument, makeQrValue, mapFields, renderMaterialSlipTemplate } from './material-slip-layout.ts'
import { buildPpicPickupSlipPrintDocument } from './ppic-pickup-slip-template.ts'

export { renderMaterialSlipTemplate } from './material-slip-layout.ts'

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

export function buildMaterialPrepSlipPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const projection = buildMaterialPrepProjection()
  const row = projection.rowsById[input.sourceId]
    || projection.rows.find((item) => item.cutOrderId === input.sourceId || item.cutOrderNo === input.sourceId)
    || projection.rows[0]
  if (!row) throw new Error('缺少配料单来源数据')

  const slipNo = `PL-${row.cutOrderNo}`
  const targetRoute = `/fcs/craft/cutting/warehouse-management/wait-process?cutOrderId=${encodeURIComponent(row.cutOrderId)}`
  const generatedAt = now()

  return buildBaseDocument({
    buildInput: input,
    kind: 'prep',
    sourceId: row.id,
    title: '配料单',
    subtitle: '用于仓库按裁片单准备面料、复核配料缺口并衔接裁床接收。',
    headerFields: mapFields([
      { label: '配料单号', value: slipNo, emphasis: true },
      { label: '来源生产单', value: row.productionOrderNo },
      { label: '裁片单', value: row.cutOrderNo },
      { label: '裁片单二维码', value: row.shouldPrintQr ? '已生成' : row.qrHiddenHint || '待生成' },
      { label: '中转仓配料', value: row.materialPrepStatus.label },
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
          { label: '需求来源', value: '裁片单配料' },
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
            `${row.cutOrderNo}-B${index + 1}`,
            `${row.cutOrderNo}-R${index + 1}`,
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
        rows: [['裁片单二维码', '扫码查看裁片单配料与接收信息', row.qrCodeValue || row.cutOrderQrValue]],
        minRows: 1,
      },
    ],
    qrDescription: '扫码查看裁片单配料与接收信息',
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
      { label: '接收人签字', signerRole: '接收人' },
      { label: '备注', signerRole: '现场备注' },
    ],
    footerFields: [
      { label: '配料单号', value: slipNo },
      { label: '裁片单', value: row.cutOrderNo },
    ],
    returnHref: targetRoute,
  })
}

function allPickupSlips(): PickupSlip[] {
  return [...commonPickupSlips, ...cuttingPickupSlips]
}

export function buildPickupSlipPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const ppicVersion = getSewingPickupSlipVersion(input.sourceId)
  if (ppicVersion) return buildPpicPickupSlipPrintDocument(input, ppicVersion)
  const slip = allPickupSlips().find((item) => item.pickupSlipNo === input.sourceId || item.sourceTaskNo === input.sourceId || item.boundObjectNo === input.sourceId)
    || allPickupSlips()[0]
  if (!slip) throw new Error('缺少接收单来源数据')

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
    title: '接收单',
    subtitle: '用于工厂或裁床从仓库领取面料、裁片、辅料或成衣，并完成扫码确认。',
    headerFields: mapFields([
      { label: '接收单号', value: slip.pickupSlipNo, emphasis: true },
      { label: '来源生产单', value: slip.productionOrderNo },
      { label: '来源任务', value: slip.sourceTaskNo },
      { label: '接收工厂', value: slip.factoryName },
      { label: '发料仓库', value: '仓库发料区' },
      { label: '裁床接收', value: slip.currentStatus === 'READY_TO_PICKUP' ? '待接收' : slip.currentStatus === 'RECEIVED' ? '已接收' : '待复核' },
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
          { label: '接收对象类型', value: noun.replace('数量', '').replace('米数', '面料').replace('件数', '成衣') },
          { label: '计划接收对象数量', value: objectQtyText(slip.plannedQtySummary, noun) },
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
        title: '接收明细表',
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
          scanRecord?.note || '扫码确认接收',
        ]],
        minRows: 5,
      },
    ],
    qrDescription: '扫码确认接收',
    qrValue: makeQrValue({
      documentType: 'PICKUP_SLIP',
      sourceId: slip.pickupSlipNo,
      slipNo: slip.pickupSlipNo,
      sourceProductionOrderNo: slip.productionOrderNo,
      targetRoute,
    }),
    signatureBlocks: [
      { label: '发料人签字', signerRole: '发料人' },
      { label: '接收人签字', signerRole: '接收人' },
      { label: '复核人签字', signerRole: '复核人' },
      { label: '备注', signerRole: '现场备注' },
    ],
    footerFields: [
      { label: '接收单号', value: slip.pickupSlipNo },
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
  const targetRoute = `/fcs/craft/cutting/warehouse-management/wait-handover?tab=handoverOrders&dispatchOrderId=${encodeURIComponent(order.dispatchOrderId)}`
  const diffQty = order.differenceQty || order.remainingGarmentQty || 0

  return buildBaseDocument({
    buildInput: input,
    kind: 'issue',
    sourceId: order.dispatchOrderId,
    title: '交出单',
    subtitle: '用于裁床向接收对象交出裁片并完成签收。',
    headerFields: mapFields([
      { label: '交出单号', value: order.dispatchOrderNo, emphasis: true },
      { label: '来源生产单', value: order.productionOrderNo },
      { label: '来源任务', value: order.cuttingOrderNos.join('、') || '裁片交出任务' },
      { label: '交出仓库', value: order.cuttingFactoryName },
      { label: '接收对象', value: order.sewingFactoryName },
      { label: '交出状态', value: order.status },
      { label: '打印时间', value: now() },
      { label: '打印人', value: '仓库发料员' },
    ]),
    sections: [
      {
        sectionId: 'base',
        title: '基础信息区',
        fields: mapFields([
          { label: '款号', value: '随生产单' },
          { label: '商品名称', value: '裁片交出' },
          { label: '工序 / 工艺', value: '裁片交出 / 接收对象签收' },
          { label: '交出对象类型', value: '成衣' },
          { label: '计划交出对象数量', value: garmentQty(order.plannedDispatchGarmentQty) },
          { label: '已交出对象数量', value: garmentQty(order.cumulativeDispatchedGarmentQty) },
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
    qrDescription: '扫码查看交出记录',
    qrValue: makeQrValue({
      documentType: 'ISSUE_SLIP',
      sourceId: order.dispatchOrderId,
      slipNo: order.dispatchOrderNo,
      sourceProductionOrderNo: order.productionOrderNo,
      targetRoute,
    }),
    signatureBlocks: [
      { label: '交出人签字', signerRole: '交出人' },
      { label: '接收人签字', signerRole: '接收人' },
      { label: '复核人签字', signerRole: '复核人' },
      { label: '备注', signerRole: '现场备注' },
    ],
    footerFields: [
      { label: '交出单号', value: order.dispatchOrderNo },
      { label: '生产单', value: order.productionOrderNo },
    ],
    returnHref: targetRoute,
  })
}

export const MaterialPrepSlipTemplate = renderMaterialSlipTemplate
export const PickupSlipTemplate = renderMaterialSlipTemplate
export const IssueSlipTemplate = renderMaterialSlipTemplate
export const SupplementMaterialSlipTemplate = renderMaterialSlipTemplate
export const MaterialTransferSlipTemplate = renderMaterialSlipTemplate
