import type { MaterialProcessDraft, MaterialProcessType, MaterialUnitRelation, MaterialPackageSpec } from './pcs-material-archive-types.ts'
import { listMaterialUnitDefinitions } from './pcs-material-config.ts'

export const MATERIAL_CODE_RULE_VERSION = 'MATERIAL-R1-20261005'
export const MATERIAL_PROCESS_LABELS: Record<MaterialProcessType | 'BASE', string> = {
  BASE: '基础', DYEING: '染后', PRINTING: '印后', EMBROIDERY: '绣后', HEAT_TRANSFER: '烫画后',
}
export const MATERIAL_PROCESS_NAMES: Record<MaterialProcessType, string> = {
  DYEING: '染色', PRINTING: '印花', EMBROIDERY: '绣花', HEAT_TRANSFER: '烫画',
}
export function materialCodeSegment(value: string, label = '编码段'): string {
  const token = value.trim().replace(/\s+/g, '-').replace(/-+/g, '-')
  if (!token || !/^[\p{L}\p{N}_-]+$/u.test(token)) throw new Error(`${label}只能包含文字、数字、短横线或下划线。`)
  return token
}
export function checkedMaterialCode(code: string): string {
  if (code.length > 256) throw new Error('物料编码超过 256 个字符，请调整本次构成；不会截断编码。')
  return code
}
export function buildProcessedMaterialCode(predecessorCode: string, draft: MaterialProcessDraft): string {
  const parent = materialCodeSegment(predecessorCode, '投入 SKU 编码')
  if (draft.objectType && draft.objectType !== 'MATERIAL') throw new Error('裁片、毛织部位和成衣加工请进入技术/生产对象，不新建物料 SKU。')
  let segment = ''
  if (draft.processType === 'DYEING') {
    if (!draft.pantoneSystem?.trim() || !draft.pantoneCode?.trim()) throw new Error('染色必须明确 Pantone 体系和色号。')
    const system = materialCodeSegment(draft.pantoneSystem.toUpperCase(), 'Pantone 体系')
    const pantone = materialCodeSegment(draft.pantoneCode.replace(/PT$/i, ''), 'Pantone 色号')
    segment = `${materialCodeSegment(draft.colorCode || '', '颜色编码')}-${system === 'TCX' ? '' : `${system}-`}${pantone}PT`
  } else {
    const pattern = materialCodeSegment(draft.patternCode || '', '花型编号')
    const revision = draft.deliveryRevisionSegment?.trim().toUpperCase() || ''
    if (revision && !/^R\d{2,}$/.test(revision)) throw new Error('交付修订段请使用 R02 等格式；资料纠错不增加编码段。')
    const front = `${pattern}${revision}`
    if (draft.processType === 'PRINTING') {
      if (!['A', 'AB'].includes(draft.printSide || '')) throw new Error('印花必须选择单面 A 或双面 AB。')
      if (draft.printSide === 'AB' && !draft.backPatternCode?.trim()) throw new Error('双面印必须明确反面花型；同花也需确认。')
      const back = draft.backPatternCode ? materialCodeSegment(draft.backPatternCode, '反面花型编号') : ''
      const patternPart = draft.printSide === 'AB' && back !== pattern ? `F${front}-B${back}` : front
      segment = `${patternPart}-${draft.printSide}${draft.penetration ? '-ST' : ''}YH`
    } else if (draft.processType === 'EMBROIDERY') segment = `${front}XH`
    else if (draft.processType === 'HEAT_TRANSFER') segment = `${front}TH`
    else throw new Error('本期物料身份工艺仅支持染色、印花、绣花、烫画。')
  }
  return checkedMaterialCode(`${parent}-${segment}`)
}
export function canonicalMaterialUnit(unit: string): string {
  const map: Record<string, string> = { '米': 'M', 'm': 'M', '码': 'Yard', 'yard': 'Yard', '公斤': 'KG', 'kg': 'KG', '千克': 'KG', 'pcs': 'PCS' }
  return map[unit.trim()] || unit.trim()
}
export function materialUnitDimension(unit: string): string {
  const value = canonicalMaterialUnit(unit)
  const configured = listMaterialUnitDefinitions().find(item => item.code === value || item.aliases?.includes(unit))
  if (configured) return { length: '长度', mass: '重量', area: '面积', count: '计数', package: '包装', volume: '体积' }[configured.dimension]
  if (['M', 'Yard', 'cm', 'mm'].includes(value)) return '长度'
  if (['KG', 'g'].includes(value)) return '重量'
  if (['PCS', '件', '套', '粒', '条', '片', 'Pair'].includes(value)) return '计数'
  if (['包', '箱', '盒', '卷', '筒', '瓶', 'Bunch', 'DZ'].includes(value)) return '包装'
  if (['L', 'ml'].includes(value)) return '体积'
  return '待明确'
}
export function fixedMaterialFactor(aux: string, main: string): number | null {
  const scales: Record<string, number> = { M: 1, Yard: .9144, cm: .01, mm: .001, KG: 1, g: .001 }
  const a = canonicalMaterialUnit(aux), m = canonicalMaterialUnit(main)
  if (a === m) return 1
  return scales[a] && scales[m] && materialUnitDimension(a) === materialUnitDimension(m) ? scales[a] / scales[m] : null
}
export function validateMaterialRelation(mainUnit: string, relation: MaterialUnitRelation): void {
  if (canonicalMaterialUnit(relation.auxUnitId) === canonicalMaterialUnit(mainUnit)) throw new Error('主单位无需重复建立辅助关系。')
  if (!Number.isFinite(relation.mainQtyPerAux) || relation.mainQtyPerAux <= 0) throw new Error('换算数量必须大于 0。')
  if (!relation.uses.length) throw new Error('至少选择一个适用用途。')
  if (relation.isDefaultForUse.some(use => !relation.uses.includes(use))) throw new Error('默认用途必须在适用用途中。')
  const fixed = fixedMaterialFactor(relation.auxUnitId, mainUnit)
  if (fixed !== null && Math.abs(fixed - relation.mainQtyPerAux) > 1e-8) throw new Error('固定单位换算只读引用标准值，不能手工改写。')
  if (relation.basisType === 'FIXED' && fixed === null) throw new Error('该组合没有固定换算，需提供规格标准或包装含量。')
  if (fixed === null && !relation.basisReference.trim()) throw new Error('跨量纲或包装换算必须填写有依据的标准，不默认 1:1。')
  if (relation.basisType === 'PACKAGE' && !relation.packageSpecId) throw new Error('包装换算必须关联具体包装规格。')
}
export function materialPackageVolume(pack: Pick<MaterialPackageSpec, 'lengthCm'|'widthCm'|'heightCm'|'volumeM3'|'volumeSource'|'measurementBasis'>): number | null {
  if (pack.volumeSource === 'DIMENSIONS') {
    const dimensions = [pack.lengthCm, pack.widthCm, pack.heightCm]
    if (dimensions.some(x => x === null)) return null
    if (dimensions.some(x => !Number.isFinite(x) || Number(x) <= 0)) throw new Error('已填写的包装尺寸必须大于 0；未知请留空。')
    return Number((Number(pack.lengthCm) * Number(pack.widthCm) * Number(pack.heightCm) / 1e6).toFixed(8))
  }
  if (pack.volumeSource === 'CONFIRMED') {
    if (pack.volumeM3 === null || pack.volumeM3 <= 0 || !pack.measurementBasis.trim()) throw new Error('确认体积需填写正值和测量基准。')
    return pack.volumeM3
  }
  return null
}
// All cost arithmetic uses fixed eight-decimal precision, with one rounding at each operation.
const SCALE = 100000000n
function decimal(value: number | string): bigint {
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error('金额或换算值不是有效数字。')
  return BigInt(n.toFixed(8).replace('.', ''))
}
export function materialDecimalAdd(...values: Array<number | string>): number { return Number(values.reduce<bigint>((sum, v) => sum + decimal(v), 0n)) / Number(SCALE) }
export function materialDecimalMultiply(a: number | string, b: number | string): number {
  const product = decimal(a) * decimal(b)
  return Number((product + (product >= 0n ? SCALE / 2n : -SCALE / 2n)) / SCALE) / Number(SCALE)
}
export function materialMoney(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value) || value < 0) throw new Error('标准单价必须为非负数，未维护请留空。')
  return value
}
