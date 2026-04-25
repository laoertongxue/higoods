import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildPrintDocument, renderPrintDocument } from '../src/data/fcs/print-template-registry.ts'

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

function build(documentType: 'PRODUCTION_CONFIRMATION' | 'MAKE_GOODS_CONFIRMATION') {
  return buildPrintDocument({
    documentType,
    sourceType: 'PRODUCTION_ORDER',
    sourceId: 'PO-202603-0004',
  })
}

function main(): void {
  const printService = read('src/data/fcs/print-service.ts')
  const registry = read('src/data/fcs/print-template-registry.ts')
  const preview = read('src/pages/print/print-preview.ts')
  const template = read('src/pages/print/templates/production-material-confirmation-template.ts')
  const styles = read('src/pages/print/print-styles.ts')
  const oldRoutePage = read('src/pages/production/confirmation-print.ts')
  const routeLinks = read('src/data/fcs/fcs-route-links.ts')
  const routes = read('src/router/routes-fcs.ts')
  const ordersPage = read('src/pages/production/orders-domain.ts')
  const detailPage = read('src/pages/production/detail-domain.ts')
  const docs = read('docs/fcs-print-service-plan.md')

  ;[
    'TASK_ROUTE_CARD',
    'TASK_DELIVERY_CARD',
    'MATERIAL_PREP_SLIP',
    'PICKUP_SLIP',
    'ISSUE_SLIP',
    'SUPPLEMENT_MATERIAL_SLIP',
    'FEI_TICKET_LABEL',
    'TRANSFER_BAG_LABEL',
    'CUTTING_ORDER_QR_LABEL',
    'HANDOVER_QR_LABEL',
  ].forEach((token) => assertIncludes(printService + registry, token, `前五步打印能力缺少 ${token}`))

  assertIncludes(printService + registry + preview, 'PRODUCTION_CONFIRMATION', '缺少 PRODUCTION_CONFIRMATION 文档类型')
  assertIncludes(printService + registry + preview, 'MAKE_GOODS_CONFIRMATION', '缺少 MAKE_GOODS_CONFIRMATION 文档类型')
  assertIncludes(printService, 'PRODUCTION_ORDER', '缺少 PRODUCTION_ORDER 来源类型')

  ;[
    'ProductionMaterialConfirmationTemplate',
    'ProductionConfirmationTemplate',
    'MakeGoodsConfirmationTemplate',
    'buildProductionConfirmationPrintDocument',
    'buildMakeGoodsConfirmationPrintDocument',
    'resolvePrintProductImage',
    'resolveProductionPrintImages',
    'resolveMaterialPrintImages',
  ].forEach((token) => assertIncludes(template, token, `生产资料确认模板缺少 ${token}`))

  assertIncludes(routes + oldRoutePage, 'confirmation-print', '旧生产确认单入口被删除')
  assertIncludes(oldRoutePage, 'renderUnifiedPrintPreviewPage', '旧生产确认单入口未接入统一打印预览壳')
  assertIncludes(routeLinks, 'buildProductionConfirmationPrintLink', '缺少生产确认单打印链接')
  assertIncludes(routeLinks, 'buildMakeGoodsConfirmationPrintLink', '缺少做货确认单打印链接')
  assertIncludes(ordersPage + detailPage, '打印做货确认单', '缺少打印做货确认单入口')

  ;[
    '商品主图',
    '款式图',
    '样衣图',
    '面料图',
    '辅料图',
    '纸样图',
    '唛架图',
    '花型图',
  ].forEach((token) => assertIncludes(template, token, `生产资料图片能力缺少 ${token}`))

  ;[
    'SKU / 颜色 / 尺码数量矩阵',
    '计划生产成衣件数',
    '面辅料信息区',
    '单件面料用量',
    '计划面料米数',
    '计划辅料数量',
    '损耗面料米数',
    '损耗辅料数量',
    '工序工艺区',
    '质检标准区',
    '确认与签字区',
    '工厂确认区',
  ].forEach((token) => assertIncludes(template, token, `生产确认单核心字段缺少 ${token}`))

  ;[
    '做货数量区',
    '面料区',
    '辅料区',
    '工艺要求区',
    '纸样 / 尺寸 / 唛架说明区',
    '工厂现场做货',
  ].forEach((token) => assertIncludes(template, token, `做货确认单现场字段缺少 ${token}`))

  assertIncludes(template + docs, '菲票归属原始裁片单', '裁片口径必须说明菲票回落原始裁片单')
  assertNotIncludes(template + docs, '菲票归属合并裁剪批次', '不得把合并裁剪批次作为菲票归属主体')
  assertIncludes(template, '不直接生成质量扣款流水', '质检标准区不得直接生成质量扣款流水')
  assertIncludes(template + styles + docs, 'A4', '缺少 A4 打印能力')
  assertIncludes(styles + template + docs, 'page-break', '缺少 A4 多页 page-break 能力')
  assertIncludes(styles + template + docs, 'break-inside', '缺少 A4 多页 break-inside 能力')
  assertIncludes(template + docs, '第 1 页 / 共 N 页', '缺少页码提示')
  assertNotIncludes(template + oldRoutePage, '系统占位图', '生产确认单 / 做货确认单不得显示大块系统占位图')
  ;['商品中心系统', '采购管理系统', '工厂生产协同', '工作台'].forEach((token) => {
    assertNotIncludes(template + oldRoutePage, token, `生产资料打印模板不得渲染 Web 壳：${token}`)
  })
  assertNotIncludes(template + oldRoutePage, '数量：', '生产资料打印模板不得只显示数量')
  assertNotIncludes(template, '用量：', '面辅料字段不得只写用量')

  const productionDoc = build('PRODUCTION_CONFIRMATION')
  const makeGoodsDoc = build('MAKE_GOODS_CONFIRMATION')
  const productionHtml = renderPrintDocument(productionDoc)
  const makeGoodsHtml = renderPrintDocument(makeGoodsDoc)

  assert(productionDoc.documentTitle === '生产确认单', '生产确认单标题错误')
  assert(makeGoodsDoc.documentTitle === '做货确认单', '做货确认单标题错误')
  assert(productionDoc.sourceType === 'PRODUCTION_ORDER', '生产确认单来源类型错误')
  assert(makeGoodsDoc.sourceType === 'PRODUCTION_ORDER', '做货确认单来源类型错误')
  assert(productionHtml.includes('生产确认单号'), '生产确认单缺少生产确认单号')
  assert(productionHtml.includes('来源需求单号'), '生产确认单缺少来源需求单号')
  assert(productionHtml.includes('计划生产成衣件数'), '生产确认单数量字段未对象化')
  assert(productionHtml.includes('SKU / 颜色 / 尺码数量矩阵'), '生产确认单缺少 SKU 数量矩阵')
  assert(productionHtml.includes('面辅料信息区'), '生产确认单缺少面辅料信息')
  assert(productionHtml.includes('工序工艺区'), '生产确认单缺少工序工艺')
  assert(productionHtml.includes('质检标准区'), '生产确认单缺少质检标准')
  assert(productionHtml.includes('确认与签字区'), '生产确认单缺少签字确认区')
  assert(makeGoodsHtml.includes('做货数量区'), '做货确认单缺少做货数量区')
  assert(makeGoodsHtml.includes('面料区'), '做货确认单缺少面料区')
  assert(makeGoodsHtml.includes('辅料区'), '做货确认单缺少辅料区')
  assert(makeGoodsHtml.includes('工艺要求区'), '做货确认单缺少工艺要求区')
  assert(makeGoodsHtml.includes('工厂确认区'), '做货确认单缺少工厂确认区')
  assert(makeGoodsHtml !== productionHtml, '做货确认单不能只是生产确认单改标题')
  ;[productionHtml, makeGoodsHtml].forEach((html) => {
    assertNotIncludes(html, '系统占位图', '不得显示大块系统占位图')
    assertNotIncludes(html, '商品中心系统', '不得显示系统顶部导航')
    assertNotIncludes(html, '业务 Tab', '不得显示业务 Tab')
    assertNotIncludes(html, '数量：', '数量字段不得只写数量')
    assertIncludes(html, '扫码查看生产资料', '缺少生产资料二维码说明')
  })

  ;[
    'scripts/check-print-service-post-route-card.ts',
    'scripts/check-task-route-cards-unified-print.ts',
    'scripts/check-task-delivery-card-unified-print.ts',
    'scripts/check-material-pickup-issue-supplement-print.ts',
    'scripts/check-label-print-unification.ts',
  ].forEach((path) => assert(existsSync(join(root, path)), `前置检查脚本缺失：${path}`))

  console.log('production confirmation print unification checks passed')
}

main()
