import { getTechnicalDataVersionStoreSnapshot } from './pcs-technical-data-version-repository.ts'
import { listEngineeringBomVersions } from './pcs-engineering-bom-repository.ts'

export interface MaterialTechnicalUsage {
  referenceId: string; materialSkuId: string; source: 'TECHNICAL_VERSION'|'ENGINEERING_BOM'
  ownerId: string; ownerCode: string; styleCode: string; styleName: string
  version: string; status: string; quantity: number; unit: string; path?: string
}
/** Read actual BOM references in one batch; counters and historical root-only
 * demonstration links cannot claim that a particular SKU was adopted. */
export function listMaterialTechnicalUsages(skuIds: readonly string[]): MaterialTechnicalUsage[] {
  const selected = new Set(skuIds), source = getTechnicalDataVersionStoreSnapshot(), content = new Map(source.contents.map(item => [item.technicalVersionId, item]))
  const result: MaterialTechnicalUsage[] = []
  for (const version of source.records) for (const line of content.get(version.technicalVersionId)?.bomItems || []) {
    if (!line.materialSkuId || !selected.has(line.materialSkuId)) continue
    result.push({ referenceId: `${version.technicalVersionId}:${line.id}`, materialSkuId: line.materialSkuId, source: 'TECHNICAL_VERSION', ownerId: version.technicalVersionId, ownerCode: version.technicalVersionCode, styleCode: version.styleCode, styleName: version.styleName,
      version: version.versionLabel, status: version.versionStatus, quantity: line.unitConsumption, unit: line.unit || '', path: `/pcs/technical-data/tech-packs/${version.technicalVersionId}` })
  }
  for (const version of listEngineeringBomVersions()) for (const [index, line] of version.materialLines.entries()) {
    if (!selected.has(line.materialSkuId)) continue
    result.push({ referenceId: `${version.bomDraftVersionId}:${line.bomItemId || index}`, materialSkuId: line.materialSkuId, source: 'ENGINEERING_BOM', ownerId: version.ownerId, ownerCode: version.ownerCode, styleCode: version.styleCode, styleName: version.styleName,
      version: version.versionCode, status: version.versionStatus, quantity: line.usage, unit: line.usageUnit })
  }
  return result
}
