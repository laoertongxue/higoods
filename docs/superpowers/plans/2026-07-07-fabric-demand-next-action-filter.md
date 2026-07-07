# 面料需求看板后续建议工作筛选实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在面料需求看板搜索区新增「后续建议工作」筛选项，按现有异常映射筛出调拨或采购跟进事项。

**架构：** 不新增异常类型、不新增宽表列，只在现有面料需求看板数据过滤口径上增加一个后续动作维度。页面复用现有 `renderSelect()` 和分页逻辑，筛选变化后仍回到第一页。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有 `scripts/check-wls-fabric-demand-board.ts` 断言脚本。

---

## 文件结构

- 修改：`src/data/wls/fabric-demand-board.ts`
  - 增加「后续建议工作」业务类型和选项。
  - 在筛选条件中增加后续建议工作。
  - 将 4 类后续建议工作映射到现有 6 类异常。
- 修改：`src/pages/wls-fabric-demand-board.ts`
  - 搜索区新增「后续建议工作」下拉框。
  - 下拉框放在「异常类型」之后、「仓库 / 目的仓」之前。
  - 保持宽表不新增列，分页逻辑不变。
- 修改：`scripts/check-wls-fabric-demand-board.ts`
  - 先写失败检查，覆盖文案、选项、筛选映射、分页保留。
- 修改：`docs/prototype-review-records/2026-07-06-fabric-demand-board.md`
  - 补充本次筛选项的原型审查记录。

## 任务 1：先补失败守门检查

**文件：**
- 修改：`scripts/check-wls-fabric-demand-board.ts`

- [ ] **步骤 1：新增后续建议工作选项检查**

在 `transferDirections` 后加入：

```typescript
const nextActionOptions = [
  '中央仓面料仓调拨至印花待加工仓',
  '中央仓面料仓调拨至染色待加工仓',
  '中央仓面料仓调拨至中转仓',
  '采购跟单跟进',
] as const
```

在页面文案检查数组中加入：

```typescript
  '后续建议工作',
  ...nextActionOptions,
```

- [ ] **步骤 2：新增筛选映射检查**

在 `alertRows` 检查之后加入：

```typescript
const printTransferRows = filterFabricDemandBoardRows(rows, {
  keyword: '',
  materialType: '全部',
  printRequirement: '全部',
  dyeRequirement: '全部',
  alertType: '全部',
  nextAction: '中央仓面料仓调拨至印花待加工仓',
  warehouseName: '全部',
})
assert.ok(printTransferRows.length > 0, '后续建议工作筛选应能命中印花调拨')
assert.ok(
  printTransferRows.every((row) => row.alerts.some((alert) => alert.type === '印花待调拨')),
  '印花调拨建议工作不应混入非印花待调拨行',
)

const dyeTransferRows = filterFabricDemandBoardRows(rows, {
  keyword: '',
  materialType: '全部',
  printRequirement: '全部',
  dyeRequirement: '全部',
  alertType: '全部',
  nextAction: '中央仓面料仓调拨至染色待加工仓',
  warehouseName: '全部',
})
assert.ok(dyeTransferRows.length > 0, '后续建议工作筛选应能命中染色调拨')
assert.ok(
  dyeTransferRows.every((row) => row.alerts.some((alert) => alert.type === '染色待调拨')),
  '染色调拨建议工作不应混入非染色待调拨行',
)

const directCutTransferRows = filterFabricDemandBoardRows(rows, {
  keyword: '',
  materialType: '全部',
  printRequirement: '全部',
  dyeRequirement: '全部',
  alertType: '全部',
  nextAction: '中央仓面料仓调拨至中转仓',
  warehouseName: '全部',
})
assert.ok(directCutTransferRows.length > 0, '后续建议工作筛选应能命中直裁调拨')
assert.ok(
  directCutTransferRows.every((row) => row.alerts.some((alert) => alert.type === '直裁待调拨')),
  '直裁调拨建议工作不应混入非直裁待调拨行',
)

const purchaseFollowRows = filterFabricDemandBoardRows(rows, {
  keyword: '',
  materialType: '全部',
  printRequirement: '全部',
  dyeRequirement: '全部',
  alertType: '全部',
  nextAction: '采购跟单跟进',
  warehouseName: '全部',
})
assert.ok(purchaseFollowRows.length > 0, '后续建议工作筛选应能命中采购跟单跟进')
assert.ok(
  purchaseFollowRows.every((row) =>
    row.alerts.some((alert) => ['缺直裁面料', '缺印花原料', '缺染色原料'].includes(alert.type)),
  ),
  '采购跟单跟进不应混入待调拨行',
)
```

