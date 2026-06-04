import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-types.ts'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
  },
  configurable: true,
})

const {
  approveTechPackReview,
  returnTechPackReviewToFirstStage,
  startTechPackReview,
  submitTechPackFirstStageReview,
} = await import('../src/data/pcs-tech-pack-review.ts')
const {
  replaceTechnicalDataVersionStore,
} = await import('../src/data/pcs-technical-data-version-repository.ts')
const { renderTechPackPage } = await import('../src/pages/tech-pack.ts')

const technicalVersionId = 'tdv_review_module_lock_001'
const styleId = 'STYLE-REVIEW-MODULE-LOCK'
const styleCode = 'STYLE-REVIEW-MODULE-LOCK'

const record = {
  technicalVersionId,
  technicalVersionCode: 'TDV-REVIEW-MODULE-LOCK-001',
  versionLabel: 'V1',
  versionNo: 1,
  styleId,
  styleCode,
  styleName: '模块锁定验证款',
  sourceProjectId: 'PRJ-REVIEW-MODULE-LOCK',
  sourceProjectCode: 'PRJ-REVIEW-MODULE-LOCK',
  sourceProjectName: '模块锁定验证项目',
  sourceProjectNodeId: '',
  primaryPlateTaskId: '',
  primaryPlateTaskCode: '',
  primaryPlateTaskVersion: '',
  linkedRevisionTaskIds: [],
  linkedPatternTaskIds: [],
  linkedArtworkTaskIds: [],
  createdFromTaskType: 'MANUAL',
  createdFromTaskId: '',
  createdFromTaskCode: '',
  baseTechnicalVersionId: '',
  baseTechnicalVersionCode: '',
  changeScope: '手动新增',
  changeSummary: '审核模块锁定验证',
  garmentDifficultyGrade: 'B',
  linkedPartTemplateIds: [],
  linkedPatternLibraryVersionIds: [],
  linkedPatternAssetIds: [],
  linkedPatternAssetCodes: [],
  archiveCollectedFlag: false,
  archiveCollectedAt: '',
  versionStatus: 'DRAFT',
  bomStatus: 'DRAFT',
  patternStatus: 'DRAFT',
  processStatus: 'DRAFT',
  gradingStatus: 'DRAFT',
  qualityStatus: 'DRAFT',
  colorMaterialStatus: 'DRAFT',
  designStatus: 'EMPTY',
  attachmentStatus: 'EMPTY',
  bomItemCount: 1,
  patternFileCount: 1,
  processEntryCount: 1,
  gradingRuleCount: 1,
  qualityRuleCount: 1,
  colorMaterialMappingCount: 1,
  designAssetCount: 0,
  attachmentCount: 0,
  completenessScore: 100,
  missingItemCodes: [],
  missingItemNames: [],
  publishedAt: '',
  publishedBy: '',
  createdAt: '2026-05-25 12:00',
  createdBy: '测试用户',
  updatedAt: '2026-05-25 12:00',
  updatedBy: '测试用户',
  note: '',
  legacySpuCode: '',
  legacyVersionLabel: '',
} satisfies TechnicalDataVersionRecord

const content: TechnicalDataVersionContent = {
  technicalVersionId,
  patternFiles: [
    {
      id: 'pattern-module-lock-1',
      recordKind: 'MATERIAL_ASSOCIATION',
      patternName: '前片纸样',
      fileName: 'front.dxf',
      fileUrl: '#',
      uploadedAt: '2026-05-25 12:00',
      uploadedBy: '版师',
    },
  ],
  patternDesc: '',
  processEntries: [
    {
      id: 'process-module-lock-1',
      entryType: 'CRAFT',
      stageCode: 'PROD',
      stageName: '生产阶段',
      processCode: 'SEW',
      processName: '车缝',
      craftCode: 'SEW_BASE',
      craftName: '基础车缝',
      assignmentGranularity: 'ORDER',
      defaultDocType: 'TASK',
      taskTypeMode: 'CRAFT',
      isSpecialCraft: false,
    },
  ],
  sizeTable: [{ id: 'size-module-lock-1', part: '胸围', S: 90, M: 94, L: 98, XL: 102, tolerance: 1 }],
  bomItems: [
    {
      id: 'bom-module-lock-1',
      type: '面料',
      name: '主面料',
      spec: '棉涤混纺',
      unitConsumption: 1.2,
      lossRate: 0.03,
      supplier: '供应商甲',
    },
  ],
  qualityRules: [
    {
      id: 'quality-module-lock-1',
      checkItem: '外观',
      standardText: '无明显瑕疵',
      samplingRule: '首件 + 抽检',
      note: '',
    },
  ],
  colorMaterialMappings: [
    {
      id: 'mapping-module-lock-1',
      spuCode: styleCode,
      colorCode: 'BK',
      colorName: '黑色',
      status: 'AUTO_DRAFT',
      generatedMode: 'SYSTEM',
      lines: [],
      remark: '',
    },
  ],
  patternDesigns: [],
  attachments: [],
  legacyCompatibleCostPayload: {
    materialCostItems: [
      { id: 'MC-bom-module-lock-1', bomItemId: 'bom-module-lock-1', price: 12, currency: '人民币', unit: '人民币/件' },
    ],
    customCostItems: [
      { id: 'CC-module-lock-1', name: '打样费', price: 80, currency: '人民币', unit: '人民币/项', remark: '' },
    ],
  },
}

