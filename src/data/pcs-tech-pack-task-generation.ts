import { syncExistingProjectArchiveByProjectId } from './pcs-project-archive-sync.ts'
import {
  getEngineeringChangeTaskById,
  listEngineeringMasterOrders,
} from './pcs-engineering-master-repository.ts'
import { getProjectById, updateProjectRecord } from './pcs-project-repository.ts'
import { upsertProjectRelation } from './pcs-project-relation-repository.ts'
import { getRevisionTaskById, updateRevisionTask } from './pcs-revision-task-repository.ts'
import { getPlateMakingTaskById, updatePlateMakingTask } from './pcs-plate-making-repository.ts'
import { getPatternTaskById, updatePatternTask } from './pcs-pattern-task-repository.ts'
import { appendTechPackVersionLog } from './pcs-tech-pack-version-log-repository.ts'
import { listPatternAssets, updatePatternAsset } from './pcs-pattern-library.ts'
import { getPatternTaskCompletionMissingFields, getPlateTaskTechPackMissingFields } from './pcs-engineering-task-field-policy.ts'
import {
  findStyleArchiveByCode,
  findStyleArchiveByProjectId,
  getStyleArchiveById,
  updateStyleArchive,
} from './pcs-style-archive-repository.ts'
import {
  createTechnicalDataVersionDraft,
  getCurrentTechPackVersionByStyleId,
  getNextStyleVersionMeta,
  getNextTechnicalVersionIdentity,
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  listTechnicalDataVersionsByStyleId,
  updateTechnicalDataVersionContent,
  updateTechnicalDataVersionRecord,
} from './pcs-technical-data-version-repository.ts'
import type {
  TechPackSourceTaskType,
  StoredTechPackSourceTaskType,
  TechPackVersionChangeScope,
  TechnicalBomItem,
  TechnicalColorMaterialMapping,
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
  TechnicalPatternDesign,
  TechnicalPatternFile,
  TechnicalProcessEntry,
  TechnicalQualityRule,
  TechnicalSizeRow,
} from './pcs-technical-data-version-types.ts'
import type { RevisionTaskRecord } from './pcs-revision-task-types.ts'
import type { PlateMakingTaskRecord } from './pcs-plate-making-types.ts'
import type { PatternTaskRecord } from './pcs-pattern-task-types.ts'
import type { EngineeringTaskType } from './pcs-engineering-master-types.ts'
import { normalizeProcessRouteEntries } from './tech-pack-process-route.ts'
import { resolveTechnicalVersionProductProject } from './pcs-technical-data-version-project-source.ts'

export type TechPackGenerationAction = 'CREATED' | 'WRITTEN'

export interface TechPackGenerationResult {
  action: TechPackGenerationAction
  record: TechnicalDataVersionRecord
  content: TechnicalDataVersionContent
  logType:
    | '制版生成技术包'
    | '花型写入技术包'
    | '花型生成新版本'
    | '改版生成新版本'
  actionText: string
}

interface AuthoritativeTechPackSource {
  sourceProjectId: string
  sourceProjectCode: string
  sourceProjectName: string
  sourceTaskType: TechPackSourceTaskType
  sourceTaskId: string
  sourceTaskCode: string
  sourceTaskName: string
}

interface EngineeringTaskUpstreamRef {
  upstreamObjectId: string
  upstreamObjectCode: string
}

function resolveEngineeringMasterTechPackSource(
  styleId: string,
  upstream: EngineeringTaskUpstreamRef,
  allowedTaskTypes: EngineeringTaskType[],
  taskName: string,
): AuthoritativeTechPackSource {
  const master = listEngineeringMasterOrders().find((record) =>
    record.tasks.some(
      (task) =>
        allowedTaskTypes.includes(task.taskType) &&
        task.taskId === upstream.upstreamObjectId,
    ),
  )
  if (!master) throw new Error(`当前${taskName}未明确关联工程主单内的${taskName}，不能建立技术包版本。`)
  if (master.styleId !== styleId) throw new Error(`当前${taskName}关联的工程主单与款式不一致。`)
  if (master.status === '已关闭' || master.status === '已终止') {
    throw new Error(`当前${taskName}关联的工程主单已关闭或终止，不能建立技术包版本。`)
  }
  const task = master.tasks.find((item) => item.taskType === 'TECH_PACK_CONFIRMATION')
  if (!task) throw new Error('当前工程主单没有技术包确认任务，不能建立技术包版本。')
  return {
    sourceProjectId: master.masterOrderId,
    sourceProjectCode: master.masterOrderCode,
    sourceProjectName: master.styleName,
    sourceTaskType: 'ENGINEERING_MASTER',
    sourceTaskId: task.taskId,
    sourceTaskCode: task.taskId,
    sourceTaskName: task.taskName,
  }
}

