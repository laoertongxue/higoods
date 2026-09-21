import {
  difficultyOptions,
  escapeHtml,
  getTechniqueCraftOptions,
  getTechniqueProcessOptions,
  getSelectedDraftMeta,
  isBomDrivenPrepTechnique,
  isPrepStage,
  isTechPackModuleReadOnly,
  partitionBomItemsByType,
  stageCodeToName,
  stageOptions,
  state,
} from './context.ts'
import type { TechniqueItem } from './context.ts'
import {
  resolveProcessRouteLaneOrder,
  sortProcessRouteEntries,
} from '../../data/tech-pack-process-route.ts'
import {
  getMaterialSkuRecordById,
  listMaterialSkuRecordsByMaterialId,
} from '../../data/pcs-material-archive-repository.ts'
import type { MaterialSkuRecord } from '../../data/pcs-material-archive-types.ts'

type PatternRouteLane = {
  key: string
  patternName: string
  pieceName: string
  items: TechniqueItem[]
}

function getBomDisplayName(item: (typeof state.bomItems)[number]): string {
  const identity = [item.materialCode, item.colorLabel].filter(Boolean).join(' · ')
  const name = item.materialName || item.type || 'BOM 物料'
  return identity ? `${name} · ${identity}` : name
}

function getPatternRouteLanes(entries: TechniqueItem[]): PatternRouteLane[] {
  const lanes = new Map<string, PatternRouteLane>()
  state.patternItems
    .filter((pattern) => pattern.recordKind !== 'PACKAGE')
    .forEach((pattern) => {
      pattern.pieceRows.forEach((piece) => {
        const key = `PATTERN:${pattern.id}:PIECE:${piece.id}`
        if (lanes.has(key)) return
        lanes.set(key, {
          key,
          patternName: pattern.sourcePatternPackageName || pattern.name || '纸样包',
          pieceName: piece.name || '未命名裁片',
          items: entries.filter((item) => item.stageCode === 'PROD' && item.routeObjectKey === key),
        })
      })
    })
  return [...lanes.values()]
}

function renderRouteNode(
  item: TechniqueItem,
  index: number,
  ordered: boolean,
  options: { editable?: boolean; laneSize?: number } = {},
): string {
  const canReorder = options.editable && (options.laneSize ?? 0) > 1
  return `
    <div class="min-w-[144px] rounded-lg border px-3 py-2 ${ordered ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'}">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[11px] font-medium ${ordered ? 'text-emerald-700' : 'text-amber-700'}">第 ${index + 1} 道${ordered ? '' : ' · 待确认'}</span>
        ${canReorder ? `
          <span class="inline-flex overflow-hidden rounded border border-slate-200 bg-white">
            <button
              type="button"
              class="inline-flex h-6 items-center px-1.5 text-[11px] text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              data-tech-action="move-prep-route-entry"
              data-tech-id="${escapeHtml(item.id)}"
              data-direction="up"
              aria-label="前移 ${escapeHtml(item.technique)}"
              ${index === 0 ? 'disabled' : ''}
            >前移</button>
            <button
              type="button"
              class="inline-flex h-6 items-center border-l px-1.5 text-[11px] text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              data-tech-action="move-prep-route-entry"
              data-tech-id="${escapeHtml(item.id)}"
              data-direction="down"
              aria-label="后移 ${escapeHtml(item.technique)}"
              ${index === (options.laneSize ?? 0) - 1 ? 'disabled' : ''}
            >后移</button>
          </span>
        ` : ''}
      </div>
      <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(item.technique)}</div>
    </div>
  `
}

