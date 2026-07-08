import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function read(path: string): string {
  assert.ok(existsSync(path), `${path} 不存在`)
  return readFileSync(path, 'utf8')
}

function assertNotIncludes(path: string, text: string, reason: string): void {
  assert.ok(!read(path).includes(text), reason)
}

function assertMissing(path: string): void {
  assert.ok(!existsSync(path), `${path} 应删除`)
}

const removedLabels = ['生产单计划', '状态管理', '交付仓配置']
const removedRoutes = ['/fcs/production/plan', '/fcs/production/status', '/fcs/production/delivery']
const removedFields = [
  'planStartDate',
  'planEndDate',
  'planStatus',
  'planQty',
  'planFactoryId',
  'planFactoryName',
  'planRemark',
  'planUpdatedAt',
  'planUpdatedBy',
  'deliveryWarehouseId',
  'deliveryWarehouseName',
  'deliveryWarehouseStatus',
  'deliveryWarehouseRemark',
  'deliveryWarehouseUpdatedAt',
  'deliveryWarehouseUpdatedBy',
  'lifecycleStatus',
  'lifecycleStatusRemark',
  'lifecycleUpdatedAt',
  'lifecycleUpdatedBy',
]
const removedActions = [
  'open-plan-edit',
  'save-plan-edit',
  'release-plan',
  'open-delivery-edit',
  'save-delivery-edit',
  'open-status-change',
  'save-status-change',
]

assertMissing('src/pages/production/plan-domain.ts')
assertMissing('src/pages/production/status-domain.ts')
assertMissing('src/pages/production/delivery-domain.ts')

for (const label of removedLabels) {
  assertNotIncludes('src/data/app-shell-config.ts', label, `菜单仍包含 ${label}`)
  assertNotIncludes('src/router/routes-fcs.ts', label, `路由仍包含 ${label}`)
}

for (const route of removedRoutes) {
  assertNotIncludes('src/data/app-shell-config.ts', route, `菜单仍包含 ${route}`)
  assertNotIncludes('src/router/routes-fcs.ts', route, `路由仍包含 ${route}`)
}

for (const field of removedFields) {
  assertNotIncludes('src/data/fcs/production-orders.ts', field, `生产单数据仍包含 ${field}`)
  assertNotIncludes('src/pages/production/context.ts', field, `生产上下文仍包含 ${field}`)
}

for (const action of removedActions) {
  assertNotIncludes('src/pages/production/events.ts', action, `生产事件仍包含 ${action}`)
}

for (const path of [
  'src/pages/print/templates/production-material-confirmation-template.ts',
  'src/pages/capacity.ts',
  'src/pages/production-order-progress-tracking.ts',
  'src/pages/production/detail-domain.ts',
  'src/components/production-object-overview.ts',
]) {
  for (const label of ['交付仓', '计划状态', '生命周期']) {
    assertNotIncludes(path, label, `${path} 仍展示 ${label}`)
  }
}

console.log('production order management cleanup check passed')
