import { getCutPieceDispatchReadinessForTask, requiresCutPieceReleaseForProcessCodes } from './cut-piece-release.ts'
import { listEffectiveTaskAssignments, type EffectiveTaskAssignment } from './effective-task-assignments.ts'
import {
  getFactoryActivePpicSnapshot,
  listSewingFactoriesWithoutActivePpic,
  listSewingFactoryMasterRecords,
} from './factory-master-store.ts'
import { PPIC_TEAM_LEADER_LINGYUN } from './factory-onboarding-ppic.ts'
import { getRuntimeTaskById, listRuntimeProcessTasks } from './runtime-process-tasks.ts'
import { getCurrentSewingTaskResponsibility } from './sewing-outsourcing-responsibility.ts'
import { listSewingOutsourcingWorkbenchRows } from './sewing-outsourcing-workbench.ts'

export type SewingMigrationAuditCategory =
  | 'FACTORY_PPIC_IDENTITY'
  | 'TASK_RESPONSIBILITY'
  | 'RELEASE_ALLOCATION'
  | 'HISTORICAL_LINKAGE'
  | 'LEGACY_MULTI_FACTORY'
  | 'PCS_SAMPLE_NAMING'

export type SewingMigrationAuditStatus = 'PASS' | 'BLOCKED' | 'MANUAL_REVIEW' | 'READ_ONLY'

export interface SewingMigrationAuditItem {
  auditId: string
  category: SewingMigrationAuditCategory
  categoryLabel: string
  status: SewingMigrationAuditStatus
  subjectType: string
  subjectId: string
  subjectLabel: string
  quantityValue: number | null
  quantityUnit: string
  detail: string
  recoveryAction: string
  sourceHref: string
}

export interface SewingMigrationAuditReport {
  reportVersion: 'PPIC-MIGRATION-AUDIT-V1'
  generatedAt: string
  isReadOnly: true
  factoryCount: number
  effectiveAssignmentCount: number
  quantityBefore: number
  quantityAfter: number
  quantityUnit: '件（仅有效分配数量，不跨单位合计）'
  items: SewingMigrationAuditItem[]
  statusCounts: Record<SewingMigrationAuditStatus, number>
}

export const SEWING_MIGRATION_AUDIT_STATUS_LABEL: Record<SewingMigrationAuditStatus, string> = {
  PASS: '校验通过',
  BLOCKED: '阻断新写入',
  MANUAL_REVIEW: '待人工确认',
  READ_ONLY: '历史只读保留',
}

const CATEGORY_LABEL: Record<SewingMigrationAuditCategory, string> = {
  FACTORY_PPIC_IDENTITY: '工厂PPIC映射',
  TASK_RESPONSIBILITY: '任务责任版本',
  RELEASE_ALLOCATION: '放行与分配占用',
  HISTORICAL_LINKAGE: '历史事实关联',
  LEGACY_MULTI_FACTORY: '旧多厂来源任务',
  PCS_SAMPLE_NAMING: 'PCS样衣命名',
}