function resolvePreparationSkuCandidates(item: TechniqueItem, bom: (typeof state.bomItems)[number]): MaterialSkuRecord[] {
  const inputSkuId = item.inputMaterialSkuId || bom.materialSkuId || ''
  const inputSku = inputSkuId ? getMaterialSkuRecordById(inputSkuId) : null
  const outputSku = item.outputMaterialSkuId ? getMaterialSkuRecordById(item.outputMaterialSkuId) : null
  const candidates = inputSku ? listMaterialSkuRecordsByMaterialId(inputSku.materialId) : []
  const byId = new Map(candidates.map((sku) => [sku.materialSkuId, sku]))
  if (inputSku) byId.set(inputSku.materialSkuId, inputSku)
  if (outputSku) byId.set(outputSku.materialSkuId, outputSku)
  return [...byId.values()].filter((sku) => (
    (sku.status === 'ACTIVE' || sku.materialSkuId === item.outputMaterialSkuId)
    && (!(item.processCode === 'DYE' || item.processCode === 'PRINT') || sku.materialSkuId !== inputSkuId)
  ))
}

function renderPreparationSkuIdentity(
  sku: MaterialSkuRecord | null,
  fallback: { code?: string; name?: string; imageUrl?: string },
  label: string,
): string {
  const code = sku?.materialSkuCode || fallback.code || '未维护 SKU'
  const name = sku?.materialName || fallback.name || '物料'
  const imageUrl = sku?.skuImageUrl || fallback.imageUrl || ''
  return `
    <span class="flex min-w-0 items-center gap-2">
      ${imageUrl ? `
        <button type="button" class="shrink-0" data-tech-action="open-material-image-preview" data-image-url="${escapeHtml(imageUrl)}" data-image-label="${escapeHtml(`${code} ${name}`)}">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(`${code} ${name}`)}" class="h-8 w-8 rounded border object-cover" />
        </button>
      ` : '<span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border bg-slate-50 text-[10px] text-slate-400">无图</span>'}
      <span class="min-w-0">
        <span class="block text-[10px] text-slate-500">${escapeHtml(label)}</span>
        <span class="block truncate text-xs font-medium text-slate-800" title="${escapeHtml(`${code} · ${name}`)}">${escapeHtml(code)}</span>
      </span>
    </span>
  `
}

