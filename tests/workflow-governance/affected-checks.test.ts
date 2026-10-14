import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { routeAffectedChecks } from '../../scripts/workflow-governance/affected-checks.ts'
import { verificationCheckEnvironment } from '../../scripts/workflow-governance/check-execution.ts'

test('Caddy 发布工具路由到实际 Python 契约而非仅构建', () => {
  const result = routeAffectedChecks(['scripts/deploy/receiver.py', 'scripts/deploy/prepare-release.py', 'scripts/deploy/check-public.py', 'tests/deploy/test_receiver.py', 'tests/deploy/test_prepare.py', 'tests/deploy/test_network.py', 'deploy/network-initcwnd.py', 'deploy/higoods-network.service', 'deploy/higoods-network.timer'])
  assert.deepEqual(result.unknownPaths, [])
  assert.deepEqual(result.fastChecks, ['PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/deploy -v'])
  assert.deepEqual(result.fullChecks, [])
})

test('Caddy 运行和 Actions 配置核验发布契约、站点 JSON 与构建', () => {
  const result = routeAffectedChecks(['.github/workflows/deploy.yml', 'deploy/Caddyfile', 'deploy/sites.json', 'vercel.json'])
  assert.deepEqual(result.unknownPaths, [])
  assert(result.fastChecks.includes('PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/deploy -v'))
  assert(result.fastChecks.includes('python3 -m json.tool deploy/sites.json > /dev/null'))
  assert(result.fullChecks.includes('npm run build'))
})

test('未知发布测试仍升级，不能被目录前缀误判为已执行', () => {
  const result = routeAffectedChecks(['tests/deploy/unknown.test.py'])
  assert.deepEqual(result.unknownPaths, ['tests/deploy/unknown.test.py'])
})

test('补料页面路由到专项检查和原型治理', () => {
  const result = routeAffectedChecks([
    'src/pages/cutting/supplement-management.ts',
  ])

  assert(result.fastChecks.includes('npm run check:cutting-supplement-process-work-orders'))
  assert(result.governanceChecks.some((command) => command.startsWith('npm run check:prototype-design-governance -- --scope worktree --paths ')))
  assert(result.governanceChecks.some((command) => command.startsWith('npm run check:list-page-governance -- --scope worktree --paths ')))
})

test('裁片数据路由到裁床检查', () => {
  const result = routeAffectedChecks([
    'src/data/fcs/cutting-transfer-bags.ts',
  ])

  assert(result.fastChecks.includes('npm run check:cutting:all'))
  assert(result.governanceChecks.some((command) => command.startsWith('npm run check:prototype-design-governance -- --scope worktree --paths ')))
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

  assert(result.governanceChecks.some((command) => command.startsWith('npm run check:list-page-governance -- --scope worktree --paths ')))
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

  assert(result.governanceChecks.some((command) => command.startsWith('npm run check:prototype-design-governance -- --scope worktree --paths ')))
  assert(result.fullChecks.includes('npm run build'))
  assert(result.escalationReasons.some((reason) => reason.includes('未匹配专项检查')))
})

test('项目依赖清单单独变化仍升级构建', () => {
  const result = routeAffectedChecks(['package.json'])

  assert(result.fullChecks.includes('npm run build'))
  assert(result.escalationReasons.some((reason) => reason.includes('项目依赖或命令')))
})

