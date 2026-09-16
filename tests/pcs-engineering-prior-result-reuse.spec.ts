import assert from 'node:assert/strict'

import '../src/data/fcs/design-revision-process-work-order-adapter.ts'
import {
  DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS,
  confirmEngineeringIndependentSamplingPlan,
  confirmEngineeringIndependentSamplingResult,
  completeEngineeringIndependentBuyerPreparation,
  createEngineeringIndependentSampling,
  getEngineeringIndependentSamplingStep,
  listReusableEngineeringIndependentProfessionalResults,
  resetEngineeringIndependentSamplingRepository,
  reviewEngineeringIndependentProfessionalTask,
  startEngineeringIndependentProfessionalTask,
  submitEngineeringIndependentProfessionalTask,
  suggestEngineeringIndependentTaskTypes,
} from '../src/data/pcs-engineering-master-sampling.ts'
import {
  getEngineeringBomVersionById,
  listEngineeringBomVersionsByOwner,
  resetEngineeringBomRepository,
  saveEngineeringBomPricingPlan,
  saveEngineeringBomVersion,
} from '../src/data/pcs-engineering-bom-repository.ts'
import { captureEngineeringUploadedFiles } from '../src/data/pcs-engineering-file-upload.ts'
import { resetEngineeringTaskUploadRepository } from '../src/data/pcs-engineering-task-upload-repository.ts'
import { listMaterialArchives, listMaterialSkuRecordsByMaterialId } from '../src/data/pcs-material-archive-repository.ts'
import {
  confirmEngineeringMasterTaskPlan,
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  listEngineeringMasterPriorResultCandidates,
  resetEngineeringMasterRepository,
  type EngineeringMasterPriorResultDecisionInput,
} from '../src/data/pcs-engineering-master-repository.ts'
import type {
  EngineeringIndependentProfessionalTaskType,
  EngineeringIndependentSamplingRecord,
} from '../src/data/pcs-engineering-master-types.ts'
import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { renderPcsEngineeringMasterDetailPage } from '../src/pages/pcs-engineering-master-detail.ts'

const merchandiser = { role: '跟单', userId: 'MERCH-A6', userName: '跟单-A6' }
const buyer = { role: '买手', userId: 'BUYER-A6', userName: '买手-A6' }

resetStyleArchiveRepository()
resetEngineeringIndependentSamplingRepository(false)
resetEngineeringBomRepository()
resetEngineeringTaskUploadRepository()
resetEngineeringMasterRepository()
const [sourceStyle, targetStyle] = listStyleArchives().filter((style) => style.mainImageUrl)
assert.ok(sourceStyle && targetStyle)

const materialWithSku = listMaterialArchives().map((material) => ({
  material,
  sku: listMaterialSkuRecordsByMaterialId(material.materialId).find((item) => item.status === 'ACTIVE' && item.costPrice > 0),
})).find((item) => item.sku)
assert.ok(materialWithSku?.sku, '专项数据必须有可用于真实 BOM 的有效物料')

function realFile(name: string, type: string): File {
  return new File([`pcs-prior-result-${name}`], name, { type })
}

async function uploaded(
  files: File[],
  purpose: Parameters<typeof captureEngineeringUploadedFiles>[0]['purpose'],
  actor: { userId: string; userName: string; teamName: string },
) {
  return captureEngineeringUploadedFiles({ files, purpose, actor, roundNo: 1, uploadedAt: '2026-07-01 12:00:00' })
}

