import assert from 'node:assert/strict'
import {
  getStandardProjectWorkItemIdentityById,
  listStandardProjectWorkItemIdentities,
  resolveLegacyProjectWorkItemTypeCode,
} from '../src/data/pcs-work-item-configs.ts'

const identities = listStandardProjectWorkItemIdentities()

assert.equal(identities.length, 21, '商品项目主线应固定为 21 个标准工作项')

const ids = identities.map((item) => item.workItemId)
const codes = identities.map((item) => item.workItemTypeCode)
const names = identities.map((item) => item.workItemTypeName)

assert.equal(new Set(ids).size, ids.length, '正式编号必须一号一义')
assert.equal(new Set(codes).size, codes.length, '正式编码必须一码一义')
assert.equal(new Set(names).size, names.length, '正式名称必须一名一义')

const wi001 = getStandardProjectWorkItemIdentityById('WI-001')
assert.ok(wi001, '应存在 WI-001')
assert.equal(wi001?.workItemTypeCode, 'PROJECT_INIT', 'WI-001 只能代表商品项目立项')
assert.equal(wi001?.workItemTypeName, '商品项目立项', 'WI-001 名称应稳定')
assert.notEqual(wi001?.workItemTypeName, '制版准备', 'WI-001 不得再表示制版准备')

const wi002 = getStandardProjectWorkItemIdentityById('WI-002')
const wi003 = getStandardProjectWorkItemIdentityById('WI-003')
assert.equal(wi002?.workItemTypeCode, 'SAMPLE_ACQUIRE', 'WI-002 应对应样衣获取')
assert.equal(wi003?.workItemTypeCode, 'SAMPLE_INBOUND_CHECK', 'WI-003 应对应到样入库与核对')
assert.notEqual(wi002?.workItemTypeCode, wi003?.workItemTypeCode, 'WI-002 与 WI-003 不得再重复映射')

assert.equal(
  resolveLegacyProjectWorkItemTypeCode('样衣留存与库存'),
  'SAMPLE_RETAIN_REVIEW',
  '旧名称“样衣留存与库存”应迁移到样衣留存评估',
)
assert.equal(
  resolveLegacyProjectWorkItemTypeCode('未知旧名称'),
  null,
  '未收录旧名称不得被自动猜测映射',
)

console.log('pcs-project-work-item-identity.spec.ts PASS')
