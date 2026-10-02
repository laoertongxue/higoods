# PMS 模块代码评审报告

> 视角：资深前端工程师 · 代码质量与数据正确性评审
> 日期：2026-10-03
>
> **修复跟踪**：本报告 P0-1 ~ P0-5 已实施修复，实施与验证证据见
> `docs/2026-10-03-pms-p0-fix-matrix.md`。本报告的评审结论保持原样（历史事实），不随修复改写。

## 0. 评审元信息

| 项 | 值 |
| --- | --- |
| 分支 / HEAD | `workbuddy/main-d9b7fac9` @ `83bb8532`（与 `origin/main` 一致） |
| 代码范围 | `src/pages/pms/`（33 文件 / 15,107 行）、`src/data/pms/`（27 文件 / 12,878 行）、`src/data/pms/idb-storage.ts`、`src/utils/pms-export.ts`、`src/utils/pms-excel-import.ts` |
| 相关提交 | `645eeb86` 全量迁移 IndexedDB → `6da17a34` 乐观锁 suppliers → `a8ff9f06`/`92ffc4ec` 乐观锁扩 7 模块 → `05f6f18b` 错误码字典 |
| 依据规范 | `AGENTS.md` §2.4（浏览器存储）、§2.4.3（读写与失败处理）、§2.4.6（迁移） |

证据标记：**【已核实】** 表示评审人二次打开源码逐行确认；**【未复核】** 表示来自子代理扫描、未经评审人逐条验证，结论供参考。

---

## 1. 总体结论

PMS 是本项目工程质量**偏高**的模块：数据层 12,878 行做到**零 `any`、零 `@ts-ignore`**，错误处理统一走 `PmsDomainError` 并带语义化日志标签，静态种子数据与运行时状态严格隔离，事件系统统一收敛到 `main.ts` 的委托层——这些是多数原型项目做不到的。

但持久化层存在 **5 个 P0 级缺陷**，共同特征是**数据静默丢失**：用户看到"已保存"，实际未落盘，或刷新后读不回。其中最关键的是——**最近三个提交（6da17a34 / 92ffc4ec / a8ff9f06）实现的乐观锁，在当前代码状态下完全不可达**，即投入的工作量没有产生任何实际保护效果。

按原型项目的验收口径：**P0 必须修复，否则"数据已保存"是不可信的**；P1 可在下一迭代排期；P2 属风格与体验债。

| 维度 | 评级 | 核心依据 |
| --- | --- | --- |
| 架构分层 | B+ | pages / data / components 三层职责清晰，无 React 越界 |
| 类型安全 | A− | 0 `any`、0 `@ts-ignore`、0 `as any`；11 处 `!.`、1 处 `as never` |
| 持久化正确性 | **D** | 5 个 P0，乐观锁不可达，TMF 刷新丢数据 |
| 错误处理纪律 | B+ | 无空 `catch`，失败即抛；但 fire-and-forget 吞掉保存结果 |
| 页面可维护性 | C+ | 14 个 >150 行函数（最大 320 行），重复率约 21% |
| 渲染性能 | B− | 单次交互 6 次全表 filter；无分页压力数据 |
| 安全（XSS） | B | 无已验证利用面，但转义缺少强制约束 |
| 工程门禁 | **C** | `src/pages`、`src/data` 不在 CI 类型检查范围内 |

---

## 2. P0 — 数据正确性（必须修复）

### P0-1 乐观锁形成死锁，生产路径永不可达 【已核实】

**证据链**：

1. `idb-storage.ts:230` — 只有 entity 上 `_pmsBaseVersion` 是 `number` 才走乐观锁分支，否则退化 `pmsPut`：
   ```ts
   if (typeof value === 'object' && value !== null && '_pmsBaseVersion' in value && typeof value._pmsBaseVersion === 'number') {
     return pmsPutWithVersion(storeName, value, actor)
   }
   return pmsPut(storeName, value)          // :233
   ```
