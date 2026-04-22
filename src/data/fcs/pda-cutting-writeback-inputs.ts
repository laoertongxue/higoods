import { getBrowserLocalStorage, type BrowserStorageLike } from '../browser-storage.ts'
import { indonesiaFactories } from './indonesia-factories.ts'
import { getTaskChainTaskById } from './page-adapters/task-chain-pages-adapter.ts'
import {
  getPdaCuttingTaskSnapshot,
  type PdaCuttingTaskDetailData,
  type PdaCuttingTaskOrderLine,
} from './pda-cutting-execution-source.ts'
import {
  findFactoryPdaRoleById,
  getCurrentPdaUser,
  getPdaSession,
  initialFactoryUsers,
  pdaRoleTemplates,
  defaultFactoryRoles,
  listFactoryPdaUsers,
} from './store-domain-pda.ts'

export type CuttingPdaActionType =
  | 'PICKUP_CONFIRM'
  | 'PICKUP_DISPUTE'
  | 'SPREADING_RECORD'
  | 'INBOUND_CONFIRM'
  | 'HANDOVER_CONFIRM'
  | 'REPLENISHMENT_FEEDBACK'

export interface CuttingPdaWritebackIdentityInput {
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  executionOrderId: string
  executionOrderNo: string
  legacyCutPieceOrderNo: string
  cutPieceOrderNo: string
  materialSku: string
  styleCode?: string
  spuCode?: string
}

export interface CuttingPdaWritebackOperatorInput {
  operatorAccountId: string
  operatorName: string
  operatorRole: string
  operatorFactoryId: string
  operatorFactoryName: string
}

export interface CuttingPdaWritebackSourceInput {
  sourceChannel: 'PDA'
  sourceDeviceId: string
  sourceRecordId: string
  sourcePageKey: string
}

export interface PdaCuttingWritebackSelection {
  executionOrderId?: string
  executionOrderNo?: string
  originalCutOrderId?: string
  originalCutOrderNo?: string
  mergeBatchId?: string
  mergeBatchNo?: string
  materialSku?: string
  legacyCutPieceOrderNo?: string
  cutPieceOrderNo?: string
}

export interface PdaCuttingResolvedExecutionContext {
  detail: PdaCuttingTaskDetailData
  line: PdaCuttingTaskOrderLine
}

function nowText(date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function compactTimestamp(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, 14)
}

function normalizeNameKey(name: string): string {
  return Array.from(name.trim())
    .map((char) => char.charCodeAt(0).toString(16))
    .join('')
    .slice(0, 16)
}

function buildSyntheticOperatorAccountId(factoryId: string, operatorName: string): string {
  return `PDA-${factoryId || 'UNKNOWN'}-${normalizeNameKey(operatorName || '现场操作员') || 'anonymous'}`
}

function resolveFactoryName(factoryId: string): string {
  if (!factoryId) return '待补工厂'
  return indonesiaFactories.find((item) => item.id === factoryId)?.name || factoryId
}

function resolveRoleNameByRoleId(roleId: string | undefined): string {
  if (!roleId) return '现场操作员'
  return pdaRoleTemplates.find((item) => item.roleId === roleId)?.roleName
    || findFactoryPdaRoleById(roleId)?.roleName
    || defaultFactoryRoles.find((item) => item.roleId === roleId)?.roleName
    || roleId
}

function resolveRoleNameByRoleIds(roleIds: string[] | undefined): string {
  if (!roleIds?.length) return '现场操作员'
  return resolveRoleNameByRoleId(roleIds[0])
}

function resolveFactoryContext(taskId: string): { factoryId: string; factoryName: string } {
  const session = getPdaSession()
  const task = getTaskChainTaskById(taskId)
  const factoryId = session?.factoryId || task?.assignedFactoryId || ''
  return {
    factoryId,
    factoryName: session?.factoryName || task?.assignedFactoryName || resolveFactoryName(factoryId) || '待补工厂',
  }
}

function resolveOperatorFromSession(taskId: string, operatorName?: string): CuttingPdaWritebackOperatorInput {
  const session = getPdaSession()
  const currentPdaUser = getCurrentPdaUser()
  const normalizedName = operatorName?.trim() || ''
  const { factoryId, factoryName } = resolveFactoryContext(taskId)

  if (session && currentPdaUser) {
    return {
      operatorAccountId: currentPdaUser.userId,
      operatorName: normalizedName || currentPdaUser.name,
      operatorRole: resolveRoleNameByRoleId(currentPdaUser.roleId),
      operatorFactoryId: currentPdaUser.factoryId,
      operatorFactoryName: factoryName,
    }
  }

  const matchedPdaUser = normalizedName
    ? listFactoryPdaUsers(factoryId).find((item) => item.name === normalizedName)
    : null
  if (matchedPdaUser) {
    return {
      operatorAccountId: matchedPdaUser.userId,
      operatorName: matchedPdaUser.name,
      operatorRole: resolveRoleNameByRoleId(matchedPdaUser.roleId),
      operatorFactoryId: matchedPdaUser.factoryId,
      operatorFactoryName: factoryName,
    }
  }

  const matchedFactoryUser = normalizedName
    ? initialFactoryUsers.find((item) => item.factoryId === factoryId && item.name === normalizedName)
    : null
  if (matchedFactoryUser) {
    return {
      operatorAccountId: matchedFactoryUser.userId,
      operatorName: matchedFactoryUser.name,
      operatorRole: resolveRoleNameByRoleIds(matchedFactoryUser.roleIds),
      operatorFactoryId: matchedFactoryUser.factoryId,
      operatorFactoryName: factoryName,
    }
  }

  const fallbackName = normalizedName || '现场操作员'
  return {
    operatorAccountId: buildSyntheticOperatorAccountId(factoryId, fallbackName),
    operatorName: fallbackName,
    operatorRole: '现场操作员',
    operatorFactoryId: factoryId,
    operatorFactoryName: factoryName,
  }
}

