import { normalizeChangedPath } from './changed-paths.ts'

export interface AffectedCheckRoute {
  changedPaths: string[]
  fastChecks: string[]
  governanceChecks: string[]
  fullChecks: string[]
  unknownPaths: string[]
  escalationReasons: string[]
}

const PROTOTYPE_PREFIXES = [
  'src/pages/',
  'src/components/',
  'src/data/',
  'src/router/',
  'src/main-handlers/',
]

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
    let handled = false
    const isPrototype = PROTOTYPE_PREFIXES.some((prefix) => path.startsWith(prefix))
    if (isPrototype) {
      add(governanceChecks, 'npm run check:prototype-design-governance -- --all')
    }

    if (path.startsWith('src/pages/')) {
      add(governanceChecks, 'npm run check:list-page-governance')
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

    if (/^src\/components\/ui\/list-(?:page|table|table-model)\.ts$/.test(path)) {
      add(governanceChecks, 'npm run check:list-page-governance')
      add(fullChecks, 'npm run build')
      escalationReasons.add('列表公共组件变化影响所有标准列表页')
      handled = true
    }

    if (
      path === 'scripts/check-prototype-design-governance.ts'
      || path.startsWith('scripts/workflow-governance/')
      || path.startsWith('tests/workflow-governance/')
    ) {
      add(fastChecks, 'npm run test:workflow-governance')
      add(fullChecks, 'npm run build')
      escalationReasons.add('治理脚本变化需要治理测试和构建')
      handled = true
    }

    if (path === 'package.json' || path === 'package-lock.json') {
      add(fullChecks, 'npm run build')
      escalationReasons.add('项目依赖或命令变化需要构建')
      handled = true
    }

    if (
      path.startsWith('docs/')
      || path === 'AGENTS.md'
    ) {
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
