# 裁片退仓精确发起与原子接收原型审查记录

## 1. 基本信息

| 项目 | 内容 |
|---|---|
| 记录日期 | 2026-08-15 |
| 相关需求 / 任务 | “新增退仓”右置；按车缝任务、生产单+实际车缝工厂或菲票号精确找到责任；件数和部位片数分别限于实际正式交出；一次提交创建、确认并入退裁片库区 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PFOS 裁床厂管理、车缝交出事实、裁片退仓、补料管理 |
| 涉及页面路径 | `/fcs/craft/cutting/cut-piece-return-processing`、`/fcs/craft/cutting/supplement-management`、`/fcs/craft/cutting/cut-orders` |
| 端类型 | 管理 / 主管端桌面 Web、退裁片大菲票打印预览 |
| 主要角色与任务 | 裁床退仓员定位实际车缝任务并录入退件；主管查看责任、报废或创建补料；管理人员追溯来源任务、工厂、裁片单和数量 |
| 开工分支 / 版本 | `codex/cut-piece-return-supplement-v2`；基线 `b70910a5537e2c4451d644084a82f5d74274c562` 加当前未提交工作树 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：本轮改变“新增退仓”的位置、精确查找入口、数量上限提示、实物票证据录入和提交结果，属于用户可见的页面、字段、交互及防错变化。
- “新增退仓”移到标题操作区最右侧；打开后不再展示全量候选，必须先精确查找。
- 新流程一次提交退件件数、全部来源部位片数和实物票证据；成功后直接成为“已确认退件”，失败不留下空的“待接收”退仓单。
- 历史待接收退仓单仍可继续“接收清点”，只删除新建空待接收单的入口。
- 既有报废、车缝退仓补料、原裁片单关联、补料状态、大菲票、普通/特殊工艺菲票和捆条菲票逻辑不变。
- 本轮不新增真实后端、权限、PDA、上传、弱网或打印机驱动。

现行依据：

- `AGENTS.md` 第 4、5、7、8 节当前治理与验证基线。
- `docs/product-design/裁片退仓处理与补料来源简化总体设计.md` v3.0。
- `docs/product-design/裁片退仓处理与补料来源简化实施计划.md` v3.0。
- `docs/product-design/裁片退仓处理与补料来源简化需求追踪与交付矩阵.md` v3.0。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
|---|---|---|
| 角色、当前任务和主动作 | 通过 | 标题行先显示“查看退裁片库区”，最右侧蓝色主动作是“新增退仓”。 |
| 查找与对象防错 | 通过 | 支持车缝任务号、生产单+实际承接车缝工厂、历史菲票号三种精确查找；不展示全量候选。 |
| 多任务责任隔离 | 通过 | 责任键包含任务、工厂、生产单、颜色、尺码和原裁片单范围；同生产单/工厂多任务必须再次选择。 |
| 数量、单位和差异 | 通过 | 件数读取任务级齐套责任；片数读取工厂有效接收回写；分别减历史已退，任一超限阻断；件/片差异只提示。 |
| 实物票证据 | 通过 | 通过菲票查任务不代表实物票在场；仅本次匹配扫码记为在场，缺票/不可识别可手工选部位。 |
| 原子提交和恢复 | 通过 | 件超限、片超限、错票均不落单且保留输入；纠正后一次创建、确认和入库。 |
| 图片、大图和失败态 | 通过 | 款式图和正式物料图与对象同块展示；加载、失败、大图和 Esc 关闭保持既有验证。 |
| 打印与下游 | 通过 | 缺旧实物票仍可生成固定 100mm×100mm 大菲票；报废和车缝退仓补料链保持原行为。 |
| 分辨率和页面模式 | 通过 | 使用标准管理列表；1366×768 与 1280×720 页面主体不横向溢出。 |

## 4. 主要问题与处理

