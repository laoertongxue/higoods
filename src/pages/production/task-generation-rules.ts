import { escapeHtml } from '../../utils.ts'
import {
  buildTaskGenerationPreview,
  listProductionTaskGenerationRules,
  type ProductionTaskGenerationRule,
} from '../../data/fcs/production-task-generation-rules.ts'
import { productionOrders } from '../../data/fcs/production-orders.ts'

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

function renderStatCard(label: string, value: string | number, hint: string): string {
  return `
    <article class="rounded-lg border bg-card p-4">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-2xl font-semibold">${escapeHtml(String(value))}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(hint)}</div>
    </article>
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
        <table class="w-full min-w-[1380px] text-sm">
          <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">规则名称</th>
              <th class="px-3 py-2 text-left font-medium">优先级</th>
              <th class="px-3 py-2 text-left font-medium">状态</th>
              <th class="px-3 py-2 text-left font-medium">适用售卖类型</th>
              <th class="px-3 py-2 text-left font-medium">工厂条件</th>
              <th class="px-3 py-2 text-left font-medium">承接方式</th>
              <th class="px-3 py-2 text-left font-medium">独立拆出</th>
              <th class="px-3 py-2 text-left font-medium">其余处理</th>
              <th class="px-3 py-2 text-left font-medium">任务名称模板</th>
              <th class="px-3 py-2 text-left font-medium">PDA步骤</th>
              <th class="px-3 py-2 text-left font-medium">最近更新</th>
              <th class="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${rules.map((rule) => `
              <tr class="border-b last:border-b-0">
                <td class="px-3 py-3">
                  <div class="font-medium">${escapeHtml(rule.ruleName)}</div>
                  <div class="font-mono text-xs text-muted-foreground">${escapeHtml(rule.ruleNo)}</div>
                </td>
                <td class="px-3 py-3">${renderBadge(String(rule.priority), 'blue')}</td>
                <td class="px-3 py-3">${renderBadge(rule.enabled ? '启用' : '停用', rule.enabled ? 'green' : 'slate')}</td>
                <td class="px-3 py-3"><div class="flex flex-wrap gap-1">${rule.saleTypes.map((item) => renderBadge(item)).join('')}</div></td>
                <td class="px-3 py-3">${escapeHtml(rule.factoryConditionMode === 'REQUIRE_SPECIFIED_FACTORY' ? '要求指定工厂' : rule.factoryConditionMode === 'RECOMMEND_IF_EMPTY' ? '未指定可推荐' : '不要求')}</td>
                <td class="px-3 py-3">${renderBadge(getRuleAcceptanceLabel(rule), rule.generatedTaskUnitType === 'WHOLE_ORDER_TASK' ? 'amber' : 'slate')}</td>
                <td class="px-3 py-3">${escapeHtml(rule.independentProcessCodes.join('、') || '无')}</td>
                <td class="px-3 py-3">${escapeHtml(getRemainingStrategyLabel(rule))}</td>
                <td class="px-3 py-3">${escapeHtml(rule.taskNameTemplate)}</td>
                <td class="px-3 py-3">${escapeHtml(rule.pdaStepTemplateCode === 'SIMPLE_FIVE_STEP' ? '简化5步' : '默认任务步骤')}</td>
                <td class="px-3 py-3">
                  <div class="font-mono text-xs">${escapeHtml(rule.updatedAt)}</div>
                  <div class="text-xs text-muted-foreground">${escapeHtml(rule.updatedBy)}</div>
                </td>
                <td class="px-3 py-3">
                  <div class="flex flex-wrap gap-2">
                    <button class="h-8 rounded-md border px-2 text-xs hover:bg-muted">编辑</button>
                    <button class="h-8 rounded-md border px-2 text-xs hover:bg-muted">复制</button>
                    <button class="h-8 rounded-md border px-2 text-xs hover:bg-muted">模拟</button>
                    <button class="h-8 rounded-md border px-2 text-xs hover:bg-muted">${rule.enabled ? '停用' : '启用'}</button>
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

function renderPreviewSample(): string {
  const sampleOrder = productionOrders.find((order) => order.demandSnapshot.saleType.includes('KOL'))
  if (!sampleOrder) return ''
  const preview = buildTaskGenerationPreview(sampleOrder.productionOrderId)
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">规则模拟预览</h2>
          <p class="mt-1 text-sm text-muted-foreground">示例生产单：${escapeHtml(preview.productionOrderNo)} / ${escapeHtml(preview.saleType)} / 命中：${escapeHtml(preview.matchedRuleName || '未命中')}</p>
        </div>
        ${renderBadge(preview.statusReason, preview.status === 'READY' ? 'green' : 'amber')}
      </div>
      <div class="mt-3 grid gap-3 text-sm md:grid-cols-4">
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
    </section>
  `
}

function renderRuleEditorDrawer(rules: ProductionTaskGenerationRule[]): string {
  const rule = rules[0]
  return `
    <aside class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <h2 class="text-base font-semibold">新增/编辑规则抽屉</h2>
        <p class="mt-1 text-sm text-muted-foreground">原型展示新增规则需要填写的完整字段，实际保存仍沿用 mock 规则域。</p>
      </div>
      <div class="grid gap-4 p-4 lg:grid-cols-2">
        <fieldset class="space-y-3 rounded-lg border bg-muted/10 p-3">
          <legend class="px-1 text-sm font-medium">基础信息</legend>
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">规则名称</span>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(rule.ruleName)}" />
          </label>
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">规则编号</span>
            <input class="h-9 w-full rounded-md border bg-muted px-3 text-sm text-muted-foreground" readonly value="${escapeHtml(rule.ruleNo)}" />
          </label>
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">规则说明</span>
            <textarea class="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm">${escapeHtml(rule.description || '')}</textarea>
          </label>
        </fieldset>

        <fieldset class="space-y-3 rounded-lg border bg-muted/10 p-3">
          <legend class="px-1 text-sm font-medium">触发条件</legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">适用售卖类型</span>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(rule.saleTypes.join('、'))}" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">是否要求指定工厂</span>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm"><option>要求指定</option><option>未指定可推荐</option><option>不要求</option></select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-muted-foreground">指定工厂</span>
              <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(rule.factoryIds.join('、') || '后续分配')}" />
            </label>
            <label class="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" checked class="h-4 w-4 rounded border" />
              工厂必须支持承接方式
            </label>
          </div>
        </fieldset>

        <fieldset class="space-y-3 rounded-lg border bg-muted/10 p-3">
          <legend class="px-1 text-sm font-medium">工序处理</legend>
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">独立拆出工序</span>
            <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(rule.independentProcessCodes.join('、') || '无')}" />
          </label>
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">其余工序处理方式</span>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm"><option>${escapeHtml(getRemainingStrategyLabel(rule))}</option></select>
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" class="h-4 w-4 rounded border" />
            是否允许空覆盖
          </label>
        </fieldset>

        <fieldset class="space-y-3 rounded-lg border bg-muted/10 p-3">
          <legend class="px-1 text-sm font-medium">任务单元设置</legend>
          <div class="grid gap-3 sm:grid-cols-2">
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

        <fieldset class="space-y-3 rounded-lg border bg-muted/10 p-3 lg:col-span-2">
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
      </div>
    </aside>
  `
}

export function renderProductionTaskGenerationRulesPage(): string {
  const rules = listProductionTaskGenerationRules()
  const enabledRules = rules.filter((rule) => rule.enabled)
  const kolRules = rules.filter((rule) => rule.saleTypes.some((saleType) => saleType.includes('KOL')))
  const combinedRules = rules.filter((rule) => rule.generatedTaskUnitType === 'COMBINED_PROCESS_TASK')
  const wholeOrderRules = rules.filter((rule) => rule.generatedTaskUnitType === 'WHOLE_ORDER_TASK')
  const hitCount = productionOrders
    .map((order) => buildTaskGenerationPreview(order.productionOrderId))
    .filter((preview) => preview.status === 'READY' || preview.status === 'NO_MATCH_USE_DEFAULT')
    .length

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">生产单任务生成规则</h1>
          <p class="mt-1 text-sm text-muted-foreground">配置生产单拆解任务时的任务单元生成方式。规则先于任务清单、自动分配配置执行。</p>
        </div>
        <div class="flex gap-2">
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted">规则模拟</button>
          <button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">新增规则</button>
        </div>
      </header>

      <section class="grid gap-3 md:grid-cols-5">
        ${renderStatCard('启用规则', enabledRules.length, 'enabled=true')}
        ${renderStatCard('KOL规则', kolRules.length, '包含 KOL 售卖类型')}
        ${renderStatCard('连续工序规则', combinedRules.length, '组合工序任务')}
        ${renderStatCard('整单承接规则', wholeOrderRules.length, '整单任务')}
        ${renderStatCard('本周命中预估', hitCount, '基于 mock 生产单')}
      </section>

      ${renderFilters()}
      ${renderRuleTable(rules)}
      ${renderRuleEditorDrawer(rules)}
      ${renderPreviewSample()}
    </div>
  `
}
