import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  buildTaskDeliveryCardPrintDocByRecordId,
  resolveTaskPrintImage,
  type TaskDeliveryCardLine,
  type TaskDeliveryCardPrintDoc,
} from '../../../data/fcs/task-print-cards.ts'
import {
  getDifferenceRecordsByHandoverRecordId,
  getProcessHandoverRecordById,
  getProcessWarehouseRecordById,
  listProcessWarehouseReviewRecords,
  type ProcessHandoverDifferenceRecord,
  type ProcessHandoverRecord,
  type ProcessWarehouseObjectType,
  type ProcessWarehouseRecord,
} from '../../../data/fcs/process-warehouse-domain.ts'
import {
  getPostFinishingSourceLabel,
  getPostFinishingWorkOrderById,
} from '../../../data/fcs/post-finishing-domain.ts'
import {
  createPrintDocumentId,
  formatPrintQty,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
  type PrintField,
} from '../../../data/fcs/print-service.ts'

type TaskDeliveryCardAdapterInput = PrintDocumentBuildInput | string
type DeliveryVariant = 'runtime' | 'printing' | 'dyeing' | 'specialCraft' | 'postFinishing' | 'cutting' | 'sewing'

const DELIVERY_TITLE_BY_VARIANT: Record<DeliveryVariant, string> = {
  runtime: '任务交货卡',
  printing: '印花任务交货卡',
  dyeing: '染色任务交货卡',
  specialCraft: '特殊工艺任务交货卡',
  postFinishing: '后道任务交货卡',
  cutting: '裁片任务交货卡',
  sewing: '车缝任务交货卡',
}

function toText(value: string | number | undefined | null, fallback = '—'): string {
  if (value === undefined || value === null) return fallback
  const text = String(value).trim()
  return text || fallback
}

function emptyToDash(value: string | undefined): string {
  return value && value.trim() ? value : '—'
}

function resolveDeliveryInput(input: TaskDeliveryCardAdapterInput): PrintDocumentBuildInput {
  if (typeof input === 'string') {
    return {
      documentType: 'TASK_DELIVERY_CARD',
      sourceType: 'HANDOVER_RECORD',
      sourceId: input,
      handoverRecordId: input,
    }
  }
  const handoverRecordId = input.handoverRecordId || input.sourceId
  return {
    ...input,
    documentType: 'TASK_DELIVERY_CARD',
    sourceType: input.sourceType || 'HANDOVER_RECORD',
    sourceId: input.sourceId || handoverRecordId,
    handoverRecordId,
  }
}

function mapFields(rows: Array<{ label: string; value: string; emphasis?: boolean }>): PrintField[] {
  return rows.map((row) => ({ label: row.label, value: row.value, emphasis: row.emphasis }))
}

function objectQtyNoun(objectType: ProcessWarehouseObjectType | string, qtyUnit?: string): string {
  if (objectType === '面料' || String(objectType).includes('面料')) return qtyUnit === '卷' ? '面料卷数' : '面料米数'
  if (objectType === '裁片' || String(objectType).includes('裁片')) return '裁片数量'
  if (objectType === '成衣' || String(objectType).includes('成衣') || qtyUnit === '件') return '成衣件数'
  return '对象数量'
}

function qtyText(value: number | undefined | null, unit: string | undefined): string {
  if (!Number.isFinite(value)) return '待回写'
  return formatPrintQty(value, unit || '')
}

function isPlaceholderImage(sourceLabel: string | undefined): boolean {
  return !sourceLabel || sourceLabel === '暂无商品图' || sourceLabel === '无业务图片'
}

function inferVariantFromText(text: string): DeliveryVariant {
  if (text.includes('印花')) return 'printing'
  if (text.includes('染色')) return 'dyeing'
  if (text.includes('后道')) return 'postFinishing'
  if (text.includes('车缝') || text.includes('缝制')) return 'sewing'
  if (text.includes('裁片') || text.includes('裁剪') || text.includes('裁床')) return 'cutting'
  if (['打揽', '打条', '捆条', '烫画', '直喷', '激光切', '洗水', '特殊工艺'].some((keyword) => text.includes(keyword))) {
    return 'specialCraft'
  }
  return 'runtime'
}

