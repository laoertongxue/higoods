'use client'

import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react'
import { productionOrders, type ProductionOrder, type RiskFlag } from './production-orders'
import { processTasks, type ProcessTask, type TaskAuditLog, type BlockReason, type AcceptanceStatus } from './process-tasks'
import { applyQualitySeedBootstrap } from './store-domain-quality-bootstrap'

export type { BlockReason, AcceptanceStatus } from './process-tasks'
export type {
  AdjustmentStatus,
  AdjustmentType,
  StatementAdjustment,
  SettlementBatchStatus,
  ProductionChangeType,
  ProductionChangeStatus,
  ProductionOrderChange,
  SettlementBatchItem,
  SettlementBatch,
  StatementStatus,
  StatementDraftItem,
  StatementDraft,
} from './store-domain-settlement-types'
import { indonesiaFactories } from './indonesia-factories'
import { routingTemplates, type RoutingTemplate } from './routing-templates'
import {
  initialMaterialStatementDrafts,
  initialStatementDrafts,
  initialStatementAdjustments,
  initialSettlementBatches,
  initialProductionOrderChanges,
} from './store-domain-settlement-seeds'
import type {
  AdjustmentStatus,
  AdjustmentType,
  StatementAdjustment,
  SettlementBatchStatus,
  ProductionChangeType,
  ProductionChangeStatus,
  ProductionOrderChange,
  SettlementBatchItem,
  SettlementBatch,
  StatementStatus,
  StatementDraftItem,
  StatementDraft,
} from './store-domain-settlement-types'

// =============================================
// PDA / 权限域 — 从 store-domain-pda.ts 引入并 re-export，保持所有 consumer 导入兼容
// =============================================
export type {
  PermissionKey,
  FactoryRole,
  FactoryUser,
  PdaRoleId,
  FactoryPdaUser,
  PdaRoleTemplate,
  PermissionCatalogItem,
  FactoryPdaRoleAuditLog,
  FactoryPdaRole,
} from './store-domain-pda'
export {
  getPdaSession,
  setPdaSession,
  clearPdaSession,
  defaultFactoryRoles,
  generateFactoryUsers,
  initialFactoryUsers,
  initialFactoryRoles,
  pdaRoleTemplates,
  initialFactoryPdaUsers,
  permissionCatalog,
  generatePresetRolesForFactory,
  initialFactoryPdaRoles,
} from './store-domain-pda'
import {
  getPdaSession,
  initialFactoryUsers,
  initialFactoryRoles,
  initialFactoryPdaUsers,
  initialFactoryPdaRoles,
} from './store-domain-pda' // RBAC session helper

// =============================================
// 任务分配 / 执行准备域 — 已拆到独立文件
// =============================================
export type {
  TenderStatus,
  TenderOrderStatus,
  MaterialStatementStatus,
  MaterialStatementItem,
  MaterialStatementDraft,
  MaterialIssueStatus,
  MaterialIssueSheet,
  QcStandardStatus,
  QcStandardSheet,
  TenderOrder,
  TenderBid,
  Tender,
} from './store-domain-dispatch-process'
import {
  type TenderStatus,
  type TenderOrderStatus,
  type MaterialStatementStatus,
  type MaterialStatementItem,
  type MaterialStatementDraft,
  type MaterialIssueStatus,
  type MaterialIssueSheet,
  type QcStandardStatus,
  type QcStandardSheet,
  type TenderOrder,
  type TenderBid,
  type Tender,
  initialTenders,
  initialTenderOrders,
  initialMaterialIssueSheets,
  initialQcStandardSheets,
} from './store-domain-dispatch-process'

// =============================================
// ExceptionCase (异常单) 类型定义
// =============================================
// 进度域类型、生成器和 seed 数据 → 已拆到独立文件
// =============================================
export {
  type CaseStatus,
  type Severity,
  type ExceptionCategory,
  type ReasonCode,
  type ExceptionAction,
  type ExceptionAuditLog,
  type ExceptionCase,
  calculateSlaDue,
  generateCaseId,
  initialExceptions,
  type HandoverEventType,
  type HandoverStatus,
  type DiffReasonCode,
  type PartyKind,
  type HandoverParty,
  type HandoverEvidence,
  type HandoverAuditLog,
  type HandoverEvent,
  generateHandoverEventId,
  initialHandoverEvents,
  type InternalUser,
  mockInternalUsers,
  type NotificationLevel,
  type RecipientType,
  type TargetType,
  type NotificationDeepLink,
  type NotificationRelated,
  type Notification,
  generateNotificationId,
  initialNotifications,
  type UrgeType,
  type UrgeStatus,
  type UrgeAuditLog,
  type UrgeLog,
  generateUrgeId,
  initialUrges,
} from './store-domain-progress'
import type {
  CaseStatus,
  ExceptionCase,
  HandoverEvent,
  InternalUser,
  Notification,
  UrgeLog,
} from './store-domain-progress'
import {
  initialExceptions,
  initialHandoverEvents,
  mockInternalUsers,
  initialNotifications,
  initialUrges,
  calculateSlaDue,
  generateCaseId,
  generateHandoverEventId,
  generateNotificationId,
  generateUrgeId,
} from './store-domain-progress'

// =============================================
// 质量域 (Quality)
// =============================================
// 质量域类型与 helper — 已拆到独立文件，此处 re-export 保持旧导入兼容
// =============================================
export type {
  QcResult,
  LiabilityStatus,
  AllocationSnapshot,
  AllocationEvent,
  ReturnBatchQcStatus,
  ReturnBatch,
  DyePrintProcessType,
  DyePrintOrderStatus,
  DyePrintSettlementRelation,
  DyePrintReturnResult,
  DyePrintReturnBatch,
  DyePrintOrder,
  SettlementPartyType,
  DefectItem,
  QcAuditLog,
  QualityInspection,
  DeductionReasonCode,
  DeductionStatus,
  DeductionEvidenceRef,
  DeductionCandidate,
  DeductionBasisSourceType,
  DeductionBasisStatus,
  DeductionBasisReasonCode,
  DeductionBasisEvidenceRef,
  DeductionBasisAuditLog,
  DeductionBasisItem,
} from './store-domain-quality-types'
export {
  deriveDyePrintSettlementRelation,
  defaultResponsibility,
} from './store-domain-quality-types'
import type {
  QcResult,
  LiabilityStatus,
  AllocationSnapshot,
  AllocationEvent,
  ReturnBatchQcStatus,
  ReturnBatch,
  DyePrintProcessType,
  DyePrintOrderStatus,
  DyePrintSettlementRelation,
  DyePrintReturnResult,
  DyePrintReturnBatch,
  DyePrintOrder,
  SettlementPartyType,
  DefectItem,
  QcAuditLog,
  QualityInspection,
  DeductionReasonCode,
  DeductionStatus,
  DeductionEvidenceRef,
  DeductionCandidate,
  DeductionBasisSourceType,
  DeductionBasisStatus,
  DeductionBasisReasonCode,
  DeductionBasisEvidenceRef,
  DeductionBasisAuditLog,
  DeductionBasisItem,
} from './store-domain-quality-types'
import {
  deriveDyePrintSettlementRelation,
  defaultResponsibility,
} from './store-domain-quality-types'
import {
  initialQualityInspections,
  initialDeductionCandidates,
  initialDeductionBasisItems,
  initialAllocationByTaskId,
  initialAllocationEvents,
  initialReturnBatches,
  initialDyePrintOrders,
} from './store-domain-quality-seeds'

applyQualitySeedBootstrap()

interface FcsState {
  productionOrders: ProductionOrder[]
  processTasks: ProcessTask[]
  factories: IndonesiaFactory[]
  tenders: Tender[]
  tenderOrders: TenderOrder[]
  materialIssueSheets: MaterialIssueSheet[]
  qcStandardSheets: QcStandardSheet[]
  materialStatementDrafts: MaterialStatementDraft[]
  routingTemplates: RoutingTemplate[]
  exceptions: ExceptionCase[]
  handoverEvents: HandoverEvent[]
  notifications: Notification[]
  urges: UrgeLog[]
  qualityInspections: QualityInspection[]
  qcRecords: QualityInspection[]          // alias for qualityInspections (backward-compat)
  deductionCandidates: DeductionCandidate[]
  deductionBasisItems: DeductionBasisItem[]
  factoryUsers: FactoryUser[]
  factoryRoles: FactoryRole[]
  factoryPdaUsers: FactoryPdaUser[]
  factoryPdaRoles: FactoryPdaRole[]
  allocationByTaskId: Record<string, AllocationSnapshot>
  allocationEvents: AllocationEvent[]
  returnBatches: ReturnBatch[]
  dyePrintOrders: DyePrintOrder[]
  statementDrafts: StatementDraft[]
  statementAdjustments: StatementAdjustment[]
  settlementBatches: SettlementBatch[]
  productionOrderChanges: ProductionOrderChange[]
}

// =============================================
// Action 类型
// =============================================
// 任务风险标签类型
export type TaskRiskFlag =
  | 'TECH_PACK_NOT_RELEASED'
  | 'TENDER_OVERDUE'
  | 'TENDER_NEAR_DEADLINE'
  | 'DISPATCH_REJECTED'
  | 'FACTORY_BLACKLISTED'
  | 'TASK_OVERDUE'
  | 'HAS_BLOCKED_TASK'

type FcsAction =
  | { type: 'UPDATE_ORDER'; payload: ProductionOrder }
  | { type: 'UPDATE_ORDERS'; payload: ProductionOrder[] }
  | { type: 'UPDATE_TASK'; payload: ProcessTask }
  | { type: 'UPDATE_TASKS'; payload: ProcessTask[] }
  | { type: 'ADD_TASKS'; payload: ProcessTask[] }
  | { type: 'ADD_TENDER'; payload: Tender }
  | { type: 'UPDATE_TENDER'; payload: Tender }
  | { type: 'BATCH_DISPATCH'; payload: { taskIds: string[]; factoryId: string; factoryName: string } }
  | { type: 'BATCH_CREATE_TENDER'; payload: { taskIds: string[]; tender: Tender } }
  | { type: 'AWARD_TENDER'; payload: { tenderId: string; winnerFactoryId: string; winnerBidId: string } }
  | { type: 'ADD_TENDER_ORDER'; payload: TenderOrder }
  | { type: 'UPDATE_TENDER_ORDER'; payload: TenderOrder }
  | { type: 'ADD_MATERIAL_ISSUE_SHEET'; payload: MaterialIssueSheet }
  | { type: 'UPDATE_MATERIAL_ISSUE_SHEET'; payload: MaterialIssueSheet }
  | { type: 'ADD_QC_STANDARD_SHEET'; payload: QcStandardSheet }
  | { type: 'UPDATE_QC_STANDARD_SHEET'; payload: QcStandardSheet }
  | { type: 'ADD_MATERIAL_STATEMENT_DRAFT'; payload: MaterialStatementDraft }
  | { type: 'UPDATE_MATERIAL_STATEMENT_DRAFT'; payload: MaterialStatementDraft }
  | {
    type: 'UPDATE_TASK_STATUS'; payload: {
      taskId: string;
      newStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'CANCELLED';
      blockReason?: BlockReason;
      blockRemark?: string;
      by: string;
    }
  }
  // Exception actions
  | { type: 'ADD_EXCEPTION'; payload: ExceptionCase }
  | { type: 'UPDATE_EXCEPTION'; payload: ExceptionCase }
  | { type: 'SET_EXCEPTIONS'; payload: ExceptionCase[] }
  // Handover actions
  | { type: 'ADD_HANDOVER_EVENT'; payload: HandoverEvent }
  | { type: 'UPDATE_HANDOVER_EVENT'; payload: HandoverEvent }
  | { type: 'SET_HANDOVER_EVENTS'; payload: HandoverEvent[] }
  // Notification actions
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'UPDATE_NOTIFICATION'; payload: Notification }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  // Urge actions
  | { type: 'ADD_URGE'; payload: UrgeLog }
  | { type: 'UPDATE_URGE'; payload: UrgeLog }
  | { type: 'SET_URGES'; payload: UrgeLog[] }
  // PDA Task Accept/Reject actions
  | { type: 'ACCEPT_TASK'; payload: { taskId: string; by: string } }
  | { type: 'REJECT_TASK'; payload: { taskId: string; reason: string; by: string } }
  // PDA Exec actions
  | { type: 'START_TASK'; payload: { taskId: string; by: string } }
  | { type: 'FINISH_TASK'; payload: { taskId: string; by: string } }
  | { type: 'BLOCK_TASK'; payload: { taskId: string; reason: BlockReason; remark: string; by: string } }
  | { type: 'UNBLOCK_TASK'; payload: { taskId: string; remark: string; by: string } }
  | { type: 'SYNC_ALLOCATION_GATES'; payload: { updates: Array<{ taskId: string; action: 'BLOCK' | 'UNBLOCK'; noteZh: string; by: string }> } }
  // PDA Handover actions
  | { type: 'CONFIRM_HANDOVER'; payload: { eventId: string; by: string } }
  | { type: 'DISPUTE_HANDOVER'; payload: { eventId: string; qtyActual: number; diffReasonCode: DiffReasonCode; diffRemark: string; evidence: HandoverEvidence[]; by: string } }
  // Quality Inspection actions
  | { type: 'ADD_QC'; payload: QualityInspection }
  | { type: 'UPDATE_QC'; payload: QualityInspection }
  | { type: 'SUBMIT_QC'; payload: { qcId: string; generatedTaskIds: string[]; blockedTaskId?: string; by: string } }
  // Deduction Candidate actions
  | { type: 'ADD_DEDUCTION_CANDIDATE'; payload: DeductionCandidate }
  | { type: 'UPDATE_DEDUCTION_CANDIDATE'; payload: DeductionCandidate }
  // Rework auto-unblock actions
  | { type: 'UPDATE_TASK_AUDIT_LOG'; payload: { taskId: string; auditLog: { id: string; action: string; detail: string; at: string; by: string } } }
  | { type: 'UNBLOCK_TASK_BY_REWORK'; payload: { parentTaskId: string; reworkTaskId: string; newStatus: 'NOT_STARTED' | 'IN_PROGRESS'; by: string } }
  | { type: 'RESOLVE_EXCEPTION_BY_REWORK'; payload: { caseId: string; reworkTaskId: string; by: string } }
  // Deduction Basis Item actions
  | { type: 'ADD_DEDUCTION_BASIS_ITEM'; payload: DeductionBasisItem }
  | { type: 'UPDATE_DEDUCTION_BASIS_ITEM'; payload: DeductionBasisItem }
  // Allocation actions
  | { type: 'UPSERT_ALLOCATION_SNAPSHOT'; payload: AllocationSnapshot }
  | { type: 'ADD_ALLOCATION_EVENT'; payload: AllocationEvent }
  // ReturnBatch actions
  | { type: 'ADD_RETURN_BATCH'; payload: ReturnBatch }
  | { type: 'UPDATE_RETURN_BATCH'; payload: ReturnBatch }
  // DyePrintOrder actions
  | { type: 'ADD_DYE_PRINT_ORDER'; payload: DyePrintOrder }
  | { type: 'UPDATE_DYE_PRINT_ORDER'; payload: DyePrintOrder }
  | { type: 'ADD_DYE_PRINT_RETURN'; payload: { dpId: string; batch: DyePrintReturnBatch } }
  // Task dependency update (reuses UPDATE_TASK)
  | { type: 'UPDATE_TASK_DEPENDENCIES'; payload: { taskId: string; dependsOnTaskIds: string[] } }
  // FactoryPdaRole actions
  | { type: 'CREATE_FACTORY_PDA_ROLE'; payload: FactoryPdaRole }
  | { type: 'UPDATE_FACTORY_PDA_ROLE'; payload: FactoryPdaRole }
  // FactoryPdaUser actions
  | { type: 'CREATE_FACTORY_PDA_USER'; payload: FactoryPdaUser }
  | { type: 'UPDATE_FACTORY_PDA_USER'; payload: FactoryPdaUser }
  // StatementDraft actions
  | { type: 'ADD_STATEMENT_DRAFT'; payload: StatementDraft }
  | { type: 'UPDATE_STATEMENT_DRAFT'; payload: StatementDraft }
  // StatementAdjustment actions
  | { type: 'ADD_STATEMENT_ADJUSTMENT'; payload: StatementAdjustment }
  | { type: 'UPDATE_STATEMENT_ADJUSTMENT'; payload: StatementAdjustment }
  // SettlementBatch actions
  | { type: 'ADD_SETTLEMENT_BATCH'; payload: SettlementBatch }
  | { type: 'UPDATE_SETTLEMENT_BATCH'; payload: SettlementBatch }
  | { type: 'BATCH_UPDATE_STATEMENT_DRAFTS'; payload: StatementDraft[] }
  // ProductionOrderChange actions
  | { type: 'ADD_PRODUCTION_ORDER_CHANGE'; payload: ProductionOrderChange }
  | { type: 'UPDATE_PRODUCTION_ORDER_CHANGE'; payload: ProductionOrderChange }

