import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  handlePcsProjectListEvent,
  renderPcsProjectListPage,
} from '../src/pages/pcs-projects-list.ts'

const source = fs.readFileSync('src/pages/pcs-projects-list.ts', 'utf8')
const routeSource = fs.readFileSync('src/router/route-renderers.ts', 'utf8')
const handlerSource = fs.readFileSync('src/main-handlers/pcs-handlers.ts', 'utf8')
const detailSource = fs.readFileSync('src/pages/pcs-projects.ts', 'utf8')

assert.match(source, /^\/\/ @page-pattern: list\s*$/m, '商品项目页必须声明标准列表页模式')
for (const contract of ['renderStandardListPage', 'renderStandardListTable', 'renderTablePagination']) {
  assert.ok(source.includes(contract), `商品项目列表必须使用 ${contract}`)
}
assert.match(
  routeSource,
  /import\('\.\.\/pages\/pcs-projects-list'\)[\s\S]*'renderPcsProjectListPage'/,
  '真实 /pcs/projects 路由必须由标准列表模块渲染',
)
assert.match(
  handlerSource,
  /pathname === '\/pcs\/projects'[\s\S]*import\('\.\.\/pages\/pcs-projects-list'\)[\s\S]*handlePcsProjectListEvent/,
  '真实 /pcs/projects 事件必须由标准列表模块处理',
)
assert.doesNotMatch(detailSource, /export async function renderPcsProjectListPage/, '详情巨型模块不得保留商品项目列表死导出')
for (const deadFunction of [
  'renderPagination',
  'renderLegacyProjectListTable',
  'renderProjectGrid',
  'renderProjectListHeader',
]) {
  assert.doesNotMatch(detailSource, new RegExp(`function ${deadFunction}\\b`), `详情模块必须删除列表死函数：${deadFunction}`)
}
assert.match(source, /higood:list-page:\/pcs\/projects/, '商品项目列偏好必须按列表路由持久化')
assert.match(source, /loadListColumnPreferences/, '商品项目列表进入时必须读取列偏好')
assert.match(source, /saveListColumnPreferences/, '商品项目列偏好变化后必须保存')
assert.match(source, /resetStandardListEntryTransientStateOnRouteEntry/, '商品项目当前页和列排序必须在重新进入时复位')
assert.match(source, /refreshProjectListRegions/, '商品项目轻交互必须局部刷新列表区域')
assert.match(source, /dragstart[\s\S]*dragover[\s\S]*drop[\s\S]*dragend/, '商品项目列设置必须处理真实拖动事件')
assert.match(source, /toggle-column-visibility/, '商品项目列设置必须支持显示或隐藏')
assert.match(source, /toggle-column-freeze/, '商品项目列设置必须支持冻结或取消冻结')

let html = await renderPcsProjectListPage()
assert.match(html, /data-standard-list-page/, '商品项目必须使用标准列表页骨架')
assert.match(html, /data-standard-list-scroll/, '商品项目宽表必须只在表格容器内横向滚动')
assert.match(html, /data-standard-list-sort-icon="none"/, '商品项目可排序列必须显示未排序图标')
assert.match(html, /sticky right-0/, '商品项目操作列必须固定在右侧')
assert.match(html, /列设置/, '商品项目列表必须提供列设置')
assert.match(html, /条\/页/, '商品项目列表必须明确每页条数')
assert.match(html, /data-skip-page-rerender="true"/, '商品项目轻交互必须跳过整页重绘')

Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    querySelector: (selector: string) => selector === '[data-pcs-project-list-page]' ? {} : null,
  },
})

function actionTarget(action: string, dataset: Record<string, string> = {}): HTMLElement {
  const actionNode = {
    dataset: {
      pcsProjectListAction: action,
      ...dataset,
    },
  }
  return {
    closest: (selector: string) => selector === '[data-pcs-project-list-action]' ? actionNode : null,
  } as unknown as HTMLElement
}

function dragTarget(columnKey: string): HTMLElement {
  const dragNode = {
    dataset: {
      pcsProjectListColumnKey: columnKey,
      dragSource: columnKey,
      dropTarget: columnKey,
    },
  }
  return {
    closest: (selector: string) => selector === '[data-standard-list-column-drag]' ? dragNode : null,
  } as unknown as HTMLElement
}

assert.equal(handlePcsProjectListEvent(actionTarget('open-column-settings')), true)
html = await renderPcsProjectListPage()
assert.match(html, /data-standard-list-column-drag/, '真实 handler 必须能局部打开列设置')

assert.equal(handlePcsProjectListEvent(actionTarget('sort-column', { columnKey: 'project' })), true)
html = await renderPcsProjectListPage()
assert.match(html, /data-standard-list-sort-icon="asc"/, '真实 handler 必须能切换标准列排序')

assert.equal(
  handlePcsProjectListEvent(
    actionTarget('toggle-column-visibility', { pcsProjectListColumnKey: 'category' }),
    new Event('change'),
  ),
  true,
)
html = await renderPcsProjectListPage()
assert.doesNotMatch(html, /data-standard-list-column-width="category"/, '真实 handler 必须能隐藏非必需列')

assert.equal(
  handlePcsProjectListEvent(
    actionTarget('toggle-column-freeze', { pcsProjectListColumnKey: 'code' }),
    new Event('change'),
  ),
  true,
)
html = await renderPcsProjectListPage()
assert.ok(
  html.indexOf('data-standard-list-column-width="code"') < html.indexOf('data-standard-list-column-width="project"'),
  '冻结列必须立即移动到左侧固定区',
)

assert.equal(
  handlePcsProjectListEvent(
    dragTarget('updated'),
    { type: 'dragstart', dataTransfer: { setData: () => undefined } } as unknown as DragEvent,
  ),
  true,
)
assert.equal(
  handlePcsProjectListEvent(
    dragTarget('owner'),
    { type: 'drop', preventDefault: () => undefined } as unknown as DragEvent,
  ),
  true,
)
html = await renderPcsProjectListPage()
assert.ok(
  html.indexOf('data-standard-list-column-width="updated"') < html.indexOf('data-standard-list-column-width="owner"'),
  '真实拖动必须更新列顺序',
)

assert.equal(handlePcsProjectListEvent(actionTarget('next-page')), true)
html = await renderPcsProjectListPage()
assert.match(html, />2 \/ 4</, '真实 handler 必须局部分页且保留总页数口径')

Reflect.deleteProperty(globalThis, 'document')

console.log('pcs-projects-standard-list.spec.ts PASS')
