import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildEngineeringTaskPlan,
  getEngineeringTaskDependencies,
  listPreparationProjectionItems,
} from '../src/data/pcs-engineering-dependency-policy.ts'
import {
  resetEngineeringIndependentSamplingRepository,
  restoreEngineeringIndependentSamplingRepositoryState,
} from '../src/data/pcs-engineering-master-sampling.ts'
import {
  confirmEngineeringMasterTaskPlan,
  createEngineeringMasterOrder,
  listEngineeringMasterPriorResultCandidates,
  resetEngineeringMasterRepository,
  startEngineeringTask,
} from '../src/data/pcs-engineering-master-repository.ts'
import { projectEngineeringMasterToPreparation } from '../src/data/pcs-engineering-preparation-projection.ts'
import { resetEngineeringPatternResultVersions, submitEngineeringPatternResult } from '../src/data/pcs-engineering-pattern-result.ts'
import { captureEngineeringUploadedFiles } from '../src/data/pcs-engineering-file-upload.ts'
import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { renderPcsPlateMakingTaskDetailPage } from '../src/pages/pcs-engineering-tasks/plate-making-task.ts'
import { renderPcsFirstSampleTaskDetailPage } from '../src/pages/pcs-engineering-tasks/first-sample-task.ts'
import type { EngineeringIndependentSamplingRecord } from '../src/data/pcs-engineering-master-types.ts'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length(): number { return this.values.size }
  clear(): void { this.values.clear() }
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null }
  removeItem(key: string): void { this.values.delete(key) }
  setItem(key: string, value: string): void { this.values.set(key, String(value)) }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage, dispatchEvent: () => true } })

resetStyleArchiveRepository()
resetEngineeringIndependentSamplingRepository(false)
resetEngineeringMasterRepository()
resetEngineeringPatternResultVersions()

const [sourceStyle, targetStyle] = listStyleArchives().filter((style) => style.mainImageUrl)
assert.ok(sourceStyle && targetStyle, '专项数据必须有两份已建档款式')
const patternFile = {
  fileId: 'DR-BASE-PRJ-1', purpose: 'PATTERN_SOURCE' as const, fileName: 'confirmed-base.prj', extension: 'prj',
  mimeType: 'application/octet-stream', sizeBytes: 4, dataUrl: 'data:application/octet-stream;base64,UFJK', status: '已保存' as const,
  uploadedById: 'PATTERN-DR-1', uploadedByName: '版师-设计改款', uploadedByTeam: '版师', uploadedAt: '2026-09-14 12:00:00', roundNo: 1, errorMessage: '',
}
const completedSampling: EngineeringIndependentSamplingRecord = {
  samplingTaskId: 'ES-ID-DR-PREP-1', samplingTaskCode: 'ES-DR-PREP-1', samplingType: 'DESIGN_REVISION',
  sourceStyleId: sourceStyle.styleId, sourceStyleCode: sourceStyle.styleCode, targetMode: 'ARCHIVED_STYLE',
  targetStyleId: targetStyle.styleId, targetStyleCode: targetStyle.styleCode, targetStyleName: targetStyle.styleName,
  temporarySpuName: '', linkedFormalStyleId: '', linkedFormalStyleCode: '', linkedFormalStyleName: '', linkedAt: '', linkedBy: '',
  status: 'COMPLETED', creationReason: '生产准备专项前期资料', designFiles: [{ ...patternFile, fileId: 'DR-DESIGN-1', purpose: 'DESIGN_IMAGE', fileName: 'design.png', extension: 'png', mimeType: 'image/png' }], patternHandling: 'REMAKE', reusedPatternFiles: [],
  buyerId: 'BUYER-DR-1', buyerName: '买手-设计改款', merchandiserId: '', merchandiserName: '',
  relatedProfessionalTaskIds: ['ES-ID-DR-PREP-1-BASE_PATTERN'], professionalTasks: [{
    taskId: 'ES-ID-DR-PREP-1-BASE_PATTERN', taskType: 'BASE_PATTERN', taskName: '基码纸样', ownerTeamName: '版师',
    status: 'COMPLETED', dependsOnTaskIds: [], plannedCompleteAt: '2026-09-14', startedAt: '2026-09-14 10:00:00',
    submittedAt: '2026-09-14 12:00:00', completedAt: '2026-09-14 12:00:00', pantoneColorCode: '', colorName: '', dyeColorCode: '',
    colorRequirementConfirmedBy: '', colorRequirementConfirmedAt: '', sampleRequirements: [], processWorkOrderRefs: [], results: [{
      resultId: 'DR-BASE-RESULT-1', title: '已确认基码纸样', version: 'v1.0', description: '设计改款已完成纸样',
      applicablePartOrSize: '基码', sampleQuantity: 0, sampleColor: '', sampleSize: '', sourcePatternVersion: '',
      imageUrl: '', files: [patternFile], status: 'APPROVED', rejectReason: '',
    }],
  }],
  bomDraftVersionId: '', bomVersionIds: [], resultVersion: 'v1.0', resultSummary: '设计改款整单已确认',
  confirmedBy: '买手-设计改款', confirmedAt: '2026-09-14 13:00:00', selectedTaskTypes: ['BASE_PATTERN'], suggestedTaskTypes: ['BASE_PATTERN'],
  taskPlanConfirmedBy: '买手-设计改款', taskPlanConfirmedAt: '2026-09-14 09:30:00', colorMappings: [], materialConversionLines: [],
  bomConversionStatus: 'CONFIRMED', bomConversionConfirmedBy: '买手-设计改款', bomConversionConfirmedAt: '2026-09-14 09:20:00',
  buyerPreparationConfirmedBy: '买手-设计改款', buyerPreparationConfirmedAt: '2026-09-14 09:20:00', buyerPreparationReturnedBy: '',
  buyerPreparationReturnedAt: '', buyerPreparationReturnReason: '', sourceResultVersionId: '', reuseDecision: 'PENDING', operationLogs: [],
  createdBy: '买手-设计改款', createdAt: '2026-09-14 09:00:00', updatedAt: '2026-09-14 13:00:00',
}
function createDraft(uniqueKey: string) {
  return createEngineeringMasterOrder({
    styleId: completedSampling.targetStyleId,
    styleCode: completedSampling.targetStyleCode,
    merchandiserId: 'MERCH-PREP-1',
    merchandiserName: '跟单-生产准备',
    createdById: 'MERCH-PREP-1',
    createdBy: '跟单-生产准备',
    createdByRole: '跟单',
    preparationType: 'PURE_WOVEN',
    qualificationFact: {
      styleCode: completedSampling.targetStyleCode,
      formalSaleStatus: 'NO_FORMAL_SALE',
      formalProductionStatus: 'NO_FORMAL_PRODUCTION',
      formalSaleSource: '专项测试',
      formalProductionSource: '专项测试',
      checkedAt: '2026-09-15 09:00:00',
    },
    bulkProductionQualification: {
      basisType: 'OTHER_CONFIRMED',
      triggerBusinessObjectType: '业务确认',
      triggerBusinessObjectId: uniqueKey,
      thresholdQuantity: null,
      reachedQuantity: null,
      reachedAt: '2026-09-15 09:00:00',
      reason: '生产准备专项测试',
      uniqueTriggerKey: uniqueKey,
    },
    creationReason: '验证设计改款基码纸样承接与并行生产准备',
  })
}

