import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  getPostFinishingFlowText,
  getPostFinishingSourceLabel,
  getPostFinishingWorkOrderById,
  type PostFinishingActionRecord,
  type PostFinishingWorkOrder,
} from '../../../data/fcs/post-finishing-domain.ts'
import {
  getDifferenceRecordsByWorkOrderId,
  getHandoverRecordsByWorkOrderId,
  getWarehouseRecordsByWorkOrderId,
} from '../../../data/fcs/process-warehouse-domain.ts'
import {
  createPrintDocumentId,
  formatPrintQty,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
  type PrintField,
  type PrintSection,
  type PrintTable,
} from '../../../data/fcs/print-service.ts'
import { resolveTaskPrintImage } from '../../../data/fcs/task-print-cards.ts'

function valueOrDash(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—'
  const text = String(value).trim()
  return text || '—'
}

function actionQty(action: PostFinishingActionRecord, primary?: number): string {
  return formatPrintQty(primary ?? action.acceptedGarmentQty, action.qtyUnit)
}

function actionTime(action: PostFinishingActionRecord): string {
  return action.finishedAt || action.startedAt || '—'
}

function isPlaceholderImage(sourceLabel: string): boolean {
  return sourceLabel === '暂无商品图'
}

function getPostActionFields(order: PostFinishingWorkOrder): PrintField[] {
  if (order.isPostDoneBySewingFactory) {
    return [
      { label: '后道状态', value: '后道已由车缝厂完成', emphasis: true },
      { label: '车缝工厂', value: order.sourceSewingFactoryName },
      { label: '车缝任务号', value: order.sourceSewingTaskNo },
      { label: '车缝厂后道完成成衣件数', value: formatPrintQty(order.postAction.completedPostGarmentQty ?? order.postAction.acceptedGarmentQty, order.postAction.qtyUnit), emphasis: true },
      { label: '后道完成时间', value: valueOrDash(order.postAction.finishedAt) },
      { label: '说明', value: order.postAction.skipReason || '本工厂仅执行接收领料、质检、复检、交出' },
    ]
  }

  return [
    { label: '后道状态', value: order.postAction.status },
    { label: '待后道成衣件数', value: formatPrintQty(order.qcAction.acceptedGarmentQty, order.qcAction.qtyUnit), emphasis: true },
    { label: '后道完成成衣件数', value: actionQty(order.postAction, order.postAction.completedPostGarmentQty), emphasis: true },
    { label: '后道操作人', value: valueOrDash(order.postAction.operatorName) },
    { label: '后道完成时间', value: valueOrDash(order.postAction.finishedAt) },
    { label: '备注', value: valueOrDash(order.postAction.remark) },
  ]
}

function buildRouteRows(order: PostFinishingWorkOrder): string[][] {
  const rows: Array<{ node: string; action?: PostFinishingActionRecord; qty: string; remark?: string }> = [
    { node: '接收领料', action: order.receiveAction, qty: actionQty(order.receiveAction, order.receiveAction.receivedGarmentQty ?? order.receiveAction.acceptedGarmentQty) },
    { node: '质检', action: order.qcAction, qty: actionQty(order.qcAction, order.qcAction.passedGarmentQty ?? order.qcAction.acceptedGarmentQty) },
  ]

  if (!order.isPostDoneBySewingFactory) {
    rows.push({
      node: '后道',
      action: order.postAction,
      qty: actionQty(order.postAction, order.postAction.completedPostGarmentQty ?? order.postAction.acceptedGarmentQty),
    })
  }

  rows.push(
    { node: '复检', action: order.recheckAction, qty: actionQty(order.recheckAction, order.recheckAction.confirmedGarmentQty ?? order.recheckAction.acceptedGarmentQty) },
    {
      node: '交出',
      qty: formatPrintQty(order.handoverAction?.handoverGarmentQty ?? 0, '件'),
      remark: order.handoverAction?.status || '待交出',
    },
  )

  return rows.map((row) => [
    row.node,
    row.action?.status || row.remark || '待交出',
    row.action?.operatorName || '—',
    row.action ? actionTime(row.action) : '—',
    row.qty,
    '',
  ])
}

