/**
 * Static records first shipped by this demo version. Legacy whole-collection
 * snapshots predate these IDs: their absence is not a user deletion. Existing
 * record overlays and explicit tombstones still take precedence.
 */
export const PCS_STATIC_DEMO_VERSION = 'pcs-r1-2026-10-05'

const introducedIds = new Set<string>()
const register = (key: string, group: string, ids: readonly string[]) => {
  ids.forEach(id => introducedIds.add(`${key}/${group}/${encodeURIComponent(id)}`))
}

register('higood-pcs-style-archive-store-v3', 'records', [
  'style_r1_wms_tee', 'style_r1_physical_set', 'style_r1_virtual_bundle',
])
register('higood-pcs-sku-archive-store-v1', 'records', [
  'sku_r1_wms_tee_black_s', 'sku_r1_tee_white_m', 'sku_r1_physical_set_m', 'sku_r1_virtual_bundle_m',
])

const materialKey = 'higood-pcs-material-archive-store-v2'
const roots = ['MAT-FB-00000001', 'MAT-YN-00000001', 'MAT-YN-00000002', 'MAT-CS-00000001', 'MAT-CS-00000002', 'MAT-EP-00000001', 'MAT-EP-00000002'].map(code => `material-r1-${code}`)
const bases = roots.flatMap((id, index) => index === 0 ? [`${id}-B01`] : [`${id}-B01`, `${id}-B02`])
const phases = ['dye', 'print', 'double', 'penetration', 'embroidery', 'heat']
const processed = phases.map(phase => `material-r1-process-${phase}`)
register(materialKey, 'records', roots)
register(materialKey, 'skuRecords', [...bases, ...processed])
register(materialKey, 'processDefinitions', processed.map(id => `process-${id}`))
register(materialKey, 'costVersions', [...bases.map(id => `legacy-standard-${id}`), ...processed.map(id => `cost-${id}`)])
register(materialKey, 'assets', phases.map(phase => `material-r1-execution-${phase}`))

export function isPcsNewStaticRecord(id: string): boolean {
  if (introducedIds.has(id)) return true
  // This R1 fixture was introduced after older whole-catalog snapshots. Keep its
  // two listings, three mappings, prices and field baselines available there too.
  if (!id.startsWith('higood-pcs-channel-catalog-v1/')) return false
  return /\/(listings|variants|fieldBaselines)\/channel-listing-wms-demo-[12](?:$|-|%3A)/.test(id)
    || /\/prices\/ST-00[17]%3Asku_r1_wms_tee_black_s%3A/.test(id)
}
