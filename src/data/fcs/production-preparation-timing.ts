export type ProductPrepType =
  | '非烫画&非毛织（纯梭织）'
  | '烫画&直喷'
  | '毛织'
  | '毛织&梭织'

export type PreparationItemType =
  | '梭织基码纸样'
  | '毛织基码纸样'
  | '版衣制作'
  | '梭织齐码纸样'
  | '毛织齐码纸样'
  | '数码印/DTF/DTG花型'
  | '染色调色（纱线）'
  | '染色调色（面料）'
  | '辅料下单'

export type PreparationOutputType = '正式技术包' | '生产单' | '印花单' | '染色单' | '辅料采购单'
export type PreparationOutputStatus = '预计生成' | '已生成'

export type PreparationRecordStatus = '未开始' | '进行中' | '部分超时' | '已完成' | '已关闭'

export type PreparationItemStatus =
  | '无需'
  | '待判断'
  | '待分配'
  | '待开始'
  | '进行中'
  | '待确认'
  | '已完成'
  | '已超时'

export interface ProductionPreparationItem {
  itemId: string
  recordId: string
  itemType: PreparationItemType
  required: boolean
  requiredKind: '必做' | '选填'
  selectedByMerchandiser: boolean
  selectedAt: string
  sequenceGroup: string
  dependsOnItemIds: string[]
  parallelGroup: string
  status: PreparationItemStatus
  ownerTeam: string
  ownerName: string
  plannedStartAt: string
  plannedFinishAt: string
  actualFinishAt: string
  evidenceType: string
  evidenceSummary: string
  sourceObjectType: string
  sourceObjectNo: string
  sourceHref: string
  overdueHours: number
  remark: string
  patternTaskNo?: string
  patternDesignerId?: string
  patternDesignerName?: string
  patternTeamName?: string
  assignedAt?: string
  completionImageIds?: string[]
  patternFileIds?: string[]
  buyerReviewStatus?: '未提交' | '待确认' | '已通过' | '需调整'
}

export interface ProductionPreparationOutput {
  outputType: PreparationOutputType
  outputNo: string
  outputHref: string
  outputStatus: PreparationOutputStatus
}

export interface ProductionPreparationRecord {
  recordId: string
  recordNo: string
  spuCode: string
  spuName: string
  imageUrl: string
  selectionName: string
  buyerName: string
  merchandiserName: string
  sourceReason: '销量达标' | '人工加入' | '前置打板' | '新类目'
  craftTags: string[]
  categoryTags: string[]
  largeGoodsThresholdQty: number
  largeGoodsReachedQty: number
  largeGoodsReachedAt: string
  largeGoodsReachedDays: number
  reachedThresholdAt: string
  enteredAt: string
  derivedProductPrepType: ProductPrepType
  confirmedProductPrepType: ProductPrepType
  prepTypeSource: '系统推导' | '人工修正'
  prepTypeConfirmedBy: string
  prepTypeConfirmedAt: string
  prepTypeOverrideReason: string
  productionDemandNo: string
  productionOrderNo: string
  productionOrderHref: string
  techPackVersionLabel: string
  techPackPublishedAt: string
  status: PreparationRecordStatus
  currentBlockerText: string
  expectedFinishAt: string
  closedReason: string
  outputReady: boolean
  outputPublishedAt: string
  outputs: ProductionPreparationOutput[]
  items: ProductionPreparationItem[]
}

export interface FlattenedPreparationItem extends ProductionPreparationItem {
  recordNo: string
  spuCode: string
  spuName: string
  imageUrl: string
  confirmedProductPrepType: ProductPrepType
  buyerName: string
  merchandiserName: string
  sourceReason: ProductionPreparationRecord['sourceReason']
  enteredAt: string
  productionDemandNo: string
  productionOrderNo: string
  techPackVersionLabel: string
  recordStatus: PreparationRecordStatus
  currentBlockerText: string
}

export interface ProductionPreparationKpi {
  key: string
  label: string
  value: number
  unit: string
  hint: string
}

export interface MonthlyPreparationStatRow {
  itemType: PreparationItemType
  completedCount: number
  onTimeCompletedCount: number
  overdueCompletedCount: number
  averageDurationHours: number
  latestFinishedAt: string
}

export interface MonthlyPreparationCompletionDetail extends FlattenedPreparationItem {
  itemStatus: PreparationItemStatus
  required: boolean
  durationHours: number
  onTime: boolean
}

export interface ProductionPreparationFilter {
  month?: string
  merchandiserName?: string
  buyerName?: string
  recordStatus?: PreparationRecordStatus | '全部'
  itemType?: PreparationItemType | '全部'
  ownerTeam?: string
  patternDesigner?: string
  overdueOnly?: boolean
  keyword?: string
  quickFilter?: '我的花型任务' | '待上传完成图' | '待买手确认'
}

export interface ProductionPreparationFilterOptions {
  months: string[]
  merchandiserNames: string[]
  buyerNames: string[]
  recordStatuses: Array<PreparationRecordStatus | '全部'>
  itemTypes: Array<PreparationItemType | '全部'>
  ownerTeams: string[]
  patternDesigners: typeof patternDesignerOptions
}

export const preparationItemTypes: PreparationItemType[] = [
  '梭织基码纸样',
  '毛织基码纸样',
  '版衣制作',
  '梭织齐码纸样',
  '毛织齐码纸样',
  '数码印/DTF/DTG花型',
  '染色调色（纱线）',
  '染色调色（面料）',
  '辅料下单',
]

export const preparationRecordStatuses: PreparationRecordStatus[] = [
  '未开始',
  '进行中',
  '部分超时',
  '已完成',
  '已关闭',
]

export const preparationItemStatuses: PreparationItemStatus[] = [
  '无需',
  '待判断',
  '待分配',
  '待开始',
  '进行中',
  '待确认',
  '已完成',
  '已超时',
]

export const preparationOwnerTeams = ['版师团队', '车板团队', '花型团队', '染色团队', '采购团队', '毛织团队']

export const patternDesignerOptions = [
  { id: 'designer-bingbing', name: '冰冰', teamName: '中国花型组' },
  { id: 'designer-linxiaomei', name: '林小美', teamName: '中国花型组' },
  { id: 'designer-diah', name: 'Diah', teamName: 'Bandung 花型组' },
  { id: 'designer-sari', name: 'Sari', teamName: 'Jakarta 花型组' },
]

type PreparationItemSeed = Omit<
  ProductionPreparationItem,
  | 'itemId'
  | 'recordId'
  | 'sourceObjectType'
  | 'sourceObjectNo'
  | 'sourceHref'
  | 'evidenceType'
  | 'evidenceSummary'
  | 'overdueHours'
  | 'remark'
  | 'requiredKind'
  | 'selectedByMerchandiser'
  | 'selectedAt'
  | 'sequenceGroup'
  | 'dependsOnItemIds'
  | 'parallelGroup'
> &
  Partial<
    Pick<
      ProductionPreparationItem,
      | 'sourceObjectType'
      | 'sourceObjectNo'
      | 'sourceHref'
      | 'evidenceType'
      | 'evidenceSummary'
      | 'overdueHours'
      | 'remark'
      | 'requiredKind'
      | 'selectedByMerchandiser'
      | 'selectedAt'
      | 'sequenceGroup'
      | 'dependsOnItemIds'
      | 'parallelGroup'
    >
  >

type RecordSeed = Omit<
  ProductionPreparationRecord,
  'largeGoodsThresholdQty' | 'reachedThresholdAt' | 'productionOrderHref' | 'outputs' | 'items'
> & {
  items: PreparationItemSeed[]
}

function orderHref(orderNo: string): string {
  return `/fcs/production/orders?keyword=${encodeURIComponent(orderNo)}`
}

