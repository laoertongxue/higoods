import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function includesAll(source: string, labels: string, values: string[]): void {
  values.forEach((value) => assert.ok(source.includes(value), `${labels} 缺少：${value}`))
}

const shell = read('src/data/app-shell-config.ts')
const fcsRoutes = read('src/router/routes-fcs.ts')
const rootRoutes = read('src/router/routes.ts')
const handlers = read('src/main-handlers/fcs-handlers.ts')
const replacementPage = read('src/pages/garment-spu-replacements.ts')
const relabelTaskPage = read('src/pages/wls-garment-relabel-tasks.ts')
const productionList = read('src/pages/production/orders-domain.ts')
const productionEvents = read('src/pages/production/events.ts')
const core = read('src/data/fcs/garment-spu-replacement.ts')
const post = read('src/data/fcs/post-finishing-domain.ts')
const returnWorkflow = read('src/data/fcs/return-inbound-workflow.ts')
const fulfillment = read('src/data/fcs/production-return-fulfillment.ts')
const printRegistry = read('src/data/fcs/print-template-registry.ts')
const printTemplate = read('src/pages/print/templates/garment-sku-label-template.ts')
const printService = read('src/data/fcs/print-service.ts')
const printPreview = read('src/pages/print/print-preview.ts')
const shellIcons = read('src/icons/shell-icons.ts')

includesAll(shell, '菜单', [
  "title: '成衣 SPU 替换'",
  "title: '成衣仓换码任务'",
  "href: '/fcs/craft/post-finishing/garment-spu-replacements'",
  "href: '/wls/garment-spu-replacements'",
  "href: '/wls/garment-relabel-tasks'",
  "icon: 'RefreshCw'",
  "icon: 'Tags'",
])
includesAll(shellIcons, '菜单图标注册', [
  'RefreshCw,',
  'Tags,',
])
includesAll(fcsRoutes, 'FCS 路由', [
  "'/fcs/craft/post-finishing/garment-spu-replacements':",
  'renderPostFinishingGarmentSpuReplacementsPage',
])
includesAll(rootRoutes, 'WLS 路由', [
  "'/wls/garment-spu-replacements':",
  "'/wls/garment-relabel-tasks':",
  'renderWlsGarmentSpuReplacementsPage',
  'renderWlsGarmentRelabelTasksPage',
])
includesAll(handlers, '事件入口', [
  "pathname === '/fcs/craft/post-finishing/garment-spu-replacements'",
  'handleGarmentSpuReplacementEvent',
  "pathname === '/wls/garment-spu-replacements'",
  'handleWlsGarmentRelabelTasksEvent',
])

assert.ok(replacementPage.startsWith('// @page-pattern: list'))
assert.ok(relabelTaskPage.startsWith('// @page-pattern: list'))
includesAll(replacementPage, '替换页面', [
  'renderStandardListPage',
  '范围固定为“生产单＋源颜色”',
  '生产单（可搜索）',
  'data-searchable-select="production-order"',
  '源颜色（来自所选生产单）',
  '目标 SPU（商品中心，可搜索）',
  'data-searchable-select="target-spu"',
  '目标颜色（来自目标 SPU）',
  '匹配目标 SKU',
  '已完成销售出库（历史）',
  '成衣仓未售成衣',
  '后道工厂未入仓成衣',
  '生产单剩余待回货',
  '现场截图（非必填）',
  '已上传图片可点击查看原图',
  'evidenceImageUrl',
  'FileReader',
  '打印新条码',
  '打印新吊牌',
  '瑕疵迁移与追溯',
  '确认后道工厂在手成衣已全部换码',
  '后道工厂换码',
  '成衣仓换码',
  '剩余待回货',
  '目标 SKU 已生效',
  '怎么才算完成',
  '当前待办：等待成衣仓换码任务完成',
  '完成条件已满足：后道工厂与成衣仓实物换码均已完成',
  '图片加载失败',
  'open-image',
])
includesAll(core, 'Mock 场景', [
  'buildSeedSnapshot',
  '等待后道工厂和成衣仓开始换码',
  '成衣仓正在按原入库批次处理',
  '后道与成衣仓均已完成新条码、新吊牌和旧出新入',
  "task.status = 'PROCESSING'",
  "task.status = 'COMPLETED'",
])
assert.ok(!replacementPage.includes('现场创建'))
assert.ok(!replacementPage.includes('新建目标 SKU'))
for (const obsoleteLabel of ['A 已售历史', 'B 成衣仓', 'C 后道厂', 'D 待回货', 'A / B / C / D', 'A 类', 'B 类', 'C 类', 'D 类']) {
  assert.ok(!replacementPage.includes(obsoleteLabel), `替换页面不应再显示内部分类字母：${obsoleteLabel}`)
  assert.ok(!relabelTaskPage.includes(obsoleteLabel), `成衣仓任务页面不应再显示内部分类字母：${obsoleteLabel}`)
}

