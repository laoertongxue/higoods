import type { SamCurrentFieldKey } from './process-craft-dict.ts'

export type FactorySupplyFormulaTemplate = 'A' | 'B' | 'C' | 'D'

export interface FactorySupplyFormulaGuide {
  template: FactorySupplyFormulaTemplate
  idealFormulaLines: string[]
  currentFieldKeys: SamCurrentFieldKey[]
  currentFormulaLines: string[]
  currentExplanationLines: string[]
  currentExampleLines: string[]
  currentReason: string
}

const TEMPLATE_A_CRAFT_NAMES = ['基础连接', '手缝扣', '手工盘扣', '包装'] as const
const TEMPLATE_B_CRAFT_NAMES = [
  '定位裁',
  '定向裁',
  '绣花',
  '贝壳绣',
  '曲牙',
  '打揽',
  '烫画',
  '直喷',
  '开扣眼',
  '机打扣',
  '四爪扣',
  '布包扣',
  '鸡眼扣',
  '熨烫',
] as const
const TEMPLATE_C_CRAFT_NAMES = ['丝网印', '数码印', '压褶', '打条', '激光切', '捆条', '印花工艺'] as const
const TEMPLATE_D_CRAFT_NAMES = ['匹染', '色织', '染色工艺', '缩水', '洗水'] as const

export const FACTORY_SUPPLY_TEMPLATE_BY_CRAFT_NAME: Record<string, FactorySupplyFormulaTemplate> = Object.fromEntries(
  [
    ...TEMPLATE_A_CRAFT_NAMES.map((name) => [name, 'A']),
    ...TEMPLATE_B_CRAFT_NAMES.map((name) => [name, 'B']),
    ...TEMPLATE_C_CRAFT_NAMES.map((name) => [name, 'C']),
    ...TEMPLATE_D_CRAFT_NAMES.map((name) => [name, 'D']),
  ],
) as Record<string, FactorySupplyFormulaTemplate>

export const CURRENT_STAGE_ALLOWED_FIELD_KEYS: SamCurrentFieldKey[] = [
  'deviceCount',
  'deviceShiftMinutes',
  'deviceEfficiencyValue',
  'staffCount',
  'staffShiftMinutes',
  'staffEfficiencyValue',
  'batchLoadCapacity',
  'cycleMinutes',
  'setupMinutes',
  'switchMinutes',
  'efficiencyFactor',
]

export const EXPECTED_SAM_CURRENT_FIELD_KEYS_BY_TEMPLATE: Record<FactorySupplyFormulaTemplate, SamCurrentFieldKey[]> = {
  A: ['staffCount', 'staffShiftMinutes', 'staffEfficiencyValue', 'efficiencyFactor'],
  B: [
    'deviceCount',
    'deviceShiftMinutes',
    'deviceEfficiencyValue',
    'staffCount',
    'staffShiftMinutes',
    'staffEfficiencyValue',
    'setupMinutes',
    'switchMinutes',
    'efficiencyFactor',
  ],
  C: [
    'deviceCount',
    'deviceShiftMinutes',
    'deviceEfficiencyValue',
    'staffCount',
    'staffShiftMinutes',
    'staffEfficiencyValue',
    'setupMinutes',
    'switchMinutes',
    'efficiencyFactor',
  ],
  D: [
    'deviceCount',
    'deviceShiftMinutes',
    'batchLoadCapacity',
    'cycleMinutes',
    'staffCount',
    'staffShiftMinutes',
    'staffEfficiencyValue',
    'setupMinutes',
    'switchMinutes',
    'efficiencyFactor',
  ],
}

function buildTemplateAGuide(craftName: string): FactorySupplyFormulaGuide {
  return {
    template: 'A',
    idealFormulaLines: [
      '人员侧日供给能力 = 人数 × 单人默认日有效分钟 × 人员标准效率值',
      '标准完整口径下的日供给能力 = 人员侧日供给能力 × 工厂效率系数',
    ],
    currentFieldKeys: EXPECTED_SAM_CURRENT_FIELD_KEYS_BY_TEMPLATE.A,
    currentFormulaLines: [
      '基础日能力 = staffCount × staffShiftMinutes × staffEfficiencyValue',
      '默认日可供给发布工时 SAM = 基础日能力 × efficiencyFactor',
    ],
    currentExplanationLines: [
      '理想完整口径会同时保留人员效率单位，用来解释人工效率值的业务口径。',
      '当前阶段只让工厂维护人数、单人默认日有效分钟、人员标准效率值和工厂效率系数这 4 个最小必要数值字段。',
      '系统会根据这 4 个字段自动换算默认日可供给发布工时 SAM，不需要工厂再手工录入结果值。',
      '工厂效率系数用来修正理论结果值和这家工厂实际可兑现能力之间的偏差。',
    ],
    currentExampleLines: [
      `某工厂做“${craftName}”，有 8 人，每人默认日有效 420 分钟，人员标准效率值 0.8，工厂效率系数 0.9。`,
      '基础日能力 = 8 × 420 × 0.8 = 2688',
      '默认日可供给发布工时 SAM = 2688 × 0.9 = 2419.2',
    ],
    currentReason:
      '理想完整口径会保留人员效率单位做解释字段；当前阶段只收敛人数、单人默认日有效分钟、人员标准效率值和工厂效率系数，系统据此自动算出默认日可供给发布工时 SAM。',
  }
}

