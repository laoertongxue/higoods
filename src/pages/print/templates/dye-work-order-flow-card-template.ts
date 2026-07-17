import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import {
  createPrintDocumentId,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
  type PrintField,
} from '../../../data/fcs/print-service.ts'
import { listDyeWorkOrderOnlineRows, type DyeWorkOrderOnlineRow } from '../../../data/fcs/dye-work-order-online-view.ts'
import { escapeHtml } from '../../../utils.ts'

type FlowCardInput = PrintDocumentBuildInput | string

function resolveInput(input: FlowCardInput): PrintDocumentBuildInput {
  return typeof input === 'string'
    ? { documentType: 'TASK_ROUTE_CARD', sourceType: 'DYEING_WORK_ORDER', sourceId: input }
    : input
}

function formatQty(value: number, unit: string): string {
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`
}

function fields(rows: Array<[string, string, boolean?]>): PrintField[] {
  return rows.map(([label, value, emphasis]) => ({ label, value: value || '—', emphasis }))
}

function buildSingle(input: PrintDocumentBuildInput, row: DyeWorkOrderOnlineRow): PrintDocument {
  const generatedAt = getPrintGeneratedAt()
  const targetRoute = `/fcs/craft/dyeing/work-orders?dyeOrderId=${encodeURIComponent(row.dyeOrderId)}`
  const qrPayload = new URLSearchParams({
    documentType: 'TASK_ROUTE_CARD',
    sourceType: 'DYEING_WORK_ORDER',
    sourceId: row.dyeOrderId,
    workOrderNo: row.workOrderNo,
    targetRoute,
  }).toString()
  return {
    printDocumentId: createPrintDocumentId({ ...input, sourceId: row.dyeOrderId }, 'DYEING_WORK_ORDER_FLOW_CARD'),
    documentType: 'TASK_ROUTE_CARD',
    documentTitle: '染整生产流程卡',
    sourceType: 'DYEING_WORK_ORDER',
    sourceId: row.dyeOrderId,
    templateCode: 'DYEING_WORK_ORDER_FLOW_CARD',
    paperType: 'A4',
    orientation: 'portrait',
    printTitle: '染整生产流程卡',
    printSubtitle: 'Kartu Alur Produksi Pencelupan dan Penyempurnaan',
    headerFields: fields([
      ['卡序号 Urutan kartu', '1', true],
      ['平台加工单号', row.workOrderNo, true],
      ['下单日期 Tgl', row.orderedAt.split(' ')[0] || row.orderedAt],
      ['是否加急 Mendesak', row.isOverdue ? '是 Ya' : '否 Tidak'],
      ['开单日期 Tgl buka', generatedAt],
      ['生产单号 No. Produksi', row.productionOrderNo || '备货创建'],
    ]),
    imageBlocks: [
      { title: '色样备注 Cat sampel', imageUrl: row.materialImageUrl, imageLabel: row.colorNo, sourceLabel: '色卡 / 面料样', fallbackLabel: '暂无色样' },
      { title: '商品 SPU', imageUrl: row.productImageUrl, imageLabel: row.productCode, sourceLabel: '商品资料', fallbackLabel: '暂无商品图' },
    ],
    qrCodes: [{ title: '染色加工单二维码', value: qrPayload, description: '扫码查看平台染色加工单', sizeMm: 32 }],
    barcodes: [],
    sections: [
      {
        sectionId: 'color-sample',
        title: '色样与商品信息 Informasi sampel warna dan produk',
        fields: fields([
          ['色样备注 Cat sampel', row.colorNo],
          ['纱线 RAINBOW 色卡', row.colorNo],
          ['辅料 GCC 色卡', '—'],
          ['TPG 色卡', '—'],
          ['TCX 色卡', '—'],
          ['样衣 SPU', row.productCode],
          ['布料样品 SPU', row.productCode],
          ['翻单 SPU', row.productCode],
          ['批号 No. batch', row.batchNo],
        ]),
      },
      {
        sectionId: 'material',
        title: '原料信息 Informasi bahan baku',
        fields: fields([
          ['布料供应商 Pemasok kain', '亿程'],
          ['原料名称 Nama bahan baku', row.materialName],
          ['色号 No. Warna', row.colorNo, true],
          ['原料 Bahan baku', row.rawMaterialSku, true],
          ['颜色 Warna', row.colorSku],
          ['数量 Kuantitas (KG/Y)', formatQty(row.plannedQty, row.qtyUnit), true],
          ['匹数 Jml gulungan kain', `${row.rawMaterialRollCount} 卷`],
          ['成分 Formula pencelupan', row.composition],
          ['幅宽 Lebar', row.width],
          ['克重 Berat (gram)', row.weightGsm ? `${row.weightGsm}G` : '—'],
        ]),
      },
      {
        sectionId: 'preparation',
        title: '备料 Persiapan bahan baku',
        fields: fields([
          ['松布 Pelonggaran kain', ''],
          ['装袋 Pengemasan ke dalam kantong', ''],
          ['卷支 Jumlah roll atau gulungan', ''],
          ['络筒 Penggulungan benang ke tabung', ''],
        ]),
      },
    ],
    tables: [
      {
        tableId: 'dye-flow-signoff',
        title: '现场流程签认 Proses dan tanda tangan lapangan',
        headers: ['工序 Proses', '开始时间 Waktu mulai', '完成时间 Waktu selesai', '操作人 Operator', '签字 Tanda tangan'],
        rows: [
          ['复样 Pencocokan sampel/duplikasi sampel', '', '', '', ''],
          ['染色 Pencelupan', '', '', '', ''],
          ['脱水 Penghilangan air', '', '', '', ''],
          ['开幅 Pembukaan kain', '', '', '', ''],
          ['烘干 Pengeringan', '', '', '', ''],
          ['定型 Finishing', '', '', '', ''],
          ['包装 Kemasan', '', '', '', ''],
          ['出货 Pengiriman', '', '', '', ''],
        ],
        minRows: 8,
      },
    ],
    signatureBlocks: [
      { label: '染厂主管签字', signerRole: 'Supervisor pencelupan' },
      { label: '面料接收人签字', signerRole: row.receiverName || 'Penerima kain' },
    ],
    differenceBlocks: [],
    footerFields: [
      { label: '备注 Catatan', value: row.remark || '—' },
      { label: '打印时间', value: generatedAt },
    ],
    printMeta: {
      generatedAt,
      generatedBy: '系统自动生成',
      printNotice: '打印前请在浏览器打印设置中关闭页眉和页脚',
      returnHref: targetRoute,
    },
    printVersionNo: 'V1',
    qrPayload,
  }
}

export function buildDyeWorkOrderFlowCardPrintDocument(input: FlowCardInput): PrintDocument {
  const resolved = resolveInput(input)
  const ids = resolved.sourceId.split(',').map((item) => item.trim()).filter(Boolean)
  if (!ids.length) throw new Error('缺少染色加工单 ID')
  const allRows = listDyeWorkOrderOnlineRows()
  const rows = ids.map((id) => allRows.find((row) => row.dyeOrderId === id)).filter((row): row is DyeWorkOrderOnlineRow => Boolean(row))
  if (rows.length !== ids.length) throw new Error('染色加工单不存在，无法打印流程卡')
  const document = buildSingle(resolved, rows[0]!)
  if (ids.length > 1) {
    document.sourceId = resolved.sourceId
    document.relatedObjectIds = ids
    document.batchPrintId = `DYE-FLOW-BATCH-${ids.join('-')}`
    document.printDocumentId = createPrintDocumentId(resolved, 'DYEING_WORK_ORDER_FLOW_CARD_BATCH')
  }
  return document
}

function renderFields(items: PrintField[]): string {
  return `<div class="print-field-grid">${items.map((item) => `<div class="print-field ${item.emphasis ? 'print-field-emphasis' : ''}"><div class="print-field-label">${escapeHtml(item.label)}</div><div class="print-field-value">${escapeHtml(item.value || '—')}</div></div>`).join('')}</div>`
}

function renderImageBlocks(document: PrintDocument): string {
  return `<section class="print-production-image-grid print-dye-image-grid">${document.imageBlocks.map((item) => `<figure class="print-production-image-card"><figcaption><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.imageLabel || item.sourceLabel || '')}</span></figcaption>${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}">` : `<div class="print-image-fallback">${escapeHtml(item.fallbackLabel || '暂无图片')}</div>`}</figure>`).join('')}</section>`
}

function renderSingle(document: PrintDocument, sequence = 1, total = 1): string {
  const qr = document.qrCodes[0]
  const headerFields = document.headerFields.map((item) => item.label.startsWith('卡序号') ? { ...item, value: String(sequence) } : item)
  return `<article class="print-paper-a4"><div class="print-card-sheet">
    <header class="print-card-title-row"><div class="print-card-sequence" aria-label="卡序号 ${sequence}">${sequence}</div><div><div class="print-card-title">${escapeHtml(document.printTitle)}</div><div class="print-card-subtitle">${escapeHtml(document.printSubtitle)}</div></div>${total > 1 ? `<div class="print-card-page-count">${sequence} / ${total}</div>` : ''}</header>
    <div class="print-main-grid">${renderImageBlocks(document)}<section><div class="print-section-title">基础信息 Informasi dasar</div>${renderFields(headerFields)}</section><section class="print-qr-box"><div class="print-section-title">${escapeHtml(qr?.title || '二维码')}</div><div class="print-qr-inner">${qr ? renderRealQrPlaceholder({ value: qr.value, size: 112, title: qr.title, label: qr.title }) : ''}</div></section></div>
    ${document.sections.map((section) => `<section class="print-section"><div class="print-section-title">${escapeHtml(section.title)}</div>${renderFields(section.fields)}</section>`).join('')}
    ${document.tables.map((table) => `<section class="print-section"><div class="print-section-title">${escapeHtml(table.title)}</div><table class="print-table"><thead><tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell || ' ')}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`).join('')}
    <section class="print-section print-avoid-break"><div class="print-section-title">签字区 Tanda tangan</div><div class="print-signature-grid">${document.signatureBlocks.map((block) => `<div class="print-signature-cell"><div class="print-signature-label">${escapeHtml(block.label)}</div><div class="print-signature-role">${escapeHtml(block.signerRole)}</div></div>`).join('')}</div></section>
    <footer class="print-footer-fields">${document.footerFields.map((item) => `<span>${escapeHtml(item.label)}：${escapeHtml(item.value || '—')}</span>`).join('')}</footer>
  </div></article>`
}

export function renderDyeWorkOrderFlowCardTemplate(document: PrintDocument): string {
  const ids = document.relatedObjectIds || [document.sourceId]
  if (ids.length === 1) return renderSingle(document)
  return ids.map((id, index) => renderSingle(buildDyeWorkOrderFlowCardPrintDocument(id), index + 1, ids.length)).join('')
}
