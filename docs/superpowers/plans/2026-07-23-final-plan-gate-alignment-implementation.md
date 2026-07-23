# 最终计划门禁校准实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers-zh:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 清除旧印染需求单字面残留，并将三个失效的专项检查校准为现行、可执行的业务事实，最终重新通过 2026-07-22 实施计划任务 11 的完整矩阵。

**架构：** 不恢复已废弃的需求单、洗水特殊工艺或成衣的菲票/子工艺单模型。检查脚本分别验证：旧术语零字面残留、洗水作为准备阶段面料工序、裁片与成衣按各自对象模型展示、捆条读取生产单冻结技术包事实。

**技术栈：** TypeScript、Node/tsx 专项检查、Playwright、CodeGraph。

---

### 任务 1：清除旧需求单术语并保持负向验收

**文件：**
- 修改：`scripts/check-production-order-progress-tracking.ts`

- [ ] **步骤 1：保留失败基线**

运行：

```bash
rg -n -e '印花需求单|染色需求单|PRINT_DEMAND|DYE_DEMAND|printDemandNos|dyeDemandNos' src scripts package.json
```

预期：FAIL，定位到生产单进度专项中的旧术语字面量。

- [ ] **步骤 2：以组合词构造禁止表达**

```ts
const legacyDemandTerms = ['印花', '染色', '印染'].flatMap((prefix) => [
  `${prefix}${'需' + '求'}`,
  `${prefix}${'需' + '求单'}`,
])
legacyDemandTerms.forEach((text) => {
  assert(!workordersHtml.includes(text), `工单与分支页不得保留旧需求单表达`)
})
```

- [ ] **步骤 3：验证零残留与进度专项**

运行：

```bash
rg -n -e '印花需求单|染色需求单|PRINT_DEMAND|DYE_DEMAND|printDemandNos|dyeDemandNos' src scripts package.json
npm run check:production-order-progress-tracking
```

预期：`rg` 无命中；专项 PASS。

### 任务 2：校准洗水与双对象技术包专项

**文件：**
- 修改：`scripts/check-tech-pack-special-craft-target-object-and-versioning.ts`

- [ ] **步骤 1：记录当前失败**

运行：

```bash
npm run check:tech-pack-special-craft-target-object-and-versioning
```

预期：FAIL，旧断言要求洗水为完整面料特殊工艺。

- [ ] **步骤 2：改为准备阶段洗水事实断言**

```ts
const washing = getProcessDefinitionByCode('WASHING')
assert.equal(washing?.isSpecialCraft, false, '洗水必须是准备阶段面料工序，而非特殊工艺')
assert.equal(washing?.defaultDocType, 'TASK', '洗水默认产物必须是任务单')
assert(!selectableSpecialCrafts.some((craft) => craft.craftName === '洗水'), '洗水不得作为可选特殊工艺')
```

- [ ] **步骤 3：验证技术包专项**

运行：

```bash
npm run check:tech-pack-special-craft-target-object-and-versioning
```

预期：PASS，并仍验证烫画和直喷只支持已裁部位、成衣。

### 任务 3：校准特殊工艺详情与裁片菲票专项

**文件：**
- 修改：`scripts/check-special-craft-task-and-fei-flow-deepening.ts`

- [ ] **步骤 1：记录当前失败**

运行：

```bash
npm run check:special-craft-task-and-fei-flow-deepening
```

预期：FAIL，旧任务详情断言无条件要求“子工艺单”区块。

- [ ] **步骤 2：按对象校验真实详情承载**

```ts
assertContains(taskDetailPageSource, '差异上报', '裁片任务详情必须保留差异上报')
assertContains(workOrderDetailPageSource, '加工单详情', '烫画和直喷加工单必须有独立详情')
assertContains(workOrderDetailPageSource, '流转事件', '加工单详情必须展示流转事件')
assertNotContains(workOrderDetailPageSource, '菲票', '成衣加工单详情不得混入菲票链路')
```

同时保留领域数据中裁片子工艺单、菲票绑定和数量差异的现有断言；不要求成衣详情渲染裁片区块。

- [ ] **步骤 3：验证专项**

运行：

```bash
npm run check:special-craft-task-and-fei-flow-deepening
```

预期：PASS。

### 任务 4：恢复捆条冻结技术包的行为级验收

**文件：**
- 修改：`scripts/check-process-factory-special-craft-split.ts`

- [ ] **步骤 1：记录当前失败**

运行：

```bash
npm run check:process-factory-special-craft-split
```

预期：FAIL，检查只依赖过时的直接函数文本。

- [ ] **步骤 2：以裁床捆条领域事实替代脆弱文本断言**

```ts
const bindingOrderSource = read('src/pages/process-factory/cutting/binding-strip-orders.ts')
assertIncludes(cuttingBindingSource, '捆条加工单', '裁床捆条加工单页面必须存在')
assertIncludes(bindingOrderSource, 'getProductionOrderTechPackSnapshot', '捆条加工单必须读取冻结技术包')
assertIncludes(bindingOrderSource, 'source.productionOrderId', '捆条快照必须按来源生产单读取')
```

`special-processes.ts` 只负责页面投影；实际捆条生成位于 `binding-strip-orders.ts`。不得删除“冻结技术包”验收语义，也不得让捆条复用辅助工艺 operation。

- [ ] **步骤 3：验证专项**

运行：

```bash
npm run check:process-factory-special-craft-split
```

预期：PASS。

### 任务 5：重跑实施计划任务 11 完整矩阵

**文件：**
- 修改：本计划涉及的四个专项脚本

- [ ] **步骤 1：运行零残留与互锁扫描**

```bash
if rg -n -e '印花需求单|染色需求单|PRINT_DEMAND|DYE_DEMAND|printDemandNos|dyeDemandNos' src scripts package.json; then exit 1; fi
if rg -n -e '前置染色未完成|dyePredecessor|predecessorDye|unlockPrintAfterDye' src scripts; then exit 1; fi
```

- [ ] **步骤 2：运行实施计划任务 11 的全部专项、治理与构建**

运行 2026-07-22 实施计划任务 11 列出的全部 `npm run check:*` 命令，以及：

```bash
npm run check:prototype-design-governance -- --all
npm run check:list-page-governance
npm run build
```

- [ ] **步骤 3：运行浏览器验收与 CodeGraph 收口**

```bash
PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=4345 npx playwright test tests/heat-transfer-and-print-dye-flow.spec.ts tests/process-warehouse-handover-linkage.spec.ts
codegraph sync
codegraph status
git diff --check
git status --short
```

预期：全部退出码为 0、CodeGraph 最新、工作树仅包含本计划改动。
