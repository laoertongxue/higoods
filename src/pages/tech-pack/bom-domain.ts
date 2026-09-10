import {
  dedupeStrings,
  bomRequirementOptions,
  bomBoundCraftOptions,
  bomUsageProcessOptions,
  dyeOptions,
  escapeHtml,
  getBomPatternDesignIds,
  getBomBoundCraftCode,
  getPatternDesignPreviewAssetById,
  getPatternDesignOptionsBySide,
  getSkuOptionsForCurrentSpu,
  isTechPackModuleReadOnly,
  printOptions,
  state,
} from './context.ts'
import type { BomItemRow } from './context.ts'
import {
  getMaterialArchiveById,
  getMaterialSkuRecordById,
  listMaterialArchives,
  listMaterialSkuRecordsByMaterialId,
} from '../../data/pcs-material-archive-repository.ts'
import { listStyleArchives } from '../../data/pcs-style-archive-repository.ts'

function renderTextValue(value: string): string {
  return value.trim().length > 0 ? escapeHtml(value) : '<span class="text-muted-foreground">-</span>'
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
  const materialArchives = listMaterialArchives()
  const styleImageUrl = listStyleArchives().find((record) => record.styleCode === spuLabel)?.mainImageUrl || ''
  const legacyDemoMaterialImageByCode: Record<string, string> = {
    tdv_seed_project_018_base_bom_main: '/materials/fabric-main.jpg',
  }
  const resolveMaterialSnapshot = (item: BomItemRow) => {
    const sku = item.materialSkuId ? getMaterialSkuRecordById(item.materialSkuId) : null
    const archive = sku
      ? getMaterialArchiveById(sku.materialId)
      : materialArchives.find((record) => record.materialCode === item.materialCode) ?? null
    return {
      imageUrl:
        sku?.skuImageUrl
        || archive?.mainImageUrl
        || legacyDemoMaterialImageByCode[item.materialCode.replace(/-/g, '_')]
        || (item.type === '成衣' ? styleImageUrl : ''),
      unitPrice: sku?.costPrice || 0,
      pricingUnit: sku?.pricingUnit || archive?.pricingUnit || '',
    }
  }
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
  const nonSpecificColorLabels = new Set(['全部SKU（当前未区分颜色）', '未识别颜色', '多颜色'])
  skuOptions.forEach((sku) => {
    const colorLabel = sku.color.trim()
    if (!colorLabel || nonSpecificColorLabels.has(colorLabel)) return
    const current = groupsByColor.get(colorLabel)
    if (current) {
      current.skuCodes = dedupeStrings([...current.skuCodes, sku.skuCode])
      return
    }
    groupsByColor.set(colorLabel, {
      groupKey: colorLabel,
      colorLabel,
      skuCodes: [sku.skuCode],
      rows: [],
    })
  })
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
  const groups = Array.from(groupsByColor.values())
  const unitOptions = ['PCS', '件', '米', 'Yard', '公斤', '卷', 'DZ', 'CNS', 'Pair']
  const cellClass = 'border-b border-r px-2 py-2 align-middle leading-5 last:border-r-0'
  const headerClass = 'h-10 whitespace-nowrap border-b border-r bg-muted/30 px-2 py-2 text-center text-xs font-medium last:border-r-0'

  const renderGroupControls = (group: BomColorGroup): string => readonly
    ? ''
    : `<div class="mt-1.5 flex items-center gap-1 whitespace-nowrap">
        <button type="button" class="inline-flex h-6 items-center rounded bg-blue-600 px-2 text-[11px] text-white hover:bg-blue-700" data-tech-action="open-add-bom" data-color-label="${escapeHtml(group.colorLabel)}" data-sku-codes="${escapeHtml(group.skuCodes.join(','))}">添加</button>
        <button type="button" class="inline-flex h-6 items-center rounded border px-2 text-[11px] hover:bg-muted" data-tech-action="open-copy-bom-color" data-color-label="${escapeHtml(group.colorLabel)}" data-bom-ids="${escapeHtml(group.rows.map((item) => item.id).join(','))}" ${group.rows.length === 0 || groups.length <= 1 ? 'disabled' : ''}>整色复制</button>
      </div>`

  const renderGroupCost = (group: BomColorGroup): string => {
    let allRowsComparable = group.rows.length > 0
    const amount = group.rows.reduce((sum, item) => {
      const snapshot = resolveMaterialSnapshot(item)
      if (!snapshot.unitPrice || !snapshot.pricingUnit || snapshot.pricingUnit !== item.unit) {
        allRowsComparable = false
        return sum
      }
      return sum + item.usage * (1 + item.lossRate / 100) * snapshot.unitPrice
    }, 0)
    return allRowsComparable ? amount.toFixed(2) : '—'
  }

  const renderMaterialImage = (item: BomItemRow): string => {
    const imageUrl = resolveMaterialSnapshot(item).imageUrl
    if (!imageUrl) {
      return '<div class="flex h-12 w-12 items-center justify-center rounded border border-red-200 bg-red-50 px-1 text-center text-[10px] text-red-700">缺少物料图</div>'
    }
    const imageLabel = `${item.materialName}（${item.materialCode}）`
    return `<button type="button" class="relative flex h-11 w-11 cursor-zoom-in items-center justify-center overflow-hidden rounded border bg-white" data-tech-action="open-material-image-preview" data-image-url="${escapeHtml(imageUrl)}" data-image-label="${escapeHtml(imageLabel)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(imageLabel)}大图">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageLabel)}真实物料图" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false" />
      <span class="absolute inset-0 flex items-center justify-center bg-white px-1 text-center text-[10px] text-muted-foreground">加载中</span>
    </button>`
  }

  return `
    <section>
      <div>
        ${groups.length === 0
          ? `<div class="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">暂无款色和常规物料${readonly ? '' : '，请先维护款色'}</div>`
          : `
              <div class="max-w-full overflow-x-auto rounded-md border" data-testid="tech-pack-regular-bom-table">
              <table class="w-[1840px] table-fixed border-collapse text-xs">
                <colgroup>
                  <col class="w-[108px]" />
                  <col class="w-[118px]" />
                  <col class="w-[112px]" />
                  <col class="w-[48px]" />
                  <col class="w-[64px]" />
                  <col class="w-[150px]" />
                  <col class="w-[140px]" />
                  <col class="w-[62px]" />
                  <col class="w-[112px]" />
                  <col class="w-[96px]" />
                  <col class="w-[88px]" />
                  <col class="w-[96px]" />
                  <col class="w-[96px]" />
                  <col class="w-[96px]" />
                  <col class="w-[88px]" />
                  <col class="w-[88px]" />
                  <col class="w-[124px]" />
                  <col class="w-[104px]" />
                </colgroup>
                <thead>
                  <tr>
                    <th class="${headerClass}">SPU</th>
                    <th class="${headerClass}">颜色</th>
                    <th class="${headerClass}">物料标准成本合计</th>
                    <th class="${headerClass}">序号</th>
                    <th class="${headerClass}">类型</th>
                    <th class="${headerClass}">物料编码</th>
                    <th class="${headerClass}">物料名称</th>
                    <th class="${headerClass}">物料图</th>
                    <th class="${headerClass}">规格</th>
                    <th class="${headerClass}">单位用量</th>
                    <th class="${headerClass}">单位</th>
                    <th class="${headerClass}">损耗率(%)</th>
                    <th class="${headerClass} border-l-2 border-l-blue-100">印花需求</th>
                    <th class="${headerClass}">染色需求</th>
                    <th class="${headerClass}">水溶需求</th>
                    <th class="${headerClass}">绣花需求</th>
                    <th class="${headerClass} border-l-2 border-l-emerald-100">绑定工艺</th>
                    <th class="${headerClass}">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${groups
                    .map(
                      (group) => {
                        if (group.rows.length === 0) {
                          return `
                            <tr class="bg-muted/10">
                              <td class="${cellClass} whitespace-nowrap font-medium">${escapeHtml(spuLabel)}</td>
                              <td class="${cellClass} min-w-[118px]">
                                <div class="font-medium">${escapeHtml(group.colorLabel)}</div>
                                ${renderGroupControls(group)}
                              </td>
                              <td class="${cellClass} text-center">—</td>
                              <td colspan="15" class="border-b px-3 py-4 text-center text-sm text-muted-foreground">当前款色暂无常规物料</td>
                            </tr>
                          `
                        }

                        return group.rows
                          .map((item, rowIndex) => {
                            const boundCraftCode = getBomBoundCraftCode(item)
                            const boundCraftOptions = bomBoundCraftOptions.filter((option) => option.allowedTypes.includes(item.type))
                            const selectableUnits = dedupeStrings([item.unit, ...unitOptions].filter(Boolean))
                            return `
                              <tr>
                                ${
                                  rowIndex === 0
                                    ? `<td rowspan="${group.rows.length}" class="${cellClass} whitespace-nowrap align-middle font-medium">${escapeHtml(spuLabel)}</td>
                                       <td rowspan="${group.rows.length}" class="${cellClass} align-middle">
                                         <div class="font-medium">${escapeHtml(group.colorLabel)}</div>
                                         ${renderGroupControls(group)}
                                       </td>
                                       <td rowspan="${group.rows.length}" class="${cellClass} text-center font-medium">${renderGroupCost(group)}</td>`
                                    : ''
                                }
                                <td class="${cellClass} text-center">${rowIndex + 1}</td>
                                <td class="${cellClass} whitespace-nowrap text-center">${escapeHtml(item.type)}</td>
                                <td class="${cellClass} break-all font-mono text-[11px]">${escapeHtml(item.materialCode)}</td>
                                <td class="${cellClass} break-words font-medium">${escapeHtml(item.materialName)}</td>
                                <td class="${cellClass} text-center">${renderMaterialImage(item)}</td>
                                <td class="${cellClass} break-words text-muted-foreground">${escapeHtml(item.spec || '-')}</td>
                                <td class="${cellClass}">
                                  ${
                                    readonly
                                      ? item.usage.toFixed(4)
                                      : `<input type="number" min="0" step="0.0001" class="h-8 w-full rounded border px-2 text-right text-xs" value="${item.usage.toFixed(4)}" data-tech-field="bom-usage" data-bom-id="${item.id}" data-skip-page-rerender="true" aria-label="${escapeHtml(item.materialName)}单位用量" />`
                                  }
                                </td>
                                <td class="${cellClass}" data-bom-unit-missing="${item.unit.trim() ? 'false' : 'true'}">
                                  ${readonly
                                    ? renderTextValue(item.unit)
                                    : `<select class="h-8 w-full rounded border px-2 text-xs" data-tech-field="bom-unit" data-bom-id="${item.id}">
                                        ${item.unit.trim() ? '' : '<option value="" selected>请选择</option>'}
                                        ${selectableUnits.map((option) => `<option value="${escapeHtml(option)}" ${item.unit === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
                                      </select>`}
                                  ${item.unit.trim() ? '' : '<div class="mt-1 whitespace-nowrap text-[10px] text-red-600">缺少单位，不能勾选水溶</div>'}
                                </td>
                                <td class="${cellClass}">
                                  ${readonly
                                    ? `${item.lossRate.toFixed(2)}%`
                                    : `<label class="flex items-center gap-1"><input type="number" min="0" step="0.01" class="h-8 min-w-0 flex-1 rounded border px-2 text-right text-xs" value="${item.lossRate.toFixed(2)}" data-tech-field="bom-loss-rate" data-bom-id="${item.id}" data-skip-page-rerender="true" aria-label="${escapeHtml(item.materialName)}损耗率" /><span>%</span></label>`}
                                </td>
                                <td class="${cellClass} border-l-2 border-l-blue-100">
                                  ${
                                    readonly || item.type === '成衣'
                                      ? renderTextValue(item.type === '成衣' ? '' : item.printRequirement)
                                      : `<select class="h-8 w-full rounded-md border px-2 text-xs" data-tech-field="bom-print" data-bom-id="${item.id}">
                                          ${printOptions
                                            .map((option) => `<option value="${option}" ${item.printRequirement === option ? 'selected' : ''}>${option}</option>`)
                                            .join('')}
                                        </select>`
                                  }
                                </td>
                                <td class="${cellClass}">
                                  ${
                                    readonly || item.type === '成衣'
                                      ? renderTextValue(item.type === '成衣' ? '' : item.dyeRequirement)
                                      : `<select class="h-8 w-full rounded-md border px-2 text-xs" data-tech-field="bom-dye" data-bom-id="${item.id}">
                                          ${dyeOptions
                                            .map((option) => `<option value="${option}" ${item.dyeRequirement === option ? 'selected' : ''}>${option}</option>`)
                                            .join('')}
                                        </select>`
                                  }
                                </td>
                                <td class="${cellClass}">
                                  ${
                                    readonly || item.type === '成衣'
                                      ? renderTextValue(item.type === '成衣' ? '' : item.waterSolubleRequirement === '是' ? '有' : '无')
                                      : `<select class="h-8 w-full rounded-md border px-2 text-xs" data-tech-field="bom-water-soluble" data-bom-id="${item.id}" data-testid="bom-water-soluble-requirement-select">
                                          ${bomRequirementOptions
                                            .map((option) => `<option value="${option}" ${item.waterSolubleRequirement === option ? 'selected' : ''}>${option === '是' ? '有' : '无'}</option>`)
                                            .join('')}
                                        </select>`
                                  }
                                </td>
                                <td class="${cellClass}">
                                  ${
                                    readonly || item.type === '成衣'
                                      ? renderTextValue(item.type === '成衣' ? '' : item.embroideryRequirement)
                                      : `<select class="h-8 w-full rounded-md border px-2 text-xs" data-tech-field="bom-embroidery" data-bom-id="${item.id}">
                                          ${['无', '有']
                                            .map((option) => `<option value="${option}" ${item.embroideryRequirement === option ? 'selected' : ''}>${option}</option>`)
                                            .join('')}
                                        </select>`
                                  }
                                </td>
                                <td class="${cellClass} border-l-2 border-l-emerald-100">
                                  ${
                                    readonly || item.type === '成衣'
                                      ? renderTextValue(bomBoundCraftOptions.find((option) => option.code === boundCraftCode)?.label || '')
                                      : `<select class="h-8 w-full rounded-md border px-2 text-xs" data-tech-field="bom-bound-craft" data-bom-id="${item.id}" ${boundCraftOptions.length <= 1 ? 'disabled' : ''}>
                                          ${boundCraftOptions
                                            .map((option) => `<option value="${option.code}" ${boundCraftCode === option.code ? 'selected' : ''}>${option.label}</option>`)
                                            .join('')}
                                        </select>`
                                  }
                                </td>
                                <td class="${cellClass}">
                                  <div class="flex items-center gap-1">
                                    ${readonly ? '' : `<button type="button" class="inline-flex h-7 w-7 items-center justify-center rounded text-blue-600 hover:bg-blue-50" data-tech-action="edit-bom" data-bom-id="${item.id}" title="编辑" aria-label="编辑${escapeHtml(item.materialName)}">
                                      <i data-lucide="edit-2" class="h-4 w-4"></i>
                                    </button>`}
                                    ${readonly ? '' : `<button type="button" class="inline-flex h-7 w-7 items-center justify-center rounded text-emerald-600 hover:bg-emerald-50" data-tech-action="copy-bom" data-bom-id="${item.id}" title="复制" aria-label="复制${escapeHtml(item.materialName)}">
                                      <i data-lucide="copy" class="h-4 w-4"></i>
                                    </button>`}
                                    ${readonly ? '' : `<button type="button" class="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-bom" data-bom-id="${item.id}" title="删除" aria-label="删除${escapeHtml(item.materialName)}">
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
              </div>
            `}
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
  const colorOptions = dedupeStrings([
    state.newBomItem.colorLabel,
    ...state.bomItems.map((item) => item.colorLabel),
    ...skuOptions.map((item) => item.color),
  ]).filter((item) => item && !['全部SKU（当前未区分颜色）', '未识别颜色', '多颜色'].includes(item))
  const isGarment = state.newBomItem.type === '成衣'
  const allowedKindsByType: Partial<Record<BomItemRow['type'], string[]>> = {
    面料: ['fabric'],
    纱线: ['yarn'],
    辅料: ['accessory'],
    包装材料: ['packaging'],
    其他: ['consumable', 'parts'],
  }
  const materialArchives = listMaterialArchives().filter((item) => (
    item.status === 'ACTIVE' && (allowedKindsByType[state.newBomItem.type] ?? []).includes(item.kind)
  ))
  const materialSkuOptions = materialArchives.flatMap((archive) => (
    listMaterialSkuRecordsByMaterialId(archive.materialId)
      .filter((sku) => sku.status === 'ACTIVE' && Boolean(sku.skuImageUrl || archive.mainImageUrl))
      .map((sku) => ({ archive, sku }))
  ))
  const selectedMaterialSku = state.newBomItem.materialSkuId
    ? getMaterialSkuRecordById(state.newBomItem.materialSkuId)
    : null
  const selectedMaterialArchive = selectedMaterialSku
    ? getMaterialArchiveById(selectedMaterialSku.materialId)
    : materialArchives.find((item) => item.materialCode === state.newBomItem.materialCode) ?? null
  const selectedMaterialImageUrl = selectedMaterialSku?.skuImageUrl || selectedMaterialArchive?.mainImageUrl || ''
  const usageProcessOptions = bomUsageProcessOptions.filter((option) =>
    option.allowedTypes.includes(state.newBomItem.type)
  )
  const boundCraftOptions = bomBoundCraftOptions.filter((option) =>
    option.allowedTypes.includes(state.newBomItem.type)
  )
  const boundCraftCode = getBomBoundCraftCode(state.newBomItem)
  const applyAllSku = isGarment
    ? skuOptions.length > 0 && state.newBomItem.applicableSkuCodes.length === skuOptions.length
    : state.newBomItem.applicableSkuCodes.length === 0
  const frontDesignOptions = getPatternDesignOptionsBySide('FRONT')
  const insideDesignOptions = getPatternDesignOptionsBySide('INSIDE')
  const hasPrintDemand = state.newBomItem.printRequirement !== '无'
  const showDesignPickers = hasPrintDemand && ['SINGLE', 'REVERSE', 'DOUBLE'].includes(state.newBomItem.printSideMode)
  const selectedFrontDesignIds = getBomPatternDesignIds(state.newBomItem, 'FRONT')
  const selectedInsideDesignIds = getBomPatternDesignIds(state.newBomItem, 'INSIDE')

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true" data-testid="tech-pack-bom-form-dialog">
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
                ${['面料', '纱线', '辅料', '包装材料', '成衣', '其他']
                  .map((option) => `<option value="${option}" ${state.newBomItem.type === option ? 'selected' : ''}>${option}</option>`)
                  .join('')}
              </select>
            </label>
            ${isGarment ? '' : `
              <label class="space-y-1">
                <span class="text-sm">物料档案 <span class="text-red-500">*</span></span>
                <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-material-sku">
                  <option value="">请选择带真实图片的物料</option>
                  ${materialSkuOptions
                    .map(({ archive, sku }) => `<option value="${escapeHtml(sku.materialSkuId)}" ${state.newBomItem.materialSkuId === sku.materialSkuId ? 'selected' : ''}>${escapeHtml(`${archive.materialCode} · ${archive.materialName} · ${sku.colorName} / ${sku.specName}`)}</option>`)
                    .join('')}
                </select>
              </label>
              ${selectedMaterialImageUrl
                ? `<button type="button" class="flex w-full items-center gap-3 rounded-md border p-2 text-left hover:bg-muted/40" data-tech-action="open-material-image-preview" data-image-url="${escapeHtml(selectedMaterialImageUrl)}" data-image-label="${escapeHtml(state.newBomItem.materialName || selectedMaterialArchive?.materialName || '物料')}" data-skip-page-rerender="true">
                    <img src="${escapeHtml(selectedMaterialImageUrl)}" alt="${escapeHtml(state.newBomItem.materialName || selectedMaterialArchive?.materialName || '物料')}真实物料图" class="h-14 w-14 rounded border object-cover" />
                    <span class="text-sm">查看物料大图</span>
                  </button>`
                : '<p class="text-xs text-amber-700">保存前请选择带真实图片的物料档案。</p>'}
            `}
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
            ${isGarment ? '' : `
              <label class="space-y-1">
                <span class="text-sm">物料编码</span>
                <input class="w-full rounded-md border bg-muted/20 px-3 py-2 text-sm" data-tech-field="new-bom-material-code" value="${escapeHtml(state.newBomItem.materialCode)}" placeholder="选择物料后自动带出" readonly />
              </label>
              <label class="space-y-1">
                <span class="text-sm">规格</span>
                <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-spec" value="${escapeHtml(state.newBomItem.spec)}" placeholder="规格" />
              </label>
            `}
            ${isGarment ? `<div class="space-y-1">
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
            </div>` : ''}
            ${isGarment
              ? `<div class="space-y-1">
                  <span class="text-sm">成衣工艺</span>
                  <div class="grid grid-cols-2 gap-2 rounded-md border p-2 text-xs">
                    ${usageProcessOptions
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
                </div>`
              : `<label class="space-y-1">
                  <span class="text-sm">绑定工艺</span>
                  <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-bound-craft" ${boundCraftOptions.length <= 1 ? 'disabled' : ''}>
                    ${boundCraftOptions
                      .map((option) => `<option value="${option.code}" ${boundCraftCode === option.code ? 'selected' : ''}>${option.label}</option>`)
                      .join('')}
                  </select>
                </label>`}
            ${isGarment ? `
              <div class="grid grid-cols-2 gap-3">
                <label class="space-y-1">
                  <span class="text-sm">单件用量</span>
                  <input class="w-full rounded-md border bg-muted/20 px-3 py-2 text-sm" value="1" disabled />
                </label>
                <label class="space-y-1">
                  <span class="text-sm">单位</span>
                  <input class="w-full rounded-md border bg-muted/20 px-3 py-2 text-sm" value="件" disabled />
                </label>
              </div>
            ` : `
              <label class="space-y-1">
                <span class="text-sm">单位用量</span>
                <input type="number" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-usage" value="${escapeHtml(state.newBomItem.usage)}" placeholder="0" />
              </label>
              <label class="space-y-1">
                <span class="text-sm">单位</span>
                <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-unit" value="${escapeHtml(state.newBomItem.unit)}" placeholder="请输入物料单位" />
              </label>
            `}
          </div>

          <div class="space-y-4">
            <label class="space-y-1">
              <span class="text-sm">物料名称 <span class="text-red-500">*</span></span>
              <input class="w-full rounded-md border bg-muted/20 px-3 py-2 text-sm" data-tech-field="new-bom-material-name" value="${escapeHtml(state.newBomItem.materialName)}" placeholder="选择物料后自动带出" readonly />
            </label>
            ${isGarment ? `
              <label class="space-y-1">
                <span class="text-sm">备注</span>
                <textarea rows="3" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-remark" placeholder="补充成衣辅助工艺说明（可选）">${escapeHtml(state.newBomItem.remark)}</textarea>
              </label>
            ` : `
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
                      <option value="REVERSE" ${state.newBomItem.printSideMode === 'REVERSE' ? 'selected' : ''}>反面印</option>
                      <option value="DOUBLE" ${state.newBomItem.printSideMode === 'DOUBLE' ? 'selected' : ''}>双面印</option>
                    </select>
                  </label>
                `
                : ''
            }
            ${showDesignPickers ? renderPatternDesignPicker('正面花型', 'FRONT', frontDesignOptions, selectedFrontDesignIds) : ''}
            ${showDesignPickers ? renderPatternDesignPicker('里面花型', 'INSIDE', insideDesignOptions, selectedInsideDesignIds) : ''}
            <label class="space-y-1">
              <span class="text-sm">水溶要求</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-water-soluble-requirement" data-testid="new-bom-water-soluble-requirement-select">
                ${bomRequirementOptions
                  .map((option) => `<option value="${option}" ${state.newBomItem.waterSolubleRequirement === option ? 'selected' : ''}>${option}</option>`)
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
            <label class="space-y-1">
              <span class="text-sm">绣花需求</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-embroidery-requirement">
                ${['无', '有']
                  .map((option) => `<option value="${option}" ${state.newBomItem.embroideryRequirement === option ? 'selected' : ''}>${option}</option>`)
                  .join('')}
              </select>
            </label>
            `}
          </div>
        </div>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-bom">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.newBomItem.materialName.trim() && (!isGarment || state.newBomItem.applicableSkuCodes.length > 0)
              ? ''
              : 'pointer-events-none opacity-50'
          }" data-tech-action="save-bom">确认</button>
        </footer>
      </section>
    </div>
  `
}
