import { renderCode128Barcode } from '../../../components/real-barcode.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  createPrintDocumentId,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
  type PrintLabelItem,
} from '../../../data/fcs/print-service.ts'
import { listGarmentPrintRows } from '../../../data/fcs/garment-spu-replacement.ts'
import { findStyleArchiveByCode } from '../../../data/pcs-style-archive-repository.ts'

const ONLINE_WASHING_STANDARD = 'GB/T 2660 2017'
const ONLINE_SAFETY_CATEGORY = 'B'

function formatLabelDate(generatedAt: string): string {
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(generatedAt)
  if (!match) return generatedAt.slice(0, 10)
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function formatRupiah(value: number): string {
  const amount = value > 0 && value < 10_000 ? value * 1_000 : value
  return `Rp. ${Math.round(Math.max(amount, 0)).toLocaleString('en-US')}`
}

function buildLabelItems(input: PrintDocumentBuildInput, generatedAt: string): PrintLabelItem[] {
  const rows = listGarmentPrintRows(input.sourceId)
  if (!rows.length) throw new Error('当前单据没有可打印的成衣 SKU。')
  const isHangtag = input.documentType === 'GARMENT_HANGTAG'
  return rows.map((row) => {
    const style = findStyleArchiveByCode(row.identity.spuCode)
    const brandName = style?.brandName || style?.styleNameEn || row.identity.spuName || row.identity.spuCode
    const categoryName = style?.subCategoryName || style?.categoryName || "Women's Tops"
    return {
      labelTitle: isHangtag ? brandName : row.identity.skuCode,
      labelSubtitle: isHangtag ? categoryName : formatLabelDate(generatedAt),
      labelFields: isHangtag
        ? [
            { label: 'Kategori', value: categoryName },
            { label: 'SPU', value: row.identity.spuCode },
            { label: 'Metode pencucian', value: '' },
            { label: 'Standar implementasi', value: ONLINE_WASHING_STANDARD },
            { label: 'Kategori keamanan', value: ONLINE_SAFETY_CATEGORY },
            { label: 'Harga', value: formatRupiah(row.identity.suggestedRetailPrice) },
          ]
        : [
            { label: '日期', value: formatLabelDate(generatedAt) },
            { label: 'SKU', value: row.identity.skuCode },
          ],
      barcode: {
        title: isHangtag ? `${row.identity.shipmentBarcode}-0` : row.identity.shipmentBarcode,
        value: isHangtag ? `${row.identity.shipmentBarcode}-0` : row.identity.shipmentBarcode,
        description: isHangtag ? `${row.identity.shipmentBarcode}-0` : row.identity.shipmentBarcode,
      },
      secondaryBarcode: isHangtag
        ? {
            title: row.identity.retailBarcode,
            value: row.identity.retailBarcode,
            description: row.identity.retailBarcode,
          }
        : undefined,
      labelWarnings: [],
    }
  })
}

export function buildGarmentSkuLabelPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const generatedAt = getPrintGeneratedAt()
  const labelItems = buildLabelItems(input, generatedAt)
  const isHangtag = input.documentType === 'GARMENT_HANGTAG'
  const templateCode = isHangtag ? 'GARMENT_HANGTAG_V2' : 'GARMENT_SKU_BARCODE_V2'
  return {
    printDocumentId: createPrintDocumentId(input, templateCode),
    documentType: input.documentType,
    documentTitle: isHangtag ? '商品标签' : 'SKU 条码',
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    templateCode,
    paperType: isHangtag ? 'LABEL_40_100' : 'LABEL_40_30',
    orientation: 'portrait',
    printTitle: isHangtag ? '商品标签' : 'SKU 条码',
    printSubtitle: '',
    headerFields: [],
    imageBlocks: [],
    qrCodes: [],
    barcodes: labelItems.flatMap((item) => [item.barcode, item.secondaryBarcode].filter(Boolean) as NonNullable<PrintLabelItem['barcode']>[]),
    sections: [],
    tables: [],
    signatureBlocks: [],
    differenceBlocks: [],
    footerFields: [],
    printMeta: {
      generatedAt,
      generatedBy: '当前登录用户',
      printNotice: '',
      returnHref: input.sourceType === 'GARMENT_WAREHOUSE_RELABEL_TASK'
        ? '/wls/garment-relabel-tasks'
        : '/fcs/production/orders',
    },
    labelSize: isHangtag ? 'LABEL_40_100' : 'LABEL_40_30',
    labelLayout: '单张标签',
    printMode: '普通打印',
    labelItems,
    relatedObjectIds: [input.sourceId],
    totalCopies: labelItems.length,
  }
}

