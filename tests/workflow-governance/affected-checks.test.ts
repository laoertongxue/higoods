import assert from 'node:assert/strict'
import test from 'node:test'
import { routeAffectedChecks } from '../../scripts/workflow-governance/affected-checks.ts'

test('补料页面路由到专项检查和原型治理', () => {
  const result = routeAffectedChecks([
    'src/pages/cutting/supplement-management.ts',
  ])

  assert(result.fastChecks.includes('npm run check:cutting-supplement-process-work-orders'))
  assert(result.governanceChecks.includes('npm run check:prototype-design-governance -- --all'))
  assert(result.governanceChecks.includes('npm run check:list-page-governance'))
})

test('裁片数据路由到裁床检查', () => {
  const result = routeAffectedChecks([
    'src/data/fcs/cutting-transfer-bags.ts',
  ])

  assert(result.fastChecks.includes('npm run check:cutting:all'))
  assert(result.governanceChecks.includes('npm run check:prototype-design-governance -- --all'))
})

test('主处理器变更升级到端到端检查和构建', () => {
  const result = routeAffectedChecks([
    'src/main-handlers/fcs-handlers.ts',
  ])

  assert(result.fastChecks.includes('npm run check:fcs-end-to-end'))
  assert(result.fullChecks.includes('npm run build'))
  assert(result.escalationReasons.some((reason) => reason.includes('主处理器')))
})

test('列表公共组件路由到列表治理并升级构建', () => {
  const result = routeAffectedChecks([
    'src/components/ui/list-table.ts',
  ])

  assert(result.governanceChecks.includes('npm run check:list-page-governance'))
  assert(result.fullChecks.includes('npm run build'))
})

test('未知路径不会静默跳过而是升级完整检查', () => {
  const result = routeAffectedChecks([
    'tools/unknown-generator.ts',
  ])

  assert.deepEqual(result.unknownPaths, ['tools/unknown-generator.ts'])
  assert(result.fullChecks.includes('npm run build'))
  assert(result.escalationReasons.some((reason) => reason.includes('未知路径')))
})