function fieldsToGrid(fields: PrintField[]): string {
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

function renderTable(table: PrintTable): string {
  const rows = [...table.rows]
  while (rows.length < (table.minRows || 0)) {
    rows.push(Array.from({ length: table.headers.length }, () => ''))
  }
  return `
    <section class="print-section">
      <div class="print-section-title">${escapeHtml(table.title)}</div>
      <table class="print-table">
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

function renderSection(section: PrintSection): string {
  return `
    <section class="print-section">
      <div class="print-section-title">${escapeHtml(section.title)}</div>
      ${fieldsToGrid(section.fields)}
      ${section.note ? `<div class="print-note">${escapeHtml(section.note)}</div>` : ''}
    </section>
  `
}

export function buildPostFinishingRouteCardPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const order = getPostFinishingWorkOrderById(input.sourceId)
  if (!order) {
    throw new Error(`未找到后道单：${input.sourceId}`)
  }

  const printAt = getPrintGeneratedAt()
  const image = resolveTaskPrintImage({
    productionOrderId: order.sourceProductionOrderId || order.sourceProductionOrderNo,
    processName: '后道',
    craftName: '后道',
  })
  const warehouseRecords = getWarehouseRecordsByWorkOrderId(order.postOrderId)
  const waitProcessRecord = warehouseRecords.find((record) => record.recordType === 'WAIT_PROCESS')
  const waitHandoverRecord = warehouseRecords.find((record) => record.recordType === 'WAIT_HANDOVER')
  const handoverRecords = getHandoverRecordsByWorkOrderId(order.postOrderId)
  const latestHandover = handoverRecords[0]
  const differenceRecords = getDifferenceRecordsByWorkOrderId(order.postOrderId)
  const flowText = getPostFinishingFlowText(order)
  const sourceLabel = getPostFinishingSourceLabel(order)
  const qrTargetRoute = `/fcs/pda/exec/${encodeURIComponent(order.sourceTaskId)}`
  const qrValue = new URLSearchParams({
    sourceType: 'POST_FINISHING_WORK_ORDER',
    sourceId: order.postOrderId,
    postOrderNo: order.postOrderNo,
    targetRoute: qrTargetRoute,
  }).toString()

  const headerFields: PrintField[] = [
    { label: '后道单号', value: order.postOrderNo, emphasis: true },
    { label: '生产单', value: order.sourceProductionOrderNo, emphasis: true },
    { label: '来源任务', value: order.sourceTaskNo },
    { label: '来源车缝任务', value: order.sourceSewingTaskNo },
    { label: '当前工厂', value: order.currentFactoryName },
    { label: '后道工厂', value: order.managedPostFactoryName },
    { label: '后道来源', value: sourceLabel, emphasis: true },
    { label: '当前流程', value: flowText, emphasis: true },
    { label: '当前状态', value: order.currentStatus },
    { label: '打印时间', value: printAt },
  ]

  const productFields: PrintField[] = [
    { label: '款号', value: order.styleNo },
    { label: '商品名称', value: '后道成衣' },
    { label: 'SKU / 颜色 / 尺码概况', value: order.skuSummary },
    { label: '计划成衣件数', value: formatPrintQty(order.plannedGarmentQty, order.plannedGarmentQtyUnit), emphasis: true },
  ]

  const baseFields: PrintField[] = [
    { label: '后道单号', value: order.postOrderNo },
    { label: '生产单', value: order.sourceProductionOrderNo },
    { label: '来源任务', value: order.sourceTaskNo },
    { label: '来源车缝任务', value: order.sourceSewingTaskNo },
    { label: '当前工厂', value: order.currentFactoryName },
    { label: '后道来源', value: sourceLabel },
    { label: '是否专门后道工厂', value: order.isDedicatedPostFactory ? '是' : '否' },
    { label: '后道是否已由车缝厂完成', value: order.isPostDoneBySewingFactory ? '是' : '否' },
    { label: '计划成衣件数', value: formatPrintQty(order.plannedGarmentQty, order.plannedGarmentQtyUnit), emphasis: true },
    { label: '已完成后道成衣件数', value: formatPrintQty(order.postAction.completedPostGarmentQty ?? order.postAction.acceptedGarmentQty, order.postAction.qtyUnit), emphasis: true },
    { label: '待质检成衣件数', value: formatPrintQty(order.receiveAction.acceptedGarmentQty, order.receiveAction.qtyUnit), emphasis: true },
    { label: '待复检成衣件数', value: formatPrintQty(order.qcAction.acceptedGarmentQty, order.qcAction.qtyUnit), emphasis: true },
    { label: '待交出成衣件数', value: formatPrintQty(waitHandoverRecord?.availableObjectQty ?? order.recheckAction.acceptedGarmentQty, '件'), emphasis: true },
    { label: '当前状态', value: order.currentStatus },
    { label: '交付仓', value: waitHandoverRecord?.targetWarehouseName || '后道交出仓' },
  ]

  const sections: PrintSection[] = [
    { sectionId: 'product', title: '商品信息区', fields: productFields },
    { sectionId: 'base', title: '任务基础信息区', fields: baseFields },
    {
      sectionId: 'receive',
      title: '接收领料区',
      fields: [
        { label: '接收领料状态', value: order.receiveAction.status },
        { label: '应接收成衣件数', value: formatPrintQty(order.receiveAction.submittedGarmentQty, order.receiveAction.qtyUnit), emphasis: true },
        { label: '实接收成衣件数', value: formatPrintQty(order.receiveAction.receivedGarmentQty ?? order.receiveAction.acceptedGarmentQty, order.receiveAction.qtyUnit), emphasis: true },
        { label: '接收差异成衣件数', value: formatPrintQty(order.receiveAction.diffGarmentQty, order.receiveAction.qtyUnit), emphasis: true },
        { label: '接收人', value: valueOrDash(order.receiveAction.operatorName) },
        { label: '接收时间', value: valueOrDash(order.receiveAction.finishedAt) },
        { label: '签字', value: '' },
      ],
    },
    {
      sectionId: 'qc',
      title: '质检区',
      fields: [
        { label: '待质检成衣件数', value: formatPrintQty(order.qcAction.submittedGarmentQty, order.qcAction.qtyUnit), emphasis: true },
        { label: '质检通过成衣件数', value: formatPrintQty(order.qcAction.passedGarmentQty ?? order.qcAction.acceptedGarmentQty, order.qcAction.qtyUnit), emphasis: true },
        { label: '质检不合格成衣件数', value: formatPrintQty(order.qcAction.defectiveGarmentQty ?? order.qcAction.rejectedGarmentQty, order.qcAction.qtyUnit), emphasis: true },
        { label: '质检人', value: valueOrDash(order.qcAction.operatorName) },
        { label: '质检时间', value: valueOrDash(order.qcAction.finishedAt) },
        { label: '质检结果', value: valueOrDash(order.qcAction.qcResult) },
        { label: '签字', value: '' },
      ],
    },
    {
      sectionId: 'post',
      title: '后道区',
      fields: getPostActionFields(order),
      note: order.isPostDoneBySewingFactory
        ? '车缝厂已经完成该环节，本工厂仅执行接收领料、质检、复检、交出。'
        : '',
    },
    {
      sectionId: 'recheck',
      title: '复检区',
      fields: [
        { label: '待复检成衣件数', value: formatPrintQty(order.recheckAction.submittedGarmentQty, order.recheckAction.qtyUnit), emphasis: true },
        { label: '复检确认成衣件数', value: formatPrintQty(order.recheckAction.confirmedGarmentQty ?? order.recheckAction.acceptedGarmentQty, order.recheckAction.qtyUnit), emphasis: true },
        { label: '差异成衣件数', value: formatPrintQty(order.recheckAction.diffGarmentQty, order.recheckAction.qtyUnit), emphasis: true },
        { label: '复检人', value: valueOrDash(order.recheckAction.operatorName) },
        { label: '复检时间', value: valueOrDash(order.recheckAction.finishedAt) },
        { label: '签字', value: '' },
      ],
    },
    {
      sectionId: 'handover',
      title: '交出区',
      fields: [
        { label: '待交出成衣件数', value: formatPrintQty(waitHandoverRecord?.availableObjectQty ?? order.recheckAction.acceptedGarmentQty, '件'), emphasis: true },
        { label: '已交出成衣件数', value: formatPrintQty(latestHandover?.handoverObjectQty ?? order.handoverAction?.handoverGarmentQty ?? 0, '件'), emphasis: true },
        { label: '实收成衣件数', value: formatPrintQty(latestHandover?.receiveObjectQty ?? order.handoverAction?.receiveGarmentQty ?? 0, '件'), emphasis: true },
        { label: '差异成衣件数', value: formatPrintQty(latestHandover?.diffObjectQty ?? order.handoverAction?.diffGarmentQty ?? 0, '件'), emphasis: true },
        { label: '交出人', value: latestHandover?.handoverPerson || '—' },
        { label: '交出时间', value: latestHandover?.handoverAt || '—' },
        { label: '接收人', value: latestHandover?.receivePerson || '—' },
        { label: '回写时间', value: latestHandover?.receiveAt || '—' },
        { label: '签字', value: '' },
      ],
    },
  ]

  const tables: PrintTable[] = [
    {
      tableId: 'route-nodes',
      title: '流转节点区',
      headers: ['节点', '状态', '操作人', '时间', '成衣件数', '签字'],
      rows: buildRouteRows(order),
      minRows: order.isPostDoneBySewingFactory ? 4 : 5,
    },
  ]

  return {
    printDocumentId: createPrintDocumentId(input, 'POST_FINISHING_ROUTE_CARD'),
    documentType: 'TASK_ROUTE_CARD',
    documentTitle: '后道任务流转卡',
    sourceType: 'POST_FINISHING_WORK_ORDER',
    sourceId: order.postOrderId,
    templateCode: 'POST_FINISHING_ROUTE_CARD',
    paperType: 'A4',
    orientation: 'portrait',
    printTitle: '后道任务流转卡',
    printSubtitle: `${sourceLabel}｜${flowText}`,
    headerFields,
    imageBlocks: [
      {
        title: '商品信息区',
        imageUrl: isPlaceholderImage(image.sourceLabel) ? '' : image.url,
        imageLabel: image.title,
        sourceLabel: isPlaceholderImage(image.sourceLabel) ? '无业务图片' : image.sourceLabel,
        fallbackLabel: '暂无商品图',
      },
    ],
    qrCodes: [
      {
        title: '任务二维码',
        value: qrValue,
        description: '扫码进入工厂端后道任务详情',
        sizeMm: 30,
      },
    ],
    barcodes: [],
    sections,
    tables,
    signatureBlocks: [
      { label: '接收人签字', signerRole: '接收人' },
      { label: '质检人签字', signerRole: '质检人' },
      { label: order.isPostDoneBySewingFactory ? '车缝厂后道签字' : '后道人签字', signerRole: order.isPostDoneBySewingFactory ? '车缝后道人' : '后道人' },
      { label: '复检人签字', signerRole: '复检人' },
      { label: '交出人签字', signerRole: '交出人' },
      { label: '接收方签字', signerRole: '接收方' },
    ],
    differenceBlocks: [
      {
        title: '差异记录区',
        headers: ['差异类型', '应收成衣件数', '实收成衣件数', '差异成衣件数', '原因', '处理结果', '处理人', '处理时间'],
        rows: differenceRecords.map((record) => [
          record.differenceType,
          formatPrintQty(record.expectedObjectQty, record.qtyUnit),
          formatPrintQty(record.actualObjectQty, record.qtyUnit),
          formatPrintQty(record.diffObjectQty, record.qtyUnit),
          record.remark || '—',
          record.handlingResult || record.status,
          record.handledBy || '—',
          record.handledAt || '—',
        ]),
        minRows: 3,
      },
    ],
    footerFields: [
      { label: '待加工仓记录', value: waitProcessRecord?.warehouseRecordNo || order.waitProcessWarehouseRecordId },
      { label: '交出仓记录', value: waitHandoverRecord?.warehouseRecordNo || order.waitHandoverWarehouseRecordId || '暂无交出仓记录' },
      { label: '交出记录', value: latestHandover?.handoverRecordNo || order.handoverRecordId || '暂无交出记录' },
    ],
    printMeta: {
      generatedAt: printAt,
      generatedBy: '统一打印服务',
      printNotice: '打印前请在浏览器打印设置中关闭页眉和页脚',
      returnHref: `/fcs/craft/post-finishing/work-orders/${encodeURIComponent(order.postOrderId)}`,
    },
  }
}

export function renderPostFinishingRouteCardTemplate(doc: PrintDocument): string {
  const image = doc.imageBlocks[0]
  const qr = doc.qrCodes[0]

  return `
    <article class="print-paper-a4">
      <div class="print-card-sheet">
        <header>
          <div class="print-card-title">${escapeHtml(doc.printTitle)}</div>
          <div class="print-card-subtitle">${escapeHtml(doc.printSubtitle)}</div>
        </header>

        <section class="print-section">
          <div class="print-section-title">页头区</div>
          ${fieldsToGrid(doc.headerFields)}
        </section>

        <div class="print-main-grid">
          <section class="print-image-box">
            <div class="print-section-title">商品信息区</div>
            ${
              image?.imageUrl
                ? `<div class="print-image-frame"><img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageLabel)}"></div>`
                : `<div class="print-image-placeholder">${escapeHtml(image?.fallbackLabel || '暂无商品图')}</div>`
            }
            <div class="print-note">${escapeHtml(image?.sourceLabel || '无业务图片')}</div>
          </section>
          <section>
            ${doc.sections.filter((section) => section.sectionId === 'product' || section.sectionId === 'base').map(renderSection).join('')}
          </section>
          <section class="print-qr-box">
            <div class="print-section-title">二维码区</div>
            <div class="print-qr-inner">
              ${qr ? renderRealQrPlaceholder({
                value: qr.value,
                size: 112,
                title: qr.title,
                label: qr.title,
              }) : ''}
            </div>
            <div class="print-note">${escapeHtml(qr?.description || '扫码进入工厂端后道任务详情')}</div>
          </section>
        </div>

        ${doc.tables.map(renderTable).join('')}
        ${doc.sections.filter((section) => !['product', 'base'].includes(section.sectionId)).map(renderSection).join('')}
        ${doc.differenceBlocks.map((block) => renderTable({
          tableId: 'difference',
          title: block.title,
          headers: block.headers,
          rows: block.rows,
          minRows: block.minRows,
        })).join('')}

        <section class="print-section">
          <div class="print-section-title">签字区</div>
          <div class="print-signatures">
            ${doc.signatureBlocks.map((block) => `
              <div class="print-signature-box">
                <div>${escapeHtml(block.label)}</div>
                <div class="print-signature-line">${escapeHtml(block.signerRole)}</div>
              </div>
            `).join('')}
          </div>
        </section>

        <section class="print-section">
          <div class="print-section-title">底部信息</div>
          ${fieldsToGrid(doc.footerFields)}
        </section>
      </div>
    </article>
  `
}
