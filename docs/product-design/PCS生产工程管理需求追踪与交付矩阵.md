# PCS 生产工程管理需求追踪与交付矩阵

## 0. 文档信息

| 项目 | 内容 |
|---|---|
| 权威需求来源 | 《PCS设计改款合并、工程变更删除与生产准备时效收口调整方案》 |
| 适用版本 | `codex/pcs-design-revision-consolidation-20260827` |
| 原子需求总数 | 81 条 |
| 当前状态 | 已验证（第一轮正向、第二轮反向均通过）；待用户验收 |
| 产品口径 | 用户于 2026-08-27 确认：设计与改款合并；设计稿由跟单上传；删除工程变更；生产准备时效只读工程主单 |
| 证据刷新规则 | 最后一次实质修改后，自动化和页面证据必须重新生成 |

## 1. 状态口径

- `待实施`：尚无实现。
- `实施中`：正在修改。
- `已实现待验证`：实现存在，仍需完成两轮当前版本核验。
- `已验证`：正向、反向两轮核验均通过。
- `已阻塞`：存在明确外部阻塞。
- `不适用`：必须注明原因。

## 2. 原子需求与交付证据

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实现位置／事实源 | 自动化证据 | 页面／运行时证据 | 状态 | 证据版本与确认 |
|---|---|---|---|---|---|---|---|---|
| SCOPE-001 | §1 | 删除工程变更完整能力，不只是隐藏菜单 | WP5 | `src/data/pcs-engineering-master-sampling.ts`；`src/pages/pcs-independent-sampling.ts`；`src/router/routes-pcs.ts` | `npm run check:pcs-design-revision-consolidation`；残留扫描 | 统一菜单、统一路由、无分类验收 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| SCOPE-002 | §1 | 改款和设计合并为设计改款 | WP1 | `src/data/pcs-engineering-master-sampling.ts`；`src/pages/pcs-independent-sampling.ts`；`src/router/routes-pcs.ts` | `npm run check:pcs-design-revision-consolidation`；残留扫描 | 统一菜单、统一路由、无分类验收 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| SCOPE-003 | §1 | 不保留设计／改款分类和统计 | WP1、WP2 | `src/data/pcs-engineering-master-sampling.ts`；`src/pages/pcs-independent-sampling.ts`；`src/router/routes-pcs.ts` | `npm run check:pcs-design-revision-consolidation`；残留扫描 | 统一菜单、统一路由、无分类验收 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DR-001 | §3.2 | 来源款 A 必须已建档 | WP1 | `createEngineeringIndependentSampling()`；统一设计改款记录 | `tests/pcs-design-revision-consolidation.spec.ts` 创建门禁 | 新建弹窗与详情首屏 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DR-002 | §3.2 | 目标款 B 必须已建档 | WP1 | `createEngineeringIndependentSampling()`；统一设计改款记录 | `tests/pcs-design-revision-consolidation.spec.ts` 创建门禁 | 新建弹窗与详情首屏 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DR-003 | §3.2 | A、B 不能是同一 SPU | WP1 | `createEngineeringIndependentSampling()`；统一设计改款记录 | `tests/pcs-design-revision-consolidation.spec.ts` 创建门禁 | 新建弹窗与详情首屏 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DR-004 | §3.2 | 每张任务必须有设计改款说明 | WP1 | `createEngineeringIndependentSampling()`；统一设计改款记录 | `tests/pcs-design-revision-consolidation.spec.ts` 创建门禁 | 新建弹窗与详情首屏 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DR-005 | §3.2 | 测款结论和样衣返工不得静默创建设计改款，必须由跟单补齐完整资料后显式创建 | WP1、WP2 | `createEngineeringIndependentSampling()`；统一设计改款记录 | `tests/pcs-design-revision-consolidation.spec.ts` 创建门禁 | 新建弹窗与详情首屏 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| FILE-001 | §3.2 | 每张任务必须上传真实设计稿图片 | WP2 | `src/data/pcs-engineering-file-upload.ts`；设计稿创建／替换动作 | 真实 `File` 上传、替换权限与锁定后阻断契约 | 真实选择文件、预览、替换和失败恢复 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| FILE-002 | §3.2 | 仅跟单首次上传设计稿 | WP2 | `src/data/pcs-engineering-file-upload.ts`；设计稿创建／替换动作 | 真实 `File` 上传、替换权限与锁定后阻断契约 | 真实选择文件、预览、替换和失败恢复 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| FILE-003 | §3.2 | 仅跟单在工作安排确认前替换设计稿 | WP2 | `src/data/pcs-engineering-file-upload.ts`；设计稿创建／替换动作 | 真实 `File` 上传、替换权限与锁定后阻断契约 | 真实选择文件、预览、替换和失败恢复 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| FILE-004 | §3.2 | 设计稿显示上传人、时间、文件名和预览 | WP2 | `src/data/pcs-engineering-file-upload.ts`；设计稿创建／替换动作 | 真实 `File` 上传、替换权限与锁定后阻断契约 | 真实选择文件、预览、替换和失败恢复 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| FILE-005 | §5.3 | 上传失败保留表单并提供重试 | WP2 | `src/data/pcs-engineering-file-upload.ts`；设计稿创建／替换动作 | 真实 `File` 上传、替换权限与锁定后阻断契约 | 真实选择文件、预览、替换和失败恢复 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| IMAGE-001 | §5.4 | A/B 款均展示真实图片并可查看大图 | WP2 | `src/pages/pcs-independent-sampling.ts`；款式档案真实图片 | 命名页面缩略图／大图／Esc 验收 | A/B 款缩略图、大图、遮罩、Esc、失败态 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| COLOR-001 | §3.2 | B 款颜色数独立于 A 款 | WP3 | `confirmEngineeringIndependentColorMappings()`；目标色与参考色关系 | 少／等／多颜色和无参考色契约 | 第一步目标色／参考色维护 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| COLOR-002 | §3.2 | B 款每色可选择一个 A 款参考色 | WP3 | `confirmEngineeringIndependentColorMappings()`；目标色与参考色关系 | 少／等／多颜色和无参考色契约 | 第一步目标色／参考色维护 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| COLOR-003 | §3.2 | B 款颜色可选择无参考色 | WP3 | `confirmEngineeringIndependentColorMappings()`；目标色与参考色关系 | 少／等／多颜色和无参考色契约 | 第一步目标色／参考色维护 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| BOM-001 | §3.2 | 有参考色默认带入最近已完成且已确认物料方案 | WP3 | `src/data/pcs-engineering-bom-*`；设计改款买手准备步骤 | 最近确认方案、空白方案、物料与费用统一确认契约 | 第一步 BOM 与价格统一确认 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| BOM-002 | §3.2 | 无参考色从空白 BOM 开始 | WP3 | `src/data/pcs-engineering-bom-*`；设计改款买手准备步骤 | 最近确认方案、空白方案、物料与费用统一确认契约 | 第一步 BOM 与价格统一确认 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| BOM-003 | §3.2 | 买手可新增、删除、替换 B 款物料 | WP3 | `src/data/pcs-engineering-bom-*`；设计改款买手准备步骤 | 最近确认方案、空白方案、物料与费用统一确认契约 | 第一步 BOM 与价格统一确认 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| BOM-004 | §3.2 | 买手统一确认物料和整款费用 | WP3 | `src/data/pcs-engineering-bom-*`；设计改款买手准备步骤 | 最近确认方案、空白方案、物料与费用统一确认契约 | 第一步 BOM 与价格统一确认 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| BOM-005 | §3.2 | 非买手不能维护或确认 BOM 与价格 | WP3 | `src/data/pcs-engineering-bom-*`；设计改款买手准备步骤 | 最近确认方案、空白方案、物料与费用统一确认契约 | 第一步 BOM 与价格统一确认 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| BOM-006 | §6.3 | BOM 所有者阶段删除工程变更 | WP5 | `src/data/pcs-engineering-bom-*`；设计改款买手准备步骤 | 最近确认方案、空白方案、物料与费用统一确认契约 | 第一步 BOM 与价格统一确认 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DATA-001 | §2.4、§7.1 | 删除旧改版纸样／回直播状态／物料行辅助类型文件 | WP5 | 旧改版辅助类型已删除；`src/data/pcs-task-source-normalizer.ts` | 文件不存在与依赖零残留扫描 | 不适用：内部事实源删除，以残留扫描为证 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DATA-002 | §2.4、§7.6 | 删除旧改版来源标准化函数，并统一专业任务来源名称 | WP5 | 旧改版辅助类型已删除；`src/data/pcs-task-source-normalizer.ts` | 文件不存在与依赖零残留扫描 | 不适用：内部事实源删除，以残留扫描为证 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| TASK-001 | §3.2 | 跟单确认设计改款工作安排 | WP3 | 设计改款工作安排、统一专业任务仓储与规范任务详情 | 工作安排、固定依赖、真实成果文件与双入口契约 | 工作安排、专业列表、任务详情与成果上传 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| TASK-002 | §3.2 | 销售展示样衣要求按颜色、尺码、数量下达 | WP3 | 设计改款工作安排、统一专业任务仓储与规范任务详情 | 工作安排、固定依赖、真实成果文件与双入口契约 | 工作安排、专业列表、任务详情与成果上传 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| TASK-003 | §3.2 | 专业任务依赖固定且自动补齐前置 | WP3 | 设计改款工作安排、统一专业任务仓储与规范任务详情 | 工作安排、固定依赖、真实成果文件与双入口契约 | 工作安排、专业列表、任务详情与成果上传 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| TASK-004 | §5.5 | 父单和专业列表进入同一任务详情 | WP3 | 设计改款工作安排、统一专业任务仓储与规范任务详情 | 工作安排、固定依赖、真实成果文件与双入口契约 | 工作安排、专业列表、任务详情与成果上传 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| TASK-005 | §5.5 | 专业任务成果使用真实文件上传 | WP3 | 设计改款工作安排、统一专业任务仓储与规范任务详情 | 工作安排、固定依赖、真实成果文件与双入口契约 | 工作安排、专业列表、任务详情与成果上传 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| TASK-006 | §5.5 | 专业任务来源不再出现工程变更 | WP5 | 设计改款工作安排、统一专业任务仓储与规范任务详情 | 工作安排、固定依赖、真实成果文件与双入口契约 | 工作安排、专业列表、任务详情与成果上传 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| TASK-007 | §7.6 | 同款首版样衣返工在原任务新增轮次 | WP5 | 设计改款工作安排、统一专业任务仓储与规范任务详情 | 工作安排、固定依赖、真实成果文件与双入口契约 | 工作安排、专业列表、任务详情与成果上传 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| TASK-008 | §7.6 | 首版样衣返工不自动创建旧改版任务 | WP5 | 设计改款工作安排、统一专业任务仓储与规范任务详情 | 工作安排、固定依赖、真实成果文件与双入口契约 | 工作安排、专业列表、任务详情与成果上传 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| STATE-001 | §4.2 | 创建后显示新款资料准备中 | WP1、WP2 | `src/data/pcs-engineering-master-sampling.ts` 状态投影；设计改款详情步骤 | 四步状态推进与幂等契约 | 四步骤页签与当前团队／当前动作 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| STATE-002 | §4.2 | 买手完成后进入待跟单安排 | WP3 | `src/data/pcs-engineering-master-sampling.ts` 状态投影；设计改款详情步骤 | 四步状态推进与幂等契约 | 四步骤页签与当前团队／当前动作 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| STATE-003 | §4.2 | 跟单确认后进入专业工作中 | WP3 | `src/data/pcs-engineering-master-sampling.ts` 状态投影；设计改款详情步骤 | 四步状态推进与幂等契约 | 四步骤页签与当前团队／当前动作 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| STATE-004 | §4.2 | 专业任务全部完成后进入待整单确认 | WP3 | `src/data/pcs-engineering-master-sampling.ts` 状态投影；设计改款详情步骤 | 四步状态推进与幂等契约 | 四步骤页签与当前团队／当前动作 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| STATE-005 | §4.2 | 跟单整单确认后完成 | WP3 | `src/data/pcs-engineering-master-sampling.ts` 状态投影；设计改款详情步骤 | 四步状态推进与幂等契约 | 四步骤页签与当前团队／当前动作 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| MASTER-001 | §3.3 | 同一 SPU 只允许一张未关闭工程主单 | WP3 | `src/data/pcs-engineering-master-repository.ts`；工程主单详情与复用候选 | 工程主单领域、复用、返工与唯一性专项 | 工程主单新建、任务方案、详情与返工 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| MASTER-002 | §3.3 | 主单首步由跟单确认任务方案 | WP3 | `src/data/pcs-engineering-master-repository.ts`；工程主单详情与复用候选 | 工程主单领域、复用、返工与唯一性专项 | 工程主单新建、任务方案、详情与返工 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| MASTER-003 | §3.3 | 主单展示设计改款可复用成果 | WP3 | `src/data/pcs-engineering-master-repository.ts`；工程主单详情与复用候选 | 工程主单领域、复用、返工与唯一性专项 | 工程主单新建、任务方案、详情与返工 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| MASTER-004 | §3.3 | 跟单逐项选择复用、重做或不采用 | WP3 | `src/data/pcs-engineering-master-repository.ts`；工程主单详情与复用候选 | 工程主单领域、复用、返工与唯一性专项 | 工程主单新建、任务方案、详情与返工 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| MASTER-005 | §3.3 | 销售展示样衣不替代产前版样衣 | WP3 | `src/data/pcs-engineering-master-repository.ts`；工程主单详情与复用候选 | 工程主单领域、复用、返工与唯一性专项 | 工程主单新建、任务方案、详情与返工 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| MASTER-006 | §3.4 | 主单关闭前修改和返工留在原主单 | WP3 | `src/data/pcs-engineering-master-repository.ts`；工程主单详情与复用候选 | 工程主单领域、复用、返工与唯一性专项 | 工程主单新建、任务方案、详情与返工 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| MASTER-007 | §3.4 | 已关闭主单和正式包只读 | WP4、WP5 | `src/data/pcs-engineering-master-repository.ts`；工程主单详情与复用候选 | 工程主单领域、复用、返工与唯一性专项 | 工程主单新建、任务方案、详情与返工 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| MASTER-008 | §2.4、§7.3 | 工程主单详情只展示统一设计改款成果，不保留工程变更或双打样来源 | WP3、WP5 | `src/data/pcs-engineering-master-repository.ts`；工程主单详情与复用候选 | 工程主单领域、复用、返工与唯一性专项 | 工程主单新建、任务方案、详情与返工 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| PACK-001 | §3.5 | 新业务技术包只能由工程主单生成 | WP4 | `src/data/pcs-technical-data-version-*`；`src/data/pcs-engineering-tech-pack-workspace.ts`；FCS 快照 | 技术包工程主单唯一来源、审核、正式快照与 FCS 回归 | 技术包列表、详情、审核、发布与 FCS 快照 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| PACK-002 | §3.5 | 设计改款不能直接生成正式技术包 | WP4 | `src/data/pcs-technical-data-version-*`；`src/data/pcs-engineering-tech-pack-workspace.ts`；FCS 快照 | 技术包工程主单唯一来源、审核、正式快照与 FCS 回归 | 技术包列表、详情、审核、发布与 FCS 快照 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| PACK-003 | §3.5 | 旧改版、制版、花型、手工入口不能生成新业务版本 | WP4 | `src/data/pcs-technical-data-version-*`；`src/data/pcs-engineering-tech-pack-workspace.ts`；FCS 快照 | 技术包工程主单唯一来源、审核、正式快照与 FCS 回归 | 技术包列表、详情、审核、发布与 FCS 快照 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| PACK-004 | §3.5 | 技术包继续走现行审核流程 | WP4 | `src/data/pcs-technical-data-version-*`；`src/data/pcs-engineering-tech-pack-workspace.ts`；FCS 快照 | 技术包工程主单唯一来源、审核、正式快照与 FCS 回归 | 技术包列表、详情、审核、发布与 FCS 快照 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| PACK-005 | §3.5 | 发布时形成 BOM 与价格正式快照 | WP4 | `src/data/pcs-technical-data-version-*`；`src/data/pcs-engineering-tech-pack-workspace.ts`；FCS 快照 | 技术包工程主单唯一来源、审核、正式快照与 FCS 回归 | 技术包列表、详情、审核、发布与 FCS 快照 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| PACK-006 | §3.7 | 来源类型收口不得误删技术包内容中的人工维护／人工调整字段 | WP4 | `src/data/pcs-technical-data-version-*`；`src/data/pcs-engineering-tech-pack-workspace.ts`；FCS 快照 | 技术包工程主单唯一来源、审核、正式快照与 FCS 回归 | 技术包列表、详情、审核、发布与 FCS 快照 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| PACK-007 | §3.7 | 已发布技术包仍可被 FCS 生产单和生产快照读取 | WP4 | `src/data/pcs-technical-data-version-*`；`src/data/pcs-engineering-tech-pack-workspace.ts`；FCS 快照 | 技术包工程主单唯一来源、审核、正式快照与 FCS 回归 | 技术包列表、详情、审核、发布与 FCS 快照 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| PACK-008 | §6.3、§7.5 | 现行 Mock 技术包统一改为工程主单来源 | WP4、WP7 | `src/data/pcs-technical-data-version-*`；`src/data/pcs-engineering-tech-pack-workspace.ts`；FCS 快照 | 技术包工程主单唯一来源、审核、正式快照与 FCS 回归 | 技术包列表、详情、审核、发布与 FCS 快照 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| PACK-009 | §3.7、§6.3 | `linkedRevisionTaskIds` 统一为设计改款成果溯源关系，且不改变工程主单唯一生成来源 | WP4、WP5 | `src/data/pcs-technical-data-version-*`；`src/data/pcs-engineering-tech-pack-workspace.ts`；FCS 快照 | 技术包工程主单唯一来源、审核、正式快照与 FCS 回归 | 技术包列表、详情、审核、发布与 FCS 快照 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DELETE-001 | §7.1 | 删除工程变更工作区文件 | WP5 | 工程变更专用文件、入口、类型、Mock、投影与检查已删除 | 旧路由 404、文件不存在、`src/tests/scripts` 零实现残留 | 旧工程变更和旧双路由均返回未匹配 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DELETE-002 | §7.1 | 删除工程变更页面文件 | WP5 | 工程变更专用文件、入口、类型、Mock、投影与检查已删除 | 旧路由 404、文件不存在、`src/tests/scripts` 零实现残留 | 旧工程变更和旧双路由均返回未匹配 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DELETE-003 | §7.2 | 删除工程变更菜单、路由、渲染器和处理器 | WP5 | 工程变更专用文件、入口、类型、Mock、投影与检查已删除 | 旧路由 404、文件不存在、`src/tests/scripts` 零实现残留 | 旧工程变更和旧双路由均返回未匹配 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DELETE-004 | §7.3 | 删除主单快照 changeTasks 及创建查询重置函数 | WP5 | 工程变更专用文件、入口、类型、Mock、投影与检查已删除 | 旧路由 404、文件不存在、`src/tests/scripts` 零实现残留 | 旧工程变更和旧双路由均返回未匹配 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DELETE-005 | §7.4 | 删除工程变更 BOM 所有者阶段 | WP5 | 工程变更专用文件、入口、类型、Mock、投影与检查已删除 | 旧路由 404、文件不存在、`src/tests/scripts` 零实现残留 | 旧工程变更和旧双路由均返回未匹配 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DELETE-006 | §7.5 | 删除工程变更技术包来源和生成逻辑 | WP4、WP5 | 工程变更专用文件、入口、类型、Mock、投影与检查已删除 | 旧路由 404、文件不存在、`src/tests/scripts` 零实现残留 | 旧工程变更和旧双路由均返回未匹配 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DELETE-007 | §7.3 | 删除工程变更专业任务投影 | WP5 | 工程变更专用文件、入口、类型、Mock、投影与检查已删除 | 旧路由 404、文件不存在、`src/tests/scripts` 零实现残留 | 旧工程变更和旧双路由均返回未匹配 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DELETE-008 | §7.6 | 删除旧改版任务第二事实源 | WP5 | 工程变更专用文件、入口、类型、Mock、投影与检查已删除 | 旧路由 404、文件不存在、`src/tests/scripts` 零实现残留 | 旧工程变更和旧双路由均返回未匹配 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DELETE-009 | §6.4 | 不保留旧数据迁移、兼容读取或提示 | WP5 | 工程变更专用文件、入口、类型、Mock、投影与检查已删除 | 旧路由 404、文件不存在、`src/tests/scripts` 零实现残留 | 旧工程变更和旧双路由均返回未匹配 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| DELETE-010 | §7.7 | 更新所有现行测试、脚本和权威文档 | WP7 | 工程变更专用文件、入口、类型、Mock、投影与检查已删除 | 旧路由 404、文件不存在、`src/tests/scripts` 零实现残留 | 旧工程变更和旧双路由均返回未匹配 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| REL-001 | §3.7、§7.6 | 项目关系契约删除 `REVISION_TASK`，统一登记设计改款任务 | WP5 | `src/data/pcs-project-relation-*`；`src/data/pcs-task-project-relation-writeback.ts` | 项目关系生命周期与来源解析专项 | 项目详情关系和专业任务来源 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| REL-002 | §3.7 | 花型、制版和样衣任务来源统一为设计改款或原专业任务返工 | WP1、WP5 | `src/data/pcs-project-relation-*`；`src/data/pcs-task-project-relation-writeback.ts` | 项目关系生命周期与来源解析专项 | 项目详情关系和专业任务来源 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| ARCHIVE-001 | §3.7、§7.6 | 项目归档删除 `REVISION_RECORD` 分组 | WP5 | `src/data/pcs-project-archive-*` | 项目归档收集与旧分组零残留专项 | 项目归档统一成果分组 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| ARCHIVE-002 | §3.7 | 项目归档统一收集设计稿、BOM、样衣和专业成果 | WP5、WP7 | `src/data/pcs-project-archive-*` | 项目归档收集与旧分组零残留专项 | 项目归档统一成果分组 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| CLOSE-001 | §3.7 | 项目关闭和数据一致性不再要求旧改版任务 | WP5 | `src/data/pcs-project-data-consistency.ts`；项目关闭视图 | 项目关闭与一致性专项 | 项目关闭结果不再要求旧改版记录 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| COPY-001 | §2.2 | 保留“因需求变更结束”业务状态 | WP5 | 工程任务状态与 `src/pages/pcs-engineering-tasks/shared.ts` | 条件结束状态与用户文案扫描 | 条件任务结束文案 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| COPY-002 | §2.2 | 用户文案不再说“因工程变更结束” | WP5 | 工程任务状态与 `src/pages/pcs-engineering-tasks/shared.ts` | 条件结束状态与用户文案扫描 | 条件任务结束文案 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| TIME-001 | §3.6 | 时效只读取工程主单和主单任务 | WP6 | `src/data/pcs-engineering-preparation-projection.ts`；生产准备时效只读页 | 时效投影、颜色投影、只读页面专项 | 生产准备时效列表、详情、返回主单／任务 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| TIME-002 | §3.6 | 设计改款任务不进入时效 | WP6 | `src/data/pcs-engineering-preparation-projection.ts`；生产准备时效只读页 | 时效投影、颜色投影、只读页面专项 | 生产准备时效列表、详情、返回主单／任务 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| TIME-003 | §3.6 | 时效页面无写动作 | WP6 | `src/data/pcs-engineering-preparation-projection.ts`；生产准备时效只读页 | 时效投影、颜色投影、只读页面专项 | 生产准备时效列表、详情、返回主单／任务 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| TIME-004 | §3.6 | 同一主单只形成一条时效记录 | WP6 | `src/data/pcs-engineering-preparation-projection.ts`；生产准备时效只读页 | 时效投影、颜色投影、只读页面专项 | 生产准备时效列表、详情、返回主单／任务 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| PAGE-001 | §5.1 | 只保留一个设计改款菜单和规范路由 | WP2 | `src/data/app-shell-config.ts`；`src/router/routes-pcs.ts`；命名页面 | 1366×768 命名页面与导航验收 | 统一设计改款列表／新建／详情及表头列设置 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| PAGE-002 | §5.2 | 列表提供当前需处理的团队筛选 | WP2 | `src/data/app-shell-config.ts`；`src/router/routes-pcs.ts`；命名页面 | 1366×768 命名页面与导航验收 | 统一设计改款列表／新建／详情及表头列设置 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| PAGE-003 | §5.2 | 列设置位于列表表头最右侧 | WP2 | `src/data/app-shell-config.ts`；`src/router/routes-pcs.ts`；命名页面 | 1366×768 命名页面与导航验收 | 统一设计改款列表／新建／详情及表头列设置 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| PAGE-004 | §5.7 | 时效记录可回到主单或工程任务 | WP6 | `src/data/app-shell-config.ts`；`src/router/routes-pcs.ts`；命名页面 | 1366×768 命名页面与导航验收 | 统一设计改款列表／新建／详情及表头列设置 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |
| PAGE-005 | §7.3 | 工程主单详情可进入统一设计改款成果及对应专业任务 | WP3 | `src/data/app-shell-config.ts`；`src/router/routes-pcs.ts`；命名页面 | 1366×768 命名页面与导航验收 | 统一设计改款列表／新建／详情及表头列设置 | 已验证 | 分支 codex/pcs-design-revision-consolidation-20260827；基线 HEAD 1778d6343e1dd37f37ebe8c0f91833b8cf536568；双轮核验 2026-08-27；产品口径已确认，实施验收待用户 |