function resolveEngineeringChangeTechPackSource(task: RevisionTaskRecord): AuthoritativeTechPackSource {
  const change = getEngineeringChangeTaskById(task.upstreamObjectId)
  if (!change || (task.upstreamObjectCode && change.engineeringChangeTaskCode !== task.upstreamObjectCode)) {
    throw new Error('当前改版任务未明确关联工程变更任务，不能建立技术包版本。')
  }
  if (change.styleId !== task.styleId) {
    throw new Error('当前改版任务关联的工程变更任务与款式不一致。')
  }
  return {
    sourceProjectId: change.engineeringChangeTaskId,
    sourceProjectCode: change.engineeringChangeTaskCode,
    sourceProjectName: change.title,
    sourceTaskType: 'ENGINEERING_CHANGE',
    sourceTaskId: change.engineeringChangeTaskId,
    sourceTaskCode: change.engineeringChangeTaskCode,
    sourceTaskName: change.title,
  }
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function appendUnique(values: string[], value: string): string[] {
  if (!value) return [...values]
  return Array.from(new Set([...values, value]))
}

function clonePatternFiles(items: TechnicalPatternFile[]): TechnicalPatternFile[] {
  return items.map((item) => ({
    ...item,
    pieceRows: item.pieceRows?.map((row) => ({
      ...row,
      applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
    })),
  }))
}

function cloneProcessEntries(items: TechnicalProcessEntry[]): TechnicalProcessEntry[] {
  return items.map((item) => ({
    ...item,
    detailSplitDimensions: [...(item.detailSplitDimensions ?? [])],
    supportedTargetObjects: [...(item.supportedTargetObjects ?? [])],
    supportedTargetObjectLabels: [...(item.supportedTargetObjectLabels ?? [])],
    linkedBomItemIds: [...(item.linkedBomItemIds ?? [])],
    linkedPatternIds: [...(item.linkedPatternIds ?? [])],
    visibleFactoryTypes: [...(item.visibleFactoryTypes ?? [])],
  }))
}

function inferRouteSourceKind(item: TechnicalProcessEntry): NonNullable<TechnicalProcessEntry['routeSourceKind']> {
  if (item.routeSourceKind) return item.routeSourceKind
  if (item.sourceType === 'BOM') return 'BOM_REQUIREMENT'
  if (item.isSpecialCraft) return 'PIECE_CRAFT'
  if ((item.linkedPatternIds ?? []).length > 0) return 'PATTERN_PACKAGE'
  if (item.sourceType === 'MANUAL') return 'MANUAL'
  return 'DICT_REFERENCE'
}

function withInitialRouteFields(items: TechnicalProcessEntry[]): TechnicalProcessEntry[] {
  return normalizeProcessRouteEntries(cloneProcessEntries(items).map((item) => ({
    ...item,
    routeSourceKind: inferRouteSourceKind(item),
  })))
}

function cloneSizeRows(items: TechnicalSizeRow[]): TechnicalSizeRow[] {
  return items.map((item) => ({ ...item }))
}

function cloneBomItems(items: TechnicalBomItem[]): TechnicalBomItem[] {
  return items.map((item) => ({
    ...item,
    applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
    linkedPatternIds: [...(item.linkedPatternIds ?? [])],
    usageProcessCodes: [...(item.usageProcessCodes ?? [])],
  }))
}

function cloneQualityRules(items: TechnicalQualityRule[]): TechnicalQualityRule[] {
  return items.map((item) => ({ ...item }))
}

function cloneColorMappings(items: TechnicalColorMaterialMapping[]): TechnicalColorMaterialMapping[] {
  return items.map((item) => ({
    ...item,
    lines: item.lines.map((line) => ({
      ...line,
      applicableSkuCodes: [...(line.applicableSkuCodes ?? [])],
    })),
  }))
}

function clonePatternDesigns(items: TechnicalPatternDesign[]): TechnicalPatternDesign[] {
  return items.map((item) => ({ ...item }))
}

function cloneContent(content: TechnicalDataVersionContent, technicalVersionId: string): TechnicalDataVersionContent {
  return {
    technicalVersionId,
    patternFiles: clonePatternFiles(content.patternFiles),
    patternDesc: content.patternDesc,
    processEntries: withInitialRouteFields(content.processEntries),
    processRouteStatus: content.processRouteStatus,
    processRouteConfirmedBy: content.processRouteConfirmedBy,
    processRouteConfirmedAt: content.processRouteConfirmedAt,
    processRouteUpdatedBy: content.processRouteUpdatedBy,
    processRouteUpdatedAt: content.processRouteUpdatedAt,
    processRouteChangeReason: content.processRouteChangeReason,
    sizeTable: cloneSizeRows(content.sizeTable),
    bomItems: cloneBomItems(content.bomItems),
    qualityRules: cloneQualityRules(content.qualityRules),
    colorMaterialMappings: cloneColorMappings(content.colorMaterialMappings),
    patternDesigns: clonePatternDesigns(content.patternDesigns),
    attachments: content.attachments.map((item) => ({ ...item })),
    legacyCompatibleCostPayload: { ...content.legacyCompatibleCostPayload },
  }
}

function createPlatePatternFiles(task: PlateMakingTaskRecord, operatorName: string): TechnicalPatternFile[] {
  const uploadedAt = task.confirmedAt || task.updatedAt || nowText()
  const rows = (task.patternImageLineItems || []).map((line) => ({
    id: line.lineId,
    name: line.materialPartName || '纸样部位',
    count: line.pieceCount || 1,
    note: line.materialDescription || '',
    applicableSkuCodes: [],
    sourceType: 'MANUAL' as const,
  }))
  const files: TechnicalPatternFile[] = []
  ;(task.patternDxfFileIds || []).forEach((fileId, index) => {
    files.push({
      id: `${task.plateTaskId}_dxf_${index + 1}`,
      fileName: `${fileId}.dxf`,
      fileUrl: fileId,
      uploadedAt,
      uploadedBy: operatorName,
      dxfFileName: `${fileId}.dxf`,
      patternFileMode: 'SINGLE_FILE',
      parseStatus: 'NOT_PARSED',
      sizeRange: task.sizeRange,
      pieceRows: rows,
    })
  })
  ;(task.patternRulFileIds || []).forEach((fileId, index) => {
    files.push({
      id: `${task.plateTaskId}_rul_${index + 1}`,
      fileName: `${fileId}.rul`,
      fileUrl: fileId,
      uploadedAt,
      uploadedBy: operatorName,
      rulFileName: `${fileId}.rul`,
      patternFileMode: 'SINGLE_FILE',
      parseStatus: 'NOT_PARSED',
      sizeRange: task.sizeRange,
      pieceRows: rows,
    })
  })
  ;(task.patternPdfFileIds || []).forEach((fileId, index) => {
    files.push({
      id: `${task.plateTaskId}_pdf_${index + 1}`,
      fileName: `${fileId}.pdf`,
      fileUrl: fileId,
      uploadedAt,
      uploadedBy: operatorName,
      singlePatternFileName: `${fileId}.pdf`,
      patternFileMode: 'SINGLE_FILE',
      parseStatus: 'NOT_REQUIRED',
      sizeRange: task.sizeRange,
      pieceRows: rows,
    })
  })
  if (files.length > 0) return files
  return [
    {
      id: `${task.plateTaskId}_pattern_file`,
      fileName: `${task.plateTaskCode}-${task.patternVersion || 'P1'}.dxf`,
      fileUrl: `mock://tech-pack/pattern/${task.plateTaskCode}`,
      uploadedAt,
      uploadedBy: operatorName,
      widthCm: 148,
      markerLengthM: 2.35,
      totalPieceCount: 12,
      pieceRows: [
        {
          id: `${task.plateTaskId}_piece_front`,
          name: '前片',
          count: 2,
          note: '主面布',
          applicableSkuCodes: [],
        },
        {
          id: `${task.plateTaskId}_piece_back`,
          name: '后片',
          count: 2,
          note: '主面布',
          applicableSkuCodes: [],
        },
      ],
    },
  ]
}

function createPlateProcessEntries(task: PlateMakingTaskRecord): TechnicalProcessEntry[] {
  return withInitialRouteFields([
    {
      id: `${task.plateTaskId}_process_prep`,
      entryType: 'PROCESS_BASELINE',
      stageCode: 'PREP',
      stageName: '裁前准备',
      processCode: 'PROC_PREP_001',
      processName: '纸样核对',
      assignmentGranularity: 'ORDER',
      ruleSource: '制版任务输出',
      detailSplitMode: 'COMPOSITE',
      detailSplitDimensions: ['PATTERN', 'MATERIAL_SKU'],
      defaultDocType: 'TASK',
      taskTypeMode: 'PROCESS',
      isSpecialCraft: false,
      sourceType: 'MANUAL',
      routeSourceKind: 'PATTERN_PACKAGE',
      triggerSource: '制版任务',
      difficulty: 'MEDIUM',
      remark: `${task.patternVersion || '当前版型'} 已完成核版。`,
    },
    {
      id: `${task.plateTaskId}_process_prod`,
      entryType: 'CRAFT',
      stageCode: 'PROD',
      stageName: '车缝生产',
      processCode: 'PROC_PROD_001',
      processName: '主缝工序',
      craftCode: 'CRAFT_MAIN_STITCH',
      craftName: '主缝',
      assignmentGranularity: 'SKU',
      ruleSource: '制版任务输出',
      detailSplitMode: 'COMPOSITE',
      detailSplitDimensions: ['PATTERN'],
      defaultDocType: 'TASK',
      taskTypeMode: 'CRAFT',
      isSpecialCraft: false,
      sourceType: 'MANUAL',
      routeSourceKind: 'PATTERN_PACKAGE',
      triggerSource: '制版任务',
      difficulty: 'MEDIUM',
      remark: `按 ${task.patternType || '标准版型'} 输出执行。`,
    },
  ])
}

function createPlateSizeRows(task: PlateMakingTaskRecord): TechnicalSizeRow[] {
  const seed = task.sizeRange || 'S-XL'
  return [
    { id: `${task.plateTaskId}_size_chest`, part: `胸围（${seed}）`, S: 88, M: 92, L: 96, XL: 100, tolerance: 1 },
    { id: `${task.plateTaskId}_size_length`, part: '衣长', S: 84, M: 86, L: 88, XL: 90, tolerance: 1 },
  ]
}

function createPlateQualityRules(task: PlateMakingTaskRecord): TechnicalQualityRule[] {
  return [
    {
      id: `${task.plateTaskId}_quality_main`,
      checkItem: '版型对位',
      standardText: `按 ${task.patternVersion || '当前版型'} 检查前后片与腰节对位。`,
      samplingRule: '首件全检',
      note: '制版输出要求',
    },
  ]
}

function createPlateColorMappings(task: PlateMakingTaskRecord): TechnicalColorMaterialMapping[] {
  return [
    {
      id: `${task.plateTaskId}_color_mapping_main`,
      spuCode: task.spuCode || task.productStyleCode,
      colorCode: 'MAIN',
      colorName: '主色',
      status: 'CONFIRMED',
      generatedMode: 'MANUAL',
      confirmedBy: task.ownerName,
      confirmedAt: task.confirmedAt || task.updatedAt || nowText(),
      remark: '制版任务同步建立款色用料对应。',
      lines: [
        {
          id: `${task.plateTaskId}_color_mapping_line`,
          materialCode: 'MAIN-FABRIC',
          materialName: '主面料',
          materialType: '面料',
          unit: '米',
          sourceMode: 'MANUAL',
          applicableSkuCodes: [],
          note: '默认主色配置',
        },
      ],
    },
  ]
}

function buildPlateGeneratedContent(
  task: PlateMakingTaskRecord,
  technicalVersionId: string,
  operatorName: string,
  baseContent?: TechnicalDataVersionContent | null,
): TechnicalDataVersionContent {
  const base = baseContent ? cloneContent(baseContent, technicalVersionId) : null
  return {
    technicalVersionId,
    patternFiles: base?.patternFiles.length ? base.patternFiles : createPlatePatternFiles(task, operatorName),
    patternDesc: base?.patternDesc || `${task.patternType || '标准版型'} · ${task.patternVersion || '当前版型'} 已完成结构输出。`,
    processEntries: base?.processEntries.length ? base.processEntries : createPlateProcessEntries(task),
    processRouteStatus: base?.processRouteStatus ?? 'UNCONFIRMED',
    processRouteConfirmedBy: base?.processRouteConfirmedBy ?? '',
    processRouteConfirmedAt: base?.processRouteConfirmedAt ?? '',
    processRouteUpdatedBy: base?.processRouteUpdatedBy ?? operatorName,
    processRouteUpdatedAt: base?.processRouteUpdatedAt ?? nowText(),
    processRouteChangeReason: base?.processRouteChangeReason ?? '',
    sizeTable: base?.sizeTable.length ? base.sizeTable : createPlateSizeRows(task),
    bomItems: base?.bomItems.length
      ? base.bomItems
      : [
          {
            id: `${task.plateTaskId}_bom_main`,
            type: '主面料',
            name: '主面料',
            spec: task.patternType || '标准面料',
            unitConsumption: 1.85,
            lossRate: 0.05,
            supplier: '默认供应商',
            applicableSkuCodes: [],
            linkedPatternIds: [],
            usageProcessCodes: [],
          },
        ],
    qualityRules: base?.qualityRules.length ? base.qualityRules : createPlateQualityRules(task),
    colorMaterialMappings: base?.colorMaterialMappings.length ? base.colorMaterialMappings : createPlateColorMappings(task),
    patternDesigns: base?.patternDesigns ?? [],
    attachments: base?.attachments ?? [],
    legacyCompatibleCostPayload: { ...(base?.legacyCompatibleCostPayload ?? {}) },
  }
}

function buildArtworkDesign(task: PatternTaskRecord): TechnicalPatternDesign[] {
  return [
    {
      id: `${task.patternTaskId}_design`,
      name: task.artworkName || task.title,
      imageUrl: task.completionImageIds[0],
    },
  ]
}

function hasArtworkContent(
  record: Pick<TechnicalDataVersionRecord, 'linkedPatternLibraryVersionIds'>,
  content: TechnicalDataVersionContent,
): boolean {
  return content.patternDesigns.length > 0 || (record.linkedPatternLibraryVersionIds?.length ?? 0) > 0
}

function ensureTaskProject(task: { projectId: string; projectCode: string; projectName: string }, errorText: string) {
  if (!task.projectId || !task.projectCode || !task.projectName) {
    throw new Error(errorText)
  }
  const project = getProjectById(task.projectId)
  if (!project) {
    throw new Error('未找到关联商品项目，不能建立技术包版本。')
  }
  return project
}

function buildChangeSummaryFromRevision(task: RevisionTaskRecord): string {
  const scopes = task.revisionScopeNames.length ? task.revisionScopeNames.join('、') : task.revisionScopeCodes.join('、')
  return [
    task.title,
    task.baseStyleCode ? `旧款：${task.baseStyleCode}` : '',
    task.targetStyleCodeCandidate ? `新款候选：${task.targetStyleCodeCandidate}` : '',
    scopes ? `改版范围：${scopes}` : '',
    task.revisionSuggestionRichText ? `修改建议：${task.revisionSuggestionRichText}` : task.issueSummary ? `问题点：${task.issueSummary}` : '',
    task.liveRetestRequired ? `回直播验证：${task.liveRetestStatus}` : '',
  ]
    .filter(Boolean)
    .join('；')
}

function buildTechPackVersionRecord(input: {
  styleId: string
  styleCode: string
  styleName: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  createdFromTaskType: TechPackSourceTaskType
  createdFromTaskId: string
  createdFromTaskCode: string
  baseVersion?: TechnicalDataVersionRecord | null
  primaryPlateTaskId: string
  primaryPlateTaskCode: string
  primaryPlateTaskVersion: string
  linkedRevisionTaskIds?: string[]
  linkedPatternTaskIds?: string[]
  linkedArtworkTaskIds?: string[]
  linkedPatternLibraryVersionIds?: string[]
  linkedPatternAssetIds?: string[]
  linkedPatternAssetCodes?: string[]
  changeScope: TechPackVersionChangeScope
  changeSummary: string
  note?: string
  operatorName: string
}): TechnicalDataVersionRecord {
  const identity = getNextTechnicalVersionIdentity()
  const versionMeta = getNextStyleVersionMeta(input.styleId)
  const base = input.baseVersion
  return {
    technicalVersionId: identity.technicalVersionId,
    technicalVersionCode: identity.technicalVersionCode,
    versionLabel: versionMeta.versionLabel,
    versionNo: versionMeta.versionNo,
    styleId: input.styleId,
    styleCode: input.styleCode,
    styleName: input.styleName,
    sourceProjectId: input.projectId,
    sourceProjectCode: input.projectCode,
    sourceProjectName: input.projectName,
    sourceProjectNodeId: input.projectNodeId,
    primaryPlateTaskId: input.primaryPlateTaskId,
    primaryPlateTaskCode: input.primaryPlateTaskCode,
    primaryPlateTaskVersion: input.primaryPlateTaskVersion,
    linkedRevisionTaskIds: [...(input.linkedRevisionTaskIds ?? [])],
    linkedPatternTaskIds: [...(input.linkedPatternTaskIds ?? [])],
    linkedArtworkTaskIds: [...(input.linkedArtworkTaskIds ?? [])],
    createdFromTaskType: input.createdFromTaskType,
    createdFromTaskId: input.createdFromTaskId,
    createdFromTaskCode: input.createdFromTaskCode,
    baseTechnicalVersionId: base?.technicalVersionId || '',
    baseTechnicalVersionCode: base?.technicalVersionCode || '',
    changeScope: input.changeScope,
    changeSummary: input.changeSummary,
    garmentDifficultyGrade: base?.garmentDifficultyGrade || 'B',
    linkedPartTemplateIds: base?.linkedPartTemplateIds ? [...base.linkedPartTemplateIds] : [],
    linkedPatternLibraryVersionIds: [...(input.linkedPatternLibraryVersionIds ?? base?.linkedPatternLibraryVersionIds ?? [])],
    linkedPatternAssetIds: [...(input.linkedPatternAssetIds ?? base?.linkedPatternAssetIds ?? [])],
    linkedPatternAssetCodes: [...(input.linkedPatternAssetCodes ?? base?.linkedPatternAssetCodes ?? [])],
    archiveCollectedFlag: false,
    archiveCollectedAt: '',
    versionStatus: 'DRAFT',
    bomStatus: 'EMPTY',
    patternStatus: 'EMPTY',
    processStatus: 'EMPTY',
    gradingStatus: 'EMPTY',
    qualityStatus: 'EMPTY',
    colorMaterialStatus: 'EMPTY',
    designStatus: 'EMPTY',
    attachmentStatus: 'EMPTY',
    bomItemCount: 0,
    patternFileCount: 0,
    processEntryCount: 0,
    gradingRuleCount: 0,
    qualityRuleCount: 0,
    colorMaterialMappingCount: 0,
    designAssetCount: 0,
    attachmentCount: 0,
    completenessScore: 0,
    missingItemCodes: [],
    missingItemNames: [],
    publishedAt: '',
    publishedBy: '',
    createdAt: identity.timestamp,
    createdBy: input.operatorName,
    updatedAt: identity.timestamp,
    updatedBy: input.operatorName,
    note: input.note || '',
    legacySpuCode: '',
    legacyVersionLabel: '',
  }
}

function writeVersionLog(input: {
  record: TechnicalDataVersionRecord
  logType:
    | '制版生成技术包'
    | '花型写入技术包'
    | '花型生成新版本'
    | '改版生成新版本'
  changeScope: TechPackVersionChangeScope
  changeText: string
  operatorName: string
  sourceTaskType: TechPackSourceTaskType
  sourceTaskId: string
  sourceTaskCode: string
  sourceTaskName: string
  beforeVersion?: TechnicalDataVersionRecord | null
  afterVersion?: TechnicalDataVersionRecord | null
}): void {
  const timestamp = nowText()
  appendTechPackVersionLog({
    logId: `tech_pack_log_${input.record.technicalVersionId}_${timestamp.replace(/[^0-9]/g, '')}_${input.logType}`,
    technicalVersionId: input.record.technicalVersionId,
    technicalVersionCode: input.record.technicalVersionCode,
    versionLabel: input.record.versionLabel,
    styleId: input.record.styleId,
    styleCode: input.record.styleCode,
    logType: input.logType,
    sourceTaskType: input.sourceTaskType,
    sourceTaskId: input.sourceTaskId,
    sourceTaskCode: input.sourceTaskCode,
    sourceTaskName: input.sourceTaskName,
    changeScope: input.changeScope,
    changeText: input.changeText,
    beforeVersionId: input.beforeVersion?.technicalVersionId || '',
    beforeVersionCode: input.beforeVersion?.technicalVersionCode || '',
    afterVersionId: (input.afterVersion || input.record).technicalVersionId,
    afterVersionCode: (input.afterVersion || input.record).technicalVersionCode,
    createdAt: timestamp,
    createdBy: input.operatorName,
  })
}

function buildProjectRelationId(technicalVersionId: string): string {
  return `rel_tech_pack_${technicalVersionId}`
}

function getStyleTechPackStatus(
  versions: TechnicalDataVersionRecord[],
  currentTechPackVersionId: string,
): string {
  if (currentTechPackVersionId && versions.some((item) => item.technicalVersionId === currentTechPackVersionId)) {
    return '已启用'
  }
  if (versions.some((item) => item.versionStatus === 'PUBLISHED')) return '已发布待启用'
  if (versions.length > 0) return '草稿中'
  return '未建立'
}

export function writeProjectRelationFromTechPackVersion(
  record: TechnicalDataVersionRecord,
  operatorName = '当前用户',
  _sourceTaskType: StoredTechPackSourceTaskType = record.createdFromTaskType,
): void {
  const source = resolveTechnicalVersionProductProject(record)
  if (!source) return
  upsertProjectRelation({
    projectRelationId: buildProjectRelationId(record.technicalVersionId),
    projectId: source.project.projectId,
    projectCode: source.project.projectCode,
    projectNodeId: null,
    stepCode: '',
    stepName: '',
    relationRole: '产出对象',
    sourceModule: '技术包',
    sourceObjectType: '技术包版本',
    sourceObjectId: record.technicalVersionId,
    sourceObjectCode: record.technicalVersionCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: `${record.styleName} ${record.versionLabel}`,
    sourceStatus: record.versionStatus,
    businessDate: record.updatedAt,
    ownerName: operatorName,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    updatedAt: record.updatedAt,
    updatedBy: operatorName,
    note: '',
  })
}

export function syncStyleArchiveFromTechPackVersion(record: TechnicalDataVersionRecord): void {
  const style = getStyleArchiveById(record.styleId)
  if (!style) return
  const versions = listTechnicalDataVersionsByStyleId(record.styleId)
  updateStyleArchive(record.styleId, {
    techPackVersionCount: versions.length,
    techPackStatus: getStyleTechPackStatus(versions, style.currentTechPackVersionId || ''),
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
  })
}

export function syncProjectFromTechPackVersion(record: TechnicalDataVersionRecord): void {
  const source = resolveTechnicalVersionProductProject(record)
  if (!source) return
  updateProjectRecord(
    source.project.projectId,
    {
      linkedTechPackVersionId: record.technicalVersionId,
      linkedTechPackVersionCode: record.technicalVersionCode,
      linkedTechPackVersionLabel: record.versionLabel,
      linkedTechPackVersionStatus: record.versionStatus,
      linkedTechPackVersionPublishedAt: record.publishedAt || '',
      updatedAt: record.updatedAt,
    },
    record.updatedBy || '当前用户',
  )
}

function finalizeGeneration(
  record: TechnicalDataVersionRecord,
  action: TechPackGenerationAction,
  logType:
    | '制版生成技术包'
    | '花型写入技术包'
    | '花型生成新版本'
    | '改版生成新版本',
  operatorName: string,
  sourceTaskType: StoredTechPackSourceTaskType = record.createdFromTaskType,
): TechPackGenerationResult {
  syncStyleArchiveFromTechPackVersion(record)
  syncProjectFromTechPackVersion(record)
  const source = resolveTechnicalVersionProductProject(record)
  if (source) syncExistingProjectArchiveByProjectId(source.project.projectId, operatorName)
  writeProjectRelationFromTechPackVersion(record, operatorName, sourceTaskType)
  return {
    action,
    record: getTechnicalDataVersionById(record.technicalVersionId) || record,
    content: getTechnicalDataVersionContent(record.technicalVersionId) || createPlateGeneratedContentFallback(record.technicalVersionId),
    logType,
    actionText:
      logType === '花型写入技术包'
        ? '已写入技术包花型'
        : logType === '花型生成新版本'
          ? '已生成花型新版本'
          : logType === '改版生成新版本'
            ? '已生成改版技术包版本'
            : '已建立技术包版本',
  }
}

function createPlateGeneratedContentFallback(technicalVersionId: string): TechnicalDataVersionContent {
  return {
    technicalVersionId,
    patternFiles: [],
    patternDesc: '',
    processEntries: [],
    sizeTable: [],
    bomItems: [],
    qualityRules: [],
    colorMaterialMappings: [],
    patternDesigns: [],
    attachments: [],
    legacyCompatibleCostPayload: {},
  }
}

function ensureStyleArchive(
  task: { styleId?: string; styleCode?: string; styleName?: string; spuCode?: string; projectId: string },
  errorText: string,
) {
  const style =
    (task.styleId ? getStyleArchiveById(task.styleId) : null) ||
    findStyleArchiveByCode(task.styleCode || task.spuCode || '') ||
    findStyleArchiveByProjectId(task.projectId)
  if (!style) {
    throw new Error(errorText)
  }
  return style
}

function ensurePlateTaskReady(task: PlateMakingTaskRecord): PlateMakingTaskRecord {
  if (task.status === '已取消') {
    throw new Error(getTechPackGenerationBlockedReason(task.status) || '当前制版任务已取消，不能生成技术包版本。')
  }
  if (task.status === '已完成') {
    throw new Error(getTechPackGenerationBlockedReason(task.status) || '当前制版任务已完成，不能重复生成技术包版本。')
  }
  if (task.sampleReviewStatus !== '样板已通过') {
    throw new Error('当前制版任务尚未样板确认通过，不能生成技术包版本。')
  }
  if (!isTechPackGenerationAllowedStatus(task.status)) {
    throw new Error(getTechPackGenerationBlockedReason(task.status) || '当前制版任务尚未确认产出，不能建立技术包版本。')
  }
  const missingFields = getPlateTaskTechPackMissingFields(task)
  if (missingFields.length > 0) {
    throw new Error(`制版任务产出未完整：缺少${missingFields.join('、')}，不能生成技术包版本。`)
  }
  const hasPatternOutput =
    Boolean(task.patternVersion)
    || (task.patternImageLineItems || []).length > 0
    || (task.patternPdfFileIds || []).length > 0
    || (task.patternDxfFileIds || []).length > 0
    || (task.patternRulFileIds || []).length > 0
  if (!hasPatternOutput) {
    throw new Error('当前制版任务缺少生成技术包所需资料')
  }
  return task
}

function ensurePatternTaskReady(task: PatternTaskRecord): PatternTaskRecord {
  if (!isTechPackGenerationAllowedStatus(task.status)) {
    throw new Error(getTechPackGenerationBlockedReason(task.status) || '当前花型任务尚未确认产出，不能写入技术包。')
  }
  const missingFields = getPatternTaskCompletionMissingFields(task)
  if (missingFields.length > 0) {
    throw new Error(`花型任务产出未完整：缺少${missingFields.join('、')}，不能写入技术包。`)
  }
  return task
}

function ensureRevisionTaskReady(task: RevisionTaskRecord): RevisionTaskRecord {
  if (!isTechPackGenerationAllowedStatus(task.status)) {
    throw new Error(getTechPackGenerationBlockedReason(task.status) || '当前改版任务尚未确认产出，不能建立技术包版本。')
  }
  return task
}

function getLatestPlateWritableVersion(styleId: string): TechnicalDataVersionRecord | null {
  return (
    listTechnicalDataVersionsByStyleId(styleId).find(
      (item) => item.versionStatus === 'DRAFT' && item.primaryPlateTaskId,
    ) || null
  )
}

function buildPatternLibraryRefs(task: PatternTaskRecord, baseVersion: TechnicalDataVersionRecord): string[] {
  return [...baseVersion.linkedPatternLibraryVersionIds]
}

function buildPatternAssetRefs(
  task: PatternTaskRecord,
  baseVersion: Pick<TechnicalDataVersionRecord, 'linkedPatternAssetIds' | 'linkedPatternAssetCodes'>,
): { linkedPatternAssetIds: string[]; linkedPatternAssetCodes: string[] } {
  const asset =
    (task.patternAssetId ? listPatternAssets().find((item) => item.id === task.patternAssetId) : null) ||
    listPatternAssets().find((item) => item.source_task_id === task.patternTaskId) ||
    null
  return {
    linkedPatternAssetIds: asset ? appendUnique(baseVersion.linkedPatternAssetIds ?? [], asset.id) : [...(baseVersion.linkedPatternAssetIds ?? [])],
    linkedPatternAssetCodes: asset ? appendUnique(baseVersion.linkedPatternAssetCodes ?? [], asset.pattern_code) : [...(baseVersion.linkedPatternAssetCodes ?? [])],
  }
}

function syncPatternAssetTechPackLineage(
  task: PatternTaskRecord,
  record: TechnicalDataVersionRecord,
  operatorName: string,
): void {
  const asset =
    (task.patternAssetId ? listPatternAssets().find((item) => item.id === task.patternAssetId) : null) ||
    listPatternAssets().find((item) => item.source_task_id === task.patternTaskId)
  if (!asset) return
  updatePatternAsset(asset.id, {
    source_task_code: task.patternTaskCode,
    source_task_type: 'PATTERN_ARTWORK_TASK',
    source_task_name: task.title,
    source_tech_pack_version_id: record.technicalVersionId,
    source_tech_pack_version_code: record.technicalVersionCode,
    buyer_review_status: task.buyerReviewStatus,
    difficulty_grade: task.difficultyGrade,
    assigned_team_code: task.assignedTeamCode,
    assigned_team_name: task.assignedTeamName,
    assigned_member_id: task.assignedMemberId,
    assigned_member_name: task.assignedMemberName,
    updatedBy: operatorName,
  })
}

export function generateTechPackVersionFromPlateTask(
  plateTaskId: string,
  operatorName = '当前用户',
): TechPackGenerationResult {
  const task = getPlateMakingTaskById(plateTaskId)
  if (!task) throw new Error('未找到制版任务。')
  ensurePlateTaskReady(task)
  ensureTaskProject(task, '当前制版任务未绑定正式商品项目，不能建立技术包版本。')
  const style = ensureStyleArchive(
    { styleId: '', styleCode: task.productStyleCode, projectId: task.projectId, spuCode: task.spuCode },
    '当前制版任务未绑定正式款式档案，不能建立技术包版本。',
  )
  const source = resolveEngineeringMasterTechPackSource(
    style.styleId,
    task,
    ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT', 'SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'],
    '制版任务',
  )
  const baseVersion = getCurrentTechPackVersionByStyleId(style.styleId) || listTechnicalDataVersionsByStyleId(style.styleId)[0] || null
  const baseContent = baseVersion ? getTechnicalDataVersionContent(baseVersion.technicalVersionId) : null
  const nextRecord = buildTechPackVersionRecord({
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    projectId: source.sourceProjectId,
    projectCode: source.sourceProjectCode,
    projectName: source.sourceProjectName,
    projectNodeId: '',
    createdFromTaskType: source.sourceTaskType,
    createdFromTaskId: source.sourceTaskId,
    createdFromTaskCode: source.sourceTaskCode,
    baseVersion,
    primaryPlateTaskId: task.plateTaskId,
    primaryPlateTaskCode: task.plateTaskCode,
    primaryPlateTaskVersion: task.patternVersion,
    linkedPatternTaskIds: appendUnique([], task.plateTaskId),
    linkedRevisionTaskIds: [],
    linkedArtworkTaskIds: [],
    changeScope: '制版生成',
    changeSummary: `${task.title} 输出 ${task.patternVersion || '当前版型'} 技术包版本。`,
    note: task.note,
    operatorName,
  })
  const nextContent = buildPlateGeneratedContent(task, nextRecord.technicalVersionId, operatorName, baseContent)
  const createdRecord = createTechnicalDataVersionDraft(nextRecord, nextContent)
  writeVersionLog({
    record: createdRecord,
    logType: '制版生成技术包',
    changeScope: '制版生成',
    changeText: `已由制版任务 ${task.plateTaskCode} 建立技术包版本 ${createdRecord.versionLabel}。`,
    operatorName,
    sourceTaskType: source.sourceTaskType,
    sourceTaskId: source.sourceTaskId,
    sourceTaskCode: source.sourceTaskCode,
    sourceTaskName: source.sourceTaskName,
    beforeVersion: baseVersion,
    afterVersion: createdRecord,
  })
  updatePlateMakingTask(task.plateTaskId, {
    status: '已生成技术包',
    linkedTechPackVersionId: createdRecord.technicalVersionId,
    linkedTechPackVersionCode: createdRecord.technicalVersionCode,
    linkedTechPackVersionLabel: createdRecord.versionLabel,
    linkedTechPackVersionStatus: createdRecord.versionStatus,
    linkedTechPackUpdatedAt: createdRecord.updatedAt,
    primaryTechPackGeneratedFlag: true,
    primaryTechPackGeneratedAt: createdRecord.updatedAt,
    updatedAt: createdRecord.updatedAt,
    updatedBy: operatorName,
  })
  const result = finalizeGeneration(createdRecord, 'CREATED', '制版生成技术包', operatorName, source.sourceTaskType)
  return result
}

export function generateTechPackVersionFromPatternTask(
  patternTaskId: string,
  operatorName = '当前用户',
): TechPackGenerationResult {
  const task = getPatternTaskById(patternTaskId)
  if (!task) throw new Error('未找到花型任务。')
  ensurePatternTaskReady(task)
  ensureTaskProject(task, '当前花型任务未绑定正式商品项目，不能写入技术包。')
  const style = ensureStyleArchive(
    { styleId: '', styleCode: task.productStyleCode, projectId: task.projectId, spuCode: task.spuCode },
    '当前花型任务未绑定正式款式档案，不能写入技术包。',
  )
  const source = resolveEngineeringMasterTechPackSource(
    style.styleId,
    task,
    ['PATTERN_ARTWORK'],
    '花型任务',
  )
  const effectiveVersion = getCurrentTechPackVersionByStyleId(style.styleId)
  const plateDraftVersion = getLatestPlateWritableVersion(style.styleId)
  const targetVersion = effectiveVersion || plateDraftVersion
  if (!targetVersion) {
    throw new Error('当前款式没有可写入花型的技术包版本，请先完成制版任务生成技术包。')
  }
  const targetContent = getTechnicalDataVersionContent(targetVersion.technicalVersionId)
  if (!targetContent) {
    throw new Error('未找到目标技术包版本内容，不能写入花型。')
  }

  const nextDesigns = buildArtworkDesign(task)
  const nextPatternLibraryRefs = buildPatternLibraryRefs(task, targetVersion)
  const nextPatternAssetRefs = buildPatternAssetRefs(task, targetVersion)

  const canWriteTargetInPlace =
    targetVersion.versionStatus === 'DRAFT' &&
    targetVersion.createdFromTaskType === source.sourceTaskType &&
    targetVersion.sourceProjectId === source.sourceProjectId &&
    targetVersion.createdFromTaskId === source.sourceTaskId

  if (canWriteTargetInPlace && !hasArtworkContent(targetVersion, targetContent)) {
    updateTechnicalDataVersionContent(targetVersion.technicalVersionId, {
      patternDesigns: nextDesigns,
    })
    const updatedRecord = updateTechnicalDataVersionRecord(targetVersion.technicalVersionId, {
      linkedArtworkTaskIds: appendUnique(targetVersion.linkedArtworkTaskIds, task.patternTaskId),
      linkedPatternLibraryVersionIds: nextPatternLibraryRefs,
      linkedPatternAssetIds: nextPatternAssetRefs.linkedPatternAssetIds,
      linkedPatternAssetCodes: nextPatternAssetRefs.linkedPatternAssetCodes,
      changeScope: '花型写入',
      changeSummary: `${task.title} 首次写入花型内容。`,
      updatedAt: nowText(),
      updatedBy: operatorName,
    })
    if (!updatedRecord) {
      throw new Error('写入技术包花型失败。')
    }
    writeVersionLog({
      record: updatedRecord,
      logType: '花型写入技术包',
      changeScope: '花型写入',
      changeText: `已由花型任务 ${task.patternTaskCode} 写入当前技术包版本花型。`,
      operatorName,
      sourceTaskType: source.sourceTaskType,
      sourceTaskId: source.sourceTaskId,
      sourceTaskCode: source.sourceTaskCode,
      sourceTaskName: source.sourceTaskName,
      beforeVersion: targetVersion,
      afterVersion: updatedRecord,
    })
    updatePatternTask(task.patternTaskId, {
      linkedTechPackVersionId: updatedRecord.technicalVersionId,
      linkedTechPackVersionCode: updatedRecord.technicalVersionCode,
      linkedTechPackVersionLabel: updatedRecord.versionLabel,
      linkedTechPackVersionStatus: updatedRecord.versionStatus,
      linkedTechPackUpdatedAt: updatedRecord.updatedAt,
      updatedAt: updatedRecord.updatedAt,
      updatedBy: operatorName,
    })
    syncPatternAssetTechPackLineage(task, updatedRecord, operatorName)
    return finalizeGeneration(updatedRecord, 'WRITTEN', '花型写入技术包', operatorName, source.sourceTaskType)
  }

  const nextRecord = buildTechPackVersionRecord({
    styleId: targetVersion.styleId,
    styleCode: targetVersion.styleCode,
    styleName: targetVersion.styleName,
    projectId: source.sourceProjectId,
    projectCode: source.sourceProjectCode,
    projectName: source.sourceProjectName,
    projectNodeId: targetVersion.sourceProjectNodeId,
    createdFromTaskType: source.sourceTaskType,
    createdFromTaskId: source.sourceTaskId,
    createdFromTaskCode: source.sourceTaskCode,
    baseVersion: targetVersion,
    primaryPlateTaskId: targetVersion.primaryPlateTaskId,
    primaryPlateTaskCode: targetVersion.primaryPlateTaskCode,
    primaryPlateTaskVersion: targetVersion.primaryPlateTaskVersion,
    linkedRevisionTaskIds: [...targetVersion.linkedRevisionTaskIds],
    linkedPatternTaskIds: [...targetVersion.linkedPatternTaskIds],
    linkedArtworkTaskIds: appendUnique(targetVersion.linkedArtworkTaskIds, task.patternTaskId),
    linkedPatternLibraryVersionIds: nextPatternLibraryRefs,
    linkedPatternAssetIds: nextPatternAssetRefs.linkedPatternAssetIds,
    linkedPatternAssetCodes: nextPatternAssetRefs.linkedPatternAssetCodes,
    changeScope: '花型替换',
    changeSummary: `${task.title} 仅调整花型内容，其它技术包域保持不变。`,
    note: task.note,
    operatorName,
  })
  const newContent: TechnicalDataVersionContent = {
    ...cloneContent(targetContent, nextRecord.technicalVersionId),
    patternDesigns: nextDesigns,
  }
  const createdRecord = createTechnicalDataVersionDraft(nextRecord, newContent)
  syncPatternAssetTechPackLineage(task, createdRecord, operatorName)
  writeVersionLog({
    record: createdRecord,
    logType: '花型生成新版本',
    changeScope: '花型替换',
    changeText: `已由花型任务 ${task.patternTaskCode} 基于 ${targetVersion.versionLabel} 生成仅调整花型的新版本。`,
    operatorName,
    sourceTaskType: source.sourceTaskType,
    sourceTaskId: source.sourceTaskId,
    sourceTaskCode: source.sourceTaskCode,
    sourceTaskName: source.sourceTaskName,
    beforeVersion: targetVersion,
    afterVersion: createdRecord,
  })
  updatePatternTask(task.patternTaskId, {
    linkedTechPackVersionId: createdRecord.technicalVersionId,
    linkedTechPackVersionCode: createdRecord.technicalVersionCode,
    linkedTechPackVersionLabel: createdRecord.versionLabel,
    linkedTechPackVersionStatus: createdRecord.versionStatus,
    linkedTechPackUpdatedAt: createdRecord.updatedAt,
    updatedAt: createdRecord.updatedAt,
    updatedBy: operatorName,
  })
  return finalizeGeneration(createdRecord, 'CREATED', '花型生成新版本', operatorName, source.sourceTaskType)
}

export function generateTechPackVersionFromRevisionTask(
  revisionTaskId: string,
  operatorName = '当前用户',
): TechPackGenerationResult {
  const task = getRevisionTaskById(revisionTaskId)
  if (!task) throw new Error('未找到改版任务。')
  ensureRevisionTaskReady(task)
  ensureTaskProject(task, '当前改版任务未绑定正式商品项目，不能建立技术包版本。')
  const style = ensureStyleArchive(
    { styleId: task.styleId, styleCode: task.styleCode || task.productStyleCode, projectId: task.projectId, spuCode: task.spuCode },
    '当前改版任务未绑定正式款式档案，不能建立技术包版本。',
  )
  const source = resolveEngineeringChangeTechPackSource(task)
  const currentEffective = getCurrentTechPackVersionByStyleId(style.styleId)
  if (!currentEffective) {
    throw new Error('当前款式尚未启用技术包版本，不能基于改版生成新版本。')
  }
  const currentContent = getTechnicalDataVersionContent(currentEffective.technicalVersionId)
  if (!currentContent) {
    throw new Error('未找到当前生效技术包内容，不能基于改版生成新版本。')
  }
  const nextRevisionTaskIds = currentEffective.linkedRevisionTaskIds.includes(task.revisionTaskId)
    ? [...currentEffective.linkedRevisionTaskIds]
    : [...currentEffective.linkedRevisionTaskIds, task.revisionTaskId]
  const nextRecord = buildTechPackVersionRecord({
    styleId: currentEffective.styleId,
    styleCode: currentEffective.styleCode,
    styleName: currentEffective.styleName,
    projectId: source.sourceProjectId,
    projectCode: source.sourceProjectCode,
    projectName: source.sourceProjectName,
    projectNodeId: '',
    createdFromTaskType: source.sourceTaskType,
    createdFromTaskId: source.sourceTaskId,
    createdFromTaskCode: source.sourceTaskCode,
    baseVersion: currentEffective,
    primaryPlateTaskId: currentEffective.primaryPlateTaskId,
    primaryPlateTaskCode: currentEffective.primaryPlateTaskCode,
    primaryPlateTaskVersion: currentEffective.primaryPlateTaskVersion,
    linkedRevisionTaskIds: nextRevisionTaskIds,
    linkedPatternTaskIds: [...currentEffective.linkedPatternTaskIds],
    linkedArtworkTaskIds: [...currentEffective.linkedArtworkTaskIds],
    linkedPatternLibraryVersionIds: [...currentEffective.linkedPatternLibraryVersionIds],
    changeScope: '改版生成',
    changeSummary: buildChangeSummaryFromRevision(task),
    note: task.note,
    operatorName,
  })
  const nextContent = cloneContent(currentContent, nextRecord.technicalVersionId)
  const createdRecord = createTechnicalDataVersionDraft(nextRecord, nextContent)
  writeVersionLog({
    record: createdRecord,
    logType: '改版生成新版本',
    changeScope: '改版生成',
    changeText: `已由改版任务 ${task.revisionTaskCode} 基于 ${currentEffective.versionLabel} 生成新的技术包版本。`,
    operatorName,
    sourceTaskType: source.sourceTaskType,
    sourceTaskId: source.sourceTaskId,
    sourceTaskCode: source.sourceTaskCode,
    sourceTaskName: source.sourceTaskName,
    beforeVersion: currentEffective,
    afterVersion: createdRecord,
  })
  updateRevisionTask(task.revisionTaskId, {
    status: '已生成技术包',
    linkedTechPackVersionId: createdRecord.technicalVersionId,
    linkedTechPackVersionCode: createdRecord.technicalVersionCode,
    linkedTechPackVersionLabel: createdRecord.versionLabel,
    linkedTechPackVersionStatus: createdRecord.versionStatus,
    linkedTechPackUpdatedAt: createdRecord.updatedAt,
    generatedNewTechPackVersionFlag: true,
    generatedNewTechPackVersionAt: createdRecord.updatedAt,
    updatedAt: createdRecord.updatedAt,
    updatedBy: operatorName,
  })
  return finalizeGeneration(createdRecord, 'CREATED', '改版生成新版本', operatorName, source.sourceTaskType)
}

export function isTechPackGenerationAllowedStatus(status: string): boolean {
  return status === '已确认' || status === '已生成技术包' || status === '已完成'
}

export function getTechPackGenerationBlockedReason(status: string): string {
  if (isTechPackGenerationAllowedStatus(status)) return ''
  return '当前任务尚未确认产出，不能建立技术包版本。'
}

export function getRevisionTechPackActionLabel(): string {
  return '生成改版技术包版本'
}

export function getPlateTechPackActionLabel(): string {
  return ['生成', '技术包版本'].join('')
}

export interface PatternTechPackActionMeta {
  label: string
  disabled: boolean
  disabledReason: string
}

function buildPatternTechPackDisabledLabel(reason: string): string {
  if (reason.includes('产出未完整')) return '待补齐产出'
  if (reason.includes('未绑定正式款式档案')) return '待关联款式档案'
  if (reason.includes('先完成制版任务生成技术包')) return '待生成技术包'
  if (reason.includes('尚未确认产出')) return '待任务确认'
  return '写入技术包花型'
}

interface PatternTechPackTargetResolution {
  mode: 'WRITE' | 'NEW_VERSION'
  disabledReason: string
}

function resolvePatternTechPackTarget(patternTaskId: string): PatternTechPackTargetResolution {
  const task = getPatternTaskById(patternTaskId)
  if (!task) {
    return {
      mode: 'WRITE',
      disabledReason: '未找到花型任务。',
    }
  }
  if (!isTechPackGenerationAllowedStatus(task.status)) {
    return {
      mode: 'WRITE',
      disabledReason: getTechPackGenerationBlockedReason(task.status) || '当前花型任务尚未确认产出，不能写入技术包。',
    }
  }
  const missingFields = getPatternTaskCompletionMissingFields(task)
  if (missingFields.length > 0) {
    return {
      mode: 'WRITE',
      disabledReason: `花型任务产出未完整：缺少${missingFields.join('、')}，不能写入技术包。`,
    }
  }
  try {
    const style = ensureStyleArchive(
      { styleId: '', styleCode: task.productStyleCode, projectId: task.projectId, spuCode: task.spuCode },
      '当前花型任务未绑定正式款式档案，不能写入技术包。',
    )
    const effectiveVersion = getCurrentTechPackVersionByStyleId(style.styleId)
    const plateDraftVersion = getLatestPlateWritableVersion(style.styleId)
    const targetVersion = effectiveVersion || plateDraftVersion
    if (!targetVersion) {
      return {
        mode: 'WRITE',
        disabledReason: '当前款式没有可写入花型的技术包版本，请先完成制版任务生成技术包。',
      }
    }
    const targetContent = getTechnicalDataVersionContent(targetVersion.technicalVersionId)
    if (!targetContent) {
      return {
        mode: 'WRITE',
        disabledReason: '未找到目标技术包版本内容，不能写入花型。',
      }
    }
    return {
      mode: hasArtworkContent(targetVersion, targetContent) ? 'NEW_VERSION' : 'WRITE',
      disabledReason: '',
    }
  } catch (error) {
    return {
      mode: 'WRITE',
      disabledReason: error instanceof Error ? error.message : '当前花型任务暂不能写入技术包。',
    }
  }
}

function getPatternTechPackDisabledReason(patternTaskId: string): string {
  return resolvePatternTechPackTarget(patternTaskId).disabledReason
}

function resolvePatternTaskTargetMode(patternTaskId: string): 'WRITE' | 'NEW_VERSION' {
  return resolvePatternTechPackTarget(patternTaskId).mode
}

export function getPatternTechPackActionLabel(patternTaskId: string): string {
  return resolvePatternTaskTargetMode(patternTaskId) === 'NEW_VERSION' ? '生成花型新版本' : '写入技术包花型'
}

export function getPatternTechPackActionMeta(patternTaskId: string): PatternTechPackActionMeta {
  const disabledReason = getPatternTechPackDisabledReason(patternTaskId)
  if (disabledReason) {
    return {
      label: buildPatternTechPackDisabledLabel(disabledReason),
      disabled: true,
      disabledReason,
    }
  }
  return {
    label: getPatternTechPackActionLabel(patternTaskId),
    disabled: false,
    disabledReason: '',
  }
}

export function getTechPackVersionById(technicalVersionId: string): TechnicalDataVersionRecord | null {
  return getTechnicalDataVersionById(technicalVersionId)
}

export function buildTechPackVersionSourceTaskSummary(record: TechnicalDataVersionRecord): {
  primaryPlateText: string
  revisionTaskCount: number
  patternTaskCount: number
  artworkTaskCount: number
  taskChainText: string
} {
  if (record.createdFromTaskType === 'MANUAL') {
    return {
      primaryPlateText: record.primaryPlateTaskCode
        ? `${record.primaryPlateTaskCode}${record.primaryPlateTaskVersion ? ` · ${record.primaryPlateTaskVersion}` : ''}`
        : '未绑定主制版任务',
      revisionTaskCount: 0,
      patternTaskCount: 0,
      artworkTaskCount: 0,
      taskChainText: '手动新增版本，无来源工程任务',
    }
  }

  const primaryPlateText = record.primaryPlateTaskCode
    ? `${record.primaryPlateTaskCode}${record.primaryPlateTaskVersion ? ` · ${record.primaryPlateTaskVersion}` : ''}`
    : '未绑定主制版任务'
  const parts = [
    record.primaryPlateTaskCode ? `主制版：${primaryPlateText}` : '',
    record.linkedArtworkTaskIds.length > 0 ? `花型任务 ${record.linkedArtworkTaskIds.length} 个` : '',
    record.linkedRevisionTaskIds.length > 0 ? `改版任务 ${record.linkedRevisionTaskIds.length} 个` : '',
  ].filter(Boolean)
  return {
    primaryPlateText,
    revisionTaskCount: record.linkedRevisionTaskIds.length,
    patternTaskCount: record.linkedPatternTaskIds.length,
    artworkTaskCount: record.linkedArtworkTaskIds.length,
    taskChainText: parts.join('；') || '未记录来源任务链',
  }
}
