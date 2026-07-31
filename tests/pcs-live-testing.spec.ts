import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  handlePcsLiveTestingEvent,
  handlePcsLiveTestingInput,
  renderPcsLiveTestingListPage,
} from '../src/pages/pcs-live-testing.ts'

const source = readFileSync(new URL('../src/pages/pcs-live-testing.ts', import.meta.url), 'utf8')
const routeRenderersSource = readFileSync(new URL('../src/router/route-renderers.ts', import.meta.url), 'utf8')
const handlersSource = readFileSync(new URL('../src/main-handlers/pcs-handlers.ts', import.meta.url), 'utf8')
const listHtml = renderPcsLiveTestingListPage()

assert.match(listHtml, /直播测款/, '列表页应渲染直播测款标题')
assert.match(listHtml, /新增直播测款/, '列表页应提供新增直播测款入口')
assert.match(listHtml, /直播测款列表/, '列表页应渲染正式列表标题')
assert.match(source, /^\/\/ @page-pattern: list/m, '直播测款列表页应声明标准列表页模式')
assert.match(source, /renderStandardListPage/, '直播测款列表页应使用标准列表骨架')
assert.match(source, /renderStandardListTable/, '直播测款列表页应使用标准列表表格')
assert.match(source, /renderTablePagination/, '直播测款列表页应使用标准分页')
assert.match(listHtml, /data-standard-list-page/, '直播测款列表页应输出标准列表页标记')
assert.match(listHtml, /data-standard-list-scroll/, '直播测款列表应在表格容器内部横向滚动')
assert.match(listHtml, /data-standard-list-sort-icon="none"/, '可排序列应显示未排序图标')
assert.match(listHtml, /sticky right-0/, '操作列应固定在右侧')
assert.match(listHtml, /data-pcs-live-testing-action="open-column-settings"/, '列表页应提供列设置入口')
assert.match(listHtml, /data-pcs-live-testing-field="pageSize"/, '分页应提供每页条数选择')
assert.match(source, /higood:list-page:\/pcs\/testing\/live/, '列偏好和每页条数应按直播测款路由持久化')
assert.match(source, /action === 'sort-column'/, '处理器应支持三态排序')
assert.match(source, /toggle-column-visibility/, '处理器应支持列显示设置')
assert.match(source, /toggle-column-freeze/, '处理器应支持冻结列设置')
assert.match(source, /refreshLiveTestingListRegions/, '列表轻交互应采用局部刷新')
assert.doesNotMatch(source, /function renderPager\(/, '标准列表迁移后不应保留旧分页实现')
assert.doesNotMatch(source, /function renderListHeader\(/, '标准列表迁移后不应保留旧列表头实现')
assert.doesNotMatch(source, /function renderListTable\(/, '标准列表迁移后不应保留旧表格实现')
assert.match(source, /hydrateIcons\(region\)/, '局部替换表格后应只为新插入区域补充图标')
assert.doesNotMatch(source, /hydrateIcons\(document\)/, '列表局部刷新不得重新扫描整页图标')
assert.doesNotMatch(source, /QuickFilterKey|STATUS_OPTIONS|ACCOUNTING_OPTIONS/, '无界面入口的筛选常量与类型不应残留')
assert.doesNotMatch(source, /state\.list\.(?:status|purpose|accounting|quickFilter)/, '无界面入口的筛选状态不应残留')
assert.doesNotMatch(source, /action === '(?:query|set-quick-filter)'/, '无界面入口的筛选动作分支不应残留')
assert.doesNotMatch(source, /action === 'set-page'/, '标准分页不会产生 set-page 动作，不应保留不可达分支')
assert.match(routeRenderersSource, /renderPcsLiveTestingListPage[\s\S]*pages\/pcs-live-testing/, '直播测款列表路由应继续指向原页面入口')
assert.match(handlersSource, /handlePcsLiveTestingEvent/, 'PCS 主处理器应继续绑定直播测款事件入口')
assert.match(handlersSource, /handlePcsLiveTestingInput/, 'PCS 主处理器应继续绑定直播测款输入入口')

assert.match(source, /测款入账/, '页面源码应保留测款入账区域')
assert.match(source, /日志审计|操作日志/, '页面源码应保留日志区域')
assert.match(source, /关键人/, '页面源码应保留关键人区块')
assert.match(source, /项目步骤字段/, '页面源码应保留项目步骤字段区')
assert.match(source, /测款状态/, '页面源码应展示测款业务状态')
assert.doesNotMatch(source, /工作项状态/, '页面源码不得继续展示已删除的工作项语义')
assert.match(source, /关联直播测款记录/, '页面源码应保留正式关联动作')
assert.match(source, /直播挂车明细/, '页面源码应保留直播挂车明细字段')

assert.doesNotMatch(source, /本页用于|该模块用于|用于帮助|字段分层清单|字段模型说明|任务中心说明/, '直播测款页不应保留无关说明文案')

class FakeElement {
  dataset: Record<string, string>
  innerHTML = ''
  hydrationQueries = 0

  constructor(dataset: Record<string, string> = {}) {
    this.dataset = dataset
  }

  closest(selector: string): FakeElement | null {
    if (selector === '[data-pcs-live-testing-action]' && this.dataset.pcsLiveTestingAction) return this
    if (selector === '[data-pcs-live-testing-field]' && this.dataset.pcsLiveTestingField) return this
    if (selector === '[data-standard-list-column-drag]' && this.dataset.standardListColumnDrag) return this
    return null
  }

  querySelectorAll(selector: string): Element[] {
    if (selector === '[data-lucide]') this.hydrationQueries += 1
    return []
  }
}

class FakeInputElement extends FakeElement {
  value = ''
}

class FakeSelectElement extends FakeElement {
  value = ''
}

class FakeTextAreaElement extends FakeElement {
  value = ''
}

const tableHost = new FakeElement()
const paginationHost = new FakeElement()
const filtersHost = new FakeElement()
const settingsHost = new FakeElement()
const mountedRoot = new FakeElement()
const storedPreferences = new Map<string, string>()
const fakeStorage = {
  getItem(key: string) {
    return storedPreferences.get(key) ?? null
  },
  setItem(key: string, value: string) {
    storedPreferences.set(key, value)
  },
  removeItem(key: string) {
    storedPreferences.delete(key)
  },
}
const fakeDocument = {
  querySelector(selector: string) {
    if (selector === '[data-pcs-live-testing-list-page]') return mountedRoot
    if (selector === '[data-pcs-live-testing-region="table"]') return tableHost
    if (selector === '[data-pcs-live-testing-region="pagination"]') return paginationHost
    if (selector === '[data-pcs-live-testing-region="filters"]') return filtersHost
    if (selector === '[data-pcs-live-testing-region="column-settings"]') return settingsHost
    return null
  },
  querySelectorAll() {
    throw new Error('局部刷新不得扫描整个 document')
  },
}

Object.assign(globalThis, {
  HTMLElement: FakeElement,
  HTMLInputElement: FakeInputElement,
  HTMLSelectElement: FakeSelectElement,
  HTMLTextAreaElement: FakeTextAreaElement,
  document: fakeDocument,
  window: { localStorage: fakeStorage },
})

function actionTarget(action: string, dataset: Record<string, string> = {}): HTMLElement {
  return new FakeElement({ pcsLiveTestingAction: action, ...dataset }) as unknown as HTMLElement
}

handlePcsLiveTestingEvent(actionTarget('sort-column', { columnKey: 'gmv' }))
assert.match(tableHost.innerHTML, /data-standard-list-sort-icon="asc"/, '首次点击可排序列应切换为升序')
handlePcsLiveTestingEvent(actionTarget('sort-column', { columnKey: 'gmv' }))
assert.match(tableHost.innerHTML, /data-standard-list-sort-icon="desc"/, '再次点击可排序列应切换为降序')
handlePcsLiveTestingEvent(actionTarget('sort-column', { columnKey: 'gmv' }))
assert.doesNotMatch(tableHost.innerHTML, /data-standard-list-sort-icon="(?:asc|desc)"/, '第三次点击可排序列应恢复未排序')

function sessionIds(html: string): string[] {
  return [...html.matchAll(/<p class="text-xs text-slate-500">(LS-[^<]+)<\/p>/g)].map((match) => match[1])
}

const firstPageSessionIds = sessionIds(tableHost.innerHTML)
assert.match(paginationHost.innerHTML, />1 \/ 2</, '初始分页应展示第 1 / 2 页')
handlePcsLiveTestingEvent(actionTarget('next-page'))
const secondPageSessionIds = sessionIds(tableHost.innerHTML)
assert.match(paginationHost.innerHTML, />2 \/ 2</, '真实下一页动作应进入第 2 / 2 页')
assert.notDeepEqual(secondPageSessionIds, firstPageSessionIds, '翻页后应展示不同的行集合')
assert.notEqual(secondPageSessionIds[0], firstPageSessionIds[0], '翻页后首行应发生变化')
handlePcsLiveTestingEvent(actionTarget('prev-page'))
assert.match(paginationHost.innerHTML, />1 \/ 2</, '真实上一页动作应回到第 1 / 2 页')
assert.deepEqual(sessionIds(tableHost.innerHTML), firstPageSessionIds, '返回上一页后应恢复首屏行集合')

handlePcsLiveTestingEvent(actionTarget('toggle-column-visibility', { pcsLiveTestingColumnKey: 'account' }), { type: 'change' } as Event)
assert.doesNotMatch(tableHost.innerHTML, /账号 \/ 主播/, '隐藏列后局部表格应立即移除该列')
handlePcsLiveTestingEvent(actionTarget('toggle-column-visibility', { pcsLiveTestingColumnKey: 'account' }), { type: 'change' } as Event)
handlePcsLiveTestingEvent(actionTarget('toggle-column-freeze', { pcsLiveTestingColumnKey: 'account' }), { type: 'change' } as Event)

const dragSource = new FakeElement({
  standardListColumnDrag: 'true',
  pcsLiveTestingColumnKey: 'account',
}) as unknown as HTMLElement
const dragTarget = new FakeElement({
  standardListColumnDrag: 'true',
  pcsLiveTestingColumnKey: 'session',
}) as unknown as HTMLElement
handlePcsLiveTestingEvent(dragSource, {
  type: 'dragstart',
  dataTransfer: { setData() {} },
} as unknown as DragEvent)
handlePcsLiveTestingEvent(dragTarget, {
  type: 'drop',
  preventDefault() {},
} as unknown as DragEvent)

const pageSizeSelect = new FakeSelectElement({ pcsLiveTestingField: 'pageSize' })
pageSizeSelect.value = '20'
handlePcsLiveTestingInput(pageSizeSelect as unknown as Element)
handlePcsLiveTestingEvent(actionTarget('sort-column', { columnKey: 'updated' }))

const saved = JSON.parse(storedPreferences.get('higood:list-page:/pcs/testing/live') || '{}') as {
  order?: string[]
  visibleKeys?: string[]
  frozenKeys?: string[]
  pageSize?: number
  currentPage?: number
  sort?: unknown
}
assert.equal(saved.pageSize, 20, '每页条数应按路由持久化')
assert.ok(saved.visibleKeys?.includes('account'), '重新显示的列应进入持久化偏好')
assert.ok(saved.frozenKeys?.includes('account'), '冻结列应进入持久化偏好')
assert.ok((saved.order?.indexOf('account') ?? -1) < (saved.order?.indexOf('session') ?? -1), '拖拽后的列顺序应进入持久化偏好')
assert.equal(saved.currentPage, undefined, '当前页不得持久化')
assert.equal(saved.sort, undefined, '数据排序不得持久化')
assert.ok(tableHost.innerHTML.length > 0 && paginationHost.innerHTML.length > 0, '轻交互应实际更新表格与分页 DOM 区域')

console.log('pcs-live-testing.spec.ts PASS')
