import assert from 'node:assert/strict'
import {
  listFactoryMasterRecords,
  removeFactoryMasterRecord,
  upsertFactoryMasterRecord,
} from '../src/data/fcs/factory-master-store.ts'

class MemoryStorage {
  private readonly values = new Map<string, string>()
  throwOnSet = false

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) throw new Error('quota exceeded')
    this.values.set(key, value)
  }
}

const storage = new MemoryStorage()
;(globalThis as typeof globalThis & { window?: { localStorage: MemoryStorage } }).window = { localStorage: storage }
const assessmentModuleUrl = new URL('../src/data/fcs/third-party-factory-comprehensive-assessment.ts', import.meta.url).href
let moduleLoadCount = 0
const loadAssessmentModule = () => import(`${assessmentModuleUrl}?storage-check=${moduleLoadCount++}`)
const assessmentModule = await loadAssessmentModule()
const {
  WOMENSWEAR_CATEGORY_OPTIONS,
  calculateFactoryQualityMetrics,
  calculateFactoryTimelinessMetrics,
  getAssessmentCompletion,
  getThirdPartyFactoryComprehensiveAssessment,
  listThirdPartyFactoryComprehensiveAssessments,
  updateThirdPartyFactoryManualAssessment,
  THIRD_PARTY_COMPREHENSIVE_ASSESSMENT_STORAGE_KEY,
} = assessmentModule

assert.deepEqual(WOMENSWEAR_CATEGORY_OPTIONS, [
  '衬衫', 'T 恤', '马甲', '背心', '连衣裙', '休闲连体裤', '西装连体裤', '休闲套装', '西装套装', '裤子', '半裙',
], '女装品类字典必须精确匹配综合评定口径')

const masterFactories = listFactoryMasterRecords().filter(
  (factory) => factory.factoryTier === 'THIRD_PARTY' &&
    (factory.factoryType === 'THIRD_SEWING' || factory.processAbilities.some((ability) => ability.processCode === 'SEW')),
)
const assessments = listThirdPartyFactoryComprehensiveAssessments()
assert.deepEqual(
  new Set(assessments.map((item) => item.factoryId)),
  new Set(masterFactories.map((item) => item.id)),
  '综合评定必须覆盖且只覆盖工厂主档中的三方车缝工厂',
)
for (const master of masterFactories) {
  const assessment = getThirdPartyFactoryComprehensiveAssessment(master.id)
  assert.ok(assessment, `${master.id} 必须可按真实主档 ID 查询`)
  assert.equal(assessment.factoryCode, master.code, `${master.id} 工厂编码必须来自主档`)
  assert.equal(assessment.factoryName, master.name, `${master.id} 工厂名称必须来自主档`)
  assert.ok(assessment.fieldSources.factoryName.includes('工厂主档'), `${master.id} 必须标识主档来源`)
  assert.ok(assessment.fieldSources.timeliness.includes('系统'), `${master.id} 时效必须标识系统事实来源`)
  assert.ok(assessment.fieldSources.quality.includes('系统'), `${master.id} 品控必须标识系统事实来源`)
}

const quality = calculateFactoryQualityMetrics([
  { factoryId: 'quality-case', inspectedQty: 100, reworkQty: 4, factoryLiabilityDefectQty: 2 },
  { factoryId: 'quality-case', inspectedQty: 100, reworkQty: 6, factoryLiabilityDefectQty: 8 },
])
assert.deepEqual(quality, { defectiveRate: 0.1, defectRate: 0.05, reworkRate: 0.05 }, '品控必须先汇总数量再计算四位小数比例')
assert.deepEqual(
  calculateFactoryQualityMetrics([{ factoryId: 'empty-quality', inspectedQty: 0, reworkQty: 3, factoryLiabilityDefectQty: 2 }]),
  { defectiveRate: null, defectRate: null, reworkRate: null },
  '零质检不得伪造成零不良率',
)

const acceptedAt = '2026-07-01T00:00:00.000Z'
const onTimeTimeliness = calculateFactoryTimelinessMetrics([{
  factoryId: 'timeliness-case', allocatedQty: 100, acceptedAt, taskKind: 'INDEPENDENT_SEWING', submittedQty: 100,
  submittedReachedAt: '2026-07-05T00:00:00.000Z',
  receiptMilestones: { 30: '2026-07-05T00:00:00.000Z', 70: '2026-07-09T00:00:00.000Z', 100: '2026-07-10T00:00:00.000Z' },
}], new Date('2026-07-20T00:00:00.000Z'))
assert.deepEqual(onTimeTimeliness, {
  deliveryOnTimeRate: 1, receipt30OnTimeRate: 1, receipt70OnTimeRate: 1, receipt100OnTimeRate: 1,
}, '独立车缝按节点完成时必须全部准时')
assert.deepEqual(
  calculateFactoryTimelinessMetrics([{
    factoryId: 'future-case', allocatedQty: 100, acceptedAt, taskKind: 'INDEPENDENT_SEWING', submittedQty: 0,
    submittedReachedAt: null, receiptMilestones: { 30: null, 70: null, 100: null },
  }], new Date('2026-07-03T00:00:00.000Z')),
  { deliveryOnTimeRate: null, receipt30OnTimeRate: null, receipt70OnTimeRate: null, receipt100OnTimeRate: null },
  '未到截止且未达标的节点不得进入时效分母或伪造零值',
)

