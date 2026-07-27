# 裁床中转袋对抗式缺口修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers-zh:subagent-driven-development` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

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

- [x] **步骤 2：历史红灯证据**

运行：

```bash
npm run check:pda-cutting-inbound-workflow
```

这是历史 TDD 证据，当前 HEAD 已为绿灯，不能通过现在重跑同一命令期待复现红灯。实现前 SHA 为 `e2eaba12c5225268a9d4f4a4f1d105601a8b9073`；当时缺少袋 / 菲票 / 库位台账迁移，自然 timeout 的失败状态、确认前 pending 扫描和跨轮次重复菲票未形成闭环。

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

- [x] **步骤 2：历史红灯证据**

运行：

```bash
npm run check:pda-cutting-wait-handover-entry-routing
```

这是历史 TDD 证据，当前 HEAD 已为绿灯。入口导航修复前 SHA 为 `146fa93024cd396f33bb24af6f3dfa36cfcab61a`；当时返回地址、根页旧内容和 legacy 入口未同时满足新的生产路由契约。后续 fast / integration 分层是对覆盖边界的加强，不要求当前 fast 命令再次变红。

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

- [x] **步骤 2：历史红灯证据**

运行：

```bash
npm run check:pda-cutting-transfer-bag-handover
```

这是历史 TDD 证据，当前 HEAD 已为绿灯。任务草稿覆盖修复前 SHA 为 `5c8ff61b700831f2c195009f400ec1dbd6e96114`，失败摘要为「未确认草稿被误判为已绑定，阻断同生产单有效纠错」；清空事件修复前 SHA 为 `a2d9e8a7cd9bffd2c18451b811bdfe861111ccc7`，失败摘要为「输入清空后 pending timer 仍可能把旧任务 / 袋写回状态和 DOM」。

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

使用账号 `F090_operator`、密码 `123456` 登录 PDA。每个会改变本地 Mock 台账的成功场景使用新的浏览器 context 或硬刷新重新开始，避免上一场景消费袋 / 菲票后污染下一场景。

- [ ] **步骤 2：确认源码 Mock 与固定路由**

固定路由：

- PDA 根页：`/fcs/pda/warehouse/wait-handover?scope=cutting`
- PDA 装袋：`/fcs/pda/cutting/inbound/TASK-CUT-PDA-NO-PICKUP-0301`
- PDA 入仓：`/fcs/pda/cutting/inbound/TASK-CUT-PDA-NO-PICKUP-0301?action=inbound-location`
- PDA 交出：`/fcs/pda/cutting/handover/TASK-CUT-PDA-NO-PICKUP-0301?action=transfer-bag-handover`
- Web：`/fcs/craft/cutting/warehouse-management/wait-handover`

PDA 装袋 / 入仓当前源码 Mock：

- 可装袋空袋：`BAG-001`、`BAG-002`。
- 可装袋菲票：`FT-CUT-260307-102-01-001`、`FT-CUT-260307-102-01-002`、`FT-CUT-260307-102-02-017`。
- 可入仓袋：`BAG-WAIT-001`；有效裁床库位：`CUT-A-01`。
- 状态无效袋：`BAG-IN-001`（已入仓）、`BAG-HAND-001`（已交出）、`BAG-VOID-001`（已作废）。
- 状态无效菲票：`FT-DEMO-BAGGED-001`（已装袋）、`FT-DEMO-VOID-001`（已作废）。
- 无效库位：`CUT-X-99`（停用）、`SEW-A-01`（非裁床库位）。
- 自动检查固定的不存在输入：`BAG-NOT-FOUND`、`CUT-NOT-FOUND`；它们不是候选 Mock，专用于验证「不存在」提示。

PDA 交出当前源码 Mock：

- 可交出且未绑定袋：`TB-CUT-260727-001`。
- 同生产单可接收任务：`SEW-PO-202603-0102-01`、`SEW-PO-202603-0102-02`。
- 已绑定袋：`TB-CUT-260727-002`，已绑定 `SEW-PO-202603-0102-02`。
- 状态无效袋：`TB-CUT-260727-003`（已交出）、`TB-CUT-260727-VOID`（已作废）。
- 不可接收任务：`SEW-PO-202603-0103-01`；自动检查固定未知任务输入：`UNKNOWN-TASK`。

Web 当前源码 Mock：

