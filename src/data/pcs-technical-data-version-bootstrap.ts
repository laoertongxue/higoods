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

type SeedScenario = 'DEFAULT' | 'WHOLE_WOOL' | 'PART_WOOL' | 'GARMENT_HEAT_TRANSFER'

function resolveSeedGarmentDifficulty(seed: ProductionDemandTechPackSeed) {
  const scenario = resolveSeedScenario(seed)
  if (scenario === 'WHOLE_WOOL') return 'A+' as const
  if (scenario === 'PART_WOOL') return 'A++' as const
  if (scenario === 'GARMENT_HEAT_TRANSFER') return 'B' as const
  if (seed.demand.spuCode === 'SPU-2024-009') return 'A' as const
  if (seed.demand.spuCode === 'SPU-2024-014') return 'C' as const
  return 'B' as const
}

function resolveSeedScenario(seed: ProductionDemandTechPackSeed): SeedScenario {
  if (seed.demand.spuCode === 'SPU-2024-011' || seed.demand.spuCode === 'SPU-2024-012') return 'WHOLE_WOOL'
  if (seed.demand.spuCode === 'SPU-TEE-084') return 'PART_WOOL'
  if (seed.demand.spuCode === 'SPU-2024-004') return 'GARMENT_HEAT_TRANSFER'
  return 'DEFAULT'
}

function buildDemoDesignPreviewDataUrl(fileName: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#f8fafc"/><rect x="22" y="22" width="276" height="156" rx="16" fill="#ffffff" stroke="#cbd5e1"/><text x="160" y="92" text-anchor="middle" font-size="22" fill="#334155" font-family="Arial, sans-serif">PRINT DESIGN</text><text x="160" y="124" text-anchor="middle" font-size="13" fill="#64748b" font-family="Arial, sans-serif">${fileName}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function buildSpecialCraftConfig(craftCode: string, craftName: string, selectedTargetObject = '裁片部位') {
  return {
    processCode: 'SPECIAL_CRAFT',
    processName: '特殊工艺',
    craftCode,
    craftName,
    displayName: craftName,
    selectedTargetObject,
    supportedTargetObjects: ['CUT_PIECE', 'CUT_PIECE_PART'],
    supportedTargetObjectLabels: ['裁片部位'],
  }
}

