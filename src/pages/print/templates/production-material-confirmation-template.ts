import { renderCode128Barcode } from '../../../components/real-barcode.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  buildPrintQrPayload,
  createPrintDocumentId,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
  type PrintImageBlock,
} from '../../../data/fcs/print-service.ts'
import {
  buildProductionConfirmationSnapshot,
  getOrCreateProductionConfirmation,
  getProductionConfirmationByOrderId,
  getProductionConfirmationSnapshotById,
  isProductionConfirmationPrintable,
  productionConfirmationStatusLabels,
  type ProductionConfirmationImage,
  type ProductionConfirmationSnapshot,
  type ProductionConfirmationBomSnapshotRow,
} from '../../../data/fcs/production-confirmation.ts'
import { productionOrders } from '../../../data/fcs/production-orders.ts'

export const ProductionMaterialConfirmationTemplate = 'ProductionMaterialConfirmationTemplate'
export const ProductionConfirmationTemplate = 'ProductionConfirmationTemplate'

/** The frozen business snapshot travels with this document; rendering never silently reads a later version. */
export interface ProductionConfirmationPrintDocument extends PrintDocument {
  confirmationSnapshot: ProductionConfirmationSnapshot
}

function text(value: string | number | undefined | null, fallback = '未维护'): string {
  return value === undefined || value === null || !String(value).trim() ? fallback : String(value)
}

export function formatProductionConfirmationQuantity(value: number | null | undefined, unit = ''): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '未维护'
  return `${Number(value.toFixed(8))}${unit ? ` ${unit}` : ''}`
}

function imageBlock(title: string, images: ProductionConfirmationImage[]): PrintImageBlock {
  return { title, imageUrl: images[0]?.url, imageLabel: images[0]?.label || title, sourceLabel: '生产资料图片', fallbackLabel: '图片未维护' }
}

export function resolveProductionPrintImages(productionOrderId: string): PrintImageBlock[] {
  const snapshot = buildProductionConfirmationSnapshot(productionOrderId)
  return [
    imageBlock('商品主图', snapshot.imageSnapshot.productImages),
    imageBlock('款式图', snapshot.imageSnapshot.styleImages),
    imageBlock('样衣图', snapshot.imageSnapshot.sampleImages),
    imageBlock('面料图', snapshot.imageSnapshot.materialImages),
    imageBlock('辅料图', snapshot.imageSnapshot.accessoryImages),
    imageBlock('纸样图', snapshot.imageSnapshot.patternImages),
    imageBlock('唛架图', snapshot.imageSnapshot.markerImages),
    imageBlock('花型图', snapshot.imageSnapshot.artworkImages),
  ]
}

export function resolveMaterialPrintImages(productionOrderId: string): PrintImageBlock[] {
  const snapshot = buildProductionConfirmationSnapshot(productionOrderId)
  return [imageBlock('面料图', snapshot.imageSnapshot.materialImages), imageBlock('辅料图', snapshot.imageSnapshot.accessoryImages)]
}

export function resolvePrintProductImage(_sourceType: string, sourceId: string): PrintImageBlock {
  return imageBlock('商品主图', buildProductionConfirmationSnapshot(sourceId).imageSnapshot.productImages)
}