function outputsFor(
  recordNo: string,
  orderNo: string,
  ready: boolean,
  items: PreparationItemSeed[],
): ProductionPreparationOutput[] {
  const status: PreparationOutputStatus = ready ? '已生成' : '预计生成'
  const prefix = ready ? '' : '预计'
  const selectedItems = items.filter((item) => item.selectedByMerchandiser !== false)
  const outputs: ProductionPreparationOutput[] = [
    { outputType: '正式技术包', outputNo: `${prefix}TP-${orderNo}`, outputHref: `/fcs/production/orders/${encodeURIComponent(orderNo)}/tech-pack`, outputStatus: status },
    { outputType: '生产单', outputNo: orderNo, outputHref: orderHref(orderNo), outputStatus: status },
  ]

  if (selectedItems.some((item) => item.itemType === '数码印/DTF/DTG花型')) {
    outputs.push({ outputType: '印花单', outputNo: `${prefix}PR-${recordNo.slice(-3)}`, outputHref: '/fcs/craft/printing/orders', outputStatus: status })
  }
  if (selectedItems.some((item) => item.itemType === '染色调色（纱线）' || item.itemType === '染色调色（面料）')) {
    outputs.push({ outputType: '染色单', outputNo: `${prefix}DY-${recordNo.slice(-3)}`, outputHref: '/fcs/craft/dyeing/orders', outputStatus: status })
  }
  if (selectedItems.some((item) => item.itemType === '辅料下单')) {
    outputs.push({ outputType: '辅料采购单', outputNo: `${prefix}AP-${recordNo.slice(-3)}`, outputHref: '/fcs/purchase/accessory-orders', outputStatus: status })
  }

  return outputs
}

function req(
  itemType: PreparationItemType,
  status: PreparationItemStatus,
  ownerTeam: string,
  ownerName: string,
  plannedStartAt: string,
  plannedFinishAt: string,
  actualFinishAt: string,
  sequenceGroup: string,
  dependsOnItemIds: string[],
  parallelGroup: string,
  extra: Partial<PreparationItemSeed> = {},
): PreparationItemSeed {
  return {
    itemType,
    required: true,
    requiredKind: '必做',
    selectedByMerchandiser: true,
    selectedAt: plannedStartAt,
    status,
    ownerTeam,
    ownerName,
    plannedStartAt,
    plannedFinishAt,
    actualFinishAt,
    sequenceGroup,
    dependsOnItemIds,
    parallelGroup,
    ...extra,
  }
}

function opt(
  itemType: PreparationItemType,
  selectedByMerchandiser: boolean,
  status: PreparationItemStatus,
  ownerTeam: string,
  ownerName: string,
  plannedStartAt: string,
  plannedFinishAt: string,
  actualFinishAt: string,
  sequenceGroup: string,
  parallelGroup: string,
  extra: Partial<PreparationItemSeed> = {},
): PreparationItemSeed {
  return {
    itemType,
    required: false,
    requiredKind: '选填',
    selectedByMerchandiser,
    selectedAt: selectedByMerchandiser ? plannedStartAt : '',
    status,
    ownerTeam,
    ownerName,
    plannedStartAt,
    plannedFinishAt,
    actualFinishAt,
    sequenceGroup,
    dependsOnItemIds: [],
    parallelGroup,
    ...extra,
  }
}

function createItems(recordId: string, productionOrderNo: string, seeds: PreparationItemSeed[]): ProductionPreparationItem[] {
  return seeds.map((seed, index) => ({
    itemId: `${recordId}-item-${String(index + 1).padStart(2, '0')}`,
    recordId,
    sourceObjectType: '生产单',
    sourceObjectNo: productionOrderNo,
    sourceHref: orderHref(productionOrderNo),
    evidenceType: '系统记录',
    evidenceSummary: '',
    overdueHours: 0,
    remark: '',
    ...seed,
  }))
}

function record(seed: RecordSeed): ProductionPreparationRecord {
  return {
    ...seed,
    largeGoodsThresholdQty: 300,
    reachedThresholdAt: seed.largeGoodsReachedAt,
    productionOrderHref: orderHref(seed.productionOrderNo),
    outputs: outputsFor(seed.recordNo, seed.productionOrderNo, seed.outputReady, seed.items),
    items: createItems(seed.recordId, seed.productionOrderNo, seed.items),
  }
}

