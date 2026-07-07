import { escapeHtml } from '../utils'
import {
  listWorkerVisiblePdaSpreadingTargets,
  type PdaCuttingSpreadingTarget,
  type PdaCuttingTaskDetailData,
} from '../data/fcs/pda-cutting-execution-source.ts'
import { buildPdaCuttingSpreadingProjection } from './pda-cutting-spreading-projection'
import {
  resolvePdaCuttingRuntimeIdentity,
  resolvePdaCuttingRuntimeOperator,
  type CuttingPdaRuntimeOperatorInput,
} from '../data/fcs/pda-cutting-runtime-action-inputs.ts'
import {
  appendCuttingRuntimeEvent,
} from '../data/fcs/cutting/cutting-runtime-event-ledger.ts'
import {
  findFactoryPdaRoleById,
  getCurrentPdaUser,
  defaultFactoryRoles,
  getPdaSession,
  initialFactoryUsers,
  listFactoryPdaUsers,
  pdaRoleTemplates,
} from '../data/fcs/store-domain-pda.ts'
import { ensurePdaSessionForAction, getPdaRuntimeContext, renderPdaLoginRedirect } from './pda-runtime'
import {
  buildPdaCuttingExecutionStateKey,
  normalizePdaCuttingHandoverResultLabel,
  renderPdaCuttingEmptyState,
  renderPdaCuttingFeedbackNotice,
  renderPdaCuttingOrderSelectionPrompt,
  renderPdaCuttingPageLayout,
} from './pda-cutting-shared'
import {
  buildPdaCuttingExecutionContext,
  readSelectedExecutionOrderIdFromLocation,
  readSelectedExecutionOrderNoFromLocation,
} from './pda-cutting-context'
import { renderMaterialIdentityBlock } from './process-factory/cutting/material-identity'
import { buildPdaCuttingCompletedReturnHref } from './pda-cutting-nav-context'
import {
  cuttingTableResources,
  findCuttingTableById,
} from './process-factory/cutting/cutting-table-resource'
import {
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  createOperatorRecordDraft,
  createRollRecordDraft,
  formatRollOperatorLayerRows,
  serializeMarkerSpreadingStorage,
  normalizeRollOperatorLayerRows,
  upsertSpreadingSession,
  type MarkerModeKey,
  type SpreadingCuttingStatusKey,
  type SpreadingSession,
  type SpreadingStatusKey,
  type SpreadingRollOperatorLayerRow,
} from './process-factory/cutting/marker-spreading-model'
import { readMarkerSpreadingPrototypeData } from './process-factory/cutting/marker-spreading-utils'

type SpreadingRecordType = '开始铺布' | '中途交接' | '接手继续' | '完成铺布'
type FeedbackTone = 'default' | 'success' | 'warning'
type PdaCuttingSyncStatus = '已同步' | '待同步' | '同步失败'

interface SpreadingReuseSnapshot {
  layerCount: string
  headLength: string
  tailLength: string
}

interface PdaSpreadingOperatorLayerRow {
  rowId: string
  startLayer: string
  endLayer: string
  operatorName: string
}

interface SpreadingFormState {
  selectedTargetKey: string
  selectedPlanUnitId: string
  recordType: SpreadingRecordType
  cuttingTableId: string
  ownerAccountId: string
  ownerName: string
  layerCount: string
  actualLength: string
  headLength: string
  tailLength: string
  handoverToAccountId: string
  handoverNote: string
  note: string
  actualCutQty: string
  actualUsage: string
  cuttingOperator: string
  feedbackMessage: string
  feedbackTone: FeedbackTone
  syncStatus: PdaCuttingSyncStatus | ''
  backHrefOverride: string
  lastSubmittedSnapshot: SpreadingReuseSnapshot | null
  operatorLayerRows: PdaSpreadingOperatorLayerRow[]
}

const spreadingState = new Map<string, SpreadingFormState>()
let pdaOperatorLayerRowSequence = 0

function getSpreadingDetail(taskId: string, executionKey?: string | null) {
  return buildPdaCuttingSpreadingProjection(taskId, executionKey ?? undefined)
}

function getVisibleTargets(detail: PdaCuttingTaskDetailData): PdaCuttingSpreadingTarget[] {
  return listWorkerVisiblePdaSpreadingTargets(detail)
}

function getSelectedTarget(detail: PdaCuttingTaskDetailData, selectedTargetKey: string): PdaCuttingSpreadingTarget | null {
  const visibleTargets = getVisibleTargets(detail)
  if (!visibleTargets.length) return null
  return visibleTargets.find((item) => item.targetKey === selectedTargetKey) || visibleTargets[0] || null
}

function getSelectedExecutionLine(detail: PdaCuttingTaskDetailData) {
  return detail.cutPieceOrders.find((line) => line.executionOrderId === detail.currentSelectedExecutionOrderId) || detail.cutPieceOrders[0] || null
}

function getPrimaryActionLabel(detail: PdaCuttingTaskDetailData): string {
  return getSelectedExecutionLine(detail)?.nextActionLabel || detail.nextRecommendedAction || '查看提交结果'
}

function isSpreadingAction(actionLabel: string): boolean {
  return actionLabel === '开始铺布' || actionLabel === '完成铺布'
}

function isCuttingAction(actionLabel: string): boolean {
  return actionLabel === '开始裁剪' || actionLabel === '完成裁剪'
}

function getPlannedLayerCount(target: PdaCuttingSpreadingTarget | null): number {
  return Math.max(...(target?.planUnits || []).map((unit) => Number(unit.plannedRepeatCount || 0)), 0)
}

function getPlannedCutQty(target: PdaCuttingSpreadingTarget | null): number {
  return (target?.planUnits || []).reduce((sum, unit) => sum + Math.max(Number(unit.plannedCutGarmentQty || 0), 0), 0)
}

function getDefaultTargetKey(detail: PdaCuttingTaskDetailData): string {
  return getVisibleTargets(detail)[0]?.targetKey || ''
}

function getDefaultPlanUnitId(target: PdaCuttingSpreadingTarget | null): string {
  return target?.planUnits?.[0]?.planUnitId || ''
}

function mapPdaSpreadingModeToMarkerMode(mode: PdaCuttingSpreadingTarget['spreadingMode']): MarkerModeKey {
  if (mode === 'HIGH_LOW') return 'high_low'
  if (mode === 'FOLD_HIGH_LOW') return 'fold_high_low'
  if (mode === 'FOLD_NORMAL') return 'fold_normal'
  return 'normal'
}

function findStoredSpreadingSessionForTarget(target: PdaCuttingSpreadingTarget | null): SpreadingSession | null {
  if (!target) return null
  const sessions = readMarkerSpreadingPrototypeData().store.sessions
  return sessions.find((session) =>
    Boolean(target.spreadingSessionId) && session.spreadingSessionId === target.spreadingSessionId,
  )
    || sessions.find((session) => Boolean(target.title) && session.sessionNo === target.title)
    || sessions.find((session) => Boolean(target.markerId) && (session.markerId === target.markerId || session.sourceMarkerId === target.markerId))
    || sessions.find((session) => Boolean(target.markerNo) && (session.markerNo === target.markerNo || session.sourceMarkerNo === target.markerNo))
    || null
}

function buildOwnerOptions(
  operator: CuttingPdaRuntimeOperatorInput,
): Array<{ accountId: string; name: string }> {
  const base = [{ accountId: operator.operatorAccountId || 'current-operator', name: operator.operatorName || '当前登录人' }]
  const pdaUsers = listFactoryPdaUsers(operator.operatorFactoryId)
    .map((item) => ({ accountId: item.userId, name: item.name }))
  const factoryUsers = initialFactoryUsers
    .filter((item) => item.factoryId === operator.operatorFactoryId)
    .map((item) => ({ accountId: item.userId, name: item.name }))
  return Array.from(new Map([...base, ...pdaUsers, ...factoryUsers].map((item) => [item.accountId, item])).values())
}

function resolveOwnerName(accountId: string, operator: CuttingPdaRuntimeOperatorInput): string {
  return buildOwnerOptions(operator).find((item) => item.accountId === accountId)?.name || operator.operatorName || '当前登录人'
}

function getState(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): SpreadingFormState {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo)
  const existing = spreadingState.get(stateKey)
  if (existing) return existing
  const detail = getSpreadingDetail(taskId, executionOrderId ?? executionOrderNo ?? undefined)
  const initialTarget = detail ? getSelectedTarget(detail, getDefaultTargetKey(detail)) : null
  const initialSession = findStoredSpreadingSessionForTarget(initialTarget)
  const initialOperator = detail ? resolveCurrentOperator(taskId, detail) : resolvePdaCuttingRuntimeOperator(taskId, '现场铺布员')
  const initial: SpreadingFormState = {
    selectedTargetKey: detail ? getDefaultTargetKey(detail) : '',
    selectedPlanUnitId: getDefaultPlanUnitId(initialTarget),
    recordType: '开始铺布',
    cuttingTableId: initialSession?.cuttingTableId || '',
    ownerAccountId: initialSession?.ownerAccountId || initialOperator.operatorAccountId || 'current-operator',
    ownerName: initialSession?.ownerName || initialOperator.operatorName || '当前登录人',
    layerCount: '',
    actualLength: '',
    headLength: '',
    tailLength: '',
    handoverToAccountId: '',
    handoverNote: '',
    note: '',
    actualCutQty: '',
    actualUsage: '',
    cuttingOperator: '',
    feedbackMessage: '',
    feedbackTone: 'default',
    syncStatus: '',
    backHrefOverride: '',
    lastSubmittedSnapshot: null,
    operatorLayerRows: [],
  }
  spreadingState.set(stateKey, initial)
  return initial
}

function getSpreadingModeLabel(mode: 'NORMAL' | 'HIGH_LOW' | 'FOLD_NORMAL' | 'FOLD_HIGH_LOW'): string {
  if (mode === 'HIGH_LOW') return '高低层唛架'
  if (mode === 'FOLD_HIGH_LOW') return '对折高低层唛架'
  if (mode === 'FOLD_NORMAL') return '对折普通唛架'
  return '普通唛架'
}

function isHandoverRecord(recordType: SpreadingRecordType): boolean {
  return recordType === '中途交接' || recordType === '接手继续'
}

function getGrossOccupiedLength(form: SpreadingFormState): number {
  const actual = Number(form.actualLength || '0')
  const layerCount = Math.max(Number(form.layerCount || '0'), 0)
  const head = Number(form.headLength || '0')
  const tail = Number(form.tailLength || '0')
  return Number(((actual * layerCount) + head + tail).toFixed(2))
}

function getUsableLength(form: SpreadingFormState): number {
  const actual = Number(form.actualLength || '0')
  const layerCount = Math.max(Number(form.layerCount || '0'), 0)
  const head = Number(form.headLength || '0')
  const tail = Number(form.tailLength || '0')
  return Number(Math.max((actual * layerCount) + head + tail, 0).toFixed(2))
}

function getSelectedPlanUnit(target: PdaCuttingSpreadingTarget | null, planUnitId: string) {
  if (!target?.planUnits?.length) return null
  return target.planUnits.find((item) => item.planUnitId === planUnitId) || target.planUnits[0] || null
}

function isSpreadingRecordForTarget(
  record: PdaCuttingTaskDetailData['spreadingRecords'][number],
  target: PdaCuttingSpreadingTarget | null,
): boolean {
  if (!target) return true
  return (
    !target.spreadingSessionId
    || record.spreadingSessionId === target.spreadingSessionId
    || record.spreadingSessionId === target.title
  )
}

function resolveNextRollNo(rollNos: string[]): string {
  const normalizedRollNos = Array.from(new Set(rollNos.map((item) => String(item || '').trim()).filter(Boolean)))
  const numericRollNos = normalizedRollNos
    .filter((rollNo) => /^\d+$/.test(rollNo))
    .map((rollNo) => Number(rollNo))
    .filter((value) => Number.isFinite(value) && value > 0)
  return String((numericRollNos.length ? Math.max(...numericRollNos) : normalizedRollNos.length) + 1)
}

