# 对账单扣款按生产单拆分实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将新建对账单的瑕疵扣款、返工反扣展示和延误扣款从整单聚合口径改为生产单口径，其中瑕疵金额按 `生产单 + 瑕疵原因` 填写。

**架构：** 继续使用 `src/pages/statements.ts` 的 Vanilla TypeScript 字符串模板和本地 mock 数据，不引入新的状态层。检查脚本先锁定新字段、新事件和旧字段删除，再改页面状态、手工扣款明细生成、质检扣款 Tab、金额确认 Tab。对账单底层 `StatementDraftItem` 已有 `productionOrderNo`，无需改领域类型。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有 Node 检查脚本、CodeGraph。

**状态：** 已实现并验证。

---

## 业务规则锁定

- 结算对象为 `按预结算流水` 时，步骤为：基础范围 -> 预结算流水 -> 质检扣款 -> 金额确认。
- 结算对象为 `按生产单` 时，步骤为：基础范围 -> 对象反查 -> 质检扣款 -> 金额确认。
- 瑕疵事实可以按原因汇总阅读，但填钱入口必须是 `生产单 + 瑕疵原因`，不能跨生产单共用一个金额。
- 返工反扣来自预结算流水，只展示弱信息；表格必须展示生产单。
- 延误扣款由业务人员填写；系统按生产单展示开始时间参考、最后交出时间、金额和说明。
- 当前金额统一按 IDR 处理。

## 文件结构

- 修改：`scripts/check-statements.ts`
  - 锁定新建对账单页面必须使用生产单维度扣款字段。
  - 反向断言旧的全局原因金额字段和全局延误字段被删除。
- 修改：`scripts/check-factory-settlement-statements.ts`
  - 锁定对账单生成流程页面中的生产单维度输入和返工反扣生产单列。
- 修改：`src/pages/statements.ts`
  - 替换 `StatementsState` 中的手工扣款状态。
  - 新增生产单维度瑕疵汇总和生产单维度时间辅助 helper。
  - 生成生产单维度手工扣款明细。
  - 重写质检扣款 Tab 的瑕疵、返工反扣、延误三块展示。
  - 更新金额确认 Tab 汇总和事件处理。

## 实施任务

### 任务 1：先改检查脚本，锁定新口径红灯

**文件：**
- 修改：`scripts/check-statements.ts`
- 修改：`scripts/check-factory-settlement-statements.ts`

- [x] **步骤 1：修改 `scripts/check-statements.ts` 的源码断言**

在现有 `statementsPageSource` 断言区域，把旧的 `manual-defect-reason-amount` 正向断言替换为生产单维度断言，并加入旧字段反向断言：

```ts
  assert(
    statementsPageSource.includes('manualDefectProductionOrderDeductions'),
    '新建对账单未按生产单保存瑕疵扣款输入',
  )
  assert(
    statementsPageSource.includes('manualDelayProductionOrderDeductions'),
    '新建对账单未按生产单保存延误扣款输入',
  )
  assert(
    statementsPageSource.includes('setManualDefectProductionOrderDeduction'),
    '新建对账单缺少生产单 + 瑕疵原因扣款输入处理函数',
  )
  assert(
    statementsPageSource.includes('getBuildQcReasonSummariesByProductionOrder'),
    '新建对账单缺少按生产单汇总质检瑕疵事实的函数',
  )
  assert(
    statementsPageSource.includes('getBuildProductionOrderTimingAssist'),
    '新建对账单缺少按生产单提供延误时间辅助的函数',
  )
  assert(
    statementsPageSource.includes('data-stm-build-field="manual-defect-production-order-amount"'),
    '新建对账单未按生产单 + 瑕疵原因填写扣款金额',
  )
  assert(
    statementsPageSource.includes('data-stm-build-field="manual-defect-production-order-remark"'),
    '新建对账单未按生产单 + 瑕疵原因填写扣款说明',
  )
  assert(
    statementsPageSource.includes('data-stm-build-field="manual-delay-production-order-amount"'),
    '新建对账单未按生产单填写延误扣款金额',
  )
  assert(
    statementsPageSource.includes('data-stm-build-field="manual-delay-production-order-remark"'),
    '新建对账单未按生产单填写延误扣款说明',
  )
  assert(
    !statementsPageSource.includes('manualDefectReasonDeductions'),
    '新建对账单仍残留按瑕疵原因全局保存扣款输入的旧状态',
  )
  assert(
    !statementsPageSource.includes('manualDelayDeductionAmount'),
    '新建对账单仍残留整张对账单共用的延误扣款金额',
  )
  assert(
    !statementsPageSource.includes('manualDelayDeductionRemark'),
    '新建对账单仍残留整张对账单共用的延误扣款说明',
  )
  assert(
    !statementsPageSource.includes('data-stm-build-field="manual-defect-reason-amount"'),
    '新建对账单仍残留按瑕疵原因全局填写扣款金额的旧输入',
  )
  assert(
    !statementsPageSource.includes('data-stm-build-field="manual-delay-deduction-amount"'),
    '新建对账单仍残留整张对账单共用的延误扣款输入',
  )
```

