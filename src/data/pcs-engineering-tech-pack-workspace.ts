import { getEngineeringMasterOrderById } from './pcs-engineering-master-repository'
import { getStyleArchiveById } from './pcs-style-archive-repository'
import { listEngineeringPatternResultVersions } from './pcs-engineering-pattern-result'
import {
  createTechnicalDataVersionDraft,
  getNextStyleVersionMeta,
  getNextTechnicalVersionIdentity,
  getTechnicalDataVersionContent,
  listTechnicalDataVersions,
  listTechnicalDataVersionsByProjectId,
} from './pcs-technical-data-version-repository'
import type {
  TechnicalDataVersionRecord,
  TechnicalDataVersionContent,
  TechnicalModuleKey,
  TechnicalPatternFile,
  TechnicalPatternManagedFile,
  TechnicalReviewNode,
} from './pcs-technical-data-version-types'
import type { EngineeringUploadedFile } from './pcs-engineering-file-upload.ts'
import {
  captureEngineeringBomRepositoryState,
  copyEngineeringBomPricingPlan,
  createEngineeringBomVersionsForOwner,
  getEngineeringBomPricingPlan,
  listEngineeringBomVersionsByOwner,
  restoreEngineeringBomRepositoryState,
} from './pcs-engineering-bom-repository.ts'
import { resolveEngineeringBomMaterialLine } from './pcs-engineering-bom-material-resolver.ts'
import type { EngineeringBomVersionRecord } from './pcs-engineering-bom-types.ts'

export const TECH_PACK_MODULE_LABELS: Record<TechnicalModuleKey, string> = {
  BOM: 'BOM',
  COST: '价格',
  PATTERN: '纸样',
  MATERIAL_PATTERN_LINK: '花型',
  COLOR_MATERIAL_MAPPING: '颜色与物料',
  PROCESS: '工艺',
  SIZE: '尺码',
  DESIGN: '设计资料',
  ATTACHMENT: '附件',
  QUALITY: '质量要求',
}

function toManagedPatternFile(file?: EngineeringUploadedFile): TechnicalPatternManagedFile | undefined {
  if (!file || file.status !== '已保存' || !file.dataUrl) return undefined
  return {
    fileName: file.fileName,
    fileType: file.mimeType,
    fileSize: file.sizeBytes,
    uploadedAt: file.uploadedAt,
    uploadedBy: file.uploadedByName,
    dataUrl: file.dataUrl,
    previewUrl: file.purpose === 'PATTERN_PREVIEW' ? file.dataUrl : undefined,
  }
}

function buildPatternFilesFromResult(
  result: ReturnType<typeof listEngineeringPatternResultVersions>[number],
): TechnicalPatternFile[] {
  const sourceFiles = (result.sourceFiles || []).filter((file) => file.status === '已保存' && Boolean(file.dataUrl))
  if (sourceFiles.length === 0) return []
  const preview = (result.previewFiles || []).find((file) => file.status === '已保存' && Boolean(file.dataUrl))
  const prj = sourceFiles.find((file) => file.extension === 'prj')
  const dxf = sourceFiles.find((file) => file.extension === 'dxf')
  const rul = sourceFiles.find((file) => file.extension === 'rul')
  const pdf = sourceFiles.find((file) => file.extension === 'pdf')
  const primary = pdf || prj || sourceFiles[0]
  const selectedIds = new Set([prj?.fileId, dxf?.fileId, rul?.fileId, pdf?.fileId].filter(Boolean))
  const baseRecord = (file: EngineeringUploadedFile, index: number, supplemental = false): TechnicalPatternFile => ({
    id: `${result.resultVersionId}-FILE-${index + 1}`,
    recordKind: 'PACKAGE',
    patternName: `${result.materialKind}${result.patternKind}${supplemental ? `补充文件 ${index}` : ''}`,
    patternMaterialType: result.materialKind === '毛织' ? 'WOOL' : 'WOVEN',
    patternMaterialTypeLabel: result.materialKind,
    fileName: file.fileName,
    fileUrl: file.dataUrl,
    uploadedAt: result.submittedAt,
    uploadedBy: result.submittedBy,
    selectedSizeCodes: [...result.applicableSizes],
    imageUrl: preview?.dataUrl || '',
    markerImage: toManagedPatternFile(preview),
    remark: result.note,
  })
  const main: TechnicalPatternFile = {
    ...baseRecord(primary, 0),
    prjFile: toManagedPatternFile(prj),
    dxfFile: toManagedPatternFile(dxf),
    dxfFileName: dxf?.fileName,
    dxfFileSize: dxf?.sizeBytes,
    dxfLastModified: dxf?.uploadedAt,
    rulFile: toManagedPatternFile(rul),
    rulFileName: rul?.fileName,
    rulFileSize: rul?.sizeBytes,
    rulLastModified: rul?.uploadedAt,
  }
  const extras = sourceFiles
    .filter((file) => !selectedIds.has(file.fileId))
    .map((file, index) => {
      const record = baseRecord(file, index + 1, true)
      if (file.extension === 'prj') record.prjFile = toManagedPatternFile(file)
      if (file.extension === 'dxf') {
        record.dxfFile = toManagedPatternFile(file)
        record.dxfFileName = file.fileName
        record.dxfFileSize = file.sizeBytes
        record.dxfLastModified = file.uploadedAt
      }
      if (file.extension === 'rul') {
        record.rulFile = toManagedPatternFile(file)
        record.rulFileName = file.fileName
        record.rulFileSize = file.sizeBytes
        record.rulLastModified = file.uploadedAt
      }
      return record
    })
  return [main, ...extras]
}

