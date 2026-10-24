import { renderInspectionReference } from '../../quality-management/reference.ts'
import type { InspectionSnapshot } from '../../../data/fcs/quality-management-types.ts'
import { getPostFinishingFullFlowQcTask, getPostFinishingQcInspectionSummary, listPostFinishingFullFlowQcTasks, type PostFinishingQcTask } from '../../../data/fcs/post-finishing-full-flow.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderCode128Barcode } from '../../../components/real-barcode.ts'
import {
  buildProductionConfirmationSnapshot,
  type ProductionConfirmationBomSnapshotRow,
  type ProductionConfirmationSnapshot,
} from '../../../data/fcs/production-confirmation.ts'
import {
  getPostFinishingTaskById,
  getPostFinishingTaskByProductionOrder,
  listPostFinishingQcOrderEntities,
  type PostFinishingQcOrder,
  type PostFinishingTaskView,
} from '../../../data/fcs/post-finishing-current-read-model.ts'
import {
  buildPrintBarcodePayload,
  buildPrintQrPayload,
  createPrintDocumentId,
  formatPrintQty,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
} from '../../../data/fcs/print-service.ts'
import { productionOrders } from '../../../data/fcs/production-orders.ts'
import {
  getQcShippingPriorityForQc,
  getQcShippingPriorityForProduction,
  preparePostFinishingQcShippingPriority,
  type QcShippingPriorityDocument,
} from '../../../data/fcs/post-finishing-qc-shipping-priority-runtime.ts'
import { renderPostFinishingQcPriorityBlock } from './post-finishing-qc-priority-block.ts'

export interface OnlinePostFinishingQcMaterial {
  materialName: string
  materialCode: string
  unitConsumption: string
  materialUsed: string
  imageUrl: string
  imageCaption?: string
}

export interface OnlinePostFinishingQcMasterModel {
  priority?: QcShippingPriorityDocument
  prioritySource?: QcShippingPriorityPrintSource | null
  documentNo: string
  spuCode: string
  styleGrade: string
  productionOrderNo: string
  factoryName: string
  productImageUrl: string
  tagPrice: number | string
  buyerName: string
  productionOrderType: string
  saleType: string
  materials: OnlinePostFinishingQcMaterial[]
  sizeHeaders: string[]
  sizeRows: string[][]
  inspectionHtml?: string
}

export interface OnlinePostFinishingQcDetailModel {
  priority?: QcShippingPriorityDocument
  prioritySource?: QcShippingPriorityPrintSource | null
  documentNo: string
  spuCode: string
  printedAt: string
  productionOrderNo: string
  factoryName: string
  buyerName: string
  productionOrderType: string
  saleType: string
  inspectionHtml?: string
  skuLines: Array<{
    skuCode: string
    waitProcessQty: string
    waitQcQty: string
    inspectedQty: string
  }>
}

export interface QcShippingPriorityPrintSource {
  type: 'QC' | 'PRODUCTION'
  id: string
}

function prioritySourceAttributes(source: QcShippingPriorityPrintSource): string {
  return `data-qc-shipping-source-type="${source.type}" data-qc-shipping-source-id="${escapeHtml(source.id)}"`
}

function renderQcPrintToolbar(source: QcShippingPriorityPrintSource): string {
  return `<div class="pf-qc-toolbar"><p class="pf-qc-print-notice">点击下方按钮重新读取需求、库存和规则后打印。浏览器直接打印使用当前预览的统计时点。</p><button type="button" data-qc-shipping-print data-post-verified-print ${prioritySourceAttributes(source)} data-skip-page-rerender="true">刷新需求并打印</button><span role="status" aria-live="polite" data-qc-shipping-print-status></span></div>`
}

function renderPrioritySlot(source: QcShippingPriorityPrintSource, priority?: QcShippingPriorityDocument): string {
  return `<div data-qc-shipping-priority-slot ${prioritySourceAttributes(source)}>${renderPostFinishingQcPriorityBlock(priority)}</div>`
}

