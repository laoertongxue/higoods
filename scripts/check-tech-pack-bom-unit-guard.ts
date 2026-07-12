import assert from 'node:assert/strict'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
  configurable: true,
})

class FakeHTMLElement {
  dataset: Record<string, string> = {}

  closest(): FakeHTMLElement | null {
    return this
  }
}

class FakeHTMLInputElement extends FakeHTMLElement {
  value = ''
  checked = false
}

class FakeHTMLSelectElement extends FakeHTMLElement {
  value = ''
}

class FakeHTMLTextAreaElement extends FakeHTMLElement {
  value = ''
}

Object.defineProperty(globalThis, 'HTMLElement', { value: FakeHTMLElement, configurable: true })
Object.defineProperty(globalThis, 'HTMLInputElement', { value: FakeHTMLInputElement, configurable: true })
Object.defineProperty(globalThis, 'HTMLSelectElement', { value: FakeHTMLSelectElement, configurable: true })
Object.defineProperty(globalThis, 'HTMLTextAreaElement', { value: FakeHTMLTextAreaElement, configurable: true })

const alerts: string[] = []
Object.defineProperty(globalThis, 'window', {
  value: {
    alert: (message: string) => alerts.push(message),
    dispatchEvent: () => true,
    location: { pathname: '/pcs/products/styles/STYLE-BOM-UNIT-GUARD-NORMAL', search: '' },
    history: { pushState: () => {}, replaceState: () => {} },
  },
  configurable: true,
})

const {
  getTechnicalDataVersionContent,
  getTechnicalDataVersionStoreSnapshot,
  replaceTechnicalDataVersionStore,
  resetTechnicalDataVersionRepository,
} = await import('../src/data/pcs-technical-data-version-repository.ts')
const { buildTechPackReviewDiffSnapshot } = await import('../src/data/pcs-tech-pack-review-diff.ts')
const { handleTechPackEvent, renderTechPackPage } = await import('../src/pages/tech-pack.ts')

resetTechnicalDataVersionRepository()
const seeded = getTechnicalDataVersionStoreSnapshot()
const baseRecord = seeded.records.find((item) => item.versionStatus === 'DRAFT')
assert(baseRecord, '技术包 BOM 单位回归缺少草稿版本基线')
const baseContent = seeded.contents.find((item) => item.technicalVersionId === baseRecord.technicalVersionId)
assert(baseContent, '技术包 BOM 单位回归缺少草稿内容基线')

const createVersion = (suffix: string, illegal = false) => {
  const technicalVersionId = `tdv_bom_unit_guard_${suffix}`
  const styleId = `STYLE-BOM-UNIT-GUARD-${suffix}`
  const styleCode = `STYLE-BOM-UNIT-GUARD-${suffix}`
  const missingUnitItem = {
    ...baseContent.bomItems[0],
    id: `BOM-MISSING-${suffix}`,
    materialCode: `MAT-MISSING-${suffix}`,
    name: '缺单位物料',
    unit: '',
    printRequirement: '无',
    printSideMode: '',
    waterSolubleRequirement: illegal ? '是' as const : '否' as const,
  }
  const legalUnits = ['米', '个', '公斤']
  const legalItems = legalUnits.map((unit, index) => ({
    ...baseContent.bomItems[index % baseContent.bomItems.length],
    id: `BOM-LEGAL-${suffix}-${index + 1}`,
    materialCode: `MAT-LEGAL-${suffix}-${index + 1}`,
    name: `${unit}单位物料`,
    unit,
    waterSolubleRequirement: '否' as const,
  }))
  return {
    record: {
      ...baseRecord,
      technicalVersionId,
      technicalVersionCode: `TDV-BOM-UNIT-GUARD-${suffix}`,
      styleId,
      styleCode,
      styleName: `BOM 单位保真回归 ${suffix}`,
      versionStatus: 'DRAFT' as const,
      bomStatus: 'DRAFT' as const,
      processStatus: 'DRAFT' as const,
      reviewSnapshot: undefined,
    },
    content: {
      ...baseContent,
      technicalVersionId,
      bomItems: [missingUnitItem, ...legalItems],
    },
  }
}

