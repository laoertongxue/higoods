import { buildTechnicalVersionListByStyle } from './pcs-technical-data-version-view-model.ts'
import { listStyleArchives } from './pcs-style-archive-repository.ts'
import type {
  MaterialArchiveKind,
  MaterialArchiveRecord,
  MaterialArchiveStatus,
  MaterialSkuDraftInput,
  MaterialArchiveStoreSnapshot,
  MaterialLogRecord,
  MaterialSkuRecord,
  MaterialUsageRecord,
} from './pcs-material-archive-types.ts'

const MATERIAL_ARCHIVE_STORAGE_KEY = 'higood-pcs-material-archive-store-v2'
const MATERIAL_ARCHIVE_STORE_VERSION = 2

const MATERIAL_CATEGORY_OPTIONS: Record<MaterialArchiveKind, string[]> = {
  fabric: ['针织布', '梭织布', '经编布', '里布', '网布', '牛仔布'],
  accessory: ['花边辅料', '纽扣', '拉链', '刺绣辅料', '松紧带', '装饰件'],
  yarn: ['车缝线', '包缝线', '绣花线', '织带线'],
  consumable: ['包装耗材', '吊牌', '胶袋', '贴纸', '辅助耗材'],
}

const MATERIAL_SKU_SPEC_META: Record<
  MaterialArchiveKind,
  {
    primaryLabel: string
    secondaryLabel: string
    primaryPlaceholder: string
    secondaryPlaceholder: string
  }
> = {
  fabric: {
    primaryLabel: '颜色',
    secondaryLabel: '克重',
    primaryPlaceholder: '例如：白色 / 黑色 / 蓝色',
    secondaryPlaceholder: '例如：160g / 180g / 220g',
  },
  accessory: {
    primaryLabel: '颜色',
    secondaryLabel: '规格',
    primaryPlaceholder: '例如：白色 / 金色 / 银色',
    secondaryPlaceholder: '例如：20mm / 标准款 / 左右配套',
  },
  yarn: {
    primaryLabel: '颜色',
    secondaryLabel: '纱支',
    primaryPlaceholder: '例如：白色 / 黑色',
    secondaryPlaceholder: '例如：40s/2 / 50s/2',
  },
  consumable: {
    primaryLabel: '颜色',
    secondaryLabel: '规格',
    primaryPlaceholder: '例如：透明 / 白色',
    secondaryPlaceholder: '例如：35×45cm / 中号 / 大号',
  },
}

let memorySnapshot: MaterialArchiveStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneRecord(record: MaterialArchiveRecord): MaterialArchiveRecord {
  return {
    ...record,
    processTags: [...record.processTags],
    galleryImageUrls: [...record.galleryImageUrls],
  }
}

function cloneSkuRecord(record: MaterialSkuRecord): MaterialSkuRecord {
  return { ...record }
}

function cloneUsageRecord(record: MaterialUsageRecord): MaterialUsageRecord {
  return { ...record }
}

function cloneLogRecord(record: MaterialLogRecord): MaterialLogRecord {
  return { ...record }
}