- [x] **步骤 2：修改 `scripts/check-factory-settlement-statements.ts` 的 token 列表**

把旧 token：

```ts
  'data-stm-build-field="manual-defect-reason-amount"',
  'data-stm-build-field="manual-defect-reason-remark"',
  'data-stm-build-field="manual-delay-deduction-amount"',
  'data-stm-build-field="manual-delay-deduction-remark"',
```

替换为：

```ts
  'data-stm-build-field="manual-defect-production-order-amount"',
  'data-stm-build-field="manual-defect-production-order-remark"',
  'data-stm-build-field="manual-delay-production-order-amount"',
  'data-stm-build-field="manual-delay-production-order-remark"',
  'data-production-order-no',
  'getBuildProductionOrderTimingAssist',
```

在 token 循环后增加返工反扣生产单列断言：

```ts
assert(
  /<th[^>]*>生产单<\/th>[\s\S]*<th[^>]*>流水号<\/th>[\s\S]*<th[^>]*>质检记录<\/th>/.test(source),
  '返工反扣表必须展示生产单列',
)
```

- [x] **步骤 3：运行检查验证失败**

运行：

```bash
npm run check:statements
npm run check:factory-settlement-statements
```

预期：两个命令至少一个失败，失败信息指向生产单维度字段或返工反扣生产单列缺失。

- [x] **步骤 4：提交检查脚本变更**

```bash
git add scripts/check-statements.ts scripts/check-factory-settlement-statements.ts
git commit -m "test: lock statement deduction production-order grain"
```

### 任务 2：替换页面状态和数据 helper

**文件：**
- 修改：`src/pages/statements.ts`

- [x] **步骤 1：新增手工扣款输入类型**

在 `StatementOverviewCounts` 附近加入：

```ts
interface ManualDeductionInput {
  amount: string
  remark: string
}

interface BuildQcReasonProductionOrderSummary {
  productionOrderNo: string
  productionOrderId?: string
  reasonName: string
  qty: number
}
```

- [x] **步骤 2：替换 `StatementsState` 字段**

把旧字段：

```ts
  manualDefectReasonDeductions: Record<string, { amount: string; remark: string }>
  manualDelayDeductionAmount: string
  manualDelayDeductionRemark: string
```

替换为：

```ts
  manualDefectProductionOrderDeductions: Record<string, Record<string, ManualDeductionInput>>
  manualDelayProductionOrderDeductions: Record<string, ManualDeductionInput>
```

把 `state` 初始值中的旧字段：

```ts
  manualDefectReasonDeductions: {},
  manualDelayDeductionAmount: '',
  manualDelayDeductionRemark: '',
```

替换为：

```ts
  manualDefectProductionOrderDeductions: {},
  manualDelayProductionOrderDeductions: {},
```

- [x] **步骤 3：替换清空和设置 helper**

删除 `setManualDefectReasonDeduction`，把 `clearBuildManualDeductions` 改为：

