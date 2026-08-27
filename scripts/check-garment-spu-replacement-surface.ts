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
const core = read('src/data/fcs/garment-spu-replacement.ts')
const post = read('src/data/fcs/post-finishing-domain.ts')
const returnWorkflow = read('src/data/fcs/return-inbound-workflow.ts')
const fulfillment = read('src/data/fcs/production-return-fulfillment.ts')
const printRegistry = read('src/data/fcs/print-template-registry.ts')
const printTemplate = read('src/pages/print/templates/garment-sku-label-template.ts')

includesAll(shell, '菜单', [
  "title: '成衣 SPU 替换'",
  "title: '成衣仓换码任务'",
  "href: '/fcs/craft/post-finishing/garment-spu-replacements'",
  "href: '/wls/garment-spu-replacements'",
  "href: '/wls/garment-relabel-tasks'",
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
  '目标 SPU（商品中心）',
  '唯一目标 SKU',
  'A 已售历史',
  'B 成衣仓',
  'C 后道厂',
  'D 待回货',
  '现场截图（非必填）',
  '已上传图片可点击查看原图',
  'evidenceImageUrl',
  'FileReader',
  '打印新条码',
  '打印新吊牌',
  '瑕疵迁移与追溯',
  '确认后道 C 类已全部换码',
  '图片加载失败',
  'open-image',
])
assert.ok(!replacementPage.includes('现场创建'))
assert.ok(!replacementPage.includes('新建目标 SKU'))

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
  "documentType: 'GARMENT_SKU_BARCODE'",
  "label: '打印吊牌'",
  "documentType: 'GARMENT_HANGTAG'",
  '原生产需求不变',
  '当前成衣构成',
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
  "title: 'HG 出货条码'",
  "title: '零售条码'",
  "{ label: '日期'",
  "{ label: '当前 SKU'",
  '商品资料以商品中心当前有效 SKU 为准',
])

const scopedSources = [core, replacementPage, relabelTaskPage, printTemplate].join('\n')
for (const excluded of ['异常对账数量', '销售退回数量', '通用异常平台', '多级替换', '替换审批', '替换回滚']) {
  assert.ok(!scopedSources.includes(excluded), `本次范围不应引入：${excluded}`)
}

console.log('成衣 SPU/SKU 替换反向表面审查通过：菜单、路由、事件、两类列表、双打印、A/B/C/D、瑕疵、回货、仓库双流水和非范围均已逐项反查。')
