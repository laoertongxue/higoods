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
  canEditTechnicalModule,
  getTechnicalReviewPendingRoles,
  reopenTechPackReviewForRoles,
  returnTechPackReviewByModules,
  startTechPackReview,
  submitTechPackFirstStageReview,
} = await import('../src/data/pcs-tech-pack-review.ts')
const {
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  replaceTechnicalDataVersionStore,
} = await import('../src/data/pcs-technical-data-version-repository.ts')
const { buildTechPackReviewDiffSnapshot } = await import('../src/data/pcs-tech-pack-review-diff.ts')
const { renderTechPackPage } = await import('../src/pages/tech-pack.ts')
const {
  buildPatternFormStateFromItem,
  state,
} = await import('../src/pages/tech-pack/context.ts')
const { renderPatternFormDialog } = await import('../src/pages/tech-pack/pattern-domain.ts')

const styleId = 'STYLE-PATTERN-OWNERSHIP'
const styleCode = 'STYLE-PATTERN-OWNERSHIP'
const technicalVersionId = 'tdv_pattern_ownership_001'
const baselineVersionId = 'tdv_pattern_ownership_base'
const bomItemId = 'bom-pattern-ownership-main'
const packageId = 'pattern-package-main'
const associationId = 'pattern-association-main'
const bindingStripId = 'binding-waist-main'

function buildRecord(input: {
  technicalVersionId: string
  technicalVersionCode: string
  versionLabel: string
  versionNo: number
  versionStatus: 'DRAFT' | 'PUBLISHED'
  baseTechnicalVersionId?: string
  baseTechnicalVersionCode?: string
  publishedAt?: string
}): TechnicalDataVersionRecord {
  return {
    technicalVersionId: input.technicalVersionId,
    technicalVersionCode: input.technicalVersionCode,
    versionLabel: input.versionLabel,
    versionNo: input.versionNo,
    styleId,
    styleCode,
    styleName: '纸样维护归属验证款',
    sourceProjectId: 'PRJ-PATTERN-OWNERSHIP',
    sourceProjectCode: 'PRJ-PATTERN-OWNERSHIP',
    sourceProjectName: '纸样维护归属验证项目',
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
    baseTechnicalVersionId: input.baseTechnicalVersionId || '',
    baseTechnicalVersionCode: input.baseTechnicalVersionCode || '',
    changeScope: '手动新增',
    changeSummary: '验证纸样池、物料关联和审核重审',
    garmentDifficultyGrade: 'B',
    linkedPartTemplateIds: [],
    linkedPatternLibraryVersionIds: [],
    linkedPatternAssetIds: [],
    linkedPatternAssetCodes: [],
    archiveCollectedFlag: false,
    archiveCollectedAt: '',
    versionStatus: input.versionStatus,
    bomStatus: 'DRAFT',
    patternStatus: 'DRAFT',
    processStatus: 'DRAFT',
    gradingStatus: 'DRAFT',
    qualityStatus: 'DRAFT',
    colorMaterialStatus: 'DRAFT',
    designStatus: 'EMPTY',
    attachmentStatus: 'EMPTY',
    bomItemCount: 1,
    patternFileCount: 2,
    processEntryCount: 1,
    gradingRuleCount: 1,
    qualityRuleCount: 1,
    colorMaterialMappingCount: 1,
    designAssetCount: 0,
    attachmentCount: 0,
    completenessScore: 100,
    missingItemCodes: [],
    missingItemNames: [],
    publishedAt: input.publishedAt || '',
    publishedBy: input.publishedAt ? '系统' : '',
    createdAt: '2026-06-04 10:00',
    createdBy: '测试用户',
    updatedAt: '2026-06-04 10:00',
    updatedBy: '测试用户',
    note: '',
    legacySpuCode: '',
    legacyVersionLabel: '',
  }
}

