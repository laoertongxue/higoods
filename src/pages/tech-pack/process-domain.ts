import {
  canEditTechnique,
  difficultyOptions,
  escapeHtml,
  getTechniqueCraftOptions,
  getTechniqueProcessOptions,
  getSelectedDraftMeta,
  isBomDrivenPrepTechnique,
  isPrepStage,
  stageCodeToName,
  stageOptions,
  state,
  timeUnitOptions,
} from './context'
import type { TechniqueItem } from './context'

export function renderProcessTechniqueCard(item: TechniqueItem): string {
  const canEdit = canEditTechnique(item)
  const canDelete = !isBomDrivenPrepTechnique(item)
  return `
    <article class="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-semibold">${escapeHtml(item.technique)}</span>
          </div>
        </div>
        <div class="flex items-center gap-1">
          ${
            canEdit
              ? `<button class="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted" data-tech-action="edit-technique" data-tech-id="${item.id}">
                  <i data-lucide="edit-2" class="h-3.5 w-3.5"></i>
                </button>`
              : ''
          }
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
  const currentStageName = state.newTechnique.stageCode
    ? stageCodeToName.get(state.newTechnique.stageCode) || state.newTechnique.stageCode
    : ''
  const processOptions = getTechniqueProcessOptions(state.newTechnique.stageCode)
  const availableCraftOptions = getTechniqueCraftOptions(
    state.newTechnique.stageCode,
    state.newTechnique.processCode,
  )

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
