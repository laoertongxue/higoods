# 批量复制设计改款草稿时 BOM 存储超限修复

## 1. 基本信息

基线 main / 04b3a7c7832e582e57634014123c8151d596834d，工作树 /Users/laoer/Documents/higoods。命名入口：设计改款任务列表“批量复制为草稿”。Chromium 1366×768，本地同工作树生产构建 preview 4735。

现场只读诊断：站点 localStorage 共 5,241,333 字符；BOM 仓库 326,094 字符，134 个版本、92 个费用方案，重复字符串占 132,142 字符。没有修改或清除用户浏览器数据。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：缓解已有数据接近存储上限时的复制失败，真实容量不足时明确告知未生成草稿。依据 AGENTS.md 第 4、5、7 节。

## 3. 自查结论

| 项目 | 结论 | 说明 |
| --- | --- | --- |
| 原始问题 | 通过 | BOM 每次写全量 JSON，重复字段和值占用额度，复制新增记录超过站点共享容量 |
| 数据保护 | 通过 | 单个存储值内无损字典编码；不删历史、不改金额数量，不依赖其他存储键 |
| 历史读取 | 通过 | 兼容原始 JSON，新编码仅在比原 JSON 更小时使用，下一次实际保存时更新 |
| 原子性 | 通过 | 持久化成功后才替换内存；未变更的快照回滚不再重复写入 |
| 错误反馈 | 通过 | 容量拒写保留原任务并返回中文提示，不伪报成功 |
| 图片 | 通过 | 原图片字符串无损还原；沿用现有图片渲染，未替换素材 |
| PDA、打印、数据库 | 不适用 | 本次不修改这些入口或连接数据库 |

## 4. 问题标签

浏览器共享容量、重复数据、复制回滚。

## 5. 实施与证据对应

1. 存储减量：pcs-engineering-bom-storage.ts 编解码字典；单元验证旧格式、无损回读、缩减、坏引用拒绝。
2. 接入：pcs-engineering-bom-repository.ts 在原键读写，保留内存更新顺序；同快照回滚无需重写。
3. 错误反馈：pcs-engineering-master-sampling.ts 保留逐张回滚规则，容量错误返回明确中文说明。
4. 浏览器：初始化演示关联后填充本地测试站点至 5 Mi 字符附近，旧格式读取、复制、刷新、新草稿详情重复五轮；容量拒写分支验证零新增与可重试。用户现场数据未搬入测试环境。

早期测试在页面渲染前读存储，修正为等待列表；首次近满测试还触发演示关联的懒初始化写入，改为先初始化关联，再构造与现场已有数据相符的容量条件。未通过的结果保留在本次运行日志中，未作为通过证据。

## 6. 最终结论

结论：通过。

旧格式近满额复制五轮成功，刷新后新草稿存在且无工作项；BOM 从 319,541 字符降至 144,057～144,080 字符，复制耗时最高 196.11ms。拒写零新增与重试通过，相邻生产准备列表和先染后印提交流程 3 个浏览器回归通过。代码尚未提交或推送。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-engineering-bom-storage.ts`
- `src/data/pcs-engineering-bom-repository.ts`
- `src/data/pcs-engineering-master-sampling.ts`

### 页面路由

- `/pcs/production-preparation/design-revision`
- `/pcs/production-preparation/design-revision/:id`
- `/pcs/production-preparation/orders`

### 验证命令

- `npm run build`：通过
- `node --import tsx --test tests/unit/engineering-bom-storage-codec.test.ts tests/unit/engineering-bom-storage-atomicity.test.ts`：通过
- `node scripts/check-typescript-scope.mjs src/data/pcs-engineering-bom-repository.ts src/data/pcs-engineering-bom-storage.ts src/data/pcs-engineering-master-sampling.ts`：通过

- `CUTTING_E2E_PORT=4735 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pcs-design-revision-copy-quota.spec.ts --workers=1 --reporter=line --output=/tmp/copy-quota-results`：通过
- `CUTTING_E2E_PORT=4734 CUTTING_E2E_USE_PREVIEW=true npx playwright test tests/pcs-engineering-orders-storage-quota.spec.ts tests/pcs-design-revision-storage-quota.spec.ts --workers=1 --reporter=line`：通过（组合运行中这 3 个测试通过）

### 证据

- `evidence/2026-09-24-copy-quota.json`
- `evidence/2026-09-24-copy-quota.png`
- `tests/unit/engineering-bom-storage-codec.test.ts`
- `tests/unit/engineering-bom-storage-atomicity.test.ts`
- `tests/pcs-design-revision-copy-quota.spec.ts`

### 例外

- 无。