function resolveNextFabricRollNo(detail: PdaCuttingTaskDetailData, target: PdaCuttingSpreadingTarget | null): string {
  const webSession = findStoredSpreadingSessionForTarget(target)
  const webRollNos = (webSession?.rolls || []).map((roll) => roll.rollNo)
  const detailRollNos = detail.spreadingRecords
    .filter((record) => isSpreadingRecordForTarget(record, target))
    .map((record) => record.fabricRollNo)
  return resolveNextRollNo([...webRollNos, ...detailRollNos])
}

function getActualCutGarmentQty(form: SpreadingFormState, selectedPlanUnit: ReturnType<typeof getSelectedPlanUnit>): number {
  const layerCount = Number(form.layerCount || '0')
  const garmentQtyPerUnit = Number(selectedPlanUnit?.garmentQtyPerUnit || 0)
  return Number((layerCount * garmentQtyPerUnit).toFixed(0))
}

function formatLength(value: number): string {
  return `${Number(value || 0).toFixed(2)} 米`
}

function formatMaterialQty(value: number, unit = '米'): string {
  return `${Number(value || 0).toFixed(2)} ${unit || '米'}`
}

function renderMaterialReadinessBadge(target: PdaCuttingSpreadingTarget): string {
  const readiness = target.materialReadiness
  return `<span class="inline-flex rounded-xl border px-2 py-0.5 text-[11px] font-medium ${readiness.statusClassName}">${escapeHtml(readiness.statusLabel)}</span>`
}

function buildCuttingActualOutputLines(
  target: PdaCuttingSpreadingTarget,
  actualCutQty: number,
  occurredAt: string,
): Array<{
  outputId: string
  color: string
  size: string
  partCode: string
  partName: string
  actualPieceQty: number
  actualGarmentQty: number
  unit: '片'
}> {
  const planUnits = target.planUnits
    .map((unit) => ({
      ...unit,
      sizeRows: unit.sizeRows.filter((sizeRow) => Boolean(sizeRow.size || sizeRow.skuCode)),
      partRows: unit.partRows.filter((partRow) => Boolean(partRow.partCode || partRow.partName)),
    }))
    .filter((unit) => unit.sizeRows.length > 0 && unit.partRows.length > 0)

  const allocateByWeight = <T extends { weight: number }>(totalQty: number, rows: T[]): Array<T & { allocatedQty: number }> => {
    if (!rows.length) return []
    const totalWeight = rows.reduce((sum, row) => sum + Math.max(Number(row.weight || 0), 0), 0)
    let allocated = 0
    return rows.map((row, index) => {
      const isLast = index === rows.length - 1
      const ratio = totalWeight > 0 ? Math.max(Number(row.weight || 0), 0) / totalWeight : 1 / rows.length
      const allocatedQty = isLast ? Math.max(totalQty - allocated, 0) : Math.max(Math.round(totalQty * ratio), 0)
      allocated += allocatedQty
      return { ...row, allocatedQty }
    })
  }

  const totalPlanned = planUnits.reduce((sum, unit) => sum + Math.max(Number(unit.plannedCutGarmentQty || 0), 0), 0)
  const timestampKey = occurredAt.replace(/[^0-9]/g, '')
  return allocateByWeight(
    actualCutQty,
    planUnits.map((unit) => ({
      unit,
      weight: totalPlanned > 0 ? Math.max(Number(unit.plannedCutGarmentQty || 0), 0) : 1,
    })),
  ).flatMap(({ unit, allocatedQty: unitGarmentQty }) => {
    return allocateByWeight(
      unitGarmentQty,
      unit.sizeRows.map((sizeRow) => ({
        sizeRow,
        weight: Math.max(Number(sizeRow.plannedQty || 0), 0),
      })),
    ).flatMap(({ sizeRow, allocatedQty: sizeGarmentQty }) =>
      unit.partRows.map((partRow, partIndex) => {
        const pieceCountPerUnit = Math.max(Number(partRow.pieceCountPerUnit || 0), 1)
        const partCode = String(partRow.partCode || partRow.partName || '')
        const partName = String(partRow.partName || partRow.partCode || '')
        return {
          outputId: `actual-output:${target.spreadingSessionId || target.markerId || target.title}:${unit.planUnitId}:${sizeRow.skuCode || sizeRow.size}:${partCode}:${partIndex + 1}:${timestampKey}`,
          color: sizeRow.color || unit.color || target.colorSummary || '综合颜色',
          size: sizeRow.size || sizeRow.skuCode,
          partCode,
          partName,
          actualPieceQty: Math.max(sizeGarmentQty * pieceCountPerUnit, 0),
          actualGarmentQty: sizeGarmentQty,
          unit: '片' as const,
        }
      }),
    )
  })
}

function hasCuttingOutputBreakdown(target: PdaCuttingSpreadingTarget | null): boolean {
  return Boolean(target?.planUnits?.some((unit) =>
    unit.sizeRows.some((sizeRow) => Boolean(sizeRow.size || sizeRow.skuCode))
    && unit.partRows.some((partRow) => Boolean(partRow.partCode || partRow.partName)),
  ))
}

function resolveRecordHandoverResultLabel(label?: string | null): string {
  return normalizePdaCuttingHandoverResultLabel(label)
}

function renderFormulaBlock(value: string, formula: string): string {
  return `
    <div class="rounded-xl border bg-muted/20 px-1.5 py-1">
      <div class="text-sm font-semibold text-foreground">${escapeHtml(value)}</div>
      <div class="mt-px font-mono text-[11px] leading-3.5 text-muted-foreground">${escapeHtml(formula)}</div>
    </div>
  `
}

function renderFeedbackBlock(form: SpreadingFormState): string {
  if (!form.feedbackMessage) return ''
  return renderPdaCuttingFeedbackNotice(form.feedbackMessage, form.feedbackTone)
}

function resolveRoleName(roleId: string): string {
  return pdaRoleTemplates.find((item) => item.roleId === roleId)?.roleName
    || findFactoryPdaRoleById(roleId)?.roleName
    || defaultFactoryRoles.find((item) => item.roleId === roleId)?.roleName
    || roleId
}

function resolveCurrentOperator(taskId: string, detail: PdaCuttingTaskDetailData): CuttingPdaRuntimeOperatorInput {
  const session = getPdaSession()
  const pdaUser = getCurrentPdaUser()
  if (session?.userId && pdaUser) {
    return {
      operatorAccountId: pdaUser.userId,
      operatorName: pdaUser.name,
      operatorRole: resolveRoleName(pdaUser.roleId),
      operatorFactoryId: pdaUser.factoryId,
      operatorFactoryName: detail.assigneeFactoryName,
    }
  }

  if (session?.userId) {
    const factoryUser = initialFactoryUsers.find((item) => item.userId === session.userId)
    if (factoryUser) {
      return {
        operatorAccountId: factoryUser.userId,
        operatorName: factoryUser.name,
        operatorRole: resolveRoleName(factoryUser.roleIds[0] || 'ROLE_PRODUCTION'),
        operatorFactoryId: factoryUser.factoryId,
        operatorFactoryName: detail.assigneeFactoryName,
      }
    }
  }

  return resolvePdaCuttingRuntimeOperator(taskId, '现场铺布员')
}

function buildDefaultOperatorLayerRow(
  operator: CuttingPdaRuntimeOperatorInput,
  layerCount?: string | number,
): PdaSpreadingOperatorLayerRow {
  const parsedLayerCount = Math.max(Number(layerCount || '0') || 0, 0)
  return {
    rowId: `pda-operator-layer-${++pdaOperatorLayerRowSequence}`,
    startLayer: parsedLayerCount > 0 ? '1' : '',
    endLayer: parsedLayerCount > 0 ? String(parsedLayerCount) : '',
    operatorName: operator.operatorName || '',
  }
}

function ensureOperatorLayerRows(
  form: SpreadingFormState,
  operator: CuttingPdaRuntimeOperatorInput,
): PdaSpreadingOperatorLayerRow[] {
  if (!form.operatorLayerRows.length) {
    form.operatorLayerRows = [buildDefaultOperatorLayerRow(operator, form.layerCount)]
  }
  return form.operatorLayerRows
}

function syncSingleOperatorLayerRange(form: SpreadingFormState): void {
  if (form.operatorLayerRows.length !== 1) return
  const layerCount = Math.max(Number(form.layerCount || '0') || 0, 0)
  if (layerCount <= 0) return
  const row = form.operatorLayerRows[0]
  if (!row.startLayer || row.startLayer === '1') row.startLayer = '1'
  if (!row.endLayer || Number(row.endLayer) <= 0) row.endLayer = String(layerCount)
}

function normalizePdaOperatorLayerRows(
  form: SpreadingFormState,
  operator: CuttingPdaRuntimeOperatorInput,
  layerCount: number,
): SpreadingRollOperatorLayerRow[] {
  const rows = ensureOperatorLayerRows(form, operator)
  return normalizeRollOperatorLayerRows(
    rows.map((row, index) => ({
      rowId: row.rowId || `pda-operator-layer-${index + 1}`,
      startLayer: Number(row.startLayer || '0') || undefined,
      endLayer: Number(row.endLayer || '0') || undefined,
      operatorName: row.operatorName.trim() || operator.operatorName,
    })),
  ).map((row, index) => ({
    ...row,
    startLayer: row.startLayer ?? (index === 0 && layerCount > 0 ? 1 : undefined),
    endLayer: row.endLayer ?? (index === 0 && layerCount > 0 ? layerCount : undefined),
  }))
}

function getOperatorLayerValidationMessage(rows: SpreadingRollOperatorLayerRow[]): string {
  if (!rows.length) return '请填写人员按层信息。'
  const invalidName = rows.some((row) => !row.operatorName.trim())
  if (invalidName) return '人员按层必须填写人员姓名。'
  const invalidRange = rows.some((row) =>
    row.startLayer !== undefined
    && row.endLayer !== undefined
    && row.startLayer > row.endLayer,
  )
  return invalidRange ? '人员按层的起始层不能大于结束层。' : ''
}

