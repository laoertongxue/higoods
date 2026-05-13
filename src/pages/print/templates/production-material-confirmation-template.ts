import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  buildPrintBarcodePayload,
  buildPrintQrPayload,
  createPrintDocumentId,
  formatPrintQty,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
  type PrintField,
  type PrintImageBlock,
} from '../../../data/fcs/print-service.ts'
import {
  buildProductionConfirmationSnapshot,
  getOrCreateProductionConfirmation,
  getProductionConfirmationByOrderId,
  getProductionConfirmationSnapshotById,
  isProductionConfirmationPrintable,
  productionConfirmationStatusLabels,
  type ProductionConfirmation,
  type ProductionConfirmationBomSnapshotRow,
  type ProductionConfirmationImage,
  type ProductionConfirmationSnapshot,
} from '../../../data/fcs/production-confirmation.ts'
import {
  productionOrders,
  productionOrderStatusConfig,
  type ProductionOrder,
} from '../../../data/fcs/production-orders.ts'

export const ProductionMaterialConfirmationTemplate = 'ProductionMaterialConfirmationTemplate'
export const ProductionConfirmationTemplate = 'ProductionConfirmationTemplate'

interface ProductionPrintContext {
  order: ProductionOrder
  snapshot: ProductionConfirmationSnapshot
  confirmation?: ProductionConfirmation
  statusLabel: string
  confirmationNo: string
  confirmationVersion: number
  printVersionNo: string
  printedAt: string
  printedBy: string
  historyCount: number
}

function text(value: string | number | undefined | null, fallback = '暂无数据'): string {
  if (value === undefined || value === null) return fallback
  const normalized = String(value).trim()
  return normalized || fallback
}

function mapFields(rows: Array<{ label: string; value: string | number | undefined | null; emphasis?: boolean }>): PrintField[] {
  return rows.map((row) => ({ label: row.label, value: text(row.value), emphasis: row.emphasis }))
}

function formatPercent(value: number | null): string {
  return value === null || value === undefined ? '暂无数据' : `${value}%`
}

function materialUnitLabel(row: ProductionConfirmationBomSnapshotRow): string {
  return row.usageUnit || (row.materialType === '面料' ? '米' : '件')
}

function calcLossQty(row: ProductionConfirmationBomSnapshotRow): string {
  if (row.plannedUsageQty === null || row.lossRate === null) return '暂无数据'
  const divisor = 1 + row.lossRate / 100
  if (divisor <= 0) return '暂无数据'
  const baseUsage = row.plannedUsageQty / divisor
  const lossQty = Math.max(0, row.plannedUsageQty - baseUsage)
  return formatPrintQty(lossQty, materialUnitLabel(row))
}

function objectizedUnitConsumption(row: ProductionConfirmationBomSnapshotRow): string {
  if (row.unitConsumption === null) return '暂无数据'
  return row.materialType === '面料'
    ? `${row.unitConsumption} 米 / 件`
    : `${row.unitConsumption} ${materialUnitLabel(row)} / 件`
}

function objectizedPlannedUsage(row: ProductionConfirmationBomSnapshotRow): string {
  if (row.plannedUsageQty === null) return '暂无数据'
  return row.materialType === '面料'
    ? formatPrintQty(row.plannedUsageQty, '米')
    : formatPrintQty(row.plannedUsageQty, materialUnitLabel(row))
}

function firstImage(images: ProductionConfirmationImage[]): string | undefined {
  return images[0]?.url
}

function imageBlock(title: string, images: ProductionConfirmationImage[], fallbackLabel = '暂无图片'): PrintImageBlock {
  return {
    title,
    imageUrl: firstImage(images),
    imageLabel: images[0]?.label || fallbackLabel,
    sourceLabel: images[0] ? '生产资料图片' : '无业务图片',
    fallbackLabel,
  }
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
  return [
    imageBlock('面料图', snapshot.imageSnapshot.materialImages),
    imageBlock('辅料图', snapshot.imageSnapshot.accessoryImages),
  ]
}

export function resolvePrintProductImage(_sourceType: string, sourceId: string): PrintImageBlock {
  const snapshot = buildProductionConfirmationSnapshot(sourceId)
  return imageBlock('商品主图', snapshot.imageSnapshot.productImages)
}

function getProductionOrder(sourceId: string): ProductionOrder {
  const order = productionOrders.find((item) => item.productionOrderId === sourceId || item.productionOrderNo === sourceId)
  if (!order) throw new Error(`未找到生产单：${sourceId}`)
  return order
}

