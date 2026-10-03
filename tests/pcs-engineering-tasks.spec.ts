import { resetAndGetProductionPreparationStyle } from './helpers/pcs-engineering-design-revision-fixture.ts'
import { listEngineeringMasterPriorResultCandidates } from '../src/data/pcs-engineering-master-repository.ts'
import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  submitEngineeringTaskResult,
} from '../src/data/pcs-engineering-master-repository.ts'
import { submitEngineeringPatternResult } from '../src/data/pcs-engineering-pattern-result.ts'
import {
  handlePcsEngineeringTaskEvent,
  renderPcsFirstOrderSampleTaskDetailPage,
  renderPcsFirstOrderSampleTaskPage,
  renderPcsFirstSampleTaskDetailPage,
  renderPcsFirstSampleTaskPage,
  renderPcsPatternTaskDetailPage,
  renderPcsPatternTaskPage,
  renderPcsPlateMakingTaskDetailPage,
  renderPcsPlateMakingTaskPage,
  resetPcsEngineeringTaskRepositories,
  resetPcsEngineeringTaskState,
  submitEngineeringFirstSampleResult,
} from '../src/pages/pcs-engineering-tasks.ts'



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

function makeActionTarget(action: string, extraDataset: Record<string, string> = {}): HTMLElement {
  return {
    dataset: { pcsEngineeringAction: action, ...extraDataset },
    closest(selector: string) {
      if (selector === '[data-pcs-engineering-action]') return this
      if (selector === '[data-pcs-engineering-list-module]' && this.dataset.pcsEngineeringListModule) return this
      return null
    },
  } as unknown as HTMLElement
}

function masterTaskId(masterOrderId: string, taskType: string): string {
  return `${masterOrderId}-${taskType}`
}

resetStyleArchiveRepository()
resetEngineeringMasterRepository()
resetPcsEngineeringTaskRepositories()
resetPcsEngineeringTaskState()

const style = resetAndGetProductionPreparationStyle()
assert.ok(style, '应存在用于生产准备单的款式档案')
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'USER-MERCHANDISER',
  merchandiserName: '跟单回归测试',
  createdById: 'USER-MERCHANDISER',
  createdBy: '跟单回归测试',
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
    triggerBusinessObjectId: `TASKS-${style.styleCode}`,
    thresholdQuantity: 300,
    reachedQuantity: 320,
    reachedAt: '2026-08-13 09:00:00',
    reason: '已满足做大货要求',
    uniqueTriggerKey: `TASKS-${style.styleCode}`,
  },
  creationReason: '验证工程专业任务页面',
}).masterOrderId)

const plateTaskId = masterTaskId(master.masterOrderId, 'SIZE_PATTERN_WOVEN')
const knitPlateTaskId = masterTaskId(master.masterOrderId, 'SIZE_PATTERN_KNIT')
const patternTaskId = masterTaskId(master.masterOrderId, 'PATTERN_ARTWORK')
const sampleTaskId = masterTaskId(master.masterOrderId, 'PRE_PRODUCTION_SAMPLE')

// 三个专业页只读取同一生产准备单生成的任务 ID 和状态，不能再各自读取旧仓库。
const plateListHtml = renderPcsPlateMakingTaskPage()
const patternListHtml = renderPcsPatternTaskPage()
const sampleListHtml = renderPcsFirstSampleTaskPage()
for (const [html, taskId, title] of [
  [plateListHtml, plateTaskId, '制版任务'],
  [patternListHtml, patternTaskId, '花型任务'],
  [sampleListHtml, sampleTaskId, '首单样衣任务'],
] as const) {
  assert.match(html, new RegExp(title), `${title}页面应使用当前业务名称`)
  assert.ok(html.includes(taskId), `${title}页面应展示生产准备单任务 ID`)
  assert.ok(html.includes(master.masterOrderCode), `${title}页面应展示所属生产准备单`)
}
assert.match(patternListHtml, /未启用/, '未带入印花物料时花型任务应保持未启用')
assert.doesNotMatch(sampleListHtml, /首版样衣|首单确认|验收与结论/, '首单样衣页面不应保留旧样衣事实或验收')

