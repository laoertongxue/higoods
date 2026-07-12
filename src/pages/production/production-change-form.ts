import { renderSteps } from '../../components/ui/steps.ts'
import {
  getProductionOrderChangeCurrentFacts,
  listProductionOrderTechPackRelations,
  type ProductionOrderChangeCurrentFacts,
  type ProductionOrderChangeOrder,
} from '../../data/fcs/production-tech-pack-change-domain.ts'
import {
  adaptLegacyQuantityLinesForEdit,
  areMaterialSelectionsEquivalent,
  buildProductionChangePreview,
  buildMaterialReplacementAllocations,
  createFollowingOrderPlans,
  createQuantityLinesForOrder,
  getProductionChangeLockMessage,
  LEGACY_ORIGINAL_MATERIAL_PREFIX,
  LEGACY_REPLACEMENT_MATERIAL_PREFIX,
  listAffectedDocumentNosForOrder,
  listReplacementMaterialOptions,
  normalizeMaterialReplacementAllocations,
  productionChangeResultLabels,
  readLegacyMaterialText,
  resolveLegacyMaterialValue,
  type LegacyQuantityChangeLine,
  type ProductionChangePlanItem,
  type ProductionChangeExecutionStep,
  type ProductionChangeResult,
  type ProductionChangePreview,
} from '../../data/fcs/production-order-change-workflow.ts'
import { escapeHtml } from '../../utils.ts'
import { createProductionChangeForm, state } from './context.ts'

type ProductionChangeFormStep = typeof state.productionChangeFormStep
type ProductionChangeForm = typeof state.productionChangeForm

const productionChangeSteps: Array<{
  key: ProductionChangeFormStep
  title: string
  description: string
}> = [
  { key: 'order', title: '选择生产单', description: '系统获取当前事实' },
  { key: 'content', title: '填写变更内容', description: '唯一核心数据节点' },
  { key: 'handling', title: '确认处理方案', description: '只判断必要事项' },
  { key: 'execution', title: '同步执行', description: '全部提交或全部回滚' },
]

function renderOptions(options: Array<{ value: string; label: string }>, selectedValue: string): string {
  return options.map((option) => `
    <option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? 'selected' : ''}>
      ${escapeHtml(option.label)}
    </option>
  `).join('')
}

function renderFactTable(title: string, headers: string[], rows: string[][], emptyText: string): string {
  const visibleRows = rows.slice(0, 8)
  const overflowRows = rows.slice(8)
  const renderRows = (items: string[][]): string => items.map((row) => `
    <tr>${row.map((cell) => `<td class="whitespace-nowrap px-3 py-2 align-top">${escapeHtml(cell)}</td>`).join('')}</tr>
  `).join('')

  return `
    <section class="border-t pt-4">
      <h3 class="text-sm font-semibold">${escapeHtml(title)}</h3>
      <div class="mt-2 overflow-x-auto rounded-md border">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>${headers.map((header) => `<th class="whitespace-nowrap px-3 py-2 font-medium">${escapeHtml(header)}</th>`).join('')}</tr>
          </thead>
          <tbody class="divide-y">
            ${rows.length > 0
              ? renderRows(visibleRows)
              : `<tr><td colspan="${headers.length}" class="px-3 py-4 text-muted-foreground">${escapeHtml(emptyText)}</td></tr>`}
          </tbody>
        </table>
      </div>
      ${overflowRows.length > 0 ? `
        <details class="mt-2" data-production-change-fact-overflow>
          <summary class="cursor-pointer text-sm text-primary">查看其余 ${overflowRows.length} 条</summary>
          <div class="mt-2 overflow-x-auto rounded-md border">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-muted/40 text-xs text-muted-foreground">
                <tr>${headers.map((header) => `<th class="whitespace-nowrap px-3 py-2 font-medium">${escapeHtml(header)}</th>`).join('')}</tr>
              </thead>
              <tbody class="divide-y">${renderRows(overflowRows)}</tbody>
            </table>
          </div>
        </details>
      ` : ''}
    </section>
  `
}

function normalizeLegacyProductionChangeHistoryStatus(status: string): string {
  const statusLabels: Record<string, string> = {
    审核中: '处理中',
    待审核: '待处理',
    审核通过: '处理完成',
    审核驳回: '处理退回',
  }
  return statusLabels[status] ?? status
}

export function renderProductionChangeCurrentFactsSummary(facts: ProductionOrderChangeCurrentFacts): string {
  return `
    <section class="space-y-4" data-production-change-current-facts>
      <div class="flex flex-wrap items-start justify-between gap-3 border-t pt-4">
        <div>
          <h2 class="text-base font-semibold">生产单当前事实</h2>
          <p class="mt-1 text-sm text-muted-foreground">系统已读取当前需求、物料、关联单据和历史记录，跟单无需重复上报。</p>
        </div>
        <span class="rounded-md border bg-muted/40 px-2 py-1 text-xs font-medium">当前事实只读</span>
      </div>
      ${renderFactTable(
        '当前需求明细',
        ['需求范围', '原需求', '当前需求', '已生成单据', '已完成', '待处理', '事实说明'],
        facts.demandQuantityFacts.map((item) => [
          item.scope,
          `${item.originalDemandQty} 件`,
          `${item.currentDemandQty} 件`,
          `${item.generatedDocumentQty} 件`,
          `${item.executedQty} 件`,
          `${item.pendingQty} 件`,
          item.note,
        ]),
        '暂无需求明细事实',
      )}
      ${renderFactTable(
        '物料事实',
        ['物料', '应配', '已配', '已领', '剩余可处理', '来源单据', '事实说明'],
        facts.materialFacts.map((item) => [
          item.material,
          item.requiredQty,
          item.preparedQty,
          item.pickedQty,
          item.changeableQty,
          item.sourceDocument,
          item.note,
        ]),
        '暂无物料事实',
      )}
      ${renderFactTable(
        '关联单据',
        ['单据类型', '单据号', '当前状态', '计划数量', '已完成', '待处理', '事实说明'],
        facts.documentFacts.map((item) => [
          item.group,
          item.documentNo,
          item.status,
          item.plannedQty,
          item.doneQty,
          item.pendingQty,
          item.note,
        ]),
        '暂无关联单据事实',
      )}
      ${renderFactTable(
        '历史留痕',
        ['变更单号', '变更结果', '当前状态', '影响范围', '锁定状态'],
        facts.historyFacts.map((item) => [
          item.changeOrderNo,
          item.result,
          normalizeLegacyProductionChangeHistoryStatus(item.status),
          item.affectedScope,
          item.lockStatus,
        ]),
        '暂无历史变更记录',
      )}
    </section>
  `
}