function resolveProductionPrintContext(productionOrderId: string): ProductionPrintContext {
  const order = getProductionOrder(productionOrderId)
  const existing = getProductionConfirmationByOrderId(order.productionOrderId)
  const printable = isProductionConfirmationPrintable(order.productionOrderId)
  let confirmation: ProductionConfirmation | undefined = existing

  if (!confirmation && printable.printable) {
    confirmation = getOrCreateProductionConfirmation(order.productionOrderId)
  }

  const snapshot = confirmation
    ? getProductionConfirmationSnapshotById(confirmation.snapshotId) || buildProductionConfirmationSnapshot(order.productionOrderId)
    : buildProductionConfirmationSnapshot(order.productionOrderId)
  const statusLabel = confirmation
    ? productionConfirmationStatusLabels[confirmation.status]
    : printable.printable ? '可打印' : printable.reason || '资料待完善'
  const confirmationNo = confirmation?.confirmationNo || snapshot.confirmationNo
  const confirmationVersion = confirmation?.confirmationVersion || snapshot.confirmationVersion
  const generatedAt = getPrintGeneratedAt()

  return {
    order,
    snapshot,
    confirmation,
    statusLabel,
    confirmationNo,
    confirmationVersion,
    printVersionNo: `V${confirmationVersion}`,
    printedAt: confirmation?.printedAt || generatedAt,
    printedBy: confirmation?.printedBy || '系统',
    historyCount: confirmation ? Math.max(1, confirmation.confirmationVersion) : 0,
  }
}

function buildSkuMatrixTable(snapshot: ProductionConfirmationSnapshot): PrintDocument['tables'][number] {
  const sizes = snapshot.sizeQtySnapshot.sizes
  return {
    tableId: 'sku-size-qty',
    title: 'SKU / 颜色 / 尺码数量矩阵',
    headers: ['颜色', ...sizes, '计划生产成衣件数合计', '备注'],
    rows: snapshot.sizeQtySnapshot.rows.map((row) => [
      row.color,
      ...sizes.map((size) => formatPrintQty(row.sizeQtyMap[size] || 0, '件')),
      formatPrintQty(row.totalQty, '件'),
      '按生产单执行',
    ]),
    minRows: 3,
  }
}

function buildMaterialTable(snapshot: ProductionConfirmationSnapshot): PrintDocument['tables'][number] {
  return {
    tableId: 'bom-materials',
    title: '面辅料信息区',
    headers: ['物料类型', '物料 SKU', '物料名称', '颜色', '规格', '单件面料用量 / 单件辅料用量', '损耗率', '计划面料米数 / 计划辅料数量', '损耗面料米数 / 损耗辅料数量', '物料图片', '备注'],
    rows: snapshot.bomSnapshot.map((row) => [
      row.materialType,
      row.materialSku,
      row.materialName,
      row.materialColor,
      row.spec,
      objectizedUnitConsumption(row),
      formatPercent(row.lossRate),
      objectizedPlannedUsage(row),
      calcLossQty(row),
      row.materialImageUrl ? '已关联物料图' : '暂无图片',
      [row.printRequirement, row.dyeRequirement].filter(Boolean).join('；') || '按技术包要求',
    ]),
    minRows: 4,
  }
}

function buildProcessTable(snapshot: ProductionConfirmationSnapshot): PrintDocument['tables'][number] {
  return {
    tableId: 'process-route',
    title: '工序工艺区',
    headers: ['工序名称', '工艺名称', '工艺要求', '执行工厂类型', '是否特殊工艺', '质检点', '计划完成节点', '备注'],
    rows: snapshot.taskAssignmentSnapshot.map((row) => [
      row.processName,
      row.craftName || row.taskDisplayName,
      row.remark || '按生产资料执行',
      row.assignedFactoryName,
      row.processName.includes('特殊工艺') || row.stageName.includes('特殊工艺') ? '是' : '否',
      `${row.processName}完成后按质检标准复核`,
      row.taskDeadline || '随生产计划',
      `${row.targetObject || '任务对象'}：${formatPrintQty(row.taskQty, row.qtyUnit)}`,
    ]),
    minRows: 5,
  }
}

