import {
  TECH_PACK_PATTERN_CATEGORY_OPTIONS,
  escapeHtml,
  formatPatternSpec,
  getBomColorOptionsForPattern,
  getPatternPieceSpecialCraftOptionsFromCurrentTechPack,
  getPatternBySelectionKey,
  getSizeCodeOptionsFromSizeRules,
  state,
} from './context.ts'

function isAllowedPatternImage(value: string): boolean {
  const normalized = String(value || '').trim()
  if (!normalized || normalized === '#') return false
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return false
  return !['/placeholder.svg', 'picsum', 'unsplash', 'dummyimage', 'loremflickr'].some((marker) =>
    normalized.includes(marker),
  )
}

function renderTextValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null || String(value).trim().length === 0) {
    return '<span class="text-muted-foreground">暂无数据</span>'
  }
  return escapeHtml(String(value))
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '暂无数据'
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}

function renderPatternFileBadge(label: string): string {
  return `<span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(label)}</span>`
}

function renderPatternFileInfo(input: {
  title: string
  fileName?: string
  fileSize?: number
  lastModified?: string
  action: string
  actionLabel: string
}): string {
  const hasFile = Boolean(String(input.fileName || '').trim())

  return `
    <div class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-medium">${escapeHtml(input.title)}</div>
          <div class="mt-1 text-xs text-muted-foreground">
            ${
              hasFile
                ? escapeHtml(input.fileName || '')
                : '暂无数据'
            }
          </div>
        </div>
        <button
          type="button"
          class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted"
          data-tech-action="${input.action}"
        >
          ${escapeHtml(input.actionLabel)}
        </button>
      </div>
      <div class="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div>文件大小：${escapeHtml(formatFileSize(input.fileSize || 0))}</div>
        <div>最后修改：${escapeHtml(input.lastModified || '暂无数据')}</div>
      </div>
    </div>
  `
}

function renderPatternPiecePreview(previewSvg?: string): string {
  if (!previewSvg) {
    return '<span class="text-muted-foreground">暂无图片</span>'
  }

  return `
    <div class="flex h-12 w-16 items-center justify-center overflow-hidden rounded border bg-white">
      ${previewSvg}
    </div>
  `
}

function renderReadonlyTagList(labels: string[], emptyText = '暂无数据'): string {
  if (labels.length === 0) {
    return `<span class="text-muted-foreground">${escapeHtml(emptyText)}</span>`
  }
  return `<div class="flex flex-wrap gap-1">${labels
    .map((label) => `<span class="inline-flex rounded border px-1.5 py-0.5 text-[10px]">${escapeHtml(label)}</span>`)
    .join('')}</div>`
}

function renderPatternSizeSummary(selectedSizeCodes: string[], sizeRange?: string): string {
  if (selectedSizeCodes.length > 0) return escapeHtml(selectedSizeCodes.join(' / '))
  return renderTextValue(sizeRange)
}

function renderPatternPieceColorSummary(
  row: { colorAllocations: Array<{ colorName: string; pieceCount: number }>; applicableSkuCodes: string[] },
): string {
  if (row.colorAllocations.length > 0) {
    return renderReadonlyTagList(row.colorAllocations.map((allocation) => allocation.colorName))
  }
  if (row.applicableSkuCodes.length > 0) {
    return renderReadonlyTagList(row.applicableSkuCodes)
  }
  return '<span class="text-muted-foreground">暂无数据</span>'
}

function renderPatternPieceColorCountSummary(
  row: { colorAllocations: Array<{ colorName: string; pieceCount: number }> },
): string {
  if (row.colorAllocations.length === 0) {
    return '<span class="text-muted-foreground">暂无数据</span>'
  }
  return `<div class="space-y-1">${row.colorAllocations
    .map(
      (allocation) =>
        `<div class="text-xs"><span class="text-muted-foreground">${escapeHtml(allocation.colorName)}</span>：${escapeHtml(String(allocation.pieceCount))}</div>`,
    )
    .join('')}</div>`
}