const missingBaseDraft = createDraft('PREP-MISSING-BASE')
assert.throws(() => confirmEngineeringMasterTaskPlan(missingBaseDraft.masterOrderId, {
  confirmedBy: missingBaseDraft.merchandiserName,
  confirmedById: missingBaseDraft.merchandiserId,
  confirmedByRole: '跟单',
  selectedConditionalTaskTypes: [],
}), /必须绑定同一张已完成设计改款|必须关联设计改款已确认的可用梭织基码纸样/, '没有可用设计改款基码纸样时必须阻断发布')

resetEngineeringMasterRepository()
const draft = createDraft('PREP-NORMAL')
restoreEngineeringIndependentSamplingRepositoryState({ records: [completedSampling] })
const candidates = listEngineeringMasterPriorResultCandidates(completedSampling.targetStyleCode, 'PURE_WOVEN')
const baseCandidate = candidates.find((candidate) => candidate.engineeringTaskType === 'BASE_PATTERN_WOVEN')
assert.ok(baseCandidate, '生产准备单必须能选择设计改款已确认的真实 PRJ 基码纸样')
const published = confirmEngineeringMasterTaskPlan(draft.masterOrderId, {
  confirmedBy: draft.merchandiserName,
  confirmedById: draft.merchandiserId,
  confirmedByRole: '跟单',
  selectedConditionalTaskTypes: [],
  priorResultDecisions: [{
    engineeringTaskType: 'BASE_PATTERN_WOVEN',
    sourceSamplingTaskId: baseCandidate.source.samplingTaskId,
    sourceProfessionalTaskId: baseCandidate.source.professionalTaskId,
    sourceResultVersion: baseCandidate.source.resultVersion,
    decision: '复用',
  }],
})

