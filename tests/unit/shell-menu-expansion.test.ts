import assert from 'node:assert/strict'
import test from 'node:test'

import { renderSidebar } from '../../src/components/shell.ts'
import { menusBySystem } from '../../src/data/app-shell-config.ts'
import { appStore } from '../../src/state/store.ts'

test('当前子页面的父菜单首次自动展开，一次点击即可收起并能再次展开', (t) => {
  const original = structuredClone(appStore.getState())
  t.after(() => Object.assign(appStore.getState(), original))

  for (const groups of Object.values(menusBySystem)) {
    for (const item of groups.flatMap((group) => group.items)) {
      const child = item.children?.find((entry) => entry.href)
      if (!child) continue

      appStore.navigate(`${child.href}?menu-check=1#active`)
      appStore.getState().expandedItems = {}
      const childSelector = `data-tab-key="${child.key}"`
      assert.ok(renderSidebar(appStore.getState()).includes(childSelector), `${item.title} 默认展开`)

      appStore.toggleItem(item.key)
      assert.equal(appStore.getState().expandedItems[item.key], false, `${item.title} 首次点击收起`)
      assert.ok(!renderSidebar(appStore.getState()).includes(childSelector), `${item.title} 隐藏子菜单`)
      assert.equal(appStore.getState().pathname, `${child.href}?menu-check=1#active`)

      appStore.toggleItem(item.key)
      assert.equal(appStore.getState().expandedItems[item.key], true, `${item.title} 再次展开`)
      assert.ok(renderSidebar(appStore.getState()).includes(childSelector), `${item.title} 恢复子菜单`)
    }
  }
})

test('非当前页面的菜单默认收起，手动展开和收起不改变页面', (t) => {
  const original = structuredClone(appStore.getState())
  t.after(() => Object.assign(appStore.getState(), original))
  appStore.navigate('/pcs/products/styles')
  appStore.getState().expandedItems = {}
  const childSelector = 'data-tab-key="pcs-config-workspace"'

  assert.ok(!renderSidebar(appStore.getState()).includes(childSelector))
  appStore.toggleItem('pcs-menu-settings')
  assert.ok(renderSidebar(appStore.getState()).includes(childSelector))
  appStore.toggleItem('pcs-menu-settings')
  assert.ok(!renderSidebar(appStore.getState()).includes(childSelector))
  assert.equal(appStore.getState().pathname, '/pcs/products/styles')
})