function fieldValue(item: PrintLabelItem, label: string): string {
  return item.labelFields.find((field) => field.label === label)?.value || ''
}

function renderBarcode(value: string, ariaLabel: string, className: string): string {
  return `<div class="${className}" data-online-barcode>${renderCode128Barcode(value, ariaLabel)}</div>`
}

function renderWashingIcons(): string {
  return `<div class="online-hangtag-washing-icons" aria-label="洗涤方式图标">
    <svg viewBox="0 0 24 20" aria-hidden="true"><path d="M3 7h18l-2 11H5L3 7Zm2-4c2 3 4 3 7 0 3 3 5 3 7 0"/></svg>
    <svg viewBox="0 0 24 20" aria-hidden="true"><path d="m12 2 9 16H3L12 2Z"/><path d="m8 14 8-8"/></svg>
    <svg viewBox="0 0 24 20" aria-hidden="true"><rect x="3" y="2" width="18" height="16" rx="1"/><circle cx="12" cy="10" r="5"/></svg>
    <svg viewBox="0 0 24 20" aria-hidden="true"><path d="M3 14h18l-3-8H8l-5 8Zm5-8V3h7"/><path d="M7 17h10"/></svg>
  </div>`
}

function renderBarcodeLabel(item: PrintLabelItem): string {
  const date = fieldValue(item, '日期')
  const sku = fieldValue(item, 'SKU')
  const barcodeValue = item.barcode?.value || ''
  return `<article class="online-sku-barcode" data-online-print-layout="sku-barcode">
    ${renderBarcode(barcodeValue, `SKU 条码 ${barcodeValue}`, 'online-sku-barcode-bars')}
    <div class="online-sku-barcode-code">${escapeHtml(barcodeValue)}</div>
    <div class="online-sku-barcode-date">${escapeHtml(date)}</div>
    <div class="online-sku-barcode-sku">${escapeHtml(sku)}</div>
  </article>`
}

function renderHangtag(item: PrintLabelItem): string {
  const shipmentBarcode = item.barcode?.value || ''
  const retailBarcode = item.secondaryBarcode?.value || ''
  return `<article class="online-garment-hangtag" data-online-print-layout="garment-hangtag">
    <div class="online-hangtag-color-dot" data-online-color-dot aria-hidden="true"></div>
    <strong class="online-hangtag-brand">${escapeHtml(item.labelTitle)}</strong>
    <div class="online-hangtag-field"><span>Kategori:</span> ${escapeHtml(fieldValue(item, 'Kategori'))}</div>
    <div class="online-hangtag-field"><span>SPU:</span> ${escapeHtml(fieldValue(item, 'SPU'))}</div>
    <div class="online-hangtag-field online-hangtag-washing"><span>Metode pencucian:</span></div>
    ${renderWashingIcons()}
    <div class="online-hangtag-field online-hangtag-standard"><span>Standar implementasi:</span><b>${escapeHtml(fieldValue(item, 'Standar implementasi'))}</b></div>
    <div class="online-hangtag-field"><span>Kategori keamanan:</span> ${escapeHtml(fieldValue(item, 'Kategori keamanan'))}</div>
    ${renderBarcode(shipmentBarcode, `HG 条码 ${shipmentBarcode}`, 'online-hangtag-barcode online-hangtag-shipment')}
    <div class="online-hangtag-code">${escapeHtml(shipmentBarcode)}</div>
    ${renderBarcode(retailBarcode, `零售条码 ${retailBarcode}`, 'online-hangtag-barcode online-hangtag-retail')}
    <strong class="online-hangtag-price">${escapeHtml(fieldValue(item, 'Harga'))}</strong>
  </article>`
}

