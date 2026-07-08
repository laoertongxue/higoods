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
  | '确认染色要求（纱线）'
  | '染色调色（纱线）'
  | '确认染色要求（面料）'
  | '染色调色（面料）'
  | '辅料下单'

export type PreparationOutputType =
  | '正式版本技术包'
  | '生产需求单'
  | '生产单'
  | '印花需求单'
  | '印花加工单'
  | '染色需求单'
  | '染色加工单'
  | '辅料采购单'
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

export interface PreparationUploadRecord {
  uploadId: string
  recordId: string
  itemId: string
  itemType: PreparationItemType
  fileName: string
  fileType: string
  fileSize: number
  fileDataUrl: string
  uploadedBy: string
  uploadedAt: string
  note: string
}

export interface PreparationDownloadRecord {
  downloadId: string
  recordId: string
  itemId: string
  uploadId: string
  fileName: string
  downloadedBy: string
  downloadedAt: string
}

export interface PreparationMaterialRequirement {
  materialNo: string
  materialName: string
  materialType?: string
  imageUrl?: string
  requiredQty?: number
  preparedQty?: number
  issuedQty?: number
  unit?: string
  items?: PreparationMaterialLine[]
}

export interface PreparationMaterialLine {
  materialNo: string
  materialName: string
  materialType: string
  imageUrl: string
  requiredQty: number
  preparedQty: number
  issuedQty: number
  unit: string
}

export interface PreparationDyeRequirement extends PreparationMaterialRequirement {
  colorName: string
  pantoneCode: string
  remark: string
  maintainedBy: string
  maintainedAt: string
}

export interface PreparationOwnerRoleRule {
  ownerTeam: string
  roleLabels: string[]
  actionScope: string
}

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
  dyeRequirement?: PreparationDyeRequirement
  uploads?: PreparationUploadRecord[]
  downloads?: PreparationDownloadRecord[]
}

