# 水溶工序对抗式审查缺口修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复水溶功能对抗式审查发现的错误数据来源、任务二维码、单位、状态绕过、PDA 权限与交接防错缺口，使独立水溶和联合染色都真实遵守已确认业务规则。

**架构：** 保持正式技术包快照和 BOM 物料为唯一业务来源。字典覆盖 Mock 与真实加工任务彻底隔离；独立水溶继续使用水溶领域，联合水溶继续使用染色领域，但所有写入口统一执行状态、单位、工厂、角色、网络和扫码校验。FCS、PFOS、PDA 与通用交接只投影同一领域事实。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、Node/tsx 断言脚本、Playwright、现有水溶/染色/移动任务/通用交接领域。

---

## 一、文件结构与职责

### 修改文件

- `scripts/check-water-soluble-process.ts`
  - 增加真实仅水溶来源、字典 Mock 隔离、正式版本冻结、二维码、单位、零产出和节点顺序反例。
- `scripts/check-water-soluble-pda.ts`
  - 增加移动任务身份、单位、角色和交接扫码领域断言。
- `tests/water-soluble-pages.spec.ts`
  - 增加 FCS 跳转、PFOS 操作人和角色矩阵浏览器验证。
- `tests/water-soluble-pda.spec.ts`
  - 增加跨厂读取、离线交出、错误扫码、单位提示和联网重试验证。
- `src/data/pcs-technical-data-version-bootstrap.ts`
  - 提供真正来自正式技术包的“仅水溶”BOM 演示数据。
- `src/data/fcs/production-orders.ts`
  - 保证演示生产单冻结包含仅水溶 BOM 的正式快照，不在运行领域手工补单。
- `src/data/fcs/production-artifact-generation.ts`
  - 阻断缺单位 BOM 生成；字典覆盖 Mock 不冒充水溶业务产物。
- `src/data/fcs/water-soluble-task-domain.ts`
  - 只消费正式非 DICT 水溶产物；冻结正式版本；允许 0 产出进入暂停。
- `src/data/fcs/dyeing-task-domain.ts`
  - 重建动态任务二维码和审计事实；保留原单位；为后处理节点增加领域顺序校验；允许 0 产出进入暂停。
- `src/data/fcs/pda-handover-events.ts`
  - 联合染色最终交接使用权威原单位；提供水溶扫码允许值。
- `src/data/fcs/water-soluble-pda-actor.ts`
  - 对外提供页面和领域共享的角色判断。
- `src/pages/pda-exec-detail.ts`
  - 水溶详情先做工厂访问校验；数量提示显示原单位。
- `src/pages/pda-handover-detail.ts`
  - 提交前增加在线状态和扫码匹配校验，失败保留输入。
- `src/pages/process-water-soluble-orders.ts`
  - 接通真实任务、执行/异常和交接入口。
- `src/pages/process-factory/dyeing/water-soluble-orders.ts`
  - 复用统一权限矩阵并展示真实最近操作人。
- `src/data/fcs/factory-onboarding-store.ts`
  - 恢复被覆盖的既有多能力 Mock，水溶能力使用独立演示记录。
- `docs/prototype-review-records/2026-07-11-water-soluble-process.md`
  - 用最终新鲜证据修正二维码、离线、权限、数据来源与操作人结论。

### 不修改

- 生产准备时效页面与领域文件。
- 水溶专用仓库、结算、计价和批次模块。
- PDA 底部导航。
- 分厂和中间交接业务。

---

## 二、实施任务

### 任务 1：修正真实 BOM 来源、字典 Mock 隔离和版本冻结

**文件：**

- 修改：`scripts/check-water-soluble-process.ts`
- 修改：`src/data/pcs-technical-data-version-bootstrap.ts`
- 修改：`src/data/fcs/production-orders.ts`
- 修改：`src/data/fcs/production-artifact-generation.ts`
- 修改：`src/data/fcs/water-soluble-task-domain.ts`

- [ ] **步骤 1：为错误来源写失败断言**

在 `scripts/check-water-soluble-process.ts` 增加：