```ts
function clearBuildManualDeductions(): void {
  state.manualDefectProductionOrderDeductions = {}
  state.manualDelayProductionOrderDeductions = {}
}
```

新增以下 helper：

```ts
function getEmptyManualDeductionInput(): ManualDeductionInput {
  return { amount: '', remark: '' }
}

function getManualDefectProductionOrderDeduction(
  productionOrderNo: string,
  reasonName: string,
): ManualDeductionInput {
  return state.manualDefectProductionOrderDeductions[productionOrderNo]?.[reasonName] ?? getEmptyManualDeductionInput()
}

function setManualDefectProductionOrderDeduction(
  productionOrderNo: string,
  reasonName: string,
  patch: Partial<ManualDeductionInput>,
): void {
  const currentByReason = state.manualDefectProductionOrderDeductions[productionOrderNo] ?? {}
  const current = currentByReason[reasonName] ?? getEmptyManualDeductionInput()
  state.manualDefectProductionOrderDeductions = {
    ...state.manualDefectProductionOrderDeductions,
    [productionOrderNo]: {
      ...currentByReason,
      [reasonName]: { ...current, ...patch },
    },
  }
}

function getManualDelayProductionOrderDeduction(productionOrderNo: string): ManualDeductionInput {
  return state.manualDelayProductionOrderDeductions[productionOrderNo] ?? getEmptyManualDeductionInput()
}

function setManualDelayProductionOrderDeduction(
  productionOrderNo: string,
  patch: Partial<ManualDeductionInput>,
): void {
  const current = getManualDelayProductionOrderDeduction(productionOrderNo)
  state.manualDelayProductionOrderDeductions = {
    ...state.manualDelayProductionOrderDeductions,
    [productionOrderNo]: { ...current, ...patch },
  }
}
```

- [x] **步骤 4：新增按生产单汇总质检事实 helper**

把 `getBuildQcReasonSummaries` 改名并改为按生产单返回：

```ts
function getBuildQcReasonSummariesByProductionOrder(
  projections: ProductionOrderSettlementProjection[],
): BuildQcReasonProductionOrderSummary[] {
  return getIncludedBuildProjections(projections)
    .flatMap((projection) =>
      Object.entries(projection.defectReasonQtyByName)
        .filter(([reasonName, qty]) => isSewingFactoryLiabilityReason(reasonName) && qty > 0)
        .map(([reasonName, qty]) => ({
          productionOrderNo: projection.productionOrderNo,
          productionOrderId: projection.productionOrderId,
          reasonName,
          qty,
        })),
    )
    .sort((left, right) => {
      if (left.productionOrderNo !== right.productionOrderNo) {
        return left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN')
      }
      const leftIndex = SEWING_FACTORY_LIABILITY_REASONS.indexOf(
        left.reasonName as (typeof SEWING_FACTORY_LIABILITY_REASONS)[number],
      )
      const rightIndex = SEWING_FACTORY_LIABILITY_REASONS.indexOf(
        right.reasonName as (typeof SEWING_FACTORY_LIABILITY_REASONS)[number],
      )
      return leftIndex === rightIndex ? left.reasonName.localeCompare(right.reasonName, 'zh-CN') : leftIndex - rightIndex
    })
}
```

- [x] **步骤 5：新增按生产单时间辅助 helper**

把 `getBuildTimingAssist` 替换为：

```ts
function getBuildProductionOrderTimingAssist(productionOrderNo: string): { startTime: string; lastHandoverTime: string } {
  const ledgers = getBuildRangeLedgers().filter((item) => item.productionOrderNo === productionOrderNo)
  const times = ledgers.map((item) => item.occurredAt).filter(Boolean).sort()
  const handoverTimes = ledgers
    .filter((item) => item.ledgerType === 'TASK_EARNING')
    .map((item) => item.occurredAt)
    .filter(Boolean)
    .sort()
  return {
    startTime: times[0] ?? '—',
    lastHandoverTime: handoverTimes[handoverTimes.length - 1] ?? '—',
  }
}
```

- [x] **步骤 6：运行检查验证进入下一个失败点**

运行：

```bash
npm run check:statements
```

