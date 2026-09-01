import assert from 'node:assert/strict'

import { menusBySystem } from '../src/data/app-shell-config.ts'
import {
  renderPcsFirstOrderSampleTaskDetailPage,
  renderPcsFirstOrderSampleTaskPage,
  renderPcsFirstSampleTaskDetailPage,
  renderPcsFirstSampleTaskPage,
  resetPcsEngineeringTaskState,
} from '../src/pages/pcs-engineering-tasks.ts'

resetPcsEngineeringTaskState()

const engineeringMenu = menusBySystem.pcs
  .flatMap((group) => group.items)
  .find((item) => item.key === 'pcs-menu-engineering')
assert.ok(engineeringMenu?.children)

const menuText = engineeringMenu.children.map((item) => `${item.title}:${item.href}`).join('\n')
assert.match(menuText, /首单样衣任务:\/pcs\/samples\/first-sample/)
assert.doesNotMatch(menuText, /首版样衣|产前版样衣|\/pcs\/samples\/first-order/)

const preProductionSampleHtml = renderPcsFirstSampleTaskPage()
assert.match(preProductionSampleHtml, /首单样衣任务/)
assert.doesNotMatch(preProductionSampleHtml, /首版样衣|产前版样衣|验收|复用/)

const retainedRouteAliasHtml = renderPcsFirstOrderSampleTaskPage()
assert.equal(retainedRouteAliasHtml, preProductionSampleHtml, '旧地址只能无文案地落到首单样衣任务')

const retainedRouteAliasDetailHtml = renderPcsFirstOrderSampleTaskDetailPage('missing-engineering-task')
assert.equal(
  retainedRouteAliasDetailHtml,
  renderPcsFirstSampleTaskDetailPage('missing-engineering-task'),
  '旧详情地址只能无文案地落到首单样衣任务详情',
)

console.log('pcs-engineering-page-boundary.spec.ts PASS')
