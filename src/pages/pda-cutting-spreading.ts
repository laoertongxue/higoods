import { escapeHtml } from '../utils'
import type {
  PdaCuttingSpreadingTarget,
  PdaCuttingTaskDetailData,
} from '../data/fcs/pda-cutting-execution-source.ts'
import { buildPdaCuttingSpreadingProjection } from './pda-cutting-spreading-projection'
import {
  buildPdaCuttingWritebackSource,
  resolvePdaCuttingWritebackIdentity,
  resolvePdaCuttingWritebackOperator,
  type CuttingPdaWritebackOperatorInput,
} from '../data/fcs/pda-cutting-writeback-inputs.ts'
import { writePdaSpreadingToFcs } from '../domain/cutting-pda-writeback/bridge.ts'
import {
  defaultFactoryRoles,
  getPdaSession,
  initialFactoryPdaUsers,
  initialFactoryUsers,
  pdaRoleTemplates,
} from '../data/fcs/store-domain-pda.ts'
import {
  buildPdaCuttingExecutionStateKey,
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
import { buildPdaCuttingCompletedReturnHref } from './pda-cutting-nav-context'

type SpreadingRecordType = '开始铺布' | '中途交接' | '接手继续' | '完成铺布'
type FeedbackTone = 'default' | 'success' | 'warning'

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
  feedbackMessage: string
  feedbackTone: FeedbackTone
  backHrefOverride: string
  lastSubmittedSnapshot: SpreadingReuseSnapshot | null
}

const spreadingState = new Map<string, SpreadingFormState>()

function getSpreadingDetail(taskId: string, executionKey?: string | null) {
  return buildPdaCuttingSpreadingProjection(taskId, executionKey ?? undefined)
}

function canUseManualSpreadingEntry(): boolean {
  const session = getPdaSession()
  if (!session.userId) return false
  const pdaUser = initialFactoryPdaUsers.find((item) => item.userId === session.userId)
  if (pdaUser) return pdaUser.roleId === 'ROLE_ADMIN' || pdaUser.roleId === 'ROLE_DISPATCH'
  const factoryUser = initialFactoryUsers.find((item) => item.userId === session.userId)
  if (!factoryUser) return false
  return factoryUser.roleIds.includes('ROLE_ADMIN') || factoryUser.roleIds.includes('ROLE_DISPATCH')
}

function getVisibleTargets(detail: PdaCuttingTaskDetailData): PdaCuttingSpreadingTarget[] {
  const allowManualEntry = canUseManualSpreadingEntry()
  return detail.spreadingTargets.filter((target) => {
    if (target.targetType === 'session' || target.targetType === 'marker') return true
    if (target.targetType === 'manual-entry') return allowManualEntry
    return false
  })
}

function getSelectedTarget(detail: PdaCuttingTaskDetailData, selectedTargetKey: string): PdaCuttingSpreadingTarget | null {
  const visibleTargets = getVisibleTargets(detail)
  if (!visibleTargets.length) return null
  return visibleTargets.find((item) => item.targetKey === selectedTargetKey) || visibleTargets[0] || null
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
    feedbackMessage: '',
    feedbackTone: 'default',
    backHrefOverride: '',
    lastSubmittedSnapshot: null,
  }
  spreadingState.set(stateKey, initial)
  return initial
}

function getSpreadingModeLabel(mode: 'NORMAL' | 'HIGH_LOW' | 'FOLD_NORMAL' | 'FOLD_HIGH_LOW'): string {
  if (mode === 'HIGH_LOW') return '高低层模式'
  if (mode === 'FOLD_HIGH_LOW') return '对折-高低层模式'
  if (mode === 'FOLD_NORMAL') return '对折-普通模式'
  return '普通模式'
}

function isHandoverRecord(recordType: SpreadingRecordType): boolean {
  return recordType === '中途交接' || recordType === '接手继续'
}

function getGrossOccupiedLength(form: SpreadingFormState): number {
  const actual = Number(form.actualLength || '0')
  const head = Number(form.headLength || '0')
  const tail = Number(form.tailLength || '0')
  return Number((actual + head + tail).toFixed(2))
}

