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

type SpreadingRecordType = '开始铺布' | '中途交接' | '接手继续' | '完成铺布'
type FeedbackTone = 'default' | 'success' | 'warning'
type PdaCuttingSyncStatus = '已同步' | '待同步' | '同步失败'

interface SpreadingReuseSnapshot {
  layerCount: string
  headLength: string
  tailLength: string
}

interface SpreadingFormState {
  selectedTargetKey: string
  selectedPlanUnitId: string
  recordType: SpreadingRecordType
  fabricRollNo: string
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
  photoProofCount: string
  feedbackMessage: string
  feedbackTone: FeedbackTone
  syncStatus: PdaCuttingSyncStatus | ''
  backHrefOverride: string
  lastSubmittedSnapshot: SpreadingReuseSnapshot | null
}

const spreadingState = new Map<string, SpreadingFormState>()

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

function getState(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): SpreadingFormState {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo)
  const existing = spreadingState.get(stateKey)
  if (existing) return existing
  const detail = getSpreadingDetail(taskId, executionOrderId ?? executionOrderNo ?? undefined)
  const initial: SpreadingFormState = {
    selectedTargetKey: detail ? getDefaultTargetKey(detail) : '',
    selectedPlanUnitId: detail ? getDefaultPlanUnitId(getSelectedTarget(detail, getDefaultTargetKey(detail))) : '',
    recordType: '开始铺布',
    fabricRollNo: '',
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
    photoProofCount: '',
    feedbackMessage: '',
    feedbackTone: 'default',
    syncStatus: '',
    backHrefOverride: '',
    lastSubmittedSnapshot: null,
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

function getTargetEntryLabel(target: PdaCuttingSpreadingTarget | null): string {
  if (!target) return '待选择铺布单'
  if (target.targetType === 'session') return '继续当前铺布'
  return '待分配铺布单'
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
                <div>长度：${escapeHtml(String(item.actualLength))} 米</div>
                <div>录入人：${escapeHtml(item.enteredBy || '现场铺布员')}</div>
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

function renderLatestSummary(detail: NonNullable<ReturnType<typeof getSpreadingDetail>>): string {
  const latestRecord = [...detail.spreadingRecords].sort((left, right) => right.enteredAt.localeCompare(left.enteredAt))[0] || null
  return `
    <section class="rounded-xl border bg-card px-1.5 py-1" data-testid="pda-cutting-spreading-latest-summary">
      <div class="grid gap-1 text-xs sm:grid-cols-2">
        <div><div class="text-muted-foreground">当前状态</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(detail.currentExecutionStatus)}</div></div>
        <div><div class="text-muted-foreground">最近卷号</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(latestRecord?.fabricRollNo || '暂无记录')}</div></div>
        <div><div class="text-muted-foreground">最近时间</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(detail.latestSpreadingAt)}</div><div class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(detail.latestSpreadingBy)}</div></div>
        <div><div class="text-muted-foreground">当前步骤</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(detail.nextRecommendedAction)}</div></div>
      </div>
    </section>
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

function renderFormInner(
  taskId: string,
  detail: PdaCuttingTaskDetailData,
  form: SpreadingFormState,
): string {
  const selectedTarget = getSelectedTarget(detail, form.selectedTargetKey)
  const selectedPlanUnit = getSelectedPlanUnit(selectedTarget, form.selectedPlanUnitId)
  const currentOperator = resolveCurrentOperator(taskId, detail)
  const actionLabel = getPrimaryActionLabel(detail)
  const plannedLayerCount = getPlannedLayerCount(selectedTarget)
  const plannedCutQty = getPlannedCutQty(selectedTarget)
  const syncStatusLine = form.syncStatus
    ? `${form.syncStatus}：${form.feedbackMessage || '已提交'}`
    : detail.latestSyncSummary

  return `
    <div class="space-y-1.5 pb-1 text-xs">
      ${renderFeedbackBlock(form)}
      <section class="rounded-xl border bg-card px-1.5 py-1" data-testid="pda-cutting-spreading-object-summary">
        <div class="grid gap-1 text-xs sm:grid-cols-2">
          <div><div class="text-muted-foreground">铺布单</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(selectedTarget?.title || detail.taskNo)}</div></div>
          <div><div class="text-muted-foreground">唛架编号</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(selectedTarget?.markerNo || selectedTarget?.sourceMarkerLabel || '—')}</div></div>
          <div><div class="text-muted-foreground">执行对象</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(detail.executionOrderNo)}</div></div>
          <div><div class="text-muted-foreground">裁片单</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(detail.cutOrderNo)}</div></div>
          <div class="sm:col-span-2">
            <div class="mb-1 text-muted-foreground">面料信息</div>
            ${renderMaterialIdentityBlock(
              {
                materialSku: selectedTarget?.materialSku || detail.materialSku,
                materialLabel: detail.materialTypeLabel,
                materialAlias: selectedTarget?.materialAlias || detail.materialAlias,
                materialImageUrl: selectedTarget?.materialImageUrl || detail.materialImageUrl,
              },
              { compact: true, showCategory: false },
            )}
          </div>
        </div>
      </section>
      <section class="rounded-xl border bg-card px-1.5 py-1" data-testid="pda-cutting-spreading-form-card">
        <div class="space-y-1.5">
          <div class="rounded-xl bg-muted/30 px-2 py-1.5">
            <div class="text-muted-foreground">当前要做</div>
            <div class="mt-0.5 text-base font-semibold text-foreground">${escapeHtml(actionLabel)}</div>
            <div class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(syncStatusLine)}</div>
          </div>
          <label class="block space-y-0.5">
            <span class="text-muted-foreground">铺布单 / 唛架编号</span>
            <select class="h-6 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-field="selectedTargetKey">
              ${getVisibleTargets(detail)
                .map(
                  (target) => `
                    <option value="${escapeHtml(target.targetKey)}" ${form.selectedTargetKey === target.targetKey ? 'selected' : ''}>
                      ${escapeHtml(getTargetEntryLabel(target))} / ${escapeHtml(target.sourceMarkerLabel || target.title)}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </label>
          ${renderTargetSummary(selectedTarget)}
          <div class="border-t pt-1" data-testid="pda-cutting-spreading-plan-summary">
            <div class="grid grid-cols-2 gap-1.5">
              <div><div class="text-muted-foreground">计划层数</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(`${plannedLayerCount || '-'} 层`)}</div></div>
              <div><div class="text-muted-foreground">计划数量</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(`${plannedCutQty || '-'} 件`)}</div></div>
            </div>
          </div>
          ${
            isSpreadingAction(actionLabel)
              ? `
          <div class="border-t pt-1" data-testid="pda-cutting-spreading-inputs">
            <div class="grid grid-cols-2 gap-1.5">
              <label class="col-span-2 block space-y-0.5">
                <span class="text-muted-foreground">布卷号</span>
                <input class="h-6 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-field="fabricRollNo" value="${escapeHtml(form.fabricRollNo)}" />
              </label>
              <label class="block space-y-0.5">
                <span class="text-muted-foreground">${selectedPlanUnit?.stepLabel ? `${selectedPlanUnit.stepLabel}实铺层数` : '实铺层数'}</span>
                <input type="number" min="0" step="1" class="h-6 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-field="layerCount" value="${escapeHtml(form.layerCount)}" />
              </label>
              <label class="block space-y-0.5">
                <span class="text-muted-foreground">实际铺布长度（m）</span>
                <input type="number" min="0" step="0.01" class="h-6 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-field="actualLength" value="${escapeHtml(form.actualLength)}" />
              </label>
              <label class="block space-y-0.5">
                <span class="text-muted-foreground">布头长度（m）</span>
                <input type="number" min="0" step="0.01" class="h-6 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-field="headLength" value="${escapeHtml(form.headLength)}" />
              </label>
              <label class="block space-y-0.5">
                <span class="text-muted-foreground">布尾长度（m）</span>
                <input type="number" min="0" step="0.01" class="h-6 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-field="tailLength" value="${escapeHtml(form.tailLength)}" />
              </label>
              <label class="col-span-2 block space-y-0.5">
                <span class="text-muted-foreground">现场照片</span>
                <input type="number" min="0" step="1" class="h-6 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-field="photoProofCount" value="${escapeHtml(form.photoProofCount)}" placeholder="照片张数" />
              </label>
            </div>
          </div>
              `
              : ''
          }
          ${
            isCuttingAction(actionLabel)
              ? `
          <div class="border-t pt-1" data-testid="pda-cutting-cutting-inputs">
            <div class="grid grid-cols-2 gap-1.5">
            <label class="block space-y-0.5">
                <span class="text-muted-foreground">实际裁剪数量</span>
                <input type="number" min="0" step="1" class="h-6 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-field="actualCutQty" value="${escapeHtml(form.actualCutQty)}" />
            </label>
              <label class="block space-y-0.5">
                <span class="text-muted-foreground">实际用量</span>
                <input type="number" min="0" step="0.01" class="h-6 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-field="actualUsage" value="${escapeHtml(form.actualUsage)}" />
              </label>
              <label class="block space-y-0.5">
                <span class="text-muted-foreground">裁剪人员</span>
                <input class="h-6 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-field="cuttingOperator" value="${escapeHtml(form.cuttingOperator || currentOperator.operatorName)}" />
              </label>
              <label class="block space-y-0.5">
                <span class="text-muted-foreground">现场照片</span>
                <input type="number" min="0" step="1" class="h-6 w-full rounded-xl border bg-background px-2 text-sm" data-pda-cut-spreading-field="photoProofCount" value="${escapeHtml(form.photoProofCount)}" placeholder="照片张数" />
              </label>
            </div>
          </div>
              `
              : ''
          }
          <label class="block space-y-0.5">
            <span class="text-muted-foreground">备注</span>
            <textarea class="min-h-12 w-full rounded-xl border bg-background px-2 py-1 text-sm" data-pda-cut-spreading-field="note">${escapeHtml(form.note)}</textarea>
          </label>
          <div class="grid gap-1.5 text-xs sm:grid-cols-3">
            <div><div class="text-muted-foreground">录入人</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(currentOperator.operatorName)}</div></div>
            <div><div class="text-muted-foreground">当前工厂</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(detail.assigneeFactoryName)}</div></div>
            <div><div class="text-muted-foreground">发生时间</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(new Date().toISOString().replace('T', ' ').slice(0, 19))}</div></div>
          </div>
        </div>
      </section>
    </div>
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
  const submitClassName = disabledByMaterial
    ? 'inline-flex min-h-6 items-center justify-center rounded-xl bg-muted px-2 py-1 text-xs font-medium text-muted-foreground opacity-70'
    : 'inline-flex min-h-6 items-center justify-center rounded-xl bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90'
  return `
    <div class="sticky bottom-0 z-10 rounded-xl border bg-background/95 px-1.5 py-1 backdrop-blur" data-testid="pda-cutting-spreading-submit-bar" data-pda-cut-spreading-submit-shell="${escapeHtml(taskId)}">
      <div class="grid grid-cols-[0.9fr_1.1fr] gap-1">
        <button class="inline-flex min-h-6 items-center justify-center rounded-xl border px-2 py-1 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}" data-pda-cut-spreading-back="true">
          返回
        </button>
        <button class="${submitClassName}" data-pda-cut-spreading-action="submit" data-task-id="${escapeHtml(taskId)}" ${disabledByMaterial ? 'disabled aria-disabled="true"' : ''}>
          ${escapeHtml(actionLabel)}
        </button>
      </div>
      ${disabledByMaterial ? `<div class="mt-1 text-center text-[11px] text-muted-foreground">${escapeHtml(selectedTarget?.materialReadiness.reasonText || '')}</div>` : ''}
    </div>
  `
}

function syncSpreadingFormDom(taskId: string, executionOrderId?: string | null, executionOrderNo?: string | null): void {
  if (typeof document === 'undefined') return
  const root = document.querySelector<HTMLElement>(`[data-pda-cut-spreading-root="${taskId}"]`)
  if (!root) return
  const context = buildPdaCuttingExecutionContext(taskId, 'spreading')
  if (!context.detail) return
  const form = getState(taskId, executionOrderId, executionOrderNo)
  const pageBackHref = form.backHrefOverride || context.backHref
  root.innerHTML = renderFormInner(taskId, context.detail, form)
  const actionLabel = getPrimaryActionLabel(context.detail)
  const selectedTarget = getSelectedTarget(context.detail, form.selectedTargetKey)
  const submitShell = document.querySelector<HTMLElement>(`[data-pda-cut-spreading-submit-shell="${taskId}"]`)
  if (submitShell) {
    submitShell.outerHTML = renderSubmitBar(taskId, form, pageBackHref, actionLabel, selectedTarget)
  }
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
  const selectedTargetForSubmit = getSelectedTarget(detail, form.selectedTargetKey)

  if (actionLabel === '去领料' || actionLabel === '开工') {
    const isPickup = actionLabel === '去领料'
    const body = `
      <section class="space-y-2">
        ${renderLatestSummary(detail)}
        <section class="rounded-xl border bg-card px-3 py-3 text-sm">
          <div class="text-xs text-muted-foreground">当前要做</div>
          <div class="mt-1 text-lg font-semibold text-foreground">${escapeHtml(actionLabel)}</div>
          <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(isPickup ? '没有领料记录，不能开工、铺布或裁剪。' : '已有领料记录，开工后才能进入铺布。')}</div>
          <button class="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" ${isPickup ? `data-nav="${escapeHtml(`/fcs/pda/handover?tab=pickup&focusTaskId=${encodeURIComponent(taskId)}&returnTo=${encodeURIComponent(pageBackHref)}`)}"` : `data-pda-cut-spreading-action="start-work" data-task-id="${escapeHtml(taskId)}"`}>
            ${escapeHtml(actionLabel)}
          </button>
          <div class="mt-2 hidden rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800" data-pda-cutting-spreading-stage-feedback></div>
        </section>
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
        ${renderLatestSummary(detail)}
        <section class="rounded-xl border bg-card px-3 py-3 text-sm">
          <div class="text-xs text-muted-foreground">当前要做</div>
          <div class="mt-1 text-lg font-semibold text-foreground">查看提交结果</div>
          <div class="mt-2 rounded-xl bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">${escapeHtml(detail.latestSyncSummary)}</div>
          <button class="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" data-nav="${escapeHtml(pageBackHref)}">返回裁片任务</button>
        </section>
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
      ${renderLatestSummary(detail)}
      ${renderSubmitBar(taskId, form, pageBackHref, actionLabel, selectedTargetForSubmit)}
      <div data-task-id="${escapeHtml(taskId)}" data-pda-cut-spreading-root="${escapeHtml(taskId)}">${renderFormInner(taskId, detail, form)}</div>
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
    const detail = getSpreadingDetail(taskId, selectedExecutionOrderId ?? selectedExecutionOrderNo ?? undefined)
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const field = fieldNode.dataset.pdaCutSpreadingField
    if (!field) return true

    if (field === 'selectedTargetKey') {
      form.selectedTargetKey = fieldNode.value
      const nextTarget = detail ? getSelectedTarget(detail, form.selectedTargetKey) : null
      const nextPlanUnit = getSelectedPlanUnit(nextTarget, form.selectedPlanUnitId)
      form.selectedPlanUnitId = nextPlanUnit?.planUnitId || getDefaultPlanUnitId(nextTarget)
    }
    if (field === 'planUnitId') form.selectedPlanUnitId = fieldNode.value
    if (field === 'recordType' && fieldNode instanceof HTMLSelectElement) form.recordType = fieldNode.value as SpreadingRecordType
    if (field === 'fabricRollNo') form.fabricRollNo = fieldNode.value
    if (field === 'layerCount') form.layerCount = fieldNode.value
    if (field === 'actualLength') form.actualLength = fieldNode.value
    if (field === 'headLength') form.headLength = fieldNode.value
    if (field === 'tailLength') form.tailLength = fieldNode.value
    if (field === 'handoverToAccountId') form.handoverToAccountId = fieldNode.value
    if (field === 'handoverNote') form.handoverNote = fieldNode.value
    if (field === 'actualCutQty') form.actualCutQty = fieldNode.value
    if (field === 'actualUsage') form.actualUsage = fieldNode.value
    if (field === 'cuttingOperator') form.cuttingOperator = fieldNode.value
    if (field === 'photoProofCount') form.photoProofCount = fieldNode.value
    if (field === 'note') form.note = fieldNode.value

    if (!isHandoverRecord(form.recordType)) {
      form.handoverToAccountId = ''
      form.handoverNote = ''
    }

    syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-cut-spreading-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pdaCutSpreadingAction
  const taskId = actionNode.dataset.taskId
  if (!action || !taskId) return false
  const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation()
  const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation()

  if (action === 'start-work') {
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const context = buildPdaCuttingExecutionContext(taskId, 'spreading')
    const detail = context.detail
    const identity = resolvePdaCuttingRuntimeIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || undefined,
      executionOrderNo: context.selectedExecutionOrderNo || undefined,
    })
    if (!identity || !detail) {
      form.feedbackMessage = '同步失败：当前执行对象无法识别。'
      form.feedbackTone = 'warning'
      form.syncStatus = '同步失败'
      syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
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
    syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    return true
  }

  if (action === 'reuse-last-layer-count') {
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    if (!form.lastSubmittedSnapshot) return true
    form.layerCount = form.lastSubmittedSnapshot.layerCount
    form.feedbackMessage = '已沿用上次层数。'
    form.feedbackTone = 'default'
    syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    return true
  }

  if (action === 'reuse-last-head-tail') {
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    if (!form.lastSubmittedSnapshot) return true
    form.headLength = form.lastSubmittedSnapshot.headLength
    form.tailLength = form.lastSubmittedSnapshot.tailLength
    form.feedbackMessage = '已沿用上次头尾。'
    form.feedbackTone = 'default'
    syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    return true
  }

  if (action === 'submit') {
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    const context = buildPdaCuttingExecutionContext(taskId, 'spreading')
    const detail = context.detail
    const identity = resolvePdaCuttingRuntimeIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || undefined,
      executionOrderNo: context.selectedExecutionOrderNo || undefined,
      cutOrderId: context.selectedExecutionOrder?.cutOrderId || undefined,
      cutOrderNo: context.selectedExecutionOrder?.cutOrderNo || undefined,
      markerPlanId: context.selectedExecutionOrder?.markerPlanId || undefined,
      markerPlanNo: context.selectedExecutionOrder?.markerPlanNo || undefined,
      materialSku: context.selectedExecutionOrder?.materialSku || undefined,
    })
    if (!identity || !detail) {
      form.feedbackMessage = '当前执行对象无法识别，不能提交铺布记录。'
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
      return true
    }

    const selectedTarget = getSelectedTarget(detail, form.selectedTargetKey)
    if (!selectedTarget) {
      form.feedbackMessage = '请先选择当前铺布单。'
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
      return true
    }
    const actionLabel = getPrimaryActionLabel(detail)
    const operator = resolveCurrentOperator(taskId, detail)

    if (actionLabel === '开始铺布' && !selectedTarget.materialReadiness.canStartSpreading) {
      form.feedbackMessage = selectedTarget.materialReadiness.reasonText
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
      return true
    }

    if (isCuttingAction(actionLabel)) {
      const actualCutQty = Number(form.actualCutQty || '0') || 0
      const actualUsage = Number(form.actualUsage || '0') || 0
      const plannedCutQty = getPlannedCutQty(selectedTarget)
      if (actionLabel === '完成裁剪' && (actualCutQty <= 0 || actualUsage <= 0)) {
        form.feedbackMessage = '实际裁剪数量和实际用量必须大于 0。'
        form.feedbackTone = 'warning'
        syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
        return true
      }
      const submittedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const varianceFlag = actionLabel === '完成裁剪' && plannedCutQty > 0 && actualCutQty < plannedCutQty
      if (actionLabel === '完成裁剪') {
        if (!hasCuttingOutputBreakdown(selectedTarget)) {
          form.feedbackMessage = '当前铺布单缺少尺码或部位明细，不能生成实际裁剪产出。'
          form.feedbackTone = 'warning'
          syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
          return true
        }
        const cuttingCompletedAt = submittedAt
        const outputLines = buildCuttingActualOutputLines(selectedTarget, actualCutQty, cuttingCompletedAt)
        appendCuttingRuntimeEvent({
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
      } else {
        appendCuttingRuntimeEvent({
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
      }
      form.actualCutQty = ''
      form.actualUsage = ''
      form.photoProofCount = ''
      form.note = ''
      form.feedbackMessage = `${actionLabel}已提交，${varianceFlag ? '已标记差异，' : ''}${submittedAt}`
      form.feedbackTone = 'success'
      form.syncStatus = '已同步'
      form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
        taskId,
        context.selectedExecutionOrderId,
        context.selectedExecutionOrderNo,
        context.navContext,
        'spreading',
      )
      syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
      return true
    }

    const selectedPlanUnit = getSelectedPlanUnit(selectedTarget, form.selectedPlanUnitId)
    if (!selectedPlanUnit) {
      form.feedbackMessage = '请先选择铺布明细。'
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
      return true
    }
    form.selectedPlanUnitId = selectedPlanUnit.planUnitId

    const layerCount = Number(form.layerCount || '0') || 0
    const actualLength = Number(form.actualLength || '0') || 0
    const headLength = Number(form.headLength || '0') || 0
    const tailLength = Number(form.tailLength || '0') || 0
    if (!form.fabricRollNo.trim()) {
      form.feedbackMessage = '请先录入卷号。'
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
      return true
    }
    if (layerCount <= 0 || actualLength <= 0) {
      form.feedbackMessage = '铺布层数和实际长度必须大于 0。'
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
      return true
    }

    const snapshot: SpreadingReuseSnapshot = {
      layerCount: form.layerCount,
      headLength: form.headLength,
      tailLength: form.tailLength,
    }

    const fabricRollNo = form.fabricRollNo.trim()
    const recordType = actionLabel === '完成铺布' ? '完成铺布' : '开始铺布'
    const submittedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const varianceFlag = getPlannedLayerCount(selectedTarget) > 0 && layerCount < getPlannedLayerCount(selectedTarget)
    const runtimeEvent = appendCuttingRuntimeEvent({
      eventType: recordType === '完成铺布' ? '完成铺布' : '开始铺布',
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
      payload: recordType === '完成铺布'
        ? {
            spreadingOrderId: selectedTarget.spreadingSessionId || identity.executionOrderId,
            spreadingOrderNo: selectedTarget.title || identity.executionOrderNo,
            planUnitId: selectedPlanUnit.planUnitId,
            sourceLineId: selectedPlanUnit.sourceLineId,
            stepNo: selectedPlanUnit.stepNo,
            stepLabel: selectedPlanUnit.stepLabel,
            materialSku: selectedPlanUnit.materialSku,
            color: selectedPlanUnit.color,
            actualLayerCount: layerCount,
            actualSpreadLength: actualLength,
            actualMaterialUsage: getGrossOccupiedLength(form),
            headLength,
            tailLength,
            unit: '米',
            rollNos: [fabricRollNo],
            operatorNames: [operator.operatorName],
            finishedAt: submittedAt,
          }
        : {
            spreadingOrderId: selectedTarget.spreadingSessionId || identity.executionOrderId,
            spreadingOrderNo: selectedTarget.title || identity.executionOrderNo,
            planUnitId: selectedPlanUnit.planUnitId,
            sourceLineId: selectedPlanUnit.sourceLineId,
            stepNo: selectedPlanUnit.stepNo,
            stepLabel: selectedPlanUnit.stepLabel,
            materialSku: selectedPlanUnit.materialSku,
            color: selectedPlanUnit.color,
            fabricRollNo,
            actualLayerCount: layerCount,
            actualSpreadLength: actualLength,
            headLength,
            tailLength,
            startedAt: submittedAt,
            startedBy: operator.operatorName,
            note: [form.note.trim(), selectedPlanUnit.stepLabel ? `阶梯：${selectedPlanUnit.stepLabel}` : '', `唛架编号：${selectedTarget.markerNo || selectedTarget.sourceMarkerLabel}`, `模式：${getSpreadingModeLabel(selectedTarget.spreadingMode)}`]
              .filter(Boolean)
              .join('；'),
          },
    })

    form.lastSubmittedSnapshot = snapshot
    form.fabricRollNo = ''
    form.layerCount = ''
    form.actualLength = ''
    form.headLength = ''
    form.tailLength = ''
    form.handoverToAccountId = ''
    form.handoverNote = ''
    form.note = ''
    form.photoProofCount = ''
    form.feedbackMessage = `${recordType}已提交，${varianceFlag ? '已标记差异，' : ''}${runtimeEvent.occurredAt}`
    form.feedbackTone = 'success'
    form.syncStatus = '已同步'
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      context.selectedExecutionOrderId,
      context.selectedExecutionOrderNo,
      context.navContext,
      'spreading',
    )
    syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
    return true
  }

  return false
}

function appTaskIdFromPath(): string {
  if (typeof window === 'undefined') return ''
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/spreading\/([^/]+)/)
  return matched?.[1] ?? ''
}