const complete = getAssessmentCompletion({
  categoryAbilities: ['衬衫'], processAbilities: ['车缝'], machineCount: 1, workerCount: 1,
  monthlyOutputValueTenThousandIdr: 1, grade: 'S', timeliness: onTimeTimeliness, quality,
})
assert.deepEqual(complete, { ability: true, capacity: true, timeliness: true, quality: true, grade: true, incompleteCount: 0 }, '完整评定必须全部完成')
assert.equal(
  getAssessmentCompletion({ ...complete, categoryAbilities: [], processAbilities: ['车缝'], machineCount: 1, workerCount: 1, monthlyOutputValueTenThousandIdr: 1, grade: null, timeliness: onTimeTimeliness, quality }).incompleteCount,
  2,
  '缺品类和评级必须各计为一个未完成维度',
)

assert.ok(assessments.some((item) => item.completion.incompleteCount === 0 && item.grade === 'S'), '必须有完整 S 级样例')
assert.ok(assessments.some((item) => item.completion.incompleteCount === 0 && item.grade === 'A'), '必须有完整 A 级样例')
assert.ok(assessments.some((item) => !item.completion.capacity), '必须有产能缺失样例')
assert.ok(assessments.some((item) => !item.completion.ability && item.categoryAbilities.length === 0), '必须有品类缺失样例')
assert.ok(assessments.some((item) => !item.completion.timeliness), '必须有无时效数据样例')
assert.ok(assessments.some((item) => !item.completion.quality), '必须有无质检数据样例')
assert.ok(assessments.some((item) => item.timeliness.deliveryOnTimeRate === 0 && item.quality.defectiveRate !== null && item.quality.defectiveRate <= 0.03), '必须有时效差品控好样例')
assert.ok(assessments.some((item) => item.timeliness.deliveryOnTimeRate === 1 && item.quality.defectiveRate !== null && item.quality.defectiveRate >= 0.1), '必须有品控差时效好样例')
assert.ok(assessments.some((item) => item.grade === null), '必须有评级缺失样例')
assert.ok(assessments.every((item) => item.processAbilities.length > 0), '当前全部真实三方车缝主档均有工艺能力，综合评定不得伪造工艺缺失')

const updateTarget = assessments[0]
const before = getThirdPartyFactoryComprehensiveAssessment(updateTarget.factoryId)!
const updateResult = updateThirdPartyFactoryManualAssessment(updateTarget.factoryId, {
  categoryAbilities: ['衬衫', 'T 恤'], machineCount: 21, workerCount: 42,
  monthlyOutputValueTenThousandIdr: 88, grade: 'A', updatedBy: '综合评定核查', updatedAt: '2026-07-21T08:00:00.000Z',
})
assert.equal(updateResult.grade, 'A', '更新 API 必须保存人工评级')
assert.deepEqual(updateResult.timeliness, before.timeliness, '更新 API 不得覆盖系统时效事实')
assert.deepEqual(updateResult.quality, before.quality, '更新 API 不得覆盖系统品控事实')

assert.ok(storage.getItem(THIRD_PARTY_COMPREHENSIVE_ASSESSMENT_STORAGE_KEY), '合法人工更新必须写入浏览器存储')
const reloadedModule = await loadAssessmentModule()
const reloadedTarget = reloadedModule.getThirdPartyFactoryComprehensiveAssessment(updateTarget.factoryId)!
assert.equal(reloadedTarget.grade, 'A', '重新加载模块后必须从浏览器存储恢复合法人工快照')

const mutableResult = reloadedModule.listThirdPartyFactoryComprehensiveAssessments()
const originalCategories = [...mutableResult[0].categoryAbilities]
mutableResult[0].categoryAbilities.push('西装套装')
mutableResult[0].timeliness.deliveryOnTimeRate = 0
mutableResult[0].fieldSources.grade = '被调用方篡改'
const freshResult = reloadedModule.getThirdPartyFactoryComprehensiveAssessment(mutableResult[0].factoryId)!
assert.deepEqual(freshResult.categoryAbilities, originalCategories, '返回数组中的品类必须是克隆，不得反写内部状态')
assert.notEqual(freshResult.fieldSources.grade, '被调用方篡改', '返回对象中的来源说明必须是克隆')