function buildContent(input: { technicalVersionId: string; markerLengthM: number; materialAlias: string }): TechnicalDataVersionContent {
  const pieceRows = [
    { id: `${input.technicalVersionId}-front`, name: '前片', count: 1, sourceType: 'MANUAL' as const },
    { id: `${input.technicalVersionId}-back`, name: '后片', count: 1, sourceType: 'MANUAL' as const },
    { id: `${input.technicalVersionId}-waist`, name: '腰头', count: 1, sourceType: 'MANUAL' as const },
  ]
  const bindingStrips = [
    {
      bindingStripId,
      bindingStripName: '腰头捆条',
      relatedPieceId: `${input.technicalVersionId}-waist`,
      relatedPieceName: '腰头',
      lengthCm: 88,
      widthCm: 4.2,
      stripCount: 1,
      relatedMaterialId: '',
      relatedMaterialName: '',
      note: '捆条归属纸样包。',
    },
  ]
  return {
    technicalVersionId: input.technicalVersionId,
    patternFiles: [
      {
        id: packageId,
        recordKind: 'PACKAGE',
        patternName: '连衣裙主体纸样包',
        patternCategory: '主体片',
        patternMaterialType: 'WOVEN',
        patternMaterialTypeLabel: '布料纸样',
        patternFileMode: 'PAIRED_DXF_RUL',
        fileName: 'dress-main.dxf / dress-main.rul',
        dxfFileName: 'dress-main.dxf',
        rulFileName: 'dress-main.rul',
        uploadedAt: '2026-06-04 10:00',
        uploadedBy: '版师B',
        parseStatus: 'PARSED',
        parseStatusLabel: '已解析',
        maintainerStepStatus: '已完成',
        merchandiserInfoStatus: '已填写',
        patternMakerInfoStatus: '已解析',
        selectedSizeCodes: ['S', 'M', 'L'],
        linkedBomItemId: '',
        widthCm: 150,
        markerLengthM: input.markerLengthM,
        bindingStrips,
        totalPieceCount: 3,
        isWoolted: '否',
        pieceRows,
      },
      {
        id: associationId,
        recordKind: 'MATERIAL_ASSOCIATION',
        patternName: '连衣裙主体纸样包',
        patternCategory: '主体片',
        patternMaterialType: 'WOVEN',
        patternMaterialTypeLabel: '布料纸样',
        patternFileMode: 'PAIRED_DXF_RUL',
        fileName: 'dress-main.dxf / dress-main.rul',
        dxfFileName: 'dress-main.dxf',
        rulFileName: 'dress-main.rul',
        uploadedAt: '2026-06-04 10:00',
        uploadedBy: '版师B',
        parseStatus: 'PARSED',
        parseStatusLabel: '已解析',
        maintainerStepStatus: '已完成',
        merchandiserInfoStatus: '已填写',
        patternMakerInfoStatus: '已解析',
        selectedSizeCodes: ['S', 'M', 'L'],
        linkedBomItemId: bomItemId,
        linkedMaterialAlias: input.materialAlias,
        sourcePatternPackageId: packageId,
        sourcePatternPackageName: '连衣裙主体纸样包',
        widthCm: 150,
        markerLengthM: input.markerLengthM,
        bindingStrips,
        totalPieceCount: 3,
        isWoolted: '否',
        pieceRows,
      },
    ],
    patternDesc: '',
    processEntries: [
      {
        id: 'process-pattern-ownership-1',
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
        linkedPatternIds: [associationId],
      },
    ],
    sizeTable: [{ id: 'size-pattern-ownership-1', part: '胸围', S: 90, M: 94, L: 98, XL: 102, tolerance: 1 }],
    bomItems: [
      {
        id: bomItemId,
        type: '面料',
        name: '印花雪纺主面料',
        spec: 'Multi / 150cm',
        unitConsumption: 1.25,
        lossRate: 0.03,
        supplier: '供应商甲',
        linkedPatternIds: [associationId],
      },
    ],
    qualityRules: [
      {
        id: 'quality-pattern-ownership-1',
        checkItem: '外观',
        standardText: '无明显瑕疵',
        samplingRule: '首件 + 抽检',
        note: '',
      },
    ],
    colorMaterialMappings: [
      {
        id: 'mapping-pattern-ownership-1',
        spuCode: styleCode,
        colorCode: 'MULTI',
        colorName: 'Multi',
        status: 'CONFIRMED',
        generatedMode: 'MANUAL',
        lines: [
          {
            id: 'mapping-pattern-ownership-line-1',
            bomItemId,
            materialCode: bomItemId,
            materialName: '印花雪纺主面料',
            materialType: '面料',
            patternId: associationId,
            patternName: '连衣裙主体纸样包',
            pieceId: `${input.technicalVersionId}-front`,
            pieceName: '前片',
            pieceCountPerUnit: 1,
            unit: '米',
            sourceMode: 'MANUAL',
          },
        ],
      },
    ],
    patternDesigns: [],
    attachments: [],
    legacyCompatibleCostPayload: {
      materialCostItems: [{ id: 'MC-pattern-ownership-1', bomItemId, price: 12, currency: '人民币', unit: '人民币/件' }],
    },
  }
}

