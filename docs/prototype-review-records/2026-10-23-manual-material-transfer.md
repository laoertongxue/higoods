# 本次产品审查
依据 `AGENTS.md` REVIEW-01。

## 基本信息
- 日期：2026-10-23
- 任务 / 需求编号：后道辅料调拨单人工创建
- 验证人：Qoder 代理

## 影响判定
- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：新增人工辅料调拨单创建、辅料中央仓同步门禁、列表创建方式/物料列、操作日志；同时扩展 WLS 调拨种类和共享投影契约。

## 需求 → 实现 → 原子结果
| 编号 | 需求 | 实现 | 证据 |
| --- | --- | --- | --- |
| R1 | 按生产单读取技术包 BOM，填写数量，单位取 BOM | 新增 `readManualTransferProductionPreview()`；按 `productionOrderNo` 精确匹配冻结技术包并读取 BOM | 单元测试“技术包 BOM 预览…”；`functional-evidence.json` 的 `bomRows`（拉链/条、纽扣/粒）；`create-bom-1366.png` |
| R2 | 不按生产单，通过可搜索物料列表添加多行，每物料一行 | 新增通用物料目录、搜索/添加/移除和单物料去重；领域层再次按物料编码校验 | 单元测试“通用物料目录…”和“人工通用物料创建…”；`tests/manual-material-transfer.spec.ts` 通用路径 |
| R3 | 排除面料及吊粒、品牌吊牌、价格吊牌、车缝线 | `isManualTransferExcludedBomItem()` 先按 BOM 类型排除面料，再按名称排除吊牌/吊粒/车缝线；同时排除非后道 BOM 类型、需裁剪/纸样关联项 | 单元测试；`functional-evidence.json` 的 `excludedInBomRows` 全部 `false`；`create-bom-1366.png` 的“已排除 5 项” |
| R4 | 列表新增创建方式（系统自动创建/人工创建） | `PostFinishingMaterialTransferOrder.creationMode` 投影；系统记录默认 `SYSTEM`，人工记录为 `MANUAL` | `list-system-1366.png` 的“系统自动创建”；`list-manual-1366.png` 的“人工创建” |
| R5 | 中央仓同步创建并自动审核通过后才出现在后道列表 | 人工创建写入 `GTP_TO_POST` 中央仓调拨单、DLN 收货事项和自动审核历史；后道列表仅投影该记录，不额外写第二套事实；保存失败不刷新列表 | `functional-evidence.json` 的 `manualRecords`、`failureGate`（失败前后 0 条，恢复后 1 条）；`central-warehouse-evidence.json`；`gtp-transfer-1366.png` |
| R6 | 列表新增物料列，分行展示缩略图/名称/编码/数量单位，支持大图 | `materialCell()` 渲染每行物料；复用 `accessoryImage()` 的图片预览和失败态 | `list-manual-1366.png`、`list-manual-1024.png`；E2E 图片 `naturalWidth` 断言 |
| R7 | 操作记录移出详情，操作栏新增查看日志，时间轴最近在上 | 详情移除历史区；列表操作栏新增“查看日志”；日志按 `operatedAt` 倒序渲染时间轴 | `log-1366.png`；E2E 断言两条记录顺序为“自动审核通过”后“人工创建调拨单”；`detail-1366.png` 无操作记录区 |

## 自查结论
| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 两种创建维度 | 通过 | 单元测试 + 两条 Playwright 路径；生产单预览和通用物料搜索均成功 |
| BOM 数量与单位 | 通过 | 技术包 BOM 单位直接作为只读单位；领域层拒绝非正数/非有限数量；见单元测试和 `functional-evidence.json` |
| 排除规则与单物料去重 | 通过 | 单元测试、E2E 排除断言、通用目录唯一 key |
| 中央仓同步与失败恢复 | 通过 | 中央仓记录与 DLN 收货事项在同一 WLS 事务保存；IDB abort 时无后道记录，输入保留，重试后同命令成功 |
| 列表创建方式与物料列 | 通过 | 真实列表 DOM/截图；列表物料图片可点击打开大图 |
| 日志与详情 | 通过 | 日志时间轴倒序；详情无操作记录区；列表操作栏保留日志入口 |
| 持久化/刷新/下游 | 通过 | 刷新后人工记录仍在；通用调拨完成 GTP 出库和 DLN 收货后，库存回读为 8 粒/`PF-MAT-A01-01` |
| 旧数据与兼容 | 通过 | 旧 PCS 与系统 WLS 记录默认 `SYSTEM`；人工记录只新增可选字段和 `GTP_TO_POST` 种类；未清理真实资料或无关记录 |
| 回归 | 通过 | 全量单元 1675 通过；accessory post finishing 10 通过；accessory workflow mock 4 通过；main integration 2 通过；目标列表/仓库检查通过 |
| 性能 | 通过 | 站内切换最大 459ms、刷新最大 895ms、创建弹层最大 203ms、保存最大 301ms；冷启动直开边界见例外 |