function inferVariantFromProcess(record: ProcessHandoverRecord): DeliveryVariant {
  if (record.craftType === 'PRINT') return 'printing'
  if (record.craftType === 'DYE') return 'dyeing'
  if (record.craftType === 'SPECIAL_CRAFT') return 'specialCraft'
  if (record.craftType === 'POST_FINISHING') return 'postFinishing'
  return inferVariantFromText(`${record.craftName} ${record.sourceTaskNo} ${record.sourceWorkOrderNo}`)
}

function resolveTargetRoute(record: ProcessHandoverRecord): string {
  if (record.craftType === 'PRINT') return `/fcs/craft/printing/work-orders/${encodeURIComponent(record.sourceWorkOrderId)}?tab=handover`
  if (record.craftType === 'DYE') return `/fcs/craft/dyeing/work-orders/${encodeURIComponent(record.sourceWorkOrderId)}?tab=handover`
  if (record.craftType === 'POST_FINISHING') return `/fcs/craft/post-finishing/work-orders/${encodeURIComponent(record.sourceWorkOrderId)}?tab=handover`
  if (record.craftType === 'SPECIAL_CRAFT') return `/fcs/process-factory/special-craft/tasks?handoverRecordId=${encodeURIComponent(record.handoverRecordId)}`
  return `/fcs/progress/handover?recordId=${encodeURIComponent(record.handoverRecordId)}`
}

function buildDeliveryQrValue(input: {
  handoverRecordId: string
  handoverRecordNo: string
  sourceWorkOrderNo: string
  targetRoute: string
}): string {
  return new URLSearchParams({
    documentType: 'TASK_DELIVERY_CARD',
    sourceType: 'HANDOVER_RECORD',
    handoverRecordId: input.handoverRecordId,
    handoverRecordNo: input.handoverRecordNo,
    sourceWorkOrderNo: input.sourceWorkOrderNo,
    targetRoute: input.targetRoute,
  }).toString()
}

function findFieldValue(rows: Array<{ label: string; value: string }> | undefined, keyword: string, fallback = '待回写'): string {
  return rows?.find((row) => row.label.includes(keyword))?.value || fallback
}

function buildDifferenceRows(differences: ProcessHandoverDifferenceRecord[]): string[][] {
  return differences.map((record) => [
    record.differenceType,
    qtyText(record.expectedObjectQty, record.qtyUnit),
    qtyText(record.actualObjectQty, record.qtyUnit),
    qtyText(record.diffObjectQty, record.qtyUnit),
    record.remark || record.handlingResult || '接收方回写差异',
    record.responsibilitySide,
    record.handlingResult || record.nextAction || '待处理',
    [record.handledBy, record.handledAt].filter(Boolean).join(' / '),
  ])
}

function buildLegacyDifferenceRows(doc: TaskDeliveryCardPrintDoc, noun: string): string[][] {
  const diffValue = findFieldValue(doc.writebackRows, '差异', '')
  if (!diffValue) return []
  return [[
    `${noun}差异`,
    qtyText(doc.submittedQty, doc.qtyUnit),
    findFieldValue(doc.writebackRows, '回写', '待回写'),
    diffValue,
    findFieldValue(doc.remarkRows, '接收方备注', '现场回写差异'),
    '待判定',
    '平台处理',
    '',
  ]]
}

function buildLineRows(lines: TaskDeliveryCardLine[], noun: string): string[][] {
  return lines.map((line) => [
    line.objectTypeLabel || noun,
    line.itemName || '交出明细',
    line.materialOrSku || '待确认',
    line.color || '待确认',
    line.size || '待确认',
    line.partName || '待确认',
    line.carrierNo || '待确认',
    qtyText(line.submittedQty, line.qtyUnit),
    line.qtyUnit || '',
    '',
  ])
}

