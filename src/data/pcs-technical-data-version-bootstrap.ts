import { listStyleArchives } from './pcs-style-archive-repository.ts'
import { listProductionDemandTechPackSeeds, type ProductionDemandTechPackSeed } from './pcs-production-demand-tech-pack-seeds.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
  TechnicalDataVersionStoreSnapshot,
} from './pcs-technical-data-version-types.ts'

function parseVersionNo(versionLabel: string, fallback: number): number {
  const matched = versionLabel.match(/(\d+(?:\.\d+)?)/)
  if (!matched) return fallback
  const value = Number.parseFloat(matched[1])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function buildSizeTable(seed: ProductionDemandTechPackSeed) {
  const sizes = new Set(seed.demand.skuLines.map((line) => line.size))
  const has = (size: string) => sizes.has(size)
  return [
    {
      id: `${seed.technicalVersionId}-size-1`,
      part: '关键尺寸',
      S: has('S') ? 48 : 0,
      M: has('M') ? 50 : 0,
      L: has('L') ? 52 : 0,
      XL: has('XL') ? 54 : 0,
      tolerance: 1,
    },
  ]
}

type SeedScenario = 'DEFAULT' | 'WHOLE_KNIT' | 'PART_KNIT' | 'GARMENT_HEAT_TRANSFER'

function resolveSeedScenario(seed: ProductionDemandTechPackSeed): SeedScenario {
  if (seed.demand.spuCode === 'SPU-2024-011' || seed.demand.spuCode === 'SPU-2024-012') return 'WHOLE_KNIT'
  if (seed.demand.spuCode === 'SPU-TEE-084') return 'PART_KNIT'
  if (seed.demand.spuCode === 'SPU-2024-004') return 'GARMENT_HEAT_TRANSFER'
  return 'DEFAULT'
}

function buildContent(seed: ProductionDemandTechPackSeed): TechnicalDataVersionContent {
  const { demand } = seed
  const scenario = resolveSeedScenario(seed)
  const allSkuCodes = demand.skuLines.map((line) => line.skuCode)
  const colors = Array.from(new Set(demand.skuLines.map((line) => line.color)))
  const bomItemId = `${seed.technicalVersionId}-bom-main`
  const patternId = `${seed.technicalVersionId}-pattern-main`
  const buildPieceRows = (pieces: Array<{ id: string; name: string; count: number }>) => pieces.map((piece) => ({
    ...piece,
    applicableSkuCodes: [...allSkuCodes],
    colorAllocations: colors.map((color, index) => ({
      id: `${piece.id}-color-${index + 1}`,
      colorName: color,
      skuCodes: demand.skuLines.filter((line) => line.color === color).map((line) => line.skuCode),
      pieceCount: piece.count,
    })),
    sourceType: 'MANUAL' as const,
  }))
  const defaultPieceRows = buildPieceRows([
    { id: `${patternId}-front`, name: '前片', count: 1 },
    { id: `${patternId}-back`, name: '后片', count: 1 },
    { id: `${patternId}-sleeve`, name: '袖片', count: 2 },
  ])
  const knitPieceRows = scenario === 'WHOLE_KNIT'
    ? buildPieceRows([{ id: `${patternId}-whole`, name: '整件针织成衣', count: 1 }])
    : buildPieceRows([
        { id: `${patternId}-collar`, name: '领口罗纹', count: 1 },
        { id: `${patternId}-cuff`, name: '袖口罗纹', count: 2 },
        { id: `${patternId}-hem`, name: '下摆罗纹', count: 1 },
      ])
  const isKnitScenario = scenario === 'WHOLE_KNIT' || scenario === 'PART_KNIT'
  const pieceRows = isKnitScenario ? knitPieceRows : defaultPieceRows
  const patternMaterialType = isKnitScenario ? 'KNIT' : 'WOVEN'
  const patternMaterialTypeLabel = isKnitScenario ? '针织纸样' : '布料纸样'
  const patternFileName = isKnitScenario ? `${demand.spuCode}-针织工艺单.pdf` : `${demand.spuCode}-正式纸样.dxf`
  const mainBomType = scenario === 'GARMENT_HEAT_TRANSFER' ? '半成品' : isKnitScenario ? '纱线' : '面料'
  const mainBomName = scenario === 'GARMENT_HEAT_TRANSFER'
    ? '纯色 T-shirt 半成品'
    : isKnitScenario
      ? '针织用纱线'
      : '主面料'
  const mainUsageProcessCodes = scenario === 'GARMENT_HEAT_TRANSFER'
    ? ['SPECIAL_CRAFT']
    : isKnitScenario
      ? ['KNITTING']
      : ['CUT_PANEL', 'SEW']
  const processEntries = scenario === 'WHOLE_KNIT'
    ? [
        {
          id: `${seed.technicalVersionId}-process-knit-whole`,
          entryType: 'CRAFT' as const,
          stageCode: 'PROD' as const,
          stageName: '生产执行',
          processCode: 'KNITTING',
          processName: '针织',
          craftCode: 'CRAFT_2000007',
          craftName: '整件针织',
          assignmentGranularity: 'SKU' as const,
          ruleSource: 'OVERRIDE_CRAFT',
          detailSplitMode: 'COMPOSITE',
          detailSplitDimensions: ['GARMENT_SKU'],
          defaultDocType: 'TASK' as const,
          taskTypeMode: 'CRAFT' as const,
          isSpecialCraft: false,
          knittingTaskType: 'WHOLE_GARMENT' as const,
          downstreamTarget: '后道工厂' as const,
          requiresFeiTicket: false,
          packagingRequired: true,
          materialIssueMode: 'WAREHOUSE_DELIVERY' as const,
          linkedBomItemIds: [bomItemId],
          linkedPatternIds: [patternId],
          standardTimeMinutes: 18,
          timeUnit: '分钟/件',
          difficulty: 'HIGH' as const,
          remark: '整件针织完成后交后道工厂，熨烫必有，包装按本单要求执行。',
        },
      ]
    : scenario === 'PART_KNIT'
      ? [
          {
            id: `${seed.technicalVersionId}-process-knit-part`,
            entryType: 'CRAFT' as const,
            stageCode: 'PROD' as const,
            stageName: '生产执行',
            processCode: 'KNITTING',
            processName: '针织',
            craftCode: 'CRAFT_2000008',
            craftName: '部位针织',
            assignmentGranularity: 'DETAIL' as const,
            ruleSource: 'OVERRIDE_CRAFT',
            detailSplitMode: 'COMPOSITE',
            detailSplitDimensions: ['PATTERN', 'GARMENT_SKU'],
            defaultDocType: 'TASK' as const,
            taskTypeMode: 'CRAFT' as const,
            isSpecialCraft: false,
            knittingTaskType: 'PART_PANEL' as const,
            downstreamTarget: '裁床待交出仓' as const,
            requiresFeiTicket: true,
            packagingRequired: false,
            materialIssueMode: 'WAREHOUSE_DELIVERY' as const,
            linkedBomItemIds: [bomItemId],
            linkedPatternIds: [patternId],
            standardTimeMinutes: 2.5,
            timeUnit: '分钟/件',
            difficulty: 'MEDIUM' as const,
            remark: '部位针织按部位、颜色、尺码生成明细并打印菲票，完成后交裁床待交出仓。',
          },
        ]
      : scenario === 'GARMENT_HEAT_TRANSFER'
        ? [
            {
              id: `${seed.technicalVersionId}-process-heat-transfer`,
              entryType: 'CRAFT' as const,
              stageCode: 'PROD' as const,
              stageName: '生产执行',
              processCode: 'SPECIAL_CRAFT',
              processName: '特殊工艺',
              craftCode: 'CRAFT_008192',
              craftName: '烫画',
              assignmentGranularity: 'SKU' as const,
              ruleSource: 'OVERRIDE_CRAFT',
              detailSplitMode: 'COMPOSITE',
              detailSplitDimensions: ['GARMENT_SKU'],
              defaultDocType: 'TASK' as const,
              taskTypeMode: 'CRAFT' as const,
              isSpecialCraft: true,
              selectedTargetObject: '成衣半成品' as const,
              targetObject: 'GARMENT_SEMI' as const,
              targetObjectName: '成衣半成品' as const,
              supportedTargetObjects: ['CUT_PIECE', 'SEMI_FINISHED_GARMENT'] as const,
              supportedTargetObjectLabels: ['已裁部位', '成衣半成品'] as const,
              linkedBomItemIds: [bomItemId],
              standardTimeMinutes: 0.7,
              timeUnit: '分钟/件',
              difficulty: 'MEDIUM' as const,
              remark: '在纯色 T-shirt 半成品上烫画，按 SKU 件数生成特殊工艺任务。',
            },
          ]
        : [
            {
              id: `${seed.technicalVersionId}-process-cut`,
              entryType: 'PROCESS_BASELINE' as const,
              stageCode: 'PREP' as const,
              stageName: '裁前准备',
              processCode: 'CUT_PANEL',
              processName: '裁片',
              assignmentGranularity: 'ORDER' as const,
              defaultDocType: 'TASK' as const,
              taskTypeMode: 'PROCESS' as const,
              isSpecialCraft: false,
              standardTimeMinutes: 8,
              timeUnit: '分钟/件',
            },
            {
              id: `${seed.technicalVersionId}-process-sew`,
              entryType: 'PROCESS_BASELINE' as const,
              stageCode: 'PROD' as const,
              stageName: '生产执行',
              processCode: 'SEW',
              processName: '车缝',
              assignmentGranularity: 'SKU' as const,
              defaultDocType: 'TASK' as const,
              taskTypeMode: 'PROCESS' as const,
              isSpecialCraft: false,
              standardTimeMinutes: 12,
              timeUnit: '分钟/件',
            },
          ]

  return {
    technicalVersionId: seed.technicalVersionId,
    patternFiles: [
      {
        id: patternId,
        patternName: isKnitScenario ? `${demand.spuCode} 针织纸样` : `${demand.spuCode} 正式纸样`,
        patternCategory: isKnitScenario ? '结构片' : '主体片',
        patternMaterialType,
        patternMaterialTypeLabel,
        patternFileMode: 'SINGLE_FILE',
        fileName: patternFileName,
        fileUrl: `local://demand-tech-pack/${demand.spuCode}/pattern`,
        uploadedAt: demand.updatedAt,
        uploadedBy: '生产需求单',
        singlePatternFileName: patternFileName,
        parseStatus: isKnitScenario ? 'NOT_REQUIRED' : 'PARSED',
        parseStatusLabel: isKnitScenario ? '无需解析' : '已解析',
        merchandiserInfoStatus: '已填写',
        patternMakerInfoStatus: '已完成',
        maintainerStepStatus: '已完成',
        selectedSizeCodes: Array.from(new Set(demand.skuLines.map((line) => line.size))),
        linkedBomItemId: bomItemId,
        totalPieceCount: pieceRows.reduce((sum, row) => sum + row.count, 0),
        isKnitted: isKnitScenario ? '是' : '否',
        pieceRows,
      },
    ],
    patternDesc: scenario === 'WHOLE_KNIT'
      ? '整件针织技术包，生产单生成针织加工单，完成后交后道工厂。'
      : scenario === 'PART_KNIT'
        ? '部位针织技术包，生产单生成部位针织加工单和针织菲票，完成后交裁床待交出仓。'
        : scenario === 'GARMENT_HEAT_TRANSFER'
          ? '纯色 T-shirt 半成品烫画技术包，按成衣半成品生成特殊工艺任务。'
          : '来源生产需求单当前生效技术包。',
    processEntries,
    sizeTable: buildSizeTable(seed),
    bomItems: [
      {
        id: bomItemId,
        type: mainBomType,
        name: mainBomName,
        spec: scenario === 'GARMENT_HEAT_TRANSFER'
          ? `${colors.join(' / ') || '默认色'} 纯色 T-shirt`
          : isKnitScenario
            ? `${colors.join(' / ') || '默认色'} 纱线，染厂/面料仓送料到厂`
            : `${colors.join(' / ') || '默认色'} 主面料`,
        colorLabel: colors.join(' / '),
        unitConsumption: scenario === 'GARMENT_HEAT_TRANSFER' ? 1 : isKnitScenario ? 0.48 : 1.2,
        lossRate: isKnitScenario ? 0.05 : 0.03,
        supplier: '生产需求单指定',
        applicableSkuCodes: [...allSkuCodes],
        linkedPatternIds: [patternId],
        usageProcessCodes: mainUsageProcessCodes,
      },
    ],
    qualityRules: [],
    colorMaterialMappings: colors.map((color, index) => ({
      id: `${seed.technicalVersionId}-mapping-${index + 1}`,
      spuCode: demand.spuCode,
      colorCode: color,
      colorName: color,
      status: 'CONFIRMED',
      generatedMode: 'AUTO',
      lines: pieceRows.map((piece) => ({
        id: `${seed.technicalVersionId}-mapping-${index + 1}-${piece.id}`,
        bomItemId,
        materialName: mainBomName,
        materialType: scenario === 'GARMENT_HEAT_TRANSFER' ? '半成品' : isKnitScenario ? '其他' : '面料',
        patternId,
        patternName: isKnitScenario ? `${demand.spuCode} 针织纸样` : `${demand.spuCode} 正式纸样`,
        pieceId: piece.id,
        pieceName: piece.name,
        pieceCountPerUnit: piece.count,
        unit: '米',
        applicableSkuCodes: demand.skuLines.filter((line) => line.color === color).map((line) => line.skuCode),
        sourceMode: 'AUTO',
      })),
    })),
    patternDesigns: [],
    attachments: [],
    legacyCompatibleCostPayload: {},
  }
}

export function createTechnicalDataVersionBootstrapSnapshot(
  version: number,
): TechnicalDataVersionStoreSnapshot {
  const styles = listStyleArchives()
  const styleByCode = new Map(styles.map((style) => [style.styleCode, style]))
  const records: TechnicalDataVersionRecord[] = []
  const contents: TechnicalDataVersionContent[] = []
  const pendingItems: TechnicalDataVersionStoreSnapshot['pendingItems'] = []

  listProductionDemandTechPackSeeds().forEach((seed) => {
    const style = styleByCode.get(seed.demand.spuCode)
    if (!style) return
    const versionNo = parseVersionNo(seed.versionLabel, seed.seedIndex + 1)
    const content = buildContent(seed)

    records.push({
      technicalVersionId: seed.technicalVersionId,
      technicalVersionCode: seed.technicalVersionCode,
      versionLabel: seed.versionLabel,
      versionNo,
      styleId: style.styleId,
      styleCode: style.styleCode,
      styleName: style.styleName,
      sourceProjectId: style.sourceProjectId || '',
      sourceProjectCode: style.sourceProjectCode || '',
      sourceProjectName: style.sourceProjectName || '',
      sourceProjectNodeId: '',
      primaryPlateTaskId: '',
      primaryPlateTaskCode: '',
      primaryPlateTaskVersion: '',
      linkedRevisionTaskIds: [],
      linkedPatternTaskIds: [],
      linkedArtworkTaskIds: [],
      createdFromTaskType: 'REVISION',
      createdFromTaskId: '',
      createdFromTaskCode: '',
      baseTechnicalVersionId: '',
      baseTechnicalVersionCode: '',
      changeScope: '改版生成',
      changeSummary: '生产需求单当前生效技术包初始化。',
      linkedPartTemplateIds: [],
      linkedPatternLibraryVersionIds: [],
      linkedPatternAssetIds: [],
      linkedPatternAssetCodes: [],
      archiveCollectedFlag: false,
      archiveCollectedAt: '',
      versionStatus: 'PUBLISHED',
      bomStatus: 'COMPLETE',
      patternStatus: 'COMPLETE',
      processStatus: 'COMPLETE',
      gradingStatus: 'COMPLETE',
      qualityStatus: 'EMPTY',
      colorMaterialStatus: 'COMPLETE',
      designStatus: 'EMPTY',
      attachmentStatus: 'EMPTY',
      bomItemCount: content.bomItems.length,
      patternFileCount: content.patternFiles.length,
      processEntryCount: content.processEntries.length,
      gradingRuleCount: 1,
      qualityRuleCount: 0,
      colorMaterialMappingCount: Array.from(new Set(seed.demand.skuLines.map((line) => line.color))).length,
      designAssetCount: content.patternDesigns.length,
      attachmentCount: content.attachments.length,
      completenessScore: 100,
      missingItemCodes: [],
      missingItemNames: [],
      publishedAt: seed.demand.updatedAt || '',
      publishedBy: '生产需求单',
      createdAt: seed.demand.updatedAt || '',
      createdBy: '生产需求单',
      updatedAt: seed.demand.updatedAt || '',
      updatedBy: '生产需求单',
      note: '',
      legacySpuCode: '',
      legacyVersionLabel: '',
    })
    contents.push(content)
  })

  return {
    version,
    records,
    contents,
    pendingItems,
  }
}
