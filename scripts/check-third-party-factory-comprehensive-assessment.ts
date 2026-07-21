import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
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

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

const storage = new MemoryStorage()
;(globalThis as typeof globalThis & {
  window?: {
    localStorage: MemoryStorage
    location: { pathname: string, search: string }
    history: { pushState: (state: unknown, title: string, url?: string | URL | null) => void, replaceState: (state: unknown, title: string, url?: string | URL | null) => void }
  }
}).window = {
  localStorage: storage,
  location: { pathname: '/fcs/factories/third-party-comprehensive-assessment', search: '' },
  history: {
    pushState: () => undefined,
    replaceState: () => undefined,
  },
}
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
reloadedModule.updateThirdPartyFactoryManualAssessment(updateTarget.factoryId, {
  machineCount: 0, workerCount: 0, monthlyOutputValueTenThousandIdr: 0,
})
const zeroReloadedTarget = (await loadAssessmentModule()).getThirdPartyFactoryComprehensiveAssessment(updateTarget.factoryId)!
assert.equal(zeroReloadedTarget.machineCount, 0, '零机器台数必须能在模块重载后恢复')
assert.equal(zeroReloadedTarget.workerCount, 0, '零工人人数必须能在模块重载后恢复')
assert.equal(zeroReloadedTarget.monthlyOutputValueTenThousandIdr, 0, '零月产值必须能在模块重载后恢复')

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

const pagePath = new URL('../src/pages/third-party-factory-comprehensive-assessment.ts', import.meta.url)
assert.ok(existsSync(pagePath), '缺少第三方车缝厂综合评定列表页')

const assessmentPageSource = readFileSync(pagePath, 'utf8')
assert.ok(assessmentPageSource.startsWith('// @page-pattern: list'), '综合评定列表页必须声明列表页模式')
for (const componentName of ['renderStandardListPage', 'renderStandardListStats', 'renderStandardListTable', 'renderTablePagination']) {
  assert.ok(assessmentPageSource.includes(componentName), `综合评定列表页必须复用 ${componentName}`)
}
assert.ok(assessmentPageSource.includes("fcs.third-party-comprehensive-assessment.columns.v1"), '综合评定列偏好必须按页面路径独立持久化')
assert.ok(assessmentPageSource.includes('data-completion-filter'), '筛选区必须声明完成状态检查标记')

const assessmentPageModuleUrl = new URL('../src/pages/third-party-factory-comprehensive-assessment.ts', import.meta.url).href
const assessmentPageModule = await import(`${assessmentPageModuleUrl}?page-check=1`)
const {
  filterThirdPartyFactoryComprehensiveAssessments,
  getThirdPartyFactoryComprehensiveAssessmentDefaultColumnPreferences,
  handleThirdPartyFactoryComprehensiveAssessmentEvent,
  renderThirdPartyFactoryComprehensiveAssessmentPage,
  validateThirdPartyFactoryComprehensiveAssessmentInput,
} = assessmentPageModule

assert.deepEqual(
  validateThirdPartyFactoryComprehensiveAssessmentInput({
    categoryAbilities: [], machineCount: '-1', workerCount: '1.5', monthlyOutputValueTenThousandIdr: '1.234', grade: '',
  }),
  {
    categoryAbilities: '至少选择 1 个品类能力',
    machineCount: '机器台数须为非负整数',
    workerCount: '工人人数须为非负整数',
    monthlyOutputValueTenThousandIdr: '月产值须为非负数，最多保留 2 位小数',
    grade: '请选择综合评级',
  },
  '编辑表单必须同时阻断品类、产能和评级的非法输入',
)
assert.deepEqual(
  validateThirdPartyFactoryComprehensiveAssessmentInput({
    categoryAbilities: ['衬衫'], machineCount: '0', workerCount: '0', monthlyOutputValueTenThousandIdr: '0.25', grade: 'S',
  }),
  {},
  '非负整数、零值和两位小数月产值必须允许保存',
)

