# 特殊工艺加工单简化设计

## 目标

辅助工艺 & 特种工艺的加工单操作栏精简：去掉"上报差异""差异后重交"及所有相关差异数据/文案/代码，加工单只保留 4 个核心操作。

---

## 一、当前架构（基于代码审查）

### 1.1 当前状态机（11 个状态）

```
src/data/fcs/special-craft-task-orders.ts:46-57

 待领料 → 成衣仓已出库待收货 → 已入待加工仓 → 加工中 → 已完成 → 待交出 → 已交出 → 已回写
                                                                    ↓                ↓
                                                              差异 / 异议中 / 异常
```

- `SpecialCraftTaskStatus`: 11 个值
- `SpecialCraftTaskExecutionStatus`: 9 个英文字段（`WAIT_PICKUP`, `IN_WAIT_PROCESS_WAREHOUSE`, `PROCESSING`, `COMPLETED`, `WAIT_HANDOVER`, `HANDED_OVER`, `WRITTEN_BACK`, `DIFFERENCE`, `OBJECTION`, `ABNORMAL`）

### 1.2 当前 5 个操作定义

**来源 A**：`src/pages/process-factory/special-craft/shared.ts:223-296`（前端动作）

| actionCode | label | fromStatuses | toStatus |
|------------|-------|--------------|----------|
| `SPECIAL_CRAFT_CONFIRM_RECEIVE` | 确认接收 | `待领料` | `加工中` |
| `SPECIAL_CRAFT_FINISH_PROCESS` | 完成加工 | `加工中` | `待交出` |
| `SPECIAL_CRAFT_REPORT_DIFFERENCE` | 上报差异 | `已接收/已入待加工仓/加工中/加工完成/待交出` | `差异` |
| `SPECIAL_CRAFT_SUBMIT_HANDOVER` | 发起交出 | `待交出` | `已交出` |
| `SPECIAL_CRAFT_REWORK_AFTER_REJECT` | 差异后重交 | `差异/异议中/异常/交出待收货/收货差异` | `待交出` |

> 注：`shared.ts:468-505` 中，`CONFIRM_RECEIVE` / `FINISH_PROCESS` / `SUBMIT_HANDOVER` 三个动作使用自定义 SKU/菲票表格弹窗；差异和重交使用通用 `openProcessWebStatusActionDialog`。

**来源 B**：`src/data/fcs/process-action-writeback-service.ts:520-568`（写回服务）

| actionCode | label | fromStatuses | toStatus | writebackHandler |
|------------|-------|--------------|----------|------------------|
| `SPECIAL_CRAFT_START_PROCESS` | 开始加工 | `已接收/待加工/已入待加工仓` | `加工中` | updateStatus |
| `SPECIAL_CRAFT_FINISH_PROCESS` | 完成加工 | `加工中` | `待交出` | updateStatus |
| `SPECIAL_CRAFT_REPORT_DIFFERENCE` | 上报差异 | `已接收/已入待加工仓/加工中/加工完成/待交出` | `差异` | createDifferenceRecord |
| `SPECIAL_CRAFT_SUBMIT_HANDOVER` | 发起交出 | `加工完成/待交出` | `交出待收货` | createHandoverRecord |
| `SPECIAL_CRAFT_REWORK_AFTER_REJECT` | 差异后重交 | `差异/异议中/异常/交出待收货/收货差异` | `待交出` | updateStatus |

> 注：写回服务中还有 `SPECIAL_CRAFT_CONFIRM_RECEIVE`（定义在 `process-action-writeback-service.ts:210-220` 附近）。

### 1.3 当前数据模型（关键字段）

`src/data/fcs/special-craft-task-orders.ts:205-281` — `SpecialCraftTaskOrder`

关键数量字段：
- `planQty` — 计划数量
- `receivedQty` — 已接收数量
- `completedQty` — 已完成数量
- `currentQty` — 当前数量（动态）
- `lossQty` — 损耗数量
- `damageQty` — 货损数量
- `returnedQty` — 已交出数量
- `waitHandoverQty` — 待交出数量

