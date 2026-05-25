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

export interface CuttingPdaRuntimeIdentityInput {
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  markerPlanId: string
  markerPlanNo: string
  executionOrderId: string
  executionOrderNo: string
  cutPieceOrderNo: string
  materialSku: string
  styleCode?: string
  spuCode?: string
}

export interface CuttingPdaRuntimeOperatorInput {
  operatorAccountId: string
  operatorName: string
  operatorRole: string
  operatorFactoryId: string
  operatorFactoryName: string
}

export interface CuttingPdaRuntimeSourceInput {
  sourceChannel: 'PDA'
  sourceDeviceId: string
  sourceRecordId: string
  sourcePageKey: string
}

export interface PdaCuttingRuntimeSelection {
  executionOrderId?: string
  executionOrderNo?: string
  cutOrderId?: string
  cutOrderNo?: string
  markerPlanId?: string
  markerPlanNo?: string
  materialSku?: string
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

function resolveOperatorFromSession(taskId: string, operatorName?: string): CuttingPdaRuntimeOperatorInput {
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
  selection: PdaCuttingRuntimeSelection = {},
): PdaCuttingTaskOrderLine | null {
  if (selection.executionOrderId) {
    return detail.cutPieceOrders.find((item) => item.executionOrderId === selection.executionOrderId) ?? null
  }
  if (selection.executionOrderNo) {
    return detail.cutPieceOrders.find((item) => item.executionOrderNo === selection.executionOrderNo) ?? null
  }
  if (selection.cutOrderId) {
    return detail.cutPieceOrders.find((item) => item.cutOrderId === selection.cutOrderId) ?? null
  }
  if (selection.cutOrderNo) {
    return detail.cutPieceOrders.find((item) => item.cutOrderNo === selection.cutOrderNo) ?? null
  }
  if (selection.cutPieceOrderNo) {
    const executionKey = selection.cutPieceOrderNo || ''
    return detail.cutPieceOrders.find((item) =>
      item.executionOrderNo === executionKey,
    ) ?? null
  }
  if (detail.currentSelectedExecutionOrderId) {
    return detail.cutPieceOrders.find((item) => item.executionOrderId === detail.currentSelectedExecutionOrderId) ?? null
  }
  return detail.cutPieceOrders[0] ?? null
}

export function resolvePdaCuttingExecutionContext(
  taskId: string,
  selection: PdaCuttingRuntimeSelection = {},
): PdaCuttingResolvedExecutionContext | null {
  const executionKey =
    selection.executionOrderId
    || selection.executionOrderNo
    || selection.cutOrderId
    || selection.cutOrderNo
    || selection.cutPieceOrderNo
    || ''
  const detail = getPdaCuttingTaskSnapshot(taskId, executionKey || undefined)
  if (!detail) return null
  const line = matchExecutionLine(detail, selection)
  if (!line) return null
  return { detail, line }
}

export function resolvePdaCuttingRuntimeIdentity(
  taskId: string,
  selection: PdaCuttingRuntimeSelection = {},
): CuttingPdaRuntimeIdentityInput | null {
  const context = resolvePdaCuttingExecutionContext(taskId, selection)
  if (!context) return null
  const { detail, line } = context
  return {
    taskId,
    taskNo: detail.taskNo,
    productionOrderId: line.productionOrderId,
    productionOrderNo: line.productionOrderNo,
    cutOrderId: line.cutOrderId,
    cutOrderNo: line.cutOrderNo,
    markerPlanId: line.markerPlanId || '',
    markerPlanNo: line.markerPlanNo || '',
    executionOrderId: line.executionOrderId,
    executionOrderNo: line.executionOrderNo,
    cutPieceOrderNo: line.executionOrderNo,
    materialSku: line.materialSku,
  }
}

export function resolvePdaCuttingRuntimeOperator(
  taskId: string,
  operatorName?: string,
): CuttingPdaRuntimeOperatorInput {
  return resolveOperatorFromSession(taskId, operatorName)
}

export function buildPdaCuttingRuntimeSource(
  sourcePageKey: string,
  sourceRecordId = '',
): CuttingPdaRuntimeSourceInput {
  return {
    sourceChannel: 'PDA',
    sourceDeviceId: 'PDA-CUTTING-HANDSET',
    sourceRecordId,
    sourcePageKey,
  }
}

export function buildPdaCuttingRuntimeEventId(
  actionType: CuttingPdaActionType,
  identity: Pick<CuttingPdaRuntimeIdentityInput, 'taskId' | 'executionOrderId' | 'cutOrderId'>,
  actionAt = nowText(),
): string {
  const compact = compactTimestamp(actionAt)
  const base = `${actionType}:${identity.taskId}:${identity.executionOrderId}:${identity.cutOrderId}`
  const hash = normalizeNameKey(base).slice(0, 8) || '00000000'
  return `pda-${actionType.toLowerCase()}-${identity.taskId}-${identity.executionOrderId}-${compact}-${hash}`
}

export function buildDefaultPdaRollNo(
  identity: Pick<CuttingPdaRuntimeIdentityInput, 'executionOrderNo' | 'materialSku'>,
  actionAt = nowText(),
): string {
  const compact = compactTimestamp(actionAt).slice(-8)
  return `ROLL-${identity.executionOrderNo}-${compact}-${(identity.materialSku || 'MAT').slice(0, 6)}`
}

export function getPdaCuttingRuntimeStorage(): BrowserStorageLike | null {
  return getBrowserLocalStorage()
}
