// 工艺字典 - ProcessType
// 稳定编码，不可变更

export type ProcessStage = 'PREP' | 'CUTTING' | 'SEWING' | 'POST' | 'SPECIAL' | 'MATERIAL' | 'WAREHOUSE'
export type AssignmentMode = 'DIRECT' | 'BIDDING'
export type OwnerTier = 'ANY' | 'CENTRAL' | 'SATELLITE' | 'THIRD_PARTY'
export type ProcessAssignmentGranularity = 'ORDER' | 'COLOR' | 'SKU'

export interface ProcessType {
  code: string
  nameZh: string
  stage: ProcessStage
  assignmentGranularity: ProcessAssignmentGranularity
  canOutsource: boolean
  isExternalConstraint: boolean
  recommendedAssignmentMode: AssignmentMode
  recommendedOwnerTier: OwnerTier
  recommendedOwnerTypes: string[]
  defaultQcPoints: string[]
  defaultParamKeys: string[]
}

export const stageLabels: Record<ProcessStage, string> = {
  PREP: '前道准备',
  CUTTING: '裁剪',
  SEWING: '车缝',
  POST: '后道',
  SPECIAL: '特种工艺',
  MATERIAL: '物料',
  WAREHOUSE: '仓储',
}

const processAssignmentGranularityOverrides: Partial<Record<string, ProcessAssignmentGranularity>> = {
  PROC_PRINT: 'COLOR',
  PROC_DYE: 'COLOR',
  PROC_SEW: 'SKU',
  PROC_IRON: 'SKU',
  PROC_PACK: 'SKU',
  PROC_QC: 'SKU',
  PROC_FINISHING: 'SKU',
}

