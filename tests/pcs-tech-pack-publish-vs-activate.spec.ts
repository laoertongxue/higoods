import assert from 'node:assert/strict'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
} from '../src/data/pcs-project-repository.ts'
import {
  generateTechPackVersionFromPlateTask,
  generateTechPackVersionFromRevisionTask,
  publishTechnicalDataVersion,
} from '../src/data/pcs-project-technical-data-writeback.ts'
import { getStyleArchiveById } from '../src/data/pcs-style-archive-repository.ts'
import { getTechnicalDataVersionById } from '../src/data/pcs-technical-data-version-repository.ts'
import { activateTechPackVersionForStyle } from '../src/data/pcs-tech-pack-version-activation.ts'
import {
  fillCoreTechPackContent,
  prepareTechPackTaskScenario,
} from './pcs-tech-pack-test-helper.ts'

const scenario = prepareTechPackTaskScenario()

const firstDraft = generateTechPackVersionFromPlateTask(scenario.plateTaskId, '测试用户')
fillCoreTechPackContent(firstDraft.record.technicalVersionId, scenario.styleCode)
const firstPublished = publishTechnicalDataVersion(firstDraft.record.technicalVersionId, '测试用户')

let style = getStyleArchiveById(scenario.styleId)
assert.equal(style!.currentTechPackVersionId, '', '发布后不应自动成为当前生效版本')
assert.equal(style!.techPackStatus, '已发布', '仅发布后款式档案技术包状态应为已发布')

const secondDraft = generateTechPackVersionFromRevisionTask(scenario.revisionTaskId, '测试用户')
assert.throws(
  () => activateTechPackVersionForStyle(scenario.styleId, secondDraft.record.technicalVersionId, '测试用户'),
  /只有已发布技术包版本才能启用为当前生效版本/,
  '草稿技术包版本不应允许启用',
)

const firstActivated = activateTechPackVersionForStyle(
  scenario.styleId,
  firstPublished.technicalVersionId,
  '测试用户',
)
style = getStyleArchiveById(scenario.styleId)
assert.equal(style!.currentTechPackVersionId, firstPublished.technicalVersionId, '启用后款式档案应记录当前生效版本主键')
assert.equal(style!.currentTechPackVersionCode, firstPublished.technicalVersionCode, '启用后款式档案应记录当前生效版本编号')
assert.equal(style!.currentTechPackVersionStatus, '已发布', '当前生效版本状态应为已发布')
assert.equal(style!.currentTechPackVersionActivatedAt, firstActivated.activatedAt, '启用后应回写启用时间')
assert.equal(style!.currentTechPackVersionActivatedBy, '测试用户', '启用后应回写启用人')

let project = getProjectById(scenario.projectId)
assert.equal(project!.linkedTechPackVersionId, firstPublished.technicalVersionId, '启用后项目主记录应回写最近关联技术包版本')
assert.equal(project!.linkedTechPackVersionStatus, 'PUBLISHED', '项目主记录应回写技术包版本正式状态编码')

let transferNode = getProjectNodeRecordByWorkItemTypeCode(scenario.projectId, 'PROJECT_TRANSFER_PREP')
assert.equal(transferNode!.latestResultType, '已启用当前生效技术包', '启用后项目节点应回写启用结果')
assert.equal(
  transferNode!.pendingActionText,
  '后续生产需求转生产单时将消费当前生效技术包版本',
  '启用后项目节点应回写生产消费提示',
)

fillCoreTechPackContent(secondDraft.record.technicalVersionId, scenario.styleCode)
const secondPublished = publishTechnicalDataVersion(secondDraft.record.technicalVersionId, '测试用户')
style = getStyleArchiveById(scenario.styleId)
assert.equal(style!.currentTechPackVersionId, firstPublished.technicalVersionId, '新版本发布后不应自动覆盖当前生效版本')

activateTechPackVersionForStyle(scenario.styleId, secondPublished.technicalVersionId, '测试用户')
style = getStyleArchiveById(scenario.styleId)
assert.equal(style!.currentTechPackVersionId, secondPublished.technicalVersionId, '启用新版本后当前生效版本应切换为新版本')
assert.equal(
  getTechnicalDataVersionById(firstPublished.technicalVersionId)?.versionStatus,
  'PUBLISHED',
  '旧版本被替换后仍应保持已发布状态',
)
assert.equal(
  getTechnicalDataVersionById(secondPublished.technicalVersionId)?.versionStatus,
  'PUBLISHED',
  '启用动作不应改写技术包版本状态',
)

project = getProjectById(scenario.projectId)
assert.equal(project!.linkedTechPackVersionId, secondPublished.technicalVersionId, '启用新版本后项目主记录应回写新版本')
transferNode = getProjectNodeRecordByWorkItemTypeCode(scenario.projectId, 'PROJECT_TRANSFER_PREP')
assert.equal(transferNode!.latestInstanceId, secondPublished.technicalVersionId, '启用新版本后项目节点应指向新版本')

console.log('pcs-tech-pack-publish-vs-activate.spec.ts PASS')
