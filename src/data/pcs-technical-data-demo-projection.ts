import type { TechnicalDataVersionStoreSnapshot } from './pcs-technical-data-version-types.ts'
import { getPcsDurableFileReference, getPcsDeletedRecordIds } from './pcs-record-runtime.ts'

// Exact unedited static snapshots observed on 2026-10-06. A different record OR content stays user-owned.
// The dual checksum is an identity fingerprint for demo data, not a security primitive.
const LEGACY_DEMO_SIGNATURES: Record<string, readonly [string, string]> = {
  'tdv_demand_SPU_2024_001': ['3286:d8def0fe:ddb9be48', '10647:81bbffdf:70f97543'],
  'tdv_demand_SPU_2024_003': ['3301:8c4fac32:f926f818', '8490:3b950f5b:6167b3f3'],
  'tdv_demand_SPU_2024_004': ['3298:70122494:5a8b6298', '10280:f39537:9870d37f'],
  'tdv_demand_SPU_2024_005': ['3301:cd79a345:df62f789', '9404:6417d932:26a421bc'],
  'tdv_demand_SPU_2024_008': ['3298:9b389972:d88f9b52', '8500:75b1f8aa:e900e03c'],
  'tdv_demand_SPU_2024_009': ['3298:e7db40de:3ad10b30', '9414:c920572:76c9957c'],
  'tdv_demand_SPU_2024_010': ['3298:1df56b2c:8ab01904', '9185:737495fb:6ad84a55'],
  'tdv_demand_SPU_2024_011': ['3303:ff6bfc33:70b55f93', '5062:5b6471a8:da93b438'],
  'tdv_demand_SPU_2024_012': ['3296:ce97f6c3:d31e9be1', '5062:6c93b85d:a12aa57b'],
  'tdv_demand_SPU_2024_013': ['3297:92dc3e49:fdb1e0c9', '8930:5ed88a1a:c634c1bc'],
  'tdv_demand_SPU_2024_014': ['3297:3afdf949:d8d592bb', '9442:35f78468:1009311c'],
  'tdv_demand_SPU_2024_015': ['3299:be06cf5c:133bf406', '9436:c0692482:947cc37c'],
  'tdv_demand_SPU_2024_016': ['3299:3465062a:4cb33c8', '8976:f010ef58:e4d3da9c'],
  'tdv_demand_SPU_2024_017': ['3300:61d622d3:a5222b3', '8934:295b340a:f18629bc'],
  'tdv_demand_SPU_DRESS_083': ['3293:f309eaa4:bda12340', '8203:46ccab1f:e47deeed'],
  'tdv_demand_SPU_HOODIE_082': ['3296:209e3db1:9d1f11b3', '8542:8f0c1004:d611365c'],
  'tdv_demand_SPU_JACKET_085': ['3294:e33668bc:8ba352d4', '8532:db467c8:3842745c'],
  'tdv_demand_SPU_SHIRT_086': ['3292:66c2e2b7:87dc477d', '8496:47bc6958:4ae2479c'],
  'tdv_demand_SPU_TEE_084': ['3286:241a3fec:80d085f6', '7646:6fbd187e:507e69d6'],
  'tdv_demand_SPU_TSHIRT_081': ['3300:4352c554:6ab1b1b6', '13038:29e1bad5:b27e4db7'],
  'tdv_seed_project_018_base': ['3446:7d6e9fcb:90cdac9b', '13495:5a8bf296:1139a368'],
  'tdv_seed_project_018_review_skip_demo': ['3484:f60780:7c67cc70', '13532:641dc74a:fd9895b0'],
}

// Exact content fingerprints of this release before the detail-route and material-reference corrections.
// Maintenance of people or timestamps does not edit technical content and remains intact.
const RELEASE_DEMO_CONTENT_SIGNATURES: Record<string, readonly string[]> = {
  'tdv_demand_SPU_QC_001': ['57823:8cd575d1:b215f2f1', '57685:9f6a5767:28ed7591'],
  'tdv_demand_SPU_QC_002': ['57823:593bc18b:878c76d1', '57685:f918c0af:a6f60bd1'],
  'tdv_demand_SPU_QC_003': ['57823:d706eda1:13784331', '57685:75afd89f:b682391'],
  'tdv_seed_project_018_review_skip_demo': ['61305:bb757e8e:f2522810', '61252:5400e6ac:8f37e4c6'],
  'tdv_demand_ASYSA26060310': ['66318:1978653b:7bd1c6d3', '66156:96a9670f:4f0ce53'],
  'tdv_seed_project_018_base': ['60141:f9edc963:3382ee7d', '60184:64840163:7e4df8b'],
  'tdv_demand_SPU_2024_001': ['44992:6df7fde4:b595ed8e', '44838:4355715c:c34c80ce'],
  'tdv_demand_SPU_SHIRT_086': ['41714:1b44ae1a:8fc690ba', '41552:bbd213c8:f053a35a'],
  'tdv_demand_SPU_JACKET_085': ['41882:6f68d5bd:d0e1ec9d', '41712:fc987d23:8608dabd'],
  'tdv_demand_SPU_TEE_084': ['41298:54e45f28:6992fed4', '41152:713ca964:e6925ed4'],
  'tdv_demand_SPU_DRESS_083': ['41257:3c9b486f:157f134d', '41095:569d814b:a6d4774d'],
  'tdv_demand_SPU_HOODIE_082': ['41897:de9776f:b7217d47', '41727:14101abb:8a4c7847'],
  'tdv_demand_SPU_TSHIRT_081': ['48731:1e074f94:28a4ef76', '48561:32cb85d4:480687b6'],
  'tdv_demand_SPU_2024_017': ['41516:a63fddbc:2d3acc38', '41362:a888319e:a822b198'],
  'tdv_demand_SPU_2024_015': ['42120:2c486a4d:8da14381', '41966:305384ef:7a874921'],
  'tdv_demand_SPU_2024_008': ['41606:8155b0ab:40e02a5d', '41452:719b6e7b:505cd61d'],
  'tdv_demand_SPU_2024_014': ['41531:48215861:73859fa1', '41377:7aea22a3:5b49bcc1'],
  'tdv_demand_SPU_2024_005': ['42570:2b23bc5:d46de9bb', '42416:82a50d3f:e0b5085b'],
  'tdv_demand_SPU_2024_013': ['41516:ac722218:ba53934', '41362:6a4bc252:b515fa14'],
  'tdv_demand_SPU_2024_004': ['47592:5d87ae5a:ab466cde', '47509:ebcb5784:f4226d48'],
  'tdv_demand_SPU_2024_010': ['41652:5bc867b7:66621d4f', '41498:fc8a57fb:6ecfd5cf'],
  'tdv_demand_SPU_2024_012': ['41531:e5eae265:fd29bb71', '41377:d53d2cd:e65795b1'],
  'tdv_demand_SPU_2024_003': ['41594:fb155a4e:ee1a6250', '41440:22f79bde:f62f13d0'],
  'tdv_demand_SPU_2024_016': ['41591:e3bed7bb:8557ccab', '41437:8d8cdc21:f938a4b'],
  'tdv_demand_SPU_2024_011': ['41531:cbb8d8fe:7ba8e8e4', '41377:7afc3d8a:c07a38e4'],
  'tdv_demand_SPU_2024_009': ['42703:362dc088:e96467d0', '42549:775bb368:3b26890'],
}

