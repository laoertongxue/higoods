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
- `scripts/check-pda-cutting-wait-handover-entry-routing.ts`：仓管上下文、返回地址和根页聚焦回归。
- `scripts/check-pda-cutting-transfer-bag-handover.ts`：交出任务改扫与最终绑定回归。
- `docs/prototype-review-records/2026-07-27-cutting-transfer-bag-whole-flow.md`：以实际复验结果更新审查结论。

### 任务 1：补齐装袋与入仓状态防错

**文件：**
- 修改：`src/pages/pda-cutting-inbound.ts`
- 修改：`scripts/check-pda-cutting-inbound-workflow.ts`

- [x] **步骤 1：编写失败测试**

在检查脚本中增加真实行为断言：

```ts
assert.equal(validateBaggingBag('NOT-A-REAL-BAG').ok, false)
assert.equal(validateBaggingBag('TB-CUT-260727-001').ok, true)
assert.equal(confirmBaggingRound(validRound).ok, true)
assert.equal(validateTicketForBagging('FT-CUT-260307-102-01-001').ok, false)
assert.equal(validateInboundBag('TB-CUT-260727-EMPTY').ok, false)
assert.equal(validateInboundLocation('RANDOM-NOT-A-LOCATION').ok, false)
assert.equal(confirmInboundRound(validInboundRound).ok, true)
assert.equal(validateInboundBag('TB-CUT-260727-001').ok, false)
```

- [x] **步骤 2：运行测试并确认红灯**

运行：

```bash
npm run check:pda-cutting-inbound-workflow
```

预期：因袋、跨轮次菲票或库位校验函数尚不存在或行为未实现而失败。

- [x] **步骤 3：实现最小本地 Mock 台账**

定义明确的袋、菲票和库位候选：

```ts
type InboundBagStatus = '空袋可装袋' | '已装袋待入仓' | '已入仓' | '已交出' | '已作废'
type InboundTicketStatus = '待装袋' | '已装袋' | '已作废'
type InboundLocationStatus = '可用' | '停用'
```

确认装袋成功时，把袋更新为“已装袋待入仓”，把本轮菲票更新为“已装袋”；确认入仓成功时，把袋更新为“已入仓”并记录有效库位。失败时保留当前输入。

- [x] **步骤 4：运行测试确认绿灯**

运行：

```bash
npm run check:pda-cutting-inbound-workflow
```

预期：通过，且覆盖不存在袋、重复菲票、空袋入仓、无效库位、重复入仓。

### 任务 2：修正仓管上下文和根页聚焦

**文件：**
- 修改：`src/pages/pda-cutting-inbound.ts`
- 修改：`src/pages/pda-warehouse-wait-handover.ts`
- 修改：`scripts/check-pda-cutting-wait-handover-entry-routing.ts`

- [x] **步骤 1：编写失败测试**

增加断言：

```ts
assert(pageSource.includes("activeTab: 'warehouse'"))
assert(pageSource.includes("backHref: '/fcs/pda/warehouse/wait-handover?scope=cutting'"))
assert(!rootHtml.includes('交出装袋确认'))
assert(!rootHtml.includes('混装：'))
assert(!rootHtml.includes('inboundTempBags.slice'))
```

- [x] **步骤 2：运行测试并确认红灯**

运行：

```bash
npm run check:pda-cutting-wait-handover-entry-routing
```

预期：现有执行 Tab、任务返回地址或根页旧卡片使检查失败。

- [x] **步骤 3：实现仓管返回和纯五入口根页**

装袋与入仓页面选中仓管 Tab，返回固定进入裁床待交出仓根页；根页只保留仓库切换和五个动作按钮，移除候选袋列表、混装信息和旧“交出装袋确认”展示。

- [x] **步骤 4：运行测试确认绿灯**

运行：

```bash
npm run check:pda-cutting-wait-handover-entry-routing
```

预期：通过。

### 任务 3：允许交出确认前纠正车缝任务

**文件：**
- 修改：`src/pages/pda-cutting-handover.ts`
- 修改：`scripts/check-pda-cutting-transfer-bag-handover.ts`

- [x] **步骤 1：编写失败测试**

增加场景：

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

预期：现有代码把未确认草稿误判为已绑定而失败。

- [x] **步骤 3：实现草稿覆盖**

允许同一待交出袋在确认前重新扫描同生产单、可接收的车缝任务，并覆盖当前草稿；仅当袋候选本身已有 `boundSewingTaskNo` 时阻断换绑。

- [x] **步骤 4：运行测试确认绿灯**

运行：

```bash
npm run check:pda-cutting-transfer-bag-handover
```

预期：通过。

### 任务 4：补齐治理记录和自动门禁

**文件：**
- 修改：`docs/prototype-review-records/2026-07-27-cutting-transfer-bag-whole-flow.md`
- 必要时修改：上述三个检查脚本

- [x] **步骤 1：逐项运行定向检查**

```bash
npm run check:pda-cutting-inbound-workflow
npm run check:pda-cutting-wait-handover-entry-routing
npm run check:pda-cutting-transfer-bag-handover
npm run check:web-cutting-transfer-bag-actions
npm run check:prototype-design-governance
npm run check:list-page-governance
npm run build
```

- [x] **步骤 2：更新审查记录**

只有在对应检查与浏览器复验真实通过后，才把“不存在袋、重复菲票、非法库位、仓管返回、根页旧卡片、交出任务纠错”写为已关闭；不得写入尚未验证的结论。

### 任务 5：第二轮对抗式审查

**文件：**
- 不预设生产代码修改；发现问题则返回对应任务修复并重新审查。

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
