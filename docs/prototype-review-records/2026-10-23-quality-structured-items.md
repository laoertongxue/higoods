# 质检标准结构化与后道 QC 按项执行

依据：[AGENTS.md](../../AGENTS.md) 当前项目规则；继承用户 2026-10-23 确认的三项口径：检查项结构化并按项记录、测量项绑定技术包尺寸表、按 STORE-04 重置本次演示数据。

## 基本信息

- 日期：2026-10-23
- 任务 / 需求编号：质检标准结构化与后道 QC 按项执行
- 验证人：Codex主代理

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定等级：T4（共享质检标准事实、快照、后道 QC、质检记录和打印消费方）
- 判定依据：检查项从描述文本扩展为可执行结构；后道 QC 增加项目级观测并写入快照/记录/打印；技术包尺寸测量进入质检快照；质检配置命名空间执行一次性 STORE-04 结构版本切换。

## 设计边界

- 检查项保留原 `content/criterion/references` 文本以兼容既有标准表达，同时增加 `kind/method/measurement/defectCodes/severity/disposition/evidenceRequirement`。
- 测量项通过 `measurement.techPackPart` 绑定生产单冻结技术包的 `sizeMeasurements`；开检时把标准值、单位和公差固定进快照。库存/样衣没有生产单来源时，测量项显示未绑定，不伪造标准值。
- 后道 QC 按 SKU/项目记录结果、实测值、缺陷代码、说明和问题照片；合格/瑕疵/返工件数仍由操作员按件填写。项目级失败不会自动累加成衣件数，避免同一件多问题被重复计数。
- 附加标准既支持新增 typed 项目，也支持按 `severity/method/measurement/...` 覆盖原项目；覆盖值仍按原有标准优先级合并。
- 不改变现有抽样、稽查、升级、初始全检、数量守恒、权限和保存事务规则。

## 原子验收矩阵

| 编号 | 原子需求 | 实际实现 | 自动化 / 页面证据 | 状态 |
| --- | --- | --- | --- | --- |
| SI-01 | 检查项具备类型、方法、测量、缺陷代码、严重度、处置和证据要求 | `quality-management-types.ts`、`quality-management-records.ts` | `tests/unit/quality-structured-items.test.ts` | 已验证 |
| SI-02 | 测量项开检时从生产单冻结技术包尺寸表固定标准值、单位和公差 | `quality-management-source.ts/bindInspectionMeasurements`、`post-finishing-full-flow.ts` | 单元测试“测量项从生产单冻结技术包尺寸表绑定” | 已验证 |
| SI-03 | 基本标准、规则和附加覆盖详情以结构化表格/字段展示 | `quality-management/index.ts/renderItems/renderRuleDetails/renderOverrideDetails` | `basic-standard-1366.png`、`rules-1366.png`；六类中心 E2E | 已验证 |
| SI-04 | 编辑器可维护 typed 项目、测量定义、缺陷代码及附加 typed 覆盖 | `quality-management/editor.ts`、`quality-management/index.ts` | 派生草稿 E2E；附加 typed 覆盖单元测试 | 已验证 |
| SI-05 | 后道 QC 按 SKU/项目记录结果、实测值、缺陷代码、说明和问题照片 | `qc-workbench.ts`、`post-finishing-quality.ts` | `qc-observations-1366.png`、`qc-observations-1024.png` | 已验证 |
| SI-06 | 测量超差不能判定合格；不合格须缺陷代码或说明；项目失败与件数不一致阻断 | `post-finishing-quality.ts/validatePostQcObservations/submitPostQcRound` | 单元测试 5 项 | 已验证 |
| SI-07 | 项目观测随轮次持久化，并投影到质检中心详情和 QC 打印 | `quality-post-read-source.ts`、`quality-management/index.ts`、`post-finishing-qc-print-template.ts` | `record-observations-1366.png`；结构化 E2E 打印页 | 已验证 |
| SI-08 | STORE-04 一次性清理旧演示质检配置并重建结构化种子 | `quality-management-records.ts/prepareQualityConfigurationSchema`、页面入口 | STORE-04 Playwright 用例：旧配置活动行删除、schema=2 | 已验证 |
| SI-09 | 1366×768、1280×720、1024×768 可读且页面不横向溢出 | 结构化卡片和表单布局 | 1024/1280 视口用例；截图 | 已验证 |
| SI-10 | 受影响页面生产预览完整响应 ≤1 秒 | 页面静态结构 + 原数据链 | `performance.json`，4 家族各 5 次，最大 831ms | 已验证 |
| SI-11 | 旧版已完成 QC 快照不参与新开检 | 新快照写 `snapshotSchemaVersion=2`；旧完成记录保留历史只读 | 代码边界和新快照测试 | 已验证（历史只读保留） |

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 基本标准与规则详情结构化 | 通过 | `basic-standard-1366.png`、`rules-1366.png` |
| 附加标准 typed 项目及覆盖 | 通过 | 单元测试覆盖 severity/measurement；派生草稿 E2E |
| 技术包尺寸测量绑定 | 通过 | 单元测试固定 `M/50cm/±1`；无技术包时不伪造 |
| 后道 QC 项目观测 | 通过 | 1366/1024 截图；完整提交 E2E |
| 项目观测校验和件数口径 | 通过 | 超差 PASS、缺缺陷代码、失败但件数 0 均阻断 |
| 质检中心记录详情 | 通过 | `record-observations-1366.png` 显示 SKU/项目/结果/实测值 |
| QC 打印 | 通过 | 打印页显示实际检查记录和 50cm；未重新做实体纸面/PDF 解码 |
| STORE-04 配置切换 | 通过 | 旧配置活动行删除、schema=2、结构化种子可读 |
| 旧 QC 历史 | 通过 | 旧完成快照保留只读，不参与新开检；未物理删除历史证据 |
| 权限和数量规则 | 通过 | 未新增权限分支；三类件数、抽样、稽查、出货规则未改 |
| 性能 | 通过 | 生产预览 4 家族各 5 次，最大 831ms |
| 图片 | 不适用 | 未改变图片对象、来源或展示交互 |

