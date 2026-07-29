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

    if (/supplement|补料/i.test(path)) {
      add(fastChecks, 'npm run check:cutting-supplement-process-work-orders')
      handled = true
    }

    if (/cutting|cut-piece|transfer-bag|fei-ticket/i.test(path)) {
      add(fastChecks, 'npm run check:cutting:all')
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