/** Await the fresh snapshot before touching paper content or invoking the browser print dialog. */
export async function handleQcShippingPriorityPrint(target: HTMLElement): Promise<boolean> {
  const button = target.closest<HTMLButtonElement>('[data-qc-shipping-print]')
  if (!button) return false
  if (button.disabled) return true
  const ownerDocument = button.ownerDocument
  const status = button.parentElement?.querySelector<HTMLElement>('[data-qc-shipping-print-status]')
  const originalText = button.textContent
  button.disabled = true
  button.textContent = '正在核对最新需求…'
  if (status) status.textContent = ''
  try {
    await preparePostFinishingQcShippingPriority()
    const documents = new Map<string, QcShippingPriorityDocument | undefined>()
    const updates = Array.from(ownerDocument.querySelectorAll<HTMLElement>('[data-qc-shipping-priority-slot]')).map(slot => {
      const type = slot.dataset.qcShippingSourceType
      const id = slot.dataset.qcShippingSourceId || ''
      if (!id || !['QC', 'PRODUCTION'].includes(type || '')) throw new Error('质检打印来源缺失，请重新打开单据。')
      const key = `${type}:${id}`
      if (!documents.has(key)) documents.set(key, type === 'PRODUCTION' ? getQcShippingPriorityForProduction(id) : getQcShippingPriorityForQc(id))
      return { slot, html: renderPostFinishingQcPriorityBlock(documents.get(key)) }
    })
    // Compute every sheet from the same prepared clock before publishing the local updates.
    updates.forEach(({ slot, html }) => { slot.innerHTML = html })
    if (status) status.textContent = '已读取最新资料；需核对的信息已显示在单据中。'
    await (await import('../post-finishing-print-ready.ts')).preparePostFinishingPrint(button)
  } catch (error) {
    if (status) status.textContent = `${error instanceof Error ? error.message : '最新资料读取失败。'} 尚未打印，请重试。`
  } finally {
    button.disabled = false
    button.textContent = originalText
  }
  return true
}

function pickImage(...urls: Array<string | undefined>): string {
  return urls.find((url) => url
    && !url.includes('/placeholder.svg')
    && !url.includes('placehold.co')
    && !url.startsWith('data:image/svg+xml')) || ''
}

function firstSnapshotImage(images: ProductionConfirmationSnapshot['imageSnapshot'][keyof ProductionConfirmationSnapshot['imageSnapshot']]): string {
  return pickImage(...images.map((item) => item.url))
}

function resolveTask(sourceId: string): PostFinishingTaskView {
  const task = getPostFinishingTaskByProductionOrder(sourceId) || getPostFinishingTaskById(sourceId)
  if (!task) throw new Error(`未找到生产单质检总单：${sourceId}`)
  return task
}

function resolveQcOrder(sourceId: string): PostFinishingQcOrder {
  const qc = listPostFinishingQcOrderEntities(sourceId)[0]
  if (!qc) throw new Error(`未找到质检单：${sourceId}`)
  return qc
}

function materialQty(row: ProductionConfirmationBomSnapshotRow): string {
  if (row.plannedUsageQty === null || row.plannedUsageQty === undefined) return '-'
  return formatPrintQty(row.plannedUsageQty, row.usageUnit || (row.materialType === '面料' ? 'Yard' : 'PCS'))
}

function materialUsed(row: ProductionConfirmationBomSnapshotRow): string {
  if (row.unitConsumption === null || row.unitConsumption === undefined) return '-'
  return `${row.unitConsumption} ${row.usageUnit || ''}/件`.trim()
}

function materialImageCaption(row: ProductionConfirmationBomSnapshotRow): string {
  // Only an explicit description in this exact BOM row can label its picture.
  // A raw fabric photograph must not imply that it shows the garment's final color.
  return row.spec.match(/原料图（[^）]+）/)?.[0] || ''
}

function sizePartLabel(part: string): string {
  if (part.includes('后中') || part.includes('衣长')) return 'Panjang punggung tengah(后中长)'
  if (part.includes('肩')) return 'Lingkar Bahu(肩宽)'
  if (part.includes('胸')) return 'Lingkar Dada(胸围)'
  if (part.includes('袖长')) return 'Panjang Lengan(袖长)'
  if (part.includes('袖口')) return 'Cuff Tangan(袖口)'
  return part
}

const qcMasterSizeParts = ['后中长', '肩宽', '胸围', '袖长', '袖口']

function findSizeMeasurement(
  measurements: ProductionConfirmationSnapshot['patternSnapshot']['sizeMeasurements'],
  size: string,
  part: string,
): ProductionConfirmationSnapshot['patternSnapshot']['sizeMeasurements'][number] | undefined {
  return measurements.find((item) => {
    if (item.sizeCode !== size) return false
    if (part === '后中长') return item.measurementPart.includes('后中') || item.measurementPart.includes('衣长')
    return item.measurementPart.includes(part)
  })
}

export function buildSizeMatrix(snapshot: ProductionConfirmationSnapshot): { headers: string[]; rows: string[][] } {
  const measurements = snapshot.patternSnapshot.sizeMeasurements
  const sizes = snapshot.sizeQtySnapshot.sizes.length ? snapshot.sizeQtySnapshot.sizes : Array.from(new Set(measurements.map((item) => item.sizeCode)))
  const parts = [...new Set(measurements.map(row=>row.measurementPart))]
  const shownParts = parts.length ? parts : qcMasterSizeParts
  return {
    headers: ['size(尺码)', ...shownParts.map(sizePartLabel)],
    rows: sizes.map((size) => [
      size,
      ...shownParts.map((part) => {
        const matched = findSizeMeasurement(measurements, size, part)
        return matched ? `${matched.measurementValue}${matched.measurementUnit || ''}` : ''
      }),
    ]),
  }
}

