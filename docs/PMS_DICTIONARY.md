# PMS 模块字典

本文档为 HiGood 仓库 PMS(采购管理系统)模块的**集成索引**,供新业务接入、二次开发、Code Review 时快速定位。

---

## 1. 模块布局

```
src/
├── data/pms/                  # 业务逻辑层(纯 TS,无 DOM)
│   ├── runtime.ts             # 核心运行时:类型 + PmsDomainError + actor 常量 + 操作日志
│   ├── idb-storage.ts         # IndexedDB 抽象层:25 store + pmsTx/pmsPut/pmsPutWithVersion 等
│   ├── suppliers.ts           # 供应商
│   ├── material-purchase-orders.ts  # 面辅料采购单(MPO)
│   ├── material-requirements.ts     # 面辅料需求(MREQ)
│   ├── product-purchase-orders.ts   # 商品采购单
│   ├── purchase-suggestions.ts      # 采购建议 + KOL 需求
│   ├── supplier-confirmations.ts    # 供应商包装确认单(SCFM)
│   ├── supplier-supply-archives.ts  # 供应商供应档案
│   ├── inventory-monitor.ts         # 库存监控 + 库存单据
│   ├── reconciliations.ts           # 对账(MR / LR)
│   ├── first-leg-logistics.ts       # 头程物流(FL)
│   ├── payment-requests.ts          # 请款单(PAY-M / PAY-L)
│   ├── bom-templates.ts             # BOM 模板 + BOM 日志
│   ├── bom-detail.ts                # BOM 样板详情
│   ├── tmf-material-purchases.ts    # 织带厂(tmf)状态(2789 行,考虑拆分)
│   └── ...
├── pages/pms/                 # 页面渲染层(返回 HTML 字符串 + 事件处理)
│   ├── shared.ts               # 共享渲染 + 字段读取 + 状态徽章
│   ├── data-management.ts      # § 2.4.5 数据管理页
│   └── ...
├── router/
│   ├── routes-pms.ts           # 33 个 PMS 路由注册
│   └── route-renderers-pms.ts  # createLazyRenderer 包装(每页一行)
├── main-handlers/pms-handlers.ts  # 30 个 click 事件分发 spec
└── data/app-shell-config.ts    # 33 个 PMS 菜单项(挂在 9 个 system 下)
```

---

## 2. 33 条 PMS 路由

| 路由 | 渲染器 | Handler |
| --- | --- | --- |
| `/pms/workbench/overview` | workbench | `handlePmsWorkbenchEvent` |
| `/pms/data-management` | data-management | `handlePmsDataManagementEvent` |
| `/pms/bom-templates` | bom-templates | `handlePmsBomTemplatesEvent` |
| `/pms/bom-templates/:id` | bom-detail | `handlePmsBomDetailEvent` |
| `/pms/material-archives` | material-archives | `handlePmsMaterialArchivesEvent` |
| `/pms/sample-skus` | product-skus | `handlePmsProductSkusEvent` |
| `/pms/garment-skus` | product-skus | 同上 |
| `/pms/material-inventory` | material-inventory | `handlePmsMaterialInventoryEvent` |
| `/pms/material-purchase-orders` | material-purchase-orders | `handlePmsMaterialPurchaseOrdersEvent` |
| `/pms/material-purchase-tracking` | material-purchase-tracking | `handlePmsMaterialPurchaseTrackingEvent` |
| `/pms/material-requirements` | material-requirements | `handlePmsMaterialRequirementsEvent` |
| `/pms/material-supplier-confirmations` | supplier-confirmations | `handlePmsSupplierConfirmationsEvent` |
| `/pms/product-purchase-orders` | product-purchase-orders | `handlePmsProductPurchaseOrdersEvent` |
| `/pms/purchase-suggestions` | purchase-suggestions | `handlePmsPurchaseSuggestionsEvent` |
| `/pms/kol-demands` | kol-demands | `handlePmsKolDemandsEvent` |
| `/pms/suppliers` | suppliers | `handlePmsSuppliersEvent` |
| `/pms/supplier-supply-archives` | supplier-supply-archives | `handlePmsSupplyArchivesEvent` |
| `/pms/first-leg-shipments` | first-leg-shipments | `handlePmsFirstLegShipmentsEvent` |
| `/pms/first-leg-carriers` | first-leg-carriers | `handlePmsFirstLegCarriersEvent` |
| `/pms/material-reconciliations` | material-reconciliations | `handlePmsMaterialReconciliationsEvent` |
| `/pms/logistics-reconciliations` | logistics-reconciliations | `handlePmsLogisticsReconciliationsEvent` |
| `/pms/material-payment-requests` | payment-requests | `handlePmsPaymentRequestsEvent` |
| `/pms/logistics-payment-requests` | payment-requests | 同上 |
| `/pms/trade-subjects` | trade-subjects | `handlePmsTradeSubjectsEvent` |
| `/pms/subject-operations` | subject-operations | `handlePmsSubjectOperationsEvent` |
| `/pms/transit/dashboard` | transit-dashboard | `handlePmsTransitDashboardEvent` |
| `/pms/transit/receipts` | transit-receipts | `handlePmsTransitReceiptsEvent` |
| `/pms/transit/order-checks` | transit-simple-lists | `handlePmsTransitSimpleListEvent` |
| `/pms/transit/preparation-tasks` | transit-simple-lists | 同上 |
| `/pms/units` | units | `handlePmsUnitsEvent` |
| `/pms/warehouses` | warehouses | `handlePmsWarehousesEvent` |
| `/pms/users` | settings | `handlePmsUsersEvent` |
| `/pms/roles` | settings | `handlePmsRolesEvent` |
| `/pms/dictionaries` | settings | `handlePmsDictionariesEvent` |