预期：不再报旧状态字段缺失，新失败点指向 UI 字段或返工反扣生产单列。

- [x] **步骤 7：提交状态和 helper 变更**

```bash
git add src/pages/statements.ts
git commit -m "feat: split statement manual deduction state by production order"
```

### 任务 3：生成生产单维度手工扣款明细

**文件：**
- 修改：`src/pages/statements.ts`

- [x] **步骤 1：新增手工扣款 ID 清洗 helper**

在 `parseManualDeductionAmount` 附近加入：

```ts
function toManualDeductionIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9-]/g, '-')
}
```

- [x] **步骤 2：改写 `buildManualStatementDeductionLines` 的输入构造**

用以下结构替换 `defectInputs` 和单个 `MANUAL-DELAY` 输入：

```ts
  const defectInputs = getBuildQcReasonSummariesByProductionOrder(getBuildProductionOrderProjections()).map(
    (summary, index) => {
      const input = getManualDefectProductionOrderDeduction(summary.productionOrderNo, summary.reasonName)
      return {
        id: `MANUAL-DEFECT-${toManualDeductionIdPart(summary.productionOrderNo)}-${String(index + 1).padStart(2, '0')}-${baseId}`,
        label: `${summary.productionOrderNo} ${summary.reasonName}扣款`,
        productionOrderNo: summary.productionOrderNo,
        productionOrderId: summary.productionOrderId,
        lineType: 'QUALITY_DEFECT' as const,
        amount: parseManualDeductionAmount(input.amount),
        qty: summary.qty,
        remark: input.remark.trim() || `业务人员填写${summary.productionOrderNo} ${summary.reasonName}瑕疵扣款`,
      }
    },
  )
  const delayInputs = getIncludedBuildProjections(getBuildProductionOrderProjections()).map((projection) => {
    const input = getManualDelayProductionOrderDeduction(projection.productionOrderNo)
    return {
      id: `MANUAL-DELAY-${toManualDeductionIdPart(projection.productionOrderNo)}-${baseId}`,
      label: `${projection.productionOrderNo} 延误扣款`,
      productionOrderNo: projection.productionOrderNo,
      productionOrderId: projection.productionOrderId,
      lineType: 'DELAY' as const,
      amount: parseManualDeductionAmount(input.amount),
      qty: 0,
      remark: input.remark.trim() || `业务人员根据${projection.productionOrderNo}开始时间和最后交出时间填写延误扣款`,
    }
  })
  const inputs = [...defectInputs, ...delayInputs]
```

- [x] **步骤 3：在 `StatementDraftItem` 输出中写入生产单字段**

在返回的明细对象中加入：

```ts
      productionOrderId: input.productionOrderId,
      productionOrderNo: input.productionOrderNo,
```

完整对象里保留现有字段，扣款字段继续使用负数金额：

```ts
      deductionAmount: -input.amount,
      qualityDeductionAmount: input.amount,
      netAmount: -input.amount,
```

- [x] **步骤 4：运行检查验证手工明细不破坏构建**

运行：

```bash
npm run check:statements
```

预期：脚本可执行到页面源码断言，失败点只剩渲染字段或事件字段。

- [x] **步骤 5：提交明细生成变更**

```bash
git add src/pages/statements.ts
git commit -m "feat: generate statement manual deduction lines per production order"
```

### 任务 4：重写质检扣款 Tab 的三块 UI 和事件处理

**文件：**
- 修改：`src/pages/statements.ts`

- [x] **步骤 1：调整 `renderBuildQcDeductionTab` 签名**

把参数：

```ts
  timingAssist: { startTime: string; lastHandoverTime: string },
```

删除，并更新调用处：

```ts
          ? renderBuildQcDeductionTab(projections, buildLines)
```

- [x] **步骤 2：按生产单渲染瑕疵扣款**

在 `renderBuildQcDeductionTab` 内使用：