function buildPatternTable(snapshot: ProductionConfirmationSnapshot): PrintDocument['tables'][number] {
  const rows = snapshot.patternSnapshot.rows.flatMap((pattern) =>
    pattern.pieceRows.length
      ? pattern.pieceRows.map((piece) => [
          pattern.patternVersion || '暂无数据',
          pattern.patternFileName || '暂无数据',
          pattern.sizeRange || pattern.selectedSizeCodes.join(' / ') || '暂无数据',
          piece.name,
          formatPrintQty(piece.count, '片 / 件'),
          piece.colorAllocations.map((item) => `${item.colorName} ${formatPrintQty(item.pieceCount, '片')}`).join('；') || '按颜色矩阵',
          piece.specialCrafts.map((item) => item.displayName || item.craftName).join('、') || '无',
          '菲票归属原始裁片单，合并裁剪批次只作为执行上下文',
        ])
      : [[
          pattern.patternVersion || '暂无数据',
          pattern.patternFileName || '暂无数据',
          pattern.sizeRange || pattern.selectedSizeCodes.join(' / ') || '暂无数据',
          '暂无裁片部位',
          '暂无数据',
          '暂无数据',
          '无',
          '菲票归属原始裁片单，合并裁剪批次只作为执行上下文',
        ]],
  )

  return {
    tableId: 'pattern-cutting',
    title: '纸样 / 唛架 / 裁片信息区',
    headers: ['纸样版本', '纸样 / 唛架文件', '尺码范围', '裁片部位', '部位数量', '颜色裁片数量', '特殊工艺', '裁片口径'],
    rows,
    minRows: 3,
  }
}

function buildQcTable(): PrintDocument['tables'][number] {
  return {
    tableId: 'qc-standard',
    title: '质检标准区',
    headers: ['检查项', '检查标准', '抽检方式', '不合格处理方式', '备注'],
    rows: [
      ['尺寸复核', '按纸样 / 尺码表公差执行', '首件 + 抽检', '返修或平台确认', '只展示质检标准，不直接生成质量扣款流水'],
      ['外观与污渍', '无明显污渍、破洞、线头异常', '随机抽检', '隔离异常件', '异常进入差异处理'],
      ['工艺一致性', '印花、染色、特殊工艺、后道按确认资料执行', '过程抽检', '暂停并复核工艺资料', '不得直接生成质量扣款流水'],
    ],
    minRows: 4,
  }
}

function buildHeaderFields(context: ProductionPrintContext): PrintField[] {
  const { order, snapshot } = context

  return mapFields([
    { label: '生产确认单号', value: context.confirmationNo, emphasis: true },
    { label: '生产单号', value: order.productionOrderNo, emphasis: true },
    { label: '来源需求单号', value: snapshot.productionOrderSnapshot.sourceDemandNos.join('、') },
    { label: '确认单状态', value: context.statusLabel },
    { label: '生产单状态', value: productionOrderStatusConfig[order.status]?.label || order.status },
    { label: '当前版本', value: context.printVersionNo },
    { label: '打印版本', value: context.printVersionNo },
    { label: '打印时间', value: context.printedAt },
    { label: '打印人', value: context.printedBy },
  ])
}

function buildProductionSections(context: ProductionPrintContext): PrintDocument['sections'] {
  const { order, snapshot } = context
  return [
    {
      sectionId: 'base',
      title: '基础信息区',
      fields: mapFields([
        { label: '款号', value: snapshot.styleSnapshot.styleCode },
        { label: '款式名称', value: snapshot.styleSnapshot.styleName },
        { label: 'SPU', value: snapshot.styleSnapshot.spuCode },
        { label: '商品名称', value: snapshot.styleSnapshot.spuName },
        { label: '首单 / 翻单', value: snapshot.productionOrderSnapshot.orderType },
        { label: '生产类型', value: snapshot.productionOrderSnapshot.orderType },
        { label: '生产工厂或主工厂', value: order.mainFactorySnapshot.name },
        { label: '要求交期', value: snapshot.productionOrderSnapshot.requiredDeliveryDate || '暂无数据' },
        { label: '计划开始日期', value: snapshot.productionOrderSnapshot.plannedStartDate },
        { label: '计划完成日期', value: snapshot.productionOrderSnapshot.plannedFinishDate },
        { label: '计划生产成衣件数', value: formatPrintQty(snapshot.productionOrderSnapshot.plannedQty, '件'), emphasis: true },
        { label: '生产备注', value: snapshot.productionOrderSnapshot.productionRemark },
      ]),
    },
    {
      sectionId: 'delivery',
      title: '包装与交付要求区',
      fields: mapFields([
        { label: '包装方式', value: '按订单包装标准执行' },
        { label: '吊牌 / 水洗标 / 贴标要求', value: '按技术包和商品档案要求执行' },
        { label: '外箱要求', value: '按交付仓收货规范' },
        { label: '交付仓', value: order.deliveryWarehouseName || '待确认' },
        { label: '交付方式', value: order.deliveryWarehouseStatus === 'SET' ? '交付仓已设置' : '待跟单确认' },
        { label: '备注', value: order.deliveryWarehouseRemark || snapshot.productionOrderSnapshot.productionRemark || '暂无数据' },
      ]),
    },
  ]
}