2. 唯一注入该字段的地方是 hydrate：`suppliers.ts:31`、`material-requirements.ts:82`、`bom-detail.ts:33`、`reconciliations.ts:46,51`，且全部带门槛：
   ```ts
   const version = await pmsGetEntityVersion(PMS_STORES.pmsSuppliers, supplier.supplierCode)
   if (version > 0) supplier._pmsBaseVersion = version   // suppliers.ts:31
   ```
3. `pmsGetEntityVersion` 读的是 `pmsVersionSnapshots`，而该 store **只有 `pmsPutWithVersion` 会写**（`idb-storage.ts:321`）。
4. `pmsPut`（普通写入，`:233` 路径）**不写快照**。

**结论**：空库 → 无快照 → hydrate 时 version=0 → 不注入字段 → 保存走 `pmsPut` → 仍不写快照 → 下次 hydrate 依然 version=0。循环闭合，乐观锁**永远不会被激活**。

**佐证**：`tests/pms-idb-storage-e2e.spec.ts:229` 是用**另一个手工事务预先塞入快照**才让冲突用例跑通的——测试绕过了生产路径。【未复核】

**影响**：三个提交实现的并发保护实际为零；`suppliers`、`bom-detail`、`material-requirements`、`reconciliations` 四个模块的多标签页写入无任何冲突检测。

**修复方向**：首次写入即创建快照。让 `pmsPut` 对已登记模块也 upsert 快照（version 从 0 → 1），或去掉 `if (version > 0)` 门槛改为"无快照则视为 version 0 并注入"。

---

### P0-2 乐观锁一旦激活，第二次保存必定自冲突并静默失败 【已核实】

`idb-storage.ts:319` 只把新版本写进**副本**：

```ts
const valueWithVersion = { ...value, _pmsBaseVersion: nextVersion } as T
entityStore.put(valueWithVersion)        // IDB 里是 N+1
snapStore.put({ snapshotKey, version: nextVersion, ... })
```

调用方传入的是**内存对象引用**（如 `suppliers.ts:60` 的 `supplier`），函数内展开成新对象，**内存对象的 `_pmsBaseVersion` 保持旧值 N**。

于是对同一对象第二次保存：内存 baseVersion=N，IDB lastVersion=N+1 → `idb-storage.ts:306` 判定冲突 → 抛 `PMS_IDB_VERSION_CONFLICT`。

而调用方是 fire-and-forget（`suppliers.ts:60-63`、`material-requirements.ts:110`、`bom-detail.ts:61`、`reconciliations.ts:79,91`），只 `console.error`。**UI 照常提示"已保存"，数据实际未落盘**——违反 §2.4.3.5。

**影响**：用户第二次编辑同一条供应商/对账行并保存，修改丢失且无感知。这是本次评审中危害最直接的缺陷。

**修复方向**：`pmsPutWithVersion` 成功后将 `nextVersion` 回写调用方对象（`Object.assign(value, { _pmsBaseVersion: nextVersion })`），或返回新版本号由调用方更新内存态。

---

### P0-3 TMF hydrate 因 `??` 与三元运算符优先级抛错，刷新即丢全部状态 【已核实】

`tmf-material-purchases.ts:602-605`：

```ts
const sections = {
  orders: ordersSection?.section ?? legacyData ? extractOrdersSection(legacyData!) : null,
  production: productionSection?.section ?? legacyData ? extractProductionSection(legacyData!) : null,
  ...
}
```

`??` 优先级**高于** `?:`，实际语义是：

```ts
(ordersSection?.section ?? legacyData) ? extractOrdersSection(legacyData!) : null
```

即：**只要新 section 存在，就无条件用 `legacyData` 去 extract**，与新 section 本身无关。

而 `legacyData` 在正常情况下恒为 `undefined`——旧 store `pmsTmfPurchaseState` 已从 `PMS_STORES` 移除，`:596` 的 `pmsGet` 必然抛错并被 `:598` 的空 catch 吞掉。

再看 `extractOrdersSection`（`:648`）第一行即解引用：

```ts
return { orders: s.orders, baseOrders: s.baseOrders, ... }   // :649
```