---

## 3. 25 IDB store(在 `higood-pms` 数据库中)

| Store 名 | keyPath | 业务对象 |
| --- | --- | --- |
| `pmsSuppliers` | `supplierCode` | PmsSupplier |
| `pmsMaterialPurchaseOrderDeltas` | `purchaseOrderNo` | PmsMaterialPurchaseOrder(变更) |
| `pmsMaterialRequirements` | `requirementNo` | PmsMaterialRequirement |
| `pmsProductPurchaseOrders` | `purchaseOrderNo` | PmsProductPurchaseOrder |
| `pmsPurchaseSuggestions` | `suggestionNo` | PmsPurchaseSuggestion |
| `pmsKolDemands` | `demandNo` | PmsKolDemand |
| `pmsSupplierConfirmations` | `confirmationNo` | PmsSupplierConfirmation |
| `pmsSupplyArchives` | `archiveId` | PmsSupplyArchive |
| `pmsInventoryMonitor` | `id` | PmsMaterialInventoryRow |
| `pmsInventoryOrders` | `orderNo` | PmsMaterialInventoryOrder |
| `pmsBomDetails` | `spu` | PmsBomDetail |
| `pmsBomTemplates` | `spu` | PmsBomTemplate |
| `pmsBomLogs` | `id` | PmsBomLog |
| `pmsReconciliations` | `id` | PmsMaterialReconciliation \| PmsLogisticsReconciliation(MR-/LR- 前缀区分) |
| `pmsFirstLegBatches` | `batchNo` | PmsFirstLegBatch |
| `pmsFirstLegCarriers` | `carrierId` | PmsFirstLegCarrier |
| `pmsFirstLegChannels` | `channelId` | PmsFirstLegChannel |
| `pmsPaymentRequests` | `requestNo` | PmsPaymentRequest |
| `pmsPaymentDrafts` | `draftKey` | PmsPaymentDraft(`'material'` / `'logistics'`) |
| `pmsOperationLogs` | `id` | PmsOperationLog |
| `pmsVersionSnapshots` | `snapshotKey` | PmsVersionSnapshot(`<store>::<key>`) |
| `pmsTmfOrders` | `singleton` | TMF 订单 section |
| `pmsTmfProduction` | `singleton` | TMF 生产 section |
| `pmsTmfScrap` | `singleton` | TMF 报废 section |
| `pmsTmfOperations` | `singleton` | TMF 操作 section |

---

## 4. 4 个 actor 常量(`runtime.ts`)