// =============================================
// Reducer
// =============================================
function fcsReducer(state: FcsState, action: FcsAction): FcsState {
  switch (action.type) {
    case 'UPDATE_ORDER':
      return {
        ...state,
        productionOrders: state.productionOrders.map(o =>
          o.productionOrderId === action.payload.productionOrderId ? action.payload : o
        ),
      }
    case 'UPDATE_ORDERS':
      return {
        ...state,
        productionOrders: state.productionOrders.map(o => {
          const updated = action.payload.find(u => u.productionOrderId === o.productionOrderId)
          return updated || o
        }),
      }
    case 'UPDATE_TASK':
      return {
        ...state,
        processTasks: state.processTasks.map(t =>
          t.taskId === action.payload.taskId ? action.payload : t
        ),
      }
    case 'UPDATE_TASK_DEPENDENCIES': {
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      return {
        ...state,
        processTasks: state.processTasks.map(t => {
          if (t.taskId !== action.payload.taskId) return t
          return {
            ...t,
            dependsOnTaskIds: action.payload.dependsOnTaskIds,
            updatedAt: now,
            auditLogs: [...t.auditLogs, {
              id: `AL-DEP-${Date.now()}-${t.taskId}`,
              action: 'UPDATE_DEPENDENCIES',
              detail: `dependsOnTaskIds → [${action.payload.dependsOnTaskIds.join(', ')}]`,
              at: now,
              by: '系统',
            }],
          }
        }),
      }
    }
    case 'UPDATE_TASKS':
      return {
        ...state,
        processTasks: state.processTasks.map(t => {
          const updated = action.payload.find(u => u.taskId === t.taskId)
          return updated || t
        }),
      }
    case 'ADD_TASKS':
      return {
        ...state,
        processTasks: [...state.processTasks, ...action.payload],
      }
    case 'ADD_TENDER':
      return {
        ...state,
        tenders: [...state.tenders, action.payload],
      }
    case 'UPDATE_TENDER':
      return {
        ...state,
        tenders: state.tenders.map(t =>
          t.tenderId === action.payload.tenderId ? action.payload : t
        ),
      }
    case 'BATCH_DISPATCH': {
      const { taskIds, factoryId, factoryName } = action.payload
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

      // 更新任务
      const updatedTasks = state.processTasks.map(task => {
        if (taskIds.includes(task.taskId)) {
          const newLog: TaskAuditLog = {
            id: `AL-${Date.now()}-${task.taskId}`,
            action: 'DISPATCH',
            detail: `派单至工厂 ${factoryName} (${factoryId})`,
            at: now,
            by: 'Admin',
          }
          return {
            ...task,
            assignmentMode: 'DIRECT' as const,
            assignmentStatus: 'ASSIGNED' as const,
            assignedFactoryId: factoryId,
            updatedAt: now,
            auditLogs: [...task.auditLogs, newLog],
          }
        }
        return task
      })

      // 收集所有影响的生产单ID
      const affectedOrderIds = new Set(
        state.processTasks
          .filter(t => taskIds.includes(t.taskId))
          .map(t => t.productionOrderId)
      )

      // 更新生产单
      const updatedOrders = state.productionOrders.map(order => {
        if (affectedOrderIds.has(order.productionOrderId)) {
          const orderTasks = updatedTasks.filter(t => t.productionOrderId === order.productionOrderId)
          const unassigned = orderTasks.filter(t => t.assignmentStatus === 'UNASSIGNED').length
          const assigned = orderTasks.filter(t => t.assignmentStatus === 'ASSIGNED' || t.assignmentStatus === 'AWARDED').length
          const bidding = orderTasks.filter(t => t.assignmentStatus === 'BIDDING').length

          let newStatus = order.status
          if (order.status === 'WAIT_ASSIGNMENT') {
            newStatus = 'ASSIGNING'
          }
          if (unassigned === 0 && bidding === 0) {
            newStatus = 'EXECUTING'
          }

          return {
            ...order,
            status: newStatus,
            assignmentProgress: {
              ...order.assignmentProgress,
              status: unassigned === 0 && bidding === 0 ? 'DONE' as const : 'IN_PROGRESS' as const,
              directAssignedCount: assigned,
            },
            assignmentSummary: {
              ...order.assignmentSummary,
              unassignedCount: unassigned,
            },
            directDispatchSummary: {
              ...order.directDispatchSummary,
              assignedFactoryCount: new Set(orderTasks.filter(t => t.assignedFactoryId).map(t => t.assignedFactoryId)).size,
            },
            updatedAt: now,
          }
        }
        return order
      })

      return {
        ...state,
        processTasks: updatedTasks,
        productionOrders: updatedOrders,
      }
    }
    case 'BATCH_CREATE_TENDER': {
      const { taskIds, tender } = action.payload
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

      // 更新任务
      const updatedTasks = state.processTasks.map(task => {
        if (taskIds.includes(task.taskId)) {
          const newLog: TaskAuditLog = {
            id: `AL-${Date.now()}-${task.taskId}`,
            action: 'BIDDING_START',
            detail: `发起竞价 ${tender.tenderId}`,
            at: now,
            by: 'Admin',
          }
          return {
            ...task,
            assignmentMode: 'BIDDING' as const,
            assignmentStatus: 'BIDDING' as const,
            tenderId: tender.tenderId,
            updatedAt: now,
            auditLogs: [...task.auditLogs, newLog],
          }
        }
        return task
      })

      // 收集受影响的生产单ID
      const affectedOrderIds = new Set(
        state.processTasks
          .filter(t => taskIds.includes(t.taskId))
          .map(t => t.productionOrderId)
      )

      // 更新生产单
      const updatedOrders = state.productionOrders.map(order => {
        if (affectedOrderIds.has(order.productionOrderId)) {
          const orderTasks = updatedTasks.filter(t => t.productionOrderId === order.productionOrderId)
          const unassigned = orderTasks.filter(t => t.assignmentStatus === 'UNASSIGNED').length
          const biddingCount = orderTasks.filter(t => t.assignmentStatus === 'BIDDING').length

          let newStatus = order.status
          if (order.status === 'WAIT_ASSIGNMENT') {
            newStatus = 'ASSIGNING'
          }

          // 计算最近截止时间
          const orderTenderIds = orderTasks.filter(t => t.tenderId).map(t => t.tenderId)
          const orderTenders = [...state.tenders, tender].filter(t => orderTenderIds.includes(t.tenderId))
          const nearestDeadline = orderTenders
            .filter(t => t.status === 'OPEN')
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0]?.deadline

          return {
            ...order,
            status: newStatus,
            assignmentProgress: {
              ...order.assignmentProgress,
              status: 'IN_PROGRESS' as const,
              biddingLaunchedCount: order.assignmentProgress.biddingLaunchedCount + taskIds.filter(id => orderTasks.some(t => t.taskId === id)).length,
            },
            assignmentSummary: {
              ...order.assignmentSummary,
              biddingCount: biddingCount,
              unassignedCount: unassigned,
            },
            biddingSummary: {
              ...order.biddingSummary,
              activeTenderCount: orderTenders.filter(t => t.status === 'OPEN').length,
              nearestDeadline,
            },
            updatedAt: now,
          }
        }
        return order
      })

      return {
        ...state,
        processTasks: updatedTasks,
        productionOrders: updatedOrders,
        tenders: [...state.tenders, tender],
      }
    }
    case 'AWARD_TENDER': {
      const { tenderId, winnerFactoryId, winnerBidId } = action.payload
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      const tender = state.tenders.find(t => t.tenderId === tenderId)
      if (!tender) return state

      const winnerFactory = state.factories.find(f => f.id === winnerFactoryId)
      const winnerFactoryName = winnerFactory?.name || winnerFactoryId

      // 更新招标单
      const updatedTender: Tender = {
        ...tender,
        status: 'AWARDED',
        winnerFactoryId,
        winnerBidId,
        updatedAt: now,
        auditLogs: [
          ...tender.auditLogs,
          { id: `TAL-${Date.now()}`, action: 'AWARD', detail: `定标完成，中标工厂: ${winnerFactoryName}`, at: now, by: 'Admin' },
        ],
      }

      // 更新任务
      const updatedTasks = state.processTasks.map(task => {
        if (tender.taskIds.includes(task.taskId)) {
          const newLog: TaskAuditLog = {
            id: `AL-${Date.now()}-${task.taskId}`,
            action: 'BIDDING_AWARD',
            detail: `竞价中标，分配至 ${winnerFactoryName}`,
            at: now,
            by: 'Admin',
          }
          return {
            ...task,
            assignmentStatus: 'AWARDED' as const,
            assignedFactoryId: winnerFactoryId,
            updatedAt: now,
            auditLogs: [...task.auditLogs, newLog],
          }
        }
        return task
      })

      // 更新生产单
      const affectedOrderIds = new Set(tender.productionOrderIds)
      const updatedOrders = state.productionOrders.map(order => {
        if (affectedOrderIds.has(order.productionOrderId)) {
          const orderTasks = updatedTasks.filter(t => t.productionOrderId === order.productionOrderId)
          const unassigned = orderTasks.filter(t => t.assignmentStatus === 'UNASSIGNED').length
          const bidding = orderTasks.filter(t => t.assignmentStatus === 'BIDDING').length
          const awarded = orderTasks.filter(t => t.assignmentStatus === 'AWARDED').length
          const assigned = orderTasks.filter(t => t.assignmentStatus === 'ASSIGNED').length

          let newStatus = order.status
          if (unassigned === 0 && bidding === 0) {
            newStatus = 'EXECUTING'
          }

          return {
            ...order,
            status: newStatus,
            assignmentProgress: {
              ...order.assignmentProgress,
              status: unassigned === 0 && bidding === 0 ? 'DONE' as const : 'IN_PROGRESS' as const,
              biddingAwardedCount: awarded,
              directAssignedCount: assigned,
            },
            assignmentSummary: {
              ...order.assignmentSummary,
              unassignedCount: unassigned,
            },
            biddingSummary: {
              ...order.biddingSummary,
              activeTenderCount: Math.max(0, order.biddingSummary.activeTenderCount - 1),
            },
            updatedAt: now,
          }
        }
        return order
      })

      return {
        ...state,
        tenders: state.tenders.map(t => t.tenderId === tenderId ? updatedTender : t),
        processTasks: updatedTasks,
        productionOrders: updatedOrders,
      }
    }
    case 'UPDATE_TASK_STATUS': {
      const { taskId, newStatus, blockReason, blockRemark, by } = action.payload
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      const task = state.processTasks.find(t => t.taskId === taskId)
      if (!task) return state

      // 构建审计日志
      const actionMap: Record<string, string> = {
        'NOT_STARTED': 'RESET',
        'IN_PROGRESS': task.status === 'BLOCKED' ? 'UNBLOCK' : 'START',
        'DONE': 'FINISH',
        'BLOCKED': 'BLOCK',
        'CANCELLED': 'CANCEL',
      }
      const detailMap: Record<string, string> = {
        'NOT_STARTED': '重置为未开始',
        'IN_PROGRESS': task.status === 'BLOCKED' ? `解除暂不能继续，恢复为进行中` : '标记开始',
        'DONE': '标记完工',
        'BLOCKED': `标记暂不能继续，原因：${blockReason || 'OTHER'}${blockRemark ? `，备注：${blockRemark}` : ''}`,
        'CANCELLED': '取消任务',
      }

      const newLog: TaskAuditLog = {
        id: `AL-${Date.now()}-${taskId}`,
        action: actionMap[newStatus] || 'STATUS_CHANGE',
        detail: detailMap[newStatus] || `状态变更为${newStatus}`,
        at: now,
        by,
      }

      // 更新任务
      const updatedTask: ProcessTask = {
        ...task,
        status: newStatus,
        updatedAt: now,
        auditLogs: [...task.auditLogs, newLog],
        // 添加开始/完成时间字段（如果类型支持）
        ...(newStatus === 'IN_PROGRESS' && !task.auditLogs.some(l => l.action === 'START') ? { startedAt: now } : {}),
        ...(newStatus === 'DONE' ? { finishedAt: now } : {}),
        // 暂不能继续信息
        ...(newStatus === 'BLOCKED' ? { blockReason, blockRemark, blockedAt: now } : {}),
        ...(newStatus !== 'BLOCKED' ? { blockReason: undefined, blockRemark: undefined, blockedAt: undefined } : {}),
      } as ProcessTask

      const updatedTasks = state.processTasks.map(t => t.taskId === taskId ? updatedTask : t)

      // 自动同步更新生产单状态
      const orderId = task.productionOrderId
      const order = state.productionOrders.find(o => o.productionOrderId === orderId)
      if (!order) return { ...state, processTasks: updatedTasks }

      const orderTasks = updatedTasks.filter(t => t.productionOrderId === orderId)
      const doneCount = orderTasks.filter(t => t.status === 'DONE').length
      const inProgressCount = orderTasks.filter(t => t.status === 'IN_PROGRESS').length
      const blockedCount = orderTasks.filter(t => t.status === 'BLOCKED').length
      const totalTasks = orderTasks.length
      const progressPercent = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0

      // 计算新状态
      let newOrderStatus = order.status
      if (order.status === 'EXECUTING' || order.status === 'ASSIGNING') {
        if (doneCount === totalTasks) {
          newOrderStatus = 'COMPLETED'
        } else if (inProgressCount > 0 || blockedCount > 0 || doneCount > 0) {
          newOrderStatus = 'EXECUTING'
        }
      }

      // 计算风险标签
      const newRiskFlags: RiskFlag[] = [...(order.riskFlags || [])]
      const hasBlockedTask = blockedCount > 0
      if (hasBlockedTask && !newRiskFlags.includes('HAS_BLOCKED_TASK' as RiskFlag)) {
        // 注：如果类型不支持 HAS_BLOCKED_TASK，可以忽略
      }

      const orderLog = {
        id: `AL-ORDER-${Date.now()}`,
        action: 'TASK_STATUS_WRITEBACK',
        detail: `任务${taskId}状态变更为${newStatus}，进度${progressPercent}%`,
        at: now,
        by: '系统',
      }

      const updatedOrder: ProductionOrder = {
        ...order,
        status: newOrderStatus,
        progressPercent,
        updatedAt: now,
        auditLogs: [...order.auditLogs, orderLog],
      }

      return {
        ...state,
        processTasks: updatedTasks,
        productionOrders: state.productionOrders.map(o => o.productionOrderId === orderId ? updatedOrder : o),
      }
    }
    case 'ADD_EXCEPTION':
      return {
        ...state,
        exceptions: [...state.exceptions, action.payload],
      }
    case 'UPDATE_EXCEPTION':
      return {
        ...state,
        exceptions: state.exceptions.map(e =>
          e.caseId === action.payload.caseId ? action.payload : e
        ),
      }
    case 'SET_EXCEPTIONS':
      return {
        ...state,
        exceptions: action.payload,
      }
    case 'ADD_HANDOVER_EVENT':
      return {
        ...state,
        handoverEvents: [...state.handoverEvents, action.payload],
      }
    case 'UPDATE_HANDOVER_EVENT':
      return {
        ...state,
        handoverEvents: state.handoverEvents.map(e =>
          e.eventId === action.payload.eventId ? action.payload : e
        ),
      }
    case 'SET_HANDOVER_EVENTS':
      return {
        ...state,
        handoverEvents: action.payload,
      }
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      }
    case 'UPDATE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.notificationId === action.payload.notificationId ? action.payload : n
        ),
      }
    case 'SET_NOTIFICATIONS':
      return {
        ...state,
        notifications: action.payload,
      }
    case 'ADD_URGE':
      return {
        ...state,
        urges: [...state.urges, action.payload],
      }
    case 'UPDATE_URGE':
      return {
        ...state,
        urges: state.urges.map(u =>
          u.urgeId === action.payload.urgeId ? action.payload : u
        ),
      }
    case 'SET_URGES':
      return {
        ...state,
        urges: action.payload,
      }
    // PDA Accept/Reject Task
    case 'ACCEPT_TASK': {
      const { taskId, by } = action.payload
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      return {
        ...state,
        processTasks: state.processTasks.map(task => {
          if (task.taskId !== taskId) return task
          return {
            ...task,
            acceptanceStatus: 'ACCEPTED' as const,
            acceptedAt: now,
            acceptedBy: by,
            updatedAt: now,
            auditLogs: [...task.auditLogs, {
              id: `AL-ACC-${Date.now()}`,
              action: 'ACCEPT_TASK',
              detail: `工厂确��接单`,
              at: now,
              by,
            }],
          }
        }),
      }
    }
    case 'REJECT_TASK': {
      const { taskId, reason, by } = action.payload
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      return {
        ...state,
        processTasks: state.processTasks.map(task => {
          if (task.taskId !== taskId) return task
          return {
            ...task,
            acceptanceStatus: 'REJECTED' as const,
            assignmentStatus: 'UNASSIGNED' as const,
            assignedFactoryId: undefined,
            updatedAt: now,
            auditLogs: [...task.auditLogs, {
              id: `AL-REJ-${Date.now()}`,
              action: 'REJECT_TASK',
              detail: `工厂拒绝接单，原因：${reason}`,
              at: now,
              by,
            }],
          }
        }),
      }
    }
    // 设置任务分配方式（最小已完成）
    case 'SET_TASK_ASSIGN_MODE': {
      const { taskIds, mode, by } = action.payload as { taskIds: string[]; mode: 'DIRECT' | 'BIDDING' | 'HOLD'; by: string }
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      const modeMap: Record<string, { assignmentMode: 'DIRECT' | 'BIDDING'; assignmentStatus: 'UNASSIGNED' | 'ASSIGNING' | 'ASSIGNED' | 'BIDDING' | 'AWARDED' }> = {
        DIRECT: { assignmentMode: 'DIRECT', assignmentStatus: 'UNASSIGNED' },
        BIDDING: { assignmentMode: 'BIDDING', assignmentStatus: 'UNASSIGNED' },
        HOLD: { assignmentMode: 'DIRECT', assignmentStatus: 'UNASSIGNED' },
      }
      const mapped = modeMap[mode] ?? modeMap.DIRECT
      return {
        ...state,
        processTasks: state.processTasks.map(task => {
          if (!taskIds.includes(task.taskId)) return task
          return {
            ...task,
            ...mapped,
            updatedAt: now,
            auditLogs: [...task.auditLogs, {
              id: `AL-SAM-${Date.now()}-${task.taskId}`,
              action: 'SET_ASSIGN_MODE',
              detail: mode === 'HOLD' ? '设为暂不分配' : mode === 'DIRECT' ? '设为直接派单' : '设为竞价',
              at: now,
              by,
            }],
          }
        }),
      }
    }
    // PDA Exec: Start Task
    case 'START_TASK': {
      const { taskId, by } = action.payload
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      return {
        ...state,
        processTasks: state.processTasks.map(task => {
          if (task.taskId !== taskId) return task
          return {
            ...task,
            status: 'IN_PROGRESS' as const,
            startedAt: now,
            updatedAt: now,
            auditLogs: [...task.auditLogs, {
              id: `AL-START-${Date.now()}`,
              action: 'START_TASK',
              detail: '任务开工',
              at: now,
              by,
            }],
          }
        }),
      }
    }
    // PDA Exec: Finish Task
    case 'FINISH_TASK': {
      const { taskId, by } = action.payload
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      return {
        ...state,
        processTasks: state.processTasks.map(task => {
          if (task.taskId !== taskId) return task
          return {
            ...task,
            status: 'DONE' as const,
            finishedAt: now,
            updatedAt: now,
            auditLogs: [...task.auditLogs, {
              id: `AL-FINISH-${Date.now()}`,
              action: 'FINISH_TASK',
              detail: '任务完工',
              at: now,
              by,
            }],
          }
        }),
      }
    }
    // PDA Exec: Block Task
    case 'BLOCK_TASK': {
      const { taskId, reason, remark, by } = action.payload
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      return {
        ...state,
        processTasks: state.processTasks.map(task => {
          if (task.taskId !== taskId) return task
          return {
            ...task,
            status: 'BLOCKED' as const,
            blockReason: reason,
            blockRemark: remark,
            blockedAt: now,
            updatedAt: now,
            auditLogs: [...task.auditLogs, {
              id: `AL-BLOCK-${Date.now()}`,
              action: 'BLOCK_TASK',
              detail: `标记暂不能继续，原因：${reason}，备注：${remark || '-'}`,
              at: now,
              by,
            }],
          }
        }),
      }
    }
    // PDA Exec: Unblock Task
    case 'UNBLOCK_TASK': {
      const { taskId, remark, by } = action.payload
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      return {
        ...state,
        processTasks: state.processTasks.map(task => {
          if (task.taskId !== taskId) return task
          return {
            ...task,
            status: 'IN_PROGRESS' as const,
            blockReason: undefined,
            blockRemark: undefined,
            blockedAt: undefined,
            updatedAt: now,
            auditLogs: [...task.auditLogs, {
              id: `AL-UNBLOCK-${Date.now()}`,
              action: 'UNBLOCK_TASK',
              detail: `解除暂不能继续，备注：${remark || '-'}`,
              at: now,
              by,
            }],
          }
        }),
      }
    }
    // Allocation Gate sync
    case 'SYNC_ALLOCATION_GATES': {
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      const { updates } = action.payload
      if (!updates.length) return state
      const updateMap = new Map(updates.map(u => [u.taskId, u]))
      return {
        ...state,
        processTasks: state.processTasks.map(task => {
          const upd = updateMap.get(task.taskId)
          if (!upd) return task
          if (upd.action === 'BLOCK') {
            return {
              ...task,
              status: 'BLOCKED' as const,
              blockReason: 'ALLOCATION_GATE' as BlockReason,
              blockRemark: upd.noteZh,
              blockNoteZh: upd.noteZh,
              blockedAt: now,
              updatedAt: now,
              auditLogs: [...task.auditLogs, {
                id: `AL-GATE-BLOCK-${Date.now()}-${task.taskId}`,
                action: 'BLOCK_BY_ALLOCATION_GATE',
                detail: upd.noteZh,
                at: now,
                by: upd.by,
              }],
            }
          } else {
            return {
              ...task,
              status: 'NOT_STARTED' as const,
              blockReason: undefined,
              blockRemark: undefined,
              blockNoteZh: undefined,
              blockedAt: undefined,
              updatedAt: now,
              auditLogs: [...task.auditLogs, {
                id: `AL-GATE-UNBLOCK-${Date.now()}-${task.taskId}`,
                action: 'UNBLOCK_BY_ALLOCATION_GATE',
                detail: `上一步已可继续，开始条件解除`,
                at: now,
                by: upd.by,
              }],
            }
          }
        }),
      }
    }
    // PDA Handover: Confirm Handover
    case 'CONFIRM_HANDOVER': {
      const { eventId, by } = action.payload
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      return {
        ...state,
        handoverEvents: state.handoverEvents.map(event => {
          if (event.eventId !== eventId) return event
          return {
            ...event,
            status: 'CONFIRMED' as const,
            qtyActual: event.qtyActual || event.qtyExpected,
            qtyDiff: (event.qtyActual || event.qtyExpected) - event.qtyExpected,
            confirmedAt: now,
            confirmedBy: by,
            auditLogs: [...event.auditLogs, {
              id: `HAL-CONF-${Date.now()}`,
              action: 'CONFIRM_HANDOVER',
              detail: '确认收货',
              at: now,
              by,
            }],
          }
        }),
      }
    }
    // PDA Handover: Dispute Handover
    case 'DISPUTE_HANDOVER': {
      const { eventId, qtyActual, diffReasonCode, diffRemark, evidence, by } = action.payload
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      return {
        ...state,
        handoverEvents: state.handoverEvents.map(event => {
          if (event.eventId !== eventId) return event
          return {
            ...event,
            status: 'DISPUTED' as const,
            qtyActual,
            qtyDiff: qtyActual - event.qtyExpected,
            diffReasonCode,
            diffRemark,
            evidence: [...event.evidence, ...evidence],
            confirmedAt: now,
            confirmedBy: by,
            auditLogs: [...event.auditLogs, {
              id: `HAL-DISP-${Date.now()}`,
              action: 'DISPUTE_HANDOVER',
              detail: `提出争议：${diffReasonCode}，实收${qtyActual}件，差异${qtyActual - event.qtyExpected}件`,
              at: now,
              by,
            }],
          }
        }),
      }
    }
    // Quality Inspection: Add QC
    case 'ADD_QC': {
      const updated = [...state.qualityInspections, action.payload]
      return { ...state, qualityInspections: updated, qcRecords: updated }
    }
    // Quality Inspection: Update QC
    case 'UPDATE_QC': {
      const updated = state.qualityInspections.map(qc =>
        qc.qcId === action.payload.qcId ? action.payload : qc
      )
      return { ...state, qualityInspections: updated, qcRecords: updated }
    }
    // Quality Inspection: Submit QC (with rework task generation)
    case 'SUBMIT_QC': {
      const { qcId, generatedTaskIds, blockedTaskId, by } = action.payload
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      const updatedQIs = state.qualityInspections.map(qc => {
        if (qc.qcId !== qcId) return qc
        return {
          ...qc,
          status: 'SUBMITTED' as const,
          generatedTaskIds,
          updatedAt: now,
          auditLogs: [...qc.auditLogs, {
            id: `QAL-SUB-${Date.now()}`,
            action: 'SUBMIT_QC',
            detail: generatedTaskIds.length > 0
              ? `提交质检，生成返工任务：${generatedTaskIds.join(', ')}`
              : '提交质检',
            at: now,
            by,
          }],
        }
      })
      return {
        ...state,
        qualityInspections: updatedQIs,
        qcRecords: updatedQIs,
        processTasks: blockedTaskId
          ? state.processTasks.map(task => {
            if (task.taskId !== blockedTaskId) return task
            return {
              ...task,
              status: 'BLOCKED' as const,
              blockReason: 'QUALITY' as const,
              blockRemark: `QC FAIL ${qcId} -> 生成${generatedTaskIds.length}个返工任务`,
              blockedAt: now,
              updatedAt: now,
              auditLogs: [...task.auditLogs, {
                id: `AL-QCBLOCK-${Date.now()}`,
                action: 'BLOCK_BY_QC',
                detail: `质检不合格(${qcId})，任务暂不能继续`,
                at: now,
                by,
              }],
            }
          })
          : state.processTasks,
      }
    }
    case 'ADD_DEDUCTION_CANDIDATE':
      return {
        ...state,
        deductionCandidates: [...state.deductionCandidates, action.payload],
      }
    // Deduction Candidate: Update
    case 'UPDATE_DEDUCTION_CANDIDATE':
      return {
        ...state,
        deductionCandidates: state.deductionCandidates.map(dc =>
          dc.candidateId === action.payload.candidateId ? action.payload : dc
        ),
      }
    // Rework: Update Task Audit Log
    case 'UPDATE_TASK_AUDIT_LOG': {
      const { taskId, auditLog } = action.payload
      return {
        ...state,
        processTasks: state.processTasks.map(task => {
          if (task.taskId !== taskId) return task
          return {
            ...task,
            auditLogs: [...task.auditLogs, auditLog],
          }
        }),
      }
    }
    // Rework: Unblock Parent Task By Rework Done
    case 'UNBLOCK_TASK_BY_REWORK': {
      const { parentTaskId, reworkTaskId, newStatus, by } = action.payload
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      return {
        ...state,
        processTasks: state.processTasks.map(task => {
          if (task.taskId !== parentTaskId) return task
          return {
            ...task,
            status: newStatus,
            blockReason: undefined,
            blockRemark: `${task.blockRemark || ''} | UNBLOCK_BY_REWORK ${reworkTaskId}`,
            blockedAt: undefined,
            updatedAt: now,
            auditLogs: [...task.auditLogs,
            {
              id: `AL-RWDONE-${Date.now()}`,
              action: 'REWORK_DONE',
              detail: `返工任务 ${reworkTaskId} 已完成`,
              at: now,
              by,
            },
            {
              id: `AL-UNBLKRW-${Date.now()}`,
              action: 'UNBLOCK_BY_REWORK',
              detail: `返工完成，自动解除 QUALITY 暂不能继续，恢复状态为 ${newStatus}`,
              at: now,
              by,
            },
            ],
          }
        }),
      }
    }
    // Rework: Auto-resolve Exception
    case 'RESOLVE_EXCEPTION_BY_REWORK': {
      const { caseId, reworkTaskId, by } = action.payload
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      return {
        ...state,
        exceptions: state.exceptions.map(exc => {
          if (exc.caseId !== caseId) return exc
          return {
            ...exc,
            caseStatus: 'RESOLVED' as const,
            resolvedAt: now,
            resolvedBy: by,
            auditLogs: [...exc.auditLogs, {
              id: `EAL-AUTORES-${Date.now()}`,
              action: 'AUTO_RESOLVE_BY_REWORK',
              detail: `返工任务 ${reworkTaskId} 完成，自动关闭质量异常`,
              at: now,
              by,
            }],
          }
        }),
      }
    }
    // Deduction Basis Item: Add
    case 'ADD_DEDUCTION_BASIS_ITEM':
      return {
        ...state,
        deductionBasisItems: [...state.deductionBasisItems, action.payload],
      }
    // Deduction Basis Item: Update
    case 'UPDATE_DEDUCTION_BASIS_ITEM':
      return {
        ...state,
        deductionBasisItems: state.deductionBasisItems.map(item =>
          item.basisId === action.payload.basisId ? action.payload : item
        ),
      }
    // Allocation
    case 'UPSERT_ALLOCATION_SNAPSHOT':
      return {
        ...state,
        allocationByTaskId: {
          ...state.allocationByTaskId,
          [action.payload.taskId]: action.payload,
        },
      }
    case 'ADD_ALLOCATION_EVENT':
      return {
        ...state,
        allocationEvents: [...state.allocationEvents, action.payload],
      }
    // ReturnBatch
    case 'ADD_RETURN_BATCH':
      return { ...state, returnBatches: [...state.returnBatches, action.payload] }
    case 'UPDATE_RETURN_BATCH':
      return {
        ...state,
        returnBatches: state.returnBatches.map(b =>
          b.batchId === action.payload.batchId ? action.payload : b
        ),
      }
    // DyePrintOrder
    case 'ADD_DYE_PRINT_ORDER':
      return { ...state, dyePrintOrders: [...state.dyePrintOrders, action.payload] }
    case 'UPDATE_DYE_PRINT_ORDER':
      return {
        ...state,
        dyePrintOrders: state.dyePrintOrders.map(o =>
          o.dpId === action.payload.dpId ? action.payload : o
        ),
      }
    case 'ADD_DYE_PRINT_RETURN': {
      const { dpId, batch } = action.payload
      return {
        ...state,
        dyePrintOrders: state.dyePrintOrders.map(o => {
          if (o.dpId !== dpId) return o
          const newBatches = [...o.returnBatches, batch]
          const passQty = newBatches.filter(b => b.result === 'PASS').reduce((s, b) => s + b.qty, 0)
          const failQty = newBatches.filter(b => b.result === 'FAIL').reduce((s, b) => s + b.qty, 0)
          const totalQty = passQty + failQty
          const newStatus: DyePrintOrderStatus =
            o.status === 'CLOSED' ? 'CLOSED'
              : totalQty >= o.plannedQty ? 'COMPLETED'
                : totalQty > 0 ? 'PARTIAL_RETURNED'
                  : o.status
          return {
            ...o,
            returnBatches: newBatches,
            returnedPassQty: passQty,
            returnedFailQty: failQty,
            availableQty: passQty,
            status: newStatus,
            updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
          }
        }),
      }
    }
    // FactoryPdaUser
    case 'CREATE_FACTORY_PDA_USER':
      return { ...state, factoryPdaUsers: [...state.factoryPdaUsers, action.payload] }
    case 'UPDATE_FACTORY_PDA_USER':
      return { ...state, factoryPdaUsers: state.factoryPdaUsers.map(u => u.userId === action.payload.userId ? action.payload : u) }
    case 'ADD_STATEMENT_DRAFT':
      return { ...state, statementDrafts: [...state.statementDrafts, action.payload] }
    case 'UPDATE_STATEMENT_DRAFT':
      return { ...state, statementDrafts: state.statementDrafts.map(s => s.statementId === action.payload.statementId ? action.payload : s) }
    case 'ADD_STATEMENT_ADJUSTMENT':
      return { ...state, statementAdjustments: [...state.statementAdjustments, action.payload] }
    case 'UPDATE_STATEMENT_ADJUSTMENT':
      return { ...state, statementAdjustments: state.statementAdjustments.map(a => a.adjustmentId === action.payload.adjustmentId ? action.payload : a) }
    case 'ADD_SETTLEMENT_BATCH':
      return { ...state, settlementBatches: [...state.settlementBatches, action.payload] }
    case 'UPDATE_SETTLEMENT_BATCH':
      return { ...state, settlementBatches: state.settlementBatches.map(b => b.batchId === action.payload.batchId ? action.payload : b) }
    case 'BATCH_UPDATE_STATEMENT_DRAFTS':
      return {
        ...state,
        statementDrafts: state.statementDrafts.map(s => {
          const updated = action.payload.find(u => u.statementId === s.statementId)
          return updated ?? s
        }),
      }
    case 'ADD_PRODUCTION_ORDER_CHANGE':
      return { ...state, productionOrderChanges: [...state.productionOrderChanges, action.payload] }
    case 'UPDATE_PRODUCTION_ORDER_CHANGE':
      return { ...state, productionOrderChanges: state.productionOrderChanges.map(c => c.changeId === action.payload.changeId ? action.payload : c) }
    case 'ADD_TENDER_ORDER':
      return { ...state, tenderOrders: [...state.tenderOrders, action.payload] }
    case 'UPDATE_TENDER_ORDER':
      return { ...state, tenderOrders: state.tenderOrders.map(t => t.tenderId === action.payload.tenderId ? action.payload : t) }
    case 'ADD_MATERIAL_ISSUE_SHEET':
      return { ...state, materialIssueSheets: [...state.materialIssueSheets, action.payload] }
    case 'UPDATE_MATERIAL_ISSUE_SHEET':
      return { ...state, materialIssueSheets: state.materialIssueSheets.map(s => s.issueId === action.payload.issueId ? action.payload : s) }
    case 'ADD_QC_STANDARD_SHEET':
      return { ...state, qcStandardSheets: [...state.qcStandardSheets, action.payload] }
    case 'UPDATE_QC_STANDARD_SHEET':
      return { ...state, qcStandardSheets: state.qcStandardSheets.map(s => s.standardId === action.payload.standardId ? action.payload : s) }
    case 'ADD_MATERIAL_STATEMENT_DRAFT':
      return { ...state, materialStatementDrafts: [...state.materialStatementDrafts, action.payload] }
    case 'UPDATE_MATERIAL_STATEMENT_DRAFT':
      return { ...state, materialStatementDrafts: state.materialStatementDrafts.map(d => d.materialStatementId === action.payload.materialStatementId ? action.payload : d) }
    default:
      return state
  }
}

