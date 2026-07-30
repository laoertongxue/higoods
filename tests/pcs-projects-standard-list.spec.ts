import assert from 'node:assert/strict'
import fs from 'node:fs'

import { renderPcsProjectListPage } from '../src/pages/pcs-projects.ts'

const source = fs.readFileSync('src/pages/pcs-projects.ts', 'utf8')

assert.match(source, /^\/\/ @page-pattern: list\s*$/m, '商品项目页必须声明标准列表页模式')
for (const contract of ['renderStandardListPage', 'renderStandardListTable', 'renderTablePagination']) {
  assert.ok(source.includes(contract), `商品项目列表必须使用 ${contract}`)
}
assert.match(source, /higood:list-page:\/pcs\/projects/, '商品项目列偏好必须按列表路由持久化')
assert.match(source, /loadListColumnPreferences/, '商品项目列表进入时必须读取列偏好')
assert.match(source, /saveListColumnPreferences/, '商品项目列偏好变化后必须保存')
assert.match(source, /resetStandardListEntryTransientStateOnRouteEntry/, '商品项目当前页和列排序必须在重新进入时复位')

const html = await renderPcsProjectListPage()
assert.match(html, /data-standard-list-page/, '商品项目必须使用标准列表页骨架')
assert.match(html, /data-standard-list-scroll/, '商品项目宽表必须只在表格容器内横向滚动')
assert.match(html, /data-standard-list-sort-icon="none"/, '商品项目可排序列必须显示未排序图标')
assert.match(html, /sticky right-0/, '商品项目操作列必须固定在右侧')
assert.match(html, /列设置/, '商品项目列表必须提供列设置')
assert.match(html, /条\/页/, '商品项目列表必须明确每页条数')
assert.match(html, /data-skip-page-rerender="true"/, '商品项目轻交互必须跳过整页重绘')

console.log('pcs-projects-standard-list.spec.ts PASS')