function confirmSamplingBom(record: EngineeringIndependentSamplingRecord): void {
  record.bomVersionIds.forEach((versionId, index) => {
    const version = getEngineeringBomVersionById(versionId)!
    saveEngineeringBomVersion({
      versionId,
      role: '买手',
      userId: buyer.userId,
      userName: buyer.userName,
      materialLines: [{
        bomItemId: `${versionId}-LINE-${index + 1}`,
        materialSkuId: materialWithSku!.sku!.materialSkuId,
        styleCode: version.styleCode,
        productColor: version.productColor,
        materialType: '面料',
        materialImageUrl: materialWithSku!.sku!.skuImageUrl || materialWithSku!.material.mainImageUrl,
        usage: 1,
        sampleQuantity: 1,
        usageUnit: materialWithSku!.sku!.pricingUnit,
        lossRate: 0,
        applicableSkuIds: version.applicableSkuIds,
        printRequirement: '否',
        dyeRequirement: '否',
        purchaseRequirement: '否',
        remark: '前期成果复用专项 BOM；本场景不创建印花加工单，花型任务由买手明确选用',
      }],
      customCosts: [],
    })
  })
  saveEngineeringBomPricingPlan({
    ownerStage: 'INDEPENDENT_SAMPLING',
    ownerId: record.samplingTaskId,
    role: '买手',
    userId: buyer.userId,
    userName: buyer.userName,
    customCostDecision: 'NO_CUSTOM_COST',
    customCosts: [],
    updatedAt: record.createdAt,
  })
  completeEngineeringIndependentBuyerPreparation({
    samplingTaskId: record.samplingTaskId,
    actor: buyer,
    completedAt: record.createdAt,
  })
}

async function createSampling(
  marker: string,
  taskTypes: EngineeringIndependentProfessionalTaskType[],
  confirmedAt?: string,
): Promise<EngineeringIndependentSamplingRecord> {
  const designFiles = await uploaded(
    [realFile(`${marker}-design.png`, 'image/png')],
    'DESIGN_IMAGE',
    { userId: buyer.userId, userName: buyer.userName, teamName: '买手' },
  )
  const created = createEngineeringIndependentSampling({
    sourceStyleId: sourceStyle.styleId,
    targetStyleId: targetStyle.styleId,
    creationReason: `${marker} 前期成果复用专项`,
    designFiles,
    buyer,
    createdAt: `2026-07-${marker === 'OLD' ? '01' : marker === 'NEW' ? '10' : '20'} 09:00:00`,
  })
  assert.equal(getEngineeringIndependentSamplingStep(created), 'SCHEME_CONFIRMATION')
  confirmSamplingBom(created)
  const requiredTaskTypes = [...new Set([
    ...taskTypes,
    ...suggestEngineeringIndependentTaskTypes(created.samplingTaskId),
  ])]
  let current = confirmEngineeringIndependentSamplingPlan({
    samplingTaskId: created.samplingTaskId,
    actor: buyer,
    selectedTaskTypes: requiredTaskTypes,
    displaySampleAssignment: { ...DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0] },
    confirmedAt: created.createdAt,
  })
  assert.equal(getEngineeringIndependentSamplingStep(current), 'PROFESSIONAL_WORK')
  assert.deepEqual(
    [current.displaySampleTeamId, current.displaySampleTeamName, current.displaySampleReceivingLocationId, current.displaySampleReceivingLocationName],
    ['PCS-DISPLAY-SAMPLE-TEAM', '制作团队', 'PCS-DISPLAY-SAMPLE-AREA', '销售展示样衣制作区'],
  )
  for (const taskType of ['BASE_PATTERN', 'PATTERN_ARTWORK', 'DISPLAY_SAMPLE'] as const) {
    const task = current.professionalTasks.find((item) => item.taskType === taskType)
    if (!task) continue
    const executor = {
      role: taskType === 'BASE_PATTERN' ? '版师' : taskType === 'DISPLAY_SAMPLE' ? '制作团队' : '花型团队',
      userId: `EXEC-${taskType}`,
      userName: `${task.taskName}负责人`,
    }
    current = startEngineeringIndependentProfessionalTask({ taskId: task.taskId, actor: executor, startedAt: created.createdAt })
    const files = taskType === 'BASE_PATTERN'
      ? await uploaded([realFile(`${marker}-base.prj`, 'application/octet-stream')], 'PATTERN_SOURCE', { ...executor, teamName: '版师团队' })
      : taskType === 'DISPLAY_SAMPLE'
        ? await uploaded([realFile(`${marker}-display.jpg`, 'image/jpeg')], 'SAMPLE_RESULT', { ...executor, teamName: '制作团队' })
        : await uploaded([realFile(`${marker}-artwork.ai`, 'application/postscript'), realFile(`${marker}-artwork.jpg`, 'image/jpeg')], 'PATTERN_ARTWORK', { ...executor, teamName: '花型团队' })
    const results = taskType === 'DISPLAY_SAMPLE'
      ? (task.sampleRequirements || []).map((requirement, index) => ({
        title: `${task.taskName}-${marker}-${index + 1}`,
        version: `v-${marker}`,
        description: `${marker} 专项真实成果`,
        requirementLineId: requirement.requirementLineId,
        sampleQuantity: requirement.requiredQuantity,
        sampleColor: requirement.targetColor,
        sampleSize: requirement.targetSize,
        sourcePatternVersion: `v-${marker}`,
        files,
      }))
      : [{
        title: `${task.taskName}-${marker}`,
        version: `v-${marker}`,
        description: `${marker} 专项真实成果`,
        ...(taskType === 'BASE_PATTERN' ? { applicablePartOrSize: 'M 码' } : {}),
        files,
      }]
    current = submitEngineeringIndependentProfessionalTask({
      taskId: task.taskId,
      actor: executor,
      results,
      submittedAt: created.createdAt,
    })
    const submitted = current.professionalTasks.find((item) => item.taskId === task.taskId)!
    if (submitted.status === 'WAIT_REVIEW') {
      current = reviewEngineeringIndependentProfessionalTask({
        taskId: task.taskId,
        actor: buyer,
        decisions: submitted.results.map((result) => ({ resultId: result.resultId, approved: true })),
        reviewedAt: created.createdAt,
      })
    }
  }
  assert.equal(getEngineeringIndependentSamplingStep(current), 'RESULT_CONFIRMATION')
  if (!confirmedAt) return current
  return confirmEngineeringIndependentSamplingResult({
    samplingTaskId: created.samplingTaskId,
    actor: buyer,
    resultVersion: `v-${marker}`,
    resultSummary: `${marker} 整单成果`,
    confirmedAt,
  })
}