// 预置工艺字典（30+）
const processTypeSeeds: Omit<ProcessType, 'assignmentGranularity'>[] = [
  // 裁剪类
  {
    code: 'PROC_CUT',
    nameZh: '裁片',
    stage: 'CUTTING',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING', 'CUTTING'],
    defaultQcPoints: ['裁片数量核对', '裁片尺寸抽检', '布料色差检查'],
    defaultParamKeys: ['layerCount', 'cuttingMethod'],
  },
  {
    code: 'PROC_SHRINK',
    nameZh: '缩水',
    stage: 'PREP',
    canOutsource: true,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING', 'SPECIAL_PROCESS'],
    defaultQcPoints: ['缩水率测试', '布料平整度'],
    defaultParamKeys: ['shrinkRate', 'temperature'],
  },
  {
    code: 'PROC_POSITION_CUT',
    nameZh: '定位裁',
    stage: 'CUTTING',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'CENTRAL',
    recommendedOwnerTypes: ['SEWING', 'CUTTING'],
    defaultQcPoints: ['定位精度检查', '花型对位检查'],
    defaultParamKeys: ['positionMethod'],
  },
  {
    code: 'PROC_DIRECTION_CUT',
    nameZh: '定向裁',
    stage: 'CUTTING',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'CENTRAL',
    recommendedOwnerTypes: ['SEWING', 'CUTTING'],
    defaultQcPoints: ['纹路方向检查', '裁片一致性'],
    defaultParamKeys: ['directionType'],
  },
  {
    code: 'PROC_LASER_CUT',
    nameZh: '激光切',
    stage: 'CUTTING',
    canOutsource: true,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'BIDDING',
    recommendedOwnerTier: 'CENTRAL',
    recommendedOwnerTypes: ['SPECIAL_PROCESS', 'LASER'],
    defaultQcPoints: ['切边精度', '无烧焦痕迹', '图案完整性'],
    defaultParamKeys: ['laserPower', 'cuttingSpeed'],
  },

  // 车缝类
  {
    code: 'PROC_SEW',
    nameZh: '车缝',
    stage: 'SEWING',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING'],
    defaultQcPoints: ['线迹均匀', '缝合牢固', '尺寸符合'],
    defaultParamKeys: ['stitchType', 'needleType'],
  },
  {
    code: 'PROC_PLEAT',
    nameZh: '压褶',
    stage: 'SEWING',
    canOutsource: true,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'BIDDING',
    recommendedOwnerTier: 'CENTRAL',
    recommendedOwnerTypes: ['SEWING', 'SPECIAL_PROCESS'],
    defaultQcPoints: ['褶皱均匀', '褶距一致', '定型牢固'],
    defaultParamKeys: ['pleatWidth', 'pleatDepth'],
  },
  {
    code: 'PROC_DALAN',
    nameZh: '打揽',
    stage: 'SEWING',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING'],
    defaultQcPoints: ['揽线均匀', '松紧适中'],
    defaultParamKeys: ['gatherRatio'],
  },
  {
    code: 'PROC_DATIAO',
    nameZh: '打条',
    stage: 'SEWING',
    canOutsource: true,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'BIDDING',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING', 'SPECIAL_PROCESS'],
    defaultQcPoints: ['条宽一致', '缝合牢固', '无露底'],
    defaultParamKeys: ['stripWidth'],
  },
  {
    code: 'PROC_KUNTIAO',
    nameZh: '捆条',
    stage: 'SEWING',
    canOutsource: true,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING'],
    defaultQcPoints: ['捆边均匀', '无起皱'],
    defaultParamKeys: ['bindingWidth'],
  },
  {
    code: 'PROC_TANGTIAO',
    nameZh: '搪条',
    stage: 'SEWING',
    canOutsource: true,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING'],
    defaultQcPoints: ['包边平整', '宽度一致'],
    defaultParamKeys: ['edgeWidth'],
  },

  // 扣类
  {
    code: 'PROC_HAND_BUTTON',
    nameZh: '手缝扣',
    stage: 'SEWING',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING'],
    defaultQcPoints: ['扣位准确', '缝线牢固', '线迹整齐'],
    defaultParamKeys: ['buttonType', 'threadType'],
  },
  {
    code: 'PROC_MACHINE_BUTTON',
    nameZh: '机打扣',
    stage: 'SEWING',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING'],
    defaultQcPoints: ['扣位准确', '打扣牢固'],
    defaultParamKeys: ['buttonSize'],
  },
  {
    code: 'PROC_FOUR_CLAW',
    nameZh: '四爪扣',
    stage: 'SEWING',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING'],
    defaultQcPoints: ['四爪紧固', '无脱落风险'],
    defaultParamKeys: ['clawSize'],
  },
  {
    code: 'PROC_EYELET',
    nameZh: '鸡眼扣',
    stage: 'SEWING',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING'],
    defaultQcPoints: ['孔眼圆整', '金属无毛刺'],
    defaultParamKeys: ['eyeletSize'],
  },
  {
    code: 'PROC_BUTTONHOLE',
    nameZh: '开扣眼',
    stage: 'SEWING',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING'],
    defaultQcPoints: ['扣眼大小一致', '锁边牢固', '无散线'],
    defaultParamKeys: ['holeLength', 'holeType'],
  },
  {
    code: 'PROC_QUYA',
    nameZh: '曲牙',
    stage: 'SEWING',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING'],
    defaultQcPoints: ['曲牙均匀', '拉合顺滑'],
    defaultParamKeys: ['zipperType'],
  },
  {
    code: 'PROC_CLOTH_BUTTON',
    nameZh: '布包扣',
    stage: 'SEWING',
    canOutsource: true,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING', 'SPECIAL_PROCESS'],
    defaultQcPoints: ['包布平整', '无皱褶', '扣脚牢固'],
    defaultParamKeys: ['buttonDiameter'],
  },
  {
    code: 'PROC_PANKOU',
    nameZh: '手工盘扣',
    stage: 'SEWING',
    canOutsource: true,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'BIDDING',
    recommendedOwnerTier: 'CENTRAL',
    recommendedOwnerTypes: ['SPECIAL_PROCESS', 'SEWING'],
    defaultQcPoints: ['盘扣造型', '缝合牢固', '对称美观'],
    defaultParamKeys: ['knotStyle'],
  },

  // 特种工艺
  {
    code: 'PROC_EMBROIDER',
    nameZh: '绣花',
    stage: 'SPECIAL',
    canOutsource: true,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'BIDDING',
    recommendedOwnerTier: 'CENTRAL',
    recommendedOwnerTypes: ['EMBROIDERY', 'SPECIAL_PROCESS'],
    defaultQcPoints: ['绣花图案完整', '线迹密度', '背面整洁'],
    defaultParamKeys: ['embroideryType', 'threadColor'],
  },
  {
    code: 'PROC_TANHUA',
    nameZh: '烫画',
    stage: 'SPECIAL',
    canOutsource: true,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'BIDDING',
    recommendedOwnerTier: 'CENTRAL',
    recommendedOwnerTypes: ['PRINTING', 'SPECIAL_PROCESS'],
    defaultQcPoints: ['图案清晰', '附着牢固', '无气泡'],
    defaultParamKeys: ['transferType', 'temperature'],
  },
  {
    code: 'PROC_DIRECT_PRINT',
    nameZh: '直喷',
    stage: 'SPECIAL',
    canOutsource: true,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'BIDDING',
    recommendedOwnerTier: 'CENTRAL',
    recommendedOwnerTypes: ['PRINTING', 'SPECIAL_PROCESS'],
    defaultQcPoints: ['色彩还原度', '喷印均匀', '手感柔软'],
    defaultParamKeys: ['inkType', 'resolution'],
  },
  {
    code: 'PROC_SHELL_EMBROIDER',
    nameZh: '贝壳绣',
    stage: 'SPECIAL',
    canOutsource: true,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'BIDDING',
    recommendedOwnerTier: 'CENTRAL',
    recommendedOwnerTypes: ['EMBROIDERY', 'SPECIAL_PROCESS'],
    defaultQcPoints: ['贝壳固定牢固', '排列整齐', '无脱落'],
    defaultParamKeys: ['shellSize', 'pattern'],
  },

  // 印染类（外部约束）
  {
    code: 'PROC_PRINT',
    nameZh: '印花',
    stage: 'SPECIAL',
    canOutsource: true,
    isExternalConstraint: true,
    recommendedAssignmentMode: 'BIDDING',
    recommendedOwnerTier: 'THIRD_PARTY',
    recommendedOwnerTypes: ['PRINTING', 'DYEING'],
    defaultQcPoints: ['印花对位准确', '色牢度达标', '无色差'],
    defaultParamKeys: ['printMethod', 'colorCount'],
  },
  {
    code: 'PROC_DYE',
    nameZh: '染色',
    stage: 'SPECIAL',
    canOutsource: true,
    isExternalConstraint: true,
    recommendedAssignmentMode: 'BIDDING',
    recommendedOwnerTier: 'THIRD_PARTY',
    recommendedOwnerTypes: ['DYEING'],
    defaultQcPoints: ['色牢度', '均匀度', '无色斑'],
    defaultParamKeys: ['dyeType', 'colorCode'],
  },
  {
    code: 'PROC_WASH',
    nameZh: '洗水',
    stage: 'SPECIAL',
    canOutsource: true,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'BIDDING',
    recommendedOwnerTier: 'THIRD_PARTY',
    recommendedOwnerTypes: ['WASHING', 'DENIM'],
    defaultQcPoints: ['洗水效果', '手感达标', '无损伤'],
    defaultParamKeys: ['washType', 'intensity'],
  },

  // 后道
  {
    code: 'PROC_IRON',
    nameZh: '整烫',
    stage: 'POST',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING', 'FINISHING'],
    defaultQcPoints: ['平整无皱', '无极光', '无水渍'],
    defaultParamKeys: ['ironTemperature'],
  },
  {
    code: 'PROC_PACK',
    nameZh: '包装',
    stage: 'POST',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING', 'FINISHING', 'WAREHOUSE'],
    defaultQcPoints: ['包装完整', '吊牌齐全', '数量准确'],
    defaultParamKeys: ['packingMethod'],
  },
  {
    code: 'PROC_QC',
    nameZh: '质检',
    stage: 'POST',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING', 'FINISHING'],
    defaultQcPoints: ['尺寸抽检', '外观检查', '功能测试'],
    defaultParamKeys: ['qcLevel'],
  },
  {
    code: 'PROC_FINISHING',
    nameZh: '后整理',
    stage: 'POST',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['SEWING', 'FINISHING'],
    defaultQcPoints: ['线头处理', '标签检查', '整体外观'],
    defaultParamKeys: [],
  },

  // 仓储物料
  {
    code: 'PROC_MATERIAL_PREP',
    nameZh: '物料准备',
    stage: 'MATERIAL',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['WAREHOUSE', 'SEWING'],
    defaultQcPoints: ['物料齐套', '数量准确', '质量合格'],
    defaultParamKeys: [],
  },
  {
    code: 'PROC_WAREHOUSE_IN',
    nameZh: '入库',
    stage: 'WAREHOUSE',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['WAREHOUSE'],
    defaultQcPoints: ['数量核对', '质量抽检', '系统录入'],
    defaultParamKeys: [],
  },
]

export const processTypes: ProcessType[] = processTypeSeeds.map((item) => ({
  ...item,
  // 仅对明确冻结的工序覆盖为 SKU/COLOR，其余默认整单。
  assignmentGranularity: processAssignmentGranularityOverrides[item.code] ?? 'ORDER',
}))

// 根据code获取工艺
export function getProcessTypeByCode(code: string): ProcessType | undefined {
  return processTypes.find(p => p.code === code)
}

// 根据stage获取工艺列表
export function getProcessTypesByStage(stage: ProcessStage): ProcessType[] {
  return processTypes.filter(p => p.stage === stage)
}

// 获取所有工艺code列表
export function getAllProcessCodes(): string[] {
  return processTypes.map(p => p.code)
}

export function getProcessAssignmentGranularity(code: string): ProcessAssignmentGranularity {
  const process = getProcessTypeByCode(code)
  if (!process) return processAssignmentGranularityOverrides[code] ?? 'ORDER'
  return process.assignmentGranularity
}

export function isSkuGranularityProcess(code: string): boolean {
  return getProcessAssignmentGranularity(code) === 'SKU'
}

export function isColorGranularityProcess(code: string): boolean {
  return getProcessAssignmentGranularity(code) === 'COLOR'
}
