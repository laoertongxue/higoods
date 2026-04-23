import {
  canEditTechnique,
  difficultyOptions,
  escapeHtml,
  getTechniqueCraftOptions,
  getTechniqueProcessOptions,
  getTechniqueReferenceMetaByCraftCode,
  getSelectedDraftMeta,
  isBomDrivenPrepTechnique,
  isPrepStage,
  stageCodeToName,
  stageOptions,
  state,
} from './context.ts'
import type { TechniqueItem } from './context.ts'

export function renderProcessTechniqueCard(item: TechniqueItem): string {
  const readonly = false
  const canEdit = canEditTechnique(item)
  const canDelete = !isBomDrivenPrepTechnique(item)
  const referenceValueText =
    item.referencePublishedSamValue !== null && item.referencePublishedSamUnitLabel
      ? `${item.referencePublishedSamValue} ${item.referencePublishedSamUnitLabel}`
      : '当前为工序级项，需选定具体工艺后才有平台参考值'
  const targetObjectText =
    item.isSpecialCraft && item.selectedTargetObject
      ? `<span class="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">作用对象：${escapeHtml(item.selectedTargetObject)}</span>`
      : ''
  return `
    <article class="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-semibold">${escapeHtml(item.technique)}</span>
            <span class="rounded border border-slate-200 bg-background px-2 py-0.5 text-[11px] font-medium text-slate-700">${escapeHtml(item.process)}</span>
            ${targetObjectText}
            <span class="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">当前款发布工时 SAM 基线</span>
          </div>
          <p class="text-xs text-muted-foreground">平台字典给理论参考值与推荐单位，这里维护的是当前这款的覆盖基线，不是平台永久统一口径。</p>
        </div>
        <div class="flex items-center gap-1">
          ${
            canEdit && !readonly
              ? `<button class="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted" data-tech-action="edit-technique" data-tech-id="${item.id}">
                  <i data-lucide="edit-2" class="h-3.5 w-3.5"></i>
                </button>`
              : ''
          }
          ${
            canDelete && !readonly
              ? `<button class="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-technique" data-tech-id="${item.id}">
                  <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
                </button>`
              : ''
          }
        </div>
      </div>
      <div class="rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2">
        <div class="grid gap-2 text-xs md:grid-cols-3">
          <div>
            <span class="text-muted-foreground">平台参考</span>
            <p class="mt-1 font-medium text-slate-800">${escapeHtml(referenceValueText)}</p>
          </div>
          <div>
            <span class="text-muted-foreground">默认推荐单位</span>
            <p class="mt-1 font-medium text-slate-800">${escapeHtml(item.referencePublishedSamUnitLabel || item.timeUnit || '-')}</p>
          </div>
          <div>
            <span class="text-muted-foreground">参考说明</span>
            <p class="mt-1 leading-5 text-slate-700">${escapeHtml(item.referencePublishedSamNote)}</p>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 gap-3 text-sm md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">当前款发布工时 SAM 基线</span>
          <div class="flex items-center gap-2">
            <input
              type="number"
              class="h-8 w-28 rounded-md border px-2 text-sm"
              value="${item.standardTime}"
              ${readonly ? 'disabled' : ''}
              data-tech-field="tech-standard-time"
              data-tech-id="${item.id}"
            />
            <span class="inline-flex h-8 items-center rounded-md border bg-background px-3 text-xs font-medium text-slate-700">
              ${escapeHtml(item.timeUnit || item.referencePublishedSamUnitLabel || '-')}
            </span>
          </div>
          <p class="text-[11px] leading-4 text-muted-foreground">单位默认跟随工艺字典推荐单位，当前阶段不作为自由配置项。</p>
        </label>
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">难度辅助说明</span>
          <select class="mt-1 h-8 w-full rounded-md border px-2 text-sm" data-tech-field="tech-difficulty" data-tech-id="${item.id}" ${readonly ? 'disabled' : ''}>
            ${difficultyOptions.map((option) => `<option value="${option}" ${item.difficulty === option ? 'selected' : ''}>${option}</option>`).join('')}
          </select>
          <p class="text-[11px] leading-4 text-muted-foreground">难度仅作为解释项，不替代当前款发布工时 SAM 基线。</p>
        </label>
        <label class="md:col-span-2">
          <span class="text-xs text-muted-foreground">基线备注</span>
          <input
            class="mt-1 h-8 w-full rounded-md border px-2 text-sm"
            value="${escapeHtml(item.remark)}"
            ${readonly ? 'disabled' : ''}
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
  const readonly = false
  return `
    <section class="space-y-4">
      <header class="rounded-lg border bg-card px-4 py-3">
        <h3 class="text-base font-semibold">工序工艺</h3>
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
                    allowAddTechnique && !readonly
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
                            allowAddTechnique && !readonly
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
  const currentStageName = state.newTechnique.stageCode
    ? stageCodeToName.get(state.newTechnique.stageCode) || state.newTechnique.stageCode
    : ''
  const processOptions = getTechniqueProcessOptions(state.newTechnique.stageCode)
  const availableCraftOptions = getTechniqueCraftOptions(
    state.newTechnique.stageCode,
    state.newTechnique.processCode,
  )
  const selectedCraft = availableCraftOptions.find((item) => item.craftCode === state.newTechnique.craftCode) ?? null
  const targetOptions = selectedCraft?.isSpecialCraft ? selectedCraft.supportedTargetObjectLabels ?? [] : []
  const draftReferenceMeta = getTechniqueReferenceMetaByCraftCode(state.newTechnique.craftCode)
  const draftReferenceText =
    draftReferenceMeta.referencePublishedSamValue !== null && draftReferenceMeta.referencePublishedSamUnitLabel
      ? `${draftReferenceMeta.referencePublishedSamValue} ${draftReferenceMeta.referencePublishedSamUnitLabel}`
      : '请先选择工艺后查看平台参考值'

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-lg rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">${isEdit ? '编辑工序配置' : '新增工序配置'}</h3>
        </header>
        <div class="space-y-4 px-6 py-4">
          <label class="space-y-1">
            <span class="text-sm">所属阶段</span>
            <div class="w-full rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              ${escapeHtml(currentStageName || '-')}
            </div>
          </label>

          <label class="space-y-1">
            <span class="text-sm">所属工序 <span class="text-red-500">*</span></span>
            <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-process-code" ${isLockedPrepTechnique ? 'disabled' : ''}>
              <option value="">选择工序</option>
              ${processOptions
                .map(
                  (item) =>
                    `<option value="${item.processCode}" ${state.newTechnique.processCode === item.processCode ? 'selected' : ''}>${item.processName}</option>`,
                )
                .join('')}
            </select>
          </label>

          <label class="space-y-1">
            <span class="text-sm">工艺 <span class="text-red-500">*</span></span>
            <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-craft-code" ${isLockedPrepTechnique ? 'disabled' : ''}>
              <option value="">选择工艺</option>
              ${availableCraftOptions
                .map(
                  (item) =>
                    `<option value="${item.craftCode}" ${state.newTechnique.craftCode === item.craftCode ? 'selected' : ''}>${item.craftName}</option>`,
                )
                .join('')}
            </select>
          </label>

          ${
            selectedCraft?.isSpecialCraft
              ? `
                <label class="space-y-1">
                  <span class="text-sm">作用对象 <span class="text-red-500">*</span></span>
                  ${
                    targetOptions.length <= 1
                      ? `<div class="w-full rounded-md border bg-muted/20 px-3 py-2 text-sm text-slate-700">${escapeHtml(targetOptions[0] || '请选择')}</div>`
                      : `<select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-target-object">
                          <option value="">请选择作用对象</option>
                          ${targetOptions
                            .map((item) => `<option value="${item}" ${state.newTechnique.selectedTargetObject === item ? 'selected' : ''}>${item}</option>`)
                            .join('')}
                        </select>`
                  }
                </label>
              `
              : ''
          }

          <div class="rounded-md border border-blue-100 bg-blue-50/60 px-3 py-3">
            <p class="text-xs font-medium text-blue-700">工艺理论标准（参考）</p>
            <div class="mt-2 grid gap-2 text-xs md:grid-cols-3">
              <div>
                <span class="text-muted-foreground">平台参考</span>
                <p class="mt-1 font-medium text-slate-800">${escapeHtml(draftReferenceText)}</p>
              </div>
              <div>
                <span class="text-muted-foreground">默认推荐单位</span>
                <p class="mt-1 font-medium text-slate-800">${escapeHtml(draftReferenceMeta.referencePublishedSamUnitLabel || '-')}</p>
              </div>
              <div>
                <span class="text-muted-foreground">说明</span>
                <p class="mt-1 leading-5 text-slate-700">${escapeHtml(draftReferenceMeta.referencePublishedSamNote)}</p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <label class="space-y-1">
              <span class="text-sm">当前款发布工时 SAM 基线</span>
              <input type="number" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-standard-time" value="${escapeHtml(state.newTechnique.standardTime)}" placeholder="0" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">默认推荐发布工时单位</span>
              <div class="w-full rounded-md border bg-muted/20 px-3 py-2 text-sm text-slate-700">
                ${escapeHtml(state.newTechnique.timeUnit || draftReferenceMeta.referencePublishedSamUnitLabel || '-')}
              </div>
            </label>
          </div>

          <label class="space-y-1">
            <span class="text-sm">难度辅助说明</span>
            <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-difficulty">
              ${difficultyOptions
                .map((option) => `<option value="${option}" ${state.newTechnique.difficulty === option ? 'selected' : ''}>${option}</option>`)
                .join('')}
            </select>
          </label>

          <label class="space-y-1">
            <span class="text-sm">基线备注</span>
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
