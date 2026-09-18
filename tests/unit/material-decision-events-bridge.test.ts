import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as bridge from '../../src/pages/material-decision/events-bridge'

// Load the actual route registration with small business-handler doubles; importing
// the bridge must not initialize the material data or require a browser document.
const routeCode = ts.transpileModule(readFileSync(new URL('../../src/pages/material-decision/index.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
function target(selectors: string[] = [], prepAction?: string): HTMLElement {
  return { closest(selector: string) { return selectors.includes(selector) ? { dataset: { mdPrepAction: prepAction } } : null } } as unknown as HTMLElement
}
function loadRoute(failDependency = false) {
  const calls: string[] = [], handled = new Set<string>()
  const ui = { role: '物料计划员', stale: false }, feedback = { textContent: '' }
  const handler = (name: string) => () => { calls.push(name); return handled.has(name) }
  const dependencies: Record<string, object> = {
    './events-bridge': bridge,
    './events': {
      ui, enter: (section: string) => { calls.push(`enter:${section}`); return 'first page content' },
      handleMaterialDecisionClick: handler('generic'), handleMaterialDecisionInput: handler('input'),
      handleMaterialDecisionChange: handler('change'), handleMaterialDecisionKey: handler('key'),
    },
    './health': { handleHealthClick: handler('health') },
    './warnings': { handleWarningsClick: handler('warnings'), handleWarningsChange: handler('warnings-change') },
    './daily': { handleDailyClick: handler('daily') },
    './preparation': { handlePreparationClick: handler('preparation'), handlePreparationChange: handler('preparation-change') },
    './processing': { handleProcessingClick: handler('processing') },
    './packaging': { handlePackagingClick: handler('packaging') },
    './views': { sections: { overview: true }, businessSections: { preparation: true } },
  }
  const exports: { renderMaterialDecisionPage?: (path: string) => string } = {}
  runInNewContext(routeCode, {
    exports, document: { querySelector: () => feedback },
    require(path: string) { if (failDependency && path === './views') throw new Error('load interrupted'); assert(path in dependencies); return dependencies[path] },
  })
  return { calls, handled, ui, feedback, render: exports.renderMaterialDecisionPage! }
}

test('未进入物料页面时 bridge 不加载业务；加载失败重试后首次渲染即已注册', () => {
  const plain = target(), event = { key: 'Escape' } as KeyboardEvent
  assert.equal(bridge.dispatchMaterialDecisionClick(plain), false)
  assert.equal(bridge.dispatchMaterialDecisionInput(plain), false)
  assert.equal(bridge.dispatchMaterialDecisionChange(plain), false)
  assert.equal(bridge.dispatchMaterialDecisionKey(event), false)
  assert.throws(() => loadRoute(true), /load interrupted/)
  assert.equal(bridge.dispatchMaterialDecisionClick(plain), false)
  const route = loadRoute(); route.handled.add('health')
  assert.match(route.render('/dds/supply-chain/materials/overview'), /first page content/)
  assert.equal(bridge.dispatchMaterialDecisionClick(plain), true)
  assert.deepEqual(route.calls, ['enter:overview', 'health'])
})

test('click 分组顺序、短路、选择器范围保持原行为，重新注册替换旧处理器', () => {
  const route = loadRoute()
  const all = target(['[data-md-processing-action]', '[data-md-packaging-action]', '[data-md-action]'])
  assert.equal(bridge.dispatchMaterialDecisionClick(all), false)
  assert.deepEqual(route.calls, ['health', 'warnings', 'daily', 'preparation', 'processing', 'packaging', 'generic'])
  route.calls.length = 0; route.handled.add('daily')
  assert.equal(bridge.dispatchMaterialDecisionClick(all), true)
  assert.deepEqual(route.calls, ['health', 'warnings', 'daily'])
  const next = loadRoute(); next.handled.add('generic')
  assert.equal(bridge.dispatchMaterialDecisionClick(target()), false)
  assert.deepEqual(next.calls, ['health', 'warnings', 'daily', 'preparation'])
  assert.equal(bridge.dispatchMaterialDecisionClick(target(['[data-md-action]'])), true)
})

test('备料写入守卫读取实时角色与水位，阻断时不调用业务处理器', () => {
  const route = loadRoute(); route.handled.add('preparation'); route.ui.role = '只读查看者'
  for (const action of ['add','edit','save','generate','raw-receive','produce','receive','cancel-record']) {
    assert.equal(bridge.dispatchMaterialDecisionClick(target(['[data-md-prep-action]'], action)), true)
    assert.equal(route.feedback.textContent, '只读查看者不能修改备料记录')
    assert.deepEqual(route.calls, [])
  }
  route.ui.role = '物料计划员'; route.ui.stale = true
  assert.equal(bridge.dispatchMaterialDecisionClick(target(['[data-md-prep-action]'], 'save')), true)
  assert.equal(route.feedback.textContent, '数据已过期，禁止执行备料建议')
  assert.deepEqual(route.calls, [])
  route.ui.stale = false
  assert.equal(bridge.dispatchMaterialDecisionClick(target(['[data-md-prep-action]'], 'save')), true)
  assert.deepEqual(route.calls, ['health', 'warnings', 'daily', 'preparation'])
  route.calls.length = 0; route.ui.role = '只读查看者'
  assert.equal(bridge.dispatchMaterialDecisionClick(target(['[data-md-prep-action]'], 'view')), true)
  assert.deepEqual(route.calls, ['health', 'warnings', 'daily', 'preparation'])
})

test('input/change/keyboard 原入口、筛选范围和 change 优先级完整保留', () => {
  const route = loadRoute(), field = target(['[data-md-field]'])
  route.handled.add('input'); route.handled.add('change'); route.handled.add('key')
  assert.equal(bridge.dispatchMaterialDecisionInput(target()), false)
  assert.equal(bridge.dispatchMaterialDecisionInput(field), true)
  assert.equal(bridge.dispatchMaterialDecisionChange(field), true)
  assert.equal(bridge.dispatchMaterialDecisionKey({ key: 'Escape' } as KeyboardEvent), true)
  assert.deepEqual(route.calls, ['input', 'preparation-change', 'warnings-change', 'change', 'key'])
  route.calls.length = 0; route.handled.add('preparation-change')
  assert.equal(bridge.dispatchMaterialDecisionChange(field), true)
  assert.deepEqual(route.calls, ['preparation-change'])
})