const normalVersion = createVersion('NORMAL')
const illegalVersion = createVersion('ILLEGAL', true)
const reviewStyleId = 'STYLE-BOM-UNIT-REVIEW-DIFF'
const reviewBomItem = {
  ...baseContent.bomItems[0],
  id: 'BOM-REVIEW-UNIT',
  materialCode: 'MAT-REVIEW-UNIT',
  name: '审核单位差异物料',
  unit: '',
  waterSolubleRequirement: '否' as const,
}
const reviewBaseline = {
  record: {
    ...baseRecord,
    technicalVersionId: 'tdv_bom_unit_review_baseline',
    technicalVersionCode: 'TDV-BOM-UNIT-REVIEW-1',
    styleId: reviewStyleId,
    styleCode: reviewStyleId,
    styleName: 'BOM 单位差异审核款',
    versionNo: 1,
    versionLabel: 'V1',
    versionStatus: 'PUBLISHED' as const,
    publishedAt: '2026-07-10 10:00',
    publishedBy: '审核基线发布人',
  },
  content: {
    ...baseContent,
    technicalVersionId: 'tdv_bom_unit_review_baseline',
    bomItems: [reviewBomItem],
  },
}
const createReviewDraft = (suffix: string, unit: string, versionNo: number) => ({
  record: {
    ...reviewBaseline.record,
    technicalVersionId: `tdv_bom_unit_review_${suffix}`,
    technicalVersionCode: `TDV-BOM-UNIT-REVIEW-${versionNo}`,
    versionNo,
    versionLabel: `V${versionNo}`,
    versionStatus: 'DRAFT' as const,
    publishedAt: '',
    publishedBy: '',
  },
  content: {
    ...reviewBaseline.content,
    technicalVersionId: `tdv_bom_unit_review_${suffix}`,
    bomItems: [{ ...reviewBomItem, unit }],
  },
})
const reviewMeterDraft = createReviewDraft('meter', '米', 2)
const reviewEmptyDraft = createReviewDraft('empty', '', 3)
replaceTechnicalDataVersionStore({
  version: seeded.version,
  records: [
    normalVersion.record,
    illegalVersion.record,
    reviewBaseline.record,
    reviewMeterDraft.record,
    reviewEmptyDraft.record,
  ],
  contents: [
    normalVersion.content,
    illegalVersion.content,
    reviewBaseline.content,
    reviewMeterDraft.content,
    reviewEmptyDraft.content,
  ],
  pendingItems: [],
})

const emptyToMeterDiff = buildTechPackReviewDiffSnapshot(reviewMeterDraft.record, 'BUYER')
assert.equal(emptyToMeterDiff.diffStatus, '有差异', '已发布空单位改为米时必须产生审核差异')
assert.equal(emptyToMeterDiff.changedCount, 1, '空单位改为米必须只产生一条物料清单修改')
assert(
  emptyToMeterDiff.items.some((item) => item.scope === '物料清单' && item.changeType === '修改'),
  '空单位改为米的审核明细必须标记物料清单修改',
)
const emptyToEmptyDiff = buildTechPackReviewDiffSnapshot(reviewEmptyDraft.record, 'BUYER')
assert.equal(emptyToEmptyDiff.diffStatus, '无差异', '已发布空单位和草稿空单位必须保持无差异')
assert.equal(emptyToEmptyDiff.changedCount, 0, '空单位保持为空不得产生虚假修改')

const renderBom = (version: typeof normalVersion) => renderTechPackPage(version.record.styleCode, {
  styleId: version.record.styleId,
  technicalVersionId: version.record.technicalVersionId,
  activeTab: 'bom',
})

const selectWaterSoluble = (bomId: string, value: '是' | '否') => {
  const select = new FakeHTMLSelectElement()
  select.dataset.techField = 'bom-water-soluble'
  select.dataset.bomId = bomId
  select.value = value
  return { select, handled: handleTechPackEvent(select as unknown as HTMLElement) }
}

const triggerAction = (techAction: string, bomId?: string) => handleTechPackEvent({
  closest: (selector: string) => selector === '[data-tech-action]'
    ? ({ dataset: { techAction, ...(bomId ? { bomId } : {}) } } as HTMLElement)
    : null,
} as unknown as HTMLElement)