function matchExecutionLine(
  detail: PdaCuttingTaskDetailData,
  selection: PdaCuttingWritebackSelection = {},
): PdaCuttingTaskOrderLine | null {
  if (selection.executionOrderId) {
    return detail.cutPieceOrders.find((item) => item.executionOrderId === selection.executionOrderId) ?? null
  }
  if (selection.executionOrderNo) {
    return detail.cutPieceOrders.find((item) => item.executionOrderNo === selection.executionOrderNo) ?? null
  }
  if (selection.originalCutOrderId) {
    return detail.cutPieceOrders.find((item) => item.originalCutOrderId === selection.originalCutOrderId) ?? null
  }
  if (selection.originalCutOrderNo) {
    return detail.cutPieceOrders.find((item) => item.originalCutOrderNo === selection.originalCutOrderNo) ?? null
  }
  if (selection.legacyCutPieceOrderNo || selection.cutPieceOrderNo) {
    const executionKey = selection.legacyCutPieceOrderNo || selection.cutPieceOrderNo || ''
    return detail.cutPieceOrders.find((item) =>
      item.executionOrderNo === executionKey || item.legacyCutPieceOrderNo === executionKey,
    ) ?? null
  }
  if (detail.currentSelectedExecutionOrderId) {
    return detail.cutPieceOrders.find((item) => item.executionOrderId === detail.currentSelectedExecutionOrderId) ?? null
  }
  return detail.cutPieceOrders[0] ?? null
}

export function resolvePdaCuttingExecutionContext(
  taskId: string,
  selection: PdaCuttingWritebackSelection = {},
): PdaCuttingResolvedExecutionContext | null {
  const executionKey =
    selection.executionOrderId
    || selection.executionOrderNo
    || selection.originalCutOrderId
    || selection.originalCutOrderNo
    || selection.legacyCutPieceOrderNo
    || selection.cutPieceOrderNo
    || ''
  const detail = getPdaCuttingTaskSnapshot(taskId, executionKey || undefined)
  if (!detail) return null
  const line = matchExecutionLine(detail, selection)
  if (!line) return null
  return { detail, line }
}

export function resolvePdaCuttingWritebackIdentity(
  taskId: string,
  selection: PdaCuttingWritebackSelection = {},
): CuttingPdaWritebackIdentityInput | null {
  const context = resolvePdaCuttingExecutionContext(taskId, selection)
  if (!context) return null
  const { detail, line } = context
  return {
    taskId,
    taskNo: detail.taskNo,
    productionOrderId: line.productionOrderId,
    productionOrderNo: line.productionOrderNo,
    originalCutOrderId: line.originalCutOrderId,
    originalCutOrderNo: line.originalCutOrderNo,
    mergeBatchId: line.mergeBatchId || '',
    mergeBatchNo: line.mergeBatchNo || '',
    executionOrderId: line.executionOrderId,
    executionOrderNo: line.executionOrderNo,
    legacyCutPieceOrderNo: line.legacyCutPieceOrderNo || line.executionOrderNo,
    cutPieceOrderNo: line.executionOrderNo,
    materialSku: line.materialSku,
  }
}

export function resolvePdaCuttingWritebackOperator(
  taskId: string,
  operatorName?: string,
): CuttingPdaWritebackOperatorInput {
  return resolveOperatorFromSession(taskId, operatorName)
}

export function buildPdaCuttingWritebackSource(
  sourcePageKey: string,
  sourceRecordId = '',
): CuttingPdaWritebackSourceInput {
  return {
    sourceChannel: 'PDA',
    sourceDeviceId: 'PDA-CUTTING-HANDSET',
    sourceRecordId,
    sourcePageKey,
  }
}

export function buildPdaCuttingWritebackId(
  actionType: CuttingPdaActionType,
  identity: Pick<CuttingPdaWritebackIdentityInput, 'taskId' | 'executionOrderId' | 'originalCutOrderId'>,
  actionAt = nowText(),
): string {
  const compact = compactTimestamp(actionAt)
  const base = `${actionType}:${identity.taskId}:${identity.executionOrderId}:${identity.originalCutOrderId}`
  const hash = normalizeNameKey(base).slice(0, 8) || '00000000'
  return `pda-${actionType.toLowerCase()}-${identity.taskId}-${identity.executionOrderId}-${compact}-${hash}`
}

export function buildDefaultPdaRollNo(
  identity: Pick<CuttingPdaWritebackIdentityInput, 'executionOrderNo' | 'materialSku'>,
  actionAt = nowText(),
): string {
  const compact = compactTimestamp(actionAt).slice(-8)
  return `ROLL-${identity.executionOrderNo}-${compact}-${(identity.materialSku || 'MAT').slice(0, 6)}`
}

export function getPdaCuttingWritebackStorage(): BrowserStorageLike | null {
  return getBrowserLocalStorage()
}
