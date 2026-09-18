import { getPmsBomTemplate, listPmsBomLogs, publishPmsBomTemplate, type PmsBomLog } from './bom-templates.ts'
import { appendPmsLog, PmsDomainError, roundPmsQty, type PmsActorRole } from './runtime.ts'

export type PmsBomSampleStatus = '未打样' | '打样中' | '已确认'

export type PmsBomOptionKind = 'radio' | 'checkbox' | 'enum'

export interface PmsBomOption {
  key: string
  label: string
  kind: PmsBomOptionKind
  value: string
  selected: boolean
  choices?: string[]
}

export const PMS_BOM_DEVELOPMENT_STATUSES = ['待打板', '打板中', '已完成'] as const
export const PMS_BOM_REVIEW_STATUSES = ['待审核', '已通过', '已驳回'] as const
export const PMS_BOM_PRODUCTION_MODES = ['工厂生产', '外采成衣', '样衣开发'] as const
export const PMS_BOM_TRANSPORT_MODES = ['国内快递', '物流专线', '工厂送货'] as const

export interface PmsBomDetail {
  spu: string
  season: string
  category: string
  factoryName: string
  factoryContact: string
  factoryPhone: string
  factoryAddress: string
  paymentTerms: string
  factoryLeadTimeDays: number
  standardCost: number
  quotePrice: number
  suggestedPrice: number
  pieceWeight: number
  unitCost: number
  totalCost: number
  purchasePrice: number
  freightCost: number
  packagingCost: number
  targetGrossMargin: number
  mainFabric: string
  mainAccessory: string
  printType: string
  embroideryType: string
  colorCount: number
  currency: 'RMB'
  priceUpdatedAt: string
  craftRoute: string[]
  craftNotes: string
  description: string
  packagingNotes: string
  qualityNotes: string
  sampleStatus: PmsBomSampleStatus
  options: PmsBomOption[]
  updatedBy: string
  updatedAt: string
}

interface PmsBomDetailRuntime {
  details: Map<string, PmsBomDetail>
}

let runtime: PmsBomDetailRuntime | null = null

const factoryExtras: Record<string, { phone: string; address: string; paymentTerms: string }> = {
  'HG-TS-2601': { phone: '13800138010', address: '广州市白云区太和镇工业园 18 号', paymentTerms: '月结 30 天' },
  'HG-PT-2602': { phone: '13800138011', address: '佛山市南海区狮山镇纺织路 6 号', paymentTerms: '月结 30 天' },
  'HG-HD-2603': { phone: '13800138012', address: '中山市沙溪镇服装工业区 22 号', paymentTerms: '预付 30% 尾款月结' },
  'HG-JK-2605': { phone: '13800138013', address: '苏州市吴中区临湖镇工业园 9 号', paymentTerms: '月结 45 天' },
  'HG-SH-2607': { phone: '13800138014', address: '宁波市海曙区望春工业园区 3 号', paymentTerms: '月结 30 天' },
  'HG-SK-2604': { phone: '13800138015', address: '杭州市余杭区乔司街道服装园 11 号', paymentTerms: '月结 30 天' },
  'HG-GAR-2601': { phone: '13800138011', address: '佛山市南海区狮山镇纺织路 6 号', paymentTerms: '款到发货' },
  'HG-SAM-2601': { phone: '13800138016', address: '杭州市临平区样衣开发中心 2 号', paymentTerms: '样衣确认后月结' },
}

const materialExtras: Record<string, { mainFabric: string; mainAccessory: string; printType: string; embroideryType: string; colorCount: number }> = {
  'HG-TS-2601': { mainFabric: '180g 纯棉针织布', mainAccessory: '白色织唛', printType: '水浆印', embroideryType: '无', colorCount: 2 },
  'HG-PT-2602': { mainFabric: '220g 涤棉卫衣布', mainAccessory: 'YKK 5号尼龙拉链', printType: '无', embroideryType: '无', colorCount: 1 },
  'HG-HD-2603': { mainFabric: '220g 涤棉卫衣布', mainAccessory: '白色织唛', printType: '胶浆印', embroideryType: '平绣', colorCount: 2 },
  'HG-JK-2605': { mainFabric: '涤纶绗缝布', mainAccessory: 'YKK 5号尼龙拉链', printType: '无', embroideryType: '无', colorCount: 1 },
  'HG-SH-2607': { mainFabric: '白色府绸', mainAccessory: '黑色四眼纽扣', printType: '无', embroideryType: '无', colorCount: 1 },
  'HG-SK-2604': { mainFabric: '180g 纯棉针织布', mainAccessory: 'YKK 5号尼龙拉链', printType: '无', embroideryType: '无', colorCount: 1 },
  'HG-GAR-2601': { mainFabric: '', mainAccessory: '', printType: '无', embroideryType: '无', colorCount: 1 },
  'HG-SAM-2601': { mainFabric: '180g 纯棉针织布', mainAccessory: '白色织唛', printType: '无', embroideryType: '无', colorCount: 1 },
}

