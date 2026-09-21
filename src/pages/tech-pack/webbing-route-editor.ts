import type { BomItemRow, TechniqueItem } from './context.ts'
import { cloneWebbingSpecifications, validateWebbingSpecifications, WEBBING_CUT_PROCESS, WEBBING_TIP_PROCESS, type WebbingSpecification } from '../../data/fcs/webbing-specifications.ts'

/** 修改同一 BOM 的 TMF 分支，不改橡筋、印染或其他 BOM 的工艺。 */
export function applyWebbingRouteSpecifications(
  techniques: TechniqueItem[], bom: Pick<BomItemRow, 'id' | 'type' | 'materialSkuId' | 'materialCode' | 'materialName'>,
  specifications: WebbingSpecification[], predecessorId: string,
): TechniqueItem[] {
  if (bom.type !== '辅料' || !bom.materialSkuId) throw new Error('请先在 BOM 中选择织带／绳子的半成品 SKU。')
  if (techniques.some((item) => item.craftCode === 'CRAFT_3000009' && item.linkedBomItemIds?.includes(bom.id))) throw new Error('此 BOM 已绑定独立橡筋定长切割，不能同时生成 TMF 截断。')
  const errors = validateWebbingSpecifications(specifications, [bom.id])
  if (errors.length) throw new Error(errors.map((item) => item.message).join('；'))
  const own = techniques.filter((item) => item.linkedBomItemIds?.includes(bom.id) && [WEBBING_CUT_PROCESS, WEBBING_TIP_PROCESS].includes(item.processCode))
  if (own.filter((item) => item.processCode === WEBBING_CUT_PROCESS).length > 1 || own.filter((item) => item.processCode === WEBBING_TIP_PROCESS).length > 1) throw new Error('此 BOM 存在多条截断分支，请先整理路线后编辑。')
  const predecessor = predecessorId ? techniques.find((item) => item.id === predecessorId) : undefined
  if (predecessorId && (!predecessor || predecessor.stageCode !== 'PREP' || !predecessor.linkedBomItemIds?.includes(bom.id) || own.some((item) => item.id === predecessorId))) throw new Error('前序必须是当前 BOM 的准备工艺，不能引用自身或其他物料。')
  const otherPrep = techniques.filter((item) => item.stageCode === 'PREP' && item.linkedBomItemIds?.includes(bom.id) && !own.some((candidate) => candidate.id === item.id))
  if (!predecessor && otherPrep.length) throw new Error('此物料已有准备工艺，请选择实际前序，不能跳过印染。')
  if (predecessor && otherPrep.some((item) => item.predecessorEntryIds?.includes(predecessor.id))) throw new Error('所选工艺之后还有准备步骤，请选择最终前序。')
  const skuId = predecessor?.outputMaterialSkuId ?? bom.materialSkuId
  if (!skuId) throw new Error('前序工艺尚未确认产出 SKU。')
  const cutId = own.find((item) => item.processCode === WEBBING_CUT_PROCESS)?.id ?? `TMF-CUT:${bom.id}`
  const tipId = own.find((item) => item.processCode === WEBBING_TIP_PROCESS)?.id ?? `TMF-TIP:${bom.id}`
  const withTips = specifications.filter((item) => item.tippingRequired)
  const create = (code: string, id: string, specs: WebbingSpecification[]): TechniqueItem => ({
    ...(own.find((item) => item.id === id) ?? {}), id, entryType: 'PROCESS_BASELINE', stageCode: 'PREP', stage: '准备阶段',
    processCode: code, process: code === WEBBING_CUT_PROCESS ? '织带／绳子截断' : '织带／绳子打头',
    craftCode: '', technique: code === WEBBING_CUT_PROCESS ? '织带／绳子截断' : '织带／绳子打头',
    assignmentGranularity: 'DETAIL', ruleSource: 'INHERIT_PROCESS', detailSplitMode: 'COMPOSITE', detailSplitDimensions: ['MATERIAL_SKU', 'GARMENT_SKU'],
    defaultDocType: 'PREPARATION_ORDER', taskTypeMode: 'PROCESS', isSpecialCraft: false,
    targetObject: 'ACCESSORY', targetObjectName: '辅料', inputObjectType: 'ACCESSORY', outputObjectType: 'ACCESSORY',
    linkedBomItemIds: [bom.id], routeObjectKey: `BOM:${bom.id}`, sourceType: 'MANUAL', source: '字典引用',
    inputMaterialSkuId: skuId, outputMaterialSkuId: skuId, inputMaterialSkuCode: predecessor?.outputMaterialSkuCode ?? bom.materialCode,
    outputMaterialSkuCode: predecessor?.outputMaterialSkuCode ?? bom.materialCode,
    inputMaterialName: bom.materialName, outputMaterialName: bom.materialName,
    inputMaterialImageUrl: predecessor?.outputMaterialImageUrl, outputMaterialImageUrl: predecessor?.outputMaterialImageUrl,
    outputMaterialSkuMode: 'UNCHANGED', inputInventoryForm: code === WEBBING_CUT_PROCESS ? 'CONTINUOUS' : 'CUT_PIECES',
    outputInventoryForm: code === WEBBING_CUT_PROCESS && withTips.length ? 'CUT_PIECES' : 'FINISHED_PIECES',
    webbingSpecifications: cloneWebbingSpecifications(specs),
    predecessorEntryIds: code === WEBBING_CUT_PROCESS ? predecessorId ? [predecessorId] : [] : [cutId],
    consumedBomItemIds: code === WEBBING_TIP_PROCESS ? [...new Set(specs.flatMap((spec) => [spec.endA.materialBomItemId, spec.endB.materialBomItemId].filter((value): value is string => Boolean(value))))] : [],
    triggerSource: '技术包 BOM 加工规格', difficulty: '中等', remark: '', routeStepNo: (predecessor?.routeStepNo ?? 0) + (code === WEBBING_CUT_PROCESS ? 1 : 2),
    routeLaneNo: predecessor?.routeLaneNo ?? 1, routeSourceKind: 'MANUAL',
  })
  const oldFinalId = own.find((item) => item.processCode === WEBBING_TIP_PROCESS)?.id ?? cutId
  const newFinalId = withTips.length ? tipId : cutId
  return [...techniques.filter((item) => !own.some((candidate) => candidate.id === item.id)).map((item) => ({ ...item,
    predecessorEntryIds: item.predecessorEntryIds?.map((id) => id === oldFinalId ? newFinalId : id),
  })), create(WEBBING_CUT_PROCESS, cutId, specifications), ...(withTips.length ? [create(WEBBING_TIP_PROCESS, tipId, withTips)] : [])]
}