const oldResult = await createSampling('OLD', ['DISPLAY_SAMPLE', 'PATTERN_ARTWORK'], '2026-07-01 18:00:00')
const newResult = await createSampling('NEW', ['DISPLAY_SAMPLE', 'PATTERN_ARTWORK'], '2026-07-10 18:00:00')
const unconfirmed = await createSampling('PENDING', ['DISPLAY_SAMPLE'])

const reusable = listReusableEngineeringIndependentProfessionalResults(targetStyle.styleCode)
assert.ok(reusable.length >= 6, '两份已确认成果的专业任务必须可供生产准备单逐项选择')
assert.ok(reusable.every((item) => item.samplingTaskId !== unconfirmed.samplingTaskId), '未整单确认成果不得进入候选')
assert.ok(reusable.every((item) => item.completedAt), '专业任务自身未完成不得进入候选')

const candidates = listEngineeringMasterPriorResultCandidates(targetStyle.styleCode, 'PURE_WOVEN')
const baseCandidates = candidates.filter((item) => item.engineeringTaskType === 'BASE_PATTERN_WOVEN')
assert.equal(baseCandidates[0]?.source.samplingTaskId, newResult.samplingTaskId, '默认必须推荐最近确认版本')
assert.equal(baseCandidates[0]?.recommended, true)
assert.ok(baseCandidates.some((item) => item.source.samplingTaskId === oldResult.samplingTaskId), '跟单必须可以改选历史有效版本')

