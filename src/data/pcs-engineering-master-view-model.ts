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
  saveEngineeringMasterBomVersion,
  confirmEngineeringMasterBomVersion,
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
  confirmEngineeringBomPricingPlan,
  getEngineeringBomPricingPlan,
  getEngineeringBomVersionById,
  listEngineeringBomVersionsByOwner,
  markEngineeringBomVersionsPublished,
} from './pcs-engineering-bom-repository.ts'
import {
  listTechnicalDataVersionsByStyleId,
  updateTechnicalDataVersionRecord,
} from './pcs-technical-data-version-repository.ts'
import {
  confirmEngineeringChangeWork,
  createEngineeringChangeWorkspace,
  listEngineeringChangeModificationOptions,
  listEngineeringChangeWorkspaceViews,
  startEngineeringChangeTaskLine,
} from './pcs-engineering-change-workspace.ts'
import { CURRENT_PCS_ENGINEERING_USER } from './pcs-engineering-current-user.ts'
import { getEngineeringTeamCurrentOperator } from './pcs-engineering-team-directory.ts'
import { buildEngineeringBomTaskRows } from './pcs-engineering-bom-repository.ts'

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
  { phaseKey: 'sample-size', phaseName: '产前版样衣与齐码', taskTypes: ['PRE_PRODUCTION_SAMPLE', 'SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'] },
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
    ensureEngineeringDemoBomVersions(published, bomConditions)
    ensureEngineeringDemoTaskMaterials([published])
    seedEngineeringMasterScenario(published.masterOrderId, scenarioNo)
  }
  ensureEngineeringLifecycleDemoData()
}

function ensureEngineeringDemoBomVersions(
  master: EngineeringMasterOrderRecord,
  conditions: EngineeringBomTaskConditions,
): void {
  const versions = listEngineeringBomVersionsByOwner('ENGINEERING_MASTER', master.masterOrderId)
  versions.forEach((version, versionIndex) => {
    if (version.versionStatus !== 'DRAFT') return
    const base = {
      usage: 1,
      sampleQuantity: 1,
      lossRate: 0,
      applicableSkuIds: [...version.applicableSkuIds],
      printRequirement: '否' as const,
      dyeRequirement: '否' as const,
      purchaseRequirement: '否' as const,
      waterSolubleRequirementText: '无',
      printSide: '无' as const,
      linkedPatternResultIds: [],
    }
    const materialLines = [{
      ...base,
      bomItemId: `${version.bomDraftVersionId}-BASE`,
      materialSkuId: 'material_fabric_001_sku_001',
      materialType: '面料',
      usageUnit: 'Yard',
      printRequirement: conditions.hasPrintRequirement ? '是' as const : '否' as const,
      printRequirementText: conditions.hasPrintRequirement ? '数码印花' : '',
    }]
    if (conditions.hasFabricDyeRequirement) materialLines.push({
      ...base,
      bomItemId: `${version.bomDraftVersionId}-DYE-FABRIC`,
      materialSkuId: 'material_fabric_002_sku_001',
      materialType: '面料',
      usageUnit: '米',
      dyeRequirement: '是',
      dyeRequirementText: '按潘通色号调色',
      printRequirementText: '',
    })
    if (conditions.hasYarnDyeRequirement) materialLines.push({
      ...base,
      bomItemId: `${version.bomDraftVersionId}-DYE-YARN`,
      materialSkuId: 'material_yarn_001_sku_001',
      materialType: '纱线',
      usageUnit: '卷',
      dyeRequirement: '是',
      dyeRequirementText: '按潘通色号调色',
      printRequirementText: '',
    })
    if (conditions.hasAccessoryPurchaseRequirement) materialLines.push({
      ...base,
      bomItemId: `${version.bomDraftVersionId}-PURCHASE`,
      materialSkuId: 'material_accessory_001_sku_001',
      materialType: '辅料',
      usageUnit: 'PCS',
      purchaseRequirement: '是',
      printRequirementText: '',
    })
    saveEngineeringMasterBomVersion({
      versionId: version.bomDraftVersionId,
      role: '买手',
      userId: 'BUYER-DEMO',
      userName: '买手-阿乐',
      materialLines,
      customCosts: versionIndex === 0 ? [{ title: '车位费', amountIdr: 25000, note: '演示自定义费用' }] : [],
    })
  })
  const firstVersion = versions[0]
  if (firstVersion && getEngineeringBomVersionById(firstVersion.bomDraftVersionId)?.versionStatus === 'DRAFT') {
    confirmEngineeringMasterBomVersion({
      versionId: firstVersion.bomDraftVersionId,
      role: '买手',
      userId: 'BUYER-DEMO',
      userName: '买手-阿乐',
    })
  }
}

