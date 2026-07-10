import { renderSteps } from '../../components/ui/steps.ts'
import {
  getProductionOrderChangeCurrentFacts,
  listProductionOrderTechPackRelations,
  type ProductionOrderChangeCurrentFacts,
} from '../../data/fcs/production-tech-pack-change-domain.ts'
import {
  buildMaterialReplacementAllocations,
  createFollowingOrderPlans,
  createQuantityLinesForOrder,
  listReplacementMaterialOptions,
} from '../../data/fcs/production-order-change-workflow.ts'
import { escapeHtml } from '../../utils.ts'
import { state } from './context.ts'

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
              ? rows.slice(0, 8).map((row) => `
                <tr>${row.map((cell) => `<td class="whitespace-nowrap px-3 py-2 align-top">${escapeHtml(cell)}</td>`).join('')}</tr>
              `).join('')
              : `<tr><td colspan="${headers.length}" class="px-3 py-4 text-muted-foreground">${escapeHtml(emptyText)}</td></tr>`}
          </tbody>
        </table>
      </div>
      ${rows.length > 8 ? `<p class="mt-2 text-xs text-muted-foreground">首屏显示 8 条，共 ${rows.length} 条。</p>` : ''}
    </section>
  `
}

function renderCurrentFactsSummary(facts: ProductionOrderChangeCurrentFacts): string {
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
        ['变更单号', '变更结果', '当前状态', '影响范围', '锁定状态', '事实说明'],
        facts.historyFacts.map((item) => [
          item.changeOrderNo,
          item.result,
          item.status,
          item.affectedScope,
          item.lockStatus,
          item.note,
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
      ${renderSteps({ steps: productionChangeSteps, current, className: 'min-w-[760px]' })}
    </section>
  `
}