function buildUnifiedLineRows(record: ProcessHandoverRecord, warehouse?: ProcessWarehouseRecord): string[][] {
  return [[
    record.objectType,
    warehouse?.materialName || record.craftName || '交出对象',
    warehouse?.materialSku || warehouse?.skuSummary || record.sourceTaskNo || '待确认',
    warehouse?.skuSummary || '见 SKU 概况',
    warehouse?.skuSummary || '见 SKU 概况',
    record.objectType === '裁片' ? '裁片部位见菲票' : '—',
    record.relatedFeiTicketIds.length > 0 ? record.relatedFeiTicketIds.join('、') : `${record.packageQty || 0} ${record.packageUnit || ''}`.trim(),
    qtyText(record.handoverObjectQty, record.qtyUnit),
    record.qtyUnit,
    record.remark || '',
  ]]
}

function getLegacyDeliveryVariant(doc: TaskDeliveryCardPrintDoc, preferredVariant?: DeliveryVariant): DeliveryVariant {
  return preferredVariant || inferVariantFromText(`${doc.title} ${doc.processName} ${doc.craftName || ''} ${doc.taskNo || ''}`)
}

function buildDocumentFromLegacyDoc(
  input: PrintDocumentBuildInput,
  doc: TaskDeliveryCardPrintDoc,
  preferredVariant?: DeliveryVariant,
): PrintDocument {
  const generatedAt = getPrintGeneratedAt()
  const line = doc.lineRows[0]
  const noun = objectQtyNoun(line?.objectTypeLabel || doc.processName, doc.qtyUnit)
  const variant = getLegacyDeliveryVariant(doc, preferredVariant)
  const title = DELIVERY_TITLE_BY_VARIANT[variant]
  const imageUrl = isPlaceholderImage(doc.imageSourceLabel) ? '' : doc.imageUrl

  return {
    printDocumentId: createPrintDocumentId(input, 'TASK_DELIVERY_CARD'),
    documentType: 'TASK_DELIVERY_CARD',
    documentTitle: title,
    sourceType: 'HANDOVER_RECORD',
    sourceId: doc.handoverRecordId,
    templateCode: 'TASK_DELIVERY_CARD',
    paperType: 'A4',
    orientation: 'portrait',
    printTitle: title,
    printSubtitle: '用于工厂交出、接收回写、差异确认和现场签收。',
    headerFields: mapFields([
      { label: '交货卡号 / 交出记录号', value: doc.handoverRecordNo, emphasis: true },
      { label: '来源单据号', value: doc.handoverOrderNo },
      { label: '生产单号', value: doc.productionOrderNo || '待确认' },
      { label: '当前状态', value: findFieldValue(doc.writebackRows, '异议状态', doc.summaryRows.find((row) => row.label === '状态')?.value || '待回写') },
      { label: '打印时间', value: generatedAt },
    ]),
    imageBlocks: [
      {
        title: '商品信息',
        imageUrl,
        imageLabel: doc.imageLabel,
        sourceLabel: imageUrl ? doc.imageSourceLabel : '无业务图片',
        fallbackLabel: '暂无商品图',
      },
    ],
    qrCodes: [
      {
        title: '交出二维码',
        value: buildDeliveryQrValue({
          handoverRecordId: doc.handoverRecordId,
          handoverRecordNo: doc.handoverRecordNo,
          sourceWorkOrderNo: doc.handoverOrderNo,
          targetRoute: `/fcs/progress/handover?recordId=${encodeURIComponent(doc.handoverRecordId)}`,
        }),
        description: '扫码查看交出记录',
        sizeMm: 30,
      },
    ],
    barcodes: [],
    sections: [
      {
        sectionId: 'parties',
        title: '交出方与接收方',
        fields: mapFields([
          { label: '交出方工厂', value: doc.sourceFactoryName },
          { label: '交出人', value: doc.summaryRows.find((row) => row.label === '提交人')?.value || '工厂操作员' },
          { label: '交出时间', value: doc.submittedAt || '待确认' },
          { label: '接收方', value: doc.receiverName },
          { label: '接收仓 / 接收工厂', value: doc.receiverName },
          { label: '接收人', value: findFieldValue(doc.writebackRows, '回写人', '待回写') },
          { label: '回写时间', value: findFieldValue(doc.writebackRows, '回写时间', '待回写') },
        ]),
      },
      {
        sectionId: 'base',
        title: '任务基础信息',
        fields: mapFields([
          { label: '任务编号 / 加工单号', value: doc.taskNo || doc.handoverOrderNo },
          { label: '生产单', value: doc.productionOrderNo || '待确认' },
          { label: '工序 / 工艺', value: [doc.processName, doc.craftName].filter(Boolean).join(' / ') || '待确认' },
          { label: '款号', value: doc.summaryRows.find((row) => row.label.includes('款号'))?.value || '随生产单' },
          { label: '商品名称', value: doc.summaryRows.find((row) => row.label.includes('商品'))?.value || '随生产单' },
          { label: 'SKU / 颜色 / 尺码概况', value: doc.lineRows.map((row) => [row.materialOrSku, row.color, row.size].filter(Boolean).join(' / ')).slice(0, 2).join('；') || '待确认' },
          { label: '来源任务', value: doc.taskNo || '待确认' },
          { label: `计划${noun}`, value: qtyText(doc.submittedQty, doc.qtyUnit) },
          ...(variant === 'sewing' ? [
            { label: '是否本厂完成后道', value: `${doc.title} ${doc.processName} ${doc.craftName || ''}`.includes('后道') ? '是' : '按任务要求确认' },
            { label: '后道完成成衣件数', value: qtyText(doc.submittedQty, doc.qtyUnit) },
            { label: '后道后流向', value: '交给后道工厂质检和复检' },
            { label: '关联后道单号', value: '待后道工厂接收后关联' },
          ] : []),
        ]),
      },
      {
        sectionId: 'delivery',
        title: '本次交出信息区',
        fields: mapFields([
          { label: '本次交出对象类型', value: line?.objectTypeLabel || noun },
          { label: `交出${noun}`, value: qtyText(doc.submittedQty, doc.qtyUnit), emphasis: true },
          { label: '包装数量', value: `${doc.lineRows.length || 1} 包` },
          { label: `实收${noun}`, value: findFieldValue(doc.writebackRows, '回写', '待回写') },
          { label: `差异${noun}`, value: findFieldValue(doc.writebackRows, '差异', '0') },
          { label: '当前状态', value: findFieldValue(doc.writebackRows, '异议状态', '待回写') },
        ]),
      },
      {
        sectionId: 'writeback',
        title: '回写信息区',
        fields: mapFields([
          { label: `应收${noun}`, value: qtyText(doc.submittedQty, doc.qtyUnit) },
          { label: `实收${noun}`, value: findFieldValue(doc.writebackRows, '回写', '待回写') },
          { label: `差异${noun}`, value: findFieldValue(doc.writebackRows, '差异', '0') },
          { label: '回写人', value: findFieldValue(doc.writebackRows, '回写人', '待回写') },
          { label: '回写时间', value: findFieldValue(doc.writebackRows, '回写时间', '待回写') },
          { label: '回写状态', value: findFieldValue(doc.writebackRows, '异议状态', '待回写') },
          { label: '凭证', value: '现场拍照凭证随交出记录留存' },
          { label: '备注', value: findFieldValue(doc.remarkRows, '接收方备注', '无') },
        ]),
      },
    ],
    tables: [
      {
        tableId: 'delivery-lines',
        title: '交出明细表',
        headers: ['明细类型', '物料 / 裁片 / 成衣说明', '编码 / SKU', '颜色', '尺码', '部位', '卷号 / 菲票号 / 包号 / 箱号', `本次交出${noun}`, '单位', '备注'],
        rows: buildLineRows(doc.lineRows, noun),
        minRows: 4,
      },
    ],
    differenceBlocks: [
      {
        title: '差异记录区',
        headers: ['差异类型', '应收对象数量', '实收对象数量', '差异对象数量', '原因', '责任方', '处理结果', '处理人 / 处理时间'],
        rows: buildLegacyDifferenceRows(doc, noun),
        minRows: 3,
      },
    ],
    signatureBlocks: [
      { label: '交出人签字', signerRole: '交出人' },
      { label: '接收人签字', signerRole: '接收人' },
      { label: '回写人签字', signerRole: '回写人' },
      { label: '平台确认人签字', signerRole: '平台确认人' },
      { label: '备注', signerRole: '现场备注' },
    ],
    footerFields: [
      { label: '打印时间', value: generatedAt },
      { label: '交出记录', value: doc.handoverRecordNo },
    ],
    printMeta: {
      generatedAt,
      generatedBy: '系统自动生成',
      printNotice: '打印前请在浏览器打印设置中关闭页眉和页脚',
      returnHref: `/fcs/progress/handover?recordId=${encodeURIComponent(doc.handoverRecordId)}`,
    },
  }
}

