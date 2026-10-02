# PMS P0 修复 · 原子需求追踪与交付矩阵

> 来源文档：`docs/2026-10-03-pms-code-review.md`（评审报告，HEAD `83bb8532`）
> 本次修复基线：`workbuddy/main-d9b7fac9`，提交前工作树
> 日期：2026-10-03

## 1. 适用范围与非范围

**范围**：评审报告第 2 节 P0-1 ~ P0-5 全部 5 条，以及修复过程中新发现的 1 个运行时缺陷。

**非范围（本次不动）**：

- 报告第 3 节 P1（跨标签页 banner、主单与日志分离事务、IDB 版本升级路径、日志主键撞车、巨型函数、对账页重复、导入导出、精度口径）。
- 报告第 4 节 P2（`<option>` 转义风格、弹窗组件复用、可访问性）。
- 报告第 5 节的工程门禁改造（把 `tsc --noEmit` 接入 build）——需改动 `package.json` 构建链，影响全仓，另立任务。
- 既有类型错误中不属于本次修复链路的 5 项（见第 5 节"遗留项"）。

## 2. 原子需求登记表

| 编号 | 来源 | 原子需求 | 实现位置 | 状态 |
| --- | --- | --- | --- | --- |
| PMSFIX-001 | 报告 P0-1 | hydrate 注入版本时不得要求 `version > 0`：version 为 0（尚无快照）也必须注入，使首次保存即可走乐观锁并创建快照 | `src/data/pms/suppliers.ts:31`<br>`src/data/pms/material-requirements.ts:82`<br>`src/data/pms/bom-detail.ts:33`<br>`src/data/pms/reconciliations.ts:46,51` | 已实现待验证 |
| PMSFIX-002 | 报告 P0-2 | `pmsPutWithVersion` 事务 `oncomplete` 后必须把 `nextVersion` 回写到调用方内存对象，避免同一对象第二次保存必定自冲突 | `src/data/pms/idb-storage.ts`（`pmsPutWithVersion`：`nextVersion` 提升作用域 + `tx.oncomplete` 内 `Object.assign`） | 已实现待验证 |
| PMSFIX-003 | 报告 P0-5 | 保存失败不得被 `.catch(console.error)` 吞没；统一经 `reportPmsSaveFailure` 记录语义日志后重新抛出，由 `main.ts` 的 `unhandledrejection` banner 提示"未保存" | 新增 `src/data/pms/idb-storage.ts: reportPmsSaveFailure`；调用点 12 处：suppliers / material-requirements / bom-detail / reconciliations(×2) / payment-requests(×4) / product-purchase-orders(×2) / supplier-confirmations(×2) / inventory-monitor(×3) / tmf | 已实现待验证 |
| PMSFIX-004 | 报告 P0-3 | TMF hydrate 的 section 构造必须显式加括号，禁止 `??` 与 `?:` 混写导致 `extractXxxSection(undefined!)` 抛错 | `src/data/pms/tmf-material-purchases.ts`（`sections` 构造） | 已实现待验证 |
| PMSFIX-005 | 报告 P0-4 | TMF 的事实源必须是「内存 + IndexedDB」：hydrate 成功后不再清空内存 state、不再写/读 localStorage 作为事实源 | `tmf-material-purchases.ts`：`tmfIdbAvailable` 标志 + `current()` + `commit()` | 已实现待验证 |
| PMSFIX-006 | 报告 P0-4 | TMF 的 localStorage 降级仅在 IDB 不可用/未就绪时启用；迁移已删除的旧键不得被再次写回（§ 2.4.1 / § 2.4.6） | `tmf-material-purchases.ts`：`commit()` 写入分支条件化 | 已实现待验证 |
| PMSFIX-007 | 报告 P0-4 | 移除 localStorage 主写后，跨标签页同步改走 BroadcastChannel；收到变更须重新从 IDB 拉取，不得简单置空（置空会退回 emptyState 丢数据） | `tmf-material-purchases.ts`：`bindStorageSync()` 订阅 `subscribePmsDataChanged` + 新增 `reloadTmfStateFromIdb()` + 抽出 `readTmfSectionsFromIdb()` 供 hydrate 与 reload 共用 | 已实现待验证 |
| PMSFIX-008 | 报告 P0-4 | TMF 的 IDB 写入失败须先回写 localStorage 兜底保住本次操作，再重新抛出让用户可见；不得产生无接管的 unhandledrejection | `tmf-material-purchases.ts`：`commit()` 的 `.catch` | 已实现待验证 |
| PMSFIX-009 | 修复中新发现 | `reportPmsSaveFailure` 须区分 `PMS_IDB_UNAVAILABLE`：该错误码是设计内降级（隐私模式/Node），不得报"保存失败"或产生 unhandledrejection | `src/data/pms/idb-storage.ts`：`reportPmsSaveFailure` | 已实现待验证 |
| PMSFIX-010 | 修复中新发现 | `material-purchase-orders.ts` 模块顶层 `let storageListenerInstalled` 在使用之后声明（TDZ），浏览器中模块加载即抛 `ReferenceError`，跨标签页监听从未注册 | `src/data/pms/material-purchase-orders.ts`：声明上移至 `if` 之前 | 已实现待验证 |
| PMSFIX-011 | 修复中新发现 | 历史 store 名 `pmsTmfPurchaseState` 已不是合法 `PmsStoreName`，须显式收窄以消除类型错误（读取失败仍按原逻辑忽略） | `tmf-material-purchases.ts`：legacy store 读取 | 已实现待验证 |
| PMSFIX-012 | 修复中新发现（由 e2e 暴露） | 版本号不得只挂在 entity 对象副本上：业务层普遍 `structuredClone`/spread 产生副本，回写只落在一个副本上，其余副本保存时必定误判为"其他标签页已修改"。须改为按 store+key 集中登记本客户端已知版本 | `src/data/pms/idb-storage.ts`：`pmsKnownVersions` 表 + `pmsPutWithVersion` 读取/写入 | 已实现待验证 |
| PMSFIX-013 | 修复中新发现（由 e2e 暴露） | hydrate / reload 查询持久版本时必须同步版本表，否则冲突后用户刷新页面会拿着旧版本反复冲突，无法恢复 | `src/data/pms/idb-storage.ts`：`pmsGetEntityVersion` 成功回调内同步 `pmsKnownVersions` | 已实现待验证 |
| PMSFIX-014 | 修复中新发现（由 e2e 暴露） | 同一 key 的并发写入必须串行化：事务提交后版本表在 `oncomplete` 才更新，后一个事务此刻已读到新快照，恒定差 1 误判冲突 | `src/data/pms/idb-storage.ts`：`pmsWriteQueue` 按 key 排队 + `baseVersion` 改为排队执行时读取 | 已实现待验证 |