export const productionPreparationRecords: ProductionPreparationRecord[] = [
  record({
    recordId: 'prep-202603-001',
    recordNo: 'PREP-202603-001',
    spuCode: 'SPU-WV-260301',
    spuName: '纯梭织通勤衬衫',
    imageUrl: '/mock/products/spring-print-dress.jpg',
    selectionName: '妮娜',
    buyerName: '沈若琳',
    merchandiserName: 'Maya',
    sourceReason: '销量达标',
    craftTags: ['梭织', '数码印'],
    categoryTags: ['梭织'],
    largeGoodsReachedQty: 426,
    largeGoodsReachedAt: '2026-03-01T10:00:00',
    largeGoodsReachedDays: 4,
    enteredAt: '2026-03-01T11:20:00',
    derivedProductPrepType: '非烫画&非毛织（纯梭织）',
    confirmedProductPrepType: '非烫画&非毛织（纯梭织）',
    prepTypeSource: '系统推导',
    prepTypeConfirmedBy: 'Maya',
    prepTypeConfirmedAt: '2026-03-01T11:35:00',
    prepTypeOverrideReason: '',
    productionDemandNo: 'PD-202603-001',
    productionOrderNo: 'PO-202603-001',
    techPackVersionLabel: 'TP-v3.2',
    techPackPublishedAt: '2026-03-04T17:40:00',
    status: '进行中',
    currentBlockerText: '花型完成图已上传，面料染色未选择，梭织齐码仍在整理',
    expectedFinishAt: '2026-03-05T18:00:00',
    closedReason: '',
    outputReady: false,
    outputPublishedAt: '',
    items: [
      req('梭织基码纸样', '已完成', '版师团队', '陈版师', '2026-03-01T12:00:00', '2026-03-03T12:00:00', '2026-03-02T18:00:00', '梭织主线', [], '梭织基码', { evidenceSummary: 'M 码梭织基码纸样已上传' }),
      req('版衣制作', '已完成', '车板团队', 'Ayu', '2026-03-02T18:00:00', '2026-03-03T18:00:00', '2026-03-03T16:30:00', '梭织主线', ['prep-202603-001-item-01'], '版衣', { evidenceSummary: '版衣照片已上传' }),
      req('梭织齐码纸样', '进行中', '版师团队', '陈版师', '2026-03-03T16:30:00', '2026-03-05T16:30:00', '', '梭织主线', ['prep-202603-001-item-02'], '梭织齐码', { evidenceSummary: 'S-L 齐码纸样整理中' }),
      req('辅料下单', '已完成', '采购团队', '武汉辅料组', '2026-03-01T12:00:00', '2026-03-03T12:00:00', '2026-03-02T15:00:00', '辅料并行', [], '主辅料', { evidenceSummary: '纽扣和洗标采购单已同步' }),
      req('辅料下单', '已完成', '采购团队', '武汉辅料组', '2026-03-01T12:20:00', '2026-03-03T12:00:00', '2026-03-02T17:00:00', '辅料并行', [], '包装辅料', { evidenceSummary: '吊牌和包装袋采购单已同步' }),
      opt('数码印/DTF/DTG花型', true, '待确认', '花型团队', '林小美', '2026-03-01T12:00:00', '2026-03-03T12:00:00', '', '花型并行', '花型', { evidenceSummary: '完成图已上传，待买手确认', patternTaskNo: 'PAT-202603-001', patternDesignerId: 'designer-linxiaomei', patternDesignerName: '林小美', patternTeamName: '中国花型组', assignedAt: '2026-03-01T12:10:00', completionImageIds: ['img-001'], patternFileIds: ['ai-001'], buyerReviewStatus: '待确认' }),
      opt('染色调色（面料）', false, '待判断', '染色团队', '待确认', '', '', '', '染色并行', '面料染色', { evidenceSummary: '跟单未选择面料染色调色' }),
    ],
  }),
  record({
    recordId: 'prep-202603-002',
    recordNo: 'PREP-202603-002',
    spuCode: 'SPU-MX-260302',
    spuName: '毛织拼接梭织短袖上衣',
    imageUrl: '/mock/products/contrast-knit-top.jpg',
    selectionName: '艾拉',
    buyerName: '赵嘉宁',
    merchandiserName: 'Raka',
    sourceReason: '销量达标',
    craftTags: ['毛织拼接', '梭织'],
    categoryTags: ['毛织', '梭织拼接'],
    largeGoodsReachedQty: 388,
    largeGoodsReachedAt: '2026-03-02T15:30:00',
    largeGoodsReachedDays: 5,
    enteredAt: '2026-03-02T16:05:00',
    derivedProductPrepType: '毛织&梭织',
    confirmedProductPrepType: '毛织&梭织',
    prepTypeSource: '系统推导',
    prepTypeConfirmedBy: 'Raka',
    prepTypeConfirmedAt: '2026-03-02T16:20:00',
    prepTypeOverrideReason: '',
    productionDemandNo: 'PD-202603-002',
    productionOrderNo: 'PO-202603-002',
    techPackVersionLabel: 'TP-v1.8',
    techPackPublishedAt: '2026-03-02T14:00:00',
    status: '部分超时',
    currentBlockerText: '毛织基码纸样超时，纱线染色已完成，面料染色仍在复核',
    expectedFinishAt: '2026-03-10T18:00:00',
    closedReason: '',
    outputReady: false,
    outputPublishedAt: '',
    items: [
      req('毛织基码纸样', '已超时', '毛织团队', 'Siti', '2026-03-02T16:30:00', '2026-03-04T18:00:00', '', '双基码并行', [], '毛织基码', { evidenceSummary: '毛织前片基码未回传', overdueHours: 18 }),
      req('梭织基码纸样', '已完成', '版师团队', '梁敏', '2026-03-02T16:30:00', '2026-03-04T18:00:00', '2026-03-04T16:30:00', '双基码并行', [], '梭织基码', { evidenceSummary: '梭织拼接口基码纸样已上传' }),
      req('版衣制作', '待开始', '车板团队', 'Dewi', '2026-03-05T09:00:00', '2026-03-06T18:00:00', '', '混合主线', ['prep-202603-002-item-01', 'prep-202603-002-item-02'], '版衣', { evidenceSummary: '等待毛织基码纸样', overdueHours: 5 }),
      req('毛织齐码纸样', '待开始', '毛织团队', 'Siti', '2026-03-07T09:00:00', '2026-03-08T18:00:00', '', '双齐码并行', ['prep-202603-002-item-03'], '毛织齐码', { evidenceSummary: '等待版衣确认', overdueHours: 6 }),
      req('梭织齐码纸样', '待开始', '版师团队', '梁敏', '2026-03-07T09:00:00', '2026-03-08T18:00:00', '', '双齐码并行', ['prep-202603-002-item-03'], '梭织齐码', { evidenceSummary: '等待版衣确认' }),
      req('辅料下单', '已完成', '采购团队', '何珊', '2026-03-03T09:00:00', '2026-03-05T18:00:00', '2026-03-05T16:10:00', '辅料并行', [], '主辅料', { evidenceSummary: '罗纹和洗标已锁单' }),
      req('辅料下单', '已完成', '采购团队', '何珊', '2026-03-03T09:30:00', '2026-03-05T18:00:00', '2026-03-05T17:40:00', '辅料并行', [], '毛纱辅料', { evidenceSummary: '毛纱批次采购单已同步' }),
      opt('数码印/DTF/DTG花型', false, '待判断', '花型团队', '待确认', '', '', '', '花型并行', '花型', { evidenceSummary: '跟单未选择花型准备' }),
      opt('染色调色（纱线）', true, '已完成', '染色团队', 'Wulan', '2026-03-03T09:00:00', '2026-03-06T18:00:00', '2026-03-06T15:30:00', '染色并行', '纱线染色', { evidenceSummary: '咖色纱线色卡已确认' }),
      opt('染色调色（面料）', true, '进行中', '染色团队', 'Rini', '2026-03-03T09:00:00', '2026-03-06T18:00:00', '', '染色并行', '面料染色', { evidenceSummary: '梭织拼接面料二次调色', overdueHours: 9 }),
    ],
  }),
  record({
    recordId: 'prep-202603-003',
    recordNo: 'PREP-202603-003',
    spuCode: 'SPU-PT-260303',
    spuName: 'DTF 直喷休闲短袖',
    imageUrl: '/mock/products/casual-print-tee.jpg',
    selectionName: '乔安',
    buyerName: '沈若琳',
    merchandiserName: 'Maya',
    sourceReason: '销量达标',
    craftTags: ['DTF', '直喷'],
    categoryTags: ['针织T恤'],
    largeGoodsReachedQty: 512,
    largeGoodsReachedAt: '2026-03-03T10:00:00',
    largeGoodsReachedDays: 3,
    enteredAt: '2026-03-03T10:40:00',
    derivedProductPrepType: '烫画&直喷',
    confirmedProductPrepType: '烫画&直喷',
    prepTypeSource: '系统推导',
    prepTypeConfirmedBy: 'Maya',
    prepTypeConfirmedAt: '2026-03-03T10:50:00',
    prepTypeOverrideReason: '',
    productionDemandNo: 'PD-202603-003',
    productionOrderNo: 'PO-202603-003',
    techPackVersionLabel: 'TP-v2.1',
    techPackPublishedAt: '2026-03-06T14:20:00',
    status: '已完成',
    currentBlockerText: '数码印/DTF/DTG花型已完成并通过买手确认',
    expectedFinishAt: '2026-03-09T18:00:00',
    closedReason: '',
    outputReady: true,
    outputPublishedAt: '2026-03-06T15:00:00',
    items: [
      req('数码印/DTF/DTG花型', '已完成', '花型团队', '冰冰', '2026-03-03T13:00:00', '2026-03-06T18:00:00', '2026-03-06T14:20:00', '花型必做', [], '花型', { evidenceSummary: '胸前 DTF 文件和完成图已通过买手确认', patternTaskNo: 'PAT-202603-003', patternDesignerId: 'designer-bingbing', patternDesignerName: '冰冰', patternTeamName: '中国花型组', assignedAt: '2026-03-03T13:30:00', completionImageIds: ['img-pattern-tee-003'], patternFileIds: ['file-pattern-tee-003'], buyerReviewStatus: '已通过' }),
    ],
  }),
  record({
    recordId: 'prep-202603-004',
    recordNo: 'PREP-202603-004',
    spuCode: 'SPU-KN-260304',
    spuName: '毛织连帽短开衫',
    imageUrl: '/mock/products/hoodie-set.jpg',
    selectionName: '可岚',
    buyerName: '李乔',
    merchandiserName: 'Nadia',
    sourceReason: '前置打板',
    craftTags: ['毛织'],
    categoryTags: ['毛织'],
    largeGoodsReachedQty: 344,
    largeGoodsReachedAt: '2026-03-04T09:40:00',
    largeGoodsReachedDays: 6,
    enteredAt: '2026-03-04T10:10:00',
    derivedProductPrepType: '毛织',
    confirmedProductPrepType: '毛织',
    prepTypeSource: '系统推导',
    prepTypeConfirmedBy: 'Nadia',
    prepTypeConfirmedAt: '2026-03-04T10:20:00',
    prepTypeOverrideReason: '',
    productionDemandNo: 'PD-202603-004',
    productionOrderNo: 'PO-202603-004',
    techPackVersionLabel: 'TP-v1.4',
    techPackPublishedAt: '2026-03-04T09:00:00',
    status: '进行中',
    currentBlockerText: '毛织齐码纸样整理中，面料染色已选择且仍在调色',
    expectedFinishAt: '2026-03-11T18:00:00',
    closedReason: '',
    outputReady: false,
    outputPublishedAt: '',
    items: [
      req('毛织基码纸样', '已完成', '毛织团队', 'Yuni', '2026-03-04T11:00:00', '2026-03-05T18:00:00', '2026-03-05T17:00:00', '毛织主线', [], '毛织基码', { evidenceSummary: '毛织基码纸样已上传' }),
      req('版衣制作', '已完成', '车板团队', 'Dewi', '2026-03-06T09:00:00', '2026-03-07T18:00:00', '2026-03-07T16:50:00', '毛织主线', ['prep-202603-004-item-01'], '版衣', { evidenceSummary: '毛织版衣已完成' }),
      req('毛织齐码纸样', '进行中', '毛织团队', 'Yuni', '2026-03-08T09:00:00', '2026-03-09T18:00:00', '', '毛织主线', ['prep-202603-004-item-02'], '毛织齐码', { evidenceSummary: 'M-XL 毛织齐码整理中' }),
      req('辅料下单', '已完成', '采购团队', '周怡', '2026-03-06T09:00:00', '2026-03-08T18:00:00', '2026-03-08T13:10:00', '辅料并行', [], '主辅料', { evidenceSummary: '拉链和绳头采购单已同步' }),
      req('辅料下单', '已完成', '采购团队', '周怡', '2026-03-06T09:30:00', '2026-03-08T18:00:00', '2026-03-08T15:20:00', '辅料并行', [], '包装辅料', { evidenceSummary: '包装袋采购单已同步' }),
      opt('染色调色（面料）', true, '进行中', '染色团队', 'Wulan', '2026-03-07T09:00:00', '2026-03-10T18:00:00', '', '染色并行', '面料染色', { evidenceSummary: '雾蓝色二次调色中', overdueHours: 3 }),
    ],
  }),
  record({
    recordId: 'prep-202603-005',
    recordNo: 'PREP-202603-005',
    spuCode: 'SPU-WV-260305',
    spuName: '纯梭织户外轻量夹克',
    imageUrl: '/mock/products/light-jacket.jpg',
    selectionName: '米朵',
    buyerName: '李乔',
    merchandiserName: 'Nadia',
    sourceReason: '新类目',
    craftTags: ['梭织'],
    categoryTags: ['梭织'],
    largeGoodsReachedQty: 306,
    largeGoodsReachedAt: '2026-03-05T14:00:00',
    largeGoodsReachedDays: 8,
    enteredAt: '2026-03-05T14:35:00',
    derivedProductPrepType: '非烫画&非毛织（纯梭织）',
    confirmedProductPrepType: '非烫画&非毛织（纯梭织）',
    prepTypeSource: '系统推导',
    prepTypeConfirmedBy: 'Nadia',
    prepTypeConfirmedAt: '2026-03-05T14:45:00',
    prepTypeOverrideReason: '',
    productionDemandNo: 'PD-202603-005',
    productionOrderNo: 'PO-202603-005',
    techPackVersionLabel: 'TP-v0.9',
    techPackPublishedAt: '2026-03-05T13:20:00',
    status: '未开始',
    currentBlockerText: '花型和面料染色均未选择，必做项待分配',
    expectedFinishAt: '2026-03-12T18:00:00',
    closedReason: '',
    outputReady: false,
    outputPublishedAt: '',
    items: [
      req('梭织基码纸样', '待分配', '版师团队', '待分配', '2026-03-05T15:00:00', '2026-03-06T18:00:00', '', '梭织主线', [], '梭织基码', { evidenceSummary: '等待版师接单' }),
      req('版衣制作', '待开始', '车板团队', '待接单', '2026-03-07T09:00:00', '2026-03-08T18:00:00', '', '梭织主线', ['prep-202603-005-item-01'], '版衣', { evidenceSummary: '等待基码纸样' }),
      req('梭织齐码纸样', '待开始', '版师团队', '待分配', '2026-03-09T09:00:00', '2026-03-10T18:00:00', '', '梭织主线', ['prep-202603-005-item-02'], '梭织齐码', { evidenceSummary: '等待版衣确认' }),
      req('辅料下单', '待开始', '采购团队', '待接单', '2026-03-06T09:00:00', '2026-03-08T18:00:00', '', '辅料并行', [], '主辅料', { evidenceSummary: '等待辅料清单确认' }),
      req('辅料下单', '待开始', '采购团队', '待接单', '2026-03-06T09:20:00', '2026-03-08T18:00:00', '', '辅料并行', [], '包装辅料', { evidenceSummary: '等待包装辅料确认' }),
      opt('数码印/DTF/DTG花型', false, '待判断', '花型团队', '待确认', '', '', '', '花型并行', '花型', { evidenceSummary: '跟单未选择花型准备' }),
      opt('染色调色（面料）', false, '待判断', '染色团队', '待确认', '', '', '', '染色并行', '面料染色', { evidenceSummary: '跟单未选择面料染色调色' }),
    ],
  }),
  record({
    recordId: 'prep-202603-006',
    recordNo: 'PREP-202603-006',
    spuCode: 'SPU-KN-260306',
    spuName: '毛织商务针织衫',
    imageUrl: '/mock/products/slim-shirt.jpg',
    selectionName: '若伊',
    buyerName: '赵嘉宁',
    merchandiserName: 'Raka',
    sourceReason: '销量达标',
    craftTags: ['毛织'],
    categoryTags: ['毛织'],
    largeGoodsReachedQty: 472,
    largeGoodsReachedAt: '2026-03-06T09:30:00',
    largeGoodsReachedDays: 4,
    enteredAt: '2026-03-06T10:05:00',
    derivedProductPrepType: '毛织',
    confirmedProductPrepType: '毛织',
    prepTypeSource: '系统推导',
    prepTypeConfirmedBy: 'Raka',
    prepTypeConfirmedAt: '2026-03-06T10:15:00',
    prepTypeOverrideReason: '',
    productionDemandNo: 'PD-202603-006',
    productionOrderNo: 'PO-202603-006',
    techPackVersionLabel: 'TP-v4.0',
    techPackPublishedAt: '2026-03-11T16:00:00',
    status: '已完成',
    currentBlockerText: '毛织主线和辅料下单均已完成，面料染色未选择',
    expectedFinishAt: '2026-03-12T18:00:00',
    closedReason: '',
    outputReady: true,
    outputPublishedAt: '2026-03-11T16:20:00',
    items: [
      req('毛织基码纸样', '已完成', '毛织团队', 'Yuni', '2026-03-06T10:30:00', '2026-03-07T18:00:00', '2026-03-07T15:00:00', '毛织主线', [], '毛织基码', { evidenceSummary: '毛织基码纸样已上传' }),
      req('版衣制作', '已完成', '车板团队', 'Dewi', '2026-03-08T09:00:00', '2026-03-09T18:00:00', '2026-03-09T14:30:00', '毛织主线', ['prep-202603-006-item-01'], '版衣', { evidenceSummary: '针织衫版衣已完成' }),
      req('毛织齐码纸样', '已完成', '毛织团队', 'Yuni', '2026-03-10T09:00:00', '2026-03-11T18:00:00', '2026-03-11T15:30:00', '毛织主线', ['prep-202603-006-item-02'], '毛织齐码', { evidenceSummary: 'S-XXL 毛织齐码纸样已上传' }),
      req('辅料下单', '已完成', '采购团队', '何珊', '2026-03-08T09:00:00', '2026-03-10T18:00:00', '2026-03-10T10:40:00', '辅料并行', [], '主辅料', { evidenceSummary: '纽扣和吊牌已下单' }),
      req('辅料下单', '已完成', '采购团队', '何珊', '2026-03-08T09:20:00', '2026-03-10T18:00:00', '2026-03-10T14:40:00', '辅料并行', [], '包装辅料', { evidenceSummary: '胶袋和尺码贴已下单' }),
      opt('染色调色（面料）', false, '待判断', '染色团队', '待确认', '', '', '', '染色并行', '面料染色', { evidenceSummary: '跟单未选择面料染色调色' }),
    ],
  }),
  record({
    recordId: 'prep-202604-001',
    recordNo: 'PREP-202604-001',
    spuCode: 'SPU-WV-260401',
    spuName: '纯梭织亚麻衬衫',
    imageUrl: '/mock/products/kemeja-linen-pria.jpg',
    selectionName: '拉娜',
    buyerName: 'Alicia',
    merchandiserName: 'Raka',
    sourceReason: '销量达标',
    craftTags: ['梭织'],
    categoryTags: ['梭织'],
    largeGoodsReachedQty: 533,
    largeGoodsReachedAt: '2026-04-01T09:00:00',
    largeGoodsReachedDays: 3,
    enteredAt: '2026-04-01T09:30:00',
    derivedProductPrepType: '非烫画&非毛织（纯梭织）',
    confirmedProductPrepType: '非烫画&非毛织（纯梭织）',
    prepTypeSource: '系统推导',
    prepTypeConfirmedBy: 'Raka',
    prepTypeConfirmedAt: '2026-04-01T09:45:00',
    prepTypeOverrideReason: '',
    productionDemandNo: 'PD-202604-001',
    productionOrderNo: 'PO-202604-001',
    techPackVersionLabel: 'TP-v2.0',
    techPackPublishedAt: '2026-04-06T15:00:00',
    status: '已完成',
    currentBlockerText: '纯梭织必做项全部完成',
    expectedFinishAt: '2026-04-07T18:00:00',
    closedReason: '',
    outputReady: true,
    outputPublishedAt: '2026-04-06T15:30:00',
    items: [
      req('梭织基码纸样', '已完成', '版师团队', '陈晓岚', '2026-04-01T10:00:00', '2026-04-02T18:00:00', '2026-04-02T15:40:00', '梭织主线', [], '梭织基码', { evidenceSummary: '亚麻衬衫基码纸样已上传' }),
      req('版衣制作', '已完成', '车板团队', 'Ayu', '2026-04-03T09:00:00', '2026-04-04T18:00:00', '2026-04-04T17:30:00', '梭织主线', ['prep-202604-001-item-01'], '版衣', { evidenceSummary: '亚麻衬衫版衣已完成' }),
      req('梭织齐码纸样', '已完成', '版师团队', '陈晓岚', '2026-04-05T09:00:00', '2026-04-06T18:00:00', '2026-04-06T14:50:00', '梭织主线', ['prep-202604-001-item-02'], '梭织齐码', { evidenceSummary: 'M-XXL 齐码纸样已上传' }),
      req('辅料下单', '已完成', '采购团队', '何珊', '2026-04-02T09:00:00', '2026-04-04T18:00:00', '2026-04-04T12:20:00', '辅料并行', [], '主辅料', { evidenceSummary: '贝壳扣和洗标已下单' }),
      req('辅料下单', '已完成', '采购团队', '何珊', '2026-04-02T09:20:00', '2026-04-04T18:00:00', '2026-04-04T13:20:00', '辅料并行', [], '包装辅料', { evidenceSummary: '包装辅料采购单已同步' }),
      opt('数码印/DTF/DTG花型', false, '待判断', '花型团队', '待确认', '', '', '', '花型并行', '花型', { evidenceSummary: '纯色亚麻款未选择花型' }),
      opt('染色调色（面料）', false, '待判断', '染色团队', '待确认', '', '', '', '染色并行', '面料染色', { evidenceSummary: '使用现货亚麻本色，未选择染色' }),
    ],
  }),
  record({
    recordId: 'prep-202604-002',
    recordNo: 'PREP-202604-002',
    spuCode: 'SPU-KN-260402',
    spuName: '毛织缎面拼色上衣',
    imageUrl: '/mock/products/blus-wanita-satin.jpg',
    selectionName: '苏拉',
    buyerName: 'Alicia',
    merchandiserName: 'Sinta',
    sourceReason: '人工加入',
    craftTags: ['毛织'],
    categoryTags: ['毛织'],
    largeGoodsReachedQty: 359,
    largeGoodsReachedAt: '2026-04-02T11:10:00',
    largeGoodsReachedDays: 7,
    enteredAt: '2026-04-02T11:40:00',
    derivedProductPrepType: '毛织',
    confirmedProductPrepType: '毛织',
    prepTypeSource: '系统推导',
    prepTypeConfirmedBy: 'Sinta',
    prepTypeConfirmedAt: '2026-04-02T11:55:00',
    prepTypeOverrideReason: '',
    productionDemandNo: 'PD-202604-002',
    productionOrderNo: 'PO-202604-002',
    techPackVersionLabel: 'TP-v1.1',
    techPackPublishedAt: '2026-04-02T10:30:00',
    status: '部分超时',
    currentBlockerText: '毛织齐码纸样和面料染色均超时，色卡待上传',
    expectedFinishAt: '2026-04-09T18:00:00',
    closedReason: '',
    outputReady: false,
    outputPublishedAt: '',
    items: [
      req('毛织基码纸样', '已完成', '毛织团队', 'Yuni', '2026-04-02T12:00:00', '2026-04-03T18:00:00', '2026-04-03T17:40:00', '毛织主线', [], '毛织基码', { evidenceSummary: '毛织基码纸样已上传' }),
      req('版衣制作', '已完成', '车板团队', 'Dewi', '2026-04-04T09:00:00', '2026-04-05T18:00:00', '2026-04-05T17:50:00', '毛织主线', ['prep-202604-002-item-01'], '版衣', { evidenceSummary: '缎面拼色版衣已上传' }),
      req('毛织齐码纸样', '已超时', '毛织团队', 'Yuni', '2026-04-06T09:00:00', '2026-04-07T18:00:00', '', '毛织主线', ['prep-202604-002-item-02'], '毛织齐码', { evidenceSummary: '齐码纸样进行中', overdueHours: 10 }),
      req('辅料下单', '已完成', '采购团队', '周怡', '2026-04-03T09:00:00', '2026-04-05T18:00:00', '2026-04-05T14:30:00', '辅料并行', [], '主辅料', { evidenceSummary: '珍珠扣和吊牌已下单' }),
      req('辅料下单', '已完成', '采购团队', '周怡', '2026-04-03T09:20:00', '2026-04-05T18:00:00', '2026-04-05T16:30:00', '辅料并行', [], '包装辅料', { evidenceSummary: '包装辅料已下单' }),
      opt('染色调色（面料）', true, '已超时', '染色团队', 'Rini', '2026-04-03T09:00:00', '2026-04-06T18:00:00', '', '染色并行', '面料染色', { evidenceSummary: '待上传潘通色卡照片', overdueHours: 14 }),
    ],
  }),
  record({
    recordId: 'prep-202604-003',
    recordNo: 'PREP-202604-003',
    spuCode: 'SPU-PT-260403',
    spuName: '直喷水洗短裤',
    imageUrl: '/mock/products/celana-pendek-pria.jpg',
    selectionName: '迪诺',
    buyerName: 'Alicia',
    merchandiserName: 'Raka',
    sourceReason: '销量达标',
    craftTags: ['直喷', '数码印'],
    categoryTags: ['梭织短裤'],
    largeGoodsReachedQty: 401,
    largeGoodsReachedAt: '2026-04-03T09:20:00',
    largeGoodsReachedDays: 4,
    enteredAt: '2026-04-03T10:00:00',
    derivedProductPrepType: '烫画&直喷',
    confirmedProductPrepType: '烫画&直喷',
    prepTypeSource: '系统推导',
    prepTypeConfirmedBy: 'Raka',
    prepTypeConfirmedAt: '2026-04-03T10:12:00',
    prepTypeOverrideReason: '',
    productionDemandNo: 'PD-202604-003',
    productionOrderNo: 'PO-202604-003',
    techPackVersionLabel: 'TP-v1.5',
    techPackPublishedAt: '2026-04-03T08:50:00',
    status: '进行中',
    currentBlockerText: '花型已分配 Diah，缺完成图上传',
    expectedFinishAt: '2026-04-10T18:00:00',
    closedReason: '',
    outputReady: false,
    outputPublishedAt: '',
    items: [
      req('数码印/DTF/DTG花型', '进行中', '花型团队', 'Diah', '2026-04-03T13:00:00', '2026-04-06T18:00:00', '', '花型必做', [], '花型', { evidenceSummary: 'Diah 已接单，缺完成图上传', overdueHours: 8, remark: '保留分配和上传检查场景', patternTaskNo: 'PAT-202604-003', patternDesignerId: 'designer-diah', patternDesignerName: 'Diah', patternTeamName: 'Bandung 花型组', assignedAt: '2026-04-03T13:20:00', completionImageIds: [], patternFileIds: ['file-pattern-shorts-003'], buyerReviewStatus: '未提交' }),
    ],
  }),
  record({
    recordId: 'prep-202604-004',
    recordNo: 'PREP-202604-004',
    spuCode: 'SPU-MX-260404',
    spuName: '毛织梭织拼接休闲T恤',
    imageUrl: '/mock/products/spring-casual-tee.jpg',
    selectionName: '桑妮',
    buyerName: '沈若琳',
    merchandiserName: 'Maya',
    sourceReason: '销量达标',
    craftTags: ['毛织拼接', '数码印'],
    categoryTags: ['梭织', '毛织拼接'],
    largeGoodsReachedQty: 364,
    largeGoodsReachedAt: '2026-04-04T15:00:00',
    largeGoodsReachedDays: 5,
    enteredAt: '2026-04-04T15:25:00',
    derivedProductPrepType: '毛织',
    confirmedProductPrepType: '毛织&梭织',
    prepTypeSource: '人工修正',
    prepTypeConfirmedBy: 'Maya',
    prepTypeConfirmedAt: '2026-04-04T15:40:00',
    prepTypeOverrideReason: '技术包确认前片为毛织罗纹，后片为梭织拼接，需同时准备毛织和梭织纸样',
    productionDemandNo: 'PD-202604-004',
    productionOrderNo: 'PO-202604-004',
    techPackVersionLabel: 'TP-v0.6',
    techPackPublishedAt: '2026-04-04T14:40:00',
    status: '进行中',
    currentBlockerText: '花型已选择，纱线染色未选择，面料染色仍在进行',
    expectedFinishAt: '2026-04-11T18:00:00',
    closedReason: '',
    outputReady: false,
    outputPublishedAt: '',
    items: [
      req('毛织基码纸样', '已完成', '毛织团队', 'Yuni', '2026-04-04T16:00:00', '2026-04-06T18:00:00', '2026-04-06T17:10:00', '双基码并行', [], '毛织基码', { evidenceSummary: '毛织基码纸样已上传' }),
      req('梭织基码纸样', '已完成', '版师团队', '陈晓岚', '2026-04-04T16:00:00', '2026-04-06T18:00:00', '2026-04-06T16:20:00', '双基码并行', [], '梭织基码', { evidenceSummary: '梭织基码纸样已上传' }),
      req('版衣制作', '进行中', '车板团队', 'Ayu', '2026-04-07T09:00:00', '2026-04-08T18:00:00', '', '混合主线', ['prep-202604-004-item-01', 'prep-202604-004-item-02'], '版衣', { evidenceSummary: '拼接版衣制作中' }),
      req('毛织齐码纸样', '待开始', '毛织团队', 'Yuni', '2026-04-09T09:00:00', '2026-04-10T18:00:00', '', '双齐码并行', ['prep-202604-004-item-03'], '毛织齐码', { evidenceSummary: '等待版衣确认' }),
      req('梭织齐码纸样', '待开始', '版师团队', '陈晓岚', '2026-04-09T09:00:00', '2026-04-10T18:00:00', '', '双齐码并行', ['prep-202604-004-item-03'], '梭织齐码', { evidenceSummary: '等待版衣确认' }),
      req('辅料下单', '已完成', '采购团队', '何珊', '2026-04-05T09:00:00', '2026-04-07T18:00:00', '2026-04-07T15:30:00', '辅料并行', [], '主辅料', { evidenceSummary: '领标和罗纹辅料已下单' }),
      req('辅料下单', '已完成', '采购团队', '何珊', '2026-04-05T09:20:00', '2026-04-07T18:00:00', '2026-04-07T19:00:00', '辅料并行', [], '包装辅料', { evidenceSummary: '包装辅料已下单', overdueHours: 1 }),
      opt('数码印/DTF/DTG花型', true, '待确认', '花型团队', 'Sari', '2026-04-05T09:00:00', '2026-04-08T18:00:00', '', '花型并行', '花型', { evidenceSummary: '花型完成图待买手确认', overdueHours: 6, patternTaskNo: 'PAT-202604-004', patternDesignerId: 'designer-sari', patternDesignerName: 'Sari', patternTeamName: 'Jakarta 花型组', assignedAt: '2026-04-05T09:20:00', completionImageIds: ['img-pattern-004'], patternFileIds: ['file-pattern-004'], buyerReviewStatus: '待确认' }),
      opt('染色调色（纱线）', false, '待判断', '染色团队', '待确认', '', '', '', '染色并行', '纱线染色', { evidenceSummary: '跟单未选择纱线染色' }),
      opt('染色调色（面料）', true, '进行中', '染色团队', 'Rini', '2026-04-05T09:00:00', '2026-04-08T18:00:00', '', '染色并行', '面料染色', { evidenceSummary: '面料染色二次复核', overdueHours: 4 }),
    ],
  }),
  record({
    recordId: 'prep-202604-005',
    recordNo: 'PREP-202604-005',
    spuCode: 'SPU-PT-260405',
    spuName: 'DTG 图案基础T恤',
    imageUrl: '/mock/products/basic-print-tee.jpg',
    selectionName: '露西',
    buyerName: '沈若琳',
    merchandiserName: 'Maya',
    sourceReason: '销量达标',
    craftTags: ['DTG', '数码印'],
    categoryTags: ['针织T恤'],
    largeGoodsReachedQty: 318,
    largeGoodsReachedAt: '2026-04-05T10:30:00',
    largeGoodsReachedDays: 6,
    enteredAt: '2026-04-05T11:00:00',
    derivedProductPrepType: '烫画&直喷',
    confirmedProductPrepType: '烫画&直喷',
    prepTypeSource: '系统推导',
    prepTypeConfirmedBy: 'Maya',
    prepTypeConfirmedAt: '2026-04-05T11:10:00',
    prepTypeOverrideReason: '',
    productionDemandNo: 'PD-202604-005',
    productionOrderNo: 'PO-202604-005',
    techPackVersionLabel: 'TP-v0.8',
    techPackPublishedAt: '2026-04-05T10:10:00',
    status: '未开始',
    currentBlockerText: '花型待分配',
    expectedFinishAt: '2026-04-12T18:00:00',
    closedReason: '',
    outputReady: false,
    outputPublishedAt: '',
    items: [
      req('数码印/DTF/DTG花型', '待分配', '花型团队', '待分配', '2026-04-05T13:00:00', '2026-04-08T18:00:00', '', '花型必做', [], '花型', { evidenceSummary: '等待花型师接单', completionImageIds: [], patternFileIds: [], buyerReviewStatus: '未提交' }),
    ],
  }),
  record({
    recordId: 'prep-202604-006',
    recordNo: 'PREP-202604-006',
    spuCode: 'SPU-MX-260406',
    spuName: '毛织梭织拼接开衫',
    imageUrl: '/mock/products/sweater-rajut-wanita.jpg',
    selectionName: '贝拉',
    buyerName: 'Alicia',
    merchandiserName: 'Sinta',
    sourceReason: '销量达标',
    craftTags: ['毛织拼接', '梭织'],
    categoryTags: ['毛织', '梭织拼接'],
    largeGoodsReachedQty: 489,
    largeGoodsReachedAt: '2026-04-06T09:30:00',
    largeGoodsReachedDays: 4,
    enteredAt: '2026-04-06T10:00:00',
    derivedProductPrepType: '毛织&梭织',
    confirmedProductPrepType: '毛织&梭织',
    prepTypeSource: '系统推导',
    prepTypeConfirmedBy: 'Sinta',
    prepTypeConfirmedAt: '2026-04-06T10:15:00',
    prepTypeOverrideReason: '',
    productionDemandNo: 'PD-202604-006',
    productionOrderNo: 'PO-202604-006',
    techPackVersionLabel: 'TP-v2.4',
    techPackPublishedAt: '2026-04-12T16:00:00',
    status: '已完成',
    currentBlockerText: '毛织&梭织全部已选准备项完成',
    expectedFinishAt: '2026-04-13T18:00:00',
    closedReason: '',
    outputReady: true,
    outputPublishedAt: '2026-04-12T16:30:00',
    items: [
      req('毛织基码纸样', '已完成', '毛织团队', 'Yuni', '2026-04-06T11:00:00', '2026-04-08T18:00:00', '2026-04-08T16:40:00', '双基码并行', [], '毛织基码', { evidenceSummary: '毛织基码纸样已上传' }),
      req('梭织基码纸样', '已完成', '版师团队', '梁敏', '2026-04-06T11:00:00', '2026-04-08T18:00:00', '2026-04-08T15:30:00', '双基码并行', [], '梭织基码', { evidenceSummary: '梭织基码纸样已上传' }),
      req('版衣制作', '已完成', '车板团队', 'Dewi', '2026-04-09T09:00:00', '2026-04-10T18:00:00', '2026-04-10T16:20:00', '混合主线', ['prep-202604-006-item-01', 'prep-202604-006-item-02'], '版衣', { evidenceSummary: '拼接开衫版衣已完成' }),
      req('毛织齐码纸样', '已完成', '毛织团队', 'Yuni', '2026-04-11T09:00:00', '2026-04-12T18:00:00', '2026-04-12T14:40:00', '双齐码并行', ['prep-202604-006-item-03'], '毛织齐码', { evidenceSummary: '毛织齐码纸样已上传' }),
      req('梭织齐码纸样', '已完成', '版师团队', '梁敏', '2026-04-11T09:00:00', '2026-04-12T18:00:00', '2026-04-12T15:10:00', '双齐码并行', ['prep-202604-006-item-03'], '梭织齐码', { evidenceSummary: '梭织齐码纸样已上传' }),
      req('辅料下单', '已完成', '采购团队', '周怡', '2026-04-07T09:00:00', '2026-04-09T18:00:00', '2026-04-09T14:50:00', '辅料并行', [], '主辅料', { evidenceSummary: '扣具和罗纹辅料已下单' }),
      req('辅料下单', '已完成', '采购团队', '周怡', '2026-04-07T09:20:00', '2026-04-09T18:00:00', '2026-04-09T15:20:00', '辅料并行', [], '包装辅料', { evidenceSummary: '包装辅料已下单' }),
      opt('数码印/DTF/DTG花型', false, '待判断', '花型团队', '待确认', '', '', '', '花型并行', '花型', { evidenceSummary: '跟单未选择花型准备' }),
      opt('染色调色（纱线）', true, '已完成', '染色团队', 'Wulan', '2026-04-07T09:00:00', '2026-04-10T18:00:00', '2026-04-10T15:30:00', '染色并行', '纱线染色', { evidenceSummary: '纱线灰蓝色卡已确认' }),
      opt('染色调色（面料）', true, '已完成', '染色团队', 'Rini', '2026-04-07T09:00:00', '2026-04-10T18:00:00', '2026-04-10T16:10:00', '染色并行', '面料染色', { evidenceSummary: '梭织面料浅灰色卡已确认' }),
    ],
  }),
]

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort()
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function resolvePatternDesignerName(value?: string): string {
  if (!value) return ''
  const option = patternDesignerOptions.find((designer) => designer.id === value || designer.name === value)
  return option?.name ?? value
}

