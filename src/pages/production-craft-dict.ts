import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'

type Stage = '准备阶段' | '生产阶段' | '后整阶段'
type Difficulty = '简单' | '中等' | '困难'
type CraftStatus = '启用' | '停用'
type MappingStatus = '已映射' | '未映射' | '待确认'
type CraftDictTab = 'overview' | 'detail' | 'mapping'

interface CheckItem {
  name: string
  required: boolean
  standard: string
}

interface CraftEntry {
  id: string
  stage: Stage
  process: string
  craftName: string
  craftCode: string
  stdTime: number
  timeUnit: string
  difficulty: Difficulty
  checkItems: CheckItem[]
  craftStandard: string
  status: CraftStatus
  mappingStatus: MappingStatus
}

interface OldSystemMapping {
  id: string
  sourceSystem: string
  oldStage: string
  oldProcess: string
  oldCraft: string
  suggestedCraft: string
  currentCraft: string
  mappingStatus: MappingStatus
  remark: string
}

interface CraftDictState {
  activeTab: CraftDictTab
  keyword: string
  filterStage: string
  filterProcess: string
  filterStatus: string
  filterMapping: string
  mapKeyword: string
  mapFilterStatus: string
  mapFilterStage: string
  viewCraftId: string
}

const MOCK_CRAFTS: CraftEntry[] = [
  {
    id: 'C001',
    stage: '准备阶段',
    process: '裁片',
    craftName: '自动裁前片',
    craftCode: 'CUT-AUTO-F',
    stdTime: 3,
    timeUnit: '分钟/件',
    difficulty: '简单',
    checkItems: [
      { name: '裁片尺寸', required: true, standard: '偏差 ≤ 0.2cm' },
      { name: '布边整齐度', required: true, standard: '无毛边、无拉丝' },
    ],
    craftStandard: '使用自动裁床进行前片裁剪，确保方向一致，纹路对齐，误差控制在 ±0.2cm 以内。裁剪前核查排料图。',
    status: '启用',
    mappingStatus: '已映射',
  },
  {
    id: 'C002',
    stage: '准备阶段',
    process: '裁片',
    craftName: '自动裁后片',
    craftCode: 'CUT-AUTO-B',
    stdTime: 3,
    timeUnit: '分钟/件',
    difficulty: '简单',
    checkItems: [
      { name: '裁片尺寸', required: true, standard: '偏差 ≤ 0.2cm' },
      { name: '纹路方向', required: true, standard: '与排料图一致' },
    ],
    craftStandard: '自动裁床裁后片，方向与前片一致，按排料图执行。',
    status: '启用',
    mappingStatus: '已映射',
  },
  {
    id: 'C003',
    stage: '准备阶段',
    process: '裁片',
    craftName: '手工裁领片',
    craftCode: 'CUT-MAN-C',
    stdTime: 6,
    timeUnit: '分钟/件',
    difficulty: '中等',
    checkItems: [
      { name: '领型轮廓', required: true, standard: '与样版偏差 ≤ 0.1cm' },
      { name: '对称性', required: true, standard: '左右对称，误差 ≤ 1mm' },
      { name: '布纹方向', required: false, standard: '45° 斜纹或正纹按款式要求' },
    ],
    craftStandard: '手工裁领片需使用标准样版，左右对称，特殊领型须二次核对。',
    status: '启用',
    mappingStatus: '待确认',
  },
  {
    id: 'C004',
    stage: '生产阶段',
    process: '车缝',
    craftName: '合肩',
    craftCode: 'SEW-SHLD',
    stdTime: 5,
    timeUnit: '分钟/件',
    difficulty: '中等',
    checkItems: [
      { name: '缝份宽度', required: true, standard: '1cm，误差 ≤ 1mm' },
      { name: '线迹均匀度', required: true, standard: '无跳针、断线' },
    ],
    craftStandard: '合肩缝份 1cm，前后肩缝对齐，左右肩高一致，缝线均匀平整。',
    status: '启用',
    mappingStatus: '已映射',
  },
  {
    id: 'C005',
    stage: '生产阶段',
    process: '车缝',
    craftName: '上领',
    craftCode: 'SEW-COLL',
    stdTime: 8,
    timeUnit: '分钟/件',
    difficulty: '困难',
    checkItems: [
      { name: '领缝对称', required: true, standard: '领中缝对准衣身中缝' },
      { name: '领口松紧', required: true, standard: '无拉伸、无皱褶' },
      { name: '领脚整齐', required: true, standard: '内外领脚高度一致' },
    ],
    craftStandard: '上领工序要求领型圆顺，领中线对齐衣身，领脚内外高度一致，不允许有扭曲。',
    status: '启用',
    mappingStatus: '已映射',
  },
  {
    id: 'C006',
    stage: '生产阶段',
    process: '车缝',
    craftName: '锁边',
    craftCode: 'SEW-OVER',
    stdTime: 4,
    timeUnit: '分钟/件',
    difficulty: '简单',
    checkItems: [
      { name: '锁边宽度', required: true, standard: '0.5cm 均匀' },
      { name: '线迹牢固度', required: true, standard: '拉力测试 ≥ 5N' },
    ],
    craftStandard: '使用包缝机锁边，线迹均匀，无漏针，布边不起皱。',
    status: '启用',
    mappingStatus: '已映射',
  },
  {
    id: 'C007',
    stage: '生产阶段',
    process: '车缝',
    craftName: '拼袖',
    craftCode: 'SEW-SLV',
    stdTime: 6,
    timeUnit: '分钟/件',
    difficulty: '中等',
    checkItems: [
      { name: '袖山对位点', required: true, standard: '前后袖山对位点吻合' },
      { name: '袖长左右一致', required: true, standard: '误差 ≤ 2mm' },
    ],
    craftStandard: '按对位点拼袖，袖山圆顺，不起吊，左右袖长一致。',
    status: '启用',
    mappingStatus: '待确认',
  },
  {
    id: 'C008',
    stage: '生产阶段',
    process: '印花',
    craftName: '数码印花',
    craftCode: 'PRT-DGTL',
    stdTime: 10,
    timeUnit: '分钟/件',
    difficulty: '中等',
    checkItems: [
      { name: '色彩还原度', required: true, standard: '与打样色差 ΔE ≤ 2.0' },
      { name: '印花位置', required: true, standard: '偏差 ≤ 0.5cm' },
      { name: '油墨牢度', required: false, standard: '水洗 30 次后无明显褪色' },
    ],
    craftStandard: '数码喷墨印花，色彩还原度高，图案清晰无晕染，印后热固处理。',
    status: '启用',
    mappingStatus: '已映射',
  },
  {
    id: 'C009',
    stage: '生产阶段',
    process: '印花',
    craftName: '丝网印花',
    craftCode: 'PRT-SCRN',
    stdTime: 8,
    timeUnit: '分钟/件',
    difficulty: '中等',
    checkItems: [
      { name: '套色精度', required: true, standard: '多色套印偏差 ≤ 0.3cm' },
      { name: '油墨厚度', required: false, standard: '均匀、无溢胶' },
    ],
    craftStandard: '丝网印花要求套印精准，油墨均匀，固化后柔软度符合标准。',
    status: '启用',
    mappingStatus: '未映射',
  },
  {
    id: 'C010',
    stage: '生产阶段',
    process: '染色',
    craftName: '染缸染色',
    craftCode: 'DYE-TUB',
    stdTime: 120,
    timeUnit: '分钟/批',
    difficulty: '困难',
    checkItems: [
      { name: '色差', required: true, standard: '批内色差 ≤ 4 级' },
      { name: '色牢度', required: true, standard: '耐洗色牢度 ≥ 3 级' },
      { name: 'pH 值', required: true, standard: '4.5 ~ 7.5' },
    ],
    craftStandard: '按染色工艺单执行，控制染液浓度、温度与时间，批次内色差控制在 4 级以内，pH 达标后出缸。',
    status: '启用',
    mappingStatus: '已映射',
  },
  {
    id: 'C011',
    stage: '后整阶段',
    process: '水洗',
    craftName: '成衣水洗',
    craftCode: 'WS-GNT',
    stdTime: 60,
    timeUnit: '分钟/批',
    difficulty: '中等',
    checkItems: [
      { name: '缩水率', required: true, standard: '经向 ≤ 3%，纬向 ≤ 3%' },
      { name: '外观', required: true, standard: '无色花、无折痕' },
    ],
    craftStandard: '成衣水洗按洗水工艺卡执行，控制水温、洗涤剂浓度及时间，脱水后及时整烫。',
    status: '启用',
    mappingStatus: '已映射',
  },
  {
    id: 'C012',
    stage: '后整阶段',
    process: '整烫',
    craftName: '成衣整烫',
    craftCode: 'IRON-GNT',
    stdTime: 5,
    timeUnit: '分钟/件',
    difficulty: '简单',
    checkItems: [
      { name: '烫后平整度', required: true, standard: '无极光、无折印' },
      { name: '尺寸稳定性', required: true, standard: '整烫后尺寸符合规格' },
    ],
    craftStandard: '使用蒸汽熨斗或隧道式烫机，温度按面料要求设定，不允许出现极光。',
    status: '启用',
    mappingStatus: '已映射',
  },
  {
    id: 'C013',
    stage: '后整阶段',
    process: '整烫',
    craftName: '定型整烫',
    craftCode: 'IRON-SET',
    stdTime: 7,
    timeUnit: '分钟/件',
    difficulty: '中等',
    checkItems: [
      { name: '定型温度', required: true, standard: '按面料规格表执行' },
      { name: '尺寸符合率', required: true, standard: '关键尺寸偏差 ≤ 0.5cm' },
    ],
    craftStandard: '定型整烫用于特殊结构部位，需使用定型模板，确保尺寸符合规格表。',
    status: '启用',
    mappingStatus: '未映射',
  },
  {
    id: 'C014',
    stage: '后整阶段',
    process: '包装',
    craftName: '成衣包装',
    craftCode: 'PKG-GNT',
    stdTime: 3,
    timeUnit: '分钟/件',
    difficulty: '简单',
    checkItems: [
      { name: '吊牌完整', required: true, standard: '主唛、洗唛、尺码唛齐全' },
      { name: '折叠方式', required: true, standard: '按包装 SOP 执行' },
      { name: '条码扫描', required: true, standard: '条码可读，与系统一致' },
    ],
    craftStandard: '包装按客户 SOP 执行，吊牌齐全，折叠规范，装袋前核查尺码。',
    status: '启用',
    mappingStatus: '已映射',
  },
  {
    id: 'C015',
    stage: '后整阶段',
    process: '包装',
    craftName: '礼盒包装',
    craftCode: 'PKG-GIFT',
    stdTime: 8,
    timeUnit: '分钟/件',
    difficulty: '中等',
    checkItems: [
      { name: '礼盒完整性', required: true, standard: '无破损、无压痕' },
      { name: '填充物', required: false, standard: '填充物丰满、无空洞感' },
    ],
    craftStandard: '礼盒包装需使用指定礼盒型号，内衬纸按样品对照，填充物均匀丰满。',
    status: '启用',
    mappingStatus: '未映射',
  },
  {
    id: 'C016',
    stage: '后整阶段',
    process: '车缝',
    craftName: '质量补线',
    craftCode: 'RWK-STT',
    stdTime: 10,
    timeUnit: '分钟/件',
    difficulty: '中等',
    checkItems: [
      { name: '补线后强度', required: true, standard: '与原线迹强度一致' },
      { name: '外观', required: true, standard: '补线处不可见，与周边一致' },
    ],
    craftStandard: '质量补线需使用相同色号、相同粗细缝线，补线区域不可有明显色差。',
    status: '启用',
    mappingStatus: '已映射',
  },
  {
    id: 'C017',
    stage: '生产阶段',
    process: '车缝',
    craftName: '装拉链',
    craftCode: 'SEW-ZIP',
    stdTime: 7,
    timeUnit: '分钟/件',
    difficulty: '中等',
    checkItems: [
      { name: '拉链顺滑度', required: true, standard: '无卡顿、无跑偏' },
      { name: '拉链头对位', required: true, standard: '头尾对齐，误差 ≤ 2mm' },
    ],
    craftStandard: '拉链安装须与门襟对齐，拉合顺滑，两端固定牢固。',
    status: '启用',
    mappingStatus: '已映射',
  },
  {
    id: 'C018',
    stage: '准备阶段',
    process: '裁片',
    craftName: '排料裁剪（自动）',
    craftCode: 'CUT-LAY-A',
    stdTime: 15,
    timeUnit: '分钟/批',
    difficulty: '简单',
    checkItems: [
      { name: '利用率', required: false, standard: '面料利用率 ≥ 85%' },
      { name: '裁片完整', required: true, standard: '裁片无破损、无缺角' },
    ],
    craftStandard: '使用 CAD 排料软件输出排料图，自动裁床执行，记录面料利用率。',
    status: '启用',
    mappingStatus: '待确认',
  },
]