replaceTechnicalDataVersionStore({
  version: 3,
  records: [record],
  contents: [content],
  pendingItems: [],
})

type RenderOptions = NonNullable<Parameters<typeof renderTechPackPage>[1]>
const render = (activeTab: RenderOptions['activeTab']) =>
  renderTechPackPage(styleCode, { styleId, technicalVersionId, activeTab })

submitTechPackFirstStageReview(technicalVersionId, '维护人')
assert.ok(render('bom').includes('添加物料'), '第一阶段待买手审核时物料清单应可编辑')
assert.ok(render('pattern').includes('添加纸样包'), '第一阶段待版师审核时纸样管理应可编辑')
assert.ok(render('pattern').includes('按物料关联纸样'), '第一阶段跟单维护的物料&纸样关联应可编辑')

startTechPackReview(technicalVersionId, 'BUYER', '买手A')
assert.equal(render('bom').includes('添加物料'), false, '买手审核中物料清单应隐藏添加入口')
const lockedCostHtml = render('cost')
assert.equal(lockedCostHtml.includes('添加成本项'), false, '买手审核中核价应隐藏添加成本项入口')
assert.match(lockedCostHtml, /data-tech-field="material-price"[^>]*disabled/, '买手审核中核价单价输入应禁用')
assert.ok(render('pattern').includes('添加纸样包'), '买手审核中不应锁定版师纸样模块')
assert.ok(render('pattern').includes('按物料关联纸样'), '买手审核中不应锁定跟单物料&纸样关联模块')

approveTechPackReview(technicalVersionId, 'BUYER', '物料和核价通过', '买手A')
startTechPackReview(technicalVersionId, 'PATTERN_MAKER', '版师B')
assert.equal(render('pattern').includes('添加纸样包'), false, '版师审核中纸样管理应隐藏添加入口')
assert.ok(render('pattern').includes('按物料关联纸样'), '版师审核中物料&纸样关联仍由跟单可维护')
const editableMappingHtml = render('color-mapping')
assert.ok(editableMappingHtml.includes('新增映射行'), '版师审核中款色用料对应仍由跟单可维护')
assert.ok(editableMappingHtml.includes('data-tech-field="mapping-remark"'), '版师审核中款色用料对应备注仍可编辑')

approveTechPackReview(technicalVersionId, 'PATTERN_MAKER', '纸样和映射通过', '版师B')
startTechPackReview(technicalVersionId, 'MERCHANDISER', '跟单C')
assert.equal(render('pattern').includes('按物料关联纸样'), false, '跟单复核中物料&纸样关联应锁定')
const lockedMappingHtml = render('color-mapping')
assert.equal(lockedMappingHtml.includes('新增映射行'), false, '跟单复核中款色用料对应应隐藏新增映射行入口')
assert.equal(lockedMappingHtml.includes('data-tech-field="mapping-remark"'), false, '跟单复核中款色用料对应应切换为只读展示')
returnTechPackReviewToFirstStage(technicalVersionId, '跟单复核发现问题，打回上一阶段', '跟单C')
assert.ok(render('bom').includes('添加物料'), '跟单打回后买手模块应重新可编辑')
assert.ok(render('pattern').includes('添加纸样包'), '跟单打回后版师模块应重新可编辑')
assert.ok(render('pattern').includes('按物料关联纸样'), '跟单打回后物料&纸样关联应重新可编辑')
assert.ok(render('cost').includes('添加成本项'), '跟单打回后核价应重新可编辑')

const eventSource = readFileSync('src/pages/tech-pack/events.ts', 'utf8')
assert.ok(eventSource.includes('function getTechPackFieldModuleKey'), '事件层应按字段归属模块拦截')
assert.ok(eventSource.includes('function getTechPackActionModuleKey'), '事件层应按动作归属模块拦截')
assert.ok(eventSource.includes('isTechPackFieldReadOnly'), '字段变更应使用模块级只读判断')
assert.ok(eventSource.includes('isTechPackModuleReadOnly(lockedModuleKey)'), '按钮动作应使用模块级只读判断')

console.log('check:tech-pack-review-module-locks passed')
