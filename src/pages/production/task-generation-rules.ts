import { escapeHtml } from '../../utils.ts'
import {
  buildTaskGenerationPreview,
  getProductionTaskGenerationRuleById,
  listProductionTaskGenerationRuleLogs,
  listProductionTaskGenerationRules,
  type ProductionTaskGenerationRule,
} from '../../data/fcs/production-task-generation-rules.ts'
import { productionOrders } from '../../data/fcs/production-orders.ts'
import { productionDemands } from '../../data/fcs/production-demands.ts'
import { listFactoryMasterRecords } from '../../data/fcs/factory-master-store.ts'
import { listProcessDefinitions } from '../../data/fcs/process-craft-dict.ts'

const RULE_LIST_PATH = '/fcs/production/task-generation-rules'

interface SelectOption {
  value: string
  label: string
}

function renderBadge(label: string, tone = 'slate'): string {
  const classes: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }
  return `<span class="inline-flex items-center rounded border px-2 py-0.5 text-xs ${classes[tone] ?? classes.slate}">${escapeHtml(label)}</span>`
}

function getRuleAcceptanceLabel(rule: ProductionTaskGenerationRule): string {
  if (rule.generatedTaskUnitType === 'WHOLE_ORDER_TASK') return '整单'
  if (rule.generatedTaskUnitType === 'COMBINED_PROCESS_TASK') return '连续工序'
  if (rule.generatedTaskUnitType === 'INDEPENDENT_WORK_ORDER_TASK') return '独立加工单'
  return '单工序'
}

function getRemainingStrategyLabel(rule: ProductionTaskGenerationRule): string {
  if (rule.remainingProcessStrategy === 'MERGE_TO_WHOLE_ORDER_TASK') return '合并为整单任务'
  if (rule.remainingProcessStrategy === 'MERGE_TO_COMBINED_TASK') return '合并为组合任务'
  return '默认按工序'
}

function getFactoryConditionLabel(rule: ProductionTaskGenerationRule): string {
  if (rule.factoryConditionMode === 'REQUIRE_SPECIFIED_FACTORY') return '要求指定工厂'
  if (rule.factoryConditionMode === 'RECOMMEND_IF_EMPTY') return '未指定可推荐'
  return '不要求工厂条件'
}

function getSaleTypeOptionsFromDemands(): SelectOption[] {
  return Array.from(new Set(productionDemands.map((demand) => demand.saleType)))
    .map((saleType) => ({ value: saleType, label: saleType }))
}

function getFactoryOptionsFromProfile(): SelectOption[] {
  return listFactoryMasterRecords()
    .map((factory) => ({ value: factory.id, label: `${factory.id} · ${factory.name}` }))
}

function getProcessOptionsFromCraftDict(): SelectOption[] {
  return listProcessDefinitions()
    .filter((definition) => definition.isActive)
    .map((definition) => ({
      value: definition.processCode,
      label: definition.processName,
    }))
}

function optionLabels(options: SelectOption[], values: string[]): string[] {
  const selected = new Set(values)
  return options.filter((option) => selected.has(option.value)).map((option) => option.label)
}

function renderMultiSelectDropdown(input: {
  label: string
  field: string
  options: SelectOption[]
  selectedValues: string[]
  disabled?: boolean
  className?: string
}): string {
  const selected = new Set(input.selectedValues)
  const selectedText = optionLabels(input.options, input.selectedValues).join('、') || '请选择'
  const disabledAttrs = input.disabled ? 'disabled' : ''
  return `
    <label class="block space-y-1 ${input.className ?? ''}" data-field="${escapeHtml(input.field)}">
      <span class="text-xs text-muted-foreground">${escapeHtml(input.label)}</span>
      <details class="relative ${input.disabled ? 'pointer-events-none opacity-70' : ''}">
        <summary class="flex min-h-9 w-full cursor-pointer list-none items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
          <span class="min-w-0 flex-1 whitespace-normal break-words">${escapeHtml(selectedText)}</span>
          <span class="ml-2 text-muted-foreground">⌄</span>
        </summary>
        <div class="absolute z-20 mt-1 max-h-72 w-full min-w-[360px] overflow-y-auto rounded-md border bg-background p-2 shadow-lg">
          ${input.options.map((option) => `
            <label class="flex items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
              <input type="checkbox" value="${escapeHtml(option.value)}" ${selected.has(option.value) ? 'checked' : ''} ${disabledAttrs} class="mt-0.5 h-4 w-4 rounded border" />
              <span class="min-w-0 whitespace-normal break-words">${escapeHtml(option.label)}</span>
            </label>
          `).join('')}
        </div>
      </details>
    </label>
  `
}