~~~typescript
const businessWaterArtifacts = productionArtifactGeneration
  .listGeneratedProductionTaskArtifacts()
  .filter((item) => item.processCode === 'WATER_SOLUBLE' && !item.artifactId.startsWith('DICT-'))

assert(businessWaterArtifacts.length > 0, '必须存在正式快照生成的仅水溶业务产物')
assert(
  listWaterSolubleWorkOrders().every((order) => !order.sourceArtifactId.startsWith('DICT-')),
  '字典覆盖 Mock 不得生成独立水溶加工单',
)

for (const order of listWaterSolubleWorkOrders()) {
  const productionOrder = productionOrders.find((item) => item.productionOrderId === order.productionOrderId)
  const bomItem = productionOrder?.techPackSnapshot?.bomItems.find((item) => item.id === order.bomItemId)
  assert.equal(bomItem?.waterSolubleRequirement, '是', `${order.waterOrderId} 来源 BOM 必须勾选水溶`)
  assert.equal(String(bomItem?.dyeRequirement || '无'), '无', `${order.waterOrderId} 来源 BOM 必须是仅水溶`)
}
~~~

补充未派厂版本冻结反例：

~~~typescript
const unassigned = listWaterSolubleWorkOrders().find((item) => item.status === 'WAIT_FACTORY_ASSIGNMENT')!
const sourceOrder = productionOrders.find((item) => item.productionOrderId === unassigned.productionOrderId)!
const formalVersionId = unassigned.techPackVersionId
const originalSelectedVersionId = sourceOrder.selectedTechPackVersionId
sourceOrder.selectedTechPackVersionId = 'UNPUBLISHED-DRAFT-X'
syncWaterSolubleOrderStoreWithArtifacts()
assert.equal(
  getWaterSolubleWorkOrderById(unassigned.waterOrderId)?.techPackVersionId,
  formalVersionId,
  '未派厂加工单也必须冻结正式快照版本',
)
sourceOrder.selectedTechPackVersionId = originalSelectedVersionId
~~~

- [ ] **步骤 2：运行检查确认红灯**

运行：

~~~bash
npm run check:water-soluble-process
~~~

预期：FAIL，至少包含“字典覆盖 Mock 不得生成独立水溶加工单”或“必须存在正式快照生成的仅水溶业务产物”。

- [ ] **步骤 3：增加正式仅水溶演示 BOM**

在既有水溶演示技术包正式版本中增加一条独立 BOM 行，例如：

~~~typescript
{
  id: 'bom-water-only-lace',
  materialCode: 'MAT-WATER-LACE-ONLY',
  name: '仅水溶花边',
  category: '辅料',
  unit: '米',
  unitConsumption: 1.2,
  lossRate: 3,
  waterSolubleRequirement: '是',
  dyeRequirement: '无',
  applicableSkuCodes: [],
}
~~~

将该 BOM 行关联到正式快照的 `WATER_SOLUBLE` 工序；不把它关联到 `DYE` 工序。保持既有联合水溶染色 BOM 不变。

- [ ] **步骤 4：隔离字典覆盖产物**

在 `isMaterialWaterSolubleTaskArtifact` 增加业务来源校验：

~~~typescript
if (artifact.artifactId.startsWith('DICT-') || artifact.sourceEntryId.startsWith('DICT-MOCK-')) {
  return false
}
~~~

字典覆盖产物可以继续服务字典展示，但不得进入水溶加工单领域。

- [ ] **步骤 5：冻结正式技术包版本**

`buildOrderFromArtifact` 使用产物携带的正式版本：

~~~typescript
techPackVersionId: artifact.techPackId,
~~~

同步可刷新字段时不再从 `productionOrder.selectedTechPackVersionId` 覆盖该值。

- [ ] **步骤 6：运行绿灯与相关回归**

运行：

~~~bash
npm run check:water-soluble-process
npm run check:fcs-production-tech-pack-snapshot
npm run check:tech-pack-process-route
~~~

预期：全部退出 0；打印出的独立水溶单来源均不是 `DICT-*`。