function renderStyle(): string {
  return `
    <style>
      @page { size: A4 portrait; margin: 6mm; }
      .pf-qc-print-root { min-height: 100vh; background: #777; color: #111; }
      .pf-qc-toolbar { margin: 0 auto; width: 210mm; padding: 8px 0; text-align: right; }
      .pf-qc-toolbar button { border: 0; background: #3498db; color: #fff; padding: 8px 14px; font-size: 14px; }
      .pf-qc-print-notice { margin:0 0 6px; text-align:left; color:#fff; font-size:12px; }
      .pf-qc-toolbar [data-qc-shipping-print-status] { display:block; margin-top:6px; color:#fff; font-size:12px; }
      .pf-qc-paper { width: 200mm; min-height: 287mm; margin: 0 auto 18px; background: #fff; padding: 6mm 5mm; box-sizing: border-box; font-family: Arial, "Microsoft YaHei", sans-serif; font-size: 12px; line-height: 1.2; }
      .pf-qc-slip { min-height: 88mm; }
      .pf-qc-title { display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 16px; font-weight: 700; text-align: center; }
      .pf-qc-title-text { min-width: 92mm; text-align: right; }
      .pf-qc-barcode { width: 42mm; }
      .pf-qc-barcode svg { display: block; width: 42mm; height: 12mm; }
      .pf-qc-section-title { margin: 6mm 0 3mm; text-align: center; font-size: 16px; font-weight: 700; }
      .pf-qc-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .pf-qc-table tr { break-inside: avoid; page-break-inside: avoid; }
      .pf-qc-section-title, .pf-qc-section h2, .pf-qc-section h3 { break-after: avoid; page-break-after: avoid; }
      .pf-qc-table th, .pf-qc-table td { border: 1px solid #777; padding: 4px 5px; text-align: center; vertical-align: middle; font-weight: 400; overflow-wrap: anywhere; word-break: break-word; }
      .pf-qc-table th { font-weight: 400; }
      .pf-qc-header td { height: 24mm; font-size: 14px; }
      .pf-qc-header th { font-size: 13px; }
      .pf-qc-product-cell img { display: block; max-width: 32mm; max-height: 28mm; margin: 0 auto 2px; object-fit: contain; }
      .pf-qc-image-wrap { display: flex; min-height: 12mm; align-items: center; justify-content: center; }
      .pf-qc-image-fallback { color: #b91c1c; font-size: 10px; }
      .pf-qc-material td { min-height: 12mm; }
      .pf-qc-material-imgs { display: flex; align-items: center; justify-content: center; gap: 4px; }
      .pf-qc-material-imgs img { max-width: 20mm; max-height: 16mm; object-fit: contain; }
      .pf-qc-material-caption { margin-top: 2px; font-size: 10px; }
      .pf-qc-size td, .pf-qc-size th { padding: 3px 4px; }
      .pf-qc-sku-table th, .pf-qc-sku-table td { height: 10mm; font-size: 13px; }
      @media print {
        .pf-qc-print-root { background: #fff; }
        .pf-qc-toolbar { display: none; }
        .pf-qc-paper { width: auto; min-height: 0; margin: 0; padding: 0; }
        .pf-qc-section-title { break-after: avoid-page; }
        .pf-qc-table tr { break-inside: avoid; }
      }
    </style>
  `
}

function renderBarcode(value: string): string {
  return `<div class="pf-qc-barcode" aria-label="barcode">${renderCode128Barcode(value, `质检单 ${value} 条码`)}</div>`
}

function renderQcImage(imageUrl: string, alt: string): string {
  if (!imageUrl) return '<span class="pf-qc-image-fallback" data-print-image-missing>图片缺失</span>'
  return `<span class="pf-qc-image-wrap"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="pf-qc-image-fallback">图片加载失败</span></span>`
}

function resolveMaterialFallbackImage(row: ProductionConfirmationBomSnapshotRow): string {
  const text = `${row.materialName} ${row.materialSku} ${row.materialType}`.toLowerCase()
  if (text.includes('纱') || text.includes('yarn')) return '/materials/yarn-stitching.jpg'
  if (text.includes('袋') || text.includes('bag') || text.includes('包装')) return '/materials/packing-bag.jpg'
  if (text.includes('扣') || text.includes('button')) return '/materials/accessory-button.jpg'
  if (text.includes('拉链') || text.includes('zipper')) return '/materials/accessory-zipper.jpg'
  if (text.includes('标') || text.includes('label') || text.includes('tag')) return '/materials/accessory-label.jpg'
  if (row.materialType === '面料') return '/materials/fabric-main.jpg'
  return '/materials/accessory-label.jpg'
}

