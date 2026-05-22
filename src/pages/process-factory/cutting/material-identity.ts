import { escapeHtml } from '../../../utils.ts'

export interface CuttingMaterialIdentity {
  materialSku?: string
  materialLabel?: string
  materialCategory?: string
  materialAlias?: string
  materialImageUrl?: string
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
  const label = material.materialLabel || '待补技术包物料名'
  const alias = material.materialAlias || '技术包未维护别名'
  const imageSizeClass = options.imageSizeClass || (options.compact ? 'h-10 w-10' : 'h-12 w-12')
  const category = material.materialCategory || ''

  return `
    <div class="flex min-w-[12rem] items-start gap-2">
      ${renderMaterialImage(material.materialImageUrl, alias || label || sku, imageSizeClass)}
      <div class="min-w-0">
        <div class="truncate font-medium text-foreground" title="${escapeHtml(sku)}">${escapeHtml(sku)}</div>
        <div class="mt-1 truncate text-xs text-blue-700" title="${escapeHtml(alias)}">技术包别名：${escapeHtml(alias)}</div>
        <div class="mt-1 truncate text-xs text-muted-foreground" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
        ${options.showCategory === false || !category ? '' : `<div class="mt-1 truncate text-[11px] text-muted-foreground" title="${escapeHtml(category)}">${escapeHtml(category)}</div>`}
      </div>
    </div>
  `
}

export function renderMaterialIdentityInline(material: CuttingMaterialIdentity): string {
  const alias = material.materialAlias || '技术包未维护别名'
  return `${material.materialSku || '待补面料 SKU'} / ${alias}`
}
