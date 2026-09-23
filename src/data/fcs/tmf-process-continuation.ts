import type { DyeWorkOrder } from './dyeing-task-domain.ts'
import type { PrintWorkOrder } from './printing-task-domain.ts'
import type { ProductionOrderTechPackSnapshot } from './production-tech-pack-snapshot-types.ts'
import { validateWebbingSpecifications, WEBBING_CUT_PROCESS } from './webbing-specifications.ts'

/** 印花后的连续辅料必须交给采用路线中的直接截断节点。 */
export function assertTmfPrintCutContinuation(print: PrintWorkOrder, cutEntryId: string, pack: ProductionOrderTechPackSnapshot): void {
 const source=print.sourceSnapshot
 if(source?.sourceType!=='PRODUCTION_ORDER'||source.productionOrderId!==pack.productionOrderId||source.techPackVersionId!==pack.sourceTechPackVersionId)throw new Error('印花与截断必须来自同一生产单采用的技术包版本。')
 if(print.status==='CANCELLED'||source.cancelledAt||print.changeImpact?.length)throw new Error('印花单已取消或存在未处理变更。')
 const from=pack.processEntries.find(e=>e.id===source.processEntryId),cut=pack.processEntries.find(e=>e.id===cutEntryId)
 if(from?.processCode!=='PRINT'||cut?.processCode!==WEBBING_CUT_PROCESS||cut.predecessorEntryIds?.length!==1||cut.predecessorEntryIds[0]!==from.id)throw new Error('印花与织带截断不是唯一直接前后工序，不能跨节点接续。')
 if(from.outputObjectType!=='ACCESSORY'||cut.inputObjectType!=='ACCESSORY'||from.outputInventoryForm!=='CONTINUOUS'||cut.inputInventoryForm!=='CONTINUOUS')throw new Error('仅连续辅料可以由印花交给织带截断。')
 if(!from.outputMaterialSkuId||from.outputMaterialSkuId!==cut.inputMaterialSkuId||print.outputMaterialSku!==(from.outputMaterialSkuCode||from.outputMaterialSkuId))throw new Error('印花产出与截断投入SKU不一致。')
 if(!['米','m'].includes(print.qtyUnit)||!print.printFactoryId)throw new Error('请核对印花计量单位和加工厂。')
 const bomIds=[source.bomItemId,...(source.bomItemIds??[])].filter((id):id is string=>!!id)
 const issues=validateWebbingSpecifications(cut.webbingSpecifications,bomIds)
 if(issues.length)throw new Error(issues.map(i=>i.message).join('；'))
 if(print.productionTmfContinuation&&print.productionTmfContinuation.cutEntryId!==cutEntryId)throw new Error('已绑定其他截断节点，不能覆盖。')
}

/** 染色后的连续辅料直接进入织带截断（路线无印花）时必须交给直接截断节点。 */
export function assertTmfDyeCutContinuation(dye: DyeWorkOrder, cutEntryId: string, pack: ProductionOrderTechPackSnapshot): void {
 const source=dye.sourceSnapshot
 if(source?.sourceType!=='PRODUCTION_ORDER'||source.productionOrderId!==pack.productionOrderId||source.techPackVersionId!==pack.sourceTechPackVersionId)throw new Error('染色与截断必须来自同一生产单采用的技术包版本。')
 if(dye.status==='CANCELLED'||source.cancelledAt||dye.changeImpact?.length)throw new Error('染色单已取消或存在未处理变更。')
 if(dye.sourceSnapshot?.downstreamWorkOrderId||dye.productionPrintContinuation)throw new Error('染色已绑定下游印花单，不能同时直接交给织带厂截断。')
 const from=pack.processEntries.find(e=>e.id===source.processEntryId),cut=pack.processEntries.find(e=>e.id===cutEntryId)
 if(from?.processCode!=='DYE'||cut?.processCode!==WEBBING_CUT_PROCESS||cut.predecessorEntryIds?.length!==1||cut.predecessorEntryIds[0]!==from.id)throw new Error('染色与织带截断不是唯一直接前后工序，不能跨节点接续。')
 if(from.outputObjectType!=='ACCESSORY'||cut.inputObjectType!=='ACCESSORY'||from.outputInventoryForm!=='CONTINUOUS'||cut.inputInventoryForm!=='CONTINUOUS')throw new Error('仅连续辅料可以由染色交给织带截断。')
 if(!from.outputMaterialSkuId||from.outputMaterialSkuId!==cut.inputMaterialSkuId||dye.outputMaterial?.sku!==(from.outputMaterialSkuCode||from.outputMaterialSkuId))throw new Error('染色产出与截断投入SKU不一致。')
 if(!['米','m'].includes(dye.qtyUnit)||!dye.dyeFactoryId)throw new Error('请核对染色计量单位和加工厂。')
 const bomIds=[source.bomItemId,...(source.bomItemIds??[])].filter((id):id is string=>!!id)
 const issues=validateWebbingSpecifications(cut.webbingSpecifications,bomIds)
 if(issues.length)throw new Error(issues.map(i=>i.message).join('；'))
}

