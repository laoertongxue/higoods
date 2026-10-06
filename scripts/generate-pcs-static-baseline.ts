import { writeFileSync, mkdirSync } from 'node:fs'
import { PCS_LEGACY_KEYS } from '../src/data/pcs-record-runtime.ts'
import { pcsRecordStore, withPcsDemoData } from '../src/data/pcs-record-runtime.ts'

let initialized = false
export async function initializePcsRecordBaseline(): Promise<void> {
  if (initialized) return
  const [style, sku, testing, sampling, master, view, bom, channel, relation, technical, logs, notifications, config, exchange, materialConfig, material, catalog, stores, materialPlans] = await Promise.all([
    import('../src/data/pcs-style-archive-repository.ts'), import('../src/data/pcs-sku-archive-repository.ts'),
    import('../src/data/pcs-testing-order-repository.ts'), import('../src/data/pcs-engineering-master-sampling.ts'),
    import('../src/data/pcs-engineering-master-repository.ts'), import('../src/data/pcs-engineering-master-view-model.ts'),
    import('../src/data/pcs-engineering-bom-repository.ts'), import('../src/data/pcs-channel-product-project-repository.ts'),
    import('../src/data/pcs-project-relation-repository.ts'), import('../src/data/pcs-technical-data-version-repository.ts'),
    import('../src/data/pcs-tech-pack-version-log-repository.ts'), import('../src/data/pcs-tech-pack-review-notification-repository.ts'),
    import('../src/data/pcs-config-workspace-repository.ts'), import('../src/data/pcs-exchange-rate-config.ts'),
    import('../src/data/pcs-material-config.ts'), import('../src/data/pcs-material-archive-repository.ts'),
    import('../src/data/pcs-channel-catalog.ts'), import('../src/data/pcs-channel-store-repository.ts'),
    import('../src/data/fcs/material-process-plans.ts'),
  ])
  withPcsDemoData(() => bom.withEngineeringBomDemoBatch(() => {
    const set = (key: string, value: unknown) => pcsRecordStore.setItem(key, JSON.stringify(value))
    set('higood-pcs-config-workspace-store-v1', config.getConfigWorkspaceSnapshot())
    set('higood-pcs-exchange-rate-config-v1', exchange.getPcsExchangeRateConfig())
    set('higood-pcs-material-config-v1', materialConfig.getMaterialConfigSnapshot())
    set('higood-pcs-material-archive-store-v2', material.getMaterialArchiveBaseline())
    set('higood-fcs-material-process-plans-v1', materialPlans.getFcsMaterialProcessPlanBaseline())
    set('higood-pcs-channel-store-v1', stores.getPcsChannelStoreSnapshot())
    style.listStyleArchives(); sku.listSkuArchives(); testing.listTestingOrders(); sampling.listEngineeringIndependentSamplingRecords()
    view.ensureEngineeringMasterDemoData()
    set('higood-pcs-testing-orders-v1', testing.listTestingOrders())
    set('higood-pcs-engineering-master-store-v1', master.getEngineeringMasterOrderStoreSnapshot())
    set('higood-pcs-design-revision-v1', sampling.listEngineeringIndependentSamplingRecords())
    set('higood-pcs-engineering-bom-pricing-plan-store-v2', bom.captureEngineeringBomRepositoryState())
    set('higood-pcs-style-archive-store-v3', style.getStyleArchiveStoreSnapshot())
    set('higood-pcs-sku-archive-store-v1', { version: 1, records: sku.listSkuArchives() })
    set('higood-pcs-channel-catalog-v1', catalog.getPcsChannelCatalogSnapshot())
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

// Build-time authoring only. Runtime reads the published static asset and never
// generates or persists a second copy of demonstration records.
await initializePcsRecordBaseline()
const snapshot = Object.fromEntries(PCS_LEGACY_KEYS.map(key => [key, pcsRecordStore.getItem(key) ?? '[]']))
mkdirSync(new URL('../src/data/generated/', import.meta.url), { recursive: true })
writeFileSync(new URL('../src/data/generated/pcs-record-baseline.json', import.meta.url), JSON.stringify(snapshot))
console.log(`PCS static baseline: ${Object.keys(snapshot).length} collections; no browser storage writes.`)