状态/异常字段：
- `status: SpecialCraftTaskStatus` — 主状态
- `abnormalStatus: SpecialCraftTaskAbnormalStatus` — 异常状态
- `abnormalRecords: SpecialCraftTaskAbnormalRecord[]` — 异常记录列表

差异相关：
- `openDifferenceReportCount` — 未关闭差异报告数
- `openObjectionCount` — 未关闭异议数

### 1.4 当前详情页 Tab 结构

`src/pages/process-factory/special-craft/task-detail.ts:36-42`

| Tab key | label | 内容 |
|---------|-------|------|
| `overview` | 概览 | 基本信息 + 任务明细摘要 + 裁片/面料/成衣信息 |
| `demand` | 任务明细 | 需求行（部位/颜色/尺码/每件片数/计划数量/纸样/菲票） |
| `warehouse` | 仓库流转 | 菲票流转 + 仓库记录（含差异/异议列） |
| `exceptions` | 差异异常 | 接收差异上报/回仓差异上报 + 异常记录 |
| `events` | 节点记录 | 操作日志（节点/操作/数量/操作人/时间） |

### 1.5 当前列表页状态筛选

`src/pages/process-factory/special-craft/task-orders.ts:66-74`

```typescript
const TASK_STATUS_OPTIONS = [
  '全部', '待领料', '待加工', '加工中', '待交出', '已完成', '差异'
]
```

统计卡片（`renderStats:338-346`）：加工单数、待领料、加工中、待交出、差异/异常

---

## 二、目标架构

### 2.1 新状态机（4 个状态）

```
                    ┌─────────────────────────────────┐
                    │ 确认接收/加工填报/发起交出 (可多次) │
                    │ ← 仅 "加工中" 状态下可见           │
                    └─────┬───────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────┐    ┌─────────────┐    ┌───────────┐
│  待领料    │───→│   加工中     │───→│  已完结   │
│ PENDING   │ 确认│ PROCESSING  │完成│ COMPLETED │
│           │ 接收│             │加工│ (只读)    │
└───────────┘    └─────────────┘    └───────────┘
```

**删除状态**：成衣仓已出库待收货、已入待加工仓、已完成、待交出、已交出、已回写、差异、异议中、异常

**状态定义**：

| 状态值 | 含义 | 可执行操作 |
|--------|------|-----------|
| `待领料` | 加工单已生成，等待工厂接收物料 | 确认接收 |
| `加工中` | 物料已入库待加工仓，正在执行加工 | 确认接收、加工填报、发起交出 |
| `已完结` | 加工单已完成所有操作并结单 | 无（仅查看） |

**触发条件**：

| 触发 | 条件 | 动作 |
|------|------|------|
| `待领料 → 加工中` | 用户点击"确认接收"，弹窗填入实收数量 | 物料入库到待加工仓指定库区库位 + 自动开工 |
| `加工中 → 已完结` | 用户点击"完成加工单"，弹窗只读确认 | 结单，所有操作禁用 |
| `加工中 → 加工中` | 确认接收/加工填报/发起交出（不含完成加工单）| 状态保持不变，仅更新数量 |

### 2.2 新操作定义

| 操作 | actionCode | label | fromStatus | toStatus | 弹窗类型 |
|------|-----------|-------|-----------|----------|---------|
| 确认接收 | `SPECIAL_CRAFT_CONFIRM_RECEIVE` | 确认接收 | `待领料` / `加工中` | `加工中` | 逐行表格（可编辑实收数） |
| 加工填报 | `SPECIAL_CRAFT_PROCESS_REPORT` | 加工填报 | `加工中` | `加工中` | 逐行表格（可编辑完工数） |
| 发起交出 | `SPECIAL_CRAFT_SUBMIT_HANDOVER` | 发起交出 | `加工中` | `加工中` | 逐行表格（可编辑交出数） |
| 完成加工单 | `SPECIAL_CRAFT_COMPLETE_ORDER` | 完成加工单 | `加工中` | `已完结` | 逐行表格（全部只读） |

