import type { FeedbackComment, FeedbackTheme } from './types.ts'
import type { FeedbackDetailItem, FeedbackDetailRule } from './phase3-types.ts'

export const FEEDBACK_DETAIL_RULE_VERSION = 'P3-V1.1'
const group = (theme: FeedbackTheme, values: Array<[string, string, '问题' | '正向']>): FeedbackDetailRule[] => values.map(([id, label, sentiment]) => ({ id, label, sentiment, theme, definition: `买家明确表达“${label}”，需保存对应原句或图片及语境`, exclude: '未提及、否定、仅评分或不能确定含义时不选择；不推断根因与责任', example: `原文明确提到${label}，且与本次购买商品有关` }))
export const FEEDBACK_DETAIL_RULES: FeedbackDetailRule[] = [
  ...group('面料与穿着', [['fabric-thin','厚度偏薄','问题'],['fabric-thick','厚度偏厚','问题'],['fabric-sheer','透感不符','问题'],['fabric-hot','透气性差','问题'],['fabric-feel','手感不适','问题'],['fabric-shrink','洗后缩水','问题'],['fabric-pill','起球','问题'],['fabric-soft','手感柔软','正向'],['fabric-comfort','穿着舒适','正向'],['fabric-air','透气性好','正向']]),
  ...group('做工与质量', [['zip-stuck','拉链卡顿','问题'],['seam-loose','缝线脱线','问题'],['button-loose','纽扣松脱','问题'],['quality-damage','破损','问题'],['quality-stain','污渍','问题'],['quality-neat','做工整齐','正向']]),
  ...group('尺码与版型', [['chest-small','胸围偏小','问题'],['chest-large','胸围偏大','问题'],['waist-small','腰围偏小','问题'],['waist-large','腰围偏大','问题'],['length-short','衣长偏短','问题'],['length-long','衣长偏长','问题'],['trouser-short','裤长偏短','问题'],['trouser-long','裤长偏长','问题'],['fit-good','整体合身','正向']]),
  ...group('颜色与外观', [['color-diff','色差','问题'],['color-fade','褪色','问题'],['color-nice','颜色好看','正向'],['pattern-nice','图案好看','正向']]),
  ...group('展示与预期', [['photo-diff','与图片不符','问题'],['material-diff','与材质描述不符','问题'],['size-description','与尺寸说明不符','问题'],['display-match','与展示一致','正向']]),
  ...group('发货与物流', [['wrong-style','错款','问题'],['wrong-color','错色','问题'],['wrong-size','错码','问题'],['missing-pieces','少件','问题'],['delivery-damage','到货损坏','问题'],['delivery-slow','到货慢','问题'],['delivery-fast','配送及时','正向']]),
  ...group('使用与价值', [['value-price','价格不符预期','问题'],['use-scene','适合特定场景','正向'],['use-match','搭配方便','正向'],['use-again','愿意复购','正向']]),
]
export const detailRule = (id: string) => FEEDBACK_DETAIL_RULES.find(r => r.id === id)
/** Candidates aid reading only. Negation is never turned into a confirmed problem. */
export function fixedDetailSuggestions(c: FeedbackComment): FeedbackDetailItem[] {
  const text = c.raw.content
  const pairs: Array<[string, RegExp]> = [['fabric-thin',/太薄|偏薄|terlalu tipis|tipis.*(?:kurang cocok|untuk saya)/i],['fabric-thick',/太厚|偏厚|terlalu tebal/i],['fabric-sheer',/有些透|透感不符|(?<!tidak )transparan/i],['fabric-shrink',/缩水|menyusut/i],['fabric-soft',/柔软|lembut/i],['fabric-comfort',/舒服|舒适|nyaman/i],['zip-stuck',/拉链卡顿|resleting macet/i],['seam-loose',/脱线|缝线脱开|jahitan lepas/i],['waist-small',/腰围偏小|pinggang terlalu kecil/i],['color-nice',/颜色好看/i],['use-scene',/适合通勤/i],['delivery-slow',/物流等待较久|到货慢/i],['fit-good',/合身/i],['photo-diff',/与照片不太一致|与图片不符|tidak seperti foto/i]]
  return pairs.flatMap(([ruleId, regex]) => { const match = text.match(regex); return match ? [{ ruleId, evidence: match[0], basis: '原文' as const, translationId: '', note: '' }] : [] })
}
