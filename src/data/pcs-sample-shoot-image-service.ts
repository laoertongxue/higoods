import { getProjectById } from './pcs-project-repository.ts'
import type {
  PcsProjectImageAssetRecord,
  PcsProjectImageStatus,
  PcsProjectImageType,
  PcsProjectImageUsageScope,
} from './pcs-project-image-types.ts'
import {
  createProjectImageAssetRecords,
  getProjectImageAssetById,
  listProjectImageAssetsBySourceNode,
  removeProjectImageAsset,
  updateProjectImageAsset,
  upsertProjectImageAssets,
} from './pcs-project-image-repository.ts'

export type SampleShootImageFieldKey =
  | 'sampleFlatImageIds'
  | 'sampleTryOnImageIds'
  | 'sampleDetailImageIds'

export type SampleShootImageUsageAction =
  | 'listing'
  | 'styleArchive'
  | 'evaluateOnly'
  | 'retake'
  | 'discarded'

const SAMPLE_SHOOT_SOURCE_NODE_CODE = 'SAMPLE_SHOOT_FIT'

const SAMPLE_SHOOT_IMAGE_TYPE_MAP: Record<SampleShootImageFieldKey, PcsProjectImageType> = {
  sampleFlatImageIds: '样衣平铺图',
  sampleTryOnImageIds: '试穿图',
  sampleDetailImageIds: '细节图',
}

function ensureUsageScopes(scopes: PcsProjectImageUsageScope[], additions: PcsProjectImageUsageScope[]): PcsProjectImageUsageScope[] {
  const scopeSet = new Set<PcsProjectImageUsageScope>([...scopes, ...additions])
  return [...scopeSet]
}

function removeUsageScopes(scopes: PcsProjectImageUsageScope[], removals: PcsProjectImageUsageScope[]): PcsProjectImageUsageScope[] {
  const removalSet = new Set(removals)
  return scopes.filter((scope) => !removalSet.has(scope))
}

function getCurrentSortStart(projectId: string): number {
  return listProjectImageAssetsBySourceNode(projectId, SAMPLE_SHOOT_SOURCE_NODE_CODE).length
}

export function listSampleShootImageAssets(projectId: string): PcsProjectImageAssetRecord[] {
  return listProjectImageAssetsBySourceNode(projectId, SAMPLE_SHOOT_SOURCE_NODE_CODE)
}

export function appendSampleShootImages(
  projectId: string,
  fieldKey: SampleShootImageFieldKey,
  imageUrls: string[],
  operatorName = '当前用户',
  sourceRecordId = '',
): PcsProjectImageAssetRecord[] {
  const project = getProjectById(projectId)
  if (!project) {
    throw new Error('未找到对应商品项目，不能上传样衣拍摄图片。')
  }
  const normalizedUrls = imageUrls.map((item) => item.trim()).filter(Boolean)
  if (normalizedUrls.length === 0) return []

  const sortStart = getCurrentSortStart(project.projectId)
  const imageType = SAMPLE_SHOOT_IMAGE_TYPE_MAP[fieldKey]
  const records = createProjectImageAssetRecords(
    project,
    normalizedUrls.map((imageUrl, index) => ({
      imageUrl,
      imageName: `${imageType} ${sortStart + index + 1}`,
      imageType,
      sourceNodeCode: SAMPLE_SHOOT_SOURCE_NODE_CODE,
      sourceRecordId,
      sourceType: '样衣拍摄与试穿',
      usageScopes: ['样衣评估', '项目资料归档'],
      imageStatus: '待确认',
      mainFlag: false,
      sortNo: sortStart + index + 1,
    })),
    operatorName,
  )
  return upsertProjectImageAssets(records)
}

export function updateSampleShootImageUsage(
  projectId: string,
  imageId: string,
  action: SampleShootImageUsageAction,
  operatorName = '当前用户',
): PcsProjectImageAssetRecord {
  const image = getProjectImageAssetById(imageId)
  if (!image || image.projectId !== projectId || image.sourceNodeCode !== SAMPLE_SHOOT_SOURCE_NODE_CODE) {
    throw new Error('未找到对应样衣拍摄图片。')
  }

  let usageScopes = [...image.usageScopes]
  let imageStatus: PcsProjectImageStatus = image.imageStatus

  if (action === 'listing') {
    usageScopes = ensureUsageScopes(usageScopes, ['样衣评估', '项目资料归档', '商品上架'])
    imageStatus = '可用于上架'
  } else if (action === 'styleArchive') {
    usageScopes = ensureUsageScopes(usageScopes, ['样衣评估', '项目资料归档', '款式档案'])
    imageStatus = '可用于款式档案'
  } else if (action === 'evaluateOnly') {
    usageScopes = ensureUsageScopes(removeUsageScopes(usageScopes, ['商品上架', '款式档案']), ['样衣评估', '项目资料归档'])
    imageStatus = '待确认'
  } else if (action === 'retake') {
    usageScopes = ensureUsageScopes(removeUsageScopes(usageScopes, ['商品上架', '款式档案']), ['样衣评估', '项目资料归档'])
    imageStatus = '需重拍'
  } else if (action === 'discarded') {
    usageScopes = ensureUsageScopes(removeUsageScopes(usageScopes, ['商品上架', '款式档案']), ['项目资料归档'])
    imageStatus = '已弃用'
  }

  const updated = updateProjectImageAsset(imageId, {
    usageScopes,
    imageStatus,
    updatedAt: new Date().toISOString(),
    updatedBy: operatorName,
  })

  if (!updated) {
    throw new Error('更新样衣拍摄图片用途失败。')
  }
  return updated
}

export function removeSampleShootImage(projectId: string, imageId: string): void {
  const image = getProjectImageAssetById(imageId)
  if (!image || image.projectId !== projectId || image.sourceNodeCode !== SAMPLE_SHOOT_SOURCE_NODE_CODE) {
    throw new Error('未找到待删除的样衣拍摄图片。')
  }
  removeProjectImageAsset(imageId)
}

export function listSampleShootCandidateImages(projectId: string, scope: '商品上架' | '款式档案'): PcsProjectImageAssetRecord[] {
  const expectedStatus = scope === '商品上架' ? '可用于上架' : '可用于款式档案'
  return listSampleShootImageAssets(projectId).filter(
    (record) => record.usageScopes.includes(scope) && record.imageStatus === expectedStatus,
  )
}
