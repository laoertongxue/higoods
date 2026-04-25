import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildPrintDocument,
  printTemplateRegistry,
  renderPrintDocument,
  requiredPrintDocumentTypes,
  validatePrintTemplateRegistry,
} from '../src/data/fcs/print-template-registry.ts'
import {
  createPrintRecord,
  createPrintRecordFromDocument,
  createReprintRecord,
  getPrintRecordById,
  getPrintRecordsBySource,
  listPrintRecords,
  markPrintRecordPrinted,
} from '../src/data/fcs/print-record-domain.ts'
import { getSettlementChangeRequests } from '../src/data/fcs/settlement-change-requests.ts'
import { listProcessHandoverDifferenceRecords } from '../src/data/fcs/process-warehouse-domain.ts'
import { listQualityDeductionCaseFacts } from '../src/data/fcs/quality-deduction-repository.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertIncludes(content: string, token: string, message: string): void {
  assert(content.includes(token), message)
}

function assertNotIncludes(content: string, token: string, message: string): void {
  assert(!content.includes(token), message)
}

function build(documentType: string, sourceType: string, sourceId: string) {
  return buildPrintDocument({ documentType, sourceType, sourceId } as any)
}

function assertNoPrintShell(html: string, name: string): void {
  ;['商品中心系统', '采购管理系统', '工厂生产协同', '工作台', '业务 Tab'].forEach((token) =>
    assertNotIncludes(html, token, `${name} 不得渲染 Web 壳：${token}`),
  )
  assertNotIncludes(html, '系统占位图', `${name} 不得显示大块系统占位图`)
}

