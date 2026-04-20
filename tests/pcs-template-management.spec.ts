import assert from 'node:assert/strict'
import {
  renderPcsTemplateDetailPage,
  renderPcsTemplateEditorPage,
  renderPcsTemplateListPage,
} from '../src/pages/pcs-templates.ts'

const listHtml = renderPcsTemplateListPage()

assert.match(listHtml, /商品项目模板/, '列表页应渲染模板管理标题')
assert.match(listHtml, /TPL-001/, '列表页应包含内置模板编号')
assert.match(listHtml, /\/pcs\/templates\/TPL-001/, '列表页应包含详情跳转')

const detailHtml = renderPcsTemplateDetailPage('TPL-001')

assert.match(detailHtml, /阶段与工作项配置/, '详情页应渲染阶段配置章节')
assert.match(detailHtml, /基础款 - 完整测款转档模板/, '详情页应渲染模板名称')

const editorHtml = renderPcsTemplateEditorPage()

assert.match(editorHtml, /商品项目模板为内置固定模板/, '只读页应说明模板为内置固定模板')
assert.match(editorHtml, /返回模板列表/, '只读页应保留返回入口')
assert.doesNotMatch(editorHtml, /只读说明/, '只读页不应再展示说明型标题')

console.log('pcs-template-management.spec.ts PASS')