function getUsableLength(form: SpreadingFormState): number {
  const actual = Number(form.actualLength || '0')
  const head = Number(form.headLength || '0')
  const tail = Number(form.tailLength || '0')
  return Number(Math.max(actual - head - tail, 0).toFixed(2))
}

function getSelectedPlanUnit(target: PdaCuttingSpreadingTarget | null, planUnitId: string) {
  if (!target?.planUnits?.length) return null
  return target.planUnits.find((item) => item.planUnitId === planUnitId) || target.planUnits[0] || null
}

function getTargetEntryLabel(target: PdaCuttingSpreadingTarget | null): string {
  if (!target) return '待选择铺布对象'
  if (target.targetType === 'session') return '继续当前铺布'
  if (target.targetType === 'marker') return '按唛架开始铺布'
  return '异常补录铺布'
}

function getActualCutGarmentQty(form: SpreadingFormState, selectedPlanUnit: ReturnType<typeof getSelectedPlanUnit>): number {
  const layerCount = Number(form.layerCount || '0')
  const garmentQtyPerUnit = Number(selectedPlanUnit?.garmentQtyPerUnit || 0)
  return Number((layerCount * garmentQtyPerUnit).toFixed(0))
}

function formatLength(value: number): string {
  return `${Number(value || 0).toFixed(2)} 米`
}

function renderFormulaBlock(value: string, formula: string): string {
  return `
    <div class="rounded-xl border bg-muted/20 px-3 py-3">
      <div class="text-sm font-semibold text-foreground">${escapeHtml(value)}</div>
      <div class="mt-1 font-mono text-[11px] text-muted-foreground">${escapeHtml(formula)}</div>
    </div>
  `
}

function renderFeedbackBlock(form: SpreadingFormState): string {
  if (!form.feedbackMessage) return ''
  return renderPdaCuttingFeedbackNotice(form.feedbackMessage, form.feedbackTone)
}

function resolveRoleName(roleId: string): string {
  return pdaRoleTemplates.find((item) => item.roleId === roleId)?.roleName
    || defaultFactoryRoles.find((item) => item.roleId === roleId)?.roleName
    || roleId
}