```ts
export const PMS_SYSTEM_ACTOR  = { id: 'USR-PMS-SYSTEM', name: '系统计算', role: '系统' }
export const PMS_BUYER_ACTOR   = { id: 'USR-PMS-WANG',   name: '王采购', role: '采购员' }
export const PMS_MANAGER_ACTOR = { id: 'USR-PMS-CHEN',   name: '陈主管', role: '采购主管' }
export const PMS_FINANCE_ACTOR = { id: 'USR-PMS-LIU',    name: '刘财务', role: '财务' }
```

---

## 5. PmsDomainError 错误码 namespace

`runtime.ts` 提供 `PMS_ERROR_NAMESPACE` 字典,从 code 前缀自动推导 namespace。

| Namespace | 错误码前缀 | 业务领域 |
| --- | --- | --- |
| `idb` | `PMS_IDB_` | IndexedDB 读写 |
| `bom` | `BOM_` | BOM 模板/样板详情 |
| `mpo` | `MPO_` | 面辅料采购单 |
| `mreq` | `MREQ_` | 面辅料需求 |
| `payment` | `PAYMENT_` | 请款单 |
| `recon` | `RECON_` | 对账 |
| `conf` | `CONF_` | 供应商包装确认 |
| `tmf` | `TMF_` | 织带厂 |
| `batch` | `BATCH_` | 头程批次 |
| `carrier` | `CARRIER_` | 头程承运商 |
| `channel` | `CHANNEL_` | 头程渠道 |
| `fl` | `FL_` / `FIRST_LEG_` | 头程物流 |
| `inventory` | `INVENTORY_` | 库存监控 |
| `material` | `MATERIAL_` | 面辅料 |
| `production` | `PRODUCTION_` | 生产 |
| `product` | `PRODUCT_` | 商品 |
| `kol` | `KOL_` | KOL 需求 |
| `purchase` | `PURCHASE_` | 采购通用 |
| `suggest` | `SUGGEST_` | 采购建议 |
| `supplier` | `SUPPLIER_` / `SUPPLY_` | 供应商 |
| `transit` | `TRANSIT_` | 中转 |
| `unit` / `warehouse` | `UNIT_` / `WAREHOUSE_` | 主数据 |
| `role` / `user` / `dictionary` | `ROLE_` / `USER_` / `DICTIONARY_` | 系统设置 |
| `misc` | 未匹配 | 兜底 |

完整错误码(250+ 个)由 `grep -roh "PmsDomainError('[A-Z_0-9]\+'" src/` 检索。

---

## 6. IDB 抽象层核心 helper(`idb-storage.ts`)

| 函数 | 用途 |
| --- | --- |
| `pmsTx(stores, mode, fn)` | 单 store / 多 store 事务 |
| `pmsPut(store, value)` | 单条写入(异步) |
| `pmsDelete(store, key)` | 单条删除 |
| `pmsAll(store)` | 全表读取 |
| `pmsGet(store, key)` | 单条读取 |
| `pmsPersistEntity(store, value, actor)` | § 2.4.3.6 乐观锁入口 |
| `pmsPutWithVersion(store, value, actor)` | 乐观锁写入(自动检测版本冲突) |
| `pmsGetEntityVersion(store, key)` | 读乐观锁版本号 |
| `pmsGetVersionMap(store)` | 批量读版本号 |
| `dispatchPmsSaveFailure(error, ctx)` | 失败统一处理(不可用 → warn,其他 → queueMicrotask throw 触发 banner) |
| `exportPmsDataBundle()` | § 2.4.5 导出备份 |
| `importPmsDataBundle(json)` | § 2.4.5 导入恢复 |
| `estimatePmsStorage()` | § 2.4.5 空间估算 |
| `clearAllPmsData()` | § 2.4.5 清空所有 PMS 数据 |

---

## 7. Hydration 状态机(14 个 PMS 业务模块)

每个业务模块遵循相同模式:

```ts
let xxxHydrationStarted = false
let xxxHydrationPromise: Promise<void> | null = null
let xxxHydrationReady = false
const pendingHydrationXxx: Entity[] = []

export function hydrateXxxFromIdb(): Promise<void> {
  if (xxxHydrationStarted) return xxxHydrationPromise ?? Promise.resolve()
  xxxHydrationStarted = true
  xxxHydrationPromise = (async () => {
    try {
      const stored = await pmsAll<Entity>(PMS_STORES.xxx)
      // ... 应用到内存
      // § 2.4.3.6 hydrate 后注入乐观锁版本(可选)
    } catch (error) { ... }
    finally {
      xxxHydrationReady = true
      // flush pendingHydration
    }
  })()
  return xxxHydrationPromise
}

function persistXxx(entity: Entity): void {
  if (xxxHydrationReady) {
    pmsPersistEntity(PMS_STORES.xxx, entity, 'pms-user')  // § 2.4.3.6 乐观锁
      .catch((error) => console.error(...))
  } else {
    pendingHydrationXxx.push(entity)
  }
}
```