function renderPatternPieceSpecialCraftSummary(
  row: { specialCrafts: Array<{ displayName: string; craftName: string }> },
): string {
  if (row.specialCrafts.length === 0) {
    return '<span class="text-muted-foreground">无</span>'
  }
  return renderReadonlyTagList(
    row.specialCrafts.map((craft) => craft.displayName || craft.craftName),
    '无',
  )
}

function hasExtension(fileName: string, extension: string): boolean {
  return fileName.trim().toLowerCase().endsWith(extension)
}

function getWovenStatusMessage(): string {
  const hasDxf = Boolean(state.newPattern.dxfFileName.trim())
  const hasRul = Boolean(state.newPattern.rulFileName.trim())
  const dxfValid = !hasDxf || hasExtension(state.newPattern.dxfFileName, '.dxf')
  const rulValid = !hasRul || hasExtension(state.newPattern.rulFileName, '.rul')

  if (state.newPattern.patternParsing || state.newPattern.parseStatus === 'PARSING') return '解析中'
  if (hasDxf && !dxfValid) return 'DXF 文件格式不正确'
  if (hasRul && !rulValid) return 'RUL 文件格式不正确'
  if (!hasDxf && !hasRul) return '请成对上传 1 个 DXF 和 1 个 RUL 文件'
  if (hasDxf !== hasRul) return '还缺少 1 个配对文件'
  if (state.newPattern.parseStatus === 'FAILED') return state.newPattern.parseError || '解析失败'
  if (state.newPattern.parseStatus === 'PARSED' && state.newPattern.pieceRows.length > 0) {
    return `已解析 ${state.newPattern.pieceRows.length} 个裁片`
  }
  return '文件已齐，可解析'
}

function canParseWovenPattern(): boolean {
  const hasName = Boolean(state.newPattern.name.trim())
  const hasDxf = Boolean(state.newPattern.dxfFileName.trim())
  const hasRul = Boolean(state.newPattern.rulFileName.trim())
  if (!hasName || !hasDxf || !hasRul) return false
  if (!hasExtension(state.newPattern.dxfFileName, '.dxf')) return false
  if (!hasExtension(state.newPattern.rulFileName, '.rul')) return false
  return !state.newPattern.patternParsing
}

function canSavePatternForm(): boolean {
  if (!state.newPattern.name.trim()) return false
  const sizeOptions = getSizeCodeOptionsFromSizeRules()
  if (sizeOptions.length === 0 || state.newPattern.selectedSizeCodes.length === 0) return false
  const colorOptions = getBomColorOptionsForPattern(state.newPattern.linkedBomItemId)
  if (colorOptions.length === 0) return false

  const hasInvalidColorAllocations = state.newPattern.pieceRows.some(
    (row) =>
      row.colorAllocations.length === 0
      || row.colorAllocations.some((allocation) => Number(allocation.pieceCount) <= 0),
  )

  if (state.newPattern.patternMaterialType === 'WOVEN') {
    if (state.newPattern.parseStatus !== 'PARSED') return false
    if (state.newPattern.pieceRows.length === 0) return false
    if (hasInvalidColorAllocations) return false
    return !state.newPattern.pieceRows.some(
      (row) => !row.name.trim() || Number(row.count) <= 0 || row.missingName || row.missingCount,
    )
  }

  if (state.newPattern.patternMaterialType === 'KNIT') {
    if (!state.newPattern.singlePatternFileName.trim() && !state.newPattern.file.trim()) return false
    if (state.newPattern.pieceRows.length === 0) return false
    if (hasInvalidColorAllocations) return false
    return !state.newPattern.pieceRows.some((row) => !row.name.trim() || Number(row.count) <= 0)
  }

  return false
}

