# 裁床中转袋对抗式缺口修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 按首次对抗式审核的顺序修复 PDA 装袋、入仓、仓管导航、根页旧信息和交出纠错缺口，并以第二轮自动化与真实浏览器对抗式审查通过作为完成条件。

**架构：** 继续使用 Vanilla TypeScript 字符串模板和页面内本地 Mock 状态。只在裁床中转袋原型相关页面建立轻量袋、菲票和库位台账，不接 API、不写事件账、不扩展到其他模块；扫码、确认和成功后的状态变化都通过可测试的纯函数表达。

**技术栈：** Vite、TypeScript、Tailwind CSS、Node `assert` 检查脚本、Playwright CLI。

---

## 文件职责

- `src/pages/pda-cutting-inbound.ts`：PDA 菲票装袋、中转袋入仓页面、本地 Mock 台账、扫码与确认防错。
- `src/pages/pda-cutting-wait-handover-actions.ts`：五个仓管操作入口及路由。
- `src/pages/pda-warehouse-wait-handover.ts`：待交出仓五入口根页，不再展示候选袋或旧流程卡。
- `src/pages/pda-cutting-handover.ts`：整袋交出和确认前车缝任务纠错。
- `scripts/check-pda-cutting-inbound-workflow.ts`：袋、菲票、库位状态与跨轮次回归。
- `scripts/check-pda-cutting-wait-handover-entry-routing.ts`：快速路由契约、返回地址、纯五入口源码约束和 legacy 解析回归，不执行页面渲染。
- `scripts/check-pda-cutting-wait-handover-route-integration.ts`：建立 PDA 登录态并通过真实 `resolvePage` 覆盖根页、新深链、legacy 跳转和跳转目标渲染。
- `scripts/check-pda-cutting-transfer-bag-handover.ts`：交出任务改扫、手动清空任务 / 袋、最终绑定和重复交出回归。
- `docs/prototype-review-records/2026-07-27-cutting-transfer-bag-whole-flow.md`：以实际复验结果更新审查结论。

### 任务 1：补齐装袋与入仓状态防错

**文件：**
- 修改：`src/pages/pda-cutting-inbound.ts`
- 修改：`scripts/check-pda-cutting-inbound-workflow.ts`

- [x] **步骤 1：用实际导出函数编写失败测试**

`scripts/check-pda-cutting-inbound-workflow.ts` 直接加载并检查以下生产函数：

- `createPdaCuttingInboundMockLedger`：生成袋、菲票和库位台账。
- `applyPdaCuttingInboundBusinessTransition`：执行装袋 / 入仓纯台账迁移。
- `completePdaCuttingInboundTicketScan`：校验菲票并把结果写回同一轮表单状态。
- `confirmPdaCuttingInboundRound`：按最新扫描状态编排确认，失败保留输入且不改台账。
- `createPdaCuttingInboundScanTimerController`：覆盖自然 timeout、确认前 flush、取消与旧轮次回调。

- [x] **步骤 2：运行测试并确认红灯**

运行：

```bash
npm run check:pda-cutting-inbound-workflow
```

红灯原因：原实现缺少袋 / 菲票 / 库位台账迁移，且自然 timeout 的失败状态、确认前 pending 扫描和跨轮次重复菲票未形成闭环。

- [x] **步骤 3：实现实际本地 Mock 台账与确认编排**

`createPdaCuttingInboundMockLedger` 使用实际内部状态 `EMPTY_READY`、`BAGGED_WAIT_INBOUND`、`INBOUNDED`、`HANDED_OVER`、`VOIDED` 和菲票状态 `READY_FOR_BAGGING`、`BAGGED`、`VOIDED`。`applyPdaCuttingInboundBusinessTransition` 在成功装袋后更新袋与菲票归属，在成功入仓后更新袋状态与裁床库位；失败返回原台账。

`confirmPdaCuttingInboundRound` 会阻断自然 timeout 或 flush 后的失败菲票状态以及尚未完成的 pending 输入；失败保留袋、既有有效菲票和库位，成功才清空当前轮。自然 timeout 执行后 timer 必须从 controller 删除，同时把 `lastTicketScanStatus` 写为 `invalid`。