function renderPreparationRouteNode(
  item: TechniqueItem,
  bom: (typeof state.bomItems)[number],
  index: number,
  ordered: boolean,
  options: { editable?: boolean; laneSize?: number } = {},
): string {
  const requiresSkuChange = item.processCode === 'DYE' || item.processCode === 'PRINT'
  const mustKeepSku = ['WATER_SOLUBLE', 'WEBBING_CUT', 'WEBBING_TIP'].includes(item.processCode)
  const fallbackInputSkuId = index === 0 ? (item.inputMaterialSkuId || bom.materialSkuId || '') : (item.inputMaterialSkuId || '')
  const inputSku = getMaterialSkuRecordById(fallbackInputSkuId)
  const outputSku = getMaterialSkuRecordById(item.outputMaterialSkuId || (mustKeepSku ? fallbackInputSkuId : ''))
  const candidates = resolvePreparationSkuCandidates(item, bom)
  const inputCode = inputSku?.materialSkuCode || item.inputMaterialSkuCode || (index === 0 ? bom.materialCode : '等待上道产出')
  const outputCode = outputSku?.materialSkuCode || item.outputMaterialSkuCode || (requiresSkuChange ? '待选择' : inputCode)
  const selectedOutputSkuId = item.outputMaterialSkuId || (mustKeepSku ? fallbackInputSkuId : '')
  const hasSelectedOutputOption = candidates.some((sku) => sku.materialSkuId === selectedOutputSkuId)
  const unchanged = mustKeepSku
  const canSelectOutput = options.editable && requiresSkuChange
  const canReorder = options.editable && (options.laneSize ?? 0) > 1
  return `
    <div class="min-w-[290px] rounded-lg border px-3 py-2 ${ordered ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'}">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[11px] font-medium ${ordered ? 'text-emerald-700' : 'text-amber-700'}">第 ${index + 1} 道${ordered ? '' : ' · 待确认'}</span>
        ${canReorder ? `
          <span class="inline-flex overflow-hidden rounded border border-slate-200 bg-white">
            <button type="button" class="inline-flex h-6 items-center px-1.5 text-[11px] text-slate-700 hover:bg-slate-50 disabled:text-slate-300" data-tech-action="move-prep-route-entry" data-tech-id="${escapeHtml(item.id)}" data-direction="up" ${index === 0 ? 'disabled' : ''}>前移</button>
            <button type="button" class="inline-flex h-6 items-center border-l px-1.5 text-[11px] text-slate-700 hover:bg-slate-50 disabled:text-slate-300" data-tech-action="move-prep-route-entry" data-tech-id="${escapeHtml(item.id)}" data-direction="down" ${index === (options.laneSize ?? 0) - 1 ? 'disabled' : ''}>后移</button>
          </span>
        ` : ''}
      </div>
      <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(item.technique)}</div>
      <div class="mt-2 grid gap-2 rounded-md border border-white/80 bg-white/80 p-2">
        ${renderPreparationSkuIdentity(inputSku, { code: item.inputMaterialSkuCode || bom.materialCode, name: item.inputMaterialName || bom.materialName, imageUrl: item.inputMaterialImageUrl }, '加工投入')}
        <div class="border-t pt-2">
          <div class="mb-1 flex items-center justify-between gap-2 text-[10px] text-slate-500"><span>加工产出</span><span>${unchanged ? 'SKU 不变' : selectedOutputSkuId ? `转为 ${escapeHtml(outputCode)}` : '必须更换 SKU'}</span></div>
          ${canSelectOutput ? `
            <select class="h-8 w-full rounded border bg-white px-2 text-xs" data-tech-field="prep-output-material-sku" data-tech-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.technique)}加工产出 SKU">
              <option value="" ${selectedOutputSkuId ? '' : 'selected'} disabled>请选择加工后的新 SKU</option>
              ${selectedOutputSkuId && !hasSelectedOutputOption ? `<option value="${escapeHtml(selectedOutputSkuId)}" selected>${escapeHtml(`${outputCode} · ${item.outputMaterialName || bom.materialName}`)}</option>` : ''}
              ${candidates.map((sku) => `<option value="${escapeHtml(sku.materialSkuId)}" ${sku.materialSkuId === selectedOutputSkuId ? 'selected' : ''}>${escapeHtml(`${sku.materialSkuCode} · ${sku.colorName || sku.specName || sku.materialName}`)}</option>`).join('')}
            </select>
            ${candidates.length === 0 ? '<div class="mt-1 text-[10px] text-red-600">当前物料没有可选的新 SKU，请先在物料档案新增。</div>' : ''}
          ` : renderPreparationSkuIdentity(outputSku, { code: item.outputMaterialSkuCode || (unchanged ? inputCode : '待选择新 SKU'), name: item.outputMaterialName || (unchanged ? item.inputMaterialName : '') || bom.materialName, imageUrl: item.outputMaterialImageUrl || (unchanged ? item.inputMaterialImageUrl : undefined) }, unchanged ? '标准产出' : '加工产出')}
        </div>
      </div>
    </div>
  `
}

function renderLaneProcess(
  items: TechniqueItem[],
  emptyLabel: string,
  options: { editable?: boolean; bom?: (typeof state.bomItems)[number] } = {},
): string {
  if (items.length === 0) {
    return `<span class="inline-flex rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">${escapeHtml(emptyLabel)}</span>`
  }
  const lane = resolveProcessRouteLaneOrder(items)
  return `
    <div class="flex min-w-max items-center gap-2">
      ${lane.entries.map((item, index) => `${index > 0 ? '<i data-lucide="arrow-right" class="h-4 w-4 shrink-0 text-slate-400"></i>' : ''}${options.bom ? renderPreparationRouteNode(item, options.bom, index, lane.ordered, { editable: options.editable, laneSize: lane.entries.length }) : renderRouteNode(item, index, lane.ordered, { editable: options.editable, laneSize: lane.entries.length })}`).join('')}
    </div>
  `
}