function demoSignature(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    // Hydration replaces a saved file reference with its session preview URL.
    // Compare the exact registered file identity, never ignore changed images.
    if (typeof item === 'string' && item.startsWith('blob:')) {
      try { return getPcsDurableFileReference(item) } catch { return item }
    }
    return Array.isArray(item) ? item.map(canonical) : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical((item as Record<string, unknown>)[key])])) : item
  }
  const json = JSON.stringify(canonical(value))
  let first = 2166136261, second = 5381
  for (let index = 0; index < json.length; index++) { const code = json.charCodeAt(index); first = Math.imul(first ^ code, 16777619) >>> 0; second = (Math.imul(second, 33) ^ code) >>> 0 }
  return `${json.length}:${first.toString(16)}:${second.toString(16)}`
}

/** Read-only release projection: no IndexedDB writes, no old-key deletion, no user-edit replacement. */
export function projectUneditedLegacyTechnicalDemo(source: TechnicalDataVersionStoreSnapshot, current: TechnicalDataVersionStoreSnapshot): TechnicalDataVersionStoreSnapshot {
  const deleted = getPcsDeletedRecordIds('higood-pcs-technical-data-version-store-v5')
  const mayAdd = (id: string) => !deleted.has(`higood-pcs-technical-data-version-store-v5/records/${encodeURIComponent(id)}`)
  const oldContents = new Map(source.contents.map(content => [content.technicalVersionId, content]))
  const newRecords = new Map(current.records.map(record => [record.technicalVersionId, record]))
  const newContents = new Map(current.contents.map(content => [content.technicalVersionId, content]))
  const correctedReleaseContents = new Set(source.contents.filter(content => RELEASE_DEMO_CONTENT_SIGNATURES[content.technicalVersionId]?.includes(demoSignature(content)) && newContents.has(content.technicalVersionId)).map(content => content.technicalVersionId))
  const upgraded = new Set<string>()
  const records = source.records.map(record => {
    const signatures = LEGACY_DEMO_SIGNATURES[record.technicalVersionId]
    const replacement = newRecords.get(record.technicalVersionId), content = oldContents.get(record.technicalVersionId)
    if (!signatures || !replacement || !content || demoSignature(record) !== signatures[0] || demoSignature(content) !== signatures[1]) return record
    upgraded.add(record.technicalVersionId)
    return { ...replacement, createdFromTaskType: record.createdFromTaskType, createdFromTaskId: record.createdFromTaskId, createdFromTaskCode: record.createdFromTaskCode, sourceProjectId: record.sourceProjectId, sourceProjectCode: record.sourceProjectCode, sourceProjectName: record.sourceProjectName, sourceProjectNodeId: record.sourceProjectNodeId, primaryPlateTaskId: record.primaryPlateTaskId, primaryPlateTaskCode: record.primaryPlateTaskCode, primaryPlateTaskVersion: record.primaryPlateTaskVersion, changeScope: record.changeScope, changeSummary: record.changeSummary }
  })
  const existingIds = new Set(records.map(record => record.technicalVersionId))
  // Only the complete observed old demo may gain its four newly supplied examples. A deleted/missing old row is not resurrected.
  const extendCompleteOldDemo = upgraded.size === Object.keys(LEGACY_DEMO_SIGNATURES).length
  return { ...source, records: [...records, ...(extendCompleteOldDemo ? current.records.filter(record => !existingIds.has(record.technicalVersionId) && mayAdd(record.technicalVersionId)) : [])], contents: [...source.contents.map(content => upgraded.has(content.technicalVersionId) || correctedReleaseContents.has(content.technicalVersionId) ? newContents.get(content.technicalVersionId)! : content), ...(extendCompleteOldDemo ? current.contents.filter(content => !existingIds.has(content.technicalVersionId) && mayAdd(content.technicalVersionId)) : [])] }
}