- [ ] **步骤 7：提交**

~~~bash
git add scripts/check-water-soluble-process.ts src/data/pcs-technical-data-version-bootstrap.ts src/data/fcs/production-orders.ts src/data/fcs/production-artifact-generation.ts src/data/fcs/water-soluble-task-domain.ts
git commit -m "fix: generate water-soluble orders from formal BOM"
~~~

### 任务 2：修正任务二维码、单位、零产出和染色节点顺序

**文件：**

- 修改：`scripts/check-water-soluble-process.ts`
- 修改：`scripts/check-water-soluble-pda.ts`
- 修改：`src/data/fcs/production-artifact-generation.ts`
- 修改：`src/data/fcs/dyeing-task-domain.ts`
- 修改：`src/data/fcs/water-soluble-task-domain.ts`
- 修改：`src/data/fcs/pda-handover-events.ts`
- 修改：`src/pages/pda-exec-detail.ts`

- [ ] **步骤 1：写任务身份和单位失败断言**

用真实创建入口创建一张单位为“公斤”的需先水溶染色单：

~~~typescript
const createdKgOrder = createDyeWorkOrderFromDemands({
  demands: [{
    demandId: 'ADV-KG-DEMAND',
    sourceArtifactId: 'ADV-KG-ARTIFACT',
    sourceProductionOrderId: 'ADV-KG-PO',
    bomItemId: 'ADV-KG-BOM',
    materialCode: 'ADV-KG-MAT',
    materialName: '公斤花边',
    requiredQty: 12,
    unit: '公斤',
    requiresWaterSoluble: true,
    processRoute: ['WATER_SOLUBLE', 'DYE'],
  }],
  factoryId: 'F090',
  plannedFinishAt: '2026-07-20',
})
assert(createdKgOrder.ok && createdKgOrder.order)
const createdTask = listMobileExecutionTasks().find((item) => item.taskId === createdKgOrder.order!.taskId)!
assert.equal(createdTask.taskQrValue, buildTaskQrValue(createdTask.taskId), '新任务二维码必须编码自身 taskId')
assert.equal(createdTask.qtyDisplayUnit, '公斤', '移动任务必须保留原 BOM 单位')
~~~

增加缺单位断言：

~~~typescript
assert.throws(
  () => generateProductionArtifactsForOrder(orderWithBlankBomUnit.productionOrderId),
  /缺少数量单位/,
)
~~~

- [ ] **步骤 2：写零产出与节点绕过失败断言**

~~~typescript
const zeroResult = completeWaterSoluble(zeroOrder.waterOrderId, 0, '原料全部损坏')
assert.equal(zeroResult.order?.status, 'PRODUCTION_PAUSED')

const zeroWithoutReason = completeDyeWaterSolubleNode(combinedOrder.dyeOrderId, 0, '')
assert.equal(zeroWithoutReason.ok, false)
const zeroWithReason = completeDyeWaterSolubleNode(combinedOrder.dyeOrderId, 0, '本批无可用产出')
assert.equal(zeroWithReason.order?.status, 'PRODUCTION_PAUSED')

const bypassBefore = getDyeWorkOrderById(combinedBypassOrder.dyeOrderId)
assert.throws(() => completeDyeNode(combinedBypassOrder.dyeOrderId, 'PACK', { outputQty: 1 }), /请先完成/)
assert.deepEqual(getDyeWorkOrderById(combinedBypassOrder.dyeOrderId), bypassBefore)
~~~

- [ ] **步骤 3：运行检查确认红灯**

~~~bash
npm run check:water-soluble-process
npm run check:water-soluble-pda
~~~

预期：二维码、零产出或节点绕过断言失败。

- [ ] **步骤 4：重建动态任务身份**

创建动态染色任务时显式覆盖模板运行事实：

~~~typescript
taskQrValue: buildTaskQrValue(taskId),
taskQrStatus: 'ACTIVE',
auditLogs: [],
startedAt: undefined,
finishedAt: undefined,
handoverOrderId: undefined,
handoverStatus: 'NOT_CREATED',
~~~