function renderOperatorLayerEditor(
  taskId: string,
  form: SpreadingFormState,
  operator: CuttingPdaRuntimeOperatorInput,
): string {
  const rows = ensureOperatorLayerRows(form, operator)
  return `
    <section class="rounded-xl border bg-muted/10 px-2 py-2" data-testid="pda-cutting-spreading-operator-layer-editor">
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="text-sm font-semibold text-foreground">人员按层</div>
          <div class="mt-0.5 text-[11px] leading-4 text-muted-foreground">按实际负责层数录入，可新增多个人员。</div>
        </div>
        <button class="inline-flex min-h-7 items-center justify-center rounded-xl border px-2 text-xs font-medium hover:bg-muted" data-pda-cut-spreading-action="add-operator-layer" data-task-id="${escapeHtml(taskId)}">
          新增人员
        </button>
      </div>
      <div class="mt-2 space-y-1.5">
        ${rows.map((row, index) => `
          <div class="grid grid-cols-[1fr_1fr_1.4fr_auto] gap-1" data-pda-cut-spreading-operator-row="${escapeHtml(row.rowId)}">
            <label class="block space-y-0.5">
              <span class="text-[11px] text-muted-foreground">起始层</span>
              <input type="number" min="1" step="1" class="h-8 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-operator-field="startLayer" data-pda-cut-spreading-operator-index="${index}" value="${escapeHtml(row.startLayer)}" />
            </label>
            <label class="block space-y-0.5">
              <span class="text-[11px] text-muted-foreground">结束层</span>
              <input type="number" min="1" step="1" class="h-8 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-operator-field="endLayer" data-pda-cut-spreading-operator-index="${index}" value="${escapeHtml(row.endLayer)}" />
            </label>
            <label class="block space-y-0.5">
              <span class="text-[11px] text-muted-foreground">人员</span>
              <input class="h-8 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-operator-field="operatorName" data-pda-cut-spreading-operator-index="${index}" value="${escapeHtml(row.operatorName)}" />
            </label>
            <button class="mt-5 inline-flex h-8 min-w-8 items-center justify-center rounded-xl border px-2 text-xs font-medium hover:bg-muted ${rows.length <= 1 ? 'opacity-40' : ''}" data-pda-cut-spreading-action="remove-operator-layer" data-task-id="${escapeHtml(taskId)}" data-pda-cut-spreading-operator-index="${index}" ${rows.length <= 1 ? 'disabled aria-disabled="true"' : ''}>
              删
            </button>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

function buildHandoverOptions(taskId: string, detail: PdaCuttingTaskDetailData): Array<{ accountId: string; name: string }> {
  const currentOperator = resolveCurrentOperator(taskId, detail)
  const factoryId = currentOperator.operatorFactoryId
  const pdaOptions = listFactoryPdaUsers(factoryId)
    .filter((item) => item.userId !== currentOperator.operatorAccountId)
    .map((item) => ({ accountId: item.userId, name: item.name }))
  const factoryOptions = initialFactoryUsers
    .filter((item) => item.factoryId === factoryId && item.userId !== currentOperator.operatorAccountId)
    .map((item) => ({ accountId: item.userId, name: item.name }))
  return Array.from(
    new Map([...pdaOptions, ...factoryOptions].map((item) => [item.accountId, item])).values(),
  )
}

function renderRecords(detail: NonNullable<ReturnType<typeof getSpreadingDetail>>): string {
  if (!detail || !detail.spreadingRecords.length) {
    return renderPdaCuttingEmptyState('当前裁片单暂无铺布记录', '')
  }

  const totalLength = detail.spreadingRecords.reduce((sum, item) => sum + item.calculatedLength, 0)

  return `
    <div class="space-y-1.5">
      <div class="rounded-xl bg-muted/30 px-2 py-1.5 text-xs">
        <div class="text-muted-foreground">最近记录汇总</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(totalLength.toFixed(2))} 米</div>
      </div>
      ${detail.spreadingRecords
        .map(
          (item) => `
            <article class="rounded-xl border px-2 py-1.5 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-foreground">卷号：${escapeHtml(item.fabricRollNo)}</div>
                <div class="text-muted-foreground">${escapeHtml(item.enteredAt)}</div>
              </div>
              <div class="mt-1.5 grid grid-cols-2 gap-1.5 text-muted-foreground">
                ${item.stepLabel ? `<div>阶梯：${escapeHtml(item.stepLabel)}</div>` : ''}
                <div>铺布层数：${escapeHtml(String(item.layerCount))} 层</div>
                <div>卷布料长度：${escapeHtml(item.calculatedLength.toFixed(2))} 米</div>
                <div class="col-span-2">人员：${escapeHtml(item.operatorLayerText || item.enteredBy || '现场铺布员')}</div>
                <div>交接结果：${escapeHtml(resolveRecordHandoverResultLabel(item.handoverResultLabel))}</div>
              </div>
              <div class="mt-0.5 text-muted-foreground">备注：${escapeHtml(item.note || '无')}</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderTargetSummary(target: PdaCuttingSpreadingTarget | null): string {
  if (!target) {
    return renderPdaCuttingEmptyState('当前无可选铺布单', '')
  }

  const markerParts = target.sourceMarkerLabel.split('/').map((item) => item.trim()).filter(Boolean)
  const schemeLabel = markerParts.length > 1 ? markerParts[0] : target.title || '—'
  const markerLabel = markerParts.length > 1 ? markerParts.slice(1).join(' / ') : target.sourceMarkerLabel

  return `
    <div class="grid gap-1.5 text-xs sm:grid-cols-2">
      <div><div class="text-muted-foreground">铺布单</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(target.title)}</div></div>
      <div><div class="text-muted-foreground">当前状态</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(target.statusLabel)}</div></div>
      <div><div class="text-muted-foreground">排唛架方案</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(schemeLabel)}</div></div>
      <div><div class="text-muted-foreground">唛架编号</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(markerLabel || '—')}</div></div>
      <div data-pda-cut-spreading-field="spreadingMode"><div class="text-muted-foreground">唛架模式</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(getSpreadingModeLabel(target.spreadingMode))}</div></div>
      <div><div class="text-muted-foreground">裁片单</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(target.cutOrderNo || '—')}</div></div>
      <div><div class="text-muted-foreground">唛架方案</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(target.markerPlanNo || '—')}</div></div>
      <div class="sm:col-span-2 rounded-xl border bg-muted/20 px-2 py-1.5">
        <div class="flex items-center justify-between gap-2">
          <div class="text-muted-foreground">铺布物料状态</div>
          ${renderMaterialReadinessBadge(target)}
        </div>
        <div class="mt-1 grid grid-cols-3 gap-1 text-[11px]">
          <div><div class="text-muted-foreground">计划</div><div class="font-semibold text-foreground">${escapeHtml(formatMaterialQty(target.materialReadiness.plannedUsageQty, target.materialReadiness.unit))}</div></div>
          <div><div class="text-muted-foreground">可用</div><div class="font-semibold text-foreground">${escapeHtml(formatMaterialQty(target.materialReadiness.availableQty, target.materialReadiness.unit))}</div></div>
          <div><div class="text-muted-foreground">缺口</div><div class="font-semibold ${target.materialReadiness.shortageQty > 0 ? 'text-rose-600' : 'text-emerald-700'}">${escapeHtml(formatMaterialQty(target.materialReadiness.shortageQty, target.materialReadiness.unit))}</div></div>
        </div>
        <div class="mt-1 text-[11px] leading-4 text-muted-foreground">${escapeHtml(target.materialReadiness.reasonText)}</div>
      </div>
      <div class="sm:col-span-2">
        <div class="mb-1 text-muted-foreground">面料信息</div>
        ${renderMaterialIdentityBlock(
          {
            materialSku: target.materialSku,
            materialLabel: '铺布面料',
            materialAlias: target.materialAlias,
            materialImageUrl: target.materialImageUrl,
          },
          { compact: true, showCategory: false },
        )}
      </div>
      <div><div class="text-muted-foreground">颜色</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(target.colorSummary || '—')}</div></div>
    </div>
  `
}

function renderCompactSpreadingContext(
  detail: PdaCuttingTaskDetailData,
  target: PdaCuttingSpreadingTarget | null,
  planUnit: ReturnType<typeof getSelectedPlanUnit>,
): string {
  const materialSku = planUnit?.materialSku || target?.materialSku || detail.materialSku
  const materialAlias = planUnit?.materialAlias || target?.materialAlias || detail.materialAlias
  const materialImageUrl = planUnit?.materialImageUrl || target?.materialImageUrl || detail.materialImageUrl
  return `
    <section class="rounded-xl border bg-card px-2 py-2" data-testid="pda-cutting-spreading-core-summary">
      <div class="flex items-start gap-2">
        ${renderMaterialIdentityBlock(
          {
            materialSku,
            materialLabel: detail.materialTypeLabel,
            materialAlias,
            materialImageUrl,
          },
          { compact: true, showCategory: false },
        )}
      </div>
      <div class="mt-1.5 grid grid-cols-2 gap-1 text-xs">
        <div class="rounded-xl bg-muted/30 px-2 py-1.5">
          <div class="text-muted-foreground">裁片单</div>
          <div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(detail.cutOrderNo || '—')}</div>
        </div>
        <div class="rounded-xl bg-muted/30 px-2 py-1.5">
          <div class="text-muted-foreground">铺布单</div>
          <div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(target?.title || detail.executionOrderNo || '—')}</div>
        </div>
      </div>
    </section>
  `
}

function renderPlanUnitSelectorField(
  target: PdaCuttingSpreadingTarget | null,
  form: SpreadingFormState,
): string {
  const planUnits = target?.planUnits || []
  const selectedPlanUnit = getSelectedPlanUnit(target, form.selectedPlanUnitId)
  const selectedLabel = selectedPlanUnit ? formatPlanUnitOptionLabel(selectedPlanUnit) : '当前铺布单暂无铺布明细'
  return `
    <section class="rounded-xl border bg-card px-2 py-2" data-testid="pda-cutting-plan-unit-selector">
      <label class="block space-y-0.5">
        <span class="text-muted-foreground">面料 / 铺布明细</span>
        <select class="h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold" data-pda-cut-spreading-field="planUnitId" ${planUnits.length ? '' : 'disabled aria-disabled="true"'}>
          ${planUnits.length
            ? planUnits.map((item) => `
              <option value="${escapeHtml(item.planUnitId)}" ${selectedPlanUnit?.planUnitId === item.planUnitId ? 'selected' : ''}>
                ${escapeHtml(formatPlanUnitOptionLabel(item))}
              </option>
            `).join('')
            : '<option value="">暂无可选面料</option>'}
        </select>
      </label>
      <div class="mt-1 rounded-xl bg-muted/20 px-2 py-1.5 text-[11px] leading-4 text-muted-foreground">
        当前选择：${escapeHtml(selectedLabel)}
      </div>
    </section>
  `
}

function renderTargetDetailDisclosure(
  target: PdaCuttingSpreadingTarget | null,
  planUnit: ReturnType<typeof getSelectedPlanUnit>,
): string {
  return `
    <details class="rounded-xl border bg-card px-2 py-2 text-xs" data-testid="pda-cutting-spreading-extra-detail">
      <summary class="cursor-pointer text-sm font-semibold text-foreground">查看铺布单信息</summary>
      <div class="mt-2 space-y-2">
        ${renderTargetSummary(target)}
        <div class="border-t pt-2">
          <div class="mb-1 text-sm font-semibold text-foreground">铺布明细</div>
          ${renderPlanUnitSummary(planUnit)}
        </div>
      </div>
    </details>
  `
}

function renderOperatorSummary(taskId: string, detail: PdaCuttingTaskDetailData): string {
  const operator = resolveCurrentOperator(taskId, detail)
  return `
    <div class="grid gap-1.5 text-xs sm:grid-cols-2">
      <div><div class="text-muted-foreground">录入人</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(operator.operatorName)}</div></div>
      <div><div class="text-muted-foreground">当前工厂</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(detail.assigneeFactoryName)}</div></div>
    </div>
  `
}

function renderPlanUnitSummary(planUnit: ReturnType<typeof getSelectedPlanUnit>): string {
  if (!planUnit) {
    return renderPdaCuttingEmptyState('当前铺布单暂无铺布明细', '')
  }
  const planUnitLabel = planUnit.label || `${planUnit.color || '待定'} / ${planUnit.materialSku || '待定'} / ${planUnit.garmentQtyPerUnit}件`
  return `
    <div class="grid gap-1.5 text-xs sm:grid-cols-2">
      <div><div class="text-muted-foreground">铺布明细</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(planUnitLabel)}</div></div>
      <div><div class="text-muted-foreground">本次成衣件数（件）</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(String(planUnit.garmentQtyPerUnit))}</div></div>
      ${planUnit.stepLabel ? `<div><div class="text-muted-foreground">阶梯编号</div><div class="mt-0.5 text-sm font-semibold text-blue-600">${escapeHtml(planUnit.stepLabel)}</div></div>` : ''}
      <div><div class="text-muted-foreground">计划层数/净长</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(`${planUnit.plannedRepeatCount || 0} 层 / ${Number(planUnit.lengthPerUnitM || 0).toFixed(2)} m`)}</div></div>
      <div class="sm:col-span-2">
        <div class="mb-1 text-muted-foreground">面料信息</div>
        ${renderMaterialIdentityBlock(
          {
            materialSku: planUnit.materialSku,
            materialLabel: '唛架铺布面料',
            materialAlias: planUnit.materialAlias,
            materialImageUrl: planUnit.materialImageUrl,
          },
          { compact: true, showCategory: false },
        )}
      </div>
      <div><div class="text-muted-foreground">颜色</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(planUnit.color || '—')}</div></div>
    </div>
  `
}

function formatPlanUnitOptionLabel(planUnit: NonNullable<ReturnType<typeof getSelectedPlanUnit>>): string {
  const parts = [
    planUnit.color || '待定颜色',
    planUnit.materialAlias || planUnit.materialSku || '待定面料',
    planUnit.stepLabel ? `阶梯 ${planUnit.stepLabel}` : '',
    `${planUnit.plannedRepeatCount || 0} 层`,
    `${planUnit.plannedCutGarmentQty || 0} 件`,
  ].filter(Boolean)
  return parts.join(' / ')
}

function renderStartSpreadingConfirm(
  detail: PdaCuttingTaskDetailData,
  form: SpreadingFormState,
  operator: CuttingPdaRuntimeOperatorInput,
): string {
  const ownerOptions = buildOwnerOptions(operator)
  const selectedOwnerName = resolveOwnerName(form.ownerAccountId, operator)
  void detail
  return `
    <section class="rounded-xl border bg-card px-2 py-2" data-testid="pda-cutting-start-spreading-confirm">
      <div class="text-sm font-semibold text-foreground">开始铺布确认</div>
      <div class="mt-2 grid gap-2">
        <label class="block space-y-0.5">
          <span class="text-muted-foreground">裁床</span>
          <select class="h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold" data-pda-cut-spreading-field="cuttingTableId">
            <option value="">请选择裁床</option>
            ${cuttingTableResources.map((table) => `
              <option value="${escapeHtml(table.cuttingTableId)}" ${form.cuttingTableId === table.cuttingTableId ? 'selected' : ''}>
                ${escapeHtml(table.cuttingTableName)}
              </option>
            `).join('')}
          </select>
        </label>
        <label class="block space-y-0.5">
          <span class="text-muted-foreground">负责人</span>
          <select class="h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold" data-pda-cut-spreading-field="ownerAccountId">
            ${ownerOptions.map((item) => `
              <option value="${escapeHtml(item.accountId)}" ${form.ownerAccountId === item.accountId ? 'selected' : ''}>
                ${escapeHtml(item.name)}
              </option>
            `).join('')}
          </select>
        </label>
      </div>
      <div class="mt-2 rounded-xl bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
        当前负责人：${escapeHtml(selectedOwnerName)}。开始铺布只推进阶段，不生成卷记录。
      </div>
      <label class="mt-2 block space-y-0.5">
        <span class="text-muted-foreground">备注</span>
        <textarea class="min-h-12 w-full rounded-xl border bg-background px-2 py-1 text-sm" data-pda-cut-spreading-field="note">${escapeHtml(form.note)}</textarea>
      </label>
    </section>
  `
}

function renderFormInner(
  taskId: string,
  detail: PdaCuttingTaskDetailData,
  form: SpreadingFormState,
  pageBackHref: string,
): string {
  const selectedTarget = getSelectedTarget(detail, form.selectedTargetKey)
  const selectedPlanUnit = getSelectedPlanUnit(selectedTarget, form.selectedPlanUnitId)
  const currentOperator = resolveCurrentOperator(taskId, detail)
  const actionLabel = getPrimaryActionLabel(detail)
  syncSingleOperatorLayerRange(form)
  const isSpreading = isSpreadingAction(actionLabel)
  const isRollEntryVisible = actionLabel === '完成铺布'
  const grossLength = getGrossOccupiedLength(form)
  const nextFabricRollNo = resolveNextFabricRollNo(detail, selectedTarget)

  return `
    <div class="space-y-2 pb-2 text-xs">
      ${renderCompactSpreadingContext(detail, selectedTarget, selectedPlanUnit)}
      ${renderPlanUnitSelectorField(selectedTarget, form)}
      ${actionLabel === '开始铺布' ? renderStartSpreadingConfirm(detail, form, currentOperator) : ''}
      ${
        isSpreading && isRollEntryVisible
          ? `
          <section class="rounded-xl border bg-card px-2 py-2" data-testid="pda-cutting-spreading-inputs">
            <div class="grid grid-cols-2 gap-2">
              <div class="col-span-2 rounded-xl bg-muted/30 px-2 py-1.5" data-testid="pda-cutting-next-roll-no">
                <div class="text-muted-foreground">布卷号（自动）</div>
                <div class="mt-0.5 text-base font-semibold text-foreground">${escapeHtml(nextFabricRollNo)}</div>
              </div>
              <label class="block space-y-0.5">
                <span class="text-muted-foreground">实铺层数</span>
                <input type="number" min="0" step="1" class="h-9 w-full rounded-xl border bg-background px-2 text-base font-semibold" data-pda-cut-spreading-field="layerCount" value="${escapeHtml(form.layerCount)}" />
              </label>
              <label class="block space-y-0.5">
                <span class="text-muted-foreground">实际铺布长度（m）</span>
                <input type="number" min="0" step="0.01" class="h-9 w-full rounded-xl border bg-background px-2 text-base font-semibold" data-pda-cut-spreading-field="actualLength" value="${escapeHtml(form.actualLength)}" />
              </label>
              <label class="block space-y-0.5">
                <span class="text-muted-foreground">布头长度（m）</span>
                <input type="number" min="0" step="0.01" class="h-9 w-full rounded-xl border bg-background px-2 text-base font-semibold" data-pda-cut-spreading-field="headLength" value="${escapeHtml(form.headLength)}" />
              </label>
              <label class="block space-y-0.5">
                <span class="text-muted-foreground">布尾长度（m）</span>
                <input type="number" min="0" step="0.01" class="h-9 w-full rounded-xl border bg-background px-2 text-base font-semibold" data-pda-cut-spreading-field="tailLength" value="${escapeHtml(form.tailLength)}" />
              </label>
              <div class="col-span-2 rounded-xl border bg-muted/20 px-2 py-1.5">
                <div class="text-muted-foreground">卷布料长度</div>
                <div class="mt-0.5 text-base font-semibold text-foreground" data-testid="pda-cutting-gross-length-value">${escapeHtml(grossLength.toFixed(2))} 米</div>
                <div class="mt-0.5 text-[11px] text-muted-foreground">实际铺布长度 × 层数 + 布头 + 布尾</div>
              </div>
            </div>
          </section>
          ${renderOperatorLayerEditor(taskId, form, currentOperator)}
          `
          : ''
      }
      ${
        isCuttingAction(actionLabel)
          ? `
          <section class="rounded-xl border bg-card px-2 py-2" data-testid="pda-cutting-cutting-inputs">
            <div class="grid grid-cols-2 gap-2">
            <label class="block space-y-0.5">
                <span class="text-muted-foreground">实际裁剪数量</span>
                <input type="number" min="0" step="1" class="h-9 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-field="actualCutQty" value="${escapeHtml(form.actualCutQty)}" />
            </label>
              <label class="block space-y-0.5">
                <span class="text-muted-foreground">实际用量</span>
                <input type="number" min="0" step="0.01" class="h-9 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-field="actualUsage" value="${escapeHtml(form.actualUsage)}" />
              </label>
              <label class="block space-y-0.5">
                <span class="text-muted-foreground">裁剪人员</span>
                <input class="h-9 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-field="cuttingOperator" value="${escapeHtml(form.cuttingOperator || currentOperator.operatorName)}" />
              </label>
            </div>
          </section>
          `
          : ''
      }
      ${actionLabel !== '开始铺布'
        ? `
      <section class="rounded-xl border bg-card px-2 py-2" data-testid="pda-cutting-spreading-note-card">
        <label class="block space-y-0.5">
          <span class="text-muted-foreground">备注</span>
          <textarea class="min-h-12 w-full rounded-xl border bg-background px-2 py-1 text-sm" data-pda-cut-spreading-field="note">${escapeHtml(form.note)}</textarea>
        </label>
      </section>
        `
        : ''}
      ${renderFeedbackBlock(form)}
      ${renderSubmitBar(taskId, form, pageBackHref, actionLabel, selectedTarget)}
      ${renderTargetDetailDisclosure(selectedTarget, selectedPlanUnit)}
      <section class="rounded-xl border bg-card px-2 py-2" data-testid="pda-cutting-spreading-records">
        <div class="mb-1 text-sm font-semibold text-foreground">已录卷记录</div>
        ${renderRecords(detail)}
      </section>
    </div>
  `
}

function renderCutCompletionReportBlock(
  taskId: string,
  detail: PdaCuttingTaskDetailData,
  form: SpreadingFormState,
  pageBackHref: string,
): string {
  const rows = detail.cutCompletionPartRows
  return `
    <section class="space-y-2" data-pda-cut-completion-report="${escapeHtml(taskId)}">
      <section class="rounded-xl border bg-card px-3 py-3">
        <div class="text-lg font-semibold text-foreground">裁片完成上报</div>
        <div class="mt-1 text-xs text-muted-foreground">生产单 ${escapeHtml(detail.productionOrderNo)} / 裁片单 ${escapeHtml(detail.cutOrderNo)}</div>
      </section>
      <section class="rounded-xl border bg-card px-3 py-2">
        <div class="text-sm font-semibold text-foreground">本次上报数量</div>
        <div class="mt-2 space-y-2">
          ${rows.length
            ? rows.map((row) => `
              <article class="rounded-xl border bg-muted/10 px-2.5 py-2 text-xs">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="break-words text-sm font-semibold text-foreground">${escapeHtml(row.partName)}</div>
                    <div class="mt-0.5 text-muted-foreground">${escapeHtml(row.colorName)}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-semibold text-foreground">${escapeHtml(row.cutPieceQty.toLocaleString('zh-CN'))} 片</div>
                    <div class="text-muted-foreground">可做成衣数 ${escapeHtml(row.garmentAvailableQty.toLocaleString('zh-CN'))} 件</div>
                  </div>
                </div>
              </article>
            `).join('')
            : renderPdaCuttingEmptyState('暂无可上报裁片明细', '')}
        </div>
      </section>
      <section class="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        确认后同步到连续任务进度，后续由连续任务继续执行。
      </section>
      <div data-pda-cut-completion-feedback="${escapeHtml(taskId)}">${renderFeedbackBlock(form)}</div>
      <div class="grid grid-cols-[0.9fr_1.1fr] gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold" data-nav="${escapeHtml(pageBackHref)}">返回</button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" data-pda-cut-spreading-action="submit" data-task-id="${escapeHtml(taskId)}">确认上报</button>
      </div>
    </section>
  `
}

function renderSubmitBar(
  taskId: string,
  form: SpreadingFormState,
  pageBackHref: string,
  actionLabel: string,
  selectedTarget: PdaCuttingSpreadingTarget | null,
): string {
  void form
  const disabledByMaterial = actionLabel === '开始铺布' && selectedTarget !== null && !selectedTarget.materialReadiness.canStartSpreading
  const primaryClassName = disabledByMaterial
    ? 'inline-flex min-h-6 items-center justify-center rounded-xl bg-muted px-2 py-1 text-xs font-medium text-muted-foreground opacity-70'
    : 'inline-flex min-h-6 items-center justify-center rounded-xl bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90'
  const secondaryClassName = 'inline-flex min-h-6 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100'
  const renderButton = (
    label: string,
    action: string,
    className = primaryClassName,
    extraAttrs = '',
  ) => `
    <button class="${className}" data-pda-cut-spreading-action="${escapeHtml(action)}" data-task-id="${escapeHtml(taskId)}" ${extraAttrs}>
      ${escapeHtml(label)}
    </button>
  `
  const actionButtons = (() => {
    if (actionLabel === '开始铺布') {
      return renderButton('开始铺布', 'start-spreading', primaryClassName, disabledByMaterial ? 'disabled aria-disabled="true"' : '')
    }
    if (actionLabel === '完成铺布') {
      return `
        <div class="grid grid-cols-2 gap-1">
          ${renderButton('提交本卷', 'submit', secondaryClassName, 'data-pda-cut-spreading-submit-stage="submit-roll"')}
          ${renderButton('完成铺布', 'finish-spreading')}
        </div>
      `
    }
    if (actionLabel === '开始裁剪') return renderButton('开始裁剪', 'start-cutting')
    if (actionLabel === '完成裁剪') return renderButton('完成裁剪', 'submit', primaryClassName, 'data-pda-cut-spreading-submit-stage="finish-cutting"')
    return renderButton(actionLabel, 'submit')
  })()
  return `
    <div class="rounded-xl border bg-background px-1.5 py-1" data-testid="pda-cutting-spreading-submit-bar" data-pda-cut-spreading-submit-shell="${escapeHtml(taskId)}">
      <div class="grid grid-cols-[0.9fr_1.1fr] gap-1">
        <button class="inline-flex min-h-6 items-center justify-center rounded-xl border px-2 py-1 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}" data-pda-cut-spreading-back="true">
          返回
        </button>
        ${actionButtons}
      </div>
      ${disabledByMaterial ? `<div class="mt-1 text-center text-[11px] text-muted-foreground">${escapeHtml(selectedTarget?.materialReadiness.reasonText || '')}</div>` : ''}
    </div>
  `
}

function resolveSpreadingStateScope(
  taskId: string,
  executionOrderId?: string | null,
  executionOrderNo?: string | null,
) {
  const context = buildPdaCuttingExecutionContext(taskId, 'spreading')
  return {
    context,
    executionOrderId: executionOrderId || context.selectedExecutionOrderId || null,
    executionOrderNo: executionOrderNo || context.selectedExecutionOrderNo || null,
  }
}

function syncSpreadingFormDom(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): void {
  if (typeof document === 'undefined') return
  const root = document.querySelector<HTMLElement>(`[data-pda-cut-spreading-root="${taskId}"]`)
  if (!root) return
  const { context, executionOrderId: stateExecutionOrderId, executionOrderNo: stateExecutionOrderNo } =
    resolveSpreadingStateScope(taskId, executionOrderId, executionOrderNo)
  if (!context.detail) return
  const form = getState(taskId, stateExecutionOrderId, stateExecutionOrderNo)
  const pageBackHref = form.backHrefOverride || context.backHref
  root.innerHTML = renderFormInner(taskId, context.detail, form, pageBackHref)
}

function syncCutCompletionReportDom(taskId: string, form: SpreadingFormState): boolean {
  if (typeof document === 'undefined') return false
  const feedbackNode = document.querySelector<HTMLElement>(`[data-pda-cut-completion-feedback="${taskId}"]`)
  if (!feedbackNode) return false
  feedbackNode.innerHTML = renderFeedbackBlock(form)
  return true
}

function syncSpreadingLiveDom(taskId: string, form: SpreadingFormState): void {
  if (typeof document === 'undefined') return
  const root = document.querySelector<HTMLElement>(`[data-pda-cut-spreading-root="${taskId}"]`)
  if (!root) return

  const grossLengthNode = root.querySelector<HTMLElement>('[data-testid="pda-cutting-gross-length-value"]')
  if (grossLengthNode) {
    grossLengthNode.textContent = `${getGrossOccupiedLength(form).toFixed(2)} 米`
  }

  form.operatorLayerRows.forEach((row, index) => {
    ;(['startLayer', 'endLayer', 'operatorName'] as Array<keyof PdaSpreadingOperatorLayerRow>).forEach((field) => {
      const input = root.querySelector<HTMLInputElement>(
        `[data-pda-cut-spreading-operator-field="${field}"][data-pda-cut-spreading-operator-index="${index}"]`,
      )
      if (input && document.activeElement !== input) {
        input.value = String(row[field] || '')
      }
    })
  })
}

function shouldRerenderAfterFieldInput(fieldNode: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
  if (fieldNode instanceof HTMLSelectElement) return true
  if (fieldNode instanceof HTMLTextAreaElement) return false
  const inputType = (fieldNode.type || 'text').toLowerCase()
  return ['checkbox', 'radio', 'file', 'range', 'color'].includes(inputType)
}

function persistMarkerSpreadingStoreFromPda(store: ReturnType<typeof readMarkerSpreadingPrototypeData>['store']): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY, serializeMarkerSpreadingStorage(store))
}