function buildDocument(input: PrintDocumentBuildInput): ProductionConfirmationPrintDocument {
  const order = productionOrders.find((row) => row.productionOrderId === input.sourceId || row.productionOrderNo === input.sourceId)
  if (!order) throw new Error(`未找到生产单：${input.sourceId}`)
  const existing = getProductionConfirmationByOrderId(order.productionOrderId)
  const printable = isProductionConfirmationPrintable(order.productionOrderId)
  if (!existing && !printable.printable) throw new Error(printable.reason || '生产单尚不可打印')
  const confirmation = existing || getOrCreateProductionConfirmation(order.productionOrderId)
  const snapshot = (confirmation ? getProductionConfirmationSnapshotById(confirmation.snapshotId) : undefined)
    || buildProductionConfirmationSnapshot(order.productionOrderId)
  const printVersionNo = `V${snapshot.confirmationVersion}`
  const generatedAt = getPrintGeneratedAt()
  const qrPayload = buildPrintQrPayload({
    documentType: 'PRODUCTION_CONFIRMATION', sourceType: 'PRODUCTION_ORDER', sourceId: order.productionOrderId,
    businessNo: order.productionOrderNo, printVersionNo,
    targetRoute: `/fcs/production/orders/${encodeURIComponent(order.productionOrderId)}/confirmation-print`,
  })
  return {
    printDocumentId: createPrintDocumentId({ ...input, sourceId: order.productionOrderId, documentType: 'PRODUCTION_CONFIRMATION' }, 'PRODUCTION_CONFIRMATION'),
    documentType: 'PRODUCTION_CONFIRMATION', documentTitle: '生产确认单', sourceType: 'PRODUCTION_ORDER', sourceId: order.productionOrderId,
    templateCode: 'PRODUCTION_CONFIRMATION', paperType: 'A4', orientation: 'portrait',
    printTitle: '生产确认单（Formula Konfirmasi Barang）', printSubtitle: '',
    headerFields: [
      { label: '生产单号', value: order.productionOrderNo },
      { label: '生产确认单号', value: snapshot.confirmationNo },
      { label: '打印版本', value: printVersionNo },
      { label: '确认单状态', value: confirmation ? productionConfirmationStatusLabels[confirmation.status] : '预览' },
    ],
    imageBlocks: [imageBlock('商品主图', snapshot.imageSnapshot.productImages)],
    qrCodes: [{ title: '生产单二维码', value: qrPayload, description: '扫码查看生产资料', sizeMm: 24 }],
    barcodes: [{ title: '生产单条码', value: order.productionOrderNo, description: '生产单号' }],
    sections: [],
    tables: [{
      tableId: 'sku-size-qty', title: 'Daftar SK', headers: ['颜色', ...snapshot.sizeQtySnapshot.sizes, '合计'],
      rows: snapshot.sizeQtySnapshot.rows.map((row) => [row.color, ...snapshot.sizeQtySnapshot.sizes.map((size) => String(row.sizeQtyMap[size] || 0)), String(row.totalQty)]),
    }],
    signatureBlocks: [], differenceBlocks: [], footerFields: [],
    printMeta: {
      generatedAt, generatedBy: '系统', printNotice: 'A4 纵向打印；关闭浏览器页眉和页脚。图片未就绪时请先补齐或重试。',
      returnHref: `/fcs/production/orders/${encodeURIComponent(order.productionOrderId)}`,
    },
    qrPayload, barcodePayload: order.productionOrderNo, printVersionNo, confirmationSnapshot: snapshot,
  }
}

export function buildProductionMaterialConfirmationPrintDocument(input: PrintDocumentBuildInput): ProductionConfirmationPrintDocument {
  return buildDocument(input)
}

export function buildProductionConfirmationPrintDocument(input: PrintDocumentBuildInput | string): ProductionConfirmationPrintDocument {
  return buildDocument(typeof input === 'string'
    ? { documentType: 'PRODUCTION_CONFIRMATION', sourceType: 'PRODUCTION_ORDER', sourceId: input }
    : input)
}

function renderImage(url: string | undefined, label: string, className = ''): string {
  if (!url) return `<div class="confirmation-image-missing" data-print-image-missing>${escapeHtml(label)}：图片未维护</div>`
  return `<figure class="confirmation-image ${className}" data-print-image-frame>
    <button type="button" data-print-image-url="${escapeHtml(url)}" data-print-image-title="${escapeHtml(label)}" aria-label="查看${escapeHtml(label)}大图">
      <img data-print-image src="${escapeHtml(url)}" alt="${escapeHtml(label)}" loading="eager" />
    </button>
    <span data-print-image-loading class="print-hidden">图片加载中…</span><span data-print-image-error hidden class="print-hidden">图片加载失败：${escapeHtml(label)} <button type="button" data-print-image-retry>重试图片</button></span>
    <figcaption>${escapeHtml(label)}</figcaption>
  </figure>`
}

function milestone(snapshot: ProductionConfirmationSnapshot, key: 'cuttingCompleted' | 'factoryArrived' | 'firstDelivery' | 'productionCompleted'): string {
  const row = snapshot.onlineDisplaySnapshot.milestones.find((item) => item.key === key)
  if (row?.actualAt) return escapeHtml(row.actualAt)
  if (row?.plannedAt) return `未发生<br><span class="confirmation-muted">计划：${escapeHtml(row.plannedAt)}</span>`
  return '未发生'
}