任务详情继续优先读取 `task.taskQrValue`，但该值必须已经与新 taskId 一致。

- [ ] **步骤 5：保留原单位并阻断缺单位**

生成 BOM 产物前执行：

~~~typescript
const plannedUnit = bomItem.unit?.trim()
if (!plannedUnit) {
  throw new Error(`BOM ${bomItem.id}（${bomItem.materialCode || bomItem.name}）缺少数量单位，不能生成加工单`)
}
~~~

移动任务保留 `qtyDisplayUnit: normalizedUnit`；最终交接对染色任务优先使用：

~~~typescript
const taskDisplayUnit = task.qtyDisplayUnit?.trim()
const handoverQtyUnit = taskDisplayUnit || mapCanonicalTaskQtyUnit(task.qtyUnit)
~~~

PDA 开始染色提示改为：

~~~typescript
window.prompt(`请输入染色投入数量（${dyeOrder.qtyUnit}）`, String(maxInputQty))
~~~

- [ ] **步骤 6：实现零产出与节点顺序校验**

独立和联合水溶完成使用非负数校验：0 有原因时写入 `completedQty = 0` 并进入 `PRODUCTION_PAUSED`。

为后处理定义前序关系：

~~~typescript
const DYE_NODE_PREREQUISITE = {
  DEHYDRATE: 'DYE',
  DRY: 'DEHYDRATE',
  SET: 'DRY',
  ROLL: 'SET',
  PACK: 'ROLL',
} as const
~~~

`startDyeNode` 和 `completeDyeNode` 在任何 mutation 前确认：

- 当前加工单状态与节点匹配。
- 前序节点存在且 `finishedAt` 有值。
- 当前节点没有重复开始或完成。

- [ ] **步骤 7：运行绿灯与染色/交接回归**

~~~bash
npm run check:water-soluble-process
npm run check:water-soluble-pda
npm run check:dyeing-workflow
npm run check:pda-handover-pages
npm run check:pda-exec-task-detail
~~~

预期：全部退出 0。

- [ ] **步骤 8：提交**

~~~bash
git add scripts/check-water-soluble-process.ts scripts/check-water-soluble-pda.ts src/data/fcs/production-artifact-generation.ts src/data/fcs/dyeing-task-domain.ts src/data/fcs/water-soluble-task-domain.ts src/data/fcs/pda-handover-events.ts src/pages/pda-exec-detail.ts
git commit -m "fix: secure water-soluble task identity and sequence"
~~~

### 任务 3：修复 PDA 跨厂读取、离线交出、错误扫码和角色矩阵

**文件：**

- 修改：`tests/water-soluble-pages.spec.ts`
- 修改：`tests/water-soluble-pda.spec.ts`
- 修改：`src/data/fcs/water-soluble-pda-actor.ts`
- 修改：`src/data/fcs/pda-handover-events.ts`
- 修改：`src/pages/pda-exec-detail.ts`
- 修改：`src/pages/pda-handover-detail.ts`
- 修改：`src/pages/process-factory/dyeing/water-soluble-orders.ts`

- [ ] **步骤 1：写跨厂详情失败用例**

在 `tests/water-soluble-pda.spec.ts` 增加：

~~~typescript
test('外厂账号直达独立水溶详情不会泄露任务事实', async ({ page }) => {
  const target = await bootstrapForeignFactoryWaterTask(page)
  await loginFactoryUser(page, 'ID-F001_operator', '123456')
  await page.goto(`/fcs/pda/exec/${encodeURIComponent(target.taskId)}`)
  await expect(page.getByText('当前账号不能查看该工厂任务')).toBeVisible()
  await expect(page.getByText(target.materialCode)).toHaveCount(0)
  await expect(page.getByText(target.productionOrderNo)).toHaveCount(0)
})
~~~

- [ ] **步骤 2：写离线交出和扫码失败用例**

