import { escapeHtml } from '../../../utils.ts'
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
} from '../../../data/fcs/post-finishing-domain.ts'
import {
  buildPrintBarcodePayload,
  buildPrintQrPayload,
  createPrintDocumentId,
  formatPrintQty,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
} from '../../../data/fcs/print-service.ts'

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
  const task = getPostFinishingTaskById(sourceId) || getPostFinishingTaskByProductionOrder(sourceId)
  if (!task) throw new Error(`未找到生产单质检总单：${sourceId}`)
  return task
}

function resolveQcOrder(sourceId: string): PostFinishingQcOrder {
  const qc = listPostFinishingQcOrderEntities().find((item) => item.qcOrderId === sourceId || item.qcOrderNo === sourceId)
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

function buildSizeMatrix(snapshot: ProductionConfirmationSnapshot): { headers: string[]; rows: string[][] } {
  const measurements = snapshot.patternSnapshot.sizeMeasurements
  const sizes = snapshot.sizeQtySnapshot.sizes.length ? snapshot.sizeQtySnapshot.sizes : Array.from(new Set(measurements.map((item) => item.sizeCode)))
  return {
    headers: ['size(尺码)', ...qcMasterSizeParts.map(sizePartLabel)],
    rows: sizes.map((size) => [
      size,
      ...qcMasterSizeParts.map((part) => {
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
      .pf-qc-paper { width: 200mm; min-height: 287mm; margin: 0 auto 18px; background: #fff; padding: 6mm 5mm; box-sizing: border-box; font-family: Arial, "Microsoft YaHei", sans-serif; font-size: 12px; line-height: 1.2; }
      .pf-qc-slip { min-height: 88mm; }
      .pf-qc-title { display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 16px; font-weight: 700; text-align: center; }
      .pf-qc-title-text { min-width: 92mm; text-align: right; }
      .pf-qc-barcode { width: 42mm; }
      .pf-qc-barcode-lines { height: 10mm; background: repeating-linear-gradient(90deg, #000 0 1px, #fff 1px 3px, #000 3px 5px, #fff 5px 7px, #000 7px 8px, #fff 8px 10px); }
      .pf-qc-barcode-text { overflow-wrap: anywhere; font-size: 6px; color: #111; }
      .pf-qc-section-title { margin: 6mm 0 3mm; text-align: center; font-size: 16px; font-weight: 700; }
      .pf-qc-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .pf-qc-table th, .pf-qc-table td { border: 1px solid #777; padding: 4px 5px; text-align: center; vertical-align: middle; font-weight: 400; overflow-wrap: anywhere; word-break: break-word; }
      .pf-qc-table th { font-weight: 400; }
      .pf-qc-header td { height: 24mm; font-size: 14px; }
      .pf-qc-header th { font-size: 13px; }
      .pf-qc-product-cell img { display: block; max-width: 32mm; max-height: 28mm; margin: 0 auto 2px; object-fit: contain; }
      .pf-qc-material td { min-height: 12mm; }
      .pf-qc-material-imgs { display: flex; align-items: center; justify-content: center; gap: 4px; }
      .pf-qc-material-imgs img { max-width: 20mm; max-height: 16mm; object-fit: contain; }
      .pf-qc-size td, .pf-qc-size th { padding: 3px 4px; }
      .pf-qc-sku-table th, .pf-qc-sku-table td { height: 10mm; font-size: 13px; }
      @media print {
        .pf-qc-print-root { background: #fff; }
        .pf-qc-toolbar { display: none; }
        .pf-qc-paper { width: auto; min-height: 0; margin: 0; padding: 0; }
      }
    </style>
  `
}

function renderBarcode(value: string): string {
  return `
    <div class="pf-qc-barcode" aria-label="barcode">
      <div class="pf-qc-barcode-lines"></div>
      <div class="pf-qc-barcode-text">${escapeHtml(value)}</div>
    </div>
  `
}

function renderProductImage(snapshot: ProductionConfirmationSnapshot): string {
  const imageUrl = pickImage(
    firstSnapshotImage(snapshot.imageSnapshot.productImages),
    firstSnapshotImage(snapshot.imageSnapshot.styleImages),
    firstSnapshotImage(snapshot.imageSnapshot.sampleImages),
  )
  return imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="产品图">` : ''
}

function renderMaterialImages(row: ProductionConfirmationBomSnapshotRow, snapshot: ProductionConfirmationSnapshot): string {
  const imageUrl = pickImage(
    row.materialImageUrl,
    row.materialType === '面料' ? firstSnapshotImage(snapshot.imageSnapshot.materialImages) : firstSnapshotImage(snapshot.imageSnapshot.accessoryImages),
    resolveMaterialFallbackImage(row),
  )
  return imageUrl ? `<div class="pf-qc-material-imgs"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(row.materialName)}"></div>` : ''
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

function renderMasterPrint(task: PostFinishingTaskView, document: PrintDocument): string {
  const snapshot = buildProductionConfirmationSnapshot(task.productionOrderId)
  const materials = snapshot.bomSnapshot.slice(0, 6)
  const sizeMatrix = buildSizeMatrix(snapshot)
  const barcode = document.barcodes[0]?.value || document.barcodePayload || task.postTaskNo

  return `
    ${renderStyle()}
    <div class="pf-qc-print-root">
      <div class="pf-qc-toolbar"><button onclick="window.print()">打印</button></div>
      <article class="pf-qc-paper">
        <div class="pf-qc-title">
          <div class="pf-qc-title-text">生产单质检总单（Pemeriksaan Kualitas Produksi）</div>
          ${renderBarcode(barcode)}
        </div>
        <table class="pf-qc-table pf-qc-header">
          <colgroup><col style="width:26%"><col style="width:16%"><col style="width:19%"><col style="width:16%"><col style="width:23%"></colgroup>
          <thead>
            <tr>
              <th>款号SPU(Satuan Pembelian)</th>
              <th>款式评级（Gaya penilaian）</th>
              <th>生产单号（Nomor produksi tunggal）</th>
              <th>工厂名字（Nama pabrik）</th>
              <th>产品图（Gambar Produk）</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml(task.spuCode)}</td>
              <td>D</td>
              <td>${escapeHtml(task.productionOrderNo)}</td>
              <td>${escapeHtml(task.managedPostFactoryName)}</td>
              <td class="pf-qc-product-cell">${renderProductImage(snapshot)}<div>吊牌价：${escapeHtml(snapshot.productionOrderSnapshot.plannedQty.toLocaleString('zh-CN'))}.00</div></td>
            </tr>
          </tbody>
        </table>

        <div class="pf-qc-section-title">面辅料（pakaian &amp; aksesori）</div>
        <table class="pf-qc-table pf-qc-material">
          <colgroup><col style="width:22%"><col style="width:19%"><col style="width:10%"><col style="width:23%"><col style="width:22%"><col style="width:4%"></colgroup>
          <thead>
            <tr>
              <th>辅料名称(Nama aksesori)</th>
              <th>辅料编码(Kode aksesori)</th>
              <th>数量(jumlah)</th>
              <th>用料(Material yang digunakan)</th>
              <th>图片(Gambar)</th>
              <th>已准备(Siap)</th>
            </tr>
          </thead>
          <tbody>
            ${materials.map((row) => `
              <tr>
                <td>${escapeHtml(row.materialName)}</td>
                <td>${escapeHtml(row.materialSku)}</td>
                <td>${escapeHtml(materialQty(row))}</td>
                <td>${escapeHtml(materialUsed(row))}</td>
                <td>${renderMaterialImages(row, snapshot)}</td>
                <td></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="pf-qc-section-title">尺码表（Graf ukuran）</div>
        <table class="pf-qc-table pf-qc-size">
          <thead><tr>${sizeMatrix.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
          <tbody>
            ${sizeMatrix.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </article>
    </div>
  `
}

function renderQcOrderPrint(qc: PostFinishingQcOrder, document: PrintDocument): string {
  const barcode = document.barcodes[0]?.value || document.barcodePayload || qc.qcOrderNo
  return `
    ${renderStyle()}
    <div class="pf-qc-print-root">
      <div class="pf-qc-toolbar"><button onclick="window.print()">打印</button></div>
      <article class="pf-qc-paper pf-qc-slip">
        <div class="pf-qc-title">
          <div class="pf-qc-title-text">质检单（Pemeriksaan Kualitas）</div>
          ${renderBarcode(barcode)}
        </div>
        <table class="pf-qc-table pf-qc-header">
          <colgroup><col style="width:26%"><col style="width:20%"><col style="width:32%"><col style="width:22%"></colgroup>
          <thead>
            <tr>
              <th>款号SPU(Satuan Pembelian)</th>
              <th>打印时间（Print Time）</th>
              <th>生产单号（Nomor produksi tunggal）</th>
              <th>工厂名字（Nama pabrik）</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml(qc.spuCode)}</td>
              <td>${escapeHtml(document.printMeta.generatedAt)}</td>
              <td>${escapeHtml(qc.productionOrderNo)}</td>
              <td>${escapeHtml(qc.managedPostFactoryName)}</td>
            </tr>
          </tbody>
        </table>

        <div class="pf-qc-section-title">SKU列表（Daftar SKU）</div>
        <table class="pf-qc-table pf-qc-sku-table">
          <colgroup><col style="width:17%"><col style="width:29%"><col style="width:29%"><col style="width:25%"></colgroup>
          <thead>
            <tr>
              <th>SKU</th>
              <th>待质检数量(Tes kualitas diperlukan)</th>
              <th>质检数量(Kualitas sudah diperiksa)</th>
              <th>日期签名(Date &amp; Tandatangan)</th>
            </tr>
          </thead>
          <tbody>
            ${qc.skuLines.map((line) => {
              const result = qc.qcSkuResults.find((item) => item.skuLineId === line.skuLineId || item.skuCode === line.skuCode)
              return `
                <tr>
                  <td>${escapeHtml(line.skuCode)}</td>
                  <td>${escapeHtml(formatPrintQty(line.plannedQty, line.qtyUnit))}</td>
                  <td>${result?.inspectedQty ? escapeHtml(formatPrintQty(result.inspectedQty, line.qtyUnit)) : ''}</td>
                  <td></td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
      </article>
    </div>
  `
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
  const targetRoute = `/fcs/pda/exec/${encodeURIComponent(qc.postTaskId || qc.productionOrderId)}?postMobileAction=complete-qc&qcOrderId=${encodeURIComponent(qc.qcOrderId)}`
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
    qrCodes: [{ title: '质检单二维码', value: qrPayload, description: '扫码进入 PDA 质检执行页', sizeMm: 30 }],
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