storage.setItem(THIRD_PARTY_COMPREHENSIVE_ASSESSMENT_STORAGE_KEY, JSON.stringify([
  {
    factoryId: 'ID-F021', categoryAbilities: ['衬衫', '非法品类', '衬衫'], machineCount: -1, workerCount: 99,
    monthlyOutputValueTenThousandIdr: -2, grade: 'X', updatedBy: 123, updatedAt: null,
  },
  { factoryId: 'UNKNOWN-FACTORY', categoryAbilities: ['衬衫'], machineCount: 1, workerCount: 1, monthlyOutputValueTenThousandIdr: 1, grade: 'S', updatedBy: '错误身份', updatedAt: '2026-07-21' },
]))
const dirtyReloadedModule = await loadAssessmentModule()
const normalized = dirtyReloadedModule.getThirdPartyFactoryComprehensiveAssessment('ID-F021')!
assert.deepEqual(normalized.categoryAbilities, ['衬衫'], '存储品类必须过滤字典外值并去重')
assert.equal(normalized.machineCount, 42, '负机器数不得覆盖 seed')
assert.equal(normalized.workerCount, 99, '有效人工字段必须按工厂 ID 合并到 seed')
assert.equal(normalized.monthlyOutputValueTenThousandIdr, 420, '非正月产值不得覆盖 seed')
assert.equal(normalized.grade, 'A', '非法评级不得覆盖 seed')
assert.equal(normalized.updatedBy, '陈慧', '非字符串更新人不得覆盖 seed')
assert.equal(normalized.updatedAt, null, 'null 更新日期必须可被安全恢复')
assert.equal(dirtyReloadedModule.getThirdPartyFactoryComprehensiveAssessment('UNKNOWN-FACTORY'), undefined, '未知工厂 ID 必须忽略')
assert.equal(dirtyReloadedModule.getThirdPartyFactoryComprehensiveAssessment('KOL-GOTO-001')!.grade, 'S', '脏数组不得覆盖其他种子快照')

const beforeStorageFailure = dirtyReloadedModule.getThirdPartyFactoryComprehensiveAssessment('ID-F021')!
storage.throwOnSet = true
assert.throws(
  () => dirtyReloadedModule.updateThirdPartyFactoryManualAssessment('ID-F021', { grade: 'C' }),
  /保存失败/,
  '浏览器存储写入失败必须明确抛错',
)
storage.throwOnSet = false
assert.equal(
  dirtyReloadedModule.getThirdPartyFactoryComprehensiveAssessment('ID-F021')!.grade,
  beforeStorageFailure.grade,
  '存储写入失败后内存快照必须保持不变',
)

const temporaryFactoryId = 'ID-F099'
const storageBeforeTemporaryFactory = storage.getItem(THIRD_PARTY_COMPREHENSIVE_ASSESSMENT_STORAGE_KEY)
const temporaryMasterSource = masterFactories[0]
try {
  upsertFactoryMasterRecord({
    ...temporaryMasterSource,
    id: temporaryFactoryId,
    code: 'ID-FAC-0099',
    name: '综合评定重载回归工厂',
    isTestFactory: true,
    processAbilities: temporaryMasterSource.processAbilities.map((ability) => ({ ...ability, craftCodes: [...ability.craftCodes] })),
  })
  const temporaryFactoryModule = await loadAssessmentModule()
  assert.ok(
    temporaryFactoryModule.listThirdPartyFactoryComprehensiveAssessments().some((item) => item.factoryId === temporaryFactoryId),
    '新增真实三方车缝主档即使不在固定 seed 也必须进入综合评定列表',
  )
  temporaryFactoryModule.updateThirdPartyFactoryManualAssessment(temporaryFactoryId, {
    categoryAbilities: ['衬衫'], machineCount: 10, workerCount: 20, monthlyOutputValueTenThousandIdr: 30,
    grade: 'A', updatedBy: '重载回归', updatedAt: '2026-07-21T09:00:00.000Z',
  })
  const temporaryFactoryReloadedModule = await loadAssessmentModule()
  assert.equal(
    temporaryFactoryReloadedModule.getThirdPartyFactoryComprehensiveAssessment(temporaryFactoryId)?.grade,
    'A',
    '不在固定 seed 的真实三方车缝厂更新后必须在模块重载时恢复',
  )
} finally {
  removeFactoryMasterRecord(temporaryFactoryId)
  if (storageBeforeTemporaryFactory === null) {
    storage.setItem(THIRD_PARTY_COMPREHENSIVE_ASSESSMENT_STORAGE_KEY, '')
  } else {
    storage.setItem(THIRD_PARTY_COMPREHENSIVE_ASSESSMENT_STORAGE_KEY, storageBeforeTemporaryFactory)
  }
}

console.log('第三方车缝厂综合评定数据检查通过')