```ts
  const reasonRows = getBuildQcReasonSummariesByProductionOrder(projections)
  const includedProjections = getIncludedBuildProjections(projections)
  const reasonRowsByProductionOrder = new Map<string, BuildQcReasonProductionOrderSummary[]>()
  for (const row of reasonRows) {
    const rows = reasonRowsByProductionOrder.get(row.productionOrderNo) ?? []
    rows.push(row)
    reasonRowsByProductionOrder.set(row.productionOrderNo, rows)
  }
```

把原来的全局瑕疵原因表替换成每张生产单一个表：

```ts
        reasonRows.length
          ? includedProjections
              .filter((projection) => (reasonRowsByProductionOrder.get(projection.productionOrderNo) ?? []).length > 0)
              .map((projection) => {
                const rows = reasonRowsByProductionOrder.get(projection.productionOrderNo) ?? []
                return `
                  <article class="mt-3 rounded-md border bg-background">
                    <div class="border-b bg-muted/30 px-4 py-3">
                      <div class="text-sm font-semibold">${escapeHtml(projection.productionOrderNo)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">裁片完成 ${projection.cuttingCompletedQty} / 结算口径累计交出 ${projection.settlementHandoverQty} / 瑕疵 ${projection.sewingFactoryLiabilityDefectQty}</div>
                    </div>
                    <div class="overflow-x-auto">
                      <table class="w-full min-w-[860px] text-sm">
                        <thead>
                          <tr class="border-b bg-muted/20 text-left">
                            <th class="px-4 py-2 font-medium">瑕疵原因</th>
                            <th class="px-4 py-2 text-right font-medium">瑕疵数量</th>
                            <th class="px-4 py-2 font-medium">扣款金额（IDR）</th>
                            <th class="px-4 py-2 font-medium">扣款说明</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${rows
                            .map((summary) => {
                              const input = getManualDefectProductionOrderDeduction(summary.productionOrderNo, summary.reasonName)
                              return `
                                <tr class="border-b last:border-b-0">
                                  <td class="px-4 py-3 font-medium">${escapeHtml(summary.reasonName)}</td>
                                  <td class="px-4 py-3 text-right tabular-nums">${summary.qty}</td>
                                  <td class="px-4 py-3">
                                    <input type="number" min="0" step="1" class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-stm-build-field="manual-defect-production-order-amount" data-production-order-no="${escapeHtml(summary.productionOrderNo)}" data-reason="${escapeHtml(summary.reasonName)}" value="${escapeHtml(input.amount)}" />
                                  </td>
                                  <td class="px-4 py-3">
                                    <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-stm-build-field="manual-defect-production-order-remark" data-production-order-no="${escapeHtml(summary.productionOrderNo)}" data-reason="${escapeHtml(summary.reasonName)}" data-skip-page-rerender="true" value="${escapeHtml(input.remark)}" placeholder="${escapeHtml(summary.productionOrderNo)} ${escapeHtml(summary.reasonName)}扣款说明" />
                                  </td>
                                </tr>
                              `
                            })
                            .join('')}
                        </tbody>
                      </table>
                    </div>
                  </article>
                `
              })
              .join('')
          : '<p class="mt-3 rounded-md border bg-muted/20 py-6 text-center text-sm text-muted-foreground">当前纳入对象暂无归车缝工厂原因的瑕疵事实。</p>'
```

- [x] **步骤 3：返工反扣表增加生产单列**

把返工表表头改为：

```ts
                    <th class="px-4 py-2 font-medium">生产单</th>
                    <th class="px-4 py-2 font-medium">流水号</th>
                    <th class="px-4 py-2 font-medium">质检记录</th>
                    <th class="px-4 py-2 text-right font-medium">返工数量</th>
                    <th class="px-4 py-2 text-right font-medium">扣款金额</th>
```

在行内第一列加入：

```ts
                          <td class="px-4 py-3 font-medium">${escapeHtml(line.productionOrderNoDisplay ?? line.productionOrderNo ?? '-')}</td>
```

并把表格最小宽度从 `min-w-[760px]` 调整为 `min-w-[900px]`。

- [x] **步骤 4：延误扣款改为生产单列表**

用以下结构替换原来的单个延误输入块：

```ts
      <div class="mt-3 overflow-x-auto rounded-md border">
        <table class="w-full min-w-[980px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="px-4 py-2 font-medium">生产单</th>
              <th class="px-4 py-2 font-medium">开始时间参考</th>
              <th class="px-4 py-2 font-medium">最后交出时间</th>
              <th class="px-4 py-2 font-medium">延误扣款金额（IDR）</th>
              <th class="px-4 py-2 font-medium">延误扣款说明</th>
            </tr>
          </thead>
          <tbody>
            ${includedProjections
              .map((projection) => {
                const input = getManualDelayProductionOrderDeduction(projection.productionOrderNo)
                const timing = getBuildProductionOrderTimingAssist(projection.productionOrderNo)
                return `
                  <tr class="border-b last:border-b-0">
                    <td class="px-4 py-3 font-medium">${escapeHtml(projection.productionOrderNo)}</td>
                    <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(timing.startTime)}</td>
                    <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(timing.lastHandoverTime)}</td>
                    <td class="px-4 py-3">
                      <input type="number" min="0" step="1" class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-stm-build-field="manual-delay-production-order-amount" data-production-order-no="${escapeHtml(projection.productionOrderNo)}" value="${escapeHtml(input.amount)}" />
                    </td>
                    <td class="px-4 py-3">
                      <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-stm-build-field="manual-delay-production-order-remark" data-production-order-no="${escapeHtml(projection.productionOrderNo)}" value="${escapeHtml(input.remark)}" data-skip-page-rerender="true" placeholder="${escapeHtml(projection.productionOrderNo)} 延误扣款说明" />
                    </td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      </div>
