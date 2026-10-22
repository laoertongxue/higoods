import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const samplePage = readFileSync('src/pages/sewing-outsourcing/sample-approval-suggestions.ts', 'utf8')
const materialPage = readFileSync('src/pages/sewing-outsourcing/material-handover.ts', 'utf8')
const routes = readFileSync('src/router/routes-fcs.ts', 'utf8')
const renderers = readFileSync('src/router/route-renderers-fcs.ts', 'utf8')
const handlers = readFileSync('src/main-handlers/fcs-handlers.ts', 'utf8')

for(const text of ['批版建议','PPIC接收产前版样衣','确认接收','转交批版人员','领取批版','填写批版建议','反馈工厂','有问题','面料意见','工艺意见','用料意见','其他意见','本次检查要求','具体检查项','连续计48小时','核对并转换旧记录']) assert.ok(samplePage.includes(text),`缺少批版业务表达：${text}`)
for(const text of ['requiresAnotherApproval','第${record.sample.roundNo}轮','待工厂制作','root.outerHTML']) assert.ok(!samplePage.includes(text),`不得保留活动逻辑：${text}`)
for(const text of ['statusTabsHtml:','filtersHtml:','data-sample-approval-screenshot-card','select-received-photos','multiple','ppicReceivedSamplePhotoUrls','preview-image','isSampleApprovalSuggestionDialogOpen','readForm','approvalSheetPhotoUrls','data-sample-issue-id','data-sample-issue-note','data-sample-overlays']) assert.ok(samplePage.includes(text),`页面能力缺失：${text}`)

for (const text of [
  '面辅料交出',
  '按当前任务读取仓库实交事实',
  '仓库交出事实',
  'PPIC页面不提供新增、修改或确认数量按钮',
]) {
  assert.ok(materialPage.includes(text), `面辅料页面缺少业务口径：${text}`)
}
assert.ok(materialPage.includes('data-sewing-material-action="preview-image"'), '每种面辅料必须支持真实图片大图')
assert.ok(materialPage.includes('真实物料图缺失'), '真实物料图片缺失时必须明确阻塞，不能静默占位')

for (const path of [
  '/fcs/sewing-outsourcing/sample-approval-suggestions',
  '/fcs/sewing-outsourcing/material-handover',
]) {
  assert.ok(routes.includes(`'${path}'`), `缺少命名路由：${path}`)
  assert.ok(handlers.includes(`pathname.startsWith('${path}')`), `缺少页面事件处理：${path}`)
}
assert.ok(renderers.includes("import('../pages/sewing-outsourcing/sample-approval-suggestions')"))
assert.ok(renderers.includes("import('../pages/sewing-outsourcing/material-handover')"))
assert.ok(handlers.includes('closeSampleApprovalSuggestionDialog()'))
assert.ok(handlers.includes('closeSewingMaterialHandoverDialog()'))

console.log('车缝外发批版建议截图卡、角色动作与面辅料只读页面契约检查通过')
