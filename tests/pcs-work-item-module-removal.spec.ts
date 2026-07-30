import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { listProjectFlowStageContracts } from '../src/data/pcs-project-domain-contract.ts'
import { buildProjectNodes } from '../src/data/pcs-project-node-factory.ts'

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

const removedPaths = [
  'src/pages/pcs-work-items.ts',
  'src/pages/pcs-templates.ts',
  'src/data/pcs-work-items.ts',
  'src/data/pcs-templates.ts',
  'src/data/pcs-work-item-runtime-carrier.ts',
  'src/data/pcs-template-domain-view-model.ts',
  'src/data/pcs-work-item-configs.ts',
  'src/data/pcs-work-item-configs',
  'tests/pcs-work-item-library.spec.ts',
  'tests/pcs-work-item-status-contract.spec.ts',
]

assert.deepEqual(
  removedPaths.filter((relativePath) => existsSync(resolve(repositoryRoot, relativePath))),
  [],
  '商品项目工作项、工作项模板及其配置代码必须从仓库中彻底删除',
)

const productionEntryFiles = [
  'src/router/routes-pcs.ts',
  'src/router/route-renderers.ts',
  'src/main-handlers/pcs-handlers.ts',
  'src/data/app-shell-config.ts',
]

for (const relativePath of productionEntryFiles) {
  const source = readFileSync(resolve(repositoryRoot, relativePath), 'utf8')
  assert.doesNotMatch(
    source,
    /\/pcs\/(?:work-items|templates)|pcs-(?:work-items|templates)|Pcs(?:Step|Template)/,
    `${relativePath} 不得残留工作项或模板入口`,
  )
}

function listFilesRecursively(relativeDirectory: string): string[] {
  const absoluteDirectory = resolve(repositoryRoot, relativeDirectory)
  return readdirSync(absoluteDirectory).flatMap((name) => {
    const absolutePath = resolve(absoluteDirectory, name)
    const relativePath = `${relativeDirectory}/${name}`
    return statSync(absolutePath).isDirectory() ? listFilesRecursively(relativePath) : [relativePath]
  })
}

const bannedModuleReferences =
  /pcs-work-items|pcs-templates|getPcsStepDefinition|pcs-work-item-configs|pcs-work-item-runtime-carrier/
const scannedFiles = ['src', 'scripts', 'tests']
  .flatMap(listFilesRecursively)
  .filter((relativePath) => /\.(?:ts|json)$/.test(relativePath))
  .filter((relativePath) => relativePath !== 'tests/pcs-work-item-module-removal.spec.ts')

const remainingBannedReferences = scannedFiles.filter((relativePath) =>
  bannedModuleReferences.test(readFileSync(resolve(repositoryRoot, relativePath), 'utf8')),
)
assert.deepEqual(
  remainingBannedReferences,
  [],
  `不得通过兼容入口或改名继续保留已删除模块：${remainingBannedReferences.join('、')}`,
)

const oldStyleArchiveStepFiles = scannedFiles.filter((relativePath) =>
  /STYLE_ARCHIVE_CREATE/.test(readFileSync(resolve(repositoryRoot, relativePath), 'utf8')),
)
assert.deepEqual(
  oldStyleArchiveStepFiles,
  [],
  `不得保留“生成款式档案”旧步骤、按钮或关系：${oldStyleArchiveStepFiles.join('、')}`,
)

const projectRuntimeFiles = scannedFiles.filter(
  (relativePath) =>
    /^src\/data\/pcs-project(?:-|\.ts)/.test(relativePath) ||
    /^src\/pages\/pcs-projects(?:-|\.ts)/.test(relativePath),
)
const legacyRuntimeModelPattern =
  /\b(?:PcsProjectWorkItemCode|getProjectWorkItemContract|workItemTypeCode|workItemTypeName|templateId|templateName|templateVersion)\b/
const legacyRuntimeModelFiles = projectRuntimeFiles
  .filter(
    (relativePath) =>
      relativePath !== 'src/data/pcs-project-repository.ts' &&
      relativePath !== 'src/data/pcs-project-inline-node-record-repository.ts',
  )
  .filter((relativePath) =>
    legacyRuntimeModelPattern.test(readFileSync(resolve(repositoryRoot, relativePath), 'utf8')),
  )
assert.deepEqual(
  legacyRuntimeModelFiles,
  [],
  `商品项目运行时必须只使用固定 stepCode/stepName，不得把工作项或模板模型内聚改名保留：${legacyRuntimeModelFiles.join('、')}`,
)

const expectedSteps = [
  ['PROJECT_ARCHIVE', '项目与档案建立'],
  ['SAMPLE_PREPARATION', '样衣准备'],
  ['PRE_TEST_PREPARATION', '测款前准备'],
  ['MARKET_TESTING', '市场测款'],
  ['TEST_DECISION_CLOSURE', '测款判断与收尾'],
]

assert.deepEqual(
  listProjectFlowStageContracts().map((step) => [step.stepCode, step.stepName]),
  expectedSteps,
  '删除配置模块后仍必须保留固定五步业务契约',
)

const nodes = buildProjectNodes({
  projectId: 'prj_module_removal',
  ownerId: 'owner-test',
  ownerName: '测试负责人',
  createdAt: '2026-07-31 09:00',
})
const requiredDetailedTaskCodes = [
  'SAMPLE_ACQUIRE',
  'SAMPLE_INBOUND_CHECK',
  'SAMPLE_SHOOT_FIT',
  'SAMPLE_CONFIRM',
  'SAMPLE_COST_REVIEW',
  'SAMPLE_PRICING',
  'CHANNEL_PRODUCT_LISTING',
  'LIVE_TEST',
  'VIDEO_TEST',
  'TEST_CONCLUSION',
  'SAMPLE_RETURN_HANDLE',
]

assert.ok(nodes.length > expectedSteps.length, '固定五步必须继续承载逐项业务办理，不得改成一锅烩')
assert.deepEqual(
  requiredDetailedTaskCodes.filter(
    (taskCode) => !nodes.some((node) => (node as unknown as { stepCode?: string }).stepCode === taskCode),
  ),
  [],
  '删除工作项模块不得删除固定流程下的详细业务表单节点',
)

console.log('pcs-work-item-module-removal.spec.ts PASS')