export function renderProductionChangeFormSteps(step: ProductionChangeFormStep): string {
  const current = Math.max(0, productionChangeSteps.findIndex((item) => item.key === step))
  return `
    <section class="min-h-[92px] overflow-x-auto rounded-lg border bg-card p-4" data-production-change-form-steps>
      ${renderSteps({ steps: productionChangeSteps, current })}
    </section>
  `
}

export function renderProductionChangeOrderStep(form: ProductionChangeForm): string {
  const relations = listProductionOrderTechPackRelations().filter((relation) =>
    getProductionOrderChangeCurrentFacts(relation.productionOrderId) !== null &&
    createQuantityLinesForOrder(relation.productionOrderId).length > 0,
  )
  const facts = form.productionOrderId
    ? getProductionOrderChangeCurrentFacts(form.productionOrderId)
    : null

  return `
    <div class="space-y-4">
      <label class="block max-w-3xl space-y-1 text-sm">
        <span class="font-medium">选择生产单</span>
        <select data-prod-field="productionChangeProductionOrderId" class="w-full rounded-md border px-3 py-2">
          <option value="">请选择生产单</option>
          ${relations.map((relation) => `
            <option value="${escapeHtml(relation.productionOrderId)}" ${relation.productionOrderId === form.productionOrderId ? 'selected' : ''}>
              ${escapeHtml(`${relation.productionOrderNo} / ${relation.spuCode} / ${relation.styleName}`)}
            </option>
          `).join('')}
        </select>
      </label>
      ${facts
        ? renderProductionChangeCurrentFactsSummary(facts)
        : form.productionOrderId
          ? `
          <section class="flex min-h-[180px] items-center justify-center rounded-md border border-dashed border-amber-300 bg-amber-50 px-6 text-center">
            <div>
              <h2 class="text-base font-semibold text-amber-900">找不到当前事实</h2>
              <p class="mt-2 text-sm text-amber-800">该生产单不在当前可变更范围内，请重新选择列表中的生产单。</p>
            </div>
          </section>
        `
          : `
          <section class="flex min-h-[180px] items-center justify-center rounded-md border border-dashed bg-muted/20 px-6 text-center">
            <div>
              <h2 class="text-base font-semibold">尚未选择生产单</h2>
              <p class="mt-2 text-sm text-muted-foreground">选择生产单后，系统将显示只读的当前需求明细、物料事实、关联单据和历史留痕。</p>
            </div>
          </section>
        `}
    </div>
  `
}

function renderQuantityLine(line: ProductionChangeForm['quantityLines'][number], readOnly = false): string {
  const difference = line.targetQty - line.currentQty
  const differenceText = difference === 0
    ? '不变'
    : difference > 0
      ? `增加 ${difference} 件`
      : `减少 ${Math.abs(difference)} 件`
  const editableIdentity = line.isNew

  return `
    <tr data-production-change-quantity-row data-line-id="${escapeHtml(line.id)}">
      <td class="px-3 py-3">
        ${editableIdentity
          ? `<input data-prod-field="productionChangeQuantitySkuCode" data-skip-page-rerender="true" data-line-id="${escapeHtml(line.id)}" value="${escapeHtml(line.skuCode)}" class="w-32 rounded-md border px-2 py-1.5" placeholder="商品编码" ${readOnly ? 'disabled' : ''} />`
          : escapeHtml(line.skuCode)}
      </td>
      <td class="px-3 py-3">
        ${editableIdentity
          ? `<input data-prod-field="productionChangeQuantityColor" data-skip-page-rerender="true" data-line-id="${escapeHtml(line.id)}" value="${escapeHtml(line.color)}" class="w-24 rounded-md border px-2 py-1.5" placeholder="颜色" ${readOnly ? 'disabled' : ''} />`
          : escapeHtml(line.color)}
      </td>
      <td class="px-3 py-3">
        ${editableIdentity
          ? `<input data-prod-field="productionChangeQuantitySize" data-skip-page-rerender="true" data-line-id="${escapeHtml(line.id)}" value="${escapeHtml(line.size)}" class="w-20 rounded-md border px-2 py-1.5" placeholder="尺码" ${readOnly ? 'disabled' : ''} />`
          : escapeHtml(line.size)}
      </td>
      <td class="whitespace-nowrap px-3 py-3">${escapeHtml(String(line.originalQty))} 件</td>
      <td class="whitespace-nowrap px-3 py-3">${escapeHtml(String(line.currentQty))} 件</td>
      <td class="px-3 py-3">
        <input data-prod-field="productionChangeQuantityTargetQty" data-skip-page-rerender="true" data-line-id="${escapeHtml(line.id)}" type="number" min="0" step="1" value="${escapeHtml(String(line.targetQty))}" class="w-24 rounded-md border px-2 py-1.5" ${readOnly ? 'disabled' : ''} />
      </td>
      <td class="whitespace-nowrap px-3 py-3" data-production-change-quantity-delta data-line-id="${escapeHtml(line.id)}">${escapeHtml(differenceText)}</td>
      <td class="whitespace-nowrap px-3 py-3" data-production-change-quantity-status data-line-id="${escapeHtml(line.id)}">${line.targetQty === 0 ? '已取消' : line.isNew ? '新增' : '保留'}</td>
      <td class="px-3 py-3">
        ${line.isNew && !readOnly ? `<button type="button" class="text-sm text-destructive" data-prod-action="remove-production-change-quantity-line" data-line-id="${escapeHtml(line.id)}">删除</button>` : '<span class="text-xs text-muted-foreground">历史行保留</span>'}
      </td>
    </tr>
  `
}