**触发路径**：用户在 TMF 里做过任意操作 → section 数据写入 IDB → 刷新页面 → hydrate 时 section 存在 → `extractOrdersSection(undefined!)` → TypeError → 被 `:619` 的 catch 仅 `console.error` → `state` 停在 `emptyState()`。

**影响**：TMF 模块的采购单、发料、报废、终止、操作日志，**每次刷新后全部读不回来**。这是功能性数据丢失，不是边缘场景。

**修复方向**：改为显式括号 `(ordersSection?.section ?? (legacyData ? extractOrdersSection(legacyData) : null))`，并把 4 个 `extractXxxSection` 的入参加 `?? emptyState()` 兜底。

---

### P0-4 TMF 以 localStorage 为事实源，IndexedDB 沦为异步旁路 【已核实】

`tmf-material-purchases.ts:875` + `:889-892` + `:894`：

```ts
if (typeof window !== 'undefined') state = undefined        // :875 每个动作都清空内存
...
const storage = getBrowserLocalStorage()
if (typeof window !== 'undefined' && (!storage || !writeBrowserStorageItem(storage, TMF_PURCHASE_STORAGE_KEY, JSON.stringify(draft)))) {
  throw new Error('本次未保存，数量未改变。请检查浏览器存储后使用原操作重试。')   // :891
}
state = draft                                              // :894
persistTmfPurchaseStateToIdb(draft).catch(...)             // :902 异步附带
```

配合 `current()`（`:816-837`）优先读 localStorage：内存被清空后，`current()` 一定从 localStorage 重建 state。

**问题**：

1. **事实源倒置**：localStorage 决定业务结果，IDB 只是"顺便写一份"，与 §2.4.1「业务数据存 IndexedDB」、§2.4.6「迁移完成删除旧键」直接冲突。§2.4.1 明确禁止用 localStorage 变相保存业务快照。
2. **IDB 写入失败用户无感**：localStorage 已写成功、内存已更新、函数正常返回，IDB 失败只在 `:904` 打日志。
3. **`:902-906` 的 `.catch` 内部再 `throw`** 产生新的 rejected Promise 且无人接管 → **必然 unhandledrejection**。注释 `:900` 称"失败抛错，unhandledrejection banner 暴露给用户"，但 banner 只能显示"出错了"，无法回滚已生效的 localStorage 与内存态。
4. **localStorage 配额满即业务中断**：即使 IDB 完全可用，`:891` 也会让整个操作失败。

**修复方向**：调换主次——内存 state 为权威，IDB 写入成功后再更新内存并删除 localStorage 键；localStorage 仅在 IDB 不可用时降级使用。

---

### P0-5 保存失败被 fire-and-forget 吞没，UI 谎报成功（全局模式） 【已核实】

所有 `persistXxx` 均为 `.catch(console.error)` 且**同步返回**：`suppliers.ts:60`、`material-requirements.ts:110`、`bom-detail.ts:61`、`reconciliations.ts:79,91`、`payment-requests.ts:82,93,104`、`product-purchase-orders.ts:48`、`supplier-confirmations.ts:46`、`inventory-monitor.ts:58,69`。

调用链是「同步改内存 → 异步写 IDB（不 await）→ 返回 → UI 渲染"已保存"」。违反 §2.4.3.4「必须等事务 `complete` 才显示保存成功」。

**影响**：任何 IDB 写入失败（配额、事务中止、隐私模式）都表现为"保存成功"，刷新后数据消失。

**修复方向**：让业务动作返回 Promise 并在页面层 await，用 pending / failed 三态驱动 UI；或在数据层集中维护"未保存队列 + 重试入口"（§2.4.3.5 要求保留可恢复输入与重试方式）。

---

## 3. P1 — 中等（建议本迭代排期）

### 3.1 存储层