function renderLinkedBomLabel(patternId: string, linkedBomItemId: string, bomById: Map<string, { materialCode: string; materialName: string }>): string {
  const linkedBom = linkedBomItemId ? bomById.get(linkedBomItemId) : null
  if (!linkedBom) return '<span class="text-sm text-muted-foreground">未关联</span>'

  return `
    <button
      class="text-left text-blue-600 hover:underline"
      data-tech-action="open-pattern-detail"
      data-pattern-id="${patternId}"
    >
      ${escapeHtml(`${linkedBom.materialCode} · ${linkedBom.materialName}`)}
    </button>
  `
}

function renderPatternDetailPieceTable(): string {
  const pattern = getPatternBySelectionKey(state.selectedPattern || '')
  if (!pattern) return ''

  if (pattern.pieceRows.length === 0) {
    return '<div class="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">暂无数据</div>'
  }

  return `
    <table class="w-full text-xs">
      <thead>
        <tr class="border-b bg-muted/20">
          <th class="px-2 py-1 text-left">部位名称</th>
          <th class="px-2 py-1 text-right">片数</th>
          <th class="px-2 py-1 text-left">适用颜色</th>
          <th class="px-2 py-1 text-left">每种颜色的片数</th>
          <th class="px-2 py-1 text-left">特殊工艺</th>
          <th class="px-2 py-1 text-left">备注</th>
        </tr>
      </thead>
      <tbody>
        ${pattern.pieceRows
          .map(
            (row) => `
              <tr class="border-b last:border-0">
                <td class="px-2 py-1">${escapeHtml(row.name)}</td>
                <td class="px-2 py-1 text-right">${row.count}</td>
                <td class="px-2 py-1">${renderPatternPieceColorSummary(row)}</td>
                <td class="px-2 py-1">${renderPatternPieceColorCountSummary(row)}</td>
                <td class="px-2 py-1">${renderPatternPieceSpecialCraftSummary(row)}</td>
                <td class="px-2 py-1 text-muted-foreground">${escapeHtml(row.note || '-')}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `
}

export function renderPatternTab(): string {
  const bomById = new Map(
    state.bomItems.map((item) => [item.id, { materialCode: item.materialCode, materialName: item.materialName }]),
  )
  const readonly = false

  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between border-b px-4 py-3">
        <h3 class="text-base font-semibold">纸样管理</h3>
        ${readonly ? '' : `<button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-add-pattern">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
          添加纸样
        </button>`}
      </header>
      <div class="p-4">
        ${
          state.patternItems.length === 0
            ? '<div class="rounded-lg border py-8 text-center text-muted-foreground">暂无纸样</div>'
            : `
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/30">
                    <th class="px-3 py-2 text-left">纸样名称</th>
                    <th class="px-3 py-2 text-left">纸样文件类型</th>
                    <th class="px-3 py-2 text-left">纸样分类</th>
                    <th class="px-3 py-2 text-left">关联物料</th>
                    <th class="px-3 py-2 text-left">规格</th>
                    <th class="px-3 py-2 text-right">裁片总片数</th>
                    <th class="px-3 py-2 text-left">裁片明细</th>
                    <th class="px-3 py-2 text-left">纸样文件</th>
                    <th class="px-3 py-2 text-left">备注</th>
                    <th class="px-3 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.patternItems
                    .map((item) => {
                      const pieceCount =
                        Number.isFinite(item.totalPieceCount) && item.totalPieceCount > 0
                          ? item.totalPieceCount
                          : item.pieceRows.reduce((sum, row) => sum + row.count, 0)

                      return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2 font-medium">${escapeHtml(item.name)}</td>
                          <td class="px-3 py-2">${renderPatternFileBadge(item.patternMaterialTypeLabel || '暂无数据')}</td>
                          <td class="px-3 py-2"><span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(item.type)}</span></td>
                          <td class="px-3 py-2 text-sm">${renderLinkedBomLabel(item.id, item.linkedBomItemId, bomById)}</td>
                          <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(formatPatternSpec(item.widthCm, item.markerLengthM))}</td>
                          <td class="px-3 py-2 text-right">${pieceCount} 片</td>
                          <td class="px-3 py-2">
                            ${
                              item.pieceRows.length > 0
                                ? `<button type="button" class="text-blue-600 hover:underline" data-tech-action="open-pattern-detail" data-pattern-id="${item.id}">${item.pieceRows.length} 项明细</button>`
                                : '<span class="text-sm text-muted-foreground">暂无数据</span>'
                            }
                          </td>
                          <td class="px-3 py-2 text-sm text-muted-foreground">${renderTextValue(item.file)}</td>
                          <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(item.remark || '-')}</td>
                          <td class="px-3 py-2">
                            <div class="flex items-center gap-1">
                              ${readonly ? '' : `<button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted" data-tech-action="edit-pattern" data-pattern-id="${item.id}">
                                <i data-lucide="edit-2" class="h-4 w-4"></i>
                              </button>`}
                              <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted" data-tech-action="open-pattern-detail" data-pattern-id="${item.id}">
                                <i data-lucide="eye" class="h-4 w-4"></i>
                              </button>
                              ${readonly ? '' : `<button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-pattern" data-pattern-id="${item.id}">
                                <i data-lucide="trash-2" class="h-4 w-4"></i>
                              </button>`}
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')}
                </tbody>
              </table>
            `
        }
      </div>
    </section>
  `
}