- [ ] **步骤 3：运行检查确认失败**

运行：

```bash
npm run test -- scripts/check-wls-fabric-demand-board.ts
```

预期：FAIL，TypeScript 或断言报错，原因是 `nextAction` 尚未加入筛选条件，或页面缺少「后续建议工作」文案。

## 任务 2：实现数据筛选口径

**文件：**
- 修改：`src/data/wls/fabric-demand-board.ts`
- 测试：`scripts/check-wls-fabric-demand-board.ts`

- [ ] **步骤 1：增加后续建议工作类型和选项**

在异常类型后加入：

```typescript
export type FabricDemandBoardNextAction =
  | '中央仓面料仓调拨至印花待加工仓'
  | '中央仓面料仓调拨至染色待加工仓'
  | '中央仓面料仓调拨至中转仓'
  | '采购跟单跟进'

export const fabricDemandBoardNextActions: Array<'全部' | FabricDemandBoardNextAction> = [
  '全部',
  '中央仓面料仓调拨至印花待加工仓',
  '中央仓面料仓调拨至染色待加工仓',
  '中央仓面料仓调拨至中转仓',
  '采购跟单跟进',
]
```

- [ ] **步骤 2：扩展筛选条件默认值**

在 `FabricDemandBoardFilters` 中加入，位置在 `alertType` 后：

```typescript
  nextAction: '全部' | FabricDemandBoardNextAction
```

在 `defaultFabricDemandBoardFilters` 中加入：

```typescript
  nextAction: '全部',
```

- [ ] **步骤 3：增加最小映射函数**

在 `formatFabricDemandQty()` 前加入：

```typescript
function matchesNextAction(row: FabricDemandBoardRow, nextAction: FabricDemandBoardFilters['nextAction']): boolean {
  if (nextAction === '全部') return true
  const alertTypes = row.alerts.map((item) => item.type)
  if (nextAction === '中央仓面料仓调拨至印花待加工仓') return alertTypes.includes('印花待调拨')
  if (nextAction === '中央仓面料仓调拨至染色待加工仓') return alertTypes.includes('染色待调拨')
  if (nextAction === '中央仓面料仓调拨至中转仓') return alertTypes.includes('直裁待调拨')
  return alertTypes.some((type) => type === '缺直裁面料' || type === '缺印花原料' || type === '缺染色原料')
}
```

- [ ] **步骤 4：接入过滤函数**

在 `filterFabricDemandBoardRows()` 中，放在异常类型判断之后：

```typescript
    if (!matchesNextAction(row, filters.nextAction)) return false
```

- [ ] **步骤 5：运行检查确认页面文案仍失败**

运行：

```bash
npm run test -- scripts/check-wls-fabric-demand-board.ts
```

预期：FAIL，筛选映射相关断言通过，页面文案仍因未展示「后续建议工作」失败。

## 任务 3：搜索区新增筛选项

**文件：**
- 修改：`src/pages/wls-fabric-demand-board.ts`
- 测试：`scripts/check-wls-fabric-demand-board.ts`

- [ ] **步骤 1：引入选项**

在页面 import 中加入：

```typescript
  fabricDemandBoardNextActions,
```