// =============================================
// Context
// =============================================
interface FcsContextType {
  state: FcsState
  dispatch: React.Dispatch<FcsAction>
  // 便捷方法
  getTasksByOrderId: (orderId: string) => ProcessTask[]
  getOrderById: (orderId: string) => ProductionOrder | undefined
  getFactoryById: (factoryId: string) => IndonesiaFactory | undefined
  getTenderById: (tenderId: string) => Tender | undefined
  getTenderByTaskId: (taskId: string) => Tender | undefined
  batchDispatch: (taskIds: string[], factoryId: string, factoryName: string) => void
  batchCreateTender: (taskIds: string[], deadline: string, invitedFactoryIds: string[]) => void
  awardTender: (tenderId: string, winnerFactoryId: string, winnerBidId: string) => void
  addTasks: (tasks: ProcessTask[]) => void
  updateTaskStatus: (taskId: string, newStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'CANCELLED', blockReason?: BlockReason, blockRemark?: string, by?: string) => void
  updateOrder: (order: ProductionOrder) => void
  // Exception methods
  getExceptionById: (caseId: string) => ExceptionCase | undefined
  getExceptionsByTaskId: (taskId: string) => ExceptionCase[]
  getExceptionsByOrderId: (orderId: string) => ExceptionCase[]
  getExceptionsByTenderId: (tenderId: string) => ExceptionCase[]
  addException: (exception: ExceptionCase) => void
  updateException: (exception: ExceptionCase) => void
  createOrUpdateExceptionFromSignal: (signal: { sourceType: 'TASK' | 'ORDER' | 'TENDER'; sourceId: string; reasonCode: ReasonCode; detail?: string }) => ExceptionCase
  extendTenderDeadline: (tenderId: string, hours?: number) => void
  // Handover methods
  getHandoverEventById: (eventId: string) => HandoverEvent | undefined
  getHandoverEventsByOrderId: (orderId: string) => HandoverEvent[]
  getHandoverEventsByTaskId: (taskId: string) => HandoverEvent[]
  createHandoverEvent: (payload: Omit<HandoverEvent, 'eventId' | 'createdAt' | 'auditLogs'>) => HandoverEvent
  confirmHandoverEvent: (eventId: string, by: string) => void
  markHandoverDisputed: (eventId: string, reason: string, by: string) => void
  voidHandoverEvent: (eventId: string, by: string) => void
  // Notification methods
  createNotification: (payload: Omit<Notification, 'notificationId' | 'createdAt'>) => Notification
  markNotificationRead: (notificationId: string) => void
  markAllNotificationsRead: (filter?: { recipientType?: RecipientType; recipientId?: string }) => void
  recomputeAutoNotifications: () => void
  // Urge methods
  createUrge: (payload: Omit<UrgeLog, 'urgeId' | 'createdAt' | 'status' | 'auditLogs'>) => UrgeLog
  ackUrge: (urgeId: string, by: string) => void
  // PDA Task Accept/Reject
  acceptTask: (taskId: string, by: string) => { ok: boolean; errorCode?: string; messageKey?: string } | undefined
  rejectTask: (taskId: string, reason: string, by: string) => { ok: boolean; errorCode?: string; messageKey?: string } | undefined
  // PDA Exec methods
  startTask: (taskId: string, by: string) => { ok: boolean; errorCode?: string; messageKey?: string } | undefined
  finishTask: (taskId: string, by: string) => { ok: boolean; errorCode?: string; messageKey?: string } | undefined
  blockTask: (taskId: string, reason: BlockReason, remark: string, by: string) => { ok: boolean; errorCode?: string; messageKey?: string } | undefined
  unblockTask: (taskId: string, remark: string, by: string) => { ok: boolean; errorCode?: string; messageKey?: string } | undefined
  // PDA Handover methods
  confirmHandover: (eventId: string, by: string) => { ok: boolean; errorCode?: string; messageKey?: string } | undefined
  disputeHandover: (eventId: string, payload: { qtyActual: number; diffReasonCode: DiffReasonCode; diffRemark: string; evidence?: HandoverEvidence[] }, by: string) => { ok: boolean; errorCode?: string; messageKey?: string } | undefined
  // Quality Inspection methods
  getQcById: (qcId: string) => QualityInspection | undefined
  getQcsByTaskId: (taskId: string) => QualityInspection[]
  getSubmittedQcListByTaskId: (taskId: string) => QualityInspection[]
  getLatestSubmittedQcByTaskId: (taskId: string) => QualityInspection | undefined
  hasSubmittedQc: (taskId: string) => boolean
  createQc: (payload: Omit<QualityInspection, 'qcId' | 'status' | 'auditLogs' | 'createdAt' | 'updatedAt'>) => QualityInspection
  updateQc: (qc: QualityInspection) => void
  submitQc: (qcId: string, by: string) => { ok?: boolean; errorCode?: string; messageKey?: string; generatedTaskIds: string[] }
  updateQcDispositionBreakdown: (qcId: string, breakdown: { reworkQty?: number; remakeQty?: number; acceptAsDefectQty?: number; scrapQty?: number; acceptNoDeductQty?: number }, by: string) => { ok: boolean; message?: string }
  confirmQcLiability: (qcId: string, payload: { liablePartyType: SettlementPartyType; liablePartyId: string; settlementPartyType: SettlementPartyType; settlementPartyId: string; liabilityReason: string }, by: string) => { ok: boolean; message?: string }
  disputeQcLiability: (qcId: string, payload: { disputeRemark: string }, by: string) => { ok: boolean; message?: string }
  closeQcCase: (qcId: string, by: string) => { ok: boolean; message?: string }
  arbitrateDispute: (input: {
    qcId: string
    result: 'UPHOLD' | 'REASSIGN' | 'VOID_DEDUCTION'
    remark: string
    liablePartyType?: SettlementPartyType
    liablePartyId?: string
    settlementPartyType?: SettlementPartyType
    settlementPartyId?: string
  }, by: string) => { ok: boolean; message?: string }
  applyQcAllocationWriteback: (qcId: string, by: string) => { ok: boolean; message?: string }
  // ReturnBatch actions
  createReturnBatch: (taskId: string, returnedQty: number, by: string) => { ok: boolean; batchId?: string; message?: string }
  markReturnBatchPass: (batchId: string, by: string) => { ok: boolean; message?: string }
  startReturnBatchFailQc: (batchId: string, by: string) => { ok: boolean; qcId?: string; message?: string }
  // DyePrintOrder actions
  createDyePrintOrder: (input: { productionOrderId: string; relatedTaskId?: string; processorFactoryId: string; processorFactoryName: string; processType: DyePrintProcessType; plannedQty: number; remark?: string }) => { ok: boolean; dpId?: string; message?: string }
  startDyePrintOrder: (dpId: string) => { ok: boolean; message?: string }
  closeDyePrintOrder: (dpId: string) => { ok: boolean; message?: string }
  addDyePrintReturn: (dpId: string, payload: { qty: number; result: DyePrintReturnResult; disposition?: QcDisposition; remark?: string }) => { ok: boolean; returnId?: string; qcId?: string; message?: string }
  // Task dependency
  updateTaskDependencies: (taskId: string, dependsOnTaskIds: string[], by: string) => { ok: boolean; message?: string }
  // Rework/Remake task completion
  completeReworkTask: (taskId: string, by: string) => { ok: boolean; message?: string }
  // Statement Draft actions
  generateStatementDraft: (input: {
    settlementPartyType: SettlementPartyType
    settlementPartyId: string
    basisIds: string[]
    remark?: string
  }, by: string) => { ok: boolean; statementId?: string; message?: string }
  confirmStatementDraft: (statementId: string, by: string) => { ok: boolean; message?: string }
  closeStatementDraft: (statementId: string, by: string) => { ok: boolean; message?: string }
  // StatementAdjustment actions
  createStatementAdjustment: (input: {
    statementId: string
    adjustmentType: AdjustmentType
    amount: number
    remark: string
    relatedBasisId?: string
  }, by: string) => { ok: boolean; adjustmentId?: string; message?: string }
  effectStatementAdjustment: (adjustmentId: string, by: string) => { ok: boolean; message?: string }
  voidStatementAdjustment: (adjustmentId: string, by: string) => { ok: boolean; message?: string }
  // SettlementBatch actions
  createSettlementBatch: (input: {
    statementIds: string[]
    remark?: string
    batchName?: string
  }, by: string) => { ok: boolean; batchId?: string; message?: string }
  startSettlementBatch: (batchId: string, by: string) => { ok: boolean; message?: string }
  completeSettlementBatch: (batchId: string, by: string) => { ok: boolean; message?: string }
  syncSettlementPaymentResult: (input: {
    batchId: string
    paymentSyncStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL'
    paymentAmount?: number
    paymentAt?: string
    paymentReferenceNo?: string
    paymentRemark?: string
  }, by: string) => { ok: boolean; message?: string }
  updateProductionPlan: (input: {
    productionOrderId: string
    planStartDate: string
    planEndDate: string
    planQty: number
    planFactoryId: string
    planFactoryName?: string
    planRemark?: string
  }, by: string) => { ok: boolean; message?: string }
  releaseProductionPlan: (productionOrderId: string, by: string) => { ok: boolean; message?: string }
  updateProductionOrderStatus: (input: {
    productionOrderId: string
    nextStatus: 'DRAFT' | 'PLANNED' | 'RELEASED' | 'IN_PRODUCTION' | 'QC_PENDING' | 'COMPLETED' | 'CLOSED'
    remark?: string
  }, by: string) => { ok: boolean; message?: string }
  // ProductionOrderChange actions
  createProductionOrderChange: (input: {
    productionOrderId: string
    changeType: ProductionChangeType
    beforeValue?: string
    afterValue?: string
    impactScopeZh?: string
    reason: string
    remark?: string
  }, by: string) => { ok: boolean; changeId?: string; message?: string }
  updateProductionOrderChangeStatus: (input: {
    changeId: string
    nextStatus: ProductionChangeStatus
    remark?: string
  }, by: string) => { ok: boolean; message?: string }
  updateProductionDeliveryWarehouse: (input: {
    productionOrderId: string
    deliveryWarehouseId: string
    deliveryWarehouseName?: string
    deliveryWarehouseRemark?: string
  }, by: string) => { ok: boolean; message?: string }
  // 招标单台账 actions
  createTenderOrder: (input: {
    taskIds: string[]
    titleZh?: string
    targetFactoryIds?: string[]
    bidDeadline?: string
    remark?: string
  }, by: string) => { ok: boolean; tenderId?: string; message?: string }
  updateTenderOrderStatus: (input: {
    tenderId: string
    nextStatus: TenderOrderStatus
    remark?: string
  }, by: string) => { ok: boolean; message?: string }
  awardTenderOrder: (input: {
    tenderId: string
    candidateFactoryIds: string[]
    awardedFactoryId: string
    awardRemark?: string
  }, by: string) => { ok: boolean; message?: string }
  voidTenderAward: (input: {
    tenderId: string
    remark?: string
  }, by: string) => { ok: boolean; message?: string }
  // 派单/竞价异常台账 actions
  createDispatchException: (input: {
    exceptionType: 'TENDER_NOT_CREATED' | 'NO_BID_FACTORY' | 'AWARD_CONFLICT' | 'TASK_UNASSIGNED' | 'OTHER'
    sourceType: 'TASK' | 'TENDER' | 'AWARD'
    sourceId: string
    productionOrderId?: string
    titleZh?: string
    descriptionZh?: string
    remark?: string
  }, by: string) => { ok: boolean; exceptionId?: string; message?: string }
  updateDispatchExceptionStatus: (input: {
    exceptionId: string
    nextStatus: 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'CLOSED'
    remark?: string
  }, by: string) => { ok: boolean; message?: string }
  // 领料需求单 actions
  createMaterialIssueSheet: (input: {
    taskId: string
    productionOrderId?: string
    materialSummaryZh: string
    requestedQty: number
    remark?: string
  }, by: string) => { ok: boolean; issueId?: string; message?: string }
  updateMaterialIssueSheet: (input: {
    issueId: string
    materialSummaryZh?: string
    requestedQty?: number
    issuedQty?: number
    remark?: string
  }, by: string) => { ok: boolean; message?: string }
  updateMaterialIssueStatus: (input: {
    issueId: string
    nextStatus: MaterialIssueStatus
    remark?: string
  }, by: string) => { ok: boolean; message?: string }
  // 质检点/验收标准单 actions
  createQcStandardSheet: (input: {
    taskId: string
    productionOrderId?: string
    checkpointSummaryZh: string
    acceptanceSummaryZh: string
    samplingSummaryZh?: string
    remark?: string
  }, by: string) => { ok: boolean; standardId?: string; message?: string }
  updateQcStandardSheet: (input: {
    standardId: string
    checkpointSummaryZh?: string
    acceptanceSummaryZh?: string
    samplingSummaryZh?: string
    remark?: string
  }, by: string) => { ok: boolean; message?: string }
  updateQcStandardStatus: (input: {
    standardId: string
    nextStatus: QcStandardStatus
    remark?: string
  }, by: string) => { ok: boolean; message?: string }
  // 领料对账单 actions
  generateMaterialStatementDraft: (input: {
    productionOrderId: string
    issueIds: string[]
    remark?: string
  }, by: string) => { ok: boolean; materialStatementId?: string; message?: string }
  confirmMaterialStatementDraft: (materialStatementId: string, by: string) => { ok: boolean; message?: string }
  closeMaterialStatementDraft: (materialStatementId: string, by: string) => { ok: boolean; message?: string }
  resolvePermissions: (user: FactoryUser) => Set<PermissionKey>
  can: (permissionKey: PermissionKey) => boolean
  // FactoryPdaUser 管理
  listFactoryPdaUsers: (factoryId: string) => FactoryPdaUser[]
  createFactoryPdaUser: (input: Omit<FactoryPdaUser, 'userId' | 'createdAt' | 'createdBy'>) => { ok: boolean; user?: FactoryPdaUser; messageKey?: string }
  updateFactoryPdaUser: (userId: string, patch: Partial<Pick<FactoryPdaUser, 'name' | 'loginId' | 'roleId'>>) => { ok: boolean; user?: FactoryPdaUser; messageKey?: string }
  toggleFactoryPdaUserLock: (userId: string, locked: boolean) => void
  setFactoryPdaUserRole: (userId: string, roleId: string) => void
  // FactoryPdaRole 管理
  listFactoryPdaRoles: (factoryId: string) => FactoryPdaRole[]
  getRoleById: (roleId: string, factoryId: string) => FactoryPdaRole | undefined
  createFactoryPdaRole: (factoryId: string, roleName: string, permissionKeys: PermissionKey[]) => { ok: boolean; role?: FactoryPdaRole; messageKey?: string }
  updateFactoryPdaRole: (roleId: string, factoryId: string, patch: { roleName?: string; permissionKeys?: PermissionKey[]; status?: 'ACTIVE' | 'DISABLED' }) => { ok: boolean; messageKey?: string }
  toggleFactoryPdaRole: (roleId: string, factoryId: string, status: 'ACTIVE' | 'DISABLED') => { ok: boolean; messageKey?: string }
  computeEffectivePermissionsForUser: (userId: string) => PermissionKey[]
}

const FcsContext = createContext<FcsContextType | null>(null)

// =============================================
// Provider
// =============================================

type DispatchExceptionType = 'TENDER_NOT_CREATED' | 'NO_BID_FACTORY' | 'AWARD_CONFLICT' | 'TASK_UNASSIGNED' | 'OTHER'
type DispatchExceptionStatus = 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'CLOSED'