function resolveCurrentOperator(taskId: string, detail: PdaCuttingTaskDetailData): CuttingPdaWritebackOperatorInput {
  const session = getPdaSession()
  if (session.userId) {
    const pdaUser = initialFactoryPdaUsers.find((item) => item.userId === session.userId)
    if (pdaUser) {
      return {
        operatorAccountId: pdaUser.userId,
        operatorName: pdaUser.name,
        operatorRole: resolveRoleName(pdaUser.roleId),
        operatorFactoryId: pdaUser.factoryId,
        operatorFactoryName: detail.assigneeFactoryName,
      }
    }

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

  return resolvePdaCuttingWritebackOperator(taskId, '现场铺布员')
}

function buildHandoverOptions(taskId: string, detail: PdaCuttingTaskDetailData): Array<{ accountId: string; name: string }> {
  const currentOperator = resolveCurrentOperator(taskId, detail)
  const factoryId = currentOperator.operatorFactoryId
  const pdaOptions = initialFactoryPdaUsers
    .filter((item) => item.factoryId === factoryId && item.userId !== currentOperator.operatorAccountId)
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
    <div class="space-y-3">
      <div class="rounded-xl bg-muted/30 px-3 py-3 text-xs">
        <div class="text-muted-foreground">最近记录汇总</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(totalLength.toFixed(2))} 米</div>
      </div>
      ${detail.spreadingRecords
        .map(
          (item) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-foreground">${escapeHtml(item.id)} / ${escapeHtml(item.fabricRollNo)}</div>
                <div class="text-muted-foreground">${escapeHtml(item.enteredAt)}</div>
              </div>
              <div class="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
                <div>铺布层数：${escapeHtml(String(item.layerCount))} 层</div>
                <div>实际长度：${escapeHtml(String(item.actualLength))} 米</div>
                <div>整卷占用长度：${escapeHtml(String(item.calculatedLength))} 米</div>
                <div>净可用长度：${escapeHtml(String(item.usableLength))} 米</div>
                <div>录入人：${escapeHtml(item.enteredBy)} / ${escapeHtml(item.enteredByAccountId || '待补账号')}</div>
                <div>换班：${item.handoverFlag ? '是' : '否'}</div>
              </div>
              <div class="mt-2 text-muted-foreground">来源：${escapeHtml(item.sourceType)} / 写回：${escapeHtml(item.sourceWritebackId || '—')}</div>
              <div class="mt-1 text-muted-foreground">备注：${escapeHtml(item.note || '无')}</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderLatestSummary(detail: NonNullable<ReturnType<typeof getSpreadingDetail>>): string {
  return `
    <section class="rounded-xl border bg-card px-3 py-3" data-testid="pda-cutting-spreading-latest-summary">
      <div class="grid gap-3 text-xs sm:grid-cols-2">
        <div><div class="text-muted-foreground">当前铺布状态</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.currentExecutionStatus)}</div></div>
        <div><div class="text-muted-foreground">最近记录号</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.latestSpreadingRecordNo || '暂无记录')}</div></div>
        <div><div class="text-muted-foreground">最近录入时间</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.latestSpreadingAt)}</div><div class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(detail.latestSpreadingBy)}</div></div>
        <div><div class="text-muted-foreground">当前建议动作</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.nextRecommendedAction)}</div></div>
      </div>
    </section>
  `
}

function renderTargetSummary(target: PdaCuttingSpreadingTarget | null): string {
  if (!target) {
    return renderPdaCuttingEmptyState('当前无可选铺布对象', '')
  }

  return `
    <div class="grid gap-3 text-xs sm:grid-cols-2">
      <div><div class="text-muted-foreground">当前对象</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(target.title)}</div></div>
      <div><div class="text-muted-foreground">状态</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(target.statusLabel)}</div></div>
      <div><div class="text-muted-foreground">来源唛架</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(target.sourceMarkerLabel)}</div></div>
      <div data-pda-cut-spreading-field="spreadingMode"><div class="text-muted-foreground">铺布模式</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(getSpreadingModeLabel(target.spreadingMode))}</div></div>
      <div><div class="text-muted-foreground">原始裁片单</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(target.originalCutOrderNo || '—')}</div></div>
      <div><div class="text-muted-foreground">合并批次</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(target.mergeBatchNo || '—')}</div></div>
      <div><div class="text-muted-foreground">面料 SKU</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(target.materialSku || '—')}</div></div>
      <div><div class="text-muted-foreground">颜色</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(target.colorSummary || '—')}</div></div>
    </div>
  `
}

function renderOperatorSummary(taskId: string, detail: PdaCuttingTaskDetailData): string {
  const operator = resolveCurrentOperator(taskId, detail)
  return `
    <div class="grid gap-3 text-xs sm:grid-cols-2">
      <div><div class="text-muted-foreground">操作账号</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(operator.operatorAccountId)}</div></div>
      <div><div class="text-muted-foreground">操作人</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(operator.operatorName)}</div></div>
    </div>
  `
}

function renderPlanUnitSummary(planUnit: ReturnType<typeof getSelectedPlanUnit>): string {
  if (!planUnit) {
    return renderPdaCuttingEmptyState('当前铺布对象暂无排版项', '')
  }
  return `
    <div class="grid gap-3 text-xs sm:grid-cols-2">
      <div><div class="text-muted-foreground">当前排版项</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(planUnit.label)}</div></div>
      <div><div class="text-muted-foreground">单次成衣件数（件）</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(String(planUnit.garmentQtyPerUnit))}</div></div>
      <div><div class="text-muted-foreground">面料 SKU</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(planUnit.materialSku || '—')}</div></div>
      <div><div class="text-muted-foreground">颜色</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(planUnit.color || '—')}</div></div>
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
  const grossOccupiedLength = getGrossOccupiedLength(form)
  const usableLength = getUsableLength(form)
  const actualCutGarmentQty = getActualCutGarmentQty(form, selectedPlanUnit)
  const handoverOptions = buildHandoverOptions(taskId, detail)
  const currentOperator = resolveCurrentOperator(taskId, detail)

  return `
    <div class="space-y-3 pb-3 text-xs">
      ${renderFeedbackBlock(form)}
      <section class="rounded-xl border bg-card px-3 py-3" data-testid="pda-cutting-spreading-object-summary">
        <div class="grid gap-3 text-xs sm:grid-cols-2">
          <div><div class="text-muted-foreground">任务号</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.taskNo)}</div></div>
          <div><div class="text-muted-foreground">当前执行单</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.executionOrderNo)}</div></div>
          <div><div class="text-muted-foreground">原始裁片单</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.originalCutOrderNo)}</div></div>
          <div><div class="text-muted-foreground">面料 SKU</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.materialSku)}</div></div>
        </div>
      </section>
      <section class="rounded-xl border bg-card px-3 py-3" data-testid="pda-cutting-spreading-form-card">
        <div class="space-y-3">
          <label class="block space-y-1">
            <span class="text-muted-foreground">铺布对象</span>
            <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="selectedTargetKey">
              ${getVisibleTargets(detail)
                .map(
                  (target) => `
                    <option value="${escapeHtml(target.targetKey)}" ${form.selectedTargetKey === target.targetKey ? 'selected' : ''}>
                      ${escapeHtml(getTargetEntryLabel(target))} / ${escapeHtml(target.title)} / ${escapeHtml(target.statusLabel)}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </label>
          ${renderTargetSummary(selectedTarget)}
          <div class="border-t pt-3" data-testid="pda-cutting-spreading-plan-summary">
            <label class="block space-y-1">
              <span class="text-muted-foreground">当前排版项</span>
              <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="planUnitId">
                <option value="">请选择当前排版项</option>
                ${(selectedTarget?.planUnits || [])
                  .map(
                    (unit) => `
                      <option value="${escapeHtml(unit.planUnitId)}" ${form.selectedPlanUnitId === unit.planUnitId ? 'selected' : ''}>
                        ${escapeHtml(unit.label)}
                      </option>
                    `,
                  )
                  .join('')}
              </select>
            </label>
            <div class="mt-3">${renderPlanUnitSummary(selectedPlanUnit)}</div>
          </div>
          <div class="border-t pt-3">
            <div class="grid grid-cols-2 gap-3">
              <label class="col-span-2 block space-y-1">
                <span class="text-muted-foreground">卷号</span>
                <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="fabricRollNo" value="${escapeHtml(form.fabricRollNo)}" />
              </label>
              <label class="block space-y-1">
                <span class="text-muted-foreground">记录类型</span>
                <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="recordType">
                  ${(['开始铺布', '中途交接', '接手继续', '完成铺布'] as SpreadingRecordType[])
                    .map((item) => `<option value="${escapeHtml(item)}" ${form.recordType === item ? 'selected' : ''}>${escapeHtml(item)}</option>`)
                    .join('')}
                </select>
              </label>
              <label class="block space-y-1">
                <span class="text-muted-foreground">铺布层数（层）</span>
                <input type="number" min="0" step="1" class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="layerCount" value="${escapeHtml(form.layerCount)}" />
              </label>
              <label class="block space-y-1">
                <span class="text-muted-foreground">实际铺布长度（m）</span>
                <input type="number" min="0" step="0.01" class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="actualLength" value="${escapeHtml(form.actualLength)}" />
              </label>
              <label class="block space-y-1">
                <span class="text-muted-foreground">布头长度（m）</span>
                <input type="number" min="0" step="0.01" class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="headLength" value="${escapeHtml(form.headLength)}" />
              </label>
              <label class="block space-y-1">
                <span class="text-muted-foreground">布尾长度（m）</span>
                <input type="number" min="0" step="0.01" class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="tailLength" value="${escapeHtml(form.tailLength)}" />
              </label>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <label class="block space-y-1">
              <span class="text-muted-foreground">净可用长度（m）</span>
              ${renderFormulaBlock(
                formatLength(usableLength),
                `${usableLength.toFixed(2)} 米 = ${Number(form.actualLength || '0').toFixed(2)} 米 - ${Number(form.headLength || '0').toFixed(2)} 米 - ${Number(form.tailLength || '0').toFixed(2)} 米`,
              )}
            </label>
            <label class="block space-y-1">
              <span class="text-muted-foreground">实际裁剪成衣件数（件）</span>
              ${renderFormulaBlock(
                `${actualCutGarmentQty} 件`,
                `${actualCutGarmentQty} 件 = ${Number(form.layerCount || '0').toFixed(0)} 层 × ${Number(selectedPlanUnit?.garmentQtyPerUnit || 0).toFixed(0)} 件`,
              )}
            </label>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <div class="text-muted-foreground">整卷占用长度</div>
              ${renderFormulaBlock(
                formatLength(grossOccupiedLength),
                `${grossOccupiedLength.toFixed(2)} 米 = ${Number(form.actualLength || '0').toFixed(2)} 米 + ${Number(form.headLength || '0').toFixed(2)} 米 + ${Number(form.tailLength || '0').toFixed(2)} 米`,
              )}
            </div>
            <div>${renderOperatorSummary(taskId, detail)}</div>
          </div>
          ${
            isHandoverRecord(form.recordType)
              ? `
                <div class="grid gap-3">
                  <label class="block space-y-1">
                    <span class="text-muted-foreground">接手人账号</span>
                    <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="handoverToAccountId">
                      <option value="">请选择接手人</option>
                      ${handoverOptions
                        .map(
                          (item) => `
                            <option value="${escapeHtml(item.accountId)}" ${form.handoverToAccountId === item.accountId ? 'selected' : ''}>
                              ${escapeHtml(item.name)} / ${escapeHtml(item.accountId)}
                            </option>
                          `,
                        )
                        .join('')}
                    </select>
                  </label>
                  <label class="block space-y-1">
                    <span class="text-muted-foreground">交接说明</span>
                    <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-spreading-field="handoverNote" value="${escapeHtml(form.handoverNote)}" />
                  </label>
                </div>
              `
              : ''
          }
          <label class="block space-y-1">
            <span class="text-muted-foreground">备注</span>
            <textarea class="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-cut-spreading-field="note">${escapeHtml(form.note)}</textarea>
          </label>
          <div class="grid gap-3 text-xs sm:grid-cols-3">
            <div><div class="text-muted-foreground">操作账号</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(currentOperator.operatorAccountId)}</div></div>
            <div><div class="text-muted-foreground">操作人</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(currentOperator.operatorName)}</div></div>
            <div><div class="text-muted-foreground">发生时间</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(new Date().toISOString().replace('T', ' ').slice(0, 19))}</div></div>
          </div>
        </div>
      </section>
    </div>
  `
}

function renderSubmitBar(taskId: string, form: SpreadingFormState, pageBackHref: string): string {
  return `
    <div class="sticky bottom-0 z-10 rounded-xl border bg-background/95 px-3 py-3 backdrop-blur" data-testid="pda-cutting-spreading-submit-bar">
      <div class="grid grid-cols-4 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}" data-pda-cut-spreading-back="true">
          返回裁片任务
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted ${form.lastSubmittedSnapshot ? '' : 'opacity-50'}" data-pda-cut-spreading-action="reuse-last-layer-count" data-task-id="${escapeHtml(taskId)}" ${form.lastSubmittedSnapshot ? '' : 'disabled'}>
          沿用上次层数
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted ${form.lastSubmittedSnapshot ? '' : 'opacity-50'}" data-pda-cut-spreading-action="reuse-last-head-tail" data-task-id="${escapeHtml(taskId)}" ${form.lastSubmittedSnapshot ? '' : 'disabled'}>
          沿用上次头尾
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-spreading-action="submit" data-task-id="${escapeHtml(taskId)}">
          保存铺布记录
        </button>
      </div>
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
}

export function renderPdaCuttingSpreadingPage(taskId: string): string {
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

  const body = `
    <div class="space-y-3">
      ${renderLatestSummary(detail)}
      ${renderSubmitBar(taskId, form, pageBackHref)}
      <div data-task-id="${escapeHtml(taskId)}" data-pda-cut-spreading-root="${escapeHtml(taskId)}">${renderFormInner(taskId, detail, form)}</div>
      <section class="rounded-xl border bg-card px-3 py-3">
        <div class="mb-3 text-sm font-semibold text-foreground">最近铺布记录</div>
        ${renderRecords(detail)}
      </section>
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
    const identity = resolvePdaCuttingWritebackIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || undefined,
      executionOrderNo: context.selectedExecutionOrderNo || undefined,
      originalCutOrderId: context.selectedExecutionOrder?.originalCutOrderId || undefined,
      originalCutOrderNo: context.selectedExecutionOrder?.originalCutOrderNo || undefined,
      mergeBatchId: context.selectedExecutionOrder?.mergeBatchId || undefined,
      mergeBatchNo: context.selectedExecutionOrder?.mergeBatchNo || undefined,
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
      form.feedbackMessage = '请先选择当前铺布对象。'
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
      return true
    }
    const selectedPlanUnit = getSelectedPlanUnit(selectedTarget, form.selectedPlanUnitId)
    if (!selectedPlanUnit || !form.selectedPlanUnitId) {
      form.feedbackMessage = '请先选择计划单元。'
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
      return true
    }

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

    const operator = resolveCurrentOperator(taskId, detail)
    const handoverOptions = buildHandoverOptions(taskId, detail)
    const handoverTarget = handoverOptions.find((item) => item.accountId === form.handoverToAccountId) || null

    if (isHandoverRecord(form.recordType) && !handoverTarget) {
      form.feedbackMessage = '中途交接或接手继续时，请明确接手人。'
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

    const result = writePdaSpreadingToFcs({
      identity,
      operator,
      source: buildPdaCuttingWritebackSource('spreading', selectedTarget.spreadingSessionId || selectedTarget.targetKey),
      spreadingSessionId: selectedTarget.spreadingSessionId || '',
      markerId: selectedTarget.markerId || '',
      markerNo: selectedTarget.markerNo || '',
      planUnitId: selectedPlanUnit.planUnitId,
      planUnits: selectedTarget.planUnits.map((unit) => ({
        planUnitId: unit.planUnitId,
        sourceType: unit.sourceType,
        sourceLineId: unit.sourceLineId,
        color: unit.color,
        materialSku: unit.materialSku,
        garmentQtyPerUnit: unit.garmentQtyPerUnit,
        plannedRepeatCount: unit.plannedRepeatCount,
        lengthPerUnitM: unit.lengthPerUnitM,
        plannedCutGarmentQty: unit.plannedCutGarmentQty,
        plannedSpreadLengthM: unit.plannedSpreadLengthM,
      })),
      spreadingMode: selectedTarget.spreadingMode,
      recordType: form.recordType,
      fabricRollNo,
      operatorActionType: form.recordType,
      handoverFlag: isHandoverRecord(form.recordType),
      handoverNote: form.handoverNote.trim(),
      handoverToAccountId: handoverTarget?.accountId || '',
      handoverToName: handoverTarget?.name || '',
      layerCount,
      actualLength,
      headLength,
      tailLength,
      note: [form.note.trim(), `铺布对象：${selectedTarget.title}`, `模式：${getSpreadingModeLabel(selectedTarget.spreadingMode)}`]
        .filter(Boolean)
        .join('；'),
    })
    if (!result.success) {
      form.feedbackMessage = result.issues.join('；')
      form.feedbackTone = 'warning'
      syncSpreadingFormDom(taskId, selectedExecutionOrderId, selectedExecutionOrderNo)
      return true
    }

    form.lastSubmittedSnapshot = snapshot
    form.fabricRollNo = ''
    form.layerCount = ''
    form.actualLength = ''
    form.headLength = ''
    form.tailLength = ''
    form.handoverToAccountId = ''
    form.handoverNote = ''
    form.note = ''
    form.feedbackMessage = '铺布记录已保存，已清空本次录入值。'
    form.feedbackTone = 'success'
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