function matchesKeyword(record: ProductionPreparationRecord, keyword: string): boolean {
  if (!keyword) return true
  const haystack = [
    record.recordNo,
    record.spuCode,
    record.spuName,
    record.selectionName,
    record.productionDemandNo,
    record.productionOrderNo,
    record.techPackVersionLabel,
    record.buyerName,
    record.merchandiserName,
    record.confirmedProductPrepType,
    ...record.craftTags,
    ...record.categoryTags,
    ...record.items.flatMap((item) => [
      item.itemType,
      item.status,
      item.ownerTeam,
      item.ownerName,
      item.evidenceSummary,
      item.sourceObjectNo,
      item.patternTaskNo,
      item.patternDesignerName,
      item.patternTeamName,
    ]),
  ]
  return haystack.some((value) => normalize(value).includes(keyword))
}

function hasPatternUploadGap(item: ProductionPreparationItem): boolean {
  return (
    item.itemType === '数码印/DTF/DTG花型' &&
    item.selectedByMerchandiser === true &&
    item.status !== '无需' &&
    (!item.completionImageIds?.length || !item.patternFileIds?.length)
  )
}

function matchesCompletionItemFilter(item: FlattenedPreparationItem, filter: ProductionPreparationFilter): boolean {
  const patternDesigner =
    filter.quickFilter === '我的花型任务'
      ? '林小美'
      : resolvePatternDesignerName(filter.patternDesigner)

  if (filter.itemType && filter.itemType !== '全部' && item.itemType !== filter.itemType) return false
  if (filter.ownerTeam && item.ownerTeam !== filter.ownerTeam) return false
  if (patternDesigner && (item.itemType !== '数码印/DTF/DTG花型' || item.patternDesignerName !== patternDesigner)) return false
  if (filter.overdueOnly && !(item.status === '已超时' || item.overdueHours > 0)) return false
  if (filter.quickFilter === '待上传完成图' && !hasPatternUploadGap(item)) return false
  if (
    filter.quickFilter === '待买手确认' &&
    !(item.itemType === '数码印/DTF/DTG花型' && item.buyerReviewStatus === '待确认')
  ) {
    return false
  }

  return true
}