function renderMainTable(snapshot: ProductionConfirmationSnapshot): string {
  const display = snapshot.onlineDisplaySnapshot
  const price = display.retailTagPrice
  const priceLabel = price ? `${price.amount.toFixed(2)} ${price.currency}` : '未维护'
  const original = (label: string) => escapeHtml(display.originalLabelFields.find((row) => row.label === label)?.value || '未维护')
  const source = display.purchaseOrderNos.length ? display.purchaseOrderNos.join('，') : `采购单未维护；来源需求：${snapshot.productionOrderSnapshot.sourceDemandNos.join('，')}`
  return `<table class="confirmation-table confirmation-main" aria-label="生产单基本资料">
    <colgroup><col style="width:21%"><col style="width:14%"><col style="width:20%"><col style="width:23%"><col style="width:22%"></colgroup>
    <tbody>
      <tr class="confirmation-labels"><td>款号SPU(Satuan Pembelian)</td><td>做货难度（Gaya penilaian）</td><td>Nomor produksi tunggal<br>生产单号</td><td>Nomor pembelian tunggal<br>采购单号</td><td>Gambar Produk</td></tr>
      <tr><td>${escapeHtml(snapshot.styleSnapshot.spuCode)}</td><td>${escapeHtml(text(display.garmentDifficultyGrade))}</td><td>${escapeHtml(snapshot.productionOrderNo)}</td><td>${escapeHtml(source)}<br>${escapeHtml(display.saleType)}</td><td rowspan="9">${renderImage(snapshot.styleSnapshot.productMainImageUrl, `${snapshot.styleSnapshot.spuCode} ${snapshot.styleSnapshot.spuName}`, 'confirmation-product-image')}<div>吊牌价：${escapeHtml(priceLabel)}</div></td></tr>
      <tr class="confirmation-labels"><td colspan="2">Nama pabrik<br>承接工厂</td><td>jenis<br>订单类型</td><td>Waktu Perintah Pembelian<br>下单日期</td></tr>
      <tr><td colspan="2">${escapeHtml(display.factoryNames.join('、') || '未分配')}</td><td>${escapeHtml(snapshot.productionOrderSnapshot.orderType)}</td><td>${escapeHtml(display.orderDate.slice(0, 10))}</td></tr>
      <tr class="confirmation-labels"><td colspan="2">Waktu selesai cutting<br>裁剪完成</td><td>Waktu Kedatangan ke Pabrik<br>到厂</td><td>Waktu pengiriman pertama<br>首次交付</td></tr>
      <tr><td colspan="2">${milestone(snapshot, 'cuttingCompleted')}</td><td>${milestone(snapshot, 'factoryArrived')}</td><td>${milestone(snapshot, 'firstDelivery')}</td></tr>
      <tr class="confirmation-labels"><td colspan="2">Waktu penyelesaian produksi<br>生产完成</td><td>Gulungan kain<br>布卷数</td><td>Perkiraan total potongan<br>预计总件数</td></tr>
      <tr><td colspan="2">${milestone(snapshot, 'productionCompleted')}</td><td>${display.fabricRollIds === null ? '未维护' : `${display.fabricRollIds.length} 卷`}</td><td>${formatProductionConfirmationQuantity(snapshot.productionOrderSnapshot.plannedQty, '件')}</td></tr>
      <tr class="confirmation-labels"><td colspan="2">Proses Tambahan<br>额外工艺</td><td>Apakah itu undang-undang dasar<br><span class="text-xs">直译：那是宪法吗？</span></td><td>Yang sama<br><span class="text-xs">相同的</span></td></tr>
      <tr><td colspan="2">${escapeHtml(display.additionalProcesses.join('、') || '无额外工艺')}</td><td>${original('Apakah itu undang-undang dasar')}</td><td>${original('Yang sama')}</td></tr>
    </tbody>
  </table>`
}

