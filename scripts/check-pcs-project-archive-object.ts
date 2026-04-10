import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const archiveRepositorySource = read('src/data/pcs-project-archive-repository.ts')
assert.ok(archiveRepositorySource.includes('listProjectArchives'), '必须存在正式项目资料归档仓储')
assert.ok(archiveRepositorySource.includes('upsertProjectArchive'), '正式项目资料归档仓储必须支持写入归档主记录')

const archiveSyncSource = read('src/data/pcs-project-archive-sync.ts')
assert.ok(archiveSyncSource.includes('createProjectArchive'), '必须存在创建项目资料归档对象的正式同步服务')
assert.ok(archiveSyncSource.includes('syncProjectArchive'), '必须存在同步项目资料归档对象的正式同步服务')
assert.ok(archiveSyncSource.includes('uploadProjectArchiveManualDocument'), '必须存在手工上传资料的正式同步服务')
assert.ok(archiveSyncSource.includes('finalizeProjectArchive'), '必须存在完成项目资料归档的正式同步服务')

const archivePageSource = read('src/pages/pcs-project-archive.ts')
assert.ok(archivePageSource.includes('基础与来源'), '必须存在正式项目资料归档页面')
assert.ok(archivePageSource.includes('技术与图纸'), '项目资料归档页面必须包含技术与图纸页签')
assert.ok(archivePageSource.includes('样衣与打样'), '项目资料归档页面必须包含样衣与打样页签')
assert.ok(archivePageSource.includes('检测与报价'), '项目资料归档页面必须包含检测与报价页签')
assert.ok(!archivePageSource.includes('技术包'), '项目资料归档页面不应出现技术包旧口径')

const routeSource = read('src/router/routes.ts')
assert.ok(routeSource.includes('renderPcsProjectArchivePage'), '路由必须接入正式项目资料归档页面')
assert.ok(routeSource.includes('/archive'), '必须存在项目资料归档正式路由')

const projectDetailSource = read('src/pages/pcs-project-detail.ts')
assert.ok(projectDetailSource.includes('create-project-archive'), '项目详情页必须提供创建项目资料归档入口')
assert.ok(projectDetailSource.includes('go-project-archive'), '项目详情页必须提供查看项目资料归档入口')
assert.ok(!projectDetailSource.includes('collectProjectArchiveAutoData'), '项目详情页不应直接扫描归档自动收集逻辑')
assert.ok(!projectDetailSource.includes('listProjectArchiveDocumentsByArchiveId'), '项目详情页不应直接拼装正式归档资料')

const nodeDetailSource = read('src/pages/pcs-project-work-item-detail.ts')
assert.ok(nodeDetailSource.includes('项目资料归档'), '项目节点详情页必须存在项目资料归档状态区域')
assert.ok(nodeDetailSource.includes('create-project-archive'), '项目节点详情页必须提供创建项目资料归档入口')
assert.ok(nodeDetailSource.includes('go-project-archive'), '项目节点详情页必须提供查看项目资料归档入口')
assert.ok(!nodeDetailSource.includes('listProjectArchiveDocumentsByArchiveId'), '项目节点详情页不应直接拼装正式归档资料')

const styleWritebackSource = read('src/data/pcs-project-style-archive-writeback.ts')
const technicalWritebackSource = read('src/data/pcs-project-technical-data-writeback.ts')
const sampleWritebackSource = read('src/data/pcs-sample-project-writeback.ts')
const taskWritebackSource = read('src/data/pcs-task-project-relation-writeback.ts')
assert.ok(styleWritebackSource.includes('syncExistingProjectArchiveByProjectId'), '款式档案写入服务必须接入项目资料归档自动同步')
assert.ok(technicalWritebackSource.includes('syncExistingProjectArchiveByProjectId'), '技术资料写入服务必须接入项目资料归档自动同步')
assert.ok(sampleWritebackSource.includes('syncExistingProjectArchiveByProjectId'), '样衣写入服务必须接入项目资料归档自动同步')
assert.ok(taskWritebackSource.includes('syncExistingProjectArchiveByProjectId'), '任务写入服务必须接入项目资料归档自动同步')

console.log('check-pcs-project-archive-object.ts PASS')
