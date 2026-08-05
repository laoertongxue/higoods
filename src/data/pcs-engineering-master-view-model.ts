// 工程主单视图模型：为列表页与泳道工作台派生只读展示数据。
// 演示种子只在本模块内部维护，页面渲染前调用 ensureEngineeringMasterDemoData()。

import {
  buildEngineeringTaskPlan,
  getEngineeringTaskDefinition,
  listEngineeringTaskDefinitions,
  type EngineeringTaskDefinition,
  type EngineeringBomTaskConditions,
} from './pcs-engineering-dependency-policy.ts'
import { hasFormalProductionFact } from './pcs-engineering-first-production-policy.ts'
import {
  createEngineeringMasterOrder,
  confirmEngineeringMasterTaskPlan,
  applyBomRequirementsToEngineeringTasks,
  listEngineeringMasterOrders,
  listEngineeringMasterPriorResultCandidates,
  seedEngineeringMasterDemoLifecycleStatus,
  setEngineeringMasterStatus,
  updateEngineeringTaskRecord,
} from './pcs-engineering-master-repository.ts'
import type {
  EngineeringMasterOrderRecord,
  EngineeringMasterStatus,
  EngineeringPreparationType,
  EngineeringPriorResultReuseLine,
  EngineeringTaskRecord,
  EngineeringTaskStatus,
  EngineeringTaskType,
} from './pcs-engineering-master-types.ts'
import { listStyleArchives, updateStyleArchive } from './pcs-style-archive-repository.ts'
import { createEngineeringMasterTechPackDraft } from './pcs-engineering-tech-pack-workspace.ts'
import {
  listTechnicalDataVersionsByStyleId,
  updateTechnicalDataVersionRecord,
} from './pcs-technical-data-version-repository.ts'
import {
  createEngineeringChangeWorkspace,
  listEngineeringChangeWorkspaceViews,
  startEngineeringChangeTaskLine,
} from './pcs-engineering-change-workspace.ts'
import { CURRENT_PCS_ENGINEERING_USER } from './pcs-engineering-current-user.ts'

// ============ 泳道与逻辑阶段（固定结构，只读） ============

export interface EngineeringLaneDefinition {
  laneKey: string
  laneName: string
  taskTypes: EngineeringTaskType[]
}

export interface EngineeringPhaseDefinition {
  phaseKey: string
  phaseName: string
  taskTypes: EngineeringTaskType[]
}

