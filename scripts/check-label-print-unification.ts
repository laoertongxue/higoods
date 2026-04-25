import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { buildPrintDocument, renderPrintDocument } from '../src/data/fcs/print-template-registry.ts'
import { listProcessHandoverRecords } from '../src/data/fcs/process-warehouse-domain.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
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

function main(): void {
  const printService = read('src/data/fcs/print-service.ts')
  const registry = read('src/data/fcs/print-template-registry.ts')
  const preview = read('src/pages/print/print-preview.ts')
  const labelTemplate = read('src/pages/print/templates/label-print-template.ts')
  const printStyles = read('src/pages/print/print-styles.ts')
  const routeLinks = read('src/data/fcs/fcs-route-links.ts')
  const feiPage = read('src/pages/process-factory/cutting/fei-tickets.ts')
  const transferBagsPage = read('src/pages/process-factory/cutting/transfer-bags.ts')
  const originalOrdersPage = read('src/pages/process-factory/cutting/original-orders.ts')
  const materialPrepPage = read('src/pages/process-factory/cutting/material-prep.ts')
  const progressHandoverPage = read('src/pages/progress-handover.ts')
  const docs = read('docs/fcs-print-service-plan.md')

  ;[
    'TASK_ROUTE_CARD',
    'TASK_DELIVERY_CARD',
    'MATERIAL_PREP_SLIP',
    'PICKUP_SLIP',
    'ISSUE_SLIP',
    'SUPPLEMENT_MATERIAL_SLIP',
  ].forEach((token) => assertIncludes(printService + registry, token, `前置打印能力缺少 ${token}`))

  ;[
    'FEI_TICKET_LABEL',
    'FEI_TICKET_REPRINT_LABEL',
    'FEI_TICKET_VOID_LABEL',
    'TRANSFER_BAG_LABEL',
    'CUTTING_ORDER_QR_LABEL',
    'HANDOVER_QR_LABEL',
  ].forEach((token) => assertIncludes(printService + registry + preview, token, `缺少标签文档类型 ${token}`))

  ;[
    'FeiTicketLabelTemplate',
    'FeiTicketReprintLabelTemplate',
    'FeiTicketVoidLabelTemplate',
    'TransferBagLabelTemplate',
    'CuttingOrderQrLabelTemplate',
    'HandoverQrLabelTemplate',
  ].forEach((token) => assertIncludes(labelTemplate, token, `缺少标签模板 ${token}`))

  ;['LABEL_80_50', 'LABEL_100_60', 'LABEL_60_40', 'A4_LABEL_GRID'].forEach((token) => {
    assertIncludes(printService + printStyles + labelTemplate + docs, token, `缺少标签纸规格 ${token}`)
  })

  ;[
    'buildPrintQrPayload',
    'buildPrintBarcodePayload',
    'targetRoute',
    'printVersionNo',
    'isReprint',
    'isVoid',
  ].forEach((token) => assertIncludes(printService + labelTemplate, token, `二维码 payload 缺少 ${token}`))

  assertIncludes(routeLinks, 'buildFeiTicketLabelPrintLink', '缺少菲票标签打印链接')
  assertIncludes(routeLinks, 'buildTransferBagLabelPrintLink', '缺少载具标签打印链接')
  assertIncludes(routeLinks, 'buildCuttingOrderQrLabelPrintLink', '缺少裁片单二维码打印链接')
  assertIncludes(routeLinks, 'buildHandoverQrLabelPrintLink', '缺少交出二维码打印链接')

  assertIncludes(feiPage, 'buildFeiTicketLabelPrintLink', '菲票打印入口未进入统一打印预览')
  assertIncludes(feiPage, '打印作废标识', '菲票作废标识入口缺失')
  assertIncludes(transferBagsPage, 'buildTransferBagLabelPrintLink', '中转袋二维码入口未进入统一打印预览')
  assertIncludes(originalOrdersPage + materialPrepPage, 'buildCuttingOrderQrLabelPrintLink', '裁片单二维码入口缺失')
  assertIncludes(progressHandoverPage, 'buildHandoverQrLabelPrintLink', '交出二维码入口缺失')

  assertNotIncludes(labelTemplate, '系统占位图', '标签模板不得显示大块系统占位图')
  ;['商品中心系统', '采购管理系统', '工厂生产协同', '工作台', 'Tab'].forEach((token) =>
    assertNotIncludes(labelTemplate, token, `标签模板不得渲染 Web 壳：${token}`),
  )
  assertNotIncludes(labelTemplate + docs, '菲票归属合并裁剪批次', '不得把合并裁剪批次作为菲票归属主体')
  assertIncludes(labelTemplate + docs, '菲票归属原始裁片单', '菲票标签必须显示原始裁片单归属')
  assertIncludes(labelTemplate, '补打不改变菲票归属', '菲票补打必须不改变归属')
  assertIncludes(labelTemplate, '不可流转', '菲票作废标识必须不可作为有效流转凭证')
  assertIncludes(labelTemplate, '绑定菲票数量', '载具二维码必须关联菲票绑定关系')
  assertIncludes(labelTemplate, '交出二维码必须关联统一交出记录', '交出二维码必须关联统一交出记录')

  const handover = listProcessHandoverRecords()[0]
  const samples = [
    build('FEI_TICKET_LABEL', 'FEI_TICKET_RECORD', 'CUT-260226-014-01::001'),
    build('FEI_TICKET_REPRINT_LABEL', 'FEI_TICKET_RECORD', 'CUT-260226-014-01::001'),
    build('FEI_TICKET_VOID_LABEL', 'FEI_TICKET_RECORD', 'CUT-260226-014-01::001'),
    build('TRANSFER_BAG_LABEL', 'TRANSFER_BAG_RECORD', 'carrier-bag-005'),
    build('CUTTING_ORDER_QR_LABEL', 'CUTTING_ORDER_RECORD', 'CUT-260226-014-01'),
    build('HANDOVER_QR_LABEL', 'HANDOVER_RECORD', handover.handoverRecordId),
  ]

  samples.forEach((doc) => {
    const html = renderPrintDocument(doc)
    assert(doc.qrPayload?.includes('targetRoute') || doc.qrCodes[0]?.value.includes('targetRoute'), `${doc.documentType} 二维码缺少目标路由`)
    assert(doc.labelItems?.length, `${doc.documentType} 未生成标签项`)
    assertNotIncludes(html, '系统占位图', `${doc.documentType} 不得显示系统占位图`)
    assertNotIncludes(html, '商品中心系统', `${doc.documentType} 不得显示顶部导航`)
    assertNotIncludes(html, '数量：', `${doc.documentType} 不得只显示数量`)
  })

  const a4Grid = build('FEI_TICKET_LABEL', 'FEI_TICKET_RECORD', 'cut-order:CUT-260226-014-01')
  assert(a4Grid.paperType === 'A4_LABEL_GRID', '批量菲票必须支持 A4 多标签排版')
  assert((a4Grid.labelItems?.length || 0) > 1, '批量菲票需要一页多个标签')

  ;[
    'scripts/check-print-service-post-route-card.ts',
    'scripts/check-task-route-cards-unified-print.ts',
    'scripts/check-task-delivery-card-unified-print.ts',
    'scripts/check-material-pickup-issue-supplement-print.ts',
  ].forEach((path) => assert(existsSync(join(root, path)), `前置检查脚本缺失：${path}`))

  console.log('label print unification checks passed')
}

main()