function mapPdaPlanUnitsToWeb(target: PdaCuttingSpreadingTarget): NonNullable<SpreadingSession['planUnits']> {
  return target.planUnits.map((unit) => ({
    planUnitId: unit.planUnitId,
    sourceType: unit.sourceType,
    sourceLineId: unit.sourceLineId,
    stepNo: unit.stepNo,
    stepLabel: unit.stepLabel,
    color: unit.color,
    materialSku: unit.materialSku,
    materialAlias: unit.materialAlias,
    materialImageUrl: unit.materialImageUrl,
    garmentQtyPerUnit: unit.garmentQtyPerUnit,
    plannedRepeatCount: unit.plannedRepeatCount,
    lengthPerUnitM: unit.lengthPerUnitM,
    plannedCutGarmentQty: unit.plannedCutGarmentQty,
    plannedSpreadLengthM: unit.plannedSpreadLengthM,
    sizeRows: unit.sizeRows.map((row) => ({
      skuCode: row.skuCode,
      color: row.color,
      size: row.size,
      plannedQty: row.plannedQty,
      plannedLayerCount: row.plannedLayerCount || unit.plannedRepeatCount || 0,
    })),
  }))
}

function buildFallbackWebSpreadingSession(input: {
  detail: PdaCuttingTaskDetailData
  target: PdaCuttingSpreadingTarget
  identity: NonNullable<ReturnType<typeof resolvePdaCuttingRuntimeIdentity>>
  occurredAt: string
}): SpreadingSession {
  const sessionId = input.target.spreadingSessionId || input.identity.executionOrderId || `pda-spreading-${input.detail.taskId}-${input.target.targetKey}`
  return {
    spreadingSessionId: sessionId,
    sessionNo: input.target.title || input.identity.executionOrderNo || sessionId,
    contextType: 'cut-order',
    cutOrderIds: [input.identity.cutOrderId].filter(Boolean),
    markerPlanId: input.identity.markerPlanId || input.target.markerId || '',
    markerPlanNo: input.identity.markerPlanNo || input.target.markerPlanNo || '',
    markerId: input.target.markerId || input.identity.markerPlanId || '',
    markerNo: input.target.markerNo || input.identity.markerPlanNo || '',
    sourceMarkerId: input.target.markerId || input.identity.markerPlanId || '',
    sourceMarkerNo: input.target.markerNo || input.identity.markerPlanNo || '',
    sourceSchemeId: input.target.markerId || input.identity.markerPlanId || '',
    sourceSchemeNo: input.target.markerPlanNo || input.identity.markerPlanNo || '',
    sourceBedId: input.target.markerId || input.identity.markerPlanId || '',
    sourceBedNo: input.target.markerNo || input.target.sourceMarkerLabel || '',
    sourceBedMode: mapPdaSpreadingModeToMarkerMode(input.target.spreadingMode),
    styleCode: '',
    spuCode: input.detail.productionOrderNo || '',
    materialSkuSummary: input.target.materialSku,
    materialAliasSummary: input.target.materialAlias || '',
    materialImageUrl: input.target.materialImageUrl || '',
    colorSummary: input.target.colorSummary || '',
    spreadingMode: mapPdaSpreadingModeToMarkerMode(input.target.spreadingMode),
    status: 'DRAFT',
    importedFromMarker: input.target.importedFromMarker,
    plannedLayers: getPlannedLayerCount(input.target),
    actualLayers: 0,
    totalActualLength: 0,
    totalHeadLength: 0,
    totalTailLength: 0,
    totalCalculatedUsableLength: 0,
    totalRemainingLength: 0,
    operatorCount: 0,
    rollCount: 0,
    configuredLengthTotal: 0,
    claimedLengthTotal: 0,
    varianceLength: 0,
    varianceNote: '',
    actualCutPieceQty: 0,
    actualCutGarmentQty: 0,
    unitPrice: 0,
    totalAmount: 0,
    note: 'PDA 现场执行自动创建的铺布单。',
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
    warningMessages: [],
    planUnits: mapPdaPlanUnitsToWeb(input.target),
    sourceChannel: 'PDA_WRITEBACK',
    sourceWritebackId: '',
    updatedFromPdaAt: '',
    rolls: [],
    operators: [],
  }
}