export const ENGINEERING_LANES: readonly EngineeringLaneDefinition[] = [
  { laneKey: 'pattern', laneName: '制版', taskTypes: ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT', 'SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'] },
  { laneKey: 'sample', laneName: '产前版样衣', taskTypes: ['PRE_PRODUCTION_SAMPLE'] },
  { laneKey: 'artwork', laneName: '花型', taskTypes: ['PATTERN_ARTWORK'] },
  { laneKey: 'color', laneName: '调色', taskTypes: ['COLOR_YARN', 'COLOR_FABRIC'] },
  { laneKey: 'purchase', laneName: '辅料下单', taskTypes: ['ACCESSORY_PURCHASE'] },
  { laneKey: 'tech-pack', laneName: '技术包确认', taskTypes: ['TECH_PACK_CONFIRMATION'] },
]

export const ENGINEERING_PHASES: readonly EngineeringPhaseDefinition[] = [
  { phaseKey: 'base-pattern', phaseName: '基码纸样', taskTypes: ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT'] },
  { phaseKey: 'sample-size', phaseName: '版衣与齐码', taskTypes: ['PRE_PRODUCTION_SAMPLE', 'SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'] },
  { phaseKey: 'artwork-color', phaseName: '花型与调色', taskTypes: ['PATTERN_ARTWORK', 'COLOR_YARN', 'COLOR_FABRIC'] },
  { phaseKey: 'purchase', phaseName: '辅料采购', taskTypes: ['ACCESSORY_PURCHASE'] },
  { phaseKey: 'tech-pack', phaseName: '技术包确认', taskTypes: ['TECH_PACK_CONFIRMATION'] },
]

// 演示计划时间按任务类型相对发布时间的固定偏移（天）。
const PLAN_OFFSET_DAYS: Record<EngineeringTaskType, number> = {
  BASE_PATTERN_WOVEN: 5,
  BASE_PATTERN_KNIT: 5,
  PRE_PRODUCTION_SAMPLE: 10,
  SIZE_PATTERN_WOVEN: 15,
  SIZE_PATTERN_KNIT: 15,
  PATTERN_ARTWORK: 12,
  COLOR_YARN: 18,
  COLOR_FABRIC: 18,
  ACCESSORY_PURCHASE: 8,
  TECH_PACK_CONFIRMATION: 22,
}

// ============ 演示种子 ============

// 仓库为空时创建演示主单：首张发布为 EM-001，第二张保持草稿，用于展示不同状态。
export function ensureEngineeringMasterDemoData(): void {
  const records = listEngineeringMasterOrders()
  if (records.length >= 12) {
    ensureEngineeringDemoTaskMaterials(records)
    ensureEngineeringLifecycleDemoData()
    return
  }
  const styles = listStyleArchives()
  const usedStyleIds = new Set(records.map((record) => record.styleId))
  const candidates = styles
    .filter((style) => !usedStyleIds.has(style.styleId))
    .filter((style) => !hasFormalProductionFact(style.styleCode))
    .filter((style) => Boolean(style.mainImageUrl || style.galleryImageUrls[0]))
    .slice(0, Math.max(0, 12 - records.length))
  if (candidates.length === 0) {
    ensureEngineeringDemoTaskMaterials(records)
    ensureEngineeringLifecycleDemoData()
    return
  }
  const preparationTypes = ['PURE_WOVEN', 'KNIT', 'KNIT_WOVEN', 'HEAT_TRANSFER_DIRECT_PRINT'] as const
  for (const [index, style] of candidates.entries()) {
    const scenarioNo = records.length + index
    const preparationType = preparationTypes[scenarioNo % preparationTypes.length]
    const record = createEngineeringMasterOrder({
      styleId: style.styleId,
      styleCode: style.styleCode,
      merchandiserId: `USER-M-${(scenarioNo % 3) + 1}`,
      merchandiserName: '跟单-林晓',
      createdById: `USER-M-${(scenarioNo % 3) + 1}`,
      createdBy: '跟单-林晓',
      createdByRole: '跟单',
      preparationType,
      qualificationFact: {
        styleCode: style.styleCode,
        formalSaleStatus: 'NO_FORMAL_SALE',
        formalProductionStatus: 'NO_FORMAL_PRODUCTION',
        formalSaleSource: '正式销售订单事实',
        formalProductionSource: '正式生产单事实',
        checkedAt: `2026-08-${String((scenarioNo % 4) + 1).padStart(2, '0')} 09:00:00`,
      },
      bulkProductionQualification: {
        basisType: scenarioNo % 3 === 0 ? 'TEST_APPROVED' : scenarioNo % 3 === 1 ? 'REVISION_READY' : 'DESIGN_READY',
        triggerBusinessObjectType: '做大货资格',
        triggerBusinessObjectId: `BULK-DEMO-${scenarioNo + 1}`,
        thresholdQuantity: 300,
        reachedQuantity: 320 + scenarioNo * 10,
        reachedAt: `2026-08-${String((scenarioNo % 4) + 1).padStart(2, '0')} 09:00:00`,
        reason: '已满足做大货要求',
        uniqueTriggerKey: `BULK-DEMO-${style.styleCode}`,
      },
      creationReason: '跟单核实后人工创建',
    })
    // 保留一张草稿用于演示“待确认任务方案”，其余主单进入可执行场景。
    if (scenarioNo === 1) continue
    const bomConditions: EngineeringBomTaskConditions = {
      hasPrintRequirement: scenarioNo % 3 === 0,
      hasYarnDyeRequirement: preparationType === 'KNIT' || preparationType === 'KNIT_WOVEN',
      hasFabricDyeRequirement: scenarioNo % 4 === 2,
      hasAccessoryPurchaseRequirement: scenarioNo % 2 === 0,
    }
    const published = confirmEngineeringMasterTaskPlan(record.masterOrderId, {
      confirmedBy: record.merchandiserName,
      confirmedById: record.merchandiserId,
      confirmedByRole: '跟单',
      preparationType,
      bomConditions,
      selectedConditionalTaskTypes: [],
    })
    ensureEngineeringDemoTaskMaterials([published])
    seedEngineeringMasterScenario(published.masterOrderId, scenarioNo)
  }
  ensureEngineeringLifecycleDemoData()
}

function ensureEngineeringDemoTaskMaterials(records: EngineeringMasterOrderRecord[]): void {
  for (const master of records) {
    if (!master.bulkProductionQualification.triggerBusinessObjectId.startsWith('BULK-DEMO-')) continue
    if (!['已发布', '进行中'].includes(master.status)) continue
    const emptyActiveTaskTypes = new Set(master.tasks
      .filter((task) => ['待开始', '进行中', '返工中'].includes(task.status) && task.materialLines.length === 0)
      .map((task) => task.taskType))
    const rows = []
    if (emptyActiveTaskTypes.has('PATTERN_ARTWORK')) {
      rows.push(
        {
          bomItemId: `${master.masterOrderId}-PRINT-BLUE`,
          materialSkuId: 'material_fabric_001_sku_002',
          materialName: '经编8坑-C2813',
          materialType: '面料',
          productColor: '宝蓝色',
          printRequirement: '是',
          printProcess: '数码印花',
        },
        {
          bomItemId: `${master.masterOrderId}-PRINT-WHITE`,
          materialSkuId: 'material_fabric_001_sku_001',
          materialName: '经编8坑-C2813',
          materialType: '面料',
          productColor: '米白色',
          printRequirement: '是',
          printProcess: '定位印花',
        },
      )
    }
    if (emptyActiveTaskTypes.has('COLOR_FABRIC')) {
      rows.push({
        bomItemId: `${master.masterOrderId}-DYE-FABRIC`,
        materialSkuId: 'material_fabric_002_sku_001',
        materialName: '纯棉毛织布 180g',
        materialType: '面料',
        productColor: '番茄红',
        dyeRequirement: '是',
      })
    }
    if (emptyActiveTaskTypes.has('COLOR_YARN')) {
      rows.push({
        bomItemId: `${master.masterOrderId}-DYE-YARN`,
        materialSkuId: 'material_yarn_001_sku_001',
        materialName: '精梳棉纱线',
        materialType: '纱线',
        productColor: '经典蓝',
        dyeRequirement: '是',
      })
    }
    if (emptyActiveTaskTypes.has('ACCESSORY_PURCHASE')) {
      rows.push(
        {
          bomItemId: `${master.masterOrderId}-ACC-FLOWER`,
          materialSkuId: 'material_accessory_001_sku_001',
          materialName: '欧根纱刺绣蕾丝小花',
          materialType: '辅料',
          productColor: '蓝色',
          purchaseRequirement: '是',
        },
        {
          bomItemId: `${master.masterOrderId}-ACC-BUTTON`,
          materialSkuId: 'material_accessory_002_sku_001',
          materialName: '树脂四眼纽扣',
          materialType: '辅料',
          productColor: '本色',
          purchaseRequirement: '是',
        },
      )
    }
    if (rows.length > 0) applyBomRequirementsToEngineeringTasks(master.masterOrderId, rows)
  }
}

function seedEngineeringMasterScenario(masterOrderId: string, scenarioNo: number): void {
  const master = listEngineeringMasterOrders().find((record) => record.masterOrderId === masterOrderId)
  if (!master) return
  const enabled = master.tasks.filter((task) => task.status !== '未启用')
  const baseTime = `2026-08-${String((scenarioNo % 4) + 1).padStart(2, '0')}`
  const completeTask = (taskId: string, offset: number) => updateEngineeringTaskRecord(masterOrderId, taskId, (task) => {
    const startedAt = `${baseTime} ${String(9 + offset).padStart(2, '0')}:00:00`
    const completedAt = `${baseTime} ${String(10 + offset).padStart(2, '0')}:30:00`
    task.status = '已完成'
    task.assigneeId = `USER-E-${offset + 1}`
    task.assigneeName = `${task.ownerTeamName}-${offset + 1}`
    task.startedAt = startedAt
    task.submittedAt = completedAt
    task.firstCompletedAt = completedAt
    task.effectiveCompletedAt = completedAt
    task.completedAt = completedAt
    task.events.startedAt = startedAt
    task.events.submittedAt = completedAt
    task.events.firstCompletedAt = completedAt
    task.events.effectiveCompletedAt = completedAt
  })
  const primary = enabled.filter((task) => task.taskType !== 'TECH_PACK_CONFIRMATION')
  const seedTechPackDraft = scenarioNo === 3 || scenarioNo === 7 || scenarioNo === 11
  const completedPrimaryTasks = seedTechPackDraft
    ? primary
    : primary.slice(0, Math.min(primary.length, scenarioNo % 4))
  completedPrimaryTasks.forEach((task, offset) => completeTask(task.taskId, offset))
  const refreshed = listEngineeringMasterOrders().find((record) => record.masterOrderId === masterOrderId)
  const active = refreshed?.tasks.filter((task) => task.status !== '未启用' && task.status !== '已完成') || []
  active.slice(0, scenarioNo % 3 === 0 ? 2 : 1).forEach((task, offset) => {
    updateEngineeringTaskRecord(masterOrderId, task.taskId, (stored) => {
      const desiredStatus = scenarioNo % 5 === 0 ? '待审核' : scenarioNo % 5 === 1 ? '返工中' : '进行中'
      const reviewRequired = getEngineeringTaskDefinition(stored.taskType).reviewRequired
      stored.status = reviewRequired && stored.materialLines.length > 0 ? desiredStatus : '进行中'
      stored.assigneeId = `USER-A-${scenarioNo}-${offset}`
      stored.assigneeName = `${stored.ownerTeamName}负责人`
      stored.startedAt = `${baseTime} 11:00:00`
      stored.events.startedAt = stored.startedAt
      if (stored.status === '待审核') {
        stored.submittedAt = `${baseTime} 15:00:00`
        stored.events.submittedAt = stored.submittedAt
      }
      if (stored.status === '返工中') stored.reworkRounds = [{ roundNo: 1, reason: '成果需要调整', startedAt: `${baseTime} 16:00:00`, submittedAt: '', passedAt: '' }]
    })
  })
  if (scenarioNo >= 2) setEngineeringMasterStatus(masterOrderId, scenarioNo >= 10 ? '技术包审核中' : '进行中')
  if (seedTechPackDraft) createEngineeringMasterTechPackDraft(masterOrderId, master.merchandiserName)
}

function ensureEngineeringLifecycleDemoData(): void {
  // 只允许初始化内置 BULK-DEMO 主单；人工新建草稿不得因追加到仓库末尾而被改写生命周期。
  const records = listEngineeringMasterOrders().filter((record) =>
    record.bulkProductionQualification.triggerBusinessObjectId.startsWith('BULK-DEMO-'))
  const closingMaster = records.at(-2)
  const closedMaster = records.at(-1)
  if (closingMaster && closingMaster.status !== '待关闭' && closingMaster.status !== '已关闭') {
    seedEngineeringMasterDemoLifecycleStatus(closingMaster.masterOrderId, '待关闭')
  }
  if (!closedMaster) return
  let versions = listTechnicalDataVersionsByStyleId(closedMaster.styleId)
    .filter((version) => version.createdFromTaskType === 'ENGINEERING_MASTER')
  if (versions.length === 0) {
    for (const task of closedMaster.tasks) {
      if (task.status === '未启用') continue
      updateEngineeringTaskRecord(closedMaster.masterOrderId, task.taskId, (stored) => {
        stored.status = '已完成'
        stored.startedAt ||= '2026-08-04 09:00:00'
        stored.submittedAt ||= '2026-08-04 15:00:00'
        stored.firstCompletedAt ||= stored.submittedAt
        stored.effectiveCompletedAt ||= stored.submittedAt
        stored.completedAt ||= stored.submittedAt
      })
    }
    createEngineeringMasterTechPackDraft(closedMaster.masterOrderId, closedMaster.merchandiserName)
    versions = listTechnicalDataVersionsByStyleId(closedMaster.styleId)
      .filter((version) => version.createdFromTaskType === 'ENGINEERING_MASTER')
  }
  const currentVersion = versions[0]
  if (currentVersion && currentVersion.versionStatus !== 'PUBLISHED') {
    updateTechnicalDataVersionRecord(currentVersion.technicalVersionId, {
      versionStatus: 'PUBLISHED',
      reviewStage: '已发布',
      publishedAt: '2026-08-04 17:30:00',
      publishedBy: closedMaster.merchandiserName,
      updatedAt: '2026-08-04 17:30:00',
      updatedBy: closedMaster.merchandiserName,
    })
  }
  if (currentVersion) {
    updateStyleArchive(closedMaster.styleId, {
      currentTechPackVersionId: currentVersion.technicalVersionId,
      currentTechPackVersionCode: currentVersion.technicalVersionCode,
    })
  }
  if (closedMaster.status !== '已关闭') {
    seedEngineeringMasterDemoLifecycleStatus(closedMaster.masterOrderId, '已关闭')
  }
  if (listEngineeringChangeWorkspaceViews().length > 0) return
  const changeView = createEngineeringChangeWorkspace({
    sourceMasterOrderId: closedMaster.masterOrderId,
    changeReason: '直播反馈领口版型需要调整，同时更新齐码纸样。',
    affectedModules: ['PATTERN', 'DESIGN'],
    actor: CURRENT_PCS_ENGINEERING_USER,
  })
  const firstLine = changeView.workspace.taskLines[0]
  if (firstLine) startEngineeringChangeTaskLine(changeView.change.engineeringChangeTaskId, firstLine.lineId, CURRENT_PCS_ENGINEERING_USER)
}

// ============ 列表视图模型 ============

export interface EngineeringMasterListRow {
  masterOrderId: string
  masterOrderCode: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  merchandiserName: string
  status: EngineeringMasterStatus
  currentStage: string
  progressText: string
  updatedAt: string
}

function deriveCurrentStage(record: EngineeringMasterOrderRecord): string {
  if (record.status === '草稿') return '待确认任务方案'
  if (record.status === '已关闭') return '已关闭'
  if (record.status === '已终止') return '已终止'
  if (record.status === '待关闭') return '待关闭'
  if (record.status === '技术包审核中') return '技术包审核中'
  const active = record.tasks.filter((task) =>
    ['待开始', '进行中', '待审核', '返工中'].includes(task.status),
  )
  if (active.length > 1) return `并行准备（${active.length} 项）`
  if (active.length === 1) return active[0].taskName
  const waiting = record.tasks.find((task) => task.status === '待前置')
  if (waiting) return waiting.taskName
  return '全部就绪'
}

function deriveProgressText(record: EngineeringMasterOrderRecord): string {
  if (record.status === '草稿') return '未发布'
  const applicable = record.tasks.filter((task) => task.status !== '未启用' && task.status !== '因需求变更结束')
  const done = applicable.filter((task) => task.status === '已完成').length
  return `${done}/${applicable.length}`
}

function deriveUpdatedAt(record: EngineeringMasterOrderRecord): string {
  return [
    record.createdAt,
    record.taskPlanConfirmedAt || '',
    record.publishedAt,
    record.closedAt,
    record.terminatedAt,
    ...record.tasks.flatMap((task) => [
      task.events.startedAt,
      task.events.submittedAt,
      task.events.reviewedAt,
      task.events.effectiveCompletedAt,
      ...task.operationLogs.map((log) => log.operatedAt),
    ]),
  ].filter(Boolean).sort().at(-1) || record.createdAt
}

export function buildEngineeringMasterListRows(): EngineeringMasterListRow[] {
  const styles = new Map(listStyleArchives().map((style) => [style.styleId, style]))
  return listEngineeringMasterOrders().map((record) => ({
    masterOrderId: record.masterOrderId,
    masterOrderCode: record.masterOrderCode,
    styleCode: record.styleCode,
    styleName: record.styleName,
    styleImageUrl: styles.get(record.styleId)?.mainImageUrl
      || styles.get(record.styleId)?.galleryImageUrls[0]
      || '',
    merchandiserName: record.merchandiserName,
    status: record.status,
    currentStage: deriveCurrentStage(record),
    progressText: deriveProgressText(record),
    updatedAt: deriveUpdatedAt(record),
  }))
}

// ============ 详情视图模型（泳道工作台） ============

export interface EngineeringTaskCardModel {
  taskId: string
  taskType: EngineeringTaskType
  taskName: string
  ownerTeamName: string
  status: EngineeringTaskStatus
  currentNodeName: string
  plannedTimeText: string
  actualTimeText: string
  riskText: string
  dependsOnLabels: string[]
  dependsOnTaskIds: string[]
  requiredByLabels: string[]
  requiredByTaskIds: string[]
  reviewRequired: boolean
}

export interface EngineeringLaneModel {
  laneKey: string
  laneName: string
  tasks: EngineeringTaskCardModel[]
}

export interface EngineeringTaskPlanSuggestion {
  taskType: EngineeringTaskType
  taskName: string
  ownerTeamName: string
  dependencyText: string
  required: boolean
  notApplicable: boolean
  suggestedSelected: boolean
  suggestionReason: string
}

export interface EngineeringMasterDetailModel {
  masterOrderId: string
  masterOrderCode: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  status: EngineeringMasterStatus
  merchandiserName: string
  createdBy: string
  createdAt: string
  publishedAt: string
  preparationType: EngineeringPreparationType | ''
  lanes: EngineeringLaneModel[]
  priorResultReuseLines: EngineeringPriorResultReuseLine[]
  priorResultCandidateGroups: EngineeringPriorResultCandidateGroup[]
  taskPlanSuggestions: EngineeringTaskPlanSuggestion[]
}

export interface EngineeringPriorResultCandidateModel {
  engineeringTaskType: EngineeringTaskType
  sourceSamplingTaskId: string
  sourceSamplingTaskCode: string
  sourceProfessionalTaskId: string
  sourceTaskLabel: string
  sourceResultVersion: string
  sourceBomDraftVersionId: string
  confirmedBy: string
  confirmedAt: string
  recommended: boolean
}

export interface EngineeringPriorResultCandidateGroup {
  engineeringTaskType: EngineeringTaskType
  taskName: string
  candidates: EngineeringPriorResultCandidateModel[]
}

function buildTaskPlanSuggestions(
  record: EngineeringMasterOrderRecord,
  _style: ReturnType<typeof listStyleArchives>[number] | undefined,
  preparationType: EngineeringPreparationType | '' = record.preparationType,
): EngineeringTaskPlanSuggestion[] {
  if (!preparationType) return []
  const conditions: EngineeringBomTaskConditions = {
    hasPrintRequirement: record.tasks.some((task) => task.materialLines.some((line) => line.requirementType === '印花' && line.status === '正常')),
    hasYarnDyeRequirement: record.tasks.some((task) => task.materialLines.some((line) => line.requirementType === '染色' && line.materialType === '纱线' && line.status === '正常')),
    hasFabricDyeRequirement: record.tasks.some((task) => task.materialLines.some((line) => line.requirementType === '染色' && line.materialType === '面料' && line.status === '正常')),
    hasAccessoryPurchaseRequirement: record.tasks.some((task) => task.materialLines.some((line) => line.requirementType === '辅料' && line.status === '正常')),
  }
  const plan = new Map(buildEngineeringTaskPlan(preparationType, conditions).map((line) => [line.taskType, line]))
  return listEngineeringTaskDefinitions().map((definition) => {
    const planLine = plan.get(definition.taskType)
    const required = planLine?.applicability === 'REQUIRED'
    const notApplicable = planLine?.applicability === 'NOT_APPLICABLE'
    const suggestedSelected = planLine?.enabled === true
    const conditionalReason = notApplicable
      ? '当前生产准备类型不适用'
      : planLine?.enabled ? '已由结构化 BOM 需求启用' : '当 BOM 存在对应需求时启用'
    return {
      taskType: definition.taskType,
      taskName: definition.taskName,
      ownerTeamName: definition.ownerTeamName,
      dependencyText: planLine && planLine.dependsOn.length > 0
        ? planLine.dependsOn.map((taskType) => getEngineeringTaskDefinition(taskType).taskName).join('、')
        : '无',
      required,
      notApplicable,
      suggestedSelected,
      suggestionReason: required ? '首单工程固定任务' : conditionalReason,
    }
  })
}

function parseDateText(text: string): Date | null {
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatPlanDate(baseText: string, offsetDays: number): string {
  const base = parseDateText(baseText)
  if (!base) return '—'
  const target = new Date(base.getTime() + offsetDays * 24 * 60 * 60 * 1000)
  const month = String(target.getMonth() + 1).padStart(2, '0')
  const day = String(target.getDate()).padStart(2, '0')
  return `${month}-${day}`
}

function deriveCurrentNodeName(task: EngineeringTaskRecord, definition: EngineeringTaskDefinition): string {
  if (definition.stages.length === 0) return task.status
  if (task.status === '待审核') {
    const reviewStage = definition.stages.find((stage) => stage.stageType === 'BUYER_REVIEW')
    return reviewStage?.stageName ?? task.status
  }
  if (task.status === '进行中') {
    const coloringStage = definition.stages.find((stage) => stage.stageType === 'FACTORY_COLORING')
    return coloringStage?.stageName ?? task.status
  }
  return task.status
}

function deriveRiskText(
  task: EngineeringTaskRecord,
  dependsOnLabels: string[],
  definition: EngineeringTaskDefinition,
): string {
  if (task.status === '待前置') {
    return dependsOnLabels.length > 0 ? `等待：${dependsOnLabels.join('、')}` : '等待前置完成'
  }
  if (task.status === '待审核') return '等待审核'
  if (task.status === '返工中') return `返工中：第 ${task.reworkRounds.length + 1} 轮`
  if (task.status === '进行中' && definition.stages.length > 0) {
    const coloringStage = definition.stages.find((stage) => stage.stageType === 'FACTORY_COLORING')
    return coloringStage ? '染厂执行中' : ''
  }
  return ''
}

export function buildEngineeringMasterDetailModel(
  key: string,
  preparationTypeOverride: EngineeringPreparationType | '' = '',
): EngineeringMasterDetailModel | null {
  ensureEngineeringMasterDemoData()
  const records = listEngineeringMasterOrders()
  const record =
    records.find((item) => item.masterOrderId === key || item.masterOrderCode === key) ?? null
  if (!record) return null

  const definitions = new Map(
    listEngineeringTaskDefinitions().map((definition) => [definition.taskType, definition]),
  )
  const taskById = new Map(record.tasks.map((task) => [task.taskId, task]))
  const style = listStyleArchives().find((item) => item.styleId === record.styleId)
  const effectivePreparationType = preparationTypeOverride || record.preparationType
  const priorResultCandidateGroups = record.status === '草稿' && effectivePreparationType
    ? [...new Set(
        listEngineeringMasterPriorResultCandidates(record.styleCode, effectivePreparationType)
          .map((candidate) => candidate.engineeringTaskType),
      )].map((engineeringTaskType) => ({
        engineeringTaskType,
        taskName: getEngineeringTaskDefinition(engineeringTaskType).taskName,
        candidates: listEngineeringMasterPriorResultCandidates(record.styleCode, effectivePreparationType)
          .filter((candidate) => candidate.engineeringTaskType === engineeringTaskType)
          .map((candidate) => ({
            engineeringTaskType,
            sourceSamplingTaskId: candidate.source.samplingTaskId,
            sourceSamplingTaskCode: candidate.source.samplingTaskCode,
            sourceProfessionalTaskId: candidate.source.professionalTaskId,
            sourceTaskLabel: candidate.source.professionalTaskName,
            sourceResultVersion: candidate.source.resultVersion,
            sourceBomDraftVersionId: candidate.source.bomDraftVersionId,
            confirmedBy: candidate.source.confirmedBy,
            confirmedAt: candidate.source.confirmedAt,
            recommended: candidate.recommended,
          })),
      }))
    : []

  const lanes: EngineeringLaneModel[] = ENGINEERING_LANES.map((lane) => {
    const tasks = lane.taskTypes
      .map((taskType) => {
        const task = record.tasks.find((item) => item.taskType === taskType)
        if (!task) return null
        const definition = definitions.get(taskType)
        if (!definition) return null
        const dependsOnLabels = task.dependsOnTaskIds
          .map((dependencyId) => taskById.get(dependencyId)?.taskName ?? '')
          .filter(Boolean)
        const requiredByLabels = record.tasks
          .filter((item) => item.dependsOnTaskIds.includes(task.taskId))
          .map((item) => item.taskName)
        const requiredByTaskIds = record.tasks
          .filter((item) => item.dependsOnTaskIds.includes(task.taskId))
          .map((item) => item.taskId)
        return {
          taskId: task.taskId,
          taskType: task.taskType,
          taskName: task.taskName,
          ownerTeamName: task.ownerTeamName,
          status: task.status,
          currentNodeName: deriveCurrentNodeName(task, definition),
          plannedTimeText: record.publishedAt
            ? `计划 ${formatPlanDate(record.publishedAt, PLAN_OFFSET_DAYS[taskType])}`
            : '—',
          actualTimeText: task.effectiveCompletedAt
            ? `实际完成 ${task.effectiveCompletedAt}`
            : task.startedAt
              ? `开始 ${task.startedAt}`
              : '未开始',
          riskText: deriveRiskText(task, dependsOnLabels, definition),
          dependsOnLabels,
          dependsOnTaskIds: [...task.dependsOnTaskIds],
          requiredByLabels,
          requiredByTaskIds,
          reviewRequired: definition.reviewRequired,
        } satisfies EngineeringTaskCardModel
      })
      .filter((task): task is EngineeringTaskCardModel => task !== null)
    return { laneKey: lane.laneKey, laneName: lane.laneName, tasks }
  })

  return {
    masterOrderId: record.masterOrderId,
    masterOrderCode: record.masterOrderCode,
    styleCode: record.styleCode,
    styleName: record.styleName,
    styleImageUrl: style?.mainImageUrl || style?.galleryImageUrls[0] || '',
    status: record.status,
    merchandiserName: record.merchandiserName,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    publishedAt: record.publishedAt,
    preparationType: effectivePreparationType,
    lanes,
    priorResultReuseLines: record.priorResultReuseLines.map((line) => ({ ...line })),
    priorResultCandidateGroups,
    taskPlanSuggestions: buildTaskPlanSuggestions(record, style, effectivePreparationType),
  }
}
