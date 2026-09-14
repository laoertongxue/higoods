// Keep existing registry imports stable; the two paper sheets can also load independently.
export { buildPrintingInfoSheetDocument, buildPrintingConfirmationDocument, renderPrintingInfoSheetDocument, renderPrintingConfirmationDocument, printingSheetQuantities } from './printing-sheet-template.ts'
import { isPrintablePrintingRoll } from '../../../data/fcs/printing-task-domain.ts'
import { printingMaterialCode } from '../../process-factory/printing/relations.ts'
import { formatPrintingQty, formatPrintingWeightKg, getPrintingWorkOrderById, type PrintingRollBarcode, type PrintingWorkOrderBusinessRecord } from '../../../data/fcs/printing-work-order-business.ts'
import { createPrintDocumentId, getPrintGeneratedAt, type PrintDocument, type PrintDocumentBuildInput, type PrintField } from '../../../data/fcs/print-service.ts'
import { renderLabelPrintTemplate } from './label-print-template.ts'
const ROLL_LABEL_TEMPLATE = 'PRINTING_ROLL_LABEL_V2'
const fields = (rows: Array<[string,string,boolean?]>): PrintField[] => rows.map(([label,value,emphasized])=>({label,value,emphasized}))

function parseRollSource(sourceId: string): { order: PrintingWorkOrderBusinessRecord; barcodes: PrintingRollBarcode[] } {
  const separator = sourceId.indexOf(':')
  const workOrderId = separator >= 0 ? sourceId.slice(0, separator) : sourceId
  const requested = separator >= 0 ? sourceId.slice(separator + 1).split(',').filter(Boolean) : []
  const order = getPrintingWorkOrderById(workOrderId)
  if (!order) throw new Error('未找到印花加工单，无法打印产出卷条码')
  const barcodes = requested.length ? order.barcodes.filter((barcode) => requested.includes(barcode.id)) : order.barcodes
  if (!barcodes.length) throw new Error('未选择产出卷条码')
  if (requested.some(id => !barcodes.some(barcode => barcode.id === id))) throw new Error('所选产出卷不存在或不属于本加工单，请重新选择')
  if (barcodes.some(barcode => !isPrintablePrintingRoll(order, barcode))) throw new Error('仅能打印已完成且正数量的产出卷；草稿不能打印')
  return { order, barcodes }
}

export function buildPrintingRollLabelDocument(input: PrintDocumentBuildInput): PrintDocument {
  const { order, barcodes } = parseRollSource(input.sourceId)
  const generatedAt = getPrintGeneratedAt()
  return {
    printDocumentId: createPrintDocumentId(input, ROLL_LABEL_TEMPLATE), documentType: 'PRINTING_ROLL_LABEL', documentTitle: '加工产出卷条码', sourceType: 'PRINTING_ROLL_RECORD', sourceId: input.sourceId,
    templateCode: ROLL_LABEL_TEMPLATE, paperType: 'LABEL_100_60', orientation: 'portrait', printTitle: '加工产出卷条码', printSubtitle: `${order.printOrderNo} · ${order.output.sku}`,
    headerFields: [], imageBlocks: [], qrCodes: [], barcodes: [], sections: [], tables: [], signatureBlocks: [], differenceBlocks: [], footerFields: [],
    labelSize: 'LABEL_100_60', labelLayout: '单张标签', printMode: '普通打印', relatedObjectIds: barcodes.map((barcode) => barcode.id),
    labelItems: barcodes.map((barcode) => ({
      labelTitle: '印花加工产出卷', labelSubtitle: `${order.printOrderNo} · 卷号 ${barcode.rollNo}`,
      labelFields: fields([
        ['产出 SKU', printingMaterialCode(barcode.sku, true), true], ['来源标识', barcode.sku], ['数量', `${formatPrintingQty(barcode.lengthY)} ${order.output.qtyUnit}`],
        [barcode.weightSource==='ACTUAL'?'实称重量':'理论重量', `${formatPrintingWeightKg(barcode.weightKg)} KG`], ['克重/幅宽', ['面料', '花边', '织带'].includes(order.output.objectType) ? `${barcode.gsm.toFixed(2)} g/㎡ / ${barcode.widthCm} cm` : '不适用'],
        ['缸号', barcode.vatNo || '—'], ['入库仓库', barcode.warehouseName], ['备注', barcode.remark || '—'],
      ]),
      barcode: { title: '卷条码', value: barcode.barcode, description: `${order.output.sku} · ${barcode.rollNo}` },
      qrCode: { title: '卷二维码', value: JSON.stringify({ type: 'PRINTING_OUTPUT_ROLL', workOrderId: order.workOrderId, barcodeId: barcode.id, outputSku: order.output.sku }), description: '扫码识别印花产出卷', sizeMm: 22 },
      printMode: '普通打印',
    })),
    printMeta: { generatedAt, generatedBy: 'Web 打印操作员', printNotice: '一卷一个条码；条码只绑定加工产出 SKU；KG 保留 3 位小数。', returnHref: `/fcs/craft/printing/work-orders/${encodeURIComponent(order.workOrderId)}` },
  }
}

export function renderPrintingRollLabelDocument(document: PrintDocument): string {
  return renderLabelPrintTemplate(document)
}
