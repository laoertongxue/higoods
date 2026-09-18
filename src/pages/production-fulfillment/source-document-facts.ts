/** Read only the current business documents; never match by style or synthesize receiving/QC. */
import { productionOrders, type ProductionOrder } from '../../data/fcs/production-orders'
import { listFactoryReceivingSources, listFactoryReceipts, listFactoryDeliveryNotes } from '../../data/fcs/factory-receiving'
import type { FactoryReceivingSource, FactoryReceipt, FactoryDeliveryNote } from '../../data/fcs/factory-receiving-types'
import { listPdaHandoverHeads, getPdaHandoverRecordsByHead, type PdaHandoverHead, type PdaHandoverRecord } from '../../data/fcs/pda-handover-events'
import { initialQualityInspections } from '../../data/fcs/store-domain-quality-seeds'
import { qualityDeductionSharedCaseFacts } from '../../data/fcs/quality-deduction-shared-facts'
import { toCompatibilityQualityInspection } from '../../data/fcs/quality-deduction-selectors'
import type { QualityInspection } from '../../data/fcs/store-domain-quality-types'
import { listEngineeringPurchaseOrderFacts, type EngineeringPurchaseOrderFact } from '../../data/pcs-engineering-purchase-linkage'

export interface ProductionDocumentFacts {
  orders:ProductionOrder[];
  receivingSources:FactoryReceivingSource[];
  receipts:FactoryReceipt[];
  deliveries?:FactoryDeliveryNote[];
  handovers:{head:PdaHandoverHead;records:PdaHandoverRecord[]}[];
  inspections:QualityInspection[];
  purchases:EngineeringPurchaseOrderFact[];
}

export function readProductionDocumentFacts(taskIds:ReadonlySet<string>,purchaseOrderNos:string[]):ProductionDocumentFacts {
  // The QC facade invokes automatic liability decisions. Read the shared current facts directly,
  // overlaid on legacy inspections, so opening DDS never submits or confirms a business decision.
  const inspections=new Map(initialQualityInspections.map(item=>[item.qcId,item]))
  for(const fact of qualityDeductionSharedCaseFacts)inspections.set(fact.qcRecord.qcId,toCompatibilityQualityInspection(fact))
  return {
    orders:productionOrders,
    receivingSources:listFactoryReceivingSources(undefined,true),receipts:listFactoryReceipts(),deliveries:listFactoryDeliveryNotes(),
    handovers:listPdaHandoverHeads({taskIds,includeWool:false}).filter(head=>head.headType==='HANDOUT').map(head=>({head,records:getPdaHandoverRecordsByHead(head.handoverId)})),
    inspections:[...inspections.values()],
    purchases:listEngineeringPurchaseOrderFacts(purchaseOrderNos).filter(order=>order.accessible!==false),
  }
}