export function renderQuantityChangeForm(
  form: ProductionChangeForm,
  options: { readOnly?: boolean; unmatchedLegacyLines?: LegacyQuantityChangeLine[] } = {},
): string {
  const readOnly = options.readOnly === true
  const unmatchedLegacyLines = options.unmatchedLegacyLines ?? []
  const quantityLines = form.quantityLines.length > 0
    ? form.quantityLines
    : createQuantityLinesForOrder(form.productionOrderId)
  const originalTotal = quantityLines.reduce((sum, line) => sum + line.originalQty, 0)
  const currentTotal = quantityLines.reduce((sum, line) => sum + line.currentQty, 0)
  const targetTotal = quantityLines.reduce((sum, line) => sum + line.targetQty, 0)

  return `
    <section class="space-y-4" data-production-change-form-type="QUANTITY_CHANGE">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">修改生产单需求数量</h2>
          <p class="mt-1 text-sm text-muted-foreground">按每条需求明细修改，不直接修改生产单总数量。数量改为 0 后显示“已取消”，历史行仍保留。</p>
        </div>
        ${readOnly ? '' : `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="add-production-change-quantity-line">
          <i data-lucide="plus" class="mr-1 inline h-4 w-4"></i>新增明细
        </button>`}
      </div>
      ${unmatchedLegacyLines.length > 0 ? `
        <section class="rounded-md border border-amber-300 bg-amber-50 p-4" data-production-change-edit-safety-warning>
          <h3 class="text-sm font-semibold text-amber-900">无法安全对应当前需求明细，不能直接保存，请按原记录新建变更</h3>
          <div class="mt-3 overflow-x-auto rounded-md border border-amber-200 bg-background">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-amber-100/60"><tr>${['原记录颜色', '原记录尺码', '原数量', '变更后数量', '原记录变化'].map((title) => `<th class="px-3 py-2 font-medium">${title}</th>`).join('')}</tr></thead>
              <tbody>${unmatchedLegacyLines.map((line) => `<tr><td class="px-3 py-2">${escapeHtml(line.color)}</td><td class="px-3 py-2">${escapeHtml(line.size)}</td><td class="px-3 py-2">${line.currentQty} 件</td><td class="px-3 py-2">${line.newQty} 件</td><td class="px-3 py-2">${line.newQty - line.currentQty} 件</td></tr>`).join('')}</tbody>
            </table>
          </div>
        </section>
      ` : ''}
      <div class="overflow-x-auto rounded-md border">
        <table class="min-w-[1120px] text-left text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>${['商品编码', '颜色', '尺码', '原需求', '当前需求', '变更后数量', '变化', '状态', '操作'].map((title) => `<th class="whitespace-nowrap px-3 py-2 font-medium">${title}</th>`).join('')}</tr>
          </thead>
          <tbody class="divide-y">
            ${quantityLines.length > 0
              ? quantityLines.map((line) => renderQuantityLine(line, readOnly)).join('')
              : '<tr><td colspan="9" class="px-3 py-6 text-center text-muted-foreground">暂无需求明细，可新增一条明细。</td></tr>'}
          </tbody>
        </table>
      </div>
      <template data-production-change-new-quantity-line-template>
        <input data-prod-field="productionChangeQuantitySkuCode" data-line-id="NEW" />
        <input data-prod-field="productionChangeQuantityColor" data-line-id="NEW" />
        <input data-prod-field="productionChangeQuantitySize" data-line-id="NEW" />
      </template>
      <div class="grid gap-3 border-t pt-4 text-sm sm:grid-cols-3" data-production-change-quantity-summary>
        <p><span class="text-muted-foreground">原需求合计：</span><strong>${originalTotal} 件</strong></p>
        <p><span class="text-muted-foreground">当前需求合计：</span><strong>${currentTotal} 件</strong></p>
        <p><span class="text-muted-foreground">调整后自动汇总：</span><strong data-production-change-quantity-target-total>${targetTotal} 件</strong></p>
      </div>
      <label class="block space-y-1 text-sm">
        <span class="font-medium">变更原因</span>
        <textarea data-prod-field="productionChangeReason" data-skip-page-rerender="true" class="min-h-24 w-full rounded-md border px-3 py-2" placeholder="说明本次调整原因" ${readOnly ? 'disabled' : ''}>${escapeHtml(form.reason)}</textarea>
      </label>
    </section>
  `
}

function renderSegmentButton(
  label: string,
  action: string,
  dataName: string,
  dataValue: string,
  active: boolean,
  disabled = false,
): string {
  return `
    <button type="button" class="min-h-10 flex-1 border px-3 py-2 text-sm first:rounded-l-md last:rounded-r-md ${active ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}"
      data-prod-action="${action}" data-${dataName}="${dataValue}" ${disabled ? 'disabled' : ''}>${label}</button>
  `
}