function item(input: Omit<SewingMigrationAuditItem, 'categoryLabel'>): SewingMigrationAuditItem {
  return { ...input, categoryLabel: CATEGORY_LABEL[input.category] }
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function listReleaseAuditItems(assignments: EffectiveTaskAssignment[]): SewingMigrationAuditItem[] {
  const byOrder = new Map<string, EffectiveTaskAssignment[]>()
  assignments
    .filter((assignment) => requiresCutPieceReleaseForProcessCodes(assignment.processCodes))
    .forEach((assignment) => {
      const rows = byOrder.get(assignment.productionOrderId) || []
      rows.push(assignment)
      byOrder.set(assignment.productionOrderId, rows)
    })

  const issues: SewingMigrationAuditItem[] = []
  for (const [productionOrderId, orderAssignments] of byOrder) {
    const uniqueLines = new Map<string, { skuCode: string; color: string; size: string; qty: number }>()
    orderAssignments.flatMap((assignment) => assignment.skuLines).forEach((line) => {
      const key = `${normalize(line.skuCode)}::${normalize(line.color)}::${normalize(line.size)}`
      if (!uniqueLines.has(key)) uniqueLines.set(key, { ...line, qty: 0 })
    })
    const readiness = getCutPieceDispatchReadinessForTask({
      productionOrderId,
      productionOrderNo: orderAssignments[0]?.productionOrderNo,
      skuLines: [...uniqueLines.values()],
    })
    if (!readiness.hasRecord) {
      const allocatedQty = orderAssignments.reduce((sum, assignment) => sum + assignment.assignedQty, 0)
      issues.push(item({
        auditId: `RELEASE-MISSING::${productionOrderId}`,
        category: 'RELEASE_ALLOCATION',
        status: 'MANUAL_REVIEW',
        subjectType: '生产单',
        subjectId: productionOrderId,
        subjectLabel: orderAssignments[0]?.productionOrderNo || productionOrderId,
        quantityValue: allocatedQty,
        quantityUnit: '件有效分配',
        detail: `历史有效分配${allocatedQty}件，但无法读取对应裁片放行版本；系统没有补造放行记录。`,
        recoveryAction: '由裁床与PPIC核对原放行依据，人工建立关联版本；确认前阻断再次分配。',
        sourceHref: '/fcs/craft/cutting/cut-piece-release',
      }))
      continue
    }
    readiness.lines
      .filter((line) => line.releaseConfirmQty !== null && line.allocatedQty > line.releaseConfirmQty)
      .forEach((line) => issues.push(item({
        auditId: `RELEASE-OVER::${productionOrderId}::${line.skuCode}`,
        category: 'RELEASE_ALLOCATION',
        status: 'BLOCKED',
        subjectType: '生产单SKU',
        subjectId: `${productionOrderId}::${line.skuCode}`,
        subjectLabel: `${readiness.productionOrderNo} · ${line.color}/${line.size}`,
        quantityValue: line.allocatedQty - (line.releaseConfirmQty || 0),
        quantityUnit: '件超放行占用',
        detail: `历史有效分配${line.allocatedQty}件，当前有效放行${line.releaseConfirmQty}件，超出${line.allocatedQty - (line.releaseConfirmQty || 0)}件；原分配和原放行均未被改写。`,
        recoveryAction: '由PPIC和裁床核实原始依据；先处理历史差异，再允许新增分配或调低放行。',
        sourceHref: '/fcs/craft/cutting/cut-piece-release',
      })))
  }
  if (issues.length) return issues
  return [item({
    auditId: 'RELEASE-ALLOCATION-PASS',
    category: 'RELEASE_ALLOCATION',
    status: 'PASS',
    subjectType: '控制项',
    subjectId: 'RELEASE-ALLOCATION',
    subjectLabel: '当前可核对放行占用',
    quantityValue: byOrder.size,
    quantityUnit: '个生产单',
    detail: '当前可匹配放行版本的有效车缝分配未发现“已分配大于放行”的静默改写。',
    recoveryAction: '继续执行放行硬门禁；调低放行不得低于已分配数量。',
    sourceHref: '/fcs/craft/cutting/cut-piece-release',
  })]
}

export function buildSewingOutsourcingMigrationAuditReport(): SewingMigrationAuditReport {
  // 先建立与实际PPIC页面一致的只读投影，确保审计的是同一组演示事实；后续重复执行不新增业务版本。
  const workbenchRows = listSewingOutsourcingWorkbenchRows({
    viewerPpicId: PPIC_TEAM_LEADER_LINGYUN.ppicId,
    leaderView: true,
  })
  const factories = listSewingFactoryMasterRecords()
  const factoriesById = new Map(factories.map((factory) => [factory.id, factory]))
  const missingFactoryPpics = listSewingFactoriesWithoutActivePpic()
  const assignments = listEffectiveTaskAssignments().filter((assignment) => assignment.status === 'EFFECTIVE')
  const quantityBefore = assignments.reduce((sum, assignment) => sum + assignment.assignedQty, 0)
  const items: SewingMigrationAuditItem[] = []

  if (missingFactoryPpics.length) {
    missingFactoryPpics.forEach((factory) => items.push(item({
      auditId: `FACTORY-PPIC::${factory.id}`,
      category: 'FACTORY_PPIC_IDENTITY',
      status: 'BLOCKED',
      subjectType: '三方车缝工厂',
      subjectId: factory.id,
      subjectLabel: factory.name,
      quantityValue: null,
      quantityUnit: '',
      detail: '工厂缺少唯一有效PPIC，或人员已停用／ID姓名不一致。',
      recoveryAction: '必须先在工厂档案补齐一名启用中的PPIC；修复前阻断新任务分配。',
      sourceHref: '/fcs/factories/profile',
    })))
  } else {
    items.push(item({
      auditId: 'FACTORY-PPIC-PASS',
      category: 'FACTORY_PPIC_IDENTITY',
      status: 'PASS',
      subjectType: '控制项',
      subjectId: 'ALL-SEWING-FACTORIES',
      subjectLabel: `${factories.length}家车缝工厂`,
      quantityValue: factories.length,
      quantityUnit: '家',
      detail: '当前原型中的正式车缝工厂均可解析到一名启用中的PPIC。',
      recoveryAction: '新增或导入工厂时继续执行必填、启用状态和ID姓名一致性校验。',
      sourceHref: '/fcs/factories/profile',
    }))
  }

  const taskIssues = assignments.flatMap((assignment) => {
    const runtimeTask = getRuntimeTaskById(assignment.runtimeTaskId)
    const responsibility = getCurrentSewingTaskResponsibility(assignment.runtimeTaskId)
    const factory = factoriesById.get(assignment.factoryId)
    const activeFactoryPpic = factory ? getFactoryActivePpicSnapshot(factory.id) : null
    const issues: SewingMigrationAuditItem[] = []
    if (!factory || !runtimeTask || !responsibility || !assignment.ppicId || !assignment.ppicName) {
      issues.push(item({
        auditId: `TASK-IDENTITY::${assignment.assignmentId}`,
        category: 'TASK_RESPONSIBILITY',
        status: 'MANUAL_REVIEW',
        subjectType: '有效分配',
        subjectId: assignment.assignmentId,
        subjectLabel: assignment.taskNo || assignment.runtimeTaskId,
        quantityValue: assignment.assignedQty,
        quantityUnit: '件',
        detail: `历史身份不完整：${!factory ? '工厂未知；' : ''}${!runtimeTask ? '执行任务未匹配；' : ''}${!responsibility ? '任务责任版本缺失；' : ''}${!assignment.ppicId || !assignment.ppicName ? '分配PPIC快照缺失；' : ''}`,
        recoveryAction: '由凌云或指定负责人核对原工厂、执行任务和原PPIC，建立显式责任／关联版本；不得按工厂当前PPIC自动回填。',
        sourceHref: '/fcs/sewing-outsourcing/responsibility-transfers',
      }))
    } else if (activeFactoryPpic && responsibility.ppicId !== activeFactoryPpic.ppicId) {
      issues.push(item({
        auditId: `TASK-PPIC-HISTORY::${assignment.assignmentId}`,
        category: 'TASK_RESPONSIBILITY',
        status: 'READ_ONLY',
        subjectType: '有效分配',
        subjectId: assignment.assignmentId,
        subjectLabel: assignment.taskNo || assignment.runtimeTaskId,
        quantityValue: assignment.assignedQty,
        quantityUnit: '件',
        detail: `任务当前责任为${responsibility.ppicName}，工厂档案当前PPIC为${activeFactoryPpic.ppicName}；历史任务责任保持原版本。`,
        recoveryAction: '若未完事项确需换人，只允许凌云在责任移交页建立新版本。',
        sourceHref: '/fcs/sewing-outsourcing/responsibility-transfers',
      }))
    }
    return issues
  })
  items.push(...taskIssues)
  if (!taskIssues.length) items.push(item({
    auditId: 'TASK-RESPONSIBILITY-PASS',
    category: 'TASK_RESPONSIBILITY',
    status: 'PASS',
    subjectType: '控制项',
    subjectId: 'ACTIVE-ASSIGNMENTS',
    subjectLabel: `${assignments.length}条有效分配`,
    quantityValue: assignments.length,
    quantityUnit: '条',
    detail: '当前有效分配均有执行任务、工厂、分配PPIC快照和任务责任版本。',
    recoveryAction: '工厂档案换人只影响未来新分配；未完任务仍须负责人显式移交。',
    sourceHref: '/fcs/sewing-outsourcing/responsibility-transfers',
  }))

  items.push(...listReleaseAuditItems(assignments))

  const incompleteRows = workbenchRows.filter((row) => row.health === 'DATA_INCOMPLETE')
  incompleteRows.forEach((row) => items.push(item({
    auditId: `HISTORICAL-LINKAGE::${row.rowId}`,
    category: 'HISTORICAL_LINKAGE',
    status: 'MANUAL_REVIEW',
    subjectType: '历史业务事实',
    subjectId: row.rowId,
    subjectLabel: `${row.taskNo} · ${row.factoryName}`,
    quantityValue: null,
    quantityUnit: '',
    detail: row.healthReasons.join('；') || row.recentResult,
    recoveryAction: `${row.nextAction}；确认后新增关联版本，原历史记录不覆盖、不删除。`,
    sourceHref: row.sourceLinks[0]?.href || '/fcs/sewing-outsourcing/tasks',
  })))
  if (!incompleteRows.length) items.push(item({
    auditId: 'HISTORICAL-LINKAGE-PASS', category: 'HISTORICAL_LINKAGE', status: 'PASS', subjectType: '控制项', subjectId: 'HISTORICAL-LINKAGE', subjectLabel: '历史业务事实关联', quantityValue: 0, quantityUnit: '项未匹配', detail: '当前未发现无法唯一匹配执行任务的历史业务事实。', recoveryAction: '后续导入继续按执行任务、工厂和业务单号三方核对。', sourceHref: '/fcs/sewing-outsourcing/tasks',
  }))

  const legacySplitSources = listRuntimeProcessTasks().filter((task) => (
    task.isSplitSource
    && (normalize(task.processCode).includes('sew') || task.processNameZh.includes('车缝'))
  ))
  legacySplitSources.forEach((task) => items.push(item({
    auditId: `LEGACY-SPLIT-SOURCE::${task.taskId}`,
    category: 'LEGACY_MULTI_FACTORY',
    status: 'READ_ONLY',
    subjectType: '多厂拆分来源任务',
    subjectId: task.taskId,
    subjectLabel: task.taskNo || task.taskId,
    quantityValue: task.scopeQty,
    quantityUnit: '件来源范围',
    detail: '来源任务只保留聚合追溯，不能再交出、回货、结算或再次拆分。实际业务落在一厂一张的分厂执行任务。',
    recoveryAction: '保持只读；新分配只允许独立车缝按完整SKU拆分，组合任务必须整单一厂。',
    sourceHref: '/fcs/sewing-outsourcing/tasks',
  })))
  if (!legacySplitSources.length) items.push(item({
    auditId: 'LEGACY-SPLIT-SOURCE-PASS', category: 'LEGACY_MULTI_FACTORY', status: 'PASS', subjectType: '控制项', subjectId: 'LEGACY-SPLIT-SOURCES', subjectLabel: '旧多厂来源任务', quantityValue: 0, quantityUnit: '条', detail: '当前未发现需要只读保留的车缝多厂来源任务。', recoveryAction: '继续执行独立车缝完整SKU拆分和组合任务整单一厂规则。', sourceHref: '/fcs/sewing-outsourcing/tasks',
  }))

  items.push(item({
    auditId: 'PCS-SAMPLE-NAMING-COMPATIBILITY',
    category: 'PCS_SAMPLE_NAMING',
    status: 'READ_ONLY',
    subjectType: '历史兼容编码',
    subjectId: 'PRE_PRODUCTION_SAMPLE',
    subjectLabel: 'PCS历史样衣编码',
    quantityValue: null,
    quantityUnit: '',
    detail: '内部旧编码只用于兼容历史读取；PCS用户可见名称为“首单样衣”。三方车缝工厂制作的实物才是“产前版样衣”，核查业务动作叫“批版建议”。',
    recoveryAction: '不把历史泛化“首件确认”自动迁成批版建议；新记录分别使用产前版样衣身份和批版建议业务记录。',
    sourceHref: '/pcs/samples/first-sample',
  }))

  const statusCounts: Record<SewingMigrationAuditStatus, number> = { PASS: 0, BLOCKED: 0, MANUAL_REVIEW: 0, READ_ONLY: 0 }
  items.forEach((auditItem) => { statusCounts[auditItem.status] += 1 })
  const quantityAfter = assignments.reduce((sum, assignment) => sum + assignment.assignedQty, 0)
  return {
    reportVersion: 'PPIC-MIGRATION-AUDIT-V1',
    generatedAt: '2026-09-01 12:00:00',
    isReadOnly: true,
    factoryCount: factories.length,
    effectiveAssignmentCount: assignments.length,
    quantityBefore,
    quantityAfter,
    quantityUnit: '件（仅有效分配数量，不跨单位合计）',
    items: structuredClone(items),
    statusCounts,
  }
}