const pieceWeights: Record<string, number> = { T恤: 0.22, 休闲裤: 0.45, 卫衣: 0.52, 夹克: 0.6, 衬衫: 0.28, 连衣裙: 0.4, 成衣采购: 0.45, 样衣: 0.24 }

function buildOptions(spu: string, sampleStatus: PmsBomSampleStatus): PmsBomOption[] {
  const isDirectPurchase = spu === 'HG-GAR-2601'
  const isSample = spu === 'HG-SAM-2601'
  return [
    { key: 'sample', label: '是否打样', kind: 'radio', value: sampleStatus === '未打样' ? '否' : '是', selected: true },
    { key: 'pattern', label: '是否开版', kind: 'radio', value: isDirectPurchase || isSample ? '否' : '是', selected: true },
    { key: 'print', label: '需要印花', kind: 'checkbox', value: spu === 'HG-TS-2601' ? '是' : '否', selected: spu === 'HG-TS-2601' },
    { key: 'embroidery', label: '需要绣花', kind: 'checkbox', value: spu === 'HG-HD-2603' ? '是' : '否', selected: spu === 'HG-HD-2603' },
    { key: 'developmentStatus', label: '开发状态', kind: 'enum', value: spu === 'HG-JK-2605' || spu === 'HG-HD-2603' ? '打板中' : '已完成', selected: true, choices: [...PMS_BOM_DEVELOPMENT_STATUSES] },
    { key: 'reviewStatus', label: '审核状态', kind: 'enum', value: spu === 'HG-JK-2605' ? '待审核' : '已通过', selected: true, choices: [...PMS_BOM_REVIEW_STATUSES] },
    { key: 'productionMode', label: '生产方式', kind: 'enum', value: isDirectPurchase ? '外采成衣' : isSample ? '样衣开发' : '工厂生产', selected: true, choices: [...PMS_BOM_PRODUCTION_MODES] },
    { key: 'transportMode', label: '运输方式', kind: 'enum', value: isDirectPurchase ? '工厂送货' : '物流专线', selected: true, choices: [...PMS_BOM_TRANSPORT_MODES] },
  ]
}

