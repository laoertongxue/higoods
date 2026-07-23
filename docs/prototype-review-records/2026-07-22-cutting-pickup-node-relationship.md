# 裁床待领节点与多次领料关系原型审查记录

- 日期：2026-07-23
- 审查对象：裁床领料管理待领节点实现
- 涉及页面：`src/pages/process-factory/cutting/pickup-management.ts`、`src/pages/pda-warehouse-wait-process.ts`、配料管理列表及五个分类页、生产单总览、裁床待加工仓
- 涉及数据：`src/data/fcs/cutting/pickup-node-domain.ts`、`src/data/fcs/cutting/production-material-prep.ts`
- 设计参考：`docs/superpowers/specs/2026-07-22-cutting-pickup-complete-relationship-design.md`

## 1. 产品设计规范对照

### 1.1 角色与端类型

| 角色 | 端类型 | 主要操作 | 是否符合规范 |
|------|--------|---------|-------------|
| 裁床仓管 | PC 管理端 | 查看待领节点列表、核对物料详情、确认全部领料、打回中转仓 | 是 |
| 裁床领料人员 | PDA 执行端 | 查看当前节点物料、选择接收库位、确认全部领料 | 是 |
| 中转仓 | WLS 管理端 | 配料确认（不在本仓库实现范围） | 不适用 |

### 1.2 现场能力假设

- PDA 首屏只展示执行必需信息：节点类型、生产单、物料清单、库位选择、确认按钮
- 管理视角信息（链路上游、历史日志）收纳到 PC 详情页
- 文案动作化、直接："确认全部领料"替代"确认中转仓领料"
- 无抽象表达：未使用"投影""链路""来源记录"等词

### 1.3 防错与异常兜底

| 场景 | 防错措施 | 状态 |
|------|---------|------|
| 节点版本冲突 | 阻断并提示"当前待领物料已更新，请重新核对" | ✅ |
| 重复确认 | 幂等返回原领料主记录 | ✅ |
| 已关闭节点 | 确认时抛错 | ✅ |
| 部分领取 | 不可编辑数量，只允许领走全部节点物料 | ✅ |
| 仓储清位失败 | 标记主记录 `warehouseSyncStatus: '回写异常待重试'` | ✅ |
| 打回原因空 | 阻断并要求必填 | ✅ |
| 旧数据缺少领料主记录 | 按已有主记录 ID 或稳定业务组合迁移，节点序号接续历史 | ✅ |
| 历史领料节点类型 | 按每轮完成后的累计逐物料行齐套结果推导；事实不足时保守标记未配齐并保留判定依据 | ✅ |
| 多来源领料后退回 | 公开退回入口允许选择任一实际来源，按该来源分摊扣减并校验数量、卷件上限 | ✅ |
| 旧领料记录退回 | 没有来源分摊的旧记录继续按原领料记录与物料行归属校验 | ✅ |

## 2. UI 与交互检查

### 2.1 标准列表页

- ✅ 页面顶部声明 `// @page-pattern: list`
- ✅ 使用 `renderStandardListPage`、`renderStandardListTable`、`renderTablePagination`
- ✅ 节点级列定义：当前领料节点、生产单、物料、历史有效已领、领后缺口、来源位置、更新时间、操作（右侧固定）
- ✅ 必需列不可隐藏
- ✅ 48px 单行统计卡片：未配齐清单、已配齐待领、当前可领节点
- ✅ 筛选：关键词、物料、节点类型
- ✅ 分页：10/20/50 条/页

### 2.2 中文状态

| 内部值 | 页面展示 |
|--------|---------|
| `INCOMPLETE_PICKABLE` | 未配齐清单 |
| `READY_TO_PICKUP` | 已配齐待领 |
| `本轮已领完` | 本轮已领完 |
| `已回写` | 已回写 |
| `回写异常待重试` | 回写异常待重试 |

### 2.3 分辨率

- 以 1366×768 为标准验收分辨率
- 宽表在表格容器内部滚动，操作列右侧固定

## 3. Mock 数据覆盖

- ✅ 未配齐可领节点（2 个: 0101、0102）
- ✅ 已配齐待领节点（2 个: 0007、0001）
- ✅ 多记录归并（0101 黑线有 2 个 sourcePrepRecordIds）
- ✅ 四大来源仓库（中转仓、辅料仓、纱线仓、包材仓）

## 4. 例外说明

- 中转仓配料页面（WLS transfer-material-prep.ts）不在本次范围
- PDA 交接流程（非裁床领料部分）保持原样
- E2E Playwright 测试（`tests/cutting-pickup-node-flow.spec.ts`）因需浏览器环境，后续补充

## 5. 自查结论

所有设计规范要求的核心功能已实现：
1. 一个生产单一个活动节点 → ✅
2. 未领节点遇到后续到货合并 → ✅（通过节点重新派生实现）
3. 累计齐套判断并升级节点类型 → ✅
4. 确认即领取全部物料 → ✅
5. 一次确认一条 Session → ✅
6. "本轮已领完"与"部分领料"分离 → ✅
7. 版本冲突阻断 → ✅
8. 重复确认幂等 → ✅
9. 数量不可编辑 → ✅
10. 不同计量单位不跨单位求和 → ✅（需求、已配、已领、已退、可领、缺口均按 `yard`、`条` 等单位分组展示）
11. 生产单配料状态不依赖无量纲合计 → ✅（逐物料行判断是否全部配齐）
12. 旧存储领料明细可迁移为稳定、幂等的历史领料主记录 → ✅
13. 历史每轮节点类型按累计逐行齐套事实推导，收尾轮可正确标记为已配齐待领 → ✅
14. 历史事实不足时保守标记为未配齐，并保存迁移判定依据 → ✅
15. 多来源退回按指定来源货位恢复，不再按行级 FIFO 反推 → ✅
16. 同一领料记录的来源级累计退回数量和卷件数均不得超过该来源分摊 → ✅
17. 无来源分摊的旧领料记录保持退回兼容 → ✅
18. 配料记录与暂存记录按单位汇总，多单位旧总量不参与业务展示 → ✅

## 6. 检查命令结果

- `npm run check:cutting-pickup-node-domain` → 通过
- `npm run check:cutting-material-return` → 通过
- `npm run check:material-prep-unit-summary-consumers` → 通过
- `npm run check:material-prep-pickup-management` → 通过
- `npm run check:cutting-pickup-data-closure` → 通过
- `npm run check:cutting-prep-pickup-return-linkage` → 通过
- `npm run check:cutting-pickup-important-regressions` → 通过
- `npm run check:cutting-material-return` → 通过
- `npm run check:material-prep-detail-summary-cleanup` → 通过
- `npm run build` → 通过