/** 正式路线的相邻印染单：校验来源和物料，不据此生成任何实际数量。 */
export function assertTmfDyePrintContinuation(dye: DyeWorkOrder, print: PrintWorkOrder, pack: ProductionOrderTechPackSnapshot): void {
 const from=dye.sourceSnapshot,to=print.sourceSnapshot
 if(from?.sourceType!=='PRODUCTION_ORDER'||to?.sourceType!=='PRODUCTION_ORDER'||from.productionOrderId!==to.productionOrderId||pack.productionOrderId!==from.productionOrderId)throw new Error('染色与印花必须来自同一正式生产单。')
 if(from.techPackVersionId!==to.techPackVersionId||from.techPackVersionId!==pack.sourceTechPackVersionId)throw new Error('染色、印花与生产单采用技术包版本不一致。')
 if(dye.status==='CANCELLED'||print.status==='CANCELLED'||from.cancelledAt||to.cancelledAt||dye.changeImpact?.length||print.changeImpact?.length)throw new Error('加工单已取消或存在未处理变更，不能关联后续。')
 const dyeNode=pack.processEntries.find(e=>e.id===from.processEntryId),printNode=pack.processEntries.find(e=>e.id===to.processEntryId)
 if(dyeNode?.processCode!=='DYE'||printNode?.processCode!=='PRINT'||!printNode.predecessorEntryIds?.includes(dyeNode.id))throw new Error('技术包中两工序不是染色到印花的直接前后关系。')
 if(dyeNode.outputObjectType!=='ACCESSORY'||printNode.inputObjectType!=='ACCESSORY'||dyeNode.outputInventoryForm!=='CONTINUOUS'||printNode.inputInventoryForm!=='CONTINUOUS')throw new Error('此接续只用于连续辅料，不能套用于其他加工对象。')
 const fromBom=new Set([from.bomItemId,...(from.bomItemIds??[])].filter(Boolean)),toBom=[to.bomItemId,...(to.bomItemIds??[])].filter(Boolean)
 if(!toBom.length||toBom.some(id=>!fromBom.has(id)))throw new Error('染色与印花BOM用途不一致。')
 if(!dyeNode.outputMaterialSkuId||dyeNode.outputMaterialSkuId!==printNode.inputMaterialSkuId||dye.outputMaterial?.sku!==(dyeNode.outputMaterialSkuCode||dyeNode.outputMaterialSkuId)||print.materialSku!==(printNode.inputMaterialSkuCode||printNode.inputMaterialSkuId))throw new Error('染色产出SKU与印花投入SKU或技术包不一致。')
 if(!['米','m'].includes(dye.qtyUnit)||!['米','m'].includes(print.qtyUnit))throw new Error('连续辅料接续必须按米计量。')
 if(!print.printFactoryId||!print.printFactoryName)throw new Error('请先分配印花接收工厂。')
 if(from.downstreamWorkOrderId&&from.downstreamWorkOrderId!==print.printOrderId)throw new Error('已有其他印花接收单，不能覆盖。')
}
