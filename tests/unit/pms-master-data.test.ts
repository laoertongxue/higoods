import assert from 'node:assert/strict'
import test from 'node:test'
import { createPmsSupplier, listPmsSuppliers, type PmsSupplierInput } from '../../src/data/pms/suppliers.ts'
import { computePmsSupplyConversion, convertPmsSupplyQty, listPmsSupplyArchives, updatePmsSupplyArchive } from '../../src/data/pms/supplier-supply-archives.ts'
import { listPmsLogs, PMS_BUYER_ACTOR } from '../../src/data/pms/runtime.ts'

test('IndexedDB 不可用时供应商新增不发布记录或日志', async () => {
  const input: PmsSupplierInput = { supplierName:'保存失败检查',shortName:'失败检查',category:'面料供应商',country:'中国',city:'广东广州',contactName:'测试人',contactPhone:'13800000001',email:'',level:'C级',paymentMethod:'月结',currency:'RMB',defaultDeliveryMethod:'发国内仓',leadTimeDays:10,address:'',remark:'' }
  const before = structuredClone(listPmsSuppliers())
  const logs = listPmsLogs('supplier').length
  await assert.rejects(createPmsSupplier(input,PMS_BUYER_ACTOR,'草稿','supplier-save-failure'), /IndexedDB|存储|数据库/)
  assert.deepEqual(listPmsSuppliers(), before)
  assert.equal(listPmsLogs('supplier').length, logs)
})

test('供货包装换算读取不写数据，保存失败不增加快照版本', async () => {
  const archive = listPmsSupplyArchives()[0]
  assert.equal(computePmsSupplyConversion(archive,250).packageCount,3)
  assert.equal(convertPmsSupplyQty(archive,2,'box','base'),800)
  const before = structuredClone(archive)
  const logs = listPmsLogs('supply-archive').length
  await assert.rejects(updatePmsSupplyArchive(archive.archiveId,{boxQty:5},PMS_BUYER_ACTOR,'archive-save-failure'), /IndexedDB|存储|数据库/)
  assert.deepEqual(archive,before)
  assert.equal(listPmsLogs('supply-archive').length,logs)
})
