import assert from 'node:assert/strict'
import test from 'node:test'
import { productionOrders } from '../../src/data/fcs/production-orders.ts'
import { listPostFinishingFullFlowQcTasks } from '../../src/data/fcs/post-finishing-full-flow.ts'
import { LEGACY_QC_MATERIAL_BINDINGS } from '../../src/data/pcs-legacy-qc-demo-materials.ts'
import { buildProductionConfirmationSnapshot } from '../../src/data/fcs/production-confirmation.ts'
import { buildProductionQcMasterPrintDocument, renderPostFinishingQcPrintTemplate, renderPostFinishingQcTaskMaster } from '../../src/pages/print/templates/post-finishing-qc-print-template.ts'

test('通用QC主单逐BOM行取对应图片，第二面料缺图不能借第一面料图通过打印门禁',()=>{
  const order=productionOrders.find(row=>row.productionOrderId==='PF-ACCEPT-PO-1')!
  assert.ok(order?.techPackSnapshot)
  const snapshot=order.techPackSnapshot!,originalBom=snapshot.bomItems,originalImages=snapshot.imageSnapshot
  try{
    const original=structuredClone(snapshot.bomItems[0])
    // Isolated identity-only renderer fixture. The URL is deliberately not a
    // claimed photograph or a browser image-readiness acceptance resource.
    snapshot.bomItems=[{...original,id:'REVIEW-FABRIC-ONE',name:'review-first-fabric',materialImageUrl:'/review-specific-first-fabric.jpg'},
      {...original,id:'REVIEW-FABRIC-TWO',name:'review-missing-second-fabric',materialImageUrl:''}]
    snapshot.imageSnapshot={...originalImages,materialImages:['/review-specific-first-fabric.jpg']}
    const document=buildProductionQcMasterPrintDocument({documentType:'PRODUCTION_QC_MASTER',sourceType:'POST_FINISHING_TASK',sourceId:'PF-TASK-PF-ACCEPT-PO-1'})
    const html=renderPostFinishingQcPrintTemplate(document)!
    const rows=html.match(/<tr>.*?<\/tr>/gs) || []
    const first=rows.find(row=>row.includes('review-first-fabric')),second=rows.find(row=>row.includes('review-missing-second-fabric'))
    assert.ok(first);assert.ok(second)
    assert.match(first,/src="\/review-specific-first-fabric\.jpg"/)
    assert.doesNotMatch(first,/data-print-image-missing/)
    assert.doesNotMatch(second,/src="\/review-specific-first-fabric\.jpg"/)
    assert.match(second,/data-print-image-missing/)
    assert.equal(snapshot.bomItems[1].materialImageUrl,'')
  }finally{snapshot.bomItems=originalBom;snapshot.imageSnapshot=originalImages}
})


test('三原款两套主单展示冻结真实物料SKU及原料图说明，BOM关联行身份保持不变',()=>{
  for(const binding of LEGACY_QC_MATERIAL_BINDINGS){
    const order=productionOrders.find(row=>row.productionOrderId===binding.productionOrderId)!
    const task=listPostFinishingFullFlowQcTasks().find(row=>row.productionOrderId===binding.productionOrderId)!
    const snapshot=buildProductionConfirmationSnapshot(binding.productionOrderId),bom=snapshot.bomSnapshot[0]
    assert.equal(bom.materialSku,binding.technicalVersionId+'-bom-main')
    assert.equal(bom.materialSkuCode,binding.materialSkuCode)
    const document=buildProductionQcMasterPrintDocument({documentType:'PRODUCTION_QC_MASTER',sourceType:'POST_FINISHING_TASK',sourceId:order.productionOrderNo})
    for(const html of [renderPostFinishingQcPrintTemplate(document)!,renderPostFinishingQcTaskMaster(task)]){
      assert.ok(html.includes(binding.materialSkuCode))
      assert.ok(html.includes(binding.imageLabel))
      assert.ok(html.includes('src="'+binding.imageUrl+'"'))
      assert.equal(html.includes('data-print-image-missing'),false)
    }
  }
})