## 最终结论

结论：通过

结构化模型、技术包绑定、后道按项记录、质检中心读回和 STORE-04 配置切换均通过适用的专项/页面/构建/性能检查。旧完成 QC 历史按只读保留，未物理清空；若需要连同历史后道 QC 记录清空，应按 STORE-04 另做 flow 定向重置。

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/quality-management-types.ts`
- `src/data/fcs/quality-management-records.ts`
- `src/data/fcs/quality-management-rules.ts`
- `src/data/fcs/quality-management-source.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/post-finishing-quality.ts`
- `src/data/fcs/quality-post-read-source.ts`
- `src/pages/quality-management/editor.ts`
- `src/pages/quality-management/index.ts`
- `src/pages/process-factory/post-finishing/qc-workbench.ts`
- `src/pages/print/templates/post-finishing-qc-print-template.ts`
- `src/pages/sewing-outsourcing/sample-approval-suggestions.ts`
- `tests/quality-management-list-contract.spec.ts`
- `tests/quality-management-rules.spec.ts`
- `tests/quality-structured-items.spec.ts`
- `tests/unit/quality-structured-items.test.ts`

### 页面证据

- 版本：当前分支 `main`，HEAD `e65e693c` 加本次未提交差异；生产构建 `dist` 后由 Vite preview 隔离启动。
- 截图：`output/quality-structured-20261023/basic-standard-1366.png`、`rules-1366.png`、`qc-observations-1366.png`、`qc-observations-1024.png`、`record-observations-1366.png`
- 证据：`tests/quality-structured-items.spec.ts` 实际完成派生草稿、后道第 1 轮提交、质检中心记录详情和 QC 打印页；截图为 `output/quality-structured-20261023/` 下 5 张 1366/1024 页面；性能原始值见同目录 `performance.json`。
- 功能回放：基本标准测量定义与缺陷代码、规则表格、派生草稿 typed 编辑器、1366/1024 后道逐项记录、提交第 1 轮、质检中心详情、QC 打印页。

### 性能结论

- 结论：通过
- 依据：`output/quality-structured-20261023/performance.json`；1366×768，Vite preview 生产构建，4 家族各 5 次；最大值分别为 167ms、214ms、831ms、635ms，均 ≤1000ms。

### 验证命令

- `npm run typecheck:engineering`：通过
- `node --import tsx --test tests/unit/quality-management-rules.test.ts tests/unit/post-finishing-quality.test.ts tests/unit/quality-management-read-model.test.ts tests/unit/quality-management-source.test.ts tests/unit/quality-management-formal-source.test.ts tests/unit/quality-structured-items.test.ts`：通过
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43669 npx playwright test tests/quality-structured-items.spec.ts --workers=1 --reporter=line`：通过
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43659 npx playwright test tests/quality-management-list-contract.spec.ts --workers=1 --reporter=line`：通过
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43660 npx playwright test tests/quality-management-rules.spec.ts --grep "六类中心|有效配置详情" --workers=1 --reporter=line`：通过
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43661 npx playwright test tests/quality-management-rules.spec.ts --grep "四条全检条件|规则切换适用业务|配置草稿保存期间" --workers=1 --reporter=line`：通过
- `npx vite build`：通过
- `npm test`：通过
- `npm run workflow:verify -- --output <临时目录>/task-receipt.json --task-boundary "质检标准结构化、技术包尺寸绑定、后道QC按项记录、质检中心与打印读回、STORE-04配置切换" --paths <实际任务文件>`：不适用（工作区存在用户对 AGENTS.md 和 docs/prototype-review-record-template.md 的未提交修改；未用收据吸收无关差异，改以本记录的单元/E2E/构建/性能/治理检查为本次技术证据）
- `npm run check:list-page-governance -- --scope worktree --paths <本记录受管文件及本记录>`：通过
- `npm run check:prototype-design-governance -- --scope worktree --paths <本记录受管文件及本记录>`：通过

### 例外

- 旧版已完成 QC 快照保留只读，未物理删除；新快照使用 `snapshotSchemaVersion=2`，新开检使用结构化标准。若业务要求清空历史 QC 记录，需按 STORE-04 对后道 flow 做单独定向重置，不能把本次配置切换说成已清空全部历史。
- 原项缺陷代码覆盖类型已支持，但编辑器本期只开放 severity/method/measurement 等 typed 覆盖；缺陷代码可在新增 typed 项目中维护。