function buildTemplateBGuide(craftName: string): FactorySupplyFormulaGuide {
  return {
    template: 'B',
    idealFormulaLines: [
      '设备侧日供给能力 = 设备数量 × 单台默认日有效分钟 × 设备标准效率值',
      '人员侧日供给能力 = 人数 × 单人默认日有效分钟 × 人员标准效率值',
      '标准完整口径下的基础日供给能力 = 设备侧日供给能力 和 人员侧日供给能力 里较小的那个',
      '标准完整口径下的日供给能力 = (基础日供给能力 - 固定准备分钟 - 切换准备分钟) × 工厂效率系数',
    ],
    currentFieldKeys: EXPECTED_SAM_CURRENT_FIELD_KEYS_BY_TEMPLATE.B,
    currentFormulaLines: [
      '设备侧日能力 = deviceCount × deviceShiftMinutes × deviceEfficiencyValue',
      '人员侧日能力 = staffCount × staffShiftMinutes × staffEfficiencyValue',
      '基础日能力 = 设备侧日能力 和 人员侧日能力 里较小的那个',
      '默认日可供给发布工时 SAM = (基础日能力 - setupMinutes - switchMinutes) × efficiencyFactor',
    ],
    currentExplanationLines: [
      '理想完整口径会同时保留设备效率单位和人员效率单位，用来解释设备节拍与人工效率的业务口径。',
      '当前阶段先收敛设备数量、单台默认日有效分钟、设备标准效率值，以及人数、单人默认日有效分钟、人员标准效率值，再加上准备分钟和工厂效率系数。',
      '系统会先分别计算设备侧日能力和人员侧日能力，再取较小值，避免只看设备或只看人工造成高估。',
      '固定准备分钟和切换准备分钟会占掉当天真实可用能力，工厂效率系数再对结果做兑现修正。',
    ],
    currentExampleLines: [
      `某工厂做“${craftName}”，有 4 台设备，每台默认日有效 420 分钟，设备标准效率值 0.7；有 6 人，每人默认日有效 420 分钟，人员标准效率值 0.9；固定准备 20 分钟，切换准备 10 分钟，工厂效率系数 0.95。`,
      '设备侧日能力 = 4 × 420 × 0.7 = 1176',
      '人员侧日能力 = 6 × 420 × 0.9 = 2268',
      '基础日能力 = 1176',
      '默认日可供给发布工时 SAM = (1176 - 20 - 10) × 0.95 = 1088.7',
    ],
    currentReason:
      '理想完整口径会保留设备效率单位和人员效率单位做解释字段；当前阶段只保留最小必要数值字段，系统据此自动算出默认日可供给发布工时 SAM。',
  }
}

function buildTemplateCGuide(craftName: string): FactorySupplyFormulaGuide {
  return {
    template: 'C',
    idealFormulaLines: [
      '设备侧日供给能力 = 设备数量 × 单台默认日有效分钟 × 设备标准效率值',
      '人员侧日供给能力 = 人数 × 单人默认日有效分钟 × 人员标准效率值',
      '标准完整口径下的基础日供给能力 = 设备侧日供给能力 和 人员侧日供给能力 里较小的那个',
      '标准完整口径下的日供给能力 = (基础日供给能力 - 固定准备分钟 - 切换准备分钟) × 工厂效率系数',
    ],
    currentFieldKeys: EXPECTED_SAM_CURRENT_FIELD_KEYS_BY_TEMPLATE.C,
    currentFormulaLines: [
      '设备侧日能力 = deviceCount × deviceShiftMinutes × deviceEfficiencyValue',
      '人员侧日能力 = staffCount × staffShiftMinutes × staffEfficiencyValue',
      '基础日能力 = 设备侧日能力 和 人员侧日能力 里较小的那个',
      '默认日可供给发布工时 SAM = (基础日能力 - setupMinutes - switchMinutes) × efficiencyFactor',
    ],
    currentExplanationLines: [
      '理想完整口径会保留设备效率单位和人员效率单位，用来解释连续推进速度与人工速度口径。',
      '当前阶段先收敛连续型工艺真正参与运算的最小数值字段，不再让工厂额外录入说明性单位字段。',
      '系统先算设备侧日能力，再算人员侧日能力，最后取较小值，确保连续型工艺不会因为单看设备而高估供给能力。',
      '准备分钟与工厂效率系数仍保留，用来修正当天真实能兑现的发布工时 SAM。',
    ],
    currentExampleLines: [
      `某工厂做“${craftName}”，有 3 台设备，每台默认日有效 420 分钟，设备标准效率值 0.8；有 4 人，每人默认日有效 420 分钟，人员标准效率值 0.85；固定准备 15 分钟，切换准备 10 分钟，工厂效率系数 0.9。`,
      '设备侧日能力 = 3 × 420 × 0.8 = 1008',
      '人员侧日能力 = 4 × 420 × 0.85 = 1428',
      '基础日能力 = 1008',
      '默认日可供给发布工时 SAM = (1008 - 15 - 10) × 0.9 = 884.7',
    ],
    currentReason:
      '理想完整口径会保留设备效率单位和人员效率单位做连续型速度解释；当前阶段只保留最小必要数值字段，系统据此自动算出默认日可供给发布工时 SAM。',
  }
}

