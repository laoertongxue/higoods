import {
  DETAIL_SPLIT_DIMENSION_LABEL,
  DETAIL_SPLIT_MODE_LABEL,
  PROCESS_ASSIGNMENT_GRANULARITY_LABEL,
  PROCESS_DOC_TYPE_LABEL,
  RULE_SOURCE_LABEL,
  TASK_TYPE_MODE_LABEL,
  baselineProcessOptions,
  craftOptions,
  difficultyOptions,
  escapeHtml,
  formatDetailSplitDimensionsText,
  getSelectedDraftMeta,
  isBomDrivenPrepTechnique,
  isPrepStage,
  renderStatusBadge,
  stageOptions,
  state,
  timeUnitOptions,
} from './context'
import type { TechniqueItem } from './context'

export function renderProcessTechniqueCard(item: TechniqueItem): string {
  const canDelete = !isBomDrivenPrepTechnique(item)
  return `
    <article class="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-semibold">${escapeHtml(item.technique)}</span>
            <span class="inline-flex rounded border px-1.5 py-0 text-[10px] ${
              item.entryType === 'PROCESS_BASELINE'
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-green-200 bg-green-50 text-green-700'
            }">${item.entryType === 'PROCESS_BASELINE' ? '工序基线项' : '工艺引用项'}</span>
            <span class="inline-flex rounded border px-1.5 py-0 text-[10px] text-muted-foreground">${escapeHtml(item.source)}</span>
          </div>
          <div class="text-xs text-muted-foreground">
            所属工序：${escapeHtml(item.process)} · 所属阶段：${escapeHtml(item.stage)}
          </div>
          <div class="text-xs text-muted-foreground">
            分配粒度：${escapeHtml(PROCESS_ASSIGNMENT_GRANULARITY_LABEL[item.assignmentGranularity])}
            · 默认单据：${escapeHtml(PROCESS_DOC_TYPE_LABEL[item.defaultDocType])}
            · 任务模式：${escapeHtml(TASK_TYPE_MODE_LABEL[item.taskTypeMode])}
            · 特殊工艺：${item.isSpecialCraft ? '是' : '否'}
          </div>
          <div class="text-xs text-muted-foreground">
            规则来源：${escapeHtml(RULE_SOURCE_LABEL[item.ruleSource])}
            · 明细拆分方式：${escapeHtml(DETAIL_SPLIT_MODE_LABEL[item.detailSplitMode])}
            · 明细拆分维度：${escapeHtml(formatDetailSplitDimensionsText(item.detailSplitDimensions))}
          </div>
          ${
            item.triggerSource
              ? `<div class="text-xs text-muted-foreground">触发来源：${escapeHtml(item.triggerSource)}</div>`
              : ''
          }
        </div>
        <div class="flex items-center gap-1">
          <button class="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted" data-tech-action="edit-technique" data-tech-id="${item.id}">
            <i data-lucide="edit-2" class="h-3.5 w-3.5"></i>
          </button>
          ${
            canDelete
              ? `<button class="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-technique" data-tech-id="${item.id}">
                  <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
                </button>`
              : ''
          }
        </div>
      </div>
      <div class="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
        <label>
          <span class="text-xs text-muted-foreground">标准工时</span>
          <div class="mt-1 flex items-center gap-1">
            <input
              type="number"
              class="h-8 w-20 rounded-md border px-2 text-sm"
              value="${item.standardTime}"
              data-tech-field="tech-standard-time"
              data-tech-id="${item.id}"
            />
            <select
              class="h-8 w-24 rounded-md border px-2 text-sm"
              data-tech-field="tech-time-unit"
              data-tech-id="${item.id}"
            >
              ${timeUnitOptions
                .map((option) => `<option value="${option}" ${item.timeUnit === option ? 'selected' : ''}>${option}</option>`)
                .join('')}
            </select>
          </div>
        </label>
        <label>
          <span class="text-xs text-muted-foreground">难度</span>
          <select class="mt-1 h-8 w-full rounded-md border px-2 text-sm" data-tech-field="tech-difficulty" data-tech-id="${item.id}">
            ${difficultyOptions.map((option) => `<option value="${option}" ${item.difficulty === option ? 'selected' : ''}>${option}</option>`).join('')}
          </select>
        </label>
        <label>
          <span class="text-xs text-muted-foreground">备注</span>
          <input
            class="mt-1 h-8 w-full rounded-md border px-2 text-sm"
            value="${escapeHtml(item.remark)}"
            data-tech-field="tech-remark"
            data-tech-id="${item.id}"
            placeholder="可填写补充说明"
          />
        </label>
      </div>
    </article>
  `
}