| # | 问题 | 证据 | 状态 |
| --- | --- | --- | --- |
| P1-1 | 跨标签页冲突提示**永不触发**：`main.ts:265` 要求 `localAt !== undefined`，而 `__pmsHydratedAt` 唯一写入点是 `idb-storage.ts:204`（本标签页 put 成功后），hydrate 路径不写 | `main.ts:255` 注释称"hydrate 后也会填充"未实现 | 已核实 |
| P1-2 | `pmsGetVersionMap`（`idb-storage.ts:239`）是死代码：`payment-requests.ts:8` import 后全文件零调用 | grep 确认无调用点 | 已核实 |
| P1-3 | 主单与操作日志分属两个事务：`appendPmsLog`（`runtime.ts:186`）与 `persistPmsPaymentRequest` 各自独立 → 可能主单成功、日志失败，违反 §2.4.3.3 | `payment-requests.ts:499,515,543-555` | 未复核 |
| P1-4 | 无 IDB 版本升级路径：`PMS_IDB_VERSION` 恒为 1，`onupgradeneeded`（`idb-storage.ts:95-102`）只做 `if (!contains) create`；已移除的 `pmsTmfPurchaseState` 在老库里留下孤儿 store | — | 未复核 |
| P1-5 | 操作日志主键撞车：`runtime.ts:211` 用内存自增 `nextPmsSequence('PMSLOG', 6)`，hydrate 后未推进到最大值 → 重开页面后新日志从 `PMSLOG-000001` 起，`pmsPut` 直接覆盖历史日志 | `runtime.ts:130-138, 211` | 未复核 |
| P1-6 | `estimatePmsStorage` → `exportPmsDataBundle`（`idb-storage.ts:525-546, 612`）每次对全部 store `getAll` 并 `JSON.stringify` 两遍 | — | 未复核 |

### 3.2 页面可维护性

| # | 问题 | 证据 | 状态 |
| --- | --- | --- | --- |
| P1-7 | **单函数 320 行**：`handlePmsMaterialReconciliationsEvent` 从 `:435` 到 `:754`，是巨型 `if (action === 'xxx')` 链，分支间共享可变 `state` | 已核实（awk 定位函数边界） | 已核实 |
| P1-8 | 同类超长函数共 14 个（>150 行）：`logistics-reconciliations.ts:428`(309)、`material-purchase-orders.ts:484`(260)、`material-inventory.ts:458`(251)、`first-leg-shipments.ts:568`(212) | 未复核（抽样核实 1 个） | 部分核实 |
| P1-9 | 两个对账页高度雷同：`material-reconciliations.ts`(754 行) 与 `logistics-reconciliations.ts`(736 行) 有 **276 行完全一致**的行 | 已核实（`comm -12` 实测） | 已核实 |
| P1-10 | 整体重复率约 21%（3061 / 14296 非空行），典型为模块级 `state` 初始化样板 + 筛选栏三按钮，在 24 个文件中逐字重复 | 未复核 | 未复核 |

### 3.3 性能

| # | 问题 | 证据 | 状态 |
| --- | --- | --- | --- |
| P1-11 | `filteredRows()` 单次渲染被调用 **6 次**（`supplier-confirmations.ts:190/346/410/450/791/864`），每次全表 `filter` + 关键词 `concat` | 已核实；补充核实 `listPmsSupplierConfirmations()`(:290) 返回引用、**非**深拷贝，`getRuntime()`(:282) 有懒加载缓存 → 实际是 6×O(n) filter，不是 6×深拷贝，严重性**低于**初判 | 已核实（已修正） |
| P1-12 | `payment-requests.ts:218-262` 44 行人民币大写 while 循环在**模板渲染期**同步执行（`:275` 调用） | 未复核 | 未复核 |
| P1-13 | `supplier-confirmations.ts:241-272` canvas 绘制 + `toDataURL` 在事件处理里同步执行 | 未复核 | 未复核 |

### 3.4 导入导出

