import { appStore } from '../state/store'
import { escapeHtml } from '../utils'

type ProjectStatus = '进行中' | '已终止' | '已归档'
export type WorkItemStatus = '未开始' | '进行中' | '待决策' | '已完成' | '未解锁'
type WorkItemNature = '执行类' | '决策类'
type DecisionValue = '' | 'pass' | 'revision' | 'reject'

interface ProjectMeta {
  id: string
  code: string
  name: string
  status: ProjectStatus
  styleType: string
  category: string
  tags: string[]
  owner: string
  lastUpdated: string
  phaseName: string
}

interface PhaseItem {
  id: string
  no: string
  name: string
  description: string
  items: string[]
}

interface KeyOutputItem {
  label: string
  value: string
}

interface EvidenceCounters {
  attachments: number
  links: number
  records: number
}

interface LatestRecord {
  title: string
  meta: string
  time: string
}

interface MultiInstanceKpi {
  label: string
  value: string
}

interface MultiInstanceRecord {
  id: string
  title: string
  sub: string
  metrics: string
  time: string
}

interface WorkItemSummary {
  keyOutputs: KeyOutputItem[]
  evidence: EvidenceCounters
  latestRecords: LatestRecord[]
}

export interface WorkItem {
  id: string
  name: string
  nature: WorkItemNature
  status: WorkItemStatus
  phaseId: string
  owner: string
  updatedAt: string
  summary: WorkItemSummary
  isMultiInstance?: boolean
  multiInstance?: {
    kpis: MultiInstanceKpi[]
    records: MultiInstanceRecord[]
  }
}

interface ProjectLog {
  time: string
  type: '状态变更' | '工作项' | '决策'
  title: string
  detail: string
}

export interface ProjectDetailData {
  projectId: string
  project: ProjectMeta & { currentPhaseId: string }
  phases: PhaseItem[]
  workItems: Record<string, WorkItem>
  logs: ProjectLog[]
}

interface ProjectDetailPageState {
  projectId: string | null
  data: ProjectDetailData | null
  selectedWorkItemId: string | null
  expandedPhases: string[]
  showDecisionDialog: boolean
  decisionValue: DecisionValue
  decisionNote: string
  notice: string | null
}

const PROJECT_INDEX: ProjectMeta[] = [
  {
    id: 'prj_20251216_001',
    code: 'PRJ-20251216-001',
    name: '印尼风格碎花连衣裙',
    status: '进行中',
    styleType: '基础款',
    category: '裙装 / 连衣裙',
    tags: ['休闲', '甜美'],
    owner: '张丽',
    lastUpdated: '2025-12-15 12:30:30',
    phaseName: '市场测款',
  },
  {
    id: 'prj_20251216_002',
    code: 'PRJ-20251216-002',
    name: '百搭纯色基础T恤',
    status: '进行中',
    styleType: '快时尚款',
    category: '上衣 / T恤',
    tags: ['极简', '通勤'],
    owner: '王明',
    lastUpdated: '2025-12-16 12:00',
    phaseName: '工程准备',
  },
  {
    id: 'prj_20251216_003',
    code: 'PRJ-20251216-003',
    name: '夏日休闲牛仔短裤',
    status: '进行中',
    styleType: '设计款',
    category: '裤装 / 短裤',
    tags: ['休闲', '运动'],
    owner: '李娜',
    lastUpdated: '2025-12-15 18:45',
    phaseName: '打样阶段',
  },
  {
    id: 'prj_20251216_004',
    code: 'PRJ-20251216-004',
    name: '复古皮质机车夹克',
    status: '进行中',
    styleType: '改版款',
    category: '外套 / 夹克',
    tags: ['复古', '街头'],
    owner: '赵云',
    lastUpdated: '2025-12-15 16:20',
    phaseName: '立项阶段',
  },
  {
    id: 'prj_20251216_005',
    code: 'PRJ-20251216-005',
    name: '法式优雅衬衫连衣裙',
    status: '进行中',
    styleType: '设计款',
    category: '裙装 / 连衣裙',
    tags: ['优雅', '通勤'],
    owner: '周芳',
    lastUpdated: '2025-12-15 14:10',
    phaseName: '市场测款',
  },
  {
    id: 'prj_20251216_006',
    code: 'PRJ-20251216-006',
    name: '运动休闲卫衣套装',
    status: '进行中',
    styleType: '快时尚款',
    category: '套装 / 运动套装',
    tags: ['运动', '休闲'],
    owner: '陈刚',
    lastUpdated: '2025-12-14 20:30',
    phaseName: '工程准备',
  },
  {
    id: 'prj_20251216_007',
    code: 'PRJ-20251216-007',
    name: '碎花雪纺半身裙',
    status: '已归档',
    styleType: '基础款',
    category: '裙装 / 半身裙',
    tags: ['甜美', '清新'],
    owner: '张丽',
    lastUpdated: '2025-12-10 10:00',
    phaseName: '资产处置',
  },
  {
    id: 'prj_20251216_008',
    code: 'PRJ-20251216-008',
    name: '商务休闲西装外套',
    status: '已终止',
    styleType: '改版款',
    category: '外套 / 西装',
    tags: ['商务', '通勤'],
    owner: '王明',
    lastUpdated: '2025-12-08 15:00',
    phaseName: '结论与推进',
  },
  {
    id: 'prj_20251216_009',
    code: 'PRJ-20251216-009',
    name: '高腰阔腿牛仔裤',
    status: '进行中',
    styleType: '基础款',
    category: '裤装 / 长裤',
    tags: ['休闲', '百搭'],
    owner: '李娜',
    lastUpdated: '2025-12-14 11:20',
    phaseName: '打样阶段',
  },
  {
    id: 'prj_20251216_010',
    code: 'PRJ-20251216-010',
    name: '波西米亚印花长裙',
    status: '进行中',
    styleType: '设计款',
    category: '裙装 / 长裙',
    tags: ['度假', '波西米亚'],
    owner: '周芳',
    lastUpdated: '2025-12-16 09:00',
    phaseName: '立项阶段',
  },
]