function isCurrentFabricMaterial(material: string): boolean {
  const normalized = material.trim().toUpperCase()
  if (/\bACC[-_]/.test(normalized) || /(辅料|拉链|纽扣|包装|染料)/.test(material)) return false
  return /\bFAB[-_]/.test(normalized) || /(面料|坯布|布料|织物)/.test(material)
}

export function listCurrentMaterialOptionsForOrder(
  productionOrderId: string,
): Array<{ value: string; label: string }> {
  return (getProductionOrderChangeCurrentFacts(productionOrderId)?.materialFacts ?? [])
    .filter((fact) => isCurrentFabricMaterial(fact.material))
    .map((fact) => ({
      value: fact.id,
      label: `${fact.material} / ${fact.sourceDocument}`,
    }))
}

function withSelectedLegacyMaterialOption(
  options: Array<{ value: string; label: string }>,
  selectedValue: string,
): Array<{ value: string; label: string }> {
  if (!selectedValue || options.some((option) => option.value === selectedValue)) return options
  const legacyText = readLegacyMaterialText(selectedValue)
  return legacyText
    ? [{ value: selectedValue, label: `${legacyText}（原记录）` }, ...options]
    : options
}

export function createProductionChangeEditForm(order: ProductionOrderChangeOrder): ProductionChangeForm {
  const form = createProductionChangeForm()
  form.changeType = order.changeType
  form.productionOrderId = order.productionOrderId
  form.reason = order.reason

  if (order.changeType === 'QUANTITY_CHANGE') {
    form.quantityLines = adaptLegacyQuantityLinesForEdit(
      order.productionOrderId,
      order.quantityLines ?? [],
    ).quantityLines
    return form
  }

  if (order.materialReplacement) {
    const currentMaterialOptions = listCurrentMaterialOptionsForOrder(order.productionOrderId)
    const replacementMaterialOptions = listReplacementMaterialOptions()
    const baseAllocations = buildMaterialReplacementAllocations(order.productionOrderId, 0)
    const suggestedProductionQty = baseAllocations.reduce(
      (sum, line) => sum + line.suggestedReplacementQty,
      0,
    )
    const normalized = normalizeMaterialReplacementAllocations(
      order.productionOrderId,
      [],
      suggestedProductionQty,
    )
    form.materialReplacement = {
      ...form.materialReplacement,
      originalMaterialId: resolveLegacyMaterialValue(
        order.materialReplacement.originalMaterial,
        currentMaterialOptions,
        LEGACY_ORIGINAL_MATERIAL_PREFIX,
      ),
      replacementMaterialId: resolveLegacyMaterialValue(
        order.materialReplacement.replacementMaterial,
        replacementMaterialOptions,
        LEGACY_REPLACEMENT_MATERIAL_PREFIX,
      ),
      suggestedProductionQty,
      confirmedProductionQty: normalized.confirmedProductionQty,
      allocations: normalized.allocations,
      followingOrders: createFollowingOrderPlans(order.productionOrderId),
    }
  }
  return form
}

