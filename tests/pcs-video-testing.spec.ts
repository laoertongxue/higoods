import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  handlePcsVideoTestingEvent,
  handlePcsVideoTestingInput,
  renderPcsVideoTestingListPage,
} from '../src/pages/pcs-video-testing.ts'
import { listProjects } from '../src/data/pcs-project-repository.ts'

const source = readFileSync(new URL('../src/pages/pcs-video-testing.ts', import.meta.url), 'utf8')
const routeRenderersSource = readFileSync(new URL('../src/router/route-renderers.ts', import.meta.url), 'utf8')
const handlersSource = readFileSync(new URL('../src/main-handlers/pcs-handlers.ts', import.meta.url), 'utf8')
const listHtml = renderPcsVideoTestingListPage()

assert.match(listHtml, /短视频测款/, '列表页应渲染短视频测款标题')
assert.match(listHtml, /新增短视频测款/, '列表页应提供新增短视频测款入口')
assert.match(listHtml, /短视频测款列表/, '列表页应渲染正式列表标题')
assert.match(source, /^\/\/ @page-pattern: list/m, '短视频测款列表页应声明标准列表页模式')
assert.match(source, /renderStandardListPage/, '短视频测款列表页应使用标准列表骨架')
assert.match(source, /renderStandardListTable/, '短视频测款列表页应使用标准列表表格')
assert.match(source, /renderTablePagination/, '短视频测款列表页应使用标准分页')
assert.match(listHtml, /data-standard-list-page/, '短视频测款列表页应输出标准列表页标记')
assert.match(listHtml, /data-standard-list-scroll/, '短视频测款列表应在表格容器内部横向滚动')
assert.match(listHtml, /data-standard-list-sort-icon="none"/, '可排序列应显示未排序图标')
assert.match(listHtml, /sticky right-0/, '操作列应固定在右侧')
assert.match(listHtml, /data-pcs-video-testing-action="open-column-settings"/, '列表页应提供列设置入口')
assert.match(listHtml, /data-pcs-video-testing-field="pageSize"/, '分页应提供每页条数选择')
assert.match(source, /higood:list-page:\/pcs\/testing\/video/, '列偏好和每页条数应按短视频测款路由持久化')
assert.match(source, /action === 'sort-column'/, '处理器应支持三态排序')
assert.match(source, /toggle-column-visibility/, '处理器应支持列显示设置')
assert.match(source, /toggle-column-freeze/, '处理器应支持冻结列设置')
assert.match(source, /refreshVideoTestingListRegions/, '列表轻交互应采用局部刷新')
assert.doesNotMatch(source, /function renderPager\(/, '标准列表迁移后不应保留旧分页实现')
assert.doesNotMatch(source, /function renderListHeader\(/, '标准列表迁移后不应保留旧列表头实现')
assert.doesNotMatch(source, /function renderListTable\(/, '标准列表迁移后不应保留旧表格实现')
assert.doesNotMatch(source, /function renderKpis\(/, '无界面入口的旧统计卡片不应保留')
assert.match(source, /hydrateIcons\(region\)/, '局部替换表格后应只为新插入区域补充图标')
assert.doesNotMatch(source, /hydrateIcons\(document\)/, '列表局部刷新不得重新扫描整页图标')
assert.doesNotMatch(source, /QuickFilterKey|STATUS_OPTIONS|ACCOUNTING_OPTIONS/, '无界面入口的筛选常量与类型不应残留')
assert.doesNotMatch(source, /state\.list\.(?:status|purpose|platform|accounting|quickFilter)/, '无界面入口的筛选状态不应残留')
assert.doesNotMatch(source, /action === '(?:query|set-quick-filter)'/, '无界面入口的筛选动作分支不应残留')
assert.doesNotMatch(source, /action === 'set-page'/, '标准分页不会产生 set-page 动作，不应保留不可达分支')
assert.match(routeRenderersSource, /renderPcsVideoTestingListPage[\s\S]*pages\/pcs-video-testing/, '短视频测款列表路由应继续指向原页面入口')
assert.match(handlersSource, /handlePcsVideoTestingEvent/, 'PCS 主处理器应继续绑定短视频测款事件入口')
assert.match(handlersSource, /handlePcsVideoTestingInput/, 'PCS 主处理器应继续绑定短视频测款输入入口')

assert.match(source, /内容条目/, '页面源码应保留内容条目区')
assert.match(source, /数据核对/, '页面源码应保留数据核对区')
assert.match(source, /证据素材/, '页面源码应保留证据素材区')
assert.match(source, /测款入账/, '页面源码应保留测款入账区')
assert.match(source, /日志审计/, '页面源码应保留日志审计区')
assert.match(source, /负责人信息/, '页面源码应保留负责人信息区')
assert.match(source, /工作项字段/, '页面源码应保留工作项字段区')
assert.match(source, /测款状态/, '页面源码应展示测款业务状态')
assert.doesNotMatch(source, /工作项状态/, '页面源码不得继续展示已删除的工作项语义')
assert.match(source, /关联短视频测款记录/, '页面源码应保留正式关联动作')
assert.match(source, /发布渠道/, '页面源码应保留发布渠道字段')

assert.doesNotMatch(source, /本页用于|该模块用于|用于帮助|字段分层清单|字段模型说明|任务中心说明/, '短视频测款页不应保留无关说明文案')

class FakeElement {
  dataset: Record<string, string>
  private html = ''
  innerHTMLWrites = 0
  hydrationQueries = 0

  constructor(dataset: Record<string, string> = {}) {
    this.dataset = dataset
  }

  get innerHTML(): string {
    return this.html
  }

  set innerHTML(value: string) {
    this.html = value
    this.innerHTMLWrites += 1
  }

  closest(selector: string): FakeElement | null {
    if (selector === '[data-pcs-video-testing-action]' && this.dataset.pcsVideoTestingAction) return this
    if (selector === '[data-pcs-video-testing-field]' && this.dataset.pcsVideoTestingField) return this
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
    if (selector === '[data-pcs-video-testing-list-page]') return mountedRoot
    if (selector === '[data-pcs-video-testing-region="table"]') return tableHost
    if (selector === '[data-pcs-video-testing-region="pagination"]') return paginationHost
    if (selector === '[data-pcs-video-testing-region="filters"]') return filtersHost
    if (selector === '[data-pcs-video-testing-region="column-settings"]') return settingsHost
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
  return new FakeElement({ pcsVideoTestingAction: action, ...dataset }) as unknown as HTMLElement
}

function recordTitles(html: string): string[] {
  return [...html.matchAll(/<p class="font-medium text-slate-900">(分页验证短视频 \d+)<\/p>/g)]
    .map((match) => match[1])
}

const project = listProjects()[0]
assert.ok(project, '短视频测款行为测试需要至少一个商品项目')

function inputField(field: string, value: string): void {
  const input = new FakeInputElement({ pcsVideoTestingField: field })
  input.value = value
  handlePcsVideoTestingInput(input as unknown as Element)
}

for (let index = 1; index <= 9; index += 1) {
  inputField('create-project-ref', project.projectCode)
  inputField('create-title', `分页验证短视频 ${index}`)
  const platform = new FakeSelectElement({ pcsVideoTestingField: 'create-platform' })
  platform.value = 'TIKTOK'
  handlePcsVideoTestingInput(platform as unknown as Element)
  inputField('create-account', `测试账号 ${index}`)
  inputField('create-creator', `测试达人 ${index}`)
  inputField('create-published-at', `2026-07-${String(index).padStart(2, '0')} 10:00`)
  inputField('create-video-url', `https://example.com/video/${index}`)
  inputField('create-views', String(1000 + index))
  inputField('create-clicks', String(100 + index))
  inputField('create-likes', String(50 + index))
  inputField('create-orders', String(10 + index))
  inputField('create-gmv', String(1000 + index))
  const note = new FakeTextAreaElement({ pcsVideoTestingField: 'create-note' })
  note.value = `分页验证 ${index}`
  handlePcsVideoTestingInput(note as unknown as Element)
  handlePcsVideoTestingEvent(actionTarget('submit-create-record'))
}
handlePcsVideoTestingEvent(actionTarget('reset'))
const mountedRootBeforeInteractions = fakeDocument.querySelector('[data-pcs-video-testing-list-page]')

handlePcsVideoTestingEvent(actionTarget('sort-column', { columnKey: 'gmv' }))
assert.match(tableHost.innerHTML, /data-standard-list-sort-icon="asc"/, '首次点击可排序列应切换为升序')
assert.equal(recordTitles(tableHost.innerHTML)[0], '分页验证短视频 1', 'GMV 升序后首行应为最低 GMV 的短视频')
handlePcsVideoTestingEvent(actionTarget('sort-column', { columnKey: 'gmv' }))
assert.match(tableHost.innerHTML, /data-standard-list-sort-icon="desc"/, '再次点击可排序列应切换为降序')
assert.equal(recordTitles(tableHost.innerHTML)[0], '分页验证短视频 9', 'GMV 降序后首行应为最高 GMV 的短视频')
handlePcsVideoTestingEvent(actionTarget('sort-column', { columnKey: 'gmv' }))
assert.doesNotMatch(tableHost.innerHTML, /data-standard-list-sort-icon="(?:asc|desc)"/, '第三次点击可排序列应恢复未排序')
assert.equal(recordTitles(tableHost.innerHTML)[0], '分页验证短视频 9', '恢复默认顺序后应按发布时间展示最新短视频')

function recordIds(html: string): string[] {
  return [...html.matchAll(/<p class="text-xs text-slate-500">(SV-[^<]+)<\/p>/g)].map((match) => match[1])
}

const firstPageRecordIds = recordIds(tableHost.innerHTML)
assert.match(paginationHost.innerHTML, />1 \/ 2</, '初始分页应展示第 1 / 2 页')
handlePcsVideoTestingEvent(actionTarget('next-page'))
const secondPageRecordIds = recordIds(tableHost.innerHTML)
assert.match(paginationHost.innerHTML, />2 \/ 2</, '真实下一页动作应进入第 2 / 2 页')
assert.notDeepEqual(secondPageRecordIds, firstPageRecordIds, '翻页后应展示不同的行集合')
handlePcsVideoTestingEvent(actionTarget('prev-page'))
assert.match(paginationHost.innerHTML, />1 \/ 2</, '真实上一页动作应回到第 1 / 2 页')
assert.deepEqual(recordIds(tableHost.innerHTML), firstPageRecordIds, '返回上一页后应恢复首屏行集合')

const searchInput = new FakeInputElement({ pcsVideoTestingField: 'list-search' })
searchInput.value = '分页验证短视频 4'
handlePcsVideoTestingInput(searchInput as unknown as Element)
assert.match(tableHost.innerHTML, /分页验证短视频 4/, '搜索输入应立即保留匹配的短视频')
assert.doesNotMatch(tableHost.innerHTML, /分页验证短视频 3/, '搜索输入应立即过滤不匹配的短视频')
assert.match(paginationHost.innerHTML, />1 \/ 1</, '搜索后分页应按过滤结果同步收口')
searchInput.value = ''
handlePcsVideoTestingInput(searchInput as unknown as Element)
assert.match(paginationHost.innerHTML, />1 \/ 2</, '清空搜索后应恢复完整分页')

handlePcsVideoTestingEvent(actionTarget('toggle-column-visibility', { pcsVideoTestingColumnKey: 'account' }), { type: 'change' } as Event)
assert.doesNotMatch(tableHost.innerHTML, /平台 \/ 发布账号/, '隐藏列后局部表格应立即移除该列')
handlePcsVideoTestingEvent(actionTarget('toggle-column-visibility', { pcsVideoTestingColumnKey: 'account' }), { type: 'change' } as Event)
handlePcsVideoTestingEvent(actionTarget('toggle-column-freeze', { pcsVideoTestingColumnKey: 'account' }), { type: 'change' } as Event)
const frozenHeaderKeys = [...tableHost.innerHTML.matchAll(/<th[\s\S]*?data-column-key="([^"]+)"[\s\S]*?<\/th>/g)]
  .map((match) => match[1])
assert.equal(frozenHeaderKeys[0], 'account', '冻结列应立即进入表格最左侧固定区')
assert.match(
  tableHost.innerHTML,
  /<th[\s\S]*?class="[^"]*sticky[^"]*"[\s\S]*?style="[^"]*left: 0px;[^"]*"[\s\S]*?data-column-key="account"/,
  '冻结列应立即应用 sticky 和 left: 0px 固定样式',
)

const dragSource = new FakeElement({
  standardListColumnDrag: 'true',
  pcsVideoTestingColumnKey: 'creator',
}) as unknown as HTMLElement
const dragTarget = new FakeElement({
  standardListColumnDrag: 'true',
  pcsVideoTestingColumnKey: 'record',
}) as unknown as HTMLElement
handlePcsVideoTestingEvent(dragSource, {
  type: 'dragstart',
  dataTransfer: { setData() {} },
} as unknown as DragEvent)
handlePcsVideoTestingEvent(dragTarget, {
  type: 'drop',
  preventDefault() {},
} as unknown as DragEvent)
const draggedHeaderKeys = [...tableHost.innerHTML.matchAll(/<th[\s\S]*?data-column-key="([^"]+)"[\s\S]*?<\/th>/g)]
  .map((match) => match[1])
assert.ok(
  draggedHeaderKeys.indexOf('creator') < draggedHeaderKeys.indexOf('record'),
  '拖序后当前表格 DOM 应立即把达人列移动到短视频测款列之前',
)

const pageSizeSelect = new FakeSelectElement({ pcsVideoTestingField: 'pageSize' })
pageSizeSelect.value = '20'
handlePcsVideoTestingInput(pageSizeSelect as unknown as Element)
handlePcsVideoTestingEvent(actionTarget('sort-column', { columnKey: 'updated' }))

const saved = JSON.parse(storedPreferences.get('higood:list-page:/pcs/testing/video') || '{}') as {
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
assert.ok((saved.order?.indexOf('creator') ?? -1) < (saved.order?.indexOf('record') ?? -1), '拖拽后的列顺序应进入持久化偏好')
assert.equal(saved.currentPage, undefined, '当前页不得持久化')
assert.equal(saved.sort, undefined, '数据排序不得持久化')
assert.ok(tableHost.innerHTML.length > 0 && paginationHost.innerHTML.length > 0, '轻交互应实际更新表格与分页 DOM 区域')
assert.strictEqual(
  fakeDocument.querySelector('[data-pcs-video-testing-list-page]'),
  mountedRootBeforeInteractions,
  '局部刷新前后应保持同一个列表页外壳节点',
)
assert.equal(mountedRoot.innerHTMLWrites, 0, '列表轻交互不得重写列表页外壳 innerHTML')

console.log('pcs-video-testing.spec.ts PASS')
