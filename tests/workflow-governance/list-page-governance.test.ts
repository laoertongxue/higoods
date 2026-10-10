import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  assertListPage, hasStandardListContract, isPageEntry, parsePagePattern, runListPageGovernance, sha256, validateBaselineIntegrity,
} from '../../scripts/check-list-page-governance.ts'
import { assertHistoricalListCorrection, isNonStructuralListCorrection } from '../../scripts/workflow-governance/list-page-policy.ts'
import type { ReviewRecordSource } from '../../scripts/workflow-governance/prototype-review.ts'

const PAGE = 'src/pages/legacy.ts'
const RECORD = 'docs/prototype-review-records/list-copy.md'
const BASELINE = 'scripts/standard-list-page-baseline.json'
const STANDARD_IMPORTS = `import { renderStandardListPage } from '../components/ui/list-page.ts'
import { renderStandardListTable } from '../components/ui/list-table.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
`
const BEFORE = `const total = 20
export function renderLegacyPage() {
  const quantity = total * 2
  return \`<section class="legacy-panel p-4 text-gray-600"><h1>采购需求</h1><table><thead><tr><th>颜色</th><th>数量</th></tr></thead><tbody><tr><td>灰色</td><td>\${quantity} 件</td></tr></tbody></table><button data-action="save">保存</button><a href="/orders">查看</a></section>\` + renderTablePagination({ total })
}
`
const COPY = BEFORE.replace('采购需求', '采购任务')

function review(before = BEFORE, after = COPY): ReviewRecordSource {
  return { path: RECORD, source: `# 测试夹具：轻量审查

## 基本信息
- 日期：2026-10-10
- 任务 / 需求编号：GOV-LIST-LOCAL-001
- 验证人：Codex 列表治理契约测试执行者

## 影响判定
- 记录模式：轻量可见变更
- 用户可见影响：有
- 判定依据：列表标题错别字修正，保存、查询与数量计算不变
- 契约变化：无

## 轻量变更
- 对象 / 路由：管理列表 /orders
- 改了什么：采购需求标题改为采购任务
- 保留什么：字段、动作、数量公式和路由不变
- 如何验证：当前浏览器检查标题及保存按钮，并核对列表数量
- 结果：通过

## 受管文件
- \`${PAGE}\`

## 页面证据
- 版本：测试 fixture 当前工作树，1366×768，fixture-v2
- 证据：/orders 标题与保存动作核对；fixtures/list-copy.png

## 性能结论
- 结论：不适用
- 依据：本例仅测试审查解析，页面性能为隔离夹具说明

## 验证命令
- \`node --test fixture-contract.test.ts\`：通过

## 历史列表局部修正
| 文件 | 基准 SHA256 | 当前 SHA256 | 依据 |
| --- | --- | --- | --- |
| \`${PAGE}\` | ${sha256(before)} | ${sha256(after)} | 仅修改 HTML 标题文本；逐项核对数量与动作未变 |
` }
}

function withFixture(work: (cwd: string, write: (path: string, source: string) => void, git: (...args: string[]) => string) => void): void {
  const cwd = mkdtempSync(join(tmpdir(), 'higoods-list-policy-'))
  const write = (path: string, source: string) => { mkdirSync(dirname(join(cwd, path)), { recursive: true }); writeFileSync(join(cwd, path), source) }
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  try {
    git('init', '-q')
    git('config', 'user.email', 'fixture@example.test')
    git('config', 'user.name', 'Governance Test Fixture')
    write(PAGE, BEFORE)
    write(BASELINE, JSON.stringify({ [PAGE]: sha256(BEFORE) }))
    git('add', '--', PAGE, BASELINE)
    git('commit', '-qm', 'fixture baseline')
    work(cwd, write, git)
  } finally { rmSync(cwd, { recursive: true, force: true }) }
}

test('历史标题文案和静态外观类可比较为非结构修正', () => {
  assert(isNonStructuralListCorrection(BEFORE, COPY))
  const style = BEFORE.replace('p-4 text-gray-600', 'p-6 text-blue-700 font-medium')
  assert(isNonStructuralListCorrection(BEFORE, style))
  assert.doesNotThrow(() => assertHistoricalListCorrection(PAGE, BEFORE, style, [review(BEFORE, style)]))
})