function resolveWebSpreadingSessionForSync(input: {
  detail: PdaCuttingTaskDetailData
  target: PdaCuttingSpreadingTarget
  identity: NonNullable<ReturnType<typeof resolvePdaCuttingRuntimeIdentity>>
  occurredAt: string
}): { store: ReturnType<typeof readMarkerSpreadingPrototypeData>['store']; session: SpreadingSession } {
  const data = readMarkerSpreadingPrototypeData()
  const matched = data.store.sessions.find((session) =>
    Boolean(input.target.spreadingSessionId) && session.spreadingSessionId === input.target.spreadingSessionId,
  )
    || data.store.sessions.find((session) => session.spreadingSessionId === input.identity.executionOrderId)
    || data.store.sessions.find((session) => Boolean(input.target.markerId) && (session.markerId === input.target.markerId || session.sourceMarkerId === input.target.markerId))
    || null
  return {
    store: data.store,
    session: matched || buildFallbackWebSpreadingSession(input),
  }
}

function syncWebSpreadingStage(input: {
  detail: PdaCuttingTaskDetailData
  target: PdaCuttingSpreadingTarget
  identity: NonNullable<ReturnType<typeof resolvePdaCuttingRuntimeIdentity>>
  eventId: string
  occurredAt: string
  status?: SpreadingStatusKey
  cuttingStatus?: SpreadingCuttingStatusKey
  actualCutQty?: number
  actualUsage?: number
  form: SpreadingFormState
  operator: CuttingPdaRuntimeOperatorInput
}): void {
  const { store, session } = resolveWebSpreadingSessionForSync(input)
  const selectedTable = findCuttingTableById(input.form.cuttingTableId)
  const nextSession: SpreadingSession = {
    ...session,
    status: input.status || session.status,
    cuttingStatus: input.cuttingStatus || session.cuttingStatus,
    cuttingTableId: selectedTable?.cuttingTableId || session.cuttingTableId || '',
    cuttingTableNo: selectedTable?.cuttingTableNo || session.cuttingTableNo || '',
    cuttingTableName: selectedTable?.cuttingTableName || session.cuttingTableName || '',
    ownerAccountId: input.form.ownerAccountId || input.operator.operatorAccountId,
    ownerName: input.form.ownerName || input.operator.operatorName,
    actualStartAt:
      input.status === 'IN_PROGRESS'
        ? session.actualStartAt || input.occurredAt
        : session.actualStartAt || '',
    actualEndAt:
      input.status === 'DONE'
        ? session.actualEndAt || input.occurredAt
        : session.actualEndAt || '',
    cuttingStatusUpdatedAt: input.cuttingStatus ? input.occurredAt : session.cuttingStatusUpdatedAt,
    cuttingStartedAt:
      input.cuttingStatus === 'CUTTING'
        ? session.cuttingStartedAt || input.occurredAt
        : session.cuttingStartedAt,
    cuttingFinishedAt:
      input.cuttingStatus === 'CUTTING_DONE'
        ? input.occurredAt
        : session.cuttingFinishedAt,
    actualCutPieceQty: input.actualCutQty ?? session.actualCutPieceQty,
    actualCutGarmentQty: input.actualCutQty ?? session.actualCutGarmentQty,
    totalActualLength: input.actualUsage ?? session.totalActualLength,
    claimedLengthTotal: input.actualUsage ?? session.claimedLengthTotal,
    sourceChannel: 'PDA_WRITEBACK',
    sourceWritebackId: session.sourceWritebackId || input.eventId,
    updatedFromPdaAt: input.occurredAt,
    updatedAt: input.occurredAt,
  }
  persistMarkerSpreadingStoreFromPda(upsertSpreadingSession(nextSession, store))
}