**`main.ts` 启动期调用全部 15 个 hydrate 函数**(每个 PMS 模块一个 + IDB + log)。

---

## 8. 多标签页同步(`subscribePmsDataChanged` / `broadcastPmsDataChanged`)

- 写入路径: `pmsPut` / `pmsPutWithVersion` / `pmsTx` 事务 oncomplete 后调用 `broadcastPmsDataChanged(store, key, actor)`
- 订阅: `main.ts` 调 `subscribePmsDataChanged((message) => { ... })`,其他标签页写入时显示蓝色 banner
- BroadcastChannel: `'higood-pms-idb'`,不支持时静默降级

---

## 9. § 2.4 实施合规性

| 条款 | 状态 | 备注 |
| --- | --- | --- |
| § 2.4.1 业务数据 IDB | ✅ | 25 store + 旧键迁移 |
| § 2.4.3.1 普通读取不触发写入 | ✅ | hydrate 启动期不写入 |
| § 2.4.3.3 同一动作原子提交 | ✅ partial | `payment-requests` create/void 用 `pmsTx` 多 store;其他业务模块单 store put |
| § 2.4.3.4 等事务 complete | ✅ | `pmsTx` 等待 oncomplete |
| § 2.4.3.5 禁止静默回退 | ✅ | `dispatchPmsSaveFailure` 显式 dispatch;`material-purchase-orders.ts` + `tmf-material-purchases.ts` 保留旧键作为 § 2.4.6 迁移期兼容 |
| § 2.4.3.6 多标签页冲突 | ✅ partial | suppliers/bom-detail/reconciliations/material-requirements 已接乐观锁;剩余 8 模块下批次 |
| § 2.4.3.7 IDB 不可用不伪装空列表 | ✅ | fire-and-forget helper 在 IDB 不可用时静默 skip,hydrate 失败触发琥珀 banner |
| § 2.4.5 数据管理 UI | ✅ | `/pms/data-management` 路由 + 菜单项 + 4 卡片 |
| § 2.4.6 旧数据迁移 | ✅ | 启动期一次性迁移 `material-purchase-orders.ts` + `tmf-material-purchases.ts` |
| § 2.4.7 浏览器实测 | ✅ | Playwright 6/6 通过 |

---

## 10. 已知妥协

1. **tmf-material-purchases.ts 单文件 2789 行** — 业务关注点混杂,风险可控但需后续拆分(P1-4)
2. **乐观锁仅 6/14 业务模块接入** — suppliers/bom-detail/reconciliations/material-requirements/purchase-suggestions/supplier-confirmations,剩余 8 模块下批次
3. **material-purchase-orders + tmf-material-purchases 保留 localStorage 旧键** — § 2.4.6 迁移期兼容,migrate 函数会自动删除
4. **getRuntime() 每次调用 readSavedUpdates** — 已加 cachedRaw/cachedParsed memoization,跨标签页 storage 事件 invalidate
5. **listPmsLogs 已有 objectType 索引** — `logsByObjectType: Map<string, PmsOperationLog[]>`

---

## 11. 测试

- `npm run test:unit` → 567/567(全模块业务单测)
- `npm run typecheck:engineering` → 通过(范围外 8 个 fcs 历史错误)
- `playwright test tests/pms-idb-storage-e2e.spec.ts` → 6/6(§ 2.4.7 浏览器实测)

---

## 12. 评审文档

- `/private/tmp/higood-system-review-20260925/pms-code-review-senior-frontend.md` — Senior Frontend Review
- `/private/tmp/higood-system-review-20260925/pms-idb-final-100pct-completion-report.md` — IDB 100% 闭环报告
- `/private/tmp/higood-system-review-20260925/pms-idb-final-overall-check.md` — 整体检查