includesAll(relabelTaskPage, '成衣仓换码任务页面', [
  'renderStandardListPage',
  '来源：成衣 SPU 替换',
  '旧 SKU 出库 → 重新贴码 → 新 SKU 入库',
  '来源入库批次',
  '打印新条码',
  '打印新吊牌',
  '旧 SKU 销售出库',
  '确认全部完成旧出新入',
  '图片失败',
  'open-image',
])
includesAll(productionList, '生产单列表', [
  "label: '打印条码'",
  "action: 'open-order-print-dialog'",
  '批量打印货品条码',
  'SKU编码',
  '出货条码',
  '采购价格',
  '采购数量',
  '已到货数',
  '打印数量',
  'print-order-sku-barcode',
  'print-order-sku-hangtag',
  'print-order-selected-barcode',
  'print-order-selected-hangtag',
  '原生产需求不变',
  '当前成衣构成',
])
assert.equal((productionList.match(/label: '打印吊牌'/g) || []).length, 0, '生产单列表不得出现独立“打印吊牌”入口')
assert.equal((productionList.match(/label: '打印条码'/g) || []).length, 1, '生产单列表必须只有一个“打印条码”入口')
includesAll(productionEvents, '生产单打印事件', [
  "action === 'open-order-print-dialog'",
  "documentType: PrintDocumentType = action.endsWith('hangtag') ? 'GARMENT_HANGTAG' : 'GARMENT_SKU_BARCODE'",
  'skuData,',
  '大于 0 的整数',
])

includesAll(core, '核心事实', [
  "scopeKey = `${preview.productionOrderId}::${normalize(preview.sourceColor)}`",
  'replacementRequired: replacementQty > 0',
  'finishedWarehouseQty + line.postFactoryQty + line.remainingReturnQty',
  'sourceInboundBatchId',
  "movementType: 'OLD_SKU_OUTBOUND'",
  "movementType: 'NEW_SKU_INBOUND'",
  'getGarmentSalesOutboundGuard',
  'appendGarmentIdentityMigrationAudits',
  "stage: GarmentReplacementIdentityStage",
])
const coreThrowLines = core.split('\n').filter((line) => line.includes('throw new Error'))
assert.ok(coreThrowLines.every((line) => !/图片|吊牌|洗涤|执行标准|安全类别/.test(line)), '目标校验不得增加图片、吊牌或商品资料门禁')

includesAll(post, '后道链路', [
  "stage: 'DEFECT'",
  "stage: 'POST_FACTORY'",
  'listPostFinishingIdentityMigrationCandidates',
  'isPostFactoryRelabelPending',
  'availableHandoverGarmentQty: relabelPending',
])
includesAll(returnWorkflow, '回货批次', [
  "stage: 'FUTURE_RETURN'",
  'originalSkuCode',
  'effectiveSpuCode',
  'skuLines',
])
includesAll(fulfillment, '原分配匹配', [
  'resolveOriginalSkuForReturnedSku',
  'listEffectiveTaskAssignments',
  'productionOrderId === input.productionOrderId',
])
includesAll(printRegistry, '打印注册', [
  "documentType: 'GARMENT_SKU_BARCODE'",
  "documentType: 'GARMENT_HANGTAG'",
  "supportedSourceTypes: ['PRODUCTION_ORDER', 'GARMENT_WAREHOUSE_RELABEL_TASK']",
])
includesAll(printTemplate, '打印模板', [
  'renderCode128Barcode',
  'data-online-print-layout="sku-barcode"',
  'data-online-print-layout="garment-hangtag"',
  "@page { size: ${paperSize}",
  "{ label: '日期'",
  "{ label: 'SKU'",
  "{ label: 'Kategori'",
  "{ label: 'Metode pencucian'",
  "{ label: 'Standar implementasi'",
  "{ label: 'Kategori keamanan'",
])
includesAll(printService, '打印选择参数', [
  'skuData?: Array<{',
  "params.set('skuData', JSON.stringify(input.skuData))",
])
includesAll(printPreview, '打印选择参数解析', [
  'function parseSkuData',
  "parseSkuData(params.get('skuData'))",
  'skuData: resolved.skuData',
])
for (const forbiddenPrintText of ['来源 SKU', '当前标签已按整色替换', '成衣新条码']) {
  assert.ok(!printTemplate.includes(forbiddenPrintText), `线上打印样式不得额外显示：${forbiddenPrintText}`)
}

const scopedSources = [core, replacementPage, relabelTaskPage, printTemplate].join('\n')
for (const excluded of ['异常对账数量', '销售退回数量', '通用异常平台', '多级替换', '替换审批', '替换回滚']) {
  assert.ok(!scopedSources.includes(excluded), `本次范围不应引入：${excluded}`)
}

console.log('成衣 SPU/SKU 替换反向表面审查通过：菜单图标、搜索联动、三态 Mock、三段完成进度、生产单单入口双打印、瑕疵、回货、仓库双流水和非范围均已逐项反查。')
