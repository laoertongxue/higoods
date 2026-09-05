import { createPatternAsset, listPatternAssets } from './pcs-pattern-library.ts'
import type { PatternAssetRecord } from './pcs-pattern-library.ts'
import type {
  EngineeringMasterOrderRecord,
  EngineeringTaskMaterialLine,
  EngineeringTaskRecord,
} from './pcs-engineering-master-types.ts'
import type { TechnicalDataVersionRecord } from './pcs-technical-data-version-types.ts'

export interface EnsurePatternAssetForEngineeringMaterialLineInput {
  masterOrder: EngineeringMasterOrderRecord
  task: EngineeringTaskRecord
  line: EngineeringTaskMaterialLine
  reviewerName: string
  reviewedAt: string
  decision: '通过'
}

export function assertPatternAssetCanBeGeneratedForEngineeringMaterialLine(
  input: EnsurePatternAssetForEngineeringMaterialLineInput,
): void {
  if (input.task.taskType !== 'PATTERN_ARTWORK') throw new Error('仅花型任务可以生成花型资产。')
  if (input.decision !== '通过') throw new Error('只有审核通过的物料行可以生成花型资产。')
  if (input.line.status !== '正常') throw new Error('因需求变更结束的物料行不能生成花型资产。')
  if (!input.reviewerName.trim() || !input.reviewedAt.trim()) {
    throw new Error('花型资产缺少买手审核人或审核时间。')
  }

  const resultFileIds = input.line.resultFileIds.map((item) => item.trim()).filter(Boolean)
  const effectImageIds = input.line.effectImageIds.map((item) => item.trim()).filter(Boolean)
  if (!(resultFileIds[0] || effectImageIds[0])) {
    throw new Error(`物料行 ${input.line.materialLineId} 缺少花型成果，不能生成资产。`)
  }
  if (!input.line.materialSkuId.trim()) {
    throw new Error(`物料行 ${input.line.materialLineId} 缺少物料 SKU，不能生成资产。`)
  }
  if (!input.line.productColor?.trim()) {
    throw new Error(`物料行 ${input.line.materialLineId} 缺少商品颜色，不能生成资产。`)
  }
  if (!input.line.printProcess?.trim()) {
    throw new Error(`物料行 ${input.line.materialLineId} 缺少印花工艺，不能生成资产。`)
  }
}

function filenameFromReference(reference: string, fallback: string): string {
  const raw = reference.split(/[?#]/)[0]?.split('/').at(-1) || fallback
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function extensionFromFilename(filename: string): string {
  const extension = filename.split('.').at(-1)?.toLowerCase() || ''
  return extension && extension !== filename.toLowerCase() ? extension : 'ai'
}

export function ensurePatternAssetForEngineeringMaterialLine(
  input: EnsurePatternAssetForEngineeringMaterialLineInput,
): PatternAssetRecord {
  assertPatternAssetCanBeGeneratedForEngineeringMaterialLine(input)
  const reviewerName = input.reviewerName.trim()
  const reviewedAt = input.reviewedAt.trim()

  const existing = listPatternAssets().find((asset) => {
    const snapshot = asset.source_pattern_task_snapshot
    return snapshot?.source_master_order_id === input.masterOrder.masterOrderId
      && snapshot.source_task_id === input.task.taskId
      && snapshot.source_material_line_id === input.line.materialLineId
  })
  if (existing) return existing

  const resultFileIds = input.line.resultFileIds.map((item) => item.trim()).filter(Boolean)
  const effectImageIds = input.line.effectImageIds.map((item) => item.trim()).filter(Boolean)
  const primaryReference = resultFileIds[0] || effectImageIds[0]!
  const materialSku = input.line.materialSkuId.trim()
  const productColor = input.line.productColor!.trim()
  const printProcess = input.line.printProcess!.trim()
  const originalFilename = filenameFromReference(primaryReference, `${input.line.materialLineId}.ai`)
  const fileExt = extensionFromFilename(originalFilename)

  return createPatternAsset({
    patternName: `${input.masterOrder.styleCode}-${productColor || input.line.materialName}`,
    aliases: [materialSku, input.line.materialLineId],
    usageType: printProcess,
    category: '未分类',
    styleTags: [],
    colorTags: productColor ? [productColor] : [],
    hotFlag: false,
    sourceType: '工程花型任务',
    sourceNote: `${input.masterOrder.masterOrderCode} / ${input.task.taskName} / ${input.line.materialName}`,
    sourceTaskId: input.task.taskId,
    sourceTaskCode: input.task.taskId,
    sourceTaskType: input.task.taskType,
    sourceTaskName: input.task.taskName,
    buyerReviewStatus: '通过',
    assignedTeamName: input.task.ownerTeamName,
    applicableCategories: [],
    applicableParts: [],
    relatedPartTemplateIds: [],
    processDirection: printProcess,
    maintenanceStatus: '待补录',
    sourcePatternTaskSnapshot: {
      process_type: printProcess,
      fabric_sku: materialSku,
      fabric_name: input.line.materialName,
      assigned_team_name: input.task.ownerTeamName,
      buyer_review_status: '通过',
      source_master_order_id: input.masterOrder.masterOrderId,
      source_task_id: input.task.taskId,
      source_material_line_id: input.line.materialLineId,
      material_sku: materialSku,
      product_color: productColor,
      result_file_ids: resultFileIds,
      effect_image_ids: effectImageIds,
      buyer_reviewed_by: reviewerName,
      buyer_reviewed_at: reviewedAt,
    },
    createdBy: reviewerName,
    submitForReview: false,
    parsedFile: {
      originalFilename,
      fileExt,
      mimeType: fileExt === 'png' ? 'image/png' : fileExt === 'jpg' || fileExt === 'jpeg' ? 'image/jpeg' : 'application/octet-stream',
      fileSize: 0,
      filenameTokens: [],
      previewUrl: effectImageIds[0],
      thumbnailUrl: effectImageIds[0],
      parseStatus: 'success',
      parseSummary: '工程花型成果已归档',
      dominantColors: productColor ? [productColor] : [],
      parseWarnings: [],
      parseResultJson: {
        sourceMasterOrderId: input.masterOrder.masterOrderId,
        sourceTaskId: input.task.taskId,
        sourceMaterialLineId: input.line.materialLineId,
        reviewedBy: reviewerName,
        reviewedAt,
      },
    },
    license: {
      license_status: 'unverified',
      attachment_urls: [],
    },
    duplicateAction: 'force-new',
  })
}

export function listPatternAssetsByProjectId(projectId: string): PatternAssetRecord[] {
  return listPatternAssets().filter((asset) => asset.source_project_id === projectId)
}

export function listPatternAssetsByTechPackVersionId(technicalVersionId: string): PatternAssetRecord[] {
  return listPatternAssets().filter((asset) => asset.source_tech_pack_version_id === technicalVersionId)
}

export function listPatternAssetsForTechPackVersions(versions: TechnicalDataVersionRecord[]): PatternAssetRecord[] {
  const assetIds = new Set<string>()
  const versionIds = new Set<string>()
  versions.forEach((version) => {
    ;(version.linkedPatternAssetIds ?? []).forEach((assetId) => assetIds.add(assetId))
    if (version.technicalVersionId) versionIds.add(version.technicalVersionId)
  })
  const map = new Map<string, PatternAssetRecord>()
  listPatternAssets().forEach((asset) => {
    if (assetIds.has(asset.id) || (asset.source_tech_pack_version_id && versionIds.has(asset.source_tech_pack_version_id))) {
      map.set(asset.id, asset)
    }
  })
  return Array.from(map.values())
}
