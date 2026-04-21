import {
  listProjectImageAssets,
  listProjectImageAssetsBySourceNode,
  listProjectReferenceImages,
} from './pcs-project-image-repository.ts'
import type { PcsProjectImageAssetRecord, PcsProjectImageUsageScope } from './pcs-project-image-types.ts'

export interface PcsProjectReferenceImageViewModel {
  imageId: string
  imageUrl: string
  imageName: string
  imageStatus: string
  sortNo: number
  previewTitle: string
}

export interface PcsProjectImageAssetViewModel extends PcsProjectReferenceImageViewModel {
  imageType: PcsProjectImageAssetRecord['imageType']
  sourceNodeCode: string
  sourceType: PcsProjectImageAssetRecord['sourceType']
  usageScopes: PcsProjectImageAssetRecord['usageScopes']
  usageScopeText: string
}

function toImageViewModel(record: PcsProjectImageAssetRecord): PcsProjectImageAssetViewModel {
  return {
    imageId: record.imageId,
    imageUrl: record.imageUrl,
    imageName: record.imageName,
    imageStatus: record.imageStatus,
    sortNo: record.sortNo,
    previewTitle: `${record.imageName} · ${record.imageStatus}`,
    imageType: record.imageType,
    sourceNodeCode: record.sourceNodeCode,
    sourceType: record.sourceType,
    usageScopes: [...record.usageScopes],
    usageScopeText: record.usageScopes.join('、'),
  }
}

export function listProjectReferenceImageViewModels(projectId: string): PcsProjectReferenceImageViewModel[] {
  return listProjectReferenceImages(projectId).map((record) => ({
    imageId: record.imageId,
    imageUrl: record.imageUrl,
    imageName: record.imageName,
    imageStatus: record.imageStatus,
    sortNo: record.sortNo,
    previewTitle: `${record.imageName} · ${record.imageStatus}`,
  }))
}

export function listProjectSampleShootImageViewModels(projectId: string): PcsProjectImageAssetViewModel[] {
  return listProjectImageAssetsBySourceNode(projectId, 'SAMPLE_SHOOT_FIT').map(toImageViewModel)
}

export function listProjectImageViewModelsByUsage(
  projectId: string,
  usageScope: PcsProjectImageUsageScope,
): PcsProjectImageAssetViewModel[] {
  return listProjectImageAssets(projectId)
    .filter((record) => record.usageScopes.includes(usageScope))
    .map(toImageViewModel)
}

export function findProjectImageViewModelById(projectId: string, imageId: string): PcsProjectImageAssetViewModel | null {
  return listProjectImageAssets(projectId)
    .filter((record) => record.imageId === imageId)
    .map(toImageViewModel)[0] || null
}

export function listProjectListingCandidateImageViewModels(
  projectId: string,
): PcsProjectImageAssetViewModel[] {
  return listProjectImageAssets(projectId)
    .filter((record) => {
      if (record.imageStatus === '已弃用' || record.imageStatus === '需重拍') {
        return false
      }
      if (record.imageType === '上架图') return true
      if (record.sourceNodeCode === 'SAMPLE_SHOOT_FIT') {
        return record.usageScopes.includes('商品上架') && record.imageStatus === '可用于上架'
      }
      if (record.imageType === '项目参考图') return true
      return record.usageScopes.includes('商品上架')
    })
    .map(toImageViewModel)
}

export function listProjectStyleArchiveCandidateImageViewModels(
  projectId: string,
): PcsProjectImageAssetViewModel[] {
  return listProjectImageAssets(projectId)
    .filter((record) => {
      if (record.imageStatus === '已弃用' || record.imageStatus === '需重拍') {
        return false
      }
      if (record.sourceNodeCode === 'CHANNEL_PRODUCT_LISTING' || record.imageType === '上架图') {
        return true
      }
      if (record.sourceNodeCode === 'SAMPLE_SHOOT_FIT') {
        return record.usageScopes.includes('款式档案') && record.imageStatus === '可用于款式档案'
      }
      if (record.imageType === '项目参考图') return true
      if (record.sourceNodeCode === 'STYLE_ARCHIVE_CREATE' || record.imageType === '款式档案图') return true
      return record.usageScopes.includes('款式档案')
    })
    .map(toImageViewModel)
}