const PHASES: PhaseItem[] = [
  {
    id: 'phase_01',
    no: '01',
    name: '立项获取',
    description: '项目立项与样衣获取（含深圳前置打版），确保版型/工艺稳定性。',
    items: ['wi_01', 'wi_02', 'wi_03'],
  },
  {
    id: 'phase_02',
    no: '02',
    name: '评估定价',
    description: '闭合可行性、成本与定价，避免测款有效但毛利不可做。',
    items: ['wi_04', 'wi_05', 'wi_06', 'wi_07', 'wi_08'],
  },
  {
    id: 'phase_03',
    no: '03',
    name: '市场测款',
    description: '短视频验证兴趣，直播验证转化；事实记录支持多实例。',
    items: ['wi_09', 'wi_10', 'wi_11', 'wi_12'],
  },
  {
    id: 'phase_04',
    no: '04',
    name: '结论与推进',
    description: '以测款结论判定为推进闸口，通过后解锁转档与制版准备。',
    items: ['wi_13', 'wi_14', 'wi_15', 'wi_16', 'wi_17', 'wi_18', 'wi_19'],
  },
  {
    id: 'phase_05',
    no: '05',
    name: '资产处置',
    description: '样衣留存/退货处理按项目结论与资产策略执行。',
    items: ['wi_20', 'wi_21'],
  },
]

