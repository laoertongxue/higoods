# 裁片退仓处理与补料来源简化原型审查记录

## 1. 基本信息

| 项目 | 内容 |
|---|---|
| 记录日期 | 2026-08-15 |
| 相关需求 / 任务 | 非报废退裁片创建补料即结算；补料绑定原裁片单；补料业务来源区分人工发起与车缝退仓；补齐退仓菜单图标、发起入口和实物票证据规则 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PFOS 裁床厂管理、共享补料登记、裁床仓库 |
| 涉及页面路径 | `/fcs/craft/cutting/cut-piece-return-processing`、`/fcs/craft/cutting/supplement-management`、`/fcs/craft/cutting/cut-orders`、`/fcs/craft/cutting/warehouse-management/wait-handover` |
| 端类型 | 管理 / 主管端桌面 Web、退裁片大菲票打印预览 |
| 主要角色与任务 | 退仓员发起、接收、清点和制票；主管报废或创建补料；补料处理人走既有补料流程；管理人员联查责任与来源 |
| 开工分支 / 版本 | `codex/cut-piece-return-supplement-v2`；基线 `b8a88a9c757dbab24c2655d0bc07f6dbe7696bd1` 加当前未提交工作树 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：退仓页新增正式发起入口、票据证据模式、结算边界和来源补料动作；补料列表新增“业务来源”筛选与标准列；补料详情和裁片单新增退仓来源及可复用裁片快照；仓区移除退仓内重新齐套/再交出表达；菜单补图标。

边界：

- 普通、特殊工艺和捆条菲票既有业务规则不变。
- 普通补料的采购、染色、印花、物料准备及完成逻辑不变。
- 后续齐套、装袋和交出继续使用普通流程，不在退仓页重复实现。
- 本轮没有新增 PDA、上传、弱网、真实打印机驱动、后端或权限。

现行需求依据：

- `docs/product-design/裁片退仓处理与补料来源简化总体设计.md`
- `docs/product-design/裁片退仓处理与补料来源简化实施计划.md`
- `docs/product-design/裁片退仓处理与补料来源简化需求追踪与交付矩阵.md`
- `AGENTS.md` 第 4、5、7、8 节。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
|---|---|---|
| 角色、端类型、当前任务和主动作 | 通过 | 管理/主管列表首屏提供“新增退仓”；待接收行提供“接收清点”；确认后按库存状态提供报废、补料和制票。 |
| 信息密度、页面模式和导航 | 通过 | 退仓与补料均使用管理端标准列表；宽表在表格容器滚动，页面主体在 1366×768、1280×720 无横向溢出。 |
| 文案、状态、数量、单位和差异 | 通过 | “件”只用于责任/最终补件，“片”只用于部位/库存/报废/补裁；部位差异不二次改变责任。 |
| 扫码、真实图片和对象识别 | 通过 | 历史票与实物票分离；扫码必须匹配，缺失/不可识别可手工选部位；款式和物料同块显示对象图片。 |
| 防错阻断、危险确认和主管兜底 | 通过 | 重复发起、超责任、错票、重复票、超库存报废、缺原因、零补料和重复结算均有阻断；报废有二次确认。 |
| 交接责任、跨端事实、异常和追溯 | 通过 | 冻结正式交出；确认退件扣减责任；退片进入独立库区；创建补料按原裁片单拆单并立即结算；后续由普通流程承接。 |
| 低分辨率、PDA、扫码枪、弱网和上传失败 | 通过 / 不适用 | 两档桌面分辨率通过；扫码输入可键盘/扫码枪录入；本轮不新增 PDA、弱网或上传能力。 |
| 命名路由、关键交互、图片大图和打印 | 通过 | 主链、图片加载/失败/大图、100mm 大菲票、补料深链及裁片单反查均由当前 Playwright 规格覆盖。 |

## 4. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 剩余风险 |
|---|---|---|---|---|
| 退仓页没有明确发起入口 | `找不到动作` | 退仓员 | 增加“新增退仓”，候选只读正式车缝交出并冻结来源 | 无 |
| “有实物票”来源不明 | `事实混淆` | 退仓员 / 主管 | 拆分系统历史票和本次实物票状态；仅匹配扫码才算在场 | 无 |
| 退仓模块承担补料后齐套和交出，流程过重 | `职责重叠` | 主管 / 仓管 | 非报废创建补料即结算；后续统一回普通流程 | 无 |
| 补料无法区分主动发起和退仓触发 | `来源不清` | 管理人员 | 增加独立业务来源字段、筛选、列和详情 | 无 |
| 补料没有稳定原裁片单归属 | `追溯断裂` | 裁床主管 / 跟单 | 每单强制绑定一个原裁片单；跨裁片单原子拆单 | 无 |
| 校验失败后接收表单重绘导致现场输入丢失 | `操作中断` | 退仓员 | 错误只刷新反馈区域，保留件数、片数和证据输入 | 无 |
| 新增来源列未进入标准列表拖拽契约 | `治理遗漏` | 研发 / 测试 | 更新纯事件和真实 Chromium 列顺序、持久化与稳定 DOM 断言 | 无 |

## 5. 变更覆盖与验证

### 受管文件