### 2.3 弹窗字段矩阵

#### 成衣（按 SKU 逐行）

| 弹窗 | 颜色 | 尺码 | 计划件数 | 实收件数 | 完工件数 | 交出件数 | 回写件数 | 可编辑列 |
|------|------|------|---------|---------|---------|---------|---------|---------|
| 确认接收 | ○ | ○ | ○ | ○ | - | - | - | 实收件数 |
| 加工填报 | ○ | ○ | ○ | ○ | ○ | - | - | 完工件数 |
| 发起交出 | ○ | ○ | ○ | ○ | ○ | ○ | - | 交出件数 |
| 完成加工单 | ○ | ○ | ○ | ○ | ○ | ○ | - | 无（只读） |

- 确认接收默认：实收件数 = 计划件数
- 加工填报默认：完工件数 = 实收件数，约束 ≤ 实收件数
- 发起交出默认：交出件数 = 完工件数，约束 ≤ 完工件数

#### 裁片菲票（按菲票逐行）

| 弹窗 | 菲票号 | 部位 | 颜色 | 尺码 | 计划数 | 实收数 | 完工数 | 交出数 | 回写数 | 可编辑列 |
|------|--------|------|------|------|--------|--------|--------|--------|--------|---------|
| 确认接收 | ○ | ○ | ○ | ○ | ○ | ○ | - | - | - | 实收数 |
| 加工填报 | ○ | ○ | ○ | ○ | ○ | ○ | ○ | - | - | 完工数 |
| 发起交出 | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | - | 交出数 |
| 完成加工单 | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | 无（只读） |

- 确认接收：不可删除菲票行
- 加工填报默认：完工数 = 实收数，约束 ≤ 实收数，不可删除菲票行
- 发起交出默认：交出数 = 完工数，约束 ≤ 完工数
- 完成加工单：回写数由裁床待交出仓特殊工艺回仓功能写入，此处只读

---

## 三、时序图

### 3.1 确认接收时序

```
用户          操作面板       弹窗           写回服务         仓库系统
 │              │             │               │               │
 │ 点击确认接收  │             │               │               │
 │─────────────→│             │               │               │
 │              │ 打开弹窗     │               │               │
 │              │────────────→│               │               │
 │              │             │ 展示逐行表格   │               │
 │              │             │ (计划数+实收数)│               │
 │  逐行填写    │             │               │               │
 │  实收数量    │             │               │               │
 │─────────────→│             │               │               │
 │              │             │               │               │
 │ 点击确认     │             │               │               │
 │─────────────→│             │               │               │
 │              │ 收集行数据  │               │               │
 │              │────────────→│               │               │
 │              │             │ executeProcessWebAction       │
 │              │             │──────────────→│               │
 │              │             │               │ 入库到待加工仓 │
 │              │             │               │──────────────→│
 │              │             │               │ 自动开工      │
 │              │             │               │ (待领料→加工中)│
 │              │             │               │               │
 │              │             │  返回结果     │               │
 │              │             │←──────────────│               │
 │              │ 刷新页面    │               │               │
 │              │←─────────── │               │               │
 │ 显示 toast   │             │               │               │
 │←─────────────│             │               │               │
```

### 3.2 加工填报时序

```
用户          操作面板       弹窗           写回服务
 │              │             │               │
 │ 点击加工填报  │             │               │
 │─────────────→│             │               │
 │              │ 打开弹窗     │               │
 │              │────────────→│               │
 │              │             │ 展示逐行表格   │
 │              │             │ (计划+实收+完工│
 │              │             │  完工默认=实收)│
 │  逐行修改    │             │               │
 │  完工数量    │             │               │
 │  (≤实收)    │             │               │
 │─────────────→│             │               │
 │              │             │               │
 │ 点击确认     │             │               │
 │─────────────→│             │               │
 │              │ 校验 ≤ 实收 │               │
 │              │────────────→│               │
 │              │             │ writeback     │
 │              │             │──────────────→│
 │              │             │               │ 更新 completedQty
 │              │             │               │ 状态保持"加工中"
 │              │             │  返回结果     │
 │              │             │←──────────────│
 │              │ 刷新        │               │
 │ 显示 toast   │             │               │
 │←─────────────│             │               │
```

