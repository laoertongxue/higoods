import assert from 'node:assert/strict'
import {
  renderPcsWorkItemDetailPage,
  renderPcsWorkItemLibraryPage,
} from '../src/pages/pcs-work-items.ts'

const listHtml = renderPcsWorkItemLibraryPage()

assert.match(listHtml, /工作项库/, '列表页应渲染标题')
assert.match(listHtml, /商品项目立项/, '列表页应包含标准工作项')
assert.match(listHtml, /\/pcs\/work-items\/WI-001/, '列表页应包含详情跳转')

const detailHtml = renderPcsWorkItemDetailPage('WI-001')

assert.match(detailHtml, /基础信息/, '详情页应渲染基础信息章节')
assert.match(detailHtml, /字段定义/, '详情页应渲染字段定义章节')
assert.match(detailHtml, /操作定义/, '详情页应渲染操作定义章节')
assert.match(detailHtml, /运行时承载方式/, '详情页应渲染运行时承载方式章节')

console.log('pcs-work-item-library.spec.ts PASS')
