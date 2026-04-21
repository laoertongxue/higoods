import { syncExistingProjectArchiveByProjectId } from './pcs-project-archive-sync.ts'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  updateProjectNodeRecord,
  updateProjectRecord,
} from './pcs-project-repository.ts'
import { upsertProjectRelation } from './pcs-project-relation-repository.ts'
import { syncProjectNodeInstanceRuntime } from './pcs-project-node-instance-registry.ts'
import { getRevisionTaskById, updateRevisionTask } from './pcs-revision-task-repository.ts'
import { getPlateMakingTaskById, updatePlateMakingTask } from './pcs-plate-making-repository.ts'
import { getPatternTaskById, updatePatternTask } from './pcs-pattern-task-repository.ts'
import { appendTechPackVersionLog } from './pcs-tech-pack-version-log-repository.ts'
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

interface TechPackProjectNodeBinding {
  projectNodeId: string | null
  workItemTypeCode: string
  workItemTypeName: string
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
  }))
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
    processEntries: cloneProcessEntries(content.processEntries),
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
  return [
    {
      id: `${task.plateTaskId}_pattern_file`,
      fileName: `${task.plateTaskCode}-${task.patternVersion || 'P1'}.dxf`,
      fileUrl: `mock://tech-pack/pattern/${task.plateTaskCode}`,
      uploadedAt: task.confirmedAt || task.updatedAt || nowText(),
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
  return [
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
      triggerSource: '制版任务',
      standardTimeMinutes: 12,
      timeUnit: '分钟/件',
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
      triggerSource: '制版任务',
      standardTimeMinutes: 18,
      timeUnit: '分钟/件',
      difficulty: 'MEDIUM',
      remark: `按 ${task.patternType || '标准版型'} 输出执行。`,
    },
  ]
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
      imageUrl: `mock://tech-pack/artwork/${task.patternTaskCode}`,
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

function ensureTaskNode(projectId: string, workItemTypeCode: string, workItemTypeName: string) {
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, workItemTypeCode)
  if (!node) {
    throw new Error(`当前项目缺少${workItemTypeName}节点，不能写入技术包版本。`)
  }
  return node
}

function getProjectNodeBindingByTaskType(
  projectId: string,
  taskType: TechPackSourceTaskType,
): TechPackProjectNodeBinding {
  if (taskType === 'PLATE') {
    const node = getProjectNodeRecordByWorkItemTypeCode(projectId, 'PATTERN_TASK')
    return {
      projectNodeId: node?.projectNodeId || null,
      workItemTypeCode: 'PATTERN_TASK',
      workItemTypeName: node?.workItemTypeName || '制版任务',
    }
  }

  if (taskType === 'ARTWORK') {
    const node = getProjectNodeRecordByWorkItemTypeCode(projectId, 'PATTERN_ARTWORK_TASK')
    return {
      projectNodeId: node?.projectNodeId || null,
      workItemTypeCode: 'PATTERN_ARTWORK_TASK',
      workItemTypeName: node?.workItemTypeName || '花型任务',
    }
  }

  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, 'REVISION_TASK')
  return {
    projectNodeId: node?.projectNodeId || null,
    workItemTypeCode: 'REVISION_TASK',
    workItemTypeName: node?.workItemTypeName || '改版任务',
  }
}

