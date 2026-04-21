import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotIncludes(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

const packageSource = read('package.json')
const contextSource = read('src/pages/tech-pack/context.ts')
const eventsSource = read('src/pages/tech-pack/events.ts')
const patternDomainSource = read('src/pages/tech-pack/pattern-domain.ts')
const coreSource = read('src/pages/tech-pack/core.ts')
const shellSource = read('src/components/shell.ts')
const mainSource = read('src/main.ts')
const processCraftSource = read('src/data/fcs/process-craft-dict.ts')
const snapshotSource =
  read('src/data/fcs/production-tech-pack-snapshot-builder.ts') +
  read('src/data/fcs/production-confirmation.ts') +
  read('src/pages/production/confirmation-print.ts')

const fieldHandlingSection =
  eventsSource.split('if (field) {')[1]?.split('const action = actionNode?.dataset.techAction')[0] ?? ''

assertIncludes(
  packageSource,
  'check:fcs-tech-pack-special-craft-source-and-dialog-stability',
  'package.json 缺少特殊工艺来源与弹窗稳定性检查命令',
)

assertIncludes(
  contextSource,
  'function getPatternPieceSpecialCraftOptionsFromCurrentTechPack()',
  '缺少裁片部位特殊工艺来源 helper',
)
assertIncludes(contextSource, 'state.techniques', '裁片部位特殊工艺来源必须绑定当前技术包工序工艺')
assertIncludes(contextSource, "item.entryType === 'CRAFT'", '裁片部位特殊工艺来源必须限制为工艺项')
assertIncludes(contextSource, "item.processCode === 'SPECIAL_CRAFT'", '裁片部位特殊工艺来源必须限制为特殊工艺口径')
assertIncludes(contextSource, 'listSelectableSpecialCraftDefinitions()', '裁片部位特殊工艺来源必须继续受字典启用状态过滤')
assertNotIncludes(contextSource, '印花工艺', '技术包特殊工艺来源不得暴露印花工艺')
assertNotIncludes(contextSource, '染色工艺', '技术包特殊工艺来源不得暴露染色工艺')

assertIncludes(processCraftSource, 'DISALLOWED_PSEUDO_SPECIAL_CRAFT_NAMES', '工序工艺字典必须保留伪特殊工艺禁用名单')
assertIncludes(processCraftSource, 'buildProcessCraftOption(definition: ProcessCraftDefinition): ProcessCraftOption | null', '工序工艺字典缺少前端选项构造')
assertIncludes(processCraftSource, 'if (isDisallowedPseudoSpecialCraft(definition)) return null', '前端工序工艺选项必须显式排除伪特殊工艺')

assertIncludes(patternDomainSource, '（历史值）', '编辑旧数据时必须能识别历史特殊工艺值')
assertNotIncludes(patternDomainSource, 'type="submit"', '纸样弹窗按钮不得使用 submit')
assertNotIncludes(patternDomainSource, '<form', '纸样弹窗不得使用默认 form 提交')

assertIncludes(coreSource, 'data-tech-pack-page-root="true"', '技术包页面缺少局部渲染根节点')
assertIncludes(shellSource, 'data-page-content-root="true"', '应用壳缺少页面内容局部渲染容器')
assertIncludes(mainSource, 'renderPageContentOnlyWithFocusRestore', 'main.ts 缺少局部渲染并恢复焦点逻辑')
assertIncludes(mainSource, 'shouldUseTechPackScopedRender', 'main.ts 缺少 tech-pack 局部渲染判定')
assertIncludes(mainSource, 'isTechPackPageMounted()', 'main.ts 缺少 tech-pack 页面挂载判定')
assertIncludes(mainSource, 'data-tech-pack-page-root="true"', 'main.ts 必须基于 tech-pack 页面根节点做局部渲染')

assertNotIncludes(fieldHandlingSection, 'appStore.navigate', 'tech-pack 字段变更不得触发路由跳转')
assertNotIncludes(fieldHandlingSection, 'resetPatternForm()', 'tech-pack 字段变更不得重置纸样表单')
assertIncludes(eventsSource, "state.newPattern.parseError = validationError", '保存校验失败时必须保留弹窗并展示错误')
assertIncludes(eventsSource, "state.addPatternDialogOpen = false", '保存成功后必须关闭弹窗')
assertIncludes(eventsSource, 'resetPatternForm()', '保存成功后必须重置表单')

assertIncludes(snapshotSource, 'specialCrafts', '快照与确认单链路必须继续保留特殊工艺字段')
assertIncludes(snapshotSource, 'colorAllocations', '快照与确认单链路必须继续保留颜色分配字段')

;['axios', 'fetch(', 'apiClient', '/api/', 'i18n', 'useTranslation', 'locales', 'translations', '库存三态', '库位上架', 'WMS入库'].forEach((token) => {
  assertNotIncludes(contextSource, token, `技术包上下文不得引入越界能力：${token}`)
  assertNotIncludes(eventsSource, token, `技术包事件不得引入越界能力：${token}`)
  assertNotIncludes(patternDomainSource, token, `技术包页面不得引入越界能力：${token}`)
})

console.log('check-fcs-tech-pack-special-craft-source-and-dialog-stability.ts PASS')
