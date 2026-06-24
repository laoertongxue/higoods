import {
  dedupeStrings,
  bomRequirementOptions,
  bomUsageProcessOptions,
  dyeOptions,
  escapeHtml,
  getBomPatternDesignIds,
  getPatternDesignPreviewAssetById,
  getPatternDesignOptionsBySide,
  getSkuOptionsForCurrentSpu,
  isTechPackModuleReadOnly,
  printOptions,
  state,
} from './context.ts'
import type { BomItemRow } from './context.ts'

function renderTextValue(value: string): string {
  return value.trim().length > 0 ? escapeHtml(value) : '<span class="text-muted-foreground">-</span>'
}

function renderPrintSideModeLabel(mode: BomItemRow['printSideMode']): string {
  if (mode === 'SINGLE') return '单面印'
  if (mode === 'DOUBLE') return '双面印'
  return '-'
}

function renderBomPrintBindingCell(item: BomItemRow, side: 'FRONT' | 'INSIDE'): string {
  if (!item.printRequirement || item.printRequirement === '无') {
    return '<span class="text-muted-foreground">-</span>'
  }

  if (!item.printSideMode) {
    return '<span class="text-amber-600">待配置</span>'
  }

  const designIds = getBomPatternDesignIds(item, side)
  const designs = designIds
    .map((designId) => getPatternDesignPreviewAssetById(designId))
    .filter((design): design is NonNullable<ReturnType<typeof getPatternDesignPreviewAssetById>> => Boolean(design))

  if (designs.length === 0) {
    return '<span class="text-amber-600">待配置</span>'
  }

  const source = side === 'FRONT' ? 'front' : 'inside'
  const sourceLabel = side === 'FRONT' ? '正面花型' : '里面花型'

  return `
    <div class="flex max-w-[180px] flex-wrap gap-1.5">
      ${designs
        .map((design) => {
          const designName = design.name || '未命名花型'
          return `
            <button
              type="button"
              class="inline-flex max-w-full items-center rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 transition hover:border-blue-200 hover:bg-blue-100"
              data-tech-action="open-design-thumbnail-preview"
              data-design-id="${escapeHtml(design.id)}"
              data-design-source="${source}"
              data-bom-id="${escapeHtml(item.id)}"
              data-tech-preview-trigger="${source}"
              title="查看${sourceLabel}缩略图"
              aria-label="查看${sourceLabel}缩略图"
            >
              <span class="truncate">${escapeHtml(designName)}</span>
            </button>
          `
        })
        .join('')}
    </div>
  `
}

export function renderDesignThumbnailPreviewDialog(): string {
  if (!state.designPreviewDialogOpen) return ''

  const design = getPatternDesignPreviewAssetById(state.designPreviewDesignId || '')
  const sourceLabel = state.designPreviewSource === 'inside' ? '里面花型' : '正面花型'
  const designName = design?.name || '暂无数据'
  const previewUrl = design?.previewUrl || ''

  return `
    <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        class="absolute inset-0 bg-black/45"
        data-tech-action="close-design-thumbnail-preview"
        data-tech-preview-backdrop="true"
        aria-label="关闭花型缩略图预览"
      ></button>
      <section
        class="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
        data-dialog-panel="true"
        data-tech-preview-dialog="design-thumbnail"
      >
        <header class="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div class="min-w-0">
            <h3 class="text-lg font-semibold">花型缩略图预览</h3>
            <p class="mt-1 text-sm text-muted-foreground" data-tech-preview-source="${escapeHtml(state.designPreviewSource || '')}">
              ${escapeHtml(sourceLabel)} · ${escapeHtml(designName)}
            </p>
          </div>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted"
            data-tech-action="close-design-thumbnail-preview"
            data-tech-preview-close="true"
            aria-label="关闭花型缩略图预览"
          >
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </header>
        <div class="flex min-h-[320px] items-center justify-center px-6 py-6">
          ${
            previewUrl
              ? `<img
                  src="${escapeHtml(previewUrl)}"
                  alt="${escapeHtml(`${designName} 缩略图`)}"
                  class="max-h-[70vh] w-full object-contain"
                  data-tech-preview-image="true"
                />`
              : '<div class="rounded-md border border-dashed px-6 py-12 text-center text-sm text-muted-foreground" data-tech-preview-empty="true">暂无缩略图</div>'
          }
        </div>
      </section>
    </div>
  `
}