function createDraft(unique: string) {
  resetEngineeringMasterRepository()
  return createEngineeringMasterOrder({
    styleId: targetStyle.styleId,
    styleCode: targetStyle.styleCode,
    merchandiserId: merchandiser.userId,
    merchandiserName: merchandiser.userName,
    createdById: merchandiser.userId,
    createdBy: merchandiser.userName,
    createdByRole: merchandiser.role,
    preparationType: 'PURE_WOVEN',
    qualificationFact: {
      styleCode: targetStyle.styleCode,
      formalSaleStatus: 'NO_FORMAL_SALE',
      formalProductionStatus: 'NO_FORMAL_PRODUCTION',
      formalSaleSource: '销售事实',
      formalProductionSource: '生产事实',
      checkedAt: '2026-08-04 09:00:00',
    },
    bulkProductionQualification: {
      basisType: 'OTHER_CONFIRMED',
      triggerBusinessObjectType: '业务确认',
      triggerBusinessObjectId: unique,
      thresholdQuantity: null,
      reachedQuantity: null,
      reachedAt: '2026-08-04 09:00:00',
      reason: '满足大货要求',
      uniqueTriggerKey: unique,
    },
    creationReason: 'A6 专项验证',
  })
}

function decision(
  engineeringTaskType: EngineeringMasterPriorResultDecisionInput['engineeringTaskType'],
  sampling: EngineeringIndependentSamplingRecord,
  professionalTaskType: EngineeringIndependentProfessionalTaskType,
  choice: EngineeringMasterPriorResultDecisionInput['decision'],
): EngineeringMasterPriorResultDecisionInput {
  const sourceTask = sampling.professionalTasks.find((task) => task.taskType === professionalTaskType)!
  return {
    engineeringTaskType,
    sourceSamplingTaskId: sampling.samplingTaskId,
    sourceProfessionalTaskId: sourceTask.taskId,
    sourceResultVersion: sampling.resultVersion,
    decision: choice,
  }
}

const draft = createDraft('A6-NORMAL')
assert.equal(draft.sourceDesignRevisionTaskId, newResult.samplingTaskId, '生产准备单创建时必须锁定最近一张已完成设计改款')
assert.deepEqual(draft.sourceDesignFileIds, newResult.designFiles.map((file) => file.fileId), '设计稿必须与锁定的设计改款来源一致')
assert.throws(() => confirmEngineeringMasterTaskPlan(draft.masterOrderId, {
  confirmedBy: merchandiser.userName,
  confirmedById: merchandiser.userId,
  confirmedByRole: merchandiser.role,
  selectedConditionalTaskTypes: [],
  priorResultDecisions: [
    decision('BASE_PATTERN_WOVEN', oldResult, 'BASE_PATTERN', '复用'),
  ],
}), /版本已失效|不能采用/, '发布时不得改选另一张设计改款的基码纸样')
const confirmed = confirmEngineeringMasterTaskPlan(draft.masterOrderId, {
  confirmedBy: merchandiser.userName,
  confirmedById: merchandiser.userId,
  confirmedByRole: merchandiser.role,
  selectedConditionalTaskTypes: [],
  priorResultDecisions: [
    decision('BASE_PATTERN_WOVEN', newResult, 'BASE_PATTERN', '复用'),
    decision('PATTERN_ARTWORK', newResult, 'PATTERN_ARTWORK', '不采用'),
  ],
})
assert.equal(confirmed.priorResultReuseLines.length, 2)
const reusedLine = confirmed.priorResultReuseLines.find((line) => line.resultType === 'BASE_PATTERN_WOVEN')!
assert.equal(reusedLine.sourceSamplingTaskId, newResult.samplingTaskId, '基码纸样必须来自主单锁定的同一张设计改款')
assert.equal(reusedLine.sourceResultVersion, newResult.resultVersion)
assert.ok(confirmed.priorResultReuseLines.every((line) => line.sourceSamplingTaskId === newResult.samplingTaskId), '所有前期资料必须来自同一张设计改款')
assert.equal(reusedLine.confirmedById, merchandiser.userId)
assert.ok(reusedLine.confirmedAt)
assert.equal(confirmed.tasks.some((task) => task.taskType === 'BASE_PATTERN_WOVEN'), false, '生产准备阶段不得重复生成梭织基码纸样任务')
const redoneSample = confirmed.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')!
assert.equal(redoneSample.status, '待开始', '首单样衣必须作为生产准备单来源的新任务直接解锁')
assert.equal(redoneSample.sourceType, 'ENGINEERING_MASTER')
assert.deepEqual(redoneSample.dependencySatisfaction, [], '设计改款基码纸样以输入资料承接，不伪装成生产准备任务依赖')
assert.equal(confirmed.tasks.find((task) => task.taskType === 'SIZE_PATTERN_WOVEN')?.status, '待开始', '齐码纸样应与首单样衣并行解锁')
assert.equal(confirmed.tasks.find((task) => task.taskType === 'PATTERN_ARTWORK')?.status, '未启用', '不采用不得启用任务或满足依赖')
const inheritedBomSources = listEngineeringBomVersionsByOwner('ENGINEERING_MASTER', confirmed.masterOrderId)
  .map((version) => version.sourceVersionId ? getEngineeringBomVersionById(version.sourceVersionId) : null)