// 制版成果提交即完成，并为首单样衣解锁其全部固定前置。
startTaskFixture(plateTaskId)
const patternVersion = submitEngineeringPatternResult({
  masterOrderId: master.masterOrderId,
  taskId: plateTaskId,
  applicableSizes: ['M'],
  sourceFiles: [{ fileId: `${plateTaskId}-PRJ`, purpose: 'PATTERN_SOURCE', fileName: '基码纸样.prj', extension: 'prj', mimeType: 'application/octet-stream', sizeBytes: 8, dataUrl: 'data:application/octet-stream;base64,SElHT09E', status: '已保存', uploadedById: 'PATTERN-01', uploadedByName: '版师负责人', uploadedByTeam: '版师', uploadedAt: '2026-08-13 10:00:00', roundNo: 1, errorMessage: '' }],
  previewFiles: [{ fileId: `${plateTaskId}-IMAGE`, purpose: 'PATTERN_PREVIEW', fileName: '基码纸样.jpg', extension: 'jpg', mimeType: 'image/jpeg', sizeBytes: 4, dataUrl: 'data:image/jpeg;base64,/9j/2Q==', status: '已保存', uploadedById: 'PATTERN-01', uploadedByName: '版师负责人', uploadedByTeam: '版师', uploadedAt: '2026-08-13 10:00:00', roundNo: 1, errorMessage: '' }],
  note: '工程专业任务回归纸样',
  submittedBy: '版师负责人',
})
assert.equal(getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === plateTaskId)?.status, '已完成', '制版任务提交真实纸样成果即完成')
const plateDetailHtml = renderPcsPlateMakingTaskDetailPage(plateTaskId)
assert.match(plateDetailHtml, /已完成/, '制版详情应读取生产准备单完成状态')

// 花型任务的提交目标为待审核；当前未带入印花物料时，提交必须被真实门禁阻止。
assert.throws(
  () => submitEngineeringTaskResult(master.masterOrderId, patternTaskId),
  /未启用/,
  '未满足 BOM 印花条件的花型任务不得伪造为已提交',
)
const patternDetailHtml = renderPcsPatternTaskDetailPage(patternTaskId)
assert.match(patternDetailHtml, /未启用/, '花型详情应读取生产准备单任务状态')

// 首单样衣只接受完整成果；制作团队提交后即完成，无任务级验收。
startTaskFixture(sampleTaskId)
await assert.rejects(
  () => submitInBrowser(sampleTaskId, { sampleActuals: [] }),
  /逐行填写首单样衣实际交付/,
  '首单样衣成果必须包含图片',
)
const sampleRequirements = master.tasks.find((task) => task.taskId === sampleTaskId)?.sampleRequirements || []
const sampleActuals = sampleRequirements.map((requirement, index) => ({
  actualLineId: `${sampleTaskId}-TEST-ACTUAL-${index + 1}`,
  requirementLineId: requirement.requirementLineId,
  actualColor: requirement.targetColor,
  actualSize: requirement.targetSize,
  actualQuantity: requirement.requiredQuantity,
  sourcePatternVersion: `梭织基码纸样 ${listEngineeringMasterPriorResultCandidates(style.styleCode, 'PURE_WOVEN').find(item => item.engineeringTaskType === 'BASE_PATTERN_WOVEN')!.source.resultVersion}`,
  productionNote: '按跟单要求完成',
  differenceNote: '',
  imageFileIds: [style.mainImageUrl],
  submittedBy: '制作团队A',
}))
const sampleResult = await submitInBrowser(sampleTaskId, {
  sampleActuals,
})
assert.equal(sampleResult.status, '已完成', '完整首单样衣成果提交后应完成任务')
assert.equal(sampleResult.sampleActuals?.length, sampleRequirements.length)
assert.equal(sampleResult.resultSubmittedBy, '制作团队A')
const sampleDetailHtml = renderPcsFirstSampleTaskDetailPage(sampleTaskId)
assert.match(sampleDetailHtml, /样衣实际交付/, '首单样衣详情应读取逐行实际交付成果')
assert.match(sampleDetailHtml, /制作团队A/, '首单样衣详情应读取成果提交人')
assert.doesNotMatch(sampleDetailHtml, /验收|首单确认/, '首单样衣详情不应出现旧验收或首单确认')

// 首单旧路由只是静默别名，必须与首单样衣共用同一任务详情和业务文案。
assert.equal(renderPcsFirstOrderSampleTaskPage(), renderPcsFirstSampleTaskPage(), '首单任务列表入口应静默复用首单样衣页面')
assert.equal(
  renderPcsFirstOrderSampleTaskDetailPage(sampleTaskId),
  renderPcsFirstSampleTaskDetailPage(sampleTaskId),
  '首单任务详情入口应静默复用首单样衣详情',
)

// 统一事件入口继续处理标准列表轻交互；成果提交走专业页公开动作而非已删除的旧事件名。
const quickFilterTarget = makeActionTarget('set-first-sample-quick-filter', {
  pcsEngineeringListModule: 'firstSample',
  quickFilter: 'completed',
})
assert.equal(await handlePcsEngineeringTaskEvent(quickFilterTarget), true, '统一事件入口应处理首单样衣列表快捷筛选')
assert.match(renderPcsFirstSampleTaskPage(), /已完成/, '快捷筛选后的列表应仍显示当前工程任务状态')

const storedMaster = getEngineeringMasterOrderById(master.masterOrderId)
assert.equal(storedMaster?.tasks.find((task) => task.taskId === sampleTaskId)?.status, '已完成', '专业页面提交必须写回生产准备单唯一事实源')
await transactionBrowser.close()
console.log('pcs-engineering-tasks.spec.ts PASS')
