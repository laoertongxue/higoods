import assert from 'node:assert/strict'

import { CURRENT_PCS_ENGINEERING_USER } from '../src/data/pcs-engineering-current-user.ts'
import {
  confirmEngineeringIndependentSamplingPlan,
  confirmEngineeringIndependentSamplingResult,
  confirmEngineeringIndependentColorRequirement,
  createEngineeringIndependentSampling,
  getEngineeringIndependentSamplingRecord,
  listEngineeringIndependentSamplingRecords,
  listReusableEngineeringIndependentSamplingResults,
  resetEngineeringIndependentSamplingRepository,
  resolveEngineeringIndependentSamplingBomLines,
  reviewEngineeringIndependentProfessionalTask,
  startEngineeringIndependentProfessionalTask,
  submitEngineeringIndependentProfessionalTask,
} from '../src/data/pcs-engineering-master-sampling.ts'
import { confirmEngineeringBomVersion, getEngineeringBomVersionById, saveEngineeringBomVersion } from '../src/data/pcs-engineering-bom-repository.ts'
import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'

resetStyleArchiveRepository()
resetEngineeringIndependentSamplingRepository(false)
const styles = listStyleArchives().filter((item) => item.mainImageUrl)
assert.ok(styles.length >= 2)

assert.throws(() => createEngineeringIndependentSampling({ samplingType: 'REVISION', sourceStyleId: styles[0].styleId, targetStyleId: styles[0].styleId, merchandiser: CURRENT_PCS_ENGINEERING_USER, selectedTaskTypes: [], createdAt: '2026-08-04 09:00:00' }), /不能相同/)
assert.throws(() => createEngineeringIndependentSampling({ samplingType: 'DESIGN', sourceStyleId: styles[0].styleId, targetStyleId: styles[1].styleId, merchandiser: CURRENT_PCS_ENGINEERING_USER, selectedTaskTypes: [], createdAt: '2026-08-04 09:00:00' }), /不应填写来源/)
assert.throws(() => createEngineeringIndependentSampling({ samplingType: 'DESIGN', targetStyleId: styles[1].styleId, merchandiser: CURRENT_PCS_ENGINEERING_USER, selectedTaskTypes: [], createdAt: '2026-08-04 09:00:00' }), /至少选择一个专业任务/)