const completeCategoryQuery = {
  keyword: '',
  categories: ['衬衫', '裤子'],
  grade: 'ALL',
  ability: 'COMPLETE',
  capacity: 'COMPLETE',
  timeliness: 'COMPLETE',
  quality: 'COMPLETE',
  rating: 'COMPLETE',
  page: 1,
  pageSize: 10,
  editFactoryId: '',
  sortKey: '',
  sortDirection: '',
  columnSettings: false,
}
const completeCategoryRows = filterThirdPartyFactoryComprehensiveAssessments(assessments, completeCategoryQuery)
assert.ok(completeCategoryRows.length > 0, '五维完成且品类命中的组合筛选必须返回样例')
assert.ok(
  completeCategoryRows.every((item) =>
    item.completion.ability && item.completion.capacity && item.completion.timeliness && item.completion.quality && item.completion.grade &&
    item.categoryAbilities.some((category) => completeCategoryQuery.categories.includes(category)),
  ),
  '五个完成状态筛选必须组间 AND，品类必须组内 OR',
)
const allCategoriesRows = filterThirdPartyFactoryComprehensiveAssessments(assessments, {
  ...completeCategoryQuery,
  ability: 'ALL', capacity: 'ALL', timeliness: 'ALL', quality: 'ALL', rating: 'ALL',
})
assert.ok(
  allCategoriesRows.every((item) => item.categoryAbilities.some((category) => completeCategoryQuery.categories.includes(category))),
  '多个品类筛选不得误实现为组内 AND',
)
const keywordRows = filterThirdPartyFactoryComprehensiveAssessments(assessments, {
  ...completeCategoryQuery,
  keyword: assessments[0].factoryCode,
  categories: [], ability: 'ALL', capacity: 'ALL', timeliness: 'ALL', quality: 'ALL', rating: 'ALL',
})
assert.deepEqual(keywordRows.map((item) => item.factoryId), [assessments[0].factoryId], '关键字必须匹配工厂编码')
const gradeRows = filterThirdPartyFactoryComprehensiveAssessments(assessments, {
  ...completeCategoryQuery,
  categories: [], grade: 'B', ability: 'ALL', capacity: 'ALL', timeliness: 'ALL', quality: 'ALL', rating: 'ALL',
})
assert.ok(gradeRows.length > 0 && gradeRows.every((item) => item.grade === 'B'), '综合评级筛选必须仅返回目标评级')
for (const dimension of ['ability', 'capacity', 'timeliness', 'quality', 'rating'] as const) {
  const incompleteRows = filterThirdPartyFactoryComprehensiveAssessments(assessments, {
    ...completeCategoryQuery,
    categories: [], grade: 'ALL', ability: 'ALL', capacity: 'ALL', timeliness: 'ALL', quality: 'ALL', rating: 'ALL',
    [dimension]: 'INCOMPLETE',
  })
  assert.ok(incompleteRows.length > 0 && incompleteRows.every((item) => !item.completion[dimension === 'rating' ? 'grade' : dimension]), `${dimension} 待完善筛选必须只返回该维度未完善工厂`)
}

const defaultColumnPreferences = getThirdPartyFactoryComprehensiveAssessmentDefaultColumnPreferences()
assert.deepEqual(
  new Set(defaultColumnPreferences.visibleKeys),
  new Set(['factory', 'craftAbility', 'categoryAbility', 'machineCount', 'workerCount', 'monthlyOutputValue', 'deliveryCompleted', 'return30', 'return70', 'return100', 'defectiveRate', 'defectRate', 'reworkRate', 'grade', 'actions']),
  '综合评定默认必须展示全部固定列',
)