export function renderOnlinePostFinishingQcMaster(model: OnlinePostFinishingQcMasterModel): string {
  const source: QcShippingPriorityPrintSource = model.prioritySource || { type: 'QC', id: model.documentNo }
  return `
    ${renderStyle()}
    <div class="pf-qc-print-root" data-post-print-ready-root data-testid="post-finishing-qc-master-print" data-print-document-no="${escapeHtml(model.documentNo)}">
      ${model.prioritySource===null?'<div class="pf-qc-toolbar"><button type="button" data-post-verified-print>打印</button></div>':renderQcPrintToolbar(source)}
      <article class="pf-qc-paper">
        <div class="pf-qc-title"><div class="pf-qc-title-text">质检单 （Pemeriksaan Kualitas）</div>${renderBarcode(model.documentNo)}</div>
        ${model.prioritySource===null?'':renderPrioritySlot(source, model.priority)}
        <table class="pf-qc-table pf-qc-header">
          <colgroup><col style="width:26%"><col style="width:16%"><col style="width:19%"><col style="width:16%"><col style="width:23%"></colgroup>
          <thead><tr><th>款号SPU(Satuan Pembelian)</th><th>款式评级（Gaya penilaian）</th><th>生产单号（Nomor produksi tunggal）</th><th>工厂名字（Nama pabrik）</th><th>产品图（Gambar Produk）</th></tr></thead>
          <tbody>
            <tr><td>${escapeHtml(model.spuCode)}</td><td>${escapeHtml(model.styleGrade)}</td><td>${escapeHtml(model.productionOrderNo)}</td><td>${escapeHtml(model.factoryName)}</td><td rowspan="3" class="pf-qc-product-cell">${renderQcImage(model.productImageUrl, `${model.spuCode} 产品图`)}<div>吊牌价：${escapeHtml(typeof model.tagPrice==='number'?model.tagPrice.toFixed(2):model.tagPrice)}</div></td></tr>
            <tr><th>买手（Pembeli）</th><th colspan="2">生产单类型（Jenis pesanan）</th><th>售卖类型（Jenis penjualan）</th></tr>
            <tr><td>${escapeHtml(model.buyerName)}</td><td colspan="2">${escapeHtml(model.productionOrderType)}</td><td>${escapeHtml(model.saleType)}</td></tr>
          </tbody>
        </table>
        <div class="pf-qc-section-title">面辅料（pakaian &amp; aksesori）</div>
        <table class="pf-qc-table pf-qc-material">
          <colgroup><col style="width:22%"><col style="width:19%"><col style="width:13%"><col style="width:20%"><col style="width:21%"><col style="width:5%"></colgroup>
          <thead><tr><th>物料名称(Nama material)</th><th>物料编码(Kode material)</th><th>单耗(Pemakaian per unit)</th><th>用料(Material yang digunakan)</th><th>图片(Gambar)</th><th>已准备(Siap)</th></tr></thead>
          <tbody>${model.materials.map((row) => `<tr><td>${escapeHtml(row.materialName)}</td><td>${escapeHtml(row.materialCode)}</td><td>${escapeHtml(row.unitConsumption)}</td><td>${escapeHtml(row.materialUsed)}</td><td><div class="pf-qc-material-imgs">${renderQcImage(row.imageUrl, `${row.materialName} ${row.imageCaption || '图片'}`)}</div>${row.imageCaption ? `<div class="pf-qc-material-caption">${escapeHtml(row.imageCaption)}</div>` : ''}</td><td></td></tr>`).join('')}</tbody>
        </table>
        <div class="pf-qc-section-title">尺码表（Graf ukuran）</div>
        <table class="pf-qc-table pf-qc-size"><thead><tr>${model.sizeHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${model.sizeRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>
        ${model.inspectionHtml || ''}
      </article>
    </div>
  `
}