const record = createEngineeringIndependentSampling({ samplingType: 'REVISION', sourceStyleId: styles[0].styleId, targetStyleId: styles[1].styleId, merchandiser: CURRENT_PCS_ENGINEERING_USER, selectedTaskTypes: ['DISPLAY_SAMPLE', 'PATTERN_ARTWORK'], createdAt: '2026-08-04 09:00:00' })
assert.equal(record.status, 'DRAFT')
assert.equal(record.professionalTasks.length, 0, '跟单确认前不得生成真实专业任务')
const independentBom = getEngineeringBomVersionById(record.bomVersionIds[0])!
assert.equal(independentBom.materialLines.length, 1, '独立打样必须自动创建可读取的集中 BOM 草稿')
const bomItemId = independentBom.materialLines[0].bomItemId!
const nextBomLines = independentBom.materialLines.map((line) => line.bomItemId === bomItemId ? { ...line, usage: 1.25, sampleQuantity: 3, lossRate: 0.1 } : line)
assert.throws(() => saveEngineeringBomVersion({ versionId: independentBom.bomDraftVersionId, role: '跟单', userId: CURRENT_PCS_ENGINEERING_USER.userId, userName: CURRENT_PCS_ENGINEERING_USER.userName, materialLines: nextBomLines, customCosts: [] }), /只有买手/)
saveEngineeringBomVersion({ versionId: independentBom.bomDraftVersionId, role: '买手', userId: 'BUYER-1', userName: '买手-王明', materialLines: nextBomLines, customCosts: [] })
confirmEngineeringBomVersion({ versionId: independentBom.bomDraftVersionId, role: '买手', userId: 'BUYER-1', userName: '买手-王明' })
record.bomVersionIds.slice(1).forEach((versionId) => {
  const version = getEngineeringBomVersionById(versionId)!
  saveEngineeringBomVersion({
    versionId,
    role: '买手',
    userId: 'BUYER-1',
    userName: '买手-王明',
    materialLines: nextBomLines.map((line, index) => ({ ...line, bomItemId: `${versionId}-LINE-${index + 1}`, applicableSkuIds: [...version.applicableSkuIds] })),
    customCosts: [],
  })
  confirmEngineeringBomVersion({ versionId, role: '买手', userId: 'BUYER-1', userName: '买手-王明' })
})
const resolvedBomLine = resolveEngineeringIndependentSamplingBomLines(record)[0]
assert.equal(resolvedBomLine.totalRequirementQuantity, 4.125, '总需求量必须按单位用量 × 打样数量 ×（1 + 损耗率）计算')
assert.equal(resolvedBomLine.standardUnitPriceCurrency, 'CNY')
assert.ok(resolvedBomLine.materialImageUrl, 'BOM 物料必须带真实对应图片')
const planned = confirmEngineeringIndependentSamplingPlan({ samplingTaskId: record.samplingTaskId, actor: CURRENT_PCS_ENGINEERING_USER, selectedTaskTypes: ['DISPLAY_SAMPLE', 'PATTERN_ARTWORK'], confirmedAt: '2026-08-04 09:10:00' })
assert.deepEqual(new Set(planned.professionalTasks.map((task) => task.taskType)), new Set(['BASE_PATTERN', 'DISPLAY_SAMPLE', 'PATTERN_ARTWORK']), '选版衣必须自动补齐基码纸样')
const base = planned.professionalTasks.find((task) => task.taskType === 'BASE_PATTERN')!
const sample = planned.professionalTasks.find((task) => task.taskType === 'DISPLAY_SAMPLE')!
const pattern = planned.professionalTasks.find((task) => task.taskType === 'PATTERN_ARTWORK')!
assert.equal(sample.status, 'WAIT_DEPENDENCY')

const patternMaker = { role: '版师', userId: 'PATTERN-1', userName: '版师-赵云' }
const sampleMaker = { role: '制作团队', userId: 'SAMPLE-1', userName: '样衣制作-阿兰' }
const artworkMaker = { role: '花型团队', userId: 'ARTWORK-1', userName: '花型-冰冰' }
startEngineeringIndependentProfessionalTask({ taskId: base.taskId, actor: patternMaker, startedAt: '2026-08-04 10:00:00' })
submitEngineeringIndependentProfessionalTask({ taskId: base.taskId, actor: patternMaker, resultTitles: ['基码纸样 v1'], resultImageUrls: [styles[1].mainImageUrl], submittedAt: '2026-08-04 11:00:00' })
assert.equal(getEngineeringIndependentSamplingRecord(record.samplingTaskId)!.professionalTasks.find((task) => task.taskId === sample.taskId)!.status, 'WAIT_START')
startEngineeringIndependentProfessionalTask({ taskId: sample.taskId, actor: sampleMaker })
submitEngineeringIndependentProfessionalTask({ taskId: sample.taskId, actor: sampleMaker, resultTitles: ['展示样衣'], resultImageUrls: [styles[1].mainImageUrl] })
startEngineeringIndependentProfessionalTask({ taskId: pattern.taskId, actor: artworkMaker })
submitEngineeringIndependentProfessionalTask({ taskId: pattern.taskId, actor: artworkMaker, resultTitles: ['花型 A', '花型 B'], resultImageUrls: [styles[0].mainImageUrl, styles[1].mainImageUrl] })
let current = getEngineeringIndependentSamplingRecord(record.samplingTaskId)!
let patternTask = current.professionalTasks.find((task) => task.taskId === pattern.taskId)!
assert.equal(patternTask.status, 'WAIT_REVIEW')
reviewEngineeringIndependentProfessionalTask({ taskId: pattern.taskId, actor: { role: '买手', userId: 'BUYER-1', userName: '买手-王明' }, decisions: patternTask.results.map((result, index) => ({ resultId: result.resultId, approved: index === 0, reason: index ? '花色偏深' : '' })) })
current = getEngineeringIndependentSamplingRecord(record.samplingTaskId)!
patternTask = current.professionalTasks.find((task) => task.taskId === pattern.taskId)!
assert.equal(patternTask.status, 'REWORK')
assert.equal(patternTask.results[1].rejectReason, '花色偏深')
submitEngineeringIndependentProfessionalTask({ taskId: pattern.taskId, actor: artworkMaker, resultTitles: ['花型 B 改进版'], resultImageUrls: [styles[1].mainImageUrl] })
patternTask = getEngineeringIndependentSamplingRecord(record.samplingTaskId)!.professionalTasks.find((task) => task.taskId === pattern.taskId)!
reviewEngineeringIndependentProfessionalTask({ taskId: pattern.taskId, actor: { role: '买手', userId: 'BUYER-1', userName: '买手-王明' }, decisions: patternTask.results.map((result) => ({ resultId: result.resultId, approved: true })) })
assert.equal(getEngineeringIndependentSamplingRecord(record.samplingTaskId)!.status, 'WAIT_CONFIRMATION')
confirmEngineeringIndependentSamplingResult({ samplingTaskId: record.samplingTaskId, actor: CURRENT_PCS_ENGINEERING_USER, resultVersion: 'v1.0', resultSummary: '改款打样成果已确认', confirmedAt: '2026-08-04 18:00:00' })
assert.equal(listReusableEngineeringIndependentSamplingResults(styles[1].styleCode)[0].samplingTaskId, record.samplingTaskId)
assert.equal(listEngineeringIndependentSamplingRecords('DESIGN').length, 0)