- 装袋：`WEB-BAG-001` + `WEB-FEI-001` / `WEB-FEI-002`；`WEB-FEI-003` 属于另一生产单，可用于混单阻断。
- 入仓：`WEB-BAG-002` + `裁床仓 A-01`。
- 交出：`WEB-BAG-003` + `SEW-TASK-001`；`WEB-BAG-004` + `SEW-TASK-001` 用于跨生产单阻断。
- 其他无效场景：`WEB-BAG-DONE`（已交出）、`SEW-TASK-CLOSED`（不可接收）。

- [ ] **步骤 3：使用 Playwright CLI 做三分辨率攻击性操作**

视口必须覆盖：

- Web 标准：1366×768。
- Web 最低：1280×720。
- PDA 小屏：390×844。

逐项验证：

- 根页恰好五个入口，仓管 Tab / 返回根页正确，不出现候选袋、混装、暂存袋或「交出装袋确认」。
- PDA 装袋：不存在袋、已装袋 / 已作废菲票、同票跨轮重复、跨生产单均阻断；成功显示「装袋成功」并清空，重复提交仍被阻断。
- PDA 入仓：空袋、已入仓 / 已交出 / 已作废袋、停用 / 非裁床 / 不存在库位均阻断；成功显示「入仓成功」并清空，重复入仓阻断。
- PDA 交出：确认前可从 `SEW-PO-202603-0102-01` 改扫为 `SEW-PO-202603-0102-02`；清空任务保留袋并清除任务派生信息，清空袋重置整轮；已绑定袋不能换绑；成功显示「交出成功」，重复扫描 / 确认阻断。
- Web 在 1366×768 和 1280×720 分别覆盖「菲票装袋」「中转袋入仓」「中转袋交出」三操作的成功清空与至少一个失败保留场景。
- 每个路由记录 `console.error` / `pageerror`，预期均为空；检查 `document.documentElement.scrollWidth <= document.documentElement.clientWidth`，页面级无横向溢出；当前操作主按钮在视口内可见。
- 截图统一保存到 `output/playwright/`，文件名包含端、分辨率、路由动作和成功 / 失败场景。

性能必须用浏览器内 `performance.now()` 或 Performance API 测量，而不是用 Node 计时。输入准备完成后，在同一次 `page.evaluate` 中记录确认按钮点击前时间，以 MutationObserver / `requestAnimationFrame` 等待结果 DOM 出现，再计算耗时：

- PDA 装袋：`[data-pda-cut-inbound-action="confirm"]` 到「装袋成功」DOM 更新。
- PDA 入仓：`[data-pda-cut-inbound-action="confirm"]` 到「入仓成功」DOM 更新。
- PDA 交出：`[data-pda-cut-handover-action="confirm-transfer-bag-handover"]` 到「交出成功」DOM 更新。
- 三项各至少测量一次，分别记录毫秒值，且都必须 `< 200 ms`；任一不满足不得把交互性能写为通过。

- [ ] **步骤 4：显式复跑专项门禁，再运行聚合 / release**

先逐条运行并保存每条命令的退出码和关键输出，不能只依赖 `check:cutting:all`：

```bash
npm run check:pda-cutting-inbound-workflow
npm run check:pda-cutting-transfer-bag-handover
npm run check:pda-cutting-wait-handover-entry-routing
npm run check:pda-cutting-wait-handover-route-integration
npm run check:web-cutting-transfer-bag-actions
npm run check:prototype-design-governance -- --all
npm run check:list-page-governance
npm run build
npm run check:cutting:release
npm run check:cutting:all
```

最后两条单独记录：`check:cutting:release` 应先执行真实路由集成，再进入日常聚合；若 release / all 仍仅被未改动的 `src/pages/process-factory/cutting/production-order-overview-view.ts: min-w >= 1600px` 既有基线阻断，必须原样记录命令、失败文件和断言，不能写成全绿。

证据清单必须包含：

- 每条命令、退出码、通过 / 失败摘要。
- 三个视口的截图路径（`output/playwright/`）。
- 每个成功 / 阻断场景的关键页面提示。
- 控制台 error / pageerror 结果、页面级横向溢出结果、主按钮可见性。
- 装袋 / 入仓 / 交出三项点击到结果 DOM 更新的毫秒值。

只有上述专项自动检查、release / all 基线记录、三分辨率真实浏览器复验、三项 `< 200 ms` 性能证据、规格审查和代码质量审查均无未关闭的 Critical / Important 问题，才能声明修复完成。
