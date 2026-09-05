import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isProductionConfirmationPrintPath,
  isRouteAtOrBelow,
  isRouteAtOrBelowAny,
  normalizeRoutePathname,
} from '../../src/router/path-match.ts'

test('路由标准化移除 query 与 hash，但不改动路径', () => {
  assert.equal(
    normalizeRoutePathname('/fcs/craft/post-finishing/orders?tab=pending#detail'),
    '/fcs/craft/post-finishing/orders',
  )
})

test('只匹配路由根或其子路径，不误匹配相似前缀', () => {
  assert.equal(isRouteAtOrBelow('/fcs/craft/post-finishing', '/fcs/craft/post-finishing'), true)
  assert.equal(isRouteAtOrBelow('/fcs/craft/post-finishing/orders', '/fcs/craft/post-finishing'), true)
  assert.equal(isRouteAtOrBelow('/fcs/craft/post-finishing-old', '/fcs/craft/post-finishing'), false)
})

test('可在多个合法根路径中匹配一个', () => {
  const roots = ['/fcs/process-factory/special-craft', '/fcs/craft/special-craft'] as const
  assert.equal(isRouteAtOrBelowAny('/fcs/craft/special-craft/tasks?status=pending', roots), true)
  assert.equal(isRouteAtOrBelowAny('/fcs/craft/special-crafts/tasks', roots), false)
})

test('只把完整生产确认单打印路由识别为命中', () => {
  assert.equal(isProductionConfirmationPrintPath('/fcs/production/orders/PO-001/confirmation-print?preview=1'), true)
  assert.equal(isProductionConfirmationPrintPath('/fcs/production/orders/PO-001/confirmation-print/'), true)
  assert.equal(isProductionConfirmationPrintPath('/fcs/production/orders/PO-001/confirmation-print-preview'), false)
  assert.equal(isProductionConfirmationPrintPath('/fcs/production/orders/PO-001/confirmation-print/extra'), false)
})