export function renderProcessTab(): string {
  return `
    <section class="space-y-4">
      <header class="rounded-lg border bg-card px-4 py-3">
        <h3 class="text-base font-semibold">工序</h3>
        <p class="mt-1 text-sm text-muted-foreground">阶段 → 工序 → 工艺</p>
      </header>
      <div class="space-y-6">
        ${stageOptions
          .map((stage) => {
            const stageItems = state.techniques.filter((item) => item.stage === stage)
            const allowAddTechnique = !isPrepStage(stage)
            return `
              <section class="rounded-lg border bg-card">
                <header class="flex items-center justify-between px-4 py-3">
                  <h4 class="text-base font-semibold">${escapeHtml(stage)}</h4>
                  ${
                    allowAddTechnique
                      ? `<button
                          class="inline-flex items-center rounded border px-2 py-1 text-xs hover:bg-muted"
                          data-tech-action="open-add-technique"
                          data-stage="${escapeHtml(stage)}"
                        >
                          <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>
                          新增工序工艺
                        </button>`
                      : ''
                  }
                </header>
                <div class="px-4 pb-4">
                  ${
                    stageItems.length === 0
                      ? `
                        <div class="space-y-2 py-6 text-center text-muted-foreground">
                          <p class="text-sm">暂无工序工艺</p>
                          ${
                            allowAddTechnique
                              ? `<button
                                  class="inline-flex items-center rounded px-2 py-1 text-xs hover:bg-muted"
                                  data-tech-action="open-add-technique"
                                  data-stage="${escapeHtml(stage)}"
                                >
                                  <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>
                                  新增工序工艺
                                </button>`
                              : ''
                          }
                        </div>
                      `
                      : `
                        <div class="divide-y">
                          ${stageItems
                            .map(
                              (item) => `
                                <div class="py-4 first:pt-0 last:pb-0">
                                  ${renderProcessTechniqueCard(item)}
                                </div>
                              `,
                            )
                            .join('')}
                        </div>
                      `
                  }
                </div>
              </section>
            `
          })
          .join('')}
      </div>
    </section>
  `
}


