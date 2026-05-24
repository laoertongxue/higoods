import { escapeHtml } from '../../../utils.ts'

export interface CuttingMaterialIdentity {
  materialSku?: string
  materialName?: string
  materialLabel?: string
  materialCategory?: string
  materialColor?: string
  materialAlias?: string
  materialImageUrl?: string
  materialUnit?: string
}

function renderMaterialImage(url: string | undefined, alt: string, sizeClass: string): string {
  if (!url) {
    return `
      <div class="${sizeClass} flex shrink-0 items-center justify-center rounded-md border bg-slate-50 text-[10px] font-medium text-slate-400">
        暂无图
      </div>
    `
  }

  return `
    <img
      src="${escapeHtml(url)}"
      alt="${escapeHtml(alt)}"
      class="${sizeClass} shrink-0 rounded-md border bg-slate-50 object-cover"
      loading="lazy"
    />
  `
}

export function renderMaterialIdentityBlock(
  material: CuttingMaterialIdentity,
  options: {
    imageSizeClass?: string
    compact?: boolean
    showCategory?: boolean
  } = {},
): string {
  const sku = material.materialSku || '待补面料 SKU'
  const label = material.materialName || material.materialLabel || ''
  const shouldShowLabel = Boolean(label && label !== sku)
  const color = material.materialColor || '待补'
  const alias = material.materialAlias || '技术包未维护别名'
  const imageSizeClass = options.imageSizeClass || (options.compact ? 'h-10 w-10' : 'h-12 w-12')
  const unit = material.materialUnit || ''
  const category = [material.materialCategory || '', unit ? `单位：${unit}` : ''].filter(Boolean).join(' · ')
  const fullMaterialTitle = shouldShowLabel ? `面料 SKU：${sku}；面料名称：${label}` : `面料 SKU：${sku}`

  return `
    <div class="flex w-full min-w-0 max-w-full items-start gap-2">
      ${renderMaterialImage(material.materialImageUrl, alias || label || sku, imageSizeClass)}
      <div class="min-w-0 flex-1 overflow-hidden">
        <div class="truncate whitespace-nowrap font-medium text-foreground" data-material-identity-name="true" title="${escapeHtml(fullMaterialTitle)}">${escapeHtml(sku)}${shouldShowLabel ? ` <span class="font-normal text-muted-foreground">${escapeHtml(label)}</span>` : ''}</div>
        <div class="mt-1 truncate text-xs text-blue-700" title="${escapeHtml(`颜色：${color} · 技术包别名：${alias}`)}">
          颜色：${escapeHtml(color)} · 技术包别名：${escapeHtml(alias)}
        </div>
        ${options.showCategory === false || !category ? '' : `<div class="mt-1 truncate text-[11px] text-muted-foreground" title="${escapeHtml(category)}">${escapeHtml(category)}</div>`}
      </div>
    </div>
  `
}

export function renderMaterialIdentityInline(material: CuttingMaterialIdentity): string {
  const alias = material.materialAlias || '技术包未维护别名'
  return `${material.materialSku || '待补面料 SKU'} / ${alias}`
}
