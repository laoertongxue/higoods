import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const samplePage = readFileSync('src/pages/sewing-outsourcing/sample-approval-suggestions.ts', 'utf8')
const materialPage = readFileSync('src/pages/sewing-outsourcing/material-handover.ts', 'utf8')
const routes = readFileSync('src/router/routes-fcs.ts', 'utf8')
const renderers = readFileSync('src/router/route-renderers-fcs.ts', 'utf8')
const handlers = readFileSync('src/main-handlers/fcs-handlers.ts', 'utf8')

for (const text of [
  '批版建议',
  '三方车缝工厂制作的实物叫产前版样衣',
  'PPIC视角',
  '批版人员视角',
  '上传样衣照片',
  '确认接收',
  '转交批版人员',
  '填写批版建议',
  '记录已截图反馈',
  '有问题',
  '批版面料',
  '工艺意见',
  '用料意见',
  '其他意见',
  '线下批版单照片',
  '批版人员',
  '批版日期',
  '本次批版核对依据',
]) {
  assert.ok(samplePage.includes(text), `批版建议页面缺少业务口径：${text}`)
}
assert.ok(samplePage.includes('data-sample-approval-screenshot-card'), '必须提供单卡片截图区域')
assert.ok(samplePage.includes('data-sample-approval-field="receivedSamplePhotos"'), 'PPIC接收时必须提供产前版样衣实物照片上传控件')
assert.ok(samplePage.includes('data-sample-approval-action="select-received-photos"'), '选择样衣照片后必须立即形成多图预览')
assert.ok(samplePage.includes("removeAction: 'remove-received-photo'"), '样衣照片提交前必须支持逐张删除')
assert.ok(samplePage.includes('type="file" accept="image/*" multiple'), '样衣照片必须支持一次选择多张图片')
assert.ok(samplePage.includes('ppicReceivedSamplePhotoUrls'), '列表和截图卡必须优先展示PPIC收到实物后上传的照片')
assert.ok(samplePage.includes('data-sample-approval-action="preview-image"'), '产前版样衣和引用图片必须支持高清大图')
assert.ok(samplePage.includes('isSampleApprovalSuggestionDialogOpen'), '批版建议弹窗必须接入Escape关闭')
assert.ok(samplePage.includes("form.conclusion === 'HAS_PROBLEM' ? ' selected'"), '校验失败后必须保留有问题结论')
assert.ok(samplePage.includes('fabricApprovalComment: read(\'fabricApprovalComment\')'), '校验失败或选择附件后必须保留结构化批版意见')
assert.ok(samplePage.includes('data-sample-approval-field="approvalSheetPhotos"'), '必须支持上传线下批版建议单照片作为佐证')
assert.ok(samplePage.includes("removeAction: 'remove-approval-sheet-photo'"), '线下批版单照片提交前必须支持逐张删除')
assert.ok(samplePage.includes('suggestion.structuredComments'), '批版建议卡必须按四类结构化意见展示')
assert.ok(samplePage.includes('photos.map'), '批版建议卡不能只展示第一张产前版样衣照片')

for (const text of [
  '面辅料交出',
  '仅适用于裁剪+车缝+烫包任务',
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
