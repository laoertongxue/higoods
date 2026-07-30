import assert from 'node:assert/strict'

import { createBootstrapProjectSnapshot } from '../src/data/pcs-project-bootstrap.ts'
import { createStyleArchiveBootstrapSnapshot } from '../src/data/pcs-style-archive-bootstrap.ts'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

const PROJECT_STORAGE_KEY = 'higood-pcs-project-store-v4-demo'
const STYLE_ARCHIVE_STORAGE_KEY = 'higood-pcs-style-archive-store-v3'
const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: storage,
})

const bootstrap = createBootstrapProjectSnapshot(4)
const sourceProjects = bootstrap.projects.slice(0, 3)
assert.equal(sourceProjects.length, 3, '测试数据必须包含三个可迁移的历史项目')

const historicalProjects = sourceProjects.map((sourceProject, index) => ({
  ...sourceProject,
  projectId: `historical_project_${index + 1}`,
  projectCode: `HISTORY-${index + 1}`,
  projectName: `历史真实项目${index + 1}`,
  templateId: index === 1 ? 'TPL-003' : 'TPL-001',
  linkedStyleId: '',
  linkedStyleCode: '',
  linkedStyleName: '',
  linkedStyleGeneratedAt: '',
}))
const historicalPhases = historicalProjects.flatMap((project, projectIndex) => {
  const sourceProject = sourceProjects[projectIndex]!
  return bootstrap.phases
    .filter((phase) => phase.projectId === sourceProject.projectId)
    .map((phase) => ({
      ...phase,
      projectPhaseId: `${project.projectId}-${phase.phaseCode}`,
      projectId: project.projectId,
      phaseName: `旧模板阶段-${phase.phaseOrder}`,
    }))
})
const historicalNodes = historicalProjects.flatMap((project, projectIndex) => {
  const sourceProject = sourceProjects[projectIndex]!
  return bootstrap.nodes
    .filter((node) => node.projectId === sourceProject.projectId)
    .map((node, nodeIndex) => ({
      ...node,
      projectNodeId: `${project.projectId}-legacy-node-${nodeIndex + 1}`,
      projectId: project.projectId,
      workItemTypeCode:
        projectIndex === 0 && nodeIndex === 0 ? 'STYLE_ARCHIVE_CREATE' : node.workItemTypeCode,
      workItemTypeName:
        projectIndex === 0 && nodeIndex === 0 ? '旧商品／款式档案建立' : node.workItemTypeName,
      phaseName: `旧模板阶段-${Number(node.phaseCode.slice(-2))}`,
      latestResultText:
        nodeIndex === 1 ? `历史业务记录-${project.projectCode}` : node.latestResultText,
    }))
})

const styleArchiveSeed = createStyleArchiveBootstrapSnapshot(3).records[0]
const archiveSourceNodeIds = [
  'historical_project_1-legacy-node-1',
  '',
  'historical_project_3-technical-package-node',
]

storage.setItem(
  PROJECT_STORAGE_KEY,
  JSON.stringify({
    version: 4,
    projects: historicalProjects,
    phases: historicalPhases,
    nodes: historicalNodes,
  }),
)
storage.setItem(
  STYLE_ARCHIVE_STORAGE_KEY,
  JSON.stringify({
    version: 3,
    records: historicalProjects.map((project, index) => ({
        ...styleArchiveSeed,
        styleId: `historical_style_existing_${index + 1}`,
        styleCode: `HISTORY-SPU-00${index + 1}`,
        styleName: `历史已有款式档案${index + 1}`,
        sourceProjectId: project.projectId,
        sourceProjectCode: project.projectCode,
        sourceProjectName: project.projectName,
        sourceProjectNodeId: archiveSourceNodeIds[index]!,
        baseInfoStatus: '商品测款',
        remark: `历史档案业务备注必须保留-${index + 1}`,
        sellingPointText: `历史档案卖点必须保留-${index + 1}`,
      })),
    pendingItems: [],
  }),
)

const projectRepository = await import('../src/data/pcs-project-repository.ts')
const styleArchiveRepository = await import('../src/data/pcs-style-archive-repository.ts')
const fixedStepNames = ['项目与档案建立', '样衣准备', '测款前准备', '市场测款', '测款判断与收尾']

historicalProjects.forEach((historicalProject) => {
  const migratedProject = projectRepository.getProjectById(historicalProject.projectId)
  assert.ok(migratedProject, `${historicalProject.projectCode} 不得因历史迁移失败回退为 seed`)
  assert.ok(
    projectRepository
      .listProjectNodes(historicalProject.projectId)
      .some((node) => node.latestResultText === `历史业务记录-${historicalProject.projectCode}`),
    `${historicalProject.projectCode} 的历史业务记录必须保留`,
  )
  assert.deepEqual(
    projectRepository.listProjectPhases(historicalProject.projectId).map((phase) => phase.phaseName),
    fixedStepNames,
    `${historicalProject.projectCode} 的旧模板阶段必须幂等迁移为固定五步`,
  )
  const styleArchive = styleArchiveRepository.findStyleArchiveByProjectId(historicalProject.projectId)
  assert.ok(styleArchive, `${historicalProject.projectCode} 缺失的商品测款档案必须幂等补齐`)
  assert.equal(styleArchive?.baseInfoStatus, '商品测款')
  assert.equal(migratedProject?.linkedStyleId, styleArchive?.styleId)
  const projectInitNode = projectRepository
    .listProjectNodes(historicalProject.projectId)
    .find((node) => node.workItemTypeCode === 'PROJECT_INIT')
  const projectIndex = historicalProjects.findIndex((project) => project.projectId === historicalProject.projectId)
  assert.equal(
    styleArchive?.sourceProjectNodeId,
    projectInitNode?.projectNodeId,
    `${historicalProject.projectCode} 的空、旧或任意失效来源节点都必须重绑到当前 PROJECT_INIT`,
  )
  assert.equal(styleArchive?.remark, `历史档案业务备注必须保留-${projectIndex + 1}`)
  assert.equal(styleArchive?.sellingPointText, `历史档案卖点必须保留-${projectIndex + 1}`)
})
const existingArchive = styleArchiveRepository.findStyleArchiveByProjectId(historicalProjects[0].projectId)
assert.equal(existingArchive?.styleId, 'historical_style_existing_1', '历史已有档案不得被新建档案替换')

const persisted = JSON.parse(storage.getItem(PROJECT_STORAGE_KEY) || '{}') as {
  projects?: Array<{ projectId: string }>
}
assert.ok(
  historicalProjects.every((project) => persisted.projects?.some((item) => item.projectId === project.projectId)),
  '历史快照迁移后不得被 seed 静默覆盖',
)

console.log('pcs-project-historical-migration.spec.ts PASS')