function collectEngineeringOutputs(
  master: ReturnType<typeof getEngineeringMasterOrderById> extends infer T ? NonNullable<T> : never,
  technicalVersionId: string,
  bomVersions: EngineeringBomVersionRecord[],
): TechnicalDataVersionContent {
  const patternFiles = master.tasks.flatMap((task) => {
    const result = listEngineeringPatternResultVersions(task.taskId)[0]
    if (!result) return []
    return buildPatternFilesFromResult(result)
  })
  const artworkLines = master.tasks
    .filter((task) => task.taskType === 'PATTERN_ARTWORK')
    .flatMap((task) => task.materialLines.filter((line) => line.reviewStatus === '通过'))
  const colorLines = master.tasks
    .filter((task) => task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC')
    .flatMap((task) => task.materialLines.filter((line) => line.reviewStatus === '通过'))
  const sampleImages = master.tasks
    .filter((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')
    .flatMap((task) => task.resultImageIds)
  const bomItems = bomVersions.flatMap((version) => version.materialLines.map((line) => {
    const resolved = resolveEngineeringBomMaterialLine(line)
    const type = resolved.materialType === '面料' || resolved.materialType === '辅料' || resolved.materialType === '包装材料' || resolved.materialType === '成衣'
      ? resolved.materialType
      : '其他'
    return {
      id: resolved.bomItemId || `${version.bomDraftVersionId}-${resolved.materialSkuId}`,
      type,
      name: resolved.materialName,
      spec: resolved.specification || '',
      materialCode: resolved.materialCode,
      materialSkuId: resolved.materialSkuId,
      unit: resolved.usageUnit,
      colorLabel: version.productColor,
      unitConsumption: resolved.usage,
      sampleQuantity: resolved.sampleQuantity,
      lossRate: resolved.lossRate,
      supplier: '',
      printRequirement: resolved.printRequirementText || resolved.printRequirement || '否',
      dyeRequirement: resolved.dyeRequirementText || resolved.dyeRequirement || '否',
      waterSolubleRequirement: resolved.waterSolubleRequirementText && resolved.waterSolubleRequirementText !== '无' ? '是' as const : '否' as const,
      printSideMode: resolved.printSide === '双面' ? 'DOUBLE' as const : resolved.printSide === '反面' ? 'REVERSE' as const : resolved.printSide === '正面' ? 'SINGLE' as const : '' as const,
      applicableSkuCodes: [...version.applicableSkuIds],
      linkedPatternIds: [...(resolved.linkedPatternResultIds || [])],
      usageProcessCodes: resolved.processCode ? [resolved.processCode] : [],
      remark: resolved.remark || '',
    }
  }))
  return {
    technicalVersionId,
    patternFiles,
    patternDesc: patternFiles.length ? '由工程主单已完成制版成果自动汇总。' : '',
    processEntries: [],
    sizeTable: [],
    bomItems,
    // 自定义费用属于整款方案，只汇总一次，不能按颜色重复计入。
    bomCustomCosts: (getEngineeringBomPricingPlan('TECH_PACK_DRAFT', technicalVersionId)?.customCosts || [])
      .map((item) => ({ ...item })),
    bomCustomCostDecision: getEngineeringBomPricingPlan('TECH_PACK_DRAFT', technicalVersionId)?.customCostDecision
      ?? 'UNDECIDED',
    qualityRules: [],
    patternDesigns: artworkLines.flatMap((line) => [...line.resultFileIds, ...line.effectImageIds].map((url, index) => ({
      id: `${line.materialLineId}-ART-${index + 1}`,
      name: `${line.materialName}花型成果`,
      imageUrl: url,
      designSideType: 'FRONT' as const,
      fileName: url.split('/').pop() || url,
      uploadedAt: line.resultSubmittedAt,
    }))),
    colorMaterialMappings: colorLines.map((line) => ({
      id: `${line.materialLineId}-COLOR`,
      spuCode: master.styleCode,
      colorCode: line.pantoneColorCode || line.dyeColorCode || '',
      colorName: line.colorName || '',
      status: 'CONFIRMED' as const,
      generatedMode: 'AUTO' as const,
      confirmedBy: line.reviewedBy,
      confirmedAt: line.reviewedAt,
      lines: [{
        id: `${line.materialLineId}-COLOR-LINE`,
        materialName: line.materialName,
        materialType: line.materialType === '纱线' ? '其他' as const : '面料' as const,
        unit: '',
        sourceMode: 'AUTO' as const,
      }],
    })),
    attachments: sampleImages.map((url, index) => ({
      id: `${master.masterOrderId}-SAMPLE-${index + 1}`,
      fileName: url.split('/').pop() || `首单样衣-${index + 1}`,
      fileType: 'image',
      fileSize: '-',
      uploadedAt: master.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')?.submittedAt || '',
      uploadedBy: master.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')?.resultSubmittedBy || '',
      downloadUrl: url,
    })),
    legacyCompatibleCostPayload: {},
  }
}

export interface EngineeringTechPackTaskView {
  latestVersion: TechnicalDataVersionRecord | null
  versions: TechnicalDataVersionRecord[]
  missingModules: string[]
  moduleSources: Array<{ module: string; source: string; status: string }>
  reviews: Array<{ role: string; status: string; reviewer: string; opinion: string }>
  returnedModules: string[]
  canGenerate: boolean
  generateBlockedReason: string
}

function reviewView(role: string, node?: TechnicalReviewNode) {
  return {
    role,
    status: node?.status || '待审核',
    reviewer: node?.assignedReviewerName || '-',
    opinion: node?.opinion || node?.startedOpinion || '-',
  }
}

export function listEngineeringTechnicalVersions(): TechnicalDataVersionRecord[] {
  return listTechnicalDataVersions()
    .filter((record) => record.createdFromTaskType === 'ENGINEERING_MASTER')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function getEngineeringTechPackTaskView(masterOrderId: string): EngineeringTechPackTaskView {
  const master = getEngineeringMasterOrderById(masterOrderId)
  if (!master) throw new Error('未找到来源工程主单。')
  const versions = listTechnicalDataVersionsByProjectId(master.masterOrderId)
    .filter((record) => record.createdFromTaskType === 'ENGINEERING_MASTER')
    .sort((left, right) => right.versionNo - left.versionNo)
  const latestVersion = versions[0] || null
  const content = latestVersion ? getTechnicalDataVersionContent(latestVersion.technicalVersionId) : null
  const pendingTasks = master.tasks.filter((task) =>
    task.taskType !== 'TECH_PACK_CONFIRMATION'
    && task.status !== '未启用'
    && task.status !== '因需求变更结束'
    && task.status !== '已完成',
  )
  const engineeringBomVersions = listEngineeringBomVersionsByOwner('ENGINEERING_MASTER', master.masterOrderId)
  const engineeringPricingPlan = getEngineeringBomPricingPlan('ENGINEERING_MASTER', master.masterOrderId)
  const hasCompleteBomPricing = engineeringPricingPlan?.status === 'COMPLETED_CONFIRMED'
    && engineeringBomVersions.length > 0
    && engineeringBomVersions.every((version) => version.materialLines.length > 0)
  const canGenerate = !latestVersion && pendingTasks.length === 0 && hasCompleteBomPricing
  return {
    latestVersion,
    versions,
    missingModules: latestVersion?.missingItemNames || [],
    moduleSources: [
      { module: 'BOM 与价格', source: master.masterOrderCode, status: content?.bomItems.length ? '已汇总' : '待补齐' },
      { module: '纸样', source: master.tasks.filter((task) => task.taskType.startsWith('BASE_PATTERN') || task.taskType.startsWith('SIZE_PATTERN')).map((task) => task.taskId).join('、') || '-', status: content?.patternFiles.length ? '已汇总' : '待补齐' },
      { module: '首单样衣', source: master.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')?.taskId || '-', status: master.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')?.status || '不适用' },
      { module: '花型', source: master.tasks.find((task) => task.taskType === 'PATTERN_ARTWORK')?.taskId || '-', status: content?.patternDesigns.length ? '已汇总' : '待补齐' },
      { module: '调色／物料颜色', source: master.tasks.filter((task) => task.taskType.startsWith('COLOR_')).map((task) => task.taskId).join('、') || '-', status: content?.colorMaterialMappings.length ? '已汇总' : '待补齐' },
      { module: '工艺、尺码、设计、附件、质量', source: master.masterOrderCode, status: latestVersion ? '进入技术包维护' : '待生成草稿' },
    ],
    reviews: latestVersion ? [
      reviewView('买手', latestVersion.buyerReview),
      reviewView('版师', latestVersion.patternMakerReview),
      reviewView('跟单', latestVersion.merchandiserReview),
    ] : [],
    returnedModules: (latestVersion?.reviewUnlockedModuleKeys || []).map((key) => TECH_PACK_MODULE_LABELS[key]),
    canGenerate,
    generateBlockedReason: latestVersion
      ? '当前工程主单已存在技术包版本。'
      : pendingTasks.length > 0
        ? `以下任务尚未完成：${pendingTasks.map((task) => task.taskName).join('、')}`
        : engineeringBomVersions.length === 0
          ? '工程主单尚未建立 BOM 与价格版本。'
          : !hasCompleteBomPricing
            ? '工程整款 BOM 与价格尚未由买手确认。'
        : '',
  }
}

export function createEngineeringMasterTechPackDraft(
  masterOrderId: string,
  operatorName: string,
): TechnicalDataVersionRecord {
  const master = getEngineeringMasterOrderById(masterOrderId)
  if (!master) throw new Error('未找到来源工程主单。')
  const operator = operatorName.trim()
  if (!operator) throw new Error('请填写操作人。')
  const view = getEngineeringTechPackTaskView(masterOrderId)
  if (!view.canGenerate) throw new Error(view.generateBlockedReason || '当前不能生成技术包草稿。')
  const style = getStyleArchiveById(master.styleId)
  if (!style) throw new Error('未找到商品／款式档案。')
  const identity = getNextTechnicalVersionIdentity()
  const version = getNextStyleVersionMeta(style.styleId)
  const confirmationTask = master.tasks.find((task) => task.taskType === 'TECH_PACK_CONFIRMATION')
  if (!confirmationTask) throw new Error('工程主单缺少技术包确认任务。')
  const bomSnapshot = captureEngineeringBomRepositoryState()
  const engineeringBomVersions = listEngineeringBomVersionsByOwner('ENGINEERING_MASTER', master.masterOrderId)
  const confirmedBuyer = engineeringBomVersions.find((item) => item.buyerId && item.buyerName)
  createEngineeringBomVersionsForOwner({
    ownerStage: 'TECH_PACK_DRAFT',
    ownerId: identity.technicalVersionId,
    ownerCode: identity.technicalVersionCode,
    styleId: style.styleId,
    buyerId: confirmedBuyer?.buyerId,
    buyerName: confirmedBuyer?.buyerName,
    createdBy: operator,
    createdAt: identity.timestamp,
  })
  copyEngineeringBomPricingPlan({
    sourceOwnerStage: 'ENGINEERING_MASTER',
    sourceOwnerId: master.masterOrderId,
    targetOwnerStage: 'TECH_PACK_DRAFT',
    targetOwnerId: identity.technicalVersionId,
    copiedBy: operator,
    copiedAt: identity.timestamp,
  })
  const technicalBomVersions = listEngineeringBomVersionsByOwner('TECH_PACK_DRAFT', identity.technicalVersionId)
  const content = collectEngineeringOutputs(master, identity.technicalVersionId, technicalBomVersions)
  const hasPattern = content.patternFiles.length > 0
  const missingItemCodes = [...(hasPattern ? [] : ['PATTERN']), 'PROCESS', 'SIZE', 'QUALITY']
  const missingItemNames = [...(hasPattern ? [] : ['纸样']), '工艺', '尺码', '质量要求']
  try {
    return createTechnicalDataVersionDraft({
    technicalVersionId: identity.technicalVersionId,
    technicalVersionCode: identity.technicalVersionCode,
    versionLabel: version.versionLabel,
    versionNo: version.versionNo,
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    sourceProjectId: master.masterOrderId,
    sourceProjectCode: master.masterOrderCode,
    sourceProjectName: `${master.styleName}生产工程主单`,
    sourceProjectNodeId: '',
    primaryPlateTaskId: master.tasks.find((task) => task.taskType.startsWith('BASE_PATTERN'))?.taskId || '',
    primaryPlateTaskCode: master.tasks.find((task) => task.taskType.startsWith('BASE_PATTERN'))?.taskId || '',
    primaryPlateTaskVersion: '',
    linkedDesignRevisionTaskIds: [...new Set(
      master.priorResultReuseLines
        .map((line) => line.sourceSamplingTaskId)
        .filter(Boolean),
    )],
    linkedPatternTaskIds: [],
    linkedArtworkTaskIds: master.tasks.filter((task) => task.taskType === 'PATTERN_ARTWORK').map((task) => task.taskId),
    createdFromTaskType: 'ENGINEERING_MASTER',
    createdFromTaskId: confirmationTask.taskId,
    createdFromTaskCode: confirmationTask.taskId,
    baseTechnicalVersionId: style.currentTechPackVersionId || '',
    baseTechnicalVersionCode: style.currentTechPackVersionCode || '',
    changeScope: '工程主单生成',
    changeSummary: '工程主单专业任务成果汇总',
    garmentDifficultyGrade: 'B',
    linkedPartTemplateIds: [],
    linkedPatternLibraryVersionIds: [],
    linkedPatternAssetIds: [],
    linkedPatternAssetCodes: [],
    archiveCollectedFlag: false,
    archiveCollectedAt: '',
    versionStatus: 'DRAFT',
    reviewStage: '未提交审核',
    bomStatus: 'COMPLETE', patternStatus: hasPattern ? 'COMPLETE' : 'EMPTY', processStatus: 'EMPTY', gradingStatus: 'EMPTY', qualityStatus: 'EMPTY',
    colorMaterialStatus: content.colorMaterialMappings.length ? 'COMPLETE' : 'EMPTY', designStatus: content.patternDesigns.length ? 'COMPLETE' : 'EMPTY', attachmentStatus: content.attachments.length ? 'COMPLETE' : 'EMPTY',
    bomItemCount: content.bomItems.length, patternFileCount: content.patternFiles.length, processEntryCount: 0, gradingRuleCount: 0, qualityRuleCount: 0,
    colorMaterialMappingCount: content.colorMaterialMappings.length, designAssetCount: content.patternDesigns.length, attachmentCount: content.attachments.length, completenessScore: (hasPattern ? 20 : 0) + 20,
    missingItemCodes,
    missingItemNames,
    publishedAt: '', publishedBy: '', createdAt: identity.timestamp, createdBy: operator,
    updatedAt: identity.timestamp, updatedBy: operator, note: '', legacySpuCode: '', legacyVersionLabel: '',
    }, content)
  } catch (error) {
    restoreEngineeringBomRepositoryState(bomSnapshot)
    throw error
  }
}