;(globalThis as typeof globalThis & { window?: { location?: { pathname: string, search: string } } }).window!.location = {
  pathname: '/fcs/factories/third-party-comprehensive-assessment',
  search: '',
}
const assessmentPageHtml = renderThirdPartyFactoryComprehensiveAssessmentPage()
for (const text of [
  '第三方车缝厂综合评定', '全部工厂', '评定已完善', '待完善', '评级分布',
  '工艺能力', '品类能力', '机器数', '工人数', '月产值',
  '交期完成', '回货 30%', '回货 70%', '回货 100%',
  '不良率', '工厂责任瑕疵率', '返工率', '综合评级', '编辑评定',
  '系统获取', '人工填写', '工厂档案', '时效业务数据', '质检业务数据', '待完善', '暂无业务数据',
]) {
  assert.ok(assessmentPageHtml.includes(text), `综合评定页面缺少：${text}`)
}
assert.ok(assessmentPageHtml.includes('data-standard-list-header-group="ability"'), '能力分组表头必须存在')
for (const groupKey of ['factory', 'ability', 'capacity', 'timeliness', 'quality', 'grade', 'actions']) {
  assert.ok(assessmentPageHtml.includes(`data-standard-list-header-group="${groupKey}"`), `缺少 ${groupKey} 表头分组`)
}
for (const columnKey of ['factory', 'craftAbility', 'categoryAbility', 'machineCount', 'workerCount', 'monthlyOutputValue', 'deliveryCompleted', 'return30', 'return70', 'return100', 'defectiveRate', 'defectRate', 'reworkRate', 'grade', 'actions']) {
  assert.ok(assessmentPageHtml.includes(`data-column-key="${columnKey}"`), `缺少 ${columnKey} 列映射`)
}
const columnDefinitionsSource = assessmentPageSource.slice(
  assessmentPageSource.indexOf('const columns:'),
  assessmentPageSource.indexOf('const headerGroups'),
)
assert.equal((columnDefinitionsSource.match(/freezeable: true/g) ?? []).length, 14, '除操作列外的所有普通业务列必须支持冻结')
assert.ok(assessmentPageHtml.includes('data-column-key="actions"') && assessmentPageHtml.includes('sticky right-0'), '操作列必须固定在右侧')
assert.ok(assessmentPageHtml.includes('data-third-party-comprehensive-assessment-action="open-editor"'), '编辑评定必须使用页面局部抽屉动作')
assert.ok(!assessmentPageHtml.includes('data-nav="/fcs/factories/third-party-comprehensive-assessment?editFactoryId='), '编辑评定不得通过路由跳转打开')
assert.ok(assessmentPageHtml.includes('10 条/页') && assessmentPageHtml.includes('>1 /'), '列表必须渲染分页信息')
for (const dimension of ['ability', 'capacity', 'timeliness', 'quality', 'rating']) {
  assert.ok(assessmentPageHtml.includes(`data-completion-filter="${dimension}"`), `筛选区必须标记${dimension}完成状态`)
}
for (const englishStatus of ['PENDING', 'DONE', 'IN_PROGRESS', 'COMPLETE', 'INCOMPLETE']) {
  assert.ok(!assessmentPageHtml.includes(`>${englishStatus}<`), `页面不得直接展示英文状态码：${englishStatus}`)
}

;(globalThis as typeof globalThis & { window?: { location?: { pathname: string, search: string } } }).window!.location = {
  pathname: '/fcs/factories/third-party-comprehensive-assessment',
  search: '?columnSettings=1',
}
const overlayPageHtml = renderThirdPartyFactoryComprehensiveAssessmentPage()
const closeAction = 'data-third-party-comprehensive-assessment-action="close-column-settings"'
const closeButtons = overlayPageHtml.match(new RegExp(`<button[^>]*${closeAction}[^>]*>`, 'g')) ?? []
assert.equal(closeButtons.length, 2, '真实列设置抽屉的右上关闭和底部关闭必须保留局部关闭动作')
assert.ok(closeButtons.every((button) => !button.includes('data-nav=')), '列设置关闭不得被替换为全局导航')