function buildTemplateDGuide(craftName: string): FactorySupplyFormulaGuide {
  return {
    template: 'D',
    idealFormulaLines: [
      '单台默认日可运行批数 = 单台默认日有效分钟 ÷ 单次循环分钟',
      '设备侧日供给能力 = 单台默认日可运行批数 × 单次有效装载量 × 设备数量',
      '人员侧日供给能力 = 人数 × 单人默认日有效分钟 × 人员标准效率值',
      '标准完整口径下的基础日供给能力 = 设备侧日供给能力 和 人员侧日供给能力 里较小的那个',
      '标准完整口径下的日供给能力 = (基础日供给能力 - 固定准备分钟 - 切换准备分钟) × 工厂效率系数',
    ],
    currentFieldKeys: EXPECTED_SAM_CURRENT_FIELD_KEYS_BY_TEMPLATE.D,
    currentFormulaLines: [
      '单台默认日可运行批数 = deviceShiftMinutes ÷ cycleMinutes',
      '设备侧日能力 = 单台默认日可运行批数 × batchLoadCapacity × deviceCount',
      '人员侧日能力 = staffCount × staffShiftMinutes × staffEfficiencyValue',
      '基础日能力 = 设备侧日能力 和 人员侧日能力 里较小的那个',
      '默认日可供给发布工时 SAM = (基础日能力 - setupMinutes - switchMinutes) × efficiencyFactor',
    ],
    currentExplanationLines: [
      '理想完整口径会保留装载量单位和人员效率单位，用来解释批次装载量和人工效率的业务口径。',
      '当前阶段先收敛设备数量、单台默认日有效分钟、单次有效装载量、单次循环分钟，以及人员与准备损耗这些真正参与运算的数值字段。',
      '系统会先算单台默认日可运行批数，再算设备侧日能力和人员侧日能力，最后取较小值，避免只看设备批次能力或只看人工能力。',
      '固定准备分钟、切换准备分钟和工厂效率系数一起决定当天可兑现的默认日可供给发布工时 SAM。',
    ],
    currentExampleLines: [
      `某工厂做“${craftName}”，有 2 台设备，每台默认日有效 420 分钟，单次有效装载量 100，单次循环 90 分钟；有 3 人，每人默认日有效 420 分钟，人员标准效率值 0.8；固定准备 20 分钟，切换准备 10 分钟，工厂效率系数 0.9。`,
      '单台默认日可运行批数 = 420 ÷ 90 = 4.67',
      '设备侧日能力 = 4.67 × 100 × 2 = 934',
      '人员侧日能力 = 3 × 420 × 0.8 = 1008',
      '基础日能力 = 934',
      '默认日可供给发布工时 SAM = (934 - 20 - 10) × 0.9 = 813.6',
    ],
    currentReason:
      '理想完整口径会保留装载量单位和人员效率单位做批次口径解释；当前阶段只保留最小必要数值字段，系统据此自动算出默认日可供给发布工时 SAM。',
  }
}

export function getFactorySupplyFormulaTemplate(craftName: string): FactorySupplyFormulaTemplate {
  const template = FACTORY_SUPPLY_TEMPLATE_BY_CRAFT_NAME[craftName]
  if (!template) {
    throw new Error(`缺少工艺 ${craftName} 的当前阶段模板配置`)
  }
  return template
}

export function getExpectedSamCurrentFieldKeysByTemplate(
  template: FactorySupplyFormulaTemplate,
): SamCurrentFieldKey[] {
  return [...EXPECTED_SAM_CURRENT_FIELD_KEYS_BY_TEMPLATE[template]]
}

export function getFactorySupplyFormulaGuideByTemplate(
  template: FactorySupplyFormulaTemplate,
  subjectName: string,
): FactorySupplyFormulaGuide {
  switch (template) {
    case 'A':
      return buildTemplateAGuide(subjectName)
    case 'B':
      return buildTemplateBGuide(subjectName)
    case 'C':
      return buildTemplateCGuide(subjectName)
    case 'D':
      return buildTemplateDGuide(subjectName)
    default:
      throw new Error(`未支持的当前阶段模板 ${template}`)
  }
}

export function getFactorySupplyFormulaGuide(craftName: string): FactorySupplyFormulaGuide {
  return getFactorySupplyFormulaGuideByTemplate(getFactorySupplyFormulaTemplate(craftName), craftName)
}
