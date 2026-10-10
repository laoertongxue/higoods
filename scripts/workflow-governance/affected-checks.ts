import assert from 'node:assert/strict'
import { normalizeChangedPath } from './changed-paths.ts'
import { isPrototypePath } from './governance-scope.ts'

export interface AffectedCheckRoute {
  changedPaths: string[]
  fastChecks: string[]
  governanceChecks: string[]
  fullChecks: string[]
  unknownPaths: string[]
  escalationReasons: string[]
}

const LIST_GOVERNANCE_TOOLS = new Set([
  'scripts/check-list-page-governance.ts',
  'scripts/check-list-page-governance-suite.ts',
  'scripts/check-standard-list-page-template.ts',
  'scripts/workflow-governance/list-page-policy.ts',
])

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function taskScope(command: string, paths: string[]): string {
  assert(paths.every((path) => !path.includes(',')), '--paths 使用逗号分隔，当前变更含逗号文件名，无法精确传递任务范围')
  return `${command} -- --scope worktree --paths ${shellQuote(paths.join(','))}`
}

function add(target: Set<string>, command: string): void {
  target.add(command)
}

export function routeAffectedChecks(paths: string[]): AffectedCheckRoute {
  const changedPaths = [...new Set(paths.map(normalizeChangedPath).filter(Boolean))].sort()
  const fastChecks = new Set<string>()
  const governanceChecks = new Set<string>()
  const fullChecks = new Set<string>()
  const unknownPaths: string[] = []
  const escalationReasons = new Set<string>()

  for (const path of changedPaths) {
    // Rule and template edits change governance behavior even without runtime product code.
    if (path === 'AGENTS.md' || path === 'docs/prototype-review-record-template.md') {
      add(fastChecks, 'npm run test:workflow-governance')
      add(governanceChecks, 'npm run check:prototype-design-governance -- --self-test')
      continue
    }
    if (path === 'docs/cutting-e2e.md') {
      add(fastChecks, 'node --experimental-strip-types --test tests/workflow-governance/cutting-documentation.test.ts')
      continue
    }
    // Documents do not execute the domain mentioned in their filename.
    if (
      path.startsWith('docs/')
      || ['README.md', 'architecture.md'].includes(path)
      || path.startsWith('.agents/skills/higood-indonesia-factory-design/')
    ) continue

    // Governance tools validate governance contracts, regardless of business words in filenames.
    if (
      path === 'scripts/check-prototype-design-governance.ts'
      || path === 'scripts/check-cutting-p2-delivery.ts'
      || path === 'scripts/task-completion-receipt.ts'
      || path === 'scripts/record-workflow-stage.ts'
      || LIST_GOVERNANCE_TOOLS.has(path)
      || path.startsWith('scripts/workflow-governance/')
      || path.startsWith('tests/workflow-governance/')
    ) {
      add(fastChecks, 'npm run test:workflow-governance')
      add(governanceChecks, 'npm run check:prototype-design-governance -- --self-test')
      if (LIST_GOVERNANCE_TOOLS.has(path) || /list-page-policy|list-page-governance/.test(path)) {
        add(fastChecks, 'npm run check:list-page-governance:static -- --self-test')
        add(governanceChecks, 'npm run check:standard-list-page-template')
        add(governanceChecks, taskScope('npm run check:list-page-governance', changedPaths))
      }
      continue
    }
    if (/^tests\/unit\/.+\.test\.ts$/.test(path)) {
      const quotedPath = `'${path.replace(/'/g, "'\\''")}'`
      add(fastChecks, `if test -f ${quotedPath}; then node --import tsx --test ${quotedPath}; else npm run test:unit; fi`)
      continue
    }
    let handled = false
    const isPrototype = isPrototypePath(path)
    if (isPrototype) {
      add(governanceChecks, taskScope('npm run check:prototype-design-governance', changedPaths))
    }

    if (path.startsWith('src/pages/')) {
      add(governanceChecks, taskScope('npm run check:list-page-governance', changedPaths))
    }

    if (
      path.startsWith('src/pages/pms/')
      || path.startsWith('src/data/pms/')
      || path === 'src/router/routes-pms.ts'
      || path === 'src/router/route-renderers-pms.ts'
      || path === 'src/main-handlers/pms-handlers.ts'
      || path === 'src/utils/pms-export.ts'
      || path === 'src/utils/pms-excel-import.ts'
    ) {
      add(fastChecks, 'npm run check:pms-purchase-chain')
      handled = true
    }

    if (path === 'scripts/check-pms-purchase-chain.ts' || path.startsWith('tests/unit/pms-')) {
      add(fastChecks, path.startsWith('tests/unit/pms-') ? 'npm test' : 'npm run check:pms-purchase-chain')
      handled = true
    }

    if (
      path === 'tests/pms-purchase-chain.spec.ts'
      || path === 'tests/pms-material-flow.spec.ts'
      || path === 'tests/pms-master-data.spec.ts'
      || path === 'tests/pms-settlement-flow.spec.ts'
      || path === 'tests/pms-peripheral.spec.ts'
    ) {
      add(fullChecks, 'CUTTING_E2E_USE_PREVIEW=true PLAYWRIGHT_REUSE_EXISTING_SERVER=false npx playwright test tests/pms-cold-load.spec.ts tests/pms-purchase-chain.spec.ts tests/pms-material-flow.spec.ts tests/pms-master-data.spec.ts tests/pms-settlement-flow.spec.ts tests/pms-peripheral.spec.ts --workers=1 --reporter=line')
      handled = true
    }

    if (path === 'scripts/check-menu-routes.mjs' || path === 'src/main.ts') {
      add(fastChecks, path === 'src/main.ts' ? 'npm run check:fcs-end-to-end' : 'npm run check:menu-routes')
      add(fullChecks, 'npm run build')
      escalationReasons.add(path === 'src/main.ts' ? '主入口变化需要端到端检查和构建' : '菜单路由检查脚本变化需要检查和构建')
      handled = true
    }

    if (path === 'scripts/check-lace-factory-management.ts') {
      add(fastChecks, 'npm run check:lace-factory-management')
      handled = true
    }

    if (path === 'src/router/routes-pms.ts' || path === 'src/router/route-renderers-pms.ts') {
      add(fastChecks, 'npm run check:menu-routes')
      handled = true
    }

    if (/supplement|补料/i.test(path)) {
      add(fastChecks, 'npm run check:cutting-supplement-process-work-orders')
      handled = true
    }

    if (/cutting|cut-piece|transfer-bag|fei-ticket/i.test(path)) {
      add(fastChecks, 'npm run check:cutting:all')
      handled = true
    }

    if (
      /(?:^|\/)wool(?:\/|-)/i.test(path)
      || path === 'tests/wool-management-fact-workflow.spec.ts'
      || path === 'scripts/check-wool-fact-workflow.ts'
    ) {
      add(fastChecks, 'npm run check:wool-fact-workflow')
      add(
        fullChecks,
        'PLAYWRIGHT_REUSE_EXISTING_SERVER=false npm run test:wool-fact-workflow:e2e',
      )
      escalationReasons.add('毛织事实流变更必须绑定真实独立服务 E2E 退出结果')
      handled = true
    }

    if (path.startsWith('src/router/')) {
      add(fastChecks, 'npm run check:menu-routes')
      add(fullChecks, 'npm run build')
      escalationReasons.add('路由结构变化需要构建验证')
      handled = true
    }

    if (path.startsWith('src/main-handlers/')) {
      add(fastChecks, 'npm run check:fcs-end-to-end')
      add(fullChecks, 'npm run build')
      escalationReasons.add('主处理器变化需要端到端检查和构建')
      handled = true
    }

    if (
      /^src\/components\/ui\/list-.+\.ts$/.test(path)
      || path === 'src/components/ui/pagination.ts'
      || path === 'src/main.ts'
      || path === 'src/main-handlers/fcs-handlers.ts'
    ) {
      add(governanceChecks, taskScope('npm run check:list-page-governance', changedPaths))
      add(fullChecks, 'npm run build')
      add(governanceChecks, 'npm run check:standard-list-page-template')
      escalationReasons.add('列表公共组件或事件入口变化需要标准列表运行验证')
      handled = true
    }

    if (path.startsWith('tests/')
      && !path.startsWith('tests/workflow-governance/')
      && !/^tests\/pms-(?:purchase-chain|material-flow|master-data|settlement-flow|peripheral)\.spec\.ts$/.test(path)
      && path !== 'tests/wool-management-fact-workflow.spec.ts') {
      unknownPaths.push(path)
      add(fullChecks, 'npm run build')
      escalationReasons.add('测试路径未匹配已知运行器，须补充专项验证，不以构建替代该测试')
      handled = true
    }

    if (path === 'package.json' || path === 'package-lock.json') {
      add(fullChecks, 'npm run build')
      escalationReasons.add('项目依赖或命令变化需要构建')
      handled = true
    }

    if (isPrototype && !handled) {
      add(fullChecks, 'npm run build')
      escalationReasons.add('原型变更未匹配专项检查，需要构建兜底')
      handled = true
    }

    if (!handled) {
      unknownPaths.push(path)
      add(fullChecks, 'npm run build')
      escalationReasons.add('未知路径需要升级到安全的完整检查')
    }
  }

  return {
    changedPaths,
    fastChecks: [...fastChecks],
    governanceChecks: [...governanceChecks],
    fullChecks: [...fullChecks],
    unknownPaths: [...new Set(unknownPaths)].sort(),
    escalationReasons: [...escalationReasons],
  }
}