const MOCK_MAPPINGS: OldSystemMapping[] = [
  { id: 'M001', sourceSystem: 'ERP-V1', oldStage: '备料', oldProcess: '裁剪', oldCraft: '前片裁剪（机器）', suggestedCraft: '自动裁前片', currentCraft: '自动裁前片', mappingStatus: '已映射', remark: '自动映射，已确认' },
  { id: 'M002', sourceSystem: 'ERP-V1', oldStage: '备料', oldProcess: '裁剪', oldCraft: '后片裁剪（机器）', suggestedCraft: '自动裁后片', currentCraft: '自动裁后片', mappingStatus: '已映射', remark: '自动映射，已确认' },
  { id: 'M003', sourceSystem: 'ERP-V1', oldStage: '备料', oldProcess: '裁剪', oldCraft: '领子手裁', suggestedCraft: '手工裁领片', currentCraft: '', mappingStatus: '待确认', remark: '相似度 82%，待业务确认' },
  { id: 'M004', sourceSystem: 'ERP-V1', oldStage: '缝制', oldProcess: '合缝', oldCraft: '肩缝拼合', suggestedCraft: '合肩', currentCraft: '合肩', mappingStatus: '已映射', remark: '' },
  { id: 'M005', sourceSystem: 'ERP-V1', oldStage: '缝制', oldProcess: '领子', oldCraft: '上领工序', suggestedCraft: '上领', currentCraft: '上领', mappingStatus: '已映射', remark: '' },
  { id: 'M006', sourceSystem: 'ERP-V1', oldStage: '缝制', oldProcess: '收边', oldCraft: '包缝处理', suggestedCraft: '锁边', currentCraft: '锁边', mappingStatus: '已映射', remark: '' },
  { id: 'M007', sourceSystem: 'ERP-V1', oldStage: '缝制', oldProcess: '装配', oldCraft: '袖子拼装', suggestedCraft: '拼袖', currentCraft: '', mappingStatus: '待确认', remark: '需确认拼袖方式' },
  { id: 'M008', sourceSystem: 'ERP-V1', oldStage: '印花', oldProcess: '数字印花', oldCraft: 'DTG 印花', suggestedCraft: '数码印花', currentCraft: '数码印花', mappingStatus: '已映射', remark: 'DTG 即数码印花' },
  { id: 'M009', sourceSystem: 'ERP-V1', oldStage: '染色', oldProcess: '成衣染', oldCraft: '液流染色', suggestedCraft: '染缸染色', currentCraft: '染缸染色', mappingStatus: '已映射', remark: '' },
  { id: 'M010', sourceSystem: 'MES-OLD', oldStage: '后处理', oldProcess: '水洗', oldCraft: '成衣洗水', suggestedCraft: '成衣水洗', currentCraft: '成衣水洗', mappingStatus: '已映射', remark: '来源 MES 老系统' },
  { id: 'M011', sourceSystem: 'MES-OLD', oldStage: '后处理', oldProcess: '烫型', oldCraft: '蒸汽整烫', suggestedCraft: '成衣整烫', currentCraft: '成衣整烫', mappingStatus: '已映射', remark: '' },
  { id: 'M012', sourceSystem: 'MES-OLD', oldStage: '后处理', oldProcess: '包装', oldCraft: '吊牌+装袋', suggestedCraft: '成衣包装', currentCraft: '成衣包装', mappingStatus: '已映射', remark: '' },
  { id: 'M013', sourceSystem: 'MES-OLD', oldStage: '修补', oldProcess: '修补处理', oldCraft: '补线修复', suggestedCraft: '质量补线', currentCraft: '质量补线', mappingStatus: '已映射', remark: '' },
  { id: 'M014', sourceSystem: 'ERP-V2', oldStage: '印制', oldProcess: '网版印', oldCraft: '丝印工艺', suggestedCraft: '丝网印花', currentCraft: '', mappingStatus: '未映射', remark: 'ERP-V2 遗留，待处理' },
  { id: 'M015', sourceSystem: 'ERP-V2', oldStage: '备料', oldProcess: '自动裁', oldCraft: '全自动铺布裁剪', suggestedCraft: '排料裁剪（自动）', currentCraft: '', mappingStatus: '未映射', remark: '新工艺尚未确认' },
  { id: 'M016', sourceSystem: 'ERP-V2', oldStage: '缝制', oldProcess: '拉链', oldCraft: '隐形拉链安装', suggestedCraft: '装拉链', currentCraft: '装拉链', mappingStatus: '已映射', remark: '' },
]

