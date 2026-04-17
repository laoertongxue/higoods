import assert from 'node:assert/strict'

import {
  approveProjectInitAndSync,
  markProjectNodeCompletedAndUnlockNext,
} from '../src/data/pcs-project-flow-service.ts'
import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  getProjectNodeRecordByWorkItemTypeCode,
  listActiveProjectTemplates,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectInlineNodeRecordRepository } from '../src/data/pcs-project-inline-node-record-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import { resetRevisionTaskRepository } from '../src/data/pcs-revision-task-repository.ts'
import { resetPlateMakingTaskRepository } from '../src/data/pcs-plate-making-repository.ts'
import { resetPatternTaskRepository } from '../src/data/pcs-pattern-task-repository.ts'
import { resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import { resetPreProductionSampleTaskRepository } from '../src/data/pcs-pre-production-sample-repository.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { resetTechnicalDataVersionRepository } from '../src/data/pcs-technical-data-version-repository.ts'
import { resetProjectArchiveRepository } from '../src/data/pcs-project-archive-repository.ts'
import { resetSampleAssetRepository } from '../src/data/pcs-sample-asset-repository.ts'
import { resetSampleLedgerRepository } from '../src/data/pcs-sample-ledger-repository.ts'
import {
  auditPcsProjectDataConsistency,
  formatPcsProjectDataConsistencyReport,
  repairPcsProjectDataConsistency,
  validateProjectNodeCompletion,
} from '../src/data/pcs-project-data-consistency.ts'
import { syncExistingProjectEngineeringTaskNodes } from '../src/data/pcs-task-project-relation-writeback.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectInlineNodeRecordRepository()
resetProjectChannelProductRepository()
resetRevisionTaskRepository()
resetPlateMakingTaskRepository()
resetPatternTaskRepository()
resetFirstSampleTaskRepository()
resetPreProductionSampleTaskRepository()
resetStyleArchiveRepository()
resetTechnicalDataVersionRepository()
resetProjectArchiveRepository()
resetSampleAssetRepository()
resetSampleLedgerRepository()

syncExistingProjectEngineeringTaskNodes('测试同步')
repairPcsProjectDataConsistency('测试修复')

const report = auditPcsProjectDataConsistency()
assert.equal(report.issueCount, 0, formatPcsProjectDataConsistencyReport(report))

const catalog = getProjectCreateCatalog()
const templateId = listActiveProjectTemplates()[0]?.id ?? '1'
const category = catalog.categories[0]
const subCategory = category?.children[0]
const brand = catalog.brands[0]
const styleCode = catalog.styleCodes[0] || catalog.styles[0]
const owner = catalog.owners[0]
const team = catalog.teams[0]

const created = createProject(
  {
    ...createEmptyProjectDraft(),
    projectName: '商品项目数据核对测试项目',
    projectType: '商品开发',
    projectSourceType: '企划提案',
    templateId,
    categoryId: category?.id || 'cat-top',
    categoryName: category?.name || '上衣',
    subCategoryId: subCategory?.id || '',
    subCategoryName: subCategory?.name || '',
    brandId: brand?.id || 'brand-chicmore',
    brandName: brand?.name || 'Chicmore',
    styleCodeId: styleCode?.id || 'style-001',
    styleCodeName: styleCode?.name || '1-Casul Shirt-18-30休闲衬衫',
    styleType: '基础款',
    priceRangeLabel: '5美元~10美元',
    targetChannelCodes: [catalog.channelOptions[0]?.code || 'tiktok-shop'],
    ownerId: owner?.id || 'owner-zl',
    ownerName: owner?.name || '张丽',
    teamId: team?.id || 'team-plan',
    teamName: team?.name || '商品企划组',
  },
  '测试用户',
)

assert.ok(created.project, '应创建测试商品项目')
const projectId = created.project!.projectId
const approveResult = approveProjectInitAndSync(projectId, '测试用户')
assert.ok(approveResult.ok, '应允许通过立项审核')

const sampleAcquireNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'SAMPLE_ACQUIRE')
assert.ok(sampleAcquireNode, '应存在样衣获取节点')

const validation = validateProjectNodeCompletion(projectId, sampleAcquireNode!.projectNodeId)
assert.equal(validation.ok, false, '缺少正式记录的节点不应允许直接完成')
assert.ok(validation.missingFieldLabels.includes('正式记录'), '应提示缺少正式记录')

const completeResult = markProjectNodeCompletedAndUnlockNext(projectId, sampleAcquireNode!.projectNodeId, {
  operatorName: '测试用户',
})
assert.equal(completeResult.ok, false, '缺少正式记录时应拦截节点完成')
assert.match(completeResult.message, /正式记录|缺少字段/, '应返回明确的缺失说明')

console.log('pcs-project-data-consistency.spec.ts PASS')