export function filterProductionPreparationRecords(
  filter: ProductionPreparationFilter = {},
  records: ProductionPreparationRecord[] = productionPreparationRecords,
): ProductionPreparationRecord[] {
  const keyword = normalize(filter.keyword)
  const patternDesigner =
    filter.quickFilter === '我的花型任务'
      ? '林小美'
      : resolvePatternDesignerName(filter.patternDesigner)

  return records.filter((record) => {
    if (filter.month) {
      const enteredInMonth = record.enteredAt.startsWith(filter.month)
      const finishedInMonth = record.items.some((item) => item.actualFinishAt.startsWith(filter.month ?? ''))
      if (!enteredInMonth && !finishedInMonth) return false
    }

    if (filter.merchandiserName && record.merchandiserName !== filter.merchandiserName) return false
    if (filter.buyerName && record.buyerName !== filter.buyerName) return false
    if (filter.recordStatus && filter.recordStatus !== '全部' && record.status !== filter.recordStatus) return false
    if (
      filter.itemType &&
      filter.itemType !== '全部' &&
      !record.items.some((item) => item.selectedByMerchandiser === true && item.itemType === filter.itemType)
    ) {
      return false
    }
    if (
      filter.ownerTeam &&
      !record.items.some((item) => item.selectedByMerchandiser === true && item.ownerTeam === filter.ownerTeam)
    ) {
      return false
    }
    if (
      patternDesigner &&
      !record.items.some((item) => item.itemType === '数码印/DTF/DTG花型' && item.patternDesignerName === patternDesigner)
    ) {
      return false
    }
    if (filter.overdueOnly && !record.items.some((item) => item.status === '已超时' || item.overdueHours > 0)) {
      return false
    }
    if (filter.quickFilter === '待上传完成图' && !record.items.some(hasPatternUploadGap)) return false
    if (
      filter.quickFilter === '待买手确认' &&
      !record.items.some((item) => item.itemType === '数码印/DTF/DTG花型' && item.buyerReviewStatus === '待确认')
    ) {
      return false
    }
    if (!matchesKeyword(record, keyword)) return false

    return true
  })
}

