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

function formatLabelDate(generatedAt: string): string {
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(generatedAt)
  if (!match) return generatedAt.slice(0, 10)
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function buildLabelItems(input: PrintDocumentBuildInput, generatedAt: string): PrintLabelItem[] {
  const rows = listGarmentPrintRows(input.sourceId)
  if (!rows.length) throw new Error('当前单据没有可打印的成衣 SKU。')
  return rows.map((row) => ({
    labelTitle: input.documentType === 'GARMENT_HANGTAG' ? row.identity.spuName : '成衣新条码',
    labelSubtitle: `${row.identity.spuCode} · ${row.identity.color}/${row.identity.size}`,
    labelFields: [
      { label: '生产单', value: row.productionOrderNo },
      { label: '当前 SKU', value: row.identity.skuCode, emphasis: true },
      { label: '颜色 / 尺码', value: `${row.identity.color} / ${row.identity.size}` },
      { label: '日期', value: formatLabelDate(generatedAt) },
      { label: '建议零售价', value: row.identity.suggestedRetailPrice > 0 ? `${row.identity.currency} ${row.identity.suggestedRetailPrice.toLocaleString('en-US')}` : '按商品中心当前资料' },
      ...(row.originalIdentity.skuCode !== row.identity.skuCode
        ? [{ label: '来源 SKU', value: row.originalIdentity.skuCode }]
        : []),
    ],
    barcode: {
      title: 'HG 出货条码',
      value: row.identity.shipmentBarcode,
      description: row.identity.shipmentBarcode,
    },
    secondaryBarcode: {
      title: '零售条码',
      value: row.identity.retailBarcode,
      description: row.identity.retailBarcode,
    },
    imageUrl: row.identity.imageUrl,
    labelWarnings: row.originalIdentity.skuCode !== row.identity.skuCode
      ? ['当前标签已按整色替换后的 SKU 生成；原生产与结算身份保留。']
      : [],
  }))
}

export function buildGarmentSkuLabelPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const generatedAt = getPrintGeneratedAt()
  const labelItems = buildLabelItems(input, generatedAt)
  const isHangtag = input.documentType === 'GARMENT_HANGTAG'
  return {
    printDocumentId: createPrintDocumentId(input, isHangtag ? 'GARMENT_HANGTAG_V1' : 'GARMENT_SKU_BARCODE_V1'),
    documentType: input.documentType,
    documentTitle: isHangtag ? '成衣吊牌' : '成衣 SKU 条码',
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    templateCode: isHangtag ? 'GARMENT_HANGTAG_V1' : 'GARMENT_SKU_BARCODE_V1',
    paperType: isHangtag ? 'LABEL_80_50' : 'LABEL_60_40',
    orientation: 'portrait',
    printTitle: isHangtag ? '成衣吊牌' : '成衣新条码',
    printSubtitle: '商品资料以商品中心当前有效 SKU 为准',
    headerFields: [],
    imageBlocks: labelItems.map((item, index) => ({
      title: item.labelTitle,
      imageUrl: item.imageUrl,
      imageLabel: item.labelSubtitle || item.labelTitle,
      sourceLabel: '商品中心 SKU 档案',
      fallbackLabel: `第 ${index + 1} 个 SKU 图片加载失败`,
    })),
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
      printNotice: '打印前核对当前 SPU、SKU、颜色、尺码和两类条码。',
      returnHref: input.sourceType === 'GARMENT_WAREHOUSE_RELABEL_TASK'
        ? '/wls/garment-relabel-tasks'
        : '/fcs/production/orders',
    },
    labelSize: isHangtag ? 'LABEL_80_50' : 'LABEL_60_40',
    labelLayout: '单张标签',
    printMode: '普通打印',
    labelItems,
    relatedObjectIds: [input.sourceId],
    totalCopies: labelItems.length,
  }
}

function renderBarcode(title: string, value: string): string {
  return `
    <div class="garment-label-barcode">
      <span>${escapeHtml(title)}</span>
      ${renderCode128Barcode(value, title)}
      <strong>${escapeHtml(value)}</strong>
    </div>
  `
}

function renderGarmentLabel(item: PrintLabelItem, isHangtag: boolean): string {
  return `
    <article class="garment-label-sheet ${isHangtag ? 'garment-label-hangtag' : 'garment-label-barcode-only'}">
      <header>
        ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.labelSubtitle || item.labelTitle)}" onerror="this.dataset.failed='true';this.alt='商品图片加载失败';" />` : ''}
        <div><h2>${escapeHtml(item.labelTitle)}</h2><p>${escapeHtml(item.labelSubtitle || '')}</p></div>
      </header>
      <dl>${item.labelFields.map((field) => `<div><dt>${escapeHtml(field.label)}</dt><dd class="${field.emphasis ? 'font-bold' : ''}">${escapeHtml(field.value)}</dd></div>`).join('')}</dl>
      ${item.barcode ? renderBarcode(item.barcode.title, item.barcode.value) : ''}
      ${item.secondaryBarcode ? renderBarcode(item.secondaryBarcode.title, item.secondaryBarcode.value) : ''}
      ${item.labelWarnings?.map((warning) => `<p class="garment-label-warning">${escapeHtml(warning)}</p>`).join('') || ''}
    </article>
  `
}

export function renderGarmentSkuLabelTemplate(document: PrintDocument): string {
  const isHangtag = document.documentType === 'GARMENT_HANGTAG'
  const size = isHangtag ? '80mm 50mm' : '60mm 40mm'
  return `
    <style>
      @media print { @page { size: ${size}; margin: 0; } .garment-label-sheet { break-after: page; page-break-after: always; } .garment-label-sheet:last-child { break-after: auto; page-break-after: auto; } }
      .garment-label-sheet { box-sizing: border-box; width: ${isHangtag ? '80mm' : '60mm'}; min-height: ${isHangtag ? '50mm' : '40mm'}; padding: 3mm; color: #111; background: #fff; font-family: Arial, sans-serif; }
      .garment-label-sheet header { display: flex; align-items: center; gap: 2mm; border-bottom: 1px solid #111; padding-bottom: 1.5mm; }
      .garment-label-sheet header img { width: 12mm; height: 12mm; object-fit: cover; border: 1px solid #bbb; }
      .garment-label-sheet h2 { margin: 0; font-size: 11pt; } .garment-label-sheet header p { margin: .5mm 0 0; font-size: 7pt; }
      .garment-label-sheet dl { margin: 1.5mm 0; display: grid; grid-template-columns: 1fr 1fr; gap: .6mm 2mm; font-size: 6.5pt; }
      .garment-label-sheet dl div { display: flex; gap: 1mm; } .garment-label-sheet dt { color: #555; } .garment-label-sheet dd { margin: 0; }
      .garment-label-barcode { margin-top: 1mm; text-align: center; } .garment-label-barcode span { display: block; font-size: 6pt; }
      .garment-label-barcode svg { height: ${isHangtag ? '7mm' : '8mm'}; } .garment-label-barcode strong { display: block; font-size: 6pt; letter-spacing: .4mm; }
      .garment-label-warning { margin: 1mm 0 0; font-size: 5.5pt; color: #444; }
      .garment-label-barcode-only dl div:nth-child(5), .garment-label-barcode-only .garment-label-barcode:nth-of-type(2) { display: none; }
    </style>
    ${(document.labelItems || []).map((item) => renderGarmentLabel(item, isHangtag)).join('')}
  `
}
