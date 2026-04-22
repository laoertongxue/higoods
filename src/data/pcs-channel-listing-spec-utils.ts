import type {
  ChannelListingSpecLineInput,
  ChannelListingSpecLineRecord,
} from './pcs-channel-listing-spec-types.ts'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function sanitizeCodePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function compactCode(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '')
    .slice(0, 12)
}

export function cloneChannelListingSpecLine(
  line: ChannelListingSpecLineRecord,
): ChannelListingSpecLineRecord {
  return { ...line }
}

export function cloneChannelListingSpecLines(
  specLines: ChannelListingSpecLineRecord[],
): ChannelListingSpecLineRecord[] {
  return specLines.map(cloneChannelListingSpecLine)
}

export function buildChannelListingSpecLineCode(listingBatchCode: string, index: number): string {
  return `${listingBatchCode}-SPEC-${pad(index + 1)}`
}

export function buildChannelListingSpecLineId(listingBatchId: string, index: number): string {
  return `${listingBatchId}::spec::${pad(index + 1)}`.replace(/[^a-zA-Z0-9:_-]/g, '_')
}

export function buildChannelListingSellerSku(input: {
  projectCode: string
  colorName: string
  sizeName: string
  index: number
}): string {
  const projectPart = compactCode(input.projectCode.split('-').slice(-2).join(''))
  const colorPart = compactCode(input.colorName || '色')
  const sizePart = compactCode(input.sizeName || '码')
  return [projectPart || 'PRJ', colorPart || 'COLOR', sizePart || 'SIZE', pad(input.index + 1)].join('-')
}

export function buildUploadedUpstreamSkuId(
  upstreamProductId: string,
  specLineCode: string,
): string {
  return `${sanitizeCodePart(upstreamProductId)}-${sanitizeCodePart(specLineCode.split('-').slice(-1)[0] || '01')}`
}

export function normalizeChannelListingSpecLines(input: {
  listingBatchId: string
  listingBatchCode: string
  projectCode: string
  defaultPriceAmount: number
  currencyCode: string
  specLines: ChannelListingSpecLineInput[]
  resolveProductImage?: (
    imageId: string,
  ) => { imageUrl: string; imageName: string } | null
}): ChannelListingSpecLineRecord[] {
  return input.specLines.map((line, index) => {
    const productImageId = String(line.productImageId || '').trim()
    const resolvedImage = productImageId ? input.resolveProductImage?.(productImageId) || null : null
    const colorName = String(line.colorName || '').trim()
    const sizeName = String(line.sizeName || '').trim()
    const printName = String(line.printName || '').trim()
    const priceAmount =
      typeof line.priceAmount === 'number' && Number.isFinite(line.priceAmount)
        ? line.priceAmount
        : input.defaultPriceAmount
    const currencyCode = String(line.currencyCode || input.currencyCode || '').trim()
    const sellerSku =
      String(line.sellerSku || '').trim() ||
      buildChannelListingSellerSku({
        projectCode: input.projectCode,
        colorName,
        sizeName,
        index,
      })

    return {
      specLineId: String(line.specLineId || buildChannelListingSpecLineId(input.listingBatchId, index)).trim(),
      specLineCode: String(line.specLineCode || buildChannelListingSpecLineCode(input.listingBatchCode, index)).trim(),
      listingBatchId: String(line.listingBatchId || input.listingBatchId).trim(),
      productImageId,
      productImageUrl: String(line.productImageUrl || resolvedImage?.imageUrl || '').trim(),
      productImageName: String(line.productImageName || resolvedImage?.imageName || '').trim(),
      colorName,
      sizeName,
      printName,
      sellerSku,
      priceAmount,
      currencyCode,
      stockQty:
        typeof line.stockQty === 'number' && Number.isFinite(line.stockQty) ? line.stockQty : 0,
      lineStatus: line.lineStatus || '待上传',
      upstreamSkuId: String(line.upstreamSkuId || '').trim(),
      uploadResultText: String(line.uploadResultText || '').trim(),
    }
  })
}

export function validateChannelListingSpecLinesForCreate(
  specLines: ChannelListingSpecLineInput[],
): string | null {
  if (!Array.isArray(specLines) || specLines.length === 0) {
    return '请先补齐至少一条规格明细。'
  }

  for (const line of specLines) {
    if (!String(line.productImageId || '').trim()) {
      return '存在未选择商品图片的规格，不能创建上架批次。'
    }
  }
  return null
}

export function validateChannelListingSpecLinesForUpload(
  specLines: ChannelListingSpecLineRecord[],
): string | null {
  if (!Array.isArray(specLines) || specLines.length === 0) {
    return '当前款式尚未填写规格明细，不能上传到渠道。'
  }

  for (const line of specLines) {
    if (!line.productImageId.trim()) {
      return '存在未选择商品图片的规格，不能上传到渠道。'
    }
    if (!line.colorName.trim()) {
      return '存在未填写颜色的规格，不能上传到渠道。'
    }
    if (!line.sizeName.trim()) {
      return '存在未填写尺码的规格，不能上传到渠道。'
    }
    if (!(typeof line.priceAmount === 'number' && Number.isFinite(line.priceAmount) && line.priceAmount > 0)) {
      return '存在未填写价格的规格，不能上传到渠道。'
    }
    if (!line.currencyCode.trim()) {
      return '存在未填写币种的规格，不能上传到渠道。'
    }
  }

  return null
}

export function countUploadedChannelListingSpecLines(
  specLines: ChannelListingSpecLineRecord[],
): number {
  return specLines.filter((item) => Boolean(item.upstreamSkuId)).length
}
