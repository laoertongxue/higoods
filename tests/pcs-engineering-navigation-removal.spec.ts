import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const menuSource = readFileSync('src/data/app-shell-config.ts', 'utf8')
const routeSource = readFileSync('src/router/routes-pcs.ts', 'utf8')
const handlerSource = readFileSync('src/main-handlers/pcs-handlers.ts', 'utf8')

assert.doesNotMatch(menuSource, /我的工程任务/, '生产工程菜单必须彻底删除“我的工程任务”')
assert.doesNotMatch(routeSource, /['"]\/pcs\/patterns['"]\s*:/, '不得保留 /pcs/patterns 制版别名')
assert.doesNotMatch(routeSource, /\^\\\/pcs\\\/patterns\\\/\(\[\^\/\]\+\)/, '不得保留 /pcs/patterns/:id 动态别名')
assert.doesNotMatch(handlerSource, /['"]\/pcs\/patterns['"]\s*,/, '事件处理不得继续使用 /pcs/patterns 泛入口')

for (const required of [
  ['设计改款任务', '/pcs/engineering/design-revision'],
  ['制版任务', '/pcs/patterns/plate-making'],
  ['花型任务', '/pcs/patterns/artwork'],
  ['调色任务', '/pcs/engineering/color'],
  ['辅料下单任务', '/pcs/engineering/purchase'],
  ['技术包确认任务', '/pcs/engineering/tech-pack'],
  ['首单样衣任务', '/pcs/samples/first-sample'],
]) {
  assert.ok(menuSource.includes(required[0]) && menuSource.includes(required[1]), `生产工程菜单缺少 ${required[0]} 规范入口`)
}

assert.doesNotMatch(menuSource, /工程变更|改款打样任务|设计打样任务/, '生产工程菜单不得保留已删除入口')
assert.doesNotMatch(routeSource, /engineering\/changes|revision-sampling|design-sampling/, '路由不得兼容已删除入口')

for (const required of ['技术资料', '技术包', 'BOM 与价格', '花型库', '部位模板库']) {
  assert.ok(menuSource.includes(required), `技术资料菜单缺少 ${required}`)
}

for (const route of [
  '/pcs/technical-data/tech-packs',
  '/pcs/technical-data/bom-pricing',
]) {
  assert.ok(routeSource.includes(route), `技术资料入口缺少路由接线：${route}`)
}

assert.doesNotMatch(menuSource, /技术包模板库|pcs-tech-pack-template-library/, '不得保留误建的技术包模板库菜单')
assert.doesNotMatch(routeSource, /\/pcs\/technical-data\/tech-pack-templates/, '不得保留误建的技术包模板库路由')

console.log('pcs engineering navigation removal tests passed')