replaceTechnicalDataVersionStore({
  version: 3,
  records: [
    buildRecord({
      technicalVersionId: baselineVersionId,
      technicalVersionCode: 'TDV-PATTERN-OWNERSHIP-BASE',
      versionLabel: 'V0',
      versionNo: 0,
      versionStatus: 'PUBLISHED',
      publishedAt: '2026-06-01 10:00',
    }),
    buildRecord({
      technicalVersionId,
      technicalVersionCode: 'TDV-PATTERN-OWNERSHIP-001',
      versionLabel: 'V1',
      versionNo: 1,
      versionStatus: 'DRAFT',
      baseTechnicalVersionId: baselineVersionId,
      baseTechnicalVersionCode: 'TDV-PATTERN-OWNERSHIP-BASE',
    }),
  ],
  contents: [
    buildContent({ technicalVersionId: baselineVersionId, markerLengthM: 1.28, materialAlias: '旧主面料' }),
    buildContent({ technicalVersionId, markerLengthM: 1.42, materialAlias: '主面料关联' }),
  ],
  pendingItems: [],
})

const initialContent = getTechnicalDataVersionContent(technicalVersionId)
assert.ok(initialContent, '应能读取专项技术包内容')
const packageRecord = initialContent.patternFiles.find((item) => item.recordKind === 'PACKAGE')
const associationRecord = initialContent.patternFiles.find((item) => item.recordKind === 'MATERIAL_ASSOCIATION')
assert.ok(packageRecord, '应落纸样池纸样包数据')
assert.ok(associationRecord, '应落物料&纸样关联数据')
assert.equal(packageRecord.widthCm, 150, '纸样包应落门幅')
assert.equal(packageRecord.markerLengthM, 1.42, '纸样包应落排料长度')
assert.equal(packageRecord.bindingStrips?.length, 1, '纸样包应落捆条')
assert.equal(associationRecord.sourcePatternPackageId, packageId, '物料关联应指向纸样包')
assert.equal(associationRecord.bindingStrips?.[0]?.bindingStripName, '腰头捆条', '物料关联应继承纸样包捆条')

const renderedPattern = renderTechPackPage(styleCode, { styleId, technicalVersionId, activeTab: 'pattern' })
assert.ok(renderedPattern.includes('纸样池'), '页面应展示纸样池')
assert.ok(renderedPattern.includes('物料&纸样关联管理'), '页面应展示物料&纸样关联管理')
assert.ok(renderedPattern.includes('按物料关联纸样'), '页面应保留跟单维护的关联入口')

const associationItem = state.patternItems.find((item) => item.recordKind === 'MATERIAL_ASSOCIATION')
assert.ok(associationItem, '页面状态应载入物料&纸样关联记录')
state.addPatternDialogOpen = true
state.patternFormPurpose = 'ASSOCIATION'
state.patternMaintenanceStep = 'MERCHANDISER'
state.editPatternItemId = associationItem.id
state.newPattern = buildPatternFormStateFromItem(associationItem)
const associationDialogHtml = renderPatternFormDialog()
assert.ok(associationDialogHtml.includes('裁片明细'), '按物料关联纸样弹窗应展示裁片明细')
assert.ok(associationDialogHtml.includes('适用颜色与颜色片数'), '按物料关联纸样弹窗应展示颜色片数维护')
assert.ok(associationDialogHtml.includes('逐片特殊工艺'), '按物料关联纸样弹窗应展示逐片特殊工艺')
assert.equal(associationDialogHtml.includes('版师技术信息'), false, '按物料关联纸样弹窗不应再出现版师技术信息切换')
assert.equal(associationDialogHtml.includes('保存并进入版师技术信息'), false, '按物料关联纸样弹窗不应再出现进入版师技术信息按钮')
const eventSource = readFileSync('src/pages/tech-pack/events.ts', 'utf8')
assert.ok(
  eventSource.includes('[data-testid="pattern-association-dialog"]'),
  '逐片特殊工艺弹窗应能挂载到按物料关联纸样弹窗',
)

const patternDiff = buildTechPackReviewDiffSnapshot(getTechnicalDataVersionById(technicalVersionId)!, 'PATTERN_MAKER')
assert.ok(patternDiff.items.length > 0, '版师差异应能看到纸样包变化')
assert.ok(patternDiff.items.every((item) => item.scope === '纸样池'), '版师差异只能覆盖纸样池')
const merchandiserDiff = buildTechPackReviewDiffSnapshot(getTechnicalDataVersionById(technicalVersionId)!, 'MERCHANDISER')
assert.ok(
  merchandiserDiff.items.some((item) => item.scope === '物料&纸样关联管理'),
  '跟单差异应包含物料&纸样关联管理',
)
assert.ok(
  merchandiserDiff.items.some((item) => item.scope === '款色用料对应'),
  '跟单差异应包含款色用料对应',
)

