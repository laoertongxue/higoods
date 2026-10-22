import { registerQualityInspectionSource } from './quality-management-read-model.ts'
import { postQualityReadSource } from './quality-post-read-source.ts'
import { sampleQualityReadSource } from './sample-quality-read-source.ts'
let registered=false
/** Register readonly original-source adapters. The requested page then prepares
 * either compact list facts or one exact detail; execution stores stay lazy. */
export async function prepareQualityBusinessSources():Promise<void> {
 if(registered)return
 registerQualityInspectionSource('PRODUCTION_RETURN',postQualityReadSource('PRODUCTION_RETURN'))
 registerQualityInspectionSource('WAREHOUSE_STOCK',postQualityReadSource('WAREHOUSE_STOCK'))
 registerQualityInspectionSource('PRE_PRODUCTION_SAMPLE',sampleQualityReadSource)
 registered=true
}