export function flattenProductionPreparationItems(
  records: ProductionPreparationRecord[] = productionPreparationRecords,
): FlattenedPreparationItem[] {
  return records.flatMap((record) =>
    record.items.map((item) => ({
      ...item,
      recordNo: record.recordNo,
      spuCode: record.spuCode,
      spuName: record.spuName,
      imageUrl: record.imageUrl,
      confirmedProductPrepType: record.confirmedProductPrepType,
      buyerName: record.buyerName,
      merchandiserName: record.merchandiserName,
      sourceReason: record.sourceReason,
      enteredAt: record.enteredAt,
      productionDemandNo: record.productionDemandNo,
      productionOrderNo: record.productionOrderNo,
      techPackVersionLabel: record.techPackVersionLabel,
      recordStatus: record.status,
      currentBlockerText: record.currentBlockerText,
    })),
  )
}

function durationHours(startAt: string, finishAt: string): number {
  if (!startAt || !finishAt) return 0
  return (new Date(finishAt).getTime() - new Date(startAt).getTime()) / 36e5
}

export function buildProductionPreparationKpis(
  records: ProductionPreparationRecord[] = productionPreparationRecords,
): ProductionPreparationKpi[] {
  const activeRecords = records.filter((record) => record.status !== '已关闭')
  const requiredItems = flattenProductionPreparationItems(activeRecords).filter((item) => item.selectedByMerchandiser)
  const completedCount = requiredItems.filter((item) => item.status === '已完成').length
  const overdueCount = requiredItems.filter((item) => item.status === '已超时' || item.overdueHours > 0).length
  const completionRate = requiredItems.length ? Math.round((completedCount / requiredItems.length) * 100) : 0
  const pendingBuyerReviewCount = requiredItems.filter(
    (item) => item.itemType === '数码印/DTF/DTG花型' && item.buyerReviewStatus === '待确认',
  ).length

  return [
    {
      key: 'active-records',
      label: '准备记录',
      value: activeRecords.length,
      unit: '条',
      hint: '不含已关闭记录',
    },
    {
      key: 'required-items',
      label: '已选准备项',
      value: requiredItems.length,
      unit: '项',
      hint: '必做项和跟单已选择选填项',
    },
    {
      key: 'completion-rate',
      label: '完成率',
      value: completionRate,
      unit: '%',
      hint: '已完成已选项 / 全部已选项',
    },
    {
      key: 'overdue-items',
      label: '超时项',
      value: overdueCount,
      unit: '项',
      hint: '状态超时或已有超时小时数',
    },
    {
      key: 'pending-buyer-review',
      label: '待买手确认',
      value: pendingBuyerReviewCount,
      unit: '项',
      hint: '花型完成图待买手确认',
    },
  ]
}

