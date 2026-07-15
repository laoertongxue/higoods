import assert from 'node:assert/strict'
import {
  buildFactoryLines,
  summarizeDyeStatus,
  summarizePrintStatus,
  summarizeThreeStageStatus,
} from '../src/pages/process-factory/cutting/production-order-overview-model.ts'
import {
  buildProductionOrderOverviewRows,
  type ProductionOrderOverviewSources,
} from '../src/pages/process-factory/cutting/production-order-overview-projection.ts'

assert.equal(summarizeThreeStageStatus([], false), '—')
assert.equal(summarizeThreeStageStatus(['NOT_STARTED', 'NOT_STARTED'], true), '未开始')
assert.equal(summarizeThreeStageStatus(['DONE', 'NOT_STARTED'], true), '进行中')
assert.equal(summarizeThreeStageStatus(['DONE', 'DONE'], true), '已完成')
assert.equal(summarizePrintStatus(false, []), '无需印花')
assert.equal(summarizePrintStatus(true, ['PRINTING']), '进行中')
assert.equal(summarizeDyeStatus(false, []), '无需染色')
assert.equal(summarizeDyeStatus(true, ['DYEING']), '进行中')
assert.deepEqual(
  buildFactoryLines([
    {
      factoryId: 'F1',
      factoryName: '泗水中央裁床厂',
      factoryTypeLabel: '中央工厂',
      accepted: true,
      requiredQty: 100,
      pickedQty: 40,
    },
  ]),
  [
    {
      factoryId: 'F1',
      factoryName: '泗水中央裁床厂',
      factoryTypeLabel: '中央工厂',
      acceptanceLabel: '已接单',
      pickupLabel: '部分领取',
    },
  ],
)

const fixtureSources: ProductionOrderOverviewSources = {
  productionOrders: [
    {
      productionOrderId: 'PO-002',
      productionOrderNo: 'PO-002',
      demandId: 'DEM-002',
      createdAt: '2026-07-15 10:00:00',
      hasCuttingRequirement: true,
      taskBreakdownSummary: { isBrokenDown: true },
      demandSnapshot: {
        spuCode: 'SPU-02',
        spuName: '测试连衣裙',
        buyerName: '陈佳',
        merchandiserName: '林晓雯',
      },
      techPackSnapshot: {
        styleCode: 'ST-02',
        styleName: '测试连衣裙',
        imageSnapshot: { styleImages: ['/dress-sample-1.jpg'] },
        processEntries: [{ processCode: 'PRINT' }, { processCode: 'CUTTING' }],
      },
    },
  ],
  productionDemands: [{ demandId: 'DEM-002', createdAt: '2026-07-14 16:00:00' }],
  printingOrders: [{ productionOrderIds: ['PO-002'], status: 'PRINTING' }],
  dyeingOrders: [],
  materialPrepRows: [
    {
      productionOrderId: 'PO-002',
      totalRequiredQty: 100,
      totalConfirmedPrepQty: 50,
    },
  ],
  cuttingProgressRows: [
    {
      productionOrderId: 'PO-002',
      markerStatus: '未完成',
      spreadingStatus: '未开始',
      cuttingStatus: '裁剪未完成',
      inboundStatus: '未入仓',
      shippingStatus: '未发货',
      receiverFactoryNames: ['土豆工厂'],
    },
  ],
  factoryFacts: [
    {
      productionOrderId: 'PO-002',
      factoryId: 'F1',
      factoryName: '泗水中央裁床厂',
      factoryTypeLabel: '中央工厂',
      accepted: true,
      requiredQty: 100,
      pickedQty: 40,
    },
  ],
}

const rows = buildProductionOrderOverviewRows(fixtureSources)
assert.equal(rows.length, 1)
assert.equal(rows[0].productionOrderNo, 'PO-002')
assert.equal(rows[0].demandCreatedAt, '2026-07-14 16:00:00')
assert.equal(rows[0].styleImageUrl, '/dress-sample-1.jpg')
assert.equal(rows[0].buyerName, '陈佳')
assert.equal(rows[0].merchandiserName, '林晓雯')
assert.equal(rows[0].printingStatus, '进行中')
assert.equal(rows[0].dyeingStatus, '无需染色')
assert.equal(rows[0].materialPrepStatus, '部分配料')
assert.equal(rows[0].factoryLines[0].pickupLabel, '部分领取')
assert.equal('riskTags' in rows[0], false)
assert.equal('blocker' in rows[0], false)
assert.equal('exceptionFacts' in rows[0], false)

console.log('cutting production order overview model checks passed')