const WORK_ITEM_SEED: Record<string, WorkItem> = {
  wi_01: {
    id: 'wi_01',
    name: '商品项目立项',
    nature: '执行类',
    status: '已完成',
    phaseId: 'phase_01',
    owner: '张丽',
    updatedAt: '2025-12-15 10:02',
    summary: {
      keyOutputs: [
        { label: '目标渠道', value: 'TikTok / Shopee' },
        { label: '目标价位', value: 'IDR 149k-199k' },
        { label: '风险提示', value: '面料缩水风险待验证' },
      ],
      evidence: { attachments: 2, links: 1, records: 0 },
      latestRecords: [],
    },
  },
  wi_02: {
    id: 'wi_02',
    name: '样衣获取（深圳前置打版）',
    nature: '执行类',
    status: '已完成',
    phaseId: 'phase_01',
    owner: '王明',
    updatedAt: '2025-12-15 10:35',
    summary: {
      keyOutputs: [
        { label: '样衣来源', value: '深圳前置打版' },
        { label: '样衣数量', value: '2 件' },
        { label: '关键改动', value: '腰线收省、袖口松量调整' },
      ],
      evidence: { attachments: 3, links: 0, records: 1 },
      latestRecords: [{ title: '获取记录', meta: '打版完成并发出', time: '2025-12-15 10:20' }],
    },
  },
  wi_03: {
    id: 'wi_03',
    name: '到样入库与核对',
    nature: '执行类',
    status: '已完成',
    phaseId: 'phase_01',
    owner: '样管-李娜',
    updatedAt: '2025-12-15 11:10',
    summary: {
      keyOutputs: [
        { label: '入库样衣', value: '2 件（S/M）' },
        { label: '核对结果', value: '无缺件' },
        { label: '样衣编号', value: 'SY-INA-001 / SY-INA-002' },
      ],
      evidence: { attachments: 1, links: 0, records: 2 },
      latestRecords: [{ title: '入库记录', meta: '已完成入库与尺码核对', time: '2025-12-15 11:08' }],
    },
  },
  wi_04: {
    id: 'wi_04',
    name: '初步可行性判断',
    nature: '决策类',
    status: '已完成',
    phaseId: 'phase_02',
    owner: '张丽',
    updatedAt: '2025-12-15 11:25',
    summary: {
      keyOutputs: [
        { label: '结论', value: '通过（进入拍摄与测款）' },
        { label: '关键风险', value: '面料缩水、腰线位置需试穿确认' },
        { label: '建议', value: '优先直播测款验证转化' },
      ],
      evidence: { attachments: 0, links: 0, records: 1 },
      latestRecords: [{ title: '决策记录', meta: '通过', time: '2025-12-15 11:24' }],
    },
  },
  wi_05: {
    id: 'wi_05',
    name: '样衣拍摄与试穿',
    nature: '执行类',
    status: '已完成',
    phaseId: 'phase_02',
    owner: '内容-赵云',
    updatedAt: '2025-12-15 12:00',
    summary: {
      keyOutputs: [
        { label: '素材产出', value: '图 25 张 / 视频 3 条' },
        { label: '试穿要点', value: '腰线偏高，S码更贴合' },
        { label: '卖点提炼', value: '显瘦腰线、碎花氛围感' },
      ],
      evidence: { attachments: 6, links: 0, records: 1 },
      latestRecords: [{ title: '试穿反馈', meta: '建议腰线下移 1cm（可选）', time: '2025-12-15 11:58' }],
    },
  },
  wi_06: {
    id: 'wi_06',
    name: '样衣确认',
    nature: '决策类',
    status: '已完成',
    phaseId: 'phase_02',
    owner: '张丽',
    updatedAt: '2025-12-15 12:05',
    summary: {
      keyOutputs: [
        { label: '确认结论', value: '确认通过' },
        { label: '需关注点', value: '缩水率入测款观察' },
        { label: '备注', value: '腰线优化列为后续可选改版点' },
      ],
      evidence: { attachments: 1, links: 0, records: 1 },
      latestRecords: [{ title: '决策记录', meta: '确认通过', time: '2025-12-15 12:04' }],
    },
  },
  wi_07: {
    id: 'wi_07',
    name: '样衣核价',
    nature: '执行类',
    status: '已完成',
    phaseId: 'phase_02',
    owner: '核价-周强',
    updatedAt: '2025-12-15 12:15',
    summary: {
      keyOutputs: [
        { label: '核价成本', value: 'IDR 78k' },
        { label: '目标毛利', value: '46.8%' },
        { label: '结论', value: '可进入定价' },
      ],
      evidence: { attachments: 2, links: 0, records: 2 },
      latestRecords: [{ title: '核价明细', meta: '材料与工费拆分完成', time: '2025-12-15 12:12' }],
    },
  },
  wi_08: {
    id: 'wi_08',
    name: '样衣定价',
    nature: '决策类',
    status: '已完成',
    phaseId: 'phase_02',
    owner: '张丽',
    updatedAt: '2025-12-15 12:20',
    summary: {
      keyOutputs: [
        { label: '建议售价', value: 'IDR 179k' },
        { label: '活动价', value: 'IDR 169k' },
        { label: '结论', value: '通过' },
      ],
      evidence: { attachments: 1, links: 0, records: 1 },
      latestRecords: [{ title: '定价决策', meta: 'IDR 179k / 券后 169k', time: '2025-12-15 12:20' }],
    },
  },
  wi_09: {
    id: 'wi_09',
    name: '短视频测款',
    nature: '执行类',
    status: '进行中',
    phaseId: 'phase_03',
    owner: '短视频运营-小雅',
    updatedAt: '2025-12-15 12:28',
    summary: {
      keyOutputs: [
        { label: '发布视频', value: '3 条' },
        { label: '曝光量', value: '126,000' },
        { label: '点击率', value: '3.9%' },
      ],
      evidence: { attachments: 0, links: 3, records: 3 },
      latestRecords: [
        { title: '短视频 #3', meta: '完播率 21.3%，评论正向率 89%', time: '2025-12-15 12:28' },
        { title: '短视频 #2', meta: '完播率 19.7%，收藏率 3.2%', time: '2025-12-15 11:54' },
      ],
    },
    isMultiInstance: true,
    multiInstance: {
      kpis: [
        { label: '累计曝光', value: '126k' },
        { label: '累计互动', value: '9.8k' },
        { label: '收藏加购率', value: '5.1%' },
        { label: '测款结论建议', value: '待汇总' },
      ],
      records: [
        { id: 'sv_01', title: 'SV-20251215-01', sub: '穿搭场景测试', metrics: '曝光 52k ｜ 点击率 4.1% ｜ 收藏率 2.7%', time: '2025-12-15 10:30' },
        { id: 'sv_02', title: 'SV-20251215-02', sub: '面料与腰线卖点测试', metrics: '曝光 38k ｜ 点击率 3.8% ｜ 收藏率 2.1%', time: '2025-12-15 11:20' },
        { id: 'sv_03', title: 'SV-20251215-03', sub: '模特试穿反馈向', metrics: '曝光 36k ｜ 点击率 3.7% ｜ 收藏率 2.3%', time: '2025-12-15 12:28' },
      ],
    },
  },
  wi_10: {
    id: 'wi_10',
    name: '直播测款',
    nature: '执行类',
    status: '进行中',
    phaseId: 'phase_03',
    owner: '直播运营-小美',
    updatedAt: '2025-12-15 12:30',
    summary: {
      keyOutputs: [
        { label: '直播场次', value: '3 场（进行中）' },
        { label: '转化率', value: '4.2%' },
        { label: '退款率', value: '1.8%' },
      ],
      evidence: { attachments: 0, links: 2, records: 3 },
      latestRecords: [
        { title: 'LS-20251215-03', meta: 'GMV 8.7k，转化 4.3%，互动 1.2k', time: '2025-12-15 12:30' },
        { title: 'LS-20251215-02', meta: 'GMV 7.9k，转化 4.0%，互动 1.0k', time: '2025-12-15 11:45' },
      ],
    },
    isMultiInstance: true,
    multiInstance: {
      kpis: [
        { label: '总观看', value: '68k' },
        { label: '总成交', value: 'IDR 24.1M' },
        { label: '平均转化', value: '4.2%' },
        { label: '退货预警', value: '低' },
      ],
      records: [
        { id: 'ls_01', title: 'LS-20251215-01', sub: '晚高峰场', metrics: '观看 21k ｜ 转化 3.9% ｜ 退款 2.0%', time: '2025-12-15 10:45' },
        { id: 'ls_02', title: 'LS-20251215-02', sub: '午间场', metrics: '观看 24k ｜ 转化 4.0% ｜ 退款 1.8%', time: '2025-12-15 11:45' },
        { id: 'ls_03', title: 'LS-20251215-03', sub: '晚间场', metrics: '观看 23k ｜ 转化 4.3% ｜ 退款 1.6%', time: '2025-12-15 12:30' },
      ],
    },
  },
  wi_11: {
    id: 'wi_11',
    name: '测款数据汇总',
    nature: '执行类',
    status: '进行中',
    phaseId: 'phase_03',
    owner: '数据分析-小陈',
    updatedAt: '2025-12-15 12:31',
    summary: {
      keyOutputs: [
        { label: '短视频维度', value: '曝光/点击/收藏/评论' },
        { label: '直播维度', value: '观看/转化/退款/客诉' },
        { label: '当前结论', value: '待决策会审' },
      ],
      evidence: { attachments: 1, links: 0, records: 2 },
      latestRecords: [{ title: '汇总看板', meta: '数据已同步至评审板', time: '2025-12-15 12:31' }],
    },
  },
  wi_12: {
    id: 'wi_12',
    name: '测款结论判定',
    nature: '决策类',
    status: '待决策',
    phaseId: 'phase_03',
    owner: '张丽',
    updatedAt: '2025-12-15 12:32',
    summary: {
      keyOutputs: [
        { label: '待决策结论', value: '通过 / 改版 / 淘汰' },
        { label: '当前建议', value: '通过后进入工程准备' },
        { label: '闸口影响', value: '决定后续工作项解锁状态' },
      ],
      evidence: { attachments: 0, links: 0, records: 1 },
      latestRecords: [{ title: '待决策提醒', meta: '需在今日内完成结论判定', time: '2025-12-15 12:32' }],
    },
  },
  wi_13: {
    id: 'wi_13',
    name: '生成商品档案',
    nature: '执行类',
    status: '未解锁',
    phaseId: 'phase_04',
    owner: '商品中台-小王',
    updatedAt: '-',
    summary: {
      keyOutputs: [{ label: '提示', value: '等待测款结论通过后解锁' }],
      evidence: { attachments: 0, links: 0, records: 0 },
      latestRecords: [],
    },
  },
  wi_14: {
    id: 'wi_14',
    name: '转档准备',
    nature: '执行类',
    status: '未解锁',
    phaseId: 'phase_04',
    owner: '商品中台-小刘',
    updatedAt: '-',
    summary: { keyOutputs: [{ label: '提示', value: '等待测款结论通过后解锁' }], evidence: { attachments: 0, links: 0, records: 0 }, latestRecords: [] },
  },
  wi_15: {
    id: 'wi_15',
    name: '制版任务',
    nature: '执行类',
    status: '未解锁',
    phaseId: 'phase_04',
    owner: '版房-王版师',
    updatedAt: '-',
    summary: { keyOutputs: [{ label: '提示', value: '等待闸口放行' }], evidence: { attachments: 0, links: 0, records: 0 }, latestRecords: [] },
  },
  wi_16: {
    id: 'wi_16',
    name: '花型任务',
    nature: '执行类',
    status: '未解锁',
    phaseId: 'phase_04',
    owner: '设计-花型组',
    updatedAt: '-',
    summary: { keyOutputs: [{ label: '提示', value: '等待闸口放行' }], evidence: { attachments: 0, links: 0, records: 0 }, latestRecords: [] },
  },
  wi_17: {
    id: 'wi_17',
    name: '首单样衣打样',
    nature: '执行类',
    status: '未解锁',
    phaseId: 'phase_04',
    owner: '样衣组-小李',
    updatedAt: '-',
    summary: { keyOutputs: [{ label: '提示', value: '等待闸口放行' }], evidence: { attachments: 0, links: 0, records: 0 }, latestRecords: [] },
  },
  wi_18: {
    id: 'wi_18',
    name: '产前版样衣',
    nature: '执行类',
    status: '未解锁',
    phaseId: 'phase_04',
    owner: '样衣组-小刘',
    updatedAt: '-',
    summary: { keyOutputs: [{ label: '提示', value: '等待闸口放行' }], evidence: { attachments: 0, links: 0, records: 0 }, latestRecords: [] },
  },
  wi_19: {
    id: 'wi_19',
    name: '商品上架',
    nature: '执行类',
    status: '未解锁',
    phaseId: 'phase_04',
    owner: '渠道运营-小郑',
    updatedAt: '-',
    summary: { keyOutputs: [{ label: '提示', value: '等待闸口放行' }], evidence: { attachments: 0, links: 0, records: 0 }, latestRecords: [] },
  },
  wi_20: {
    id: 'wi_20',
    name: '样衣留存评估',
    nature: '执行类',
    status: '未解锁',
    phaseId: 'phase_05',
    owner: '样衣资产-小赵',
    updatedAt: '-',
    summary: { keyOutputs: [{ label: '提示', value: '待项目推进完成后执行' }], evidence: { attachments: 0, links: 0, records: 0 }, latestRecords: [] },
  },
  wi_21: {
    id: 'wi_21',
    name: '样衣退货处理',
    nature: '执行类',
    status: '未解锁',
    phaseId: 'phase_05',
    owner: '样衣资产-小赵',
    updatedAt: '-',
    summary: { keyOutputs: [{ label: '提示', value: '待项目推进完成后执行' }], evidence: { attachments: 0, links: 0, records: 0 }, latestRecords: [] },
  },
}