const STAGES: Stage[] = ['准备阶段', '生产阶段', '后整阶段']
const PROCESSES = ['裁片', '车缝', '印花', '染色', '水洗', '整烫', '包装', '修补处理']
const MAPPING_STATUSES: MappingStatus[] = ['已映射', '未映射', '待确认']

const state: CraftDictState = {
  activeTab: 'overview',
  keyword: '',
  filterStage: 'ALL',
  filterProcess: 'ALL',
  filterStatus: 'ALL',
  filterMapping: 'ALL',
  mapKeyword: '',
  mapFilterStatus: 'ALL',
  mapFilterStage: 'ALL',
  viewCraftId: '',
}

function getCraftById(craftId: string): CraftEntry | undefined {
  return MOCK_CRAFTS.find((craft) => craft.id === craftId)
}

function getCraftByName(name: string): CraftEntry | undefined {
  return MOCK_CRAFTS.find((craft) => craft.craftName === name)
}

function getMappingForCraft(craft: CraftEntry): OldSystemMapping | undefined {
  return MOCK_MAPPINGS.find(
    (mapping) => mapping.currentCraft === craft.craftName || mapping.suggestedCraft === craft.craftName,
  )
}

function mappingBadge(status: MappingStatus): string {
  if (status === '已映射') {
    return '<span class="inline-flex rounded border border-green-200 bg-green-50 px-1.5 py-0 text-[10px] font-medium text-green-700">已映射</span>'
  }
  if (status === '未映射') {
    return '<span class="inline-flex rounded border border-gray-200 bg-gray-50 px-1.5 py-0 text-[10px] font-medium text-gray-500">未映射</span>'
  }
  return '<span class="inline-flex rounded border border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] font-medium text-amber-700">待确认</span>'
}