function buildChangeSummaryFromRevision(task: RevisionTaskRecord): string {
  const scopes = task.revisionScopeNames.length ? task.revisionScopeNames.join('、') : task.revisionScopeCodes.join('、')
  return [task.title, scopes ? `改版范围：${scopes}` : '', task.issueSummary ? `问题点：${task.issueSummary}` : '']
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
    linkedPartTemplateIds: base?.linkedPartTemplateIds ? [...base.linkedPartTemplateIds] : [],
    linkedPatternLibraryVersionIds: [...(input.linkedPatternLibraryVersionIds ?? base?.linkedPatternLibraryVersionIds ?? [])],
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
  sourceTaskType: TechPackSourceTaskType = record.createdFromTaskType,
): void {
  const nodeBinding = getProjectNodeBindingByTaskType(record.sourceProjectId, sourceTaskType)
  upsertProjectRelation({
    projectRelationId: buildProjectRelationId(record.technicalVersionId),
    projectId: record.sourceProjectId,
    projectCode: record.sourceProjectCode,
    projectNodeId: nodeBinding.projectNodeId ?? (record.sourceProjectNodeId || null),
    workItemTypeCode: nodeBinding.workItemTypeCode,
    workItemTypeName: nodeBinding.workItemTypeName,
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
    legacyRefType: '',
    legacyRefValue: '',
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
  if (!record.sourceProjectId) return
  updateProjectRecord(
    record.sourceProjectId,
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

export function syncProjectSourceNodeFromTechPackVersion(
  record: TechnicalDataVersionRecord,
  operatorName = '当前用户',
  action: TechPackGenerationAction = 'CREATED',
  sourceTaskType: TechPackSourceTaskType = record.createdFromTaskType,
): void {
  if (!record.sourceProjectId) return
  const nodeBinding = getProjectNodeBindingByTaskType(record.sourceProjectId, sourceTaskType)
  if (!nodeBinding.projectNodeId) return
  const node = getProjectNodeRecordByWorkItemTypeCode(record.sourceProjectId, nodeBinding.workItemTypeCode)
  if (!node) return
  updateProjectNodeRecord(
    record.sourceProjectId,
    nodeBinding.projectNodeId,
    {
      currentStatus: '进行中',
      latestInstanceId: record.technicalVersionId,
      latestInstanceCode: record.technicalVersionCode,
      validInstanceCount: action === 'CREATED' ? (node.validInstanceCount || 0) + 1 : node.validInstanceCount,
      latestResultType: action === 'WRITTEN' ? '技术包版本已更新' : '技术包版本已建立',
      latestResultText:
        action === 'WRITTEN'
          ? '已根据任务更新技术包版本内容。'
          : '已由工程任务建立新的技术包版本草稿。',
      pendingActionType: '完善技术包内容',
      pendingActionText: '请继续补齐技术包内容并准备发布。',
      updatedAt: record.updatedAt,
    },
    operatorName,
  )
  syncProjectNodeInstanceRuntime(record.sourceProjectId, nodeBinding.projectNodeId, operatorName, record.updatedAt)
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
  sourceTaskType: TechPackSourceTaskType = record.createdFromTaskType,
): TechPackGenerationResult {
  writeProjectRelationFromTechPackVersion(record, operatorName, sourceTaskType)
  syncStyleArchiveFromTechPackVersion(record)
  syncProjectFromTechPackVersion(record)
  syncProjectSourceNodeFromTechPackVersion(record, operatorName, action, sourceTaskType)
  syncExistingProjectArchiveByProjectId(record.sourceProjectId, operatorName)
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
  if (!isTechPackGenerationAllowedStatus(task.status)) {
    throw new Error(getTechPackGenerationBlockedReason(task.status) || '当前制版任务尚未确认产出，不能建立技术包版本。')
  }
  if (!task.patternVersion) {
    throw new Error('当前制版任务缺少生成技术包所需资料')
  }
  return task
}

function ensurePatternTaskReady(task: PatternTaskRecord): PatternTaskRecord {
  if (!isTechPackGenerationAllowedStatus(task.status)) {
    throw new Error(getTechPackGenerationBlockedReason(task.status) || '当前花型任务尚未确认产出，不能写入技术包。')
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
  const artworkVersion = task.artworkVersion?.trim()
  return artworkVersion
    ? appendUnique(baseVersion.linkedPatternLibraryVersionIds, artworkVersion)
    : [...baseVersion.linkedPatternLibraryVersionIds]
}

export function generateTechPackVersionFromPlateTask(
  plateTaskId: string,
  operatorName = '当前用户',
): TechPackGenerationResult {
  const task = getPlateMakingTaskById(plateTaskId)
  if (!task) throw new Error('未找到制版任务。')
  ensurePlateTaskReady(task)
  ensureTaskProject(task, '当前制版任务未绑定正式商品项目，不能建立技术包版本。')
  const sourceNode = ensureTaskNode(task.projectId, task.workItemTypeCode, task.workItemTypeName)
  const style = ensureStyleArchive(
    { styleId: '', styleCode: task.productStyleCode, projectId: task.projectId, spuCode: task.spuCode },
    '当前制版任务未绑定正式款式档案，不能建立技术包版本。',
  )
  const baseVersion = getCurrentTechPackVersionByStyleId(style.styleId) || listTechnicalDataVersionsByStyleId(style.styleId)[0] || null
  const baseContent = baseVersion ? getTechnicalDataVersionContent(baseVersion.technicalVersionId) : null
  const nextRecord = buildTechPackVersionRecord({
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    projectId: task.projectId,
    projectCode: task.projectCode,
    projectName: task.projectName,
    projectNodeId: sourceNode.projectNodeId,
    createdFromTaskType: 'PLATE',
    createdFromTaskId: task.plateTaskId,
    createdFromTaskCode: task.plateTaskCode,
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
    sourceTaskType: 'PLATE',
    sourceTaskId: task.plateTaskId,
    sourceTaskCode: task.plateTaskCode,
    sourceTaskName: task.title,
    beforeVersion: baseVersion,
    afterVersion: createdRecord,
  })
  updatePlateMakingTask(task.plateTaskId, {
    linkedTechPackVersionId: createdRecord.technicalVersionId,
    linkedTechPackVersionCode: createdRecord.technicalVersionCode,
    linkedTechPackVersionLabel: createdRecord.versionLabel,
    linkedTechPackVersionStatus: createdRecord.versionStatus,
    linkedTechPackUpdatedAt: createdRecord.updatedAt,
    updatedAt: createdRecord.updatedAt,
    updatedBy: operatorName,
  })
  return finalizeGeneration(createdRecord, 'CREATED', '制版生成技术包', operatorName, 'PLATE')
}

export function generateTechPackVersionFromPatternTask(
  patternTaskId: string,
  operatorName = '当前用户',
): TechPackGenerationResult {
  const task = getPatternTaskById(patternTaskId)
  if (!task) throw new Error('未找到花型任务。')
  ensurePatternTaskReady(task)
  ensureTaskProject(task, '当前花型任务未绑定正式商品项目，不能写入技术包。')
  ensureTaskNode(task.projectId, task.workItemTypeCode, task.workItemTypeName)
  const style = ensureStyleArchive(
    { styleId: '', styleCode: task.productStyleCode, projectId: task.projectId, spuCode: task.spuCode },
    '当前花型任务未绑定正式款式档案，不能写入技术包。',
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

  if (!hasArtworkContent(targetVersion, targetContent)) {
    updateTechnicalDataVersionContent(targetVersion.technicalVersionId, {
      patternDesigns: nextDesigns,
    })
    const updatedRecord = updateTechnicalDataVersionRecord(targetVersion.technicalVersionId, {
      linkedArtworkTaskIds: appendUnique(targetVersion.linkedArtworkTaskIds, task.patternTaskId),
      linkedPatternLibraryVersionIds: nextPatternLibraryRefs,
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
      sourceTaskType: 'ARTWORK',
      sourceTaskId: task.patternTaskId,
      sourceTaskCode: task.patternTaskCode,
      sourceTaskName: task.title,
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
    return finalizeGeneration(updatedRecord, 'WRITTEN', '花型写入技术包', operatorName, 'ARTWORK')
  }

  const nextRecord = buildTechPackVersionRecord({
    styleId: targetVersion.styleId,
    styleCode: targetVersion.styleCode,
    styleName: targetVersion.styleName,
    projectId: targetVersion.sourceProjectId,
    projectCode: targetVersion.sourceProjectCode,
    projectName: targetVersion.sourceProjectName,
    projectNodeId: targetVersion.sourceProjectNodeId,
    createdFromTaskType: 'ARTWORK',
    createdFromTaskId: task.patternTaskId,
    createdFromTaskCode: task.patternTaskCode,
    baseVersion: targetVersion,
    primaryPlateTaskId: targetVersion.primaryPlateTaskId,
    primaryPlateTaskCode: targetVersion.primaryPlateTaskCode,
    primaryPlateTaskVersion: targetVersion.primaryPlateTaskVersion,
    linkedRevisionTaskIds: [...targetVersion.linkedRevisionTaskIds],
    linkedPatternTaskIds: [...targetVersion.linkedPatternTaskIds],
    linkedArtworkTaskIds: appendUnique(targetVersion.linkedArtworkTaskIds, task.patternTaskId),
    linkedPatternLibraryVersionIds: nextPatternLibraryRefs,
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
  writeVersionLog({
    record: createdRecord,
    logType: '花型生成新版本',
    changeScope: '花型替换',
    changeText: `已由花型任务 ${task.patternTaskCode} 基于 ${targetVersion.versionLabel} 生成仅调整花型的新版本。`,
    operatorName,
    sourceTaskType: 'ARTWORK',
    sourceTaskId: task.patternTaskId,
    sourceTaskCode: task.patternTaskCode,
    sourceTaskName: task.title,
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
  return finalizeGeneration(createdRecord, 'CREATED', '花型生成新版本', operatorName, 'ARTWORK')
}

export function generateTechPackVersionFromRevisionTask(
  revisionTaskId: string,
  operatorName = '当前用户',
): TechPackGenerationResult {
  const task = getRevisionTaskById(revisionTaskId)
  if (!task) throw new Error('未找到改版任务。')
  ensureRevisionTaskReady(task)
  ensureTaskProject(task, '当前改版任务未绑定正式商品项目，不能建立技术包版本。')
  const sourceNode = ensureTaskNode(task.projectId, task.workItemTypeCode, task.workItemTypeName)
  const style = ensureStyleArchive(
    { styleId: task.styleId, styleCode: task.styleCode || task.productStyleCode, projectId: task.projectId, spuCode: task.spuCode },
    '当前改版任务未绑定正式款式档案，不能建立技术包版本。',
  )
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
    projectId: task.projectId,
    projectCode: task.projectCode,
    projectName: task.projectName,
    projectNodeId: sourceNode.projectNodeId,
    createdFromTaskType: 'REVISION',
    createdFromTaskId: task.revisionTaskId,
    createdFromTaskCode: task.revisionTaskCode,
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
    sourceTaskType: 'REVISION',
    sourceTaskId: task.revisionTaskId,
    sourceTaskCode: task.revisionTaskCode,
    sourceTaskName: task.title,
    beforeVersion: currentEffective,
    afterVersion: createdRecord,
  })
  updateRevisionTask(task.revisionTaskId, {
    linkedTechPackVersionId: createdRecord.technicalVersionId,
    linkedTechPackVersionCode: createdRecord.technicalVersionCode,
    linkedTechPackVersionLabel: createdRecord.versionLabel,
    linkedTechPackVersionStatus: createdRecord.versionStatus,
    linkedTechPackUpdatedAt: createdRecord.updatedAt,
    updatedAt: createdRecord.updatedAt,
    updatedBy: operatorName,
  })
  return finalizeGeneration(createdRecord, 'CREATED', '改版生成新版本', operatorName, 'REVISION')
}

export function isTechPackGenerationAllowedStatus(status: string): boolean {
  return status === '已确认' || status === '已完成'
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
  if (reason.includes('未绑定正式款式档案')) return '待关联款式档案'
  if (reason.includes('先完成制版任务生成技术包')) return '待生成技术包'
  if (reason.includes('尚未确认产出')) return '待任务确认'
  return '写入技术包花型'
}

function getPatternTechPackDisabledReason(patternTaskId: string): string {
  const task = getPatternTaskById(patternTaskId)
  if (!task) return '未找到花型任务。'
  if (!isTechPackGenerationAllowedStatus(task.status)) {
    return getTechPackGenerationBlockedReason(task.status) || '当前花型任务尚未确认产出，不能写入技术包。'
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
      return '当前款式没有可写入花型的技术包版本，请先完成制版任务生成技术包。'
    }
    const targetContent = getTechnicalDataVersionContent(targetVersion.technicalVersionId)
    if (!targetContent) {
      return '未找到目标技术包版本内容，不能写入花型。'
    }
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : '当前花型任务暂不能写入技术包。'
  }
}

function resolvePatternTaskTargetMode(patternTaskId: string): 'WRITE' | 'NEW_VERSION' {
  const task = getPatternTaskById(patternTaskId)
  if (!task) return 'WRITE'
  const style = ensureStyleArchive(
    { styleId: '', styleCode: task.productStyleCode, projectId: task.projectId, spuCode: task.spuCode },
    '当前花型任务未绑定正式款式档案，不能写入技术包。',
  )
  const effectiveVersion = getCurrentTechPackVersionByStyleId(style.styleId)
  const plateDraftVersion = getLatestPlateWritableVersion(style.styleId)
  const targetVersion = effectiveVersion || plateDraftVersion
  if (!targetVersion) return 'WRITE'
  const targetContent = getTechnicalDataVersionContent(targetVersion.technicalVersionId)
  if (!targetContent) return 'WRITE'
  return hasArtworkContent(targetVersion, targetContent) ? 'NEW_VERSION' : 'WRITE'
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