export function renderAddTechniqueDialog(): string {
  if (!state.addTechniqueDialogOpen) return ''
  const selectedMeta = getSelectedDraftMeta()
  const isEdit = Boolean(state.editTechniqueId)
  const editingTechnique = state.editTechniqueId
    ? state.techniques.find((item) => item.id === state.editTechniqueId) ?? null
    : null
  const isLockedPrepTechnique = editingTechnique ? isBomDrivenPrepTechnique(editingTechnique) : false

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-lg rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">${isEdit ? '编辑工序配置' : '新增工序配置'}</h3>
        </header>
        <div class="space-y-4 px-6 py-4">
          <label class="space-y-1">
            <span class="text-sm">配置类型 <span class="text-red-500">*</span></span>
            <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-entry-type" ${isLockedPrepTechnique ? 'disabled' : ''}>
              <option value="CRAFT" ${state.newTechnique.entryType === 'CRAFT' ? 'selected' : ''}>工艺引用项</option>
              <option value="PROCESS_BASELINE" ${state.newTechnique.entryType === 'PROCESS_BASELINE' ? 'selected' : ''}>工序基线项（准备阶段）</option>
            </select>
          </label>

          ${
            state.newTechnique.entryType === 'PROCESS_BASELINE'
              ? `
                <label class="space-y-1">
                  <span class="text-sm">准备阶段工序 <span class="text-red-500">*</span></span>
                  <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-baseline-process" ${isLockedPrepTechnique ? 'disabled' : ''}>
                    <option value="">选择印花或染色</option>
                    ${baselineProcessOptions
                      .map(
                        (item) =>
                          `<option value="${item.processCode}" ${state.newTechnique.baselineProcessCode === item.processCode ? 'selected' : ''}>${item.processName}</option>`,
                      )
                      .join('')}
                  </select>
                </label>
              `
              : `
                <label class="space-y-1">
                  <span class="text-sm">工艺字典项 <span class="text-red-500">*</span></span>
                  <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-craft-code">
                    <option value="">从工艺字典中选择</option>
                    ${craftOptions
                      .map(
                        (item) =>
                          `<option value="${item.craftCode}" ${state.newTechnique.craftCode === item.craftCode ? 'selected' : ''}>${item.craftName}（${item.processName}）</option>`,
                      )
                      .join('')}
                  </select>
                </label>
              `
          }

          ${
            selectedMeta
              ? `
                <div class="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  <div>所属阶段：${escapeHtml(selectedMeta.stageName)}</div>
                  <div>所属工序：${escapeHtml(selectedMeta.processName)}</div>
                  <div>分配粒度：${escapeHtml(PROCESS_ASSIGNMENT_GRANULARITY_LABEL[selectedMeta.assignmentGranularity])}</div>
                  <div>规则来源：${escapeHtml(RULE_SOURCE_LABEL[selectedMeta.ruleSource])}</div>
                  <div>默认单据：${escapeHtml(PROCESS_DOC_TYPE_LABEL[selectedMeta.defaultDocType])}</div>
                  <div>任务模式：${escapeHtml(TASK_TYPE_MODE_LABEL[selectedMeta.taskTypeMode])}</div>
                  <div>特殊工艺：${selectedMeta.isSpecialCraft ? '是' : '否'}</div>
                  <div class="col-span-2">明细拆分方式：${escapeHtml(DETAIL_SPLIT_MODE_LABEL[selectedMeta.detailSplitMode])}</div>
                  <div class="col-span-2">明细拆分维度：${escapeHtml(formatDetailSplitDimensionsText(selectedMeta.detailSplitDimensions))}</div>
                  ${
                    selectedMeta.triggerSource
                      ? `<div class="col-span-2">触发来源：${escapeHtml(selectedMeta.triggerSource)}</div>`
                      : ''
                  }
                </div>
              `
              : '<p class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">请选择工序基线或工艺字典项后自动带出阶段/工序/分配粒度/单据类型。</p>'
          }

          ${
            selectedMeta
              ? `
                <div class="space-y-3 rounded-md border bg-muted/20 px-3 py-3">
                  <p class="text-xs font-semibold text-muted-foreground">任务拆分规则</p>
                  <label class="space-y-1">
                    <span class="text-sm">规则来源</span>
                    <select
                      class="w-full rounded-md border px-3 py-2 text-sm"
                      data-tech-field="new-technique-rule-source"
                      ${state.newTechnique.entryType === 'PROCESS_BASELINE' || selectedMeta.isSpecialCraft ? 'disabled' : ''}
                    >
                      <option value="INHERIT_PROCESS" ${(state.newTechnique.entryType === 'PROCESS_BASELINE' || state.newTechnique.ruleSource === 'INHERIT_PROCESS') ? 'selected' : ''}>继承工序规则</option>
                      <option value="OVERRIDE_CRAFT" ${(selectedMeta.isSpecialCraft || state.newTechnique.ruleSource === 'OVERRIDE_CRAFT') ? 'selected' : ''}>工艺覆盖规则</option>
                    </select>
                  </label>
                  <div class="grid grid-cols-2 gap-3">
                    <label class="space-y-1">
                      <span class="text-sm">最小可分配粒度</span>
                      <select
                        class="w-full rounded-md border px-3 py-2 text-sm"
                        data-tech-field="new-technique-assignment-granularity"
                        ${(state.newTechnique.entryType === 'PROCESS_BASELINE' || (!selectedMeta.isSpecialCraft && state.newTechnique.ruleSource !== 'OVERRIDE_CRAFT')) ? 'disabled' : ''}
                      >
                        <option value="ORDER" ${state.newTechnique.assignmentGranularity === 'ORDER' ? 'selected' : ''}>按生产单</option>
                        <option value="COLOR" ${state.newTechnique.assignmentGranularity === 'COLOR' ? 'selected' : ''}>按颜色</option>
                        <option value="SKU" ${state.newTechnique.assignmentGranularity === 'SKU' ? 'selected' : ''}>按SKU</option>
                        <option value="DETAIL" ${state.newTechnique.assignmentGranularity === 'DETAIL' ? 'selected' : ''}>按明细行</option>
                      </select>
                    </label>
                    <label class="space-y-1">
                      <span class="text-sm">明细拆分方式</span>
                      <select
                        class="w-full rounded-md border px-3 py-2 text-sm"
                        data-tech-field="new-technique-detail-split-mode"
                        ${(state.newTechnique.entryType === 'PROCESS_BASELINE' || (!selectedMeta.isSpecialCraft && state.newTechnique.ruleSource !== 'OVERRIDE_CRAFT')) ? 'disabled' : ''}
                      >
                        <option value="COMPOSITE" selected>组合维度</option>
                      </select>
                    </label>
                  </div>
                  <div class="space-y-1">
                    <span class="text-sm">明细拆分维度</span>
                    <div class="grid grid-cols-2 gap-2 rounded-md border bg-background px-2 py-2">
                      ${(['PATTERN', 'MATERIAL_SKU', 'GARMENT_COLOR', 'GARMENT_SKU'] as const)
                        .map(
                          (dimension) => `
                            <label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                class="h-3.5 w-3.5"
                                data-tech-field="new-technique-detail-split-dimension"
                                data-dimension="${dimension}"
                                ${state.newTechnique.detailSplitDimensions.includes(dimension) ? 'checked' : ''}
                                ${(state.newTechnique.entryType === 'PROCESS_BASELINE' || (!selectedMeta.isSpecialCraft && state.newTechnique.ruleSource !== 'OVERRIDE_CRAFT')) ? 'disabled' : ''}
                              />
                              ${DETAIL_SPLIT_DIMENSION_LABEL[dimension]}
                            </label>
                          `,
                        )
                        .join('')}
                    </div>
                    <p class="text-[11px] text-muted-foreground">
                      ${state.newTechnique.entryType === 'PROCESS_BASELINE'
                        ? '工序基线项固定继承工序规则。'
                        : selectedMeta.isSpecialCraft
                          ? '特殊工艺必须使用工艺级覆盖规则。'
                          : state.newTechnique.ruleSource === 'OVERRIDE_CRAFT'
                            ? '当前使用工艺覆盖规则。'
                            : '当前继承工序规则，可切换为工艺覆盖。'}
                    </p>
                  </div>
                </div>
              `
              : ''
          }

          <div class="grid grid-cols-2 gap-4">
            <label class="space-y-1">
              <span class="text-sm">标准工时</span>
              <input type="number" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-standard-time" value="${escapeHtml(state.newTechnique.standardTime)}" placeholder="0" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">工时单位</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-time-unit">
                ${timeUnitOptions
                  .map((option) => `<option value="${option}" ${state.newTechnique.timeUnit === option ? 'selected' : ''}>${option}</option>`)
                  .join('')}
              </select>
            </label>
          </div>

          <label class="space-y-1">
            <span class="text-sm">难度</span>
            <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-difficulty">
              ${difficultyOptions
                .map((option) => `<option value="${option}" ${state.newTechnique.difficulty === option ? 'selected' : ''}>${option}</option>`)
                .join('')}
            </select>
          </label>

          <label class="space-y-1">
            <span class="text-sm">备注</span>
            <textarea rows="2" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-remark" placeholder="备注信息">${escapeHtml(state.newTechnique.remark)}</textarea>
          </label>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-technique">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            selectedMeta ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="save-technique">${isEdit ? '保存' : '确认新增'}</button>
        </footer>
      </section>
    </div>
  `
}