const normalHtml = renderBom(normalVersion)
assert.match(normalHtml, /缺少单位，不能勾选水溶/, '空单位 BOM 行必须显示中文阻断原因')
assert.match(normalHtml, /data-bom-unit-missing="true"/, '空单位 BOM 行必须有明确异常标记')
assert.equal(
  getTechnicalDataVersionContent(normalVersion.record.technicalVersionId)?.bomItems[0]?.unit,
  '',
  '页面加载后 store 中的空单位必须保持为空',
)
assert.equal(triggerAction('edit-bom', 'BOM-MISSING-NORMAL'), true, '空单位 BOM 行必须可进入现有编辑态')
assert.equal(triggerAction('save-bom'), true, '未勾水溶的空单位 BOM 行必须保留现有保存能力')
const savedMissingWithoutWater = getTechnicalDataVersionContent(normalVersion.record.technicalVersionId)?.bomItems.find(
  (item) => item.id === 'BOM-MISSING-NORMAL',
)
assert.equal(savedMissingWithoutWater?.unit, '', '空单位 BOM 行从编辑态保存回 store 后仍必须为空')
assert.equal(savedMissingWithoutWater?.waterSolubleRequirement, '否', '未勾水溶时不得新增全 BOM 单位强校验')

for (const [index, unit] of ['米', '个', '公斤'].entries()) {
  const bomId = `BOM-LEGAL-NORMAL-${index + 1}`
  const { handled } = selectWaterSoluble(bomId, '是')
  assert.equal(handled, true, `${unit}单位物料的水溶选择必须由真实 handler 处理`)
  const saved = getTechnicalDataVersionContent(normalVersion.record.technicalVersionId)?.bomItems.find((item) => item.id === bomId)
  assert.equal(saved?.unit, unit, `${unit}单位必须原样持久化`)
  assert.equal(saved?.waterSolubleRequirement, '是', `${unit}单位物料必须允许勾选水溶`)
}

const missingSelect = selectWaterSoluble('BOM-MISSING-NORMAL', '是')
assert.equal(missingSelect.handled, true, '空单位 BOM 行的水溶选择必须被真实 handler 接管')
assert.equal(missingSelect.select.value, '否', '空单位 BOM 行勾选水溶后控件必须恢复未勾选')
const blockedMissing = getTechnicalDataVersionContent(normalVersion.record.technicalVersionId)?.bomItems.find(
  (item) => item.id === 'BOM-MISSING-NORMAL',
)
assert.equal(blockedMissing?.unit, '', '阻断后不得给空单位物料补写虚构单位')
assert.equal(blockedMissing?.waterSolubleRequirement, '否', '阻断后不得把水溶要求写入 store')
assert(alerts.some((message) => message.includes('缺少单位')), '阻断时必须显示中文提示')

const illegalHtml = renderBom(illegalVersion)
assert.match(illegalHtml, /缺少单位，不能勾选水溶/, '已有空单位且水溶为是的异常数据必须显式展示')
assert.equal(triggerAction('edit-bom', 'BOM-MISSING-ILLEGAL'), true, '已有异常 BOM 行必须可进入编辑态供修正')
assert.equal(triggerAction('save-bom'), true, '已有异常 BOM 行保存动作必须被真实 handler 接管')
assert(alerts.some((message) => message.includes('不能保存水溶要求')), '已有异常 BOM 行保存时必须中文阻断')
const illegalSelect = selectWaterSoluble('BOM-MISSING-ILLEGAL', '是')
assert.equal(illegalSelect.select.value, '是', '已有异常事实被阻断时不得静默改成未勾选')
const preservedIllegal = getTechnicalDataVersionContent(illegalVersion.record.technicalVersionId)?.bomItems.find(
  (item) => item.id === 'BOM-MISSING-ILLEGAL',
)
assert.equal(preservedIllegal?.unit, '', '已有异常数据加载及操作后仍不得补单位')
assert.equal(preservedIllegal?.waterSolubleRequirement, '是', '已有异常业务事实不得被静默清除')

handleTechPackEvent({
  closest: (selector: string) => selector === '[data-tech-action]'
    ? ({ dataset: { techAction: 'switch-tab', tab: 'process' } } as HTMLElement)
    : null,
} as unknown as HTMLElement)
const processHtml = renderTechPackPage(illegalVersion.record.styleCode, {
  styleId: illegalVersion.record.styleId,
  technicalVersionId: illegalVersion.record.technicalVersionId,
})
assert.match(processHtml, /工序工艺/, 'BOM 单位阻断不得影响技术包工序 Tab')
assert.match(processHtml, /data-tech-action="open-add-technique"/, 'BOM 单位阻断不得影响工序字典入口')

console.log('check:tech-pack-bom-unit-guard passed')