function buildDocumentFromProcessHandover(
  input: PrintDocumentBuildInput,
  record: ProcessHandoverRecord,
  preferredVariant?: DeliveryVariant,
): PrintDocument {
  const generatedAt = getPrintGeneratedAt()
  const warehouse = getProcessWarehouseRecordById(record.warehouseRecordId)
  const differences = getDifferenceRecordsByHandoverRecordId(record.handoverRecordId)
  const review = listProcessWarehouseReviewRecords({ handoverRecordId: record.handoverRecordId })[0]
  const postOrder = record.craftType === 'POST_FINISHING' ? getPostFinishingWorkOrderById(record.sourceWorkOrderId) : undefined
  const variant = preferredVariant || inferVariantFromProcess(record)
  const title = DELIVERY_TITLE_BY_VARIANT[variant]
  const noun = objectQtyNoun(record.objectType, record.qtyUnit)
  const image = resolveTaskPrintImage({
    productionOrderId: record.sourceProductionOrderId || record.sourceProductionOrderNo,
    processName: record.craftName,
    craftName: record.craftName,
  })
  const imageUrl = isPlaceholderImage(image.sourceLabel) ? '' : image.url
  const targetRoute = resolveTargetRoute(record)

  const postNote = postOrder
    ? '后道交出只能来自复检完成后的后道交出仓；车缝厂完成后道后需交给后道工厂接收、质检、复检，不能直接生成后道交货卡。'
    : undefined

  return {
    printDocumentId: createPrintDocumentId(input, 'TASK_DELIVERY_CARD'),
    documentType: 'TASK_DELIVERY_CARD',
    documentTitle: title,
    sourceType: 'HANDOVER_RECORD',
    sourceId: record.handoverRecordId,
    templateCode: 'TASK_DELIVERY_CARD',
    paperType: 'A4',
    orientation: 'portrait',
    printTitle: title,
    printSubtitle: '用于工厂交出、接收回写、差异确认和现场签收。',
    headerFields: mapFields([
      { label: '交货卡号 / 交出记录号', value: record.handoverRecordNo, emphasis: true },
      { label: '来源单据号', value: record.sourceWorkOrderNo },
      { label: '生产单号', value: record.sourceProductionOrderNo },
      { label: '当前状态', value: record.status },
      { label: '打印时间', value: generatedAt },
    ]),
    imageBlocks: [
      {
        title: '商品信息',
        imageUrl,
        imageLabel: image.title,
        sourceLabel: imageUrl ? image.sourceLabel : '无业务图片',
        fallbackLabel: '暂无商品图',
      },
    ],
    qrCodes: [
      {
        title: '交出二维码',
        value: buildDeliveryQrValue({
          handoverRecordId: record.handoverRecordId,
          handoverRecordNo: record.handoverRecordNo,
          sourceWorkOrderNo: record.sourceWorkOrderNo,
          targetRoute,
        }),
        description: '扫码查看交出记录',
        sizeMm: 30,
      },
    ],
    barcodes: [],
    sections: [
      {
        sectionId: 'parties',
        title: '交出方与接收方',
        fields: mapFields([
          { label: '交出方工厂', value: record.handoverFactoryName || warehouse?.sourceFactoryName || '待确认' },
          { label: '交出人', value: record.handoverPerson || '工厂操作员' },
          { label: '交出时间', value: record.handoverAt || '待确认' },
          { label: '接收方', value: record.receiveFactoryName || warehouse?.targetFactoryName || '待确认' },
          { label: '接收仓 / 接收工厂', value: record.receiveWarehouseName || record.receiveFactoryName || '待确认' },
          { label: '接收人', value: record.receivePerson || '待回写' },
          { label: '回写时间', value: record.receiveAt || '待回写' },
        ]),
      },
      {
        sectionId: 'base',
        title: '任务基础信息',
        fields: mapFields([
          { label: '任务编号 / 加工单号 / 后道单号 / 裁片单号 / 车缝任务号', value: record.sourceWorkOrderNo || record.sourceTaskNo },
          { label: '生产单', value: record.sourceProductionOrderNo || '待确认' },
          { label: '工序 / 工艺', value: record.craftName },
          { label: '款号', value: warehouse?.styleNo || postOrder?.styleNo || '随生产单' },
          { label: '商品名称', value: warehouse?.materialName || '随生产单' },
          { label: '商品图或款式图', value: imageUrl ? image.sourceLabel : '暂无商品图' },
          { label: 'SKU / 颜色 / 尺码概况', value: warehouse?.skuSummary || postOrder?.skuSummary || warehouse?.materialSku || '待确认' },
          { label: '来源任务', value: record.sourceTaskNo || '待确认' },
          { label: `计划${noun}`, value: qtyText(warehouse?.plannedObjectQty || postOrder?.plannedGarmentQty || record.handoverObjectQty, record.qtyUnit) },
          ...(postOrder ? [
            { label: '来源车缝任务', value: postOrder.sourceSewingTaskNo },
            { label: '后道工厂', value: postOrder.managedPostFactoryName },
            { label: '后道来源', value: getPostFinishingSourceLabel(postOrder) },
            { label: '复检确认成衣件数', value: qtyText(postOrder.recheckAction.confirmedGarmentQty, postOrder.recheckAction.qtyUnit) },
          ] : []),
          ...(record.craftType === 'SPECIAL_CRAFT' ? [
            { label: '关联菲票', value: record.relatedFeiTicketIds.length > 0 ? record.relatedFeiTicketIds.join('、') : '待现场绑定' },
          ] : []),
        ]),
        note: record.craftType === 'POST_FINISHING'
          ? `后道来源：${postOrder ? getPostFinishingSourceLabel(postOrder) : '后道工厂执行'}。${postNote}`
          : record.craftType === 'SPECIAL_CRAFT'
            ? `关联菲票：${record.relatedFeiTicketIds.length > 0 ? record.relatedFeiTicketIds.join('、') : '待现场绑定'}。`
            : record.craftType === 'PRINT'
              ? '印花交货卡按面料米数、卷数和接收方回写记录留痕。'
              : record.craftType === 'DYE'
                ? '染色交货卡按面料米数、卷数和接收方回写记录留痕。'
                : undefined,
      },
      {
        sectionId: 'delivery',
        title: '本次交出信息区',
        fields: mapFields([
          { label: '本次交出对象类型', value: record.objectType },
          { label: `交出${noun}`, value: qtyText(record.handoverObjectQty, record.qtyUnit), emphasis: true },
          { label: '包装数量', value: qtyText(record.packageQty, record.packageUnit) },
          { label: `实收${noun}`, value: record.receiveAt ? qtyText(record.receiveObjectQty, record.qtyUnit) : '待回写' },
          { label: `差异${noun}`, value: qtyText(record.diffObjectQty, record.qtyUnit) },
          { label: '当前状态', value: record.status },
          { label: '审核状态', value: review?.reviewStatus || '待审核' },
          { label: '交出记录号', value: record.handoverRecordNo },
        ]),
      },
      {
        sectionId: 'writeback',
        title: '回写信息区',
        fields: mapFields([
          { label: `应收${noun}`, value: qtyText(record.handoverObjectQty, record.qtyUnit) },
          { label: `实收${noun}`, value: record.receiveAt ? qtyText(record.receiveObjectQty, record.qtyUnit) : '待回写' },
          { label: `差异${noun}`, value: qtyText(record.diffObjectQty, record.qtyUnit) },
          { label: '回写人', value: record.receivePerson || '待回写' },
          { label: '回写时间', value: record.receiveAt || '待回写' },
          { label: '回写状态', value: record.status },
          { label: '凭证', value: record.evidenceUrls.length > 0 ? record.evidenceUrls.join('、') : '现场拍照凭证随交出记录留存' },
          { label: '备注', value: record.remark || '无' },
        ]),
      },
    ],
    tables: [
      {
        tableId: 'delivery-lines',
        title: '交出明细表',
        headers: ['明细类型', '物料 / 裁片 / 成衣说明', '编码 / SKU', '颜色', '尺码', '部位', '卷号 / 菲票号 / 包号 / 箱号', `本次交出${noun}`, '单位', '备注'],
        rows: buildUnifiedLineRows(record, warehouse),
        minRows: 4,
      },
    ],
    differenceBlocks: [
      {
        title: '差异记录区',
        headers: ['差异类型', '应收对象数量', '实收对象数量', '差异对象数量', '原因', '责任方', '处理结果', '处理人 / 处理时间'],
        rows: buildDifferenceRows(differences),
        minRows: 3,
      },
    ],
    signatureBlocks: [
      { label: '交出人签字', signerRole: '交出人' },
      { label: '接收人签字', signerRole: '接收人' },
      { label: '回写人签字', signerRole: '回写人' },
      { label: '平台确认人签字', signerRole: '平台确认人' },
      { label: '备注', signerRole: '现场备注' },
    ],
    footerFields: [
      { label: '打印时间', value: generatedAt },
      { label: '交出记录', value: record.handoverRecordNo },
      { label: '统一交出事实源', value: 'ProcessHandoverRecord' },
    ],
    printMeta: {
      generatedAt,
      generatedBy: '系统自动生成',
      printNotice: '打印前请在浏览器打印设置中关闭页眉和页脚',
      returnHref: targetRoute,
    },
  }
}