function main(): void {
  const printService = read('src/data/fcs/print-service.ts')
  const registry = read('src/data/fcs/print-template-registry.ts')
  const preview = read('src/pages/print/print-preview.ts')
  const businessTemplate = read('src/pages/print/templates/business-request-form-template.ts')
  const routeLinks = read('src/data/fcs/fcs-route-links.ts')
  const settlementEvents = read('src/pages/settlement/events.ts')
  const settlementRequestPage = read('src/pages/settlement/request-domain.ts')
  const settlementListPage = read('src/pages/settlement/list-domain.ts')
  const printingDetail = read('src/pages/process-factory/printing/work-order-detail.ts')
  const dyeingDetail = read('src/pages/process-factory/dyeing/work-order-detail.ts')
  const specialDetail = read('src/pages/process-factory/special-craft/work-order-detail.ts')
  const qcDetail = read('src/pages/qc-records/detail-domain.ts')
  const docs = read('docs/fcs-print-service-plan.md')
  const printRecordDomain = read('src/data/fcs/print-record-domain.ts')

  ;[
    'TASK_ROUTE_CARD',
    'TASK_DELIVERY_CARD',
    'MATERIAL_PREP_SLIP',
    'PICKUP_SLIP',
    'ISSUE_SLIP',
    'SUPPLEMENT_MATERIAL_SLIP',
    'FEI_TICKET_LABEL',
    'FEI_TICKET_REPRINT_LABEL',
    'FEI_TICKET_VOID_LABEL',
    'TRANSFER_BAG_LABEL',
    'CUTTING_ORDER_QR_LABEL',
    'HANDOVER_QR_LABEL',
    'PRODUCTION_CONFIRMATION',
    'MAKE_GOODS_CONFIRMATION',
  ].forEach((token) => assertIncludes(printService + registry + preview, token, `前六步打印能力缺少 ${token}`))

  ;[
    'SETTLEMENT_CHANGE_REQUEST',
    'HANDOVER_DIFFERENCE_REQUEST',
    'QUALITY_DEDUCTION_CONFIRMATION',
    'QUALITY_DISPUTE_PROCESSING',
    'MASTER_DATA_CHANGE_REQUEST',
  ].forEach((token) => assertIncludes(printService + registry + preview, token, `缺少业务申请单 documentType：${token}`))

  ;[
    'BusinessRequestFormTemplate',
    'SettlementChangeRequestTemplate',
    'HandoverDifferenceRequestTemplate',
    'QualityDeductionConfirmationTemplate',
    'QualityDisputeProcessingTemplate',
    'MasterDataChangeRequestTemplate',
  ].forEach((token) => assertIncludes(businessTemplate, token, `缺少业务申请单模板：${token}`))

  ;[
    'buildSettlementChangeRequestPrintDocument',
    'buildHandoverDifferenceRequestPrintDocument',
    'buildQualityDeductionConfirmationPrintDocument',
    'buildQualityDisputeProcessingPrintDocument',
    'buildMasterDataChangeRequestPrintDocument',
  ].forEach((token) => assertIncludes(businessTemplate, token, `缺少业务申请单 adapter：${token}`))

  ;[
    '结算信息变更申请单',
    '差异处理申请单',
    '质量扣款确认单',
    '质量异议处理单',
    '资料变更申请单',
  ].forEach((token) => assertIncludes(businessTemplate + docs + settlementListPage, token, `缺少业务申请单中文文案：${token}`))

  ;[
    'buildSettlementChangeRequestPrintLink',
    'buildHandoverDifferenceRequestPrintLink',
    'buildQualityDeductionConfirmationPrintLink',
    'buildQualityDisputeProcessingPrintLink',
    'buildMasterDataChangeRequestPrintLink',
  ].forEach((token) => assertIncludes(routeLinks, `function ${token}`, `缺少打印链接构建函数：${token}`))

  assertIncludes(settlementEvents + settlementRequestPage + settlementListPage, 'buildSettlementChangeRequestPrintLink', '结算信息变更申请单未进入统一打印预览')
  assertNotIncludes(settlementEvents, 'window.print()', '结算信息变更申请单不得继续在弹层内 window.print')
  assertIncludes(printingDetail + dyeingDetail + specialDetail, '打印差异处理申请单', '差异处理申请单缺少页面入口')
  assertIncludes(qcDetail, '打印质量扣款确认单', '质量扣款确认单缺少页面入口')
  assertIncludes(qcDetail, '打印质量异议处理单', '质量异议处理单缺少页面入口')
  assertIncludes(settlementListPage, '打印资料变更申请单', '资料变更申请单缺少页面入口')

  ;[
    'PrintRecord',
    'printRecordId',
    'printBatchId',
    'createPrintRecord',
    'listPrintRecords',
    'getPrintRecordById',
    'getPrintRecordsBySource',
    'markPrintRecordPrinted',
    'createReprintRecord',
  ].forEach((token) => assertIncludes(printRecordDomain + preview, token, `缺少统一打印记录能力：${token}`))

  const registryIssues = validatePrintTemplateRegistry()
  assert(registryIssues.length === 0, `模板注册表校验失败：${registryIssues.join('；')}`)
  requiredPrintDocumentTypes.forEach((documentType) => {
    assert(printTemplateRegistry.some((template) => template.documentType === documentType), `未集中注册 documentType：${documentType}`)
  })

  const settlementId = getSettlementChangeRequests()[0]?.requestId
  const differenceId = listProcessHandoverDifferenceRecords()[0]?.differenceRecordId
  const qualityCaseWithPending = listQualityDeductionCaseFacts({ includeLegacy: true }).find((item) => item.pendingDeductionRecord)
  const qualityCaseWithDispute = listQualityDeductionCaseFacts({ includeLegacy: true }).find((item) => item.disputeCase)
  assert(settlementId, '缺少结算信息变更申请单 mock 数据')
  assert(differenceId, '缺少统一差异记录 mock 数据')
  assert(qualityCaseWithPending?.pendingDeductionRecord?.pendingRecordId, '缺少待确认质量扣款记录 mock 数据')
  assert(qualityCaseWithDispute?.disputeCase?.disputeId, '缺少质量异议处理 mock 数据')

  const docsToRender = [
    build('SETTLEMENT_CHANGE_REQUEST', 'SETTLEMENT_CHANGE_REQUEST_RECORD', settlementId!),
    build('HANDOVER_DIFFERENCE_REQUEST', 'HANDOVER_DIFFERENCE_RECORD', differenceId!),
    build('QUALITY_DEDUCTION_CONFIRMATION', 'QUALITY_DEDUCTION_PENDING_RECORD', qualityCaseWithPending!.pendingDeductionRecord!.pendingRecordId),
    build('QUALITY_DISPUTE_PROCESSING', 'QUALITY_DISPUTE_RECORD', qualityCaseWithDispute!.disputeCase!.disputeId),
    build('MASTER_DATA_CHANGE_REQUEST', 'MASTER_DATA_CHANGE_REQUEST_RECORD', 'MDCR-202604-001'),
  ]

  docsToRender.forEach((doc) => {
    const html = renderPrintDocument(doc)
    assert(doc.paperType === 'A4', `${doc.documentType} 必须为 A4 单据`)
    assert(doc.templateCode === doc.documentType, `${doc.documentType} 模板编码必须与 documentType 对齐`)
    assert(doc.qrCodes.length > 0, `${doc.documentType} 缺少二维码`)
    assert(doc.signatureBlocks.length > 0, `${doc.documentType} 缺少签字区`)
    assertNoPrintShell(html, doc.documentTitle)
    assertNotIncludes(html, '数量：', `${doc.documentTitle} 不得只写数量`)
    const record = createPrintRecordFromDocument(doc, '已预览')
    assert(record.printRecordId && record.documentType === doc.documentType, `${doc.documentTitle} 未生成统一打印记录`)
    const printed = markPrintRecordPrinted(record.printRecordId, { printedBy: '检查脚本' })
    assert(printed?.printStatus === '已打印', `${doc.documentTitle} 打印记录状态未更新`)
    const reprint = createReprintRecord(record.printRecordId, { printedBy: '检查脚本' })
    assert(reprint.printStatus === '已补打', `${doc.documentTitle} 补打记录未生成`)
    assert(getPrintRecordById(record.printRecordId), `${doc.documentTitle} 无法按记录号查询`)
    assert(getPrintRecordsBySource(doc.documentType, doc.sourceId).length >= 1, `${doc.documentTitle} 无法按来源查询打印记录`)
  })

  const settlementHtml = renderPrintDocument(docsToRender[0])
  assertIncludes(settlementHtml, '变更前信息区', '结算信息变更申请单缺少变更前信息')
  assertIncludes(settlementHtml, '变更后信息区', '结算信息变更申请单缺少变更后信息')
  assertIncludes(settlementHtml, '工厂负责人签字', '结算信息变更申请单缺少签字区')

  const differenceHtml = renderPrintDocument(docsToRender[1])
  assertIncludes(differenceHtml, '应收', '差异处理申请单缺少应收对象数量')
  assertIncludes(differenceHtml, '实收', '差异处理申请单缺少实收对象数量')
  assertIncludes(differenceHtml, '差异', '差异处理申请单缺少差异对象数量')
  assertIncludes(differenceHtml, '不直接生成质量扣款流水', '差异处理申请单不得生成质量扣款流水')
  assertIncludes(differenceHtml, '对账流水或结算流水', '差异处理申请单不得生成对账或结算流水')

  const qualityHtml = renderPrintDocument(docsToRender[2])
  assertIncludes(qualityHtml, '待确认质量扣款记录', '质量扣款确认单必须展示待确认记录口径')
  assertIncludes(qualityHtml, '不是正式质量扣款流水', '质量扣款确认单不得混同正式流水')
  assert(/(?:IDR|CNY|RMB)\/件/.test(qualityHtml), '质量扣款确认单价格字段必须带币种和计价单位')

  const disputeHtml = renderPrintDocument(docsToRender[3])
  assertIncludes(disputeHtml, '质检记录不能直接当作质量异议单', '质量异议处理单必须说明质检记录不是异议单')
  assertIncludes(disputeHtml, '不在打印时触发生成流水或结算', '质量异议处理单不得触发结算')

  const masterHtml = renderPrintDocument(docsToRender[4])
  assertIncludes(masterHtml, '变更前后对比区', '资料变更申请单缺少变更前后对比')
  assertIncludes(masterHtml, '附件区', '资料变更申请单缺少附件区')

  const directRecord = createPrintRecord({
    documentType: 'MASTER_DATA_CHANGE_REQUEST',
    sourceType: 'MASTER_DATA_CHANGE_REQUEST_RECORD',
    sourceId: 'MDCR-202604-001',
    businessNo: 'MDCR-202604-001',
    templateCode: 'MASTER_DATA_CHANGE_REQUEST',
    templateName: '资料变更申请单',
    paperType: 'A4',
    printStatus: '待打印',
  })
  assert(listPrintRecords({ documentType: 'MASTER_DATA_CHANGE_REQUEST' }).some((record) => record.printRecordId === directRecord.printRecordId), 'listPrintRecords 未返回新建记录')

  assertIncludes(docs, '统一打印治理', '文档缺少统一打印治理流程图')
  assertIncludes(docs, '统一打印记录模型', '文档缺少统一打印记录模型')
  assertIncludes(docs, '散点打印治理规则', '文档缺少散点打印治理规则')
  assertIncludes(docs, '质量扣款冻结口径', '文档缺少质量扣款冻结口径')

  assertIncludes(preview, 'window.print()', '统一打印预览页必须保留统一打印按钮')
  assertNotIncludes(settlementEvents + settlementRequestPage, "window.open('', '_blank')", '本轮范围内不得 window.open 拼 HTML')
  assertNotIncludes(settlementEvents + settlementRequestPage, 'document.write', '本轮范围内不得 document.write 打印')

  ;[
    'scripts/check-print-service-post-route-card.ts',
    'scripts/check-task-route-cards-unified-print.ts',
    'scripts/check-task-delivery-card-unified-print.ts',
    'scripts/check-material-pickup-issue-supplement-print.ts',
    'scripts/check-label-print-unification.ts',
    'scripts/check-production-confirmation-print-unification.ts',
  ].forEach((path) => assert(existsSync(join(root, path)), `前置检查脚本缺失：${path}`))

  console.log('print governance final checks passed')
}

main()