function statusBadge(status: CraftStatus): string {
  if (status === '启用') {
    return '<span class="inline-flex rounded border border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] font-medium text-blue-700">启用</span>'
  }
  return '<span class="inline-flex rounded border border-gray-200 bg-gray-50 px-1.5 py-0 text-[10px] font-medium text-gray-400">停用</span>'
}

function diffBadge(diff: Difficulty): string {
  if (diff === '简单') return '<span class="text-xs font-medium text-green-700">简单</span>'
  if (diff === '困难') return '<span class="text-xs font-medium text-red-700">困难</span>'
  return '<span class="text-xs font-medium text-amber-700">中等</span>'
}

function filteredCrafts(): CraftEntry[] {
  const keyword = state.keyword.trim().toLowerCase()
  return MOCK_CRAFTS.filter((craft) => {
    if (state.filterStage !== 'ALL' && craft.stage !== state.filterStage) return false
    if (state.filterProcess !== 'ALL' && craft.process !== state.filterProcess) return false
    if (state.filterStatus !== 'ALL' && craft.status !== state.filterStatus) return false
    if (state.filterMapping !== 'ALL' && craft.mappingStatus !== state.filterMapping) return false

    if (!keyword) return true
    return (
      craft.craftName.toLowerCase().includes(keyword) ||
      craft.process.toLowerCase().includes(keyword) ||
      craft.craftCode.toLowerCase().includes(keyword)
    )
  })
}

function filteredMappings(): OldSystemMapping[] {
  const keyword = state.mapKeyword.trim().toLowerCase()
  return MOCK_MAPPINGS.filter((mapping) => {
    if (state.mapFilterStatus !== 'ALL' && mapping.mappingStatus !== state.mapFilterStatus) return false
    if (state.mapFilterStage !== 'ALL' && mapping.oldStage !== state.mapFilterStage) return false

    if (!keyword) return true
    return (
      mapping.oldCraft.toLowerCase().includes(keyword) ||
      mapping.currentCraft.toLowerCase().includes(keyword) ||
      mapping.suggestedCraft.toLowerCase().includes(keyword)
    )
  })
}