function buildInitialDetails(): Map<string, PmsBomDetail> {
  const base: Array<[string, Partial<PmsBomDetail>]> = [
    ['HG-TS-2601', { season: '2026 春夏', category: 'T恤', factoryName: '广州华盛制衣有限公司', factoryContact: '李经理 13800138010', factoryLeadTimeDays: 22, standardCost: 28.6, quotePrice: 31.5, craftRoute: ['裁剪', '车缝', '锁眼钉扣', '整烫', '包装'], craftNotes: '领口罗纹双层车缝，肩部加定型条', description: '男款圆领T恤，180g 纯棉针织布，常规版型，白色与黑色两色。', sampleStatus: '已确认' }],
    ['HG-PT-2602', { season: '2026 春夏', category: '休闲裤', factoryName: '佛山成衣加工厂', factoryContact: '陈经理 13800138011', factoryLeadTimeDays: 26, standardCost: 52.4, quotePrice: 58.6, craftRoute: ['裁剪', '车缝', '锁边', '整烫', '包装'], craftNotes: '腰部松紧带加抽绳，裤脚两道线', description: '女款休闲裤，220g 涤棉卫衣布，直筒版型。', sampleStatus: '已确认' }],
    ['HG-HD-2603', { season: '2026 秋冬', category: '卫衣', factoryName: '中山针织制衣有限公司', factoryContact: '黄经理 13800138012', factoryLeadTimeDays: 28, standardCost: 78.2, quotePrice: 86.2, craftRoute: ['裁剪', '车缝', '帽子拼接', '整烫', '包装'], craftNotes: '帽口双层，袋鼠口袋加固', description: '连帽卫衣，220g 涤棉卫衣布，灰色与藏青两色。', sampleStatus: '打样中' }],
    ['HG-JK-2605', { season: '2026 秋冬', category: '夹克', factoryName: '苏州户外服饰有限公司', factoryContact: '周经理 13800138013', factoryLeadTimeDays: 30, standardCost: 101.5, quotePrice: 112, craftRoute: ['裁剪', '车缝', '压胶', '整烫', '包装'], craftNotes: '前中拉链压胶，袖口魔术贴', description: '轻薄夹克，BOM 尚未匹配，暂不能生成面辅料需求。', sampleStatus: '未打样' }],
    ['HG-SH-2607', { season: '2026 春夏', category: '衬衫', factoryName: '宁波衬衫制造有限公司', factoryContact: '王经理 13800138014', factoryLeadTimeDays: 24, standardCost: 43.8, quotePrice: 49, craftRoute: ['裁剪', '车缝', '锁眼钉扣', '整烫', '包装'], craftNotes: '门襟双线，袖口一粒扣', description: '商务衬衫，白色府绸面料，修身版型。', sampleStatus: '已确认' }],
    ['HG-SK-2604', { season: '2026 春夏', category: '连衣裙', factoryName: '杭州女装制衣有限公司', factoryContact: '孙经理 13800138015', factoryLeadTimeDays: 27, standardCost: 86.5, quotePrice: 96, craftRoute: ['裁剪', '车缝', '装拉链', '整烫', '包装'], craftNotes: '后中隐形拉链，腰省定型', description: '女款连衣裙，裙长及膝，藏青色。', sampleStatus: '已确认' }],
    ['HG-GAR-2601', { season: '2026 春夏', category: '成衣采购', factoryName: '佛山成衣加工厂', factoryContact: '陈经理 13800138011', factoryLeadTimeDays: 25, standardCost: 108, quotePrice: 120, craftRoute: ['成衣验收', '整烫', '包装'], craftNotes: '成衣直采，不做 BOM 拆解', description: '女款休闲裤成衣直采，供应商按成品交付。', sampleStatus: '已确认' }],
    ['HG-SAM-2601', { season: '2026 春夏', category: '样衣', factoryName: '杭州样衣开发中心', factoryContact: '赵经理 13800138016', factoryLeadTimeDays: 20, standardCost: 240, quotePrice: 260, craftRoute: ['样衣打版', '样衣车缝', '样衣确认'], craftNotes: '样衣开发，单件制作', description: '男款圆领T恤样衣，用于首单确认。', sampleStatus: '已确认' }],
  ]
  const details = new Map<string, PmsBomDetail>()
  base.forEach(([spu, patch]) => {
    const factory = factoryExtras[spu] ?? { phone: '', address: '', paymentTerms: '' }
    const material = materialExtras[spu] ?? { mainFabric: '', mainAccessory: '', printType: '', embroideryType: '', colorCount: 0 }
    const standardCost = patch.standardCost ?? 0
    const quotePrice = patch.quotePrice ?? 0
    const freightCost = 2.4
    const packagingCost = 1.2
    const sampleStatus = patch.sampleStatus ?? '未打样'
    details.set(spu, {
      spu,
      season: patch.season ?? '2026',
      category: patch.category ?? '服装',
      factoryName: patch.factoryName ?? '',
      factoryContact: patch.factoryContact ?? '',
      factoryPhone: factory.phone,
      factoryAddress: factory.address,
      paymentTerms: factory.paymentTerms,
      factoryLeadTimeDays: patch.factoryLeadTimeDays ?? 20,
      standardCost,
      quotePrice,
      suggestedPrice: roundPmsQty(quotePrice * 1.25, 2),
      pieceWeight: pieceWeights[patch.category ?? ''] ?? 0.3,
      unitCost: standardCost,
      totalCost: roundPmsQty(standardCost + freightCost + packagingCost, 2),
      purchasePrice: roundPmsQty(standardCost * 0.92, 2),
      freightCost,
      packagingCost,
      targetGrossMargin: 30,
      mainFabric: material.mainFabric,
      mainAccessory: material.mainAccessory,
      printType: material.printType,
      embroideryType: material.embroideryType,
      colorCount: material.colorCount,
      currency: 'RMB',
      priceUpdatedAt: '2026-05-20 10:00:00',
      craftRoute: patch.craftRoute ?? [],
      craftNotes: patch.craftNotes ?? '',
      description: patch.description ?? '',
      packagingNotes: patch.category === '成衣采购' ? '成衣折叠入袋，按箱规装箱' : '独立胶袋 + 吊牌，按色码装箱',
      qualityNotes: '按 AQL 2.5 抽检，首件确认后量产',
      sampleStatus,
      options: buildOptions(spu, sampleStatus),
      updatedBy: '商品中心同步任务',
      updatedAt: '2026-05-20 10:00:00',
    })
  })
  return details
}