| # | 问题 | 证据 | 状态 |
| --- | --- | --- | --- |
| P1-14 | `pms-export.ts:23` `URL.revokeObjectURL(url)` 在 `link.click()` 后**立即**调用，慢速浏览器可能下载中断；`link` 未 append 到 DOM（Firefox 需要） | 未复核 | 未复核 |
| P1-15 | `pms-export.ts:16` `typeof document === 'undefined'` 时静默 `return`，调用方无反馈，违反"无可导出数据须明确反馈" | 未复核 | 未复核 |
| P1-16 | `pms-excel-import.ts:26` **逐字节倒扫**找 EOCD（最坏 O(n)）；`:24` `new DataView(bytes.buffer)` 忽略 `byteOffset`，subarray 视图会读错偏移；`:13` CSV 解析不处理转义引号，与导出转义规则**不对称** | 未复核 | 未复核 |

### 3.5 数值精度

量纲口径不统一且存在裸算 【未复核】：米数 3 位（`tmf-material-purchases.ts:863`）、金额 2 位（`:1327`）、单价 4 位（`:1328`），同一函数内两套精度；`subject-operations.ts:39-47` 连续 5 处硬编码费率裸乘（`* 0.3` / `* 0.5` / `* 0.12` …）。

---

## 4. P2 — 轻微与风格

- **`<option>` 未转义 69 处，但经抽样核实无实际利用面**：`material-archives.ts:154`、`first-leg-shipments.ts:239`、`kol-demands.ts:202` 的选项均来自**带字面量联合类型标注的硬编码数组**（`Array<'' | PmsMaterialCategory>`），非用户可控；且同一函数对动态数据（carrier）用了 `escapeHtml`（`first-leg-shipments.ts:240`）。真实风险低，但**同文件内标准不一致**本身就是隐患——建议统一走 helper，避免后来者复制硬编码写法去渲染动态数据。【已核实并下调严重级别】
- 已有 `dialog.ts / drawer.ts / toast.ts` 等组件，但 PMS 内 **64 处手写** `<div class="fixed inset-0 z-50...">`，遮罩层级与关闭逻辑各异。【未复核】
- 可访问性：全 PMS 仅 1 处 `.focus()`（`material-purchase-orders.ts:558`），弹窗无焦点转移与焦点陷阱；`shared.ts:190` 反馈条缺 `aria-live="polite"`。【未复核】
- `process-order-list-controller.ts:162-188` 注册 3 个 document 级监听且无清理路径（模块缓存使泄漏有界）。【未复核】
- `shared.ts:89/94` 使用内联 `onload="..."` 属性，CSP 不友好。【已核实，见 shared.ts】
- `settings.ts` 全部为可变导出常量，无任何持久化，用户改动刷新即失。【未复核】
- `tmf-material-purchases.ts` 存在风格断层：860-1820 行正常排版，`1568/1604/1630/2626-2632` 转为无空格压缩体，最长行 635 字符。【未复核】

---

## 5. 工程门禁：PMS 处于类型检查盲区 【已核实】

`package.json` 的 build 链：

```
build = typecheck:engineering && npm test && vite build
typecheck:engineering = typecheck:entrypoints + typecheck:scopes
```

- `tsconfig.engineering.json` 的 `files` 仅 5 个入口：`src/components/ui/index.ts`、`src/helpers/fcs-claim-dispute.ts`、`src/data/browser-storage.ts`、`src/main-infrastructure/retryable-module-loader.ts`、`src/router/path-match.ts`
- `typecheck:scopes` 仅覆盖 `src/domain/`、`src/components/ui/`、`src/state/`

**`src/pages/`（含 PMS 15,107 行）与 `src/data/`（含 PMS 12,878 行）完全不在 CI 类型检查范围内。**

全量 `tsc --noEmit`（根 `tsconfig.json` include `src/**/*.ts`）存在，但**未接入 build**。这直接解释了为什么 `tmf-material-purchases.ts:611/615` 的 `as never`、11 处非空断言 `!.` 能长期存活——包括 P0-3 里 `extractOrdersSection(legacyData!)` 这个本可被类型系统拦截的 `undefined!`。

**建议**：把 `npm run typecheck` 纳入 build；至少新增 `typecheck:pms` scope 覆盖 `src/pages/pms` + `src/data/pms`。这是**投入产出比最高**的一条改进——它能在未来自动拦住 P0-3 这类缺陷。