const forbiddenChanges: Array<[string, (source: string) => string]> = [
  ['数量公式', (s) => s.replace('total * 2', 'total * 3')],
  ['业务数值', (s) => s.replace('total = 20', 'total = 21')],
  ['HTML 内硬编码数量', (s) => s.replace('灰色', '灰色 20')],
  ['现场单位', (s) => s.replace('${quantity} 件', '${quantity} 片')],
  ['表头列数', (s) => s.replace('<th>颜色</th>', '<th>颜色</th><th>尺码</th>')],
  ['按钮删除', (s) => s.replace('<button data-action="save">保存</button>', '')],
  ['标签结构', (s) => s.replace('<h1>', '<h2>').replace('</h1>', '</h2>')],
  ['事件属性', (s) => s.replace('data-action="save"', 'data-action="remove"')],
  ['路由地址', (s) => s.replace('href="/orders"', 'href="/other"')],
  ['元素标识', (s) => s.replace('<table>', '<table id="different">')],
  ['功能选择器 class', (s) => s.replace('legacy-panel', 'other-panel')],
  ['隐藏控件 class', (s) => s.replace('legacy-panel p-4', 'legacy-panel hidden p-4')],
  ['任意值 class', (s) => s.replace('p-4', 'p-[1000px]')],
  ['文本清空', (s) => s.replace('采购需求', '')],
]
for (const [name, mutate] of forbiddenChanges) test(`${name}变化即使声明契约无也不能走历史局部例外`, () => {
  const after = mutate(BEFORE)
  assert.equal(isNonStructuralListCorrection(BEFORE, after), false)
  assert.throws(() => assertListPage(PAGE, after, BEFORE, { [PAGE]: sha256(BEFORE) }, [review(BEFORE, after)]), /无法证明仅为非结构/)
})

test('无法解析的源码不能证明为非结构修正', () => {
  assert.throws(() => isNonStructuralListCorrection(BEFORE, COPY + 'const ='), /无法解析/)
})

test('中文数字的现场数量和被事件选择器复用的样式类也不能走外观例外', () => {
  const quantity = BEFORE.replace('灰色', '二十件')
  assert.equal(isNonStructuralListCorrection(quantity, quantity.replace('二十件', '三十件')), false)
  const selector = BEFORE + '\nconst eventTarget = document.querySelector(".p-4")\n'
  assert.equal(isNonStructuralListCorrection(selector, selector.replace('legacy-panel p-4', 'legacy-panel p-6')), false)
})

test('正负号、非穷举单位和日期符号变化均不能当作文案修正', () => {
  for (const [before, after] of [['10 件', '-10 件'], ['-10 件', '+10 件'], ['2 箱', '2 吨'], ['2 kg', '2 lb'], ['2026-10-10', '2026/10/10'], ['${quantity} 箱', '${quantity} 吨']]) {
    const source = BEFORE.replace('灰色', before)
    assert.equal(isNonStructuralListCorrection(source, source.replace(before, after)), false, `${before} → ${after}`)
  }
})

test('同一数量单元格分开的数字和单位仍完整冻结，其他单元格文案可修正', () => {
  for (const [number, beforeUnit, afterUnit] of [['2', '盒', '桶'], ['20', '尺', '寸'], ['${quantity}', '盒', '桶']]) {
    const source = BEFORE.replace('${quantity} 件', `<span>${number}</span><span>${beforeUnit}</span>`)
    assert.equal(isNonStructuralListCorrection(source, source.replace(`<span>${beforeUnit}</span>`, `<span>${afterUnit}</span>`)), false)
    assert.equal(isNonStructuralListCorrection(source, source.replace('灰色', '浅灰色')), true)
  }
  const compact = BEFORE.replace('${quantity} 件', '<div><span>2</span><span>盒</span></div>')
  assert.equal(isNonStructuralListCorrection(compact, compact.replace('盒', '桶')), false)
})

test('没有数值的单位表头和独立单位不能放过，普通标题文案仍允许', () => {
  for (const [before, after] of [['数量（片）', '数量（件）'], ['箱', '吨'], ['kg', 'lb'], ['数量（未知单位甲）', '数量（未知单位乙）']]) {
    const source = BEFORE.replace('<th>数量</th>', `<th>${before}</th>`)
    assert.equal(isNonStructuralListCorrection(source, source.replace(before, after)), false, `${before} → ${after}`)
  }
  const standalone = 'export function renderSamplePage() { return `<span>箱</span>` }'
  assert.equal(isNonStructuralListCorrection(standalone, standalone.replace('箱', '吨')), false)
  assert(isNonStructuralListCorrection(BEFORE, COPY))
})