test('毛织事实流变更必须绑定专项静态检查和真实独立服务 E2E 退出结果', () => {
  const result = routeAffectedChecks([
    'src/pages/process-factory/wool/work-orders.ts',
    'tests/wool-management-fact-workflow.spec.ts',
  ])

  assert(result.fastChecks.includes('npm run check:wool-fact-workflow'))
  assert(result.fullChecks.includes(
    'PLAYWRIGHT_REUSE_EXISTING_SERVER=false npm run test:wool-fact-workflow:e2e',
  ))
  assert(result.escalationReasons.some((reason) => reason.includes('毛织事实流')))
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

test('纯治理修改只跑治理契约，不自动运行业务构建', () => {
  const result = routeAffectedChecks(['scripts/workflow-governance/prototype-review.ts', 'tests/workflow-governance/prototype-review.test.ts'])
  assert(result.fastChecks.includes('npm run test:workflow-governance'))
  assert(result.governanceChecks.includes('npm run check:prototype-design-governance -- --self-test'))
  assert.deepEqual(result.fullChecks, [])
})

test('业务名称出现在文档路径中不触发业务测试', () => {
  const result = routeAffectedChecks(['docs/cutting-wool-adjustment.md', 'README.md'])
  assert.deepEqual([...result.fastChecks, ...result.governanceChecks, ...result.fullChecks], [])
})

test('单个时间夹具修复路由到实际单测，不凭裁床名称跑全业务', () => {
  const path = 'tests/unit/cutting-special-return.test.ts'
  const result = routeAffectedChecks([path])
  assert.deepEqual(result.fastChecks, [`if test -f '${path}'; then node --import tsx --test '${path}'; else npm run test:unit; fi`])
  assert.deepEqual(result.fullChecks, [])
})

test('未识别测试必须明确升级，不能误称已运行该测试', () => {
  const result = routeAffectedChecks(['tests/custom-runner/example.case.ts'])
  assert.deepEqual(result.unknownPaths, ['tests/custom-runner/example.case.ts'])
  assert(result.escalationReasons.some((reason) => reason.includes('不以构建替代')))
})

test('既有物料目录的八个node:test契约按实际文件路由，不被构建冒充', () => {
  const paths = ['pcs-material-cost-folding', 'pcs-r1-config-page', 'pcs-r1-config', 'pcs-r1-material-field-coverage', 'pcs-r1-material-rules', 'pcs-r1-material-template-gaps', 'pcs-r1-material-transfer', 'pcs-simple-material-downstream'].map(name => `tests/${name}.test.ts`)
  const result = routeAffectedChecks(paths)
  assert.deepEqual(result.unknownPaths, [])
  assert.equal(result.fastChecks.length, 8)
  for (const path of paths) assert(result.fastChecks.includes(`node --import tsx --test '${path}'`))
  assert.deepEqual(result.fullChecks, [])
})

test('分配专项配置及三个浏览器脚本绑定真实运行器，构建先于独立服务验收', () => {
  for (const path of [
    'tests/dispatch-assignment-granularity.config.ts',
    'tests/dispatch-assignment-granularity.spec.ts',
    'tests/dispatch-assignment-granularity-preview.spec.ts',
    'tests/fcs-unified-dispatch-preparation-return-preview.spec.ts',
  ]) {
    const result = routeAffectedChecks([path])
    assert.deepEqual(result.unknownPaths, [], path)
    assert.deepEqual(result.fullChecks, [
      'npm run build',
      'npx playwright test --config tests/dispatch-assignment-granularity.config.ts --workers=1 --reporter=line',
    ], path)
  }
})

test('退休分配测试必须实际删除并执行替代场景，不能恢复旧文件后跳过', () => {
  for (const path of ['tests/dispatch-board-assignment.spec.ts', 'tests/capacity-dynamic-status.spec.ts']) {
    const result = routeAffectedChecks([path])
    assert.deepEqual(result.unknownPaths, [], path)
    assert.deepEqual(result.fastChecks, [`test ! -e '${path}'`], path)
    assert(result.fullChecks.some(command => command.includes('dispatch-assignment-granularity.config.ts')), path)
    assert.equal(execFileSync('/bin/sh', ['-c', result.fastChecks[0]], { encoding: 'utf8' }), '')
    assert.throws(() => execFileSync('/bin/sh', ['-c', 'test ! -e tests/workflow-governance/affected-checks.test.ts'], { stdio: 'pipe' }))
  }
})

test('分配业务检查脚本绑定对应专项，不将未知文件误判为已验证', () => {
  const result = routeAffectedChecks([
    'scripts/check-fcs-dispatch-list-filters.ts',
    'scripts/check-fcs-sewing-preparation-return-preview.ts',
    'scripts/check-fcs-unified-assignment-foundation.ts',
    'scripts/check-sewing-outsourcing-task-boundary.ts',
  ])
  assert.deepEqual(result.unknownPaths, [])
  assert.equal(result.fastChecks.length, 4)
  assert.deepEqual(result.fullChecks, [])
  assert.deepEqual(routeAffectedChecks(['tests/dispatch-assignment-granularity-other.spec.ts']).unknownPaths, ['tests/dispatch-assignment-granularity-other.spec.ts'])
})

test('完整运行目录与 HTML 入口不能漏掉产品治理', () => {
  for (const path of ['src/main.ts', 'src/state/order.ts', 'src/domain/order.ts', 'src/utils/quantity.ts', 'src/styles/main.css', 'index.html']) {
    const result = routeAffectedChecks([path])
    assert(result.governanceChecks.includes(`npm run check:prototype-design-governance -- --scope worktree --paths '${path}'`), path)
  }
})

test('范围必须包含记录且不能回退整工作区', () => {
  const result = routeAffectedChecks(['src/pages/example.ts', 'docs/prototype-review-records/current.md'])
  const scope = "-- --scope worktree --paths 'docs/prototype-review-records/current.md,src/pages/example.ts'"
  assert(result.governanceChecks.includes(`npm run check:prototype-design-governance ${scope}`))
  assert(result.governanceChecks.includes(`npm run check:list-page-governance ${scope}`))
  assert(!result.governanceChecks.some((command) => command.includes('--all')))
})

test('治理工具名中的 cutting 不触发裁床全量或构建', () => {
  for (const path of ['scripts/workflow-governance/governance-scope.ts', 'scripts/workflow-governance/list-page-policy.ts', 'scripts/check-list-page-governance-suite.ts', 'scripts/check-cutting-p2-delivery.ts', 'tests/workflow-governance/list-page-policy.test.ts', 'tests/workflow-governance/governance-scope.test.ts', 'scripts/workflow-governance/cutting-rule.ts']) {
    const result = routeAffectedChecks([path])
    assert(result.fastChecks.includes('npm run test:workflow-governance'), path)
    assert(!result.fastChecks.includes('npm run check:cutting:all'), path)
    assert.deepEqual(result.unknownPaths, [], path)
    assert.deepEqual(result.fullChecks, [], path)
  }
})

test('五份文档与退休入口作为文档处理而非未知业务路径', () => {
  const paths = ['AGENTS.md', 'README.md', 'architecture.md', 'docs/prototype-review-record-template.md', 'docs/cutting-e2e.md', 'docs/INDEX.md', 'docs/standard-list-page-governance-setup.md', '.agents/skills/higood-indonesia-factory-design/SKILL.md', '.agents/skills/higood-indonesia-factory-design/references/product-design-guidelines.md', '.agents/skills/higood-indonesia-factory-design/agents/openai.yaml']
  const result = routeAffectedChecks(paths)
  assert.deepEqual(result.unknownPaths, [])
  assert.deepEqual(result.fullChecks, [])
  assert(!result.fastChecks.includes('npm run check:cutting:all'))
})


test('范围文件名中的引号、空格和命令替换仅作为文字传递', () => {
  const path = "src/pages/quoted'$(printf INJECTED)`printf OTHER` name.ts"
  const record = 'docs/prototype-review-records/current.md'
  const result = routeAffectedChecks([path, record])
  for (const command of result.governanceChecks) {
    const output = execFileSync('/bin/sh', ['-c', `set -- ${command}; printf '%s\\0' "$@"`], { encoding: 'utf8' })
    const args = output.split('\0').filter(Boolean)
    assert.deepEqual(args.slice(3), ['--', '--scope', 'worktree', '--paths', `${record},${path}`])
    assert(!args.includes('INJECTED'))
  }
})

test('不能准确表达的逗号文件名明确失败而非扩大检查范围', () => {
  assert.throws(() => routeAffectedChecks(['src/pages/has,comma.ts']), /无法精确传递任务范围/)
})

test('归一化和去重只处理传入路径，不吸收外部工作区', () => {
  const result = routeAffectedChecks(['./src/styles/main.css', 'src/styles/main.css', 'docs/prototype-review-records/current.md'])
  assert.deepEqual(result.changedPaths, ['docs/prototype-review-records/current.md', 'src/styles/main.css'])
  assert.deepEqual(result.governanceChecks, ["npm run check:prototype-design-governance -- --scope worktree --paths 'docs/prototype-review-records/current.md,src/styles/main.css'"])
})

test('列表治理工具也明确保留本次文件范围', () => {
  const result = routeAffectedChecks(['scripts/check-list-page-governance-suite.ts'])
  assert(result.governanceChecks.includes("npm run check:list-page-governance -- --scope worktree --paths 'scripts/check-list-page-governance-suite.ts'"))
  assert.deepEqual(result.fullChecks, [])
})


test('列表公共组件和事件入口保留独立运行验证', () => {
  for (const path of ['src/components/ui/list-table.ts', 'src/components/ui/list-page.ts', 'src/components/ui/list-table-model.ts', 'src/components/ui/list-export.ts', 'src/components/ui/list-feedback.ts', 'src/components/ui/pagination.ts', 'src/main.ts', 'src/main-handlers/fcs-handlers.ts']) {
    const result = routeAffectedChecks([path])
    assert(result.governanceChecks.includes('npm run check:standard-list-page-template'), path)
    assert(result.fullChecks.includes('npm run build'), path)
  }
})

test('列表检查器改动有独立运行验证但不扩大为业务构建', () => {
  const result = routeAffectedChecks(['scripts/check-standard-list-page-template.ts'])
  assert(result.governanceChecks.includes('npm run check:standard-list-page-template'))
  assert.deepEqual(result.fullChecks, [])
})

test('普通页面和轻量历史列表修正不隐式触发全列表运行测试', () => {
  const result = routeAffectedChecks(['src/pages/example.ts', 'docs/prototype-review-records/current.md'])
  assert(!result.governanceChecks.includes('npm run check:standard-list-page-template'))
})

for (const path of ['AGENTS.md', 'docs/prototype-review-record-template.md']) {
  test(`${path} 规则或模板变化触发治理闭环而非业务构建`, () => {
    const result = routeAffectedChecks([path])
    assert(result.fastChecks.includes('npm run test:workflow-governance'))
    assert(result.governanceChecks.includes('npm run check:prototype-design-governance -- --self-test'))
    assert.deepEqual(result.fullChecks, [])
    assert.deepEqual(result.unknownPaths, [])
  })
}

test('裁片手册变化只验证文档契约，不运行业务全量', () => {
  const result = routeAffectedChecks(['docs/cutting-e2e.md'])
  assert.deepEqual(result.fastChecks, ['node --experimental-strip-types --test tests/workflow-governance/cutting-documentation.test.ts'])
  assert.deepEqual(result.governanceChecks, [])
  assert.deepEqual(result.fullChecks, [])
})

test('README 架构与历史文档删除不触发治理全套', () => {
  const result = routeAffectedChecks(['README.md', 'architecture.md', 'docs/INDEX.md', 'docs/standard-list-page-governance-setup.md'])
  assert.deepEqual([...result.fastChecks, ...result.governanceChecks, ...result.fullChecks], [])
})


test('PCS simple browser contracts reuse only hash-verified final evidence, including retired category entrance', () => {
  for (const name of ['adversarial','config','copy-identity','dossier','downstream','import','long-label','materials','list-entry','category-usage']) {
    const route = routeAffectedChecks([`tests/browser-contracts/pcs-simple-${name}.test.ts`])
    assert(route.fastChecks.includes('node --import tsx scripts/check-pcs-simple-browser-evidence.ts'))
    assert.deepEqual(route.unknownPaths, [])
    assert.deepEqual(route.fullChecks, [])
  }
  assert.deepEqual(routeAffectedChecks(['tests/browser-contracts/pcs-simple-future.test.ts']).unknownPaths, ['tests/browser-contracts/pcs-simple-future.test.ts'])
})
test('BOM version workflow is an actual Node assert script', () => {
  const route = routeAffectedChecks(['tests/pcs-engineering-bom-version-workflow.spec.ts'])
  assert.deepEqual(route.fastChecks, ['node --import tsx tests/pcs-engineering-bom-version-workflow.spec.ts'])
  assert.deepEqual(route.unknownPaths, [])
  assert.deepEqual(route.fullChecks, [])
})

test('material archive tab contract executes the real scoped browser runner', () => {
  const route = routeAffectedChecks(['tests/browser-contracts/pcs-material-archive-tabs.test.ts'])
  assert.deepEqual(route.fastChecks, ['node --import tsx --test tests/browser-contracts/pcs-material-archive-tabs.test.ts'])
  assert.deepEqual(route.unknownPaths, [])
  assert.deepEqual(route.fullChecks, [])
})

test('factory material plan source snapshot contract executes its Node tests', () => {
  const route = routeAffectedChecks(['tests/pcs-r1-material-plans.test.ts'])
  assert.deepEqual(route.fastChecks, ['node --import tsx --test tests/pcs-r1-material-plans.test.ts'])
  assert.deepEqual(route.unknownPaths, [])
  assert.deepEqual(route.fullChecks, [])
})

test('product reference deletion contracts execute their real Node runners', () => {
  for (const path of ['tests/pcs-r1-product-rules.test.ts', 'tests/browser-contracts/pcs-product-reference-removal.test.ts']) {
    const route = routeAffectedChecks([path])
    assert.deepEqual(route.fastChecks, [`node --import tsx --test '${path}'`])
    assert.deepEqual(route.unknownPaths, [])
    assert.deepEqual(route.fullChecks, [])
  }
})


test('冻结工作树基线只传给当前任务范围门禁，不污染临时仓库测试或构建', () => {
  const inherited = { GOVERNANCE_BASE_SHA: 'stale-ref', KEEP: 'yes' }
  for (const command of ['npm run test:workflow-governance', 'npm test', 'npm run build']) {
    assert.deepEqual(verificationCheckEnvironment('abc123', inherited, command), { KEEP: 'yes' })
  }
  const environment = verificationCheckEnvironment('abc123', inherited, 'npm run check:list-page-governance -- --scope worktree --paths src/pages/example.ts')
  assert.equal(environment.GOVERNANCE_BASE_SHA, 'abc123')
  assert.equal(environment.KEEP, 'yes')
  assert.equal(inherited.GOVERNANCE_BASE_SHA, 'stale-ref')
})

test('后道两项 Native 变更绑定真实独立服务 E2E，其他未知测试仍阻断', () => {
  const known = ['tests/post-finishing-full-flow.spec.ts', 'tests/post-finishing-full-flow-cross-terminal.spec.ts']
  const expected = 'PLAYWRIGHT_REUSE_EXISTING_SERVER=false npm run test:e2e -- tests/post-finishing-full-flow.spec.ts tests/post-finishing-full-flow-cross-terminal.spec.ts --workers=1 --reporter=json'
  for (const path of known) {
    const result = routeAffectedChecks([path])
    assert.deepEqual(result.unknownPaths, [])
    assert(result.fullChecks.includes(expected))
  }
  const result = routeAffectedChecks([...known, 'tests/unregistered-post-finishing.spec.ts'])
  assert.deepEqual(result.unknownPaths, ['tests/unregistered-post-finishing.spec.ts'])
  assert.equal(result.fullChecks.filter((command) => command === expected).length, 1)
})


test('PMS cold browser test selects the executed six-suite aggregate without an unknown runner', () => {
  const result = routeAffectedChecks(['tests/pms-cold-load.spec.ts'])
  assert.deepEqual(result.unknownPaths, [])
  assert.equal(result.fullChecks.length, 1)
  const command = result.fullChecks[0]
  for (const name of ['cold-load','purchase-chain','material-flow','master-data','settlement-flow','peripheral']) assert(command.includes(`tests/pms-${name}.spec.ts`))
  assert(command.includes('CUTTING_E2E_USE_PREVIEW=true PLAYWRIGHT_REUSE_EXISTING_SERVER=false'))
  assert(command.endsWith('--workers=1 --reporter=line'))
})

test('shared PMS memory IDB fixture runs npm test for all real unit consumers', () => {
  const result = routeAffectedChecks(['tests/helpers/pms-memory-idb.ts'])
  assert.deepEqual(result.unknownPaths, [])
  assert.deepEqual(result.fastChecks, ['npm test'])
  assert.deepEqual(result.fullChecks, [])
  assert.deepEqual(routeAffectedChecks(['tests/helpers/unregistered-idb.ts']).unknownPaths, ['tests/helpers/unregistered-idb.ts'])
})

test('legacy PMS audit and screenshot route-only retirement selects its explicit source contract', () => {
  const paths = ['tests/pms-interaction-audit.spec.ts', 'tests/pms-style-screenshots.spec.ts']
  const result = routeAffectedChecks(paths)
  assert.deepEqual(result.unknownPaths, [])
  assert.deepEqual(result.fastChecks, ['node --experimental-strip-types --test tests/workflow-governance/pms-retired-test-routes.test.ts'])
  assert.deepEqual(result.fullChecks, [])
  // A similarly named future browser test remains unregistered and blocks the receipt.
  assert.deepEqual(routeAffectedChecks([...paths, 'tests/pms-future-audit.spec.ts']).unknownPaths, ['tests/pms-future-audit.spec.ts'])
  const governance = routeAffectedChecks(['tests/workflow-governance/pms-retired-test-routes.test.ts'])
  assert(governance.fastChecks.includes('npm run test:workflow-governance'))
  assert.deepEqual(governance.unknownPaths, [])
})