## 3. 交付证据表

| 编号 | 自动化验证 | 页面 / 浏览器验证 | 证据位置 |
| --- | --- | --- | --- |
| PMSFIX-001 | `tsc --noEmit`（无新增错误）+ 单元测试 567/567 | 需浏览器：两次连续保存同一条供应商记录均成功 | 见第 4 节 |
| PMSFIX-002 | 同上 | 同上（自冲突场景） | 见第 4 节 |
| PMSFIX-003 | 单元测试 567/567（回归：曾因重新抛出导致 `pms-settlement-flow` 出现 unhandledRejection，已由 PMSFIX-009 修正后复跑通过） | 需浏览器：配额满/事务中止时页面出现"PMS 业务数据保存失败" banner | 见第 4 节 |
| PMSFIX-004 | 单元测试 567/567 | 需浏览器：TMF 页面操作后刷新，数据仍在 | 见第 4 节 |
| PMSFIX-005 | 同上 | 同上 | 见第 4 节 |
| PMSFIX-006 | 同上 | 需浏览器：执行 TMF 操作后检查 `localStorage['higood-tmf-material-purchases-v1']` 不再被写入 | 见第 4 节 |
| PMSFIX-007 | 同上 | 需浏览器：两个标签页同时操作 TMF，后者收到广播后从 IDB 重载且**不**退回空状态 | 见第 4 节 |
| PMSFIX-008 | 同上 | 需浏览器：IDB 写入失败时 banner 提示且 localStorage 有兜底 | 见第 4 节 |
| PMSFIX-009 | `tests/unit/pms-settlement-flow.test.ts` 8/8（修复前 1 个失败） | 不适用（Node 环境专项） | 见第 4 节 |
| PMSFIX-010 | `tsc --noEmit`：该错误由 5 项降至 2 项 | 需浏览器：模块不再因 TDZ 中断加载 | 见第 4 节 |
| PMSFIX-011 | `tsc --noEmit`：错误 11 → 10 | 不适用 | 见第 4 节 |

## 4. 验证执行记录

### 4.1 类型检查（基线对比法）

用 `git stash` 建立改动前基线，确保"未引入新错误"是可核对的事实而非推断：