assert.equal(published.tasks.some((task) => task.taskType.startsWith('BASE_PATTERN')), false, '新主单不得生成基码纸样任务')
const sampleTask = published.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')!
const sizeTask = published.tasks.find((task) => task.taskType === 'SIZE_PATTERN_WOVEN')!
assert.equal(sampleTask.status, '待开始')
assert.equal(sizeTask.status, '待开始')
assert.deepEqual(sampleTask.dependsOnTaskIds, [])
assert.deepEqual(sizeTask.dependsOnTaskIds, [])
assert.deepEqual(getEngineeringTaskDependencies('PURE_WOVEN', 'PRE_PRODUCTION_SAMPLE'), [])
assert.deepEqual(getEngineeringTaskDependencies('PURE_WOVEN', 'SIZE_PATTERN_WOVEN'), [])
assert.equal(published.sourceDesignRevisionTaskId, completedSampling.samplingTaskId)
assert.deepEqual(published.sourceDesignFileIds, ['DR-DESIGN-1'])

startEngineeringTask({ masterOrderId: published.masterOrderId, taskId: sampleTask.taskId, operatorId: 'SAMPLE-1', operatorName: '制作团队-1' })
const firstSamplePage = renderPcsFirstSampleTaskDetailPage(sampleTask.taskId)
assert.match(firstSamplePage, /梭织基码纸样 · v1\.0 · ES-DR-PREP-1/, '首单样衣必须从主单已确认的设计改款基码复用记录读取纸样')
assert.doesNotMatch(firstSamplePage, /尚无可用的已完成基码纸样版本/, '首单样衣不得再依赖已取消的主单基码任务')

const techPackTask = published.tasks.find((task) => task.taskType === 'TECH_PACK_CONFIRMATION')!
const allEnabledWorkIds = published.tasks
  .filter((task) => task.taskType !== 'TECH_PACK_CONFIRMATION' && task.status !== '未启用')
  .map((task) => task.taskId)
assert.deepEqual([...techPackTask.dependsOnTaskIds].sort(), [...allEnabledWorkIds].sort(), '技术包必须等待全部启用任务完成')

const projectionDefinitions = listPreparationProjectionItems()
assert.equal(projectionDefinitions.some((item) => item.taskType.startsWith('BASE_PATTERN')), false, '生产准备时效不得包含设计改款基码纸样')
const timing = projectEngineeringMasterToPreparation(published)
assert.equal(timing.items.some((item) => item.itemType.includes('基码纸样')), false)

startEngineeringTask({ masterOrderId: published.masterOrderId, taskId: sizeTask.taskId, operatorId: 'PATTERN-1', operatorName: '版师-1' })
const sourceFiles = await captureEngineeringUploadedFiles({
  files: [new File(['real-prj'], 'full-size.prj', { type: 'application/octet-stream' })],
  purpose: 'PATTERN_SOURCE',
  actor: { userId: 'PATTERN-1', userName: '版师-1', teamName: '版师' },
  roundNo: 1,
})
const result = submitEngineeringPatternResult({
  masterOrderId: published.masterOrderId,
  taskId: sizeTask.taskId,
  applicableSizes: [],
  sourceFiles,
  previewFiles: [],
  note: '',
  submittedBy: '版师-1',
})
assert.equal(result.patternKind, '齐码纸样')
assert.deepEqual(result.applicableSizes, [])
assert.deepEqual(result.previewFiles, [])
const fullSizePage = renderPcsPlateMakingTaskDetailPage(sizeTask.taskId)
assert.doesNotMatch(fullSizePage, /纸样预览图|适用尺码/)
assert.match(fullSizePage, /已上传齐码纸样文件/)

const plan = buildEngineeringTaskPlan('PURE_WOVEN')
assert.equal(plan.find((item) => item.taskType === 'BASE_PATTERN_WOVEN')?.enabled, false)
assert.equal(plan.find((item) => item.taskType === 'PRE_PRODUCTION_SAMPLE')?.enabled, true)
assert.equal(plan.find((item) => item.taskType === 'SIZE_PATTERN_WOVEN')?.enabled, true)

const shellSource = readFileSync(new URL('../src/data/app-shell-config.ts', import.meta.url), 'utf8')
assert.match(shellSource, /title: '生产准备管理'/)
assert.doesNotMatch(shellSource, /title: '生产工程管理'/)
const techPackWorkspaceSource = readFileSync(new URL('../src/data/pcs-engineering-tech-pack-workspace.ts', import.meta.url), 'utf8')
const techPackTypeSource = readFileSync(new URL('../src/data/pcs-technical-data-version-types.ts', import.meta.url), 'utf8')
assert.match(techPackWorkspaceSource, /changeScope: '生产准备单生成'/)
assert.doesNotMatch(techPackWorkspaceSource, /生产准备主单生成/)
assert.doesNotMatch(techPackTypeSource, /生产准备主单生成/)

console.log('pcs-production-preparation-transition.spec PASS')
