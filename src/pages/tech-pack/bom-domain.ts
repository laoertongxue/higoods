import {
  dedupeStrings,
  bomUsageProcessOptions,
  dyeOptions,
  escapeHtml,
  getSkuOptionsForCurrentSpu,
  printOptions,
  state,
} from './context'
import type { BomItemRow } from './context'

export function renderBomTab(): string {
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
          <h3 class="text-base font-semibold">BOM</h3>
          <p class="mt-1 text-sm text-muted-foreground">按 SKU 分组展示物料清单，便于按颜色/规格查看对应物料</p>
        </div>
        <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-add-bom">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
          添加物料
        </button>
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
                    <th class="px-3 py-2 text-left">染色需求</th>
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
                              <td colspan="9" class="px-3 py-2 text-sm text-muted-foreground">当前 SKU 暂无适用物料</td>
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
                                  <select class="h-8 w-24 rounded-md border px-2 text-sm" data-tech-field="bom-print" data-bom-id="${item.id}">
                                    ${printOptions
                                      .map((option) => `<option value="${option}" ${item.printRequirement === option ? 'selected' : ''}>${option}</option>`)
                                      .join('')}
                                  </select>
                                </td>
                                <td class="px-3 py-2">
                                  <select class="h-8 w-24 rounded-md border px-2 text-sm" data-tech-field="bom-dye" data-bom-id="${item.id}">
                                    ${dyeOptions
                                      .map((option) => `<option value="${option}" ${item.dyeRequirement === option ? 'selected' : ''}>${option}</option>`)
                                      .join('')}
                                  </select>
                                </td>
                                <td class="px-3 py-2">
                                  <div class="flex items-center gap-1">
                                    <button class="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted" data-tech-action="edit-bom" data-bom-id="${item.id}">
                                      <i data-lucide="edit-2" class="h-4 w-4"></i>
                                    </button>
                                    <button class="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-bom" data-bom-id="${item.id}">
                                      <i data-lucide="trash-2" class="h-4 w-4"></i>
                                    </button>
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


export function renderBomFormDialog(): string {
  if (!state.addBomDialogOpen) return ''
  const skuOptions = getSkuOptionsForCurrentSpu()
  const colorOptions = dedupeStrings(skuOptions.map((item) => item.color))
  const applyAllSku = state.newBomItem.applicableSkuCodes.length === 0

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-2xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">${state.editBomItemId ? '编辑物料' : '添加物料'}</h3>
        </header>
        <div class="grid grid-cols-1 gap-6 px-6 py-4 md:grid-cols-2">
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
              <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-material-code" value="${escapeHtml(state.newBomItem.materialCode)}" placeholder="例如 FAB-001" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">规格</span>
              <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-spec" value="${escapeHtml(state.newBomItem.spec)}" placeholder="例如 180g/m²" />
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
                    ? '<p class="text-muted-foreground">当前 SPU 暂无 SKU 数据，默认按全部 SKU 处理</p>'
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
              <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-material-name" value="${escapeHtml(state.newBomItem.materialName)}" placeholder="例如 纯棉针织布" />
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
            <label class="space-y-1">
              <span class="text-sm">染色需求</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-dye-requirement">
                ${dyeOptions
                  .map((option) => `<option value="${option}" ${state.newBomItem.dyeRequirement === option ? 'selected' : ''}>${option}</option>`)
                  .join('')}
              </select>
            </label>
          </div>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-bom">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.newBomItem.materialName.trim() ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="save-bom">确认</button>
        </footer>
      </section>
    </div>
  `
}