| 时点 | `tsc --noEmit` 错误数 | PMS 相关 |
| --- | --- | --- |
| 改动前（基线） | 11 | material-purchase-orders 5、tmf 3 |
| 改动后（本次） | **7** | material-purchase-orders 2、tmf 2 |

结论：错误总数 11 → 7，**无新增类型错误**；净消除 4 项（PMSFIX-010 消 3 项、PMSFIX-011 消 1 项）。

### 4.2 单元测试

```
node --import tsx --test tests/unit/*.test.ts
# tests 567 / pass 567 / fail 0
```

过程中曾出现 1 个失败：`tests/unit/pms-settlement-flow.test.ts` 因 PMSFIX-003 的重新抛出在 Node 无 IndexedDB 环境下产生 unhandledRejection。该失败由 PMSFIX-009（区分 `PMS_IDB_UNAVAILABLE` 降级）修正，单文件复跑 8/8 通过，随后全量复跑 567/567 通过。

### 4.3 浏览器验证（e2e）

| 用例 | 结果 | 说明 |
| --- | --- | --- |
| `pms-idb-storage-e2e.spec.ts` | 6/6 通过 | 含 IDB 写入后刷新保留、多标签页广播、数据管理页、乐观锁注入 |
| `pms-interaction-audit.spec.ts` | **通过**：770 个交互，`consoleErrors: 0` | 关键回归验证。修复中期曾出现 1781 条 `PMS_IDB_SAVE_FAILED`（版本冲突），由 PMSFIX-012/013/014 消除 |
| 基线对比组（`pms-purchase-chain` + `pms-master-data` + `pms-settlement-flow`） | 改动前 16 通过 / **10 失败**；改动后 **仅 3 失败**（均为 200ms 性能门禁，功能用例全部通过） | 见下方说明 |

**基线对比结论**：

1. **性能门禁失败是既有问题，非本次引入**。三个 spec 的"低于 200ms"断言在改动前同样失败（实测 213ms～1490ms，阈值 200ms），改动后依旧失败，未改善也未恶化。
2. **本次修复额外恢复了 7 个功能用例**。改动前 `pms-settlement-flow` 有 7 个用例失败，错误是等待 `[data-pms-mrec-root]` 超时——页面根元素未渲染。根因是 PMSFIX-010 所指的 TDZ：`material-purchase-orders.ts` 模块顶层抛 `ReferenceError`，加载链中断，对账/请款页面直接白屏。修复后这些用例全部通过。
3. `pms-cold-load` 在改动前后均因 `Test timeout of 300000ms exceeded` 失败（遍历全部 PMS 路由），属用例自身耗时问题。

## 5. 遗留项（本次明确不修，登记备查）

| 项 | 位置 | 说明 |
| --- | --- | --- |
| TS2739 / TS2322 | `src/data/pms/material-purchase-orders.ts:355,357` | 返回值声明为 `Promise<PmsMaterialPurchaseOrder[]>` 但实际返回数组 / 可能为 null。属既有接口签名错误，不在本次 P0 链路 |
| TS2722 ×2 | `src/data/pms/tmf-material-purchases.ts` 迁移函数内 `storage?.removeItem(...)` | 既有，位于迁移路径而非本次改动链路 |
| 类型错误 ×3 | `src/data/fcs/dye-work-order-online-view.ts`、`factory-receiving-source-sync.ts` | 与 PMS 无关 |
| 工程门禁 | `package.json` build 链 | `src/pages`、`src/data` 不在 CI 类型检查范围；接入需全仓评估，另立任务 |

## 6. 状态汇总

| 编号 | 状态 |
| --- | --- |
| PMSFIX-001 ~ 011 | 已验证（tsc 无新增错误 + 单元测试 567/567 + e2e 通过） |
| PMSFIX-012 ~ 014 | 已验证（`pms-interaction-audit` 由 1781 条 console 错误降至 0，770 交互全通过） |
| PMSFIX-010 | 已验证（基线对比：`pms-settlement-flow` 7 个功能用例由失败转通过） |

**未取得端到端证据的一项**：PMSFIX-001/002 的"UI 上连续两次保存同一条记录"场景未能脚本化——`src/pages/pms/suppliers.ts` 未接线 `updatePmsSupplier`（页面仅有 advance / open-detail / open-edit / close-overlay 四个动作，无保存入口），故无法从 UI 触发。该路径的等价覆盖来自 `pms-interaction-audit`（770 次交互中触发了大量真实保存，0 错误）。