### 3.3 发起交出时序

```
用户          操作面板       弹窗           写回服务         仓库系统
 │              │             │               │               │
 │ 点击发起交出  │             │               │               │
 │─────────────→│             │               │               │
 │              │ 打开弹窗     │               │               │
 │              │────────────→│               │               │
 │              │             │ 展示逐行表格   │               │
 │              │             │ (计划+实收+完工│               │
 │              │             │  +交出 交出=完工)│              │
 │  逐行修改    │             │               │               │
 │  交出数量    │             │               │               │
 │  (≤完工)    │             │               │               │
 │─────────────→│             │               │               │
 │              │             │               │               │
 │ 点击确认     │             │               │               │
 │─────────────→│             │               │               │
 │              │ 校验 ≤ 完工 │               │               │
 │              │────────────→│               │               │
 │              │             │ writeback     │               │
 │              │             │──────────────→│               │
 │              │             │               │ 出库到待交出仓 │
 │              │             │               │──────────────→│
 │              │             │               │ 更新 returnedQty
 │              │             │               │ 状态保持"加工中"│
 │              │             │  返回结果     │               │
 │              │             │←──────────────│               │
 │              │ 刷新        │               │               │
 │ 显示 toast   │             │               │               │
 │←─────────────│             │               │               │
```

### 3.4 完成加工单时序

```
用户          操作面板       弹窗           写回服务
 │              │             │               │
 │ 点击完成加工单│             │               │
 │─────────────→│             │               │
 │              │ 打开弹窗     │               │
 │              │────────────→│               │
 │              │             │ 展示逐行表格   │
 │              │             │ (全部字段只读) │
 │              │             │ 回写数(仅裁片) │
 │ 查看确认     │             │               │
 │─────────────→│             │               │
 │              │             │               │
 │ 点击完成     │             │               │
 │─────────────→│             │               │
 │              │────────────→│               │
 │              │             │ writeback     │
 │              │             │──────────────→│
 │              │             │               │ 加工中→已完结
 │              │  返回结果   │               │
 │              │←────────────│               │
 │              │ 刷新        │               │
 │ 显示 toast   │             │               │
 │←─────────────│             │               │
 │ 操作栏隐藏   │             │               │
 │ (仅查看模式) │             │               │
```

---

## 四、数据处理规则

### 4.1 数量累积逻辑

所有操作（确认接收、加工填报、发起交出）支持多次执行，每次执行后累加对应字段：

| 操作 | 累加字段 | 公式 |
|------|---------|------|
| 确认接收 | `receivedQty` | `receivedQty += 本次实收数` |
| 加工填报 | `completedQty` | `completedQty = 本次完工数`（累积覆盖） |
| 发起交出 | `returnedQty` | `returnedQty += 本次交出数` |

> 注：弹出弹窗时，各字段默认值基于最新累计值计算：
> - 实收数默认 = 本次可接收的剩余（planQty - receivedQty）
> - 完工数默认 = 本次可完工的剩余（receivedQty - completedQty）
> - 交出数默认 = 本次可交出的剩余（completedQty - returnedQty）

### 4.2 回写数量（仅裁片菲票）

- `writebackQty`（回写量）：由裁床待交出仓的特殊工艺回仓功能写入
- 在完成加工单弹窗中只读展示
- `writebackQty ≤ returnedQty`，每个菲票独立追踪
- 在 `SpecialCraftTaskOrder` 中新增字段：`writebackQty: number` 和 `writebackQtyByTicketNo: Record<string, number>`

### 4.3 状态流转规则

