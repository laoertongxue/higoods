import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  createPrintDocumentId,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
  type PrintDocumentType,
  type PrintField,
} from '../../../data/fcs/print-service.ts'

type MaterialSlipKind = 'prep' | 'pickup' | 'issue'

const TEMPLATE_BY_KIND: Record<MaterialSlipKind, string> = {
  prep: 'MATERIAL_PREP_SLIP',
  pickup: 'PICKUP_SLIP',
  issue: 'ISSUE_SLIP',
}

export function mapFields(rows: Array<{ label: string; value: string; emphasis?: boolean }>): PrintField[] {
  return rows.map((row) => ({ label: row.label, value: row.value, emphasis: row.emphasis }))
}


export function makeQrValue(input: {
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

export function buildBaseDocument(input: {
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
  imageUrl?: string
  imageBlocks?: PrintDocument['imageBlocks']
  imageLabel?: string
  imageSourceLabel?: string
}): PrintDocument {
  const generatedAt = getPrintGeneratedAt()
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
    imageBlocks: input.imageBlocks || [
      {
        title: '款式信息',
        imageUrl: input.imageUrl || '',
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

function renderPickupSlipImage(image: PrintDocument['imageBlocks'][number]): string {
  if (!image.imageUrl) return `<div class="print-image-placeholder" data-print-image-missing>${escapeHtml(image.fallbackLabel)}</div>`
  return `<div data-print-image-frame><button type="button" class="print-image-frame" style="width:100%;padding:0;border-radius:0" data-print-image-url="${escapeHtml(image.imageUrl)}" data-print-image-title="${escapeHtml(image.imageLabel)}" aria-label="查看${escapeHtml(image.imageLabel)}大图"><img data-print-image src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageLabel)}" loading="eager"></button><span data-print-image-loading class="print-hidden">图片加载中…</span><span data-print-image-error hidden class="print-hidden">图片加载失败：${escapeHtml(image.imageLabel)} <button type="button" data-print-image-retry>重试图片</button></span></div>`
}

function renderAdditionalImages(images: PrintDocument['imageBlocks'], pickupSlip: boolean): string {
  if (!images.length) return ''
  return `<section class="print-section print-avoid-break"><div class="print-section-title">物料图片</div><div class="grid grid-cols-3 gap-3">${images.map((image) => `<div class="rounded border p-2">${pickupSlip ? renderPickupSlipImage(image) : image.imageUrl ? `<div class="print-image-frame"><img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageLabel)}"></div>` : `<div class="print-image-placeholder">${escapeHtml(image.fallbackLabel)}</div>`}<div class="print-note">${escapeHtml(image.sourceLabel)}</div></div>`).join('')}</div></section>`
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
              doc.documentType === 'PICKUP_SLIP' && image
                ? renderPickupSlipImage(image)
                : image?.imageUrl
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

        ${renderAdditionalImages(doc.imageBlocks.slice(1), doc.documentType === 'PICKUP_SLIP')}

        ${doc.tables.map(renderTable).join('')}
        ${renderSignatureBlocks(doc.signatureBlocks)}

        <footer class="print-footer-fields">
          ${doc.footerFields.map((field) => `<span>${escapeHtml(field.label)}：${escapeHtml(field.value || '—')}</span>`).join('')}
        </footer>
      </div>
    </article>
  `
}
