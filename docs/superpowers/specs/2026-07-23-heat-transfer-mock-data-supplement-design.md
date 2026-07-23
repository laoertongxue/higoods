# 烫画加工单 Mock 数据补齐设计

## 日期

2026-07-23

## 背景

烫画加工单（AUX-OP-HEAT-TRANSFER）当前 mock 数据仅从生产单 pipeline 生成，所有任务状态均为 `待领料`，缺少多种业务状态和异常场景的演示数据。

## 现状

`src/data/fcs/special-craft-task-orders.ts` 中 `buildLinkedSupplementTaskOrders` 函数为除烫画和直喷外的所有特殊工艺运营生成 9 条全流程 demo 数据（覆盖 待领料 → 已回写 等全部状态）。

烫画在第 1432 行被显式排除：
```typescript
if (operation.operationName === '直喷' || operation.operationName === '烫画') return
```

## 方案

删除烫画的排除条件，复用现有 linked demo 生成框架。

**改动文件**: `src/data/fcs/special-craft-task-orders.ts`
**改动行**: 1432
**改动内容**:

```diff
- if (operation.operationName === '直喷' || operation.operationName === '烫画') return
+ if (operation.operationName === '直喷') return
```

## 产出数据

改动后自动生成 9 条烫画加工单 demo 数据：

| variantIndex | status | abnormalStatus | 场景 |
|---|---|---|---|
| 0 | 待领料 | 无异常 | 成衣烫画加工单待领料 |
| 1 | 已入待加工仓 | 无异常 | 成衣已入后道待加工仓 |
| 2 | 加工中 | 设备异常 | 加工进行中 + 设备异常登记 |
| 3 | 已完成 | 无异常 | 烫画加工已完成 |
| 4 | 待交出 | 无异常 | 等待交回我方后道工厂 |
| 5 | 已交出 | 无异常 | 已交回后道工厂 |
| 6 | 已回写 | 无异常 | 接收方已回写确认 |
| 7 | 差异 | 数量差异 | 回写数量与交出数量不符 |
| 8 | 异议中 | 数量差异 | 数量异议处理中 |

每条自动附带：
- 成衣仓 → 后道待加工仓 仓储流转
- 流转节点记录（待领料 → 入仓 → 开工 → 完工 → 待交出 → 交出 → 回写/差异/异议）
- 异常记录（设备异常、数量差异）
- 出入库记录、待加工仓/待交出仓库存

## 不变项

- 烫画工艺字典定义（`process-craft-dict.ts`）
- 烫画运营分类定义（`special-craft-operations.ts`）
- 烫画专属工厂（`special-craft-dedicated-factories.ts`）
- 仓储流转规则（`resolveAuxiliaryWarehouseFlow`）
- 列表页（`task-orders.ts`）
- 工单详情页（`work-order-detail.ts`）
- PDA 页面
- 生产单 pipeline 生成路径（去重 key 不同，互不覆盖）

## 验证

1. `npm run build` 通过
2. `npm run check:prototype-design-governance` 通过
3. 访问 `/fcs/process-factory/special-craft/aux-op-heat-transfer/tasks`，列表中可见多种状态加工单
4. 按状态筛选正常运作
5. 工单详情页展示完整流转节点和仓储信息
