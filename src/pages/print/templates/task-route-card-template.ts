import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  buildTaskRouteCardPrintDoc,
  type TaskRouteCardSourceType,
} from '../../../data/fcs/task-print-cards.ts'
import {
  createPrintDocumentId,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
  type PrintField,
  type PrintSourceType,
} from '../../../data/fcs/print-service.ts'

type TaskRouteCardAdapterInput = PrintDocumentBuildInput | string

const TASK_ROUTE_CARD_TEMPLATE_CODE_BY_SOURCE: Record<TaskRouteCardSourceType, string> = {
  RUNTIME_TASK: 'RUNTIME_TASK_ROUTE_CARD',
  PRINTING_WORK_ORDER: 'PRINTING_WORK_ORDER_ROUTE_CARD',
  DYEING_WORK_ORDER: 'DYEING_WORK_ORDER_ROUTE_CARD',
  SPECIAL_CRAFT_TASK_ORDER: 'SPECIAL_CRAFT_TASK_ORDER_ROUTE_CARD',
  POST_FINISHING_WORK_ORDER: 'POST_FINISHING_ROUTE_CARD',
  CUTTING_ORIGINAL_ORDER: 'CUTTING_ORIGINAL_ORDER_ROUTE_CARD',
  CUTTING_MERGE_BATCH: 'CUTTING_MERGE_BATCH_ROUTE_CARD',
}

function emptyToDash(value: string | undefined): string {
  return value && value.trim() ? value : '—'
}

function mapFields(rows: Array<{ label: string; value: string }>): PrintField[] {
  return rows.map((row) => ({ label: row.label, value: row.value }))
}

function isPlaceholderImage(sourceLabel: string): boolean {
  return sourceLabel === '暂无商品图'
}

function getSourceTypeLabel(sourceType: string): string {
  const labels: Record<string, string> = {
    RUNTIME_TASK: '运行任务',
    PRINTING_WORK_ORDER: '印花加工单',
    DYEING_WORK_ORDER: '染色加工单',
    SPECIAL_CRAFT_TASK_ORDER: '特殊工艺单',
    CUTTING_ORIGINAL_ORDER: '原始裁片单',
    CUTTING_MERGE_BATCH: '合并裁剪批次',
    POST_FINISHING_WORK_ORDER: '后道单',
  }
  return labels[sourceType] || sourceType
}

function resolveTaskRouteCardInput(input: TaskRouteCardAdapterInput, sourceType: TaskRouteCardSourceType): PrintDocumentBuildInput {
  if (typeof input === 'string') {
    return { documentType: 'TASK_ROUTE_CARD', sourceType, sourceId: input }
  }
  return input
}

function resolveTaskRouteTargetRoute(sourceType: PrintSourceType, sourceId: string, doc: ReturnType<typeof buildTaskRouteCardPrintDoc>): string {
  switch (sourceType) {
    case 'RUNTIME_TASK':
      return `/fcs/pda/exec/${encodeURIComponent(doc.taskId || sourceId)}`
    case 'PRINTING_WORK_ORDER':
      return `/fcs/craft/printing/work-orders/${encodeURIComponent(sourceId)}`
    case 'DYEING_WORK_ORDER':
      return `/fcs/craft/dyeing/work-orders/${encodeURIComponent(sourceId)}`
    case 'SPECIAL_CRAFT_TASK_ORDER':
      return `/fcs/pda/exec/${encodeURIComponent(doc.taskId || sourceId)}`
    case 'POST_FINISHING_WORK_ORDER':
      return `/fcs/craft/post-finishing/work-orders/${encodeURIComponent(sourceId)}`
    case 'CUTTING_ORIGINAL_ORDER':
      return `/fcs/craft/cutting/original-orders?originalCutOrderId=${encodeURIComponent(sourceId)}`
    case 'CUTTING_MERGE_BATCH':
      return `/fcs/craft/cutting/merge-batches?mergeBatchId=${encodeURIComponent(sourceId)}`
    default:
      return `/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=${encodeURIComponent(String(sourceType))}&sourceId=${encodeURIComponent(sourceId)}`
  }
}