~~~typescript
test('独立水溶离线交出无副作用并可联网重试', async ({ page, context }) => {
  const handover = await bootstrapWaterHandover(page)
  await fillWaterHandover(page, handover.materialCode, handover.approvedQty)
  const before = await readWaterHandoverFacts(page, handover)
  await context.setOffline(true)
  await page.getByRole('button', { name: '确认交出' }).click()
  await expect(page.getByText('当前网络不可用，请联网后重试')).toBeVisible()
  expect(await readWaterHandoverFacts(page, handover)).toEqual(before)
  await context.setOffline(false)
  await page.getByRole('button', { name: '确认交出' }).click()
  expect((await readWaterHandoverFacts(page, handover)).recordCount).toBe(before.recordCount + 1)
})

test('独立水溶交出阻断不属于当前任务的扫码值', async ({ page }) => {
  const handover = await bootstrapWaterHandover(page)
  await fillWaterHandover(page, 'WRONG-CODE', handover.approvedQty)
  await page.getByRole('button', { name: '确认交出' }).click()
  await expect(page.getByText(/不属于当前水溶任务/)).toBeVisible()
  expect((await readWaterHandoverFacts(page, handover)).recordCount).toBe(0)
})
~~~

- [ ] **步骤 3：写角色矩阵失败用例**

在 PFOS 页面用操作员、生产主管、交接员和管理员分别打开待原料、生产暂停和待交出状态，断言：

~~~typescript
await expect(operatorPage.getByRole('button', { name: '确认原料到位' })).toBeVisible()
await expect(supervisorPage.getByRole('button', { name: '确认原料到位' })).toHaveCount(0)
await expect(supervisorPage.getByRole('button', { name: '主管处理' })).toBeVisible()
await expect(handoverPage.getByRole('button', { name: '现在交出' })).toBeVisible()
~~~

- [ ] **步骤 4：运行 Playwright 确认红灯**

~~~bash
npm run test:water-soluble-pda:e2e -- --grep "外厂账号|离线交出|扫码值"
npm run test:water-soluble-pages:e2e -- --grep "角色矩阵"
~~~

预期：跨厂仍显示物料、离线仍产生记录、错误码仍被接受或页面权限按钮错误。

- [ ] **步骤 5：统一访问和角色校验**

在渲染独立水溶详情前调用当前 session 与任务工厂校验。失败时返回只包含返回按钮和无权限提示的 PDA 页面。

`water-soluble-pda-actor.ts` 导出：

~~~typescript
export function canWaterSolubleRolePerform(roleId: string, action: WaterSolublePdaRoleAction): boolean {
  return ALLOWED_ROLES[action].includes(roleId)
}
~~~

PFOS 页面删除自己的 `ACTION_ALLOWED_ROLE_IDS`，复用该函数和领域错误文案。

- [ ] **步骤 6：在 mutation 前阻断离线与错码**

`pda-handover-detail.ts` 的水溶提交分支按以下顺序处理：

1. 验证 overlay、令牌、session、角色和工厂。
2. 验证扫码值属于当前任务、加工单或物料。
3. 检查 `navigator.onLine`。
4. 验证数量和原单位。
5. 调用 adapter/领域写入。
6. 成功后清空令牌和草稿。

离线或错码时不得清空输入、令牌和焦点。

- [ ] **步骤 7：运行绿灯和通用 PDA 回归**

~~~bash
npm run test:water-soluble-pda:e2e
npm run test:water-soluble-pages:e2e
npm run check:water-soluble-pda
npm run check:pda-handover-pages
~~~

预期：全部退出 0，浏览器控制台错误为 0。

- [ ] **步骤 8：提交**

~~~bash
git add tests/water-soluble-pages.spec.ts tests/water-soluble-pda.spec.ts src/data/fcs/water-soluble-pda-actor.ts src/data/fcs/pda-handover-events.ts src/pages/pda-exec-detail.ts src/pages/pda-handover-detail.ts src/pages/process-factory/dyeing/water-soluble-orders.ts
git commit -m "fix: enforce water-soluble PDA access and handover guards"
~~~

### 任务 4：补齐 FCS/PFOS 追溯入口和无关 Mock 回归

