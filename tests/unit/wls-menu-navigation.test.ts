import assert from 'node:assert/strict'
import test from 'node:test'

import { menusBySystem, systems } from '../../src/data/app-shell-config.ts'
import type { MenuItem } from '../../src/data/app-shell-types.ts'
import { shellIcons } from '../../src/icons/shell-icons.ts'

function flattenItems(items: MenuItem[]): MenuItem[] {
  return items.flatMap((item) => [item, ...flattenItems(item.children ?? [])])
}

test('WLS 面料需求看板保留唯一身份、地址和默认入口，归入库存管理', () => {
  const groups = menusBySystem.wls
  const boardEntries = groups.flatMap((group) =>
    flattenItems(group.items)
      .filter((item) => item.key === 'wls-fabric-demand-board')
      .map((item) => ({ group, item })),
  )

  assert.equal(boardEntries.length, 1)
  const [{ group, item }] = boardEntries
  assert.equal(group.title, '库存管理')
  assert.equal(item.title, '面料需求看板列表')
  assert.equal(item.href, '/wls/fabric-demand-board')
  assert.equal(systems.find((system) => system.id === 'wls')?.defaultPage, item.href)
  assert.equal(groups.find((entry) => entry.title === '生产配料管理')?.items.some((entry) => entry.key === item.key) ?? false, false)
})

test('WLS 所有分组、菜单和嵌套菜单都声明可解析的实际图标', () => {
  const nodes = menusBySystem.wls.flatMap((group) => [group, ...flattenItems(group.items)])
  const registeredIcons: Record<string, unknown> = shellIcons

  assert.ok(nodes.length > 0)
  for (const node of nodes) {
    assert.ok(node.icon, `${node.title} 缺少图标`)
    assert.ok(registeredIcons[node.icon], `${node.title} 的图标 ${node.icon} 未注册`)
    assert.ok(Array.isArray(registeredIcons[node.icon]), `${node.title} 没有实际 SVG 图元`)
  }
})

test('WLS 主要收发、库存、仓位和盘点动作使用区分语义的图标', () => {
  const items = flattenItems(menusBySystem.wls.flatMap((group) => group.items))
  const expected = {
    'wls-finished-putaway': 'PackageCheck',
    'wls-finished-stock-realtime': 'Archive',
    'wls-finished-stock-flow': 'History',
    'wls-finished-stock-location': 'MapPin',
    'wls-finished-stock-transfer': 'ArrowLeftRight',
    'wls-finished-stock-inventory-count': 'ClipboardCheck',
    'wls-online-scan-pick': 'ScanLine',
    'wls-online-print-collect': 'Printer',
  }

  for (const [key, icon] of Object.entries(expected)) {
    assert.equal(items.find((item) => item.key === key)?.icon, icon, key)
  }
})