export function renderOnlinePostFinishingQcDetail(model: OnlinePostFinishingQcDetailModel): string {
  const source: QcShippingPriorityPrintSource = model.prioritySource || { type: 'QC', id: model.documentNo }
  return `
    ${renderStyle()}
    <div class="pf-qc-print-root" data-post-print-ready-root data-testid="post-finishing-qc-detail-print" data-print-document-no="${escapeHtml(model.documentNo)}">
      ${model.prioritySource===null?'<div class="pf-qc-toolbar"><button type="button" data-post-verified-print>打印</button></div>':renderQcPrintToolbar(source)}
      <article class="pf-qc-paper pf-qc-slip">
        <div class="pf-qc-title"><div class="pf-qc-title-text">质检详情单 （Pemeriksaan Kualitas）</div>${renderBarcode(model.documentNo)}</div>
        ${model.prioritySource===null?'':renderPrioritySlot(source, model.priority)}
        <table class="pf-qc-table pf-qc-header">
          <colgroup><col style="width:26%"><col style="width:20%"><col style="width:32%"><col style="width:22%"></colgroup>
          <thead><tr><th>款号SPU(Satuan Pembelian)</th><th>打印时间（Print Time）</th><th>生产单号（Nomor produksi tunggal）</th><th>工厂名字（Nama pabrik）</th></tr></thead>
          <tbody>
            <tr><td>${escapeHtml(model.spuCode)}</td><td>${escapeHtml(model.printedAt)}</td><td>${escapeHtml(model.productionOrderNo)}</td><td>${escapeHtml(model.factoryName)}</td></tr>
            <tr><th>买手（Pembeli）</th><th>生产单类型（Jenis pesanan）</th><th colspan="2">售卖类型（Jenis penjualan）</th></tr>
            <tr><td>${escapeHtml(model.buyerName)}</td><td>${escapeHtml(model.productionOrderType)}</td><td colspan="2">${escapeHtml(model.saleType)}</td></tr>
          </tbody>
        </table>
        <div class="pf-qc-section-title">SKU列表（Daftar SKU）</div>
        <table class="pf-qc-table pf-qc-sku-table">
          <colgroup><col style="width:24%"><col style="width:19%"><col style="width:19%"><col style="width:19%"><col style="width:19%"></colgroup>
          <thead><tr><th>SKU</th><th>待加工数量(Tes kualitas diperlukan)</th><th>待质检数量(Tes kualitas diperlukan)</th><th>质检数量(Kualitas sudah diperiksa)</th><th>日期签名(Date &amp; Tandatangan)</th></tr></thead>
          <tbody>${model.skuLines.map((line) => `<tr><td>${escapeHtml(line.skuCode)}</td><td>${escapeHtml(line.waitProcessQty)}</td><td>${escapeHtml(line.waitQcQty)}</td><td>${escapeHtml(line.inspectedQty)}</td><td></td></tr>`).join('')}</tbody>
        </table>
        ${model.inspectionHtml || ''}
      </article>
    </div>
  `
}

function renderMasterPrint(task: PostFinishingTaskView, _document: PrintDocument): string {
  const snapshot = buildProductionConfirmationSnapshot(task.productionOrderId)
  const productionOrder = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
  const sizeMatrix = buildSizeMatrix(snapshot)
  const productImageUrl = pickImage(
    firstSnapshotImage(snapshot.imageSnapshot.productImages),
    firstSnapshotImage(snapshot.imageSnapshot.styleImages),
    firstSnapshotImage(snapshot.imageSnapshot.sampleImages),
  )
  return renderOnlinePostFinishingQcMaster({
    priority: getQcShippingPriorityForProduction(task.productionOrderNo),
    prioritySource: { type: 'PRODUCTION', id: task.productionOrderNo },
    documentNo: task.postTaskNo,
    spuCode: task.spuCode,
    styleGrade: productionOrder?.techPackSnapshot?.garmentDifficultyGrade || '未记录',
    productionOrderNo: task.productionOrderNo,
    factoryName: task.managedPostFactoryName,
    productImageUrl,
    tagPrice: '未记录',
    buyerName: productionOrder?.demandSnapshot.buyerName || '—',
    productionOrderType: snapshot.productionOrderSnapshot.orderType || '—',
    saleType: productionOrder?.demandSnapshot.saleType || '—',
    materials: snapshot.bomSnapshot.map((row) => ({
      materialName: row.materialName,
      materialCode: row.materialSkuCode || row.materialCode || row.materialSku,
      unitConsumption: materialUsed(row),
      materialUsed: materialQty(row),
      imageUrl: row.materialImageUrl || '',
      imageCaption: materialImageCaption(row),
    })),
    sizeHeaders: sizeMatrix.headers,
    sizeRows: sizeMatrix.rows,
    inspectionHtml:listPostFinishingFullFlowQcTasks(new Set([task.productionOrderNo])).filter(qc=>qc.productionOrderId===task.productionOrderId).map(renderPostFinishingQcInspectionAppendix).join(''),
  })
}

function renderQcOrderPrint(qc: PostFinishingQcOrder, document: PrintDocument): string {
  const task=getPostFinishingFullFlowQcTask(qc.qcOrderId)
  if(!task)throw new Error('未找到质检权威记录')
  return renderPostFinishingQcTaskDetail(task,document.printMeta.generatedAt)
}

function inspectionRequirementTable(snapshot: InspectionSnapshot, title: string): string {
  return `<h4>${escapeHtml(title)}</h4><table class="pf-qc-table"><thead><tr><th>维度/项目</th><th>本次要求与判定</th><th>来源/依据</th><th>检查记录</th></tr></thead><tbody>${snapshot.items.map(item=>`<tr><td>${escapeHtml(item.dimension)} / ${escapeHtml(item.name)}</td><td>${escapeHtml(item.content)}<br>${escapeHtml(item.criterion)}${item.unit?`（${escapeHtml(item.unit)}）`:''}</td><td>${escapeHtml(item.sourceStandardId)} v${item.sourceStandardVersion}${item.overriddenBy.length?'；附加要求覆盖':''}<br>${item.references.map(ref=>renderInspectionReference(ref,true)).join('')}</td><td style="min-width:18mm;min-height:8mm"></td></tr>`).join('')}</tbody></table>`
}