export interface ProductionPreparationOutput {
  outputType: PreparationOutputType
  outputNo: string
  outputHref: string
  outputStatus: PreparationOutputStatus
  outputGeneratedAt: string
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
  workItemsConfirmedBy: string
  workItemsConfirmedAt: string
  prepTypeOverrideReason: string
  materialRequirement: PreparationMaterialRequirement
  sampleRequirementText: string
  confirmationRemark: string
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

export interface PreparationOutputBuildInput {
  recordNo: string
  productionDemandNo: string
  productionOrderNo: string
  outputReady: boolean
  outputPublishedAt: string
  workItemsConfirmedBy?: string
  workItemsConfirmedAt?: string
  items: Array<Pick<ProductionPreparationItem, 'itemType' | 'selectedByMerchandiser' | 'status'>>
}

export interface ProductionPreparationFilter {
  month?: string
  startDate?: string
  endDate?: string
  merchandiserName?: string
  buyerName?: string
  recordStatus?: PreparationRecordStatus | '全部'
  itemType?: PreparationItemType | '全部'
  ownerTeam?: string
  ownerName?: string
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
  ownerNames: string[]
  patternDesigners: typeof patternDesignerOptions
}

export interface PreparationTypeDefaultItem {
  itemType: PreparationItemType
  defaultSelected: boolean
  canUnselect: boolean
}

export const preparationItemTypes: PreparationItemType[] = [
  '梭织基码纸样',
  '毛织基码纸样',
  '版衣制作',
  '梭织齐码纸样',
  '毛织齐码纸样',
  '数码印/DTF/DTG花型',
  '确认染色要求（纱线）',
  '染色调色（纱线）',
  '确认染色要求（面料）',
  '染色调色（面料）',
  '辅料下单',
]

export const preparationTypeDefaultItems = {
  '非烫画&非毛织（纯梭织）': [
    { itemType: '梭织基码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '版衣制作', defaultSelected: true, canUnselect: false },
    { itemType: '梭织齐码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '辅料下单', defaultSelected: true, canUnselect: true },
    { itemType: '数码印/DTF/DTG花型', defaultSelected: false, canUnselect: true },
    { itemType: '确认染色要求（面料）', defaultSelected: false, canUnselect: true },
    { itemType: '染色调色（面料）', defaultSelected: false, canUnselect: true },
  ],
  '烫画&直喷': [
    { itemType: '数码印/DTF/DTG花型', defaultSelected: true, canUnselect: false },
  ],
  毛织: [
    { itemType: '毛织基码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '版衣制作', defaultSelected: true, canUnselect: false },
    { itemType: '毛织齐码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '辅料下单', defaultSelected: true, canUnselect: true },
    { itemType: '确认染色要求（面料）', defaultSelected: false, canUnselect: true },
    { itemType: '染色调色（面料）', defaultSelected: false, canUnselect: true },
  ],
  '毛织&梭织': [
    { itemType: '毛织基码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '梭织基码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '版衣制作', defaultSelected: true, canUnselect: false },
    { itemType: '毛织齐码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '梭织齐码纸样', defaultSelected: true, canUnselect: false },
    { itemType: '辅料下单', defaultSelected: true, canUnselect: true },
    { itemType: '数码印/DTF/DTG花型', defaultSelected: false, canUnselect: true },
    { itemType: '确认染色要求（纱线）', defaultSelected: false, canUnselect: true },
    { itemType: '染色调色（纱线）', defaultSelected: false, canUnselect: true },
    { itemType: '确认染色要求（面料）', defaultSelected: false, canUnselect: true },
    { itemType: '染色调色（面料）', defaultSelected: false, canUnselect: true },
  ],
} satisfies Record<ProductPrepType, PreparationTypeDefaultItem[]>

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

export const preparationOwnerTeams = ['版师团队', '车板团队', '花型团队', '染色团队', '采购团队', '毛织团队', '跟单角色']

export const preparationOwnerRoleRules: PreparationOwnerRoleRule[] = [
  { ownerTeam: '版师团队', roleLabels: ['版师', '版师主管'], actionScope: '操作梭织基码纸样、梭织齐码纸样' },
  { ownerTeam: '毛织团队', roleLabels: ['毛织版师', '毛织主管'], actionScope: '操作毛织基码纸样、毛织齐码纸样' },
  { ownerTeam: '车板团队', roleLabels: ['车版', '车版主管'], actionScope: '操作版衣制作' },
  { ownerTeam: '花型团队', roleLabels: ['花型师', '花型主管'], actionScope: '操作数码印/DTF/DTG花型' },
  { ownerTeam: '染色团队', roleLabels: ['染厂公共账号'], actionScope: '上传染色调色结果' },
  { ownerTeam: '采购团队', roleLabels: ['采购', '辅料采购'], actionScope: '操作辅料下单' },
  { ownerTeam: '跟单角色', roleLabels: ['跟单'], actionScope: '确认工作项、确认染色要求' },
]

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
      | 'uploads'
      | 'downloads'
    >
  >

type RecordSeed = Omit<
  ProductionPreparationRecord,
  | 'largeGoodsThresholdQty'
  | 'reachedThresholdAt'
  | 'productionOrderHref'
  | 'workItemsConfirmedBy'
  | 'workItemsConfirmedAt'
  | 'outputs'
  | 'items'
> & {
  items: PreparationItemSeed[]
  workItemsConfirmedBy?: string
  workItemsConfirmedAt?: string
}

function orderHref(orderNo: string): string {
  return `/fcs/production/orders?keyword=${encodeURIComponent(orderNo)}`
}

export function buildPreparationOutputs(input: PreparationOutputBuildInput): ProductionPreparationOutput[] {
  const selectedItems = input.items.filter((item) => item.selectedByMerchandiser !== false && item.status !== '无需')
  if (
    !(input.workItemsConfirmedBy && input.workItemsConfirmedAt) ||
    !input.outputReady ||
    !input.productionDemandNo ||
    !input.productionOrderNo ||
    !input.outputPublishedAt ||
    selectedItems.some((item) => item.status !== '已完成')
  ) {
    return []
  }

  const status: PreparationOutputStatus = '已生成'
  const outputs: ProductionPreparationOutput[] = [
    { outputType: '正式版本技术包', outputNo: `TP-${input.productionOrderNo}`, outputHref: `/fcs/production/orders/${encodeURIComponent(input.productionOrderNo)}/tech-pack`, outputStatus: status, outputGeneratedAt: input.outputPublishedAt },
    { outputType: '生产需求单', outputNo: input.productionDemandNo, outputHref: `/fcs/production/demand-inbox?keyword=${encodeURIComponent(input.productionDemandNo)}`, outputStatus: status, outputGeneratedAt: input.outputPublishedAt },
    { outputType: '生产单', outputNo: input.productionOrderNo, outputHref: orderHref(input.productionOrderNo), outputStatus: status, outputGeneratedAt: input.outputPublishedAt },
  ]

  if (selectedItems.some((item) => item.itemType === '数码印/DTF/DTG花型')) {
    outputs.push(
      { outputType: '印花需求单', outputNo: `PRD-${input.recordNo.slice(-3)}`, outputHref: '/fcs/process/print-requirements', outputStatus: status, outputGeneratedAt: input.outputPublishedAt },
      { outputType: '印花加工单', outputNo: `PRO-${input.recordNo.slice(-3)}`, outputHref: '/fcs/process/print-orders', outputStatus: status, outputGeneratedAt: input.outputPublishedAt },
    )
  }
  if (selectedItems.some((item) => item.itemType === '染色调色（纱线）' || item.itemType === '染色调色（面料）')) {
    outputs.push(
      { outputType: '染色需求单', outputNo: `DYD-${input.recordNo.slice(-3)}`, outputHref: '/fcs/process/dye-requirements', outputStatus: status, outputGeneratedAt: input.outputPublishedAt },
      { outputType: '染色加工单', outputNo: `DYO-${input.recordNo.slice(-3)}`, outputHref: '/fcs/process/dye-orders', outputStatus: status, outputGeneratedAt: input.outputPublishedAt },
    )
  }
  if (selectedItems.some((item) => item.itemType === '辅料下单')) {
    outputs.push({ outputType: '辅料采购单', outputNo: `AP-${input.recordNo.slice(-3)}`, outputHref: '/fcs/purchase/accessory-orders', outputStatus: status, outputGeneratedAt: input.outputPublishedAt })
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
  const canUnselect = itemType === '辅料下单'
  return {
    itemType,
    required: !canUnselect,
    requiredKind: canUnselect ? '选填' : '必做',
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

function materialRequirement(
  materialNo: string,
  materialName: string,
  materialType: string,
  imageUrl: string,
  requiredQty: number,
  preparedQty: number,
  issuedQty: number,
  unit = '米',
  items?: PreparationMaterialLine[],
): PreparationMaterialRequirement {
  return {
    materialNo,
    materialName,
    materialType,
    imageUrl,
    requiredQty,
    preparedQty,
    issuedQty,
    unit,
    items,
  }
}

function createItems(recordId: string, productionOrderNo: string, seeds: PreparationItemSeed[]): ProductionPreparationItem[] {
  return seeds.map((seed, index) => {
    const itemId = `${recordId}-item-${String(index + 1).padStart(2, '0')}`
    const shouldBackfillUpload = seed.selectedByMerchandiser !== false && seed.status === '已完成' && Boolean(seed.actualFinishAt)
    const uploads = 'uploads' in seed
      ? seed.uploads ?? []
      : shouldBackfillUpload
        ? [{
            uploadId: `${itemId}-history-upload-01`,
            recordId,
            itemId,
            itemType: seed.itemType,
            fileName: `${seed.itemType}-${seed.actualFinishAt.slice(0, 10)}.pdf`,
            fileType: 'application/pdf',
            fileSize: 1024,
            fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQ=',
            uploadedBy: seed.ownerName,
            uploadedAt: seed.actualFinishAt,
            note: seed.evidenceSummary || '历史完成资料',
          }]
        : []

    return {
      itemId,
      recordId,
      sourceObjectType: productionOrderNo ? '生产单' : '',
      sourceObjectNo: productionOrderNo,
      sourceHref: productionOrderNo ? orderHref(productionOrderNo) : '',
      evidenceType: '系统记录',
      evidenceSummary: '',
      overdueHours: 0,
      remark: '',
      ...seed,
      uploads,
      downloads: seed.downloads ?? [],
    }
  })
}

function record(seed: RecordSeed): ProductionPreparationRecord {
  const workItemsConfirmedBy = seed.workItemsConfirmedBy ?? seed.prepTypeConfirmedBy
  const workItemsConfirmedAt = seed.workItemsConfirmedAt ?? seed.prepTypeConfirmedAt
  return {
    ...seed,
    largeGoodsThresholdQty: 300,
    reachedThresholdAt: seed.largeGoodsReachedAt,
    productionOrderHref: seed.productionOrderNo ? orderHref(seed.productionOrderNo) : '',
    workItemsConfirmedBy,
    workItemsConfirmedAt,
    outputs: buildPreparationOutputs({
      recordNo: seed.recordNo,
      productionDemandNo: seed.productionDemandNo,
      productionOrderNo: seed.productionOrderNo,
      outputReady: seed.outputReady,
      outputPublishedAt: seed.outputPublishedAt,
      workItemsConfirmedBy,
      workItemsConfirmedAt,
      items: seed.items,
    }),
    items: createItems(seed.recordId, seed.productionOrderNo, seed.items),
  }
}

export const productionPreparationRecords: ProductionPreparationRecord[] = [
  record({
    recordId: 'prep-202603-001',
    recordNo: 'PREP-202603-001',
    spuCode: 'SPU-WV-260301',
    spuName: '纯梭织通勤衬衫',
    imageUrl: '/shirt-sample.jpg',
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
    workItemsConfirmedBy: '',
    workItemsConfirmedAt: '',
    prepTypeOverrideReason: '',
    materialRequirement: materialRequirement('FAB-202603-001', '60S 棉府绸印花底布', '主面料', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=240&q=80', 820, 0, 0),
    sampleRequirementText: '待跟单确认本次用料和做款/打板要求。',
    confirmationRemark: '',
    productionDemandNo: '',
    productionOrderNo: '',
    techPackVersionLabel: '',
    techPackPublishedAt: '',
    status: '未开始',
    currentBlockerText: '刚达到做大货要求，待跟单确认商品类型和梭织纸样、版衣、辅料、花型等准备项',
    expectedFinishAt: '2026-03-05T18:00:00',
    closedReason: '',
    outputReady: false,
    outputPublishedAt: '',
    items: [
      req('梭织基码纸样', '待判断', '版师团队', '待确认', '', '', '', '梭织主线', [], '梭织基码', { evidenceSummary: '待跟单确认是否进入梭织基码准备' }),
      req('版衣制作', '待判断', '车板团队', '待确认', '', '', '', '梭织主线', ['prep-202603-001-item-01'], '版衣', { evidenceSummary: '待跟单确认版衣制作节点' }),
      req('梭织齐码纸样', '待判断', '版师团队', '待确认', '', '', '', '梭织主线', ['prep-202603-001-item-02'], '梭织齐码', { evidenceSummary: '待跟单确认齐码纸样准备' }),
      req('辅料下单', '待判断', '采购团队', '待确认', '', '', '', '辅料并行', [], '主辅料', { evidenceSummary: '待跟单确认是否需要辅料下单' }),
      opt('数码印/DTF/DTG花型', true, '待判断', '花型团队', '待确认', '', '', '', '花型并行', '花型', { evidenceSummary: '待跟单确认数码印花型准备项', completionImageIds: [], patternFileIds: [], buyerReviewStatus: '未提交' }),
      opt('染色调色（面料）', false, '待判断', '染色团队', '待确认', '', '', '', '染色并行', '面料染色', { evidenceSummary: '待跟单确认是否需要面料染色调色' }),
    ],
  }),
  record({
    recordId: 'prep-202603-002',
    recordNo: 'PREP-202603-002',
    spuCode: 'SPU-MX-260302',
    spuName: '毛织拼接梭织短袖上衣',
    imageUrl: '/cardigan-sample.jpg',
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
    materialRequirement: materialRequirement('YRN-202603-002', '12GG 棉羊毛混纺纱', '主纱线', 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=240&q=80', 420, 360, 260, 'kg', [
      { materialNo: 'YRN-202603-002', materialName: '12GG 棉羊毛混纺纱', materialType: '主纱线', imageUrl: 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=240&q=80', requiredQty: 420, preparedQty: 360, issuedQty: 260, unit: 'kg' },
      { materialNo: 'FAB-202603-002B', materialName: '60S 棉府绸拼接料', materialType: '拼接面料', imageUrl: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=240&q=80', requiredQty: 260, preparedQty: 180, issuedQty: 90, unit: '米' },
    ]),
    sampleRequirementText: '毛织前片按 S 码起版，梭织拼接口按技术包 V1.8 对齐。',
    confirmationRemark: '选择纱线染色和面料染色，毛织基码先行。',
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
      opt('数码印/DTF/DTG花型', false, '待判断', '花型团队', '待确认', '', '', '', '花型并行', '花型', { evidenceSummary: '跟单未选择花型准备' }),
      opt('染色调色（纱线）', true, '已完成', '染色团队', 'Wulan', '2026-03-03T09:00:00', '2026-03-06T18:00:00', '2026-03-06T15:30:00', '染色并行', '纱线染色', { evidenceSummary: '咖色纱线色卡已确认', dyeRequirement: { materialNo: 'YRN-202603-002', materialName: '12GG 棉羊毛混纺纱', colorName: '暖咖', pantoneCode: 'PANTONE 18-1028 TPX', remark: '先出前片主纱色卡，确认后再放大货纱。', maintainedBy: 'Raka', maintainedAt: '2026-03-03T10:10:00' } }),
      opt('染色调色（面料）', true, '进行中', '染色团队', 'Rini', '2026-03-03T09:00:00', '2026-03-06T18:00:00', '', '染色并行', '面料染色', { evidenceSummary: '梭织拼接面料二次调色', overdueHours: 9, dyeRequirement: { materialNo: 'FAB-202603-002B', materialName: '60S 棉府绸拼接料', colorName: '米杏', pantoneCode: 'PANTONE 13-1006 TPX', remark: '需与暖咖纱线拼接后色差自然。', maintainedBy: 'Raka', maintainedAt: '2026-03-03T10:25:00' } }),
    ],
  }),
  record({
    recordId: 'prep-202603-003',
    recordNo: 'PREP-202603-003',
    spuCode: 'SPU-PT-260303',
    spuName: 'DTF 直喷休闲短袖',
    imageUrl: '/tshirt-sample.jpg',
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
    materialRequirement: materialRequirement('FAB-202603-003', '32S 精梳棉单面布', '针织主布', 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=240&q=80', 760, 760, 760),
    sampleRequirementText: '按 M 码确认 DTF 直喷位置，胸前图案居中，袖口不加印。',
    confirmationRemark: '只有花型准备项，无染色和辅料下单。',
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
    imageUrl: '/cardigan-sample.jpg',
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
    materialRequirement: materialRequirement('YRN-202603-004', '12GG 羊毛混纺纱', '主纱线', 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=240&q=80', 380, 380, 220, 'kg'),
    sampleRequirementText: '按 S 码打基码，帽绳孔位和下摆罗纹按原样保留。',
    confirmationRemark: '毛织款选择面料染色，先确认雾蓝色卡。',
    productionDemandNo: 'PD-202603-004',
    productionOrderNo: 'PO-202603-004',
    techPackVersionLabel: 'TP-v1.4',
    techPackPublishedAt: '2026-03-04T09:00:00',
    status: '进行中',
    currentBlockerText: '毛织齐码纸样整理中，面料染色已完成',
    expectedFinishAt: '2026-03-11T18:00:00',
    closedReason: '',
    outputReady: false,
    outputPublishedAt: '',
    items: [
      req('毛织基码纸样', '已完成', '毛织团队', 'Yuni', '2026-03-04T11:00:00', '2026-03-05T18:00:00', '2026-03-05T17:00:00', '毛织主线', [], '毛织基码', { evidenceSummary: '毛织基码纸样已上传' }),
      req('版衣制作', '已完成', '车板团队', 'Dewi', '2026-03-06T09:00:00', '2026-03-07T18:00:00', '2026-03-07T16:50:00', '毛织主线', ['prep-202603-004-item-01'], '版衣', { evidenceSummary: '毛织版衣已完成' }),
      req('毛织齐码纸样', '进行中', '毛织团队', 'Yuni', '2026-03-08T09:00:00', '2026-03-09T18:00:00', '', '毛织主线', ['prep-202603-004-item-02'], '毛织齐码', { evidenceSummary: 'M-XL 毛织齐码整理中' }),
      req('辅料下单', '已完成', '采购团队', '周怡', '2026-03-06T09:00:00', '2026-03-08T18:00:00', '2026-03-08T13:10:00', '辅料并行', [], '主辅料', { evidenceSummary: '拉链和绳头采购单已同步' }),
      opt('染色调色（面料）', true, '已完成', '染色团队', 'Wulan', '2026-03-07T09:00:00', '2026-03-10T18:00:00', '2026-03-10T16:40:00', '染色并行', '面料染色', { evidenceSummary: '雾蓝色面料色卡已确认', dyeRequirement: { materialNo: 'FAB-202603-004', materialName: '12GG 羊毛混纺纱', colorName: '雾蓝', pantoneCode: 'PANTONE 14-4318 TPX', remark: '先出 1 张色卡给跟单确认。', maintainedBy: 'Nadia', maintainedAt: '2026-03-04T10:20:00' } }),
    ],
  }),
  record({
    recordId: 'prep-202603-005',
    recordNo: 'PREP-202603-005',
    spuCode: 'SPU-WV-260305',
    spuName: '纯梭织户外轻量夹克',
    imageUrl: '/jacket-sample.jpg',
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
    materialRequirement: materialRequirement('FAB-202603-005', '轻量防泼尼龙布', '梭织主布', 'https://images.unsplash.com/photo-1534639077088-d702bcf685e2?auto=format&fit=crop&w=240&q=80', 690, 690, 690),
    sampleRequirementText: '按 M 码打版，袋口和下摆抽绳结构按技术包 V0.9 执行。',
    confirmationRemark: '纯梭织款，花型和面料染色均不选择。',
    productionDemandNo: 'PD-202603-005',
    productionOrderNo: 'PO-202603-005',
    techPackVersionLabel: 'TP-v0.9',
    techPackPublishedAt: '2026-03-05T13:20:00',
    status: '已完成',
    currentBlockerText: '纯梭织必做项和辅料下单均已完成，花型和面料染色未选择',
    expectedFinishAt: '2026-03-12T18:00:00',
    closedReason: '',
    outputReady: true,
    outputPublishedAt: '2026-03-10T16:20:00',
    items: [
      req('梭织基码纸样', '已完成', '版师团队', '陈晓岚', '2026-03-05T15:00:00', '2026-03-06T18:00:00', '2026-03-06T17:20:00', '梭织主线', [], '梭织基码', { evidenceSummary: '户外夹克基码纸样已上传' }),
      req('版衣制作', '已完成', '车板团队', 'Ayu', '2026-03-07T09:00:00', '2026-03-08T18:00:00', '2026-03-08T17:10:00', '梭织主线', ['prep-202603-005-item-01'], '版衣', { evidenceSummary: '户外夹克版衣已上传' }),
      req('梭织齐码纸样', '已完成', '版师团队', '陈晓岚', '2026-03-09T09:00:00', '2026-03-10T18:00:00', '2026-03-10T15:50:00', '梭织主线', ['prep-202603-005-item-02'], '梭织齐码', { evidenceSummary: 'S-XL 梭织齐码纸样已上传' }),
      req('辅料下单', '已完成', '采购团队', '周怡', '2026-03-06T09:00:00', '2026-03-08T18:00:00', '2026-03-08T14:30:00', '辅料并行', [], '主辅料', { evidenceSummary: '拉链和洗标已下单' }),
      opt('数码印/DTF/DTG花型', false, '待判断', '花型团队', '待确认', '', '', '', '花型并行', '花型', { evidenceSummary: '跟单未选择花型准备' }),
      opt('染色调色（面料）', false, '待判断', '染色团队', '待确认', '', '', '', '染色并行', '面料染色', { evidenceSummary: '跟单未选择面料染色调色' }),
    ],
  }),
  record({
    recordId: 'prep-202603-006',
    recordNo: 'PREP-202603-006',
    spuCode: 'SPU-KN-260306',
    spuName: '毛织商务针织衫',
    imageUrl: '/shirt-sample.jpg',
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
    materialRequirement: materialRequirement('YRN-202603-006', '14GG 精梳棉纱', '主纱线', 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=240&q=80', 410, 410, 410, 'kg'),
    sampleRequirementText: '按 S 码做基码，领口和袖口罗纹弹力需先确认。',
    confirmationRemark: '使用现货藏青纱线，无需染色调色。',
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
      opt('染色调色（面料）', false, '待判断', '染色团队', '待确认', '', '', '', '染色并行', '面料染色', { evidenceSummary: '跟单未选择面料染色调色' }),
    ],
  }),
  record({
    recordId: 'prep-202604-001',
    recordNo: 'PREP-202604-001',
    spuCode: 'SPU-WV-260401',
    spuName: '纯梭织亚麻衬衫',
    imageUrl: '/shirt-sample.jpg',
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
    materialRequirement: materialRequirement('FAB-202604-001', '亚麻棉混纺布', '梭织主布', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=240&q=80', 880, 880, 880),
    sampleRequirementText: '按 M 码打基码，领口止口和袖肥按亚麻缩水预留。',
    confirmationRemark: '纯梭织亚麻款，不选择花型和染色。',
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
      opt('数码印/DTF/DTG花型', false, '待判断', '花型团队', '待确认', '', '', '', '花型并行', '花型', { evidenceSummary: '纯色亚麻款未选择花型' }),
      opt('染色调色（面料）', false, '待判断', '染色团队', '待确认', '', '', '', '染色并行', '面料染色', { evidenceSummary: '使用现货亚麻本色，未选择染色' }),
    ],
  }),
  record({
    recordId: 'prep-202604-002',
    recordNo: 'PREP-202604-002',
    spuCode: 'SPU-KN-260402',
    spuName: '毛织缎面拼色上衣',
    imageUrl: '/lace-dress-sample.jpg',
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
    materialRequirement: materialRequirement('FAB-202604-002', '缎面拼色面料', '拼接面料', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=240&q=80', 330, 240, 120),
    sampleRequirementText: '按 S 码打版，缎面拼接位置需和毛织片宽对齐。',
    confirmationRemark: '面料染色已选，色卡超时后由跟单继续催办。',
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
      opt('染色调色（面料）', true, '已超时', '染色团队', 'Rini', '2026-04-03T09:00:00', '2026-04-06T18:00:00', '', '染色并行', '面料染色', { evidenceSummary: '待上传潘通色卡照片', overdueHours: 14, dyeRequirement: { materialNo: 'FAB-202604-002', materialName: '缎面拼色面料', colorName: '珍珠白', pantoneCode: 'PANTONE 11-0602 TPX', remark: '色卡需拍照回传，避免缎面偏黄。', maintainedBy: 'Sinta', maintainedAt: '2026-04-02T12:10:00' } }),
    ],
  }),
  record({
    recordId: 'prep-202604-003',
    recordNo: 'PREP-202604-003',
    spuCode: 'SPU-PT-260403',
    spuName: '直喷水洗短裤',
    imageUrl: '/denim-shorts-sample.jpg',
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
    materialRequirement: materialRequirement('FAB-202604-003', '水洗棉斜纹布', '梭织主布', 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=240&q=80', 520, 360, 180),
    sampleRequirementText: '按 M 码确认短裤版型，直喷图案按裤脚外侧定位。',
    confirmationRemark: '烫画&直喷类型，仅保留花型准备项。',
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
    spuName: '毛织罗纹拼接休闲T恤',
    imageUrl: '/tshirt-sample.jpg',
    selectionName: '桑妮',
    buyerName: '沈若琳',
    merchandiserName: 'Maya',
    sourceReason: '销量达标',
    craftTags: ['毛织拼接', '数码印'],
    categoryTags: ['毛织'],
    largeGoodsReachedQty: 364,
    largeGoodsReachedAt: '2026-04-04T15:00:00',
    largeGoodsReachedDays: 5,
    enteredAt: '2026-04-04T15:25:00',
    derivedProductPrepType: '毛织',
    confirmedProductPrepType: '毛织&梭织',
    prepTypeSource: '人工修正',
    prepTypeConfirmedBy: 'Maya',
    prepTypeConfirmedAt: '2026-04-04T15:40:00',
    prepTypeOverrideReason: '正式技术包补充后片梭织拼接，需同时准备毛织和梭织纸样',
    materialRequirement: materialRequirement('YRN-202604-004', '毛织罗纹纱', '主纱线', 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=240&q=80', 360, 320, 180, 'kg', [
      { materialNo: 'YRN-202604-004', materialName: '毛织罗纹纱', materialType: '主纱线', imageUrl: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=240&q=80', requiredQty: 360, preparedQty: 320, issuedQty: 180, unit: 'kg' },
      { materialNo: 'FAB-202604-004B', materialName: '梭织后片棉布', materialType: '拼接面料', imageUrl: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=240&q=80', requiredQty: 220, preparedQty: 160, issuedQty: 80, unit: '米' },
    ]),
    sampleRequirementText: '毛织罗纹按 S 码起版，后片梭织拼接需保留图案位置。',
    confirmationRemark: '人工修正为毛织&梭织，选择花型和面料染色，不选纱线染色。',
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
      opt('数码印/DTF/DTG花型', true, '待确认', '花型团队', '林小美', '2026-04-05T09:00:00', '2026-04-08T18:00:00', '', '花型并行', '花型', { evidenceSummary: '花型完成图待买手确认', overdueHours: 6, patternTaskNo: 'PAT-202604-004', patternDesignerId: 'designer-linxiaomei', patternDesignerName: '林小美', patternTeamName: '中国花型组', assignedAt: '2026-04-05T09:20:00', completionImageIds: ['img-pattern-004'], patternFileIds: ['file-pattern-004'], buyerReviewStatus: '待确认' }),
      opt('染色调色（纱线）', false, '待判断', '染色团队', '待确认', '', '', '', '染色并行', '纱线染色', { evidenceSummary: '跟单未选择纱线染色' }),
      opt('染色调色（面料）', true, '进行中', '染色团队', 'Rini', '2026-04-05T09:00:00', '2026-04-08T18:00:00', '', '染色并行', '面料染色', { evidenceSummary: '面料染色二次复核', overdueHours: 4, dyeRequirement: { materialNo: 'FAB-202604-004B', materialName: '梭织后片棉布', colorName: '雾灰', pantoneCode: 'PANTONE 15-4305 TPX', remark: '需和前片罗纹灰度接近，避免后片明显偏冷。', maintainedBy: 'Maya', maintainedAt: '2026-04-04T16:05:00' } }),
    ],
  }),
  record({
    recordId: 'prep-202604-005',
    recordNo: 'PREP-202604-005',
    spuCode: 'SPU-PT-260405',
    spuName: 'DTG 图案基础T恤',
    imageUrl: '/tshirt-sample.jpg',
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
    workItemsConfirmedBy: '',
    workItemsConfirmedAt: '',
    materialRequirement: materialRequirement('FAB-202604-005', '26S 棉涤单面布', '针织主布', 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=240&q=80', 610, 300, 0),
    sampleRequirementText: '按 M 码确认基础 T 恤版型，DTG 图案需预留洗后缩率。',
    confirmationRemark: '待跟单确认本款是否按烫画&直喷准备，花型暂不分配。',
    productionDemandNo: '',
    productionOrderNo: '',
    techPackVersionLabel: '',
    techPackPublishedAt: '',
    status: '未开始',
    currentBlockerText: '待跟单确认商品类型和花型准备项',
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
    imageUrl: '/cardigan-sample.jpg',
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
    materialRequirement: materialRequirement('YRN-202604-006', '羊毛混纺纱', '主纱线', 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=240&q=80', 450, 450, 450, 'kg', [
      { materialNo: 'YRN-202604-006', materialName: '羊毛混纺纱', materialType: '主纱线', imageUrl: 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&w=240&q=80', requiredQty: 450, preparedQty: 450, issuedQty: 450, unit: 'kg' },
      { materialNo: 'FAB-202604-006B', materialName: '浅灰梭织拼接布', materialType: '拼接面料', imageUrl: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=240&q=80', requiredQty: 280, preparedQty: 280, issuedQty: 280, unit: '米' },
    ]),
    sampleRequirementText: '毛织和梭织按同一 S 码样衣确认，开衫门襟需对齐拼接布色差。',
    confirmationRemark: '同时选择纱线染色和面料染色，两个色卡需分开回传。',
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
      opt('数码印/DTF/DTG花型', false, '待判断', '花型团队', '待确认', '', '', '', '花型并行', '花型', { evidenceSummary: '跟单未选择花型准备' }),
      opt('染色调色（纱线）', true, '已完成', '染色团队', 'Wulan', '2026-04-07T09:00:00', '2026-04-10T18:00:00', '2026-04-10T15:30:00', '染色并行', '纱线染色', { evidenceSummary: '纱线灰蓝色卡已确认', dyeRequirement: { materialNo: 'YRN-202604-006', materialName: '羊毛混纺纱', colorName: '灰蓝', pantoneCode: 'PANTONE 16-3915 TPX', remark: '先确认纱线色卡，再安排毛织齐码。', maintainedBy: 'Sinta', maintainedAt: '2026-04-06T10:35:00' } }),
      opt('染色调色（面料）', true, '已完成', '染色团队', 'Rini', '2026-04-07T09:00:00', '2026-04-10T18:00:00', '2026-04-10T16:10:00', '染色并行', '面料染色', { evidenceSummary: '梭织面料浅灰色卡已确认', dyeRequirement: { materialNo: 'FAB-202604-006B', materialName: '浅灰梭织拼接布', colorName: '浅灰', pantoneCode: 'PANTONE 14-4102 TPX', remark: '需和灰蓝纱线拼接后不过亮。', maintainedBy: 'Sinta', maintainedAt: '2026-04-06T10:45:00' } }),
    ],
  }),
]

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort()
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function dateInRange(dateTime: string, startDate?: string, endDate?: string): boolean {
  if (!dateTime) return false
  const date = dateTime.slice(0, 10)
  if (startDate && date < startDate) return false
  if (endDate && date > endDate) return false
  return true
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
    record.materialRequirement.materialNo,
    record.materialRequirement.materialName,
    record.materialRequirement.materialType,
    ...((record.materialRequirement.items ?? []).flatMap((material) => [
      material.materialNo,
      material.materialName,
      material.materialType,
    ])),
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

function isSelectedPreparationItem(item: Pick<ProductionPreparationItem, 'selectedByMerchandiser' | 'status'>): boolean {
  return item.selectedByMerchandiser !== false && item.status !== '无需'
}

function hasPatternUploadGap(item: ProductionPreparationItem): boolean {
  return (
    item.itemType === '数码印/DTF/DTG花型' &&
    isSelectedPreparationItem(item) &&
    (!item.completionImageIds?.length || !item.patternFileIds?.length)
  )
}

function matchesCompletionItemFilter(item: FlattenedPreparationItem, filter: ProductionPreparationFilter): boolean {
  const patternDesigner =
    filter.quickFilter === '我的花型任务'
      ? '林小美'
      : resolvePatternDesignerName(filter.patternDesigner)

  if (!isSelectedPreparationItem(item) || item.recordStatus === '已关闭') return false
  if (filter.itemType && filter.itemType !== '全部' && item.itemType !== filter.itemType) return false
  if (filter.ownerTeam && item.ownerTeam !== filter.ownerTeam) return false
  if (filter.ownerName && item.ownerName !== filter.ownerName) return false
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
    const selectedItems = record.items.filter(isSelectedPreparationItem)
    const filterableItems = record.status === '已关闭' ? [] : selectedItems

    if (filter.startDate || filter.endDate) {
      const enteredInRange = dateInRange(record.enteredAt, filter.startDate, filter.endDate)
      const finishedInRange = filterableItems.some((item) => dateInRange(item.actualFinishAt, filter.startDate, filter.endDate))
      if (!enteredInRange && !finishedInRange) return false
    } else if (filter.month) {
      const enteredInMonth = record.enteredAt.startsWith(filter.month)
      const finishedInMonth = filterableItems.some((item) => item.actualFinishAt.startsWith(filter.month ?? ''))
      if (!enteredInMonth && !finishedInMonth) return false
    }

    if (filter.merchandiserName && record.merchandiserName !== filter.merchandiserName) return false
    if (filter.buyerName && record.buyerName !== filter.buyerName) return false
    if (filter.recordStatus && filter.recordStatus !== '全部' && record.status !== filter.recordStatus) return false
    if (
      filter.itemType &&
      filter.itemType !== '全部' &&
      !filterableItems.some((item) => item.itemType === filter.itemType)
    ) {
      return false
    }
    if (
      filter.ownerTeam &&
      !filterableItems.some((item) => item.ownerTeam === filter.ownerTeam)
    ) {
      return false
    }
    if (
      filter.ownerName &&
      !filterableItems.some((item) => item.ownerName === filter.ownerName)
    ) {
      return false
    }
    if (
      patternDesigner &&
      !filterableItems.some((item) => item.itemType === '数码印/DTF/DTG花型' && item.patternDesignerName === patternDesigner)
    ) {
      return false
    }
    if (filter.overdueOnly && !filterableItems.some((item) => item.status === '已超时' || item.overdueHours > 0)) {
      return false
    }
    if (filter.quickFilter === '待上传完成图' && !filterableItems.some(hasPatternUploadGap)) return false
    if (
      filter.quickFilter === '待买手确认' &&
      !filterableItems.some((item) => item.itemType === '数码印/DTF/DTG花型' && item.buyerReviewStatus === '待确认')
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
  const requiredItems = flattenProductionPreparationItems(activeRecords).filter(isSelectedPreparationItem)
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
    ownerNames: uniqueSorted(items.map((item) => item.ownerName).filter((name) => name && name !== '待确认' && name !== '待分配')),
    patternDesigners: patternDesignerOptions,
  }
}