- [ ] **步骤 2：在搜索区插入下拉框**

在「异常类型」下拉框之后、「仓库 / 目的仓」之前加入：

```typescript
          ${renderSelect<FabricDemandBoardFilters['nextAction']>('后续建议工作', 'nextAction', filters.nextAction, fabricDemandBoardNextActions)}
```

- [ ] **步骤 3：调整宽屏网格列**

将搜索区 grid 类名改为 8 个筛选/按钮槽位：

```typescript
        <div class="grid items-end gap-3 md:grid-cols-3 xl:grid-cols-[1fr_1fr_0.95fr_0.95fr_1fr_1.35fr_1fr_auto]">
```

保持按钮容器类名不变：

```typescript
          <div class="flex h-9 items-center justify-end gap-2 md:col-span-3 xl:col-span-1">
```

- [ ] **步骤 4：运行专项检查确认通过**

运行：

```bash
npm run test -- scripts/check-wls-fabric-demand-board.ts
```

预期：PASS，输出 `WLS 面料需求看板检查通过`。

## 任务 4：补原型审查记录和治理验证

**文件：**
- 修改：`docs/prototype-review-records/2026-07-06-fabric-demand-board.md`

- [ ] **步骤 1：补充主要问题与处理记录**

在「主要问题与处理」表格末尾加入：

```markdown
| 用户需要按下一步动作查异常，但只能按异常类型筛选，采购跟进和调拨动作不够直观。 | 协作断裂 | 仓储主管、计划、采购跟单、印花 / 染色仓管 | 已新增「后续建议工作」筛选项，将现有异常映射为三类调拨动作和采购跟单跟进，不新增业务状态或执行动作。 | 否 |
```

- [ ] **步骤 2：运行治理检查**

运行：

```bash
npm run check:prototype-design-governance
```

预期：PASS，输出 `prototype design governance passed`。

- [ ] **步骤 3：运行空白检查**

运行：

```bash
git diff --check
```

预期：无输出，退出码 0。

## 任务 5：构建、浏览器验证、提交

**文件：**
- 验证：`src/pages/wls-fabric-demand-board.ts`
- 验证：`scripts/check-wls-fabric-demand-board.ts`

- [ ] **步骤 1：运行构建**

运行：

```bash
npm run build
```

预期：PASS。若只出现项目已有的 Node deprecation warning，不视为失败。

- [ ] **步骤 2：本地打开页面**

如果当前没有开发服务，启动：

```bash
npm run dev -- --host 0.0.0.0 --port 5174
```

打开：

```text
http://localhost:5174/wls/fabric-demand-board
```

- [ ] **步骤 3：浏览器人工验证**

确认以下可见行为：

- 搜索区出现「后续建议工作」。
- 下拉选项包含 4 类建议工作。
- 选择「采购跟单跟进」并点击「筛选」后，列表只出现缺料类异常。
- 分页文案仍显示，筛选后回到第一页。
- 宽表没有新增列。

- [ ] **步骤 4：提交**

只暂存本次相关文件，不暂存已有未跟踪文件 `docs/product-design/FCS整单生产任务与连续工艺任务产品说明文档.md`：

```bash
git add src/data/wls/fabric-demand-board.ts src/pages/wls-fabric-demand-board.ts scripts/check-wls-fabric-demand-board.ts docs/prototype-review-records/2026-07-06-fabric-demand-board.md
git commit -m "feat: filter fabric demand by next action"
```

预期：提交成功。

## 自检映射

- 规格第 4、5 节页面位置和文案：任务 3 覆盖。
- 规格第 6、7 节业务映射和联动：任务 1、任务 2 覆盖。
- 规格第 8 节空状态：复用现有空状态，任务 3 验证不改宽表结构。
- 规格第 9 节守门检查：任务 1 覆盖。
- 规格第 10 节原型审查记录：任务 4 覆盖。
- 规格第 11、12 节验收和边界：任务 5 覆盖。