function buildTaskRouteQrValue(input: PrintDocumentBuildInput, doc: ReturnType<typeof buildTaskRouteCardPrintDoc>): string {
  const targetRoute = resolveTaskRouteTargetRoute(input.sourceType, input.sourceId, doc)
  const payload = new URLSearchParams({
    documentType: 'TASK_ROUTE_CARD',
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    taskNo: doc.taskNo || doc.sourceId,
    targetRoute,
  })
  return payload.toString()
}

function buildTaskRouteCardPrintDocumentForSource(
  input: PrintDocumentBuildInput,
  templateCode: string,
): PrintDocument {
  const doc = buildTaskRouteCardPrintDoc({
    sourceType: input.sourceType as TaskRouteCardSourceType,
    sourceId: input.sourceId,
  })
  const generatedAt = getPrintGeneratedAt()

  return {
    printDocumentId: createPrintDocumentId(input, templateCode),
    documentType: 'TASK_ROUTE_CARD',
    documentTitle: doc.title,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    templateCode,
    paperType: 'A4',
    orientation: 'portrait',
    printTitle: doc.title,
    printSubtitle: '任务级单据，随任务执行链路流转。',
    headerFields: mapFields(doc.summaryRows),
    imageBlocks: [
      {
        title: '商品信息',
        imageUrl: isPlaceholderImage(doc.imageSourceLabel) ? '' : doc.imageUrl,
        imageLabel: doc.imageLabel,
        sourceLabel: isPlaceholderImage(doc.imageSourceLabel) ? '无业务图片' : doc.imageSourceLabel,
        fallbackLabel: '暂无商品图',
      },
    ],
    qrCodes: [
      {
        title: doc.qrLabel,
        value: buildTaskRouteQrValue(input, doc),
        description: '扫码进入工厂端任务详情',
        sizeMm: 30,
      },
    ],
    barcodes: [],
    sections: [
      {
        sectionId: 'extra',
        title: '任务补充信息',
        fields: mapFields(doc.extraRows),
      },
    ],
    tables: [
      {
        tableId: 'route-records',
        title: '流转记录表',
        headers: ['节点', '开始时间', '结束时间', '完成对象数量', '异常对象数量', '设备/工位', '操作人', '备注', '签字'],
        rows: doc.nodeRows.map((row) => [
          emptyToDash(row.node),
          emptyToDash(row.startedAt),
          emptyToDash(row.finishedAt),
          emptyToDash(row.completedQty),
          emptyToDash(row.exceptionQty),
          emptyToDash(row.station),
          emptyToDash(row.operator),
          emptyToDash(row.remark),
          '',
        ]),
        minRows: 8,
      },
    ],
    signatureBlocks: [
      { label: '任务接收签字', signerRole: '接收人' },
      { label: '执行确认签字', signerRole: '操作人' },
      { label: '交出确认签字', signerRole: '交出人' },
      { label: '接收确认签字', signerRole: '接收方' },
      { label: '审核确认签字', signerRole: '审核人' },
    ],
    differenceBlocks: [
      {
        title: '差异记录区',
        headers: ['差异类型', '应收对象数量', '实收对象数量', '差异对象数量', '原因', '处理结果', '签字'],
        rows: [],
        minRows: 3,
      },
    ],
    footerFields: [
      { label: '打印时间', value: generatedAt },
      { label: '来源类型', value: getSourceTypeLabel(input.sourceType) },
    ],
    printMeta: {
      generatedAt,
      generatedBy: '系统自动生成',
      printNotice: '打印前请在浏览器打印设置中关闭页眉和页脚',
      returnHref: '/fcs/progress/board',
    },
  }
}

export function buildLegacyTaskRouteCardPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  return buildTaskRouteCardPrintDocumentForSource(input, 'TASK_ROUTE_CARD')
}

export function buildRuntimeTaskRouteCardPrintDocument(input: TaskRouteCardAdapterInput): PrintDocument {
  const resolvedInput = resolveTaskRouteCardInput(input, 'RUNTIME_TASK')
  return buildTaskRouteCardPrintDocumentForSource(resolvedInput, TASK_ROUTE_CARD_TEMPLATE_CODE_BY_SOURCE.RUNTIME_TASK)
}