| 问题 | 影响 | 处理 | 剩余风险 |
|---|---|---|---|
| 发起按钮位于页面中部，主次关系错误 | 退仓员不易定位主要动作 | 标题右侧先放仓区次动作，最右放“新增退仓” | 无 |
| 打开后展示全量交出候选 | 容易选错生产单、工厂或任务 | 改为三种精确检索；无输入不显示候选 | 无 |
| 生产单可能拆成多个车缝任务 | 用生产单或交出单汇总会串责任 | 工厂来自实际有效交出；结果按任务、色码和裁片单范围分卡，多个必须选择 | 无 |
| 件数上限使用交出单汇总 | 可能把同单其它任务的齐套责任算入 | 在正式交出记录冻结任务级齐套责任快照 | 无 |
| 部位片数没有实际接收上限 | 可能退回超过工厂实际收到的裁片 | 按有效接收记录汇总“原裁片单+部位”，减历史已退后动态校验 | 无 |
| 先发起空单再接收 | 校验失败或中断会留下空待接收单 | 新流程使用原子创建并确认；失败前后单数不变 | 无 |
| 菲票反查与实物票在场混淆 | 系统历史记录可能被误当现场实物 | 查找命中仅显示来源提示，实物票状态仍由本次清点选择和扫码决定 | 无 |

## 5. 变更覆盖与验证

### 受管文件

- `src/data/fcs/cutting/handover-orders.ts`
- `src/data/fcs/cutting/cut-piece-return-domain.ts`
- `src/pages/process-factory/cutting/cut-piece-return-processing.ts`

### 需求映射

| 文件 | 主要需求编号 |
|---|---|
| `src/data/fcs/cutting/handover-orders.ts` | INIT-005、QTY-001 |
| `src/data/fcs/cutting/cut-piece-return-domain.ts` | INIT-001～006、QTY-005～006、EVID-006、ATOMIC-001 |
| `src/pages/process-factory/cutting/cut-piece-return-processing.ts` | INIT-001～004、QTY-005～006、EVID-006、UI-007、ATOMIC-001 |
| `scripts/check-cut-piece-return-processing-v2.ts` | 上述领域与静态契约 |
| `tests/cut-piece-return-processing.spec.ts` | 上述命名页面、图片、打印和下游闭环 |

### 页面路由

- `/fcs/craft/cutting/cut-piece-return-processing`
- `/fcs/craft/cutting/supplement-management`
- `/fcs/craft/cutting/cut-orders`

### 图片与页面证据

| 证据 | 覆盖内容 |
|---|---|
| `output/playwright/cut-piece-return-exact-source-and-limits.png` | 精确任务、任务级 200/188 件责任、每个部位有效交出/已退/可退和实物票证据输入 |
| `output/playwright/cut-piece-return-atomic-confirmed.png` | 一次提交后直接进入已确认退件详情、责任扣减和部位证据 |
| `output/playwright/cut-piece-return-large-ticket-100mm.png` | 固定 100mm×100mm 退裁片大菲票与真实二维码 |
| `output/playwright/sewing-return-supplement-detail.png` | 车缝退仓补料来源、原裁片单和退片快照 |
| `output/playwright/cut-order-sewing-return-supplement.png` | 原裁片单反查退仓补料 |

款式继续使用 `public/pants-sample.jpg`；Black 主面料继续使用 `public/materials/fei-ticket/black-stretch-twill.png`。本轮没有以色块、通用图片或网络占位图替换对象图片。

### 验证命令

- `npm run check:cut-piece-return-processing`：通过（v3 精确来源、责任快照、双上限和原子提交契约）。
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=4213 npx playwright test tests/cut-piece-return-processing.spec.ts tests/cut-order-supplement-linkage.spec.ts tests/supplement-management-list-template.spec.ts --workers=1 --reporter=line`：通过（62 / 62）。
- `npm run check:list-page-governance:static`：通过（扫描 357 个页面，历史基线 17）。
- `npm run check:standard-list-page-template`：通过（真实 Chromium 列拖拽、存储和 DOM 稳定性）。
- `npm run check:prototype-design-governance -- --all`：通过（3 个用户可见受管文件、0 个技术内部文件、1 份完整审查记录）。
- `npm run build`：通过（Vite 2344 个模块完成构建）。
- `git diff --check`：通过。
- `codegraph sync`、`codegraph status`：通过；同步 5 个变更文件，索引 1504 个文件、46408 个节点、180120 条边，无待同步文件。
- `npm run workflow:verify -- --output /private/tmp/cut-piece-return-exact-initiation-task-receipt.json --task-boundary "裁片退仓精确发起、任务级责任与件片双上限原子接收"`：通过；收据状态 `verified`、阻塞 0。

### 例外

- 无。

## 6. 最终结论

结论：通过

说明：功能、专项契约、联合浏览器回归、列表公共能力、完整原型治理、构建、CodeGraph 和任务收据均已通过。本文不表示已提交、合并、推送或产品正式接受。