```
待领料:
  ├── 确认接收 → 加工中 (每次执行 status 不变或变为 加工中)
  
加工中:
  ├── 确认接收 → 加工中 (status 不变)
  ├── 加工填报 → 加工中 (status 不变)
  ├── 发起交出 → 加工中 (status 不变)
  └── 完成加工单 → 已完结

已完结:
  └── 无可用操作 (只读查看)
```

---

## 五、文件级改动清单

### 5.1 `src/pages/process-factory/special-craft/shared.ts`

**删除**：
- `getFastSpecialCraftWebActions` 中的 `SPECIAL_CRAFT_REPORT_DIFFERENCE` 和 `SPECIAL_CRAFT_REWORK_AFTER_REJECT` 定义
- `renderStatusBadge` 中的差异/异议/异常 tone 逻辑

**修改**：
- `getFastSpecialCraftWebActions`：
  - `SPECIAL_CRAFT_CONFIRM_RECEIVE` 的 `fromStatuses` 改为 `['待领料', '加工中']`
  - 重命名 `SPECIAL_CRAFT_FINISH_PROCESS` → `SPECIAL_CRAFT_PROCESS_REPORT`，label 改为"加工填报"
  - `SPECIAL_CRAFT_SUBMIT_HANDOVER` 的 `fromStatuses` 改为 `['加工中']`，`toStatus` 改为 `加工中`
  - 新增 `SPECIAL_CRAFT_COMPLETE_ORDER`，`fromStatuses: ['加工中']`，`toStatus: '已完结'`
- `renderGarmentSkuConfirmDialog`：增加完工数/交出数列支持（通过参数控制显示哪些列）
- `renderCutPieceFeiTicketConfirmDialog`：增加完工数/交出数/回写数列支持

### 5.2 `src/pages/process-factory/special-craft/task-detail.ts`

**删除**：
- Tab `exceptions`（差异异常）— 从 Tab 列表中移除
- `abnormalRows` 渲染逻辑
- `differenceRows` 渲染逻辑
- `sections['exceptions']` 内容
- 基本信息中 `abnormalStatus` 显示

**修改**：
- 操作面板（`<aside>`）：右侧摘要卡片去掉 `待交出` 行，增加 `已完结` 行
- `handleSpecialCraftTaskDetailEvent`（行 430-597）：
  - `isCustomDialog` 条件增加 `SPECIAL_CRAFT_PROCESS_REPORT` 和 `SPECIAL_CRAFT_COMPLETE_ORDER`
  - 各弹窗标题文案更新
  - 移除 `openProcessWebStatusActionDialog` 的差异/重交 fallback 路径
  - 完成加工单弹窗收集数据时标记 `isComplete: true`

### 5.3 `src/pages/process-factory/special-craft/task-orders.ts`

**修改**：
- `TASK_STATUS_OPTIONS`：删除 '待加工'、'待交出'、'已完成'、'差异'，改为 `['全部', '待领料', '加工中', '已完结']`
- `renderStats`：删除差异/异常统计，增加已完结统计
- 操作列（`actions` 的 render）：继续复用 `getFastSpecialCraftWebActions`，自动获得 3 按钮

### 5.4 `src/data/fcs/special-craft-task-orders.ts`

**删除**：
- `SpecialCraftTaskAbnormalRecord` 接口（行 192-203）
- 以下状态值：`成衣仓已出库待收货`、`已入待加工仓`、`已完成`、`待交出`、`已交出`、`已回写`、`差异`、`异议中`、`异常`

**修改**：
- `SpecialCraftTaskStatus` 改为 `'待领料' | '加工中' | '已完结'`
- `SpecialCraftTaskExecutionStatus` 对应精简
- `SpecialCraftTaskAbnormalStatus` 删除或用 `'无异常'` 占位
- `SpecialCraftTaskOrder` 接口：
  - 删除 `abnormalRecords`、`openDifferenceReportCount`、`openObjectionCount`
  - `receivedQty` / `completedQty` / `returnedQty` 保留（用于多次累积）
  - 新增 `writebackQty: number`