function ensureEngineeringDemoTaskMaterials(records: EngineeringMasterOrderRecord[]): void {
  for (const master of records) {
    if (!master.bulkProductionQualification.triggerBusinessObjectId.startsWith('BULK-DEMO-')) continue
    if (!['已发布', '进行中'].includes(master.status)) continue
    if (getEngineeringBomPricingPlan('ENGINEERING_MASTER', master.masterOrderId)?.status !== 'COMPLETED_CONFIRMED') continue
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
    const completedOperators = ['周师傅', 'Ayu', 'Lina', '陈敏', 'Rudi', '王丽', '林晓']
    task.assigneeId = `PCS-DEMO-OPERATOR-${offset + 1}`
    task.assigneeName = completedOperators[offset % completedOperators.length] || '周师傅'
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
      const activeOperators: Record<string, { id: string; name: string }> = {
        版师: { id: 'PCS-PATTERN-MAKER-ZHOU', name: '周师傅' },
        毛织团队: { id: 'PCS-KNIT-MAKER-AYU', name: 'Ayu' },
        制作团队: { id: 'PCS-SAMPLE-MAKER-LINA', name: 'Lina' },
        花型团队: { id: 'PCS-ARTWORK-MAKER-CHEN', name: '陈敏' },
        染厂: { id: 'PCS-DYE-FACTORY-RUDI', name: 'Rudi' },
        采购人员: { id: 'PCS-BUYER-PURCHASER-WANG', name: '王丽' },
        跟单: { id: 'PCS-MERCHANDISER-LIN', name: '林晓' },
      }
      const activeOperator = activeOperators[stored.ownerTeamName]
      stored.assigneeId = activeOperator?.id || ''
      stored.assigneeName = activeOperator?.name || ''
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
    const pricingPlan = getEngineeringBomPricingPlan('TECH_PACK_DRAFT', currentVersion.technicalVersionId)
    if (pricingPlan?.status === 'DRAFT') {
      confirmEngineeringBomPricingPlan({
        ownerStage: 'TECH_PACK_DRAFT',
        ownerId: currentVersion.technicalVersionId,
        role: '买手',
        userId: pricingPlan.buyerId || 'U-BUYER-DEMO',
        userName: pricingPlan.buyerName || '买手-阿乐',
        confirmedAt: '2026-08-04 17:20:00',
      })
    }
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
    const technicalBomVersions = listEngineeringBomVersionsByOwner('TECH_PACK_DRAFT', currentVersion.technicalVersionId)
    if (technicalBomVersions.length > 0 && technicalBomVersions.every((version) => version.versionStatus === 'COMPLETED_CONFIRMED')) {
      markEngineeringBomVersionsPublished({
        ownerStage: 'TECH_PACK_DRAFT',
        ownerId: currentVersion.technicalVersionId,
        publishedSnapshotId: currentVersion.technicalVersionId,
        publishedBy: closedMaster.merchandiserName,
        publishedAt: '2026-08-04 17:30:00',
      })
    }
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
  const modificationOptions = listEngineeringChangeModificationOptions(closedMaster.masterOrderId)
  if (modificationOptions.length === 0) return
  const preferredKinds = new Set(['BOM_ITEM', 'BASE_PATTERN', 'SIZE_PATTERN', 'PRE_PRODUCTION_SAMPLE', 'PATTERN_ARTWORK'])
  const preferredOptions = modificationOptions.filter((item) => preferredKinds.has(item.itemKind))
  const selectedOptions = [
    preferredOptions.find((item) => item.treatment !== 'PROFESSIONAL_TASK'),
    preferredOptions.find((item) => item.treatment === 'PROFESSIONAL_TASK'),
  ].filter((item): item is (typeof modificationOptions)[number] => Boolean(item))
  const changeView = createEngineeringChangeWorkspace({
    sourceMasterOrderId: closedMaster.masterOrderId,
    changeReason: '直播反馈领口版型需要调整，同时更新齐码纸样。',
    modificationOptionIds: (selectedOptions.length > 0 ? selectedOptions : modificationOptions.slice(0, 2)).map((item) => item.optionId),
    actor: CURRENT_PCS_ENGINEERING_USER,
  })
  const confirmedWorkspace = confirmEngineeringChangeWork(changeView.change.engineeringChangeTaskId, CURRENT_PCS_ENGINEERING_USER)
  const firstLine = confirmedWorkspace.taskLines[0]
  if (firstLine) {
    startEngineeringChangeTaskLine(
      changeView.change.engineeringChangeTaskId,
      firstLine.lineId,
      getEngineeringTeamCurrentOperator(firstLine.currentTeamName),
    )
  }
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
  currentTeamName: string
  currentActionText: string
  completionDestinationText: string
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
  bomSummary: {
    pricingPlanId: string
    planStatus: 'DRAFT' | 'HANDED_OFF' | 'COMPLETED_CONFIRMED' | 'PUBLISHED_SNAPSHOT' | ''
    versionIds: string[]
    versionCodes: string[]
    colorCount: number
    materialLineCount: number
    sourceVersionCount: number
    customCostCount: number
    customCostDecisionText: string
    statusText: string
    buyerId: string
    buyerName: string
    updatedAt: string
    conditions: EngineeringBomTaskConditions
  }
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
  const pricingPlan = getEngineeringBomPricingPlan('ENGINEERING_MASTER', record.masterOrderId)
  const bomRows = pricingPlan?.status === 'COMPLETED_CONFIRMED'
    ? buildEngineeringBomTaskRows(listEngineeringBomVersionsByOwner('ENGINEERING_MASTER', record.masterOrderId))
    : []
  const conditions: EngineeringBomTaskConditions = {
    hasPrintRequirement: bomRows.some((line) => line.printRequirement === '是'),
    hasYarnDyeRequirement: bomRows.some((line) => line.dyeRequirement === '是' && line.materialType === '纱线'),
    hasFabricDyeRequirement: bomRows.some((line) => line.dyeRequirement === '是' && line.materialType === '面料'),
    hasAccessoryPurchaseRequirement: bomRows.some((line) => line.purchaseRequirement === '是'),
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

function deriveCurrentTeamName(task: EngineeringTaskRecord): string {
  if (task.status === '未启用' || task.status === '待前置' || task.status === '已完成' || task.status === '因需求变更结束') {
    return '—'
  }
  if (task.taskType === 'PATTERN_ARTWORK' && task.status === '待审核') return '买手'
  if (task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') {
    if (!task.colorRequirementConfirmedAt) return '跟单'
    if (task.status === '待审核') return '买手'
    return '染厂'
  }
  return task.ownerTeamName
}

function taskWorkVerb(taskType: EngineeringTaskType): string {
  if (taskType === 'BASE_PATTERN_WOVEN' || taskType === 'BASE_PATTERN_KNIT') return '制作并上传基码纸样'
  if (taskType === 'PRE_PRODUCTION_SAMPLE') return '制作并上传产前版样衣'
  if (taskType === 'SIZE_PATTERN_WOVEN' || taskType === 'SIZE_PATTERN_KNIT') return '制作并上传齐码纸样'
  if (taskType === 'PATTERN_ARTWORK') return '制作并上传花型成果'
  if (taskType === 'COLOR_YARN' || taskType === 'COLOR_FABRIC') return '制作并上传调色成果'
  if (taskType === 'ACCESSORY_PURCHASE') return '绑定采购系统中的采购单'
  return '汇总专业成果并生成待审核技术包'
}

function deriveCurrentActionText(task: EngineeringTaskRecord, dependsOnLabels: string[]): string {
  if (task.status === '未启用') return '本次不需要处理'
  if (task.status === '因需求变更结束') return '本轮工作已结束'
  if (task.status === '已完成') return '本轮工作已完成'
  if (task.status === '待前置') {
    return dependsOnLabels.length > 0
      ? `等待${dependsOnLabels.join('、')}完成`
      : '等待前项工作完成'
  }
  if ((task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && !task.colorRequirementConfirmedAt) {
    return '填写颜色名称、潘通色号和染色说明'
  }
  if ((task.taskType === 'PATTERN_ARTWORK' || task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && task.status === '待审核') {
    return task.taskType === 'PATTERN_ARTWORK' ? '审核花型成果' : '审核调色成果'
  }
  if (task.status === '返工中') return `按退回意见重新${taskWorkVerb(task.taskType).replace(/^制作并/, '')}`
  return taskWorkVerb(task.taskType)
}

function deriveCompletionDestinationText(
  task: EngineeringTaskRecord,
  requiredByLabels: string[],
): string {
  if (task.status === '未启用' || task.status === '因需求变更结束') return '—'
  if (task.taskType === 'PATTERN_ARTWORK' || task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') {
    if (task.status !== '已完成') return '买手审核通过后进入技术包'
  }
  if (task.taskType === 'TECH_PACK_CONFIRMATION') return '进入技术包审核与发布'
  if (requiredByLabels.length > 0) {
    return `${task.status === '已完成' ? '已解锁' : '完成后解锁'}：${requiredByLabels.join('、')}`
  }
  return '汇入待审核技术包'
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
          currentTeamName: deriveCurrentTeamName(task),
          currentActionText: deriveCurrentActionText(task, dependsOnLabels),
          completionDestinationText: deriveCompletionDestinationText(task, requiredByLabels),
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

  const bomVersions = listEngineeringBomVersionsByOwner('ENGINEERING_MASTER', record.masterOrderId)
  const pricingPlan = getEngineeringBomPricingPlan('ENGINEERING_MASTER', record.masterOrderId)
  const bomRows = pricingPlan?.status === 'COMPLETED_CONFIRMED' ? buildEngineeringBomTaskRows(bomVersions) : []
  const bomConditions: EngineeringBomTaskConditions = {
    hasPrintRequirement: bomRows.some((line) => line.printRequirement === '是'),
    hasYarnDyeRequirement: bomRows.some((line) => line.dyeRequirement === '是' && line.materialType === '纱线'),
    hasFabricDyeRequirement: bomRows.some((line) => line.dyeRequirement === '是' && line.materialType === '面料'),
    hasAccessoryPurchaseRequirement: bomRows.some((line) => line.purchaseRequirement === '是'),
  }

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
    bomSummary: {
      pricingPlanId: pricingPlan?.pricingPlanId || '',
      planStatus: pricingPlan?.status || '',
      versionIds: bomVersions.map((item) => item.bomDraftVersionId),
      versionCodes: bomVersions.map((item) => item.versionCode),
      colorCount: bomVersions.length,
      materialLineCount: bomVersions.reduce((sum, item) => sum + item.materialLines.length, 0),
      sourceVersionCount: bomVersions.filter((item) => Boolean(item.sourceVersionId)).length,
      customCostCount: pricingPlan?.customCosts.length || 0,
      customCostDecisionText: pricingPlan?.customCostDecision === 'HAS_CUSTOM_COST'
        ? `${pricingPlan.customCosts.length} 项整款费用`
        : pricingPlan?.customCostDecision === 'NO_CUSTOM_COST' ? '本次无自定义费用' : '费用情况待买手确认',
      statusText: bomVersions.length === 0 || !pricingPlan
        ? '未建立'
        : pricingPlan.status === 'COMPLETED_CONFIRMED' ? '已完成且已确认' : '待买手确认',
      buyerId: pricingPlan?.buyerId || '',
      buyerName: pricingPlan?.buyerName || '待分配买手',
      updatedAt: pricingPlan?.updatedAt || record.createdAt,
      conditions: bomConditions,
    },
  }
}