export function buildTaskDeliveryCardPrintDocument(
  input: TaskDeliveryCardAdapterInput,
  preferredVariant?: DeliveryVariant,
): PrintDocument {
  const resolvedInput = resolveDeliveryInput(input)
  const handoverRecordId = resolvedInput.handoverRecordId || resolvedInput.sourceId
  const processRecord = getProcessHandoverRecordById(handoverRecordId)
  if (processRecord) {
    return buildDocumentFromProcessHandover(resolvedInput, processRecord, preferredVariant)
  }

  const legacyDoc = buildTaskDeliveryCardPrintDocByRecordId(handoverRecordId)
  return buildDocumentFromLegacyDoc(resolvedInput, legacyDoc, preferredVariant)
}

export function buildRuntimeTaskDeliveryCardPrintDocument(input: TaskDeliveryCardAdapterInput): PrintDocument {
  return buildTaskDeliveryCardPrintDocument(input, 'runtime')
}

export function buildPrintingDeliveryCardPrintDocument(input: TaskDeliveryCardAdapterInput): PrintDocument {
  return buildTaskDeliveryCardPrintDocument(input, 'printing')
}

export function buildDyeingDeliveryCardPrintDocument(input: TaskDeliveryCardAdapterInput): PrintDocument {
  return buildTaskDeliveryCardPrintDocument(input, 'dyeing')
}

export function buildSpecialCraftDeliveryCardPrintDocument(input: TaskDeliveryCardAdapterInput): PrintDocument {
  return buildTaskDeliveryCardPrintDocument(input, 'specialCraft')
}

export function buildPostFinishingDeliveryCardPrintDocument(input: TaskDeliveryCardAdapterInput): PrintDocument {
  return buildTaskDeliveryCardPrintDocument(input, 'postFinishing')
}

export function buildCuttingDeliveryCardPrintDocument(input: TaskDeliveryCardAdapterInput): PrintDocument {
  return buildTaskDeliveryCardPrintDocument(input, 'cutting')
}

export function buildSewingDeliveryCardPrintDocument(input: TaskDeliveryCardAdapterInput): PrintDocument {
  return buildTaskDeliveryCardPrintDocument(input, 'sewing')
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

export function renderTaskDeliveryCardTemplate(doc: PrintDocument): string {
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
            <div class="print-note">${escapeHtml(qr?.description || '扫码查看交出记录')}</div>
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