## 3. 正向追踪要求

1. 从本矩阵每一条需求回到权威方案章节。
2. 核对实现位置是否由当前运行版本读取。
3. 执行对应自动化契约。
4. 对适用条目执行命名页面和真实文件验收。
5. 记录当前 Git HEAD、命令、退出码和页面证据。

## 4. 反向追踪要求

1. 从菜单、路由、页面、领域数据、Mock、测试和检查脚本反查需求编号。
2. 确认没有未声明的工程变更入口、对象、存储或任务投影。
3. 确认没有“设计／改款”双类型、双统计、双路由或第二事实源。
4. 确认技术包新业务来源只有工程主单，设计改款和专业任务不能直达正式技术包。
5. 确认生产准备时效只读工程主单及其任务。
6. 确认历史文档未被现行检查脚本读取为权威需求。

## 5. 交付门禁

只有 81 条需求全部达到“已验证”，且不存在无说明的待实施、实施中、已实现待验证或已阻塞条目时，才允许宣称本次调整完整完成。

## 6. 双案例、双轮次全流程验收证据

本节不新增或重复产品需求编号。`FLOW-001`～`FLOW-019` 是对上述 81 条原子需求进行跨模块串联验证的交付证据编号，用来证明单点能力能够组成连续业务流程。

| 证据 | 位置 | 结果 |
| --- | --- | --- |
| 可重复全流程模拟 | `tests/pcs-production-engineering-full-flow.spec.ts` | 每个独立进程连续执行 2 条业务链，并逐步记录对象、团队、动作、输入、输出、前后状态和断言 |
| 第 1 轮原始记录 | `docs/product-design/test-records/pcs-production-engineering-full-flow-pass-1.json` | 2 条链、44 个步骤，全部通过 |
| 第 2 轮原始记录 | `docs/product-design/test-records/pcs-production-engineering-full-flow-pass-2.json` | 2 条链、44 个步骤，全部通过 |
| 人工可读执行记录 | `docs/product-design/PCS生产工程管理全流程模拟测试执行记录.md` | 汇总两轮逐步骤记录、`FLOW-001`～`FLOW-019`、正向追踪和反向追踪 |
| 记录生成与门禁校验 | `scripts/render-pcs-production-engineering-full-flow-record.ts` | 校验轮次、案例数、必经阶段、对象唯一性、上传文件唯一性和结果后生成 Markdown |

### 6.1 覆盖关系

- 设计改款与真实设计稿：覆盖 `DR-*`、`FILE-*`、`COLOR-*`、`BOM-*`。
- 工程主单、工作安排和专业任务：覆盖 `MASTER-*`、`TASK-*`、`STATE-*`。
- 正式技术包、BOM 快照和审核：覆盖 `PACK-*`、`BOM-*`。
- FCS 生产单技术包快照和生产准备时效：覆盖 `TIME-*` 及对应上下游读取规则。
- 菜单、路由、列表和详情入口由专项页面验收覆盖；PDA 与打印不属于本次产品范围，在审查记录中明确为不适用。

### 6.2 全流程门禁结论

只有两份原始记录均满足“2 条链、44 个步骤、全部通过”，且人工可读记录中的 `FLOW-001`～`FLOW-019` 正向、反向追踪均无缺口时，才满足本矩阵的全流程验收门禁。单页截图、单点专项测试或一次进程内通过均不能替代本门禁。
