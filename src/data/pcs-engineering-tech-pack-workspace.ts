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
  TechnicalReviewNode,
} from './pcs-technical-data-version-types'

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

function collectEngineeringOutputs(
  master: ReturnType<typeof getEngineeringMasterOrderById> extends infer T ? NonNullable<T> : never,
  technicalVersionId: string,
): TechnicalDataVersionContent {
  const patternFiles = master.tasks.flatMap((task) => {
    const result = listEngineeringPatternResultVersions(task.taskId)[0]
    if (!result) return []
    const files = [...result.dxfFiles, ...result.rulFiles, ...result.pdfFiles]
    return files.map((fileUrl, index) => ({
      id: `${result.resultVersionId}-FILE-${index + 1}`,
      patternName: `${result.materialKind}${result.patternKind}`,
      patternMaterialType: result.materialKind === '毛织' ? 'WOOL' as const : 'WOVEN' as const,
      patternMaterialTypeLabel: result.materialKind,
      fileName: fileUrl.split('/').pop() || fileUrl,
      fileUrl,
      uploadedAt: result.submittedAt,
      uploadedBy: result.submittedBy,
      selectedSizeCodes: result.applicableSizes,
      imageUrl: result.imageUrls[0] || '',
      remark: result.note,
    }))
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
  return {
    technicalVersionId,
    patternFiles,
    patternDesc: patternFiles.length ? '由工程主单已完成制版成果自动汇总。' : '',
    processEntries: [],
    sizeTable: [],
    bomItems: [],
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
      fileName: url.split('/').pop() || `产前版样衣-${index + 1}`,
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
    .filter((record) => record.createdFromTaskType === 'ENGINEERING_MASTER' || record.createdFromTaskType === 'ENGINEERING_CHANGE')
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
  const canGenerate = !latestVersion && pendingTasks.length === 0
  return {
    latestVersion,
    versions,
    missingModules: latestVersion?.missingItemNames || [],
    moduleSources: [
      { module: 'BOM 与价格', source: master.masterOrderCode, status: content?.bomItems.length ? '已汇总' : '待补齐' },
      { module: '纸样', source: master.tasks.filter((task) => task.taskType.startsWith('BASE_PATTERN') || task.taskType.startsWith('SIZE_PATTERN')).map((task) => task.taskId).join('、') || '-', status: content?.patternFiles.length ? '已汇总' : '待补齐' },
      { module: '产前版样衣', source: master.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')?.taskId || '-', status: master.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')?.status || '不适用' },
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
  const content = collectEngineeringOutputs(master, identity.technicalVersionId)
  const hasPattern = content.patternFiles.length > 0
  const missingItemCodes = ['BOM', ...(hasPattern ? [] : ['PATTERN']), 'PROCESS', 'SIZE', 'QUALITY']
  const missingItemNames = ['BOM 与价格', ...(hasPattern ? [] : ['纸样']), '工艺', '尺码', '质量要求']
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
    linkedRevisionTaskIds: [],
    linkedPatternTaskIds: [],
    linkedArtworkTaskIds: master.tasks.filter((task) => task.taskType === 'PATTERN_ARTWORK').map((task) => task.taskId),
    createdFromTaskType: 'ENGINEERING_MASTER',
    createdFromTaskId: confirmationTask.taskId,
    createdFromTaskCode: confirmationTask.taskId,
    baseTechnicalVersionId: style.currentTechPackVersionId || '',
    baseTechnicalVersionCode: style.currentTechPackVersionCode || '',
    changeScope: '制版生成',
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
    bomStatus: 'EMPTY', patternStatus: hasPattern ? 'COMPLETE' : 'EMPTY', processStatus: 'EMPTY', gradingStatus: 'EMPTY', qualityStatus: 'EMPTY',
    colorMaterialStatus: content.colorMaterialMappings.length ? 'COMPLETE' : 'EMPTY', designStatus: content.patternDesigns.length ? 'COMPLETE' : 'EMPTY', attachmentStatus: content.attachments.length ? 'COMPLETE' : 'EMPTY',
    bomItemCount: 0, patternFileCount: content.patternFiles.length, processEntryCount: 0, gradingRuleCount: 0, qualityRuleCount: 0,
    colorMaterialMappingCount: content.colorMaterialMappings.length, designAssetCount: content.patternDesigns.length, attachmentCount: content.attachments.length, completenessScore: hasPattern ? 20 : 0,
    missingItemCodes,
    missingItemNames,
    publishedAt: '', publishedBy: '', createdAt: identity.timestamp, createdBy: operator,
    updatedAt: identity.timestamp, updatedBy: operator, note: '', legacySpuCode: '', legacyVersionLabel: '',
  }, content)
}