export function renderMaterialReplacementForm(form: ProductionChangeForm, readOnly = false): string {
  const replacement = form.materialReplacement
  const currentMaterialOptions = withSelectedLegacyMaterialOption(
    listCurrentMaterialOptionsForOrder(form.productionOrderId),
    replacement.originalMaterialId,
  )
  const baseReplacementMaterialOptions = listReplacementMaterialOptions()
  const originalIdentity = replacement.originalMaterialId
    ? areMaterialSelectionsEquivalent(
      replacement.originalMaterialId,
      currentMaterialOptions,
      replacement.originalMaterialId,
      currentMaterialOptions,
    )
    : false
  const selectableReplacementMaterialOptions = baseReplacementMaterialOptions.filter((option) =>
    !areMaterialSelectionsEquivalent(
      replacement.originalMaterialId,
      currentMaterialOptions,
      option.value,
      baseReplacementMaterialOptions,
    ),
  )
  const systemReplacementMaterialOptions = withSelectedLegacyMaterialOption(
    selectableReplacementMaterialOptions,
    replacement.replacementMaterialId,
  )
  const hasSameMaterialError = Boolean(
    originalIdentity &&
    (
      replacement.originalMaterialId === replacement.replacementMaterialId ||
      areMaterialSelectionsEquivalent(
        replacement.originalMaterialId,
        currentMaterialOptions,
        replacement.replacementMaterialId,
        baseReplacementMaterialOptions,
      )
    ),
  )
  const allocations = replacement.allocations
  const totalDemandQty = allocations.reduce((sum, line) => sum + line.demandQty, 0)
  const allocationTotal = allocations.reduce((sum, line) => sum + line.confirmedReplacementQty, 0)
  const calculatedSuggestion = allocations.reduce((sum, line) => sum + line.suggestedReplacementQty, 0)
  const suggestedProductionQty = replacement.suggestedProductionQty > 0
    ? replacement.suggestedProductionQty
    : calculatedSuggestion
  const followingOrders = replacement.followingOrders.length > 0
    ? replacement.followingOrders
    : createFollowingOrderPlans(form.productionOrderId)
  const invalidAllocation = allocations.find(
    (line) =>
      !Number.isInteger(line.confirmedReplacementQty) ||
      line.confirmedReplacementQty < 0 ||
      line.confirmedReplacementQty > line.demandQty,
  )
  const allocationError = invalidAllocation
    ? `${invalidAllocation.color} ${invalidAllocation.size} 的分配数量必须为非负整数，且不能超过 ${invalidAllocation.demandQty} 件。`
    : allocationTotal !== replacement.confirmedProductionQty
      ? `分配合计需等于确认生产件数，还差 ${replacement.confirmedProductionQty - allocationTotal} 件。`
      : ''

  return `
    <section class="space-y-5" data-production-change-form-type="MATERIAL_REPLACEMENT">
      <div>
        <h2 class="text-base font-semibold">替换物料</h2>
        <p class="mt-1 text-sm text-muted-foreground">这里调整的是新面料用于多少件生产，不是修改需求明细，也不是填写面料米数。</p>
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="space-y-1 text-sm">
          <span class="font-medium">原面料</span>
          <select data-prod-field="productionChangeOriginalMaterialId" data-material-source="current-facts" class="w-full rounded-md border px-3 py-2" ${readOnly ? 'disabled' : ''}>
            <option value="">请选择原面料</option>
            ${renderOptions(currentMaterialOptions, replacement.originalMaterialId)}
          </select>
        </label>
        <label class="space-y-1 text-sm">
          <span class="font-medium">新面料</span>
          <select data-prod-field="productionChangeReplacementMaterialId" data-material-source="system-archive" class="w-full rounded-md border px-3 py-2" ${readOnly ? 'disabled' : ''}>
            <option value="">请选择新面料</option>
            ${renderOptions(systemReplacementMaterialOptions, replacement.replacementMaterialId)}
          </select>
        </label>
      </div>
      ${hasSameMaterialError
        ? '<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">新面料不能与原面料相同</div>'
        : ''}
      <div class="grid gap-4 md:grid-cols-2">
        <fieldset class="space-y-2">
          <legend class="text-sm font-medium">替换方式</legend>
          <div class="flex">
            ${renderSegmentButton('剩余数量替换', 'set-production-change-replacement-mode', 'mode', 'REMAINING', replacement.replacementMode === 'REMAINING', readOnly)}
            ${renderSegmentButton('全部数量替换', 'set-production-change-replacement-mode', 'mode', 'FULL', replacement.replacementMode === 'FULL', readOnly)}
          </div>
        </fieldset>
        <fieldset class="space-y-2">
          <legend class="text-sm font-medium">处理范围</legend>
          <div class="flex">
            ${renderSegmentButton('只处理当前生产单', 'set-production-change-scope', 'scope', 'CURRENT_ONLY', replacement.scope === 'CURRENT_ONLY', readOnly)}
            ${renderSegmentButton('后续生产单也替换', 'set-production-change-scope', 'scope', 'CURRENT_AND_FOLLOWING', replacement.scope === 'CURRENT_AND_FOLLOWING', readOnly)}
          </div>
        </fieldset>
      </div>
      <div class="grid gap-4 border-y py-4 md:grid-cols-2">
        <div>
          <p class="text-sm text-muted-foreground">建议替换生产数量</p>
          <p class="mt-1 text-2xl font-semibold">${escapeHtml(String(suggestedProductionQty))} 件</p>
          <p class="mt-1 text-xs text-muted-foreground">系统根据当前生产事实自动计算。</p>
        </div>
        <label class="space-y-1 text-sm">
          <span class="font-medium">跟单确认用于生产的数量</span>
          <input data-prod-field="productionChangeConfirmedProductionQty" data-skip-page-rerender="true" type="number" min="0" max="${escapeHtml(String(totalDemandQty))}" step="1" value="${escapeHtml(String(replacement.confirmedProductionQty))}" class="w-full rounded-md border px-3 py-2" ${readOnly ? 'disabled' : ''} />
          <span class="block text-xs text-muted-foreground">最多 ${escapeHtml(String(totalDemandQty))} 件，仅填写成衣生产件数。</span>
        </label>
      </div>
      <div>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="toggle-production-change-allocation" ${readOnly ? 'disabled' : ''}>
            调整颜色尺码分配
            <i data-lucide="chevron-down" class="ml-1 inline h-4 w-4"></i>
          </button>
          <p class="text-sm font-medium" data-production-change-allocation-summary>分配合计 ${escapeHtml(String(allocationTotal))} 件 / 确认 ${escapeHtml(String(replacement.confirmedProductionQty))} 件</p>
        </div>
        <p class="mt-2 text-sm text-red-700" data-production-change-allocation-error>${escapeHtml(allocationError)}</p>
        ${form.advancedAllocationOpen ? `
          <div class="mt-3 overflow-x-auto rounded-md border">
            <table class="min-w-[760px] text-left text-sm">
              <thead class="bg-muted/40 text-xs text-muted-foreground">
                <tr>${['商品编码', '颜色', '尺码', '需求数量', '已完成生产件数', '剩余待生产件数', '确认生产数量'].map((title) => `<th class="px-3 py-2 font-medium">${title}</th>`).join('')}</tr>
              </thead>
              <tbody class="divide-y">
                ${allocations.map((line) => `
                  <tr>
                    <td class="px-3 py-3">${escapeHtml(line.skuCode)}</td>
                    <td class="px-3 py-3">${escapeHtml(line.color)}</td>
                    <td class="px-3 py-3">${escapeHtml(line.size)}</td>
                    <td class="px-3 py-3">${escapeHtml(String(line.demandQty))} 件</td>
                    <td class="px-3 py-3">${escapeHtml(String(line.oldMaterialFactQty))} 件</td>
                    <td class="px-3 py-3">${escapeHtml(String(line.suggestedReplacementQty))} 件</td>
                    <td class="px-3 py-3"><input data-prod-field="productionChangeAllocationQty" data-skip-page-rerender="true" data-allocation-id="${escapeHtml(line.id)}" type="number" min="0" max="${escapeHtml(String(line.demandQty))}" step="1" value="${escapeHtml(String(line.confirmedReplacementQty))}" class="w-24 rounded-md border px-2 py-1.5" ${readOnly ? 'disabled' : ''} /></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>
      <section class="border-t pt-4">
        <h3 class="text-sm font-semibold">后续生产单摘要（只读）</h3>
        <div class="mt-2 overflow-x-auto rounded-md border">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-muted/40 text-xs text-muted-foreground"><tr><th class="px-3 py-2 font-medium">生产单</th><th class="px-3 py-2 font-medium">开工状态</th><th class="px-3 py-2 font-medium">当前事实</th><th class="px-3 py-2 font-medium">系统建议</th></tr></thead>
            <tbody class="divide-y">
              ${followingOrders.length > 0
                ? followingOrders.slice(0, 6).map((order) => `<tr><td class="px-3 py-3">${escapeHtml(order.productionOrderId)}</td><td class="px-3 py-3">${order.started ? '已开工' : '未开工'}</td><td class="px-3 py-3">${escapeHtml(order.progressText)}</td><td class="px-3 py-3">${order.suggestedMode === 'FULL' ? '全部数量替换' : '剩余数量替换'}</td></tr>`).join('')
                : '<tr><td colspan="4" class="px-3 py-4 text-muted-foreground">没有需要展示的后续生产单。</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
      <label class="block space-y-1 text-sm">
        <span class="font-medium">变更原因</span>
        <textarea data-prod-field="productionChangeReason" data-skip-page-rerender="true" class="min-h-24 w-full rounded-md border px-3 py-2" placeholder="说明本次替换原因" ${readOnly ? 'disabled' : ''}>${escapeHtml(form.reason)}</textarea>
      </label>
    </section>
  `
}

export interface ProductionChangeFormRenderOptions {
  readOnly?: boolean
  unmatchedLegacyQuantityLines?: LegacyQuantityChangeLine[]
}

function renderProductionChangeContentStep(
  form: ProductionChangeForm,
  options: ProductionChangeFormRenderOptions,
): string {
  return `
    <div class="space-y-5">
      ${options.readOnly
        ? `<div class="max-w-2xl rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">${form.changeType === 'QUANTITY_CHANGE' ? '修改生产单需求数量（只读）' : '替换物料（只读）'}</div>`
        : `<div class="flex max-w-2xl">
            ${renderSegmentButton('修改生产单需求数量', 'set-production-change-type', 'change-type', 'QUANTITY_CHANGE', form.changeType === 'QUANTITY_CHANGE')}
            ${renderSegmentButton('替换物料', 'set-production-change-type', 'change-type', 'MATERIAL_REPLACEMENT', form.changeType === 'MATERIAL_REPLACEMENT')}
          </div>`}
      ${form.changeType === 'MATERIAL_REPLACEMENT'
        ? renderMaterialReplacementForm(form, options.readOnly === true)
        : renderQuantityChangeForm(form, {
          readOnly: options.readOnly,
          unmatchedLegacyLines: options.unmatchedLegacyQuantityLines,
        })}
    </div>
  `
}

export function buildProductionChangePreviewForForm(form: ProductionChangeForm): ProductionChangePreview {
  return buildProductionChangePreview({
    productionOrderId: form.productionOrderId,
    changeType: form.changeType,
    reason: form.reason,
    quantityLines: form.quantityLines,
    materialReplacement: form.changeType === 'MATERIAL_REPLACEMENT' ? form.materialReplacement : null,
    decisionValues: form.decisionValues,
    affectedDocumentNos: listAffectedDocumentNosForOrder(form.productionOrderId),
  })
}

function renderHandlingSummary(preview: ProductionChangePreview): string {
  const summaries = [
    ['最终变更类型', productionChangeResultLabels[preview.result]],
    ['数量与物料', preview.summary.materialDeltaText],
    [
      '上下游单据',
      `影响 ${preview.summary.affectedOrderCount} 张生产单、${preview.summary.affectedDocumentCount} 张当前事实单据。`,
    ],
    [
      '成本与交期',
      `${preview.summary.costDeltaText}${preview.summary.deliveryImpactText}`,
    ],
  ]
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="处理方案摘要">
      ${summaries.map(([title, value]) => `
        <div class="min-h-[104px] border-l-4 border-l-primary bg-muted/30 px-4 py-3">
          <p class="text-xs font-medium text-muted-foreground">${escapeHtml(title)}</p>
          <p class="mt-2 text-sm font-semibold leading-6">${escapeHtml(value)}</p>
        </div>
      `).join('')}
    </section>
  `
}

function renderHandlingAffectedFacts(preview: ProductionChangePreview): string {
  const rows = preview.affectedOrderIds.flatMap((productionOrderId) => {
    const facts = getProductionOrderChangeCurrentFacts(productionOrderId)
    if (!facts) {
      return [[productionOrderId, '生产单', productionOrderId, '尚无结构化事实', '-', '-', '-', '执行前必须重新读取']]
    }
    const demandPlannedQty = facts.demandQuantityFacts.reduce((sum, fact) => sum + fact.currentDemandQty, 0)
    const demandDoneQty = facts.demandQuantityFacts.reduce((sum, fact) => sum + fact.executedQty, 0)
    const demandPendingQty = facts.demandQuantityFacts.reduce((sum, fact) => sum + fact.pendingQty, 0)
    return [
      [
        productionOrderId,
        '生产单',
        productionOrderId,
        demandDoneQty > 0 ? '已开工' : '未开工',
        `${demandPlannedQty} 件`,
        `${demandDoneQty} 件`,
        `${demandPendingQty} 件`,
        '按确认后的变更方案统一处理',
      ],
      ...facts.documentFacts.map((fact) => [
        productionOrderId,
        fact.group,
        fact.documentNo,
        fact.status,
        fact.plannedQty,
        fact.doneQty,
        fact.pendingQty,
        fact.note,
      ]),
    ]
  })
  return renderFactTable(
    '受影响生产单及关联单据当前事实',
    ['生产单', '单据类型', '单据号', '当前状态', '计划数量', '已完成', '待处理', '处理依据'],
    rows,
    '暂无受影响单据事实',
  )
}

function renderHandlingPlanItem(item: ProductionChangePlanItem): string {
  return `
    <article class="border-t py-3 first:border-t-0">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 class="text-sm font-semibold">${escapeHtml(item.title)}</h4>
          <p class="mt-1 text-sm leading-6 text-muted-foreground">${escapeHtml(item.description)}</p>
        </div>
        ${item.affectedDocumentNo
          ? `<span class="rounded-md border bg-background px-2 py-1 text-xs font-medium">${escapeHtml(item.affectedDocumentNo)}</span>`
          : ''}
      </div>
    </article>
  `
}

function renderAutomaticHandlingItems(items: ProductionChangePlanItem[]): string {
  const groupOrder: ProductionChangePlanItem['group'][] = ['需求与物料', '上下游单据', '实物去向', '成本与交期']
  return `
    <section class="space-y-3" aria-label="系统自动处理">
      <div>
        <h3 class="text-base font-semibold">系统自动处理</h3>
        <p class="mt-1 text-sm text-muted-foreground">系统按当前事实直接处理，跟单只读查看，不需要逐项操作。</p>
      </div>
      ${groupOrder.map((group) => {
        const groupItems = items.filter((item) => item.group === group)
        if (groupItems.length === 0) return ''
        return `
          <details class="border-y" open data-production-change-auto-group="${escapeHtml(group)}">
            <summary class="cursor-pointer py-3 text-sm font-semibold">${escapeHtml(group)}（${groupItems.length} 项）</summary>
            <div class="border-t">${groupItems.map(renderHandlingPlanItem).join('')}</div>
          </details>
        `
      }).join('')}
    </section>
  `
}

function renderDecisionItem(item: ProductionChangePlanItem): string {
  return `
    <article class="border-t py-4 first:border-t-0" data-production-change-decision="${escapeHtml(item.id)}">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 class="text-sm font-semibold">${escapeHtml(item.title)}</h4>
          <p class="mt-1 text-sm leading-6 text-muted-foreground">${escapeHtml(item.description)}</p>
        </div>
        ${item.affectedDocumentNo
          ? `<span class="rounded-md border bg-background px-2 py-1 text-xs font-medium">${escapeHtml(item.affectedDocumentNo)}</span>`
          : ''}
      </div>
      <label class="mt-3 block max-w-2xl space-y-1 text-sm">
        <span class="font-medium">跟单判断</span>
        <select data-prod-field="productionChangeDecisionValue" data-decision-id="${escapeHtml(item.id)}" class="w-full rounded-md border px-3 py-2">
          <option value="">请选择</option>
          ${renderOptions(item.options, item.selectedValue)}
        </select>
      </label>
      ${item.reasonRequired ? `
        <label class="mt-3 block max-w-2xl space-y-1 text-sm">
          <span class="font-medium">判断原因</span>
          <textarea data-prod-field="productionChangeDecisionReason" data-decision-id="${escapeHtml(item.id)}" data-skip-page-rerender="true" class="min-h-20 w-full rounded-md border px-3 py-2" placeholder="说明偏离系统建议的现场事实">${escapeHtml(item.reason)}</textarea>
        </label>
      ` : ''}
    </article>
  `
}

function renderProductionChangeHandlingStep(form: ProductionChangeForm): string {
  const preview = buildProductionChangePreviewForForm(form)
  return `
    <div class="space-y-6" data-production-change-handling>
      ${renderHandlingSummary(preview)}
      ${renderHandlingAffectedFacts(preview)}
      <section class="border-y py-4">
        <p class="text-xs font-medium text-muted-foreground">最终结果</p>
        <h2 class="mt-1 text-base font-semibold">${escapeHtml(productionChangeResultLabels[preview.result])}</h2>
        <p class="mt-2 text-sm leading-6 text-muted-foreground">${escapeHtml(preview.resultReason)}</p>
      </section>
      ${renderAutomaticHandlingItems(preview.autoItems)}
      <section aria-label="待跟单判断">
        <div>
          <h3 class="text-base font-semibold">待跟单判断</h3>
          <p class="mt-1 text-sm text-muted-foreground">这里只保留系统无法替跟单判断的业务去向或替换方式。</p>
        </div>
        <div class="mt-3 border-y">
          ${preview.decisionItems.length > 0
            ? preview.decisionItems.map(renderDecisionItem).join('')
            : '<p class="py-5 text-sm text-muted-foreground">当前没有需要跟单判断的事项，可继续下一步。</p>'}
        </div>
      </section>
    </div>
  `
}

const productionChangeExecutionStepSeeds: Array<Pick<ProductionChangeExecutionStep, 'id' | 'label'>> = [
  { id: 'LOCK', label: '锁定处理范围' },
  { id: 'FACTS', label: '最后核对当前事实' },
  { id: 'CHANGE', label: '执行全部处理动作' },
  { id: 'TRACE', label: '写入双向留痕' },
  { id: 'COMMIT', label: '统一提交' },
]

const productionChangeExecutionStatusLabels: Record<ProductionChangeExecutionStep['status'], string> = {
  WAITING: '待执行',
  RUNNING: '执行中',
  DONE: '已完成',
  ROLLED_BACK: '已回滚',
}

export function renderProductionChangeExecutionStep(form: ProductionChangeForm): string {
  const preview = buildProductionChangePreviewForForm(form)
  const execution = form.execution as typeof form.execution & {
    lockObjectIds?: string[]
    result?: ProductionChangeResult
    resultLabel?: string
  }
  const isIdle = execution.status === 'IDLE'
  const isRunning = execution.status === 'RUNNING'
  const isDone = execution.status === 'DONE'
  const isRolledBack = execution.status === 'ROLLED_BACK'
  const steps = execution.steps.length > 0
    ? execution.steps
    : productionChangeExecutionStepSeeds.map((step, index) => ({
      ...step,
      status: isRunning && index === 0 ? 'RUNNING' as const : 'WAITING' as const,
    }))
  const lockObjectIds = execution.lockObjectIds ?? preview.lockObjectIds
  const resultLabel = execution.resultLabel ?? productionChangeResultLabels[execution.result ?? preview.result]
  const statusNotice = isIdle
    ? `
      <section class="rounded-md border bg-muted/20 px-4 py-3 text-sm">
        <p class="font-medium">当前尚未执行，变更尚未正式生效。</p>
        <p class="mt-1 text-muted-foreground">确认执行后，系统会在同一次操作内锁定处理范围并返回最终结果。</p>
      </section>
    `
    : isRunning
      ? `
        <section class="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p class="font-medium">${escapeHtml(getProductionChangeLockMessage())}</p>
          <p class="mt-1">执行期间，处理范围内的生产单和关联单据只能查看。</p>
        </section>
      `
      : isDone
        ? `
          <section class="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            执行完成，锁定已释放
          </section>
        `
        : `
          <section class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            已全部回滚，锁定已释放，本次没有生效
          </section>
        `

  return `
    <div class="space-y-6" data-production-change-execution>
      <header class="border-b pb-4">
        <p class="text-xs font-medium text-muted-foreground">第四步</p>
        <h2 class="mt-1 text-lg font-semibold">同步执行</h2>
        <p class="mt-2 text-sm font-medium">全部成功才生效</p>
      </header>

      <section class="grid gap-3 md:grid-cols-3" aria-label="执行前核对">
        <div class="border-l-4 border-l-primary bg-muted/30 px-4 py-3">
          <p class="text-xs text-muted-foreground">最终变更类型</p>
          <p class="mt-1 text-sm font-semibold">${escapeHtml(resultLabel)}</p>
        </div>
        <div class="border-l-4 border-l-primary bg-muted/30 px-4 py-3">
          <p class="text-xs text-muted-foreground">变更原因</p>
          <p class="mt-1 text-sm font-semibold">${escapeHtml(form.reason || '未填写')}</p>
        </div>
        <div class="border-l-4 border-l-primary bg-muted/30 px-4 py-3">
          <p class="text-xs text-muted-foreground">锁定对象数量</p>
          <p class="mt-1 text-sm font-semibold">${lockObjectIds.length} 个</p>
        </div>
      </section>

      ${statusNotice}

      ${isIdle || isRunning ? '' : `
        <section class="border-y py-4" aria-label="最终执行结果">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-xs font-medium text-muted-foreground">最终结果</p>
              <p class="mt-1 text-base font-semibold">${escapeHtml(resultLabel)}</p>
            </div>
            <p class="text-sm font-semibold">${execution.progress}%</p>
          </div>
          <p class="mt-3 text-sm ${isRolledBack ? 'text-red-700' : 'text-emerald-700'}">${escapeHtml(execution.message)}</p>
        </section>
      `}

      <section aria-label="本次同步操作结果明细">
        <h3 class="text-base font-semibold">本次同步操作结果明细</h3>
        <div class="mt-3 divide-y border-y">
          ${steps.map((step, index) => `
            <div class="flex min-h-12 items-center justify-between gap-3 py-3">
              <div class="flex items-center gap-3">
                <span class="flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">${index + 1}</span>
                <span class="text-sm font-medium">${escapeHtml(step.label)}</span>
              </div>
              <span class="text-xs font-medium ${step.status === 'ROLLED_BACK' ? 'text-red-700' : 'text-muted-foreground'}">${productionChangeExecutionStatusLabels[step.status]}</span>
            </div>
          `).join('')}
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-3">
        ${isDone ? '' : `
          <button
            type="button"
            class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            data-prod-action="execute-production-change"
            ${isRunning ? 'disabled' : ''}
          >${isRunning ? '执行中' : isRolledBack ? '重新执行' : '确认执行'}</button>
        `}
        ${isRunning ? '<span class="text-sm text-muted-foreground">本次同步操作正在完成，请勿重复执行。</span>' : ''}
      </div>

      ${isDone || isRunning ? '' : `
        <details class="border-t pt-3" data-production-change-failure-demo>
          <summary class="cursor-pointer text-sm text-muted-foreground">失败回滚演示</summary>
          <div class="mt-3">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="simulate-production-change-failure">演示全部回滚</button>
          </div>
        </details>
      `}
    </div>
  `
}

export function renderProductionChangeFormBody(
  step: ProductionChangeFormStep,
  form: ProductionChangeForm,
  options: ProductionChangeFormRenderOptions = {},
): string {
  const body = step === 'order'
    ? renderProductionChangeOrderStep(form)
    : step === 'content'
      ? renderProductionChangeContentStep(form, options)
      : step === 'handling'
        ? renderProductionChangeHandlingStep(form)
        : renderProductionChangeExecutionStep(form)

  return `
    <section class="min-h-[360px] rounded-lg border bg-card p-5" data-production-change-form-body="${escapeHtml(step)}">
      ${body}
      <div
        data-production-change-form-error
        class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        ${state.productionChangeFormError ? '' : 'hidden'}
      >${escapeHtml(state.productionChangeFormError)}</div>
    </section>
  `
}
