import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getPmsMaterial,
  PMS_MATERIAL_SPECIAL_ATTRIBUTES,
  updatePmsMaterialComplianceInfo,
  updatePmsMaterialProcurementInfo,
} from '../../src/data/pms/materials.ts'
import { getPmsBomDetail, updatePmsBomDetail, type PmsBomOption } from '../../src/data/pms/bom-detail.ts'
import { getPmsSubjectOperation, listPmsSubjectOperationDataGaps, updatePmsSubjectOperation } from '../../src/data/pms/subject-operations.ts'
import { listPmsLogs, PMS_BUYER_ACTOR, PMS_FINANCE_ACTOR, PmsDomainError } from '../../src/data/pms/runtime.ts'

test('物料申报扩展字段保存回显，26 项特殊属性按数组保存', () => {
  assert.equal(PMS_MATERIAL_SPECIAL_ATTRIBUTES.length, 26)
  updatePmsMaterialComplianceInfo(
    'ACC-2026-0001',
    {
      declaration: {
        brandType: '自有品牌',
        brandName: 'HiGood',
        brandEnglishName: 'HiGood Apparel',
        productModel: 'HG-ZIP-05',
        otherDeclarationElements: '品牌类型：自有品牌；出口享惠情况：不享惠',
        specialAttributes: [...PMS_MATERIAL_SPECIAL_ATTRIBUTES],
      },
    },
    PMS_BUYER_ACTOR,
  )
  const declaration = getPmsMaterial('ACC-2026-0001')?.declarationInfo
  assert.equal(declaration?.brandType, '自有品牌')
  assert.equal(declaration?.brandName, 'HiGood')
  assert.equal(declaration?.brandEnglishName, 'HiGood Apparel')
  assert.equal(declaration?.productModel, 'HG-ZIP-05')
  assert.equal(declaration?.otherDeclarationElements, '品牌类型：自有品牌；出口享惠情况：不享惠')
  assert.equal(declaration?.specialAttributes.length, 26)
  assert.ok(declaration?.specialAttributes.includes('危险品'))

  updatePmsMaterialProcurementInfo('ACC-2026-0001', { needInspection: false, inventoryUnit: '盒', conversionRate: '1箱=20盒' }, PMS_BUYER_ACTOR)
  const material = getPmsMaterial('ACC-2026-0001')
  assert.equal(material?.needInspection, false)
  assert.equal(material?.inventoryUnit, '盒')
  assert.equal(material?.conversionRate, '1箱=20盒')
  assert.ok(listPmsLogs('material', 'ACC-2026-0001').length >= 2)

  assert.throws(() => updatePmsMaterialComplianceInfo('ACC-2026-0001', { declaration: { brandType: '贴牌' } }, PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => updatePmsMaterialComplianceInfo('ACC-2026-0001', { declaration: { specialAttributes: ['不存在的属性'] } }, PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => updatePmsMaterialProcurementInfo('ACC-2026-0001', { inventoryUnit: '   ' }, PMS_BUYER_ACTOR), PmsDomainError)
})

test('报关扩展：法定第二计量单位与数值，不报关分支跳过必填校验', () => {
  updatePmsMaterialComplianceInfo(
    'ACC-2026-0001',
    {
      customs: {
        needCustomsDeclaration: true,
        legalSecondUnit: '千克',
        legalSecondUnitValue: 12.5,
        otherDeclarationElements: '品牌类型、出口享惠情况',
      },
    },
    PMS_BUYER_ACTOR,
  )
  const customs = getPmsMaterial('ACC-2026-0001')?.customsInfo
  assert.equal(customs?.needCustomsDeclaration, true)
  assert.equal(customs?.legalSecondUnit, '千克')
  assert.equal(customs?.legalSecondUnitValue, 12.5)
  assert.equal(customs?.otherDeclarationElements, '品牌类型、出口享惠情况')

  assert.throws(() => updatePmsMaterialComplianceInfo('ACC-2026-0001', { customs: { legalSecondUnit: '千克', legalSecondUnitValue: 0 } }, PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => updatePmsMaterialComplianceInfo('ACC-2026-0001', { customs: { legalSecondUnitValue: -1 } }, PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => updatePmsMaterialComplianceInfo('ACC-2026-0001', { customs: { legalSecondUnit: '', legalSecondUnitValue: 5 } }, PMS_BUYER_ACTOR), PmsDomainError)

  updatePmsMaterialComplianceInfo('ACC-2026-0001', { customs: { needCustomsDeclaration: false, chineseCustomsName: '', englishCustomsName: '', transactionUnit: '' } }, PMS_BUYER_ACTOR)
  const notDeclared = getPmsMaterial('ACC-2026-0001')?.customsInfo
  assert.equal(notDeclared?.needCustomsDeclaration, false)
  assert.equal(notDeclared?.chineseCustomsName, '')
  assert.equal(notDeclared?.legalSecondUnit, '千克')
  assert.throws(() => updatePmsMaterialComplianceInfo('ACC-2026-0001', { customs: { needCustomsDeclaration: true } }, PMS_BUYER_ACTOR), PmsDomainError)
})

const extendedOptions: PmsBomOption[] = [
  { key: 'sample', label: '是否打样', kind: 'radio', value: '是', selected: true },
  { key: 'pattern', label: '是否开版', kind: 'radio', value: '否', selected: true },
  { key: 'print', label: '需要印花', kind: 'checkbox', value: '是', selected: true },
  { key: 'embroidery', label: '需要绣花', kind: 'checkbox', value: '否', selected: false },
  { key: 'developmentStatus', label: '开发状态', kind: 'enum', value: '打板中', selected: true, choices: ['待打板', '打板中', '已完成'] },
  { key: 'reviewStatus', label: '审核状态', kind: 'enum', value: '审核中', selected: true, choices: ['待审核', '审核中', '已通过', '已驳回'] },
  { key: 'productionMode', label: '生产方式', kind: 'enum', value: '样衣开发', selected: true, choices: ['工厂生产', '外采成衣', '样衣开发'] },
  { key: 'transportMode', label: '运输方式', kind: 'enum', value: '物流专线', selected: true, choices: ['国内快递', '物流专线', '工厂送货'] },
]

test('BOM 业务选项与价格/成本、工厂、布料字段保存回显', () => {
  updatePmsBomDetail(
    'HG-TS-2601',
    {
      options: extendedOptions,
      suggestedPrice: 89.9,
      pieceWeight: 0.32,
      unitCost: 30.5,
      purchasePrice: 28.1,
      freightCost: 2.5,
      packagingCost: 1.2,
      targetGrossMargin: 35,
      factoryName: '广州华盛制衣有限公司',
      factoryContact: '李经理',
      factoryPhone: '13800138010',
      factoryAddress: '广州市白云区太和镇工业园 18 号',
      factoryLeadTimeDays: 24,
      paymentTerms: '月结 30 天',
      mainFabric: '180g 纯棉针织布',
      mainAccessory: '白色织唛',
      printType: '水浆印',
      embroideryType: '无',
      colorCount: 2,
      packagingNotes: '独立胶袋包装',
      qualityNotes: '按 AQL 2.5 抽检',
    },
    PMS_BUYER_ACTOR,
  )
  const detail = getPmsBomDetail('HG-TS-2601')
  assert.equal(detail?.options.length, 8)
  assert.equal(detail?.options.filter((option) => option.kind === 'radio').length, 2)
  assert.equal(detail?.options.filter((option) => option.kind === 'checkbox').length, 2)
  assert.equal(detail?.options.filter((option) => option.kind === 'enum').length, 4)
  assert.equal(detail?.options.find((option) => option.key === 'print')?.value, '是')
  assert.equal(detail?.options.find((option) => option.key === 'embroidery')?.value, '否')
  assert.equal(detail?.options.find((option) => option.key === 'developmentStatus')?.value, '打板中')
  assert.equal(detail?.options.find((option) => option.key === 'transportMode')?.value, '物流专线')
  assert.equal(detail?.suggestedPrice, 89.9)
  assert.equal(detail?.pieceWeight, 0.32)
  assert.equal(detail?.totalCost, 30.5 + 2.5 + 1.2)
  assert.equal(detail?.targetGrossMargin, 35)
  assert.equal(detail?.factoryPhone, '13800138010')
  assert.equal(detail?.paymentTerms, '月结 30 天')
  assert.equal(detail?.mainFabric, '180g 纯棉针织布')
  assert.equal(detail?.mainAccessory, '白色织唛')
  assert.equal(detail?.colorCount, 2)
  assert.equal(detail?.packagingNotes, '独立胶袋包装')
  assert.equal(detail?.qualityNotes, '按 AQL 2.5 抽检')

  assert.throws(() => updatePmsBomDetail('HG-TS-2601', { unitCost: -1 }, PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => updatePmsBomDetail('HG-TS-2601', { targetGrossMargin: -0.1 }, PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => updatePmsBomDetail('HG-TS-2601', { pieceWeight: 0 }, PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => updatePmsBomDetail('HG-TS-2601', { options: [{ key: 'x', label: '开发状态', kind: 'enum', value: '乱值', selected: true, choices: ['未开发'] }] }, PMS_BUYER_ACTOR), PmsDomainError)
})

test('主体经营 9 项成本明细加调整重算总成本，数据缺失提醒可消除', () => {
  assert.ok(getPmsSubjectOperation('SO-2026-05-02'))
  updatePmsSubjectOperation(
    'SO-2026-05-02',
    {
      purchaseCost: 800000,
      domesticFreight: 20000,
      firstLegOceanFreight: 40000,
      destinationPortFee: 10000,
      lastMileDeliveryFee: 6000,
      customsDuty: 20000,
      vat: 12000,
      clearanceFee: 4000,
      otherCost: 15000,
      adjustment: -3000,
      revenueStatus: '已确认',
      confirmedRevenue: 1200000,
    },
    PMS_FINANCE_ACTOR,
  )
  const row = getPmsSubjectOperation('SO-2026-05-02')
  assert.ok(row)
  assert.equal(row.logisticsCost, 20000 + 40000 + 10000 + 6000)
  assert.equal(row.allocatedCost, 20000 + 12000 + 4000 - 3000)
  assert.equal(row.totalCost, 800000 + 76000 + 33000 + 15000)
  assert.equal(row.grossProfit, row.salesAmount - row.totalCost)
  assert.equal(row.revenueStatus, '已确认')
  assert.equal(row.confirmedRevenue, 1200000)
  assert.equal(listPmsSubjectOperationDataGaps(row).length, 0)

  const before = { ...row }
  updatePmsSubjectOperation('SO-2026-05-02', { allocatedCost: before.allocatedCost + 500 }, PMS_FINANCE_ACTOR)
  const adjusted = getPmsSubjectOperation('SO-2026-05-02')
  assert.ok(adjusted)
  assert.equal(adjusted.adjustment, -3000 + 500)
  assert.equal(adjusted.totalCost, before.totalCost + 500)
  assert.equal(adjusted.grossProfit, adjusted.salesAmount - adjusted.totalCost)

  assert.ok(listPmsSubjectOperationDataGaps(getPmsSubjectOperation('SO-2026-05-06')!).length > 0)
  updatePmsSubjectOperation('SO-2026-05-06', { customsDuty: 8800, vat: 5600, confirmedRevenue: 280000, revenueStatus: '已确认' }, PMS_FINANCE_ACTOR)
  assert.equal(listPmsSubjectOperationDataGaps(getPmsSubjectOperation('SO-2026-05-06')!).length, 0)

  assert.throws(() => updatePmsSubjectOperation('SO-2026-05-02', { customsDuty: -1 }, PMS_FINANCE_ACTOR), PmsDomainError)
  assert.throws(() => updatePmsSubjectOperation('SO-2026-05-02', { adjustment: Number.NaN }, PMS_FINANCE_ACTOR), PmsDomainError)
  assert.throws(() => updatePmsSubjectOperation('SO-2026-05-02', { confirmedRevenue: -1 }, PMS_FINANCE_ACTOR), PmsDomainError)
  assert.throws(() => updatePmsSubjectOperation('SO-2026-05-02', { revenueStatus: '随便' as never }, PMS_FINANCE_ACTOR), PmsDomainError)
  assert.ok(listPmsLogs('subject-operation', 'SO-2026-05-02').length >= 2)
})