function syncWebSpreadingRoll(input: {
  detail: PdaCuttingTaskDetailData
  target: PdaCuttingSpreadingTarget
  identity: NonNullable<ReturnType<typeof resolvePdaCuttingRuntimeIdentity>>
  eventId: string
  occurredAt: string
  form: SpreadingFormState
  operator: CuttingPdaRuntimeOperatorInput
  planUnit: NonNullable<ReturnType<typeof getSelectedPlanUnit>>
  fabricRollNo: string
  layerCount: number
  actualLength: number
  headLength: number
  tailLength: number
  operatorLayerRows: SpreadingRollOperatorLayerRow[]
  operatorLayerText: string
  operatorNames: string[]
}): void {
  const { store, session } = resolveWebSpreadingSessionForSync(input)
  const selectedTable = findCuttingTableById(input.form.cuttingTableId)
  const existingRollIndex = session.rolls.findIndex((roll) => roll.sourceWritebackId === input.eventId)
  const roll = {
    ...createRollRecordDraft(session.spreadingSessionId, input.planUnit.materialSku, input.planUnit.planUnitId),
    rollRecordId: input.eventId,
    spreadingSessionId: session.spreadingSessionId,
    planUnitId: input.planUnit.planUnitId,
    sourceHighLowRowId: input.planUnit.sourceType === 'high-low-row' ? input.planUnit.sourceLineId : undefined,
    stepNo: input.planUnit.stepNo,
    stepLabel: input.planUnit.stepLabel,
    sortOrder: existingRollIndex >= 0 ? session.rolls[existingRollIndex].sortOrder : session.rolls.length + 1,
    rollNo: input.fabricRollNo,
    materialSku: input.planUnit.materialSku,
    color: input.planUnit.color,
    labeledLength: input.actualLength,
    actualLength: input.actualLength,
    headLength: input.headLength,
    tailLength: input.tailLength,
    layerCount: input.layerCount,
    totalLength: getGrossOccupiedLength(input.form),
    remainingLength: 0,
    actualCutGarmentQty: getActualCutGarmentQty(input.form, input.planUnit),
    occurredAt: input.occurredAt,
    operatorLayerRows: input.operatorLayerRows,
    operatorLayerText: input.operatorLayerText,
    operatorNames: input.operatorNames,
    usableLength: getUsableLength(input.form),
    note: input.form.note.trim(),
    sourceChannel: 'PDA_WRITEBACK' as const,
    sourceWritebackId: input.eventId,
    updatedFromPdaAt: input.occurredAt,
  }
  const operators = input.operatorLayerRows.map((row, index) => ({
    ...createOperatorRecordDraft(session.spreadingSessionId),
    operatorRecordId: `${input.eventId}:operator:${index + 1}`,
    spreadingSessionId: session.spreadingSessionId,
    sortOrder: session.operators.length + index + 1,
    rollRecordId: roll.rollRecordId,
    operatorAccountId: row.operatorName === input.operator.operatorName ? input.operator.operatorAccountId : '',
    operatorName: row.operatorName || input.operator.operatorName,
    startAt: input.occurredAt,
    endAt: input.occurredAt,
    actionType: '开始铺布' as const,
    startLayer: row.startLayer,
    endLayer: row.endLayer,
    sourceChannel: 'PDA_WRITEBACK' as const,
    sourceWritebackId: input.eventId,
    updatedFromPdaAt: input.occurredAt,
  }))
  const rolls = existingRollIndex >= 0
    ? session.rolls.map((item, index) => (index === existingRollIndex ? roll : item))
    : [...session.rolls, roll]
  const nextSession: SpreadingSession = {
    ...session,
    status: session.status === 'DRAFT' ? 'IN_PROGRESS' : session.status,
    cuttingTableId: selectedTable?.cuttingTableId || session.cuttingTableId || '',
    cuttingTableNo: selectedTable?.cuttingTableNo || session.cuttingTableNo || '',
    cuttingTableName: selectedTable?.cuttingTableName || session.cuttingTableName || '',
    ownerAccountId: input.form.ownerAccountId || input.operator.operatorAccountId,
    ownerName: input.form.ownerName || input.operator.operatorName,
    actualStartAt: session.actualStartAt || input.occurredAt,
    rolls,
    operators: [
      ...session.operators.filter((item) => item.sourceWritebackId !== input.eventId),
      ...operators,
    ],
    sourceChannel: 'PDA_WRITEBACK',
    sourceWritebackId: session.sourceWritebackId || input.eventId,
    updatedFromPdaAt: input.occurredAt,
    updatedAt: input.occurredAt,
  }
  persistMarkerSpreadingStoreFromPda(upsertSpreadingSession(nextSession, store))
}

export function renderPdaCuttingSpreadingPage(taskId: string): string {
  if (!getPdaRuntimeContext()) {
    return renderPdaLoginRedirect()
  }

  const context = buildPdaCuttingExecutionContext(taskId, 'spreading')
  const detail = context.detail

  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '铺布录入',
      subtitle: '',
      activeTab: 'exec',
      body: '',
      backHref: context.backHref,
    })
  }

  if (context.requiresCutPieceOrderSelection) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '铺布录入',
      subtitle: '',
      activeTab: 'exec',
      body: renderPdaCuttingOrderSelectionPrompt(detail, context.backHref, context.selectionNotice || undefined),
      backHref: context.backHref,
    })
  }

  const form = getState(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo)
  const pageBackHref = form.backHrefOverride || context.backHref
  const actionLabel = getPrimaryActionLabel(detail)

  if (detail.cuttingReportMode === 'CONTINUOUS_TASK_CUTTING_COMPLETION') {
    return renderPdaCuttingPageLayout({
      taskId,
      title: '裁片完成上报',
      subtitle: '',
      activeTab: 'exec',
      body: renderCutCompletionReportBlock(taskId, detail, form, pageBackHref),
      backHref: pageBackHref,
    })
  }

  if (actionLabel === '去领料' || actionLabel === '开工') {
    const isPickup = actionLabel === '去领料'
    const body = `
      <section class="space-y-2">
        <section class="rounded-xl border bg-card px-3 py-3 text-sm">
          <div class="text-lg font-semibold text-foreground">${escapeHtml(actionLabel)}</div>
          <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(isPickup ? '没有领料记录，不能开工、铺布或裁剪。' : '已有领料记录，开工后才能进入铺布。')}</div>
        </section>
        <button class="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" ${isPickup ? `data-nav="${escapeHtml(`/fcs/pda/handover?tab=pickup&focusTaskId=${encodeURIComponent(taskId)}&returnTo=${encodeURIComponent(pageBackHref)}`)}"` : `data-pda-cut-spreading-action="start-work" data-task-id="${escapeHtml(taskId)}"`}>
          ${escapeHtml(actionLabel)}
        </button>
        <div class="hidden rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800" data-pda-cutting-spreading-stage-feedback></div>
      </section>
    `
    return renderPdaCuttingPageLayout({
      taskId,
      title: '裁床现场执行',
      subtitle: '',
      activeTab: 'exec',
      body,
      backHref: pageBackHref,
    })
  }

  if (actionLabel === '查看提交结果') {
    const body = `
      <section class="space-y-2">
        <section class="rounded-xl border bg-card px-3 py-3 text-sm">
          <div class="text-lg font-semibold text-foreground">查看提交结果</div>
          <div class="mt-2 rounded-xl bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">${escapeHtml(detail.latestSyncSummary)}</div>
        </section>
        <button class="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" data-nav="${escapeHtml(pageBackHref)}">返回裁片任务</button>
      </section>
    `
    return renderPdaCuttingPageLayout({
      taskId,
      title: '裁床现场执行',
      subtitle: '',
      activeTab: 'exec',
      body,
      backHref: pageBackHref,
    })
  }

  const body = `
    <div class="space-y-1.5">
      <div data-task-id="${escapeHtml(taskId)}" data-pda-cut-spreading-root="${escapeHtml(taskId)}">${renderFormInner(taskId, detail, form, pageBackHref)}</div>
    </div>
  `

  return renderPdaCuttingPageLayout({
    taskId,
    title: '铺布录入',
    subtitle: '',
    activeTab: 'exec',
    body,
    backHref: pageBackHref,
  })
}

