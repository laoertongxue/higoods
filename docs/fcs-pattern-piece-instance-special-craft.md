# 逐片特殊工艺配置

## 目标

逐片特殊工艺配置用于把特殊工艺从“部位行”下沉到“裁片实例”。同一部位在不同颜色、不同片序下可以有不同工艺，后续菲票逐片生成时可以直接按 `pieceInstanceId` 追溯。

## 裁片实例生成

裁片实例来自纸样裁片明细中的“适用颜色 + 每种颜色片数”：

- 只处理 `enabled = true` 且 `pieceQty > 0` 的颜色。
- 每个颜色按 `pieceQty` 生成对应数量的实例。
- `sequenceNo` 从 1 开始。
- `pieceInstanceId` 由纸样、裁片明细、颜色和片序组合生成，保持稳定。
- 颜色片数增加时新增实例。
- 颜色片数减少且会删除已配置工艺的实例时，必须由用户确认。

## 字段说明

裁片实例字段：

- `pieceInstanceId`：裁片实例 ID。
- `sourcePieceId`：来源裁片明细 ID。
- `pieceName`：部位名称。
- `colorId` / `colorName`：颜色 ID 和颜色名称。
- `sequenceNo`：同一部位同一颜色下的片序号。
- `displayName`：例如“前片 / 黑色 / 第1片”。
- `specialCraftAssignments`：当前裁片实例的特殊工艺配置。

特殊工艺配置字段：

- `craftCode` / `craftName`：工艺编码和名称。
- `craftCategory` / `craftCategoryName`：辅助工艺或特种工艺。
- `targetObject` / `targetObjectName`：适用对象。
- `craftPosition` / `craftPositionName`：工艺位置。
- `remark`：备注。

## 位置规则

每个裁片实例的每一种特殊工艺必须选择且只能选择一个位置：

- 左
- 右
- 底
- 面

同一裁片实例不能重复添加同一个 `craftCode`。如需调整位置，应编辑已有配置，不应新增重复配置。

## 可选工艺范围

逐片特殊工艺选择器读取工序工艺字典中的 `listCutPiecePartCrafts()`。

允许裁片部位级特殊工艺，例如绣花、打条、压褶、打揽、烫画、直喷、贝壳绣、曲牙绣、一字贝绣花、模板工序、激光开袋、特种车缝（花样机）。

以下工艺不得进入逐片特殊工艺选择器：

- 捆条：面料级工艺，跟随纸样捆条区域维护。
- 橡筋定长切割：辅料级工艺。
- 缩水：准备阶段面料工序。
- 洗水：准备阶段面料工序。

## 快照保存

保存纸样和技术包版本快照时必须保留：

- `pieceInstances`
- `specialCraftAssignments`
- `craftPosition`
- `craftPositionName`
- `sourcePieceId`
- `colorId`
- `colorName`
- `sequenceNo`

本次只保存逐片特殊工艺配置，不生成菲票，不生成特殊工艺任务。

## 流程图

维护颜色片数
-> 系统生成裁片实例
-> 打开维护逐片工艺
-> 选择裁片实例
-> 添加特殊工艺
-> 选择左右底面位置
-> 保存逐片特殊工艺
-> 技术包版本快照保留裁片实例和特殊工艺

## 状态机

未生成裁片实例
-> 已生成裁片实例
-> 待维护特殊工艺
-> 已维护特殊工艺
-> 已保存到技术包快照

异常状态：

颜色片数减少
-> 命中已配置裁片实例
-> 待用户确认
-> 返回修改或确认删除配置