const EVENT_PREFIX = 'third-party-comprehensive-assessment'
const COLUMN_STORAGE_KEY = 'fcs.third-party-comprehensive-assessment.columns.v1'
const createEvent = (type: string, extra: Record<string, unknown> = {}) => ({
  type,
  defaultPrevented: false,
  preventDefault() { this.defaultPrevented = true },
  ...extra,
})
const createFieldTarget = (field: string, value: string) => ({
  closest: (selector: string) => selector === `[data-${EVENT_PREFIX}-field]`
    ? { dataset: { thirdPartyComprehensiveAssessmentField: field }, value }
    : null,
}) as unknown as HTMLElement
const createActionTarget = (action: string, columnKey?: string) => ({
  closest: (selector: string) => selector === `[data-${EVENT_PREFIX}-action]`
    ? { getAttribute: () => action, dataset: { thirdPartyComprehensiveAssessmentColumnKey: columnKey, columnKey } }
    : null,
}) as unknown as HTMLElement
const createDragTarget = (columnKey: string) => ({
  closest: (selector: string) => selector === '[data-standard-list-column-drag]'
    ? { dataset: { dragSource: columnKey, dropTarget: columnKey } }
    : null,
}) as unknown as HTMLElement
const readStoredColumns = () => JSON.parse(storage.getItem(COLUMN_STORAGE_KEY) ?? 'null') as {
  order: string[], visibleKeys: string[], frozenKeys: string[], pageSize: number
}

const pageSizeEvent = createEvent('change')
assert.equal(handleThirdPartyFactoryComprehensiveAssessmentEvent(createFieldTarget('pageSize', '20'), pageSizeEvent as unknown as Event), true, '每页条数切换必须由页面事件处理')
assert.equal(readStoredColumns().pageSize, 20, '每页条数必须持久化')

const visibilityEvent = createEvent('change')
assert.equal(handleThirdPartyFactoryComprehensiveAssessmentEvent(createActionTarget('toggle-column-visibility', 'machineCount'), visibilityEvent as unknown as Event), true, '普通列显示切换必须被处理')
assert.ok(!readStoredColumns().visibleKeys.includes('machineCount'), '普通列隐藏必须持久化')
assert.equal(handleThirdPartyFactoryComprehensiveAssessmentEvent(createActionTarget('toggle-column-visibility', 'factory'), createEvent('change') as unknown as Event), true, '必需列显示操作必须安全返回')
assert.ok(readStoredColumns().visibleKeys.includes('factory'), '必需列不得被隐藏')
assert.equal(handleThirdPartyFactoryComprehensiveAssessmentEvent(createActionTarget('toggle-column-visibility', 'actions'), createEvent('change') as unknown as Event), true, '操作列显示操作必须安全返回')
assert.ok(readStoredColumns().visibleKeys.includes('actions'), '操作列不得被隐藏')

assert.equal(handleThirdPartyFactoryComprehensiveAssessmentEvent(createActionTarget('toggle-column-freeze', 'factory'), createEvent('change') as unknown as Event), true, '冻结列切换必须被处理')
assert.ok(!readStoredColumns().frozenKeys.includes('factory'), '取消冻结必须持久化')
assert.equal(handleThirdPartyFactoryComprehensiveAssessmentEvent(createActionTarget('toggle-column-freeze', 'factory'), createEvent('change') as unknown as Event), true, '恢复冻结必须被处理')
assert.ok(readStoredColumns().frozenKeys.includes('factory'), '冻结列必须持久化')

const dragStartEvent = createEvent('dragstart', { dataTransfer: { setData: () => undefined, effectAllowed: '' } })
assert.equal(handleThirdPartyFactoryComprehensiveAssessmentEvent(createDragTarget('machineCount'), dragStartEvent as unknown as Event), true, '列拖拽开始必须被处理')
const dragDropEvent = createEvent('drop', { higoodStandardListColumnKey: 'machineCount', dataTransfer: { getData: () => 'machineCount' } })
assert.equal(handleThirdPartyFactoryComprehensiveAssessmentEvent(createDragTarget('workerCount'), dragDropEvent as unknown as Event), true, '合法列拖拽必须被处理')
assert.ok(readStoredColumns().order.indexOf('machineCount') < readStoredColumns().order.indexOf('workerCount'), '列拖拽顺序必须持久化')
const orderBeforeInvalidDrag = [...readStoredColumns().order]
assert.equal(handleThirdPartyFactoryComprehensiveAssessmentEvent(createDragTarget('actions'), createEvent('drop', { higoodStandardListColumnKey: 'machineCount' }) as unknown as Event), false, '操作列不得作为拖拽目标')
assert.deepEqual(readStoredColumns().order, orderBeforeInvalidDrag, '非法拖拽不得污染列顺序')