- `src/data/fcs/cutting/cut-order-supplement-fixture.ts`
- `src/data/fcs/cutting/cut-piece-return-domain.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/supplement-order-registry.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/pages/process-dye-orders.ts`
- `src/pages/process-factory/cutting/cut-orders.ts`
- `src/pages/process-factory/cutting/pickup-management-projection.ts`
- `src/pages/process-factory/cutting/cut-piece-return-processing.ts`
- `src/pages/process-factory/cutting/meta.ts`
- `src/pages/process-factory/cutting/supplement-management.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`

其它直接任务文件：

- `src/icons/shell-icons.ts`
- `scripts/check-cut-piece-return-processing.ts`
- `scripts/check-cut-piece-return-processing-v2.ts`
- `scripts/check-standard-list-page-template.ts`
- `tests/cut-piece-return-processing.spec.ts`
- `tests/cut-order-supplement-linkage.spec.ts`
- `tests/supplement-management-list-template.spec.ts`

### 页面路由

- `/fcs/craft/cutting/cut-piece-return-processing`
- `/fcs/craft/cutting/supplement-management`
- `/fcs/craft/cutting/cut-orders`
- `/fcs/craft/cutting/warehouse-management/wait-handover`

### 真实图片验证

| 对象 | 稳定资源 | 对应关系 | 当前验证 |
|---|---|---|---|
| `SPU-2024-010` 裤装款式 | `public/pants-sample.jpg`，1024×1024 JPEG | 款式效果图由 SPU / 款名规则精确选择 | 图片成功加载、同块标识、大图、Esc / 遮罩 / 按钮关闭通过 |
| Black 弹力斜纹主面料 | `public/materials/fei-ticket/black-stretch-twill.png`，1448×1086 PNG | 来源裁片单冻结正式物料图 | 缩略图、大图、失败态通过 |
| Charcoal 弹力斜纹主面料 | `public/materials/fei-ticket/charcoal-stretch-twill.png`，1448×1086 PNG | 来源裁片单冻结正式物料图 | 缩略图、大图、失败态通过 |

候选缺少任一正式款式图或正式物料图时禁止发起退仓，不用通用图片冒充。

### 浏览器与打印证据

| 证据 | 覆盖内容 |
|---|---|
| `output/playwright/cut-piece-return-large-ticket-100mm.png` | 退裁片大菲票固定 100mm×100mm、真实二维码、无旧实物票也可快速选部位 |
| `output/playwright/sewing-return-supplement-detail.png` | 业务来源“车缝退仓”、退仓单、交出来源、原裁片单、可复用裁片快照 |
| `output/playwright/cut-order-sewing-return-supplement.png` | 原裁片单上的车缝退仓补料标签、同裁片单多次补料和详情联查 |

命名浏览器规格 `tests/cut-piece-return-processing.spec.ts` 同时覆盖：菜单图标、标准列表、两档分辨率、发起候选、错票纠正、缺票手工录入、件/片差异、补裁数高于退片数、最终补 25 件、来源筛选和图片失败态。

### 验证命令

- `npm run check:cut-piece-return-processing`：通过。
- 三份相关 Playwright 规格合并回归：通过，62 / 62。
- `npm run build`：通过，Vite 2344 个模块完成构建。
- `node --experimental-strip-types --test tests/supplement-order-registry.test.ts`：通过，22 / 22。
- 补料节点、补料加工单、供应决策、物料准备、三列表数据闭环、PDA 领料、裁剪主链、仓区和捆条相邻回归：通过。
- `npm run check:cutting-pickup-important-regressions`：通过；旧 Store 恢复 PO0002 当前 `pickup-node:prep-order-po-202603-0002:9`。
- `npm run check:cutting-pickup-three-list`：通过；已到仓补料进入当前节点，未到仓补料仍保持独立需求且无幽灵库存。
- `npm run check:dyeing-workflow`：通过；染色领域检查与 DYE 列表页面事件检查均通过。
- `npm run check:list-page-governance`：通过；静态扫描 357 个列表页、历史基线 17 个，真实 Chromium 拖列和偏好保存通过。
- `npm run check:prototype-design-governance -- --all`：通过；12 个用户可见文件、0 个技术例外、2 份关联记录。
- `git diff --check`：通过。
- CodeGraph：通过；隔离工作树已索引 1504 个文件，任务收据同步前后待处理文件均为 0，工作树匹配。
- `npm run workflow:verify -- --output /private/tmp/cut-piece-return-supplement-task-receipt.json --task-boundary "裁片退仓处理与补料来源简化及裁床接收、染色旧数据回归修复"`：通过；状态 `verified`，阻塞项 0。

### 例外

- 本轮不新增 PDA、上传、弱网、真实打印机驱动、后端和权限；对应验收不适用。
- 当前版本尚未提交、合并或推送，不把本地验证表述为远端交付或产品接受。
- `check:fcs-handover-domain` 的合并任务二维码断言在当前分支与未修改的 `origin/main@b8a88a9c` 均同样失败；已用相同命令在独立 `origin/main` 归档目录复现，确认不是本轮交接查询优化引入。本轮按任务边界不改合并任务二维码业务。

## 6. 最终结论

结论：通过

本轮需求、实现、命名页面、图片、打印、治理、构建、CodeGraph 与任务收据已形成当前隔离工作树证据闭环。本记录不表示已经提交、合并、推送或产品正式接受。