function buildContent(seed: ProductionDemandTechPackSeed): TechnicalDataVersionContent {
  const { demand } = seed
  const scenario = resolveSeedScenario(seed)
  const allSkuCodes = demand.skuLines.map((line) => line.skuCode)
  const colors = Array.from(new Set(demand.skuLines.map((line) => line.color)))
  const bomItemId = `${seed.technicalVersionId}-bom-main`
  const patternPackageId = `${seed.technicalVersionId}-pattern-package-main`
  const patternId = `${seed.technicalVersionId}-pattern-main`
  const buildPieceRows = (pieces: Array<{
    id: string
    name: string
    count: number
    bundleLengthCm?: number
    bundleWidthCm?: number
    stripCount?: number
    remark?: string
    specialCrafts?: Array<{
      processCode: string
      processName: string
      craftCode: string
      craftName: string
      displayName: string
      selectedTargetObject: string
      supportedTargetObjects: string[]
      supportedTargetObjectLabels: string[]
    }>
  }>) => pieces.map((piece) => ({
    ...piece,
    applicableSkuCodes: [...allSkuCodes],
    colorAllocations: colors.map((color, index) => ({
      id: `${piece.id}-color-${index + 1}`,
      colorName: color,
      skuCodes: demand.skuLines.filter((line) => line.color === color).map((line) => line.skuCode),
      pieceCount: piece.count,
    })),
    specialCrafts: piece.specialCrafts ?? [],
      sourceType: 'MANUAL' as const,
  }))
  const specialCraftsBySpuAndPiece: Record<string, Record<string, ReturnType<typeof buildSpecialCraftConfig>[]>> = {
    'SPU-2024-005': {
      后片: [
        buildSpecialCraftConfig('CRAFT_000032', '打条'),
        buildSpecialCraftConfig('CRAFT_3000002', '压褶'),
      ],
    },
    'SPU-2024-009': {
      前片: [
        buildSpecialCraftConfig('CRAFT_3000001', '绣花'),
        buildSpecialCraftConfig('CRAFT_000008', '打揽'),
      ],
    },
    'SPU-2024-014': {
      后片: [
        buildSpecialCraftConfig('CRAFT_016384', '直喷'),
        buildSpecialCraftConfig('CRAFT_3000008', '特种车缝（花样机）'),
      ],
    },
    'SPU-2024-015': {
      袖片: [
        buildSpecialCraftConfig('CRAFT_3000003', '贝壳绣'),
        buildSpecialCraftConfig('CRAFT_3000009', '橡筋定长切割'),
      ],
    },
    'SPU-2024-016': {
      前片: [buildSpecialCraftConfig('CRAFT_3000004', '曲牙绣')],
    },
    'SPU-2024-017': {
      后片: [buildSpecialCraftConfig('CRAFT_3000005', '一字贝绣花')],
    },
  }
  const getPieceSpecialCrafts = (pieceName: string) => specialCraftsBySpuAndPiece[demand.spuCode]?.[pieceName] ?? []
  const defaultPieceRows = buildPieceRows([
    {
      id: `${patternId}-front`,
      name: '前片',
      count: 1,
      specialCrafts: [
        ...getPieceSpecialCrafts('前片'),
        ...(demand.spuCode === 'SPU-2024-010' ? [buildSpecialCraftConfig('CRAFT_3000006', '模板工序')] : []),
      ],
    },
    {
      id: `${patternId}-back`,
      name: '后片',
      count: 1,
      specialCrafts: [
        ...getPieceSpecialCrafts('后片'),
        ...(demand.spuCode === 'SPU-2024-013' ? [buildSpecialCraftConfig('CRAFT_3000007', '激光开袋')] : []),
      ],
    },
    {
      id: `${patternId}-sleeve`,
      name: '袖片',
      count: 2,
      bundleLengthCm: demand.spuCode === 'SPU-2024-010' ? 34 : undefined,
      bundleWidthCm: demand.spuCode === 'SPU-2024-010' ? 1.2 : undefined,
      stripCount: demand.spuCode === 'SPU-2024-010' ? 2 : undefined,
      remark: demand.spuCode === 'SPU-2024-010' ? '捆条：袖口捆条，按裁床捆条加工单生成' : undefined,
      specialCrafts: getPieceSpecialCrafts('袖片'),
    },
  ])
  const woolPieceRows = scenario === 'WHOLE_WOOL'
    ? buildPieceRows([{ id: `${patternId}-whole`, name: '整件毛织成衣', count: 1 }])
    : buildPieceRows([
        { id: `${patternId}-collar`, name: '领口罗纹', count: 1 },
        { id: `${patternId}-cuff`, name: '袖口罗纹', count: 2 },
        { id: `${patternId}-hem`, name: '下摆罗纹', count: 1 },
      ])
  const isWoolScenario = scenario === 'WHOLE_WOOL' || scenario === 'PART_WOOL'
  const pieceRows = isWoolScenario ? woolPieceRows : defaultPieceRows
  const patternMaterialType = isWoolScenario ? 'WOOL' : 'WOVEN'
  const patternMaterialTypeLabel = isWoolScenario ? '毛织纸样' : '布料纸样'
  const patternFileName = isWoolScenario ? `${demand.spuCode}-毛织工艺单.pdf` : `${demand.spuCode}-正式纸样.dxf`
  const mainBomType = scenario === 'GARMENT_HEAT_TRANSFER' ? '半成品' : isWoolScenario ? '纱线' : '面料'
  const mainBomName = scenario === 'GARMENT_HEAT_TRANSFER'
    ? '纯色 T-shirt 半成品'
    : isWoolScenario
      ? '毛织用纱线'
      : '主面料'
  const mainUsageProcessCodes = scenario === 'GARMENT_HEAT_TRANSFER'
    ? ['SPECIAL_CRAFT']
    : isWoolScenario
      ? ['WOOL']
      : ['CUT_PANEL', 'SEW']
  const processEntries = scenario === 'WHOLE_WOOL'
    ? [
        {
          id: `${seed.technicalVersionId}-process-wool-whole`,
          entryType: 'CRAFT' as const,
          stageCode: 'PROD' as const,
          stageName: '生产执行',
          processCode: 'WOOL',
          processName: '毛织',
          craftCode: 'CRAFT_2000007',
          craftName: '整件毛织',
          assignmentGranularity: 'SKU' as const,
          ruleSource: 'OVERRIDE_CRAFT',
          detailSplitMode: 'COMPOSITE',
          detailSplitDimensions: ['GARMENT_SKU'],
          defaultDocType: 'TASK' as const,
          taskTypeMode: 'CRAFT' as const,
          isSpecialCraft: false,
          woolTaskType: 'WHOLE_GARMENT' as const,
          downstreamTarget: '后道工厂' as const,
          requiresFeiTicket: false,
          packagingRequired: true,
          materialIssueMode: 'WAREHOUSE_DELIVERY' as const,
          linkedBomItemIds: [bomItemId],
          linkedPatternIds: [patternId],
          outputValuePerUnit: 18,
          outputValueUnit: '产值/件',
          difficulty: 'HIGH' as const,
          remark: '整件毛织完成后交后道工厂，熨烫必有，包装按本单要求执行。',
        },
      ]
    : scenario === 'PART_WOOL'
      ? [
          {
            id: `${seed.technicalVersionId}-process-wool-part`,
            entryType: 'CRAFT' as const,
            stageCode: 'PROD' as const,
            stageName: '生产执行',
            processCode: 'WOOL',
            processName: '毛织',
            craftCode: 'CRAFT_2000008',
            craftName: '部位毛织',
            assignmentGranularity: 'DETAIL' as const,
            ruleSource: 'OVERRIDE_CRAFT',
            detailSplitMode: 'COMPOSITE',
            detailSplitDimensions: ['PATTERN', 'GARMENT_SKU'],
            defaultDocType: 'TASK' as const,
            taskTypeMode: 'CRAFT' as const,
            isSpecialCraft: false,
            woolTaskType: 'PART_PANEL' as const,
            downstreamTarget: '裁床待交出仓' as const,
            requiresFeiTicket: true,
            packagingRequired: false,
            materialIssueMode: 'WAREHOUSE_DELIVERY' as const,
            linkedBomItemIds: [bomItemId],
            linkedPatternIds: [patternId],
            outputValuePerUnit: 2.5,
            outputValueUnit: '产值/件',
            difficulty: 'MEDIUM' as const,
            remark: '部位毛织按部位、颜色、尺码生成明细并打印菲票，完成后交裁床待交出仓。',
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
              outputValuePerUnit: 0.7,
              outputValueUnit: '产值/件',
              difficulty: 'MEDIUM' as const,
              remark: '在纯色 T-shirt 半成品上烫画，按 SKU 件数生成特殊工艺任务。',
            },
          ]
        : [
            {
              id: `${seed.technicalVersionId}-process-cut`,
              entryType: 'PROCESS_BASELINE' as const,
              stageCode: 'PROD' as const,
              stageName: '生产阶段',
              processCode: 'CUT_PANEL',
              processName: '裁片',
              assignmentGranularity: 'ORDER' as const,
              defaultDocType: 'TASK' as const,
              taskTypeMode: 'PROCESS' as const,
              isSpecialCraft: false,
              outputValuePerUnit: 8,
              outputValueUnit: '产值/件',
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
              outputValuePerUnit: 12,
              outputValueUnit: '产值/件',
            },
          ]

  const resolveColorMaterialInfo = (color: string, index: number) => {
    const colorKey = color.trim().toLowerCase()
    if (demand.spuCode === 'SPU-2024-010') {
      const joggerMaterialMap: Record<string, { code: string; name: string }> = {
        black: {
          code: 'tdv_demand_SPU_2024_010-bom-black-stretch-twill',
          name: 'Black 弹力斜纹主面料',
        },
        charcoal: {
          code: 'tdv_demand_SPU_2024_010-bom-charcoal-stretch-twill',
          name: 'Charcoal 弹力斜纹主面料',
        },
        navy: {
          code: 'tdv_demand_SPU_2024_010-bom-navy-twill',
          name: 'Navy 斜纹主面料',
        },
        khaki: {
          code: 'tdv_demand_SPU_2024_010-bom-khaki-canvas',
          name: 'Khaki 帆布主面料',
        },
      }
      const mapped = joggerMaterialMap[colorKey]
      if (mapped) return mapped
      const colorToken = colorKey.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `color-${index + 1}`
      return {
        code: `tdv_demand_SPU_2024_010-bom-${colorToken}`,
        name: `${color} 主面料`,
      }
    }
    return {
      code: bomItemId,
      name: mainBomName,
    }
  }

  return {
    technicalVersionId: seed.technicalVersionId,
    patternFiles: [
      {
        id: patternPackageId,
        recordKind: 'PACKAGE',
        patternName: isWoolScenario ? `${demand.spuCode} 毛织纸样` : `${demand.spuCode} 正式纸样`,
        patternCategory: isWoolScenario ? '结构片' : '主体片',
        patternMaterialType,
        patternMaterialTypeLabel,
        patternFileMode: 'SINGLE_FILE',
        fileName: patternFileName,
        fileUrl: `local://demand-tech-pack/${demand.spuCode}/pattern`,
        uploadedAt: demand.updatedAt,
        uploadedBy: '生产需求单',
        singlePatternFileName: patternFileName,
        parseStatus: isWoolScenario ? 'NOT_REQUIRED' : 'PARSED',
        parseStatusLabel: isWoolScenario ? '无需解析' : '已解析',
        merchandiserInfoStatus: '已填写',
        patternMakerInfoStatus: '已完成',
        maintainerStepStatus: '已完成',
        selectedSizeCodes: Array.from(new Set(demand.skuLines.map((line) => line.size))),
        linkedBomItemId: '',
        widthCm: isWoolScenario ? 120 : 150,
        markerLengthM: isWoolScenario ? 0.8 : 1.35,
        bindingStrips: isWoolScenario
          ? []
          : [
              {
                bindingStripId: `${patternPackageId}-binding-1`,
                bindingStripName: '领口捆条',
                relatedPieceId: '',
                relatedPieceName: '领口',
                lengthCm: 42,
                widthCm: 3.2,
                stripCount: 1,
                relatedMaterialId: '',
                relatedMaterialName: '',
                note: '捆条归属纸样包，关联该纸样的物料均需制作。',
              },
            ],
        totalPieceCount: pieceRows.reduce((sum, row) => sum + row.count, 0),
        isWoolted: isWoolScenario ? '是' : '否',
        pieceRows,
      },
      {
        id: patternId,
        recordKind: 'MATERIAL_ASSOCIATION',
        patternName: isWoolScenario ? `${demand.spuCode} 毛织纸样` : `${demand.spuCode} 正式纸样`,
        patternCategory: isWoolScenario ? '结构片' : '主体片',
        patternMaterialType,
        patternMaterialTypeLabel,
        patternFileMode: 'SINGLE_FILE',
        fileName: patternFileName,
        fileUrl: `local://demand-tech-pack/${demand.spuCode}/pattern`,
        uploadedAt: demand.updatedAt,
        uploadedBy: '生产需求单',
        singlePatternFileName: patternFileName,
        parseStatus: isWoolScenario ? 'NOT_REQUIRED' : 'PARSED',
        parseStatusLabel: isWoolScenario ? '无需解析' : '已解析',
        merchandiserInfoStatus: '已填写',
        patternMakerInfoStatus: '已解析',
        maintainerStepStatus: '已完成',
        selectedSizeCodes: Array.from(new Set(demand.skuLines.map((line) => line.size))),
        linkedBomItemId: bomItemId,
        sourcePatternPackageId: patternPackageId,
        sourcePatternPackageName: isWoolScenario ? `${demand.spuCode} 毛织纸样` : `${demand.spuCode} 正式纸样`,
        widthCm: isWoolScenario ? 120 : 150,
        markerLengthM: isWoolScenario ? 0.8 : 1.35,
        bindingStrips: isWoolScenario
          ? []
          : [
              {
                bindingStripId: `${patternPackageId}-binding-1`,
                bindingStripName: '领口捆条',
                relatedPieceId: '',
                relatedPieceName: '领口',
                lengthCm: 42,
                widthCm: 3.2,
                stripCount: 1,
                relatedMaterialId: '',
                relatedMaterialName: '',
                note: '继承自纸样包。',
              },
            ],
        totalPieceCount: pieceRows.reduce((sum, row) => sum + row.count, 0),
        isWoolted: isWoolScenario ? '是' : '否',
        pieceRows,
      },
    ],
    patternDesc: scenario === 'WHOLE_WOOL'
      ? '整件毛织技术包，生产单生成毛织加工单，完成后交后道工厂。'
      : scenario === 'PART_WOOL'
        ? '部位毛织技术包，生产单生成部位毛织加工单和毛织菲票，完成后交裁床待交出仓。'
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
          : isWoolScenario
            ? `${colors.join(' / ') || '默认色'} 纱线，染厂/面料仓送料到厂`
            : `${colors.join(' / ') || '默认色'} 主面料`,
        colorLabel: colors.join(' / '),
        unitConsumption: scenario === 'GARMENT_HEAT_TRANSFER' ? 1 : isWoolScenario ? 0.48 : 1.2,
        lossRate: isWoolScenario ? 0.05 : 0.03,
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
        materialCode: resolveColorMaterialInfo(color, index).code,
        materialName: resolveColorMaterialInfo(color, index).name,
        materialType: scenario === 'GARMENT_HEAT_TRANSFER' ? '半成品' : isWoolScenario ? '其他' : '面料',
        patternId,
        patternName: isWoolScenario ? `${demand.spuCode} 毛织纸样` : `${demand.spuCode} 正式纸样`,
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

function buildProject018Content(technicalVersionId: string): TechnicalDataVersionContent {
  const bomItemId = `${technicalVersionId}-bom-main`
  const patternPackageId = `${technicalVersionId}-pattern-package-main`
  const patternId = `${technicalVersionId}-pattern-main`
  const frontDesignId = `${technicalVersionId}-design-front-main`
  const frontDesignFileName = 'SPU-2026-018-front-print.png'
  const skuCodes = ['SPU-2026-018-S-MULTI', 'SPU-2026-018-M-MULTI', 'SPU-2026-018-L-MULTI']
  const pieceRows = [
    { id: `${patternId}-front`, name: '前片', count: 1 },
    { id: `${patternId}-back`, name: '后片', count: 1 },
    { id: `${patternId}-pants`, name: '裤片', count: 2 },
    { id: `${patternId}-waist`, name: '腰头', count: 1 },
  ]
  return {
    technicalVersionId,
    patternFiles: [
      {
        id: patternPackageId,
        recordKind: 'PACKAGE',
        patternName: 'SPU-2026-018 连体裤纸样包',
        patternCategory: '主体片',
        patternMaterialType: 'WOVEN',
        patternMaterialTypeLabel: '布料纸样',
        patternFileMode: 'SINGLE_FILE',
        fileName: 'SPU-2026-018-P1.dxf',
        fileUrl: 'local://engineering/PT-20260407-018/pattern.dxf',
        uploadedAt: '2026-04-07 17:20',
        uploadedBy: '制版任务',
        singlePatternFileName: 'SPU-2026-018-P1.dxf',
        parseStatus: 'PARSED',
        parseStatusLabel: '已解析',
        merchandiserInfoStatus: '已填写',
        patternMakerInfoStatus: '已完成',
        maintainerStepStatus: '已完成',
        selectedSizeCodes: ['S', 'M', 'L'],
        linkedBomItemId: '',
        widthCm: 150,
        markerLengthM: 1.42,
        bindingStrips: [
          {
            bindingStripId: `${patternPackageId}-binding-waist`,
            bindingStripName: '腰头捆条',
            relatedPieceId: `${patternId}-waist`,
            relatedPieceName: '腰头',
            lengthCm: 88,
            widthCm: 4.2,
            stripCount: 1,
            relatedMaterialId: '',
            relatedMaterialName: '',
            note: '捆条归属纸样包，关联该纸样包的物料均需制作。',
          },
        ],
        totalPieceCount: pieceRows.reduce((sum, row) => sum + row.count, 0),
        isWoolted: '否',
        pieceRows: pieceRows.map((piece) => ({
          ...piece,
          applicableSkuCodes: [...skuCodes],
          colorAllocations: [
            {
              id: `${piece.id}-color-1`,
              colorName: 'Multi',
              colorCode: 'MULTI',
              skuCodes: [...skuCodes],
              pieceCount: piece.count,
            },
          ],
          sourceType: 'MANUAL',
        })),
      },
      {
        id: patternId,
        recordKind: 'MATERIAL_ASSOCIATION',
        patternName: 'SPU-2026-018 连体裤纸样包',
        patternCategory: '主体片',
        patternMaterialType: 'WOVEN',
        patternMaterialTypeLabel: '布料纸样',
        patternFileMode: 'SINGLE_FILE',
        fileName: 'SPU-2026-018-P1.dxf',
        fileUrl: 'local://engineering/PT-20260407-018/pattern.dxf',
        uploadedAt: '2026-04-07 17:20',
        uploadedBy: '制版任务',
        singlePatternFileName: 'SPU-2026-018-P1.dxf',
        parseStatus: 'PARSED',
        parseStatusLabel: '已解析',
        merchandiserInfoStatus: '已填写',
        patternMakerInfoStatus: '已解析',
        maintainerStepStatus: '已完成',
        selectedSizeCodes: ['S', 'M', 'L'],
        linkedBomItemId: bomItemId,
        sourcePatternPackageId: patternPackageId,
        sourcePatternPackageName: 'SPU-2026-018 连体裤纸样包',
        widthCm: 150,
        markerLengthM: 1.42,
        bindingStrips: [
          {
            bindingStripId: `${patternPackageId}-binding-waist`,
            bindingStripName: '腰头捆条',
            relatedPieceId: `${patternId}-waist`,
            relatedPieceName: '腰头',
            lengthCm: 88,
            widthCm: 4.2,
            stripCount: 1,
            relatedMaterialId: '',
            relatedMaterialName: '',
            note: '继承自纸样包。',
          },
        ],
        totalPieceCount: pieceRows.reduce((sum, row) => sum + row.count, 0),
        isWoolted: '否',
        pieceRows: pieceRows.map((piece) => ({
          ...piece,
          applicableSkuCodes: [...skuCodes],
          colorAllocations: [
            {
              id: `${piece.id}-color-1`,
              colorName: 'Multi',
              colorCode: 'MULTI',
              skuCodes: [...skuCodes],
              pieceCount: piece.count,
            },
          ],
          sourceType: 'MANUAL',
        })),
      },
    ],
    patternDesc: '由制版任务 PT-20260407-018 输出的连体裤正式纸样，作为款式档案首个正式技术包版本。',
    processEntries: [
      {
        id: `${technicalVersionId}-process-cut`,
        entryType: 'PROCESS_BASELINE',
        stageCode: 'PROD',
        stageName: '生产阶段',
        processCode: 'CUT_PANEL',
        processName: '裁片',
        assignmentGranularity: 'ORDER',
        ruleSource: '制版任务输出',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        linkedBomItemIds: [bomItemId],
        linkedPatternIds: [patternId],
        outputValuePerUnit: 9,
        outputValueUnit: '产值/件',
        difficulty: 'MEDIUM',
        remark: '按连体裤纸样完成裁片。',
      },
      {
        id: `${technicalVersionId}-process-sew`,
        entryType: 'PROCESS_BASELINE',
        stageCode: 'PROD',
        stageName: '生产执行',
        processCode: 'SEW',
        processName: '车缝',
        assignmentGranularity: 'SKU',
        ruleSource: '制版任务输出',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        outputValuePerUnit: 16,
        outputValueUnit: '产值/件',
        difficulty: 'HIGH',
        remark: '重点关注腰节拼接和裤脚展开角度。',
      },
    ],
    sizeTable: [
      {
        id: `${technicalVersionId}-size-1`,
        part: '胸围',
        S: 84,
        M: 88,
        L: 92,
        XL: 0,
        tolerance: 1,
      },
      {
        id: `${technicalVersionId}-size-2`,
        part: '裤长',
        S: 102,
        M: 104,
        L: 106,
        XL: 0,
        tolerance: 1,
      },
    ],
    bomItems: [
      {
        id: bomItemId,
        type: '面料',
        name: '印花雪纺主面料',
        spec: 'Multi / 150cm',
        colorLabel: 'Multi',
        unitConsumption: 1.85,
        lossRate: 5,
        supplier: '深圳面料仓',
        printRequirement: '印花',
        dyeRequirement: '无',
        shrinkRequirement: '否',
        washRequirement: '否',
        printSideMode: 'SINGLE',
        frontPatternDesignId: frontDesignId,
        applicableSkuCodes: [...skuCodes],
        linkedPatternIds: [patternId],
        usageProcessCodes: ['CUT_PANEL', 'SEW'],
      },
    ],
    qualityRules: [
      {
        id: `${technicalVersionId}-quality-1`,
        checkItem: '印花对位与腰节拼接',
        standardText: '花型主视觉居中，腰节拼接左右误差不超过 0.5cm。',
        outputValueplingRule: '首件确认后按批次抽检',
        note: '来源于制版确认意见。',
      },
    ],
    colorMaterialMappings: [
      {
        id: `${technicalVersionId}-mapping-multi`,
        spuCode: 'SPU-2026-018',
        colorCode: 'MULTI',
        colorName: 'Multi',
        status: 'AUTO_CONFIRMED',
        generatedMode: 'AUTO',
        confirmedBy: '系统初始化',
        confirmedAt: '2026-04-07 17:20',
        remark: '由 BOM 与纸样自动生成。',
        lines: pieceRows.map((piece) => ({
          id: `${technicalVersionId}-mapping-multi-${piece.id}`,
          bomItemId,
          materialCode: bomItemId,
          materialName: '印花雪纺主面料',
          materialType: '面料',
          patternId,
          patternName: 'SPU-2026-018 连体裤正式纸样',
          pieceId: piece.id,
          pieceName: piece.name,
          pieceCountPerUnit: piece.count,
          unit: '片',
          applicableSkuCodes: [...skuCodes],
          sourceMode: 'AUTO',
          note: '系统按纸样裁片生成',
        })),
      },
    ],
    patternDesigns: [
      {
        id: frontDesignId,
        name: 'Multi 正面印花设计图',
        designSideType: 'FRONT',
        fileName: frontDesignFileName,
        originalFileName: frontDesignFileName,
        imageUrl: buildDemoDesignPreviewDataUrl(frontDesignFileName),
        previewThumbnailDataUrl: buildDemoDesignPreviewDataUrl(frontDesignFileName),
        uploadedAt: '2026-04-07 17:20',
      },
    ],
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
      garmentDifficultyGrade: resolveSeedGarmentDifficulty(seed),
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

  const project018Style = styleByCode.get('SPU-2026-018')
  if (project018Style) {
    const technicalVersionId = 'tdv_seed_project_018_base'
    const content = buildProject018Content(technicalVersionId)
    records.push({
      technicalVersionId,
      technicalVersionCode: 'TDV-20260407-018',
      versionLabel: 'V1.0',
      versionNo: 1,
      styleId: project018Style.styleId,
      styleCode: project018Style.styleCode,
      styleName: project018Style.styleName,
      sourceProjectId: project018Style.sourceProjectId || 'prj_20251216_018',
      sourceProjectCode: project018Style.sourceProjectCode || 'PRJ-20251216-018',
      sourceProjectName: project018Style.sourceProjectName || '设计款印花阔腿连体裤改版',
      sourceProjectNodeId: project018Style.sourceProjectNodeId || '',
      primaryPlateTaskId: 'PT-20260407-018',
      primaryPlateTaskCode: 'PT-20260407-018',
      primaryPlateTaskVersion: 'P1',
      linkedRevisionTaskIds: [],
      linkedPatternTaskIds: ['PT-20260407-018'],
      linkedArtworkTaskIds: [],
      createdFromTaskType: 'PLATE',
      createdFromTaskId: 'PT-20260407-018',
      createdFromTaskCode: 'PT-20260407-018',
      baseTechnicalVersionId: '',
      baseTechnicalVersionCode: '',
      changeScope: '制版生成',
      changeSummary: '由制版任务 PT-20260407-018 建立款式档案首个正式技术包版本。',
      garmentDifficultyGrade: 'A+',
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
      qualityStatus: 'COMPLETE',
      colorMaterialStatus: 'COMPLETE',
      designStatus: 'EMPTY',
      attachmentStatus: 'EMPTY',
      bomItemCount: content.bomItems.length,
      patternFileCount: content.patternFiles.length,
      processEntryCount: content.processEntries.length,
      gradingRuleCount: content.sizeTable.length,
      qualityRuleCount: content.qualityRules.length,
      colorMaterialMappingCount: content.colorMaterialMappings.length,
      designAssetCount: content.patternDesigns.length,
      attachmentCount: content.attachments.length,
      completenessScore: 100,
      missingItemCodes: [],
      missingItemNames: [],
      publishedAt: '2026-04-07 17:20',
      publishedBy: '工程任务同步',
      createdAt: '2026-04-07 17:20',
      createdBy: '工程任务同步',
      updatedAt: '2026-04-07 17:20',
      updatedBy: '工程任务同步',
      note: '补齐款式档案正式技术包版本，来源制版任务。',
      legacySpuCode: '',
      legacyVersionLabel: '',
    })
    contents.push(content)
  }

  return {
    version,
    records,
    contents,
    pendingItems,
  }
}