assert.equal(handleThirdPartyFactoryComprehensiveAssessmentEvent(createActionTarget('restore-column-settings'), createEvent('click') as unknown as Event), true, '恢复默认必须被处理')
assert.equal(storage.getItem(COLUMN_STORAGE_KEY), null, '恢复默认必须清除列偏好')

storage.setItem(COLUMN_STORAGE_KEY, JSON.stringify({ order: '错误', visibleKeys: '错误', frozenKeys: '错误', pageSize: '错误' }))
const normalizedDirtyPreferencesHtml = renderThirdPartyFactoryComprehensiveAssessmentPage()
assert.ok(normalizedDirtyPreferencesHtml.includes('data-column-key="craftAbility"') && normalizedDirtyPreferencesHtml.includes('10 条/页'), '脏列偏好必须回退到默认可见列和默认页码大小')
;(globalThis as typeof globalThis & { window?: { location?: { pathname: string, search: string } } }).window!.location = {
  pathname: '/fcs/factories/third-party-comprehensive-assessment',
  search: '?categories=%E8%A1%AC%E8%A1%AB&categories=%E8%A3%A4%E5%AD%90',
}
const categoryUrlHtml = renderThirdPartyFactoryComprehensiveAssessmentPage()
assert.ok(categoryUrlHtml.includes('value="衬衫" checked') && categoryUrlHtml.includes('value="裤子" checked'), '多个品类 URL 参数必须稳定解码并回显')
assert.ok(categoryUrlHtml.includes('categories=%E8%A1%AC%E8%A1%AB') && categoryUrlHtml.includes('categories=%E8%A3%A4%E5%AD%90'), '多个品类必须稳定编码到列表导航')

storage.removeItem(COLUMN_STORAGE_KEY)

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close((error) => error ? reject(error) : resolve(typeof address === 'object' && address ? address.port : 0))
    })
  })
}

async function waitForVite(url: string): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw lastError ?? new Error('Vite 未在预期时间内启动')
}