function renderCraftDetailContent(craft: CraftEntry): string {
  const mapping = getMappingForCraft(craft)
  return `
    <div class="space-y-5">
      <div class="space-y-2.5 rounded-md border bg-muted/20 p-4">
        <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">基础信息</p>
        ${(
          [
            ['阶段', craft.stage],
            ['工序', craft.process],
            ['工艺名称', craft.craftName],
            ['工艺编码', craft.craftCode],
            ['状态', craft.status],
          ] as Array<[string, string]>
        )
          .map(
            ([label, value]) => `
              <div class="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-b-0 last:pb-0">
                <span class="text-muted-foreground">${escapeHtml(label)}</span>
                <span class="font-medium">${escapeHtml(value)}</span>
              </div>
            `,
          )
          .join('')}
      </div>

      <div class="space-y-2.5 rounded-md border border-amber-200 bg-amber-50/60 p-4">
        <p class="mb-1 text-xs font-semibold text-amber-800">基准参考值</p>
        <p class="mb-2 text-[11px] text-amber-700">以下为基准参考值，实际工时与难度由技术包实例层覆盖</p>
        <div class="flex items-center justify-between gap-2 border-b pb-2 text-sm">
          <span class="text-muted-foreground">基准标准工时</span>
          <span class="font-medium tabular-nums">${craft.stdTime} ${escapeHtml(craft.timeUnit)}</span>
        </div>
        <div class="flex items-center justify-between gap-2 text-sm">
          <span class="text-muted-foreground">基准难度</span>
          ${diffBadge(craft.difficulty)}
        </div>
      </div>

      <div class="space-y-3 rounded-md border p-4">
        <p class="text-sm font-semibold">默认检查项模板</p>
        <div class="divide-y rounded border">
          ${craft.checkItems
            .map(
              (checkItem) => `
                <div class="px-3 py-2.5">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium">${escapeHtml(checkItem.name)}</span>
                    ${
                      checkItem.required
                        ? '<span class="rounded border border-red-200 bg-red-50 px-1.5 py-0 text-[10px] font-medium text-red-600">必检</span>'
                        : ''
                    }
                  </div>
                  <p class="mt-0.5 text-xs text-muted-foreground">标准要求：${escapeHtml(checkItem.standard)}</p>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>

      <div class="space-y-2 rounded-md border p-4">
        <p class="text-sm font-semibold">工艺标准</p>
        <p class="text-sm leading-relaxed text-muted-foreground">${escapeHtml(craft.craftStandard)}</p>
      </div>

      <div class="space-y-3 rounded-md border p-4">
        <p class="text-sm font-semibold">老系统映射摘要</p>
        ${
          !mapping
            ? '<p class="text-sm text-muted-foreground">该工艺暂无老系统映射记录</p>'
            : `
              <div class="space-y-2">
                ${(
                  [
                    ['来源系统', mapping.sourceSystem],
                    ['老系统阶段', mapping.oldStage],
                    ['老系统工序', mapping.oldProcess],
                    ['老系统工艺', mapping.oldCraft],
                  ] as Array<[string, string]>
                )
                  .map(
                    ([label, value]) => `
                      <div class="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-b-0 last:pb-0">
                        <span class="text-muted-foreground">${escapeHtml(label)}</span>
                        <span class="font-medium">${escapeHtml(value)}</span>
                      </div>
                    `,
                  )
                  .join('')}
                <div class="flex items-center justify-between gap-2 text-sm">
                  <span class="text-muted-foreground">映射状态</span>
                  ${mappingBadge(mapping.mappingStatus)}
                </div>
              </div>
            `
        }
      </div>
    </div>
  `
}

function renderCraftDetailSheet(craft: CraftEntry): string {
  const mapping = getMappingForCraft(craft)
  return `
    <div class="fixed inset-0 z-[120] bg-black/35" data-craft-dict-action="close-sheet"></div>
    <aside class="fixed inset-y-0 right-0 z-[121] w-full max-w-[560px] overflow-y-auto border-l bg-background shadow-xl">
      <header class="sticky top-0 border-b bg-background px-4 py-3">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold">工艺详情</h3>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-craft-dict-action="close-sheet">关闭</button>
        </div>
      </header>

      <div class="space-y-5 p-4">
        <div class="space-y-2 rounded-md border bg-muted/20 p-3">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">基础信息</p>
          ${(
            [
              ['阶段', craft.stage],
              ['工序', craft.process],
              ['工艺名称', craft.craftName],
              ['工艺编码', craft.craftCode],
              ['状态', craft.status],
            ] as Array<[string, string]>
          )
            .map(
              ([label, value]) => `
                <div class="flex items-center justify-between gap-2 text-sm">
                  <span class="shrink-0 text-muted-foreground">${escapeHtml(label)}</span>
                  <span class="text-right font-medium">${escapeHtml(value)}</span>
                </div>
              `,
            )
            .join('')}
        </div>

        <div class="space-y-2 rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <p class="mb-1 text-xs font-semibold text-amber-800">基准参考值</p>
          <p class="mb-2 text-[11px] text-amber-700">以下为基准参考值，实际工时与难度由技术包实例层覆盖</p>
          <div class="flex items-center justify-between gap-2 text-sm">
            <span class="shrink-0 text-muted-foreground">基准标准工时</span>
            <span class="font-medium tabular-nums">${craft.stdTime} ${escapeHtml(craft.timeUnit)}</span>
          </div>
          <div class="flex items-center justify-between gap-2 text-sm">
            <span class="shrink-0 text-muted-foreground">基准难度</span>
            ${diffBadge(craft.difficulty)}
          </div>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-semibold">默认检查项模板</p>
          <div class="divide-y rounded-md border">
            ${craft.checkItems
              .map(
                (checkItem) => `
                  <div class="space-y-0.5 px-3 py-2.5">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium">${escapeHtml(checkItem.name)}</span>
                      ${
                        checkItem.required
                          ? '<span class="rounded border border-red-200 bg-red-50 px-1.5 py-0 text-[10px] font-medium text-red-600">必检</span>'
                          : ''
                      }
                    </div>
                    <p class="text-xs text-muted-foreground">标准要求：${escapeHtml(checkItem.standard)}</p>
                  </div>
                `,
              )
              .join('')}
          </div>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-semibold">工艺标准</p>
          <div class="rounded-md border bg-muted/10 px-3 py-2.5">
            <p class="text-sm leading-relaxed text-muted-foreground">${escapeHtml(craft.craftStandard)}</p>
          </div>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-semibold">老系统映射摘要</p>
          ${
            !mapping
              ? '<div class="rounded-md border border-dashed px-3 py-3"><p class="text-sm text-muted-foreground">该工艺暂无老系统映射记录</p></div>'
              : `
                <div class="space-y-2 rounded-md border bg-muted/20 p-3">
                  ${(
                    [
                      ['来源系统', mapping.sourceSystem],
                      ['老系统阶段', mapping.oldStage],
                      ['老系统工序', mapping.oldProcess],
                      ['老系统工艺', mapping.oldCraft],
                    ] as Array<[string, string]>
                  )
                    .map(
                      ([label, value]) => `
                        <div class="flex items-center justify-between gap-2 text-sm">
                          <span class="shrink-0 text-muted-foreground">${escapeHtml(label)}</span>
                          <span class="text-right font-medium">${escapeHtml(value)}</span>
                        </div>
                      `,
                    )
                    .join('')}
                  <div class="flex items-center justify-between gap-2 text-sm">
                    <span class="text-muted-foreground">映射状态</span>
                    ${mappingBadge(mapping.mappingStatus)}
                  </div>
                </div>
              `
          }
        </div>
      </div>
    </aside>
  `
}

function renderOverviewTab(): string {
  const stats = {
    stages: new Set(MOCK_CRAFTS.map((craft) => craft.stage)).size,
    processes: new Set(MOCK_CRAFTS.map((craft) => craft.process)).size,
    total: MOCK_CRAFTS.length,
    unmapped: MOCK_MAPPINGS.filter((mapping) => mapping.mappingStatus !== '已映射').length,
  }
  const crafts = filteredCrafts()
  const hasFilters =
    state.keyword ||
    state.filterStage !== 'ALL' ||
    state.filterProcess !== 'ALL' ||
    state.filterStatus !== 'ALL' ||
    state.filterMapping !== 'ALL'

  return `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        ${[
          { label: '阶段数', value: stats.stages, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: '工序数', value: stats.processes, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
          { label: '工艺总数', value: stats.total, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
          { label: '老系统待映射', value: stats.unmapped, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
        ]
          .map(
            (item) => `
              <article class="rounded-lg border ${item.border} ${item.bg}">
                <div class="p-3">
                  <p class="text-2xl font-bold tabular-nums ${item.color}">${item.value}</p>
                  <p class="mt-0.5 text-xs text-muted-foreground">${item.label}</p>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="relative">
          <i data-lucide="search" class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"></i>
          <input
            class="h-8 w-60 rounded-md border bg-background pl-8 pr-3 text-xs"
            placeholder="搜索工艺名称 / 工序 / 编码…"
            value="${escapeHtml(state.keyword)}"
            data-craft-dict-field="keyword"
          />
        </div>
        <select class="h-8 w-28 rounded-md border bg-background px-2 text-xs" data-craft-dict-field="filterStage">
          <option value="ALL" ${state.filterStage === 'ALL' ? 'selected' : ''}>全部阶段</option>
          ${STAGES.map((stage) => `<option value="${stage}" ${state.filterStage === stage ? 'selected' : ''}>${stage}</option>`).join('')}
        </select>
        <select class="h-8 w-28 rounded-md border bg-background px-2 text-xs" data-craft-dict-field="filterProcess">
          <option value="ALL" ${state.filterProcess === 'ALL' ? 'selected' : ''}>全部工序</option>
          ${PROCESSES.map((process) => `<option value="${process}" ${state.filterProcess === process ? 'selected' : ''}>${process}</option>`).join('')}
        </select>
        <select class="h-8 w-24 rounded-md border bg-background px-2 text-xs" data-craft-dict-field="filterStatus">
          <option value="ALL" ${state.filterStatus === 'ALL' ? 'selected' : ''}>全部状态</option>
          <option value="启用" ${state.filterStatus === '启用' ? 'selected' : ''}>启用</option>
          <option value="停用" ${state.filterStatus === '停用' ? 'selected' : ''}>停用</option>
        </select>
        <select class="h-8 w-28 rounded-md border bg-background px-2 text-xs" data-craft-dict-field="filterMapping">
          <option value="ALL" ${state.filterMapping === 'ALL' ? 'selected' : ''}>全部映射</option>
          ${MAPPING_STATUSES.map(
            (status) => `<option value="${status}" ${state.filterMapping === status ? 'selected' : ''}>${status}</option>`,
          ).join('')}
        </select>
        ${
          hasFilters
            ? '<button class="inline-flex h-8 items-center rounded-md px-2 text-xs hover:bg-muted" data-craft-dict-action="clear-craft-filters">清除筛选</button>'
            : ''
        }
        <span class="ml-auto text-xs text-muted-foreground">共 ${crafts.length} 条</span>
      </div>

      <div class="overflow-x-auto rounded-md border bg-background">
        <table class="w-full min-w-[1240px] border-collapse">
          <thead>
            <tr class="bg-muted/30 text-xs">
              <th class="px-3 py-2 text-left">阶段</th>
              <th class="px-3 py-2 text-left">工序</th>
              <th class="px-3 py-2 text-left">工艺名称</th>
              <th class="px-3 py-2 text-left">工艺编码</th>
              <th class="px-3 py-2 text-right">基准工时</th>
              <th class="px-3 py-2 text-left">工时单位</th>
              <th class="px-3 py-2 text-left">基准难度</th>
              <th class="px-3 py-2 text-center">检查项数</th>
              <th class="px-3 py-2 text-left">工艺标准摘要</th>
              <th class="px-3 py-2 text-left">映射状态</th>
              <th class="px-3 py-2 text-left">状态</th>
              <th class="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              crafts.length === 0
                ? '<tr><td class="py-10 text-center text-sm text-muted-foreground" colspan="12">暂无数据，请调整筛选条件</td></tr>'
                : crafts
                    .map(
                      (craft) => `
                        <tr class="border-t text-xs hover:bg-muted/30">
                          <td class="whitespace-nowrap px-3 py-2 text-muted-foreground">${escapeHtml(craft.stage)}</td>
                          <td class="whitespace-nowrap px-3 py-2 font-medium">${escapeHtml(craft.process)}</td>
                          <td class="whitespace-nowrap px-3 py-2 font-medium">${escapeHtml(craft.craftName)}</td>
                          <td class="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">${escapeHtml(craft.craftCode)}</td>
                          <td class="px-3 py-2 text-right tabular-nums">${craft.stdTime}</td>
                          <td class="whitespace-nowrap px-3 py-2 text-muted-foreground">${escapeHtml(craft.timeUnit)}</td>
                          <td class="px-3 py-2">${diffBadge(craft.difficulty)}</td>
                          <td class="px-3 py-2 text-center">${craft.checkItems.length}</td>
                          <td class="max-w-[180px] px-3 py-2 text-muted-foreground">
                            <p class="truncate" title="${escapeHtml(craft.craftStandard)}">${escapeHtml(
                              `${craft.craftStandard.slice(0, 40)}${craft.craftStandard.length > 40 ? '…' : ''}`,
                            )}</p>
                          </td>
                          <td class="px-3 py-2">${mappingBadge(craft.mappingStatus)}</td>
                          <td class="px-3 py-2">${statusBadge(craft.status)}</td>
                          <td class="whitespace-nowrap px-3 py-2 text-right">
                            <div class="flex items-center justify-end gap-1">
                              <button
                                class="inline-flex h-6 items-center rounded-md px-2 text-[11px] hover:bg-muted"
                                data-craft-dict-action="view-craft-detail"
                                data-craft-id="${escapeHtml(craft.id)}"
                              >
                                <i data-lucide="eye" class="mr-0.5 h-3 w-3"></i>查看详情
                              </button>
                              <button
                                class="inline-flex h-6 items-center rounded-md px-2 text-[11px] hover:bg-muted"
                                data-craft-dict-action="view-mapping-tab"
                              >查看映射</button>
                            </div>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderDetailTab(): string {
  const craft = getCraftById(state.viewCraftId)
  if (!craft) {
    return `
      <div class="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <i data-lucide="eye" class="h-10 w-10 opacity-20"></i>
        <p class="text-sm">请从「字典总览」点击「查看详情」进入</p>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-craft-dict-action="set-tab" data-tab="overview">前往字典总览</button>
      </div>
    `
  }

  return `
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <button class="text-xs text-muted-foreground hover:text-foreground" data-craft-dict-action="set-tab" data-tab="overview">← 返回总览</button>
        <span class="text-muted-foreground">/</span>
        <span class="text-sm font-medium">${escapeHtml(craft.craftName)}</span>
      </div>
      <div class="max-w-[700px]">
        ${renderCraftDetailContent(craft)}
      </div>
    </div>
  `
}

function renderMappingTab(): string {
  const mappings = filteredMappings()
  const stats = {
    total: MOCK_MAPPINGS.length,
    mapped: MOCK_MAPPINGS.filter((mapping) => mapping.mappingStatus === '已映射').length,
    unmapped: MOCK_MAPPINGS.filter((mapping) => mapping.mappingStatus === '未映射').length,
    pending: MOCK_MAPPINGS.filter((mapping) => mapping.mappingStatus === '待确认').length,
  }
  const stageOptions = Array.from(new Set(MOCK_MAPPINGS.map((mapping) => mapping.oldStage)))

  return `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        ${[
          { label: '老系统工艺总数', value: stats.total, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
          { label: '已映射', value: stats.mapped, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
          { label: '未映射', value: stats.unmapped, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
          { label: '待确认', value: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
        ]
          .map(
            (item) => `
              <article class="rounded-lg border ${item.border} ${item.bg}">
                <div class="p-3">
                  <p class="text-2xl font-bold tabular-nums ${item.color}">${item.value}</p>
                  <p class="mt-0.5 text-xs text-muted-foreground">${item.label}</p>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="relative">
          <i data-lucide="search" class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"></i>
          <input
            class="h-8 w-64 rounded-md border bg-background pl-8 pr-3 text-xs"
            placeholder="搜索老系统工艺 / 字典工艺名称…"
            value="${escapeHtml(state.mapKeyword)}"
            data-craft-dict-field="mapKeyword"
          />
        </div>
        <select class="h-8 w-28 rounded-md border bg-background px-2 text-xs" data-craft-dict-field="mapFilterStatus">
          <option value="ALL" ${state.mapFilterStatus === 'ALL' ? 'selected' : ''}>全部状态</option>
          ${MAPPING_STATUSES.map(
            (status) => `<option value="${status}" ${state.mapFilterStatus === status ? 'selected' : ''}>${status}</option>`,
          ).join('')}
        </select>
        <select class="h-8 w-32 rounded-md border bg-background px-2 text-xs" data-craft-dict-field="mapFilterStage">
          <option value="ALL" ${state.mapFilterStage === 'ALL' ? 'selected' : ''}>全部阶段</option>
          ${stageOptions.map(
            (stage) => `<option value="${stage}" ${state.mapFilterStage === stage ? 'selected' : ''}>${stage}</option>`,
          ).join('')}
        </select>
        <span class="ml-auto text-xs text-muted-foreground">共 ${mappings.length} 条</span>
      </div>

      <div class="overflow-x-auto rounded-md border bg-background">
        <table class="w-full min-w-[1140px] border-collapse">
          <thead>
            <tr class="bg-muted/30 text-xs">
              <th class="px-3 py-2 text-left">来源系统</th>
              <th class="px-3 py-2 text-left">老系统阶段</th>
              <th class="px-3 py-2 text-left">老系统工序</th>
              <th class="px-3 py-2 text-left">老系统工艺</th>
              <th class="px-3 py-2 text-left">建议映射工艺</th>
              <th class="px-3 py-2 text-left">当前映射工艺</th>
              <th class="px-3 py-2 text-left">映射状态</th>
              <th class="px-3 py-2 text-left">备注</th>
              <th class="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              mappings.length === 0
                ? '<tr><td class="py-10 text-center text-sm text-muted-foreground" colspan="9">暂无数据</td></tr>'
                : mappings
                    .map((mapping) => {
                      const current = mapping.currentCraft ? `<span class="font-medium text-green-700">${escapeHtml(mapping.currentCraft)}</span>` : '<span class="text-muted-foreground">—</span>'
                      const craft = getCraftByName(mapping.currentCraft) || getCraftByName(mapping.suggestedCraft)
                      return `
                        <tr class="border-t text-xs hover:bg-muted/30">
                          <td class="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">${escapeHtml(mapping.sourceSystem)}</td>
                          <td class="whitespace-nowrap px-3 py-2">${escapeHtml(mapping.oldStage)}</td>
                          <td class="whitespace-nowrap px-3 py-2">${escapeHtml(mapping.oldProcess)}</td>
                          <td class="whitespace-nowrap px-3 py-2 font-medium">${escapeHtml(mapping.oldCraft)}</td>
                          <td class="whitespace-nowrap px-3 py-2 text-blue-700">${escapeHtml(mapping.suggestedCraft)}</td>
                          <td class="whitespace-nowrap px-3 py-2">${current}</td>
                          <td class="px-3 py-2">${mappingBadge(mapping.mappingStatus)}</td>
                          <td class="max-w-[120px] px-3 py-2 text-muted-foreground">
                            <p class="truncate" title="${escapeHtml(mapping.remark || '—')}">${escapeHtml(mapping.remark || '—')}</p>
                          </td>
                          <td class="whitespace-nowrap px-3 py-2 text-right">
                            ${
                              craft
                                ? `
                                  <button
                                    class="inline-flex h-6 items-center rounded-md px-2 text-[11px] hover:bg-muted"
                                    data-craft-dict-action="view-mapping-craft"
                                    data-craft-id="${escapeHtml(craft.id)}"
                                  >
                                    <i data-lucide="eye" class="mr-0.5 h-3 w-3"></i>查看字典工艺
                                  </button>
                                `
                                : '<span class="text-muted-foreground">—</span>'
                            }
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `
}

export function renderProductionCraftDictPage(): string {
  const tabs: Array<{ key: CraftDictTab; label: string }> = [
    { key: 'overview', label: '字典总览' },
    { key: 'detail', label: '工艺详情' },
    { key: 'mapping', label: '老系统映射' },
  ]

  const viewCraft = getCraftById(state.viewCraftId)

  return `
    <div class="flex min-h-[760px] flex-col bg-muted/20">
      <div class="border-b bg-background px-6 py-4">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="mb-0.5 flex items-center gap-2">
              <i data-lucide="book-open" class="h-5 w-5 text-primary"></i>
              <h1 class="text-lg font-semibold">工序工艺字典</h1>
              <span class="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">标准母本</span>
              <span class="rounded border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">只读展示</span>
            </div>
            <p class="text-sm text-muted-foreground">展示工序工艺标准母本及老系统映射结果，供技术包等模块统一引用</p>
          </div>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-craft-dict-action="refresh">
            <i data-lucide="refresh-cw" class="mr-1 h-3.5 w-3.5"></i>刷新
          </button>
        </div>
      </div>

      <div class="border-b bg-background px-6">
        <div class="flex">
          ${tabs
            .map(
              (tab) => `
                <button
                  class="${toClassName(
                    'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                    state.activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}"
                  data-craft-dict-action="set-tab"
                  data-tab="${tab.key}"
                >
                  ${tab.label}
                </button>
              `,
            )
            .join('')}
        </div>
      </div>

      <div class="flex-1 space-y-4 p-6">
        <div class="flex items-center gap-2 rounded-md border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <i data-lucide="book-open" class="h-3.5 w-3.5 shrink-0"></i>
          <span>当前页面仅展示工序工艺标准母本与老系统映射结果，供技术包等模块统一引用。本页为只读展示页，不承接新增、编辑、映射维护动作。</span>
        </div>

        ${state.activeTab === 'overview' ? renderOverviewTab() : ''}
        ${state.activeTab === 'detail' ? renderDetailTab() : ''}
        ${state.activeTab === 'mapping' ? renderMappingTab() : ''}
      </div>

      ${viewCraft && state.activeTab !== 'detail' ? renderCraftDetailSheet(viewCraft) : ''}
    </div>
  `
}

export function handleProductionCraftDictEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-craft-dict-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.craftDictField
    if (!field) return true

    if (field === 'keyword') {
      state.keyword = fieldNode.value
      return true
    }
    if (field === 'filterStage') {
      state.filterStage = fieldNode.value
      return true
    }
    if (field === 'filterProcess') {
      state.filterProcess = fieldNode.value
      return true
    }
    if (field === 'filterStatus') {
      state.filterStatus = fieldNode.value
      return true
    }
    if (field === 'filterMapping') {
      state.filterMapping = fieldNode.value
      return true
    }
    if (field === 'mapKeyword') {
      state.mapKeyword = fieldNode.value
      return true
    }
    if (field === 'mapFilterStatus') {
      state.mapFilterStatus = fieldNode.value
      return true
    }
    if (field === 'mapFilterStage') {
      state.mapFilterStage = fieldNode.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-craft-dict-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.craftDictAction
  if (!action) return false

  if (action === 'refresh') {
    return true
  }

  if (action === 'set-tab') {
    const tab = actionNode.dataset.tab as CraftDictTab | undefined
    if (tab && ['overview', 'detail', 'mapping'].includes(tab)) {
      state.activeTab = tab
    }
    return true
  }

  if (action === 'clear-craft-filters') {
    state.keyword = ''
    state.filterStage = 'ALL'
    state.filterProcess = 'ALL'
    state.filterStatus = 'ALL'
    state.filterMapping = 'ALL'
    return true
  }

  if (action === 'view-craft-detail') {
    const craftId = actionNode.dataset.craftId
    if (craftId) {
      state.viewCraftId = craftId
      state.activeTab = 'detail'
    }
    return true
  }

  if (action === 'view-mapping-tab') {
    state.activeTab = 'mapping'
    return true
  }

  if (action === 'view-mapping-craft') {
    const craftId = actionNode.dataset.craftId
    if (craftId) {
      state.viewCraftId = craftId
      state.activeTab = 'detail'
    }
    return true
  }

  if (action === 'close-sheet') {
    state.viewCraftId = ''
    return true
  }

  return false
}

export function isProductionCraftDictDialogOpen(): boolean {
  return Boolean(state.viewCraftId && state.activeTab !== 'detail')
}

export function closeProductionCraftDictDialog(): void {
  state.viewCraftId = ''
  appStore.navigate('/fcs/production/craft-dict')
}
