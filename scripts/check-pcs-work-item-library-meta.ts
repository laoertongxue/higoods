import assert from 'node:assert/strict'

import { listPcsWorkItemLibraryMetas } from '../src/data/pcs-work-item-library-meta.ts'

const metas = listPcsWorkItemLibraryMetas()
assert.equal(metas.length, 21, '工作项目录元数据必须覆盖 21 个正式工作项')

metas.forEach((meta) => {
  assert.equal(typeof meta.fieldCount, 'number', `${meta.workItemTypeCode} 缺少 fieldCount`)
  assert.equal(typeof meta.statusCount, 'number', `${meta.workItemTypeCode} 缺少 statusCount`)
  assert.equal(typeof meta.operationCount, 'number', `${meta.workItemTypeCode} 缺少 operationCount`)
  assert.ok(meta.runtimeCarrierMode, `${meta.workItemTypeCode} 缺少 runtimeCarrierMode`)
  assert.equal(typeof meta.hasStandaloneInstanceList, 'boolean', `${meta.workItemTypeCode} 缺少 hasStandaloneInstanceList`)
})

console.log('check-pcs-work-item-library-meta.ts PASS')
console.log(
  `已检查工作项：${metas
    .map((item) => `${item.workItemTypeCode}(${item.fieldCount}/${item.statusCount}/${item.operationCount})`)
    .join('，')}`,
)