function renderColorsAndPatterns(snapshot: ProductionConfirmationSnapshot): string {
  const colors = snapshot.sizeQtySnapshot.colors.map((color) => {
    const image = snapshot.onlineDisplaySnapshot.colorImages.find((row) => row.color === color)
    return `<tr><td>${escapeHtml(color)}${image?.skuCodes?.length ? `<div class="confirmation-muted">SKU：${escapeHtml(image.skuCodes.join('、'))}</div>` : ''}</td><td>${renderImage(image?.imageUrl, `${snapshot.styleSnapshot.spuCode} · ${color}`, 'confirmation-color-image')}</td></tr>`
  }).join('')
  const patterns = snapshot.patternSnapshot.rows.map((row) => `<tr><td>${escapeHtml(row.materialLabel)}<div class="confirmation-muted">${escapeHtml(row.patternFileName || row.patternId)}</div></td><td>
    ${renderImage(row.imageUrl, row.materialLabel, 'confirmation-pattern-image')}
    <div class="confirmation-file-links">${row.attachments.length ? row.attachments.map((file) => `<a href="${escapeHtml(file.url)}" download="${escapeHtml(file.fileName)}" title="${escapeHtml(file.fileName)}">${escapeHtml(file.kind)}</a>`).join(' ') : '<span class="confirmation-muted">附件未维护</span>'}</div>
  </td></tr>`).join('')
  return `<section class="confirmation-section"><h2>warna &amp; gambar</h2><table class="confirmation-table confirmation-colors" aria-label="颜色与纸样"><colgroup><col style="width:50%"><col style="width:50%"></colgroup><thead><tr><th>warna</th><th>gambar</th></tr></thead><tbody>${colors}<tr class="confirmation-labels"><td colspan="2">纸样（Pola kertas）</td></tr>${patterns || '<tr><td colspan="2">纸样资料未维护</td></tr>'}</tbody></table></section>`
}

function renderMaterialRow(row: ProductionConfirmationBomSnapshotRow, fabric: boolean): string {
  const unit = row.usageUnit || '单位未维护'
  const net = formatProductionConfirmationQuantity(row.netUsageQty, unit)
  const prepared = formatProductionConfirmationQuantity(row.plannedUsageQty, unit)
  const single = formatProductionConfirmationQuantity(row.unitConsumption, unit)
  const hasLoss = row.lossRate !== null && row.lossRate > 0
  const process = [row.dyeRequirement ? `Dyeing 染色：${row.dyeRequirement}` : '', row.printRequirement ? `Printing 印花：${row.printRequirement}` : '', row.embroideryRequirement || '', fabric ? 'Cutting 裁剪' : ''].filter(Boolean).join(' / ')
  return `<tr><td>${escapeHtml(row.materialName)}<div class="confirmation-muted">${escapeHtml(row.materialColor)} ${escapeHtml(row.spec)}</div></td><td>${escapeHtml(row.materialCode || row.materialSku)}</td><td>${fabric ? escapeHtml(row.partNames.join('、') || '按纸样') : escapeHtml(single)}</td><td>${fabric ? `<div>${escapeHtml(single)} / 件</div>` : ''}<div>${escapeHtml(net)}</div>${hasLoss ? `<div class="confirmation-muted">净用量；含损耗备料 ${escapeHtml(prepared)}（${row.lossRate}%）</div>` : ''}</td><td>${renderImage(row.materialImageUrl, `${row.materialName} · ${row.materialCode || row.materialSku}`, 'confirmation-material-image')}</td><td>${escapeHtml(fabric ? process : row.preparedLabel || '未维护')}</td><td>${escapeHtml(row.warehouseLabel || '未维护')}</td></tr>`
}

function renderMaterials(snapshot: ProductionConfirmationSnapshot): string {
  const fabrics = snapshot.bomSnapshot.filter((row) => row.materialType === '面料')
  const accessories = snapshot.bomSnapshot.filter((row) => !['面料', '成衣'].includes(row.materialType))
  return `<section class="confirmation-section"><h2>Kain &amp; aksesoris</h2><table class="confirmation-table confirmation-materials" aria-label="面辅料信息"><colgroup><col style="width:15%"><col style="width:17%"><col style="width:12%"><col style="width:17%"><col style="width:15%"><col style="width:15%"><col style="width:9%"></colgroup>
    <thead><tr><th>Nama Fabric</th><th>Bahan SKU</th><th>Jumlah potongan</th><th>Total/Material yang digunakan</th><th>(Gambar)</th><th>(Jenis Printing)</th><th>Informasi Gudang</th></tr></thead>
    <tbody>${fabrics.map((row) => renderMaterialRow(row, true)).join('') || '<tr><td colspan="7">无面料项目</td></tr>'}
    </tbody></table><table class="confirmation-table confirmation-materials" aria-label="辅料信息"><colgroup><col style="width:15%"><col style="width:17%"><col style="width:12%"><col style="width:17%"><col style="width:15%"><col style="width:15%"><col style="width:9%"></colgroup><thead><tr class="confirmation-labels"><th>Nama aksesori</th><th>Kode aksesori</th><th>jumlah</th><th>Material yang digunakan</th><th>Gambar</th><th>Siap</th><th>Informasi Gudang</th></tr></thead><tbody>
    ${accessories.map((row) => renderMaterialRow(row, false)).join('') || '<tr><td colspan="7">无辅料项目</td></tr>'}</tbody>
  </table></section>`
}