export function renderProductionChangeOrderStep(form: ProductionChangeForm): string {
  const relations = listProductionOrderTechPackRelations()
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
        ? renderCurrentFactsSummary(facts)
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

function renderQuantityLine(line: ProductionChangeForm['quantityLines'][number]): string {
  const difference = line.targetQty - line.currentQty
  const differenceText = difference === 0
    ? '不变'
    : difference > 0
      ? `增加 ${difference} 件`
      : `减少 ${Math.abs(difference)} 件`
  const editableIdentity = line.isNew

  return `
    <tr data-production-change-quantity-line="${escapeHtml(line.id)}">
      <td class="px-3 py-3">
        ${editableIdentity
          ? `<input data-prod-field="productionChangeQuantitySkuCode" data-line-id="${escapeHtml(line.id)}" value="${escapeHtml(line.skuCode)}" class="w-32 rounded-md border px-2 py-1.5" placeholder="商品编码" />`
          : escapeHtml(line.skuCode)}
      </td>
      <td class="px-3 py-3">
        ${editableIdentity
          ? `<input data-prod-field="productionChangeQuantityColor" data-line-id="${escapeHtml(line.id)}" value="${escapeHtml(line.color)}" class="w-24 rounded-md border px-2 py-1.5" placeholder="颜色" />`
          : escapeHtml(line.color)}
      </td>
      <td class="px-3 py-3">
        ${editableIdentity
          ? `<input data-prod-field="productionChangeQuantitySize" data-line-id="${escapeHtml(line.id)}" value="${escapeHtml(line.size)}" class="w-20 rounded-md border px-2 py-1.5" placeholder="尺码" />`
          : escapeHtml(line.size)}
      </td>
      <td class="whitespace-nowrap px-3 py-3">${line.originalQty} 件</td>
      <td class="whitespace-nowrap px-3 py-3">${line.currentQty} 件</td>
      <td class="px-3 py-3">
        <input data-prod-field="productionChangeQuantityTargetQty" data-line-id="${escapeHtml(line.id)}" type="number" min="0" step="1" value="${line.targetQty}" class="w-24 rounded-md border px-2 py-1.5" />
      </td>
      <td class="whitespace-nowrap px-3 py-3">${escapeHtml(differenceText)}</td>
      <td class="whitespace-nowrap px-3 py-3">${line.targetQty === 0 ? '已取消' : line.isNew ? '新增' : '保留'}</td>
      <td class="px-3 py-3">
        ${line.isNew ? `<button type="button" class="text-sm text-destructive" data-prod-action="remove-production-change-quantity-line" data-line-id="${escapeHtml(line.id)}">删除</button>` : '<span class="text-xs text-muted-foreground">历史行保留</span>'}
      </td>
    </tr>
  `
}

export function renderQuantityChangeForm(form: ProductionChangeForm): string {
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
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="add-production-change-quantity-line">
          <i data-lucide="plus" class="mr-1 inline h-4 w-4"></i>新增明细
        </button>
      </div>
      <div class="overflow-x-auto rounded-md border">
        <table class="min-w-[1120px] text-left text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>${['商品编码', '颜色', '尺码', '原需求', '当前需求', '变更后数量', '变化', '状态', '操作'].map((title) => `<th class="whitespace-nowrap px-3 py-2 font-medium">${title}</th>`).join('')}</tr>
          </thead>
          <tbody class="divide-y">
            ${quantityLines.length > 0
              ? quantityLines.map(renderQuantityLine).join('')
              : '<tr><td colspan="9" class="px-3 py-6 text-center text-muted-foreground">暂无需求明细，可新增一条明细。</td></tr>'}
          </tbody>
        </table>
      </div>
      <template data-production-change-new-quantity-line-template>
        <input data-prod-field="productionChangeQuantitySkuCode" data-line-id="NEW" />
        <input data-prod-field="productionChangeQuantityColor" data-line-id="NEW" />
        <input data-prod-field="productionChangeQuantitySize" data-line-id="NEW" />
      </template>
      <div class="grid gap-3 border-t pt-4 text-sm sm:grid-cols-3">
        <p><span class="text-muted-foreground">原需求合计：</span><strong>${originalTotal} 件</strong></p>
        <p><span class="text-muted-foreground">当前需求合计：</span><strong>${currentTotal} 件</strong></p>
        <p><span class="text-muted-foreground">调整后自动汇总：</span><strong>${targetTotal} 件</strong></p>
      </div>
      <label class="block space-y-1 text-sm">
        <span class="font-medium">变更原因</span>
        <textarea data-prod-field="productionChangeReason" class="min-h-24 w-full rounded-md border px-3 py-2" placeholder="说明本次调整原因">${escapeHtml(form.reason)}</textarea>
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
): string {
  return `
    <button type="button" class="min-h-10 flex-1 border px-3 py-2 text-sm first:rounded-l-md last:rounded-r-md ${active ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}"
      data-prod-action="${action}" data-${dataName}="${dataValue}">${label}</button>
  `
}

export function renderMaterialReplacementForm(form: ProductionChangeForm): string {
  const replacement = form.materialReplacement
  const materialOptions = listReplacementMaterialOptions()
  const fallbackAllocations = buildMaterialReplacementAllocations(form.productionOrderId, replacement.confirmedProductionQty)
  const allocations = replacement.allocations.length > 0 ? replacement.allocations : fallbackAllocations
  const totalDemandQty = allocations.reduce((sum, line) => sum + line.demandQty, 0)
  const calculatedSuggestion = allocations.reduce((sum, line) => sum + line.suggestedReplacementQty, 0)
  const suggestedProductionQty = replacement.suggestedProductionQty > 0
    ? replacement.suggestedProductionQty
    : calculatedSuggestion
  const followingOrders = replacement.followingOrders.length > 0
    ? replacement.followingOrders
    : createFollowingOrderPlans(form.productionOrderId)

  return `
    <section class="space-y-5" data-production-change-form-type="MATERIAL_REPLACEMENT">
      <div>
        <h2 class="text-base font-semibold">替换物料</h2>
        <p class="mt-1 text-sm text-muted-foreground">这里调整的是新面料用于多少件生产，不是修改需求明细，也不是填写面料米数。</p>
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="space-y-1 text-sm">
          <span class="font-medium">原面料</span>
          <select data-prod-field="productionChangeOriginalMaterialId" class="w-full rounded-md border px-3 py-2">
            <option value="">请选择原面料</option>
            ${renderOptions(materialOptions, replacement.originalMaterialId)}
          </select>
        </label>
        <label class="space-y-1 text-sm">
          <span class="font-medium">新面料</span>
          <select data-prod-field="productionChangeReplacementMaterialId" class="w-full rounded-md border px-3 py-2">
            <option value="">请选择新面料</option>
            ${renderOptions(materialOptions, replacement.replacementMaterialId)}
          </select>
        </label>
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <fieldset class="space-y-2">
          <legend class="text-sm font-medium">替换方式</legend>
          <div class="flex">
            ${renderSegmentButton('剩余数量替换', 'set-production-change-replacement-mode', 'mode', 'REMAINING', replacement.replacementMode === 'REMAINING')}
            ${renderSegmentButton('全部数量替换', 'set-production-change-replacement-mode', 'mode', 'FULL', replacement.replacementMode === 'FULL')}
          </div>
        </fieldset>
        <fieldset class="space-y-2">
          <legend class="text-sm font-medium">处理范围</legend>
          <div class="flex">
            ${renderSegmentButton('只处理当前生产单', 'set-production-change-scope', 'scope', 'CURRENT_ONLY', replacement.scope === 'CURRENT_ONLY')}
            ${renderSegmentButton('后续生产单也替换', 'set-production-change-scope', 'scope', 'CURRENT_AND_FOLLOWING', replacement.scope === 'CURRENT_AND_FOLLOWING')}
          </div>
        </fieldset>
      </div>
      <div class="grid gap-4 border-y py-4 md:grid-cols-2">
        <div>
          <p class="text-sm text-muted-foreground">建议替换生产数量</p>
          <p class="mt-1 text-2xl font-semibold">${suggestedProductionQty} 件</p>
          <p class="mt-1 text-xs text-muted-foreground">系统根据当前生产事实自动计算。</p>
        </div>
        <label class="space-y-1 text-sm">
          <span class="font-medium">跟单确认用于生产的数量</span>
          <input data-prod-field="productionChangeConfirmedProductionQty" type="number" min="0" max="${totalDemandQty}" step="1" value="${replacement.confirmedProductionQty}" class="w-full rounded-md border px-3 py-2" />
          <span class="block text-xs text-muted-foreground">最多 ${totalDemandQty} 件，仅填写成衣生产件数。</span>
        </label>
      </div>
      <div>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-prod-action="toggle-production-change-allocation">
          调整颜色尺码分配
          <i data-lucide="chevron-down" class="ml-1 inline h-4 w-4"></i>
        </button>
        ${form.advancedAllocationOpen ? `
          <div class="mt-3 overflow-x-auto rounded-md border">
            <table class="min-w-[760px] text-left text-sm">
              <thead class="bg-muted/40 text-xs text-muted-foreground">
                <tr>${['商品编码', '颜色', '尺码', '需求数量', '系统建议', '确认生产数量'].map((title) => `<th class="px-3 py-2 font-medium">${title}</th>`).join('')}</tr>
              </thead>
              <tbody class="divide-y">
                ${allocations.map((line) => `
                  <tr>
                    <td class="px-3 py-3">${escapeHtml(line.skuCode)}</td>
                    <td class="px-3 py-3">${escapeHtml(line.color)}</td>
                    <td class="px-3 py-3">${escapeHtml(line.size)}</td>
                    <td class="px-3 py-3">${line.demandQty} 件</td>
                    <td class="px-3 py-3">${line.suggestedReplacementQty} 件</td>
                    <td class="px-3 py-3"><input data-prod-field="productionChangeAllocationQty" data-allocation-id="${escapeHtml(line.id)}" type="number" min="0" max="${line.demandQty}" step="1" value="${line.confirmedReplacementQty}" class="w-24 rounded-md border px-2 py-1.5" /></td>
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
        <textarea data-prod-field="productionChangeReason" class="min-h-24 w-full rounded-md border px-3 py-2" placeholder="说明本次替换原因">${escapeHtml(form.reason)}</textarea>
      </label>
    </section>
  `
}

function renderProductionChangeContentStep(form: ProductionChangeForm): string {
  return `
    <div class="space-y-5">
      <div class="flex max-w-2xl">
        ${renderSegmentButton('修改生产单需求数量', 'set-production-change-type', 'change-type', 'QUANTITY_CHANGE', form.changeType === 'QUANTITY_CHANGE')}
        ${renderSegmentButton('替换物料', 'set-production-change-type', 'change-type', 'MATERIAL_REPLACEMENT', form.changeType === 'MATERIAL_REPLACEMENT')}
      </div>
      ${form.changeType === 'MATERIAL_REPLACEMENT'
        ? renderMaterialReplacementForm(form)
        : renderQuantityChangeForm(form)}
    </div>
  `
}

function renderPendingStep(title: string, description: string): string {
  return `
    <section class="flex min-h-[240px] items-center justify-center rounded-md border border-dashed bg-muted/20 px-6 text-center">
      <div class="max-w-xl">
        <h2 class="text-base font-semibold">${escapeHtml(title)}</h2>
        <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(description)}</p>
      </div>
    </section>
  `
}

export function renderProductionChangeFormBody(
  step: ProductionChangeFormStep,
  form: ProductionChangeForm,
): string {
  const body = step === 'order'
    ? renderProductionChangeOrderStep(form)
    : step === 'content'
      ? renderProductionChangeContentStep(form)
      : step === 'handling'
        ? renderPendingStep('确认处理方案', '第三步将在后续任务中接入系统处理汇总和必要判断。')
        : renderPendingStep('同步执行', '第四步将在后续任务中接入一次确认、同步提交和失败回滚。')

  return `
    <section class="min-h-[360px] rounded-lg border bg-card p-5" data-production-change-form-body="${escapeHtml(step)}">
      ${body}
      ${state.productionChangeFormError
        ? `<div class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(state.productionChangeFormError)}</div>`
        : ''}
    </section>
  `
}