function getRuntime(): PmsBomDetailRuntime {
  if (!runtime) runtime = { details: buildInitialDetails() }
  return runtime
}

export function getPmsBomDetail(spu: string): PmsBomDetail | undefined {
  return getRuntime().details.get(spu)
}

export interface PmsBomDetailPatch {
  description?: string
  craftNotes?: string
  packagingNotes?: string
  qualityNotes?: string
  factoryName?: string
  factoryContact?: string
  factoryPhone?: string
  factoryAddress?: string
  factoryLeadTimeDays?: number
  paymentTerms?: string
  quotePrice?: number
  suggestedPrice?: number
  pieceWeight?: number
  unitCost?: number
  purchasePrice?: number
  freightCost?: number
  packagingCost?: number
  targetGrossMargin?: number
  mainFabric?: string
  mainAccessory?: string
  printType?: string
  embroideryType?: string
  colorCount?: number
  options?: PmsBomOption[]
}

function requireNonNegativeAmount(value: number, message: string, code: string): number {
  if (!Number.isFinite(value) || value < 0) throw new PmsDomainError(code, message)
  return roundPmsQty(value, 2)
}

function validatePmsBomOptions(options: PmsBomOption[]): void {
  if (options.length === 0) throw new PmsDomainError('BOM_OPTION_EMPTY', '业务选项不能为空')
  options.forEach((option) => {
    const label = option.label?.trim()
    if (!label) throw new PmsDomainError('BOM_OPTION_LABEL_REQUIRED', '业务选项名称不能为空')
    if (option.kind === 'enum') {
      const choices = option.choices ?? []
      if (choices.length === 0) throw new PmsDomainError('BOM_OPTION_CHOICES_REQUIRED', `业务选项「${label}」缺少可选值`)
      if (!choices.includes(option.value)) throw new PmsDomainError('BOM_OPTION_VALUE_INVALID', `业务选项「${label}」的取值「${option.value}」不在允许范围`)
      return
    }
    if (option.value !== '是' && option.value !== '否') throw new PmsDomainError('BOM_OPTION_VALUE_INVALID', `业务选项「${label}」的取值必须是「是」或「否」`)
  })
}

