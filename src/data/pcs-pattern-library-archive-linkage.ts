import { listPatternAssets } from './pcs-pattern-library.ts'
import type { PatternAssetRecord } from './pcs-pattern-library.ts'
import type { TechnicalDataVersionRecord } from './pcs-technical-data-version-types.ts'

export function listPatternAssetsByProjectId(projectId: string): PatternAssetRecord[] {
  return listPatternAssets().filter((asset) => asset.source_project_id === projectId)
}

export function listPatternAssetsByTechPackVersionId(technicalVersionId: string): PatternAssetRecord[] {
  return listPatternAssets().filter((asset) => asset.source_tech_pack_version_id === technicalVersionId)
}

export function listPatternAssetsForTechPackVersions(versions: TechnicalDataVersionRecord[]): PatternAssetRecord[] {
  const assetIds = new Set<string>()
  const versionIds = new Set<string>()
  versions.forEach((version) => {
    ;(version.linkedPatternAssetIds ?? []).forEach((assetId) => assetIds.add(assetId))
    if (version.technicalVersionId) versionIds.add(version.technicalVersionId)
  })
  const map = new Map<string, PatternAssetRecord>()
  listPatternAssets().forEach((asset) => {
    if (assetIds.has(asset.id) || (asset.source_tech_pack_version_id && versionIds.has(asset.source_tech_pack_version_id))) {
      map.set(asset.id, asset)
    }
  })
  return Array.from(map.values())
}
