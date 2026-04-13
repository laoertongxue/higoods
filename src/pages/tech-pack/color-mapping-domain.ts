import {
  colorMappingStatusClass,
  colorMappingStatusLabel,
  escapeHtml,
  generatedModeLabel,
  getPatternById,
  getPatternPieceById,
  getSkuOptionsForCurrentSpu,
  state,
} from './context.ts'

export function renderColorMappingTab(): string {
  if (!state.techPack) return ''
  const readonly = false

  const mappings = state.colorMaterialMappings
  const bomOptions = state.bomItems
  const patternOptions = state.patternItems
  const skuOptions = getSkuOptionsForCurrentSpu()
  const skuLabelByCode = new Map(
    skuOptions.map((item) => [item.skuCode, `${item.color}/${item.size}（${item.skuCode}）`]),
  )
  const totalLineCount = mappings.reduce((sum, item) => sum + item.lines.length, 0)
  const autoDraftCount = mappings.filter((item) => item.status === 'AUTO_DRAFT').length
  const confirmedCount = mappings.filter(
    (item) => item.status === 'CONFIRMED' || item.status === 'AUTO_CONFIRMED',
  ).length
  const manualAdjustedCount = mappings.filter((item) => item.status === 'MANUAL_ADJUSTED').length

  return `
    <div class="space-y-4">
      <section class="grid grid-cols-1 gap-3 md:grid-cols-4">
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">映射颜色数</p>
          <p class="mt-1 text-2xl font-semibold">${mappings.length}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">映射明细行</p>
          <p class="mt-1 text-2xl font-semibold">${totalLineCount}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">待人工确认</p>
          <p class="mt-1 text-2xl font-semibold text-amber-700">${autoDraftCount}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">已确认 / 人工调整</p>
          <p class="mt-1 text-2xl font-semibold text-green-700">${confirmedCount + manualAdjustedCount}</p>
        </article>
      </section>

      <section class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">款色用料对应</h3>
          <p class="mt-1 text-sm text-muted-foreground">用于明确 SPU + 颜色下，单件成衣所需物料、纸样与裁片明细。复杂款自动生成后需人工确认。</p>
        </header>
        <div class="space-y-4 p-4">
          ${
            mappings.length === 0
              ? '<div class="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">当前技术包版本暂无款色用料对应，可先完善物料清单和纸样管理后由系统生成草稿</div>'
              : mappings
                  .map((mapping) => {
                    const statusLabel = colorMappingStatusLabel[mapping.status]
                    const statusClass = colorMappingStatusClass[mapping.status]

                    return `
                      <article class="rounded-lg border">
                        <header class="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="text-sm font-semibold">${escapeHtml(`${mapping.colorName}（${mapping.colorCode}）`)}</span>
                            <span class="inline-flex rounded border px-2 py-0.5 text-xs ${statusClass}">${escapeHtml(statusLabel)}</span>
                            <span class="inline-flex rounded border px-2 py-0.5 text-xs text-muted-foreground">${escapeHtml(generatedModeLabel[mapping.generatedMode])}</span>
                          </div>
                          <div class="flex flex-wrap items-center gap-2">
                            ${readonly ? '' : `<button
                              class="inline-flex h-7 items-center rounded border px-2 text-xs hover:bg-muted ${
                                mapping.status === 'AUTO_DRAFT' || mapping.status === 'MANUAL_ADJUSTED'
                                  ? ''
                                  : 'pointer-events-none opacity-50'
                              }"
                              data-tech-action="confirm-color-mapping"
                              data-mapping-id="${mapping.id}"
                            >
                              确认映射
                            </button>`}
                            ${readonly ? '' : `<button
                              class="inline-flex h-7 items-center rounded border px-2 text-xs hover:bg-muted"
                              data-tech-action="copy-system-draft-manual"
                              data-mapping-id="${mapping.id}"
                            >
                              复制系统稿为人工版
                            </button>`}
                            ${readonly ? '' : `<button
                              class="inline-flex h-7 items-center rounded border px-2 text-xs hover:bg-muted"
                              data-tech-action="add-mapping-line"
                              data-mapping-id="${mapping.id}"
                            >
                              新增映射行
                            </button>`}
                            ${readonly ? '' : `<button
                              class="inline-flex h-7 items-center rounded border px-2 text-xs hover:bg-muted"
                              data-tech-action="reset-color-mapping-suggestion"
                              data-mapping-id="${mapping.id}"
                            >
                              重置为系统建议
                            </button>`}
                          </div>
                        </header>
                        <div class="space-y-2 p-3">
                          <div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>SPU：${escapeHtml(mapping.spuCode)}</span>
                            <span>确认人：${escapeHtml(mapping.confirmedBy || '-')}</span>
                            <span>确认时间：${escapeHtml(mapping.confirmedAt || '-')}</span>
                          </div>
                          <div class="rounded border bg-muted/20 px-2 py-1.5">
                            <label class="block text-[11px] text-muted-foreground">映射备注</label>
                            <input
                              class="mt-1 h-7 w-full rounded border bg-background px-2 text-xs"
                              value="${escapeHtml(mapping.remark || '')}"
                              placeholder="可记录系统草稿说明、人工修订原因"
                              data-tech-field="mapping-remark"
                              data-mapping-id="${mapping.id}"
                              ${readonly ? 'disabled' : ''}
                            />
                          </div>
                          <div class="overflow-x-auto rounded border">
                            <table class="w-full text-xs">
                              <thead>
                                <tr class="border-b bg-muted/20">
                                  <th class="px-2 py-1 text-left">物料（BOM）</th>
                                  <th class="px-2 py-1 text-left">纸样</th>
                                  <th class="px-2 py-1 text-left">裁片</th>
                                  <th class="px-2 py-1 text-right">单件片数</th>
                                  <th class="px-2 py-1 text-left">适用 SKU</th>
                                  <th class="px-2 py-1 text-left">来源</th>
                                  <th class="px-2 py-1 text-left">备注</th>
                                  <th class="px-2 py-1 text-left">操作</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${
                                  mapping.lines.length === 0
                                    ? '<tr><td colspan="8" class="px-2 py-4 text-center text-muted-foreground">暂无映射明细</td></tr>'
                                    : mapping.lines
                                        .map(
                                          (line) => {
                                            const pieceOptions = line.patternId
                                              ? getPatternById(line.patternId)?.pieceRows ?? []
                                              : []
                                            return `
                                            <tr class="border-b last:border-0">
                                              <td class="px-2 py-1.5">
                                                <div class="grid gap-1">
                                                  <select
                                                    class="h-7 rounded border px-2 text-xs"
                                                    data-tech-field="mapping-line-bom-item"
                                                    data-mapping-id="${mapping.id}"
                                                    data-line-id="${line.id}"
                                                  >
                                                    <option value="">未绑定BOM</option>
                                                    ${bomOptions
                                                      .map(
                                                        (bom) => `<option value="${bom.id}" ${line.bomItemId === bom.id ? 'selected' : ''}>${escapeHtml(`${bom.materialCode || bom.id} · ${bom.materialName}`)}</option>`,
                                                      )
                                                      .join('')}
                                                  </select>
                                                  <input
                                                    class="h-7 rounded border px-2 text-xs"
                                                    value="${escapeHtml(line.materialName)}"
                                                    placeholder="物料名称"
                                                    data-tech-field="mapping-line-material-name"
                                                    data-mapping-id="${mapping.id}"
                                                    data-line-id="${line.id}"
                                                  />
                                                  <input
                                                    class="h-7 rounded border px-2 text-[11px] text-muted-foreground"
                                                    value="${escapeHtml(line.materialCode || '')}"
                                                    placeholder="物料编码"
                                                    data-tech-field="mapping-line-material-code"
                                                    data-mapping-id="${mapping.id}"
                                                    data-line-id="${line.id}"
                                                  />
                                                </div>
                                              </td>
                                              <td class="px-2 py-1.5">
                                                <select
                                                  class="h-7 min-w-[150px] rounded border px-2 text-xs"
                                                  data-tech-field="mapping-line-pattern-id"
                                                  data-mapping-id="${mapping.id}"
                                                  data-line-id="${line.id}"
                                                >
                                                  <option value="">未绑定纸样</option>
                                                  ${patternOptions
                                                    .map(
                                                      (pattern) => `<option value="${pattern.id}" ${line.patternId === pattern.id ? 'selected' : ''}>${escapeHtml(pattern.name)}</option>`,
                                                    )
                                                    .join('')}
                                                </select>
                                              </td>
                                              <td class="px-2 py-1.5">
                                                <select
                                                  class="h-7 min-w-[140px] rounded border px-2 text-xs"
                                                  data-tech-field="mapping-line-piece-id"
                                                  data-mapping-id="${mapping.id}"
                                                  data-line-id="${line.id}"
                                                >
                                                  <option value="">未绑定裁片</option>
                                                  ${pieceOptions
                                                    .map(
                                                      (piece) => `<option value="${piece.id}" ${line.pieceId === piece.id ? 'selected' : ''}>${escapeHtml(piece.name)}</option>`,
                                                    )
                                                    .join('')}
                                                </select>
                                              </td>
                                              <td class="px-2 py-1.5 text-right">
                                                <div class="flex items-center justify-end gap-1">
                                                  <input
                                                    class="h-7 w-20 rounded border px-2 text-right text-xs"
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value="${escapeHtml(String(line.pieceCountPerUnit || 0))}"
                                                    data-tech-field="mapping-line-piece-count"
                                                    data-mapping-id="${mapping.id}"
                                                    data-line-id="${line.id}"
                                                    ${readonly ? 'disabled' : ''}
                                                  />
                                                  <input
                                                    class="h-7 w-12 rounded border px-1 text-center text-[11px]"
                                                    value="${escapeHtml(line.unit)}"
                                                    data-tech-field="mapping-line-unit"
                                                    data-mapping-id="${mapping.id}"
                                                    data-line-id="${line.id}"
                                                    ${readonly ? 'disabled' : ''}
                                                  />
                                                </div>
                                              </td>
                                              <td class="px-2 py-1.5">
                                                <input
                                                  class="h-7 min-w-[220px] rounded border px-2 text-xs"
                                                  value="${escapeHtml(line.applicableSkuCodes.join(','))}"
                                                  placeholder="留空=全部SKU，或输入 SKU-001-A,SKU-001-B"
                                                  data-tech-field="mapping-line-skus"
                                                  data-mapping-id="${mapping.id}"
                                                  data-line-id="${line.id}"
                                                  ${readonly ? 'disabled' : ''}
                                                />
                                                ${
                                                  line.applicableSkuCodes.length > 0
                                                    ? `<div class="mt-1 flex flex-wrap gap-1">${line.applicableSkuCodes
                                                        .map((skuCode) => {
                                                          const label = skuLabelByCode.get(skuCode) || skuCode
                                                          return `<span class="inline-flex rounded border px-1.5 py-0.5 text-[10px]">${escapeHtml(label)}</span>`
                                                        })
                                                        .join('')}</div>`
                                                    : '<div class="mt-1 text-[10px] text-muted-foreground">全部 SKU</div>'
                                                }
                                              </td>
                                              <td class="px-2 py-1.5">
                                                <select
                                                  class="h-7 rounded border px-2 text-xs"
                                                  data-tech-field="mapping-line-source-mode"
                                                  data-mapping-id="${mapping.id}"
                                                  data-line-id="${line.id}"
                                                  ${readonly ? 'disabled' : ''}
                                                >
                                                  <option value="AUTO" ${line.sourceMode === 'AUTO' ? 'selected' : ''}>系统生成</option>
                                                  <option value="MANUAL" ${line.sourceMode === 'MANUAL' ? 'selected' : ''}>人工维护</option>
                                                </select>
                                              </td>
                                              <td class="px-2 py-1.5">
                                                <input
                                                  class="h-7 min-w-[160px] rounded border px-2 text-xs"
                                                  value="${escapeHtml(line.note || '')}"
                                                  placeholder="备注"
                                                  data-tech-field="mapping-line-note"
                                                  data-mapping-id="${mapping.id}"
                                                  data-line-id="${line.id}"
                                                  ${readonly ? 'disabled' : ''}
                                                />
                                              </td>
                                              <td class="px-2 py-1.5">
                                                ${readonly ? '' : `<button
                                                  class="inline-flex h-7 items-center rounded border px-2 text-xs text-red-600 hover:bg-red-50"
                                                  data-tech-action="delete-mapping-line"
                                                  data-mapping-id="${mapping.id}"
                                                  data-line-id="${line.id}"
                                                >
                                                  删除
                                                </button>`}
                                              </td>
                                            </tr>
                                          `
                                          },
                                        )
                                        .join('')
                                }
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </article>
                    `
                  })
                  .join('')
          }
        </div>
      </section>
    </div>
  `
}