export function buildMonthlyPreparationCompletionDetails(
  month: string,
  filter: ProductionPreparationFilter = {},
): MonthlyPreparationCompletionDetail[] {
  const { month: _ignoredMonth, ...recordFilter } = filter
  return flattenProductionPreparationItems(filterProductionPreparationRecords(recordFilter))
    .filter(
      (item) =>
        matchesCompletionItemFilter(item, recordFilter) &&
        item.recordStatus !== '已关闭' &&
        item.selectedByMerchandiser === true &&
        item.status === '已完成' &&
        item.actualFinishAt.startsWith(month),
    )
    .map((item) => {
      const hours = durationHours(item.plannedStartAt, item.actualFinishAt)
      return {
        ...item,
        itemStatus: item.status,
        required: item.required,
        durationHours: Number(hours.toFixed(1)),
        onTime: item.actualFinishAt <= item.plannedFinishAt,
      }
    })
}

export function buildMonthlyPreparationStats(
  month: string,
  filter: ProductionPreparationFilter = {},
): MonthlyPreparationStatRow[] {
  const details = buildMonthlyPreparationCompletionDetails(month, filter)

  return preparationItemTypes.map((itemType) => {
    const rows = details.filter((detail) => detail.itemType === itemType)
    const durationTotal = rows.reduce((sum, row) => sum + durationHours(row.plannedStartAt, row.actualFinishAt), 0)
    return {
      itemType,
      completedCount: rows.length,
      onTimeCompletedCount: rows.filter((row) => row.onTime).length,
      overdueCompletedCount: rows.filter((row) => !row.onTime).length,
      averageDurationHours: rows.length ? Number((durationTotal / rows.length).toFixed(1)) : 0,
      latestFinishedAt: rows.reduce((latest, row) => (row.actualFinishAt > latest ? row.actualFinishAt : latest), ''),
    }
  })
}

export function getProductionPreparationRecord(recordId: string): ProductionPreparationRecord | null {
  return productionPreparationRecords.find((record) => record.recordId === recordId) ?? null
}

export function getProductionPreparationFilterOptions(): ProductionPreparationFilterOptions {
  const items = flattenProductionPreparationItems()
  return {
    months: uniqueSorted([
      ...productionPreparationRecords.map((record) => record.enteredAt.slice(0, 7)),
      ...items.map((item) => item.actualFinishAt.slice(0, 7)),
    ]),
    merchandiserNames: uniqueSorted(productionPreparationRecords.map((record) => record.merchandiserName)),
    buyerNames: uniqueSorted(productionPreparationRecords.map((record) => record.buyerName)),
    recordStatuses: ['全部', ...preparationRecordStatuses],
    itemTypes: ['全部', ...preparationItemTypes],
    ownerTeams: preparationOwnerTeams,
    patternDesigners: patternDesignerOptions,
  }
}