const colorRecord = createEngineeringIndependentSampling({ samplingType: 'DESIGN', targetStyleId: styles[0].styleId, merchandiser: CURRENT_PCS_ENGINEERING_USER, selectedTaskTypes: ['COLOR_FABRIC'], createdAt: '2026-08-04 19:00:00' })
const colorPlan = confirmEngineeringIndependentSamplingPlan({ samplingTaskId: colorRecord.samplingTaskId, actor: CURRENT_PCS_ENGINEERING_USER, selectedTaskTypes: ['COLOR_FABRIC'] })
const colorTask = colorPlan.professionalTasks[0]
const dyeFactory = { role: '染厂', userId: 'DYE-1', userName: '染厂-陈师傅' }
startEngineeringIndependentProfessionalTask({ taskId: colorTask.taskId, actor: dyeFactory })
assert.throws(() => submitEngineeringIndependentProfessionalTask({ taskId: colorTask.taskId, actor: dyeFactory, resultTitles: ['面料色样'], resultImageUrls: [styles[0].mainImageUrl], dyeColorCode: 'DYE-01' }), /先由跟单确认/)
confirmEngineeringIndependentColorRequirement({ taskId: colorTask.taskId, actor: CURRENT_PCS_ENGINEERING_USER, pantoneColorCode: '18-1664 TCX', colorName: '火焰红' })
submitEngineeringIndependentProfessionalTask({ taskId: colorTask.taskId, actor: dyeFactory, resultTitles: ['面料色样'], resultImageUrls: [styles[0].mainImageUrl], dyeColorCode: 'DYE-01' })
const waitingColor = getEngineeringIndependentSamplingRecord(colorRecord.samplingTaskId)!.professionalTasks[0]
assert.equal(waitingColor.status, 'WAIT_REVIEW')
assert.throws(() => reviewEngineeringIndependentProfessionalTask({ taskId: colorTask.taskId, actor: { role: '买手', userId: 'BUYER-1', userName: '买手-王明' }, decisions: [{ resultId: waitingColor.results[0].resultId, approved: false }] }), /未通过原因/)

console.log('pcs-independent-sampling.spec PASS')