/** Both print entry points consume this exact original QC snapshot and actual rounds. */
export function renderPostFinishingQcInspectionAppendix(task:PostFinishingQcTask):string {
  const inspection=task.inspection, summary=getPostFinishingQcInspectionSummary(task)
  const source=task.sourceKind==='WAREHOUSE_STOCK'?`成衣仓库存 · ${task.sourceWarehouseName || ''} · 申请 ${task.inventoryApplicationId || ''}`:`生产回货 · ${task.productionOrderNo} · ${task.deliveryOrderNo}`
  if(!inspection||!summary) {
    if(!['待送检','待质检'].includes(task.status)) throw new Error('本次质检缺少开检标准，无法打印，请重新读取后核对。')
    return `<section class="pf-qc-section" data-qc-not-started><h3>质检单 · ${escapeHtml(task.qcTaskNo)}</h3><p>${escapeHtml(source)}</p><p>尚未开检。领取质检后确定本次检查要求和应检数量。</p></section>`
  }
  const snapshot=inspection.snapshot
  // Only print additional SKU tables when their final requirements actually differ.
  const skuGroups = new Map<string,{snapshot:InspectionSnapshot;codes:string[]}>()
  for (const row of snapshot.skuSnapshots || []) {
    const signature=JSON.stringify(row.snapshot.items)
    const group=skuGroups.get(signature) || {snapshot:row.snapshot,codes:[]}
    group.codes.push(task.lines.find(line=>line.sku.skuId===row.skuId)?.sku.skuCode || row.skuId)
    skuGroups.set(signature,group)
  }
  const requirements=inspectionRequirementTable(snapshot,'本批通用检查要求')+[...skuGroups].filter(([signature])=>signature!==JSON.stringify(snapshot.items)).map(([,group])=>inspectionRequirementTable(group.snapshot,`仅适用 SKU：${group.codes.join('、')}`)).join('')
  const roundRows=inspection.rounds.map(round=>`<tr><td>${round.roundNumber} / ${round.percent}%</td><td>${escapeHtml(round.submittedAt)}</td><td>${round.lines.reduce((n,line)=>n+line.passedQty,0)} / ${round.lines.reduce((n,line)=>n+line.defectQty,0)} / ${round.lines.reduce((n,line)=>n+line.returnQty,0)}</td><td>${round.lines.flatMap(line=>{
    const sku=task.lines.find(row=>row.sku.skuId===line.skuId)?.sku.skuCode || line.skuId
    const standard=snapshot.skuSnapshots?.find(row=>row.skuId===line.skuId)?.snapshot || snapshot
    return (line.issues||[]).map(issue=>escapeHtml(`${sku} / ${standard.items.find(item=>item.id===issue.itemId)?.name||issue.itemId}：${issue.note||'有问题'}`))
  }).join('<br>')||'未标问题'}</td></tr>`).join('')
  return `<section class="pf-qc-section" data-qc-inspection-snapshot="${escapeHtml(snapshot.id)}" style="break-before:auto;margin-top:5mm;font-size:11px">
    <h3>本次固定检查要求 · ${escapeHtml(task.qcTaskNo)}</h3><p>${escapeHtml(source)}</p>
    <p>标准 ${escapeHtml(snapshot.basicStandard.name)} v${snapshot.basicStandard.version}；取用 ${escapeHtml(snapshot.selectedAt)}；纸单版本 ${inspection.paperVersion}</p>
    <p>检查比例 ${inspection.percent}% · 应检 ${summary.target} 件 · 实检 ${summary.inspectedQty} 件 · 实检合格 ${summary.passedQty} 件 · 瑕疵 ${summary.defectQty} 件 · 返工 ${summary.returnQty} 件</p>
    <p>${task.status==='质检完成'?`未抽随批放行 ${summary.uninspectedQty} 件；正常放行 ${summary.releasedQty} 件`:'QC尚未完成，尚未放行'}${summary.pendingAudit?'；待稽查，不得先交出':''}</p>
    ${requirements}${snapshot.references.length?`<h4>本次固定的实际参照资料</h4>${snapshot.references.map(ref=>renderInspectionReference(ref,true)).join('')}`:''}<h4>实际检查记录</h4><table class="pf-qc-table"><thead><tr><th>轮次/比例</th><th>提交时间</th><th>实检合格/瑕疵/返工</th><th>具体问题项目</th></tr></thead><tbody>${roundRows||'<tr><td colspan="4">尚无已提交检查记录</td></tr>'}</tbody></table>
    ${(inspection.basisClarifications || []).length?`<h4>已确认的依据澄清</h4>${inspection.basisClarifications!.map(row=>`<p>${escapeHtml(snapshot.items.find(item=>item.id===row.itemId)?.name || row.itemId)}；冲突：${escapeHtml(row.conflictDescription)}；实际采用：${escapeHtml(row.adoptedBasis)}；说明：${escapeHtml(row.clarificationNote)}；${escapeHtml(row.by)} ${escapeHtml(row.at)}</p>`).join('')}`:''}
    <p>稽查记录：${inspection.audits.map(audit=>escapeHtml(`${audit.roundNumber}轮 / ${audit.status==='PENDING'?'待稽查':`已提高至${audit.toPercent}%`} / ${audit.note||''}`)).join('；')||'无'}</p>
    <p>已保存签字单：${inspection.papers.map(paper=>escapeHtml(`${paper.name} / 版本${paper.version} / ${paper.uploadedAt}`)).join('；')||'尚未上传'}</p>
    ${task.sourceKind==='WAREHOUSE_STOCK'?'':`<div style="display:flex;justify-content:space-between;margin-top:8mm"><span>质检员签字：________________</span><span>车缝工厂负责人签字：________________</span></div>`}
  </section>`
}
function taskPrintContext(task:PostFinishingQcTask) {
  const productionOrder=productionOrders.find(row=>row.productionOrderId===task.productionOrderId)
  const snapshot=productionOrder?buildProductionConfirmationSnapshot(task.productionOrderId):undefined
  return {productionOrder,snapshot}
}
export function renderPostFinishingQcTaskMaster(task:PostFinishingQcTask):string {
  const {productionOrder,snapshot}=taskPrintContext(task),sku=task.lines[0]?.sku
  const matrix=snapshot?buildSizeMatrix(snapshot):{headers:['尺码','尺寸依据'],rows:[] as string[][]}
  return renderOnlinePostFinishingQcMaster({priority:getQcShippingPriorityForQc(task),prioritySource:task.sourceKind==='WAREHOUSE_STOCK'?null:{type:'QC',id:task.qcTaskId},documentNo:task.qcTaskNo,spuCode:sku?.spuCode||'',styleGrade:productionOrder?.techPackSnapshot?.garmentDifficultyGrade||'未记录',productionOrderNo:task.sourceKind==='WAREHOUSE_STOCK'?'不适用（库存送检）':task.productionOrderNo,factoryName:task.sourceKind==='WAREHOUSE_STOCK'?task.sourceWarehouseName||'原仓待核对':'后道工厂',productImageUrl:sku?.imageUrl||'',tagPrice:'未记录',buyerName:productionOrder?.demandSnapshot.buyerName||'未记录',productionOrderType:task.sourceKind==='WAREHOUSE_STOCK'?'成衣仓库存送检':snapshot?.productionOrderSnapshot.orderType||'未记录',saleType:productionOrder?.demandSnapshot.saleType||'未记录',materials:(snapshot?.bomSnapshot||[]).map(row=>({materialName:row.materialName,materialCode:row.materialSkuCode||row.materialCode||row.materialSku,unitConsumption:materialUsed(row),materialUsed:materialQty(row),imageUrl:row.materialImageUrl||'',imageCaption:materialImageCaption(row)})),sizeHeaders:matrix.headers,sizeRows:matrix.rows,inspectionHtml:renderPostFinishingQcInspectionAppendix(task)})
}
export function renderPostFinishingQcTaskDetail(task:PostFinishingQcTask,printedAt=new Date().toLocaleString('zh-CN')):string {
  const {productionOrder,snapshot}=taskPrintContext(task),summary=getPostFinishingQcInspectionSummary(task)
  return renderOnlinePostFinishingQcDetail({priority:getQcShippingPriorityForQc(task),prioritySource:task.sourceKind==='WAREHOUSE_STOCK'?null:{type:'QC',id:task.qcTaskId},documentNo:task.qcTaskNo,spuCode:task.lines[0]?.sku.spuCode||'',printedAt,productionOrderNo:task.sourceKind==='WAREHOUSE_STOCK'?'不适用（库存送检）':task.productionOrderNo,factoryName:task.sourceKind==='WAREHOUSE_STOCK'?task.sourceWarehouseName||'原仓待核对':'后道工厂',buyerName:productionOrder?.demandSnapshot.buyerName||'未记录',productionOrderType:task.sourceKind==='WAREHOUSE_STOCK'?'成衣仓库存送检':snapshot?.productionOrderSnapshot.orderType||'未记录',saleType:productionOrder?.demandSnapshot.saleType||'未记录',skuLines:task.lines.map(line=>({skuCode:line.sku.skuCode,waitProcessQty:'',waitQcQty:task.status==='质检完成'?'':String(line.expectedQty),inspectedQty:summary?String(summary.lines.find(row=>row.skuId===line.sku.skuId)?.inspectedQty||0):''})),inspectionHtml:renderPostFinishingQcInspectionAppendix(task)})
}