- `SpecialCraftTaskWarehouseLink`（行 176-189）：
  - `status` 删除 `'差异'` `'异议中'`，保留 `'已入库' | '待交出' | '已出库' | '已回写'`
- Seed 数据中所有使用旧状态的任务单更新为 3 状态

### 5.5 `src/data/fcs/process-action-writeback-service.ts`

**删除**：
- `SPECIAL_CRAFT_REPORT_DIFFERENCE` 定义（行 538-548）
- `SPECIAL_CRAFT_REWORK_AFTER_REJECT` 定义（行 560-568）
- `SPECIAL_CRAFT_START_PROCESS` 定义（如果不再需要）
- 行 1200-1259 中差异记录创建逻辑
- 行 1222-1259 中 `createProcessHandoverDifferenceRecord` 调用
- 行 852-900 中仓库联动服务的差异分支

**修改**：
- `SPECIAL_CRAFT_FINISH_PROCESS` → `SPECIAL_CRAFT_PROCESS_REPORT`，label "加工填报"
- `SPECIAL_CRAFT_SUBMIT_HANDOVER`：`fromStatuses` 改为 `['加工中']`，`toStatus` 改为 `加工中`
- 新增 `SPECIAL_CRAFT_COMPLETE_ORDER`：`fromStatuses: ['加工中']`，`toStatus: '已完结'`
- `SPECIAL_CRAFT_CONFIRM_RECEIVE`：`fromStatuses` 改为 `['待领料', '加工中']`
- 写回 handler 中 `returnedQty` 赋值改为累加而非覆盖

### 5.6 `src/data/fcs/process-warehouse-linkage-service.ts`

**删除**：
- `SPECIAL_CRAFT_REPORT_DIFFERENCE` 分支和差异处理逻辑
- `SPECIAL_CRAFT_REWORK_AFTER_REJECT` 相关代码

### 5.7 `src/data/fcs/process-web-status-actions.ts`

**修改**：
- 删除 `SPECIAL_CRAFT_REPORT_DIFFERENCE` 和 `SPECIAL_CRAFT_REWORK_AFTER_REJECT` 的 action 映射

### 5.8 `src/data/fcs/cutting/special-craft-fei-ticket-flow.ts`

**删除**：差异同步逻辑（如有）

### 5.9 PDA 端文件

| 文件 | 改动 |
|------|------|
| `src/pages/pda-exec-detail.ts` | 删除差异/重交按钮，更新 actionCode 映射 |
| `src/data/fcs/special-craft-pda-warehouse-actions.ts` | 删除差异动作定义 |
| `src/data/fcs/special-craft-pda-scope.ts` | 更新操作范围 |

---

## 六、自检清单

- [ ] `SpecialCraftTaskStatus` 仅含 3 个值：待领料、加工中、已完结
- [ ] `getFastSpecialCraftWebActions` 仅返回 4 个 action（根据状态过滤）
- [ ] 待领料状态仅显示"确认接收"按钮
- [ ] 加工中状态显示"确认接收""加工填报""发起交出"三个按钮
- [ ] 已完结状态不显示操作按钮，详情页只读
- [ ] 确认接收弹窗：逐行计划数+实收数，实收数可改
- [ ] 加工填报弹窗：逐行计划数+实收数+完工数，完工数可改，前端校验 ≤ 实收数
- [ ] 发起交出弹窗：逐行计划数+实收数+完工数+交出数，交出数可改，前端校验 ≤ 完工数
- [ ] 完成加工单弹窗：全部只读，裁片额外显示回写数
- [ ] 详情页 Tabs 无"差异异常"Tab
- [ ] 列表页状态筛选无差异相关选项
- [ ] 所有差异/异常文案从页面和代码中消失
- [ ] `SpecialCraftTaskAbnormalRecord` 和相关字段删除
- [ ] `npm run build` 通过
- [ ] 原型审查记录
