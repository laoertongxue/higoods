import { getPatternAssetById, listPatternAssets, listPatternVersions } from './pcs-pattern-library.ts'
import { canPatternBeReferenced } from '../utils/pcs-pattern-library-services.ts'
import { getPcsDurableFileReference } from './pcs-record-runtime.ts'

/** Material processing references the existing pattern library; it never copies or creates a second pattern. */
export function listMaterialPatternChoices() {
  return listPatternAssets().filter(pattern => canPatternBeReferenced(pattern).allowed)
}

export function listMaterialPatternVersionChoices(patternId: string) {
  return patternId ? listPatternVersions(patternId) : []
}

export function getMaterialPatternReference(patternId: string, versionId?: string) {
  const pattern = getPatternAssetById(patternId)
  if (!pattern) throw new Error('请从花型库选择花型。')
  const available = canPatternBeReferenced(pattern)
  if (!available.allowed) throw new Error(available.reason || '该花型当前不可新增引用。')
  const version = listPatternVersions(patternId).find(item => item.id === (versionId || pattern.currentVersion?.id))
  if (!version) throw new Error('所选花型版本不属于该花型，请重新选择。')
  // Use static images and known saved files; ignore generated or unattached legacy previews.
  const preview = [version.preview_url, version.thumbnail_url].find(url => {
    if (!url) return false
    try { return Boolean(getPcsDurableFileReference(url)) } catch { return false }
  }) || ''
  return { patternId: pattern.id, patternCode: pattern.pattern_code, patternVersionId: version.id,
    patternImageUrl: preview, patternName: pattern.pattern_name, versionLabel: version.version_no }
}