function renderSizeQuantities(snapshot: ProductionConfirmationSnapshot): string {
  const { sizes, rows } = snapshot.sizeQtySnapshot
  const binding = (color: string) => snapshot.onlineDisplaySnapshot.bindingStrips.filter((row) => row.color === color).map((row) => formatProductionConfirmationQuantity(row.length, row.unit)).join(' / ') || '未维护'
  return `<section class="confirmation-section"><h2>Daftar SK</h2><table class="confirmation-table" aria-label="规格数量矩阵"><thead><tr><th rowspan="2">颜色</th><th colspan="${sizes.length + 1}">尺码明细（件）</th><th rowspan="2">捆条pinping</th></tr><tr>${sizes.map((size) => `<th>${escapeHtml(size)}</th>`).join('')}<th>合计</th></tr></thead><tbody>
    ${rows.map((row) => `<tr><td>${escapeHtml(row.color)}</td>${sizes.map((size) => `<td>${row.sizeQtyMap[size] || 0}</td>`).join('')}<td>${row.totalQty}</td><td>${escapeHtml(binding(row.color))}</td></tr>`).join('')}
    <tr class="confirmation-total"><td>合计</td>${sizes.map((size) => `<td>${rows.reduce((sum, row) => sum + (row.sizeQtyMap[size] || 0), 0)}</td>`).join('')}<td>${rows.reduce((sum, row) => sum + row.totalQty, 0)}</td><td>—</td></tr>
  </tbody></table></section>`
}

function renderMeasurements(snapshot: ProductionConfirmationSnapshot): string {
  const labels: Record<string, string> = { 后中长: 'Panjang punggung tengah(后中长)', 肩宽: 'Lingkar Bahu(肩宽)', 胸围: 'Lingkar Dada(胸围)', 袖长: 'Panjang Lengan(袖长)', 袖口: 'Cuff Tangan(袖口)', 脚围: 'Lingkar kaki(脚围)' }
  const measures = snapshot.patternSnapshot.sizeMeasurements
  const parts = Array.from(new Set(measures.map((row) => row.measurementPart)))
  const preferred = Object.keys(labels)
  parts.sort((a, b) => (preferred.includes(a) ? preferred.indexOf(a) : 99) - (preferred.includes(b) ? preferred.indexOf(b) : 99))
  const sizes = snapshot.sizeQtySnapshot.sizes
  return `<section class="confirmation-section"><h2>Graf ukura</h2><table class="confirmation-table confirmation-measurements" aria-label="成衣尺寸"><thead><tr><th>成衣尺寸</th>${parts.map((part) => `<th>${escapeHtml(labels[part] || part)}</th>`).join('')}</tr></thead><tbody>${sizes.map((size) => `<tr><td>${escapeHtml(size)}</td>${parts.map((part) => { const row = measures.find((item) => item.sizeCode === size && item.measurementPart === part); return `<td>${row ? escapeHtml(`${row.measurementValue}${row.measurementUnit}`) : '未维护'}</td>` }).join('')}</tr>`).join('') || '<tr><td>尺寸资料未维护</td></tr>'}</tbody></table></section>`
}

export function renderProductionMaterialConfirmationTemplate(doc: PrintDocument & { confirmationSnapshot?: ProductionConfirmationSnapshot }): string {
  const snapshot = doc.confirmationSnapshot || buildProductionConfirmationSnapshot(doc.sourceId)
  return `<article class="print-paper-a4 print-production-confirmation" data-production-confirmation="${escapeHtml(snapshot.productionOrderId)}">
    <div class="confirmation-sheet">
      <header class="confirmation-header"><h1>生产确认单（Formula Konfirmasi Barang）</h1><div class="confirmation-barcode">${renderCode128Barcode(snapshot.productionOrderNo, '生产单条码')}<span>${escapeHtml(snapshot.productionOrderNo)}</span></div></header>
      ${renderMainTable(snapshot)}${renderColorsAndPatterns(snapshot)}${renderMaterials(snapshot)}${renderSizeQuantities(snapshot)}${renderMeasurements(snapshot)}
    </div>
  </article>`
}

export const renderProductionConfirmationTemplate = renderProductionMaterialConfirmationTemplate
