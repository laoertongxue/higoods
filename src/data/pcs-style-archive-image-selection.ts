import { listProjectChannelProductsByProjectId } from './pcs-channel-product-project-repository.ts'
import {
  getProjectImageAssetById,
  listProjectImageAssets,
  markProjectImageAssetUsableForStyleArchive,
} from './pcs-project-image-repository.ts'
import type { PcsProjectImageAssetRecord } from './pcs-project-image-types.ts'

export interface StyleArchiveImageCandidate {
  imageId: string
  imageUrl: string
  imageName: string
  imageType: PcsProjectImageAssetRecord['imageType']
  imageStatus: PcsProjectImageAssetRecord['imageStatus']
  usageScopes: PcsProjectImageAssetRecord['usageScopes']
  sourceNodeCode: string
  sourceType: PcsProjectImageAssetRecord['sourceType']
  sourceLabel: string
  priority: number
  requiresConfirmation: boolean
}

export interface StyleArchiveImageSelectionInput {
  projectId: string
  styleMainImageId: string
  styleGalleryImageIds?: string[]
  operatorName?: string
  timestamp?: string
}

export interface StyleArchiveImageSelectionResult {
  ok: boolean
  message: string
  mainImageId: string
  mainImageUrl: string
  galleryImageIds: string[]
  galleryImageUrls: string[]
  imageSource: string
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)))
}

function getImageSourceLabel(record: PcsProjectImageAssetRecord): string {
  if (record.sourceNodeCode === 'CHANNEL_PRODUCT_LISTING') return '商品上架图片'
  if (record.sourceNodeCode === 'SAMPLE_SHOOT_FIT') return '样衣拍摄图片'
  if (record.imageType === '项目参考图') return '项目参考图'
  if (record.sourceNodeCode === 'STYLE_ARCHIVE_CREATE' || record.imageType === '款式档案图') return '档案补充图'
  return record.sourceType || '项目图片'
}

function resolveImagePriority(record: PcsProjectImageAssetRecord, listingImageIds: Set<string>): number {
  if (listingImageIds.has(record.imageId) || record.sourceNodeCode === 'CHANNEL_PRODUCT_LISTING') return 1
  if (record.sourceNodeCode === 'SAMPLE_SHOOT_FIT') return 2
  if (record.imageType === '项目参考图') return 3
  if (record.sourceNodeCode === 'STYLE_ARCHIVE_CREATE' || record.imageType === '款式档案图') return 4
  return 9
}

function canBeStyleArchiveCandidate(record: PcsProjectImageAssetRecord, listingImageIds: Set<string>): boolean {
  if (!record.imageUrl) return false
  if (record.imageStatus === '已弃用' || record.imageStatus === '需重拍') return false
  if (listingImageIds.has(record.imageId) || record.sourceNodeCode === 'CHANNEL_PRODUCT_LISTING') return true
  if (record.sourceNodeCode === 'SAMPLE_SHOOT_FIT') {
    return record.usageScopes.includes('款式档案') && record.imageStatus === '可用于款式档案'
  }
  if (record.imageType === '项目参考图') return true
  if (record.sourceNodeCode === 'STYLE_ARCHIVE_CREATE' || record.imageType === '款式档案图') return true
  return record.usageScopes.includes('款式档案')
}

function isPendingReferenceImage(record: PcsProjectImageAssetRecord): boolean {
  return record.imageType === '项目参考图' && !record.usageScopes.includes('款式档案')
}

function ensureImageReadyForStyleArchive(
  record: PcsProjectImageAssetRecord,
  operatorName: string,
  timestamp: string,
): PcsProjectImageAssetRecord | null {
  if (
    record.imageStatus === '已弃用' ||
    record.imageStatus === '需重拍' ||
    !record.imageUrl
  ) {
    return null
  }
  if (record.usageScopes.includes('款式档案') && record.imageStatus === '可用于款式档案') {
    return record
  }
  return markProjectImageAssetUsableForStyleArchive(record.imageId, operatorName, timestamp)
}