function buildProductionTables(snapshot: ProductionConfirmationSnapshot): PrintDocument['tables'] {
  return [
    buildSkuMatrixTable(snapshot),
    buildMaterialTable(snapshot),
    buildProcessTable(snapshot),
    buildPatternTable(snapshot),
    buildQcTable(),
  ]
}

function buildDocument(input: PrintDocumentBuildInput): PrintDocument {
  const context = resolveProductionPrintContext(input.sourceId)
  const { order, snapshot } = context
  const generatedAt = getPrintGeneratedAt()
  const documentType = 'PRODUCTION_CONFIRMATION'
  const templateCode = 'PRODUCTION_CONFIRMATION'
  const title = '生产确认单'
  const targetRoute = `/fcs/production/orders/${encodeURIComponent(order.productionOrderId)}/confirmation-print`
  const businessNo = context.confirmationNo
  const qrPayload = buildPrintQrPayload({
    documentType,
    sourceType: 'PRODUCTION_ORDER',
    sourceId: order.productionOrderId,
    businessNo,
    targetRoute,
    printVersionNo: context.printVersionNo,
    extra: {
      productionOrderNo: order.productionOrderNo,
      sourceType: 'PRODUCTION_ORDER',
    },
  })

  return {
    printDocumentId: createPrintDocumentId({ ...input, sourceId: order.productionOrderId, documentType }, templateCode),
    documentType,
    documentTitle: title,
    sourceType: 'PRODUCTION_ORDER',
    sourceId: order.productionOrderId,
    templateCode,
    paperType: 'A4',
    orientation: 'portrait',
    printTitle: title,
    printSubtitle: '生产单正式确认与工厂现场做货的统一依据，覆盖 SKU 数量、面辅料、工序工艺、纸样唛架、图片资料、交付和签收。',
    headerFields: buildHeaderFields(context),
    imageBlocks: resolveProductionPrintImages(order.productionOrderId),
    qrCodes: [
      {
        title: `${title}二维码`,
        value: qrPayload,
        description: '扫码查看生产资料',
        sizeMm: 30,
      },
    ],
    barcodes: [
      {
        title: `${title}条码`,
        value: buildPrintBarcodePayload({
          documentType,
          sourceType: 'PRODUCTION_ORDER',
          sourceId: order.productionOrderId,
          businessNo,
          printVersionNo: context.printVersionNo,
        }),
        description: '生产资料条码',
      },
    ],
    sections: buildProductionSections(context),
    tables: buildProductionTables(snapshot),
    signatureBlocks: [
      { label: '跟单确认', signerRole: '跟单' },
      { label: '生产负责人确认', signerRole: '生产负责人' },
      { label: '工厂确认', signerRole: '工厂负责人' },
      { label: '现场做货确认', signerRole: '现场负责人' },
      { label: '质检确认', signerRole: '质检负责人' },
      { label: '日期', signerRole: '确认日期' },
    ],
    differenceBlocks: [],
    footerFields: [
      { label: '生产单号', value: order.productionOrderNo },
      { label: '打印时间', value: generatedAt },
      { label: '页码', value: '第 1 页 / 共 N 页' },
      { label: '统一打印服务', value: 'PrintDocument' },
    ],
    printMeta: {
      generatedAt,
      generatedBy: '系统自动生成',
      printNotice: '打印前请在浏览器打印设置中关闭页眉和页脚',
      returnHref: `/fcs/production/orders/${encodeURIComponent(order.productionOrderId)}`,
    },
    qrPayload,
    barcodePayload: buildPrintBarcodePayload({
      documentType,
      sourceType: 'PRODUCTION_ORDER',
      sourceId: order.productionOrderId,
      businessNo,
      printVersionNo: context.printVersionNo,
    }),
    printVersionNo: context.printVersionNo,
  }
}

export function buildProductionMaterialConfirmationPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  return buildDocument(input)
}

export function buildProductionConfirmationPrintDocument(input: PrintDocumentBuildInput | string): PrintDocument {
  const resolved = typeof input === 'string'
    ? { documentType: 'PRODUCTION_CONFIRMATION', sourceType: 'PRODUCTION_ORDER', sourceId: input } as PrintDocumentBuildInput
    : input
  return buildDocument(resolved)
}

function renderFieldGrid(fields: PrintField[], columns = 4): string {
  return `
    <div class="print-field-grid print-field-grid-${columns}">
      ${fields.map((field) => `
        <div class="print-field ${field.emphasis ? 'print-field-emphasis' : ''}">
          <div class="print-field-label">${escapeHtml(field.label)}</div>
          <div class="print-field-value">${escapeHtml(field.value || '—')}</div>
        </div>
      `).join('')}
    </div>
  `
}

function renderImageBlocks(blocks: PrintImageBlock[], prominent: boolean): string {
  return `
    <section class="print-section print-avoid-break">
      <div class="print-section-title">图片资料区</div>
      <div class="${prominent ? 'print-production-image-grid print-production-image-grid-prominent' : 'print-production-image-grid'}">
        ${blocks.map((image) => `
          <figure class="print-production-image-card">
            <figcaption>${escapeHtml(image.title)}</figcaption>
            ${
              image.imageUrl
                ? `<div class="print-production-image-frame"><img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageLabel)}"></div>`
                : `<div class="print-image-placeholder">${escapeHtml(image.fallbackLabel || '暂无图片')}</div>`
            }
            <div class="print-note">${escapeHtml(image.sourceLabel || '图片资料')}</div>
          </figure>
        `).join('')}
      </div>
    </section>
  `
}

function renderQrBox(doc: PrintDocument): string {
  const qr = doc.qrCodes[0]
  const barcode = doc.barcodes[0]
  return `
    <section class="print-qr-box">
      <div class="print-section-title">${escapeHtml(qr?.title || '二维码')}</div>
      <div class="print-qr-inner">
        ${qr ? renderRealQrPlaceholder({
          value: qr.value,
          size: 112,
          title: qr.title,
          label: qr.title,
        }) : ''}
      </div>
      <div class="print-note">${escapeHtml(qr?.description || '扫码查看生产资料')}</div>
      ${barcode ? `<div class="print-production-barcode">${escapeHtml(barcode.value)}</div>` : ''}
    </section>
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
      <table class="print-table print-production-table">
        <thead>
          <tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>${table.headers.map((_, index) => `<td>${escapeHtml(row[index] || '')}</td>`).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `
}

function renderSignatureBlocks(blocks: PrintDocument['signatureBlocks']): string {
  const title = blocks.some((item) => item.label.includes('跟单'))
    ? '确认与签字区'
    : '工厂确认区'
  return `
    <section class="print-section print-avoid-break">
      <div class="print-section-title">${title}</div>
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

export function renderProductionMaterialConfirmationTemplate(doc: PrintDocument): string {
  return `
    <article class="print-paper-a4 print-production-confirmation">
      <div class="print-card-sheet">
        <header class="print-production-header">
          <div>
            <div class="print-card-title">${escapeHtml(doc.printTitle)}</div>
            <div class="print-card-subtitle">${escapeHtml(doc.printSubtitle)}</div>
          </div>
          ${renderQrBox(doc)}
        </header>

        <section class="print-section">
          <div class="print-section-title">页头区</div>
          ${renderFieldGrid(doc.headerFields)}
        </section>

        ${renderImageBlocks(doc.imageBlocks, true)}

        ${doc.sections.map((section) => `
          <section class="print-section">
            <div class="print-section-title">${escapeHtml(section.title)}</div>
            ${renderFieldGrid(section.fields)}
            ${section.note ? `<div class="print-note">${escapeHtml(section.note)}</div>` : ''}
          </section>
        `).join('')}

        ${doc.tables.map(renderTable).join('')}

        ${renderSignatureBlocks(doc.signatureBlocks)}

        <footer class="print-footer-fields">
          ${doc.footerFields.map((field) => `<span>${escapeHtml(field.label)}：${escapeHtml(field.value || '—')}</span>`).join('')}
        </footer>
      </div>
    </article>
  `
}

export const renderProductionConfirmationTemplate = renderProductionMaterialConfirmationTemplate