function cloneSnapshot(snapshot: MaterialArchiveStoreSnapshot): MaterialArchiveStoreSnapshot {
  return {
    version: snapshot.version,
    records: snapshot.records.map(cloneRecord),
    skuRecords: snapshot.skuRecords.map(cloneSkuRecord),
    usageRecords: snapshot.usageRecords.map(cloneUsageRecord),
    logRecords: snapshot.logRecords.map(cloneLogRecord),
  }
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function normalizeStatus(status: MaterialArchiveStatus): MaterialArchiveStatus {
  return status === 'INACTIVE' || status === 'ARCHIVED' ? status : 'ACTIVE'
}

function normalizeRecord(record: MaterialArchiveRecord): MaterialArchiveRecord {
  return {
    ...cloneRecord(record),
    status: normalizeStatus(record.status),
    materialNameEn: record.materialNameEn || record.materialName,
    processTags: Array.isArray(record.processTags) ? [...record.processTags] : [],
    galleryImageUrls: Array.isArray(record.galleryImageUrls) ? [...record.galleryImageUrls] : [],
    widthText: record.widthText || '-',
    gramWeightText: record.gramWeightText || '-',
    pricingUnit: record.pricingUnit || 'PCS',
    remark: record.remark || '',
    createdAt: record.createdAt || record.updatedAt || nowText(),
    createdBy: record.createdBy || '系统初始化',
    updatedAt: record.updatedAt || record.createdAt || nowText(),
    updatedBy: record.updatedBy || '系统初始化',
  }
}

function normalizeSkuRecord(record: MaterialSkuRecord): MaterialSkuRecord {
  return {
    ...cloneSkuRecord(record),
    status: normalizeStatus(record.status),
    specName: record.specName || '-',
    sizeName: record.sizeName || '-',
    pricingUnit: record.pricingUnit || 'PCS',
    weightKg: Number.isFinite(record.weightKg) ? record.weightKg : 0,
    lengthCm: Number.isFinite(record.lengthCm) ? record.lengthCm : 0,
    widthCm: Number.isFinite(record.widthCm) ? record.widthCm : 0,
    heightCm: Number.isFinite(record.heightCm) ? record.heightCm : 0,
    createdAt: record.createdAt || record.updatedAt || nowText(),
    createdBy: record.createdBy || '系统初始化',
    updatedAt: record.updatedAt || record.createdAt || nowText(),
    updatedBy: record.updatedBy || '系统初始化',
  }
}

function normalizeUsageRecord(record: MaterialUsageRecord): MaterialUsageRecord {
  const rawRecord = record as MaterialUsageRecord & { technicalVersionCode?: string }
  return {
    ...cloneUsageRecord(record),
    technicalVersionId: record.technicalVersionId || '',
    technicalVersionLabel: record.technicalVersionLabel || rawRecord.technicalVersionCode || '未建立',
    updatedAt: record.updatedAt || nowText(),
  }
}

function normalizeLogRecord(record: MaterialLogRecord): MaterialLogRecord {
  return {
    ...cloneLogRecord(record),
    operatorName: record.operatorName || '系统初始化',
    createdAt: record.createdAt || nowText(),
  }
}

function buildUsageRecord(
  materialId: string,
  index: number,
  input: { styleCode: string; consumptionText: string; updatedAt: string },
): MaterialUsageRecord {
  const style = listStyleArchives().find((item) => item.styleCode === input.styleCode)
  const latestVersion = style ? buildTechnicalVersionListByStyle(style.styleId)[0] : null
  return normalizeUsageRecord({
    usageId: `${materialId}-usage-${String(index + 1).padStart(2, '0')}`,
    materialId,
    styleId: style?.styleId || '',
    styleCode: style?.styleCode || input.styleCode,
    styleName: style?.styleName || input.styleCode,
    technicalVersionId: latestVersion?.technicalVersionId || style?.currentTechPackVersionId || '',
    technicalVersionLabel: latestVersion?.versionLabel || style?.currentTechPackVersionLabel || '未建立',
    consumptionText: input.consumptionText,
    updatedAt: input.updatedAt,
  })
}

function buildSeedSnapshot(): MaterialArchiveStoreSnapshot {
  const records: MaterialArchiveRecord[] = [
    {
      materialId: 'material_fabric_001',
      kind: 'fabric',
      materialCode: 'CNIDML360',
      materialName: '经编8坑-C2813',
      materialNameEn: 'Warp Knit Rib C2813',
      categoryName: '经编布',
      specSummary: '白色主布 / 可分色扩展',
      composition: '100% polyester',
      processTags: ['经编', '基础弹力'],
      widthText: '155cm',
      gramWeightText: '90g',
      pricingUnit: 'Yard',
      mainImageUrl: 'https://pic.higood.live/uploads/proudcts/20260316/4595f8e168082d676f32f9b977984a2a.png',
      galleryImageUrls: ['https://pic.higood.live/uploads/proudcts/20260316/4595f8e168082d676f32f9b977984a2a.png'],
      status: 'ACTIVE',
      skuCount: 2,
      usedStyleCount: 2,
      usedTechPackCount: 2,
      barcodeTemplateCode: 'CNIDML360-white-1',
      remark: '老系统导出白色主布样例，沉淀为正式面料主档。',
      createdAt: '2026-04-15 15:40',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:10',
      updatedBy: '系统初始化',
    },
    {
      materialId: 'material_fabric_002',
      kind: 'fabric',
      materialCode: 'FAB-COTTON-180',
      materialName: '纯棉针织布 180g',
      materialNameEn: 'Cotton Jersey 180g',
      categoryName: '针织布',
      specSummary: 'T 恤主布 / 黑白双色',
      composition: '100% cotton',
      processTags: ['针织', '匹染'],
      widthText: '180cm',
      gramWeightText: '180g/m²',
      pricingUnit: '米',
      mainImageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/16/c74d884c23376156c8dc13a5ff39d3fa.jpg',
      galleryImageUrls: [
        'https://file.higood.id/higood_live/proudcts/2026/04/16/c74d884c23376156c8dc13a5ff39d3fa.jpg',
        'https://file.higood.id/higood_live/proudcts/2026/04/16/e0f7c7ce28085289101a5aaab57e8b72.jpg',
      ],
      status: 'ACTIVE',
      skuCount: 2,
      usedStyleCount: 2,
      usedTechPackCount: 2,
      barcodeTemplateCode: 'FAB-COTTON-180-WHT',
      remark: '从当前技术包主布抽象出的正式面料档案。',
      createdAt: '2026-04-10 10:00',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 08:45',
      updatedBy: '系统同步',
    },
    {
      materialId: 'material_accessory_001',
      kind: 'accessory',
      materialCode: 'FLSZ26041134',
      materialName: '欧根纱刺绣蕾丝小花',
      materialNameEn: 'Organza Embroidery Flower Lace',
      categoryName: '刺绣花边',
      specSummary: 'blue / pink / apricot / white',
      composition: 'polyester',
      processTags: ['刺绣', '蕾丝'],
      widthText: '4.5cm',
      gramWeightText: '-',
      pricingUnit: 'PCS',
      mainImageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/13/8e7910031d7e27bed3951f0369555a83.png',
      galleryImageUrls: [
        'https://file.higood.id/higood_live/proudcts/2026/04/13/8e7910031d7e27bed3951f0369555a83.png',
        'https://file.higood.id/higood_live/proudcts/2026/04/13/e6a76d165ac01ac683f40377e1515351.jpg',
        'https://file.higood.id/higood_live/proudcts/2026/04/13/aee58e719c2f35faab770954c5d809ba.png',
      ],
      status: 'ACTIVE',
      skuCount: 4,
      usedStyleCount: 2,
      usedTechPackCount: 2,
      barcodeTemplateCode: 'FLSZ26041134-white',
      remark: '老系统导出辅料样例，当前沉淀为正式辅料主档。',
      createdAt: '2026-04-13 15:21',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:20',
      updatedBy: '系统同步',
    },
    {
      materialId: 'material_accessory_002',
      kind: 'accessory',
      materialCode: 'FLSZ26041135',
      materialName: '20.5cm刺绣花边辅料',
      materialNameEn: '20.5cm Embroidery Lace Trim',
      categoryName: '花边辅料',
      specSummary: 'same as photo',
      composition: 'polyester',
      processTags: ['刺绣', '花边'],
      widthText: '20.5cm',
      gramWeightText: '-',
      pricingUnit: 'PCS',
      mainImageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/13/23c0221901139951ff63a0071c75267c.gif',
      galleryImageUrls: ['https://file.higood.id/higood_live/proudcts/2026/04/13/23c0221901139951ff63a0071c75267c.gif'],
      status: 'ACTIVE',
      skuCount: 1,
      usedStyleCount: 2,
      usedTechPackCount: 2,
      barcodeTemplateCode: 'FLSZ26041135-sameasphoto',
      remark: '用于领口 / 袖口装饰，已进入 BOM 反查链路。',
      createdAt: '2026-04-13 15:25',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:26',
      updatedBy: '系统同步',
    },
    {
      materialId: 'material_accessory_003',
      kind: 'accessory',
      materialCode: 'FLSZ26031315',
      materialName: '130CM流苏',
      materialNameEn: '130CM Tassel Trim',
      categoryName: '流苏辅料',
      specSummary: '103 / SC-Khaki / PF-Pink',
      composition: 'polyester',
      processTags: ['流苏', '装饰辅料'],
      widthText: '130cm',
      gramWeightText: '-',
      pricingUnit: 'PCS',
      mainImageUrl: 'https://pic.higood.live/uploads/proudcts/20260314/f5271db2483941df347bce4c5ee60d64.jpg',
      galleryImageUrls: [
        'https://pic.higood.live/uploads/proudcts/20260314/f5271db2483941df347bce4c5ee60d64.jpg',
        'https://pic.higood.live/uploads/proudcts/20260318/597cd021cdc26b4c4ec98d67ea289851.png',
      ],
      status: 'ACTIVE',
      skuCount: 3,
      usedStyleCount: 1,
      usedTechPackCount: 1,
      barcodeTemplateCode: 'FLSZ26031315-103',
      remark: '来自老系统导出的流苏辅料，当前用于中式与节庆款装饰。',
      createdAt: '2026-03-14 18:51',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:32',
      updatedBy: '系统同步',
    },
    {
      materialId: 'material_yarn_001',
      kind: 'yarn',
      materialCode: 'THREAD-40S-002',
      materialName: '缝纫线 40s/2',
      materialNameEn: 'Sewing Thread 40s/2',
      categoryName: '车缝线',
      specSummary: 'Black / White',
      composition: 'polyester',
      processTags: ['车缝', '基础辅线'],
      widthText: '-',
      gramWeightText: '-',
      pricingUnit: '卷',
      mainImageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/16/291197a6d0717c9d8832fff8b329299e.jpg',
      galleryImageUrls: ['https://file.higood.id/higood_live/proudcts/2026/04/16/291197a6d0717c9d8832fff8b329299e.jpg'],
      status: 'ACTIVE',
      skuCount: 2,
      usedStyleCount: 4,
      usedTechPackCount: 4,
      barcodeTemplateCode: 'THREAD-40S-002-WHT',
      remark: '统一沉淀车缝线，不再散落于技术包自由文本。',
      createdAt: '2026-04-12 17:40',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:42',
      updatedBy: '系统同步',
    },
    {
      materialId: 'material_consumable_001',
      kind: 'consumable',
      materialCode: 'PACK-35X45',
      materialName: '独立包装袋 35×45cm',
      materialNameEn: 'Poly Bag 35x45cm',
      categoryName: '包装耗材',
      specSummary: '透明标准袋',
      composition: 'PE',
      processTags: ['包装', '出货耗材'],
      widthText: '35×45cm',
      gramWeightText: '-',
      pricingUnit: 'PCS',
      mainImageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/16/f8f3566efc82709add4e08fe108b7dfc.jpg',
      galleryImageUrls: ['https://file.higood.id/higood_live/proudcts/2026/04/16/f8f3566efc82709add4e08fe108b7dfc.jpg'],
      status: 'ACTIVE',
      skuCount: 1,
      usedStyleCount: 5,
      usedTechPackCount: 5,
      barcodeTemplateCode: 'PACK-35X45-CLR',
      remark: '作为技术包 BOM 的标准包装耗材统一维护。',
      createdAt: '2026-04-12 18:10',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:48',
      updatedBy: '系统同步',
    },
  ]

  const skuRecords: MaterialSkuRecord[] = [
    {
      materialSkuId: 'material_fabric_001_sku_001',
      materialId: 'material_fabric_001',
      materialCode: 'CNIDML360',
      materialSkuCode: 'CNIDML360-white-1',
      materialName: '经编8坑-C2813',
      colorName: 'white',
      specName: '主布',
      sizeName: '1#',
      skuImageUrl: 'https://pic.higood.live/uploads/proudcts/20260316/4595f8e168082d676f32f9b977984a2a.png',
      costPrice: 6.38,
      freightCost: 1.18,
      pricingUnit: 'Yard',
      weightKg: 0.28,
      lengthCm: 155,
      widthCm: 155,
      heightCm: 1,
      barcode: 'CNIDML360-white-1',
      status: 'ACTIVE',
      createdAt: '2026-04-15 15:40',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:10',
      updatedBy: '系统初始化',
    },
    {
      materialSkuId: 'material_fabric_001_sku_002',
      materialId: 'material_fabric_001',
      materialCode: 'CNIDML360',
      materialSkuCode: 'CNIDML360-blue-1',
      materialName: '经编8坑-C2813',
      colorName: 'blue',
      specName: '扩展色',
      sizeName: '1#',
      skuImageUrl: 'https://pic.higood.live/uploads/proudcts/20260325/cf4795cd9b8a6964c389b1708d66678a.png',
      costPrice: 6.58,
      freightCost: 1.18,
      pricingUnit: 'Yard',
      weightKg: 0.28,
      lengthCm: 155,
      widthCm: 155,
      heightCm: 1,
      barcode: 'CNIDML360-blue-1',
      status: 'ACTIVE',
      createdAt: '2026-04-15 15:41',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:12',
      updatedBy: '系统初始化',
    },
    {
      materialSkuId: 'material_fabric_002_sku_001',
      materialId: 'material_fabric_002',
      materialCode: 'FAB-COTTON-180',
      materialSkuCode: 'FAB-COTTON-180-WHT',
      materialName: '纯棉针织布 180g',
      colorName: 'White',
      specName: '主布',
      sizeName: '180g',
      skuImageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/16/c74d884c23376156c8dc13a5ff39d3fa.jpg',
      costPrice: 23.6,
      freightCost: 1.8,
      pricingUnit: '米',
      weightKg: 0.35,
      lengthCm: 180,
      widthCm: 180,
      heightCm: 1,
      barcode: 'FAB-COTTON-180-WHT',
      status: 'ACTIVE',
      createdAt: '2026-04-10 10:00',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 08:45',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_fabric_002_sku_002',
      materialId: 'material_fabric_002',
      materialCode: 'FAB-COTTON-180',
      materialSkuCode: 'FAB-COTTON-180-BLK',
      materialName: '纯棉针织布 180g',
      colorName: 'Black',
      specName: '主布',
      sizeName: '180g',
      skuImageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/16/e0f7c7ce28085289101a5aaab57e8b72.jpg',
      costPrice: 24.2,
      freightCost: 1.8,
      pricingUnit: '米',
      weightKg: 0.35,
      lengthCm: 180,
      widthCm: 180,
      heightCm: 1,
      barcode: 'FAB-COTTON-180-BLK',
      status: 'ACTIVE',
      createdAt: '2026-04-10 10:02',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 08:45',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_001_sku_001',
      materialId: 'material_accessory_001',
      materialCode: 'FLSZ26041134',
      materialSkuCode: 'FLSZ26041134-blue',
      materialName: '欧根纱刺绣蕾丝小花',
      colorName: 'blue',
      specName: '小花刺绣',
      sizeName: '标准',
      skuImageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/13/8e7910031d7e27bed3951f0369555a83.png',
      costPrice: 0.46,
      freightCost: 0.03,
      pricingUnit: 'PCS',
      weightKg: 0.02,
      lengthCm: 5,
      widthCm: 5,
      heightCm: 1,
      barcode: 'FLSZ26041134-blue',
      status: 'ACTIVE',
      createdAt: '2026-04-13 15:21',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:20',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_001_sku_002',
      materialId: 'material_accessory_001',
      materialCode: 'FLSZ26041134',
      materialSkuCode: 'FLSZ26041134-pink',
      materialName: '欧根纱刺绣蕾丝小花',
      colorName: 'pink',
      specName: '小花刺绣',
      sizeName: '标准',
      skuImageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/13/e6a76d165ac01ac683f40377e1515351.jpg',
      costPrice: 0.46,
      freightCost: 0.03,
      pricingUnit: 'PCS',
      weightKg: 0.02,
      lengthCm: 5,
      widthCm: 5,
      heightCm: 1,
      barcode: 'FLSZ26041134-pink',
      status: 'ACTIVE',
      createdAt: '2026-04-13 15:21',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:20',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_001_sku_003',
      materialId: 'material_accessory_001',
      materialCode: 'FLSZ26041134',
      materialSkuCode: 'FLSZ26041134-apricot',
      materialName: '欧根纱刺绣蕾丝小花',
      colorName: 'apricot',
      specName: '小花刺绣',
      sizeName: '标准',
      skuImageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/13/aee58e719c2f35faab770954c5d809ba.png',
      costPrice: 0.46,
      freightCost: 0.03,
      pricingUnit: 'PCS',
      weightKg: 0.02,
      lengthCm: 5,
      widthCm: 5,
      heightCm: 1,
      barcode: 'FLSZ26041134-apricot',
      status: 'ACTIVE',
      createdAt: '2026-04-13 15:21',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:20',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_001_sku_004',
      materialId: 'material_accessory_001',
      materialCode: 'FLSZ26041134',
      materialSkuCode: 'FLSZ26041134-white',
      materialName: '欧根纱刺绣蕾丝小花',
      colorName: 'white',
      specName: '小花刺绣',
      sizeName: '标准',
      skuImageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/13/03170a87fd957af3c1672371e197470a.png',
      costPrice: 0.46,
      freightCost: 0.03,
      pricingUnit: 'PCS',
      weightKg: 0.02,
      lengthCm: 5,
      widthCm: 5,
      heightCm: 1,
      barcode: 'FLSZ26041134-white',
      status: 'ACTIVE',
      createdAt: '2026-04-13 15:21',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:20',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_002_sku_001',
      materialId: 'material_accessory_002',
      materialCode: 'FLSZ26041135',
      materialSkuCode: 'FLSZ26041135-sameasphoto',
      materialName: '20.5cm刺绣花边辅料',
      colorName: 'sameasphoto',
      specName: '花边',
      sizeName: '20.5cm',
      skuImageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/13/23c0221901139951ff63a0071c75267c.gif',
      costPrice: 5.8,
      freightCost: 0.15,
      pricingUnit: 'PCS',
      weightKg: 0.08,
      lengthCm: 21,
      widthCm: 4,
      heightCm: 1,
      barcode: 'FLSZ26041135-sameasphoto',
      status: 'ACTIVE',
      createdAt: '2026-04-13 15:25',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:26',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_003_sku_001',
      materialId: 'material_accessory_003',
      materialCode: 'FLSZ26031315',
      materialSkuCode: 'FLSZ26031315-103',
      materialName: '130CM流苏',
      colorName: '103',
      specName: '流苏',
      sizeName: '130cm',
      skuImageUrl: 'https://pic.higood.live/uploads/proudcts/20260314/f5271db2483941df347bce4c5ee60d64.jpg',
      costPrice: 0.6,
      freightCost: 0.04,
      pricingUnit: 'PCS',
      weightKg: 0.05,
      lengthCm: 130,
      widthCm: 3,
      heightCm: 1,
      barcode: 'FLSZ26031315-103',
      status: 'ACTIVE',
      createdAt: '2026-03-14 18:51',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:32',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_003_sku_002',
      materialId: 'material_accessory_003',
      materialCode: 'FLSZ26031315',
      materialSkuCode: 'FLSZ26031315-sc-khaki',
      materialName: '130CM流苏',
      colorName: 'SC-Khaki',
      specName: '流苏',
      sizeName: '130cm',
      skuImageUrl: 'https://pic.higood.live/uploads/proudcts/20260314/f5271db2483941df347bce4c5ee60d64.jpg',
      costPrice: 0.6,
      freightCost: 0.04,
      pricingUnit: 'PCS',
      weightKg: 0.05,
      lengthCm: 130,
      widthCm: 3,
      heightCm: 1,
      barcode: 'FLSZ26031315-sc-khaki',
      status: 'ACTIVE',
      createdAt: '2026-03-14 18:51',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:32',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_accessory_003_sku_003',
      materialId: 'material_accessory_003',
      materialCode: 'FLSZ26031315',
      materialSkuCode: 'FLSZ26031315-pf-pink',
      materialName: '130CM流苏',
      colorName: 'PF-Pink',
      specName: '流苏',
      sizeName: '130cm',
      skuImageUrl: 'https://pic.higood.live/uploads/proudcts/20260318/597cd021cdc26b4c4ec98d67ea289851.png',
      costPrice: 0.6,
      freightCost: 0.04,
      pricingUnit: 'PCS',
      weightKg: 0.05,
      lengthCm: 130,
      widthCm: 3,
      heightCm: 1,
      barcode: 'FLSZ26031315-pf-pink',
      status: 'ACTIVE',
      createdAt: '2026-03-14 18:51',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:32',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_yarn_001_sku_001',
      materialId: 'material_yarn_001',
      materialCode: 'THREAD-40S-002',
      materialSkuCode: 'THREAD-40S-002-WHT',
      materialName: '缝纫线 40s/2',
      colorName: 'White',
      specName: '40s/2',
      sizeName: '常规',
      skuImageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/16/291197a6d0717c9d8832fff8b329299e.jpg',
      costPrice: 0.32,
      freightCost: 0.02,
      pricingUnit: '卷',
      weightKg: 0.06,
      lengthCm: 5,
      widthCm: 5,
      heightCm: 10,
      barcode: 'THREAD-40S-002-WHT',
      status: 'ACTIVE',
      createdAt: '2026-04-12 17:40',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:42',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_yarn_001_sku_002',
      materialId: 'material_yarn_001',
      materialCode: 'THREAD-40S-002',
      materialSkuCode: 'THREAD-40S-002-BLK',
      materialName: '缝纫线 40s/2',
      colorName: 'Black',
      specName: '40s/2',
      sizeName: '常规',
      skuImageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/16/766c6496dba8cace985d7b8598a1a5cd.jpg',
      costPrice: 0.32,
      freightCost: 0.02,
      pricingUnit: '卷',
      weightKg: 0.06,
      lengthCm: 5,
      widthCm: 5,
      heightCm: 10,
      barcode: 'THREAD-40S-002-BLK',
      status: 'ACTIVE',
      createdAt: '2026-04-12 17:41',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:42',
      updatedBy: '系统同步',
    },
    {
      materialSkuId: 'material_consumable_001_sku_001',
      materialId: 'material_consumable_001',
      materialCode: 'PACK-35X45',
      materialSkuCode: 'PACK-35X45-CLR',
      materialName: '独立包装袋 35×45cm',
      colorName: '透明',
      specName: '35×45cm',
      sizeName: '常规',
      skuImageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/16/f8f3566efc82709add4e08fe108b7dfc.jpg',
      costPrice: 0.45,
      freightCost: 0.02,
      pricingUnit: 'PCS',
      weightKg: 0.02,
      lengthCm: 35,
      widthCm: 45,
      heightCm: 1,
      barcode: 'PACK-35X45-CLR',
      status: 'ACTIVE',
      createdAt: '2026-04-12 18:10',
      createdBy: '系统初始化',
      updatedAt: '2026-04-16 09:48',
      updatedBy: '系统同步',
    },
  ]

  const usageRecords: MaterialUsageRecord[] = [
    buildUsageRecord('material_fabric_001', 0, { styleCode: 'SPU-SHIRT-086', consumptionText: '1.65 Yard/件', updatedAt: '2026-04-16 09:12' }),
    buildUsageRecord('material_fabric_001', 1, { styleCode: 'SPU-2024-017', consumptionText: '0.35 Yard/件', updatedAt: '2026-04-16 09:12' }),
    buildUsageRecord('material_fabric_002', 0, { styleCode: 'SPU-2024-001', consumptionText: '0.80 米/件', updatedAt: '2026-04-16 08:45' }),
    buildUsageRecord('material_fabric_002', 1, { styleCode: 'SPU-TEE-084', consumptionText: '0.76 米/件', updatedAt: '2026-04-16 08:45' }),
    buildUsageRecord('material_accessory_001', 0, { styleCode: 'SPU-DRESS-083', consumptionText: '2 PCS/件', updatedAt: '2026-04-16 09:20' }),
    buildUsageRecord('material_accessory_001', 1, { styleCode: 'SPU-2026-018', consumptionText: '1 PCS/件', updatedAt: '2026-04-16 09:20' }),
    buildUsageRecord('material_accessory_002', 0, { styleCode: 'SPU-2024-003', consumptionText: '0.6 PCS/件', updatedAt: '2026-04-16 09:26' }),
    buildUsageRecord('material_accessory_002', 1, { styleCode: 'SPU-2026-018', consumptionText: '0.4 PCS/件', updatedAt: '2026-04-16 09:26' }),
    buildUsageRecord('material_accessory_003', 0, { styleCode: 'SPU-2024-005', consumptionText: '1 PCS/件', updatedAt: '2026-04-16 09:32' }),
    buildUsageRecord('material_yarn_001', 0, { styleCode: 'SPU-2024-001', consumptionText: '1 卷/批', updatedAt: '2026-04-16 09:42' }),
    buildUsageRecord('material_yarn_001', 1, { styleCode: 'SPU-SHIRT-086', consumptionText: '1 卷/批', updatedAt: '2026-04-16 09:42' }),
    buildUsageRecord('material_yarn_001', 2, { styleCode: 'SPU-JACKET-085', consumptionText: '1 卷/批', updatedAt: '2026-04-16 09:42' }),
    buildUsageRecord('material_yarn_001', 3, { styleCode: 'SPU-2024-017', consumptionText: '1 卷/批', updatedAt: '2026-04-16 09:42' }),
    buildUsageRecord('material_consumable_001', 0, { styleCode: 'SPU-2024-001', consumptionText: '1 PCS/件', updatedAt: '2026-04-16 09:48' }),
    buildUsageRecord('material_consumable_001', 1, { styleCode: 'SPU-2024-005', consumptionText: '1 PCS/件', updatedAt: '2026-04-16 09:48' }),
    buildUsageRecord('material_consumable_001', 2, { styleCode: 'SPU-SHIRT-086', consumptionText: '1 PCS/件', updatedAt: '2026-04-16 09:48' }),
    buildUsageRecord('material_consumable_001', 3, { styleCode: 'SPU-JACKET-085', consumptionText: '1 PCS/件', updatedAt: '2026-04-16 09:48' }),
    buildUsageRecord('material_consumable_001', 4, { styleCode: 'SPU-2026-018', consumptionText: '1 PCS/件', updatedAt: '2026-04-16 09:48' }),
  ]

  const logRecords: MaterialLogRecord[] = records.flatMap((record, index) => [
    {
      logId: `${record.materialId}-log-01`,
      materialId: record.materialId,
      operatorName: index % 2 === 0 ? '系统初始化' : '商品中心管理员',
      title: '初始化建档',
      detail: `完成 ${record.materialCode} / ${record.materialName} 的正式物料主档初始化。`,
      createdAt: record.createdAt,
    },
    {
      logId: `${record.materialId}-log-02`,
      materialId: record.materialId,
      operatorName: '系统同步',
      title: '补齐规格与引用',
      detail: `同步 ${record.skuCount} 条物料 SKU，并建立 ${record.usedStyleCount} 条款式引用关系。`,
      createdAt: record.updatedAt,
    },
  ])

  return {
    version: MATERIAL_ARCHIVE_STORE_VERSION,
    records: records.map(normalizeRecord),
    skuRecords: skuRecords.map(normalizeSkuRecord),
    usageRecords: usageRecords.map(normalizeUsageRecord),
    logRecords: logRecords.map(normalizeLogRecord),
  }
}

function hydrateSnapshot(snapshot: MaterialArchiveStoreSnapshot): MaterialArchiveStoreSnapshot {
  return {
    version: MATERIAL_ARCHIVE_STORE_VERSION,
    records: Array.isArray(snapshot.records) ? snapshot.records.map(normalizeRecord) : [],
    skuRecords: Array.isArray(snapshot.skuRecords) ? snapshot.skuRecords.map(normalizeSkuRecord) : [],
    usageRecords: Array.isArray(snapshot.usageRecords) ? snapshot.usageRecords.map(normalizeUsageRecord) : [],
    logRecords: Array.isArray(snapshot.logRecords) ? snapshot.logRecords.map(normalizeLogRecord) : [],
  }
}

function loadSnapshot(): MaterialArchiveStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)

  if (!canUseStorage()) {
    memorySnapshot = buildSeedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(MATERIAL_ARCHIVE_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = buildSeedSnapshot()
      localStorage.setItem(MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    const parsed = JSON.parse(raw) as Partial<MaterialArchiveStoreSnapshot>
    if (!Array.isArray(parsed.records) || !Array.isArray(parsed.skuRecords)) {
      memorySnapshot = buildSeedSnapshot()
      localStorage.setItem(MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    memorySnapshot = hydrateSnapshot({
      version: MATERIAL_ARCHIVE_STORE_VERSION,
      records: parsed.records as MaterialArchiveRecord[],
      skuRecords: parsed.skuRecords as MaterialSkuRecord[],
      usageRecords: (parsed.usageRecords || []) as MaterialUsageRecord[],
      logRecords: (parsed.logRecords || []) as MaterialLogRecord[],
    })
    localStorage.setItem(MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = buildSeedSnapshot()
    if (canUseStorage()) {
      localStorage.setItem(MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

function persistSnapshot(snapshot: MaterialArchiveStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

function buildMaterialCode(kind: MaterialArchiveKind, name: string): string {
  const prefix = kind === 'fabric' ? 'FAB' : kind === 'accessory' ? 'ACC' : kind === 'yarn' ? 'YARN' : 'CONS'
  const normalized = name
    .replace(/[^\w\u4e00-\u9fa5]+/g, '')
    .slice(0, 8)
    .toUpperCase()
  return `${prefix}-${normalized || 'NEW'}`
}

function buildSkuToken(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase()
  return normalized || 'STD'
}

function buildMaterialSkuCode(materialCode: string, skuDraft: MaterialSkuDraftInput, index: number): string {
  return `${materialCode}-${buildSkuToken(skuDraft.colorName)}-${buildSkuToken(skuDraft.specName || skuDraft.sizeName || `SKU${index + 1}`)}`
}

function buildNextMaterialSkuCode(
  materialCode: string,
  skuDraft: MaterialSkuDraftInput,
  existingSkuRecords: MaterialSkuRecord[],
): string {
  const baseCode = buildMaterialSkuCode(materialCode, skuDraft, existingSkuRecords.length)
  const duplicateCount = existingSkuRecords.filter(
    (item) => item.materialSkuCode === baseCode || item.materialSkuCode.startsWith(`${baseCode}-`),
  ).length
  if (duplicateCount === 0) return baseCode
  return `${baseCode}-${String(duplicateCount + 1).padStart(2, '0')}`
}

export function getMaterialArchiveCategoryOptions(kind: MaterialArchiveKind): Array<{ value: string; label: string }> {
  return MATERIAL_CATEGORY_OPTIONS[kind].map((item) => ({ value: item, label: item }))
}

export function getMaterialSkuSpecMeta(kind: MaterialArchiveKind): {
  primaryLabel: string
  secondaryLabel: string
  primaryPlaceholder: string
  secondaryPlaceholder: string
} {
  return { ...MATERIAL_SKU_SPEC_META[kind] }
}

export function listMaterialArchives(kind?: MaterialArchiveKind): MaterialArchiveRecord[] {
  return loadSnapshot().records
    .filter((item) => !kind || item.kind === kind)
    .map(cloneRecord)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getMaterialArchiveById(materialId: string): MaterialArchiveRecord | null {
  const record = loadSnapshot().records.find((item) => item.materialId === materialId)
  return record ? cloneRecord(record) : null
}

export function listMaterialSkuRecordsByMaterialId(materialId: string): MaterialSkuRecord[] {
  return loadSnapshot().skuRecords.filter((item) => item.materialId === materialId).map(cloneSkuRecord)
}

export function getMaterialSkuRecordById(materialSkuId: string): MaterialSkuRecord | null {
  const record = loadSnapshot().skuRecords.find((item) => item.materialSkuId === materialSkuId)
  return record ? cloneSkuRecord(record) : null
}

export function listMaterialUsageRecordsByMaterialId(materialId: string): MaterialUsageRecord[] {
  return loadSnapshot().usageRecords.filter((item) => item.materialId === materialId).map(cloneUsageRecord)
}

export function listMaterialUsageRecordsByStyleCode(styleCode: string): MaterialUsageRecord[] {
  return loadSnapshot().usageRecords.filter((item) => item.styleCode === styleCode).map(cloneUsageRecord)
}

export function listMaterialLogRecordsByMaterialId(materialId: string): MaterialLogRecord[] {
  return loadSnapshot().logRecords.filter((item) => item.materialId === materialId).map(cloneLogRecord)
}

export function getMaterialStats(kind: MaterialArchiveKind): {
  total: number
  active: number
  skuCount: number
  usageCount: number
  linkedStyleCount: number
} {
  const records = listMaterialArchives(kind)
  const materialIds = new Set(records.map((item) => item.materialId))
  const skus = loadSnapshot().skuRecords.filter((item) => materialIds.has(item.materialId))
  const usages = loadSnapshot().usageRecords.filter((item) => materialIds.has(item.materialId))
  return {
    total: records.length,
    active: records.filter((item) => item.status === 'ACTIVE').length,
    skuCount: skus.length,
    usageCount: usages.length,
    linkedStyleCount: new Set(usages.map((item) => item.styleCode)).size,
  }
}

export function createMaterialArchive(input: {
  kind: MaterialArchiveKind
  materialName: string
  materialNameEn: string
  categoryName: string
  specSummary: string
  composition: string
  processTags: string[]
  widthText: string
  gramWeightText: string
  pricingUnit: string
  mainImageUrl: string
  barcodeTemplateCode: string
  remark: string
}): MaterialArchiveRecord {
  const snapshot = loadSnapshot()
  const timestamp = nowText()
  const nextId = `material_${input.kind}_${timestamp.replace(/\D/g, '')}`
  const materialCode = buildMaterialCode(input.kind, input.materialName)
  const record = normalizeRecord({
    materialId: nextId,
    kind: input.kind,
    materialCode,
    materialName: input.materialName,
    materialNameEn: input.materialNameEn || input.materialName,
    categoryName: input.categoryName || '未分类',
    specSummary: input.specSummary || '-',
    composition: input.composition || '-',
    processTags: input.processTags,
    widthText: input.widthText || '-',
    gramWeightText: input.gramWeightText || '-',
    pricingUnit: input.pricingUnit || 'PCS',
    mainImageUrl: input.mainImageUrl || '',
    galleryImageUrls: input.mainImageUrl ? [input.mainImageUrl] : [],
    status: 'ACTIVE',
    skuCount: 0,
    usedStyleCount: 0,
    usedTechPackCount: 0,
    barcodeTemplateCode: input.barcodeTemplateCode || '',
    remark: input.remark || '',
    createdAt: timestamp,
    createdBy: '系统演示',
    updatedAt: timestamp,
    updatedBy: '系统演示',
  })
  const log = normalizeLogRecord({
    logId: `${nextId}-log-01`,
    materialId: nextId,
    operatorName: '系统演示',
    title: '新建物料主档',
    detail: `创建 ${record.materialCode} / ${record.materialName}，已定义 SKU 规则参数，待后续补充具体 SKU。`,
    createdAt: timestamp,
  })
  persistSnapshot({
    ...snapshot,
    records: [record, ...snapshot.records],
    logRecords: [log, ...snapshot.logRecords],
  })
  return cloneRecord(record)
}

export function createMaterialSkuRecord(materialId: string, input: MaterialSkuDraftInput): MaterialSkuRecord | null {
  const snapshot = loadSnapshot()
  const material = snapshot.records.find((item) => item.materialId === materialId)
  if (!material) return null

  const timestamp = nowText()
  const normalizedInput: MaterialSkuDraftInput = {
    colorName: input.colorName.trim(),
    specName: input.specName.trim(),
    sizeName: input.sizeName.trim(),
    skuImageUrl: input.skuImageUrl.trim(),
    costPrice: Number.isFinite(input.costPrice) ? input.costPrice : 0,
    freightCost: Number.isFinite(input.freightCost) ? input.freightCost : 0,
    weightKg: Number.isFinite(input.weightKg) ? input.weightKg : 0,
    lengthCm: Number.isFinite(input.lengthCm) ? input.lengthCm : 0,
    widthCm: Number.isFinite(input.widthCm) ? input.widthCm : 0,
    heightCm: Number.isFinite(input.heightCm) ? input.heightCm : 0,
    barcode: input.barcode.trim(),
  }
  const existingSkuRecords = snapshot.skuRecords.filter((item) => item.materialId === materialId)
  const materialSkuCode = buildNextMaterialSkuCode(material.materialCode, normalizedInput, existingSkuRecords)
  const record = normalizeSkuRecord({
    materialSkuId: `${materialId}_sku_${String(existingSkuRecords.length + 1).padStart(3, '0')}`,
    materialId,
    materialCode: material.materialCode,
    materialSkuCode,
    materialName: material.materialName,
    colorName: normalizedInput.colorName,
    specName: normalizedInput.specName || normalizedInput.sizeName || '-',
    sizeName: normalizedInput.sizeName || '-',
    skuImageUrl: normalizedInput.skuImageUrl || material.mainImageUrl || '',
    costPrice: normalizedInput.costPrice,
    freightCost: normalizedInput.freightCost,
    pricingUnit: material.pricingUnit,
    weightKg: normalizedInput.weightKg,
    lengthCm: normalizedInput.lengthCm,
    widthCm: normalizedInput.widthCm,
    heightCm: normalizedInput.heightCm,
    barcode: normalizedInput.barcode || materialSkuCode,
    status: 'ACTIVE',
    createdAt: timestamp,
    createdBy: '系统演示',
    updatedAt: timestamp,
    updatedBy: '系统演示',
  })

  const updatedRecord = normalizeRecord({
    ...material,
    skuCount: existingSkuRecords.length + 1,
    barcodeTemplateCode: material.barcodeTemplateCode || record.materialSkuCode,
    updatedAt: timestamp,
    updatedBy: '系统演示',
  })
  const log = normalizeLogRecord({
    logId: `${materialId}-log-sku-${timestamp.replace(/\D/g, '')}`,
    materialId,
    operatorName: '系统演示',
    title: '新增物料 SKU',
    detail: `新增 ${record.materialSkuCode}，规格为 ${record.colorName} / ${record.specName || record.sizeName}。`,
    createdAt: timestamp,
  })

  persistSnapshot({
    ...snapshot,
    records: snapshot.records.map((item) => (item.materialId === materialId ? updatedRecord : item)),
    skuRecords: [record, ...snapshot.skuRecords],
    logRecords: [log, ...snapshot.logRecords],
  })
  return cloneSkuRecord(record)
}

export function updateMaterialSkuRecord(materialSkuId: string, input: MaterialSkuDraftInput): MaterialSkuRecord | null {
  const snapshot = loadSnapshot()
  const skuRecord = snapshot.skuRecords.find((item) => item.materialSkuId === materialSkuId)
  if (!skuRecord) return null
  const material = snapshot.records.find((item) => item.materialId === skuRecord.materialId)
  if (!material) return null

  const timestamp = nowText()
  const normalizedInput: MaterialSkuDraftInput = {
    colorName: input.colorName.trim(),
    specName: input.specName.trim(),
    sizeName: input.sizeName.trim(),
    skuImageUrl: input.skuImageUrl.trim(),
    costPrice: Number.isFinite(input.costPrice) ? input.costPrice : 0,
    freightCost: Number.isFinite(input.freightCost) ? input.freightCost : 0,
    weightKg: Number.isFinite(input.weightKg) ? input.weightKg : 0,
    lengthCm: Number.isFinite(input.lengthCm) ? input.lengthCm : 0,
    widthCm: Number.isFinite(input.widthCm) ? input.widthCm : 0,
    heightCm: Number.isFinite(input.heightCm) ? input.heightCm : 0,
    barcode: input.barcode.trim(),
  }
  const existingSkuRecords = snapshot.skuRecords.filter((item) => item.materialId === material.materialId)
  const nextMaterialSkuCode = buildNextMaterialSkuCode(
    material.materialCode,
    normalizedInput,
    existingSkuRecords.filter((item) => item.materialSkuId !== materialSkuId),
  )
  const updatedSkuRecord = normalizeSkuRecord({
    ...skuRecord,
    materialSkuCode: nextMaterialSkuCode,
    colorName: normalizedInput.colorName,
    specName: normalizedInput.specName || normalizedInput.sizeName || '-',
    sizeName: normalizedInput.sizeName || '-',
    skuImageUrl: normalizedInput.skuImageUrl || material.mainImageUrl || '',
    costPrice: normalizedInput.costPrice,
    freightCost: normalizedInput.freightCost,
    weightKg: normalizedInput.weightKg,
    lengthCm: normalizedInput.lengthCm,
    widthCm: normalizedInput.widthCm,
    heightCm: normalizedInput.heightCm,
    barcode: normalizedInput.barcode || nextMaterialSkuCode,
    updatedAt: timestamp,
    updatedBy: '系统演示',
  })
  const updatedRecord = normalizeRecord({
    ...material,
    updatedAt: timestamp,
    updatedBy: '系统演示',
  })
  const log = normalizeLogRecord({
    logId: `${material.materialId}-log-sku-edit-${timestamp.replace(/\D/g, '')}`,
    materialId: material.materialId,
    operatorName: '系统演示',
    title: '编辑物料 SKU',
    detail: `更新 ${updatedSkuRecord.materialSkuCode}，规格为 ${updatedSkuRecord.colorName} / ${updatedSkuRecord.specName || updatedSkuRecord.sizeName}。`,
    createdAt: timestamp,
  })

  persistSnapshot({
    ...snapshot,
    records: snapshot.records.map((item) => (item.materialId === material.materialId ? updatedRecord : item)),
    skuRecords: snapshot.skuRecords.map((item) => (item.materialSkuId === materialSkuId ? updatedSkuRecord : item)),
    logRecords: [log, ...snapshot.logRecords],
  })
  return cloneSkuRecord(updatedSkuRecord)
}
