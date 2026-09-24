# 生产准备列表访问时 BOM 存储超限修复

## 1. 基本信息

用户报告访问 `/pcs/production-preparation/orders` 时 BOM 费用仓库写入超限。main 基线 f2b7ad7b6229e8ffefaebe2ebca74a41f1939427，工作树 /Users/laoer/Documents/higoods；同工作树生产构建 preview 4734，Chromium，1366×768。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：已有数据的生产准备列表与详情不再触发补造演示数据和推进演示生命周期；首次初始化容量不足时列表提供明确反馈，BOM 保存失败不污染内存。依据 AGENTS.md 第 4、5、7 节。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 根因与入口 | 通过 | 列表/详情入口调用演示初始化，已有数据仍补充材料、生成技术包，触发 BOM 保存 |
| 已有数据只读 | 通过 | 有任意生产准备记录即保留现状，不为凑足演示数量补建或推进生命周期 |
| 首次 Mock | 通过 | 空仓库仍执行原演示初始化；容量失败显示提示，页面仍可见，无 pageerror |
| 保存与恢复 | 通过 | 存储成功后才更新 BOM 内存；写入失败前后快照一致，可重试 |
| 幂等初始化 | 通过 | 已有 BOM 和费用方案时不重复写入；缺费用方案时仍实际保存 |
| 图片与数量 | 不适用 | 未修改图片、数量、来源及物料渲染 |
| 页面与性能 | 通过 | 禁止 BOM 写入时刷新 5 次、搜索与重置各 5 次；刷新最高 265.71ms，交互最高 43ms |
| PDA、打印、数据库 | 不适用 | 未修改对应入口或连接数据库 |

## 4. 问题标签

只读页面写入副作用、容量超限、内存与存储一致性。

## 5. 主要问题与处理

1. 已有生产准备记录时演示初始化直接返回，避免打开列表/详情时创建技术包和不断追加数据。首次空仓库仍使用原 Mock 初始化流程。
2. BOM 写入先构造临时快照，持久化成功后才替换内存，失败不会出现内存假保存。
3. 已有 BOM 与费用方案的创建调用直接返回，不重写相同快照。
4. 列表仅捕获首次初始化的 QuotaExceededError，显示容量不足说明，其他错误继续抛出，避免掩盖业务错误。未清除用户数据，也未把正式保存失败当成功。

初次浏览器测试错用了不存在的“查询”按钮；本页实际为搜索框即时过滤。修正测试定位后重新执行，产品筛选未改。

## 6. 最终结论

结论：通过。

本地修复与验证通过；验证完成时尚未提交或推送。没有修改线上浏览器数据。存储容量没有扩大，真实保存容量不足仍按失败处理。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-engineering-bom-repository.ts`
- `src/data/pcs-engineering-master-view-model.ts`
- `src/pages/pcs-engineering-master-list.ts`

### 页面路由

- `/pcs/production-preparation/orders`
- `/pcs/production-preparation/orders/:id`（共用已有记录初始化入口；单元契约覆盖）

### 验证命令

- `npm run build`（442 个单元测试和生产构建）：通过
- `node scripts/check-typescript-scope.mjs src/data/pcs-engineering-bom-repository.ts src/data/pcs-engineering-master-view-model.ts src/pages/pcs-engineering-master-list.ts`（范围内 0，范围外既有 6 个错误）：通过
- `CUTTING_E2E_PORT=4734 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pcs-engineering-orders-storage-quota.spec.ts --workers=1 --reporter=line`：通过
- `npm run check:prototype-design-governance`：通过

### 证据

- `evidence/2026-09-24-orders-storage-quota.json`
- `evidence/2026-09-24-orders-storage-quota.png`
- `tests/unit/engineering-bom-storage-atomicity.test.ts`
- `tests/pcs-engineering-orders-storage-quota.spec.ts`

### 例外

- 无。本次 15 个测量样本均 <500ms。