async function assertRealDomColumnSettingsInteractions(): Promise<void> {
  const { chromium } = await import('@playwright/test')
  const port = await getFreePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const vite = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: process.cwd(),
    stdio: 'ignore',
  })
  const browser = await chromium.launch({ headless: true })

  try {
    await waitForVite(baseUrl)
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.evaluate(async () => {
      const assessment = await import('/src/pages/third-party-factory-comprehensive-assessment.ts')
      const path = '/fcs/factories/third-party-comprehensive-assessment'
      const mount = (search: string) => {
        window.localStorage.clear()
        window.history.replaceState({}, '', `${path}${search}`)
        document.body.innerHTML = `<div id="external-sentinel">保留</div>${assessment.renderThirdPartyFactoryComprehensiveAssessmentPage()}`
      }
      document.addEventListener('click', (event) => {
        if (event.target instanceof HTMLElement) assessment.handleThirdPartyFactoryComprehensiveAssessmentEvent(event.target, event)
      })
      document.addEventListener('change', (event) => {
        if (event.target instanceof HTMLElement) assessment.handleThirdPartyFactoryComprehensiveAssessmentEvent(event.target, event)
      })
      document.addEventListener('input', (event) => {
        if (event.target instanceof HTMLElement) assessment.handleThirdPartyFactoryComprehensiveAssessmentEvent(event.target, event)
      })
      Object.assign(window, { __assessmentMount: mount })
    })

    const mount = async (search: string) => page.evaluate((nextSearch) => {
      ;(window as unknown as { __assessmentMount: (value: string) => void }).__assessmentMount(nextSearch)
    }, search)
    const snapshotStableNodes = async () => page.evaluate(() => {
      const root = document.querySelector('[data-third-party-comprehensive-assessment-page]')
      const sentinel = document.querySelector('#external-sentinel')
      Object.assign(window, { __assessmentRoot: root, __assessmentSentinel: sentinel })
      return { path: `${location.pathname}${location.search}`, historyLength: history.length }
    })
    const assertStableNodes = async (expectedPath: string, expectedHistoryLength: number) => page.evaluate(({ path, historyLength }) => ({
      path: `${location.pathname}${location.search}`,
      historyLength: history.length,
      rootStable: document.querySelector('[data-third-party-comprehensive-assessment-page]') === (window as unknown as { __assessmentRoot: Element }).__assessmentRoot,
      sentinelStable: document.querySelector('#external-sentinel') === (window as unknown as { __assessmentSentinel: Element }).__assessmentSentinel,
    }), { path: expectedPath, historyLength: expectedHistoryLength }).then((result) => {
      assert.equal(result.path, expectedPath, '局部列设置操作不得改变当前路径')
      assert.equal(result.historyLength, expectedHistoryLength, '局部列设置操作不得新增浏览器历史')
      assert.ok(result.rootStable, '局部列设置操作不得替换页面根节点')
      assert.ok(result.sentinelStable, '局部列设置操作不得替换外部哨兵节点')
    })

    await mount('?columnSettings=1')
    const closeControls = page.locator('button[data-third-party-comprehensive-assessment-action="close-column-settings"]')
    assert.equal(await closeControls.count(), 2, '真实 DOM 中的右上关闭与底部关闭必须都保留局部动作')
    assert.equal(await closeControls.evaluateAll((nodes) => nodes.some((node) => node.hasAttribute('data-nav'))), false, '真实关闭控件不得携带全局 data-nav')
    const firstCloseBefore = await snapshotStableNodes()
    await closeControls.nth(0).click()
    assert.equal(await page.locator('[data-third-party-comprehensive-assessment-overlays]').innerHTML(), '', '右上关闭必须只清空真实 overlay')
    await assertStableNodes(firstCloseBefore.path, firstCloseBefore.historyLength)

    await mount('?columnSettings=1')
    const secondCloseBefore = await snapshotStableNodes()
    await page.locator('[data-third-party-comprehensive-assessment-action="close-column-settings"]').nth(1).click()
    assert.equal(await page.locator('[data-third-party-comprehensive-assessment-overlays]').innerHTML(), '', '底部关闭必须只清空真实 overlay')
    await assertStableNodes(secondCloseBefore.path, secondCloseBefore.historyLength)

    await mount('?columnSettings=1')
    const scrollBeforeToggle = await page.evaluate(() => {
      const scroll = document.querySelector<HTMLElement>('[data-assessment-table-surface] [data-standard-list-scroll]')
      if (!scroll) return { hasScroll: false, hasTable: false, scrollLeft: 0 }
      scroll.style.width = '320px'
      scroll.style.overflowX = 'scroll'
      const table = scroll.querySelector('table')
      if (!table) return { hasScroll: true, hasTable: false, scrollLeft: 0 }
      table.style.minWidth = '2400px'
      scroll.scrollLeft = 137
      const root = document.querySelector('[data-third-party-comprehensive-assessment-page]')
      Object.assign(window, { __assessmentRoot: root })
      return { hasScroll: true, hasTable: true, scrollLeft: scroll.scrollLeft }
    })
    assert.ok(scrollBeforeToggle.hasScroll, '真实表格必须包含内部横向滚动节点')
    assert.ok(scrollBeforeToggle.hasTable, '真实横向滚动节点必须承载标准列表表格')
    assert.equal(scrollBeforeToggle.scrollLeft, 137, '真实内部横向滚动节点必须可设置滚动位置')
    await page.locator('[data-third-party-comprehensive-assessment-action="toggle-column-visibility"][data-third-party-comprehensive-assessment-column-key="machineCount"]').click()
    assert.equal(await page.evaluate(() => document.querySelector<HTMLElement>('[data-assessment-table-surface] [data-standard-list-scroll]')?.scrollLeft), scrollBeforeToggle.scrollLeft, '切列后必须恢复真实内部横向滚动位置')
    assert.equal(await page.evaluate(() => document.querySelector('[data-third-party-comprehensive-assessment-page]') === (window as unknown as { __assessmentRoot: Element }).__assessmentRoot), true, '切列不得整页重绘')

    await mount('?pageSize=20&columnSettings=1')
    const restoreBefore = await snapshotStableNodes()
    await page.locator('[data-third-party-comprehensive-assessment-action="restore-column-settings"]').click()
    const restoreState = await page.evaluate(() => ({
      pageSize: (document.querySelector<HTMLSelectElement>('[data-third-party-comprehensive-assessment-field="pageSize"]')?.value),
      rowCount: document.querySelectorAll('[data-assessment-table-surface] tbody tr').length,
      pagination: document.querySelector('[data-assessment-pagination-surface]')?.textContent,
      hasPageSize: new URL(location.href).searchParams.has('pageSize'),
      historyLength: history.length,
      rootStable: document.querySelector('[data-third-party-comprehensive-assessment-page]') === (window as unknown as { __assessmentRoot: Element }).__assessmentRoot,
      sentinelStable: document.querySelector('#external-sentinel') === (window as unknown as { __assessmentSentinel: Element }).__assessmentSentinel,
    }))
    assert.equal(restoreState.pageSize, '10', '恢复默认必须让真实每页条数控件回到 10')
    assert.equal(restoreState.rowCount, 10, '恢复默认必须让真实表格回到 10 行口径')
    assert.ok(restoreState.pagination?.includes('10 条/页'), '恢复默认必须刷新真实分页显示')
    assert.equal(restoreState.hasPageSize, false, '恢复默认必须清理 URL 中的 pageSize 覆盖')
    assert.equal(restoreState.historyLength, restoreBefore.historyLength, '恢复默认必须使用 replace 语义而非新增历史')
    assert.ok(restoreState.rootStable && restoreState.sentinelStable, '恢复默认不得整页 root 重绘或丢失外部节点')

    await mount('')
    const editorBefore = await snapshotStableNodes()
    const editButton = page.locator('[data-third-party-comprehensive-assessment-action="open-editor"][data-factory-id="ID-F023"]')
    await editButton.click()
    assert.equal(await page.locator('[data-third-party-comprehensive-assessment-editor]').count(), 1, '编辑评定必须打开局部抽屉')
    assert.equal(await page.locator('[data-third-party-comprehensive-assessment-field="categoryAbilities"]').count(), 11, '品类能力必须完整展示业务定义的 11 个一级品类')
    await assertStableNodes(editorBefore.path, editorBefore.historyLength)
    const editorText = await page.locator('[data-third-party-comprehensive-assessment-editor]').innerText()
    for (const text of ['工艺能力', '工厂档案', '时效', '系统计算', '品控', '质检业务数据', '人工填写']) {
      assert.ok(editorText.includes(text), `编辑抽屉必须清楚展示只读来源：${text}`)
    }

    await page.locator('[data-third-party-comprehensive-assessment-field="categoryAbilities"]').first().check()
    await page.locator('[data-third-party-comprehensive-assessment-field="machineCount"]').fill('-1')
    await page.locator('[data-third-party-comprehensive-assessment-field="workerCount"]').fill('1.5')
    await page.locator('[data-third-party-comprehensive-assessment-field="monthlyOutputValueTenThousandIdr"]').fill('1.234')
    await page.locator('[data-third-party-comprehensive-assessment-field="grade"]').selectOption('')
    await page.locator('[data-third-party-comprehensive-assessment-action="save-editor"]').click()
    assert.ok((await page.locator('[data-assessment-form-errors]').innerText()).includes('机器台数须为非负整数'), '非法输入必须在抽屉内给出明确改法')

    await page.locator('[data-third-party-comprehensive-assessment-field="machineCount"]').fill('0')
    await page.locator('[data-third-party-comprehensive-assessment-field="workerCount"]').fill('0')
    await page.locator('[data-third-party-comprehensive-assessment-field="monthlyOutputValueTenThousandIdr"]').fill('0.25')
    await page.locator('[data-third-party-comprehensive-assessment-field="grade"]').selectOption('A')
    const rootBeforeSave = await page.locator('[data-third-party-comprehensive-assessment-page]').evaluate((node) => {
      Object.assign(window, { __assessmentRootBeforeSave: node })
      return true
    })
    assert.ok(rootBeforeSave)
    await page.locator('[data-third-party-comprehensive-assessment-action="save-editor"]').click()
    assert.equal(await page.locator('[data-third-party-comprehensive-assessment-editor]').count(), 0, '保存成功后必须关闭编辑抽屉')
    assert.equal(await page.evaluate(() => document.querySelector('[data-third-party-comprehensive-assessment-page]') === (window as unknown as { __assessmentRootBeforeSave: Element }).__assessmentRootBeforeSave), true, '保存不得整页重绘')
    assert.equal(`${await page.evaluate(() => location.pathname)}${await page.evaluate(() => location.search)}`, editorBefore.path, '保存不得跳转路由')
    assert.ok((await page.locator('[data-toast-container]').innerText()).includes('评定已保存'), '保存成功必须给出反馈')
    const savedRowText = await page.locator('[data-assessment-factory-id="ID-F023"]').locator('xpath=ancestor::tr').innerText()
    assert.ok(savedRowText.includes('0 台') && savedRowText.includes('0 人') && savedRowText.includes('0.25 万印尼盾／月') && savedRowText.includes('A 级'), '保存后必须局部刷新当前工厂行')
    assert.ok(savedRowText.includes('当前登录用户'), '保存后必须记录并展示最后更新人')

    await editButton.click()
    await page.locator('[data-third-party-comprehensive-assessment-field="machineCount"]').fill('1')
    page.once('dialog', (dialog) => dialog.dismiss())
    await page.locator('[data-third-party-comprehensive-assessment-action="close-editor"]').last().click()
    assert.equal(await page.locator('[data-third-party-comprehensive-assessment-editor]').count(), 1, '有未保存变更且取消确认时必须保留抽屉')
    page.once('dialog', (dialog) => dialog.accept())
    await page.locator('[data-third-party-comprehensive-assessment-action="close-editor"]').last().click()
    assert.equal(await page.locator('[data-third-party-comprehensive-assessment-editor]').count(), 0, '确认放弃未保存变更后必须关闭抽屉')
  } finally {
    await browser.close()
    vite.kill('SIGTERM')
  }
}

