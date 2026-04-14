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
assert.match(detailHtml, /模板说明/, '详情页应渲染模板说明区域')
assert.match(detailHtml, /基础款 - 完整测款转档模板/, '详情页应渲染模板名称')

const editorHtml = renderPcsTemplateEditorPage()

assert.match(editorHtml, /新增模板/, '新建页应渲染新增标题')
assert.match(editorHtml, /模板基本信息/, '新建页应渲染基础信息卡片')
assert.match(editorHtml, /阶段 & 工作项配置/, '新建页应渲染阶段配置区')

console.log('pcs-template-management.spec.ts PASS')
