import { getStyleArchiveById, listStyleArchives } from '../pcs-style-archive-repository.ts'
import { listConfigDimensionChoices } from '../pcs-config-workspace-repository.ts'
import { ensurePcsRecordState } from '../pcs-record-runtime.ts'
import type { InspectionContext } from './quality-management-types.ts'
import type { InspectionScopeIdentityAliases } from './quality-management-rules.ts'

function positioningAliases(style: {productConfigRefs?: {productPositioning?: string[]}; productPosition?:string}): string[] {
  const options = listConfigDimensionChoices('productPositioning'), byId = new Map(options.map(option => [option.id, option]))
  const ids = style.productConfigRefs?.productPositioning || []
  const aliases = ids.flatMap(id => { const option = byId.get(id); return option ? [option.id, option.name_zh, ...(option.aliases || [])] : [id] })
  // A multi-selection display label joins names. It is not another category identity.
  if (style.productPosition && ids.length <= 1) aliases.push(style.productPosition)
  return [...new Set(aliases.filter(Boolean))]
}
/** All three garment entries use exact formal identity/positioning; ambiguous codes cannot pick an arbitrary style. */
export function resolveQualityStyleContext(input: {styleId?:string; styleCode?:string}): Pick<InspectionContext,'styleId'|'styleCode'|'styleCategory'|'styleCategoryAliases'> {
  const exact = input.styleId ? getStyleArchiveById(input.styleId) : null
  const matches = exact || !input.styleCode ? [] : listStyleArchives().filter(row => row.styleCode === input.styleCode)
  if (matches.length > 1) throw new Error('款号对应多个正式款式，请先澄清唯一款式身份。')
  if (exact && input.styleCode && exact.styleCode !== input.styleCode) throw new Error('款式编号与款号不一致，请先核对正式款式。')
  const style = exact || matches[0], aliases = style ? positioningAliases(style) : []
  return { styleId: style?.styleId || input.styleId, styleCode: style?.styleCode || input.styleCode, styleCategory: aliases[0], styleCategoryAliases: aliases }
}
/** Read-only catalog identity snapshot for publication checks; no seed is persisted. */
export function getQualityInspectionScopeIdentityAliases(): InspectionScopeIdentityAliases {
  const options = listConfigDimensionChoices('productPositioning'), styles = listStyleArchives()
  return {
    styleCategories: options.map(option => [option.id, option.name_zh, ...(option.aliases || [])]),
    styleIds: styles.map(style => [style.styleId, style.styleCode]),
    styles: styles.map(style => ({ styleId: style.styleId, styleCode: style.styleCode, styleCategories: style.productConfigRefs?.productPositioning?.length ? [...style.productConfigRefs.productPositioning] : style.productPosition ? [style.productPosition] : [] })),
  }
}
export async function prepareQualityInspectionScopeIdentityAliases(): Promise<InspectionScopeIdentityAliases> {
  if (typeof window !== 'undefined' || typeof indexedDB !== 'undefined') await ensurePcsRecordState(['higood-pcs-style-archive-store-v3','higood-pcs-config-workspace-store-v1'])
  return getQualityInspectionScopeIdentityAliases()
}