export function renderGarmentSkuLabelTemplate(document: PrintDocument): string {
  const isHangtag = document.documentType === 'GARMENT_HANGTAG'
  const paperSize = isHangtag ? '40mm 100mm' : '40mm 30mm'
  return `<style>
    @media print {
      @page { size: ${paperSize}; margin: 0; }
      .online-sku-barcode, .online-garment-hangtag { break-after: page; page-break-after: always; }
      .online-sku-barcode:last-child, .online-garment-hangtag:last-child { break-after: auto; page-break-after: auto; }
    }
    .online-sku-barcode, .online-garment-hangtag { box-sizing: border-box; overflow: hidden; color: #111; background: #fff; font-family: Arial, Helvetica, sans-serif; }
    .online-sku-barcode { width: 40mm; height: 30mm; padding: 3mm 1mm 2mm; text-align: center; }
    .online-sku-barcode-bars { height: 7.5mm; overflow: hidden; }
    .online-sku-barcode-bars svg { display: block; width: 100%; height: 7.5mm; }
    .online-sku-barcode-code { margin-top: .5mm; font-size: 7.5pt; line-height: 1.05; }
    .online-sku-barcode-date { margin-top: .5mm; font-size: 8.5pt; line-height: 1.05; }
    .online-sku-barcode-sku { margin: .6mm auto 0; max-width: 38mm; font-size: 9pt; font-weight: 400; line-height: 1.05; overflow-wrap: anywhere; }
    .online-garment-hangtag { width: 40mm; height: 100mm; padding: 5mm 3mm 2.5mm; text-align: left; font-size: 6.4pt; line-height: 1.25; }
    .online-hangtag-color-dot { width: 5.5mm; height: 5.5mm; margin: 0 auto 3.5mm; border-radius: 50%; background: #666; }
    .online-hangtag-brand { display: block; margin-bottom: 1.7mm; text-align: center; font-size: 9.2pt; line-height: 1.1; }
    .online-hangtag-field { margin-top: 1.1mm; white-space: normal; }
    .online-hangtag-field span { font-weight: 400; }
    .online-hangtag-washing { margin-top: 1.5mm; }
    .online-hangtag-washing-icons { display: flex; justify-content: center; gap: 1.3mm; margin: 1.4mm 0; }
    .online-hangtag-washing-icons svg { width: 4.5mm; height: 4mm; fill: none; stroke: currentColor; stroke-width: 1.3; }
    .online-hangtag-standard { margin-top: 1.4mm; }
    .online-hangtag-standard span, .online-hangtag-standard b { display: block; font-weight: 400; }
    .online-hangtag-standard b { margin-top: .7mm; text-align: center; }
    .online-hangtag-barcode { width: 29mm; height: 8mm; margin: 2mm auto 0; overflow: hidden; }
    .online-hangtag-barcode svg { display: block; width: 100%; height: 8mm; }
    .online-hangtag-code { margin-top: .4mm; text-align: center; font-size: 5.8pt; line-height: 1; }
    .online-hangtag-retail { margin-top: 1.8mm; }
    .online-hangtag-price { display: block; margin-top: .9mm; text-align: center; font-size: 8.2pt; }
    .hidden { display: none !important; }
  </style>${(document.labelItems || []).map((item) => isHangtag ? renderHangtag(item) : renderBarcodeLabel(item)).join('')}`
}
