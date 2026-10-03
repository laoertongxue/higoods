import assert from 'node:assert/strict'

import { getStyleArchiveById, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  confirmEngineeringMasterTaskPlan,
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  listEngineeringMasterPriorResultCandidates,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  listEngineeringIndependentSamplingRecords,
  resetEngineeringIndependentSamplingRepository,
} from '../src/data/pcs-engineering-master-sampling.ts'
import {
  renderPcsFirstSampleTaskDetailPage,
  submitEngineeringFirstSampleResult,
} from '../src/pages/pcs-engineering-tasks/first-sample-task.ts'



import { chromium } from '@playwright/test'
import { PCS_LEGACY_KEYS, pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import { getEngineeringMasterOrderStoreSnapshot, startEngineeringTask, updateEngineeringTaskRecord } from '../src/data/pcs-engineering-master-repository.ts'
import { getEngineeringTeamCurrentOperator } from '../src/data/pcs-engineering-team-directory.ts'
const transactionBrowser = await chromium.launch({ headless: true })
const transactionPage = await transactionBrowser.newPage()
await transactionPage.addInitScript('globalThis.__name = (value) => value')
let browserHydrated = false
function startTaskFixture(taskId: string) {
  const owner = getEngineeringMasterOrderStoreSnapshot().records.find(item => item.tasks.some(task => task.taskId === taskId))!
  const task = owner.tasks.find(task => task.taskId === taskId)!
  const operator = getEngineeringTeamCurrentOperator(task.ownerTeamName)
  startEngineeringTask({ masterOrderId: owner.masterOrderId, taskId, operatorId: operator.operatorId, operatorName: operator.operatorName })
}
async function submitInBrowser(taskId: string, input: Parameters<typeof submitEngineeringFirstSampleResult>[1]) {
  if (!browserHydrated) {
    await transactionPage.goto('http://127.0.0.1:5173/pcs/testing/orders')
    await transactionPage.getByRole('heading', { name: '测款单', exact: true }).waitFor()
    const snapshots = PCS_LEGACY_KEYS.map(key => [key, pcsRecordStore.getItem(key)]).filter(([,raw]) => raw !== null)
    await transactionPage.evaluate(async ({ snapshots, nativeEntries }) => {
      const rt = await import('/src/data/pcs-record-runtime.ts')
      await rt.ensurePcsRecordState()
      for (const [key, raw] of nativeEntries) localStorage.setItem(key, raw)
      await rt.runPcsRecordCommand(() => { for (const [key, raw] of snapshots) rt.pcsRecordStore.setItem(key, raw) })
    }, { snapshots, nativeEntries: [...storage].filter(([key]) => !(PCS_LEGACY_KEYS as readonly string[]).includes(key)) })
    browserHydrated = true
  }
  const result = await transactionPage.evaluate(async ({ taskId, input }) => {
    const db = await import('/src/data/pcs-record-db.ts')
    const before = JSON.stringify((await db.readPcsRecords()).records)
    try {
      const result = await (await import('/src/pages/pcs-engineering-tasks/first-sample-task.ts')).submitEngineeringFirstSampleResult(taskId, input)
      const saved = (await import('/src/data/pcs-engineering-master-repository.ts')).getEngineeringMasterOrderById(result.masterOrderId)!
      if (saved.tasks.find(task => task.taskId === taskId)?.status !== result.status) throw new Error('提交结果未发布至持久工作副本')
      const savedTask = saved.tasks.find(task => task.taskId === taskId)!
      if (savedTask.resultQuantity !== result.resultQuantity || savedTask.sampleActuals?.length !== result.sampleActuals?.length || savedTask.resultSubmittedBy !== result.resultSubmittedBy) throw new Error('实际交付未完整保存')
      return { result }
    } catch (error) {
      if (JSON.stringify((await db.readPcsRecords()).records) !== before) throw new Error('失败提交改写了已有记录: ' + String(error))
      return { error: String(error) }
    }
  }, { taskId, input })
  if (result.error) throw new Error(result.error)
  updateEngineeringTaskRecord(result.result!.masterOrderId, taskId, task => Object.assign(task, result.result))
  return result.result!
}

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, String(value)) },
    removeItem: (key: string) => { storage.delete(key) },
    clear: () => { storage.clear() },
  },
})

resetStyleArchiveRepository()
resetEngineeringIndependentSamplingRepository(true)
resetEngineeringMasterRepository()