assert.ok(inheritedBomSources.length > 0)
assert.ok(inheritedBomSources.every((version) => version?.ownerStage === 'INDEPENDENT_SAMPLING' && version.ownerId === newResult.samplingTaskId), 'BOM 必须与设计稿、基码纸样来自同一张设计改款')

const detailHtml = renderPcsEngineeringMasterDetailPage(createDraft('A6-UI').masterOrderId)
assert.match(detailHtml, /前期资料/)
assert.match(detailHtml, /推荐/)
assert.match(detailHtml, /重新执行/)
assert.match(detailHtml, /不采用/)
assert.match(detailHtml, new RegExp(newResult.samplingTaskCode))
assert.doesNotMatch(detailHtml, new RegExp(oldResult.samplingTaskCode), '发布页面不得出现其他设计改款来源')

const blockedDraft = createDraft('A6-UNCONFIRMED')
assert.throws(() => confirmEngineeringMasterTaskPlan(blockedDraft.masterOrderId, {
  confirmedBy: merchandiser.userName,
  confirmedById: merchandiser.userId,
  confirmedByRole: merchandiser.role,
  selectedConditionalTaskTypes: [],
  priorResultDecisions: [
    decision('BASE_PATTERN_WOVEN', unconfirmed, 'BASE_PATTERN', '复用'),
    decision('PATTERN_ARTWORK', newResult, 'PATTERN_ARTWORK', '不采用'),
  ],
}), /未完成整单确认|不能采用/, '未确认成果必须由领域层阻断')
assert.equal(getEngineeringMasterOrderById(blockedDraft.masterOrderId)?.status, '草稿')

const dependencyDraft = createDraft('A6-DEPENDENCY')
assert.throws(() => confirmEngineeringMasterTaskPlan(dependencyDraft.masterOrderId, {
  confirmedBy: merchandiser.userName,
  confirmedById: merchandiser.userId,
  confirmedByRole: merchandiser.role,
  selectedConditionalTaskTypes: [],
  priorResultDecisions: [
    decision('BASE_PATTERN_WOVEN', newResult, 'BASE_PATTERN', '不采用'),
    decision('PATTERN_ARTWORK', newResult, 'PATTERN_ARTWORK', '不采用'),
  ],
}), /生产准备阶段不再新增基码纸样任务|请选择复用/, '生产准备必须承接设计改款基码纸样，不能选择不采用或重新生成')

console.log('pcs-engineering-prior-result-reuse.spec PASS')