export function updatePmsBomDetail(spu: string, patch: PmsBomDetailPatch, actor: { id: string; name: string; role: PmsActorRole }): PmsBomDetail {
  const detail = getPmsBomDetail(spu)
  if (!detail) throw new PmsDomainError('BOM_DETAIL_NOT_FOUND', `样板详情 ${spu} 不存在`)
  if (patch.description !== undefined) detail.description = patch.description.trim()
  if (patch.craftNotes !== undefined) detail.craftNotes = patch.craftNotes.trim()
  if (patch.packagingNotes !== undefined) detail.packagingNotes = patch.packagingNotes.trim()
  if (patch.qualityNotes !== undefined) detail.qualityNotes = patch.qualityNotes.trim()
  if (patch.factoryName !== undefined) {
    if (!patch.factoryName.trim()) throw new PmsDomainError('BOM_FACTORY_REQUIRED', '生产工厂不能为空')
    detail.factoryName = patch.factoryName.trim()
  }
  if (patch.factoryContact !== undefined) detail.factoryContact = patch.factoryContact.trim()
  if (patch.factoryPhone !== undefined) detail.factoryPhone = patch.factoryPhone.trim()
  if (patch.factoryAddress !== undefined) detail.factoryAddress = patch.factoryAddress.trim()
  if (patch.factoryLeadTimeDays !== undefined) {
    if (!Number.isInteger(patch.factoryLeadTimeDays) || patch.factoryLeadTimeDays <= 0) throw new PmsDomainError('BOM_LEAD_TIME_INVALID', '生产周期必须是大于 0 的天数')
    detail.factoryLeadTimeDays = patch.factoryLeadTimeDays
  }
  if (patch.paymentTerms !== undefined) detail.paymentTerms = patch.paymentTerms.trim()
  if (patch.quotePrice !== undefined) {
    detail.quotePrice = requireNonNegativeAmount(patch.quotePrice, '报价不能为负数', 'BOM_PRICE_INVALID')
    detail.priceUpdatedAt = new Date().toISOString()
  }
  if (patch.suggestedPrice !== undefined) detail.suggestedPrice = requireNonNegativeAmount(patch.suggestedPrice, '建议售价不能为负数', 'BOM_SUGGESTED_PRICE_INVALID')
  if (patch.pieceWeight !== undefined) {
    if (!Number.isFinite(patch.pieceWeight) || patch.pieceWeight <= 0) throw new PmsDomainError('BOM_PIECE_WEIGHT_INVALID', '单件重量必须是大于 0 的数字')
    detail.pieceWeight = roundPmsQty(patch.pieceWeight, 4)
  }
  if (patch.unitCost !== undefined) detail.unitCost = requireNonNegativeAmount(patch.unitCost, '单位成本不能为负数', 'BOM_UNIT_COST_INVALID')
  if (patch.purchasePrice !== undefined) detail.purchasePrice = requireNonNegativeAmount(patch.purchasePrice, '采购价不能为负数', 'BOM_PURCHASE_PRICE_INVALID')
  if (patch.freightCost !== undefined) detail.freightCost = requireNonNegativeAmount(patch.freightCost, '运费不能为负数', 'BOM_FREIGHT_INVALID')
  if (patch.packagingCost !== undefined) detail.packagingCost = requireNonNegativeAmount(patch.packagingCost, '包装费不能为负数', 'BOM_PACKAGING_INVALID')
  if (patch.targetGrossMargin !== undefined) {
    if (!Number.isFinite(patch.targetGrossMargin) || patch.targetGrossMargin < 0) throw new PmsDomainError('BOM_MARGIN_INVALID', '目标毛利率不能为负数')
    detail.targetGrossMargin = roundPmsQty(patch.targetGrossMargin, 2)
  }
  if (patch.mainFabric !== undefined) detail.mainFabric = patch.mainFabric.trim()
  if (patch.mainAccessory !== undefined) detail.mainAccessory = patch.mainAccessory.trim()
  if (patch.printType !== undefined) detail.printType = patch.printType.trim()
  if (patch.embroideryType !== undefined) detail.embroideryType = patch.embroideryType.trim()
  if (patch.colorCount !== undefined) {
    if (!Number.isInteger(patch.colorCount) || patch.colorCount < 0) throw new PmsDomainError('BOM_COLOR_COUNT_INVALID', '颜色数量必须是大于等于 0 的整数')
    detail.colorCount = patch.colorCount
  }
  if (patch.options !== undefined) {
    validatePmsBomOptions(patch.options)
    detail.options = patch.options
  }
  detail.totalCost = roundPmsQty(detail.unitCost + detail.freightCost + detail.packagingCost, 2)
  detail.updatedBy = actor.name
  detail.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'bom-template', objectId: spu, action: '保存样板详情', beforeValue: `${spu} 原总成本 ${detail.standardCost}`, afterValue: `总成本 ${detail.totalCost} · 目标毛利率 ${detail.targetGrossMargin}%`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return detail
}

export function submitPmsBomTemplate(spu: string, actor: { id: string; name: string; role: PmsActorRole }): { templateStatus: string; updatedAt: string } {
  const template = getPmsBomTemplate(spu)
  if (!template) throw new PmsDomainError('BOM_NOT_FOUND', `BOM 模板 ${spu} 不存在`)
  if (template.materials.length === 0) throw new PmsDomainError('BOM_MATERIAL_EMPTY', 'BOM 没有物料明细，不能提交')
  publishPmsBomTemplate(spu, actor)
  const detail = getPmsBomDetail(spu)
  if (detail) {
    detail.updatedBy = actor.name
    detail.updatedAt = new Date().toISOString()
  }
  appendPmsLog({ objectType: 'bom-template', objectId: spu, action: '提交 BOM', beforeValue: '草稿/未匹配', afterValue: '已发布', reason: '样板详情提交', actorId: actor.id, actorName: actor.name, actorRole: actor.role, secondConfirmation: true })
  return { templateStatus: '已发布', updatedAt: new Date().toISOString() }
}

export function listPmsBomActionLogs(spu: string): PmsBomLog[] {
  return listPmsBomLogs(spu)
}