- [x] **步骤 4：运行测试确认绿灯**

运行：

```bash
npm run check:pda-cutting-inbound-workflow
```

结果：通过，覆盖不存在 / 非空袋、同轮与跨轮重复菲票、作废 / 已装袋菲票、空袋 / 已入仓 / 已交出 / 已作废袋、无效 / 停用 / 非裁床库位、重复入仓，以及自然 timeout 与确认竞态。

### 任务 2：修正仓管上下文和根页聚焦

**文件：**
- 修改：`src/pages/pda-cutting-inbound.ts`
- 修改：`src/pages/pda-cutting-wait-handover-actions.ts`
- 修改：`src/pages/pda-warehouse-wait-handover.ts`
- 修改：`scripts/check-pda-cutting-wait-handover-entry-routing.ts`
- 新增：`scripts/check-pda-cutting-wait-handover-route-integration.ts`

- [x] **步骤 1：编写快速路由契约检查**

`check:pda-cutting-wait-handover-entry-routing` 只做快速契约与源码约束：

- 校验 `routes-pda` 根路由和入仓动态路由注册。
- 校验生产五入口恰好五项、固定深链及五个 legacy action 的解析目标。
- 校验装袋 / 入仓生产页固定返回 `/fcs/pda/warehouse/wait-handover?scope=cutting`。
- 校验根页组合生产五入口且源码不再包含候选袋、混装、暂存袋和旧「交出装袋确认」链。
- 明确禁止该快速脚本导入待交出仓页面或调用 `resolvePage`；它不直接断言运行时 `activeTab`。

- [x] **步骤 2：运行测试并确认红灯**

运行：

```bash
npm run check:pda-cutting-wait-handover-entry-routing
```

红灯原因：原返回地址、根页旧内容和 legacy 入口未同时满足新的生产路由契约。

- [x] **步骤 3：实现纯五入口并补独立真实路由集成**

装袋与入仓页通过生产布局进入仓管上下文并固定返回裁床待交出仓根页；根页只保留仓库切换和五个动作按钮，移除候选袋列表、混装信息、暂存袋和旧「交出装袋确认」展示。

独立 `check:pda-cutting-wait-handover-route-integration` 同步 `window.location`、建立有效 PDA 登录态，再逐条通过真实 `resolvePage` 验证根页、五个新深链、五个 legacy 重定向及最终页面关键内容。legacy 跳转使用有界条件等待，同时校验浏览器地址与 `appStore` 地址。

- [x] **步骤 4：运行测试确认绿灯**

运行：

```bash
npm run check:pda-cutting-wait-handover-entry-routing
npm run check:pda-cutting-wait-handover-route-integration
```

结果：快速契约通过且冷启动约 0.8 秒；独立真实路由集成通过且约 19–20 秒。真实集成不进入日常 `check:cutting:all`，而是进入 `check:cutting:release`。

### 任务 3：允许交出确认前纠正车缝任务

**文件：**
- 修改：`src/pages/pda-cutting-handover.ts`
- 修改：`scripts/check-pda-cutting-transfer-bag-handover.ts`

- [x] **步骤 1：用生产扫描函数编写失败测试**

使用实际 `completePdaTransferBagHandoverScan` 覆盖确认前任务纠错：

```ts
const first = completePdaTransferBagHandoverScan(bagState, 'sewingTaskCode', 'SEW-PO-202603-0102-01', candidates)
const corrected = completePdaTransferBagHandoverScan(first.state, 'sewingTaskCode', 'SEW-PO-202603-0102-02', candidates)
assert.equal(corrected.ok, true)
assert.equal(corrected.state.sewingTaskNo, 'SEW-PO-202603-0102-02')
```

同时保留“袋已在台账绑定其他任务”必须阻断的断言。

- [x] **步骤 2：运行测试并确认红灯**

运行：

```bash
npm run check:pda-cutting-transfer-bag-handover
```

红灯原因：原实现把未确认任务草稿误判为已绑定，阻断同一生产单的有效纠错。

- [x] **步骤 3：实现草稿覆盖与手动清空**