export function buildProductionQcMasterPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const task = resolveTask(input.sourceId)
  const generatedAt = getPrintGeneratedAt()
  const documentType = 'PRODUCTION_QC_MASTER'
  const businessNo = task.postTaskNo
  const targetRoute = `/fcs/craft/post-finishing/qc-orders?postTaskId=${encodeURIComponent(task.postTaskId)}&tab=qc`
  const qrPayload = buildPrintQrPayload({
    documentType,
    sourceType: 'POST_FINISHING_TASK',
    sourceId: task.postTaskId,
    businessNo,
    targetRoute,
    extra: { productionOrderNo: task.productionOrderNo },
  })
  return {
    printDocumentId: createPrintDocumentId({ ...input, documentType, sourceType: 'POST_FINISHING_TASK', sourceId: task.postTaskId }, 'PRODUCTION_QC_MASTER'),
    documentType,
    documentTitle: '生产单质检总单',
    sourceType: 'POST_FINISHING_TASK',
    sourceId: task.postTaskId,
    templateCode: 'PRODUCTION_QC_MASTER',
    paperType: 'A4',
    orientation: 'portrait',
    printTitle: '生产单质检总单',
    printSubtitle: '生产单维度质检总览',
    headerFields: [
      { label: '生产单号', value: task.productionOrderNo, emphasis: true },
      { label: '款号SPU', value: task.spuCode },
      { label: '后道工厂', value: task.managedPostFactoryName },
    ],
    imageBlocks: [],
    qrCodes: [{ title: '生产单质检总单二维码', value: qrPayload, description: '扫码查看生产单质检总单', sizeMm: 30 }],
    barcodes: [{ title: '生产单质检总单条码', value: buildPrintBarcodePayload({ documentType, sourceType: 'POST_FINISHING_TASK', sourceId: task.postTaskId, businessNo }), description: businessNo }],
    sections: [],
    tables: [],
    signatureBlocks: [],
    differenceBlocks: [],
    footerFields: [],
    printMeta: { generatedAt, generatedBy: '系统自动生成', printNotice: '打印前请在浏览器打印设置中关闭页眉和页脚', returnHref: targetRoute },
    qrPayload,
    barcodePayload: businessNo,
  }
}

export function buildPostFinishingQcOrderPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const qc = resolveQcOrder(input.sourceId)
  const generatedAt = getPrintGeneratedAt()
  const documentType = 'POST_FINISHING_QC_ORDER'
  const businessNo = qc.qcOrderNo
  const targetRoute = `/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(qc.qcOrderNo)}`
  const qrPayload = buildPrintQrPayload({
    documentType,
    sourceType: 'POST_FINISHING_QC_ORDER',
    sourceId: qc.qcOrderId,
    businessNo,
    targetRoute,
    extra: { productionOrderNo: qc.productionOrderNo },
  })
  return {
    printDocumentId: createPrintDocumentId({ ...input, documentType, sourceType: 'POST_FINISHING_QC_ORDER', sourceId: qc.qcOrderId }, 'POST_FINISHING_QC_ORDER'),
    documentType,
    documentTitle: '质检单',
    sourceType: 'POST_FINISHING_QC_ORDER',
    sourceId: qc.qcOrderId,
    templateCode: 'POST_FINISHING_QC_ORDER',
    paperType: 'A4',
    orientation: 'portrait',
    printTitle: '质检单',
    printSubtitle: '本次现场扫码质检执行单',
    headerFields: [
      { label: '质检单号', value: qc.qcOrderNo, emphasis: true },
      { label: '生产单号', value: qc.productionOrderNo },
      { label: '后道工厂', value: qc.managedPostFactoryName },
    ],
    imageBlocks: [],
    qrCodes: [{ title: '质检单二维码', value: qrPayload, description: '扫码进入 Web 质检单执行页', sizeMm: 30 }],
    barcodes: [{ title: '质检单条码', value: buildPrintBarcodePayload({ documentType, sourceType: 'POST_FINISHING_QC_ORDER', sourceId: qc.qcOrderId, businessNo }), description: businessNo }],
    sections: [],
    tables: [],
    signatureBlocks: [],
    differenceBlocks: [],
    footerFields: [],
    printMeta: { generatedAt, generatedBy: '系统自动生成', printNotice: '打印前请在浏览器打印设置中关闭页眉和页脚', returnHref: `/fcs/craft/post-finishing/qc-orders?postTaskId=${encodeURIComponent(qc.postTaskId || '')}&tab=qc` },
    qrPayload,
    barcodePayload: businessNo,
  }
}

export function renderPostFinishingQcPrintTemplate(document: PrintDocument): string {
  if (document.templateCode === 'PRODUCTION_QC_MASTER') return renderMasterPrint(resolveTask(document.sourceId), document)
  return renderQcOrderPrint(resolveQcOrder(document.sourceId), document)
}