export function buildPrintingWorkOrderRouteCardPrintDocument(input: TaskRouteCardAdapterInput): PrintDocument {
  const resolvedInput = resolveTaskRouteCardInput(input, 'PRINTING_WORK_ORDER')
  return buildTaskRouteCardPrintDocumentForSource(resolvedInput, TASK_ROUTE_CARD_TEMPLATE_CODE_BY_SOURCE.PRINTING_WORK_ORDER)
}

export function buildDyeingWorkOrderRouteCardPrintDocument(input: TaskRouteCardAdapterInput): PrintDocument {
  const resolvedInput = resolveTaskRouteCardInput(input, 'DYEING_WORK_ORDER')
  return buildTaskRouteCardPrintDocumentForSource(resolvedInput, TASK_ROUTE_CARD_TEMPLATE_CODE_BY_SOURCE.DYEING_WORK_ORDER)
}

export function buildSpecialCraftTaskOrderRouteCardPrintDocument(input: TaskRouteCardAdapterInput): PrintDocument {
  const resolvedInput = resolveTaskRouteCardInput(input, 'SPECIAL_CRAFT_TASK_ORDER')
  return buildTaskRouteCardPrintDocumentForSource(resolvedInput, TASK_ROUTE_CARD_TEMPLATE_CODE_BY_SOURCE.SPECIAL_CRAFT_TASK_ORDER)
}

export function buildCuttingOriginalOrderRouteCardPrintDocument(input: TaskRouteCardAdapterInput): PrintDocument {
  const resolvedInput = resolveTaskRouteCardInput(input, 'CUTTING_ORIGINAL_ORDER')
  return buildTaskRouteCardPrintDocumentForSource(resolvedInput, TASK_ROUTE_CARD_TEMPLATE_CODE_BY_SOURCE.CUTTING_ORIGINAL_ORDER)
}

export function buildCuttingMergeBatchRouteCardPrintDocument(input: TaskRouteCardAdapterInput): PrintDocument {
  const resolvedInput = resolveTaskRouteCardInput(input, 'CUTTING_MERGE_BATCH')
  return buildTaskRouteCardPrintDocumentForSource(resolvedInput, TASK_ROUTE_CARD_TEMPLATE_CODE_BY_SOURCE.CUTTING_MERGE_BATCH)
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
  const minRows = table.minRows || 0
  const rows = [...table.rows]
  while (rows.length < minRows) {
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

function renderDifferenceBlock(block: PrintDocument['differenceBlocks'][number]): string {
  const minRows = block.minRows || 0
  const rows = [...block.rows]
  while (rows.length < minRows) {
    rows.push(Array.from({ length: block.headers.length }, () => ''))
  }

  return `
    <section class="print-section print-avoid-break">
      <div class="print-section-title">${escapeHtml(block.title)}</div>
      <table class="print-table">
        <thead>
          <tr>${block.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>${block.headers.map((_, index) => `<td>${escapeHtml(row[index] || '')}</td>`).join('')}</tr>
          `).join('')}
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

export function renderTaskRouteCardTemplate(doc: PrintDocument): string {
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
            <div class="print-section-title">${escapeHtml(image?.title || '商品信息')}</div>
            ${
              image?.imageUrl
                ? `<div class="print-image-frame"><img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageLabel)}"></div>`
                : `<div class="print-image-placeholder">${escapeHtml(image?.fallbackLabel || '暂无商品图')}</div>`
            }
            <div class="print-note">${escapeHtml(image?.sourceLabel || '图片信息')}</div>
          </section>
          <section>
            <div class="print-section-title">任务基础信息</div>
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
            <div class="print-note">${escapeHtml(qr?.description || '扫码查看任务')}</div>
          </section>
        </div>

        ${doc.sections.map((section) => `
          <section class="print-section">
            <div class="print-section-title">${escapeHtml(section.title)}</div>
            ${renderFieldGrid(section.fields)}
            ${section.note ? `<div class="print-note">${escapeHtml(section.note)}</div>` : ''}
          </section>
        `).join('')}

        ${doc.tables.map(renderTable).join('')}

        ${doc.differenceBlocks.map(renderDifferenceBlock).join('')}

        ${renderSignatureBlocks(doc.signatureBlocks)}

        <footer class="print-footer-fields">
          ${doc.footerFields.map((field) => `
            <span>${escapeHtml(field.label)}：${escapeHtml(field.value || '—')}</span>
          `).join('')}
        </footer>
      </div>
    </article>
  `
}
