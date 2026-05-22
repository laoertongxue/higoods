import type { MarkerScheme, MarkerSchemeImage } from './marker-plan-domain.ts'

const markerBedModeLabel: Record<string, string> = {
  normal: '普通模式',
  high_low: '高低层模式',
  fold_normal: '对折普通模式',
  fold_high_low: '对折高低层模式',
}

function nowText(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function escapeXml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function encodePreview(title: string, lines: string[], options: { accent?: string; subtitle?: string } = {}): string {
  const accent = options.accent || '#2563EB'
  const rowHeight = 28
  const height = Math.max(300, 132 + Math.min(lines.length, 18) * rowHeight)
  const rows = lines
    .slice(0, 18)
    .map((line, index) => {
      const y = 120 + index * rowHeight
      const background = index % 2 === 0 ? '#F8FAFC' : '#FFFFFF'
      return `<rect x="36" y="${y - 20}" width="848" height="24" rx="6" fill="${background}" stroke="#E2E8F0"/>
        <text x="50" y="${y - 4}" font-size="14" font-family="Arial, sans-serif" fill="#334155">${escapeXml(line)}</text>`
    })
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="${height}" viewBox="0 0 920 ${height}">
    <rect width="920" height="${height}" rx="18" fill="#F8FAFC"/>
    <rect x="18" y="18" width="884" height="${height - 36}" rx="14" fill="#FFFFFF" stroke="#CBD5E1"/>
    <rect x="36" y="38" width="10" height="36" rx="5" fill="${accent}"/>
    <text x="58" y="58" font-size="26" font-family="Arial, sans-serif" font-weight="700" fill="#0F172A">${escapeXml(title)}</text>
    ${options.subtitle ? `<text x="58" y="78" font-size="13" font-family="Arial, sans-serif" fill="#64748B">${escapeXml(options.subtitle)}</text>` : ''}
    <line x1="36" y1="82" x2="884" y2="82" stroke="#E2E8F0"/>
    ${rows}
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function buildMarkerSchemeImage(scheme: MarkerScheme, generatedBy = '系统'): MarkerSchemeImage {
  const content = [
    `方案号：${scheme.schemeNo}`,
    `款号：${scheme.spuCode}`,
    `技术包：${scheme.techPackVersion}`,
    `面料：${scheme.materialSku}`,
    `总需求：${scheme.totalDemandQty}`,
    `已排：${scheme.totalPlannedQty}`,
    `剩余：${scheme.remainingQty}`,
    ...scheme.demandRows.slice(0, 8).map((row) => `需求：${row.colorName} / ${row.sizeName} / ${row.demandQty} 件`),
    ...scheme.beds
      .slice(0, 8)
      .map((bed) => `床次：${bed.bedNo} / ${markerBedModeLabel[bed.bedMode] || bed.bedMode} / ${bed.colorName} / ${bed.sizeSummaryText} / ${bed.plannedGarmentQty} 件`),
  ]
  return {
    imageId: `${scheme.schemeId}-scheme-image`,
    imageType: '方案图',
    imageName: `${scheme.schemeNo}-方案图`,
    previewUrl: encodePreview(`${scheme.schemeNo} · 方案图`, content, {
      accent: '#0EA5E9',
      subtitle: '按正式版技术包颜色、尺码和唛架编号生成',
    }),
    generatedAt: nowText(),
    generatedBy,
    status: '已生成',
  }
}

export function buildMarkerDetailImage(scheme: MarkerScheme, generatedBy = '系统'): MarkerSchemeImage {
  const content = scheme.beds.flatMap((bed) => [
    `床次：${bed.bedNo} / 模式：${markerBedModeLabel[bed.bedMode] || bed.bedMode} / 颜色：${bed.colorName}`,
    `尺码：${bed.sizeSummaryText}`,
    `层数：${bed.plannedLayerCount} / 床次净长：${bed.markerLength} m / 铺布总长：${bed.spreadTotalLength} m`,
    `计划成衣件数：${bed.plannedGarmentQty} 件 / 状态：${bed.status}`,
  ])
  return {
    imageId: `${scheme.schemeId}-detail-image`,
    imageType: '唛架明细图',
    imageName: `${scheme.schemeNo}-唛架明细图`,
    previewUrl: encodePreview(`${scheme.schemeNo} · 唛架明细图`, content, {
      accent: '#F97316',
      subtitle: '每个床次单独记录模式、颜色、尺码、层数和长度',
    }),
    generatedAt: nowText(),
    generatedBy,
    status: '已生成',
  }
}

export function markSchemeImageExpired(scheme: MarkerScheme): MarkerScheme {
  return {
    ...scheme,
    imageStatus: '已过期',
    schemeImage: scheme.schemeImage ? { ...scheme.schemeImage, status: '已过期' } : scheme.schemeImage,
    detailImage: scheme.detailImage ? { ...scheme.detailImage, status: '已过期' } : scheme.detailImage,
  }
}