## 最终结论
结论：通过

## 受管文件
- `src/data/wls/accessory-warehouse-manual-transfer.ts`
- `src/data/wls/accessory-warehouse-flow.ts`
- `src/data/wls/accessory-warehouse-post-finishing.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/pages/process-factory/post-finishing/material-transfers.ts`
- `src/pages/wls/accessory-warehouses/transfers.ts`
- `tests/unit/manual-post-material-transfer.test.ts`
- `tests/manual-material-transfer.spec.ts`

## 页面证据
- 版本：分支 `main`，合入前 HEAD `95003b31`（验证时 `4631d25f`；之后主分支仅新增印花 QC 单详情布局，未触及本次受管文件），工作树（未提交）；production preview `http://127.0.0.1:4180`，Chromium headless 1366×768/1024×768；关键文件 SHA256：`material-transfers.ts` `ff959e4ed5d28b30dbfcf9d6bfa6d8019dd7ef9da3eacdb363965fff22f83e0c`，`accessory-warehouse-manual-transfer.ts` `788f62206f66768f137acd182f5eec04f43e9d9be3b59fb597173644f5d0f9d2`，`accessory-warehouse-post-finishing.ts` `4793912b6b60f6f46748c1b604144bf9899f8c63d311e9b1fe77d03dc42876b4`，`accessory-warehouse-flow.ts` `d22c04a7a22d3da45adfb8f7ac744b42005814427d5da6841f03bb53b7f1da3a`，`accessory-warehouses/transfers.ts` `5f105ac475a4e0f027f99f25abc97e8472a8ac09be004109b3da3c3b094b7b74`。
- 证据：`docs/verification-evidence/manual-material-transfer-20261023/` 下 `list-system-1366.png`、`list-manual-1366.png`、`create-bom-1366.png`、`log-1366.png`、`detail-1366.png`、`list-manual-1024.png`、`gtp-transfer-1366.png`、`functional-evidence.json`、`central-warehouse-evidence.json`。

## 性能结论
- 结论：通过
- 依据：production preview 1366×768，两页内 Mock；5 个有效样本：站内切换 `[396,355,365,338,459]`ms、刷新 `[883,895,876,888,882]`ms、创建弹层 `[203,150,179,154,158]`ms、确认创建 `[295,251,254,301,285]`ms；起止定义和原始值见 `performance.json`。同页面冷启动直开为 `[969,972,957,971,1050]`ms，单独列入例外。

## 验证命令
- `npm run build`：通过
- `npm run typecheck:engineering`：通过
- `npm test`：通过
- `npx playwright test tests/manual-material-transfer.spec.ts`：通过
- `node --import tsx --test tests/browser-contracts/accessory-post-finishing.test.ts`：通过
- `node --import tsx --test tests/browser-contracts/accessory-workflow-mock.test.ts`：通过
- `npx playwright test tests/post-finishing-main-integration.spec.ts`：通过
- `npm run check:post-finishing-management-list-alignment`：通过
- `npm run check:post-finishing-current-read-model`：通过
- `npx playwright test tests/post-finishing-full-flow.spec.ts -g "质检清单按新编号查询|仓库弹层跟随"`：通过

## 例外
- 冷启动直开：全新浏览器上下文直接打开该路由时，5 个样本中有 1 个为 1050ms，超过 1 秒；该路径同时承担共享应用启动和来源水合，现有 `work-orders` 路由也有约 0.86～1.03 秒的同等冷启动成本。本次适用入口的站内切换、刷新、创建弹层和保存均不超过 1 秒；不对冷启动直开作通过声明。
- `npm run check:post-finishing-full-flow`：不适用（脚本仍引用已退役的 `claimPostFinishingRecheckOrder`，在本次修改前即无法导入；未作为本次证据）。
- `tests/post-finishing-full-flow.spec.ts -g "三类任务责任与新质检分流…"`：不适用（在 `seedBrowserFlow` 阶段因未提交的结构化质检配置报错“已开检的固定质检标准不能替换或删除”，发生在辅料调拨断言之前；与本次调拨功能无关；本次辅料列表/详情/日志由新增 Playwright 测试覆盖）。
- 本次人工调拨创建时校验辅料中央仓某单一来源库位的可用库存，不预占库存；实际扣减仍由中央仓“整单确认出库”执行，与现有“创建调拨不扣库存”边界一致。
- 版本绑定收据：未通过（`/tmp/manual-transfer-receipt/task-receipt.json`，status `implemented`）。阻塞：治理工具未匹配 `tests/manual-material-transfer.spec.ts` 的专项测试路由；工作树中未提交的结构化质检变更使 quality browser check 被纳入并失败；4173 端口已被占用。该收据未作为本次通过证据；产品证据和全量单测/构建已完成。