**文件：**

- 修改：`scripts/check-water-soluble-pages.ts`
- 修改：`tests/water-soluble-pages.spec.ts`
- 修改：`src/pages/process-water-soluble-orders.ts`
- 修改：`src/pages/process-factory/dyeing/water-soluble-orders.ts`
- 修改：`src/data/fcs/factory-onboarding-store.ts`

- [ ] **步骤 1：写 FCS 跳转失败用例**

~~~typescript
test('FCS 水溶加工单可进入真实任务和交接详情', async ({ page }) => {
  const order = await bootstrapFcsWaterOrderWithHandover(page)
  await page.goto('/fcs/process/water-soluble-orders')
  const row = page.locator('tr').filter({ hasText: order.waterOrderNo })
  await row.getByRole('button', { name: '查看任务' }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/exec/${order.taskId}`))
  await page.goto('/fcs/process/water-soluble-orders')
  await row.getByRole('button', { name: '查看交接' }).click()
  await expect(page).toHaveURL(new RegExp(`/fcs/pda/handover/${order.handoverOrderId}`))
})
~~~

补充静态检查，禁止旧占位文案：

~~~typescript
assert(!fcsHtml.includes('统一执行详情入口待后续任务接入'))
assert(fcsHtml.includes('查看任务'))
~~~

- [ ] **步骤 2：写 PFOS 操作人失败用例**

通过真实 PDA 动作生成带操作人的日志，再打开 PFOS 卡片：

~~~typescript
await expect(card.getByText(operatorName)).toBeVisible()
await expect(card.getByText('领域暂未记录')).toHaveCount(0)
~~~

- [ ] **步骤 3：写工厂 Mock 回归断言**

在既有工厂入驻检查中同时断言：

~~~typescript
assert(hasCapabilityPair('DIRECTED_CUTTING', 'POST_FINISHING'), '必须保留定向裁与后道包装演示')
assert(hasCapabilityPair('DYE', 'WATER_SOLUBLE'), '必须提供染色与水溶能力演示')
~~~

- [ ] **步骤 4：运行检查确认红灯**

~~~bash
npm run check:water-soluble-pages
npm run test:water-soluble-pages:e2e -- --grep "真实任务|操作人"
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-factory-onboarding-final-flow.ts
~~~

预期：FCS 缺少跳转、PFOS 缺少操作人或原工厂能力演示缺失。

- [ ] **步骤 5：实现真实跳转和操作人投影**

FCS 行操作：

- `查看任务` 导航到 `/fcs/pda/exec/${taskId}`。
- `查看执行/异常` 打开同一领域详情抽屉并定位日志与异常区。
- 存在 `handoverOrderId` 时显示 `查看交接`，导航到 `/fcs/pda/handover/${handoverOrderId}`。

PFOS 最近操作从最后一条动作日志的 `detail` 中展示已经写入的“操作人：姓名”，并同时展示动作和时间。

- [ ] **步骤 6：恢复无关 Mock**

恢复原有“定向裁＋后道包装”能力组合；水溶能力使用新增或专门的染厂演示对象，不覆盖原数组位置的既有场景。

- [ ] **步骤 7：运行绿灯**

~~~bash
npm run check:water-soluble-pages
npm run test:water-soluble-pages:e2e
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-factory-onboarding-final-flow.ts
~~~

预期：全部退出 0。

- [ ] **步骤 8：提交**

~~~bash
git add scripts/check-water-soluble-pages.ts tests/water-soluble-pages.spec.ts src/pages/process-water-soluble-orders.ts src/pages/process-factory/dyeing/water-soluble-orders.ts src/data/fcs/factory-onboarding-store.ts
git commit -m "fix: close water-soluble cross-surface traceability"
~~~

### 任务 5：修正治理记录并完成全量验收

**文件：**

- 修改：`docs/prototype-review-records/2026-07-11-water-soluble-process.md`
- 修改：`scripts/check-water-soluble-process.ts`
- 修改：`scripts/check-water-soluble-pages.ts`
- 修改：`scripts/check-water-soluble-pda.ts`

- [ ] **步骤 1：对照修复规格完成覆盖矩阵**

逐项确认以下行为都有直接测试，而不是只检查源码字符串：

- 正式仅水溶 BOM 生成独立加工单，DICT Mock 不生成。
- 同物料水溶加染色不生成独立单。
- 未派厂单也冻结正式版本。
- 新任务二维码唯一且编码自身 taskId。
- 公斤、码、卷和缺单位反例。
- 0 产出暂停和主管处理。
- 后处理节点不可绕过。
- 外厂不可读、离线不写、错码不写。
- 页面与领域角色矩阵一致。
- FCS/PFOS/PDA/交接可追溯同一事实。

- [ ] **步骤 2：更新原型审查记录**

修正审查记录中以下结论：

- 数据来源改为真实正式快照仅水溶 BOM。
- 动态任务二维码经过新 taskId 断言。
- 离线交出经过真实 `context.setOffline(true)` 验证。
- 扫码值经过错误码和三类合法码验证。
- 角色矩阵按操作员、主管、交接员、管理员分别记录。
- PFOS 已展示最近实际操作人。
- 保留 CodeGraph worktree 索引例外和既有字典基线失败说明。

- [ ] **步骤 3：运行完整自动检查**

~~~bash
npm run check:water-soluble-process
npm run check:water-soluble-pages
npm run check:water-soluble-pda
npm run check:tech-pack-process-route
npm run check:fcs-production-tech-pack-snapshot
npm run check:dyeing-workflow
npm run check:pda-exec-task-detail
npm run check:pda-handover-pages
npm run test:water-soluble-pages:e2e
npm run test:water-soluble-pda:e2e
npm run check:prototype-design-governance -- --all
npm run build
git diff --check 20e2962254b28215b66d8782814d086fcba06a8b..HEAD
~~~

预期：除已经证明与本功能无关的直接 Node 字典重建基线命令外，上述命令全部退出 0；Playwright 页面 14 项加新增项、PDA 9 项加新增项全部通过，console error 和 pageerror 为 0。

- [ ] **步骤 4：浏览器定点验收**

使用真实浏览器逐项确认：

1. FCS 独立水溶单来源 BOM 显示“水溶：是、染色：无”。
2. FCS 可进入任务和交接详情。
3. PFOS 显示实际操作员。
4. 外厂直达 PDA 详情看不到物料和数量。
5. 公斤或卷单位在执行和交接中一致。
6. 离线交出保留输入且不写记录，联网重试成功一次。
7. 错误码阻断，合法任务码、加工单号或物料码通过。
8. 联合染色无法跳过水溶和任何后处理节点。

- [ ] **步骤 5：同步 CodeGraph 状态**

~~~bash
codegraph sync
codegraph status
~~~

如果仍提示索引属于主工作树，按事实记录该限制，不声称隔离 worktree 索引最新，也不在未授权情况下执行 `codegraph init -i`。

- [ ] **步骤 6：提交治理和验收记录**

~~~bash
git add docs/prototype-review-records/2026-07-11-water-soluble-process.md scripts/check-water-soluble-process.ts scripts/check-water-soluble-pages.ts scripts/check-water-soluble-pda.ts
git commit -m "test: verify water-soluble adversarial fixes"
~~~

---

## 三、完成定义

- 独立水溶加工单全部来自正式快照中的仅水溶 BOM，不存在 DICT Mock 业务单。
- 联合水溶染色仍保持一张染色加工单、同厂、固定顺序和最终一次交接。
- 新建移动任务的 taskId、二维码、单位、工厂与加工单一致。
- 任何领域或页面入口都不能绕过水溶、染色和后处理顺序。
- 0 产出、跨厂访问、离线提交、错误扫码和非法角色均有明确、无副作用的处理。
- FCS、PFOS、PDA 和通用交接可以互相追溯同一任务事实。
- 原型治理记录与新鲜自动化及浏览器证据一致。
- 未扩展生产准备时效、仓库、结算、批次、PDA 导航或分厂范围。