function renderStageHeading(step: number, title: string, summary: string, color: 'blue' | 'emerald' | 'orange'): string {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
  }
  return `
    <header class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <div class="flex items-center gap-3">
        <span class="inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm font-semibold ${tones[color]}">${step}</span>
        <h4 class="text-sm font-semibold text-slate-900">${escapeHtml(title)}</h4>
      </div>
      <span class="text-xs text-muted-foreground">${escapeHtml(summary)}</span>
    </header>
  `
}

function renderThreeStageRouteOverview(readonly: boolean): string {
  const entries = sortProcessRouteEntries(state.techniques)
  const { materialBomItems } = partitionBomItemsByType(state.bomItems)
  const prepLanes = materialBomItems.map((bom) => ({
    bom,
    items: entries.filter((item) => item.stageCode === 'PREP' && item.linkedBomItemIds?.includes(bom.id)),
  }))
  const patternLanes = getPatternRouteLanes(entries)
  const cutEntries = entries.filter((item) => item.stageCode === 'PROD' && item.processCode === 'CUT_PANEL')
  const boundMaterialLanes = materialBomItems
    .map((bom) => ({
      bom,
      items: entries.filter((item) =>
        item.stageCode === 'PROD'
        && item.sourceType === 'BOM'
        && item.linkedBomItemIds?.includes(bom.id)
        && (item.craftCode === 'CRAFT_131072' || item.craftCode === 'CRAFT_3000009'),
      ),
    }))
    .filter((lane) => lane.items.length > 0)

  return `
    <section class="space-y-3" data-testid="tech-pack-three-stage-route">
      <article class="overflow-hidden rounded-lg border bg-card" data-route-stage="PREP">
        ${renderStageHeading(1, '准备阶段', `${materialBomItems.length} 条 BOM 物料并行`, 'blue')}
        <div class="divide-y">
          ${prepLanes.length === 0
            ? '<div class="px-4 py-5 text-sm text-muted-foreground">当前 BOM 没有需要进入准备加工的面辅料。</div>'
            : prepLanes.map(({ bom, items }) => `
                <div class="grid gap-3 px-4 py-3 lg:grid-cols-[260px_minmax(0,1fr)]" data-tech-prep-route-lane="${escapeHtml(bom.id)}">
                  <div>
                    <div class="text-sm font-medium text-slate-900">${escapeHtml(getBomDisplayName(bom))}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(bom.type || '物料')}</div>
                    ${!readonly && bom.type === '辅料' ? `<button type="button" class="mt-2 rounded border px-2 py-1 text-xs text-blue-700 hover:bg-blue-50" data-tech-action="open-webbing-specifications" data-bom-id="${escapeHtml(bom.id)}" data-skip-page-rerender="true">织带 / 绳子加工规格</button>` : ''}
                  </div>
                  <div class="overflow-x-auto pb-1">${renderLaneProcess(items, '无需准备加工', { editable: !readonly, bom })}</div>
                </div>
              `).join('')}
        </div>
      </article>

      <div class="flex justify-center" aria-hidden="true"><i data-lucide="arrow-down" class="h-5 w-5 text-slate-400"></i></div>

      <article class="overflow-hidden rounded-lg border bg-card" data-route-stage="PROD">
        ${renderStageHeading(2, '生产阶段', '裁剪、裁片工艺与面辅料加工并行，全部完成后进入车缝', 'emerald')}
        <div class="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_24px_150px] lg:items-center">
          <div class="space-y-3">
            <div class="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/30 p-3">
              <div class="mb-2 text-xs font-medium text-emerald-800">裁片路线</div>
              <div class="grid gap-3 lg:grid-cols-[150px_24px_minmax(0,1fr)] lg:items-center">
                <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
                  <div class="text-sm font-semibold text-emerald-800">裁剪</div>
                  <div class="mt-1 text-xs text-emerald-700">${cutEntries.length} 条面料裁剪</div>
                </div>
                <div class="flex justify-center text-slate-400"><i data-lucide="arrow-down" class="h-5 w-5 lg:hidden"></i><i data-lucide="arrow-right" class="hidden h-5 w-5 lg:block"></i></div>
                <div class="space-y-2">
                  ${patternLanes.length === 0
                    ? '<div class="rounded border bg-white px-3 py-3 text-sm text-muted-foreground">纸样包尚未形成裁片明细。</div>'
                    : patternLanes.map((lane) => `
                        <div class="grid gap-2 rounded-md border bg-white px-3 py-2 lg:grid-cols-[210px_minmax(0,1fr)]">
                          <div>
                            <div class="text-sm font-medium text-slate-900">${escapeHtml(lane.pieceName)}</div>
                            <div class="mt-0.5 truncate text-xs text-muted-foreground">${escapeHtml(lane.patternName)}</div>
                          </div>
                          <div class="overflow-x-auto pb-1">${renderLaneProcess(lane.items, '无额外裁片工艺')}</div>
                        </div>
                    `).join('')}
                </div>
              </div>
            </div>
            ${boundMaterialLanes.length === 0 ? '' : `
              <div class="space-y-2 rounded-lg border border-dashed border-emerald-200 bg-emerald-50/30 p-3">
                <div class="text-xs font-medium text-emerald-800">面辅料加工</div>
                ${boundMaterialLanes.map(({ bom, items }) => `
                  <div class="grid gap-2 rounded-md border bg-white px-3 py-2 lg:grid-cols-[210px_minmax(0,1fr)]">
                    <div>
                      <div class="text-sm font-medium text-slate-900">${escapeHtml(getBomDisplayName(bom))}</div>
                      <div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(bom.type)}</div>
                    </div>
                    <div class="overflow-x-auto pb-1">${renderLaneProcess(items, '')}</div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
          <div class="flex justify-center text-slate-400"><i data-lucide="arrow-down" class="h-5 w-5 lg:hidden"></i><i data-lucide="arrow-right" class="hidden h-5 w-5 lg:block"></i></div>
          <div class="rounded-lg border border-emerald-300 bg-emerald-100 px-4 py-4 text-center">
            <div class="text-sm font-semibold text-emerald-900">车缝</div>
            <div class="mt-1 text-xs text-emerald-800">等待全部投入完成</div>
          </div>
        </div>
      </article>

      <div class="flex justify-center" aria-hidden="true"><i data-lucide="arrow-down" class="h-5 w-5 text-slate-400"></i></div>

      <article class="overflow-hidden rounded-lg border bg-card" data-route-stage="POST">
        ${renderStageHeading(3, '后道阶段', '车缝回货后进入后道', 'orange')}
        <div class="flex flex-wrap items-center justify-center gap-2 px-4 py-5">
          ${['车缝回货', '到货 QC', '后道处理', '完成'].map((label, index) => `${index > 0 ? '<i data-lucide="arrow-right" class="h-4 w-4 text-slate-400"></i>' : ''}<div class="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-800">${label}</div>`).join('')}
        </div>
        <div class="border-t bg-orange-50/40 px-4 py-2 text-center text-xs text-orange-800">具体后道工序由本次外发范围和到货 QC 结果确定。</div>
      </article>
    </section>
  `
}

export function renderProcessTab(): string {
  const readonly = isTechPackModuleReadOnly('PROCESS')
  const routeConfirmed = state.processRouteStatus === 'CONFIRMED'
  const confirmMeta = routeConfirmed
    ? `确认人：${state.processRouteConfirmedBy || '-'}　确认时间：${state.processRouteConfirmedAt || '-'}`
    : state.processRouteUpdatedAt
      ? `最近调整：${state.processRouteUpdatedBy || '-'}　${state.processRouteUpdatedAt}`
      : '路线待跟单确认'
  return `
    <section class="space-y-4" data-testid="tech-pack-process-tab">
      <header class="rounded-lg border bg-card px-4 py-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-base font-semibold">工艺路线</h3>
              <span class="rounded border px-2 py-0.5 text-xs font-medium ${
                routeConfirmed
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }">${routeConfirmed ? '路线已确认' : '路线待确认'}</span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(confirmMeta)}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            ${stageOptions
              .filter((stage) => !isPrepStage(stage) && stage === '生产阶段')
              .map((stage) =>
                readonly
                  ? ''
                  : `<button
                      class="inline-flex items-center rounded border px-2 py-1 text-xs hover:bg-muted"
                      data-tech-action="open-add-technique"
                      data-stage="${escapeHtml(stage)}"
                    >
                      <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>
                      新增${escapeHtml(stage)}工序
                    </button>`,
              )
              .join('')}
            ${
              readonly || state.techniques.length === 0
                ? ''
                : `<button
                    class="inline-flex items-center rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    data-tech-action="confirm-process-route"
                  >
                    <i data-lucide="check-circle-2" class="mr-1 h-3.5 w-3.5"></i>
                    确认工艺路线
                  </button>`
            }
          </div>
        </div>
      </header>
      ${renderThreeStageRouteOverview(readonly)}
    </section>
  `
}


export function renderAddTechniqueDialog(): string {
  if (!state.addTechniqueDialogOpen) return ''
  if (isTechPackModuleReadOnly('PROCESS')) return ''
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
  const garmentBomItems = partitionBomItemsByType(state.bomItems).garmentBomItems
  const isWoolCraft = selectedCraft?.processCode === 'WOOL'
  const woolDownstream = selectedCraft?.craftName === '部位毛织' ? '裁床待交出仓' : '后道工厂'

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true" data-testid="tech-pack-technique-form-dialog">
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

          ${
            selectedCraft?.isSpecialCraft && state.newTechnique.selectedTargetObject === '成衣'
              ? `
                <div class="space-y-2">
                  <span class="text-sm">关联成衣 BOM <span class="text-red-500">*</span></span>
                  ${
                    garmentBomItems.length === 0
                      ? '<div class="rounded-md border border-dashed px-3 py-2 text-sm text-amber-700">请先在物料清单新增成衣 BOM</div>'
                      : `<div class="space-y-2 rounded-md border p-3">
                          ${garmentBomItems.map((item) => `
                            <label class="flex items-start gap-2 text-sm">
                              <input type="checkbox" class="mt-0.5" data-tech-field="new-technique-garment-bom" data-bom-id="${escapeHtml(item.id)}" ${state.newTechnique.linkedBomItemIds.includes(item.id) ? 'checked' : ''} />
                              <span>
                                <span class="block font-medium">${escapeHtml(item.materialName)}</span>
                                <span class="text-xs text-muted-foreground">适用 ${item.applicableSkuCodes.length} 个 SKU</span>
                              </span>
                            </label>
                          `).join('')}
                        </div>`
                  }
                </div>
              `
              : ''
          }

          ${
            isWoolCraft
              ? `
                <div class="rounded-md border border-emerald-100 bg-emerald-50/60 px-3 py-3 text-sm">
                  <div class="font-medium text-emerald-800">毛织任务规则</div>
                  <div class="mt-2 grid gap-2 text-xs text-slate-700 md:grid-cols-2">
                    <div>任务类型：${escapeHtml(selectedCraft?.craftName || '-')}</div>
                    <div>接收方式：染厂/面料仓送料到厂</div>
                    <div>完成交出：${escapeHtml(woolDownstream)}</div>
                  </div>
                </div>
              `
              : ''
          }

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
