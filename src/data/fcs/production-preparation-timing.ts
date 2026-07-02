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

function orderHref(orderNo: string): string {
  return `/fcs/production/orders?keyword=${encodeURIComponent(orderNo)}`
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
    requiredKind: seed.required ? '必做' : '选填',
    selectedByMerchandiser: seed.required,
    selectedAt: seed.required ? seed.plannedStartAt : '',
    sequenceGroup: 'parallel',
    dependsOnItemIds: [],
    parallelGroup: '准备并行',
    ...seed,
  }))
}

export const productionPreparationRecords: ProductionPreparationRecord[] = [
  {
    recordId: 'prep-202603-001',
    recordNo: 'PREP-202603-001',
    spuCode: 'SPU-DR-260301',
    spuName: '春季定位印花连衣裙',
    imageUrl: '/mock/products/spring-print-dress.jpg',
    buyerName: '沈若琳',
    merchandiserName: 'Maya',
    sourceReason: '销量达标',
    reachedThresholdAt: '2026-03-01T10:00:00',
    enteredAt: '2026-03-01T11:20:00',
    productionDemandNo: 'PD-202603-001',
    productionOrderNo: 'PO-202603-001',
    productionOrderHref: orderHref('PO-202603-001'),
    techPackVersionLabel: 'TP-v3.2',
    techPackPublishedAt: '2026-03-01T09:30:00',
    status: '进行中',
    currentBlockerText: '花型完成图已上传，等待买手确认',
    expectedFinishAt: '2026-03-08T18:00:00',
    closedReason: '',
    items: createItems('prep-202603-001', 'PO-202603-001', [
      {
        itemType: '基码纸样',
        required: true,
        status: '已完成',
        ownerTeam: '版师团队',
        ownerName: '陈晓岚',
        plannedStartAt: '2026-03-01T12:00:00',
        plannedFinishAt: '2026-03-02T18:00:00',
        actualFinishAt: '2026-03-02T16:20:00',
        evidenceType: '纸样文件',
        evidenceSummary: '基码 M 码纸样已归档',
        remark: '已同步给车板团队',
      },
      {
        itemType: '版衣制作',
        required: true,
        status: '已完成',
        ownerTeam: '车板团队',
        ownerName: 'Ayu',
        plannedStartAt: '2026-03-03T09:00:00',
        plannedFinishAt: '2026-03-04T18:00:00',
        actualFinishAt: '2026-03-04T17:40:00',
        evidenceType: '版衣照片',
        evidenceSummary: '定位印花版衣已拍照上传',
        remark: '版型一次通过',
      },
      {
        itemType: '齐码纸样',
        required: true,
        status: '已完成',
        ownerTeam: '版师团队',
        ownerName: '陈晓岚',
        plannedStartAt: '2026-03-05T09:00:00',
        plannedFinishAt: '2026-03-06T18:00:00',
        actualFinishAt: '2026-03-06T16:30:00',
        evidenceType: '齐码文件',
        evidenceSummary: 'S-L 齐码纸样已上传',
        remark: '齐码尺码差确认完成',
      },
      {
        itemType: '花型',
        required: true,
        status: '待确认',
        ownerTeam: '花型团队',
        ownerName: '林小美',
        plannedStartAt: '2026-03-02T09:00:00',
        plannedFinishAt: '2026-03-05T18:00:00',
        actualFinishAt: '',
        evidenceType: '完成图',
        evidenceSummary: '定位印花完成图已上传，待买手确认',
        remark: '买手需确认花位比例',
        patternTaskNo: 'PAT-202603-001',
        patternDesignerId: 'designer-linxiaomei',
        patternDesignerName: '林小美',
        patternTeamName: '中国花型组',
        assignedAt: '2026-03-02T10:00:00',
        completionImageIds: ['img-pattern-dress-001'],
        patternFileIds: ['file-pattern-dress-001'],
        buyerReviewStatus: '待确认',
      },
      {
        itemType: '染色调色',
        required: true,
        status: '已完成',
        ownerTeam: '染色团队',
        ownerName: 'Rini',
        plannedStartAt: '2026-03-03T09:00:00',
        plannedFinishAt: '2026-03-06T18:00:00',
        actualFinishAt: '2026-03-06T15:50:00',
        evidenceType: '色卡照片',
        evidenceSummary: '底布浅杏色卡已上传',
        remark: '潘通色号已写入技术包',
      },
      {
        itemType: '辅料下单',
        required: true,
        status: '已完成',
        ownerTeam: '采购团队',
        ownerName: '周怡',
        plannedStartAt: '2026-03-03T09:00:00',
        plannedFinishAt: '2026-03-05T18:00:00',
        actualFinishAt: '2026-03-05T11:30:00',
        evidenceType: '采购单',
        evidenceSummary: '隐形拉链和洗标已下单',
        remark: '供应商确认 3 月 10 日到仓',
      },
    ]),
  },
  {
    recordId: 'prep-202603-002',
    recordNo: 'PREP-202603-002',
    spuCode: 'SPU-KN-260302',
    spuName: '毛织撞色短袖上衣',
    imageUrl: '/mock/products/contrast-knit-top.jpg',
    buyerName: '赵嘉宁',
    merchandiserName: 'Raka',
    sourceReason: '人工加入',
    reachedThresholdAt: '2026-03-02T15:30:00',
    enteredAt: '2026-03-02T16:05:00',
    productionDemandNo: 'PD-202603-002',
    productionOrderNo: 'PO-202603-002',
    productionOrderHref: orderHref('PO-202603-002'),
    techPackVersionLabel: 'TP-v1.8',
    techPackPublishedAt: '2026-03-02T14:00:00',
    status: '部分超时',
    currentBlockerText: '毛织纸样已超计划 16 小时，齐码需等待毛织样确认',
    expectedFinishAt: '2026-03-10T18:00:00',
    closedReason: '',
    items: createItems('prep-202603-002', 'PO-202603-002', [
      {
        itemType: '基码纸样',
        required: true,
        status: '已完成',
        ownerTeam: '版师团队',
        ownerName: '梁敏',
        plannedStartAt: '2026-03-02T16:30:00',
        plannedFinishAt: '2026-03-03T18:00:00',
        actualFinishAt: '2026-03-03T17:20:00',
        evidenceType: '纸样文件',
        evidenceSummary: '梭织拼接基码纸样已上传',
        remark: '等待毛织样尺寸回填',
      },
      {
        itemType: '版衣制作',
        required: true,
        status: '已完成',
        ownerTeam: '车板团队',
        ownerName: 'Dewi',
        plannedStartAt: '2026-03-04T09:00:00',
        plannedFinishAt: '2026-03-05T18:00:00',
        actualFinishAt: '2026-03-05T19:30:00',
        evidenceType: '版衣照片',
        evidenceSummary: '撞色短袖版衣已完成',
        overdueHours: 1.5,
        remark: '袖口撞色线需二次确认',
      },
      {
        itemType: '齐码纸样',
        required: true,
        status: '待开始',
        ownerTeam: '版师团队',
        ownerName: '梁敏',
        plannedStartAt: '2026-03-06T09:00:00',
        plannedFinishAt: '2026-03-07T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '等待毛织纸样先完成',
        remark: '串行卡住',
      },
      {
        itemType: '毛织纸样',
        required: true,
        status: '已超时',
        ownerTeam: '毛织团队',
        ownerName: 'Siti',
        plannedStartAt: '2026-03-04T09:00:00',
        plannedFinishAt: '2026-03-06T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '毛织样衣尺寸未回传',
        overdueHours: 16,
        remark: '需毛织团队补上传结构图',
      },
      {
        itemType: '染色调色',
        required: true,
        status: '进行中',
        ownerTeam: '染色团队',
        ownerName: 'Rini',
        plannedStartAt: '2026-03-05T09:00:00',
        plannedFinishAt: '2026-03-08T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '撞色咖啡色正在调色',
        remark: '优先确认袖口配色',
      },
      {
        itemType: '辅料下单',
        required: false,
        status: '无需',
        ownerTeam: '采购团队',
        ownerName: '无需',
        plannedStartAt: '',
        plannedFinishAt: '',
        actualFinishAt: '',
        evidenceSummary: '无新增辅料采购',
        remark: '使用库存洗标',
      },
    ]),
  },
  {
    recordId: 'prep-202603-003',
    recordNo: 'PREP-202603-003',
    spuCode: 'SPU-TS-260303',
    spuName: '春季休闲印花短袖 T 恤',
    imageUrl: '/mock/products/casual-print-tee.jpg',
    buyerName: '沈若琳',
    merchandiserName: 'Maya',
    sourceReason: '销量达标',
    reachedThresholdAt: '2026-03-03T10:00:00',
    enteredAt: '2026-03-03T10:40:00',
    productionDemandNo: 'PD-202603-003',
    productionOrderNo: 'PO-202603-003',
    productionOrderHref: orderHref('PO-202603-003'),
    techPackVersionLabel: 'TP-v2.1',
    techPackPublishedAt: '2026-03-03T09:10:00',
    status: '已完成',
    currentBlockerText: '所有准备项已完成',
    expectedFinishAt: '2026-03-09T18:00:00',
    closedReason: '',
    items: createItems('prep-202603-003', 'PO-202603-003', [
      {
        itemType: '基码纸样',
        required: true,
        status: '已完成',
        ownerTeam: '版师团队',
        ownerName: '陈晓岚',
        plannedStartAt: '2026-03-03T11:00:00',
        plannedFinishAt: '2026-03-04T18:00:00',
        actualFinishAt: '2026-03-04T16:00:00',
        evidenceType: '纸样文件',
        evidenceSummary: 'T 恤 M 码纸样已上传',
        remark: '圆领版型沿用上一季',
      },
      {
        itemType: '版衣制作',
        required: true,
        status: '已完成',
        ownerTeam: '车板团队',
        ownerName: 'Ayu',
        plannedStartAt: '2026-03-05T09:00:00',
        plannedFinishAt: '2026-03-06T18:00:00',
        actualFinishAt: '2026-03-06T16:40:00',
        evidenceType: '版衣照片',
        evidenceSummary: '短袖版衣已上传',
        remark: '洗后尺寸稳定',
      },
      {
        itemType: '齐码纸样',
        required: true,
        status: '已完成',
        ownerTeam: '版师团队',
        ownerName: '陈晓岚',
        plannedStartAt: '2026-03-07T09:00:00',
        plannedFinishAt: '2026-03-08T18:00:00',
        actualFinishAt: '2026-03-08T15:30:00',
        evidenceType: '齐码文件',
        evidenceSummary: 'S-XL 齐码纸样已上传',
        remark: '已同步工厂开裁前检查',
      },
      {
        itemType: '花型',
        required: true,
        status: '已完成',
        ownerTeam: '花型团队',
        ownerName: '冰冰',
        plannedStartAt: '2026-03-03T13:00:00',
        plannedFinishAt: '2026-03-06T18:00:00',
        actualFinishAt: '2026-03-06T14:20:00',
        evidenceType: '花型文件',
        evidenceSummary: '胸前印花文件和完成图已通过买手确认',
        remark: '买手已通过',
        patternTaskNo: 'PAT-202603-003',
        patternDesignerId: 'designer-bingbing',
        patternDesignerName: '冰冰',
        patternTeamName: '中国花型组',
        assignedAt: '2026-03-03T13:30:00',
        completionImageIds: ['img-pattern-tee-003'],
        patternFileIds: ['file-pattern-tee-003'],
        buyerReviewStatus: '已通过',
      },
      {
        itemType: '染色调色',
        required: true,
        status: '已完成',
        ownerTeam: '染色团队',
        ownerName: 'Rini',
        plannedStartAt: '2026-03-04T09:00:00',
        plannedFinishAt: '2026-03-07T18:00:00',
        actualFinishAt: '2026-03-07T12:15:00',
        evidenceType: '色卡照片',
        evidenceSummary: '米白底色确认完成',
        remark: '色卡已随技术包发布',
      },
      {
        itemType: '辅料下单',
        required: true,
        status: '已完成',
        ownerTeam: '采购团队',
        ownerName: '周怡',
        plannedStartAt: '2026-03-04T09:00:00',
        plannedFinishAt: '2026-03-06T18:00:00',
        actualFinishAt: '2026-03-06T10:20:00',
        evidenceType: '采购单',
        evidenceSummary: '领标、吊牌和胶袋已同步下单',
        remark: '库存可覆盖首批',
      },
    ]),
  },
  {
    recordId: 'prep-202603-004',
    recordNo: 'PREP-202603-004',
    spuCode: 'SPU-HD-260304',
    spuName: '连帽拉链卫衣套装',
    imageUrl: '/mock/products/hoodie-set.jpg',
    buyerName: '李乔',
    merchandiserName: 'Nadia',
    sourceReason: '前置打板',
    reachedThresholdAt: '2026-03-04T09:40:00',
    enteredAt: '2026-03-04T10:10:00',
    productionDemandNo: 'PD-202603-004',
    productionOrderNo: 'PO-202603-004',
    productionOrderHref: orderHref('PO-202603-004'),
    techPackVersionLabel: 'TP-v1.4',
    techPackPublishedAt: '2026-03-04T09:00:00',
    status: '进行中',
    currentBlockerText: '花型无需，染色调色仍在进行',
    expectedFinishAt: '2026-03-11T18:00:00',
    closedReason: '',
    items: createItems('prep-202603-004', 'PO-202603-004', [
      {
        itemType: '基码纸样',
        required: true,
        status: '已完成',
        ownerTeam: '版师团队',
        ownerName: '梁敏',
        plannedStartAt: '2026-03-04T11:00:00',
        plannedFinishAt: '2026-03-05T18:00:00',
        actualFinishAt: '2026-03-05T17:00:00',
        evidenceType: '纸样文件',
        evidenceSummary: '上衣和裤子基码纸样已上传',
        remark: '套装共用罗纹规格',
      },
      {
        itemType: '版衣制作',
        required: true,
        status: '已完成',
        ownerTeam: '车板团队',
        ownerName: 'Dewi',
        plannedStartAt: '2026-03-06T09:00:00',
        plannedFinishAt: '2026-03-07T18:00:00',
        actualFinishAt: '2026-03-07T16:50:00',
        evidenceType: '版衣照片',
        evidenceSummary: '套装版衣已完成',
        remark: '拉链长度确认无误',
      },
      {
        itemType: '齐码纸样',
        required: true,
        status: '已完成',
        ownerTeam: '版师团队',
        ownerName: '梁敏',
        plannedStartAt: '2026-03-08T09:00:00',
        plannedFinishAt: '2026-03-09T18:00:00',
        actualFinishAt: '2026-03-09T17:10:00',
        evidenceType: '齐码文件',
        evidenceSummary: 'S-XL 齐码纸样已上传',
        remark: '裤长档差已确认',
      },
      {
        itemType: '花型',
        required: false,
        status: '无需',
        ownerTeam: '花型团队',
        ownerName: '无需',
        plannedStartAt: '',
        plannedFinishAt: '',
        actualFinishAt: '',
        evidenceSummary: '纯色款无需花型',
        remark: '仅保留胸标绣花，走辅料确认',
      },
      {
        itemType: '染色调色',
        required: true,
        status: '进行中',
        ownerTeam: '染色团队',
        ownerName: 'Wulan',
        plannedStartAt: '2026-03-07T09:00:00',
        plannedFinishAt: '2026-03-10T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '雾蓝色二次调色中',
        remark: '等待洗后色差确认',
      },
      {
        itemType: '辅料下单',
        required: true,
        status: '已完成',
        ownerTeam: '采购团队',
        ownerName: '周怡',
        plannedStartAt: '2026-03-06T09:00:00',
        plannedFinishAt: '2026-03-08T18:00:00',
        actualFinishAt: '2026-03-08T13:10:00',
        evidenceType: '采购单',
        evidenceSummary: '拉链、绳头、罗纹辅料已同步',
        remark: '辅料供应商已回签',
      },
      {
        itemType: '毛织纸样',
        required: true,
        status: '已完成',
        ownerTeam: '毛织团队',
        ownerName: 'Yuni',
        plannedStartAt: '2026-03-06T09:00:00',
        plannedFinishAt: '2026-03-08T18:00:00',
        actualFinishAt: '2026-03-08T15:20:00',
        evidenceType: '纸样文件',
        evidenceSummary: '罗纹袖口和下摆毛织纸样已确认',
        remark: '与卫衣套装辅料规格一致',
      },
    ]),
  },
  {
    recordId: 'prep-202603-005',
    recordNo: 'PREP-202603-005',
    spuCode: 'SPU-JK-260305',
    spuName: '户外轻量夹克',
    imageUrl: '/mock/products/light-jacket.jpg',
    buyerName: '李乔',
    merchandiserName: 'Nadia',
    sourceReason: '新类目',
    reachedThresholdAt: '2026-03-05T14:00:00',
    enteredAt: '2026-03-05T14:35:00',
    productionDemandNo: 'PD-202603-005',
    productionOrderNo: 'PO-202603-005',
    productionOrderHref: orderHref('PO-202603-005'),
    techPackVersionLabel: 'TP-v0.9',
    techPackPublishedAt: '2026-03-05T13:20:00',
    status: '部分超时',
    currentBlockerText: '基码纸样未上传，版衣制作和齐码纸样串行卡住',
    expectedFinishAt: '2026-03-12T18:00:00',
    closedReason: '',
    items: createItems('prep-202603-005', 'PO-202603-005', [
      {
        itemType: '基码纸样',
        required: true,
        status: '已超时',
        ownerTeam: '版师团队',
        ownerName: '梁敏',
        plannedStartAt: '2026-03-05T15:00:00',
        plannedFinishAt: '2026-03-06T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '轻量夹克基码纸样未上传',
        overdueHours: 26,
        remark: '需先确认帽檐结构',
      },
      {
        itemType: '版衣制作',
        required: true,
        status: '待开始',
        ownerTeam: '车板团队',
        ownerName: 'Ayu',
        plannedStartAt: '2026-03-07T09:00:00',
        plannedFinishAt: '2026-03-08T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '等待基码纸样',
        overdueHours: 12,
        remark: '无法提前开版衣',
      },
      {
        itemType: '齐码纸样',
        required: true,
        status: '待开始',
        ownerTeam: '版师团队',
        ownerName: '梁敏',
        plannedStartAt: '2026-03-09T09:00:00',
        plannedFinishAt: '2026-03-10T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '等待版衣确认',
        overdueHours: 4,
        remark: '串行风险已提醒跟单',
      },
      {
        itemType: '花型',
        required: false,
        status: '无需',
        ownerTeam: '花型团队',
        ownerName: '无需',
        plannedStartAt: '',
        plannedFinishAt: '',
        actualFinishAt: '',
        evidenceSummary: '纯色功能款无需花型',
        remark: '',
      },
      {
        itemType: '染色调色',
        required: false,
        status: '待判断',
        ownerTeam: '染色团队',
        ownerName: 'Wulan',
        plannedStartAt: '2026-03-08T09:00:00',
        plannedFinishAt: '2026-03-10T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '需确认是否使用现货面料色',
        remark: '等待采购反馈色卡',
      },
      {
        itemType: '辅料下单',
        required: true,
        status: '已完成',
        ownerTeam: '采购团队',
        ownerName: '何珊',
        plannedStartAt: '2026-03-06T09:00:00',
        plannedFinishAt: '2026-03-08T18:00:00',
        actualFinishAt: '2026-03-08T16:10:00',
        evidenceType: '采购单',
        evidenceSummary: '防水拉链和松紧扣已下单',
        remark: '关键辅料先行锁单',
      },
    ]),
  },
  {
    recordId: 'prep-202603-006',
    recordNo: 'PREP-202603-006',
    spuCode: 'SPU-SH-260306',
    spuName: '商务修身长袖衬衫',
    imageUrl: '/mock/products/slim-shirt.jpg',
    buyerName: '赵嘉宁',
    merchandiserName: 'Raka',
    sourceReason: '销量达标',
    reachedThresholdAt: '2026-03-06T09:30:00',
    enteredAt: '2026-03-06T10:05:00',
    productionDemandNo: 'PD-202603-006',
    productionOrderNo: 'PO-202603-006',
    productionOrderHref: orderHref('PO-202603-006'),
    techPackVersionLabel: 'TP-v4.0',
    techPackPublishedAt: '2026-03-06T09:00:00',
    status: '已完成',
    currentBlockerText: '所有必做项完成',
    expectedFinishAt: '2026-03-12T18:00:00',
    closedReason: '',
    items: createItems('prep-202603-006', 'PO-202603-006', [
      {
        itemType: '基码纸样',
        required: true,
        status: '已完成',
        ownerTeam: '版师团队',
        ownerName: '陈晓岚',
        plannedStartAt: '2026-03-06T10:30:00',
        plannedFinishAt: '2026-03-07T18:00:00',
        actualFinishAt: '2026-03-07T15:00:00',
        evidenceType: '纸样文件',
        evidenceSummary: '修身版基码纸样已上传',
        remark: '领围已按买手意见调整',
      },
      {
        itemType: '版衣制作',
        required: true,
        status: '已完成',
        ownerTeam: '车板团队',
        ownerName: 'Dewi',
        plannedStartAt: '2026-03-08T09:00:00',
        plannedFinishAt: '2026-03-09T18:00:00',
        actualFinishAt: '2026-03-09T14:30:00',
        evidenceType: '版衣照片',
        evidenceSummary: '长袖衬衫版衣已完成',
        remark: '袖叉工艺已确认',
      },
      {
        itemType: '齐码纸样',
        required: true,
        status: '已完成',
        ownerTeam: '版师团队',
        ownerName: '陈晓岚',
        plannedStartAt: '2026-03-10T09:00:00',
        plannedFinishAt: '2026-03-11T18:00:00',
        actualFinishAt: '2026-03-11T15:30:00',
        evidenceType: '齐码文件',
        evidenceSummary: 'S-XXL 齐码纸样已上传',
        remark: '胸围档差确认完成',
      },
      {
        itemType: '花型',
        required: false,
        status: '无需',
        ownerTeam: '花型团队',
        ownerName: '无需',
        plannedStartAt: '',
        plannedFinishAt: '',
        actualFinishAt: '',
        evidenceSummary: '纯色衬衫无需花型',
        remark: '',
      },
      {
        itemType: '染色调色',
        required: true,
        status: '已完成',
        ownerTeam: '染色团队',
        ownerName: 'Wulan',
        plannedStartAt: '2026-03-08T09:00:00',
        plannedFinishAt: '2026-03-10T18:00:00',
        actualFinishAt: '2026-03-10T16:10:00',
        evidenceType: '色卡照片',
        evidenceSummary: '浅蓝条纹底色已确认',
        remark: '色差在允许范围内',
      },
      {
        itemType: '辅料下单',
        required: true,
        status: '已完成',
        ownerTeam: '采购团队',
        ownerName: '何珊',
        plannedStartAt: '2026-03-08T09:00:00',
        plannedFinishAt: '2026-03-10T18:00:00',
        actualFinishAt: '2026-03-10T10:40:00',
        evidenceType: '采购单',
        evidenceSummary: '纽扣、衬布、吊牌已下单',
        remark: '纽扣库存足够首批',
      },
    ]),
  },
  {
    recordId: 'prep-202603-007',
    recordNo: 'PREP-202603-007',
    spuCode: 'SPU-KN-260307',
    spuName: 'Sweater Rajut Wanita',
    imageUrl: '/mock/products/sweater-rajut-wanita.jpg',
    buyerName: 'Alicia',
    merchandiserName: 'Sinta',
    sourceReason: '前置打板',
    reachedThresholdAt: '2026-03-07T13:00:00',
    enteredAt: '2026-03-07T13:35:00',
    productionDemandNo: 'PD-202603-007',
    productionOrderNo: 'PO-202603-007',
    productionOrderHref: orderHref('PO-202603-007'),
    techPackVersionLabel: 'TP-v1.2',
    techPackPublishedAt: '2026-03-07T12:00:00',
    status: '进行中',
    currentBlockerText: '毛织样和梭织样由不同团队并行，毛织纸样略有超时',
    expectedFinishAt: '2026-03-14T18:00:00',
    closedReason: '',
    items: createItems('prep-202603-007', 'PO-202603-007', [
      {
        itemType: '基码纸样',
        required: true,
        status: '进行中',
        ownerTeam: '版师团队',
        ownerName: '梁敏',
        plannedStartAt: '2026-03-07T14:00:00',
        plannedFinishAt: '2026-03-09T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '梭织拼接口基码纸样进行中',
        remark: '与毛织尺寸并行确认',
      },
      {
        itemType: '版衣制作',
        required: true,
        status: '待开始',
        ownerTeam: '车板团队',
        ownerName: 'Ayu',
        plannedStartAt: '2026-03-10T09:00:00',
        plannedFinishAt: '2026-03-11T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '等待梭织基码输出',
        remark: '可先备辅料',
      },
      {
        itemType: '齐码纸样',
        required: true,
        status: '待开始',
        ownerTeam: '版师团队',
        ownerName: '梁敏',
        plannedStartAt: '2026-03-12T09:00:00',
        plannedFinishAt: '2026-03-13T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '等待版衣确认',
        remark: '需同时回填毛织尺码',
      },
      {
        itemType: '花型',
        required: true,
        status: '进行中',
        ownerTeam: '花型团队',
        ownerName: 'Sari',
        plannedStartAt: '2026-03-08T09:00:00',
        plannedFinishAt: '2026-03-11T18:00:00',
        actualFinishAt: '',
        evidenceType: '完成图',
        evidenceSummary: '提花布局已出图，缺花型源文件',
        overdueHours: 6,
        remark: '缺花型文件',
        patternTaskNo: 'PAT-202603-007',
        patternDesignerId: 'designer-sari',
        patternDesignerName: 'Sari',
        patternTeamName: 'Jakarta 花型组',
        assignedAt: '2026-03-08T09:30:00',
        completionImageIds: ['img-pattern-sweater-007'],
        patternFileIds: [],
        buyerReviewStatus: '未提交',
      },
      {
        itemType: '毛织纸样',
        required: true,
        status: '进行中',
        ownerTeam: '毛织团队',
        ownerName: 'Yuni',
        plannedStartAt: '2026-03-07T14:30:00',
        plannedFinishAt: '2026-03-10T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '毛织前片纸样仍在调整',
        overdueHours: 8,
        remark: '毛织团队与版师团队并行',
      },
      {
        itemType: '辅料下单',
        required: true,
        status: '已完成',
        ownerTeam: '采购团队',
        ownerName: '何珊',
        plannedStartAt: '2026-03-08T09:00:00',
        plannedFinishAt: '2026-03-10T18:00:00',
        actualFinishAt: '2026-03-10T16:50:00',
        evidenceType: '采购单',
        evidenceSummary: '领标和毛纱色卡已同步',
        remark: '毛纱由毛织团队确认批次',
      },
    ]),
  },
  {
    recordId: 'prep-202603-008',
    recordNo: 'PREP-202603-008',
    spuCode: 'SPU-JG-260308',
    spuName: 'Celana Jogger Pria',
    imageUrl: '/mock/products/celana-jogger-pria.jpg',
    buyerName: 'Alicia',
    merchandiserName: 'Sinta',
    sourceReason: '人工加入',
    reachedThresholdAt: '2026-03-08T09:20:00',
    enteredAt: '2026-03-08T10:00:00',
    productionDemandNo: 'PD-202603-008',
    productionOrderNo: 'PO-202603-008',
    productionOrderHref: orderHref('PO-202603-008'),
    techPackVersionLabel: 'TP-v1.0',
    techPackPublishedAt: '2026-03-08T08:30:00',
    status: '已关闭',
    currentBlockerText: '买手取消该批生产准备',
    expectedFinishAt: '2026-03-14T18:00:00',
    closedReason: '买手取消生产需求，已关闭不计入统计',
    items: createItems('prep-202603-008', 'PO-202603-008', [
      {
        itemType: '基码纸样',
        required: true,
        status: '已完成',
        ownerTeam: '版师团队',
        ownerName: '梁敏',
        plannedStartAt: '2026-03-08T10:30:00',
        plannedFinishAt: '2026-03-09T18:00:00',
        actualFinishAt: '2026-03-09T17:30:00',
        evidenceType: '纸样文件',
        evidenceSummary: 'Jogger 基码纸样已上传',
        remark: '关闭前已完成',
      },
      {
        itemType: '版衣制作',
        required: true,
        status: '已完成',
        ownerTeam: '车板团队',
        ownerName: 'Dewi',
        plannedStartAt: '2026-03-10T09:00:00',
        plannedFinishAt: '2026-03-11T18:00:00',
        actualFinishAt: '2026-03-11T18:40:00',
        evidenceType: '版衣照片',
        evidenceSummary: 'Jogger 版衣已完成',
        overdueHours: 0.7,
        remark: '关闭记录不进入月度统计',
      },
      {
        itemType: '齐码纸样',
        required: true,
        status: '待开始',
        ownerTeam: '版师团队',
        ownerName: '梁敏',
        plannedStartAt: '2026-03-12T09:00:00',
        plannedFinishAt: '2026-03-13T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '记录关闭，未继续',
        remark: '',
      },
      {
        itemType: '花型',
        required: false,
        status: '无需',
        ownerTeam: '花型团队',
        ownerName: '无需',
        plannedStartAt: '',
        plannedFinishAt: '',
        actualFinishAt: '',
        evidenceSummary: '纯色款无需花型',
        remark: '',
      },
      {
        itemType: '染色调色',
        required: true,
        status: '已完成',
        ownerTeam: '染色团队',
        ownerName: 'Rini',
        plannedStartAt: '2026-03-09T09:00:00',
        plannedFinishAt: '2026-03-11T18:00:00',
        actualFinishAt: '2026-03-11T16:00:00',
        evidenceType: '色卡照片',
        evidenceSummary: '深灰色卡已确认',
        remark: '关闭记录不进入月度统计',
      },
      {
        itemType: '辅料下单',
        required: true,
        status: '已完成',
        ownerTeam: '采购团队',
        ownerName: '周怡',
        plannedStartAt: '2026-03-09T09:00:00',
        plannedFinishAt: '2026-03-11T18:00:00',
        actualFinishAt: '2026-03-11T15:10:00',
        evidenceType: '采购单',
        evidenceSummary: '腰绳和四合扣已下单',
        remark: '关闭后采购单已撤销',
      },
    ]),
  },
  {
    recordId: 'prep-202604-001',
    recordNo: 'PREP-202604-001',
    spuCode: 'SPU-LN-260401',
    spuName: 'Kemeja Linen Pria',
    imageUrl: '/mock/products/kemeja-linen-pria.jpg',
    buyerName: 'Alicia',
    merchandiserName: 'Raka',
    sourceReason: '销量达标',
    reachedThresholdAt: '2026-04-01T09:00:00',
    enteredAt: '2026-04-01T09:30:00',
    productionDemandNo: 'PD-202604-001',
    productionOrderNo: 'PO-202604-001',
    productionOrderHref: orderHref('PO-202604-001'),
    techPackVersionLabel: 'TP-v2.0',
    techPackPublishedAt: '2026-04-01T08:40:00',
    status: '已完成',
    currentBlockerText: '基码、版衣、齐码均在 2026-04 完成',
    expectedFinishAt: '2026-04-07T18:00:00',
    closedReason: '',
    items: createItems('prep-202604-001', 'PO-202604-001', [
      {
        itemType: '基码纸样',
        required: true,
        status: '已完成',
        ownerTeam: '版师团队',
        ownerName: '陈晓岚',
        plannedStartAt: '2026-04-01T10:00:00',
        plannedFinishAt: '2026-04-02T18:00:00',
        actualFinishAt: '2026-04-02T15:40:00',
        evidenceType: '纸样文件',
        evidenceSummary: '亚麻衬衫基码纸样已上传',
        remark: '门襟宽度已确认',
      },
      {
        itemType: '版衣制作',
        required: true,
        status: '已完成',
        ownerTeam: '车板团队',
        ownerName: 'Ayu',
        plannedStartAt: '2026-04-03T09:00:00',
        plannedFinishAt: '2026-04-04T18:00:00',
        actualFinishAt: '2026-04-04T17:30:00',
        evidenceType: '版衣照片',
        evidenceSummary: '亚麻衬衫版衣已完成',
        remark: '洗缩率已记录',
      },
      {
        itemType: '齐码纸样',
        required: true,
        status: '已完成',
        ownerTeam: '版师团队',
        ownerName: '陈晓岚',
        plannedStartAt: '2026-04-05T09:00:00',
        plannedFinishAt: '2026-04-06T18:00:00',
        actualFinishAt: '2026-04-06T14:50:00',
        evidenceType: '齐码文件',
        evidenceSummary: 'M-XXL 齐码纸样已上传',
        remark: '肩宽档差确认完成',
      },
      {
        itemType: '花型',
        required: false,
        status: '无需',
        ownerTeam: '花型团队',
        ownerName: '无需',
        plannedStartAt: '',
        plannedFinishAt: '',
        actualFinishAt: '',
        evidenceSummary: '纯色亚麻款无需花型',
        remark: '',
      },
      {
        itemType: '染色调色',
        required: true,
        status: '已完成',
        ownerTeam: '染色团队',
        ownerName: 'Wulan',
        plannedStartAt: '2026-04-02T09:00:00',
        plannedFinishAt: '2026-04-05T18:00:00',
        actualFinishAt: '2026-04-05T16:20:00',
        evidenceType: '色卡照片',
        evidenceSummary: '天然亚麻本色已确认',
        remark: '无需二次调色',
      },
      {
        itemType: '辅料下单',
        required: true,
        status: '已完成',
        ownerTeam: '采购团队',
        ownerName: '何珊',
        plannedStartAt: '2026-04-02T09:00:00',
        plannedFinishAt: '2026-04-04T18:00:00',
        actualFinishAt: '2026-04-04T12:20:00',
        evidenceType: '采购单',
        evidenceSummary: '贝壳扣和洗标已下单',
        remark: '辅料已匹配亚麻系列',
      },
    ]),
  },
  {
    recordId: 'prep-202604-002',
    recordNo: 'PREP-202604-002',
    spuCode: 'SPU-BL-260402',
    spuName: 'Blus Wanita Satin',
    imageUrl: '/mock/products/blus-wanita-satin.jpg',
    buyerName: 'Alicia',
    merchandiserName: 'Sinta',
    sourceReason: '人工加入',
    reachedThresholdAt: '2026-04-02T11:10:00',
    enteredAt: '2026-04-02T11:40:00',
    productionDemandNo: 'PD-202604-002',
    productionOrderNo: 'PO-202604-002',
    productionOrderHref: orderHref('PO-202604-002'),
    techPackVersionLabel: 'TP-v1.1',
    techPackPublishedAt: '2026-04-02T10:30:00',
    status: '部分超时',
    currentBlockerText: '染色调色待上传潘通色卡照片',
    expectedFinishAt: '2026-04-09T18:00:00',
    closedReason: '',
    items: createItems('prep-202604-002', 'PO-202604-002', [
      {
        itemType: '基码纸样',
        required: true,
        status: '已完成',
        ownerTeam: '版师团队',
        ownerName: '梁敏',
        plannedStartAt: '2026-04-02T12:00:00',
        plannedFinishAt: '2026-04-03T18:00:00',
        actualFinishAt: '2026-04-03T17:40:00',
        evidenceType: '纸样文件',
        evidenceSummary: '缎面衬衫基码纸样已上传',
        remark: '袖山高度已确认',
      },
      {
        itemType: '版衣制作',
        required: true,
        status: '已完成',
        ownerTeam: '车板团队',
        ownerName: 'Dewi',
        plannedStartAt: '2026-04-04T09:00:00',
        plannedFinishAt: '2026-04-05T18:00:00',
        actualFinishAt: '2026-04-05T17:50:00',
        evidenceType: '版衣照片',
        evidenceSummary: '缎面版衣已上传',
        remark: '面料滑移风险已备注',
      },
      {
        itemType: '齐码纸样',
        required: true,
        status: '进行中',
        ownerTeam: '版师团队',
        ownerName: '梁敏',
        plannedStartAt: '2026-04-06T09:00:00',
        plannedFinishAt: '2026-04-07T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '齐码纸样进行中',
        remark: '等待袖长档差确认',
      },
      {
        itemType: '花型',
        required: false,
        status: '无需',
        ownerTeam: '花型团队',
        ownerName: '无需',
        plannedStartAt: '',
        plannedFinishAt: '',
        actualFinishAt: '',
        evidenceSummary: '纯色缎面款无需花型',
        remark: '',
      },
      {
        itemType: '染色调色',
        required: true,
        status: '已超时',
        ownerTeam: '染色团队',
        ownerName: 'Rini',
        plannedStartAt: '2026-04-03T09:00:00',
        plannedFinishAt: '2026-04-06T18:00:00',
        actualFinishAt: '',
        evidenceType: '色卡照片',
        evidenceSummary: '待上传潘通色卡照片',
        overdueHours: 14,
        remark: '买手已催确认玫瑰粉色号',
      },
      {
        itemType: '辅料下单',
        required: true,
        status: '已完成',
        ownerTeam: '采购团队',
        ownerName: '周怡',
        plannedStartAt: '2026-04-03T09:00:00',
        plannedFinishAt: '2026-04-05T18:00:00',
        actualFinishAt: '2026-04-05T14:30:00',
        evidenceType: '采购单',
        evidenceSummary: '珍珠扣和吊牌已下单',
        remark: '辅料到仓日期已写入采购单',
      },
    ]),
  },
  {
    recordId: 'prep-202604-003',
    recordNo: 'PREP-202604-003',
    spuCode: 'SPU-SH-260403',
    spuName: 'Celana Pendek Pria',
    imageUrl: '/mock/products/celana-pendek-pria.jpg',
    buyerName: 'Alicia',
    merchandiserName: 'Raka',
    sourceReason: '销量达标',
    reachedThresholdAt: '2026-04-03T09:20:00',
    enteredAt: '2026-04-03T10:00:00',
    productionDemandNo: 'PD-202604-003',
    productionOrderNo: 'PO-202604-003',
    productionOrderHref: orderHref('PO-202604-003'),
    techPackVersionLabel: 'TP-v1.5',
    techPackPublishedAt: '2026-04-03T08:50:00',
    status: '进行中',
    currentBlockerText: '花型已分配 Diah，未上传完成图',
    expectedFinishAt: '2026-04-10T18:00:00',
    closedReason: '',
    items: createItems('prep-202604-003', 'PO-202604-003', [
      {
        itemType: '基码纸样',
        required: true,
        status: '已完成',
        ownerTeam: '版师团队',
        ownerName: '陈晓岚',
        plannedStartAt: '2026-04-03T10:30:00',
        plannedFinishAt: '2026-04-04T18:00:00',
        actualFinishAt: '2026-04-04T16:00:00',
        evidenceType: '纸样文件',
        evidenceSummary: '短裤基码纸样已上传',
        remark: '腰头结构已确认',
      },
      {
        itemType: '版衣制作',
        required: true,
        status: '进行中',
        ownerTeam: '车板团队',
        ownerName: 'Ayu',
        plannedStartAt: '2026-04-05T09:00:00',
        plannedFinishAt: '2026-04-06T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '短裤版衣制作中',
        remark: '等待袋布辅料',
      },
      {
        itemType: '齐码纸样',
        required: true,
        status: '待开始',
        ownerTeam: '版师团队',
        ownerName: '陈晓岚',
        plannedStartAt: '2026-04-07T09:00:00',
        plannedFinishAt: '2026-04-08T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '等待版衣确认',
        remark: '',
      },
      {
        itemType: '花型',
        required: true,
        status: '进行中',
        ownerTeam: '花型团队',
        ownerName: 'Diah',
        plannedStartAt: '2026-04-03T13:00:00',
        plannedFinishAt: '2026-04-06T18:00:00',
        actualFinishAt: '',
        evidenceType: '完成图',
        evidenceSummary: 'Diah 已接单，未上传完成图',
        overdueHours: 10,
        remark: '缺完成图',
        patternTaskNo: 'PAT-202604-003',
        patternDesignerId: 'designer-diah',
        patternDesignerName: 'Diah',
        patternTeamName: 'Bandung 花型组',
        assignedAt: '2026-04-03T13:20:00',
        completionImageIds: [],
        patternFileIds: ['file-pattern-shorts-003'],
        buyerReviewStatus: '未提交',
      },
      {
        itemType: '染色调色',
        required: false,
        status: '无需',
        ownerTeam: '染色团队',
        ownerName: '无需',
        plannedStartAt: '',
        plannedFinishAt: '',
        actualFinishAt: '',
        evidenceSummary: '使用现货水洗蓝面料',
        remark: '',
      },
      {
        itemType: '辅料下单',
        required: true,
        status: '待开始',
        ownerTeam: '采购团队',
        ownerName: '何珊',
        plannedStartAt: '2026-04-05T09:00:00',
        plannedFinishAt: '2026-04-07T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '等待袋布规格确认',
        remark: '辅料下单需跟版衣同步',
      },
    ]),
  },
  {
    recordId: 'prep-202604-004',
    recordNo: 'PREP-202604-004',
    spuCode: 'SPU-TS-260404',
    spuName: '春季休闲T恤',
    imageUrl: '/mock/products/spring-casual-tee.jpg',
    buyerName: '沈若琳',
    merchandiserName: 'Maya',
    sourceReason: '销量达标',
    reachedThresholdAt: '2026-04-04T15:00:00',
    enteredAt: '2026-04-04T15:25:00',
    productionDemandNo: 'PD-202604-004',
    productionOrderNo: 'PO-202604-004',
    productionOrderHref: orderHref('PO-202604-004'),
    techPackVersionLabel: 'TP-v0.6',
    techPackPublishedAt: '2026-04-04T14:40:00',
    status: '未开始',
    currentBlockerText: '刚进入准备阶段，等待责任人接单',
    expectedFinishAt: '2026-04-11T18:00:00',
    closedReason: '',
    items: createItems('prep-202604-004', 'PO-202604-004', [
      {
        itemType: '基码纸样',
        required: true,
        status: '待分配',
        ownerTeam: '版师团队',
        ownerName: '待分配',
        plannedStartAt: '2026-04-04T16:00:00',
        plannedFinishAt: '2026-04-05T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '等待版师接单',
        remark: '刚进入准备阶段',
      },
      {
        itemType: '版衣制作',
        required: true,
        status: '待开始',
        ownerTeam: '车板团队',
        ownerName: '待接单',
        plannedStartAt: '2026-04-06T09:00:00',
        plannedFinishAt: '2026-04-07T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '等待基码纸样',
        remark: '',
      },
      {
        itemType: '齐码纸样',
        required: true,
        status: '待开始',
        ownerTeam: '版师团队',
        ownerName: '待分配',
        plannedStartAt: '2026-04-08T09:00:00',
        plannedFinishAt: '2026-04-09T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '等待版衣确认',
        remark: '',
      },
      {
        itemType: '花型',
        required: true,
        status: '待判断',
        ownerTeam: '花型团队',
        ownerName: '待判断',
        plannedStartAt: '2026-04-04T16:30:00',
        plannedFinishAt: '2026-04-07T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '需确认胸前图案是否重画',
        remark: '买手尚未确认花型范围',
        completionImageIds: [],
        patternFileIds: [],
        buyerReviewStatus: '未提交',
      },
      {
        itemType: '染色调色',
        required: true,
        status: '待判断',
        ownerTeam: '染色团队',
        ownerName: '待判断',
        plannedStartAt: '2026-04-05T09:00:00',
        plannedFinishAt: '2026-04-08T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '需确认是否沿用现货米白色',
        remark: '',
      },
      {
        itemType: '辅料下单',
        required: true,
        status: '待开始',
        ownerTeam: '采购团队',
        ownerName: '待接单',
        plannedStartAt: '2026-04-05T09:00:00',
        plannedFinishAt: '2026-04-07T18:00:00',
        actualFinishAt: '',
        evidenceSummary: '等待辅料清单确认',
        remark: '',
      },
    ]),
  },
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
    record.productionDemandNo,
    record.productionOrderNo,
    record.techPackVersionLabel,
    record.buyerName,
    record.merchandiserName,
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
    if (filter.itemType && filter.itemType !== '全部' && !record.items.some((item) => item.itemType === filter.itemType)) {
      return false
    }
    if (filter.ownerTeam && !record.items.some((item) => item.ownerTeam === filter.ownerTeam)) return false
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