```

- [x] **步骤 5：更新输入事件处理**

把旧的四个分支：

```ts
    if (field === 'manual-defect-reason-amount' && buildFieldNode instanceof HTMLInputElement) {
    if (field === 'manual-defect-reason-remark' && buildFieldNode instanceof HTMLInputElement) {
    if (field === 'manual-delay-deduction-amount' && buildFieldNode instanceof HTMLInputElement) {
    if (field === 'manual-delay-deduction-remark' && buildFieldNode instanceof HTMLInputElement) {
```

替换为：

```ts
    if (field === 'manual-defect-production-order-amount' && buildFieldNode instanceof HTMLInputElement) {
      const productionOrderNo = buildFieldNode.dataset.productionOrderNo
      const reasonName = buildFieldNode.dataset.reason
      if (productionOrderNo && reasonName) {
        setManualDefectProductionOrderDeduction(productionOrderNo, reasonName, { amount: buildFieldNode.value })
      }
      return true
    }
    if (field === 'manual-defect-production-order-remark' && buildFieldNode instanceof HTMLInputElement) {
      const productionOrderNo = buildFieldNode.dataset.productionOrderNo
      const reasonName = buildFieldNode.dataset.reason
      if (productionOrderNo && reasonName) {
        setManualDefectProductionOrderDeduction(productionOrderNo, reasonName, { remark: buildFieldNode.value })
      }
      return true
    }
    if (field === 'manual-delay-production-order-amount' && buildFieldNode instanceof HTMLInputElement) {
      const productionOrderNo = buildFieldNode.dataset.productionOrderNo
      if (productionOrderNo) setManualDelayProductionOrderDeduction(productionOrderNo, { amount: buildFieldNode.value })
      return true
    }
    if (field === 'manual-delay-production-order-remark' && buildFieldNode instanceof HTMLInputElement) {
      const productionOrderNo = buildFieldNode.dataset.productionOrderNo
      if (productionOrderNo) setManualDelayProductionOrderDeduction(productionOrderNo, { remark: buildFieldNode.value })
      return true
    }
```

- [x] **步骤 6：运行检查验证 UI 断言**

运行：

```bash
npm run check:statements
npm run check:factory-settlement-statements
```

预期：两个检查脚本通过或只剩金额汇总断言相关失败。

- [x] **步骤 7：提交 UI 和事件变更**

```bash
git add src/pages/statements.ts scripts/check-statements.ts scripts/check-factory-settlement-statements.ts
git commit -m "feat: render statement deductions by production order"
```

### 任务 5：更新金额确认汇总并完成验证

**文件：**
- 修改：`src/pages/statements.ts`

- [x] **步骤 1：新增手工扣款汇总 helper**

在 `buildManualStatementDeductionLines` 附近加入：

```ts
function sumManualDefectProductionOrderDeductions(): number {
  return Object.values(state.manualDefectProductionOrderDeductions).reduce(
    (sum, reasonMap) =>
      sum + Object.values(reasonMap).reduce((reasonSum, item) => reasonSum + parseManualDeductionAmount(item.amount), 0),
    0,
  )
}

function sumManualDelayProductionOrderDeductions(): number {
  return Object.values(state.manualDelayProductionOrderDeductions).reduce(
    (sum, item) => sum + parseManualDeductionAmount(item.amount),
    0,
  )
}
```

- [x] **步骤 2：更新 `renderBuildSummaryTab`**

把旧汇总：

```ts
  const manualDefectAmount = Object.values(state.manualDefectReasonDeductions).reduce(
    (sum, item) => sum + parseManualDeductionAmount(item.amount),
    0,
  )
  const manualDelayAmount = parseManualDeductionAmount(state.manualDelayDeductionAmount)
```

替换为：

```ts
  const manualDefectAmount = sumManualDefectProductionOrderDeductions()
  const manualDelayAmount = sumManualDelayProductionOrderDeductions()
```

- [x] **步骤 3：全文清理旧符号**

运行：

```bash
rg -n "manualDefectReasonDeductions|setManualDefectReasonDeduction|getBuildQcReasonSummaries\\(|manualDelayDeductionAmount|manualDelayDeductionRemark|manual-defect-reason-amount|manual-delay-deduction-amount" src/pages/statements.ts scripts/check-statements.ts scripts/check-factory-settlement-statements.ts
```

预期：无输出。

- [x] **步骤 4：运行项目检查**

运行：

```bash
npm run check:statements
npm run check:factory-settlement-statements
npm run build
```

预期：三个命令全部通过。

- [x] **步骤 5：本地浏览器验证**

启动或复用本地 Vite：

```bash
npm run dev -- --host 0.0.0.0 --port 5178
```

打开：

```text
http://127.0.0.1:5178/fcs/settlement/statements
```

验证路径：

1. 进入 `新建对账单`。
2. 选择 `PT Sinar Garment Indonesia`，日期范围覆盖 mock 数据。
3. 选择 `按生产单`，进入 `对象反查`，确认可见 `MOCK-SETTLE-PO-001`、`MOCK-SETTLE-PO-002`、`MOCK-SETTLE-PO-003`。
4. 进入 `质检扣款`，确认同一个瑕疵原因在不同生产单下分别有金额输入。
5. 确认 `返工反扣` 表有 `生产单` 列。
6. 确认 `延误扣款` 按生产单展示开始时间、最后交出时间、金额输入和说明输入。
7. 在两张生产单的同一瑕疵原因输入不同金额，进入 `金额确认`，确认瑕疵扣款汇总为两笔之和。

- [x] **步骤 6：同步 CodeGraph 并提交收口**

运行：

```bash
codegraph sync
codegraph status
git add src/pages/statements.ts scripts/check-statements.ts scripts/check-factory-settlement-statements.ts
git commit -m "feat: confirm statement deduction totals by production order"
```

预期：CodeGraph 状态为 `Index is up to date`，提交成功。

## 自检清单

- [x] 规格中的 `生产单 + 瑕疵原因` 填钱入口由任务 2、任务 3、任务 4 覆盖。
- [x] 返工反扣展示生产单由任务 1、任务 4 覆盖。
- [x] 延误扣款按生产单填写由任务 2、任务 3、任务 4、任务 5 覆盖。
- [x] 金额确认按生产单扣款明细汇总由任务 3、任务 5 覆盖。
- [x] 旧全局原因扣款和旧全局延误扣款的删除由任务 1、任务 5 覆盖。
- [x] 不改质检记录、后道质检单、真实后端、权限和领域类型。