function formatProcessCodes(codes: string[]): string {
  const labels = optionLabels(getProcessOptionsFromCraftDict(), codes)
  return labels.join('、') || '无'
}

function renderResultStats(rules: ProductionTaskGenerationRule[]): string {
  const stats = [
    { label: '搜索结果', value: rules.length, className: 'text-slate-900' },
    { label: '启用', value: rules.filter((rule) => rule.enabled).length, className: 'text-blue-600' },
    { label: 'KOL规则', value: rules.filter((rule) => rule.saleTypes.some((saleType) => saleType.includes('KOL'))).length, className: 'text-rose-600' },
    { label: '连续工序', value: rules.filter((rule) => rule.generatedTaskUnitType === 'COMBINED_PROCESS_TASK').length, className: 'text-orange-600' },
    { label: '整单承接', value: rules.filter((rule) => rule.generatedTaskUnitType === 'WHOLE_ORDER_TASK').length, className: 'text-violet-600' },
    { label: '进入自动分配', value: rules.filter((rule) => rule.allowAutoDispatch).length, className: 'text-emerald-600' },
  ]

  return `
    <section class="rounded-[18px] border bg-background p-2 shadow-sm">
      <div class="flex flex-wrap gap-2">
        ${stats.map((stat) => `
          <div class="flex h-11 items-center gap-2 rounded-lg border bg-card px-4 shadow-sm">
            <span class="text-sm text-muted-foreground">${escapeHtml(stat.label)}:</span>
            <span class="text-xl font-semibold ${stat.className}">${escapeHtml(String(stat.value))}</span>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

function renderFilters(): string {
  return `
    <section class="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5">
      <input class="h-9 rounded-md border bg-background px-3 text-sm" placeholder="规则名称 / 工厂名 / 任务名称" />
      <select class="h-9 rounded-md border bg-background px-3 text-sm"><option>全部状态</option><option>启用</option><option>停用</option></select>
      <select class="h-9 rounded-md border bg-background px-3 text-sm"><option>全部售卖类型</option><option>KOL样衣</option><option>KOL样品小单</option><option>普通大货</option><option>快反小单</option></select>
      <select class="h-9 rounded-md border bg-background px-3 text-sm"><option>全部处理方式</option><option>按工序生成</option><option>连续工序合并</option><option>整单承接</option></select>
      <select class="h-9 rounded-md border bg-background px-3 text-sm"><option>全部工厂条件</option><option>要求指定</option><option>可系统推荐</option><option>不要求</option></select>
    </section>
  `
}

function renderRuleTable(rules: ProductionTaskGenerationRule[]): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <h2 class="text-base font-semibold">规则列表</h2>
        <p class="mt-1 text-sm text-muted-foreground">一条规则决定生产单拆解任务时生成哪些任务单元。</p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[980px] text-sm">
          <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">规则名称</th>
              <th class="px-3 py-2 text-left font-medium">适用范围</th>
              <th class="px-3 py-2 text-left font-medium">生成方式</th>
              <th class="px-3 py-2 text-left font-medium">独立拆出</th>
              <th class="px-3 py-2 text-left font-medium">PDA / 自动分配</th>
              <th class="px-3 py-2 text-left font-medium">最近更新</th>
              <th class="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rules.map((rule) => `
              <tr class="border-b last:border-b-0">
                <td class="px-3 py-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <a href="${RULE_LIST_PATH}/${encodeURIComponent(rule.ruleId)}" class="font-medium text-blue-700 hover:underline">${escapeHtml(rule.ruleName)}</a>
                    ${renderBadge(rule.enabled ? '启用' : '停用', rule.enabled ? 'green' : 'slate')}
                  </div>
                  <div class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(rule.ruleNo)} · 优先级 ${escapeHtml(String(rule.priority))}</div>
                </td>
                <td class="px-3 py-3">
                  <div class="flex flex-wrap gap-1">${rule.saleTypes.slice(0, 4).map((item) => renderBadge(item)).join('')}${rule.saleTypes.length > 4 ? renderBadge(`+${rule.saleTypes.length - 4}`) : ''}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(getFactoryConditionLabel(rule))}</div>
                </td>
                <td class="px-3 py-3">
                  <div>${renderBadge(getRuleAcceptanceLabel(rule), rule.generatedTaskUnitType === 'WHOLE_ORDER_TASK' ? 'amber' : 'slate')}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(getRemainingStrategyLabel(rule))} · ${escapeHtml(rule.taskNameTemplate)}</div>
                </td>
                <td class="px-3 py-3">${escapeHtml(formatProcessCodes(rule.independentProcessCodes))}</td>
                <td class="px-3 py-3">
                  <div>${escapeHtml(rule.pdaStepTemplateCode === 'SIMPLE_FIVE_STEP' ? '简化5步' : '默认任务步骤')}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(rule.allowAutoDispatch ? '进入自动分配' : '不进入自动分配')}</div>
                </td>
                <td class="px-3 py-3">
                  <div class="font-mono text-xs">${escapeHtml(rule.updatedAt)}</div>
                  <div class="text-xs text-muted-foreground">${escapeHtml(rule.updatedBy)}</div>
                </td>
                <td class="px-3 py-3">
                  <div class="flex flex-wrap gap-2">
                    <a href="${RULE_LIST_PATH}/${encodeURIComponent(rule.ruleId)}" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted">详情</a>
                    <a href="${RULE_LIST_PATH}/${encodeURIComponent(rule.ruleId)}/edit" class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted">编辑</a>
                    <button type="button" onclick="document.getElementById('task-generation-rule-logs-${escapeHtml(rule.ruleId)}')?.showModal()" class="h-8 rounded-md border px-2 text-xs hover:bg-muted">查看日志</button>
                    <button type="button" onclick="document.getElementById('task-generation-rule-preview')?.showModal()" class="h-8 rounded-md border px-2 text-xs hover:bg-muted">模拟</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderRuleLogRows(ruleId: string): string {
  const logs = listProductionTaskGenerationRuleLogs(ruleId)
  return logs.length === 0 ? `
    <div class="px-4 py-8 text-sm text-muted-foreground">暂无日志。</div>
  ` : `
    <div class="overflow-x-auto">
      <table class="w-full min-w-[760px] text-sm">
        <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-medium">时间</th>
            <th class="px-3 py-2 text-left font-medium">操作</th>
            <th class="px-3 py-2 text-left font-medium">操作人</th>
            <th class="px-3 py-2 text-left font-medium">日志内容</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map((log) => `
            <tr class="border-b last:border-b-0">
              <td class="px-3 py-3 font-mono text-xs">${escapeHtml(log.operatedAt)}</td>
              <td class="px-3 py-3">${escapeHtml(log.action)}</td>
              <td class="px-3 py-3">${escapeHtml(log.operator)}</td>
              <td class="px-3 py-3">${escapeHtml(log.detail)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderRuleLogDialog(rule: ProductionTaskGenerationRule): string {
  return `
    <dialog id="task-generation-rule-logs-${escapeHtml(rule.ruleId)}" class="w-[min(860px,calc(100vw-32px))] rounded-lg border bg-background p-0 shadow-2xl backdrop:bg-black/35">
      <div class="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 class="text-base font-semibold">规则日志</h2>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(rule.ruleName)} / ${escapeHtml(rule.ruleNo)}</p>
        </div>
        <button type="button" onclick="this.closest('dialog')?.close()" class="rounded-md border px-2 py-1 text-xs hover:bg-muted">关闭</button>
      </div>
      <div class="max-h-[70vh] overflow-y-auto">
        ${renderRuleLogRows(rule.ruleId)}
      </div>
    </dialog>
  `
}

function renderPreviewSample(): string {
  const sampleOrder = productionOrders.find((order) => order.demandSnapshot.saleType.includes('KOL'))
  if (!sampleOrder) return ''
  const preview = buildTaskGenerationPreview(sampleOrder.productionOrderId)
  return `
    <dialog id="task-generation-rule-preview" class="m-0 ml-auto h-screen max-h-none w-[min(860px,100vw)] border-l bg-background p-0 shadow-2xl backdrop:bg-black/35">
      <div class="flex h-full flex-col">
        <div class="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 class="text-base font-semibold">规则模拟预览</h2>
            <p class="mt-1 text-sm text-muted-foreground">示例生产单：${escapeHtml(preview.productionOrderNo)} / ${escapeHtml(preview.saleType)} / 命中：${escapeHtml(preview.matchedRuleName || '未命中')}</p>
          </div>
          <div class="flex items-center gap-2">
            ${renderBadge(preview.statusReason, preview.status === 'READY' ? 'green' : 'amber')}
            <button type="button" onclick="this.closest('dialog')?.close()" class="rounded-md border px-2 py-1 text-xs hover:bg-muted">关闭</button>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-5">
          <div class="grid gap-3 text-sm md:grid-cols-4">
            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">选择生产单</span>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm">
                ${productionOrders.slice(0, 8).map((order) => `<option ${order.productionOrderId === sampleOrder.productionOrderId ? 'selected' : ''}>${escapeHtml(order.productionOrderNo || order.productionOrderId)}</option>`).join('')}
              </select>
            </label>
            <div class="rounded-md border bg-muted/10 px-3 py-2">
              <div class="text-xs text-muted-foreground">指定工厂</div>
              <div class="mt-1">${escapeHtml(sampleOrder.mainFactorySnapshot.name)}</div>
            </div>
            <div class="rounded-md border bg-muted/10 px-3 py-2">
              <div class="text-xs text-muted-foreground">工厂承接方式</div>
              <div class="mt-1">${escapeHtml(preview.generatedUnits.some((unit) => unit.taskUnitType === 'WHOLE_ORDER_TASK') ? '支持整单承接' : '按工序承接')}</div>
            </div>
            <div class="rounded-md border bg-muted/10 px-3 py-2">
              <div class="text-xs text-muted-foreground">不可生成原因</div>
              <div class="mt-1">${escapeHtml(preview.blockedReasons.join('、') || '无')}</div>
            </div>
          </div>
          <div class="mt-3 overflow-x-auto rounded-lg border">
            <table class="w-full min-w-[880px] text-sm">
              <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">生成对象</th>
                  <th class="px-3 py-2 text-left font-medium">类型</th>
                  <th class="px-3 py-2 text-left font-medium">覆盖工序</th>
                  <th class="px-3 py-2 text-left font-medium">承接工厂</th>
                  <th class="px-3 py-2 text-left font-medium">自动分配</th>
                  <th class="px-3 py-2 text-left font-medium">PDA步骤</th>
                </tr>
              </thead>
              <tbody>
                ${preview.generatedUnits.map((unit) => `
                  <tr class="border-b last:border-b-0">
                    <td class="px-3 py-2 font-medium">${escapeHtml(unit.taskName)}</td>
                    <td class="px-3 py-2">${escapeHtml(unit.taskUnitType)}</td>
                    <td class="px-3 py-2">${escapeHtml(unit.coveredProcesses.map((item) => item.craftName || item.processName).join('、') || '—')}</td>
                    <td class="px-3 py-2">${escapeHtml(unit.assignmentTargetFactoryName || '后续分配')}</td>
                    <td class="px-3 py-2">${escapeHtml(unit.allowAutoDispatch ? '进入' : '不进入')}</td>
                    <td class="px-3 py-2">${escapeHtml(unit.pdaSteps.join(' → '))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </dialog>
  `
}

function buildNewRuleDraft(): ProductionTaskGenerationRule {
  return {
    ruleId: 'NEW',
    ruleNo: '保存后生成',
    ruleName: '',
    enabled: true,
    priority: 90,
    description: '',
    saleTypes: [],
    factoryConditionMode: 'REQUIRE_SPECIFIED_FACTORY',
    factoryIds: [],
    requireFactoryAcceptanceMode: true,
    requiredAcceptanceMode: 'WHOLE_ORDER',
    independentProcessCodes: ['PRINT', 'DYE'],
    remainingProcessStrategy: 'MERGE_TO_WHOLE_ORDER_TASK',
    mergeProcessCodes: 'ALL_EXCEPT_INDEPENDENT',
    generatedTaskUnitType: 'WHOLE_ORDER_TASK',
    taskNameTemplate: '',
    handoverReceiverKind: 'WAREHOUSE',
    handoverReceiverName: '仓库',
    pdaStepTemplateCode: 'SIMPLE_FIVE_STEP',
    allowAutoDispatch: false,
    createdAt: '',
    updatedAt: '',
    updatedBy: '',
  }
}

function renderRuleFormPage(rule: ProductionTaskGenerationRule, mode: 'new' | 'edit'): string {
  const title = mode === 'new' ? '新增规则' : '编辑规则'
  const saleTypeOptions = getSaleTypeOptionsFromDemands()
  const factoryOptions = getFactoryOptionsFromProfile()
  const processOptions = getProcessOptionsFromCraftDict()

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">${escapeHtml(title)}</h1>
          <p class="mt-1 text-sm text-muted-foreground">维护规则触发条件、任务单元生成方式和 PDA 步骤。</p>
        </div>
        <div class="flex gap-2">
          <a href="${RULE_LIST_PATH}" class="inline-flex rounded-md border px-3 py-2 text-sm hover:bg-muted">返回列表</a>
        </div>
      </header>

      <section class="grid gap-4 xl:grid-cols-2">
        <fieldset class="space-y-3 rounded-lg border bg-card p-4">
          <legend class="px-1 text-sm font-medium">基础信息</legend>
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">规则名称</span>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(rule.ruleName)}" placeholder="请输入规则名称" />
          </label>
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">规则编号</span>
            <input readonly class="h-9 w-full rounded-md border bg-muted px-3 text-sm text-muted-foreground" value="${escapeHtml(rule.ruleNo)}" />
          </label>
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">规则说明</span>
            <textarea class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请输入规则说明">${escapeHtml(rule.description || '')}</textarea>
          </label>
        </fieldset>

        <fieldset class="space-y-3 rounded-lg border bg-card p-4">
          <legend class="px-1 text-sm font-medium">触发条件</legend>
          <div class="grid gap-3 lg:grid-cols-2">
            ${renderMultiSelectDropdown({ label: '适用售卖类型', field: 'sale-types', options: saleTypeOptions, selectedValues: rule.saleTypes, className: 'lg:col-span-2' })}
            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">是否要求指定工厂</span>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option ${rule.factoryConditionMode === 'REQUIRE_SPECIFIED_FACTORY' ? 'selected' : ''}>要求指定</option>
                <option ${rule.factoryConditionMode === 'RECOMMEND_IF_EMPTY' ? 'selected' : ''}>未指定可推荐</option>
                <option ${rule.factoryConditionMode === 'NOT_REQUIRED' ? 'selected' : ''}>不要求</option>
              </select>
            </label>
            <label class="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" ${rule.requireFactoryAcceptanceMode ? 'checked' : ''} class="h-4 w-4 rounded border" />
              工厂必须支持承接方式
            </label>
            ${renderMultiSelectDropdown({ label: '指定工厂', field: 'factory-ids', options: factoryOptions, selectedValues: rule.factoryIds, className: 'lg:col-span-2' })}
          </div>
        </fieldset>

        <fieldset class="space-y-3 rounded-lg border bg-card p-4">
          <legend class="px-1 text-sm font-medium">工序处理</legend>
          ${renderMultiSelectDropdown({ label: '独立拆出工序', field: 'independent-process-codes', options: processOptions, selectedValues: rule.independentProcessCodes })}
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">其余工序处理方式</span>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option>${escapeHtml(getRemainingStrategyLabel(rule))}</option>
            </select>
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" class="h-4 w-4 rounded border" />
            是否允许空覆盖
          </label>
        </fieldset>

        <fieldset class="space-y-3 rounded-lg border bg-card p-4">
          <legend class="px-1 text-sm font-medium">任务单元设置</legend>
          <div class="grid gap-3 lg:grid-cols-2">
            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">任务类型</span>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm"><option>${escapeHtml(getRuleAcceptanceLabel(rule))}</option></select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">任务名称模板</span>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(rule.taskNameTemplate)}" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">承接工厂来源</span>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm"><option>生产单指定工厂</option><option>规则默认工厂</option><option>后续分配</option></select>
            </label>
            <label class="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" ${rule.allowAutoDispatch ? 'checked' : ''} class="h-4 w-4 rounded border" />
              是否进入非车缝自动分配
            </label>
          </div>
        </fieldset>

        <fieldset class="space-y-3 rounded-lg border bg-card p-4 xl:col-span-2">
          <legend class="px-1 text-sm font-medium">PDA执行设置</legend>
          <div class="grid gap-3 text-sm md:grid-cols-5">
            ${['领料', '开工', '关键节点上报', '交出', '完工'].map((step) => `
              <label class="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                <input type="checkbox" checked disabled class="h-4 w-4 rounded border" />
                ${escapeHtml(step)}
              </label>
            `).join('')}
          </div>
        </fieldset>
      </section>

      <div class="sticky bottom-0 flex justify-end gap-2 border-t bg-background/95 px-1 py-3">
        <a href="${RULE_LIST_PATH}" class="inline-flex rounded-md border px-3 py-2 text-sm hover:bg-muted">取消</a>
        <a href="${RULE_LIST_PATH}" class="inline-flex rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">保存</a>
      </div>
    </div>
  `
}

function renderDetailItem(label: string, value: string): string {
  return `
    <div class="rounded-md border bg-muted/10 px-3 py-2">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 whitespace-pre-wrap break-words text-sm">${escapeHtml(value || '无')}</div>
    </div>
  `
}

function renderRuleDetailPage(rule: ProductionTaskGenerationRule): string {
  const saleTypes = optionLabels(getSaleTypeOptionsFromDemands(), rule.saleTypes).join('、')
  const factories = optionLabels(getFactoryOptionsFromProfile(), rule.factoryIds).join('、') || '后续分配'
  const processes = formatProcessCodes(rule.independentProcessCodes)
  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">规则详情</h1>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(rule.ruleName)} / ${escapeHtml(rule.ruleNo)}</p>
        </div>
        <div class="flex gap-2">
          <a href="${RULE_LIST_PATH}" class="inline-flex rounded-md border px-3 py-2 text-sm hover:bg-muted">返回列表</a>
          <a href="${RULE_LIST_PATH}/${encodeURIComponent(rule.ruleId)}/edit" class="inline-flex rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">编辑规则</a>
        </div>
      </header>

      <section class="grid gap-4 xl:grid-cols-2">
        <div class="space-y-3 rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">基础信息</h2>
          <div class="grid gap-3 md:grid-cols-2">
            ${renderDetailItem('规则名称', rule.ruleName)}
            ${renderDetailItem('规则编号', rule.ruleNo)}
            ${renderDetailItem('优先级', String(rule.priority))}
            <div class="rounded-md border bg-muted/10 px-3 py-2">
              <div class="text-xs text-muted-foreground">状态</div>
              <div class="mt-1">${renderBadge(rule.enabled ? '启用' : '停用', rule.enabled ? 'green' : 'slate')}</div>
            </div>
            <div class="md:col-span-2">${renderDetailItem('规则说明', rule.description || '无')}</div>
          </div>
        </div>

        <div class="space-y-3 rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">触发条件</h2>
          <div class="grid gap-3 md:grid-cols-2">
            <div class="md:col-span-2">${renderDetailItem('适用售卖类型', saleTypes)}</div>
            ${renderDetailItem('工厂条件', getFactoryConditionLabel(rule))}
            ${renderDetailItem('工厂承接要求', rule.requireFactoryAcceptanceMode ? '必须支持承接方式' : '不校验承接方式')}
            <div class="md:col-span-2">${renderDetailItem('指定工厂', factories)}</div>
          </div>
        </div>

        <div class="space-y-3 rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">工序处理</h2>
          <div class="grid gap-3 md:grid-cols-2">
            <div class="md:col-span-2">${renderDetailItem('独立拆出工序', processes)}</div>
            ${renderDetailItem('其余工序处理方式', getRemainingStrategyLabel(rule))}
            ${renderDetailItem('覆盖方式', rule.mergeProcessCodes === 'ALL_EXCEPT_INDEPENDENT' ? '除独立拆出工序外全部覆盖' : rule.mergeProcessCodes.length > 0 ? formatProcessCodes(rule.mergeProcessCodes) : '不合并覆盖')}
          </div>
        </div>

        <div class="space-y-3 rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">任务单元设置</h2>
          <div class="grid gap-3 md:grid-cols-2">
            ${renderDetailItem('任务类型', getRuleAcceptanceLabel(rule))}
            ${renderDetailItem('任务名称模板', rule.taskNameTemplate)}
            ${renderDetailItem('承接工厂来源', '生产单指定工厂')}
            ${renderDetailItem('自动分配', rule.allowAutoDispatch ? '进入非车缝自动分配' : '不进入自动分配')}
          </div>
        </div>

        <div class="space-y-3 rounded-lg border bg-card p-4 xl:col-span-2">
          <h2 class="text-base font-semibold">PDA执行设置</h2>
          <div class="flex flex-wrap gap-2">
            ${['领料', '开工', '关键节点上报', '交出', '完工'].map((step) => renderBadge(step, 'blue')).join('')}
          </div>
        </div>
      </section>
    </div>
  `
}

function renderRuleNotFoundPage(ruleId: string): string {
  return `
    <div class="space-y-4">
      <a href="${RULE_LIST_PATH}" class="inline-flex rounded-md border px-3 py-2 text-sm hover:bg-muted">返回列表</a>
      <section class="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
        未找到规则：${escapeHtml(ruleId)}
      </section>
    </div>
  `
}

export function renderProductionTaskGenerationRulesPage(): string {
  const rules = listProductionTaskGenerationRules()

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">生产单任务生成规则</h1>
          <p class="mt-1 text-sm text-muted-foreground">配置生产单拆解任务时的任务单元生成方式。规则先于任务清单、自动分配配置执行。</p>
        </div>
        <div class="flex gap-2">
          <button type="button" onclick="document.getElementById('task-generation-rule-preview')?.showModal()" class="rounded-md border px-3 py-2 text-sm hover:bg-muted">规则模拟</button>
          <a href="${RULE_LIST_PATH}/new" class="inline-flex rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">新增规则</a>
        </div>
      </header>

      ${renderFilters()}
      ${renderResultStats(rules)}
      ${renderRuleTable(rules)}
      ${renderPreviewSample()}
      ${rules.map((rule) => renderRuleLogDialog(rule)).join('')}
    </div>
  `
}

export function renderProductionTaskGenerationRuleCreatePage(): string {
  return renderRuleFormPage(buildNewRuleDraft(), 'new')
}

export function renderProductionTaskGenerationRuleEditPage(ruleId: string): string {
  const rule = getProductionTaskGenerationRuleById(ruleId)
  return rule ? renderRuleFormPage(rule, 'edit') : renderRuleNotFoundPage(ruleId)
}

export function renderProductionTaskGenerationRuleDetailPage(ruleId: string): string {
  const rule = getProductionTaskGenerationRuleById(ruleId)
  return rule ? renderRuleDetailPage(rule) : renderRuleNotFoundPage(ruleId)
}
