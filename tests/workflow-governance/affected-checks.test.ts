import assert from 'node:assert/strict'
import test from 'node:test'
import { routeAffectedChecks } from '../../scripts/workflow-governance/affected-checks.ts'
import { verificationCheckEnvironment } from '../../scripts/workflow-governance/check-execution.ts'

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

test('未命中专项规则的原型组件仍升级构建', () => {
  const result = routeAffectedChecks(['src/components/ui/button.ts'])

  assert(result.governanceChecks.includes('npm run check:prototype-design-governance -- --all'))
  assert(result.fullChecks.includes('npm run build'))
  assert(result.escalationReasons.some((reason) => reason.includes('未匹配专项检查')))
})

test('项目依赖清单单独变化仍升级构建', () => {
  const result = routeAffectedChecks(['package.json'])

  assert(result.fullChecks.includes('npm run build'))
  assert(result.escalationReasons.some((reason) => reason.includes('项目依赖或命令')))
})

test('领域关键词不会吞掉路由、主处理器和治理脚本的结构性检查', () => {
  const result = routeAffectedChecks([
    'src/router/cutting.ts',
    'src/main-handlers/cutting-handlers.ts',
    'scripts/workflow-governance/cutting-rule.ts',
  ])

  assert(result.fastChecks.includes('npm run check:cutting:all'))
  assert(result.fastChecks.includes('npm run check:menu-routes'))
  assert(result.fastChecks.includes('npm run check:fcs-end-to-end'))
  assert(result.fastChecks.includes('npm run test:workflow-governance'))
  assert(result.fullChecks.includes('npm run build'))
})

test('冻结基线通过环境传递给原型治理子检查', () => {
  const environment = verificationCheckEnvironment('abc123', { EXISTING: 'yes' })

  assert.equal(environment.GOVERNANCE_BASE_SHA, 'abc123')
  assert.equal(environment.EXISTING, 'yes')
})
