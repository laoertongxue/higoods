# 特殊工艺加工单简化设计

## 目标

辅助工艺 & 特种工艺的加工单操作栏精简，去掉"上报差异""差异后重交"及所有相关差异数据/文案/代码，加工单只保留 4 个核心操作。

---

## 一、状态模型简化

```
待领料 ──确认接收──→ 加工中 ──完成加工单──→ 已完结（只读）
                      ↑  │  ↑  │  ↑
                      └──┘  └──┘  └── (确认接收/加工填报/发起交出 均可多次)
```

从 11 个状态缩减为 **4 个**：待领料、加工中、已完结。删除中间态和差异相关状态（差异、异议中、异常、已接收、已入待加工仓、已完成、待交出、已交出、已回写等）。

---

## 二、4 个操作定义

### 2.1 操作总览

| 操作 | actionCode | 弹窗展示列 | 可编辑列 |
|------|-----------|-----------|---------|
| 确认接收 | `SPECIAL_CRAFT_CONFIRM_RECEIVE` | 计划数、实收数 | 实收数 |
| 加工填报 | `SPECIAL_CRAFT_PROCESS_REPORT` | 计划数、实收数、完工数 | 完工数 |
| 发起交出 | `SPECIAL_CRAFT_SUBMIT_HANDOVER` | 计划数、实收数、完工数、交出数 | 交出数 |
| 完成加工单 | `SPECIAL_CRAFT_COMPLETE_ORDER` | 计划数、实收数、完工数、交出数、回写数（仅裁片） | 无（只读） |

### 2.2 各操作详细行为

**确认接收**
- 弹窗：按 SKU（成衣）/ 菲票（裁片）逐行展示计划数量、实收数量
- 默认：实收数量 = 计划数量（可改为 planQty 的默认值）
- 可编辑：实收数量
- 约束：实收数 ≥ 0
- 执行后：将接收物料入库到待加工仓指定库区库位，加工单自动开工进入"加工中"
- 支持多次：完成后加工单仍在"加工中"，可继续接收

**加工填报**
- 弹窗：按 SKU/菲票 逐行展示计划数量、实收数量、完工数量
- 默认：完工数量 = 实收数量
- 可编辑：完工数量
- 约束：0 ≤ 完工数量 ≤ 实收数量
- 支持多次

**发起交出**
- 弹窗：按 SKU/菲票 逐行展示计划数量、实收数量、完工数量、交出数量
- 默认：交出数量 = 完工数量
- 可编辑：交出数量
- 约束：0 ≤ 交出数量 ≤ 完工数量
- 支持多次

**完成加工单**
- 弹窗：按 SKU/菲票 逐行展示计划数量、实收数量、完工数量、交出数量、（回写数量仅裁片）
- 所有列只读
- 执行后：加工单进入"已完结"状态，不可再进行确认接收/加工填报/发起交出
- 已完结状态下详情页仍可访问，仅展示"查看详情"按钮

### 2.3 操作栏渲染规则

| 加工单状态 | 可见按钮 |
|-----------|---------|
| 待领料 | 确认接收 |
| 加工中 | 确认接收、加工填报、发起交出 |
| 已完结 | 无（仅查看模式） |

---

## 三、回写数量（裁片菲票特有）

- 裁片菲票交出后，裁床待交出仓的 **特殊工艺回仓** 功能记录实际回仓数量
- 回仓数量自动回写到加工单的 `回写量`（writebackQty）字段
- 排序行按菲票维度：`回写量 ≤ 交出数量`
- 成衣加工无此字段（成衣交出后不走裁片仓回仓流程）

---

## 四、要删除的内容

### 4.1 删除的动作定义

- `SPECIAL_CRAFT_REPORT_DIFFERENCE`（上报差异）
- `SPECIAL_CRAFT_REWORK_AFTER_REJECT`（差异后重交）
- 所有"差异""异常""驳回后重交"相关的 button、dialog、handler

### 4.2 删除的数据结构

- `SpecialCraftTaskAbnormalRecord`（任务单异常记录）
- `ProcessHandoverDifferenceRecord`（仓库域差异记录，如果只用于特殊工艺）

### 4.3 删除的状态值

- 从 `SpecialCraftTaskStatus` 中删除：成衣仓已出库待收货、已入待加工仓、已完成、待交出、已交出、已回写、差异、异议中、异常

---

## 五、涉及的代码文件

| 文件 | 改动 |
|------|------|
| `src/pages/process-factory/special-craft/shared.ts` | 删除差异/重交动作定义，新增完成加工单动作；重命名加工填报动作 |
| `src/pages/process-factory/special-craft/task-detail.ts` | 操作面板改为4按钮；弹窗字段调整；Tabs 去掉"差异异常" |
| `src/pages/process-factory/special-craft/task-orders.ts` | 列表操作列简化；状态筛选选项更新 |
| `src/data/fcs/special-craft-task-orders.ts` | 删除 `SpecialCraftTaskAbnormalRecord`；精简 `SpecialCraftTaskStatus` 为 4 个值；移除异常/差异相关字段 |
| `src/data/fcs/special-craft-operations.ts` | 删除差异/异常相关操作定义 |
| `src/data/fcs/process-warehouse-domain.ts` | 删除或标记废弃 `ProcessHandoverDifferenceRecord` |
| `src/data/fcs/process-warehouse-linkage-service.ts` | 删除差异联动逻辑 |
| `src/data/fcs/process-action-writeback-service.ts` | 删除差异写回逻辑 |
| `src/data/fcs/process-web-status-actions.ts` | 删除差异/重交 action 映射 |
| `src/data/fcs/cutting/special-craft-fei-ticket-flow.ts` | 删除差异同步逻辑 |
| `src/pages/pda-exec-detail.ts` | PDA 删除差异/重交按钮 |
| `src/data/fcs/special-craft-pda-warehouse-actions.ts` | PDA 仓库删除差异动作 |
| `src/data/fcs/special-craft-pda-scope.ts` | PDA 操作范围更新 |

---

## 六、自检清单

- [ ] 所有差异相关文案（上报差异、差异后重交、差异、异常、异议中等）从页面中消失
- [ ] 4 个操作在操作栏中按状态正确显示
- [ ] 确认接收弹窗：逐行计划数+实收数，实收数可改
- [ ] 加工填报弹窗：逐行计划数+实收数+完工数，完工数可改且 ≤ 实收数
- [ ] 发起交出弹窗：逐行计划数+实收数+完工数+交出数，交出数可改且 ≤ 完工数
- [ ] 完成加工单弹窗：全部只读，裁片菲票额外显示回写量
- [ ] 已完结状态：仅查看，无操作按钮
- [ ] 加工中状态三个按钮均可见，均可多次操作
- [ ] 构建通过
- [ ] 原型审查记录
