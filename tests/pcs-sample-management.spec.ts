import assert from 'node:assert/strict'

import {
  PCS_SAMPLE_TYPES,
  PCS_SAMPLE_TYPE_LABELS,
  PCS_SAMPLE_LOCATION_TYPES,
  PCS_SAMPLE_LOCATION_TYPE_LABELS,
  PCS_SAMPLE_LOCATIONS,
} from '../src/data/pcs-sample-location-master.ts'
import {
  PCS_SAMPLE_RECORDS,
  convertPcsSampleType,
  listPcsSampleTypeConversionLogs,
  canCompletePcsSampleTagging,
  buildPcsSampleTagCode,
} from '../src/data/pcs-sample-management.ts'

assert.deepEqual([...PCS_SAMPLE_TYPES], ['marketing', 'production'], '样品类型仅营销样品、生产样品两类（SAMP-001）')
assert.equal(PCS_SAMPLE_TYPE_LABELS.marketing, '营销样品', '营销样品文案（SAMP-001）')
assert.equal(PCS_SAMPLE_TYPE_LABELS.production, '生产样品', '生产样品文案（SAMP-001）')
assert.ok(
  ![...PCS_SAMPLE_TYPES, ...Object.values(PCS_SAMPLE_TYPE_LABELS)].some((value) => String(value).includes('测款样品')),
  '无「测款样品」类型（SAMP-001）',
)

assert.ok(PCS_SAMPLE_RECORDS.every((item) => PCS_SAMPLE_TYPES.includes(item.sampleType)), '种子均带合法类型（SAMP-013）')
assert.ok(
  PCS_SAMPLE_RECORDS.some((item) => item.sampleType === 'marketing') &&
    PCS_SAMPLE_RECORDS.some((item) => item.sampleType === 'production'),
  '双类型并存（SAMP-013）',
)

const marketing = PCS_SAMPLE_RECORDS.find((item) => item.sampleType === 'marketing')!
const toProduction = convertPcsSampleType(marketing.sampleId, 'production', '测试', '营销转生产')
assert.equal(toProduction.ok, true, '营销→生产可互转（SAMP-002）')
assert.equal(toProduction.record!.sampleType, 'production', '类型已更新（SAMP-002）')
const back = convertPcsSampleType(marketing.sampleId, 'marketing', '测试', '生产转回营销')
assert.equal(back.ok, true, '生产→营销可互转（SAMP-002）')

const logs = listPcsSampleTypeConversionLogs(marketing.sampleId)
assert.ok(logs.length >= 2, '互转记录追加（SAMP-003）')
assert.ok(logs[0].actor && logs[0].convertedAt && logs[0].reason, '记录操作人、时间、原因（SAMP-003）')

assert.equal(PCS_SAMPLE_LOCATION_TYPES.length, 5, '位置类型五类（SAMP-004）')
assert.deepEqual(
  [...PCS_SAMPLE_LOCATION_TYPES].sort(),
  ['department', 'factory', 'home-studio', 'live-room', 'warehouse'],
  '位置类型枚举（SAMP-004）',
)
assert.equal(PCS_SAMPLE_LOCATION_TYPE_LABELS['live-room'], '直播间', '直播间（SAMP-004）')
assert.equal(PCS_SAMPLE_LOCATION_TYPE_LABELS['home-studio'], '家播', '家播（SAMP-004）')
assert.equal(PCS_SAMPLE_LOCATION_TYPE_LABELS.factory, '工厂', '工厂（SAMP-004）')
assert.equal(PCS_SAMPLE_LOCATION_TYPE_LABELS.department, '部门', '部门（SAMP-004）')
assert.equal(PCS_SAMPLE_LOCATION_TYPE_LABELS.warehouse, '仓库', '仓库（SAMP-004）')

const homeStudios = PCS_SAMPLE_LOCATIONS.filter((item) => item.locationType === 'home-studio')
assert.ok(homeStudios.length > 0 && homeStudios.every((item) => item.ownerName), '家播独立类型且语义为主播/达人（SAMP-005）')
assert.ok(
  !PCS_SAMPLE_LOCATIONS.some((item) => item.locationType.includes('photo') || item.locationName.includes('摄影')),
  '不存在摄影位位置类型（SAMP-006）',
)

const withTag = PCS_SAMPLE_RECORDS.find((item) => item.taggedAt)
assert.ok(withTag, '存在已贴码样例（SAMP-013）')
assert.equal(withTag!.sampleCode, withTag!.skuCode, '一 SKU 一码，码值=SKU 编码（SAMP-008）')
assert.equal(buildPcsSampleTagCode(withTag!.skuCode), withTag!.skuCode, '打标码生成=SKU 编码（SAMP-008）')
assert.equal(canCompletePcsSampleTagging(withTag!), true, '已贴码且码值一致可完成（SAMP-009）')

const untagged: typeof withTag = { ...withTag!, taggedAt: null, sampleCode: 'OTHER', skuCode: 'SKU-X' }
assert.equal(canCompletePcsSampleTagging(untagged), false, '未贴码/码值不一致阻断（SAMP-009）')

const source = JSON.stringify(PCS_SAMPLE_RECORDS) + JSON.stringify(PCS_SAMPLE_LOCATIONS)
assert.ok(!source.includes('摄影棚'), '无摄影棚文案残留（SAMP-006）')

console.log('pcs-sample-management.spec.ts PASS')