允许同一待交出袋在确认前重新扫描同生产单、可接收的车缝任务，并覆盖任务号、生产单号和接收工厂草稿；跨生产单、不可接收任务和袋台账已有其他 `boundSewingTaskNo` 时阻断。

提交 `8185e50b` 补齐事件与 DOM 回归：

- 任务输入从 pending 值手动清空后，取消等待扫描，清除任务 / 生产单 / 接收工厂 / 旧反馈，但保留袋与袋内菲票数量；确认必须提示重新扫描任务。
- 袋输入从 pending 值手动清空后，取消等待扫描并重置整轮，同时清空任务输入与全部派生信息；确认必须提示重新扫描中转袋。
- 清空后的迟到 timer 不得把旧值写回输入、状态或 live 区。
- 只有确认成功后才写入最终 `boundSewingTaskNo` 并把袋更新为「已交出」，随后阻断换绑与重复交出。

- [x] **步骤 4：运行测试确认绿灯**

运行：

```bash
npm run check:pda-cutting-transfer-bag-handover
```

结果：通过，纯函数纠错、已绑定阻断、事件输入同步、任务清空、袋清空、成功绑定和重复交出均有回归。

### 任务 4：补齐自动化治理记录与发布门禁

**文件：**
- 修改：`docs/prototype-review-records/2026-07-27-cutting-transfer-bag-whole-flow.md`
- 纳入验证：任务 1 至任务 3 的检查脚本、独立真实路由集成脚本和 release 编排

- [x] **步骤 1：逐项运行自动检查与治理**

```bash
npm run check:pda-cutting-inbound-workflow
npm run check:pda-cutting-wait-handover-entry-routing
npm run check:pda-cutting-wait-handover-route-integration
npm run check:pda-cutting-transfer-bag-handover
npm run check:web-cutting-transfer-bag-actions
npm run check:prototype-design-governance -- --all
npm run check:list-page-governance
npm run build
npm run check:cutting:release
```

结果口径：

- fast 路由契约、独立真实路由集成、三项 PDA、Web、治理、列表页和构建通过。
- `check:cutting:release` 已固定先执行真实路由集成，再执行日常 `check:cutting:all`。
- release 中真实路由集成通过，随后日常聚合被未改动的 `production-order-overview-view.ts: min-w >= 1600px` 既有基线阻断；不得写成 `check:cutting:all` 全绿。

- [x] **步骤 2：更新审查记录**

审查记录只关闭自动检查能够证明的“不存在袋、重复菲票、非法库位、仓管返回、纯五入口、交出任务纠错 / 清空和确认后绑定”问题；撤回原第一次审查中失真的浏览器通过结论，不勾选、不暗示任务 5 已完成。

### 任务 5：第二轮对抗式审查

**文件：**
- 不预设生产代码修改；发现问题则返回对应任务修复并重新审查。

**当前状态：未执行。以下步骤全部保持未勾选；任务 4 的自动化 / 治理通过不能替代本任务的真实浏览器证据。**

- [ ] **步骤 1：启动局域网可访问的 Vite**

```bash
npm run dev -- --host 0.0.0.0 --port 4178
```

- [ ] **步骤 2：使用 Playwright CLI 攻击性操作**

必须验证：

```text
不存在袋不能装袋
同一菲票跨轮次不能重复装袋
空袋、已入仓袋、已交出袋不能入仓
不存在或停用库位不能入仓
装袋和入仓位于仓管 Tab，返回五入口根页
根页只有五个操作入口，不出现混装或交出装袋确认
确认交出前可改扫同生产单车缝任务
已实际绑定其他任务的袋仍不能换绑
成功装袋、入仓、交出后重复提交均被阻断
```

- [ ] **步骤 3：复跑全量相关门禁**

运行：

```bash
npm run check:cutting:all
```

若仅剩确认过的既有无关基线失败，必须单独报告，不能写成全部通过。

- [ ] **步骤 4：最终结论**

只有自动检查、真实浏览器复验、规格审查和代码质量审查均无未关闭的 Critical / Important 问题，才能声明修复完成。