const LOG_SEED: ProjectLog[] = [
  {
    time: '2025-12-15 12:30:30',
    type: '状态变更',
    title: '项目状态：测款数据更新',
    detail: '直播场次 3 进行中，当前转化 4.2%。',
  },
  {
    time: '2025-12-15 12:26:30',
    type: '工作项',
    title: '完成工作项：商品上架预检查',
    detail: '渠道字段与映射规则已校验通过。',
  },
  {
    time: '2025-12-15 12:20:00',
    type: '决策',
    title: '决策：样衣定价',
    detail: '定价 IDR 179k；券后 169k。',
  },
  {
    time: '2025-12-15 12:05:00',
    type: '决策',
    title: '决策：样衣确认',
    detail: '确认通过；腰线优化列为可选改版点。',
  },
  {
    time: '2025-12-15 11:25:00',
    type: '决策',
    title: '决策：初步可行性判断',
    detail: '通过（进入拍摄与测款）。',
  },
  {
    time: '2025-12-15 11:10:10',
    type: '工作项',
    title: '完成工作项：到样入库与核对',
    detail: 'SY-INA-001 / SY-INA-002 入库完成。',
  },
]

const state: ProjectDetailPageState = {
  projectId: null,
  data: null,
  selectedWorkItemId: null,
  expandedPhases: PHASES.map((phase) => phase.id),
  showDecisionDialog: false,
  decisionValue: '',
  decisionNote: '',
  notice: null,
}

