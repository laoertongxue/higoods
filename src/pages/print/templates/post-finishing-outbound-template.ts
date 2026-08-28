import { renderCode128Barcode } from '../../../components/real-barcode.ts'
import { escapeHtml } from '../../../utils.ts'
import { findSkuArchiveByCode } from '../../../data/pcs-sku-archive-repository.ts'
import {
  createPrintDocumentId,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
  type PrintLabelItem,
} from '../../../data/fcs/print-service.ts'
import { getPostFinishingOutboundOrderById } from '../../../data/fcs/post-finishing-outbound-orders.ts'
import { renderGarmentSkuLabelTemplate } from './garment-sku-label-template.ts'

function requireOrder(sourceId: string) {
  const order = getPostFinishingOutboundOrderById(sourceId)
  if (!order) throw new Error(`未找到后道出货单：${sourceId}`)
  return order
}

export function buildPostFinishingOutboundOrderPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const order = requireOrder(input.sourceId)
  const generatedAt = getPrintGeneratedAt()
  return {
    printDocumentId: createPrintDocumentId(input, 'POST_FINISHING_OUTBOUND_ORDER_V1'),
    documentType: input.documentType,
    documentTitle: `后道出货单 ${order.outboundOrderNo}`,
    sourceType: 'POST_FINISHING_OUTBOUND_ORDER',
    sourceId: order.outboundOrderId,
    templateCode: 'POST_FINISHING_OUTBOUND_ORDER_V1',
    paperType: 'A4',
    orientation: 'portrait',
    printTitle: '后道出货单',
    printSubtitle: order.outboundOrderNo,
    headerFields: [
      { label: '出货单号', value: order.outboundOrderNo, emphasis: true },
      { label: '状态', value: order.status },
      { label: '工厂', value: order.managedPostFactoryName },
      { label: '来源动作', value: order.sourceActionLabel },
      { label: '出库仓', value: order.sourceWarehouseName },
      { label: '接收仓', value: order.targetWarehouseName },
      { label: '生产单号', value: order.productionOrderNo },
      { label: '任务单号', value: order.taskNo },
      { label: '来源对象', value: order.sourceObjectLabel },
      { label: '创建时间', value: order.createdAt },
    ],
    imageBlocks: [],
    qrCodes: [],
    barcodes: [{ title: '后道出货单条码', value: order.outboundOrderNo, description: order.outboundOrderNo }],
    sections: [],
    tables: [{
      tableId: 'post-finishing-outbound-lines',
      title: '出货明细',
      headers: ['序号', '图片 / 名称', '类型', 'SKU', '颜色', '尺码', '计划数量', '已入库数量', '单位'],
      rows: order.lines.map((line, index) => [
        String(index + 1),
        `${line.skuImageUrl || ''}\n${line.spuName}`,
        line.itemType,
        line.skuCode,
        line.colorName,
        line.sizeName,
        String(line.plannedQty),
        String(line.inboundQty),
        line.qtyUnit,
      ]),
    }],
    signatureBlocks: [],
    differenceBlocks: [],
    footerFields: [],
    printMeta: {
      generatedAt,
      generatedBy: order.operatorName,
      printNotice: '',
      returnHref: `/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(order.outboundOrderId)}`,
    },
    relatedObjectIds: [order.recheckOrderId, order.qcOrderId, order.postOrderId || ''].filter(Boolean),
  }
}

function fallbackBarcode(skuCode: string): string {
  let hash = 0
  for (const character of skuCode) hash = (hash * 31 + character.charCodeAt(0)) % 10_000_000
  return `HG${String(hash).padStart(7, '0')}`
}

export function buildPostFinishingOutboundBarcodePrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const order = requireOrder(input.sourceId)
  const generatedAt = getPrintGeneratedAt()
  const date = generatedAt.slice(0, 10)
  const labelItems: PrintLabelItem[] = order.lines.map((line) => {
    const sku = findSkuArchiveByCode(line.skuCode)
    const barcode = sku?.barcode || fallbackBarcode(line.skuCode)
    return {
      labelTitle: line.skuCode,
      labelFields: [
        { label: '日期', value: date },
        { label: 'SKU', value: line.skuCode },
      ],
      barcode: { title: barcode, value: barcode, description: barcode },
      labelWarnings: [],
    }
  })
  return {
    printDocumentId: createPrintDocumentId(input, 'POST_FINISHING_OUTBOUND_BARCODE_V1'),
    documentType: input.documentType,
    documentTitle: 'SKU 条码',
    sourceType: 'POST_FINISHING_OUTBOUND_ORDER',
    sourceId: order.outboundOrderId,
    templateCode: 'POST_FINISHING_OUTBOUND_BARCODE_V1',
    paperType: 'LABEL_40_30',
    orientation: 'portrait',
    printTitle: 'SKU 条码',
    printSubtitle: '',
    headerFields: [],
    imageBlocks: [],
    qrCodes: [],
    barcodes: labelItems.flatMap((item) => item.barcode ? [item.barcode] : []),
    sections: [],
    tables: [],
    signatureBlocks: [],
    differenceBlocks: [],
    footerFields: [],
    printMeta: {
      generatedAt,
      generatedBy: order.operatorName,
      printNotice: '',
      returnHref: `/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(order.outboundOrderId)}`,
    },
    labelSize: 'LABEL_40_30',
    labelLayout: '单张标签',
    printMode: '普通打印',
    labelItems,
    relatedObjectIds: [order.recheckOrderId],
    totalCopies: labelItems.length,
  }
}

function renderImageCell(value: string): string {
  const [imageUrl, ...nameParts] = value.split('\n')
  const name = nameParts.join('\n')
  return `<div class="outbound-print-product">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden')"><span class="hidden">图片加载失败</span>` : '<span>无图</span>'}<b>${escapeHtml(name)}</b></div>`
}

export function renderPostFinishingOutboundOrderTemplate(document: PrintDocument): string {
  const table = document.tables[0]
  const field = (label: string) => document.headerFields.find((item) => item.label === label)?.value || ''
  return `<style>
    @media print { @page { size: A4 portrait; margin: 10mm; } }
    .post-outbound-print { box-sizing: border-box; width: 190mm; min-height: 277mm; margin: 0 auto; padding: 4mm 5mm; background: #fff; color: #111; font-family: Arial, "Microsoft YaHei", sans-serif; }
    .post-outbound-print h1 { margin: 0 0 4mm; text-align: center; font-size: 18pt; }
    .post-outbound-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-left: 1px solid #222; border-top: 1px solid #222; font-size: 9pt; }
    .post-outbound-meta div { display: grid; grid-template-columns: 28mm 1fr; border-right: 1px solid #222; border-bottom: 1px solid #222; }
    .post-outbound-meta span, .post-outbound-meta b { padding: 2mm; font-weight: 400; }
    .post-outbound-meta span { background: #f5f5f5; }
    .post-outbound-print h2 { margin: 5mm 0 2mm; font-size: 11pt; }
    .post-outbound-print table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7.5pt; }
    .post-outbound-print th, .post-outbound-print td { border: 1px solid #222; padding: 1.5mm; text-align: center; overflow-wrap: anywhere; }
    .post-outbound-print th { background: #f1f1f1; }
    .outbound-print-product { display: flex; align-items: center; gap: 1.5mm; text-align: left; }
    .outbound-print-product img { width: 10mm; height: 13mm; object-fit: cover; }
    .outbound-print-product b { font-weight: 400; }
    .post-outbound-footer { margin-top: 5mm; text-align: right; font-size: 7pt; color: #444; }
    .hidden { display: none !important; }
  </style><article class="post-outbound-print" data-post-finishing-outbound-print>
    <h1>后道出货单</h1>
    <section class="post-outbound-meta">
      ${document.headerFields.map((item) => `<div><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.value)}</b></div>`).join('')}
    </section>
    <h2>${escapeHtml(table?.title || '出货明细')}</h2>
    <table><thead><tr>${(table?.headers || []).map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>
      ${(table?.rows || []).map((row) => `<tr>${row.map((value, index) => `<td>${index === 1 ? renderImageCell(value) : escapeHtml(value)}</td>`).join('')}</tr>`).join('')}
    </tbody></table>
    <div class="post-outbound-footer">打印时间：${escapeHtml(document.printMeta.generatedAt)} · ${escapeHtml(field('出货单号'))}</div>
  </article>`
}

export function renderPostFinishingOutboundBarcodeTemplate(document: PrintDocument): string {
  return renderGarmentSkuLabelTemplate(document)
}