export function renderPatternDialog(): string {
  if (!state.patternDialogOpen || !state.selectedPattern) return ''

  const pattern = getPatternBySelectionKey(state.selectedPattern)
  if (!pattern) return ''

  const linkedBom =
    pattern.linkedBomItemId.length > 0
      ? state.bomItems.find((item) => item.id === pattern.linkedBomItemId) ?? null
      : null
  const image = isAllowedPatternImage(pattern.image) ? pattern.image : ''
  const pieceTotal =
    Number.isFinite(pattern.totalPieceCount) && pattern.totalPieceCount > 0
      ? pattern.totalPieceCount
      : pattern.pieceRows.reduce((sum, row) => sum + row.count, 0)
  const isWoven = pattern.patternMaterialType === 'WOVEN'

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-4xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">纸样详情</h3>
        </header>
        <div class="space-y-4 px-6 py-4 text-sm">
          <div class="flex items-center gap-4">
            ${
              image
                ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(pattern.name)}" class="h-24 w-24 rounded border object-cover" />`
                : '<div class="flex h-24 w-24 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">暂无图片</div>'
            }
            <div>
              <h4 class="text-lg font-semibold">${escapeHtml(pattern.name)}</h4>
              <div class="mt-2 flex flex-wrap gap-2">
                ${renderPatternFileBadge(pattern.patternMaterialTypeLabel || '暂无数据')}
                <span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(pattern.type)}</span>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p class="text-xs text-muted-foreground">关联物料</p>
              <p class="mt-1">${escapeHtml(linkedBom ? `${linkedBom.materialCode} · ${linkedBom.materialName}` : '未关联')}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">规格（门幅 × 排料长度）</p>
              <p class="mt-1">${escapeHtml(formatPatternSpec(pattern.widthCm, pattern.markerLengthM))}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">裁片总片数</p>
              <p class="mt-1">${pieceTotal} 片</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">解析状态</p>
              <p class="mt-1">${renderTextValue(pattern.parseStatusLabel)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">纸样文件</p>
              <p class="mt-1">${renderTextValue(pattern.file)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">打版软件</p>
              <p class="mt-1">${renderTextValue(pattern.patternSoftwareName)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">尺码范围</p>
              <p class="mt-1">${renderPatternSizeSummary(pattern.selectedSizeCodes, pattern.sizeRange)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">RUL 基码</p>
              <p class="mt-1">${renderTextValue(pattern.rulSampleSize)}</p>
            </div>
          </div>
          ${
            isWoven
              ? `
                <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div class="rounded-md border p-3">
                    <div class="text-xs text-muted-foreground">DXF 文件</div>
                    <div class="mt-1">${renderTextValue(pattern.dxfFileName)}</div>
                  </div>
                  <div class="rounded-md border p-3">
                    <div class="text-xs text-muted-foreground">RUL 文件</div>
                    <div class="mt-1">${renderTextValue(pattern.rulFileName)}</div>
                  </div>
                </div>
              `
              : ''
          }
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h5 class="text-sm font-medium">裁片明细</h5>
              <span class="text-xs text-muted-foreground">单位：片</span>
            </div>
            ${renderPatternDetailPieceTable()}
          </div>
          ${
            pattern.remark
              ? `<p class="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">备注：${escapeHtml(pattern.remark)}</p>`
              : ''
          }
        </div>
        <footer class="flex items-center justify-end border-t px-6 py-4">
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-pattern-detail">关闭</button>
        </footer>
      </section>
    </div>
  `
}

function renderPatternSizeSelector(): string {
  const sizeOptions = getSizeCodeOptionsFromSizeRules()
  if (sizeOptions.length === 0) {
    return '<div class="rounded-md border border-dashed px-3 py-3 text-sm text-amber-600">请先维护放码规则</div>'
  }

  const selectedSizeSet = new Set(state.newPattern.selectedSizeCodes)
  return `<div class="flex flex-wrap gap-2">${sizeOptions
    .map((option) => {
      const selected = selectedSizeSet.has(option.sizeCode)
      return `<button
        type="button"
        class="inline-flex rounded-md border px-3 py-2 text-sm ${selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-muted'}"
        data-tech-action="toggle-pattern-size-code"
        data-size-code="${escapeHtml(option.sizeCode)}"
      >${escapeHtml(option.label)}</button>`
    })
    .join('')}</div>`
}

function renderPatternPieceColorSelector(
  row: (typeof state.newPattern.pieceRows)[number],
): string {
  const colorOptions = getBomColorOptionsForPattern(state.newPattern.linkedBomItemId)
  if (colorOptions.length === 0) {
    return '<span class="text-muted-foreground">请先维护物料清单颜色</span>'
  }

  const selectedColorSet = new Set(
    row.colorAllocations.map((allocation) => allocation.colorName.trim().toLowerCase()),
  )

  return `<div class="flex flex-wrap gap-1.5">${colorOptions
    .map((option) => {
      const selected = selectedColorSet.has(option.colorName.trim().toLowerCase())
      return `<button
        type="button"
        class="inline-flex rounded-md border px-2 py-1 text-[11px] ${selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-muted'}"
        data-tech-action="toggle-pattern-piece-color"
        data-piece-id="${row.id}"
        data-color-name="${escapeHtml(option.colorName)}"
      >${escapeHtml(option.colorName)}</button>`
    })
    .join('')}</div>`
}

function renderPatternPieceColorCountEditor(
  row: (typeof state.newPattern.pieceRows)[number],
): string {
  if (row.colorAllocations.length === 0) {
    return '<span class="text-muted-foreground">请先选择颜色</span>'
  }
  return `<div class="space-y-2">${row.colorAllocations
    .map(
      (allocation) => `
        <label class="flex items-center gap-2 text-xs">
          <span class="min-w-0 flex-1 truncate text-muted-foreground">${escapeHtml(allocation.colorName)}</span>
          <input
            type="number"
            min="1"
            class="h-8 w-20 rounded border px-2 text-right text-xs"
            data-tech-field="new-pattern-piece-color-count"
            data-piece-id="${row.id}"
            data-color-name="${escapeHtml(allocation.colorName)}"
            value="${escapeHtml(String(allocation.pieceCount || 0))}"
          />
        </label>
      `,
    )
    .join('')}</div>`
}

function renderPatternPieceSpecialCraftSelector(
  row: (typeof state.newPattern.pieceRows)[number],
): string {
  const specialCraftOptions = getPatternPieceSpecialCraftOptionsFromCurrentTechPack()
  if (specialCraftOptions.length === 0) {
    return '<span class="text-muted-foreground">无</span>'
  }
  const selectedCraftKeys = new Set(
    row.specialCrafts.map((item) => `${item.processCode}:${item.craftCode}`),
  )
  const invalidHistoryCrafts = row.specialCrafts.filter(
    (item) => !specialCraftOptions.some((option) => option.processCode === item.processCode && option.craftCode === item.craftCode),
  )
  return `<div class="flex flex-wrap gap-1.5">${specialCraftOptions
    .map((craft) => {
      const selected = selectedCraftKeys.has(`${craft.processCode}:${craft.craftCode}`)
      return `<button
        type="button"
        class="inline-flex rounded-md border px-2 py-1 text-[11px] ${selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-muted'}"
        data-tech-action="toggle-pattern-piece-special-craft"
        data-piece-id="${row.id}"
        data-process-code="${escapeHtml(craft.processCode)}"
        data-craft-code="${escapeHtml(craft.craftCode)}"
      >${escapeHtml(craft.displayName)}</button>`
    })
    .join('')}${invalidHistoryCrafts
    .map(
      (craft) => `<span class="inline-flex rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">${escapeHtml(
        `${craft.displayName || craft.craftName}（历史值）`,
      )}</span>`,
    )
    .join('')}</div>`
}

function renderPatternPieceEditorTable(isWoven: boolean): string {
  if (state.newPattern.pieceRows.length === 0) {
    return '<div class="rounded border border-dashed px-3 py-3 text-xs text-muted-foreground">暂无数据</div>'
  }

  return `
    <table class="w-full text-xs">
      <thead>
        <tr class="border-b bg-muted/20">
          <th class="px-2 py-1 text-left">部位名称</th>
          <th class="px-2 py-1 text-right">片数</th>
          <th class="px-2 py-1 text-left">适用颜色</th>
          <th class="px-2 py-1 text-left">每种颜色的片数</th>
          <th class="px-2 py-1 text-left">特殊工艺</th>
          <th class="px-2 py-1 text-left">备注</th>
          <th class="px-2 py-1 text-right">操作</th>
        </tr>
      </thead>
      <tbody>
        ${state.newPattern.pieceRows
          .map(
            (row) => `
              <tr class="border-b align-top last:border-0">
                <td class="px-2 py-1">
                  ${
                    isWoven
                      ? row.name.trim()
                        ? escapeHtml(row.name)
                        : '<span class="text-red-600">名称缺失</span>'
                      : `<input class="h-8 w-full rounded border px-2 text-xs" data-tech-field="new-pattern-piece-name" data-piece-id="${row.id}" value="${escapeHtml(row.name)}" placeholder="例如 前片" />`
                  }
                </td>
                <td class="px-2 py-1">
                  ${
                    isWoven
                      ? Number(row.count) > 0
                        ? `<div class="pt-1 text-right">${escapeHtml(String(row.count))}</div>`
                        : '<span class="text-red-600">数量缺失</span>'
                      : `<input type="number" min="1" class="h-8 w-20 rounded border px-2 text-right text-xs" data-tech-field="new-pattern-piece-count" data-piece-id="${row.id}" value="${escapeHtml(String(row.count || 0))}" />`
                  }
                </td>
                <td class="px-2 py-1">${renderPatternPieceColorSelector(row)}</td>
                <td class="px-2 py-1">${renderPatternPieceColorCountEditor(row)}</td>
                <td class="px-2 py-1">${renderPatternPieceSpecialCraftSelector(row)}</td>
                <td class="px-2 py-1">
                  <input class="h-8 w-full rounded border px-2 text-xs" data-tech-field="new-pattern-piece-note" data-piece-id="${row.id}" value="${escapeHtml(row.note)}" placeholder="备注" />
                </td>
                <td class="px-2 py-1 text-right">
                  ${
                    isWoven
                      ? '<span class="text-muted-foreground">-</span>'
                      : `<button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-new-pattern-piece-row" data-piece-id="${row.id}">
                          <i data-lucide="trash-2" class="h-3 w-3"></i>
                        </button>`
                  }
                </td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `
}

export function renderPatternFormDialog(): string {
  if (!state.addPatternDialogOpen) return ''

  const bomOptions = state.bomItems
  const isWoven = state.newPattern.patternMaterialType === 'WOVEN'
  const isKnit = state.newPattern.patternMaterialType === 'KNIT'
  const sizeOptions = getSizeCodeOptionsFromSizeRules()
  const bomColorOptions = getBomColorOptionsForPattern(state.newPattern.linkedBomItemId)
  const parseButtonLabel =
    state.newPattern.patternParsing
      ? '解析中'
      : state.newPattern.parseStatus === 'PARSED'
        ? '重新解析'
        : '解析纸样'

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-5xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">${state.editPatternItemId ? '编辑纸样' : '新增纸样'}</h3>
        </header>
        <div class="space-y-4 px-6 py-4">
          <input id="tech-pack-pattern-dxf-input" type="file" accept=".dxf" data-tech-field="new-pattern-dxf-file" class="hidden" />
          <input id="tech-pack-pattern-rul-input" type="file" accept=".rul" data-tech-field="new-pattern-rul-file" class="hidden" />
          <input id="tech-pack-pattern-single-input" type="file" accept=".dxf,.rul,.zip,.pdf,.jpg,.jpeg,.png,.ai,.cdr" data-tech-field="new-pattern-single-file" class="hidden" />

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label class="space-y-1">
              <span class="text-sm">纸样名称 <span class="text-red-500">*</span></span>
              <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-name" value="${escapeHtml(state.newPattern.name)}" placeholder="例如 前片纸样" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">纸样文件类型 <span class="text-red-500">*</span></span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-material-type">
                <option value="UNKNOWN" ${state.newPattern.patternMaterialType === 'UNKNOWN' ? 'selected' : ''}>请选择</option>
                <option value="WOVEN" ${state.newPattern.patternMaterialType === 'WOVEN' ? 'selected' : ''}>布料纸样</option>
                <option value="KNIT" ${state.newPattern.patternMaterialType === 'KNIT' ? 'selected' : ''}>针织纸样</option>
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-sm">纸样分类</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-type">
                ${TECH_PACK_PATTERN_CATEGORY_OPTIONS.map((option) => `<option value="${option}" ${state.newPattern.type === option ? 'selected' : ''}>${option}</option>`).join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-sm">关联物料（物料清单）</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-linked-bom-item">
                <option value="">请选择关联物料</option>
                ${bomOptions
                  .map(
                    (item) =>
                      `<option value="${item.id}" ${state.newPattern.linkedBomItemId === item.id ? 'selected' : ''}>${escapeHtml(`${item.materialCode} · ${item.materialName}`)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-sm">门幅（cm）</span>
              <input type="number" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-width-cm" value="${escapeHtml(String(state.newPattern.widthCm || ''))}" placeholder="例如 142" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">排料长度（m）</span>
              <input type="number" step="0.01" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-marker-length-m" value="${escapeHtml(String(state.newPattern.markerLengthM || ''))}" placeholder="例如 2.62" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">打版软件</span>
              <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-pattern-software-name" value="${escapeHtml(state.newPattern.patternSoftwareName || '')}" placeholder="例如 Lectra" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">尺码范围 <span class="text-red-500">*</span></span>
              ${renderPatternSizeSelector()}
            </label>
            <label class="space-y-1 md:col-span-2">
              <span class="text-sm">备注</span>
              <textarea rows="2" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-remark" placeholder="备注信息">${escapeHtml(state.newPattern.remark)}</textarea>
            </label>
          </div>

          ${
            sizeOptions.length === 0
              ? '<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">请先维护放码规则</div>'
              : ''
          }
          ${
            bomColorOptions.length === 0
              ? '<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">请先维护物料清单颜色</div>'
              : ''
          }

          ${
            state.newPattern.patternMaterialType === 'UNKNOWN'
              ? '<div class="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">请先选择纸样文件类型</div>'
              : ''
          }

          ${
            isWoven
              ? `
                <section class="space-y-3 rounded-lg border p-4">
                  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    ${renderPatternFileInfo({
                      title: 'DXF 文件',
                      fileName: state.newPattern.dxfFileName,
                      fileSize: state.newPattern.dxfFileSize,
                      lastModified: state.newPattern.dxfLastModified,
                      action: 'open-pattern-dxf-picker',
                      actionLabel: '选择 DXF 文件',
                    })}
                    ${renderPatternFileInfo({
                      title: 'RUL 文件',
                      fileName: state.newPattern.rulFileName,
                      fileSize: state.newPattern.rulFileSize,
                      lastModified: state.newPattern.rulLastModified,
                      action: 'open-pattern-rul-picker',
                      actionLabel: '选择 RUL 文件',
                    })}
                  </div>
                  <div class="rounded-md border bg-muted/20 px-3 py-2 text-sm ${
                    state.newPattern.parseStatus === 'FAILED' ? 'text-red-600' : 'text-muted-foreground'
                  }">
                    ${escapeHtml(getWovenStatusMessage())}
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${canParseWovenPattern() ? '' : 'pointer-events-none opacity-50'}"
                      data-tech-action="parse-pattern"
                    >
                      ${escapeHtml(parseButtonLabel)}
                    </button>
                    <button
                      type="button"
                      class="rounded-md border px-4 py-2 text-sm hover:bg-muted"
                      data-tech-action="clear-pattern-uploaded-files"
                    >
                      清空已上传文件
                    </button>
                  </div>
                  <section class="space-y-2 rounded-md border p-3">
                    <div class="flex items-center justify-between">
                      <h4 class="text-sm font-medium">裁片明细</h4>
                      <span class="text-xs text-muted-foreground">解析结果只读部位名称和片数</span>
                    </div>
                    ${renderPatternPieceEditorTable(true)}
                  </section>
                </section>
              `
              : ''
          }

          ${
            isKnit
              ? `
                <section class="space-y-3 rounded-lg border p-4">
                  ${renderPatternFileInfo({
                    title: '上传纸样文件',
                    fileName: state.newPattern.singlePatternFileName || state.newPattern.file,
                    fileSize: state.newPattern.singlePatternFileSize,
                    lastModified: state.newPattern.singlePatternFileLastModified,
                    action: 'open-pattern-single-file-picker',
                    actionLabel: '选择纸样文件',
                  })}
                  <section class="space-y-2 rounded-md border p-3">
                    <div class="flex items-center justify-between">
                      <h4 class="text-sm font-medium">裁片明细</h4>
                      <button type="button" class="inline-flex items-center rounded border px-2 py-1 text-xs hover:bg-muted" data-tech-action="add-new-pattern-piece-row">
                        <i data-lucide="plus" class="mr-1 h-3 w-3"></i>
                        新增裁片
                      </button>
                    </div>
                    ${renderPatternPieceEditorTable(false)}
                  </section>
                </section>
              `
              : ''
          }
          ${
            state.newPattern.parseError
              ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">${escapeHtml(state.newPattern.parseError)}</div>`
              : ''
          }
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-pattern">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${canSavePatternForm() ? '' : 'pointer-events-none opacity-50'}" data-tech-action="save-pattern">确认</button>
        </footer>
      </section>
    </div>
  `
}