test('仅写契约无而没有页面证据不能放过历史局部修正', () => {
  const record = review()
  record.source = record.source.replace(/## 页面证据[\s\S]*?(?=## 性能结论)/, '')
  assert.throws(() => assertHistoricalListCorrection(PAGE, BEFORE, COPY, [record]), /页面证据/)
})

test('仅有轻量记录而没有源码前后哈希不能放过', () => {
  const record = review()
  record.source = record.source.replace(/## 历史列表局部修正[\s\S]*$/, '')
  assert.throws(() => assertHistoricalListCorrection(PAGE, BEFORE, COPY, [record]), /前后哈希记录/)
})

test('旧基线哈希不能冒充本次修改前哈希，当前哈希也必须匹配', () => {
  const staleBefore = review('旧源码', COPY)
  const staleAfter = review(BEFORE, '旧结果')
  assert.throws(() => assertHistoricalListCorrection(PAGE, BEFORE, COPY, [staleBefore]), /基准 SHA256/)
  assert.throws(() => assertHistoricalListCorrection(PAGE, BEFORE, COPY, [staleAfter]), /当前 SHA256/)
})

test('重复或示例代码块中的历史局部证明不接受', () => {
  const duplicated = review()
  duplicated.source += `\n${duplicated.source.slice(duplicated.source.indexOf('| `src/pages/'))}`
  assert.throws(() => assertHistoricalListCorrection(PAGE, BEFORE, COPY, [duplicated]), /文件重复/)
  const fenced = review()
  fenced.source = fenced.source.replace('## 历史列表局部修正', '```md\n## 历史列表局部修正') + '\n```\n'
  assert.throws(() => assertHistoricalListCorrection(PAGE, BEFORE, COPY, [fenced]), /前后哈希记录/)
})

test('HTML 注释和四空格代码中的哈希表不能作为历史局部证明', () => {
  const commented = review()
  commented.source = commented.source.replace('## 历史列表局部修正', '<!--\n## 历史列表局部修正') + '\n-->\n'
  assert.throws(() => assertHistoricalListCorrection(PAGE, BEFORE, COPY, [commented]), /前后哈希记录/)
  const indented = review()
  indented.source = indented.source.replace(/\|.*\n/g, (line) => `    ${line}`)
  assert.throws(() => assertHistoricalListCorrection(PAGE, BEFORE, COPY, [indented]), /表头|前后哈希记录/)
})

test('历史列表身份持续使用原始基线，本次比较使用实际前后源码', () => {
  const next = COPY.replace('text-gray-600', 'text-blue-700')
  assert.doesNotThrow(() => assertListPage(PAGE, next, COPY, { [PAGE]: sha256(BEFORE) }, [review(COPY, next)]))
  assert.throws(() => validateBaselineIntegrity({ [PAGE]: sha256(next) }, { [PAGE]: sha256(BEFORE) }), /基线哈希不得修改/)
  assert.throws(() => validateBaselineIntegrity({ [PAGE]: sha256(BEFORE), 'src/pages/new.ts': sha256(next) }, { [PAGE]: sha256(BEFORE) }), /基线不得新增/)
  assert.throws(() => validateBaselineIntegrity({ [PAGE]: sha256(next) }, null), /创建历史页面基线/)
})

test('未闭合 HTML 注释至 EOF 内的哈希证明无效', () => {
  const record = review()
  record.source = record.source.replace('## 历史列表局部修正', '<!--\n## 历史列表局部修正')
  assert.throws(() => assertHistoricalListCorrection(PAGE, BEFORE, COPY, [record]), /必须有且仅有一条/)
})

test('新增列表须声明模式且实际调用标准组件，注释不能冒充调用', () => {
  assert.throws(() => assertListPage('src/pages/new.ts', BEFORE, null, {}), /新增页面/)
  const misleading = '// @page-pattern: list\n// renderStandardListPage renderStandardListTable renderTablePagination\nexport function renderNewPage() { return "" }'
  assert.equal(hasStandardListContract(misleading), false)
  assert.throws(() => assertListPage('src/pages/new.ts', misleading, null, {}), /未完整使用/)
  const standard = STANDARD_IMPORTS + '// @page-pattern: list\nexport function renderNewPage() { return renderStandardListPage({ tableHtml: renderStandardListTable({}), paginationHtml: renderTablePagination({}) }) }'
  assert.doesNotThrow(() => assertListPage('src/pages/new.ts', standard, null, {}))
  assert.doesNotThrow(() => assertListPage('src/pages/new.ts', standard.replace('paginationHtml: renderTablePagination({})', '').replace('// @page-pattern: list', '// @page-pattern: list\n// @list-pagination: none — 固定四项展示，无分页需求'), null, {}))
})

test('本地同名函数和导出入口不可达的死函数不能冒充标准组件契约', () => {
  const calls = 'renderStandardListPage({ tableHtml: renderStandardListTable({}), paginationHtml: renderTablePagination({}) })'
  const fake = `function renderStandardListPage() { return '' }\nfunction renderStandardListTable() { return '' }\nfunction renderTablePagination() { return '' }\nexport function renderFakePage() { return ${calls} }`
  assert.equal(hasStandardListContract(fake), false)
  const dead = STANDARD_IMPORTS + `function unused() { return ${calls} }\nexport function renderFakePage() { return '<table></table>' }`
  assert.equal(hasStandardListContract(dead), false)
  const shadow = STANDARD_IMPORTS + `export function renderFakePage() { const renderStandardListPage = () => ''; return ${calls} }`
  assert.equal(hasStandardListContract(shadow), false)
  const wrongSource = STANDARD_IMPORTS.replace('../components/ui/list-page.ts', '../fake/components/ui/list-page.ts') + `export function renderFakePage() { return ${calls} }`
  assert.equal(hasStandardListContract(wrongSource), false)
})

test('真实组件的丢弃调用和未使用 const 不构成返回页面的标准契约', () => {
  const calls = 'renderStandardListPage({ tableHtml: renderStandardListTable({}), paginationHtml: renderTablePagination({}) })'
  assert.equal(hasStandardListContract(STANDARD_IMPORTS + `export function renderFakePage() { ${calls}; return '<table></table>' }`), false)
  assert.equal(hasStandardListContract(STANDARD_IMPORTS + `export function renderFakePage() { const unused = ${calls}; return '<table></table>' }`), false)
  assert.equal(hasStandardListContract(STANDARD_IMPORTS + `export function renderFakePage(flag: boolean) { if (flag) return renderStandardListPage({}); return renderStandardListTable({}) + renderTablePagination({}) }`), false)
  assert.equal(hasStandardListContract(STANDARD_IMPORTS + `function ignore(value: string) { return '<table></table>' } export function renderFakePage() { return ignore(${calls}) }`), false)
  assert.equal(hasStandardListContract(STANDARD_IMPORTS + `function wrap(value: string) { return '<section>' + value + '</section>' } export function renderActualPage() { return wrap(${calls}) }`), true)
})

test('条件、逗号和对象取值仅使用实际返回链，未知动态表达式不能拼凑契约', () => {
  const calls = 'renderStandardListPage({ tableHtml: renderStandardListTable({}), paginationHtml: renderTablePagination({}) })'
  const check = (expression: string) => hasStandardListContract(STANDARD_IMPORTS + `export function renderExpressionPage(flag: boolean) { const good = ${calls}; return ${expression} }`)
  for (const expression of [
    "false ? good : '<table>raw</table>'",
    "(good, '<table>raw</table>')",
    "({ unused: good, output: '<table>raw</table>' }).output",
    "({ unused: good, output: '<table>raw</table>' })['output']",
    "flag ? renderStandardListPage({ tableHtml: renderStandardListTable({}) }) : renderTablePagination({})",
    'renderStandardListPage({ content: flag ? renderStandardListTable({}) : renderTablePagination({}) })',
  ]) assert.equal(check(expression), false, expression)
  for (const expression of [
    "true ? good : '<table>raw</table>'",
    "('<table>raw</table>', good)",
    "({ unused: '<table>raw</table>', output: good }).output",
    "({ unused: '<table>raw</table>', output: good })['output']",
  ]) assert.equal(check(expression), true, expression)
})

test('真实组件须进入表格和分页输出槽，其他属性不能补证', () => {
  const source = STANDARD_IMPORTS + `export function renderFakePage() { return renderStandardListPage({ title: renderStandardListTable({}), className: renderTablePagination({}), filtersHtml: '', tableHtml: '<table><tbody>raw</tbody></table>', paginationHtml: '' }) }`
  assert.equal(hasStandardListContract(source), false)
  const swapped = STANDARD_IMPORTS + `export function renderFakePage() { return renderStandardListPage({ tableHtml: renderTablePagination({}), paginationHtml: renderStandardListTable({}) }) }`
  assert.equal(hasStandardListContract(swapped), false)
  const oldFakeSlots = STANDARD_IMPORTS + `export function renderFakePage() { return renderStandardListPage({ table: renderStandardListTable({}), pagination: renderTablePagination({}) }) }`
  assert.equal(hasStandardListContract(oldFakeSlots), false)
  const controller = STANDARD_IMPORTS + `import { createProcessOrderListController } from '../components/ui/process-order-list-controller.ts'; const view = createProcessOrderListController({}).getView(); export function renderFakePage() { return renderStandardListPage({ tableHtml: view.paginationHtml, paginationHtml: view.tableHtml }) }`
  assert.equal(hasStandardListContract(controller), false)
})

test('真实页面入口不能由未调用的导出 helper 或另一个页面代为通过', () => {
  const good = 'renderStandardListPage({ tableHtml: renderStandardListTable({}), paginationHtml: renderTablePagination({}) })'
  assert.equal(hasStandardListContract(STANDARD_IMPORTS + `export function renderUnusedHelper() { return ${good} } export function renderFakePage() { return '<table>raw</table>' }`), false)
  assert.equal(hasStandardListContract(STANDARD_IMPORTS + `export function renderGoodPage() { return ${good} } export function renderFakePage() { return '<table>raw</table>' }`), false)
  assert.equal(hasStandardListContract(STANDARD_IMPORTS + `export function renderUsedHelper() { return ${good} } export function renderActualPage() { return renderUsedHelper() }`), true)
})

test('真实标准组件允许 import 别名及导出入口可达的本地 helper', () => {
  const source = STANDARD_IMPORTS.replace('{ renderStandardListTable }', '{ renderStandardListTable as table }') + `
function rows() { return table({}) }
const paging = () => renderTablePagination({})
export function renderActualPage() { return renderStandardListPage({ tableHtml: rows(), paginationHtml: paging() }) }`
  assert.equal(hasStandardListContract(source), true)
})

test('跨文件 renderer 和实际调用回调的 wrapper 使用传入的同版本源码证明', () => {
  const dependency = STANDARD_IMPORTS + 'export function renderBusinessList() { return renderStandardListPage({ tableHtml: renderStandardListTable({}), paginationHtml: renderTablePagination({}) }) }'
  const entry = "import { renderBusinessList } from './business-list.ts'; export function renderActualPage() { return renderBusinessList() }"
  assert.equal(hasStandardListContract(entry), false)
  assert.equal(hasStandardListContract(entry, 'src/pages/example.ts', (path) => path === 'src/pages/business-list.ts' ? dependency : null), true)
  const wrapped = STANDARD_IMPORTS + `
function withReadSnapshot(callback: () => string) { return callback() }
function renderBody() { return renderStandardListPage({ tableHtml: renderStandardListTable({}), paginationHtml: renderTablePagination({}) }) }
export function renderActualPage() { return withReadSnapshot(renderBody) }`
  assert.equal(hasStandardListContract(wrapped), true)
  assert.equal(hasStandardListContract(wrapped.replace('return callback()', "return 'unused callback'")), false)
  const factory = STANDARD_IMPORTS + `
function createLocalPage() {
  function render() { return renderStandardListPage({ tableHtml: renderStandardListTable({}), paginationHtml: renderTablePagination({}) }) }
  return { render }
}
export function renderActualPage() { const page = createLocalPage(); return page.render() }`
  assert.equal(hasStandardListContract(factory), true)
})

test('现有直接列表、回调 wrapper、共享 factory 与缓存 renderer 保持真实标准组件契约', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const read = (path: string) => { try { return readFileSync(join(root, path), 'utf8') } catch { return null } }
  for (const path of [
    'src/pages/process-factory/cutting/supplement-management.ts',
    'src/pages/process-factory/cutting/cut-piece-release.ts',
    'src/pages/process-factory/dyeing/work-orders.ts',
    'src/pages/pcs-engineering-tasks/pattern-task.ts',
    'src/pages/process-factory/accessory/webbing/semi-finished-orders.ts',
  ]) assert.equal(hasStandardListContract(read(path)!, path, read), true, path)
})

test('遗漏范围的 dirty wrapper 不能凑齐页面契约，已提交依赖仍可使用', () => withFixture((cwd, write, git) => {
  const dependencyPath = 'src/pages/business-list.ts'
  const dependency = STANDARD_IMPORTS + 'export function renderBusinessList() { return renderStandardListPage({ tableHtml: renderStandardListTable({}), paginationHtml: renderTablePagination({}) }) }'
  write(dependencyPath, 'export function renderBusinessList() { return "<table></table>" }')
  git('add', '--', dependencyPath)
  git('commit', '-qm', 'nonstandard dependency baseline')
  write(PAGE, '// @page-pattern: list\nimport { renderBusinessList } from "./business-list.ts"; export function renderActualPage() { return renderBusinessList() }')
  write(RECORD, review().source)
  write(dependencyPath, dependency)
  assert.throws(() => runListPageGovernance(['--scope', 'worktree', '--paths', `${PAGE},${RECORD}`], cwd), /未完整使用/)
  git('add', '--', dependencyPath)
  git('commit', '-qm', 'standard dependency committed')
  write(dependencyPath, 'export function renderBusinessList() { return "unrelated dirty changes" }')
  const result = runListPageGovernance(['--scope', 'worktree', '--paths', `${PAGE},${RECORD}`], cwd)
  assert.deepEqual(result.checkedPaths, [PAGE])
  assert(result.excludedPaths.includes(dependencyPath))
}))

test('export const 页面可识别，历史列表不能更改模式伪装为详情页', () => {
  assert(isPageEntry('export const renderOrdersPage = () => ""'))
  assert.throws(() => assertListPage(PAGE, '// @page-pattern: detail\n' + COPY, BEFORE, { [PAGE]: sha256(BEFORE) }, [review(BEFORE, '// @page-pattern: detail\n' + COPY)]), /不能改变页面模式/)
})

test('页面模式和无分页声明仅接受真实独立行注释，字符串及模板注释不能伪造', () => {
  const body = 'export function renderFakePage() { return "<table data-list=\\"true\\"></table>" }'
  for (const fake of [
    "const tutorial = '@page-pattern: detail'",
    'const tutorial = `\n// @page-pattern: detail\n`',
    'const tutorial = `标题 ${name}\n// @page-pattern: detail\n`',
    '/* // @page-pattern: detail */',
    'const inline = true // @page-pattern: detail',
  ]) {
    assert.equal(parsePagePattern(fake + '\n' + body), null, fake)
    assert.throws(() => assertListPage('src/pages/new.ts', fake + '\n' + body, null, {}), /必须声明/)
  }
  assert.equal(parsePagePattern('// @page-pattern: list\nconst text = `模板 ${name}\n// @page-pattern: detail\n`'), 'list')
  assert.throws(() => parsePagePattern('// @page-pattern: list\n// @page-pattern: detail'), /重复/)
  assert.throws(() => parsePagePattern('// @page-pattern: list\n// @page-pattern: list'), /重复/)
  const noPagination = STANDARD_IMPORTS + 'export function renderListPage() { return renderStandardListPage({ tableHtml: renderStandardListTable({}) }) }'
  for (const fake of ['const tutorial = `\n// @list-pagination: none — 固定四项\n`', 'const tutorial = `标题 ${name}\n// @list-pagination: none — 固定四项\n`']) assert.equal(hasStandardListContract(fake + '\n' + noPagination), false)
  assert.equal(hasStandardListContract('// @list-pagination: none — 固定四项\n' + noPagination), true)
  assert.throws(() => hasStandardListContract('// @list-pagination: none — 固定四项\n// @list-pagination: none — 固定四项\n' + noPagination), /重复/)
})

test('worktree 显式任务范围仅验当前页面，忽略未选中的错误页面和基线篡改', () => withFixture((cwd, write) => {
  write(PAGE, COPY)
  write(RECORD, review().source)
  write('src/pages/unrelated.ts', BEFORE)
  write(BASELINE, JSON.stringify({ [PAGE]: sha256(COPY) }))
  const result = runListPageGovernance(['--scope', 'worktree', '--paths', `${PAGE},${RECORD}`], cwd)
  assert.deepEqual(result.checkedPaths, [PAGE])
  assert(result.excludedPaths.includes('src/pages/unrelated.ts'))
  assert.throws(() => runListPageGovernance(['--scope', 'worktree', '--paths', `${PAGE},${RECORD},${BASELINE}`], cwd), /基线哈希不得修改/)
}))

test('staged 检查源码与记录都来自暂存区，不受工作区后续修改影响', () => withFixture((cwd, write, git) => {
  write(PAGE, COPY)
  write(RECORD, review().source)
  git('add', '--', PAGE, RECORD)
  write(PAGE, COPY.replace('total * 2', 'total * 999'))
  write(RECORD, '工作区中的无效记录不能影响已暂存的完整证明')
  assert.deepEqual(runListPageGovernance([], cwd).checkedPaths, [PAGE])
}))

test('staged 中的行为改变不能用工作区已修正文案和记录掩盖', () => withFixture((cwd, write, git) => {
  const wrong = COPY.replace('total * 2', 'total * 999')
  write(PAGE, wrong)
  write(RECORD, review(BEFORE, wrong).source)
  git('add', '--', PAGE, RECORD)
  write(PAGE, COPY)
  write(RECORD, review().source)
  assert.throws(() => runListPageGovernance([], cwd), /无法证明仅为非结构/)
}))

test('branch 范围读取提交内容，base 范围与证据哈希一致', () => withFixture((cwd, write, git) => {
  const base = git('rev-parse', 'HEAD')
  write(PAGE, COPY)
  write(RECORD, review().source)
  git('add', '--', PAGE, RECORD)
  git('commit', '-qm', 'copy correction')
  write(PAGE, COPY.replace('total * 2', 'total * 999'))
  assert.deepEqual(runListPageGovernance(['--scope', 'branch', '--base', base, '--paths', `${PAGE},${RECORD}`], cwd).checkedPaths, [PAGE])
}))

test('运行检查不写回历史基线', () => withFixture((cwd, write) => {
  const baseline = readFileSync(join(cwd, BASELINE), 'utf8')
  write(PAGE, COPY)
  write(RECORD, review().source)
  runListPageGovernance(['--scope', 'worktree', '--paths', `${PAGE},${RECORD}`], cwd)
  assert.equal(readFileSync(join(cwd, BASELINE), 'utf8'), baseline)
}))

test('不能只移除未迁移页面的基线身份，迁移或删除后才可移除', () => withFixture((cwd, write) => {
  write(BASELINE, '{}')
  assert.throws(() => runListPageGovernance(['--scope', 'worktree', '--paths', BASELINE], cwd), /完成标准迁移/)
  const migrated = STANDARD_IMPORTS + '// @page-pattern: list\nexport function renderMigratedPage() { return renderStandardListPage({ tableHtml: renderStandardListTable({}), paginationHtml: renderTablePagination({}) }) }'
  write(PAGE, migrated)
  assert.throws(() => runListPageGovernance(['--scope', 'worktree', '--paths', BASELINE], cwd), /完成标准迁移/)
  assert.doesNotThrow(() => runListPageGovernance(['--scope', 'worktree', '--paths', `${PAGE},${BASELINE}`], cwd))
}))

test('新列表不能通过更改导出函数命名绕过声明及标准契约', () => withFixture((cwd, write) => {
  write('src/pages/new-list.ts', BEFORE.replace('renderLegacyPage', 'getSomethingElse'))
  assert.throws(() => runListPageGovernance(['--scope', 'worktree', '--paths', 'src/pages/new-list.ts'], cwd), /必须声明 @page-pattern/)
}))

test('特殊 CLI 参数必须单独使用，不能吞掉真实范围检查参数', () => {
  const script = fileURLToPath(new URL('../../scripts/check-list-page-governance.ts', import.meta.url))
  for (const flag of ['--self-test', '--write-baseline']) {
    assert.throws(() => execFileSync(process.execPath, ['--experimental-strip-types', script, '--scope', 'worktree', flag], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), (error: unknown) => {
      return /特殊参数必须单独使用/.test(String((error as { stderr?: unknown }).stderr))
    })
  }
})