const designRevision = listEngineeringIndependentSamplingRecords().find((record) =>
  record.status === 'COMPLETED' && record.targetMode === 'ARCHIVED_STYLE'
  && (record.patternHandling === 'REUSE' || record.professionalTasks.some((task) => task.taskType === 'BASE_PATTERN' && task.status === 'COMPLETED')),
)
assert.ok(designRevision, '应存在已完成且含真实基码纸样的设计改款')
const style = getStyleArchiveById(designRevision.targetStyleId)
assert.ok(style?.mainImageUrl)
const draft = createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'USER-MERCHANDISER',
  merchandiserName: '跟单A',
  createdById: 'USER-MERCHANDISER',
  createdBy: '跟单A',
  createdByRole: '跟单',
  preparationType: 'PURE_WOVEN',
  qualificationFact: {
    styleCode: style.styleCode,
    formalSaleStatus: 'NO_FORMAL_SALE',
    formalProductionStatus: 'NO_FORMAL_PRODUCTION',
    formalSaleSource: '正式销售订单事实',
    formalProductionSource: '正式生产单事实',
    checkedAt: '2026-08-13 09:00:00',
  },
  bulkProductionQualification: {
    basisType: 'TEST_APPROVED',
    triggerBusinessObjectType: '测款结果',
    triggerBusinessObjectId: designRevision.samplingTaskId,
    thresholdQuantity: 300,
    reachedQuantity: 320,
    reachedAt: '2026-08-13 09:00:00',
    reason: '已满足做大货要求',
    uniqueTriggerKey: `FIRST-SAMPLE-${style.styleCode}`,
  },
  creationReason: '验证首单样衣逐行实际交付',
})
const baseCandidate = listEngineeringMasterPriorResultCandidates(style.styleCode, 'PURE_WOVEN', designRevision.samplingTaskId)
  .find((candidate) => candidate.engineeringTaskType === 'BASE_PATTERN_WOVEN')
assert.ok(baseCandidate)
const master = confirmEngineeringMasterTaskPlan(draft.masterOrderId, {
  confirmedBy: '跟单A',
  confirmedById: 'USER-MERCHANDISER',
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
const sourcePatternVersion = `梭织基码纸样 ${baseCandidate.source.resultVersion}`

const taskId = `${master.masterOrderId}-PRE_PRODUCTION_SAMPLE`
startTaskFixture(taskId)
const sampleTask = master.tasks.find((task) => task.taskId === taskId)
assert.ok(sampleTask)
const requirements = sampleTask.sampleRequirements || []
assert.ok(requirements.length > 0)
const imageUrl = style.mainImageUrl
const makeActuals = () => requirements.map((requirement, index) => ({
  actualLineId: `${taskId}-TEST-ACTUAL-${index + 1}`,
  requirementLineId: requirement.requirementLineId,
  actualColor: requirement.targetColor,
  actualSize: requirement.targetSize,
  actualQuantity: requirement.requiredQuantity,
  sourcePatternVersion,
  productionNote: '按跟单要求制作',
  differenceNote: '',
  imageFileIds: [imageUrl],
  submittedBy: '制作团队A',
}))
await assert.rejects(
  () => submitInBrowser(taskId, {
    sampleActuals: makeActuals().map((line, index) => index === 0 ? { ...line, imageFileIds: [] } : line),
  }),
  /必须上传真实样衣图片/,
)
await assert.rejects(
  () => submitInBrowser(taskId, {
    sampleActuals: makeActuals().map((line, index) => index === 0 ? { ...line, actualQuantity: 0 } : line),
  }),
  /实际数量必须为大于 0 的整数/,
)
await assert.rejects(
  () => submitInBrowser(taskId, {
    sampleActuals: makeActuals().map((line, index) => index === 0 ? { ...line, submittedBy: '   ' } : line),
  }),
  /请填写首单样衣成果提交人/,
)
const submitted = await submitInBrowser(taskId, {
  sampleActuals: makeActuals(),
})

assert.equal(submitted.status, '已完成')
assert.equal(submitted.sampleActuals?.length, requirements.length)
assert.equal(submitted.resultImageIds.length, requirements.length)
assert.equal(submitted.resultQuantity, requirements.reduce((sum, line) => sum + line.requiredQuantity, 0))
assert.equal(submitted.resultSubmittedBy, '制作团队A')
assert.ok(submitted.submittedAt)
assert.ok(submitted.startedAt)

const stored = getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === taskId)
assert.deepEqual(stored, submitted)

const html = renderPcsFirstSampleTaskDetailPage(taskId)
assert.match(html, /已完成/)
assert.match(html, new RegExp(`要求 ${requirements.reduce((sum, line) => sum + line.requiredQuantity, 0)} 件`))
assert.match(html, /样衣实际交付/)
assert.doesNotMatch(html, /验收|待确认|确认人|首单复用|需改版/)

await transactionBrowser.close()
console.log('pcs-first-sample-engineering-result.spec.ts PASS')