export function handlePdaCuttingSpreadingEvent(target: HTMLElement): boolean {
  if (!ensurePdaSessionForAction()) return true

  const operatorFieldNode = target.closest<HTMLElement>('[data-pda-cut-spreading-operator-field]')
  if (operatorFieldNode instanceof HTMLInputElement) {
    const taskId = operatorFieldNode.closest<HTMLElement>('[data-task-id]')?.dataset.taskId || appTaskIdFromPath()
    if (!taskId) return true
    const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
    const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()
    const stateScope = resolveSpreadingStateScope(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const form = getState(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
    const rowIndex = Number(operatorFieldNode.dataset.pdaCutSpreadingOperatorIndex || '-1')
    const field = operatorFieldNode.dataset.pdaCutSpreadingOperatorField as keyof PdaSpreadingOperatorLayerRow | undefined
    if (rowIndex < 0 || !field || !form.operatorLayerRows[rowIndex]) return true
    form.operatorLayerRows[rowIndex] = {
      ...form.operatorLayerRows[rowIndex],
      [field]: operatorFieldNode.value,
    }
    syncSpreadingLiveDom(taskId, form)
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-pda-cut-spreading-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLTextAreaElement ||
    fieldNode instanceof HTMLSelectElement
  ) {
    const taskId = fieldNode.closest<HTMLElement>('[data-task-id]')?.dataset.taskId || appTaskIdFromPath()
    if (!taskId) return true
    const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
    const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()
    const stateScope = resolveSpreadingStateScope(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const detail = stateScope.context.detail
    const form = getState(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
    const field = fieldNode.dataset.pdaCutSpreadingField
    if (!field) return true

    if (field === 'planUnitId') form.selectedPlanUnitId = fieldNode.value
    if (field === 'recordType' && fieldNode instanceof HTMLSelectElement) form.recordType = fieldNode.value as SpreadingRecordType
    if (field === 'cuttingTableId') form.cuttingTableId = fieldNode.value
    if (field === 'ownerAccountId') {
      const operator = detail ? resolveCurrentOperator(taskId, detail) : resolvePdaCuttingRuntimeOperator(taskId, '现场铺布员')
      form.ownerAccountId = fieldNode.value
      form.ownerName = resolveOwnerName(form.ownerAccountId, operator)
    }
    if (field === 'layerCount') {
      form.layerCount = fieldNode.value
      syncSingleOperatorLayerRange(form)
    }
    if (field === 'actualLength') form.actualLength = fieldNode.value
    if (field === 'headLength') form.headLength = fieldNode.value
    if (field === 'tailLength') form.tailLength = fieldNode.value
    if (field === 'handoverToAccountId') form.handoverToAccountId = fieldNode.value
    if (field === 'handoverNote') form.handoverNote = fieldNode.value
    if (field === 'actualCutQty') form.actualCutQty = fieldNode.value
    if (field === 'actualUsage') form.actualUsage = fieldNode.value
    if (field === 'cuttingOperator') form.cuttingOperator = fieldNode.value
    if (field === 'note') form.note = fieldNode.value

    if (!isHandoverRecord(form.recordType)) {
      form.handoverToAccountId = ''
      form.handoverNote = ''
    }

    if (shouldRerenderAfterFieldInput(fieldNode)) {
      syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
    } else {
      syncSpreadingLiveDom(taskId, form)
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-spreading-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pdaCutSpreadingAction
  const taskId = actionNode.dataset.taskId
  if (!action || !taskId) return false
  const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
  const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()
  const stateScope = resolveSpreadingStateScope(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)

  if (action === 'add-operator-layer' || action === 'remove-operator-layer') {
    const form = getState(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
    const detail = stateScope.context.detail
    const operator = detail ? resolveCurrentOperator(taskId, detail) : resolvePdaCuttingRuntimeOperator(taskId, '现场铺布员')
    if (action === 'add-operator-layer') {
      form.operatorLayerRows.push(buildDefaultOperatorLayerRow(operator))
    } else {
      const rowIndex = Number(actionNode.dataset.pdaCutSpreadingOperatorIndex || '-1')
      if (rowIndex >= 0 && form.operatorLayerRows.length > 1) {
        form.operatorLayerRows.splice(rowIndex, 1)
      }
    }
    syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
    return true
  }

  if (action === 'start-work') {
    const form = getState(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
    const context = stateScope.context
    const detail = context.detail
    const identity = resolvePdaCuttingRuntimeIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || undefined,
      executionOrderNo: context.selectedExecutionOrderNo || undefined,
    })
    if (!identity || !detail) {
      form.feedbackMessage = '同步失败：当前铺布单无法识别。'
      form.feedbackTone = 'warning'
      form.syncStatus = '同步失败'
      syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
      return true
    }
    const operator = resolveCurrentOperator(taskId, detail)
    const startedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const event = appendCuttingRuntimeEvent({
      eventType: '裁片单开工',
      eventSource: 'PDA',
      eventStatus: '已同步',
      occurredAt: startedAt,
      operatorId: operator.operatorAccountId,
      operatorName: operator.operatorName,
      operatorRole: operator.operatorRole || '裁床组长',
      refs: {
        productionOrderId: identity.productionOrderId,
        productionOrderNo: identity.productionOrderNo,
        cutOrderId: identity.cutOrderId,
        cutOrderNo: identity.cutOrderNo,
        markerPlanId: identity.markerPlanId,
        markerPlanNo: identity.markerPlanNo,
        spreadingOrderId: identity.executionOrderId,
        spreadingOrderNo: identity.executionOrderNo,
      },
      payload: {
        cutOrderId: identity.cutOrderId,
        cutOrderNo: identity.cutOrderNo,
        startedAt,
        startedBy: operator.operatorName,
        startSource: 'PDA',
      },
    })
    form.feedbackMessage = `开工已提交，${event.occurredAt}`
    form.feedbackTone = 'success'
    form.syncStatus = '已同步'
    const feedback = document.querySelector<HTMLElement>('[data-pda-cutting-spreading-stage-feedback]')
    if (feedback) {
      feedback.classList.remove('hidden')
      feedback.textContent = `已同步：开工已提交，${event.occurredAt}`
    }
    syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
    return true
  }

  if (action === 'reuse-last-layer-count') {
    const form = getState(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
    if (!form.lastSubmittedSnapshot) return true
    form.layerCount = form.lastSubmittedSnapshot.layerCount
    form.feedbackMessage = '已沿用上次层数。'
    form.feedbackTone = 'default'
    syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
    return true
  }

  if (action === 'reuse-last-head-tail') {
    const form = getState(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
    if (!form.lastSubmittedSnapshot) return true
    form.headLength = form.lastSubmittedSnapshot.headLength
    form.tailLength = form.lastSubmittedSnapshot.tailLength
    form.feedbackMessage = '已沿用上次头尾。'
    form.feedbackTone = 'default'
    syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
    return true
  }

  if (
    action === 'submit'
    || action === 'start-spreading'
    || action === 'submit-roll'
    || action === 'finish-spreading'
    || action === 'start-cutting'
    || action === 'finish-cutting'
  ) {
    const form = getState(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
    const context = stateScope.context
    const detail = context.detail
    if (!detail) {
      form.feedbackMessage = '当前任务无法识别，不能提交。'
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
      return true
    }

    if (detail.cuttingReportMode === 'CONTINUOUS_TASK_CUTTING_COMPLETION') {
      const submittedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const totalCutPieceQty = detail.cutCompletionPartRows.reduce((sum, row) => sum + row.cutPieceQty, 0)
      const totalGarmentAvailableQty = detail.cutCompletionPartRows.reduce((sum, row) => sum + row.garmentAvailableQty, 0)
      form.feedbackMessage = `裁片完成上报已同步：${totalCutPieceQty.toLocaleString('zh-CN')} 片，可做成衣数 ${totalGarmentAvailableQty.toLocaleString('zh-CN')} 件，${submittedAt}`
      form.feedbackTone = 'success'
      form.syncStatus = '已同步'
      syncCutCompletionReportDom(taskId, form)
      return true
    }

    const identity = resolvePdaCuttingRuntimeIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || undefined,
      executionOrderNo: context.selectedExecutionOrderNo || undefined,
      cutOrderId: context.selectedExecutionOrder?.cutOrderId || undefined,
      cutOrderNo: context.selectedExecutionOrder?.cutOrderNo || undefined,
      markerPlanId: context.selectedExecutionOrder?.markerPlanId || undefined,
      markerPlanNo: context.selectedExecutionOrder?.markerPlanNo || undefined,
      materialSku: context.selectedExecutionOrder?.materialSku || undefined,
    })
    if (!identity) {
      form.feedbackMessage = '当前铺布单无法识别，不能提交铺布记录。'
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
      return true
    }

    const selectedTarget = getSelectedTarget(detail, form.selectedTargetKey)
    if (!selectedTarget) {
      form.feedbackMessage = '请先选择当前铺布单。'
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
      return true
    }
    const actionLabel = getPrimaryActionLabel(detail)
    const operator = resolveCurrentOperator(taskId, detail)
    if (!form.ownerAccountId) form.ownerAccountId = operator.operatorAccountId || 'current-operator'
    form.ownerName = resolveOwnerName(form.ownerAccountId, operator)
    const selectedPlanUnit = getSelectedPlanUnit(selectedTarget, form.selectedPlanUnitId)
    if (!selectedPlanUnit) {
      form.feedbackMessage = '请先选择铺布明细。'
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
      return true
    }
    form.selectedPlanUnitId = selectedPlanUnit.planUnitId
    const submitStage = action === 'submit'
      ? actionNode.dataset.pdaCutSpreadingSubmitStage
        || (actionLabel === '开始铺布'
          ? 'start-spreading'
          : actionLabel === '完成铺布'
            ? 'submit-roll'
            : actionLabel === '开始裁剪'
              ? 'start-cutting'
              : actionLabel === '完成裁剪'
                ? 'finish-cutting'
                : 'submit')
      : action

    if ((submitStage === 'start-spreading' || submitStage === 'submit-roll') && !selectedTarget.materialReadiness.canStartSpreading) {
      form.feedbackMessage = selectedTarget.materialReadiness.reasonText
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
      return true
    }

    if (submitStage === 'start-spreading') {
      if (!form.cuttingTableId) {
        form.feedbackMessage = '开始铺布前必须选择裁床。'
        form.feedbackTone = 'warning'
        syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
        return true
      }
      const startedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const event = appendCuttingRuntimeEvent({
        eventType: '开始铺布',
        eventSource: 'PDA',
        eventStatus: '已同步',
        occurredAt: startedAt,
        operatorId: operator.operatorAccountId,
        operatorName: form.ownerName || operator.operatorName,
        operatorRole: operator.operatorRole || '铺布负责人',
        refs: {
          productionOrderId: context.selectedExecutionOrder?.productionOrderId || '',
          productionOrderNo: context.selectedExecutionOrder?.productionOrderNo || selectedTarget.productionOrderNo || '',
          cutOrderId: identity.cutOrderId,
          cutOrderNo: identity.cutOrderNo,
          markerPlanId: identity.markerPlanId,
          markerPlanNo: identity.markerPlanNo || selectedTarget.markerPlanNo,
          spreadingOrderId: selectedTarget.spreadingSessionId || identity.executionOrderId,
          spreadingOrderNo: selectedTarget.title || identity.executionOrderNo,
        },
        material: {
          materialSku: selectedPlanUnit.materialSku || selectedTarget.materialSku || identity.materialSku,
          materialName: selectedPlanUnit.materialAlias || selectedPlanUnit.materialSku || selectedTarget.materialAlias || identity.materialSku,
          materialColor: selectedPlanUnit.color || selectedTarget.colorSummary || '',
          materialAlias: selectedPlanUnit.materialAlias || selectedTarget.materialAlias || '',
          unit: '米',
        },
        payload: {
          stageOnly: true,
          spreadingOrderId: selectedTarget.spreadingSessionId || identity.executionOrderId,
          spreadingOrderNo: selectedTarget.title || identity.executionOrderNo,
          planUnitId: selectedPlanUnit.planUnitId,
          sourceLineId: selectedPlanUnit.sourceLineId,
          stepNo: selectedPlanUnit.stepNo,
          stepLabel: selectedPlanUnit.stepLabel,
          materialSku: selectedPlanUnit.materialSku,
          color: selectedPlanUnit.color,
          cuttingTableId: form.cuttingTableId,
          cuttingTableName: findCuttingTableById(form.cuttingTableId)?.cuttingTableName || '',
          ownerAccountId: form.ownerAccountId,
          ownerName: form.ownerName,
          startedAt,
          startedBy: form.ownerName || operator.operatorName,
          note: form.note.trim(),
        },
      })
      syncWebSpreadingStage({
        detail,
        target: selectedTarget,
        identity,
        eventId: event.eventId,
        occurredAt: startedAt,
        status: 'IN_PROGRESS',
        form,
        operator,
      })
      form.feedbackMessage = `开始铺布已提交，${event.occurredAt}`
      form.feedbackTone = 'success'
      form.syncStatus = '已同步'
      form.note = ''
      form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
        taskId,
        context.selectedExecutionOrderId,
        context.selectedExecutionOrderNo,
        context.navContext,
        'spreading',
      )
      syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
      return true
    }

    if (submitStage === 'start-cutting' || submitStage === 'finish-cutting') {
      const actualCutQty = Number(form.actualCutQty || '0') || 0
      const actualUsage = Number(form.actualUsage || '0') || 0
      const plannedCutQty = getPlannedCutQty(selectedTarget)
      if (submitStage === 'finish-cutting' && (actualCutQty <= 0 || actualUsage <= 0)) {
        form.feedbackMessage = '实际裁剪数量和实际用量必须大于 0。'
        form.feedbackTone = 'warning'
        syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
        return true
      }
      const submittedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const varianceFlag = submitStage === 'finish-cutting' && plannedCutQty > 0 && actualCutQty < plannedCutQty
      if (submitStage === 'finish-cutting') {
        if (!hasCuttingOutputBreakdown(selectedTarget)) {
          form.feedbackMessage = '当前铺布单缺少尺码或部位明细，不能生成实际裁剪产出。'
          form.feedbackTone = 'warning'
          syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
          return true
        }
        const cuttingCompletedAt = submittedAt
        const outputLines = buildCuttingActualOutputLines(selectedTarget, actualCutQty, cuttingCompletedAt)
        const event = appendCuttingRuntimeEvent({
          eventType: '完成裁剪',
          eventSource: 'PDA',
          eventStatus: '已同步',
          occurredAt: cuttingCompletedAt,
          operatorId: operator.operatorAccountId,
          operatorName: form.cuttingOperator.trim() || operator.operatorName,
          operatorRole: operator.operatorRole || '裁剪人员',
          refs: {
            productionOrderId: context.selectedExecutionOrder?.productionOrderId || '',
            productionOrderNo: context.selectedExecutionOrder?.productionOrderNo || selectedTarget.productionOrderNo || '',
            cutOrderId: identity.cutOrderId,
            cutOrderNo: identity.cutOrderNo,
            markerPlanId: identity.markerPlanId,
            markerPlanNo: identity.markerPlanNo || selectedTarget.markerPlanNo,
            spreadingOrderId: selectedTarget.spreadingSessionId || identity.executionOrderId,
            spreadingOrderNo: selectedTarget.title || identity.executionOrderNo,
          },
          material: {
            materialSku: selectedTarget.materialSku || identity.materialSku,
            materialName: selectedTarget.materialAlias || selectedTarget.materialSku || identity.materialSku,
            materialColor: selectedTarget.colorSummary || '',
            materialAlias: selectedTarget.materialAlias || '',
            unit: '米',
          },
          payload: {
            spreadingOrderId: selectedTarget.spreadingSessionId || identity.executionOrderId,
            spreadingOrderNo: selectedTarget.title || identity.executionOrderNo,
            cuttingCompletedAt,
            cuttingCompletedBy: form.cuttingOperator.trim() || operator.operatorName,
            actualMaterialUsage: actualUsage,
            actualMaterialUsageUnit: '米',
            outputLines,
            hasDifference: plannedCutQty > 0 && actualCutQty < plannedCutQty,
            differenceTypes: plannedCutQty > 0 && actualCutQty < plannedCutQty ? ['实裁小于计划'] : [],
          },
        })
        syncWebSpreadingStage({
          detail,
          target: selectedTarget,
          identity,
          eventId: event.eventId,
          occurredAt: cuttingCompletedAt,
          cuttingStatus: 'CUTTING_DONE',
          actualCutQty,
          actualUsage,
          form,
          operator,
        })
      } else {
        const event = appendCuttingRuntimeEvent({
          eventType: '开始裁剪',
          eventSource: 'PDA',
          eventStatus: '已同步',
          occurredAt: submittedAt,
          operatorId: operator.operatorAccountId,
          operatorName: form.cuttingOperator.trim() || operator.operatorName,
          operatorRole: operator.operatorRole || '裁剪人员',
          refs: {
            productionOrderId: context.selectedExecutionOrder?.productionOrderId || '',
            productionOrderNo: context.selectedExecutionOrder?.productionOrderNo || selectedTarget.productionOrderNo || '',
            cutOrderId: identity.cutOrderId,
            cutOrderNo: identity.cutOrderNo,
            markerPlanId: identity.markerPlanId,
            markerPlanNo: identity.markerPlanNo || selectedTarget.markerPlanNo,
            spreadingOrderId: selectedTarget.spreadingSessionId || identity.executionOrderId,
            spreadingOrderNo: selectedTarget.title || identity.executionOrderNo,
          },
          material: {
            materialSku: selectedTarget.materialSku || identity.materialSku,
            materialName: selectedTarget.materialAlias || selectedTarget.materialSku || identity.materialSku,
            materialColor: selectedTarget.colorSummary || '',
            materialAlias: selectedTarget.materialAlias || '',
            unit: '米',
          },
          payload: {
            spreadingOrderId: selectedTarget.spreadingSessionId || identity.executionOrderId,
            spreadingOrderNo: selectedTarget.title || identity.executionOrderNo,
            startedAt: submittedAt,
            startedBy: form.cuttingOperator.trim() || operator.operatorName,
          },
        })
        syncWebSpreadingStage({
          detail,
          target: selectedTarget,
          identity,
          eventId: event.eventId,
          occurredAt: submittedAt,
          cuttingStatus: 'CUTTING',
          form,
          operator,
        })
      }
      form.actualCutQty = ''
      form.actualUsage = ''
      form.note = ''
      form.feedbackMessage = `${submitStage === 'finish-cutting' ? '完成裁剪' : '开始裁剪'}已提交，${varianceFlag ? '已标记差异，' : ''}${submittedAt}`
      form.feedbackTone = 'success'
      form.syncStatus = '已同步'
      form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
        taskId,
        context.selectedExecutionOrderId,
        context.selectedExecutionOrderNo,
        context.navContext,
        'spreading',
      )
      syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
      return true
    }

    if (submitStage === 'finish-spreading') {
      const webSession = findStoredSpreadingSessionForTarget(selectedTarget)
      const currentTargetRecords = detail.spreadingRecords.filter((record) =>
        !selectedTarget.spreadingSessionId
        || record.spreadingSessionId === selectedTarget.spreadingSessionId
        || record.spreadingSessionId === selectedTarget.title,
      )
      if (!currentTargetRecords.length && !webSession?.rolls.length) {
        form.feedbackMessage = '必须至少提交一卷记录后，才能完成铺布。'
        form.feedbackTone = 'warning'
        syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
        return true
      }
      const finishedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const event = appendCuttingRuntimeEvent({
        eventType: '完成铺布',
        eventSource: 'PDA',
        eventStatus: '已同步',
        occurredAt: finishedAt,
        operatorId: operator.operatorAccountId,
        operatorName: form.ownerName || operator.operatorName,
        operatorRole: operator.operatorRole || '铺布负责人',
        refs: {
          productionOrderId: context.selectedExecutionOrder?.productionOrderId || '',
          productionOrderNo: context.selectedExecutionOrder?.productionOrderNo || selectedTarget.productionOrderNo || '',
          cutOrderId: identity.cutOrderId,
          cutOrderNo: identity.cutOrderNo,
          markerPlanId: identity.markerPlanId,
          markerPlanNo: identity.markerPlanNo || selectedTarget.markerPlanNo,
          spreadingOrderId: selectedTarget.spreadingSessionId || identity.executionOrderId,
          spreadingOrderNo: selectedTarget.title || identity.executionOrderNo,
        },
        material: {
          materialSku: selectedPlanUnit.materialSku || selectedTarget.materialSku || identity.materialSku,
          materialName: selectedPlanUnit.materialAlias || selectedPlanUnit.materialSku || selectedTarget.materialAlias || identity.materialSku,
          materialColor: selectedPlanUnit.color || selectedTarget.colorSummary || '',
          materialAlias: selectedPlanUnit.materialAlias || selectedTarget.materialAlias || '',
          unit: '米',
        },
        payload: {
          stageOnly: true,
          spreadingOrderId: selectedTarget.spreadingSessionId || identity.executionOrderId,
          spreadingOrderNo: selectedTarget.title || identity.executionOrderNo,
          planUnitId: selectedPlanUnit.planUnitId,
          sourceLineId: selectedPlanUnit.sourceLineId,
          stepNo: selectedPlanUnit.stepNo,
          stepLabel: selectedPlanUnit.stepLabel,
          materialSku: selectedPlanUnit.materialSku,
          color: selectedPlanUnit.color,
          finishedAt,
          finishedBy: form.ownerName || operator.operatorName,
          note: form.note.trim(),
        },
      })
      syncWebSpreadingStage({
        detail,
        target: selectedTarget,
        identity,
        eventId: event.eventId,
        occurredAt: finishedAt,
        status: 'DONE',
        cuttingStatus: 'WAITING_CUTTING',
        form,
        operator,
      })
      form.note = ''
      form.feedbackMessage = `完成铺布已提交，${event.occurredAt}`
      form.feedbackTone = 'success'
      form.syncStatus = '已同步'
      form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
        taskId,
        context.selectedExecutionOrderId,
        context.selectedExecutionOrderNo,
        context.navContext,
        'spreading',
      )
      syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
      return true
    }

    const layerCount = Number(form.layerCount || '0') || 0
    const actualLength = Number(form.actualLength || '0') || 0
    const headLength = Number(form.headLength || '0') || 0
    const tailLength = Number(form.tailLength || '0') || 0
    if (layerCount <= 0 || actualLength <= 0) {
      form.feedbackMessage = '铺布层数和实际长度必须大于 0。'
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
      return true
    }
    const operatorLayerRows = normalizePdaOperatorLayerRows(form, operator, layerCount)
    const operatorLayerValidationMessage = getOperatorLayerValidationMessage(operatorLayerRows)
    if (operatorLayerValidationMessage) {
      form.feedbackMessage = operatorLayerValidationMessage
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
      return true
    }
    const operatorLayerText = formatRollOperatorLayerRows(operatorLayerRows)
    const operatorNames = Array.from(new Set(operatorLayerRows.map((row) => row.operatorName).filter(Boolean)))

    const snapshot: SpreadingReuseSnapshot = {
      layerCount: form.layerCount,
      headLength: form.headLength,
      tailLength: form.tailLength,
    }

    const fabricRollNo = resolveNextFabricRollNo(detail, selectedTarget)
    const recordType = actionLabel === '完成铺布' ? '完成铺布' : '开始铺布'
    const runtimeRecordType: SpreadingRecordType = recordType === '完成铺布' ? '开始铺布' : recordType
    const submittedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const varianceFlag = getPlannedLayerCount(selectedTarget) > 0 && layerCount < getPlannedLayerCount(selectedTarget)
    const runtimeEvent = appendCuttingRuntimeEvent({
      eventType: runtimeRecordType,
      eventSource: 'PDA',
      eventStatus: '已同步',
      occurredAt: submittedAt,
      operatorId: operator.operatorAccountId,
      operatorName: operator.operatorName,
      operatorRole: operator.operatorRole || '铺布人员',
      refs: {
        productionOrderId: context.selectedExecutionOrder?.productionOrderId || '',
        productionOrderNo: context.selectedExecutionOrder?.productionOrderNo || selectedTarget.productionOrderNo || '',
        cutOrderId: identity.cutOrderId,
        cutOrderNo: identity.cutOrderNo,
        markerPlanId: identity.markerPlanId,
        markerPlanNo: identity.markerPlanNo || selectedTarget.markerPlanNo,
        spreadingOrderId: selectedTarget.spreadingSessionId || identity.executionOrderId,
        spreadingOrderNo: selectedTarget.title || identity.executionOrderNo,
      },
      material: {
        materialSku: selectedTarget.materialSku || identity.materialSku,
        materialName: selectedTarget.materialAlias || selectedTarget.materialSku || identity.materialSku,
        materialColor: selectedTarget.colorSummary || '',
        materialAlias: selectedTarget.materialAlias || '',
        unit: '米',
      },
      payload: {
        spreadingOrderId: selectedTarget.spreadingSessionId || identity.executionOrderId,
        spreadingOrderNo: selectedTarget.title || identity.executionOrderNo,
        planUnitId: selectedPlanUnit.planUnitId,
        sourceLineId: selectedPlanUnit.sourceLineId,
        stepNo: selectedPlanUnit.stepNo,
        stepLabel: selectedPlanUnit.stepLabel,
        materialSku: selectedPlanUnit.materialSku,
        color: selectedPlanUnit.color,
        recordType: '提交本卷',
        fabricRollNo,
        actualLayerCount: layerCount,
        actualSpreadLength: actualLength,
        headLength,
        tailLength,
        operatorNames,
        operatorLayerRows,
        operatorLayerText,
        startedAt: submittedAt,
        startedBy: operator.operatorName,
        note: [form.note.trim(), selectedPlanUnit.stepLabel ? `阶梯：${selectedPlanUnit.stepLabel}` : '', `唛架编号：${selectedTarget.markerNo || selectedTarget.sourceMarkerLabel}`, `模式：${getSpreadingModeLabel(selectedTarget.spreadingMode)}`]
          .filter(Boolean)
          .join('；'),
      },
    })
    syncWebSpreadingRoll({
      detail,
      target: selectedTarget,
      identity,
      eventId: runtimeEvent.eventId,
      occurredAt: submittedAt,
      form,
      operator,
      planUnit: selectedPlanUnit,
      fabricRollNo,
      layerCount,
      actualLength,
      headLength,
      tailLength,
      operatorLayerRows,
      operatorLayerText,
      operatorNames,
    })

    form.lastSubmittedSnapshot = snapshot
    form.layerCount = ''
    form.actualLength = ''
    form.headLength = ''
    form.tailLength = ''
    form.handoverToAccountId = ''
    form.handoverNote = ''
    form.operatorLayerRows = []
    form.note = ''
    form.feedbackMessage = `本卷已提交，${varianceFlag ? '已标记差异，' : ''}${runtimeEvent.occurredAt}`
    form.feedbackTone = 'success'
    form.syncStatus = '已同步'
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      context.selectedExecutionOrderId,
      context.selectedExecutionOrderNo,
      context.navContext,
      'spreading',
    )
    syncSpreadingFormDom(taskId, stateScope.executionOrderId, stateScope.executionOrderNo)
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/spreading\/([^/]+)/)
  return matched?.[1] ?? ''
}