export function renderBomTab(): string {
  const readonly = isTechPackModuleReadOnly('BOM')
  const spuLabel = state.techPack?.spuCode || '-'
  const skuOptions = getSkuOptionsForCurrentSpu()
  const skuByCode = new Map(skuOptions.map((item) => [item.skuCode, item]))
  const deriveColorLabel = (item: BomItemRow): string => {
    if (item.colorLabel.trim()) return item.colorLabel.trim()
    if (item.applicableSkuCodes.length === 0) return '全部SKU（当前未区分颜色）'
    const colors = dedupeStrings(
      item.applicableSkuCodes
        .map((skuCode) => skuByCode.get(skuCode)?.color || '')
        .filter((color) => color.trim().length > 0),
    )
    if (colors.length === 1) return colors[0]
    if (colors.length > 1) return '多颜色'
    return '未识别颜色'
  }

  type BomColorGroup = {
    groupKey: string
    colorLabel: string
    skuCodes: string[]
    rows: BomItemRow[]
  }

  const groupsByColor = new Map<string, BomColorGroup>()
  state.bomItems.forEach((item) => {
    const colorLabel = deriveColorLabel(item)
    const groupKey = colorLabel
    const current = groupsByColor.get(groupKey)
    if (current) {
      current.rows.push(item)
      current.skuCodes = dedupeStrings([...current.skuCodes, ...item.applicableSkuCodes])
      return
    }
    groupsByColor.set(groupKey, {
      groupKey,
      colorLabel,
      skuCodes: [...item.applicableSkuCodes],
      rows: [item],
    })
  })
  const groups = Array.from(groupsByColor.values()).sort((a, b) => {
    if (a.colorLabel.startsWith('全部')) return -1
    if (b.colorLabel.startsWith('全部')) return 1
    return a.colorLabel.localeCompare(b.colorLabel)
  })
  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 class="text-base font-semibold">物料清单</h3>
        </div>
        ${readonly ? '' : `<button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-add-bom">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
          添加物料
        </button>`}
      </header>
      <div class="p-4">
        ${
          state.bomItems.length === 0
            ? '<div class="py-8 text-center text-muted-foreground">暂无数据</div>'
            : `
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/30">
                    <th class="px-3 py-2 text-left">SPU</th>
                    <th class="px-3 py-2 text-left">颜色</th>
                    <th class="px-3 py-2 text-left">类型</th>
                    <th class="px-3 py-2 text-left">物料编码</th>
                    <th class="px-3 py-2 text-left">物料名称</th>
                    <th class="px-3 py-2 text-left">规格</th>
                    <th class="px-3 py-2 text-right">单位用量</th>
                    <th class="px-3 py-2 text-right">损耗率(%)</th>
                    <th class="px-3 py-2 text-left">印花需求</th>
                    <th class="px-3 py-2 text-left">印花面别</th>
                    <th class="px-3 py-2 text-left">正面花型</th>
                    <th class="px-3 py-2 text-left">里面花型</th>
                    <th class="px-3 py-2 text-left">染色需求</th>
                    <th class="px-3 py-2 text-left">缩水需求</th>
                    <th class="px-3 py-2 text-left">洗水需求</th>
                    <th class="px-3 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${groups
                    .map(
                      (group) => {
                        if (group.rows.length === 0) {
                          return `
                            <tr class="border-b last:border-0 bg-muted/10">
                              <td class="px-3 py-2 font-medium">${escapeHtml(spuLabel)}</td>
                              <td class="px-3 py-2 text-sm">${escapeHtml(group.colorLabel)}</td>
                              <td colspan="11" class="px-3 py-2 text-sm text-muted-foreground">当前 SKU 暂无适用物料</td>
                            </tr>
                          `
                        }

                        return group.rows
                          .map((item, rowIndex) => {
                            return `
                              <tr class="border-b last:border-0">
                                ${
                                  rowIndex === 0
                                    ? `<td rowspan="${group.rows.length}" class="px-3 py-2 align-top font-medium">${escapeHtml(spuLabel)}</td>
                                       <td rowspan="${group.rows.length}" class="px-3 py-2 align-top text-sm">
                                         <div class="space-y-1">
                                           <div>${escapeHtml(group.colorLabel)}</div>
                                           ${
                                             group.skuCodes.length > 0
                                               ? `<div class="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                                                    ${group.skuCodes
                                                      .map((skuCode) => {
                                                        const sku = skuByCode.get(skuCode)
                                                        const sizeLabel = sku?.size ? `/${sku.size}` : ''
                                                        return `<span class="inline-flex rounded border px-1.5 py-0.5">${escapeHtml(`${skuCode}${sizeLabel}`)}</span>`
                                                      })
                                                      .join('')}
                                                  </div>`
                                               : '<div class="text-[11px] text-muted-foreground">全部 SKU</div>'
                                           }
                                         </div>
                                       </td>`
                                    : ''
                                }
                                <td class="px-3 py-2"><span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(item.type)}</span></td>
                                <td class="px-3 py-2 font-mono text-sm">${escapeHtml(item.materialCode)}</td>
                                <td class="px-3 py-2 font-medium">${escapeHtml(item.materialName)}</td>
                                <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(item.spec || '-')}</td>
                                <td class="px-3 py-2 text-right">${item.usage}</td>
                                <td class="px-3 py-2 text-right">${item.lossRate}%</td>
                                <td class="px-3 py-2">
                                  ${
                                    readonly
                                      ? renderTextValue(item.printRequirement)
                                      : `<select class="h-8 w-24 rounded-md border px-2 text-sm" data-tech-field="bom-print" data-bom-id="${item.id}">
                                          ${printOptions
                                            .map((option) => `<option value="${option}" ${item.printRequirement === option ? 'selected' : ''}>${option}</option>`)
                                            .join('')}
                                        </select>`
                                  }
                                </td>
                                <td class="px-3 py-2">${item.printRequirement === '无' ? '<span class="text-muted-foreground">-</span>' : item.printSideMode ? escapeHtml(renderPrintSideModeLabel(item.printSideMode)) : '<span class="text-amber-600">待配置</span>'}</td>
                                <td class="px-3 py-2" data-tech-preview-cell="front" data-bom-id="${item.id}">${renderBomPrintBindingCell(item, 'FRONT')}</td>
                                <td class="px-3 py-2" data-tech-preview-cell="inside" data-bom-id="${item.id}">${renderBomPrintBindingCell(item, 'INSIDE')}</td>
                                <td class="px-3 py-2">
                                  ${
                                    readonly
                                      ? renderTextValue(item.dyeRequirement)
                                      : `<select class="h-8 w-24 rounded-md border px-2 text-sm" data-tech-field="bom-dye" data-bom-id="${item.id}">
                                          ${dyeOptions
                                            .map((option) => `<option value="${option}" ${item.dyeRequirement === option ? 'selected' : ''}>${option}</option>`)
                                            .join('')}
                                        </select>`
                                  }
                                </td>
                                <td class="px-3 py-2">
                                  ${
                                    readonly
                                      ? renderTextValue(item.shrinkRequirement)
                                      : `<select class="h-8 w-20 rounded-md border px-2 text-sm" data-tech-field="bom-shrink" data-bom-id="${item.id}" data-testid="bom-shrink-requirement-select">
                                          ${bomRequirementOptions
                                            .map((option) => `<option value="${option}" ${item.shrinkRequirement === option ? 'selected' : ''}>${option}</option>`)
                                            .join('')}
                                        </select>`
                                  }
                                </td>
                                <td class="px-3 py-2">
                                  ${
                                    readonly
                                      ? renderTextValue(item.washRequirement)
                                      : `<select class="h-8 w-20 rounded-md border px-2 text-sm" data-tech-field="bom-wash" data-bom-id="${item.id}" data-testid="bom-wash-requirement-select">
                                          ${bomRequirementOptions
                                            .map((option) => `<option value="${option}" ${item.washRequirement === option ? 'selected' : ''}>${option}</option>`)
                                            .join('')}
                                        </select>`
                                  }
                                </td>
                                <td class="px-3 py-2">
                                  <div class="flex items-center gap-1">
                                    ${readonly ? '' : `<button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted" data-tech-action="edit-bom" data-bom-id="${item.id}">
                                      <i data-lucide="edit-2" class="h-4 w-4"></i>
                                    </button>`}
                                    ${readonly ? '' : `<button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-bom" data-bom-id="${item.id}">
                                      <i data-lucide="trash-2" class="h-4 w-4"></i>
                                    </button>`}
                                  </div>
                                </td>
                              </tr>
                            `
                          })
                          .join('')
                      },
                    )
                    .join('')}
                </tbody>
              </table>
            `
        }
      </div>
    </section>
  `
}

function renderPatternDesignPicker(
  label: string,
  side: 'FRONT' | 'INSIDE',
  options: ReturnType<typeof getPatternDesignOptionsBySide>,
  selectedIds: string[],
): string {
  const field = side === 'FRONT' ? 'new-bom-front-pattern-design-id' : 'new-bom-inside-pattern-design-id'
  const selectedSet = new Set(selectedIds)

  return `
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm">${escapeHtml(label)}</span>
        <span class="text-xs text-muted-foreground">已选 ${selectedIds.length} 张</span>
      </div>
      ${
        options.length === 0
          ? `<div class="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">暂无${escapeHtml(label)}</div>`
          : `
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" data-tech-pattern-picker="${side.toLowerCase()}">
              ${options
                .map((item) => {
                  const checked = selectedSet.has(item.id)
                  const previewUrl = item.previewThumbnailDataUrl
                  return `
                    <label class="flex cursor-pointer gap-3 rounded-md border p-2 transition ${
                      checked ? 'border-blue-300 bg-blue-50' : 'border-border hover:bg-muted/40'
                    }">
                      <input
                        type="checkbox"
                        class="mt-1 h-4 w-4 rounded border-slate-300"
                        data-tech-field="${field}"
                        data-design-id="${escapeHtml(item.id)}"
                        ${checked ? 'checked' : ''}
                      />
                      <span class="flex min-w-0 flex-1 gap-2">
                        <span class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
                          ${
                            previewUrl
                              ? `<img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(item.name)}" class="h-full w-full object-cover" />`
                              : '<i data-lucide="image" class="h-5 w-5 text-muted-foreground"></i>'
                          }
                        </span>
                        <span class="min-w-0 text-xs">
                          <span class="block truncate font-medium text-foreground" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
                          <span class="mt-1 block truncate text-muted-foreground" title="${escapeHtml(item.originalFileName || '暂无原文件')}">${escapeHtml(item.originalFileName || '暂无原文件')}</span>
                          <span class="mt-1 block text-muted-foreground">${escapeHtml(item.uploadedAt || '未记录上传时间')}</span>
                        </span>
                      </span>
                    </label>
                  `
                })
                .join('')}
            </div>
          `
      }
    </div>
  `
}


export function renderBomFormDialog(): string {
  if (!state.addBomDialogOpen) return ''
  if (isTechPackModuleReadOnly('BOM')) return ''
  const skuOptions = getSkuOptionsForCurrentSpu()
  const colorOptions = dedupeStrings(skuOptions.map((item) => item.color))
  const applyAllSku = state.newBomItem.applicableSkuCodes.length === 0
  const frontDesignOptions = getPatternDesignOptionsBySide('FRONT')
  const insideDesignOptions = getPatternDesignOptionsBySide('INSIDE')
  const hasPrintDemand = state.newBomItem.printRequirement !== '无'
  const showDesignPickers = hasPrintDemand && (state.newBomItem.printSideMode === 'SINGLE' || state.newBomItem.printSideMode === 'DOUBLE')
  const selectedFrontDesignIds = getBomPatternDesignIds(state.newBomItem, 'FRONT')
  const selectedInsideDesignIds = getBomPatternDesignIds(state.newBomItem, 'INSIDE')

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">${state.editBomItemId ? '编辑物料' : '添加物料'}</h3>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div class="space-y-4">
            <label class="space-y-1">
              <span class="text-sm">物料类型</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-type">
                ${['面料', '辅料', '包装材料', '其他']
                  .map((option) => `<option value="${option}" ${state.newBomItem.type === option ? 'selected' : ''}>${option}</option>`)
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-sm">颜色</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-color-label">
                <option value="">未指定颜色</option>
                <option value="全部SKU（当前未区分颜色）" ${state.newBomItem.colorLabel === '全部SKU（当前未区分颜色）' ? 'selected' : ''}>全部SKU（当前未区分颜色）</option>
                ${colorOptions
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option)}" ${state.newBomItem.colorLabel === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-sm">物料编码</span>
              <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-material-code" value="${escapeHtml(state.newBomItem.materialCode)}" placeholder="物料编码" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">规格</span>
              <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-spec" value="${escapeHtml(state.newBomItem.spec)}" placeholder="规格" />
            </label>
            <div class="space-y-1">
              <span class="text-sm">适用 SKU</span>
              <div class="space-y-2 rounded-md border p-2 text-xs">
                <label class="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    data-tech-field="new-bom-apply-all-sku"
                    ${applyAllSku ? 'checked' : ''}
                  />
                  <span>全部 SKU</span>
                </label>
                ${
                  skuOptions.length === 0
                    ? '<p class="text-muted-foreground">暂无 SKU 数据</p>'
                    : `
                      <div class="grid grid-cols-1 gap-1">
                        ${skuOptions
                          .map(
                            (sku) => `
                              <label class="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  data-tech-field="new-bom-sku"
                                  data-sku-code="${sku.skuCode}"
                                  ${state.newBomItem.applicableSkuCodes.includes(sku.skuCode) ? 'checked' : ''}
                                  ${applyAllSku ? 'disabled' : ''}
                                />
                                <span>${escapeHtml(`${sku.color}（${sku.skuCode}${sku.size ? ` / ${sku.size}` : ''}）`)}</span>
                              </label>
                            `,
                          )
                          .join('')}
                      </div>
                    `
                }
              </div>
            </div>
            <div class="space-y-1">
              <span class="text-sm">使用工序</span>
              <div class="grid grid-cols-2 gap-2 rounded-md border p-2 text-xs">
                ${bomUsageProcessOptions
                  .map(
                    (option) => `
                      <label class="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          data-tech-field="new-bom-usage-process"
                          data-process-code="${option.code}"
                          ${state.newBomItem.usageProcessCodes.includes(option.code) ? 'checked' : ''}
                        />
                        <span>${escapeHtml(option.label)}</span>
                      </label>
                    `,
                  )
                  .join('')}
              </div>
            </div>
            <label class="space-y-1">
              <span class="text-sm">单位用量</span>
              <input type="number" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-usage" value="${escapeHtml(state.newBomItem.usage)}" placeholder="0" />
            </label>
          </div>

          <div class="space-y-4">
            <label class="space-y-1">
              <span class="text-sm">物料名称 <span class="text-red-500">*</span></span>
              <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-material-name" value="${escapeHtml(state.newBomItem.materialName)}" placeholder="物料名称" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">损耗率(%)</span>
              <input type="number" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-loss-rate" value="${escapeHtml(state.newBomItem.lossRate)}" placeholder="0" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">印花需求</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-print-requirement">
                ${printOptions
                  .map((option) => `<option value="${option}" ${state.newBomItem.printRequirement === option ? 'selected' : ''}>${option}</option>`)
                  .join('')}
              </select>
            </label>
            ${
              hasPrintDemand
                ? `
                  <label class="space-y-1">
                    <span class="text-sm">印花面别 <span class="text-red-500">*</span></span>
                    <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-print-side-mode">
                      <option value="" ${state.newBomItem.printSideMode === '' ? 'selected' : ''}>请选择</option>
                      <option value="SINGLE" ${state.newBomItem.printSideMode === 'SINGLE' ? 'selected' : ''}>单面印</option>
                      <option value="DOUBLE" ${state.newBomItem.printSideMode === 'DOUBLE' ? 'selected' : ''}>双面印</option>
                    </select>
                  </label>
                `
                : ''
            }
            ${showDesignPickers ? renderPatternDesignPicker('正面花型', 'FRONT', frontDesignOptions, selectedFrontDesignIds) : ''}
            ${showDesignPickers ? renderPatternDesignPicker('里面花型', 'INSIDE', insideDesignOptions, selectedInsideDesignIds) : ''}
            <label class="space-y-1">
              <span class="text-sm">染色需求</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-dye-requirement">
                ${dyeOptions
                  .map((option) => `<option value="${option}" ${state.newBomItem.dyeRequirement === option ? 'selected' : ''}>${option}</option>`)
                  .join('')}
              </select>
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="space-y-1">
                <span class="text-sm">缩水需求</span>
                <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-shrink-requirement" data-testid="new-bom-shrink-requirement">
                  ${bomRequirementOptions
                    .map((option) => `<option value="${option}" ${state.newBomItem.shrinkRequirement === option ? 'selected' : ''}>${option}</option>`)
                    .join('')}
                </select>
              </label>
              <label class="space-y-1">
                <span class="text-sm">洗水需求</span>
                <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-wash-requirement" data-testid="new-bom-wash-requirement">
                  ${bomRequirementOptions
                    .map((option) => `<option value="${option}" ${state.newBomItem.washRequirement === option ? 'selected' : ''}>${option}</option>`)
                    .join('')}
                </select>
              </label>
            </div>
          </div>
        </div>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-bom">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.newBomItem.materialName.trim() ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="save-bom">确认</button>
        </footer>
      </section>
    </div>
  `
}