（注：当前工作树未安装 `node_modules`，`tsc` 不可用，本次未能执行全量类型检查实测。）

---

## 6. 值得肯定的设计

1. **类型纪律罕见地好**：数据层 12,878 行，0 `any`、0 `as any`、0 `@ts-ignore`，`Pms*` / `Tmf*` 前缀命名空间干净，无跨文件同名类型冲突。
2. **错误处理有纪律**：统一 `PmsDomainError`（336 处使用），失败即抛、不返回 `undefined` 冒充空数据；30+ 处带 `[PMS_IDB_LOAD_FAILED]` / `[PMS_IDB_SAVE_FAILED]` 语义标签，可检索；空 `catch` 仅 2 处且均有正当理由与注释。
3. **静态数据与运行时隔离**：`units.ts:59`、`materials.ts:181`、`suppliers.ts:144` 均用 `seeds.map(...)` 复制后暴露，符合 §2.4.1；TMF 的 `emptyState()` 全空，演示数据不落浏览器存储。
4. **事件系统收敛干净**：33 个页面文件中 `addEventListener` **零出现**，统一由 `main.ts` 的 root 级委托处理，重绘后无需重绑，无监听器堆叠泄漏；配合 `data-skip-page-rerender` 与 `captureFocusSnapshot`（含 `selectionStart/End`），焦点与滚动位置有保护。
5. **事务原语本身是正确的**：`pmsPutWithVersion`（`idb-storage.ts:290-326`）的 get 与 put **在同一 readwrite 事务内且中间无 await**，事务层面不存在 check-then-write 竞态；`pmsTx` 严格等 `oncomplete`，同步异常立即 `abort`。**问题出在版本字段的生命周期管理（P0-1/P0-2），不在事务实现。**
6. **连接管理良好**：单例 `dbPromise` + `onversionchange` 自动关闭，无连接泄漏；hydrate 的 pending 队列防竞态设计到位。

---

## 7. 修复路线图（按 ROI 排序）

**第一阶段 — 止血（P0，1-2 天）**

1. 修 `tmf-material-purchases.ts:602-605` 的运算符优先级 + extract 入参兜底 → 解除"刷新丢数据"。
2. `pmsPutWithVersion` 成功后回写内存 `_pmsBaseVersion` → 解除"第二次保存必失败"。
3. 首次写入即创建快照 / 放宽注入门槛 → 让乐观锁真正可达。
4. TMF 改为以内存 + IDB 为权威，localStorage 降级为 IDB 不可用时的回退并删除旧键。
5. 把 fire-and-forget 的 `.catch(console.error)` 收敛为统一的"未保存 + 重试"入口。

**第二阶段 — 门禁（0.5 天）**

6. 把 `tsc --noEmit` 或新增的 `typecheck:pms` 接入 build，让 PMS 不再裸奔。

**第三阶段 — 结构（按需排期）**

7. `tmf-material-purchases.ts`（2,789 行）按已有的 4-section 边界拆分：`types.ts` / `hydration.ts` / `operations-*.ts`。
8. 巨型事件函数按 action 拆成 handler map；两个对账页抽取共用 core。
9. 统一 `<option>` / 弹窗渲染 helper，64 处手写遮罩收敛到 `dialog.ts`。
10. `filteredRows()` 结果按渲染批次缓存一次。

---

## 8. 复核说明

- 本报告 P0 全部 5 条、P1-1/P1-2/P1-7/P1-9/P1-11、§5 工程门禁，均由评审人**逐行打开源码核实**。
- P1-3~P1-6、P1-8、P1-10、P1-12~P1-16、§4 多数条目来自子代理扫描，**未经评审人逐条验证**，引用时请二次确认。
- 两处代理结论已被评审人**下调严重级别**：§4 的 `<option>` 未转义（实为硬编码枚举，无利用面）、P1-11 的 `filteredRows` 重复（无深拷贝，getRuntime 有缓存）。
- 严重级别判定以"是否造成用户可感知的数据错误"为准，与代码量无关。
