import type { PcsProjectImageAssetRecord } from './pcs-project-image-types.ts'
import type {
  ChannelListingImageInput,
  ChannelListingImageRecord,
} from './pcs-channel-listing-image-types.ts'

function cloneChannelListingImage(
  image: ChannelListingImageRecord,
): ChannelListingImageRecord {
  return { ...image }
}

export function cloneChannelListingImages(
  images: ChannelListingImageRecord[],
): ChannelListingImageRecord[] {
  return images.map(cloneChannelListingImage)
}

export function buildChannelListingImageId(
  listingBatchId: string,
  index: number,
): string {
  return `${listingBatchId}::image::${String(index + 1).padStart(2, '0')}`
}

function buildImageSource(
  asset: Pick<PcsProjectImageAssetRecord, 'imageType' | 'sourceNodeCode'>,
): ChannelListingImageRecord['sourceType'] {
  if (asset.sourceNodeCode === 'CHANNEL_PRODUCT_LISTING' || asset.imageType === '上架图') {
    return '上架补充图'
  }
  if (asset.sourceNodeCode === 'SAMPLE_SHOOT_FIT') {
    return '样衣拍摄图片'
  }
  return '项目参考图'
}

export function normalizeChannelListingImages(input: {
  listingBatchId: string
  imageInputs: ChannelListingImageInput[]
  mainImageId: string
  imageAssets: PcsProjectImageAssetRecord[]
}): ChannelListingImageRecord[] {
  const imageAssetMap = new Map(input.imageAssets.map((record) => [record.imageId, record]))
  return input.imageInputs
    .map((item, index) => {
      const asset = imageAssetMap.get(item.imageId)
      if (!asset) return null
      return {
        listingImageId: buildChannelListingImageId(input.listingBatchId, index),
        listingBatchId: input.listingBatchId,
        imageId: asset.imageId,
        imageUrl: asset.imageUrl,
        imageName: asset.imageName,
        sourceType: buildImageSource(asset),
        sortNo:
          typeof item.sortNo === 'number' && Number.isFinite(item.sortNo)
            ? item.sortNo
            : index + 1,
        mainFlag: asset.imageId === input.mainImageId || item.mainFlag === true,
      } satisfies ChannelListingImageRecord
    })
    .filter((item): item is ChannelListingImageRecord => Boolean(item))
    .sort((left, right) => left.sortNo - right.sortNo)
    .map((item, index) => ({
      ...item,
      listingImageId: buildChannelListingImageId(input.listingBatchId, index),
      sortNo: index + 1,
      mainFlag: item.imageId === input.mainImageId,
    }))
}

export function deriveListingImageIds(
  listingImages: ChannelListingImageRecord[],
): string[] {
  return listingImages
    .slice()
    .sort((left, right) => left.sortNo - right.sortNo)
    .map((item) => item.imageId)
}

export function deriveListingMainImageId(
  listingImages: ChannelListingImageRecord[],
): string {
  return (
    listingImages.find((item) => item.mainFlag)?.imageId ||
    listingImages.slice().sort((left, right) => left.sortNo - right.sortNo)[0]?.imageId ||
    ''
  )
}

function isListingImageUsable(
  asset: PcsProjectImageAssetRecord | null | undefined,
): boolean {
  if (!asset) return false
  if (!asset.usageScopes.includes('商品上架')) return false
  return asset.imageStatus === '可用于上架' || asset.imageStatus === '已选为上架图'
}

export function validateChannelListingImagesForUpload(input: {
  listingImages: ChannelListingImageRecord[]
  listingMainImageId: string
  getImageAssetById: (imageId: string) => PcsProjectImageAssetRecord | null
}): string | null {
  if (!Array.isArray(input.listingImages) || input.listingImages.length === 0) {
    return '请先选择或上传上架图片。'
  }

  if (!input.listingMainImageId.trim()) {
    return '请设置上架主图。'
  }

  const imageIds = new Set<string>()
  for (const image of input.listingImages) {
    if (!image.imageId.trim()) {
      return '请先选择或上传上架图片。'
    }
    imageIds.add(image.imageId)
    if (!(typeof image.sortNo === 'number' && Number.isFinite(image.sortNo) && image.sortNo > 0)) {
      return '请先选择或上传上架图片。'
    }
    const asset = input.getImageAssetById(image.imageId)
    if (!isListingImageUsable(asset)) {
      return '请确认图片可用于商品上架。'
    }
  }

  if (!imageIds.has(input.listingMainImageId)) {
    return '请设置上架主图。'
  }

  const mainAsset = input.getImageAssetById(input.listingMainImageId)
  if (!isListingImageUsable(mainAsset)) {
    return '请确认图片可用于商品上架。'
  }

  return null
}
