import { pcsRecordStore, withPcsDemoData } from './pcs-record-runtime.ts'

let initialized = false
export async function initializePcsRecordBaseline(): Promise<void> {
  if (initialized) return
  const [style, sku, testing, sampling, master, view, bom, channel, relation, technical, logs, notifications] = await Promise.all([
    import('./pcs-style-archive-repository.ts'), import('./pcs-sku-archive-repository.ts'),
    import('./pcs-testing-order-repository.ts'), import('./pcs-engineering-master-sampling.ts'),
    import('./pcs-engineering-master-repository.ts'), import('./pcs-engineering-master-view-model.ts'),
    import('./pcs-engineering-bom-repository.ts'), import('./pcs-channel-product-project-repository.ts'),
    import('./pcs-project-relation-repository.ts'), import('./pcs-technical-data-version-repository.ts'),
    import('./pcs-tech-pack-version-log-repository.ts'), import('./pcs-tech-pack-review-notification-repository.ts'),
  ])
  withPcsDemoData(() => bom.withEngineeringBomDemoBatch(() => {
    const set = (key: string, value: unknown) => pcsRecordStore.setItem(key, JSON.stringify(value))
    style.listStyleArchives(); sku.listSkuArchives(); testing.listTestingOrders(); sampling.listEngineeringIndependentSamplingRecords()
    view.ensureEngineeringMasterDemoData()
    set('higood-pcs-testing-orders-v1', testing.listTestingOrders())
    set('higood-pcs-engineering-master-store-v1', master.getEngineeringMasterOrderStoreSnapshot())
    set('higood-pcs-design-revision-v1', sampling.listEngineeringIndependentSamplingRecords())
    set('higood-pcs-engineering-bom-pricing-plan-store-v2', bom.captureEngineeringBomRepositoryState())
    set('higood-pcs-style-archive-store-v3', style.getStyleArchiveStoreSnapshot())
    set('higood-pcs-sku-archive-store-v1', { version: 1, records: sku.listSkuArchives() })
    set('higood-pcs-project-channel-product-store-v2', { version: 2, records: channel.listProjectChannelProductsSnapshot() })
    set('higood-pcs-project-relation-store-v2', relation.getProjectRelationStoreSnapshot())
    set('higood-pcs-technical-data-version-store-v5', technical.getTechnicalDataVersionStoreSnapshot())
    set('higood-pcs-tech-pack-version-log-store-v1', logs.getTechPackVersionLogStoreSnapshot())
    set('higood-pcs-tech-pack-review-notification-store-v1', notifications.getTechPackReviewNotificationStoreSnapshot())
    set('higood-pcs-engineering-task-uploads-v1', [])
    set('higood:pcs:engineering-pattern-results:v1', [])
    set('higood-fcs-production-tech-pack-publish-evaluations-v1', [])
  }))
  initialized = true
}