await assertRealDomColumnSettingsInteractions()

assert.equal(handleThirdPartyFactoryComprehensiveAssessmentEvent(createActionTarget('toggle-column-freeze', 'factory'), createEvent('change') as unknown as Event), true, '取消默认工厂冻结必须被处理')
assert.equal(handleThirdPartyFactoryComprehensiveAssessmentEvent(createActionTarget('toggle-column-freeze', 'machineCount'), createEvent('change') as unknown as Event), true, '普通列冻结必须被处理')
assert.equal(handleThirdPartyFactoryComprehensiveAssessmentEvent(createActionTarget('toggle-column-freeze', 'workerCount'), createEvent('change') as unknown as Event), true, '第二普通列冻结必须被处理')
assert.deepEqual(readStoredColumns().frozenKeys, ['machineCount', 'workerCount'], '多个普通冻结列必须按用户顺序持久化')
assert.equal(handleThirdPartyFactoryComprehensiveAssessmentEvent(createActionTarget('toggle-column-freeze', 'categoryAbility'), createEvent('change') as unknown as Event), true, '超宽冻结操作必须安全返回')
assert.ok(!readStoredColumns().frozenKeys.includes('categoryAbility'), '超过冻结宽度上限的列不得持久化')
assert.equal(handleThirdPartyFactoryComprehensiveAssessmentEvent(createActionTarget('toggle-column-freeze', 'machineCount'), createEvent('change') as unknown as Event), true, '取消普通列冻结必须被处理')
assert.ok(!readStoredColumns().frozenKeys.includes('machineCount') && readStoredColumns().frozenKeys.includes('workerCount'), '取消冻结必须只恢复目标列')

console.log('第三方车缝厂综合评定页面检查通过')