const DISPATCH_EX_REASON: Record<DispatchExceptionType, { category: ExceptionCategory; reasonCode: ReasonCode; defaultTitle: string }> = {
  TENDER_NOT_CREATED: { category: 'ASSIGNMENT', reasonCode: 'DISPATCH_REJECTED', defaultTitle: '招标单未创建' },
  NO_BID_FACTORY: { category: 'ASSIGNMENT', reasonCode: 'NO_BID', defaultTitle: '无候选工厂' },
  AWARD_CONFLICT: { category: 'ASSIGNMENT', reasonCode: 'TENDER_OVERDUE', defaultTitle: '定标冲突' },
  TASK_UNASSIGNED: { category: 'ASSIGNMENT', reasonCode: 'ACK_TIMEOUT', defaultTitle: '任务未分配' },
  OTHER: { category: 'ASSIGNMENT', reasonCode: 'TENDER_NEAR_DEADLINE', defaultTitle: '派单异常' },
}
export function FcsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(fcsReducer, {
    productionOrders: [...productionOrders],
    processTasks: [...processTasks],
    factories: [...indonesiaFactories],
    tenders: [...initialTenders],
    tenderOrders: [...initialTenderOrders],
    materialIssueSheets: [...initialMaterialIssueSheets],
    routingTemplates: [...routingTemplates],
    qcStandardSheets: [...initialQcStandardSheets],
    materialStatementDrafts: [...initialMaterialStatementDrafts],
    exceptions: [...initialExceptions],
    handoverEvents: [...initialHandoverEvents],
    notifications: [...initialNotifications],
    urges: [...initialUrges],
    qualityInspections: [...initialQualityInspections],
    qcRecords: [...initialQualityInspections],
    deductionCandidates: [...initialDeductionCandidates],
    deductionBasisItems: [...initialDeductionBasisItems],
    factoryUsers: [...initialFactoryUsers],
    factoryRoles: [...initialFactoryRoles],
    factoryPdaUsers: [...initialFactoryPdaUsers],
    factoryPdaRoles: [...initialFactoryPdaRoles],
    factoryUsers: [...initialFactoryUsers],
    factoryRoles: [...initialFactoryRoles],
    factoryPdaUsers: [...initialFactoryPdaUsers],
    factoryPdaRoles: [...initialFactoryPdaRoles],
    allocationByTaskId: { ...initialAllocationByTaskId },
    allocationEvents: [...initialAllocationEvents],
    returnBatches: [...initialReturnBatches],
    dyePrintOrders: [...initialDyePrintOrders],
    statementDrafts: [...initialStatementDrafts],
    statementAdjustments: [...initialStatementAdjustments],
    settlementBatches: [...initialSettlementBatches],
    productionOrderChanges: [...initialProductionOrderChanges],
    statementDrafts: [...initialStatementDrafts],
    statementAdjustments: [...initialStatementAdjustments],
    settlementBatches: [...initialSettlementBatches],
    productionOrderChanges: [...initialProductionOrderChanges],
  })

  const getTasksByOrderId = (orderId: string) =>
    state.processTasks.filter(t => t.productionOrderId === orderId)

  const getOrderById = (orderId: string) =>
    state.productionOrders.find(o => o.productionOrderId === orderId)

  const getFactoryById = (factoryId: string) =>
    state.factories.find(f => f.id === factoryId)

  const getTenderById = (tenderId: string) =>
    state.tenders.find(t => t.tenderId === tenderId)

  const getTenderByTaskId = (taskId: string) => {
    const task = state.processTasks.find(t => t.taskId === taskId)
    if (!task?.tenderId) return undefined
    return state.tenders.find(t => t.tenderId === task.tenderId)
  }

  const batchDispatch = (taskIds: string[], factoryId: string, factoryName: string) => {
    dispatch({ type: 'BATCH_DISPATCH', payload: { taskIds, factoryId, factoryName } })
  }

  const batchCreateTender = (taskIds: string[], deadline: string, invitedFactoryIds: string[]) => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const tenderId = `TENDER-${Date.now()}`
    const productionOrderIds = [...new Set(
      state.processTasks.filter(t => taskIds.includes(t.taskId)).map(t => t.productionOrderId)
    )]

    const tender: Tender = {
      tenderId,
      taskIds,
      productionOrderIds,
      deadline,
      invitedFactoryIds,
      status: 'OPEN',
      bids: [],
      awardRule: 'LOWEST_PRICE',
      createdAt: now,
      createdBy: 'Admin',
      updatedAt: now,
      auditLogs: [
        { id: `TAL-${Date.now()}`, action: 'CREATE', detail: '创建竞价招标单', at: now, by: 'Admin' },
      ],
    }

    dispatch({ type: 'BATCH_CREATE_TENDER', payload: { taskIds, tender } })
  }

  const awardTender = (tenderId: string, winnerFactoryId: string, winnerBidId: string) => {
    dispatch({ type: 'AWARD_TENDER', payload: { tenderId, winnerFactoryId, winnerBidId } })
  }

  const addTasks = (tasks: ProcessTask[]) => {
    dispatch({ type: 'ADD_TASKS', payload: tasks })
  }

  const updateOrder = (order: ProductionOrder) => {
    dispatch({ type: 'UPDATE_ORDER', payload: order })
  }

  const updateProductionPlan = (
    input: {
      productionOrderId: string
      planStartDate: string
      planEndDate: string
      planQty: number
      planFactoryId: string
      planFactoryName?: string
      planRemark?: string
    },
    by: string,
  ): { ok: boolean; message?: string } => {
    const { productionOrderId, planStartDate, planEndDate, planQty, planFactoryId, planFactoryName, planRemark } = input
    const order = state.productionOrders.find(o => o.productionOrderId === productionOrderId)
    if (!order) return { ok: false, message: `生产单 ${productionOrderId} 不存在` }
    if (!planStartDate) return { ok: false, message: '计划开始日期不能为空' }
    if (!planEndDate) return { ok: false, message: '计划结束日期不能为空' }
    if (planQty <= 0) return { ok: false, message: '计划数量必须大于 0' }
    if (!planFactoryId) return { ok: false, message: '计划工厂不能为空' }
    if (planEndDate < planStartDate) return { ok: false, message: '计划结束日期不能早于开始日期' }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({
      type: 'UPDATE_ORDER',
      payload: {
        ...order,
        planStatus: 'PLANNED',
        planStartDate,
        planEndDate,
        planQty,
        planFactoryId,
        planFactoryName,
        planRemark,
        planUpdatedAt: ts,
        planUpdatedBy: by,
        updatedAt: ts,
      },
    })
    return { ok: true }
  }

  const releaseProductionPlan = (productionOrderId: string, by: string): { ok: boolean; message?: string } => {
    const order = state.productionOrders.find(o => o.productionOrderId === productionOrderId)
    if (!order) return { ok: false, message: `生产单 ${productionOrderId} 不存在` }
    if (!order.planStartDate || !order.planEndDate || !order.planQty || !order.planFactoryId) {
      return { ok: false, message: '请先完成生产单计划后再��发' }
    }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({
      type: 'UPDATE_ORDER',
      payload: { ...order, planStatus: 'RELEASED', planUpdatedAt: ts, planUpdatedBy: by, updatedAt: ts },
    })
    return { ok: true }
  }

  const updateProductionOrderStatus = (
    input: {
      productionOrderId: string
      nextStatus: 'DRAFT' | 'PLANNED' | 'RELEASED' | 'IN_PRODUCTION' | 'QC_PENDING' | 'COMPLETED' | 'CLOSED'
      remark?: string
    },
    by: string,
  ): { ok: boolean; message?: string } => {
    const { productionOrderId, nextStatus, remark } = input
    const order = state.productionOrders.find(o => o.productionOrderId === productionOrderId)
    if (!order) return { ok: false, message: `生产单 ${productionOrderId} ���存在` }
    if (!nextStatus) return { ok: false, message: '目标状态不能为空' }

    const current = order.lifecycleStatus ?? 'DRAFT'

    // 允许的推进路径
    const ALLOWED_FORWARD: Record<string, string> = {
      DRAFT: 'PLANNED',
      PLANNED: 'RELEASED',
      RELEASED: 'IN_PRODUCTION',
      IN_PRODUCTION: 'QC_PENDING',
      QC_PENDING: 'COMPLETED',
      COMPLETED: 'CLOSED',
    }
    // 允许的有限回退路径
    const ALLOWED_BACKWARD: Record<string, string> = {
      RELEASED: 'PLANNED',
      IN_PRODUCTION: 'RELEASED',
      QC_PENDING: 'IN_PRODUCTION',
      COMPLETED: 'QC_PENDING',
    }

    const isForward = ALLOWED_FORWARD[current] === nextStatus
    const isBackward = ALLOWED_BACKWARD[current] === nextStatus
    if (!isForward && !isBackward) {
      return { ok: false, message: '当前状态不允许切换到目标状态' }
    }

    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({
      type: 'UPDATE_ORDER',
      payload: {
        ...order,
        lifecycleStatus: nextStatus,
        lifecycleStatusRemark: remark,
        lifecycleUpdatedAt: ts,
        lifecycleUpdatedBy: by,
        updatedAt: ts,
      },
    })
    return { ok: true }
  }

  // =============================================
  // ProductionOrderChange actions
  // =============================================

  const createProductionOrderChange = (
    input: {
      productionOrderId: string
      changeType: ProductionChangeType
      beforeValue?: string
      afterValue?: string
      impactScopeZh?: string
      reason: string
      remark?: string
    },
    by: string,
  ): { ok: boolean; changeId?: string; message?: string } => {
    const { productionOrderId, changeType, beforeValue, afterValue, impactScopeZh, reason, remark } = input
    if (!productionOrderId) return { ok: false, message: '生产单不能为空' }
    const order = state.productionOrders.find(o => o.productionOrderId === productionOrderId)
    if (!order) return { ok: false, message: `生产单 ${productionOrderId} 不存在` }
    if (!changeType) return { ok: false, message: '变更类型不能为空' }
    if (!reason?.trim()) return { ok: false, message: '变更原因不能为空' }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const month = ts.slice(0, 7).replace('-', '')
    const changeId = `CHG-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
    const change: ProductionOrderChange = {
      changeId,
      productionOrderId,
      changeType,
      beforeValue,
      afterValue,
      impactScopeZh,
      reason,
      status: 'DRAFT',
      remark,
      createdAt: ts,
      createdBy: by,
    }
    dispatch({ type: 'ADD_PRODUCTION_ORDER_CHANGE', payload: change })
    return { ok: true, changeId }
  }

  const updateProductionOrderChangeStatus = (
    input: { changeId: string; nextStatus: ProductionChangeStatus; remark?: string },
    by: string,
  ): { ok: boolean; message?: string } => {
    const { changeId, nextStatus, remark } = input
    const change = state.productionOrderChanges.find(c => c.changeId === changeId)
    if (!change) return { ok: false, message: `变更单 ${changeId} ��存在` }
    if (!nextStatus) return { ok: false, message: '目标状态不能为空' }
    const ALLOWED: Record<string, string[]> = {
      DRAFT: ['PENDING', 'CANCELLED'],
      PENDING: ['DONE', 'CANCELLED'],
      DONE: [],
      CANCELLED: [],
    }
    if (!ALLOWED[change.status]?.includes(nextStatus)) {
      return { ok: false, message: '当前变更状态不允许切换到目标状态' }
    }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({
      type: 'UPDATE_PRODUCTION_ORDER_CHANGE',
      payload: { ...change, status: nextStatus, remark: remark ?? change.remark, updatedAt: ts, updatedBy: by },
    })
    return { ok: true }
  }

  const updateProductionDeliveryWarehouse = (
    input: {
      productionOrderId: string
      deliveryWarehouseId: string
      deliveryWarehouseName?: string
      deliveryWarehouseRemark?: string
    },
    by: string,
  ): { ok: boolean; message?: string } => {
    const { productionOrderId, deliveryWarehouseId, deliveryWarehouseName, deliveryWarehouseRemark } = input
    const order = state.productionOrders.find(o => o.productionOrderId === productionOrderId)
    if (!order) return { ok: false, message: `生产单 ${productionOrderId} 不存在` }
    if (!deliveryWarehouseId?.trim()) return { ok: false, message: '交付仓ID不能为空' }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({
      type: 'UPDATE_ORDER',
      payload: {
        ...order,
        deliveryWarehouseId,
        deliveryWarehouseName: deliveryWarehouseName?.trim() || deliveryWarehouseId,
        deliveryWarehouseStatus: 'SET',
        deliveryWarehouseRemark,
        deliveryWarehouseUpdatedAt: ts,
        deliveryWarehouseUpdatedBy: by,
        updatedAt: ts,
      },
    })
    return { ok: true }
  }

  // =============================================
  // 招标单台账 actions
  // =============================================

  const createTenderOrder = (
    input: {
      taskIds: string[]
      titleZh?: string
      targetFactoryIds?: string[]
      bidDeadline?: string
      remark?: string
    },
    by: string,
  ): { ok: boolean; tenderId?: string; message?: string } => {
    const { taskIds, titleZh, targetFactoryIds, bidDeadline, remark } = input
    if (!taskIds || taskIds.length === 0) return { ok: false, message: '关联任务不能为空' }
    for (const id of taskIds) {
      const task = state.processTasks.find(t => t.taskId === id)
      if (!task) return { ok: false, message: `任务 ${id} 不存在` }
      if (task.assignmentStatus === 'DONE' || task.assignmentStatus === 'CANCELLED' as string) {
        return { ok: false, message: `任务 ${id} 已完成或已取消，不可创建招标单` }
      }
    }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const month = ts.slice(0, 7).replace('-', '')
    const tenderId = `TD-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
    // 若所有任务属于同一生产单，填入 productionOrderId
    const orderIds = [...new Set(taskIds.map(id => state.processTasks.find(t => t.taskId === id)?.productionOrderId).filter(Boolean))]
    const productionOrderId = orderIds.length === 1 ? (orderIds[0] as string) : undefined
    const order: TenderOrder = {
      tenderId,
      productionOrderId,
      taskIds,
      titleZh: titleZh?.trim() || `招标单 ${tenderId}`,
      targetFactoryIds: targetFactoryIds ?? [],
      bidDeadline,
      status: 'DRAFT',
      remark,
      createdAt: ts,
      createdBy: by,
    }
    dispatch({ type: 'ADD_TENDER_ORDER', payload: order })
    return { ok: true, tenderId }
  }

  const updateTenderOrderStatus = (
    input: { tenderId: string; nextStatus: TenderOrderStatus; remark?: string },
    by: string,
  ): { ok: boolean; message?: string } => {
    const { tenderId, nextStatus, remark } = input
    const order = state.tenderOrders.find(t => t.tenderId === tenderId)
    if (!order) return { ok: false, message: `招标单 ${tenderId} 不存在` }
    if (!nextStatus) return { ok: false, message: '目标状态不能为空' }
    const ALLOWED: Record<TenderOrderStatus, TenderOrderStatus[]> = {
      DRAFT: ['OPEN', 'VOID'],
      OPEN: ['CLOSED', 'VOID'],
      CLOSED: [],
      VOID: [],
    }
    if (!ALLOWED[order.status]?.includes(nextStatus)) {
      return { ok: false, message: '当前招标单状态不允许切换到目标状态' }
    }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({
      type: 'UPDATE_TENDER_ORDER',
      payload: { ...order, status: nextStatus, remark: remark ?? order.remark, updatedAt: ts, updatedBy: by },
    })
    return { ok: true }
  }

  const awardTenderOrder = (
    input: {
      tenderId: string
      candidateFactoryIds: string[]
      awardedFactoryId: string
      awardRemark?: string
    },
    by: string,
  ): { ok: boolean; message?: string } => {
    const { tenderId, candidateFactoryIds, awardedFactoryId, awardRemark } = input
    const order = state.tenderOrders.find(t => t.tenderId === tenderId)
    if (!order) return { ok: false, message: `招标单 ${tenderId} 不存在` }
    if (order.status === 'VOID') return { ok: false, message: '招标单已作废，不可定标' }
    if (order.awardStatus === 'AWARDED') return { ok: true }
    if (!candidateFactoryIds || candidateFactoryIds.length === 0) return { ok: false, message: '候选工厂不能为空' }
    if (!awardedFactoryId?.trim()) return { ok: false, message: '中标工厂不能为空' }
    if (!candidateFactoryIds.includes(awardedFactoryId)) return { ok: false, message: '中标工厂必须在候选工厂列表中' }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({
      type: 'UPDATE_TENDER_ORDER',
      payload: {
        ...order,
        candidateFactoryIds,
        awardedFactoryId,
        awardStatus: 'AWARDED',
        awardRemark,
        awardedAt: ts,
        awardedBy: by,
        status: order.status === 'OPEN' ? 'CLOSED' : order.status,
        updatedAt: ts,
        updatedBy: by,
      },
    })
    return { ok: true }
  }

  const voidTenderAward = (
    input: { tenderId: string; remark?: string },
    by: string,
  ): { ok: boolean; message?: string } => {
    const { tenderId, remark } = input
    const order = state.tenderOrders.find(t => t.tenderId === tenderId)
    if (!order) return { ok: false, message: `招标单 ${tenderId} 不存在` }
    if (order.awardStatus === 'VOID') return { ok: true }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({
      type: 'UPDATE_TENDER_ORDER',
      payload: {
        ...order,
        awardStatus: 'VOID',
        awardRemark: remark ?? order.awardRemark,
        awardedAt: ts,
        awardedBy: by,
        updatedAt: ts,
        updatedBy: by,
      },
    })
    return { ok: true }
  }

  // =============================================
  // 派单/竞价异常台账 actions（复用 ExceptionCase / addException / updateException）
  // =============================================

  // caseStatus mapping: PENDING->OPEN, PROCESSING->IN_PROGRESS, RESOLVED->RESOLVED, CLOSED->CLOSED
  const toCaseStatus = (s: DispatchExceptionStatus): CaseStatus =>
    s === 'PENDING' ? 'OPEN' : s === 'PROCESSING' ? 'IN_PROGRESS' : s === 'RESOLVED' ? 'RESOLVED' : 'CLOSED'

  const createDispatchException = (
    input: {
      exceptionType: DispatchExceptionType
      sourceType: 'TASK' | 'TENDER' | 'AWARD'
      sourceId: string
      productionOrderId?: string
      titleZh?: string
      descriptionZh?: string
      remark?: string
    },
    by: string,
  ): { ok: boolean; exceptionId?: string; message?: string } => {
    const { exceptionType, sourceType, sourceId, productionOrderId, titleZh, descriptionZh, remark } = input
    if (!exceptionType) return { ok: false, message: '异常类型不能为空' }
    if (!sourceType) return { ok: false, message: '来源对象不能为空' }
    if (!sourceId?.trim()) return { ok: false, message: '来源ID不能为空' }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const month = ts.slice(0, 7).replace('-', '')
    const exceptionId = `DEX-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
    const meta = DISPATCH_EX_REASON[exceptionType]
    const mappedSourceType: 'TASK' | 'ORDER' | 'TENDER' =
      sourceType === 'AWARD' ? 'TENDER' : sourceType === 'TASK' ? 'TASK' : 'TENDER'
    const exception: ExceptionCase = {
      caseId: exceptionId,
      caseStatus: 'OPEN',
      severity: 'S3',
      category: meta.category,
      reasonCode: meta.reasonCode,
      sourceType: mappedSourceType,
      sourceId,
      relatedOrderIds: productionOrderId ? [productionOrderId] : [],
      relatedTaskIds: sourceType === 'TASK' ? [sourceId] : [],
      relatedTenderIds: sourceType !== 'TASK' ? [sourceId] : [],
      summary: titleZh?.trim() || meta.defaultTitle,
      detail: descriptionZh?.trim() || remark?.trim() || '',
      createdAt: ts,
      updatedAt: ts,
      slaDueAt: calculateSlaDue('S3', ts),
      tags: ['DISPATCH'],
      actions: [],
      auditLogs: [{ id: `AL-${exceptionId}-01`, action: 'CREATE', detail: '登记异常', at: ts, by }],
    }
    dispatch({ type: 'ADD_EXCEPTION', payload: exception })
    return { ok: true, exceptionId }
  }

  const updateDispatchExceptionStatus = (
    input: { exceptionId: string; nextStatus: DispatchExceptionStatus; remark?: string },
    by: string,
  ): { ok: boolean; message?: string } => {
    const { exceptionId, nextStatus, remark } = input
    const ex = state.exceptions.find(e => e.caseId === exceptionId)
    if (!ex) return { ok: false, message: `异常单 ${exceptionId} 不存在` }
    if (!nextStatus) return { ok: false, message: '目标状态不能为空' }
    const CURRENT = ex.caseStatus
    const nextCase = toCaseStatus(nextStatus)
    const ALLOWED: Partial<Record<CaseStatus, CaseStatus[]>> = {
      OPEN: ['IN_PROGRESS', 'CLOSED'],
      IN_PROGRESS: ['RESOLVED', 'CLOSED'],
      RESOLVED: ['CLOSED'],
    }
    if (!ALLOWED[CURRENT]?.includes(nextCase)) {
      return { ok: false, message: '当前异常状态不允许切换到目标状态' }
    }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const updated: ExceptionCase = {
      ...ex,
      caseStatus: nextCase,
      updatedAt: ts,
      resolvedAt: nextStatus === 'RESOLVED' || nextStatus === 'CLOSED' ? ts : ex.resolvedAt,
      resolvedBy: nextStatus === 'RESOLVED' || nextStatus === 'CLOSED' ? by : ex.resolvedBy,
      auditLogs: [
        ...ex.auditLogs,
        { id: `AL-${exceptionId}-${Date.now()}`, action: 'STATUS_CHANGE', detail: remark?.trim() || `状态变更为${nextStatus}`, at: ts, by },
      ],
    }
    dispatch({ type: 'UPDATE_EXCEPTION', payload: updated })
    return { ok: true }
  }

  // =============================================
  // 领料需求单 actions
  // =============================================

  const createMaterialIssueSheet = (
    input: {
      taskId: string
      productionOrderId?: string
      materialSummaryZh: string
      requestedQty: number
      remark?: string
    },
    by: string,
  ): { ok: boolean; issueId?: string; message?: string } => {
    const { taskId, materialSummaryZh, requestedQty, remark } = input
    if (!taskId?.trim()) return { ok: false, message: '任务ID不能为空' }
    const task = state.processTasks.find(t => t.taskId === taskId)
    if (!task) return { ok: false, message: `任务 ${taskId} 不存在` }
    if (!materialSummaryZh?.trim()) return { ok: false, message: '用料摘要不能为空' }
    if (!requestedQty || requestedQty <= 0) return { ok: false, message: '需求数量必须大于 0' }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const month = ts.slice(0, 7).replace('-', '')
    const issueId = `MIS-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
    const productionOrderId = input.productionOrderId ?? task.productionOrderId
    const sheet: MaterialIssueSheet = {
      issueId,
      productionOrderId,
      taskId,
      materialSummaryZh: materialSummaryZh.trim(),
      requestedQty,
      issuedQty: 0,
      status: 'DRAFT',
      remark,
      createdAt: ts,
      createdBy: by,
    }
    dispatch({ type: 'ADD_MATERIAL_ISSUE_SHEET', payload: sheet })
    return { ok: true, issueId }
  }

  const updateMaterialIssueSheet = (
    input: {
      issueId: string
      materialSummaryZh?: string
      requestedQty?: number
      issuedQty?: number
      remark?: string
    },
    by: string,
  ): { ok: boolean; message?: string } => {
    const { issueId, materialSummaryZh, requestedQty, issuedQty, remark } = input
    const sheet = state.materialIssueSheets.find(s => s.issueId === issueId)
    if (!sheet) return { ok: false, message: `领料需求单 ${issueId} 不存在` }
    if (requestedQty !== undefined && requestedQty <= 0) return { ok: false, message: '需求数量必须大于 0' }
    if (issuedQty !== undefined && issuedQty < 0) return { ok: false, message: '已下发数量��能为负数' }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const newRequestedQty = requestedQty ?? sheet.requestedQty
    const newIssuedQty = issuedQty ?? sheet.issuedQty
    let newStatus: MaterialIssueStatus = sheet.status
    if (issuedQty !== undefined) {
      if (newIssuedQty <= 0) {
        // leave status as-is unless it was PARTIAL
      } else if (newIssuedQty >= newRequestedQty) {
        newStatus = 'ISSUED'
      } else {
        newStatus = 'PARTIAL'
      }
    }
    const updated: MaterialIssueSheet = {
      ...sheet,
      materialSummaryZh: materialSummaryZh?.trim() ?? sheet.materialSummaryZh,
      requestedQty: newRequestedQty,
      issuedQty: newIssuedQty,
      status: newStatus,
      remark: remark ?? sheet.remark,
      updatedAt: ts,
      updatedBy: by,
    }
    dispatch({ type: 'UPDATE_MATERIAL_ISSUE_SHEET', payload: updated })
    return { ok: true }
  }

  const updateMaterialIssueStatus = (
    input: { issueId: string; nextStatus: MaterialIssueStatus; remark?: string },
    by: string,
  ): { ok: boolean; message?: string } => {
    const { issueId, nextStatus, remark } = input
    const sheet = state.materialIssueSheets.find(s => s.issueId === issueId)
    if (!sheet) return { ok: false, message: `领料需求单 ${issueId} 不存在` }
    if (!nextStatus) return { ok: false, message: '目标状态不能为空' }
    const ALLOWED: Partial<Record<MaterialIssueStatus, MaterialIssueStatus[]>> = {
      DRAFT: ['TO_ISSUE'],
      TO_ISSUE: ['PARTIAL', 'ISSUED'],
      PARTIAL: ['ISSUED', 'TO_ISSUE'],
      ISSUED: [],
    }
    if (!ALLOWED[sheet.status]?.includes(nextStatus)) {
      return { ok: false, message: '当前领料状态不允许切换到目标状态' }
    }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({
      type: 'UPDATE_MATERIAL_ISSUE_SHEET',
      payload: { ...sheet, status: nextStatus, remark: remark ?? sheet.remark, updatedAt: ts, updatedBy: by },
    })
    return { ok: true }
  }

  // =============================================
  // 质检点/验收标准单 actions
  // =============================================

  const createQcStandardSheet = (
    input: {
      taskId: string
      productionOrderId?: string
      checkpointSummaryZh: string
      acceptanceSummaryZh: string
      samplingSummaryZh?: string
      remark?: string
    },
    by: string,
  ): { ok: boolean; standardId?: string; message?: string } => {
    const { taskId, checkpointSummaryZh, acceptanceSummaryZh, samplingSummaryZh, remark } = input
    if (!taskId?.trim()) return { ok: false, message: '任务ID不能为空' }
    const task = state.processTasks.find(t => t.taskId === taskId)
    if (!task) return { ok: false, message: `任务 ${taskId} 不存在` }
    if (!checkpointSummaryZh?.trim()) return { ok: false, message: '质检点摘要不能为空' }
    if (!acceptanceSummaryZh?.trim()) return { ok: false, message: '验收标准摘要不能为空' }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const month = ts.slice(0, 7).replace('-', '')
    const standardId = `QCS-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
    const productionOrderId = input.productionOrderId ?? task.productionOrderId
    const sheet: QcStandardSheet = {
      standardId,
      productionOrderId,
      taskId,
      checkpointSummaryZh: checkpointSummaryZh.trim(),
      acceptanceSummaryZh: acceptanceSummaryZh.trim(),
      samplingSummaryZh: samplingSummaryZh?.trim(),
      status: 'DRAFT',
      remark,
      createdAt: ts,
      createdBy: by,
    }
    dispatch({ type: 'ADD_QC_STANDARD_SHEET', payload: sheet })
    return { ok: true, standardId }
  }

  const updateQcStandardSheet = (
    input: {
      standardId: string
      checkpointSummaryZh?: string
      acceptanceSummaryZh?: string
      samplingSummaryZh?: string
      remark?: string
    },
    by: string,
  ): { ok: boolean; message?: string } => {
    const { standardId, checkpointSummaryZh, acceptanceSummaryZh, samplingSummaryZh, remark } = input
    const sheet = state.qcStandardSheets.find(s => s.standardId === standardId)
    if (!sheet) return { ok: false, message: `质检标准单 ${standardId} 不存在` }
    if (checkpointSummaryZh !== undefined && !checkpointSummaryZh.trim()) return { ok: false, message: '质检���摘要不能为空' }
    if (acceptanceSummaryZh !== undefined && !acceptanceSummaryZh.trim()) return { ok: false, message: '验收标准摘要不能为空' }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const updated: QcStandardSheet = {
      ...sheet,
      checkpointSummaryZh: checkpointSummaryZh?.trim() ?? sheet.checkpointSummaryZh,
      acceptanceSummaryZh: acceptanceSummaryZh?.trim() ?? sheet.acceptanceSummaryZh,
      samplingSummaryZh: samplingSummaryZh?.trim() ?? sheet.samplingSummaryZh,
      remark: remark ?? sheet.remark,
      updatedAt: ts,
      updatedBy: by,
    }
    dispatch({ type: 'UPDATE_QC_STANDARD_SHEET', payload: updated })
    return { ok: true }
  }

  const updateQcStandardStatus = (
    input: { standardId: string; nextStatus: QcStandardStatus; remark?: string },
    by: string,
  ): { ok: boolean; message?: string } => {
    const { standardId, nextStatus, remark } = input
    const sheet = state.qcStandardSheets.find(s => s.standardId === standardId)
    if (!sheet) return { ok: false, message: `质检标准单 ${standardId} 不存在` }
    if (!nextStatus) return { ok: false, message: '目标状态���能为空' }
    const ALLOWED: Partial<Record<QcStandardStatus, QcStandardStatus[]>> = {
      DRAFT: ['TO_RELEASE', 'VOID'],
      TO_RELEASE: ['RELEASED', 'VOID'],
      RELEASED: [],
      VOID: [],
    }
    if (!ALLOWED[sheet.status]?.includes(nextStatus)) {
      return { ok: false, message: '当前标准状态不允许切换到目标状态' }
    }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({
      type: 'UPDATE_QC_STANDARD_SHEET',
      payload: { ...sheet, status: nextStatus, remark: remark ?? sheet.remark, updatedAt: ts, updatedBy: by },
    })
    return { ok: true }
  }

  // =============================================
  // 领料对账单 actions
  // =============================================

  const generateMaterialStatementDraft = (
    input: { productionOrderId: string; issueIds: string[]; remark?: string },
    by: string,
  ): { ok: boolean; materialStatementId?: string; message?: string } => {
    const { productionOrderId, issueIds, remark } = input
    if (!productionOrderId?.trim()) return { ok: false, message: '生产单号不能为空' }
    if (!issueIds || issueIds.length === 0) return { ok: false, message: '至少选择一条领料需求' }
    // validate each issue
    for (const id of issueIds) {
      const issue = state.materialIssueSheets.find(s => s.issueId === id)
      if (!issue) return { ok: false, message: `领料需求 ${id} 不存在` }
      if (issue.productionOrderId !== productionOrderId) return { ok: false, message: `领料需求 ${id} 不属于生产单 ${productionOrderId}` }
      if (issue.status !== 'PARTIAL' && issue.status !== 'ISSUED') return { ok: false, message: `领料需求 ${id} 状态不符，仅允许部分下发或已下发` }
    }
    // dedup check: issue must not be in any non-CLOSED materialStatementDraft
    const occupiedIds = new Set<string>()
    for (const d of state.materialStatementDrafts) {
      if (d.status !== 'CLOSED') d.issueIds.forEach(id => occupiedIds.add(id))
    }
    for (const id of issueIds) {
      if (occupiedIds.has(id)) return { ok: false, message: '存在已纳入未关闭领料对账单的领料需求' }
    }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const month = ts.slice(0, 7).replace('-', '')
    const materialStatementId = `MST-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
    const items: MaterialStatementItem[] = issueIds.map(id => {
      const s = state.materialIssueSheets.find(x => x.issueId === id)!
      return { issueId: s.issueId, taskId: s.taskId, materialSummaryZh: s.materialSummaryZh, requestedQty: s.requestedQty, issuedQty: s.issuedQty }
    })
    const draft: MaterialStatementDraft = {
      materialStatementId,
      productionOrderId,
      itemCount: items.length,
      totalRequestedQty: items.reduce((acc, i) => acc + i.requestedQty, 0),
      totalIssuedQty: items.reduce((acc, i) => acc + i.issuedQty, 0),
      status: 'DRAFT',
      issueIds,
      items,
      remark,
      createdAt: ts,
      createdBy: by,
    }
    dispatch({ type: 'ADD_MATERIAL_STATEMENT_DRAFT', payload: draft })
    return { ok: true, materialStatementId }
  }

  const confirmMaterialStatementDraft = (
    materialStatementId: string,
    by: string,
  ): { ok: boolean; message?: string } => {
    const d = state.materialStatementDrafts.find(x => x.materialStatementId === materialStatementId)
    if (!d) return { ok: false, message: `领料对账单 ${materialStatementId} 不存在` }
    if (d.status === 'CONFIRMED') return { ok: true }
    if (d.status === 'CLOSED') return { ok: false, message: '已关闭的领料对账单不允许确认' }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({ type: 'UPDATE_MATERIAL_STATEMENT_DRAFT', payload: { ...d, status: 'CONFIRMED', updatedAt: ts, updatedBy: by } })
    return { ok: true }
  }

  const closeMaterialStatementDraft = (
    materialStatementId: string,
    by: string,
  ): { ok: boolean; message?: string } => {
    const d = state.materialStatementDrafts.find(x => x.materialStatementId === materialStatementId)
    if (!d) return { ok: false, message: `领料对账单 ${materialStatementId} 不存在` }
    if (d.status === 'CLOSED') return { ok: true }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({ type: 'UPDATE_MATERIAL_STATEMENT_DRAFT', payload: { ...d, status: 'CLOSED', updatedAt: ts, updatedBy: by } })
    return { ok: true }
  }

  const updateTaskStatus = (
    taskId: string,
    newStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'CANCELLED',
    blockReason?: BlockReason,
    blockRemark?: string,
    by: string = 'Admin'
  ) => {
    dispatch({ type: 'UPDATE_TASK_STATUS', payload: { taskId, newStatus, blockReason, blockRemark, by } })
  }

  // Exception methods
  const getExceptionById = (caseId: string) =>
    state.exceptions.find(e => e.caseId === caseId)

  const getExceptionsByTaskId = (taskId: string) =>
    state.exceptions.filter(e => e.relatedTaskIds.includes(taskId))

  const getExceptionsByOrderId = (orderId: string) =>
    state.exceptions.filter(e => e.relatedOrderIds.includes(orderId))

  const getExceptionsByTenderId = (tenderId: string) =>
    state.exceptions.filter(e => e.relatedTenderIds.includes(tenderId))

  const addException = (exception: ExceptionCase) => {
    dispatch({ type: 'ADD_EXCEPTION', payload: exception })
  }

  const updateException = (exception: ExceptionCase) => {
    dispatch({ type: 'UPDATE_EXCEPTION', payload: exception })
  }

  // 根据信号创��或更新异���单
  const createOrUpdateExceptionFromSignal = (signal: {
    sourceType: 'TASK' | 'ORDER' | 'TENDER'
    sourceId: string
    reasonCode: ReasonCode
    detail?: string
  }): ExceptionCase => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    // 检查是否已存在非关闭的异常单
    const existing = state.exceptions.find(
      e => e.sourceType === signal.sourceType &&
        e.sourceId === signal.sourceId &&
        e.reasonCode === signal.reasonCode &&
        e.caseStatus !== 'CLOSED'
    )

    if (existing) {
      // 更新现有异常单
      const updated: ExceptionCase = {
        ...existing,
        updatedAt: now,
        detail: signal.detail || existing.detail,
        auditLogs: [
          ...existing.auditLogs,
          { id: `EAL-${Date.now()}`, action: 'UPDATE', detail: '信号重新触发，更新异常', at: now, by: '系统' },
        ],
      }
      dispatch({ type: 'UPDATE_EXCEPTION', payload: updated })
      return updated
    }

    // 确定 severity
    const s1Reasons: ReasonCode[] = ['TENDER_OVERDUE', 'NO_BID', 'FACTORY_BLACKLISTED', 'HANDOVER_DIFF']
    const s2Reasons: ReasonCode[] = ['DISPATCH_REJECTED', 'ACK_TIMEOUT', 'TENDER_NEAR_DEADLINE', 'TECH_PACK_NOT_RELEASED', 'MATERIAL_NOT_READY']
    let severity: Severity = 'S3'
    if (s1Reasons.includes(signal.reasonCode)) severity = 'S1'
    else if (s2Reasons.includes(signal.reasonCode) || signal.reasonCode.startsWith('BLOCKED_')) severity = 'S2'

    // 确定 category
    let category: ExceptionCategory = 'PRODUCTION_BLOCK'
    if (signal.reasonCode.startsWith('BLOCKED_')) category = 'PRODUCTION_BLOCK'
    else if (['TENDER_OVERDUE', 'TENDER_NEAR_DEADLINE', 'NO_BID', 'PRICE_ABNORMAL', 'DISPATCH_REJECTED', 'ACK_TIMEOUT', 'FACTORY_BLACKLISTED'].includes(signal.reasonCode)) category = 'ASSIGNMENT'
    else if (signal.reasonCode === 'TECH_PACK_NOT_RELEASED') category = 'TECH_PACK'
    else if (signal.reasonCode === 'HANDOVER_DIFF') category = 'HANDOVER'
    else if (signal.reasonCode === 'MATERIAL_NOT_READY') category = 'MATERIAL'

    // 收集关联对象
    let relatedOrderIds: string[] = []
    let relatedTaskIds: string[] = []
    let relatedTenderIds: string[] = []

    if (signal.sourceType === 'TASK') {
      const task = state.processTasks.find(t => t.taskId === signal.sourceId)
      relatedTaskIds = [signal.sourceId]
      if (task) {
        relatedOrderIds = [task.productionOrderId]
        if (task.tenderId) relatedTenderIds = [task.tenderId]
      }
    } else if (signal.sourceType === 'ORDER') {
      relatedOrderIds = [signal.sourceId]
      relatedTaskIds = state.processTasks.filter(t => t.productionOrderId === signal.sourceId).map(t => t.taskId)
    } else if (signal.sourceType === 'TENDER') {
      const tender = state.tenders.find(t => t.tenderId === signal.sourceId)
      relatedTenderIds = [signal.sourceId]
      if (tender) {
        relatedOrderIds = tender.productionOrderIds
        relatedTaskIds = tender.taskIds
      }
    }

    // 生成摘要
    const reasonSummaries: Record<ReasonCode, string> = {
      BLOCKED_MATERIAL: '物料暂不能继续',
      BLOCKED_CAPACITY: '产能暂不能继续',
      BLOCKED_QUALITY: '质量返工',
      BLOCKED_TECH: '工艺资料暂不能继续',
      BLOCKED_EQUIPMENT: '设备暂不能继续',
      BLOCKED_OTHER: '其他暂不能继续',
      TENDER_OVERDUE: '竞价已逾期',
      TENDER_NEAR_DEADLINE: '竞价即将截止',
      NO_BID: '竞价无人报价',
      PRICE_ABNORMAL: '报价异常',
      DISPATCH_REJECTED: '派单被拒',
      ACK_TIMEOUT: '派单确认超时',
      TECH_PACK_NOT_RELEASED: '技术包未发布',
      FACTORY_BLACKLISTED: '工厂黑名单',
      HANDOVER_DIFF: '交接差异',
      MATERIAL_NOT_READY: '物料未齐套',
    }

    const newCase: ExceptionCase = {
      caseId: generateCaseId(),
      caseStatus: 'OPEN',
      severity,
      category,
      reasonCode: signal.reasonCode,
      sourceType: signal.sourceType,
      sourceId: signal.sourceId,
      relatedOrderIds,
      relatedTaskIds,
      relatedTenderIds,
      summary: reasonSummaries[signal.reasonCode] || signal.reasonCode,
      detail: signal.detail || `${signal.sourceType} ${signal.sourceId} ��发异常：${reasonSummaries[signal.reasonCode]}`,
      createdAt: now,
      updatedAt: now,
      slaDueAt: calculateSlaDue(severity, now),
      tags: [],
      actions: [],
      auditLogs: [
        { id: `EAL-${Date.now()}`, action: 'CREATE', detail: '系统自动生成异常单', at: now, by: '系统' },
      ],
    }

    dispatch({ type: 'ADD_EXCEPTION', payload: newCase })
    return newCase
  }

  // 延长竞价截止时间
  const extendTenderDeadline = (tenderId: string, hours: number = 24) => {
    const tender = state.tenders.find(t => t.tenderId === tenderId)
    if (!tender) return

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const currentDeadline = new Date(tender.deadline.replace(' ', 'T'))
    currentDeadline.setHours(currentDeadline.getHours() + hours)
    const newDeadline = currentDeadline.toISOString().replace('T', ' ').slice(0, 19)

    const updatedTender: Tender = {
      ...tender,
      deadline: newDeadline,
      status: 'OPEN',
      updatedAt: now,
      auditLogs: [
        ...tender.auditLogs,
        { id: `TAL-${Date.now()}`, action: 'EXTEND', detail: `竞价截止时间延长${hours}小时`, at: now, by: 'Admin' },
      ],
    }
    dispatch({ type: 'UPDATE_TENDER', payload: updatedTender })
  }

  // Handover methods
  const getHandoverEventById = (eventId: string) =>
    state.handoverEvents.find(e => e.eventId === eventId)

  const getHandoverEventsByOrderId = (orderId: string) =>
    state.handoverEvents.filter(e => e.productionOrderId === orderId)

  const getHandoverEventsByTaskId = (taskId: string) =>
    state.handoverEvents.filter(e => e.relatedTaskId === taskId)

  const createHandoverEvent = (payload: Omit<HandoverEvent, 'eventId' | 'createdAt' | 'auditLogs'>): HandoverEvent => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const eventId = generateHandoverEventId()

    const newEvent: HandoverEvent = {
      ...payload,
      eventId,
      createdAt: now,
      auditLogs: [
        { id: `HAL-${Date.now()}`, action: 'CREATE', detail: '创建交接事件', at: now, by: payload.createdBy },
      ],
    }

    dispatch({ type: 'ADD_HANDOVER_EVENT', payload: newEvent })

    // 如果有差异，自动生成异常单
    if (newEvent.qtyDiff !== 0 || newEvent.status === 'DISPUTED') {
      const sourceType = newEvent.relatedTaskId ? 'TASK' : 'ORDER'
      const sourceId = newEvent.relatedTaskId || newEvent.productionOrderId
      const order = state.productionOrders.find(o => o.productionOrderId === newEvent.productionOrderId)
      createOrUpdateExceptionFromSignal({
        sourceType,
        sourceId,
        reasonCode: 'HANDOVER_DIFF',
        detail: `交接差异：${newEvent.fromParty.name} -> ${newEvent.toParty.name}，应交${newEvent.qtyExpected}，实交${newEvent.qtyActual}，差异${newEvent.qtyDiff}${newEvent.diffReasonCode ? `，原因：${newEvent.diffReasonCode}` : ''}${order ? `，生产单：${order.productionOrderId}` : ''}`,
      })
    }

    return newEvent
  }

  const confirmHandoverEvent = (eventId: string, by: string) => {
    const event = state.handoverEvents.find(e => e.eventId === eventId)
    if (!event || event.status !== 'PENDING_CONFIRM') return

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    // 如果有���异，设为 DISPUTED
    const newStatus: HandoverStatus = event.qtyDiff !== 0 ? 'DISPUTED' : 'CONFIRMED'

    const updatedEvent: HandoverEvent = {
      ...event,
      status: newStatus,
      confirmedAt: now,
      confirmedBy: by,
      auditLogs: [
        ...event.auditLogs,
        { id: `HAL-${Date.now()}`, action: newStatus === 'DISPUTED' ? 'DISPUTE' : 'CONFIRM', detail: newStatus === 'DISPUTED' ? `确认时发现差异，标记争议` : '确认交接', at: now, by },
      ],
    }

    dispatch({ type: 'UPDATE_HANDOVER_EVENT', payload: updatedEvent })

    // 如果有差异，生成异常单
    if (event.qtyDiff !== 0) {
      const sourceType = event.relatedTaskId ? 'TASK' : 'ORDER'
      const sourceId = event.relatedTaskId || event.productionOrderId
      const order = state.productionOrders.find(o => o.productionOrderId === event.productionOrderId)
      createOrUpdateExceptionFromSignal({
        sourceType,
        sourceId,
        reasonCode: 'HANDOVER_DIFF',
        detail: `交接差异确认：${event.fromParty.name} -> ${event.toParty.name}，应交${event.qtyExpected}，实交${event.qtyActual}，差异${event.qtyDiff}${event.diffReasonCode ? `，原因：${event.diffReasonCode}` : ''}${order ? `，生产单：${order.productionOrderId}` : ''}`,
      })
    }
  }

  const markHandoverDisputed = (eventId: string, reason: string, by: string) => {
    const event = state.handoverEvents.find(e => e.eventId === eventId)
    if (!event) return

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const updatedEvent: HandoverEvent = {
      ...event,
      status: 'DISPUTED',
      diffRemark: reason,
      auditLogs: [
        ...event.auditLogs,
        { id: `HAL-${Date.now()}`, action: 'DISPUTE', detail: `标记争议：${reason}`, at: now, by },
      ],
    }

    dispatch({ type: 'UPDATE_HANDOVER_EVENT', payload: updatedEvent })

    // 生成异常单
    const sourceType = event.relatedTaskId ? 'TASK' : 'ORDER'
    const sourceId = event.relatedTaskId || event.productionOrderId
    const order = state.productionOrders.find(o => o.productionOrderId === event.productionOrderId)
    createOrUpdateExceptionFromSignal({
      sourceType,
      sourceId,
      reasonCode: 'HANDOVER_DIFF',
      detail: `交接争议：${event.fromParty.name} -> ${event.toParty.name}，原因：${reason}${order ? `，生产单：${order.productionOrderId}` : ''}`,
    })
  }

  const voidHandoverEvent = (eventId: string, by: string) => {
    const event = state.handoverEvents.find(e => e.eventId === eventId)
    if (!event) return

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const updatedEvent: HandoverEvent = {
      ...event,
      status: 'VOID',
      auditLogs: [
        ...event.auditLogs,
        { id: `HAL-${Date.now()}`, action: 'VOID', detail: '作废交接事件', at: now, by },
      ],
    }

    dispatch({ type: 'UPDATE_HANDOVER_EVENT', payload: updatedEvent })
  }

  // Notification methods
  const createNotification = (payload: Omit<Notification, 'notificationId' | 'createdAt'>): Notification => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const notificationId = generateNotificationId()

    const newNotification: Notification = {
      ...payload,
      notificationId,
      createdAt: now,
    }

    dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification })
    return newNotification
  }

  const markNotificationRead = (notificationId: string) => {
    const notification = state.notifications.find(n => n.notificationId === notificationId)
    if (!notification || notification.readAt) return

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const updatedNotification: Notification = {
      ...notification,
      readAt: now,
    }

    dispatch({ type: 'UPDATE_NOTIFICATION', payload: updatedNotification })
  }

  const markAllNotificationsRead = (filter?: { recipientType?: RecipientType; recipientId?: string }) => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const updatedNotifications = state.notifications.map(n => {
      if (n.readAt) return n
      if (filter?.recipientType && n.recipientType !== filter.recipientType) return n
      if (filter?.recipientId && n.recipientId !== filter.recipientId) return n
      return { ...n, readAt: now }
    })

    dispatch({ type: 'SET_NOTIFICATIONS', payload: updatedNotifications })
  }

  const recomputeAutoNotifications = () => {
    const now = new Date()
    const nowStr = now.toISOString().replace('T', ' ').slice(0, 19)
    const newNotifications: Notification[] = []

    // 去重key: recipientType_recipientId_targetType_targetId_titleKey
    const existingKeys = new Set(
      state.notifications
        .filter(n => {
          const createdAt = new Date(n.createdAt.replace(' ', 'T'))
          return (now.getTime() - createdAt.getTime()) < 24 * 60 * 60 * 1000
        })
        .map(n => `${n.recipientType}_${n.recipientId}_${n.targetType}_${n.targetId}_${n.title}`)
    )

    const shouldAdd = (n: Omit<Notification, 'notificationId' | 'createdAt'>) => {
      const key = `${n.recipientType}_${n.recipientId}_${n.targetType}_${n.targetId}_${n.title}`
      if (existingKeys.has(key)) return false
      existingKeys.add(key)
      return true
    }

    // A) 异常单 SLA
    state.exceptions.forEach(ex => {
      if (ex.severity !== 'S1') return
      if (!['OPEN', 'IN_PROGRESS', 'WAITING_EXTERNAL'].includes(ex.caseStatus)) return
      if (!ex.slaDueAt) return

      const slaDue = new Date(ex.slaDueAt.replace(' ', 'T'))
      const owner = ex.ownerUserId ? mockInternalUsers.find(u => u.id === ex.ownerUserId) : mockInternalUsers[0]
      const recipientId = owner?.id || 'U001'
      const recipientName = owner?.name || '管理员'

      if (now > slaDue) {
        // SLA逾期
        const n: Omit<Notification, 'notificationId' | 'createdAt'> = {
          level: 'CRITICAL',
          title: 'SLA逾��提醒',
          content: `异常单${ex.caseId}已超过SLA时限，需立即处理`,
          recipientType: 'INTERNAL_USER',
          recipientId,
          recipientName,
          targetType: 'CASE',
          targetId: ex.caseId,
          related: { caseId: ex.caseId, productionOrderId: ex.relatedOrderIds[0] },
          deepLink: { path: '/fcs/progress/exceptions', query: { caseId: ex.caseId } },
          createdBy: 'SYSTEM',
        }
        if (shouldAdd(n)) newNotifications.push({ ...n, notificationId: generateNotificationId(), createdAt: nowStr })
      } else if (slaDue.getTime() - now.getTime() < 8 * 60 * 60 * 1000) {
        // SLA即将到期
        const n: Omit<Notification, 'notificationId' | 'createdAt'> = {
          level: 'WARN',
          title: 'SLA即将到期',
          content: `异常单${ex.caseId}将在8小时内到期，请尽快处理`,
          recipientType: 'INTERNAL_USER',
          recipientId,
          recipientName,
          targetType: 'CASE',
          targetId: ex.caseId,
          related: { caseId: ex.caseId, productionOrderId: ex.relatedOrderIds[0] },
          deepLink: { path: '/fcs/progress/exceptions', query: { caseId: ex.caseId } },
          createdBy: 'SYSTEM',
        }
        if (shouldAdd(n)) newNotifications.push({ ...n, notificationId: generateNotificationId(), createdAt: nowStr })
      }
    })

    // B) 交接待确认超时
    state.handoverEvents.forEach(hv => {
      if (hv.status !== 'PENDING_CONFIRM') return
      const occurredAt = new Date(hv.occurredAt.replace(' ', 'T'))
      if (now.getTime() - occurredAt.getTime() < 4 * 60 * 60 * 1000) return

      // 给 toParty 工厂
      if (hv.toParty.kind === 'FACTORY' && hv.toParty.id) {
        const n: Omit<Notification, 'notificationId' | 'createdAt'> = {
          level: 'WARN',
          title: '交接待确认超时',
          content: `交接事件${hv.eventId}已超过4小���未确认`,
          recipientType: 'FACTORY',
          recipientId: hv.toParty.id,
          recipientName: hv.toParty.name,
          targetType: 'HANDOVER',
          targetId: hv.eventId,
          related: { handoverEventId: hv.eventId, productionOrderId: hv.productionOrderId },
          deepLink: { path: '/fcs/progress/handover', query: { eventId: hv.eventId } },
          createdBy: 'SYSTEM',
        }
        if (shouldAdd(n)) newNotifications.push({ ...n, notificationId: generateNotificationId(), createdAt: nowStr })
      }

      // 给跟单
      const internalN: Omit<Notification, 'notificationId' | 'createdAt'> = {
        level: 'INFO',
        title: '交接待确认超时',
        content: `交接事件${hv.eventId}（${hv.toParty.name}）已超过4小时未确认`,
        recipientType: 'INTERNAL_USER',
        recipientId: 'U001',
        recipientName: '管理员',
        targetType: 'HANDOVER',
        targetId: hv.eventId,
        related: { handoverEventId: hv.eventId, productionOrderId: hv.productionOrderId },
        deepLink: { path: '/fcs/progress/handover', query: { eventId: hv.eventId } },
        createdBy: 'SYSTEM',
      }
      if (shouldAdd(internalN)) newNotifications.push({ ...internalN, notificationId: generateNotificationId(), createdAt: nowStr })
    })

    // C) 竞价临近截止/逾期
    state.tenders.forEach(td => {
      if (td.status !== 'OPEN') return
      const deadline = new Date(td.deadline.replace(' ', 'T'))
      const recipientId = 'U001'
      const recipientName = '管理员'

      if (now > deadline) {
        const n: Omit<Notification, 'notificationId' | 'createdAt'> = {
          level: 'CRITICAL',
          title: '竞价已逾期',
          content: `竞价单${td.tenderId}已超过截止时��，需延期或处理`,
          recipientType: 'INTERNAL_USER',
          recipientId,
          recipientName,
          targetType: 'TENDER',
          targetId: td.tenderId,
          related: { tenderId: td.tenderId },
          deepLink: { path: '/fcs/dispatch/board', query: { tenderId: td.tenderId } },
          createdBy: 'SYSTEM',
        }
        if (shouldAdd(n)) newNotifications.push({ ...n, notificationId: generateNotificationId(), createdAt: nowStr })
      } else if (deadline.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
        const n: Omit<Notification, 'notificationId' | 'createdAt'> = {
          level: 'WARN',
          title: '竞价临近截止',
          content: `竞价单${td.tenderId}将于24小时内截止`,
          recipientType: 'INTERNAL_USER',
          recipientId,
          recipientName,
          targetType: 'TENDER',
          targetId: td.tenderId,
          related: { tenderId: td.tenderId },
          deepLink: { path: '/fcs/dispatch/board', query: { tenderId: td.tenderId } },
          createdBy: 'SYSTEM',
        }
        if (shouldAdd(n)) newNotifications.push({ ...n, notificationId: generateNotificationId(), createdAt: nowStr })
      }
    })

    // D) 任务暂不能继续
    state.processTasks.forEach(task => {
      if (task.status !== 'BLOCKED') return

      // 给跟单
      const n: Omit<Notification, 'notificationId' | 'createdAt'> = {
        level: 'WARN',
        title: '任务暂不能继续提醒',
        content: `任务${task.taskId}因${task.blockReason || '未知原因'}暂不能继续`,
        recipientType: 'INTERNAL_USER',
        recipientId: 'U002',
        recipientName: '跟单A',
        targetType: 'TASK',
        targetId: task.taskId,
        related: { taskId: task.taskId, productionOrderId: task.productionOrderId },
        deepLink: { path: '/fcs/progress/board', query: { taskId: task.taskId } },
        createdBy: 'SYSTEM',
      }
      if (shouldAdd(n)) newNotifications.push({ ...n, notificationId: generateNotificationId(), createdAt: nowStr })

      // 若 CAPACITY/EQUIPMENT，给工厂
      if (['CAPACITY', 'EQUIPMENT'].includes(task.blockReason || '') && task.assignedFactoryId) {
        const factory = state.factories.find(f => f.id === task.assignedFactoryId)
        const factoryN: Omit<Notification, 'notificationId' | 'createdAt'> = {
          level: 'WARN',
          title: '任务暂不能继续建议',
          content: `任务${task.taskId}暂不能继续，请尽快解除`,
          recipientType: 'FACTORY',
          recipientId: task.assignedFactoryId,
          recipientName: factory?.name || task.assignedFactoryId,
          targetType: 'TASK',
          targetId: task.taskId,
          related: { taskId: task.taskId, productionOrderId: task.productionOrderId },
          deepLink: { path: '/fcs/progress/board', query: { taskId: task.taskId } },
          createdBy: 'SYSTEM',
        }
        if (shouldAdd(factoryN)) newNotifications.push({ ...factoryN, notificationId: generateNotificationId(), createdAt: nowStr })
      }
    })

    // E) 派单未确认
    state.processTasks.forEach(task => {
      if (task.assignmentStatus !== 'ASSIGNED') return
      if (task.status !== 'NOT_STARTED') return
      if (!task.assignedFactoryId) return

      // 检查是否超过4小时（简化：用 auditLogs 中的 ASSIGN 记录）
      const assignLog = task.auditLogs.find(l => l.action === 'ASSIGN' || l.action === 'DISPATCH')
      if (!assignLog) return
      const assignedAt = new Date(assignLog.at.replace(' ', 'T'))
      if (now.getTime() - assignedAt.getTime() < 4 * 60 * 60 * 1000) return

      const factory = state.factories.find(f => f.id === task.assignedFactoryId)
      const n: Omit<Notification, 'notificationId' | 'createdAt'> = {
        level: 'WARN',
        title: '派单待确认',
        content: `任务${task.taskId}已分配超过4小时未确认接单`,
        recipientType: 'FACTORY',
        recipientId: task.assignedFactoryId,
        recipientName: factory?.name || task.assignedFactoryId,
        targetType: 'TASK',
        targetId: task.taskId,
        related: { taskId: task.taskId, productionOrderId: task.productionOrderId },
        deepLink: { path: '/fcs/dispatch/board', query: { taskId: task.taskId } },
        createdBy: 'SYSTEM',
      }
      if (shouldAdd(n)) newNotifications.push({ ...n, notificationId: generateNotificationId(), createdAt: nowStr })
    })

    // 添加新生成的通知
    if (newNotifications.length > 0) {
      dispatch({ type: 'SET_NOTIFICATIONS', payload: [...state.notifications, ...newNotifications] })
    }
  }

  // Urge methods
  const createUrge = (payload: Omit<UrgeLog, 'urgeId' | 'createdAt' | 'status' | 'auditLogs'>): UrgeLog => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const urgeId = generateUrgeId()

    const newUrge: UrgeLog = {
      ...payload,
      urgeId,
      createdAt: now,
      status: 'SENT',
      auditLogs: [
        { id: `UAL-${Date.now()}`, action: 'SEND', detail: '发送催办', at: now, by: payload.fromName },
      ],
    }

    dispatch({ type: 'ADD_URGE', payload: newUrge })

    // 同时给对方生成通知
    const urgeTypeLabels: Record<UrgeType, string> = {
      URGE_ASSIGN_ACK: '催确认接单',
      URGE_START: '催开工',
      URGE_FINISH: '催完工',
      URGE_UNBLOCK: '催解除暂不能继续',
      URGE_TENDER_BID: '催报价',
      URGE_TENDER_AWARD: '催定标',
      URGE_HANDOVER_CONFIRM: '催交接确认',
      URGE_HANDOVER_EVIDENCE: '催补证据/处理差异',
      URGE_CASE_HANDLE: '去处理异常',
    }

    createNotification({
      level: 'INFO',
      title: '收到催办',
      content: `${payload.fromName}：${urgeTypeLabels[payload.urgeType]} - ${payload.message}`,
      recipientType: payload.toType,
      recipientId: payload.toId,
      recipientName: payload.toName,
      targetType: payload.targetType,
      targetId: payload.targetId,
      related: {},
      deepLink: payload.deepLink,
      createdBy: payload.fromId,
    })

    return newUrge
  }

  const ackUrge = (urgeId: string, by: string) => {
    const urge = state.urges.find(u => u.urgeId === urgeId)
    if (!urge || urge.status !== 'SENT') return

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const updatedUrge: UrgeLog = {
      ...urge,
      status: 'ACKED',
      auditLogs: [
        ...urge.auditLogs,
        { id: `UAL-${Date.now()}`, action: 'ACK', detail: '已确认收到', at: now, by },
      ],
    }

    dispatch({ type: 'UPDATE_URGE', payload: updatedUrge })
  }

  // PDA Task Accept/Reject
  const acceptTask = (taskId: string, by: string) => {
    if (!can('TASK_ACCEPT')) return { ok: false, errorCode: 'PERMISSION_DENIED', messageKey: 'pda.auth.permissionDenied' }
    const currentUser = getCurrentFactoryUser()
    dispatch({ type: 'ACCEPT_TASK', payload: { taskId, by: currentUser?.name || by || 'UNKNOWN' } })
    return { ok: true }
  }

  const rejectTask = (taskId: string, reason: string, by: string) => {
    if (!can('TASK_REJECT')) return { ok: false, errorCode: 'PERMISSION_DENIED', messageKey: 'pda.auth.permissionDenied' }
    const currentUser = getCurrentFactoryUser()
    dispatch({ type: 'REJECT_TASK', payload: { taskId, reason, by: currentUser?.name || by || 'UNKNOWN' } })
    return { ok: true }
  }

  // PDA Exec methods
  const startTask = (taskId: string, by: string) => {
    if (!can('TASK_START')) return { ok: false, errorCode: 'PERMISSION_DENIED', messageKey: 'pda.auth.permissionDenied' }
    const currentUser = getCurrentFactoryUser()
    dispatch({ type: 'START_TASK', payload: { taskId, by: currentUser?.name || by || 'UNKNOWN' } })
    return { ok: true }
  }

  const finishTask = (taskId: string, by: string) => {
    if (!can('TASK_FINISH')) return { ok: false, errorCode: 'PERMISSION_DENIED', messageKey: 'pda.auth.permissionDenied' }
    const currentUser = getCurrentFactoryUser()
    const resolvedBy = currentUser?.name || by || 'UNKNOWN'
    const task = state.processTasks.find(t => t.taskId === taskId)
    if (!task) {
      dispatch({ type: 'FINISH_TASK', payload: { taskId, by: resolvedBy } })
      return { ok: true }
    }

    // 先完成当前任务
    dispatch({ type: 'FINISH_TASK', payload: { taskId, by: resolvedBy } })

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    // 检查是否为返工/重做任务
    const isReworkTask = task.processCode === 'PROC_REWORK' || task.processCode === 'PROC_REMAKE' || !!task.sourceQcId

    if (isReworkTask) {
      // 找父任务
      let parentTaskId = task.parentTaskId

      // 若缺 parentTaskId 但有 sourceQcId，从 QC 中获取
      if (!parentTaskId && task.sourceQcId) {
        const qc = state.qualityInspections.find(q => q.qcId === task.sourceQcId)
        if (qc) {
          parentTaskId = qc.refId
        }
      }

      if (!parentTaskId) {
        // 找不到父任务，记录日志
        dispatch({
          type: 'UPDATE_TASK_AUDIT_LOG',
          payload: {
            taskId,
            auditLog: {
              id: `AL-NOPT-${Date.now()}`,
              action: 'PARENT_TASK_NOT_FOUND',
              detail: '返工任务完成，但无法找到父任务进行解锁',
              at: now,
              by: resolvedBy,
            },
          },
        })
        return
      }

      const parentTask = state.processTasks.find(t => t.taskId === parentTaskId)

      if (parentTask && parentTask.status === 'BLOCKED' && parentTask.blockReason === 'QUALITY') {
        // 解除父任务暂不能继续
        const newStatus = parentTask.startedAt ? 'IN_PROGRESS' : 'NOT_STARTED'

        dispatch({
          type: 'UNBLOCK_TASK_BY_REWORK',
          payload: {
            parentTaskId,
            reworkTaskId: taskId,
            newStatus,
            by: resolvedBy,
          },
        })

        // 自动关闭质量异常
        const qualityException = state.exceptions.find(
          e => e.sourceType === 'TASK' && e.sourceId === parentTaskId && e.reasonCode === 'BLOCKED_QUALITY' && e.caseStatus !== 'RESOLVED'
        )

        if (qualityException) {
          dispatch({
            type: 'RESOLVE_EXCEPTION_BY_REWORK',
            payload: {
              caseId: qualityException.caseId,
              reworkTaskId: taskId,
              by: resolvedBy,
            },
          })
        }
      }
    }
    return { ok: true }
  }

  const blockTask = (taskId: string, reason: BlockReason, remark: string, by: string) => {
    if (!can('TASK_BLOCK')) return { ok: false, errorCode: 'PERMISSION_DENIED', messageKey: 'pda.auth.permissionDenied' }
    const currentUser = getCurrentFactoryUser()
    dispatch({ type: 'BLOCK_TASK', payload: { taskId, reason, remark, by: currentUser?.name || by || 'UNKNOWN' } })
    return { ok: true }
  }

  const unblockTask = (taskId: string, remark: string, by: string) => {
    if (!can('TASK_UNBLOCK')) return { ok: false, errorCode: 'PERMISSION_DENIED', messageKey: 'pda.auth.permissionDenied' }
    const currentUser = getCurrentFactoryUser()
    dispatch({ type: 'UNBLOCK_TASK', payload: { taskId, remark, by: currentUser?.name || by || 'UNKNOWN' } })
    return { ok: true }
  }

  // PDA Handover methods
  const confirmHandover = (eventId: string, by: string) => {
    if (!can('HANDOVER_CONFIRM')) return { ok: false, errorCode: 'PERMISSION_DENIED', messageKey: 'pda.auth.permissionDenied' }
    const currentUser = getCurrentFactoryUser()
    const resolvedBy = currentUser?.name || by || 'UNKNOWN'
    dispatch({ type: 'CONFIRM_HANDOVER', payload: { eventId, by: resolvedBy } })

    // 检查是否需要生成 HANDOVER_DIFF 扣款依据（确认时若 qtyDiff != 0）
    const event = state.handoverEvents.find(e => e.eventId === eventId)
    if (event) {
      const qtyDiff = event.qtyActual !== undefined && event.qtyExpected !== undefined
        ? event.qtyActual - event.qtyExpected
        : (event.qtyDiff || 0)

      if (qtyDiff !== 0) {
        generateHandoverBasisItem(event, Math.abs(qtyDiff), event.diffReasonCode, resolvedBy)
      }
    }
    return { ok: true }
  }

  const disputeHandover = (eventId: string, payload: { qtyActual: number; diffReasonCode: DiffReasonCode; diffRemark: string; evidence?: HandoverEvidence[] }, by: string) => {
    if (!can('HANDOVER_DISPUTE')) return { ok: false, errorCode: 'PERMISSION_DENIED', messageKey: 'pda.auth.permissionDenied' }
    const currentUser = getCurrentFactoryUser()
    const resolvedBy = currentUser?.name || by || 'UNKNOWN'
    dispatch({ type: 'DISPUTE_HANDOVER', payload: { eventId, ...payload, evidence: payload.evidence || [], by: resolvedBy } })

    // 生成 HANDOVER_DIFF 扣款依据
    const event = state.handoverEvents.find(e => e.eventId === eventId)
    if (event) {
      const qtyDiff = payload.qtyActual - event.qtyExpected
      generateHandoverBasisItem(event, Math.abs(qtyDiff), payload.diffReasonCode, resolvedBy)
    }
    return { ok: true }
  }

  // Helper: 生成交接差异扣款依据
  const generateHandoverBasisItem = (
    event: HandoverEvent,
    absQtyDiff: number,
    diffReasonCode: DiffReasonCode | undefined,
    by: string
  ) => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    // 确定 factoryId：优先 toParty（kind==FACTORY），否则 fromParty（kind==FACTORY）
    let factoryId: string | undefined
    if (event.toParty.kind === 'FACTORY' && event.toParty.id) {
      factoryId = event.toParty.id
    } else if (event.fromParty.kind === 'FACTORY' && event.fromParty.id) {
      factoryId = event.fromParty.id
    }

    if (!factoryId) {
      // 缺 factoryId，记录日志跳过
      dispatch({
        type: 'UPDATE_HANDOVER_EVENT',
        payload: {
          ...event,
          auditLogs: [...event.auditLogs, {
            id: `HAL-BSKIP-FAC-${Date.now()}`,
            action: 'BASIS_SKIPPED_MISSING_FACTORY',
            detail: '扣���依据生成跳过：缺少 factoryId',
            at: now,
            by,
          }],
        },
      })
      return
    }

    if (absQtyDiff <= 0) {
      // qty 无效，记录日志跳过
      dispatch({
        type: 'UPDATE_HANDOVER_EVENT',
        payload: {
          ...event,
          auditLogs: [...event.auditLogs, {
            id: `HAL-BSKIP-QTY-${Date.now()}`,
            action: 'BASIS_SKIPPED_INVALID_QTY',
            detail: '扣款依据生成跳过：qtyDiff 为0',
            at: now,
            by,
          }],
        },
      })
      return
    }

    // 映射 reasonCode
    const reasonCodeMap: Record<DiffReasonCode, DeductionBasisReasonCode> = {
      'SHORTAGE': 'HANDOVER_SHORTAGE',
      'OVERAGE': 'HANDOVER_OVERAGE',
      'DAMAGE': 'HANDOVER_DAMAGE',
      'MIXED_BATCH': 'HANDOVER_MIXED_BATCH',
      'UNKNOWN': 'HANDOVER_DIFF',
    }
    const basisReasonCode = diffReasonCode ? reasonCodeMap[diffReasonCode] : 'HANDOVER_DIFF'

    // 幂等检查
    const existingBasis = state.deductionBasisItems.find(
      b => b.sourceType === 'HANDOVER_DIFF' && b.sourceRefId === event.eventId
    )

    const handoverEvidenceRefs: DeductionBasisEvidenceRef[] = (event.evidence || []).map(e => ({
      name: e.name,
      url: e.url,
      type: e.type,
    }))

    if (existingBasis) {
      // 更新现有条目
      const updatedBasis: DeductionBasisItem = {
        ...existingBasis,
        qty: absQtyDiff,
        reasonCode: basisReasonCode,
        evidenceRefs: handoverEvidenceRefs,
        updatedAt: now,
        updatedBy: by,
        auditLogs: [...existingBasis.auditLogs, {
          id: `DBIL-UPD-${Date.now()}`,
          action: 'UPDATE_BASIS_FROM_HANDOVER',
          detail: `更新扣款依据：qty=${absQtyDiff}，reasonCode=${basisReasonCode}`,
          at: now,
          by,
        }],
      }
      dispatch({ type: 'UPDATE_DEDUCTION_BASIS_ITEM', payload: updatedBasis })
    } else {
      // 创建新条目
      const newBasis: DeductionBasisItem = {
        basisId: `DBI-HV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        sourceType: 'HANDOVER_DIFF',
        sourceRefId: event.eventId,
        productionOrderId: event.productionOrderId,
        taskId: event.relatedTaskId,
        factoryId,
        reasonCode: basisReasonCode,
        qty: absQtyDiff,
        uom: 'PIECE',
        evidenceRefs: handoverEvidenceRefs,
        status: 'DRAFT',
        createdAt: now,
        createdBy: by,
        auditLogs: [{
          id: `DBIL-CR-${Date.now()}`,
          action: 'CREATE_BASIS_FROM_HANDOVER',
          detail: `创建扣款依据：sourceRefId=${event.eventId}，qty=${absQtyDiff}，reasonCode=${basisReasonCode}`,
          at: now,
          by,
        }],
      }
      dispatch({ type: 'ADD_DEDUCTION_BASIS_ITEM', payload: newBasis })
    }

    // 在 event.auditLogs 追加 GENERATE_DEDUCTION_BASIS
    dispatch({
      type: 'UPDATE_HANDOVER_EVENT',
      payload: {
        ...event,
        auditLogs: [...event.auditLogs, {
          id: `HAL-GENBASIS-${Date.now()}`,
          action: 'GENERATE_DEDUCTION_BASIS',
          detail: `已生成扣款依据条目，factoryId=${factoryId}，qty=${absQtyDiff}`,
          at: now,
          by,
        }],
      },
    })
  }

  // Quality Inspection methods
  const getQcById = (qcId: string) => state.qualityInspections.find(qc => qc.qcId === qcId)

  const getQcsByTaskId = (taskId: string) => state.qualityInspections.filter(qc => qc.refId === taskId)

  const getSubmittedQcListByTaskId = (taskId: string) =>
    state.qualityInspections
      .filter(qc => qc.refId === taskId && qc.status === 'SUBMITTED')
      .sort((a, b) => new Date(b.updatedAt || b.inspectedAt).getTime() - new Date(a.updatedAt || a.inspectedAt).getTime())

  const getLatestSubmittedQcByTaskId = (taskId: string) => getSubmittedQcListByTaskId(taskId)[0]

  const hasSubmittedQc = (taskId: string) => getSubmittedQcListByTaskId(taskId).length > 0

  const createQc = (payload: Omit<QualityInspection, 'qcId' | 'status' | 'auditLogs' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const qcId = `QC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const qc: QualityInspection = {
      rootCauseType: 'UNKNOWN',
      liabilityStatus: 'DRAFT',
      ...payload,
      qcId,
      status: 'DRAFT',
      auditLogs: [{ id: `QAL-CR-${Date.now()}`, action: 'CREATE', detail: '创建质检记录', at: now, by: payload.inspector }],
      createdAt: now,
      updatedAt: now,
    }
    dispatch({ type: 'ADD_QC', payload: qc })
    return qc
  }

  const updateQc = (qc: QualityInspection) => {
    dispatch({ type: 'UPDATE_QC', payload: qc })
  }

  const submitQc = (qcId: string, _by: string) => {
    if (!can('QC_SUBMIT')) return { ok: false, errorCode: 'PERMISSION_DENIED', messageKey: 'pda.auth.permissionDenied', generatedTaskIds: [] }
    const currentUser = getCurrentFactoryUser()
    const resolvedBy = currentUser?.name || _by || 'UNKNOWN'
    const qc = state.qualityInspections.find(q => q.qcId === qcId)
    if (!qc) return { generatedTaskIds: [] }

    const generatedTaskIds: string[] = [...(qc.generatedTaskIds || [])]
    let blockedTaskId: string | undefined
    const parentTask = state.processTasks.find(t => t.taskId === qc.refId)
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    // resolvedBy is used in place of `by` for all audit log entries below

    // 规则1: 若 result != FAIL，不做暂不能继续/返工生成
    if (qc.result !== 'FAIL') {
      dispatch({ type: 'SUBMIT_QC', payload: { qcId, generatedTaskIds, blockedTaskId, by: resolvedBy } })
      return { generatedTaskIds }
    }

    // 规则2: 若 FAIL，但父任务不存在，记录日志并返回
    if (!parentTask) {
      const updatedQc: QualityInspection = {
        ...qc,
        status: 'SUBMITTED',
        updatedAt: now,
        auditLogs: [...qc.auditLogs, {
          id: `QAL-NOTFOUND-${Date.now()}`,
          action: 'PARENT_TASK_NOT_FOUND',
          detail: `父任务 ${qc.refId} 不存在，无法暂不能继续/生成返工`,
          at: now,
          by: resolvedBy,
        }],
      }
      dispatch({ type: 'UPDATE_QC', payload: updatedQc })
      return { generatedTaskIds }
    }

    // 规则3: FAIL => 父任务置为 BLOCKED(QUALITY)
    blockedTaskId = parentTask.taskId

    // 规则4: 若 disposition in [REWORK, REMAKE]，幂等生成返工任务
    if (qc.disposition === 'REWORK' || qc.disposition === 'REMAKE') {
      // 幂等检查：是否已有该 qcId 生成的返工任务
      const existingReworkTask = state.processTasks.find(
        t => t.sourceQcId === qcId && (t.processCode === 'PROC_REWORK' || t.processCode === 'PROC_REMAKE')
      )

      if (existingReworkTask) {
        // 已存在返工任务，不重复生成，确保 generatedTaskIds 包含它
        if (!generatedTaskIds.includes(existingReworkTask.taskId)) {
          generatedTaskIds.push(existingReworkTask.taskId)
        }
      } else {
        // 检查必要条件
        if (!parentTask.assignedFactoryId) {
          // 缺工厂，记录日志不生成
          const updatedQc: QualityInspection = {
            ...qc,
            status: 'SUBMITTED',
            updatedAt: now,
            auditLogs: [...qc.auditLogs, {
              id: `QAL-NOFAC-${Date.now()}`,
              action: 'REWORK_GENERATION_FAILED',
              detail: `父任务无 assignedFactoryId，无法生成返工任务`,
              at: now,
              by: resolvedBy,
            }],
          }
          dispatch({ type: 'UPDATE_QC', payload: updatedQc })
        } else if (!qc.affectedQty || qc.affectedQty <= 0) {
          // 缺 affectedQty，记录日志不生成
          const updatedQc: QualityInspection = {
            ...qc,
            status: 'SUBMITTED',
            updatedAt: now,
            auditLogs: [...qc.auditLogs, {
              id: `QAL-NOQTY-${Date.now()}`,
              action: 'REWORK_GENERATION_FAILED',
              detail: `affectedQty 缺��或为0，无法生成返工任务`,
              at: now,
              by: resolvedBy,
            }],
          }
          dispatch({ type: 'UPDATE_QC', payload: updatedQc })
        } else {
          // 生成新返工任务
          const newTaskId = `TASK-${qcId}-${Date.now()}`

          const newTask: ProcessTask = {
            taskId: newTaskId,
            productionOrderId: parentTask.productionOrderId,
            seq: 999,
            processCode: qc.disposition === 'REWORK' ? 'PROC_REWORK' : 'PROC_REMAKE',
            processNameZh: qc.disposition === 'REWORK' ? '返工' : '重做',
            stage: 'POST',
            qty: qc.affectedQty,
            qtyUnit: parentTask.qtyUnit || 'PIECE',
            assignmentMode: 'DIRECT',
            assignmentStatus: 'ASSIGNED',
            ownerSuggestion: { kind: 'MAIN_FACTORY' },
            assignedFactoryId: parentTask.assignedFactoryId,
            qcPoints: [],
            attachments: [],
            status: 'NOT_STARTED',
            acceptanceStatus: 'PENDING',
            parentTaskId: parentTask.taskId,
            sourceQcId: qcId,
            sourceTaskId: parentTask.taskId,
            sourceProductionOrderId: qc.productionOrderId,
            taskKind: qc.disposition === 'REWORK' ? 'REWORK' : 'REMAKE',
            taskCategoryZh: qc.disposition === 'REWORK' ? '返工' : '重做',
            createdAt: now,
            updatedAt: now,
            auditLogs: [{
              id: `AL-RWCR-${Date.now()}`,
              action: 'CREATE_REWORK_TASK',
              detail: `���质检${qcId}生成，disposition=${qc.disposition}，affectedQty=${qc.affectedQty}，parentTaskId=${parentTask.taskId}`,
              at: now,
              by: resolvedBy,
            }],
          }

          dispatch({ type: 'ADD_TASKS', payload: [newTask] })
          generatedTaskIds.push(newTaskId)
        }
      }
    }

    // A) FAIL => 自动创建/更新异常单 (reasonCode=BLOCKED_QUALITY)
    createOrUpdateExceptionFromSignal({
      sourceType: 'TASK',
      sourceId: parentTask.taskId,
      reasonCode: 'BLOCKED_QUALITY',
      detail: `质检不合格(${qcId})：${qc.defectItems.map(d => `${d.defectName}×${d.qty}`).join(', ')}`,
    })

    // B) FAIL => 写入扣款候选 DeductionCandidate (DRAFT)
    if (parentTask.assignedFactoryId) {
      const existingDc = state.deductionCandidates.find(dc => dc.qcId === qcId)

      const evidenceRefs: DeductionEvidenceRef[] = (qc.defectItems || [])
        .filter(d => d.remark)
        .map(d => ({ name: d.defectName, url: d.remark || '' }))

      if (existingDc) {
        const updatedDc: DeductionCandidate = {
          ...existingDc,
          affectedQty: qc.affectedQty || qc.defectItems.reduce((sum, d) => sum + d.qty, 0),
          disposition: qc.disposition,
          evidenceRefs,
          updatedAt: now,
        }
        dispatch({ type: 'UPDATE_DEDUCTION_CANDIDATE', payload: updatedDc })
      } else {
        const newDc: DeductionCandidate = {
          candidateId: `DC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          qcId,
          productionOrderId: qc.productionOrderId,
          taskId: parentTask.taskId,
          factoryId: parentTask.assignedFactoryId,
          reasonCode: 'QUALITY_FAIL',
          affectedQty: qc.affectedQty || qc.defectItems.reduce((sum, d) => sum + d.qty, 0),
          disposition: qc.disposition,
          evidenceRefs,
          status: 'DRAFT',
          createdAt: now,
          createdBy: resolvedBy,
        }
        dispatch({ type: 'ADD_DEDUCTION_CANDIDATE', payload: newDc })
      }
    }

    // C) FAIL => 生成扣款依据（QC_FAIL）
    const qcBasisFactoryId = parentTask.assignedFactoryId
    const qcBasisQty = qc.affectedQty && qc.affectedQty > 0
      ? qc.affectedQty
      : qc.defectItems.reduce((sum, d) => sum + d.qty, 0)

    if (!qcBasisFactoryId) {
      // 缺 factoryId，记录日志跳过
      const updatedQcForBasis: QualityInspection = {
        ...qc,
        auditLogs: [...qc.auditLogs, {
          id: `QAL-BSKIP-FAC-${Date.now()}`,
          action: 'BASIS_SKIPPED_MISSING_FACTORY',
          detail: '扣款依据生成跳过：缺少 factoryId',
          at: now,
          by: resolvedBy,
        }],
      }
      dispatch({ type: 'UPDATE_QC', payload: updatedQcForBasis })
    } else if (qcBasisQty <= 0) {
      // 缺 qty，记录日志跳过
      const updatedQcForBasis: QualityInspection = {
        ...qc,
        auditLogs: [...qc.auditLogs, {
          id: `QAL-BSKIP-QTY-${Date.now()}`,
          action: 'BASIS_SKIPPED_INVALID_QTY',
          detail: '扣款依据生成跳过：qty 无效或为0',
          at: now,
          by: resolvedBy,
        }],
      }
      dispatch({ type: 'UPDATE_QC', payload: updatedQcForBasis })
    } else {
      // 幂等检查
      const existingBasis = state.deductionBasisItems.find(
        b => b.sourceType === 'QC_FAIL' && b.sourceRefId === qcId
      )

      const qcEvidenceRefs: DeductionBasisEvidenceRef[] = (qc.defectItems || [])
        .filter(d => d.remark)
        .map(d => ({ name: d.defectName, url: d.remark, type: 'DEFECT' }))

      if (existingBasis) {
        // 更新现有条目
        const updatedBasis: DeductionBasisItem = {
          ...existingBasis,
          qty: qcBasisQty,
          disposition: qc.disposition,
          summary: `${qc.defectItems.map(d => `${d.defectName}×${d.qty}`).join('、')} | disposition=${qc.disposition || '-'}`,
          evidenceRefs: qcEvidenceRefs,
          deepLinks: {
            qcHref: `/fcs/quality/qc-records/${qcId}`,
            taskHref: qc.refType === 'TASK' ? `/fcs/pda/task-receive/${qc.refId}` : undefined,
            handoverHref: qc.refType === 'HANDOVER' ? `/fcs/pda/handover/${qc.refId}` : undefined,
          },
          updatedAt: now,
          updatedBy: resolvedBy,
          auditLogs: [...existingBasis.auditLogs, {
            id: `DBIL-UPD-${Date.now()}`,
            action: 'UPDATE_BASIS_FROM_QC',
            detail: `更新扣款依据：qty=${qcBasisQty}，disposition=${qc.disposition || '-'}`,
            at: now,
            by: resolvedBy,
          }],
        }
        dispatch({ type: 'UPDATE_DEDUCTION_BASIS_ITEM', payload: updatedBasis })
      } else {
        // 创建新条目
        const basisSourceType: DeductionBasisSourceType = qc.disposition === 'ACCEPT_AS_DEFECT' ? 'QC_DEFECT_ACCEPT' : 'QC_FAIL'
        // 责任方：优先取 QC 上的，否则按默认规则推导
        const respType = qc.responsiblePartyType
        const respId = qc.responsiblePartyId
        let settlementPartyType: SettlementPartyType
        let settlementPartyId: string
        if (respType && respId) {
          settlementPartyType = respType
          settlementPartyId = respId
        } else {
          const mapped = defaultResponsibility(qc.rootCauseType, parentTask.assignedFactoryId)
          settlementPartyType = mapped.responsiblePartyType
          settlementPartyId = mapped.responsiblePartyId
        }
        const newBasis: DeductionBasisItem = {
          basisId: `DBI-QC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          sourceType: basisSourceType,
          sourceRefId: qcId,
          sourceId: qcId,
          productionOrderId: parentTask.productionOrderId || qc.productionOrderId,
          taskId: parentTask.taskId,
          factoryId: qcBasisFactoryId,
          settlementPartyType,
          settlementPartyId,
          rootCauseType: qc.rootCauseType,
          reasonCode: 'QUALITY_FAIL',
          qty: qcBasisQty,
          uom: 'PIECE',
          disposition: qc.disposition,
          summary: `${qc.defectItems.map(d => `${d.defectName}×${d.qty}`).join('、')} | disposition=${qc.disposition || '-'}`,
          evidenceRefs: qcEvidenceRefs,
          status: qc.liabilityStatus || 'DRAFT',
          deepLinks: {
            qcHref: `/fcs/quality/qc-records/${qcId}`,
            taskHref: qc.refType === 'TASK' ? `/fcs/pda/task-receive/${qc.refId}` : undefined,
            handoverHref: qc.refType === 'HANDOVER' ? `/fcs/pda/handover/${qc.refId}` : undefined,
          },
          createdAt: now,
          createdBy: resolvedBy,
          auditLogs: [{
            id: `DBIL-CR-${Date.now()}`,
            action: 'CREATE_BASIS_FROM_QC',
            detail: `创建扣款依据���sourceRefId=${qcId}，qty=${qcBasisQty}`,
            at: now,
            by: resolvedBy,
          }],
        }
        dispatch({ type: 'ADD_DEDUCTION_BASIS_ITEM', payload: newBasis })
      }

      // 在 qc.auditLogs 追加 GENERATE_DEDUCTION_BASIS
      const qcWithBasisLog: QualityInspection = {
        ...qc,
        auditLogs: [...qc.auditLogs, {
          id: `QAL-GENBASIS-${Date.now()}`,
          action: 'GENERATE_DEDUCTION_BASIS',
          detail: `已生成扣款依据条目，factoryId=${qcBasisFactoryId}，qty=${qcBasisQty}`,
          at: now,
          by: resolvedBy,
        }],
      }
      dispatch({ type: 'UPDATE_QC', payload: qcWithBasisLog })
    }

    // 提交质检（SUBMIT_QC 会处理父任���暂不能继续）
    dispatch({ type: 'SUBMIT_QC', payload: { qcId, generatedTaskIds, blockedTaskId, by: resolvedBy } })

    return { generatedTaskIds }
  }

  // =============================================
  // 处置数��拆分
  // =============================================

  const updateQcDispositionBreakdown = (
    qcId: string,
    breakdown: {
      reworkQty?: number
      remakeQty?: number
      acceptAsDefectQty?: number
      scrapQty?: number
      acceptNoDeductQty?: number
    },
    by: string,
  ): { ok: boolean; message?: string } => {
    const now = new Date().toLocaleString('sv').replace('T', ' ')
    const resolvedBy = getCurrentFactoryUser()?.name || by || 'UNKNOWN'
    const qc = state.qcRecords.find(q => q.qcId === qcId)
    if (!qc) return { ok: false, message: '质检单不存在' }
    if (qc.result !== 'FAIL') return { ok: false, message: '仅不合格（FAIL）质检单需填写处置数量拆分' }

    const reworkQty = breakdown.reworkQty ?? 0
    const remakeQty = breakdown.remakeQty ?? 0
    const acceptAsDefectQty = breakdown.acceptAsDefectQty ?? 0
    const scrapQty = breakdown.scrapQty ?? 0
    const acceptNoDeductQty = breakdown.acceptNoDeductQty ?? 0

    if (reworkQty < 0 || remakeQty < 0 || acceptAsDefectQty < 0 || scrapQty < 0 || acceptNoDeductQty < 0)
      return { ok: false, message: '各项数量不能为负数' }

    const sum = reworkQty + remakeQty + acceptAsDefectQty + scrapQty + acceptNoDeductQty
    const target = qc.affectedQty
    if (target !== undefined && target !== null && sum !== target)
      return { ok: false, message: `合计（${sum}）必须等于不合格数量（${target}），当前差值 ${target - sum}` }

    const normalized = { reworkQty, remakeQty, acceptAsDefectQty, scrapQty, acceptNoDeductQty }
    const deductionQty = sum - acceptNoDeductQty

    const updatedQc: QualityInspection = {
      ...qc,
      dispositionQtyBreakdown: normalized,
      updatedAt: now,
      auditLogs: [...qc.auditLogs, {
        id: `QAL-BREAKDOWN-${Date.now()}`,
        action: 'UPDATE_DISPOSITION_BREAKDOWN',
        detail: `处置拆分：返工${reworkQty}、重做${remakeQty}、瑕疵接收${acceptAsDefectQty}、报废${scrapQty}、无扣款接受${acceptNoDeductQty}，合计${sum}，可扣款数量${deductionQty}`,
        at: now,
        by: resolvedBy,
      }],
    }
    dispatch({ type: 'UPDATE_QC', payload: updatedQc })

    // 联动 DeductionBasisItem.deductionQty
    const relatedBasis = state.deductionBasisItems.filter(
      b => (b.sourceRefId === qcId || b.sourceId === qcId) && b.status !== 'VOID'
    )
    for (const b of relatedBasis) {
      const updatedBasis: DeductionBasisItem = {
        ...b,
        deductionQty,
        updatedAt: now,
        updatedBy: resolvedBy,
        auditLogs: [...b.auditLogs, {
          id: `DBIL-SYNC-${Date.now()}-${b.basisId}`,
          action: 'SYNC_DEDUCTION_QTY_FROM_QC',
          detail: `由 QC ${qcId} 处置拆分同步可扣款数量：${deductionQty}（合计${sum} - 无扣款接受${acceptNoDeductQty}）`,
          at: now,
          by: resolvedBy,
        }],
      }
      dispatch({ type: 'UPDATE_DEDUCTION_BASIS_ITEM', payload: updatedBasis })
    }
    return { ok: true }
  }

  // =============================================
  // 判责确认 / 争议 / 结案
  // =============================================

  const confirmQcLiability = (
    qcId: string,
    payload: {
      liablePartyType: SettlementPartyType
      liablePartyId: string
      settlementPartyType: SettlementPartyType
      settlementPartyId: string
      liabilityReason: string
    },
    by: string,
  ): { ok: boolean; message?: string } => {
    const now = new Date().toLocaleString('sv').replace('T', ' ')
    const resolvedBy = getCurrentFactoryUser()?.name || by || 'UNKNOWN'
    const qc = state.qcRecords.find(q => q.qcId === qcId)
    if (!qc) return { ok: false, message: '质检单不存在' }
    if (qc.status !== 'SUBMITTED') return { ok: false, message: '质检单状态不是已提交，无法判责' }
    if (qc.result !== 'FAIL') return { ok: false, message: '仅不合格质检单需判责' }
    if (!payload.liablePartyType || !payload.liablePartyId || !payload.settlementPartyType || !payload.settlementPartyId)
      return { ok: false, message: '判责方和结算方均不能为空' }
    if (!payload.liabilityReason?.trim()) return { ok: false, message: '判责说明不能为空' }

    const updatedQc: QualityInspection = {
      ...qc,
      liabilityStatus: 'CONFIRMED',
      liablePartyType: payload.liablePartyType,
      liablePartyId: payload.liablePartyId,
      settlementPartyType: payload.settlementPartyType,
      settlementPartyId: payload.settlementPartyId,
      liabilityReason: payload.liabilityReason,
      liabilityConfirmedAt: now,
      liabilityConfirmedBy: resolvedBy,
      updatedAt: now,
      auditLogs: [...qc.auditLogs, {
        id: `QAL-CONFIRM-${Date.now()}`,
        action: 'CONFIRM_LIABILITY',
        detail: `判责确认：责任方=${payload.liablePartyType}/${payload.liablePartyId}，结算方=${payload.settlementPartyType}/${payload.settlementPartyId}，原因：${payload.liabilityReason}`,
        at: now,
        by: resolvedBy,
      }],
    }
    dispatch({ type: 'UPDATE_QC', payload: updatedQc })

    // 联动更新关联 DeductionBasisItem
    const relatedBasis = state.deductionBasisItems.filter(
      b => b.sourceRefId === qcId || b.sourceId === qcId,
    )
    for (const b of relatedBasis) {
      const isQcClosed = qc.status === 'CLOSED'
      const updatedBasis: DeductionBasisItem = {
        ...b,
        status: 'CONFIRMED',
        settlementPartyType: payload.settlementPartyType,
        settlementPartyId: payload.settlementPartyId,
        liablePartyType: payload.liablePartyType,
        liablePartyId: payload.liablePartyId,
        liabilityReason: payload.liabilityReason,
        liabilityConfirmedAt: now,
        liabilityConfirmedBy: resolvedBy,
        liabilityStatusSnapshot: 'CONFIRMED',
        settlementReady: isQcClosed,
        settlementFreezeReason: isQcClosed ? '' : '质检未结案',
        deductionAmountEditable: isQcClosed,
        updatedAt: now,
        updatedBy: resolvedBy,
        auditLogs: [...b.auditLogs, {
          id: `DBIL-CONFIRM-${Date.now()}-${b.basisId}`,
          action: 'CONFIRM_LIABILITY_FROM_QC',
          detail: `由 QC ${qcId} 判责确认同步：结算方=${payload.settlementPartyType}/${payload.settlementPartyId}，settlementReady=${isQcClosed}`,
          at: now,
          by: resolvedBy,
        }],
      }
      dispatch({ type: 'UPDATE_DEDUCTION_BASIS_ITEM', payload: updatedBasis })
    }
    return { ok: true }
  }

  const disputeQcLiability = (
    qcId: string,
    payload: { disputeRemark: string },
    by: string,
  ): { ok: boolean; message?: string } => {
    const now = new Date().toLocaleString('sv').replace('T', ' ')
    const resolvedBy = getCurrentFactoryUser()?.name || by || 'UNKNOWN'
    const qc = state.qcRecords.find(q => q.qcId === qcId)
    if (!qc) return { ok: false, message: '质检单不存在' }
    if (qc.status !== 'SUBMITTED') return { ok: false, message: '质检单状态不是已提交，无法发起争议' }
    if (!payload.disputeRemark?.trim()) return { ok: false, message: '争议说明不能为空' }

    const updatedQc: QualityInspection = {
      ...qc,
      liabilityStatus: 'DISPUTED',
      disputeRemark: payload.disputeRemark,
      updatedAt: now,
      auditLogs: [...qc.auditLogs, {
        id: `QAL-DISPUTE-${Date.now()}`,
        action: 'DISPUTE_LIABILITY',
        detail: `发起争议：${payload.disputeRemark}`,
        at: now,
        by: resolvedBy,
      }],
    }
    dispatch({ type: 'UPDATE_QC', payload: updatedQc })

    const relatedBasis = state.deductionBasisItems.filter(
      b => b.sourceRefId === qcId || b.sourceId === qcId,
    )
    for (const b of relatedBasis) {
      const updatedBasis: DeductionBasisItem = {
        ...b,
        status: 'DISPUTED',
        liabilityStatusSnapshot: 'DISPUTED',
        settlementReady: false,
        settlementFreezeReason: '争议中，���结结算',
        deductionAmountEditable: false,
        updatedAt: now,
        updatedBy: resolvedBy,
        auditLogs: [...b.auditLogs, {
          id: `DBIL-DISPUTE-${Date.now()}-${b.basisId}`,
          action: 'DISPUTE_LIABILITY_FROM_QC',
          detail: `由 QC ${qcId} 发起争议同步，settlementFreezeReason=争议中，冻结结算`,
          at: now,
          by: resolvedBy,
        }],
      }
      dispatch({ type: 'UPDATE_DEDUCTION_BASIS_ITEM', payload: updatedBasis })
    }
    return { ok: true }
  }

  // =============================================
  // Allocation 开始条件同步（内部调用，不导出）
  // 必须在 closeQcCase / applyQcAllocationWriteback / addDyePrintReturn 之前定义
  // =============================================

  const syncAllocationGates = (by: string): void => {
    const updates: Array<{ taskId: string; action: 'BLOCK' | 'UNBLOCK'; noteZh: string; by: string }> = []

    for (const task of state.processTasks) {
      const depIds: string[] = (task as any).dependsOnTaskIds
        ?? (task as any).dependencyTaskIds
        ?? (task as any).predecessorTaskIds
        ?? []

      if (!depIds.length) continue

      const gateOk = depIds.every(depId => (state.allocationByTaskId[depId]?.availableQty ?? 0) > 0)

      if (!gateOk) {
        if (task.status === 'DONE' || task.status === 'CANCELLED') continue
        if (task.status === 'BLOCKED' && task.blockReason === 'QUALITY') continue
        if (task.status === 'BLOCKED' && task.blockReason === 'ALLOCATION_GATE') continue

        const depNames = depIds.map(id => {
          const dep = state.processTasks.find(t => t.taskId === id)
          return dep ? dep.processNameZh : id
        })
        const noteZh = `等待上一步可继续：${depNames.join('、')}（可用量=0）`
        updates.push({ taskId: task.taskId, action: 'BLOCK', noteZh, by })
      } else {
        if (task.status === 'BLOCKED' && task.blockReason === 'ALLOCATION_GATE') {
          updates.push({ taskId: task.taskId, action: 'UNBLOCK', noteZh: '上一步已可继续，开始条件解除', by })
        }
      }
    }

    if (updates.length > 0) {
      dispatch({ type: 'SYNC_ALLOCATION_GATES', payload: { updates } })
    }
  }

  const closeQcCase = (
    qcId: string,
    by: string,
  ): { ok: boolean; message?: string } => {
    const now = new Date().toLocaleString('sv').replace('T', ' ')
    const resolvedBy = getCurrentFactoryUser()?.name || by || 'UNKNOWN'
    const qc = state.qcRecords.find(q => q.qcId === qcId)
    if (!qc) return { ok: false, message: '质检单不存在' }
    if (qc.status !== 'SUBMITTED') return { ok: false, message: '质检单状态不是已提交，无法结案' }
    if (qc.liabilityStatus !== 'CONFIRMED') return { ok: false, message: '判责尚未确认，��得结案' }

    // 校验处置数量拆分完整性（FAIL 时必须）
    if (qc.result === 'FAIL') {
      const bd = qc.dispositionQtyBreakdown
      if (!bd) return { ok: false, message: '请先完成处置数量拆分，且合计必须等于不合格数量' }
      const sum = (bd.reworkQty ?? 0) + (bd.remakeQty ?? 0) + (bd.acceptAsDefectQty ?? 0) + (bd.scrapQty ?? 0) + (bd.acceptNoDeductQty ?? 0)
      const target = qc.affectedQty
      if (target !== undefined && target !== null && sum !== target)
        return { ok: false, message: `请先完成处置数量拆分，且合计必须等于不合��数量（目标：${target}，当前合计��${sum}）` }
    }

    // 若处置为 REWORK/REMAKE，或拆分中含返工/重做数量，校验子任务全部 DONE
    const bd = qc.dispositionQtyBreakdown
    const hasReworkInBreakdown = (bd?.reworkQty ?? 0) > 0 || (bd?.remakeQty ?? 0) > 0
    if (qc.disposition === 'REWORK' || qc.disposition === 'REMAKE' || hasReworkInBreakdown) {
      const generatedIds = qc.generatedTaskIds || []
      if (generatedIds.length === 0)
        return { ok: false, message: '处置为返工/重做但未生成子任务，无法结案' }
      const notDone = generatedIds.filter(tid => {
        const t = state.processTasks.find(pt => pt.taskId === tid)
        return !t || t.status !== 'DONE'
      })
      if (notDone.length > 0)
        return { ok: false, message: `以下返工任务尚未完成，无法结案：${notDone.join(', ')}` }
    }

    const updatedQc: QualityInspection = {
      ...qc,
      status: 'CLOSED',
      closedAt: now,
      closedBy: resolvedBy,
      updatedAt: now,
      auditLogs: [...qc.auditLogs, {
        id: `QAL-CLOSE-${Date.now()}`,
        action: 'CLOSE_CASE',
        detail: `质检单结���`,
        at: now,
        by: resolvedBy,
      }],
    }
    dispatch({ type: 'UPDATE_QC', payload: updatedQc })

    // 解除父任务 QUALITY 暂不能继续（仅 refType=TASK）
    if (qc.refType === 'TASK') {
      const parentTask = state.processTasks.find(t => t.taskId === qc.refId)
      if (parentTask && parentTask.status === 'BLOCKED' && parentTask.blockReason === 'QUALITY') {
        dispatch({
          type: 'UNBLOCK_TASK',
          payload: { taskId: qc.refId, remark: `QC ${qcId} 结案解暂不能继续`, by: resolvedBy },
        })
      }
    }

    // 解除关联任务 QUALITY 暂不能继续（refType=RETURN_BATCH）
    if (qc.refType === 'RETURN_BATCH') {
      const relatedTaskId = qc.refTaskId ?? state.returnBatches.find(b => b.batchId === qc.refId)?.taskId
      if (relatedTaskId) {
        const relatedTask = state.processTasks.find(t => t.taskId === relatedTaskId)
        if (relatedTask && relatedTask.status === 'BLOCKED' && relatedTask.blockReason === 'QUALITY') {
          dispatch({
            type: 'UNBLOCK_TASK',
            payload: { taskId: relatedTaskId, remark: `回货批次 QC ${qcId} 结案解暂不能继续`, by: resolvedBy },
          })
        }
      }
    }

    // 自动触发 Allocation ��写（TASK 和 RETURN_BATCH 均支持）
    if (qc.refType === 'TASK' || qc.refType === 'RETURN_BATCH') {
      const writebackResult = applyQcAllocationWriteback(qcId, resolvedBy)
      if (!writebackResult.ok) {
        // 不回滚结案，记录失败日志
        dispatch({
          type: 'UPDATE_QC',
          payload: {
            ...updatedQc,
            auditLogs: [...updatedQc.auditLogs, {
              id: `QAL-WRITEBACK-FAIL-${Date.now()}`,
              action: 'ALLOCATION_WRITEBACK_FAILED',
              detail: writebackResult.message ?? 'Allocation 同步更新失败',
              at: now,
              by: resolvedBy,
            }],
          },
        })
      }
    }

    // C) 染印加工单 FAIL 批次结案同步更新
    if (qc.result === 'FAIL' && qc.sourceProcessType === 'DYE_PRINT' && qc.sourceOrderId) {
      const dpId = qc.sourceOrderId
      const dpo = state.dyePrintOrders.find(o => o.dpId === dpId)
      if (dpo && dpo.relatedTaskId) {
        const bd = qc.dispositionQtyBreakdown
        const affected = qc.affectedQty ?? 0
        const scrap = bd?.scrapQty ?? 0
        const acceptDefect = bd?.acceptAsDefectQty ?? 0
        const deltaScrappedQty = scrap
        const deltaAcceptedAsDefectQty = acceptDefect
        const deltaAvailableQty = affected - scrap

        const taskId = dpo.relatedTaskId

        // 1) 更新染印加���单本体 availableQty 及 returnBatch 字段
        const updatedReturnBatches = dpo.returnBatches.map(rb => {
          if (rb.returnId !== qc.sourceReturnId) return rb
          return { ...rb, effectiveAvailableQty: deltaAvailableQty, qcClosedAt: now }
        })
        dispatch({
          type: 'UPDATE_DYE_PRINT_ORDER',
          payload: {
            ...dpo,
            availableQty: dpo.availableQty + deltaAvailableQty,
            returnBatches: updatedReturnBatches,
            updatedAt: now,
            updatedBy: resolvedBy,
          },
        })

        // 2) 更新当前生产流程 Allocation snapshot
        const old: AllocationSnapshot = state.allocationByTaskId[taskId] ?? {
          taskId,
          availableQty: 0,
          acceptedAsDefectQty: 0,
          scrappedQty: 0,
          updatedAt: now,
          updatedBy: resolvedBy,
        }
        dispatch({
          type: 'UPSERT_ALLOCATION_SNAPSHOT',
          payload: {
            taskId,
            availableQty: old.availableQty + deltaAvailableQty,
            acceptedAsDefectQty: old.acceptedAsDefectQty + deltaAcceptedAsDefectQty,
            scrappedQty: old.scrappedQty + deltaScrappedQty,
            updatedAt: now,
            updatedBy: resolvedBy,
          },
        })

        // 3) 追加 allocationEvent
        dispatch({
          type: 'ADD_ALLOCATION_EVENT',
          payload: {
            eventId: `ALLOC-DP-FAIL-${Date.now()}`,
            taskId,
            refType: 'DYE_PRINT_ORDER',
            refId: dpId,
            deltaAvailableQty,
            deltaAcceptedAsDefectQty,
            deltaScrappedQty,
            noteZh: `染印加工单 ${dpId} 不合格批次结案可继续：可用量+${deltaAvailableQty}（瑕疵+${deltaAcceptedAsDefectQty}，报废+${deltaScrappedQty}）`,
            createdAt: now,
            createdBy: resolvedBy,
          },
        })

        // 4) 触发下一步开始条件重算
        syncAllocationGates('系统')
      }
    }

    // C2) 同���刷新关联 DeductionBasisItem 的结算状态（所有来源，含 DYE_PRINT）
    const closeBasisList = state.deductionBasisItems.filter(
      b => b.sourceRefId === qcId || b.sourceId === qcId
    )
    for (const b of closeBasisList) {
      let settlementReady: boolean
      let settlementFreezeReason: string
      let deductionAmountEditable: boolean

      if (b.status === 'VOID') {
        settlementReady = false
        settlementFreezeReason = '已作废'
        deductionAmountEditable = false
      } else if (b.liabilityStatusSnapshot === 'CONFIRMED') {
        settlementReady = true
        settlementFreezeReason = ''
        deductionAmountEditable = true
      } else if (b.liabilityStatusSnapshot === 'DISPUTED') {
        settlementReady = false
        settlementFreezeReason = '争议中，冻结结算'
        deductionAmountEditable = false
      } else {
        settlementReady = false
        settlementFreezeReason = '待确认判责'
        deductionAmountEditable = false
      }

      const updatedCloseBasis: DeductionBasisItem = {
        ...b,
        qcStatusSnapshot: 'CLOSED',
        settlementReady,
        settlementFreezeReason,
        deductionAmountEditable,
        updatedAt: now,
        updatedBy: resolvedBy,
        auditLogs: [...b.auditLogs, {
          id: `DBIL-CLOSE-${Date.now()}-${b.basisId}`,
          action: 'SYNC_SETTLEMENT_READY_FROM_QC',
          detail: `QC ${qcId} 结案，settlementReady=${settlementReady}，freezeReason=${settlementFreezeReason || '无'}`,
          at: now,
          by: resolvedBy,
        }],
      }
      dispatch({ type: 'UPDATE_DEDUCTION_BASIS_ITEM', payload: updatedCloseBasis })
    }

    return { ok: true }
  }

  // =============================================
  // 仲裁处理
  // =============================================

  const arbitrateDispute = (
    input: {
      qcId: string
      result: 'UPHOLD' | 'REASSIGN' | 'VOID_DEDUCTION'
      remark: string
      liablePartyType?: SettlementPartyType
      liablePartyId?: string
      settlementPartyType?: SettlementPartyType
      settlementPartyId?: string
    },
    by: string,
  ): { ok: boolean; message?: string } => {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const { qcId, result, remark, liablePartyType, liablePartyId, settlementPartyType, settlementPartyId } = input

    const qc = state.qcRecords.find(q => q.qcId === qcId)
    if (!qc) return { ok: false, message: `质检单 ${qcId} 不存在` }
    if (qc.liabilityStatus !== 'DISPUTED') return { ok: false, message: '仅争议中的质检单可执行仲裁' }
    if (!remark.trim()) return { ok: false, message: '仲裁说明不能为空' }
    if (result === 'REASSIGN') {
      if (!liablePartyType || !liablePartyId) return { ok: false, message: '改判责任方时，责任方不能为空' }
      if (!settlementPartyType || !settlementPartyId) return { ok: false, message: '改判责任方时，扣款对象不能为空' }
    }

    // 关联扣款依据
    const relatedBases = state.deductionBasisItems.filter(
      b => b.sourceRefId === qcId || b.sourceId === qcId,
    )

    const settlementFn = (qcStatus: typeof qc.status) => ({
      ready: qcStatus === 'CLOSED',
      reason: qcStatus === 'CLOSED' ? '' : '质检未结案',
      editable: qcStatus === 'CLOSED',
    })

    // ---- QC 更新 ----
    const qcPatch: Partial<QualityInspection> = {
      liabilityStatus: 'CONFIRMED',
      arbitrationResult: result,
      arbitrationRemark: remark,
      arbitratedAt: ts,
      arbitratedBy: by,
      updatedAt: ts,
      auditLogs: [
        ...qc.auditLogs,
        { id: `AL-QC-ARB-${Date.now()}`, action: 'ARBITRATE_DISPUTE', detail: `仲裁结果：${result}，说明：${remark}`, at: ts, by },
      ],
    }
    if (result === 'REASSIGN') {
      qcPatch.liablePartyType = liablePartyType
      qcPatch.liablePartyId = liablePartyId
      qcPatch.settlementPartyType = settlementPartyType
      qcPatch.settlementPartyId = settlementPartyId
    }
    dispatch({ type: 'UPDATE_QC', payload: { ...qc, ...qcPatch } })

    // ---- DeductionBasisItem 更新 ----
    for (const basis of relatedBases) {
      if (result === 'VOID_DEDUCTION') {
        const updated: DeductionBasisItem = {
          ...basis,
          status: 'VOID',
          arbitrationResult: 'VOID_DEDUCTION',
          arbitrationRemark: remark,
          arbitratedAt: ts,
          arbitratedBy: by,
          settlementReady: false,
          settlementFreezeReason: '已作废',
          deductionAmountEditable: false,
          updatedAt: ts,
          updatedBy: by,
          auditLogs: [
            ...basis.auditLogs,
            { id: `AL-DBI-ARB-${Date.now()}`, action: 'ARBITRATE_DISPUTE_FROM_QC', detail: `仲裁作废，来源 ${qcId}`, at: ts, by },
          ],
        }
        dispatch({ type: 'UPDATE_DEDUCTION_BASIS', payload: updated })
      } else {
        const s = settlementFn(qc.status)
        const updated: DeductionBasisItem = {
          ...basis,
          status: basis.status === 'DISPUTED' ? 'CONFIRMED' : basis.status,
          liabilityStatusSnapshot: 'CONFIRMED',
          arbitrationResult: result,
          arbitrationRemark: remark,
          arbitratedAt: ts,
          arbitratedBy: by,
          settlementReady: s.ready,
          settlementFreezeReason: s.reason,
          deductionAmountEditable: s.editable,
          ...(result === 'REASSIGN' ? {
            liablePartyType,
            liablePartyId,
            settlementPartyType,
            settlementPartyId,
          } : {}),
          updatedAt: ts,
          updatedBy: by,
          auditLogs: [
            ...basis.auditLogs,
            { id: `AL-DBI-ARB-${Date.now()}`, action: 'ARBITRATE_DISPUTE_FROM_QC', detail: `仲裁结果：${result}，来源 ${qcId}`, at: ts, by },
          ],
        }
        dispatch({ type: 'UPDATE_DEDUCTION_BASIS', payload: updated })
      }
    }

    return { ok: true }
  }

  // =============================================
  // Allocation 同步更新
  // =============================================

  const applyQcAllocationWriteback = (
    qcId: string,
    by: string,
  ): { ok: boolean; message?: string } => {
    const now = new Date().toLocaleString('sv').replace('T', ' ')
    const resolvedBy = getCurrentFactoryUser()?.name || by || 'UNKNOWN'

    const qc = state.qcRecords.find(q => q.qcId === qcId)
    if (!qc) return { ok: false, message: `质检单 ${qcId} 不存在` }

    if (qc.result !== 'FAIL' || qc.status !== 'CLOSED')
      return { ok: false, message: '仅 FAIL 且已结案的质检单可触发 Allocation 同步更新' }

    if (qc.refType !== 'TASK' && qc.refType !== 'RETURN_BATCH')
      return { ok: false, message: 'V0 仅支持 TASK 或 RETURN_BATCH 维度同步更新' }

    // 确定 taskId
    let taskId: string
    let batchId: string | undefined
    if (qc.refType === 'RETURN_BATCH') {
      batchId = qc.refId
      taskId = qc.refTaskId ?? state.returnBatches.find(b => b.batchId === batchId)?.taskId ?? ''
      if (!taskId) return { ok: false, message: `无法确定 RETURN_BATCH 批次 ${batchId} 对应的 taskId` }
    } else {
      taskId = qc.refId
    }
    const bd = qc.dispositionQtyBreakdown
    if (!bd) return { ok: false, message: '处置数量拆分缺失，无法同步更新' }

    const affected = qc.affectedQty ?? 0
    const scrap = bd.scrapQty ?? 0
    const acceptDefect = bd.acceptAsDefectQty ?? 0
    const acceptNoDeduct = bd.acceptNoDeductQty ?? 0
    const rework = bd.reworkQty ?? 0
    const remake = bd.remakeQty ?? 0

    // 防御：拆分合计应等于 affected
    const sum = scrap + acceptDefect + acceptNoDeduct + rework + remake
    if (affected > 0 && sum !== affected)
      return { ok: false, message: `处置拆分合计（${sum}）不等于不合格数量（${affected}），同步更新中止` }

    // V0 口径：deltaAvailableQty = affected - scrap
    const deltaAvailableQty = affected - scrap
    const deltaAcceptedAsDefectQty = acceptDefect
    const deltaScrappedQty = scrap

    // 读取或初始��� snapshot
    const old: AllocationSnapshot = state.allocationByTaskId[taskId] ?? {
      taskId,
      availableQty: 0,
      acceptedAsDefectQty: 0,
      scrappedQty: 0,
      updatedAt: now,
      updatedBy: resolvedBy,
    }

    const newSnapshot: AllocationSnapshot = {
      taskId,
      availableQty: old.availableQty + deltaAvailableQty,
      acceptedAsDefectQty: old.acceptedAsDefectQty + deltaAcceptedAsDefectQty,
      scrappedQty: old.scrappedQty + deltaScrappedQty,
      updatedAt: now,
      updatedBy: resolvedBy,
    }

    dispatch({ type: 'UPSERT_ALLOCATION_SNAPSHOT', payload: newSnapshot })

    const event: AllocationEvent = {
      eventId: `ALLOC-${Date.now()}`,
      taskId,
      refType: 'QC',
      refId: qcId,
      deltaAvailableQty,
      deltaAcceptedAsDefectQty,
      deltaScrappedQty,
      noteZh: batchId
        ? `回货批次 ${batchId}（QC ${qcId}）结案同步更新：可用量+${deltaAvailableQty}（瑕疵+${deltaAcceptedAsDefectQty}，报废+${deltaScrappedQty}）`
        : `QC ${qcId} 结案同步更新可用量+${deltaAvailableQty}（瑕���+${deltaAcceptedAsDefectQty}，报废+${deltaScrappedQty}）`,
      createdAt: now,
      createdBy: resolvedBy,
    }

    dispatch({ type: 'ADD_ALLOCATION_EVENT', payload: event })

    // 染印加工单联动：同步更新后检查是否可关闭
    if (batchId) {
      const sourceBatch = state.returnBatches.find(b => b.batchId === batchId)
      if (sourceBatch?.sourceType === 'DYE_PRINT_ORDER' && sourceBatch.sourceId) {
        const dpo = state.dyePrintOrders.find(o => o.orderId === sourceBatch.sourceId)
        if (dpo && dpo.status !== 'CLOSED') {
          const updatedBatches = state.returnBatches.map(b =>
            b.batchId === batchId ? { ...b, qcStatus: 'PASS_CLOSED' as ReturnBatchQcStatus } : b
          )
          const updatedQcRecords = state.qcRecords.map(q => q.qcId === qcId ? { ...q, status: 'CLOSED' as const } : q)
          if (canCloseDyePrintOrder(dpo, updatedBatches, updatedQcRecords)) {
            dispatch({ type: 'UPDATE_DYE_PRINT_ORDER', payload: { ...dpo, status: 'CLOSED', updatedAt: now, updatedBy: resolvedBy } })
          }
        }
      }
    }

    // ���禁同步：QC 结案同步更新后重新评估所有下一步依赖
    syncAllocationGates(resolvedBy)

    return { ok: true }
  }

  // =============================================
  // 任务依赖关系配置
  // =============================================

  const updateTaskDependencies = (
    taskId: string,
    dependsOnTaskIds: string[],
    by: string,
  ): { ok: boolean; message?: string } => {
    const resolvedBy = getCurrentFactoryUser()?.name || by || 'UNKNOWN'
    const task = state.processTasks.find(t => t.taskId === taskId)
    if (!task) return { ok: false, message: `任务 ${taskId} 不存在` }

    const oldDeps: string[] = (task as any).dependsOnTaskIds
      ?? (task as any).dependencyTaskIds
      ?? (task as any).predecessorTaskIds
      ?? []

    // 去重、过滤自身
    const cleaned = [...new Set(dependsOnTaskIds.filter(id => id !== taskId))]

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const detail = `dependsOnTaskIds：[${oldDeps.join(', ')}] → [${cleaned.join(', ')}]（操作人：${resolvedBy}）`

    dispatch({
      type: 'UPDATE_TASK_DEPENDENCIES',
      payload: { taskId, dependsOnTaskIds: cleaned },
    })
    // 覆盖审计日志 detail 和 by（reducer 写了 '系统'，这里 dispatch 一个追加）
    dispatch({
      type: 'UPDATE_TASK',
      payload: {
        ...task,
        dependsOnTaskIds: cleaned,
        updatedAt: now,
        auditLogs: [...task.auditLogs, {
          id: `AL-DEP-${Date.now()}-${taskId}`,
          action: 'UPDATE_DEPENDENCIES',
          detail,
          at: now,
          by: resolvedBy,
        }],
      } as any,
    })

    // 开始条件重新计算
    syncAllocationGates('系统')

    return { ok: true }
  }

  // =============================================
  // 分批回货
  // =============================================

  const createReturnBatch = (
    taskId: string,
    returnedQty: number,
    by: string,
  ): { ok: boolean; batchId?: string; message?: string } => {
    const ts = new Date().toLocaleString('sv').replace('T', ' ')
    const resolvedBy = getCurrentFactoryUser()?.name || by || 'UNKNOWN'
    const task = state.processTasks.find(t => t.taskId === taskId)
    if (!task) return { ok: false, message: `任务 ${taskId} 不存在` }
    if (!Number.isInteger(returnedQty) || returnedQty <= 0)
      return { ok: false, message: '回货数量必须为正整数' }

    const seq = String(Date.now()).slice(-4)
    const ym = new Date().toISOString().slice(0, 7).replace('-', '')
    const batchId = `RB-${ym}-${seq}`

    const batch: ReturnBatch = {
      batchId,
      taskId,
      returnedQty,
      qcStatus: 'QC_PENDING',
      createdAt: ts,
      createdBy: resolvedBy,
    }
    dispatch({ type: 'ADD_RETURN_BATCH', payload: batch })
    return { ok: true, batchId }
  }

  const markReturnBatchPass = (
    batchId: string,
    by: string,
  ): { ok: boolean; message?: string } => {
    const ts = new Date().toLocaleString('sv').replace('T', ' ')
    const resolvedBy = getCurrentFactoryUser()?.name || by || 'UNKNOWN'
    const batch = state.returnBatches.find(b => b.batchId === batchId)
    if (!batch) return { ok: false, message: `批次 ${batchId} 不存在` }
    if (batch.qcStatus !== 'QC_PENDING') return { ok: false, message: '该批次不在待质检状态' }

    const updated: ReturnBatch = {
      ...batch,
      qcStatus: 'PASS_CLOSED',
      updatedAt: ts,
      updatedBy: resolvedBy,
    }
    dispatch({ type: 'UPDATE_RETURN_BATCH', payload: updated })

    // 写入 Allocation
    const taskId = batch.taskId
    const old: AllocationSnapshot = state.allocationByTaskId[taskId] ?? {
      taskId,
      availableQty: 0,
      acceptedAsDefectQty: 0,
      scrappedQty: 0,
      updatedAt: ts,
      updatedBy: resolvedBy,
    }
    dispatch({
      type: 'UPSERT_ALLOCATION_SNAPSHOT',
      payload: {
        taskId,
        availableQty: old.availableQty + batch.returnedQty,
        acceptedAsDefectQty: old.acceptedAsDefectQty,
        scrappedQty: old.scrappedQty,
        updatedAt: ts,
        updatedBy: resolvedBy,
      },
    })
    dispatch({
      type: 'ADD_ALLOCATION_EVENT',
      payload: {
        eventId: `ALLOC-RB-PASS-${Date.now()}`,
        taskId,
        refType: 'RETURN_BATCH',
        refId: batchId,
        deltaAvailableQty: batch.returnedQty,
        deltaAcceptedAsDefectQty: 0,
        deltaScrappedQty: 0,
        noteZh: `回货批次 ${batchId} 合��可继续：可用量+${batch.returnedQty}`,
        createdAt: ts,
        createdBy: resolvedBy,
      },
    })

    // 染印加工单联动：检查是否可关闭
    if (batch.sourceType === 'DYE_PRINT_ORDER' && batch.sourceId) {
      const dpo = state.dyePrintOrders.find(o => o.orderId === batch.sourceId)
      if (dpo) {
        const updatedBatches = state.returnBatches.map(b => b.batchId === batchId ? { ...b, qcStatus: 'PASS_CLOSED' as ReturnBatchQcStatus, updatedAt: ts, updatedBy: resolvedBy } : b)
        if (canCloseDyePrintOrder(dpo, updatedBatches, state.qcRecords)) {
          dispatch({ type: 'UPDATE_DYE_PRINT_ORDER', payload: { ...dpo, status: 'CLOSED', updatedAt: ts, updatedBy: resolvedBy } })
        }
      }
    }

    // 开始条件重算：可继续事件后重新评估所有下一步���赖
    syncAllocationGates(resolvedBy)

    return { ok: true }
  }

  const startReturnBatchFailQc = (
    batchId: string,
    by: string,
  ): { ok: boolean; qcId?: string; message?: string } => {
    const ts = new Date().toLocaleString('sv').replace('T', ' ')
    const resolvedBy = getCurrentFactoryUser()?.name || by || 'UNKNOWN'
    const batch = state.returnBatches.find(b => b.batchId === batchId)
    if (!batch) return { ok: false, message: `批次 ${batchId} 不存在` }
    if (batch.qcStatus !== 'QC_PENDING') return { ok: false, message: '该批次不在待质检状态' }

    const task = state.processTasks.find(t => t.taskId === batch.taskId)
    if (!task) return { ok: false, message: `任务 ${batch.taskId} 不存在` }

    // 生成 QC 单
    const qcId = `QC-RB-${Date.now()}`
    // 若来自染印加工单，refTaskId 使用加工单的 relatedTaskId
    const dpoOrder = batch.sourceType === 'DYE_PRINT_ORDER' && batch.sourceId
      ? state.dyePrintOrders.find(o => o.orderId === batch.sourceId)
      : undefined
    const refTaskIdForQc = dpoOrder?.relatedTaskId ?? batch.taskId
    const newQc: QualityInspection = {
      qcId,
      refType: 'RETURN_BATCH',
      refId: batchId,
      refTaskId: refTaskIdForQc,
      productionOrderId: task.productionOrderId ?? '',
      inspector: resolvedBy,
      inspectedAt: ts,
      result: 'FAIL',
      defectItems: [],
      status: 'SUBMITTED',
      rootCauseType: 'UNKNOWN',
      liabilityStatus: 'DRAFT',
      affectedQty: batch.returnedQty,
      auditLogs: [{
        id: `QAL-RB-CREATE-${Date.now()}`,
        action: 'CREATE_FROM_RETURN_BATCH',
        detail: `回货批次 ${batchId} 不合格，系统创建质检单`,
        at: ts,
        by: resolvedBy,
      }],
      createdAt: ts,
      updatedAt: ts,
    }
    dispatch({ type: 'ADD_QC', payload: newQc })

    // 生成 DeductionBasisItem
    const basisId = `DBI-RB-${Date.now()}`
    dispatch({
      type: 'ADD_DEDUCTION_BASIS_ITEM',
      payload: {
        basisId,
        sourceType: 'QC_FAIL',
        sourceRefId: qcId,
        sourceId: qcId,
        productionOrderId: task.productionOrderId ?? '',
        taskId: batch.taskId,
        factoryId: task.assignedFactoryId ?? SEED_FACTORY_ID,
        reasonCode: 'QC_FAIL_DEDUCTION',
        qty: batch.returnedQty,
        uom: 'PIECE',
        evidenceRefs: [],
        status: 'DRAFT',
        deepLinks: { qcHref: `/fcs/quality/qc-records/${qcId}` },
        createdAt: ts,
        createdBy: resolvedBy,
        auditLogs: [{
          id: `DBIL-RB-${Date.now()}`,
          action: 'CREATE_BASIS_FROM_QC',
          detail: `��回货批次 ${batchId} QC 单 ${qcId} 生成扣款依据`,
          at: ts,
          by: resolvedBy,
        }],
      },
    })

    // 更新批次状态
    dispatch({
      type: 'UPDATE_RETURN_BATCH',
      payload: { ...batch, qcStatus: 'FAIL_IN_QC', linkedQcId: qcId, updatedAt: ts, updatedBy: resolvedBy },
    })

    // 暂不能继续任务
    dispatch({
      type: 'BLOCK_TASK',
      payload: {
        taskId: batch.taskId,
        reason: 'QUALITY',
        remark: `回货批次 ${batchId} 质检不合格，已进入处理`,
        by: resolvedBy,
      },
    })

    return { ok: true, qcId }
  }

  // =============================================
  // 染印加工单
  // =============================================

  const canCloseDyePrintOrder = (order: DyePrintOrder, batches: ReturnBatch[], qcRecordsSnap: QualityInspection[]): boolean => {
    if (order.returnedPassQty + order.returnedFailQty < order.plannedQty) return false
    const orderBatches = batches.filter(b => b.sourceType === 'DYE_PRINT_ORDER' && b.sourceId === order.dpId)
    const hasPending = orderBatches.some(b => b.qcStatus === 'QC_PENDING' || b.qcStatus === 'FAIL_IN_QC')
    if (hasPending) return false
    const failBatches = orderBatches.filter(b => b.qcStatus === 'FAIL_IN_QC' && b.linkedQcId)
    for (const fb of failBatches) {
      const linkedQc = qcRecordsSnap.find(q => q.qcId === fb.linkedQcId)
      if (!linkedQc || linkedQc.status !== 'CLOSED') return false
    }
    return true
  }

  const createDyePrintOrder = (
    input: {
      productionOrderId: string
      relatedTaskId?: string
      processorFactoryId: string
      processorFactoryName: string
      processType: DyePrintProcessType
      plannedQty: number
      remark?: string
    },
  ): { ok: boolean; dpId?: string; message?: string } => {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const resolvedBy = getCurrentFactoryUser()?.name || '管理员'

    if (!input.productionOrderId) return { ok: false, message: '生���工单号不能为空' }
    if (!input.processorFactoryId) return { ok: false, message: '承接主体不能为空' }
    if (!Number.isInteger(input.plannedQty) || input.plannedQty <= 0)
      return { ok: false, message: '计划数��必须为正整数' }

    const seq = String(Date.now()).slice(-4)
    const ym = new Date().toISOString().slice(0, 7).replace('-', '')
    const dpId = `DPO-${ym}-${seq}`

    const order: DyePrintOrder = {
      dpId,
      orderId: dpId,
      productionOrderId: input.productionOrderId,
      relatedTaskId: input.relatedTaskId ?? '',
      processorFactoryId: input.processorFactoryId,
      processorFactoryName: input.processorFactoryName,
      settlementPartyType: 'PROCESSOR',
      settlementPartyId: input.processorFactoryId,
      settlementRelation: deriveDyePrintSettlementRelation(input.processorFactoryId, 'PROCESSOR', input.processorFactoryId),
      processType: input.processType,
      plannedQty: input.plannedQty,
      returnedPassQty: 0,
      returnedFailQty: 0,
      availableQty: 0,
      status: 'DRAFT',
      remark: input.remark,
      returnBatches: [],
      createdAt: ts,
      createdBy: resolvedBy,
      updatedAt: ts,
    }
    dispatch({ type: 'ADD_DYE_PRINT_ORDER', payload: order })
    return { ok: true, dpId }
  }

  const startDyePrintOrder = (dpId: string): { ok: boolean; message?: string } => {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const order = state.dyePrintOrders.find(o => o.dpId === dpId)
    if (!order) return { ok: false, message: `加工单 ${dpId} 不存在` }
    if (order.status !== 'DRAFT') return { ok: false, message: '只有草稿���态的���工单可以开始加工' }
    dispatch({ type: 'UPDATE_DYE_PRINT_ORDER', payload: { ...order, status: 'PROCESSING', updatedAt: ts } })
    return { ok: true }
  }

  const closeDyePrintOrder = (dpId: string): { ok: boolean; message?: string } => {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const order = state.dyePrintOrders.find(o => o.dpId === dpId)
    if (!order) return { ok: false, message: `加工单 ${dpId} 不存在` }
    if (order.status === 'CLOSED') return { ok: false, message: '加工单已关闭' }
    dispatch({ type: 'UPDATE_DYE_PRINT_ORDER', payload: { ...order, status: 'CLOSED', updatedAt: ts } })
    return { ok: true }
  }

  const addDyePrintReturn = (
    dpId: string,
    payload: { qty: number; result: DyePrintReturnResult; disposition?: QcDisposition; remark?: string },
  ): { ok: boolean; returnId?: string; qcId?: string; message?: string } => {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const resolvedBy = getCurrentFactoryUser()?.name || '管理员'
    const order = state.dyePrintOrders.find(o => o.dpId === dpId)
    if (!order) return { ok: false, message: `加工单 ${dpId} 不存在` }
    if (order.status === 'CLOSED') return { ok: false, message: '加工单已关闭，不能���记回货' }
    if (!Number.isInteger(payload.qty) || payload.qty <= 0) return { ok: false, message: '回货数量必须为正整数' }

    // A) relatedTaskId 必填
    if (!order.relatedTaskId) return { ok: false, message: '未关联���链路任务��无法同步更新可用量' }

    if (payload.result === 'FAIL') {
      if (!payload.disposition) return { ok: false, message: '不合格回货必须选择处置方式' }
    }

    const returnId = `RB-${dpId}-${Date.now()}`
    let qcId: string | undefined

    if (payload.result === 'FAIL') {
      // B) FAIL：创建 QC，带 sourceProcessType/sourceOrderId/sourceReturnId
      const newQc: QualityInspection = {
        qcId: `QC-DP-${Date.now()}`,
        refType: 'TASK',
        refId: order.relatedTaskId,
        productionOrderId: order.productionOrderId,
        inspector: resolvedBy,
        inspectedAt: ts,
        result: 'FAIL',
        defectItems: [{ defectCode: 'DYE_PRINT_DEFECT', defectName: '染印不良', qty: payload.qty }],
        disposition: payload.disposition,
        affectedQty: payload.qty,
        rootCauseType: 'DYE_PRINT',
        responsiblePartyType: 'PROCESSOR',
        responsiblePartyId: order.processorFactoryId,
        liabilityStatus: 'DRAFT',
        remark: payload.remark,
        sourceProcessType: 'DYE_PRINT',
        sourceOrderId: dpId,
        sourceReturnId: returnId,
        auditLogs: [{
          id: `QAL-DP-CREATE-${Date.now()}`,
          action: 'CREATE_FROM_DYE_PRINT',
          detail: `染印加工单 ${dpId} 不合格回货，系统创建质检单`,
          at: ts,
          by: resolvedBy,
        }],
        createdAt: ts,
        updatedAt: ts,
        status: 'SUBMITTED',
      }
      dispatch({ type: 'ADD_QC', payload: newQc })
      qcId = newQc.qcId

      // B) 创建 DeductionBasisItem（幂等：检查 sourceReturnId）
      const existingDbi = state.deductionBasisItems.find(
        b => b.sourceReturnId === returnId || (b.sourceOrderId === dpId && b.sourceRefId === newQc.qcId)
      )
      if (!existingDbi) {
        const newBasis: DeductionBasisItem = {
          basisId: `DBI-DP-${Date.now()}`,
          sourceType: 'QC_FAIL',
          sourceRefId: newQc.qcId,
          sourceId: newQc.qcId,
          productionOrderId: order.productionOrderId,
          taskId: order.relatedTaskId || undefined,
          factoryId: order.processorFactoryId,
          settlementPartyType: order.settlementPartyType,
          settlementPartyId: order.settlementPartyId,
          liablePartyType: 'PROCESSOR',
          liablePartyId: order.processorFactoryId,
          rootCauseType: 'DYE_PRINT',
          reasonCode: 'QUALITY_FAIL',
          qty: payload.qty,
          deductionQty: payload.qty,
          uom: 'PIECE',
          disposition: payload.disposition,
          summary: '染印不良扣款依据',
          evidenceRefs: [],
          status: 'DRAFT',
          deepLinks: { qcHref: `/fcs/quality/qc-records/${newQc.qcId}` },
          // 染印来源字段
          sourceProcessType: 'DYE_PRINT',
          sourceOrderId: dpId,
          sourceReturnId: returnId,
          processorFactoryId: order.processorFactoryId,
          settlementReady: false,
          settlementFreezeReason: '质检未结案',
          qcStatusSnapshot: 'SUBMITTED',
          liabilityStatusSnapshot: 'PENDING',
          deductionAmountEditable: false,
          createdAt: ts,
          createdBy: resolvedBy,
          auditLogs: [{
            id: `DBIL-DP-CREATE-${Date.now()}`,
            action: 'CREATE_FROM_DYE_PRINT_FAIL',
            detail: `染印加工单 ${dpId} 不合格回货，系统自动生成扣款依据；QC=${newQc.qcId}`,
            at: ts,
            by: resolvedBy,
          }],
        }
        dispatch({ type: 'ADD_DEDUCTION_BASIS_ITEM', payload: newBasis })
      }
      // FAIL 不增加 availableQty，不调 syncAllocationGates
    }

    const batch: DyePrintReturnBatch = {
      returnId,
      returnedAt: ts,
      qty: payload.qty,
      result: payload.result,
      disposition: payload.disposition,
      remark: payload.remark,
      qcId,
    }

    dispatch({ type: 'ADD_DYE_PRINT_RETURN', payload: { dpId, batch } })

    // A) PASS：同步写入当前生产流程 Allocation
    if (payload.result === 'PASS') {
      const taskId = order.relatedTaskId
      const old: AllocationSnapshot = state.allocationByTaskId[taskId] ?? {
        taskId,
        availableQty: 0,
        acceptedAsDefectQty: 0,
        scrappedQty: 0,
        updatedAt: ts,
        updatedBy: resolvedBy,
      }
      dispatch({
        type: 'UPSERT_ALLOCATION_SNAPSHOT',
        payload: {
          taskId,
          availableQty: old.availableQty + payload.qty,
          acceptedAsDefectQty: old.acceptedAsDefectQty,
          scrappedQty: old.scrappedQty,
          updatedAt: ts,
          updatedBy: resolvedBy,
        },
      })
      dispatch({
        type: 'ADD_ALLOCATION_EVENT',
        payload: {
          eventId: `ALLOC-DP-PASS-${Date.now()}`,
          taskId,
          refType: 'DYE_PRINT_ORDER',
          refId: dpId,
          deltaAvailableQty: payload.qty,
          deltaAcceptedAsDefectQty: 0,
          deltaScrappedQty: 0,
          noteZh: `染印加工单 ${dpId} 合格回货可继续：可用量+${payload.qty}`,
          createdAt: ts,
          createdBy: resolvedBy,
        },
      })
      // 触发下一步开始条件重算
      syncAllocationGates('系统')
    }

    return { ok: true, returnId, qcId }
  }

  // Old compat stubs (for ReturnBatch gate logic that references these old names):
  const createReturnBatchForDyePrintOrder = (
    orderId: string,
    returnedQty: number,
    by: string,
  ): { ok: boolean; batchId?: string; message?: string } => {
    return { ok: false, message: '请使用 addDyePrintReturn' }
  }

  // =============================================
  // RBAC helpers
  // =============================================
  // RBAC helpers
  // =============================================
  const getCurrentFactoryUser = (): FactoryUser | undefined => {
    const session = getPdaSession()
    if (!session.userId) return undefined
    return state.factoryUsers.find(u => u.userId === session.userId && u.status === 'ACTIVE')
  }

  const resolvePermissions = (user: FactoryUser): Set<PermissionKey> => {
    const keys = new Set<PermissionKey>()
    user.roleIds.forEach(roleId => {
      const role = state.factoryRoles.find(r => r.roleId === roleId)
      role?.permissionKeys.forEach(k => keys.add(k))
    })
    return keys
  }

  const can = (permissionKey: PermissionKey): boolean => {
    const user = getCurrentFactoryUser()
    if (!user) return false
    return resolvePermissions(user).has(permissionKey)
  }

  const computeEffectivePermissionsForUser = (userId: string): PermissionKey[] => {
    const user = state.factoryUsers.find(u => u.userId === userId)
    if (!user) return []
    return Array.from(resolvePermissions(user))
  }

  // =============================================
  // FactoryPdaUser 管理 actions
  // =============================================
  const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19)

  const listFactoryPdaUsers = (factoryId: string): FactoryPdaUser[] =>
    state.factoryPdaUsers.filter(u => u.factoryId === factoryId)

  const createFactoryPdaUser = (
    input: Omit<FactoryPdaUser, 'userId' | 'createdAt' | 'createdBy'>
  ): { ok: boolean; user?: FactoryPdaUser; messageKey?: string } => {
    const duplicate = state.factoryPdaUsers.some(
      u => u.factoryId === input.factoryId && u.loginId === input.loginId
    )
    if (duplicate) {
      return { ok: false, messageKey: 'factory.pdaAuth.validation.duplicateLoginId' }
    }
    const user: FactoryPdaUser = {
      ...input,
      userId: `FU-${Date.now()}`,
      createdAt: now(),
      createdBy: 'ADMIN',
    }
    dispatch({ type: 'CREATE_FACTORY_PDA_USER', payload: user })
    return { ok: true, user }
  }

  const updateFactoryPdaUser = (
    userId: string,
    patch: Partial<Pick<FactoryPdaUser, 'name' | 'loginId' | 'roleId'>>
  ): { ok: boolean; user?: FactoryPdaUser; messageKey?: string } => {
    const existing = state.factoryPdaUsers.find(u => u.userId === userId)
    if (!existing) return { ok: false, messageKey: 'factory.pdaAuth.validation.required' }
    if (patch.loginId && patch.loginId !== existing.loginId) {
      const dup = state.factoryPdaUsers.some(
        u => u.factoryId === existing.factoryId && u.loginId === patch.loginId && u.userId !== userId
      )
      if (dup) return { ok: false, messageKey: 'factory.pdaAuth.validation.duplicateLoginId' }
    }
    const updated: FactoryPdaUser = { ...existing, ...patch, updatedAt: now(), updatedBy: 'ADMIN' }
    dispatch({ type: 'UPDATE_FACTORY_PDA_USER', payload: updated })
    return { ok: true, user: updated }
  }

  const toggleFactoryPdaUserLock = (userId: string, locked: boolean): void => {
    const existing = state.factoryPdaUsers.find(u => u.userId === userId)
    if (!existing) return
    dispatch({
      type: 'UPDATE_FACTORY_PDA_USER',
      payload: { ...existing, status: locked ? 'LOCKED' : 'ACTIVE', updatedAt: now(), updatedBy: 'ADMIN' },
    })
  }

  const setFactoryPdaUserRole = (userId: string, roleId: string): void => {
    const existing = state.factoryPdaUsers.find(u => u.userId === userId)
    if (!existing) return
    dispatch({
      type: 'UPDATE_FACTORY_PDA_USER',
      payload: { ...existing, roleId: roleId as PdaRoleId, updatedAt: now(), updatedBy: 'ADMIN' },
    })
  }

  // =============================================
  // FactoryPdaRole 管理 actions
  // =============================================
  const listFactoryPdaRoles = (factoryId: string): FactoryPdaRole[] =>
    state.factoryPdaRoles.filter(r => r.factoryId === factoryId)

  const getRoleById = (roleId: string, factoryId: string): FactoryPdaRole | undefined =>
    state.factoryPdaRoles.find(r => r.roleId === roleId && r.factoryId === factoryId)

  const createFactoryPdaRole = (
    factoryId: string,
    roleName: string,
    permissionKeys: PermissionKey[]
  ): { ok: boolean; role?: FactoryPdaRole; messageKey?: string } => {
    const ts = Date.now()
    const roleId = `ROLE_CUSTOM_${ts}`
    const role: FactoryPdaRole = {
      roleId,
      factoryId,
      roleName,
      status: 'ACTIVE',
      permissionKeys,
      isSystemPreset: false,
      createdAt: now(),
      createdBy: 'ADMIN',
      auditLogs: [{ id: `RL-${ts}`, action: 'CREATE', detail: `创建���定义角色：${roleName}`, at: now(), by: 'ADMIN' }],
    }
    dispatch({ type: 'CREATE_FACTORY_PDA_ROLE', payload: role })
    return { ok: true, role }
  }

  const updateFactoryPdaRole = (
    roleId: string,
    factoryId: string,
    patch: { roleName?: string; permissionKeys?: PermissionKey[]; status?: 'ACTIVE' | 'DISABLED' }
  ): { ok: boolean; messageKey?: string } => {
    const existing = state.factoryPdaRoles.find(r => r.roleId === roleId && r.factoryId === factoryId)
    if (!existing) return { ok: false, messageKey: 'factory.pdaAuth.roles.notFound' }
    const updated: FactoryPdaRole = {
      ...existing,
      ...patch,
      updatedAt: now(),
      updatedBy: 'ADMIN',
      auditLogs: [...existing.auditLogs, { id: `RL-${Date.now()}`, action: 'UPDATE', detail: `更新角色`, at: now(), by: 'ADMIN' }],
    }
    dispatch({ type: 'UPDATE_FACTORY_PDA_ROLE', payload: updated })
    return { ok: true }
  }

  const toggleFactoryPdaRole = (
    roleId: string,
    factoryId: string,
    status: 'ACTIVE' | 'DISABLED'
  ): { ok: boolean; messageKey?: string } => {
    const existing = state.factoryPdaRoles.find(r => r.roleId === roleId && r.factoryId === factoryId)
    if (!existing) return { ok: false, messageKey: 'factory.pdaAuth.roles.notFound' }
    const updated: FactoryPdaRole = {
      ...existing,
      status,
      updatedAt: now(),
      updatedBy: 'ADMIN',
      auditLogs: [
        ...existing.auditLogs,
        {
          id: `RL-${Date.now()}`,
          action: status === 'ACTIVE' ? 'ENABLE' : 'DISABLE',
          detail: `角色${status === 'ACTIVE' ? '启用' : '停用'}`,
          at: now(),
          by: 'ADMIN',
        },
      ],
    }
    dispatch({ type: 'UPDATE_FACTORY_PDA_ROLE', payload: updated })
    return { ok: true }
  }

  // =============================================
  // 返工/重做任务完成
  // =============================================
  const completeReworkTask = (taskId: string, by: string): { ok: boolean; message?: string } => {
    const task = state.processTasks.find(t => t.taskId === taskId)
    if (!task) return { ok: false, message: `任务 ${taskId} 不存在` }
    if (task.taskKind !== 'REWORK' && task.taskKind !== 'REMAKE') {
      return { ok: false, message: '仅允许对返工/重做任务执行此操作' }
    }
    if (task.status === 'DONE') return { ok: true }
    const ts = new Date().toLocaleString('sv').replace('T', ' ')
    const resolvedBy = by || 'UNKNOWN'
    const updated: ProcessTask = {
      ...task,
      status: 'DONE',
      finishedAt: ts,
      updatedAt: ts,
      auditLogs: [
        ...task.auditLogs,
        {
          id: `AL-RWDONE-${Date.now()}`,
          action: 'COMPLETE_REWORK_TASK',
          detail: `${task.taskCategoryZh ?? (task.taskKind === 'REWORK' ? '返工' : '重做')}任务标记完成`,
          at: ts,
          by: resolvedBy,
        },
      ],
    }
    dispatch({ type: 'UPDATE_TASK', payload: updated })
    return { ok: true }
  }

  // =============================================
  // 对账单草稿 actions
  // =============================================

  const generateStatementDraft = (
    input: {
      settlementPartyType: SettlementPartyType
      settlementPartyId: string
      basisIds: string[]
      remark?: string
    },
    by: string,
  ): { ok: boolean; statementId?: string; message?: string } => {
    const { settlementPartyType, settlementPartyId, basisIds, remark } = input
    if (!basisIds.length) return { ok: false, message: '请至少选择一条扣款依据' }
    for (const id of basisIds) {
      const b = state.deductionBasisItems.find(x => x.basisId === id)
      if (!b) return { ok: false, message: `扣款依据 ${id} 不存在` }
      if (!b.settlementReady) return { ok: false, message: `扣款依据 ${id} 未满足可进入结算���件` }
      if (b.status === 'VOID') return { ok: false, message: `扣款依据 ${id} 已作废，不可纳入对账单` }
      if (b.settlementPartyType !== settlementPartyType || b.settlementPartyId !== settlementPartyId) {
        return { ok: false, message: `扣款依据 ${id} 的结算对象与选定对象不一致` }
      }
    }
    const occupiedIds = new Set(
      state.statementDrafts.filter(s => s.status !== 'CLOSED').flatMap(s => s.itemBasisIds),
    )
    if (basisIds.some(id => occupiedIds.has(id))) return { ok: false, message: '存在已纳入未关闭对账单的扣款依据' }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const month = ts.slice(0, 7).replace('-', '')
    const statementId = `ST-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
    const items: StatementDraftItem[] = basisIds.map(id => {
      const b = state.deductionBasisItems.find(x => x.basisId === id)!
      return {
        basisId: id,
        deductionQty: b.deductionQty ?? b.qty ?? 0,
        deductionAmount: (b as any).deductionAmount ?? 0,
        sourceProcessType: b.sourceProcessType,
        sourceType: b.sourceType,
        productionOrderId: b.productionOrderId,
        sourceOrderId: b.sourceOrderId,
      }
    })
    const draft: StatementDraft = {
      statementId,
      settlementPartyType,
      settlementPartyId,
      itemCount: items.length,
      totalQty: items.reduce((s, i) => s + i.deductionQty, 0),
      totalAmount: items.reduce((s, i) => s + i.deductionAmount, 0),
      status: 'DRAFT',
      itemBasisIds: basisIds,
      items,
      remark,
      createdAt: ts,
      createdBy: by,
    }
    dispatch({ type: 'ADD_STATEMENT_DRAFT', payload: draft })
    return { ok: true, statementId }
  }

  const confirmStatementDraft = (statementId: string, by: string): { ok: boolean; message?: string } => {
    const s = state.statementDrafts.find(x => x.statementId === statementId)
    if (!s) return { ok: false, message: `对账单 ${statementId} 不���在` }
    if (s.status === 'CONFIRMED') return { ok: true }
    if (s.status === 'CLOSED') return { ok: false, message: '已关闭的对账单不可确认' }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({ type: 'UPDATE_STATEMENT_DRAFT', payload: { ...s, status: 'CONFIRMED', updatedAt: ts, updatedBy: by } })
    return { ok: true }
  }

  const closeStatementDraft = (statementId: string, by: string): { ok: boolean; message?: string } => {
    const s = state.statementDrafts.find(x => x.statementId === statementId)
    if (!s) return { ok: false, message: `对账单 ${statementId} 不存在` }
    if (s.status === 'CLOSED') return { ok: true }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({ type: 'UPDATE_STATEMENT_DRAFT', payload: { ...s, status: 'CLOSED', updatedAt: ts, updatedBy: by } })
    return { ok: true }
  }

  // =============================================
  // StatementAdjustment actions
  // =============================================

  // 内部重算函数：重算对应 statement.totalAmount
  const recomputeStatementTotals = (statementId: string, adjustments: StatementAdjustment[]) => {
    const s = state.statementDrafts.find(x => x.statementId === statementId)
    if (!s) return
    const baseAmount = s.items.reduce((sum, i) => sum + i.deductionAmount, 0)
    const effectiveAdj = adjustments.filter(a => a.statementId === statementId && a.status === 'EFFECTIVE')
    const delta = effectiveAdj.reduce((sum, a) => {
      if (a.adjustmentType === 'REVERSAL') return sum - a.amount
      return sum + a.amount
    }, 0)
    const newTotal = baseAmount + delta
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({ type: 'UPDATE_STATEMENT_DRAFT', payload: { ...s, totalAmount: newTotal, updatedAt: ts, updatedBy: 'SYSTEM' } })
  }

  const createStatementAdjustment = (
    input: {
      statementId: string
      adjustmentType: AdjustmentType
      amount: number
      remark: string
      relatedBasisId?: string
    },
    by: string,
  ): { ok: boolean; adjustmentId?: string; message?: string } => {
    const { statementId, adjustmentType, amount, remark, relatedBasisId } = input
    const s = state.statementDrafts.find(x => x.statementId === statementId)
    if (!s) return { ok: false, message: `对账单 ${statementId} 不存在` }
    if (s.status === 'CLOSED') return { ok: false, message: '已关闭的对账单��可新增调整项' }
    if (!amount || amount <= 0) return { ok: false, message: '金额必须大于 0' }
    if (!remark.trim()) return { ok: false, message: '说明不能为空' }
    if (relatedBasisId) {
      const b = state.deductionBasisItems.find(x => x.basisId === relatedBasisId)
      if (!b) return { ok: false, message: `扣款依据 ${relatedBasisId} 不存在` }
    }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const month = ts.slice(0, 7).replace('-', '')
    const adjustmentId = `ADJ-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
    const adj: StatementAdjustment = {
      adjustmentId,
      statementId,
      adjustmentType,
      amount,
      remark,
      relatedBasisId,
      status: 'DRAFT',
      createdAt: ts,
      createdBy: by,
    }
    dispatch({ type: 'ADD_STATEMENT_ADJUSTMENT', payload: adj })
    return { ok: true, adjustmentId }
  }

  const effectStatementAdjustment = (adjustmentId: string, by: string): { ok: boolean; message?: string } => {
    const adj = state.statementAdjustments.find(x => x.adjustmentId === adjustmentId)
    if (!adj) return { ok: false, message: `调整项 ${adjustmentId} 不存在` }
    if (adj.status === 'EFFECTIVE') return { ok: true }
    if (adj.status === 'VOID') return { ok: false, message: '已作废的调整项不可生效' }
    const s = state.statementDrafts.find(x => x.statementId === adj.statementId)
    if (s?.status === 'CLOSED') return { ok: false, message: '对应对账单已关闭，不可生效' }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const updated: StatementAdjustment = { ...adj, status: 'EFFECTIVE', updatedAt: ts, updatedBy: by }
    dispatch({ type: 'UPDATE_STATEMENT_ADJUSTMENT', payload: updated })
    // 重算：用更新后的 adjustment 列表
    const newAdjList = state.statementAdjustments.map(a => a.adjustmentId === adjustmentId ? updated : a)
    recomputeStatementTotals(adj.statementId, newAdjList)
    return { ok: true }
  }

  const voidStatementAdjustment = (adjustmentId: string, by: string): { ok: boolean; message?: string } => {
    const adj = state.statementAdjustments.find(x => x.adjustmentId === adjustmentId)
    if (!adj) return { ok: false, message: `调整项 ${adjustmentId} 不存��` }
    if (adj.status === 'VOID') return { ok: true }
    const s = state.statementDrafts.find(x => x.statementId === adj.statementId)
    if (s?.status === 'CLOSED') return { ok: false, message: '对应对账单已关闭，不可作废' }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const wasEffective = adj.status === 'EFFECTIVE'
    const updated: StatementAdjustment = { ...adj, status: 'VOID', updatedAt: ts, updatedBy: by }
    dispatch({ type: 'UPDATE_STATEMENT_ADJUSTMENT', payload: updated })
    if (wasEffective) {
      const newAdjList = state.statementAdjustments.map(a => a.adjustmentId === adjustmentId ? updated : a)
      recomputeStatementTotals(adj.statementId, newAdjList)
    }
    return { ok: true }
  }

  // =============================================
  // SettlementBatch actions
  // =============================================

  const createSettlementBatch = (
    input: { statementIds: string[]; remark?: string; batchName?: string },
    by: string,
  ): { ok: boolean; batchId?: string; message?: string } => {
    const { statementIds, remark, batchName } = input
    if (!statementIds.length) return { ok: false, message: '请至少选择一张对账单' }
    for (const id of statementIds) {
      const s = state.statementDrafts.find(x => x.statementId === id)
      if (!s) return { ok: false, message: `对账单 ${id} 不存在` }
      if (s.status !== 'CONFIRMED') return { ok: false, message: `对账单 ${id} 状态不是已确认，不���纳入结算批次` }
    }
    const occupiedIds = new Set(
      state.settlementBatches
        .filter(b => b.status !== 'COMPLETED')
        .flatMap(b => b.statementIds),
    )
    if (statementIds.some(id => occupiedIds.has(id))) {
      return { ok: false, message: '��在已纳入未完成结算��次的对账单' }
    }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const month = ts.slice(0, 7).replace('-', '')
    const batchId = `SB-${month}-${String(Math.floor(Math.random() * 9000) + 1000)}`
    const items: SettlementBatchItem[] = statementIds.map(id => {
      const s = state.statementDrafts.find(x => x.statementId === id)!
      return { statementId: id, settlementPartyType: s.settlementPartyType, settlementPartyId: s.settlementPartyId, totalAmount: s.totalAmount }
    })
    const batch: SettlementBatch = {
      batchId,
      batchName,
      itemCount: items.length,
      totalAmount: items.reduce((sum, i) => sum + i.totalAmount, 0),
      status: 'PENDING',
      statementIds,
      items,
      remark,
      createdAt: ts,
      createdBy: by,
    }
    dispatch({ type: 'ADD_SETTLEMENT_BATCH', payload: batch })
    return { ok: true, batchId }
  }

  const startSettlementBatch = (batchId: string, by: string): { ok: boolean; message?: string } => {
    const b = state.settlementBatches.find(x => x.batchId === batchId)
    if (!b) return { ok: false, message: `结算批次 ${batchId} 不存在` }
    if (b.status === 'PROCESSING') return { ok: true }
    if (b.status === 'COMPLETED') return { ok: false, message: '已完成的结算批次不可重新开始' }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({ type: 'UPDATE_SETTLEMENT_BATCH', payload: { ...b, status: 'PROCESSING', updatedAt: ts, updatedBy: by } })
    return { ok: true }
  }

  const completeSettlementBatch = (batchId: string, by: string): { ok: boolean; message?: string } => {
    const b = state.settlementBatches.find(x => x.batchId === batchId)
    if (!b) return { ok: false, message: `结算批次 ${batchId} 不存在` }
    if (b.status === 'COMPLETED') return { ok: true }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({ type: 'UPDATE_SETTLEMENT_BATCH', payload: { ...b, status: 'COMPLETED', updatedAt: ts, updatedBy: by } })
    const updatedStatements: StatementDraft[] = b.statementIds.map(id => {
      const s = state.statementDrafts.find(x => x.statementId === id)
      if (!s) return null
      return { ...s, status: 'CLOSED' as StatementStatus, updatedAt: ts, updatedBy: by }
    }).filter(Boolean) as StatementDraft[]
    if (updatedStatements.length) {
      dispatch({ type: 'BATCH_UPDATE_STATEMENT_DRAFTS', payload: updatedStatements })
    }
    return { ok: true }
  }

  // =============================================
  // 打款结果同步更新 action
  // =============================================

  const syncSettlementPaymentResult = (
    input: {
      batchId: string
      paymentSyncStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL'
      paymentAmount?: number
      paymentAt?: string
      paymentReferenceNo?: string
      paymentRemark?: string
    },
    by: string,
  ): { ok: boolean; message?: string } => {
    const { batchId, paymentSyncStatus, paymentAmount, paymentAt, paymentReferenceNo, paymentRemark } = input
    const b = state.settlementBatches.find(x => x.batchId === batchId)
    if (!b) return { ok: false, message: `结算批次 ${batchId} 不存在` }
    if (b.status !== 'COMPLETED') return { ok: false, message: '仅已完成结算批次允许同步更新打款结果' }
    if (!['SUCCESS', 'FAILED', 'PARTIAL'].includes(paymentSyncStatus)) {
      return { ok: false, message: '同步更新状态无效' }
    }
    if (paymentAmount !== undefined && paymentAmount < 0) {
      return { ok: false, message: '打款金额不能为负数' }
    }
    if (paymentSyncStatus === 'PARTIAL' && (!paymentAmount || paymentAmount <= 0)) {
      return { ok: false, message: '部分打款必须填写打款金额且大于 0' }
    }
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    dispatch({
      type: 'UPDATE_SETTLEMENT_BATCH',
      payload: {
        ...b,
        paymentSyncStatus,
        paymentAmount,
        paymentAt,
        paymentReferenceNo,
        paymentRemark,
        paymentUpdatedAt: ts,
        paymentUpdatedBy: by,
        updatedAt: ts,
        updatedBy: by,
      },
    })
    return { ok: true }
  }

  return (
    <FcsContext.Provider value={{
      state,
      dispatch,
      getTasksByOrderId,
      getOrderById,
      getFactoryById,
      getTenderById,
      getTenderByTaskId,
      batchDispatch,
      batchCreateTender,
      awardTender,
      addTasks,
      updateOrder,
      updateTaskStatus,
      getExceptionById,
      getExceptionsByTaskId,
      getExceptionsByOrderId,
      getExceptionsByTenderId,
      addException,
      updateException,
      createOrUpdateExceptionFromSignal,
      extendTenderDeadline,
      getHandoverEventById,
      getHandoverEventsByOrderId,
      getHandoverEventsByTaskId,
      createHandoverEvent,
      confirmHandoverEvent,
      markHandoverDisputed,
      voidHandoverEvent,
      createNotification,
      markNotificationRead,
      markAllNotificationsRead,
      recomputeAutoNotifications,
      createUrge,
      ackUrge,
      acceptTask,
      rejectTask,
      startTask,
      finishTask,
      blockTask,
      unblockTask,
      confirmHandover,
      disputeHandover,
      getQcById,
      getQcsByTaskId,
      getSubmittedQcListByTaskId,
      getLatestSubmittedQcByTaskId,
      hasSubmittedQc,
      createQc,
      updateQc,
      submitQc,
      updateQcDispositionBreakdown,
      confirmQcLiability,
      disputeQcLiability,
      closeQcCase,
      applyQcAllocationWriteback,
      arbitrateDispute,
      createReturnBatch,
      markReturnBatchPass,
      startReturnBatchFailQc,
      createDyePrintOrder,
      startDyePrintOrder,
      closeDyePrintOrder,
      addDyePrintReturn,
      createReturnBatchForDyePrintOrder,
      updateTaskDependencies,
      getCurrentFactoryUser,
      resolvePermissions,
      can,
      listFactoryPdaUsers,
      createFactoryPdaUser,
      updateFactoryPdaUser,
      toggleFactoryPdaUserLock,
      setFactoryPdaUserRole,
      listFactoryPdaRoles,
      getRoleById,
      createFactoryPdaRole,
      updateFactoryPdaRole,
      toggleFactoryPdaRole,
      computeEffectivePermissionsForUser,
      completeReworkTask,
      generateStatementDraft,
      confirmStatementDraft,
      closeStatementDraft,
      createStatementAdjustment,
      effectStatementAdjustment,
      voidStatementAdjustment,
      createSettlementBatch,
      startSettlementBatch,
      completeSettlementBatch,
      syncSettlementPaymentResult,
      updateProductionPlan,
      releaseProductionPlan,
      updateProductionOrderStatus,
      createProductionOrderChange,
      updateProductionOrderChangeStatus,
      updateProductionDeliveryWarehouse,
      createTenderOrder,
      updateTenderOrderStatus,
      awardTenderOrder,
      voidTenderAward,
      createDispatchException,
      updateDispatchExceptionStatus,
      createMaterialIssueSheet,
      updateMaterialIssueSheet,
      updateMaterialIssueStatus,
      createQcStandardSheet,
      updateQcStandardSheet,
      updateQcStandardStatus,
      generateMaterialStatementDraft,
      confirmMaterialStatementDraft,
      closeMaterialStatementDraft,
      setTaskAssignMode: (taskId: string, mode: 'DIRECT' | 'BIDDING' | 'HOLD', by: string) =>
        dispatch({ type: 'SET_TASK_ASSIGN_MODE', payload: { taskIds: [taskId], mode, by } }),
      batchSetTaskAssignMode: (taskIds: string[], mode: 'DIRECT' | 'BIDDING' | 'HOLD', by: string) =>
        dispatch({ type: 'SET_TASK_ASSIGN_MODE', payload: { taskIds, mode, by } }),
    }}>
      {children}
    </FcsContext.Provider>
  )
}

// =============================================
// Hook
// =============================================
export function useFcs() {
  const context = useContext(FcsContext)
  if (!context) {
    throw new Error('useFcs must be used within FcsProvider')
  }
  return context
}

// 生成唯一一ID
export function generateTenderId() {
  return `TENDER-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}