let current = submitTechPackFirstStageReview(technicalVersionId, '维护人')
current = startTechPackReview(technicalVersionId, 'BUYER', '买手A')
current = approveTechPackReview(technicalVersionId, 'BUYER', '买手模块通过', '买手A')
current = startTechPackReview(technicalVersionId, 'PATTERN_MAKER', '版师B')
assert.equal(canEditTechnicalModule(current, 'PATTERN'), false, '版师审核中只锁纸样池')
assert.equal(canEditTechnicalModule(current, 'MATERIAL_PATTERN_LINK'), true, '版师审核中不锁物料&纸样关联')
assert.equal(canEditTechnicalModule(current, 'COLOR_MATERIAL_MAPPING'), true, '版师审核中不锁款色用料对应')
current = approveTechPackReview(technicalVersionId, 'PATTERN_MAKER', '纸样池通过', '版师B')
current = startTechPackReview(technicalVersionId, 'MERCHANDISER', '跟单C')
assert.equal(canEditTechnicalModule(current, 'MATERIAL_PATTERN_LINK'), false, '跟单复核中锁物料&纸样关联')

current = returnTechPackReviewByModules(technicalVersionId, ['PATTERN'], '纸样排料长度维护错误', '跟单C')
assert.equal(current.reviewStage, '第一阶段并行审核', '场景1：选择版师模块后回第一阶段')
assert.equal(current.buyerReview?.status, '审核-已通过', '场景1：未选买手时买手不重审')
assert.equal(current.patternMakerReview?.status, '待审核', '场景1：选纸样池时版师待审核')
assert.equal(current.merchandiserReview?.status, '审核-未通过', '场景1：跟单需最终复核')
assert.deepEqual(current.reviewUnlockedModuleKeys, ['PATTERN'], '场景1：只开放被选模块')
assert.deepEqual(getTechnicalReviewPendingRoles(current), ['版师'], '场景1：待审核角色只剩版师')
assert.equal(canEditTechnicalModule(current, 'PATTERN'), true, '场景1：纸样池可修改')
assert.equal(canEditTechnicalModule(current, 'MATERIAL_PATTERN_LINK'), false, '场景1：未选物料关联时保持只读')
assert.equal(canEditTechnicalModule(current, 'BOM'), false, '场景1：未选买手模块时保持只读')

current = startTechPackReview(technicalVersionId, 'PATTERN_MAKER', '版师B')
current = approveTechPackReview(technicalVersionId, 'PATTERN_MAKER', '纸样池复审通过', '版师B')
current = startTechPackReview(technicalVersionId, 'MERCHANDISER', '跟单C')
current = approveTechPackReview(technicalVersionId, 'MERCHANDISER', '跟单复核通过', '跟单C')
assert.equal(current.reviewStage, '待发布', '场景1复审完成后回到待发布')
assert.deepEqual(current.reviewUnlockedModuleKeys, [], '待发布时应清空重修模块')

current = reopenTechPackReviewForRoles(technicalVersionId, ['PATTERN_MAKER'], '待发布发现纸样包维护错误', '跟单C')
assert.equal(current.reviewStage, '第一阶段并行审核', '场景2：指定版师后回第一阶段')
assert.equal(current.patternMakerReview?.status, '待审核', '场景2：版师需要再审')
assert.equal(current.merchandiserReview?.status, '审核-未通过', '场景2：跟单也需要再审')
assert.equal(current.buyerReview?.status, '审核-已通过', '场景2：未指定买手时买手不重审')
assert.deepEqual(current.reviewUnlockedModuleKeys, ['PATTERN'], '场景2：指定版师只开放纸样池')
assert.equal(canEditTechnicalModule(current, 'PATTERN'), true, '场景2：纸样池可修改')
assert.equal(canEditTechnicalModule(current, 'MATERIAL_PATTERN_LINK'), false, '场景2：物料关联不随版师重审开放')

current = startTechPackReview(technicalVersionId, 'PATTERN_MAKER', '版师B')
current = approveTechPackReview(technicalVersionId, 'PATTERN_MAKER', '版师待发布重审通过', '版师B')
current = startTechPackReview(technicalVersionId, 'MERCHANDISER', '跟单C')
current = approveTechPackReview(technicalVersionId, 'MERCHANDISER', '跟单复核通过', '跟单C')

current = reopenTechPackReviewForRoles(technicalVersionId, ['MERCHANDISER'], '待发布发现物料关联维护错误', '跟单C')
assert.equal(current.reviewStage, '跟单复核', '场景2：指定跟单只回跟单复核')
assert.deepEqual(getTechnicalReviewPendingRoles(current), ['跟单'], '场景2：指定跟单只需跟单再审')
assert.ok(current.reviewUnlockedModuleKeys?.includes('MATERIAL_PATTERN_LINK'), '场景2：指定跟单开放物料&纸样关联')
assert.equal(canEditTechnicalModule(current, 'MATERIAL_PATTERN_LINK'), true, '场景2：跟单范围可修改')
assert.equal(canEditTechnicalModule(current, 'PATTERN'), false, '场景2：未指定版师时纸样池保持只读')

console.log('check:tech-pack-pattern-ownership-and-review-rework passed')