function toClassName(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function cloneDetailData(data: ProjectDetailData): ProjectDetailData {
  return JSON.parse(JSON.stringify(data)) as ProjectDetailData
}

function getMetaById(projectId: string): ProjectMeta | null {
  return PROJECT_INDEX.find((project) => project.id === projectId) ?? null
}

function getPhaseIdByName(phaseName: string): string {
  if (phaseName.includes('立项')) return 'phase_01'
  if (phaseName.includes('打样')) return 'phase_02'
  if (phaseName.includes('测款') || phaseName.includes('市场')) return 'phase_03'
  if (phaseName.includes('工程') || phaseName.includes('推进')) return 'phase_04'
  if (phaseName.includes('资产') || phaseName.includes('归档')) return 'phase_05'
  return 'phase_03'
}

function buildWorkItemsForMeta(meta: ProjectMeta): Record<string, WorkItem> {
  const items = cloneDetailData({
    projectId: 'seed',
    project: {
      ...meta,
      currentPhaseId: 'phase_03',
    },
    phases: PHASES,
    workItems: WORK_ITEM_SEED,
    logs: LOG_SEED,
  }).workItems

  const phaseId = getPhaseIdByName(meta.phaseName)
  const statusRank: Record<string, number> = {
    phase_01: 1,
    phase_02: 2,
    phase_03: 3,
    phase_04: 4,
    phase_05: 5,
  }

  const currentRank = statusRank[phaseId]

  Object.values(items).forEach((item) => {
    const itemRank = statusRank[item.phaseId]
    if (meta.status === '已归档') {
      item.status = '已完成'
      return
    }

    if (meta.status === '已终止') {
      if (itemRank <= currentRank) {
        item.status = item.nature === '决策类' && item.id === 'wi_12' ? '已完成' : '已完成'
      } else {
        item.status = '未解锁'
      }
      return
    }

    if (itemRank < currentRank) {
      item.status = '已完成'
      return
    }

    if (itemRank > currentRank) {
      item.status = '未解锁'
      return
    }

    if (phaseId === 'phase_01') {
      item.status = item.id === 'wi_03' ? '进行中' : item.id === 'wi_01' ? '已完成' : '未开始'
      return
    }

    if (phaseId === 'phase_02') {
      if (item.id === 'wi_08') item.status = '待决策'
      else if (item.id === 'wi_07') item.status = '进行中'
      else item.status = '已完成'
      return
    }

    if (phaseId === 'phase_03') {
      if (item.id === 'wi_12') item.status = '待决策'
      else if (item.id === 'wi_09' || item.id === 'wi_10' || item.id === 'wi_11') item.status = '进行中'
      else item.status = '已完成'
      return
    }

    if (phaseId === 'phase_04') {
      if (item.id === 'wi_13') item.status = '进行中'
      else if (item.id === 'wi_14') item.status = '未开始'
      else if (item.phaseId === 'phase_04') item.status = '未开始'
      else item.status = '已完成'
      return
    }

    if (phaseId === 'phase_05') {
      if (item.phaseId === 'phase_05') item.status = '进行中'
      else item.status = '已完成'
      return
    }
  })

  return items
}

function buildDetailData(projectId: string): ProjectDetailData | null {
  const meta = getMetaById(projectId)
  if (!meta) return null

  const phaseId = getPhaseIdByName(meta.phaseName)
  const workItems = buildWorkItemsForMeta(meta)

  return {
    projectId,
    project: {
      ...meta,
      currentPhaseId: phaseId,
    },
    phases: PHASES,
    workItems,
    logs: cloneDetailData({
      projectId: 'seed',
      project: { ...meta, currentPhaseId: phaseId },
      phases: PHASES,
      workItems,
      logs: LOG_SEED,
    }).logs,
  }
}

export function getPcsProjectDetailSnapshot(projectId: string): ProjectDetailData | null {
  const data = buildDetailData(projectId)
  return data ? cloneDetailData(data) : null
}

function ensureProjectState(projectId: string): void {
  if (state.projectId === projectId && state.data) return

  state.projectId = projectId
  state.data = buildDetailData(projectId)
  state.expandedPhases = PHASES.map((phase) => phase.id)
  state.decisionValue = ''
  state.decisionNote = ''
  state.showDecisionDialog = false
  state.notice = null

  if (!state.data) {
    state.selectedWorkItemId = null
    return
  }

  state.selectedWorkItemId = 'wi_01'
}

function getSelectedWorkItem(data: ProjectDetailData): WorkItem | null {
  if (!state.selectedWorkItemId) return null
  return data.workItems[state.selectedWorkItemId] ?? null
}

function getPhaseStats(data: ProjectDetailData, phase: PhaseItem): {
  total: number
  completed: number
  hasDecision: boolean
  hasBlocked: boolean
} {
  const items = phase.items.map((itemId) => data.workItems[itemId]).filter(Boolean)
  return {
    total: items.length,
    completed: items.filter((item) => item.status === '已完成').length,
    hasDecision: items.some((item) => item.status === '待决策'),
    hasBlocked: items.some((item) => item.status === '未解锁'),
  }
}

function getWorkItemStatusBadge(status: WorkItemStatus): string {
  if (status === '已完成') return renderBadge(status, 'border-green-200 bg-green-50 text-green-700')
  if (status === '进行中') return renderBadge(status, 'border-blue-200 bg-blue-50 text-blue-700')
  if (status === '待决策') return renderBadge(status, 'border-orange-200 bg-orange-50 text-orange-700')
  if (status === '未开始') return renderBadge(status, 'border-slate-200 bg-slate-50 text-slate-700')
  return renderBadge(status, 'border-slate-200 bg-slate-100 text-slate-500')
}

function getStatusIcon(status: WorkItemStatus): string {
  if (status === '已完成') return '<i data-lucide="check-circle-2" class="h-4 w-4 text-green-600"></i>'
  if (status === '进行中') return '<i data-lucide="play-circle" class="h-4 w-4 text-blue-600"></i>'
  if (status === '待决策') return '<i data-lucide="alert-circle" class="h-4 w-4 text-orange-600"></i>'
  if (status === '未解锁') return '<i data-lucide="lock" class="h-4 w-4 text-slate-400"></i>'
  return '<i data-lucide="clock-3" class="h-4 w-4 text-slate-400"></i>'
}

function getProgress(data: ProjectDetailData): { done: number; total: number; percent: number } {
  const items = Object.values(data.workItems)
  const total = items.length
  const done = items.filter((item) => item.status === '已完成').length
  const percent = Math.round((done / Math.max(total, 1)) * 100)
  return { done, total, percent }
}

function hasPendingDecisionInCurrentPhase(data: ProjectDetailData): boolean {
  const currentPhase = data.phases.find((phase) => phase.id === data.project.currentPhaseId)
  if (!currentPhase) return false
  return currentPhase.items.some((itemId) => data.workItems[itemId]?.status === '待决策')
}

function renderNotFound(projectId: string): string {
  return `
    <div class="space-y-4">
      <header class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">商品项目详情</h1>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="go-list">
          返回项目列表
        </button>
      </header>
      <section class="rounded-lg border bg-card p-8 text-center">
        <i data-lucide="alert-circle" class="mx-auto h-10 w-10 text-muted-foreground/60"></i>
        <h2 class="mt-3 text-lg font-semibold">项目未找到</h2>
        <p class="mt-1 text-sm text-muted-foreground">未匹配到项目 ID：${escapeHtml(projectId)}</p>
        <button class="mt-4 inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-project-detail-action="go-list">
          返回项目列表
        </button>
      </section>
    </div>
  `
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="inline-flex h-7 items-center rounded-md border border-blue-300 px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-project-detail-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(data: ProjectDetailData): string {
  const progress = getProgress(data)
  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-xl font-semibold">${escapeHtml(data.project.name)}</h1>
            ${renderBadge(data.project.code, 'border-slate-200 bg-slate-50 text-slate-700')}
            ${renderBadge(data.project.status, data.project.status === '进行中' ? 'border-blue-200 bg-blue-50 text-blue-700' : data.project.status === '已终止' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-700')}
          </div>
          <p class="text-sm text-muted-foreground">${escapeHtml(data.project.category)} · ${escapeHtml(data.project.styleType)} · ${data.project.tags.map((tag) => escapeHtml(tag)).join('、')}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="go-list">返回项目列表</button>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="more-actions"><i data-lucide="more-horizontal" class="mr-1 h-3.5 w-3.5"></i>更多操作</button>
        </div>
      </div>
      <div class="mt-4 grid gap-3 sm:grid-cols-4 text-sm">
        <div><span class="text-muted-foreground">负责人：</span><span class="font-medium">${escapeHtml(data.project.owner)}</span></div>
        <div><span class="text-muted-foreground">当前阶段：</span><span class="font-medium">${escapeHtml(data.phases.find((phase) => phase.id === data.project.currentPhaseId)?.name ?? '-')}</span></div>
        <div><span class="text-muted-foreground">项目进度：</span><span class="font-medium">${progress.done}/${progress.total}（${progress.percent}%）</span></div>
        <div><span class="text-muted-foreground">最后更新：</span><span class="font-medium">${escapeHtml(data.project.lastUpdated)}</span></div>
      </div>
    </section>
  `
}

function renderPhaseNavigator(data: ProjectDetailData): string {
  return `
    <aside class="w-full space-y-3 xl:w-[320px]">
      <section class="rounded-lg border bg-card p-4">
        <h2 class="mb-3 text-sm font-semibold">阶段与工作项</h2>
        <div class="space-y-2">
          ${data.phases
            .map((phase) => {
              const stats = getPhaseStats(data, phase)
              const expanded = state.expandedPhases.includes(phase.id)
              const current = data.project.currentPhaseId === phase.id
              return `
                <div class="overflow-hidden rounded-lg border">
                  <button
                    class="${toClassName(
                      'flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/50',
                      current && 'bg-blue-50',
                    )}"
                    data-pcs-project-detail-action="toggle-phase"
                    data-phase-id="${escapeHtml(phase.id)}"
                  >
                    <div class="flex items-center gap-3">
                      <span class="${toClassName(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                        stats.completed === stats.total
                          ? 'bg-green-600 text-white'
                          : current
                            ? 'bg-blue-600 text-white'
                            : 'bg-muted text-muted-foreground',
                      )}">${phase.no}</span>
                      <div>
                        <p class="text-sm font-medium">${escapeHtml(phase.name)}</p>
                        <p class="text-xs text-muted-foreground">
                          ${stats.completed}/${stats.total} 完成
                          ${stats.hasDecision ? ' · 待决策' : ''}
                          ${stats.hasBlocked ? ' · 含未解锁' : ''}
                        </p>
                      </div>
                    </div>
                    <i data-lucide="${expanded ? 'chevron-down' : 'chevron-right'}" class="h-4 w-4 text-muted-foreground"></i>
                  </button>
                  ${
                    expanded
                      ? `
                        <div class="border-t bg-muted/30">
                          ${phase.items
                            .map((itemId) => {
                              const item = data.workItems[itemId]
                              if (!item) return ''
                              const selected = state.selectedWorkItemId === item.id
                              return `
                                <button
                                  class="${toClassName(
                                    'flex w-full items-center gap-3 px-3 py-2 pl-11 text-left transition-colors hover:bg-muted/50',
                                    selected && 'bg-blue-50',
                                  )}"
                                  data-pcs-project-detail-action="select-work-item"
                                  data-work-item-id="${escapeHtml(item.id)}"
                                >
                                  ${getStatusIcon(item.status)}
                                  <div class="min-w-0 flex-1">
                                    <p class="truncate text-sm font-medium">${escapeHtml(item.name)}</p>
                                    <p class="text-xs text-muted-foreground">${escapeHtml(item.owner)}</p>
                                  </div>
                                  ${item.nature === '决策类' ? '<span class="inline-flex rounded-md border px-1.5 py-0.5 text-[11px]">决策</span>' : ''}
                                </button>
                              `
                            })
                            .join('')}
                        </div>
                      `
                      : ''
                  }
                </div>
              `
            })
            .join('')}
        </div>
      </section>
    </aside>
  `
}

function renderWorkItemPanel(data: ProjectDetailData): string {
  const item = getSelectedWorkItem(data)
  if (!item) {
    return `
      <section class="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        请从左侧选择一个工作项查看详情
      </section>
    `
  }

  return `
    <section class="space-y-4 rounded-lg border bg-card p-5">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-lg font-semibold">${escapeHtml(item.name)}</h2>
            ${renderBadge(item.nature, 'border-slate-200 bg-slate-50 text-slate-700')}
            ${getWorkItemStatusBadge(item.status)}
          </div>
          <p class="text-sm text-muted-foreground">负责人：${escapeHtml(item.owner)} · 更新：${escapeHtml(item.updatedAt)}</p>
        </div>
        <div class="flex items-center gap-2">
          ${
            item.status === '未解锁'
              ? '<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs text-muted-foreground" disabled><i data-lucide="lock" class="mr-1 h-3.5 w-3.5"></i>等待解锁</button>'
              : '<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="go-work-item-detail" data-work-item-id="' + escapeHtml(item.id) + '">查看全部<i data-lucide="chevron-right" class="ml-1 h-3.5 w-3.5"></i></button>'
          }
        </div>
      </header>

      ${
        item.status === '未解锁'
          ? `
            <section class="rounded-lg border bg-muted/40 p-4">
              <p class="inline-flex items-center gap-2 text-sm text-muted-foreground"><i data-lucide="lock" class="h-4 w-4"></i>等待测款结论判定通过后解锁</p>
            </section>
          `
          : ''
      }

      ${
        item.status !== '未解锁'
          ? `
            <section>
              <h3 class="mb-3 text-sm font-semibold text-muted-foreground">关键产出</h3>
              <div class="grid gap-3 md:grid-cols-3">
                ${item.summary.keyOutputs
                  .map(
                    (output) => `
                      <article class="rounded-lg border bg-muted/20 p-3">
                        <p class="text-xs text-muted-foreground">${escapeHtml(output.label)}</p>
                        <p class="mt-1 text-sm font-medium">${escapeHtml(output.value)}</p>
                      </article>
                    `,
                  )
                  .join('')}
              </div>
            </section>

            <section>
              <h3 class="mb-3 text-sm font-semibold text-muted-foreground">关键证据</h3>
              <div class="flex flex-wrap items-center gap-4 text-sm">
                <span class="inline-flex items-center gap-1.5"><i data-lucide="paperclip" class="h-4 w-4 text-muted-foreground"></i>${item.summary.evidence.attachments} 附件</span>
                <span class="inline-flex items-center gap-1.5"><i data-lucide="link-2" class="h-4 w-4 text-muted-foreground"></i>${item.summary.evidence.links} 链接</span>
                <span class="inline-flex items-center gap-1.5"><i data-lucide="file-text" class="h-4 w-4 text-muted-foreground"></i>${item.summary.evidence.records} 记录</span>
              </div>
            </section>

            ${
              item.multiInstance
                ? `
                  <section>
                    <h3 class="mb-3 text-sm font-semibold text-muted-foreground">汇总指标</h3>
                    <div class="grid gap-3 md:grid-cols-4">
                      ${item.multiInstance.kpis
                        .map(
                          (kpi) => `
                            <article class="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                              <p class="text-base font-semibold text-blue-700">${escapeHtml(kpi.value)}</p>
                              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(kpi.label)}</p>
                            </article>
                          `,
                        )
                        .join('')}
                    </div>
                  </section>
                `
                : ''
            }

            ${
              item.summary.latestRecords.length > 0
                ? `
                  <section>
                    <h3 class="mb-3 text-sm font-semibold text-muted-foreground">最近记录</h3>
                    <div class="space-y-2">
                      ${item.summary.latestRecords
                        .map(
                          (record) => `
                            <div class="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                              <div>
                                <p class="text-sm font-medium">${escapeHtml(record.title)}</p>
                                <p class="text-xs text-muted-foreground">${escapeHtml(record.meta)}</p>
                              </div>
                              <span class="text-xs text-muted-foreground">${escapeHtml(record.time)}</span>
                            </div>
                          `,
                        )
                        .join('')}
                    </div>
                  </section>
                `
                : ''
            }

            ${
              item.multiInstance
                ? `
                  <section>
                    <div class="mb-3 flex items-center justify-between">
                      <h3 class="text-sm font-semibold text-muted-foreground">实例记录</h3>
                      ${
                        item.status === '进行中'
                          ? '<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="add-record">新增记录</button>'
                          : ''
                      }
                    </div>
                    <div class="space-y-2">
                      ${item.multiInstance.records
                        .map(
                          (record) => `
                            <article class="rounded-lg border p-3">
                              <div class="mb-1 flex items-start justify-between gap-2">
                                <div>
                                  <p class="text-sm font-medium">${escapeHtml(record.title)}</p>
                                  <p class="text-xs text-muted-foreground">${escapeHtml(record.sub)}</p>
                                </div>
                                <span class="text-xs text-muted-foreground">${escapeHtml(record.time)}</span>
                              </div>
                              <p class="text-xs text-muted-foreground">${escapeHtml(record.metrics)}</p>
                            </article>
                          `,
                        )
                        .join('')}
                    </div>
                  </section>
                `
                : ''
            }

            <section class="flex flex-wrap items-center gap-2 border-t pt-3">
              ${
                item.status === '待决策'
                  ? '<button class="inline-flex h-8 items-center rounded-md border border-orange-300 px-3 text-xs text-orange-700 hover:bg-orange-50" data-pcs-project-detail-action="open-decision-dialog"><i data-lucide="alert-circle" class="mr-1 h-3.5 w-3.5"></i>做出决策</button>'
                  : ''
              }
              ${
                item.status === '进行中'
                  ? '<button class="inline-flex h-8 items-center rounded-md border border-green-300 px-3 text-xs text-green-700 hover:bg-green-50" data-pcs-project-detail-action="mark-complete" data-work-item-id="' + escapeHtml(item.id) + '"><i data-lucide="check-circle-2" class="mr-1 h-3.5 w-3.5"></i>标记完成</button>'
                  : ''
              }
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-pcs-project-detail-action="go-work-item-detail" data-work-item-id="${escapeHtml(item.id)}">查看全部<i data-lucide="chevron-right" class="ml-1 h-3.5 w-3.5"></i></button>
            </section>
          `
          : ''
      }
    </section>
  `
}

function renderTimeline(data: ProjectDetailData): string {
  return `
    <aside class="w-full xl:w-[300px]">
      <section class="rounded-lg border bg-card p-4">
        <h2 class="mb-3 text-sm font-semibold">项目日志</h2>
        <div class="space-y-3">
          ${data.logs
            .slice(0, 12)
            .map((log) => {
              const dotColor =
                log.type === '决策' ? 'bg-orange-500' : log.type === '工作项' ? 'bg-green-500' : 'bg-blue-500'
              return `
                <article class="relative border-l pl-4">
                  <span class="absolute -left-[5px] top-1 h-2 w-2 rounded-full ${dotColor}"></span>
                  <p class="text-xs text-muted-foreground">${escapeHtml(log.time)}</p>
                  <p class="text-sm font-medium">${escapeHtml(log.title)}</p>
                  <p class="text-xs text-muted-foreground">${escapeHtml(log.detail)}</p>
                </article>
              `
            })
            .join('')}
        </div>
      </section>
    </aside>
  `
}

function renderGateBar(data: ProjectDetailData): string {
  if (!hasPendingDecisionInCurrentPhase(data)) return ''
  return `
    <section class="rounded-lg border border-orange-200 bg-orange-50 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="inline-flex items-start gap-2">
          <i data-lucide="alert-circle" class="mt-0.5 h-5 w-5 text-orange-600"></i>
          <div>
            <p class="font-semibold text-orange-800">阶段推进待决策</p>
            <p class="text-sm text-orange-700">“测款结论判定”待决策，通过后将解锁工程准备相关工作项。</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="inline-flex h-8 items-center rounded-md border border-orange-300 px-3 text-xs text-orange-700 hover:bg-orange-100" data-pcs-project-detail-action="quick-reject">
            <i data-lucide="x-circle" class="mr-1 h-3.5 w-3.5"></i>不通过 - 项目终止
          </button>
          <button class="inline-flex h-8 items-center rounded-md border border-orange-300 bg-orange-500 px-3 text-xs text-white hover:bg-orange-600" data-pcs-project-detail-action="quick-pass">
            <i data-lucide="check-circle-2" class="mr-1 h-3.5 w-3.5"></i>通过 - 推进至工程准备
          </button>
        </div>
      </div>
    </section>
  `
}

function renderDecisionDialog(): string {
  if (!state.showDecisionDialog) return ''
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-xl rounded-lg border bg-background shadow-2xl">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">测款结论判定</h3>
          <p class="mt-1 text-xs text-muted-foreground">请根据测款数据做出决策，结论将影响后续工作项解锁状态。</p>
        </header>
        <div class="space-y-3 p-4">
          <button class="${toClassName('w-full rounded-lg border p-3 text-left hover:bg-muted/40', state.decisionValue === 'pass' && 'border-blue-300 bg-blue-50')}" data-pcs-project-detail-action="set-decision" data-decision-value="pass">
            <p class="font-medium">通过</p>
            <p class="text-xs text-muted-foreground">解锁工程准备（转档、制版、打样）</p>
          </button>
          <button class="${toClassName('w-full rounded-lg border p-3 text-left hover:bg-muted/40', state.decisionValue === 'revision' && 'border-blue-300 bg-blue-50')}" data-pcs-project-detail-action="set-decision" data-decision-value="revision">
            <p class="font-medium">改版</p>
            <p class="text-xs text-muted-foreground">生成改版任务，改版后重新测款</p>
          </button>
          <button class="${toClassName('w-full rounded-lg border p-3 text-left hover:bg-muted/40', state.decisionValue === 'reject' && 'border-blue-300 bg-blue-50')}" data-pcs-project-detail-action="set-decision" data-decision-value="reject">
            <p class="font-medium">淘汰</p>
            <p class="text-xs text-muted-foreground">终止项目，样衣进入退货处理</p>
          </button>

          <div>
            <label class="mb-1 block text-xs text-muted-foreground">决策备注</label>
            <textarea class="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请输入决策说明..." data-pcs-project-detail-field="decisionNote">${escapeHtml(state.decisionNote)}</textarea>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pcs-project-detail-action="close-decision-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-blue-300 px-3 text-sm text-blue-700 hover:bg-blue-50 ${state.decisionValue ? '' : 'cursor-not-allowed opacity-60'}" data-pcs-project-detail-action="submit-decision" ${state.decisionValue ? '' : 'disabled'}>提交决策</button>
        </footer>
      </section>
    </div>
  `
}

export function renderPcsProjectDetailPage(projectId: string): string {
  ensureProjectState(projectId)
  const data = state.data
  if (!data) {
    return renderNotFound(projectId)
  }

  return `
    <div class="space-y-4">
      ${renderHeader(data)}
      ${renderNotice()}
      <section class="flex flex-col gap-4 xl:flex-row">
        ${renderPhaseNavigator(data)}
        <div class="min-w-0 flex-1">${renderWorkItemPanel(data)}</div>
        ${renderTimeline(data)}
      </section>
      ${renderGateBar(data)}
      ${renderDecisionDialog()}
    </div>
  `
}

function nowText(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function closeAllDialogs(): void {
  if (state.showDecisionDialog) {
    state.showDecisionDialog = false
    return
  }
}

function applyDecisionResult(decision: DecisionValue): void {
  const data = state.data
  if (!data || !decision) return

  const currentPhase = data.phases.find((phase) => phase.id === data.project.currentPhaseId)
  if (!currentPhase) return

  const pendingId =
    state.selectedWorkItemId &&
    data.workItems[state.selectedWorkItemId]?.status === '待决策'
      ? state.selectedWorkItemId
      : currentPhase.items.find((itemId) => data.workItems[itemId]?.status === '待决策') ?? null

  if (!pendingId) return

  const pendingItem = data.workItems[pendingId]
  pendingItem.updatedAt = nowText()

  if (decision === 'pass') {
    pendingItem.status = '已完成'
    pendingItem.summary.keyOutputs = [
      { label: '决策结果', value: '通过' },
      { label: '放行范围', value: '工程准备工作项已解锁' },
      { label: '备注', value: state.decisionNote.trim() || '推进至工程准备' },
    ]

    ;['wi_13', 'wi_14', 'wi_15', 'wi_16', 'wi_17', 'wi_18', 'wi_19'].forEach((itemId, index) => {
      const item = data.workItems[itemId]
      if (!item) return
      item.status = index === 0 ? '进行中' : '未开始'
      item.updatedAt = nowText()
    })

    data.project.currentPhaseId = 'phase_04'
    data.project.phaseName = '结论与推进'
    data.project.lastUpdated = nowText()
    data.logs.unshift({
      time: nowText(),
      type: '决策',
      title: '决策：测款结论判定',
      detail: '通过，已推进至工程准备并解锁后续工作项。',
    })
    state.notice = '决策已提交：通过，后续工程准备工作项已解锁。'
    return
  }

  if (decision === 'revision') {
    pendingItem.status = '进行中'
    pendingItem.summary.keyOutputs = [
      { label: '决策结果', value: '改版' },
      { label: '后续动作', value: '生成改版任务并重新测款' },
      { label: '备注', value: state.decisionNote.trim() || '进入改版闭环' },
    ]
    pendingItem.updatedAt = nowText()
    data.project.lastUpdated = nowText()
    data.logs.unshift({
      time: nowText(),
      type: '决策',
      title: '决策：测款结论判定',
      detail: '改版，已回流改版任务。',
    })
    state.notice = '决策已提交：改版，项目进入改版回流。'
    return
  }

  pendingItem.status = '已完成'
  pendingItem.summary.keyOutputs = [
    { label: '决策结果', value: '淘汰' },
    { label: '后续动作', value: '项目终止，样衣进入退货处理' },
    { label: '备注', value: state.decisionNote.trim() || '终止项目' },
  ]
  ;['wi_20', 'wi_21'].forEach((itemId) => {
    const item = data.workItems[itemId]
    if (!item) return
    item.status = itemId === 'wi_21' ? '进行中' : '未开始'
    item.updatedAt = nowText()
  })
  data.project.status = '已终止'
  data.project.currentPhaseId = 'phase_05'
  data.project.phaseName = '资产处置'
  data.project.lastUpdated = nowText()
  data.logs.unshift({
    time: nowText(),
    type: '决策',
    title: '决策：测款结论判定',
    detail: '淘汰，项目终止并进入资产处置。',
  })
  state.notice = '决策已提交：淘汰，项目已终止并进入资产处置。'
}

export function handlePcsProjectDetailEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-project-detail-field]')
  if (fieldNode instanceof HTMLTextAreaElement && fieldNode.dataset.pcsProjectDetailField === 'decisionNote') {
    state.decisionNote = fieldNode.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pcs-project-detail-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsProjectDetailAction
  if (!action) return false

  if (action === 'go-list') {
    appStore.navigate('/pcs/projects')
    return true
  }

  if (action === 'toggle-phase') {
    const phaseId = actionNode.dataset.phaseId
    if (!phaseId) return true
    if (state.expandedPhases.includes(phaseId)) {
      state.expandedPhases = state.expandedPhases.filter((id) => id !== phaseId)
    } else {
      state.expandedPhases = [...state.expandedPhases, phaseId]
    }
    return true
  }

  if (action === 'select-work-item') {
    const workItemId = actionNode.dataset.workItemId
    if (workItemId) state.selectedWorkItemId = workItemId
    return true
  }

  if (action === 'open-decision-dialog') {
    state.showDecisionDialog = true
    return true
  }

  if (action === 'close-decision-dialog') {
    state.showDecisionDialog = false
    return true
  }

  if (action === 'set-decision') {
    const value = actionNode.dataset.decisionValue as DecisionValue | undefined
    if (value) state.decisionValue = value
    return true
  }

  if (action === 'submit-decision') {
    if (!state.decisionValue) return true
    applyDecisionResult(state.decisionValue)
    state.showDecisionDialog = false
    state.decisionValue = ''
    state.decisionNote = ''
    return true
  }

  if (action === 'quick-pass') {
    applyDecisionResult('pass')
    return true
  }

  if (action === 'quick-reject') {
    applyDecisionResult('reject')
    return true
  }

  if (action === 'mark-complete') {
    const workItemId = actionNode.dataset.workItemId
    if (!workItemId || !state.data) return true
    const item = state.data.workItems[workItemId]
    if (!item || item.status !== '进行中') return true
    item.status = '已完成'
    item.updatedAt = nowText()
    state.data.project.lastUpdated = nowText()
    state.notice = `工作项 ${item.name} 已标记完成（演示态）。`
    return true
  }

  if (action === 'go-work-item-detail') {
    const workItemId = actionNode.dataset.workItemId
    if (!workItemId || !state.projectId) return true
    appStore.navigate(`/pcs/projects/${state.projectId}/work-items/${workItemId}`)
    return true
  }

  if (action === 'add-record') {
    state.notice = '新增记录入口已触发（演示态）。'
    return true
  }

  if (action === 'more-actions') {
    state.notice = '更多操作菜单待接入（演示态）。'
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  return false
}

export function isPcsProjectDetailDialogOpen(): boolean {
  return state.showDecisionDialog
}
