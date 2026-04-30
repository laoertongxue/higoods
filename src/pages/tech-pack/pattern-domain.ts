import {
  TECH_PACK_PATTERN_CATEGORY_OPTIONS,
  calculatePatternTotalPieceQty,
  escapeHtml,
  formatPatternSpec,
  getBomColorOptionsForPattern,
  getPatternColorQuantityOptions,
  getPartTemplateOptions,
  getPatternPieceInstanceSpecialCraftOptions,
  getPatternPieceSpecialCraftOptionsFromCurrentTechPack,
  PATTERN_CRAFT_POSITION_OPTIONS,
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
  testId?: string
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
          ${input.testId ? `data-testid="${escapeHtml(input.testId)}"` : ''}
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

function renderBindingStripCount(count: number): string {
  return `${count} 条`
}

function renderPatternBindingStripEditor(): string {
  const rows = state.newPattern.bindingStrips
  return `
    <section class="space-y-3 rounded-md border p-3" data-testid="pattern-binding-strip-section">
      <div class="flex items-center justify-between">
        <div>
          <h4 class="text-sm font-medium">捆条</h4>
          <p class="text-xs text-muted-foreground">跟随纸样维护，长度和宽度单位固定为 cm。</p>
        </div>
        <button type="button" class="inline-flex items-center rounded border px-2 py-1 text-xs hover:bg-muted" data-tech-action="add-pattern-binding-strip" data-testid="add-binding-strip-button">
          <i data-lucide="plus" class="mr-1 h-3 w-3"></i>
          添加捆条
        </button>
      </div>
      ${
        rows.length === 0
          ? '<div class="rounded border border-dashed px-3 py-3 text-xs text-muted-foreground">暂无捆条，可点击添加捆条</div>'
          : `
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b bg-muted/20">
                    <th class="px-2 py-1 text-left">捆条编号</th>
                    <th class="px-2 py-1 text-left">捆条名称</th>
                    <th class="px-2 py-1 text-left">长度（cm）</th>
                    <th class="px-2 py-1 text-left">宽度（cm）</th>
                    <th class="px-2 py-1 text-left">备注</th>
                    <th class="px-2 py-1 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map((row) => `
                    <tr class="border-b last:border-0" data-testid="binding-strip-row">
                      <td class="px-2 py-1">${escapeHtml(row.bindingStripNo)}</td>
                      <td class="px-2 py-1">
                        <input class="h-8 w-32 rounded border px-2 text-xs" data-tech-field="new-pattern-binding-strip-name" data-binding-strip-id="${escapeHtml(row.bindingStripId)}" value="${escapeHtml(row.bindingStripName)}" placeholder="例如 领口捆条" />
                      </td>
                      <td class="px-2 py-1">
                        <input type="number" min="0.1" step="0.1" class="h-8 w-24 rounded border px-2 text-right text-xs" data-tech-field="new-pattern-binding-strip-length-cm" data-binding-strip-id="${escapeHtml(row.bindingStripId)}" value="${escapeHtml(String(row.lengthCm || ''))}" />
                      </td>
                      <td class="px-2 py-1">
                        <input type="number" min="0.1" step="0.1" class="h-8 w-24 rounded border px-2 text-right text-xs" data-tech-field="new-pattern-binding-strip-width-cm" data-binding-strip-id="${escapeHtml(row.bindingStripId)}" value="${escapeHtml(String(row.widthCm || ''))}" />
                      </td>
                      <td class="px-2 py-1">
                        <input class="h-8 w-40 rounded border px-2 text-xs" data-tech-field="new-pattern-binding-strip-remark" data-binding-strip-id="${escapeHtml(row.bindingStripId)}" value="${escapeHtml(row.remark || '')}" placeholder="可选" />
                      </td>
                      <td class="px-2 py-1 text-right">
                        <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-pattern-binding-strip" data-binding-strip-id="${escapeHtml(row.bindingStripId)}">
                          <i data-lucide="trash-2" class="h-3 w-3"></i>
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `
      }
    </section>
  `
}

function renderPatternBindingStripDetail(pattern: (typeof state.patternItems)[number]): string {
  if (pattern.bindingStrips.length === 0) {
    return '<div class="rounded border border-dashed px-3 py-3 text-sm text-muted-foreground">暂无捆条</div>'
  }
  return `
    <table class="w-full text-xs">
      <thead>
        <tr class="border-b bg-muted/20">
          <th class="px-2 py-1 text-left">捆条编号</th>
          <th class="px-2 py-1 text-left">捆条名称</th>
          <th class="px-2 py-1 text-left">长度（cm）</th>
          <th class="px-2 py-1 text-left">宽度（cm）</th>
          <th class="px-2 py-1 text-left">备注</th>
        </tr>
      </thead>
      <tbody>
        ${pattern.bindingStrips.map((row) => `
          <tr class="border-b last:border-0">
            <td class="px-2 py-1">${escapeHtml(row.bindingStripNo)}</td>
            <td class="px-2 py-1">${renderTextValue(row.bindingStripName)}</td>
            <td class="px-2 py-1">${renderTextValue(row.lengthCm)}</td>
            <td class="px-2 py-1">${renderTextValue(row.widthCm)}</td>
            <td class="px-2 py-1">${renderTextValue(row.remark)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

function renderPatternDuplicateWarning(): string {
  const warning = state.patternDuplicateWarning
  if (!warning) return ''
  const patternNames = warning.duplicatePatternNames.length > 0 ? warning.duplicatePatternNames.join('、') : '未命名纸样'
  return `
    <section class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-testid="pattern-duplicate-warning">
      <h4 class="font-medium">疑似重复纸样</h4>
      <p class="mt-1">当前技术包中存在相似纸样：${escapeHtml(patternNames)}</p>
      <p class="mt-1">原因：${escapeHtml(warning.warningReasons.join('；'))}</p>
      <p class="mt-1 text-xs">请确认是否继续保存为新纸样。</p>
      <div class="mt-3 flex justify-end gap-2">
        <button type="button" class="rounded border px-3 py-1.5 text-xs hover:bg-white" data-tech-action="cancel-pattern-duplicate-warning">返回修改</button>
        <button type="button" class="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700" data-tech-action="confirm-pattern-duplicate-warning">继续保存为新纸样</button>
      </div>
    </section>
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

function renderTemplatePreview(previewSvg?: string, emptyText = '-'): string {
  if (!previewSvg) {
    return `<span class="text-muted-foreground">${escapeHtml(emptyText)}</span>`
  }

  return `
    <div class="flex h-12 w-16 items-center justify-center overflow-hidden rounded border bg-white">
      ${previewSvg}
    </div>
  `
}

function renderTemplateFlag(isTemplate?: boolean): string {
  return isTemplate ? '是' : '否'
}

function renderTemplateBindingSummary(
  row: {
    isTemplate?: boolean
    partTemplateId?: string
    partTemplateName?: string
    partTemplatePreviewSvg?: string
    partTemplateShapeDescription?: string
  },
): string {
  if (!row.isTemplate) {
    return '<span class="text-muted-foreground">-</span>'
  }

  const summary = [row.partTemplateId, row.partTemplateName, row.partTemplateShapeDescription]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(' · ')

  return `
    <div class="space-y-2">
      <div class="text-xs">${summary ? escapeHtml(summary) : '<span class="text-red-600">待选择模板</span>'}</div>
      ${renderTemplatePreview(row.partTemplatePreviewSvg, '暂无模板缩略图')}
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

function getEnabledPatternColorQuantities(
  row: { colorPieceQuantities?: Array<{ colorName: string; pieceQty: number; enabled: boolean }> },
): Array<{ colorName: string; pieceQty: number; enabled: boolean }> {
  return (row.colorPieceQuantities ?? []).filter((item) => item.enabled)
}

function renderPatternPieceColorQuantitySummary(
  row: { colorPieceQuantities?: Array<{ colorName: string; pieceQty: number; enabled: boolean }> },
): string {
  const enabledQuantities = getEnabledPatternColorQuantities(row)
  if (enabledQuantities.length === 0) {
    return '<span class="text-red-600">请至少选择一个适用颜色</span>'
  }
  return `<div class="space-y-1">${enabledQuantities
    .map(
      (quantity) =>
        `<div class="text-xs"><span class="text-muted-foreground">${escapeHtml(quantity.colorName)}</span>：${escapeHtml(String(quantity.pieceQty || 0))} 片</div>`,
    )
    .join('')}</div>`
}

function renderPatternPieceQuantityWarnings(
  row: {
    parsedQuantity?: number
    totalPieceQty?: number
    colorPieceQuantities?: Array<{ pieceQty: number; enabled: boolean }>
  },
): string {
  const warnings: string[] = []
  const colorQuantities = row.colorPieceQuantities ?? []
  const enabledQuantities = colorQuantities.filter((item) => item.enabled)
  if (colorQuantities.some((item) => !Number.isInteger(Number(item.pieceQty)) || Number(item.pieceQty) < 0)) {
    warnings.push('颜色片数必须为非负整数。')
  }
  if (enabledQuantities.length === 0) warnings.push('请至少选择一个适用颜色。')
  if (enabledQuantities.some((item) => Number(item.pieceQty) === 0)) {
    warnings.push('已选择适用颜色但片数为 0，请确认。')
  }
  if (Number(row.totalPieceQty || 0) === 0) warnings.push('当前总片数为 0，请维护颜色片数。')
  if (
    Number.isFinite(Number(row.parsedQuantity))
    && Number(row.parsedQuantity) !== Number(row.totalPieceQty || 0)
  ) {
    warnings.push('解析参考片数与颜色片数合计不一致，请确认。')
  }
  if (warnings.length === 0) return ''
  return `<div class="mt-1 space-y-1 text-[11px] text-amber-600">${warnings
    .map((item) => `<div>${escapeHtml(item)}</div>`)
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

function getPieceInstancesBySourcePieceId(sourcePieceId: string) {
  return state.newPattern.pieceInstances.filter((instance) => instance.sourcePieceId === sourcePieceId)
}

function renderPieceInstanceCraftSummary(sourcePieceId: string): string {
  const instances = getPieceInstancesBySourcePieceId(sourcePieceId)
  const configured = instances.filter((instance) => instance.specialCraftAssignments.length > 0).length
  return `
    <div class="space-y-2">
      <div class="text-xs" data-testid="piece-instance-craft-summary" data-piece-id="${escapeHtml(sourcePieceId)}">已配置 ${escapeHtml(String(configured))} / 共 ${escapeHtml(String(instances.length))} 片</div>
      <button
        type="button"
        class="inline-flex items-center rounded border px-2 py-1 text-[11px] hover:bg-muted"
        data-tech-action="open-piece-instance-special-craft-dialog"
        data-piece-id="${escapeHtml(sourcePieceId)}"
      >
        维护逐片工艺
      </button>
    </div>
  `
}

function renderReadonlyPieceInstanceCraftSummary(pattern: (typeof state.patternItems)[number], sourcePieceId: string): string {
  const instances = pattern.pieceInstances.filter((instance) => instance.sourcePieceId === sourcePieceId)
  const configured = instances.filter((instance) => instance.specialCraftAssignments.length > 0).length
  return `
    <div class="space-y-1">
      <div>已配置 ${escapeHtml(String(configured))} / 共 ${escapeHtml(String(instances.length))} 片</div>
      ${renderReadonlyTagList(
        instances
          .flatMap((instance) =>
            instance.specialCraftAssignments.map((assignment) =>
              `${instance.displayName}：${assignment.craftName}（${assignment.craftPositionName}）`,
            ),
          )
          .slice(0, 3),
        '暂无逐片工艺',
      )}
    </div>
  `
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
  const colorOptions = getPatternColorQuantityOptions(state.newPattern.linkedBomItemId)
  if (colorOptions.length === 0) return false

  const hasInvalidColorQuantities = state.newPattern.pieceRows.some(
    (row) =>
      row.colorPieceQuantities.length === 0
      || row.colorPieceQuantities.some((item) => !Number.isInteger(Number(item.pieceQty)) || Number(item.pieceQty) < 0)
      || !row.colorPieceQuantities.some((item) => item.enabled && Number(item.pieceQty) > 0),
  )
  if (state.newPattern.patternMaterialType === 'WOVEN') {
    if (state.newPattern.parseStatus !== 'PARSED') return false
    if (state.newPattern.pieceRows.length === 0) return false
    if (hasInvalidColorQuantities) return false
    return !state.newPattern.pieceRows.some(
      (row) => !row.name.trim() || Number(row.totalPieceQty) <= 0 || row.missingName,
    )
  }

  if (state.newPattern.patternMaterialType === 'KNIT') {
    if (!state.newPattern.singlePatternFileName.trim() && !state.newPattern.file.trim()) return false
    if (state.newPattern.pieceRows.length === 0) return false
    if (hasInvalidColorQuantities) return false
    return !state.newPattern.pieceRows.some((row) => !row.name.trim() || Number(row.totalPieceQty) <= 0)
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

  const isWoven = pattern.patternMaterialType === 'WOVEN'
  const patternTotalPieceQty = calculatePatternTotalPieceQty(pattern.pieceRows)

  return `
    <div class="space-y-2" data-testid="pattern-piece-table">
      <div class="flex items-center justify-end text-xs font-medium text-blue-700" data-testid="pattern-piece-total">
        当前总片数：${escapeHtml(String(patternTotalPieceQty))} 片
      </div>
      <div class="text-xs text-muted-foreground">每种颜色片数由适用颜色维护，系统自动汇总当前部位总片数。</div>
      ${patternTotalPieceQty === 0 ? '<div class="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">当前总片数为 0，请维护颜色片数。</div>' : ''}
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b bg-muted/20">
            <th class="px-2 py-1 text-left">部位名称</th>
            ${
              isWoven
                ? `
                  <th class="px-2 py-1 text-left">原始名称</th>
                  <th class="px-2 py-1 text-left">尺码</th>
                  <th class="px-2 py-1 text-left">解析参考片数</th>
                  <th class="px-2 py-1 text-left">预览</th>
                `
                : ''
            }
            <th class="px-2 py-1 text-left">适用颜色与颜色片数</th>
            <th class="px-2 py-1 text-right">当前部位总片数</th>
            <th class="px-2 py-1 text-left">备注</th>
            <th class="px-2 py-1 text-left">逐片特殊工艺</th>
            <th class="px-2 py-1 text-left">是否为模板</th>
            <th class="px-2 py-1 text-left">部位模板ID</th>
            <th class="px-2 py-1 text-left">部位模板缩略图</th>
          </tr>
        </thead>
        <tbody>
          ${pattern.pieceRows
            .map(
              (row) => `
                <tr class="border-b align-top last:border-0" data-testid="pattern-piece-row">
                  <td class="px-2 py-1">${escapeHtml(row.name)}</td>
                  ${
                    isWoven
                      ? `
                        <td class="px-2 py-1">${renderTextValue(row.sourcePartName || row.systemPieceName)}</td>
                        <td class="px-2 py-1">${renderTextValue(row.sizeCode)}</td>
                        <td class="px-2 py-1">${renderTextValue(row.parsedQuantity)}</td>
                        <td class="px-2 py-1">${renderPatternPiecePreview(row.previewSvg)}</td>
                      `
                      : ''
                  }
                  <td class="px-2 py-1">${renderPatternPieceColorQuantitySummary(row)}${renderPatternPieceQuantityWarnings(row)}</td>
                  <td class="px-2 py-1 text-right" data-testid="pattern-piece-total-qty">${escapeHtml(String(row.totalPieceQty || 0))} 片</td>
                  <td class="px-2 py-1">${renderTextValue(row.note || row.annotation)}</td>
                  <td class="px-2 py-1">${renderReadonlyPieceInstanceCraftSummary(pattern, row.id)}</td>
                  <td class="px-2 py-1">${renderTemplateFlag(row.isTemplate)}</td>
                  <td class="px-2 py-1">${renderTextValue(row.partTemplateId)}</td>
                  <td class="px-2 py-1">${renderTemplatePreview(row.partTemplatePreviewSvg)}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
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
                    <th class="px-3 py-2 text-left">维护状态</th>
                    <th class="px-3 py-2 text-left">捆条数量</th>
                    <th class="px-3 py-2 text-right">裁片总片数</th>
                    <th class="px-3 py-2 text-left">裁片明细</th>
                    <th class="px-3 py-2 text-left">技术文件</th>
                    <th class="px-3 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.patternItems
                    .map((item) => {
                      const pieceCount =
                        Number.isFinite(item.patternTotalPieceQty) && item.patternTotalPieceQty > 0
                          ? item.patternTotalPieceQty
                          : calculatePatternTotalPieceQty(item.pieceRows)

                      return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2 font-medium">${escapeHtml(item.name)}</td>
                          <td class="px-3 py-2">${renderPatternFileBadge(item.patternMaterialTypeLabel || '暂无数据')}</td>
                          <td class="px-3 py-2"><span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(item.type)}</span></td>
                          <td class="px-3 py-2 text-sm">${renderLinkedBomLabel(item.id, item.linkedBomItemId, bomById)}</td>
                          <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(formatPatternSpec(item.widthCm, item.markerLengthM))}</td>
                          <td class="px-3 py-2"><span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(item.maintainerStepStatus)}</span></td>
                          <td class="px-3 py-2 text-sm">${escapeHtml(renderBindingStripCount(item.bindingStrips.length))}</td>
                          <td class="px-3 py-2 text-right">${pieceCount} 片</td>
                          <td class="px-3 py-2">
                            ${
                              item.pieceRows.length > 0
                                ? `<button type="button" class="text-blue-600 hover:underline" data-tech-action="open-pattern-detail" data-pattern-id="${item.id}">${item.pieceRows.length} 项明细</button>`
                                : '<span class="text-sm text-muted-foreground">暂无数据</span>'
                            }
                          </td>
                          <td class="px-3 py-2 text-sm text-muted-foreground">${renderTextValue([item.prjFile?.fileName, item.markerImage?.fileName, item.file].filter(Boolean).join(' / '))}</td>
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
    Number.isFinite(pattern.patternTotalPieceQty) && pattern.patternTotalPieceQty > 0
      ? pattern.patternTotalPieceQty
      : calculatePatternTotalPieceQty(pattern.pieceRows)
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
              <p class="text-xs text-muted-foreground">维护状态</p>
              <p class="mt-1">${renderTextValue(pattern.maintainerStepStatus)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">纸样 PRJ 文件</p>
              <p class="mt-1">${renderTextValue(pattern.prjFile?.fileName)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">唛架图片</p>
              <p class="mt-1">${renderTextValue(pattern.markerImage?.fileName)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">技术文件</p>
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
              <h5 class="text-sm font-medium">捆条</h5>
              <span class="text-xs text-muted-foreground">长度和宽度单位：cm</span>
            </div>
            ${renderPatternBindingStripDetail(pattern)}
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h5 class="text-sm font-medium">裁片明细</h5>
              <span class="text-xs text-muted-foreground">单位：片</span>
            </div>
            ${renderPatternDetailPieceTable()}
          </div>
        </div>
        <footer class="flex items-center justify-end border-t px-6 py-4">
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-pattern-detail">关闭</button>
        </footer>
      </section>
    </div>
    ${renderPieceInstanceSpecialCraftDialog()}
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
  const colorOptions = getPatternColorQuantityOptions(state.newPattern.linkedBomItemId)
  if (colorOptions.length === 0) {
    return '<span class="text-muted-foreground">请先维护物料清单颜色</span>'
  }

  const selectedColorSet = new Set(
    row.colorPieceQuantities
      .filter((quantity) => quantity.enabled)
      .map((quantity) => quantity.colorName.trim().toLowerCase()),
  )

  return `<div class="flex flex-wrap gap-1.5">${colorOptions
    .map((option) => {
      const selected = selectedColorSet.has(option.colorName.trim().toLowerCase())
      return `<button
        type="button"
        class="inline-flex rounded-md border px-2 py-1 text-[11px] ${selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-muted'}"
        data-tech-action="toggle-pattern-piece-color"
        data-piece-id="${row.id}"
        data-color-id="${escapeHtml(option.colorCode || option.colorName)}"
        data-color-name="${escapeHtml(option.colorName)}"
      >${escapeHtml(option.colorName)}</button>`
    })
    .join('')}</div>`
}

function renderPatternPieceColorCountEditor(
  row: (typeof state.newPattern.pieceRows)[number],
): string {
  if (row.colorPieceQuantities.length === 0) {
    return '<span class="text-muted-foreground">请先维护物料清单颜色</span>'
  }
  return `<div class="space-y-2">${row.colorPieceQuantities
    .map(
      (quantity) => `
        <div class="flex items-center gap-2 rounded border px-2 py-1 text-xs" data-testid="pattern-color-piece-qty">
          <label class="inline-flex items-center gap-1">
            <input
              type="checkbox"
              data-tech-field="new-pattern-piece-color-enabled"
              data-piece-id="${row.id}"
              data-color-id="${escapeHtml(quantity.colorId)}"
              data-color-name="${escapeHtml(quantity.colorName)}"
              ${quantity.enabled ? 'checked' : ''}
            />
            <span class="min-w-0 truncate text-muted-foreground">${escapeHtml(quantity.colorName)}</span>
          </label>
          <div class="ml-auto flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="1"
              class="h-8 w-20 rounded border px-2 text-right text-xs"
              data-tech-field="new-pattern-piece-color-count"
              data-piece-id="${row.id}"
              data-color-id="${escapeHtml(quantity.colorId)}"
              data-color-name="${escapeHtml(quantity.colorName)}"
              value="${escapeHtml(String(quantity.pieceQty ?? 0))}"
            />
            <span class="text-muted-foreground">片</span>
          </div>
        </div>
      `,
    )
    .join('')}${renderPatternPieceQuantityWarnings(row)}</div>`
}

function renderPatternPieceSpecialCraftSelector(
  row: (typeof state.newPattern.pieceRows)[number],
): string {
  const specialCraftOptions = getPatternPieceSpecialCraftOptionsFromCurrentTechPack()
  if (specialCraftOptions.length === 0) {
    return '<span class="text-muted-foreground">无</span>'
  }
  const selectedCraftKeys = new Set(
    row.specialCrafts.map((item) => `${item.processCode}:${item.craftCode}:${item.selectedTargetObject}`),
  )
  return `<div class="flex flex-wrap gap-1.5">${specialCraftOptions
    .map((craft) => {
      const selected = selectedCraftKeys.has(`${craft.processCode}:${craft.craftCode}:${craft.selectedTargetObject}`)
      return `<button
        type="button"
        class="inline-flex rounded-md border px-2 py-1 text-[11px] ${selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-muted'}"
        data-tech-action="toggle-pattern-piece-special-craft"
        data-piece-id="${row.id}"
        data-process-code="${escapeHtml(craft.processCode)}"
        data-craft-code="${escapeHtml(craft.craftCode)}"
        data-target-object="${escapeHtml(craft.selectedTargetObject)}"
      >${escapeHtml(craft.displayName)}</button>`
    })
    .join('')}</div>`
}

function renderPatternPieceEditorTable(isWoven: boolean): string {
  if (state.newPattern.pieceRows.length === 0) {
    return '<div class="rounded border border-dashed px-3 py-3 text-xs text-muted-foreground">暂无数据</div>'
  }
  const patternTotalPieceQty = calculatePatternTotalPieceQty(state.newPattern.pieceRows)

  return `
    <div class="space-y-2" data-testid="pattern-piece-table">
      <div class="flex flex-wrap items-center justify-end gap-3 text-xs font-medium text-blue-700" data-testid="pattern-piece-total">
        <span>当前总片数：${escapeHtml(String(patternTotalPieceQty))} 片</span>
        <span data-testid="pattern-special-craft-configured-total">已配置特殊工艺裁片：${escapeHtml(String(state.newPattern.specialCraftConfiguredPieceTotal))} 片</span>
        <span data-testid="pattern-special-craft-unconfigured-total">未配置特殊工艺裁片：${escapeHtml(String(state.newPattern.specialCraftUnconfiguredPieceTotal))} 片</span>
      </div>
      <div class="text-xs text-muted-foreground">每种颜色片数必须填写为非负整数，未适用颜色不参与计算。</div>
      ${patternTotalPieceQty === 0 ? '<div class="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">当前总片数为 0，请维护颜色片数。</div>' : ''}
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b bg-muted/20">
            <th class="px-2 py-1 text-left">部位名称</th>
            ${isWoven ? '<th class="px-2 py-1 text-left">尺码</th><th class="px-2 py-1 text-left">解析参考片数</th>' : ''}
            <th class="px-2 py-1 text-left">适用颜色与颜色片数</th>
            <th class="px-2 py-1 text-right">当前部位总片数</th>
            <th class="px-2 py-1 text-left">备注</th>
            <th class="px-2 py-1 text-left">逐片特殊工艺</th>
            <th class="px-2 py-1 text-left">是否为模板</th>
            <th class="px-2 py-1 text-left">部位模板</th>
            <th class="px-2 py-1 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          ${state.newPattern.pieceRows
            .map(
              (row) => `
                <tr class="border-b align-top last:border-0" data-testid="pattern-piece-row">
                  <td class="px-2 py-1">
                    ${
                      isWoven
                        ? row.name.trim()
                          ? escapeHtml(row.name)
                          : '<span class="text-red-600">名称缺失</span>'
                        : `<input class="h-8 w-full rounded border px-2 text-xs" data-tech-field="new-pattern-piece-name" data-piece-id="${row.id}" value="${escapeHtml(row.name)}" placeholder="例如 前片" />`
                    }
                  </td>
                  ${
                    isWoven
                      ? `
                        <td class="px-2 py-1">${renderTextValue(row.sizeCode)}</td>
                        <td class="px-2 py-1">${renderTextValue(row.parsedQuantity)}</td>
                      `
                      : ''
                  }
                  <td class="px-2 py-1">${renderPatternPieceColorCountEditor(row)}</td>
                  <td class="px-2 py-1 text-right" data-testid="pattern-piece-total-qty">${escapeHtml(String(row.totalPieceQty || 0))} 片</td>
                  <td class="px-2 py-1">
                    <textarea class="min-h-16 w-32 rounded border px-2 py-1 text-xs" data-tech-field="new-pattern-piece-note" data-piece-id="${row.id}" placeholder="备注">${escapeHtml(row.note || row.annotation || '')}</textarea>
                  </td>
                  <td class="px-2 py-1">${renderPieceInstanceCraftSummary(row.id)}</td>
                  <td class="px-2 py-1">
                  <select
                    class="h-8 w-24 rounded border px-2 text-xs"
                    data-tech-field="new-pattern-piece-is-template"
                    data-piece-id="${row.id}"
                  >
                    <option value="false" ${row.isTemplate ? '' : 'selected'}>否</option>
                    <option value="true" ${row.isTemplate ? 'selected' : ''}>是</option>
                  </select>
                </td>
                  <td class="px-2 py-1">
                  ${
                    row.isTemplate
                      ? `
                        <div class="space-y-2">
                          <div class="text-xs">${row.partTemplateId ? escapeHtml(`${row.partTemplateId}${row.partTemplateName ? ` · ${row.partTemplateName}` : ''}`) : '<span class="text-red-600">待选择模板</span>'}</div>
                          ${renderTemplatePreview(row.partTemplatePreviewSvg, '暂无模板缩略图')}
                          <button
                            type="button"
                            class="inline-flex items-center rounded border px-2 py-1 text-[11px] hover:bg-muted"
                            data-tech-action="open-pattern-piece-template-dialog"
                            data-piece-id="${row.id}"
                          >
                            ${row.partTemplateId ? '更换模板' : '选择模板'}
                          </button>
                        </div>
                      `
                      : '<span class="text-muted-foreground">-</span>'
                  }
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
    </div>
  `
}

function renderPatternFormDialogLegacy(): string {
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
      <section class="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">${state.editPatternItemId ? '编辑纸样' : '新增纸样'}</h3>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div class="space-y-4">
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
                      <span class="text-xs text-muted-foreground">解析结果只读部位名称、尺码和解析参考片数</span>
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
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-pattern">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${canSavePatternForm() ? '' : 'pointer-events-none opacity-50'}" data-tech-action="save-pattern">确认</button>
        </footer>
      </section>
    </div>
  `
}

void renderPatternFormDialogLegacy

export function renderPatternFormDialog(): string {
  if (!state.addPatternDialogOpen) return ''

  const bomOptions = state.bomItems
  const isWoven = state.newPattern.patternMaterialType !== 'KNIT'
  const activeStep = state.patternMaintenanceStep
  const selectedBom = state.newPattern.linkedBomItemId
    ? state.bomItems.find((item) => item.id === state.newPattern.linkedBomItemId)
    : null
  const parseButtonLabel =
    state.newPattern.patternParsing
      ? '解析中'
      : state.newPattern.parseStatus === 'PARSED'
        ? '重新解析'
        : '解析纸样'
  const stepButtonClass = (step: 'MERCHANDISER' | 'PATTERN_MAKER') =>
    activeStep === step
      ? 'border-blue-500 bg-blue-50 text-blue-700'
      : 'border-border bg-background text-muted-foreground hover:bg-muted'

  const merchandiserPanel = `
    <section class="space-y-4" data-testid="pattern-step-merchandiser-panel">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label class="space-y-1">
          <span class="text-sm">纸样名称 <span class="text-red-500">*</span></span>
          <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-name" value="${escapeHtml(state.newPattern.name)}" placeholder="例如 前片纸样" />
        </label>
        <label class="space-y-1">
          <span class="text-sm">纸样类型 <span class="text-red-500">*</span></span>
          <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-material-type">
            <option value="WOVEN" ${state.newPattern.patternMaterialType === 'WOVEN' || state.newPattern.patternMaterialType === 'UNKNOWN' ? 'selected' : ''}>布料纸样</option>
            <option value="KNIT" ${state.newPattern.patternMaterialType === 'KNIT' ? 'selected' : ''}>针织纸样</option>
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-sm">是否针织 <span class="text-red-500">*</span></span>
          <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-is-knitted">
            <option value="否" ${state.newPattern.isKnitted === '否' ? 'selected' : ''}>否</option>
            <option value="是" ${state.newPattern.isKnitted === '是' ? 'selected' : ''}>是</option>
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-sm">纸样分类</span>
          <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-type">
            ${TECH_PACK_PATTERN_CATEGORY_OPTIONS.map((option) => `<option value="${option}" ${state.newPattern.type === option ? 'selected' : ''}>${option}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-sm">门幅（cm） <span class="text-red-500">*</span></span>
          <input type="number" min="0.01" step="0.01" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-width-cm" value="${escapeHtml(String(state.newPattern.widthCm || ''))}" placeholder="例如 142" />
        </label>
        <label class="space-y-1">
          <span class="text-sm">关联物料 <span class="text-red-500">*</span></span>
          ${
            bomOptions.length === 0
              ? '<div class="rounded-md border border-dashed px-3 py-2 text-sm text-amber-700">请先维护物料清单</div>'
              : `
                <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-linked-bom-item">
                  <option value="">请选择关联物料</option>
                  ${bomOptions
                    .map(
                      (item) =>
                        `<option value="${item.id}" ${state.newPattern.linkedBomItemId === item.id ? 'selected' : ''}>${escapeHtml(`${item.materialName} · ${item.materialCode}`)}</option>`,
                    )
                    .join('')}
                </select>
              `
          }
        </label>
      </div>
    </section>
  `

  const makerPanel = `
    <section class="space-y-4" data-testid="pattern-step-maker-panel">
      <div class="rounded-lg border bg-muted/20 p-3 text-sm">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <div class="text-xs text-muted-foreground">纸样名称</div>
            <div class="mt-1">${renderTextValue(state.newPattern.name)}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">纸样类型</div>
            <div class="mt-1">${escapeHtml(state.newPattern.patternMaterialTypeLabel)}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">门幅（cm）</div>
            <div class="mt-1">${renderTextValue(state.newPattern.widthCm)}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">关联物料</div>
            <div class="mt-1">${escapeHtml(selectedBom ? `${selectedBom.materialName} · ${selectedBom.materialCode}` : '未关联')}</div>
          </div>
        </div>
      </div>
      <label class="block space-y-1">
        <span class="text-sm">排料长度（m） <span class="text-red-500">*</span></span>
        <input type="number" min="0.01" step="0.01" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-marker-length-m" value="${escapeHtml(String(state.newPattern.markerLengthM || ''))}" placeholder="例如 2.62" />
      </label>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        ${renderPatternFileInfo({
          title: '纸样 PRJ 文件',
          fileName: state.newPattern.prjFile?.fileName,
          fileSize: state.newPattern.prjFile?.fileSize,
          lastModified: state.newPattern.prjFile?.uploadedAt,
          action: 'open-pattern-prj-picker',
          actionLabel: '选择 PRJ 文件',
          testId: 'pattern-prj-upload',
        })}
        ${renderPatternFileInfo({
          title: '唛架图片',
          fileName: state.newPattern.markerImage?.fileName,
          fileSize: state.newPattern.markerImage?.fileSize,
          lastModified: state.newPattern.markerImage?.uploadedAt,
          action: 'open-pattern-marker-image-picker',
          actionLabel: '选择唛架图片',
          testId: 'pattern-marker-image-upload',
        })}
      </div>
      ${renderPatternBindingStripEditor()}
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
        ${escapeHtml(isWoven ? getWovenStatusMessage() : '纸样技术文件已维护后可保存')}
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
          清空 DXF/RUL 文件
        </button>
      </div>
      <section class="space-y-2 rounded-md border p-3">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-medium">裁片明细</h4>
          ${
            isWoven
              ? '<span class="text-xs text-muted-foreground">解析结果只读部位名称、尺码和解析参考片数</span>'
              : `<button type="button" class="inline-flex items-center rounded border px-2 py-1 text-xs hover:bg-muted" data-tech-action="add-new-pattern-piece-row">
                  <i data-lucide="plus" class="mr-1 h-3 w-3"></i>
                  新增裁片
                </button>`
          }
        </div>
        ${renderPatternPieceEditorTable(isWoven)}
      </section>
    </section>
  `

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl" data-dialog-panel="true" data-testid="pattern-two-step-dialog">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">${state.editPatternItemId ? '编辑纸样' : '新增纸样'}</h3>
          <div class="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-1">
            <button type="button" class="rounded-md border px-3 py-2 text-sm ${stepButtonClass('MERCHANDISER')}" data-tech-action="switch-pattern-maintenance-step" data-pattern-step="MERCHANDISER" data-testid="pattern-step-merchandiser">跟单基础信息</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm ${stepButtonClass('PATTERN_MAKER')}" data-tech-action="switch-pattern-maintenance-step" data-pattern-step="PATTERN_MAKER" data-testid="pattern-step-maker">版师技术信息</button>
          </div>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div class="space-y-4">
            <input id="tech-pack-pattern-prj-input" type="file" accept=".prj,.PRJ" data-tech-field="new-pattern-prj-file" class="hidden" />
            <input id="tech-pack-marker-image-input" type="file" accept=".png,.jpg,.jpeg,.webp" data-tech-field="new-pattern-marker-image-file" class="hidden" />
            <input id="tech-pack-pattern-dxf-input" type="file" accept=".dxf,.DXF" data-tech-field="new-pattern-dxf-file" class="hidden" />
            <input id="tech-pack-pattern-rul-input" type="file" accept=".rul,.RUL" data-tech-field="new-pattern-rul-file" class="hidden" />
            ${activeStep === 'MERCHANDISER' ? merchandiserPanel : makerPanel}
            ${
              state.newPattern.parseError
                ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">${escapeHtml(state.newPattern.parseError)}</div>`
                : ''
            }
            ${renderPatternDuplicateWarning()}
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-pattern">取消</button>
          ${
            activeStep === 'MERCHANDISER'
              ? `
                <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="save-pattern-merchandiser-step">保存</button>
                <button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-tech-action="save-pattern-and-go-maker">保存并进入版师技术信息</button>
              `
              : `
                <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="switch-pattern-maintenance-step" data-pattern-step="MERCHANDISER">返回跟单基础信息</button>
                <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="save-pattern-maker-step">保存</button>
                <button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-tech-action="save-pattern-and-parse">保存并解析</button>
              `
          }
        </footer>
      </section>
    </div>
  `
}

function renderPieceInstanceAssignmentList(instance: (typeof state.newPattern.pieceInstances)[number]): string {
  if (instance.specialCraftAssignments.length === 0) {
    return '<div class="text-xs text-muted-foreground">暂未配置特殊工艺</div>'
  }
  return `
    <div class="flex flex-wrap gap-1">
      ${instance.specialCraftAssignments
        .map((assignment) => `
          <span class="inline-flex items-center gap-1 rounded border bg-white px-2 py-1 text-[11px]" data-testid="piece-instance-assignment">
            ${escapeHtml(`${assignment.craftName}（${assignment.craftPositionName}）`)}
            <button
              type="button"
              class="text-red-600"
              data-tech-action="delete-piece-instance-special-craft"
              data-piece-instance-id="${escapeHtml(instance.pieceInstanceId)}"
              data-assignment-id="${escapeHtml(assignment.assignmentId)}"
            >删除</button>
          </span>
        `)
        .join('')}
    </div>
  `
}

export function renderPieceInstanceSpecialCraftDialog(): string {
  if (!state.pieceInstanceCraftDialogOpen || !state.activePieceInstanceSourcePieceId) return ''
  const instances = getPieceInstancesBySourcePieceId(state.activePieceInstanceSourcePieceId)
  const activeInstance =
    instances.find((instance) => instance.pieceInstanceId === state.activePieceInstanceId)
    || instances[0]
  const craftOptions = getPatternPieceInstanceSpecialCraftOptions()

  return `
    <div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" data-testid="piece-instance-special-craft-dialog" data-dialog-backdrop="true">
      <section class="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 class="text-lg font-semibold">维护逐片特殊工艺</h3>
            <p class="mt-1 text-sm text-muted-foreground">特殊工艺按裁片实例维护，每种工艺必须选择左、右、底、面中的一个位置。</p>
          </div>
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-piece-instance-special-craft-dialog">关闭</button>
        </header>
        <div class="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden px-6 py-4 md:grid-cols-[320px_minmax(0,1fr)]">
          <aside class="min-h-0 overflow-y-auto rounded-md border">
            ${
              instances.length === 0
                ? '<div class="px-4 py-8 text-center text-sm text-muted-foreground">暂无裁片实例，请先维护颜色片数。</div>'
                : instances
                    .map((instance) => {
                      const active = instance.pieceInstanceId === activeInstance?.pieceInstanceId
                      return `
                        <button
                          type="button"
                          class="block w-full border-b px-3 py-3 text-left text-sm last:border-b-0 ${active ? 'bg-blue-50 text-blue-700' : 'hover:bg-muted'}"
                          data-tech-action="select-piece-instance"
                          data-piece-instance-id="${escapeHtml(instance.pieceInstanceId)}"
                          data-testid="piece-instance-row"
                        >
                          <div class="font-medium">${escapeHtml(instance.displayName)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(instance.status)} · 已配置 ${escapeHtml(String(instance.specialCraftAssignments.length))} 项</div>
                        </button>
                      `
                    })
                    .join('')
            }
          </aside>
          <section class="min-h-0 overflow-y-auto rounded-md border p-4">
            ${
              activeInstance
                ? `
                  <div class="space-y-4">
                    <div>
                      <h4 class="text-base font-semibold">${escapeHtml(activeInstance.displayName)}</h4>
                      <div class="mt-2">${renderPieceInstanceAssignmentList(activeInstance)}</div>
                    </div>
                    <div class="grid grid-cols-1 gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-3">
                      <label class="space-y-1">
                        <span class="text-sm">特殊工艺 <span class="text-red-500">*</span></span>
                        <select class="w-full rounded-md border bg-background px-3 py-2 text-sm" data-tech-field="piece-instance-craft-code" data-testid="piece-instance-special-craft-select">
                          <option value="">请选择特殊工艺</option>
                          ${craftOptions
                            .map((craft) => `<option value="${escapeHtml(craft.craftCode)}" ${state.pieceInstanceCraftDraft.craftCode === craft.craftCode ? 'selected' : ''}>${escapeHtml(craft.craftName)}</option>`)
                            .join('')}
                        </select>
                      </label>
                      <label class="space-y-1">
                        <span class="text-sm">工艺位置 <span class="text-red-500">*</span></span>
                        <select class="w-full rounded-md border bg-background px-3 py-2 text-sm" data-tech-field="piece-instance-craft-position" data-testid="piece-instance-position-select">
                          <option value="">请选择工艺位置</option>
                          ${PATTERN_CRAFT_POSITION_OPTIONS
                            .map((position) => `<option value="${escapeHtml(position.code)}" ${state.pieceInstanceCraftDraft.craftPosition === position.code ? 'selected' : ''}>${escapeHtml(position.name)}</option>`)
                            .join('')}
                        </select>
                      </label>
                      <label class="space-y-1">
                        <span class="text-sm">备注</span>
                        <input class="w-full rounded-md border bg-background px-3 py-2 text-sm" data-tech-field="piece-instance-craft-remark" value="${escapeHtml(state.pieceInstanceCraftDraft.remark)}" placeholder="可选" />
                      </label>
                    </div>
                    ${
                      state.pieceInstanceCraftError
                        ? `<div class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">${escapeHtml(state.pieceInstanceCraftError)}</div>`
                        : ''
                    }
                    <div class="flex flex-wrap justify-end gap-2">
                      <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="apply-piece-instance-craft-to-same-color">应用到同颜色全部片</button>
                      <button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-tech-action="add-piece-instance-special-craft">添加特殊工艺</button>
                    </div>
                  </div>
                `
                : '<div class="px-4 py-8 text-center text-sm text-muted-foreground">请选择裁片实例。</div>'
            }
          </section>
        </div>
      </section>
    </div>
  `
}

export function renderPatternTemplateDialog(): string {
  if (!state.patternTemplateDialogOpen || !state.activePatternTemplatePieceId) return ''

  const keyword = state.patternTemplateSearchKeyword.trim().toLowerCase()
  const templateOptions = getPartTemplateOptions().filter((record) => {
    if (!keyword) return true
    return [
      record.id,
      record.templateName,
      record.standardPartName,
      record.sourcePartName,
    ].some((item) => String(item || '').toLowerCase().includes(keyword))
  })

  return `
    <div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-5xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h3 class="text-lg font-semibold">选择部位模板</h3>
              <p class="mt-1 text-sm text-muted-foreground">支持按模板 ID、模板名称、标准部位名称、原始部位名称搜索。</p>
            </div>
            <button
              type="button"
              class="rounded-md border px-4 py-2 text-sm hover:bg-muted"
              data-tech-action="close-pattern-template-dialog"
            >
              关闭
            </button>
          </div>
        </header>
        <div class="space-y-4 px-6 py-4">
          <label class="block space-y-1">
            <span class="text-sm">搜索</span>
            <input
              class="w-full rounded-md border px-3 py-2 text-sm"
              data-tech-field="pattern-template-search-keyword"
              value="${escapeHtml(state.patternTemplateSearchKeyword)}"
              placeholder="输入模板 ID、模板名称、标准部位名称或原始部位名称"
            />
          </label>
          <div class="max-h-[60vh] overflow-y-auto rounded-lg border">
            ${
              templateOptions.length === 0
                ? '<div class="px-4 py-10 text-center text-sm text-muted-foreground">暂无可选部位模板</div>'
                : `
                  <table class="w-full min-w-[980px] text-sm">
                    <thead class="border-b bg-muted/20 text-xs text-muted-foreground">
                      <tr>
                        <th class="px-3 py-2 text-left font-medium">部位模板ID</th>
                        <th class="px-3 py-2 text-left font-medium">部位模板名称</th>
                        <th class="px-3 py-2 text-left font-medium">模板形状说明</th>
                        <th class="px-3 py-2 text-left font-medium">部位模板缩略图</th>
                        <th class="px-3 py-2 text-right font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${templateOptions
                        .map(
                          (record) => `
                            <tr class="border-b align-top last:border-0">
                              <td class="px-3 py-2 font-mono text-xs">${escapeHtml(record.id)}</td>
                              <td class="px-3 py-2">
                                <div class="font-medium">${escapeHtml(record.templateName)}</div>
                                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(
                                  [record.standardPartName, record.sourcePartName].filter(Boolean).join(' · ') || '暂无数据',
                                )}</div>
                              </td>
                              <td class="px-3 py-2">${renderTextValue(record.shapeDescription?.autoDescription)}</td>
                              <td class="px-3 py-2">${renderTemplatePreview(record.previewSvg, '暂无模板缩略图')}</td>
                              <td class="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                                  data-tech-action="select-pattern-template"
                                  data-template-id="${escapeHtml(record.id)}"
                                >
                                  选择
                                </button>
                              </td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                `
            }
          </div>
        </div>
      </section>
    </div>
  `
}
