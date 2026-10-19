import { formatPrintQty, type PrintDocument, type PrintDocumentBuildInput } from '../../../data/fcs/print-service.ts'
import type { SewingPickupSlipVersion } from '../../../data/fcs/sewing-pickup-slips.ts'
import { buildBaseDocument, makeQrValue, mapFields } from './material-slip-layout.ts'

export { renderMaterialSlipTemplate } from './material-slip-layout.ts'

export function buildPpicPickupSlipPrintDocument(input: PrintDocumentBuildInput, slip: SewingPickupSlipVersion): PrintDocument {
  const objectLabel = slip.objectKind === 'CUT_PIECE' ? '裁片' : slip.objectKind === 'ACCESSORY' ? '辅料' : '面辅料'
  const targetRoute = `/fcs/pda/handover?tab=handout&sewingPickupVersionId=${encodeURIComponent(slip.versionId)}`
  const imageBlocks: PrintDocument['imageBlocks'] = [
    {
      title: '款式信息',
      imageUrl: slip.styleImageUrl,
      imageLabel: `${slip.styleCode} ${slip.styleName}款式图`,
      sourceLabel: `${slip.styleCode} · ${slip.styleName}`,
      fallbackLabel: '款式图加载失败',
    },
    ...slip.lines
      .filter((line) => line.objectType !== '裁片')
      .filter((line, index, rows) => rows.findIndex((item) => item.objectCode === line.objectCode) === index)
      .map((line) => ({
        title: `${line.objectType}图片`,
        imageUrl: line.imageUrl,
        imageLabel: `${line.objectCode} ${line.objectName}正式物料图`,
        sourceLabel: `${line.objectCode} · ${line.objectName}`,
        fallbackLabel: '物料图加载失败',
      })),
  ]
  return buildBaseDocument({
    buildInput: input,
    kind: 'pickup',
    sourceId: slip.versionId,
    title: `${objectLabel}领料单`,
    subtitle: 'PPIC持单领取；交出仓扫描当前有效版本后记录本次实交，打印本身不改变数量。',
    headerFields: mapFields([
      { label: '领料单号', value: slip.slipNo, emphasis: true },
      { label: '打印版本', value: `${slip.versionLabel} · ${slip.status === 'CURRENT' ? '当前有效' : '已失效'}` },
      { label: '执行任务', value: slip.taskNo },
      { label: '生产单', value: slip.productionOrderNo },
      { label: '任务类型', value: slip.taskKindLabel },
      { label: '承接工厂', value: slip.factoryName },
      { label: '任务PPIC', value: slip.ppicName },
      { label: '交出仓库', value: slip.warehouseName },
      { label: '打印时间', value: slip.printedAt },
      { label: '打印人', value: slip.printedByPpicName },
    ]),
    sections: [{
      sectionId: 'quantity-rule',
      title: '现场核对口径',
      fields: mapFields([
        { label: '领料对象', value: objectLabel },
        { label: '应领', value: '执行任务冻结需求' },
        { label: '此前已领', value: '此前有效交出累计' },
        { label: '本次可领', value: '应领减此前已领，不小于0' },
        { label: '本次实领', value: '由交出仓扫码后填写' },
        { label: '差异', value: '扫码确认时按明细保存' },
      ]),
    }],
    tables: [{
      tableId: 'ppic-pickup-lines',
      title: `${objectLabel}领料明细`,
      headers: ['对象', '编码 / SKU', '颜色 / 规格', '尺码', '部位', '应领', '此前已领', '本次可领', '本次实领', '差异', '单位'],
      rows: slip.lines.map((line) => [
        `${line.objectType} · ${line.objectName}`,
        line.objectCode,
        line.color,
        line.size,
        line.part,
        formatPrintQty(line.requiredQty, line.unit),
        formatPrintQty(line.previouslyHandedOverQty, line.unit),
        formatPrintQty(line.availableQty, line.unit),
        '现场扫码填写',
        '扫码后计算',
        line.unit,
      ]),
      minRows: 5,
    }],
    qrDescription: '交出仓扫描后核对当前有效版本并记录本次实交',
    qrValue: makeQrValue({
      documentType: 'PICKUP_SLIP',
      sourceId: slip.versionId,
      slipNo: slip.slipNo,
      sourceProductionOrderNo: slip.productionOrderNo,
      targetRoute,
    }),
    signatureBlocks: [
      { label: '交出人签字', signerRole: slip.warehouseName },
      { label: '领取人签字', signerRole: `任务PPIC ${slip.ppicName}` },
      { label: '复核人签字', signerRole: '仓库复核人' },
      { label: '现场备注', signerRole: '差异与批次说明' },
    ],
    footerFields: [
      { label: '领料单号', value: slip.slipNo },
      { label: '二维码版本', value: slip.versionLabel },
    ],
    returnHref: '/fcs/sewing-outsourcing/tasks',
    imageBlocks,
  })
}