export function listStyleArchiveImageCandidates(projectId: string): StyleArchiveImageCandidate[] {
  const listingImageIds = new Set(
    listProjectChannelProductsByProjectId(projectId)
      .flatMap((record) => record.listingImageIds || [])
      .filter(Boolean),
  )

  return listProjectImageAssets(projectId)
    .filter((record) => canBeStyleArchiveCandidate(record, listingImageIds))
    .map((record) => ({
      imageId: record.imageId,
      imageUrl: record.imageUrl,
      imageName: record.imageName || '未命名图片',
      imageType: record.imageType,
      imageStatus: record.imageStatus,
      usageScopes: [...record.usageScopes],
      sourceNodeCode: record.sourceNodeCode,
      sourceType: record.sourceType,
      sourceLabel: getImageSourceLabel(record),
      priority: resolveImagePriority(record, listingImageIds),
      requiresConfirmation: isPendingReferenceImage(record),
    }))
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.sourceLabel.localeCompare(right.sourceLabel, 'zh-Hans-CN') ||
        left.imageName.localeCompare(right.imageName, 'zh-Hans-CN'),
    )
}

export function resolveStyleArchiveImageSelection(
  input: StyleArchiveImageSelectionInput,
): StyleArchiveImageSelectionResult {
  const timestamp = input.timestamp || new Date().toISOString()
  const operatorName = input.operatorName || '当前用户'

  if (!input.styleMainImageId.trim()) {
    return {
      ok: false,
      message: '当前项目尚未确认款式档案图片，请先选择或上传图片。',
      mainImageId: '',
      mainImageUrl: '',
      galleryImageIds: [],
      galleryImageUrls: [],
      imageSource: '',
    }
  }

  const selectedIds = uniqueStrings([
    input.styleMainImageId,
    ...(input.styleGalleryImageIds || []),
  ])

  const selectedAssets = selectedIds
    .map((imageId) => getProjectImageAssetById(imageId))
    .filter((item): item is PcsProjectImageAssetRecord => Boolean(item))
    .filter((item) => item.projectId === input.projectId)

  if (selectedAssets.length !== selectedIds.length) {
    return {
      ok: false,
      message: '当前项目尚未确认款式档案图片，请先选择或上传图片。',
      mainImageId: '',
      mainImageUrl: '',
      galleryImageIds: [],
      galleryImageUrls: [],
      imageSource: '',
    }
  }

  const readyAssets = selectedAssets
    .map((asset) => ensureImageReadyForStyleArchive(asset, operatorName, timestamp))
    .filter((item): item is PcsProjectImageAssetRecord => Boolean(item))

  if (readyAssets.length !== selectedAssets.length) {
    return {
      ok: false,
      message: '请确认图片可用于款式档案。',
      mainImageId: '',
      mainImageUrl: '',
      galleryImageIds: [],
      galleryImageUrls: [],
      imageSource: '',
    }
  }

  const mainImage = readyAssets.find((item) => item.imageId === input.styleMainImageId)
  if (!mainImage) {
    return {
      ok: false,
      message: '请先选择档案主图。',
      mainImageId: '',
      mainImageUrl: '',
      galleryImageIds: [],
      galleryImageUrls: [],
      imageSource: '',
    }
  }

  const orderedGallery = uniqueStrings([
    input.styleMainImageId,
    ...(input.styleGalleryImageIds || []),
  ])
    .map((imageId) => readyAssets.find((item) => item.imageId === imageId))
    .filter((item): item is PcsProjectImageAssetRecord => Boolean(item))

  const galleryAssets = orderedGallery.length > 0 ? orderedGallery : [mainImage]
  const imageSource = Array.from(new Set(galleryAssets.map(getImageSourceLabel))).join('、')

  return {
    ok: true,
    message: '已确认款式档案图片。',
    mainImageId: mainImage.imageId,
    mainImageUrl: mainImage.imageUrl,
    galleryImageIds: galleryAssets.map((item) => item.imageId),
    galleryImageUrls: galleryAssets.map((item) => item.imageUrl),
    imageSource,
  }
}
