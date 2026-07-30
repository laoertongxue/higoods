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

const projectSnapshot = createBootstrapProjectSnapshot(4)
const sourceProject = projectSnapshot.projects[0]!
const linkedStyleId = 'style_historical_linked_only'
const historicalProject = {
  ...sourceProject,
  linkedStyleId,
  linkedStyleCode: 'HISTORY-LINKED-001',
  linkedStyleName: '历史仅按 ID 关联档案',
}
storage.setItem(
  PROJECT_STORAGE_KEY,
  JSON.stringify({
    ...projectSnapshot,
    projects: [
      historicalProject,
      ...projectSnapshot.projects.slice(1),
    ],
  }),
)

const styleSeed = createStyleArchiveBootstrapSnapshot(3)
const historicalArchive = {
  ...styleSeed.records[0]!,
  styleId: linkedStyleId,
  styleCode: 'HISTORY-LINKED-001',
  styleName: '历史仅按 ID 关联档案',
  sourceProjectId: '',
  sourceProjectCode: 'WRONG-CODE',
  sourceProjectName: '错误历史项目',
  sourceProjectNodeId: 'arbitrary-removed-project-node',
  remark: '历史档案备注必须原样保留',
  sellingPointText: '历史档案卖点必须原样保留',
  detailDescription: '历史档案详情必须原样保留',
}
storage.setItem(
  STYLE_ARCHIVE_STORAGE_KEY,
  JSON.stringify({
    version: 3,
    records: [
      historicalArchive,
      ...styleSeed.records.filter(
        (record) => record.styleId !== linkedStyleId && record.sourceProjectId !== sourceProject.projectId,
      ),
    ],
    pendingItems: styleSeed.pendingItems,
  }),
)

const projectRepository = await import('../src/data/pcs-project-repository.ts')
const styleRepository = await import('../src/data/pcs-style-archive-repository.ts')

const migratedProject = projectRepository.getProjectById(sourceProject.projectId)
const migratedArchives = styleRepository
  .listStyleArchives()
  .filter((record) => record.styleId === linkedStyleId)
assert.equal(migratedArchives.length, 1, '按 linkedStyleId 找到历史档案后不得再创建同 ID 档案')
const migratedArchive = migratedArchives[0]!
assert.equal(migratedProject?.linkedStyleId, linkedStyleId)
assert.equal(migratedArchive.sourceProjectId, sourceProject.projectId)
assert.equal(migratedArchive.sourceProjectCode, sourceProject.projectCode)
assert.equal(migratedArchive.sourceProjectName, sourceProject.projectName)
assert.equal(migratedArchive.remark, historicalArchive.remark)
assert.equal(migratedArchive.sellingPointText, historicalArchive.sellingPointText)
assert.equal(migratedArchive.detailDescription, historicalArchive.detailDescription)

const projectInitNode = projectRepository
  .listProjectNodes(sourceProject.projectId)
  .find((node) => node.stepCode === 'PROJECT_INIT')
assert.ok(projectInitNode)
assert.equal(
  migratedArchive.sourceProjectNodeId,
  projectInitNode?.projectNodeId,
  '任意非当前 PROJECT_INIT 的历史来源节点都必须重绑到当前项目建立节点',
)
assert.throws(
  () =>
    styleRepository.createStyleArchiveShell({
      ...historicalArchive,
      sourceProjectId: projectSnapshot.projects[1]!.projectId,
      sourceProjectCode: projectSnapshot.projects[1]!.projectCode,
      sourceProjectName: projectSnapshot.projects[1]!.projectName,
      sourceProjectNodeId: projectInitNode!.projectNodeId,
    }),
  /款式档案 ID|styleId|已存在/,
  '同一 styleId 不得被另一个项目重复占用',
)

console.log('pcs-project-linked-style-archive-migration.spec.ts PASS')
