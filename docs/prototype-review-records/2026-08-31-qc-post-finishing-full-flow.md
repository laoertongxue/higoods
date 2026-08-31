# QC 后道全流程原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-31 |
| 相关需求 / 任务 | 按《QC后道全流程系统功能需求》、用户 13 项补充规则、完整调整方案、实施计划和 115 条原子需求矩阵实施；执行两轮 3 个生产单 × 5 个 SKU × 5 次回货的领域规则测试及 UI-only 全量跨端连续验收 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS 后道工厂管理 / 公共 PDA / 后道员工 PDA / 仓库 PDA / 打印预览 |
| 涉及页面路径 | 回货确认与送检、Web质检、后道加工、复检、后道出货、差异日志、公共回货PDA、回货确认PDA、后道执行PDA、复检PDA、仓库收货PDA、后道打印 |
| 端类型 | 管理端 / 主管端 / 员工执行端 |
| 主要角色与任务 | 工厂回货登记人、回货确认人、质检员、质检主管、买手、后道操作员、复检员、仓库收货人、指定授权人、管理追溯人员 |
| 当前交付状态 | 本记录覆盖版本已达到本地 `verified`；远端 `delivered` 状态以 GitHub 发布 SHA 回执为准；未做生产部署 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：后道全流程由旧的生产单级自由建质检、PDA质检和多个旧回货确认入口，调整为送货单驱动的一单到底链路；新增 Web 质检工作台、四个后道 PDA 扫码动作、动态授权、差异日志、独立质检参考资料、复检错码重贴恢复及四类打印；同时重写数量、状态、术语、导航和防错反馈。

审查基线：

- `AGENTS.md` 第 3.1 节：总体设计、实施计划、原子需求矩阵、实现证据闭环。
- `AGENTS.md` 第 4 节：印尼工厂员工端扫码优先、单一主动作、数量单位、防错与恢复。
- `AGENTS.md` 第 5 节：组件、管理列表、真实图片、大图和失败态门禁。
- `AGENTS.md` 第 7 节：最后一次实质修改后的分层验证与证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 质检仅在 Web；公共 PDA 只登记回货；员工 PDA 分别处理回货确认、后道、复检和仓库收货；主管 Web 负责列表、授权与追溯。普通质检员无待办池，只能精确扫码。 |
| 文案、状态、数量与单位 | 通过 | 用户可见术语统一为“瑕疵”，数量统一为件和非负整数；回货数量必须大于 0；回货 ±5%与后续零阈值分开；差异逐 SKU 判断，不能整单抵消。 |
| 扫码、真实图片与对象识别 | 通过 | 送检、后道、复检、出货分别使用正确单号；PDA 扫描后显示款式图、SKU、颜色、尺码和数量；三张生产单样式分别使用对应的衬衫、连衣裙和外套图片。 |
| 防错、危险确认与主管兜底 | 通过 | 0数量、部分单号、任务占用、无授权、授权过期/复用、条码错误、内部交接号收货和重复入库均有明确阻断及恢复动作；危险差异要求指定授权人动态码。 |
| 交接、跨端事实与异常追溯 | 通过 | Web、PDA和打印读取同一送货链；每次回货独立形成质检任务；质检、后道、复检、出货和收货均记录真实操作账号、差异、授权和时间。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过（原型范围） | 公共 PDA 覆盖 360×800和400×806；其余后道 PDA 使用项目小屏视口，无初始全量任务。文件上传有选择、成功/失败提示和可重选动作；原型明确不宣称真实离线队列。 |
| 命名路由、交互、图片大图与打印 | 通过 | 两轮各完成 15 条链逐条跨端连续 UI 操作并各保留28张截图与完整trace；全部业务写入由 Web/PDA 页面操作产生。原8个命名场景继续承担大图、低分辨率、异常页和打印DOM相邻回归；送检单、后道加工单、出货单为A4预览，SKU重贴标签为40×30；质检条码进入Web。 |

## 4. 问题标签

- `算不准`
- `点错风险`
- `缺扫码识别`
- `协作断裂`
- `追溯不足`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 回货和后续差异曾使用不清晰的统一口径 | `算不准` | 回货确认人、质检、后道、复检、仓库 | 回货按登记数为分母判断绝对差异率是否超过 5%；后续任一 SKU 只要不等即授权；全部逐 SKU 后汇总 | 否 |
| 旧车缝自助回货可在交接/待加工仓直接确认，绕过复点授权 | `点错风险`、`追溯不足` | 回货确认人 | 旧列表隐藏可领取项；历史待处理只跳转新回货确认页；旧详情直接阻断；Web旧确认处理器删除 | 否 |
| 质检存在 PDA 入口且任务可能被多人处理 | `协作断裂` | 质检员、主管 | 质检改为 Web-only精确扫码，一单一人；占用提示当前质检员，提供退领和再领取 | 否 |
| 色差图和尺寸标准曾可能被误解为技术包内容 | `协作断裂` | 买手、QC | 建立独立质检参考资料，由买手上传或当前 QC 代上传，记录来源和上传人并按质检任务冻结；未上传不伪造 | 否 |
| 后道“次品”与质检瑕疵可能形成两套口径 | `算不准`、`追溯不足` | QC、后道、管理人员 | 用户可见词统一为“瑕疵”；原因、证据、责任和后续处理共用结构，保留发现环节且后道只追加 | 否 |
| 数量一致时 SKU 条码错误可能仍被放行 | `点错风险`、`缺扫码识别` | 复检员、仓库 | 条码错误设为独立绝对阻断；数量授权不可绕过；必须打印正确贴标、确认重贴并复扫正确 | 否 |
| 复检与出货、出货与仓库扫码身份可能重复或混淆 | `协作断裂` | 复检员、仓库 | 一复检单幂等对应一出货单；现场仓库只接受 `FCK...`，内部交接号只作后台关联；重复扫描只读 | 否 |
| 当前是本地原型，不具备真实后端动态码、权限和持久化服务 | `追溯不足` | 未来研发与验收人员 | 文档明确原型边界；本次只验证共享 Mock 事实和页面门禁，不把 LocalStorage 演示表述为生产能力 | 是，属于生产化范围外 |

## 6. 最终结论

结论：通过（本地原型）

说明：

- 核查第 1 遍：领域规则套件独立完成3×5×5并形成336条日志/15次授权消费；随后从空浏览器状态开始，用页面控件连续完成公共PDA回货→回货确认PDA→Web送检/打印→Web质检→Web后道打印→PDA后道→PDA复检→Web出货/打印→PDA仓库→Web回查，15/15链、75/75 SKU全部收货，形成271条日志/5次跨环节授权、28张截图和1份完整trace。
- 核查第 2 遍：在新的空状态、新浏览器端口和独立证据目录再次执行同一领域规模与同一连续跨端链；15/15链、75/75 SKU再次全部收货，业务落地数量与第1遍一致，形成271条日志/5次跨环节授权、28张截图和1份完整trace。
- 连续跨端测试不调用送货、确认、送检、质检、后道、复检、出货或收货领域写入；准备写操作仅限清空测试浏览器本地状态并写入PDA测试登录会话，后者只建立页面操作身份，不生成或修改业务单据。结束时只读回查链路列表和快照以生成JSON证据。
- 两轮连续UI均覆盖正常一致、±5%边界、超5%复点授权、回货后1件差异、领取冲突/退领、参考资料上传冻结、后道和直达复检、统一瑕疵、条码错误阻断/重贴/复扫、一复检一出货、FCK扫码收货、差异授权和重复入库幂等。动态码30秒刷新、过期/复用和数量变更后失效由两轮领域规则套件补足。
- 原8个命名页面场景按两轮重跑，用于精确异常页、低分辨率、大图和打印DOM相邻回归；因使用预置中间状态，不作为全链UI完成证明。
- 本结论是当前本地工作树的原型 `verified`，不等于远端 `delivered`或用户 `accepted`。

## 7. 变更覆盖与验证

### 受管文件

本清单只列本任务的文件或共享文件中的本任务片段，不吸收工作树中其他任务的差异。

- `src/data/app-shell-config.ts`
- `src/components/ui/pda-image-preview.ts`
- `src/data/fcs/post-finishing-domain.ts`
- `src/data/fcs/post-finishing-authorization.ts`
- `src/data/fcs/post-finishing-document-numbering.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/post-finishing-operation-log.ts`
- `src/data/fcs/post-finishing-qc-reference.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/main-handlers/pda-handlers.ts`
- `src/main.ts`
- `src/pages/pda-exec.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-handover.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/pda-quality.ts`
- `src/pages/pda-post-finishing-flow.ts`
- `src/pages/pda-sewing-self-return.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/pda-warehouse.ts`
- `src/pages/print/templates/post-finishing-qc-print-template.ts`
- `src/pages/process-factory/post-finishing/audit-records.ts`
- `src/pages/process-factory/post-finishing/events.ts`
- `src/pages/process-factory/post-finishing/full-flow-print.ts`
- `src/pages/process-factory/post-finishing/outbound-orders.ts`
- `src/pages/process-factory/post-finishing/qc-orders.ts`
- `src/pages/process-factory/post-finishing/qc-workbench.ts`
- `src/pages/process-factory/post-finishing/recheck-orders.ts`
- `src/pages/process-factory/post-finishing/tasks.ts`
- `src/pages/process-factory/post-finishing/warehouse.ts`
- `src/pages/process-factory/post-finishing/work-orders.ts`
- `src/pages/production/detail-domain.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes-pda.ts`
- `tests/post-finishing-full-flow-cross-terminal.spec.ts`
- `tests/post-finishing-full-flow.spec.ts`
- `tests/post-finishing-web-mobile-action-dialog.spec.ts`
- `tests/post-stage-iron-pack-consolidation.spec.ts`
- `tests/process-factory-tabs-and-post-finishing.spec.ts`
- `scripts/check-post-finishing-full-flow.ts`
- `scripts/check-post-finishing-full-flow-surface.ts`
- `scripts/check-post-finishing-cross-terminal-ui.ts`
- `scripts/check-post-finishing-cross-terminal-evidence.ts`
- `scripts/check-post-finishing-full-flow-traceability.ts`
- `scripts/check-post-finishing-qc-print-templates.ts`
- `scripts/check-post-finishing-qc-result-buckets.ts`
- `scripts/check-post-finishing-sewing-self-return.ts`
- `scripts/check-post-finishing-web-mobile-action-dialog.ts`
- `scripts/check-process-factory-tabs-and-post-finishing.ts`
- `package.json`
- `vite.config.ts`

### 页面路由

- `/fcs/craft/post-finishing/wait-process-warehouse`
- `/fcs/craft/post-finishing/qc-workbench`
- `/fcs/craft/post-finishing/qc-orders`
- `/fcs/craft/post-finishing/work-orders`
- `/fcs/craft/post-finishing/recheck-orders`
- `/fcs/craft/post-finishing/outbound-orders`
- `/fcs/craft/post-finishing/audit-records`
- `/fcs/craft/post-finishing/print`
- `/fcs/pda/handover/sewing-self-return`
- `/fcs/pda/post-finishing/return-confirm`
- `/fcs/pda/post-finishing/execute`
- `/fcs/pda/post-finishing/recheck`
- `/fcs/pda/post-finishing/outbound-receive`

### 两轮全流程证据

| 项目 | 核查第 1 遍 | 核查第 2 遍 |
|---|---|---|
| 领域规则证据 | `output/verification/qc-post-finishing-full-flow/pass-1/domain-evidence.json` | `output/verification/qc-post-finishing-full-flow/pass-2/domain-evidence.json` |
| 领域证据生成时间 | `2026-08-31T10:53:52.888Z` | `2026-08-31T10:53:52.888Z` |
| 领域结果 | 15/15链、75/75 SKU、336条日志、15次授权消费 | 15/15链、75/75 SKU、336条日志、15次授权消费 |
| 连续UI JSON | `output/verification/qc-post-finishing-full-flow/pass-1/cross-terminal-evidence.json` | `output/verification/qc-post-finishing-full-flow/pass-2/cross-terminal-evidence.json` |
| 连续UI执行时间 | `2026-08-31T10:55:17.707Z`至`2026-08-31T11:02:00.970Z` | `2026-08-31T12:13:06.733Z`至`2026-08-31T12:20:59.531Z` |
| 连续UI结果 | 15/15链、75/75 SKU、271条日志、5次跨环节授权、15次仓库收货 | 15/15链、75/75 SKU、271条日志、5次跨环节授权、15次仓库收货 |
| 页面截图 | `pass-1/browser/`共28张 | `pass-2/browser/`共28张 |
| 分页面回归 | 8/8通过；`pass-1/page-regression/`共7张 | 8/8通过；`pass-2/page-regression/`共7张 |
| Playwright trace | `pass-1/playwright/`共1份，70,369,999字节 | `pass-2/playwright/`共1份，76,352,416字节 |
| 连续UI JSON SHA-256 | `335ffd1a4fbee22755f4af2f94d512c09d47302ecd1e1b2c18a2bca9db386dbe` | `04dac01b422942f0ac0590dc71fec0b251c4135934906305ce9003106cde3c62` |
| trace SHA-256 | `e193f1f9c3a472ec3fc7a19d18f27c38ba66dc53e28e628123b6e2b2f6211e04` | `7bc67580137b8833b8fd37c180afda9d574be8bc658f00f10141a9f86ca52341` |

### 验证命令

- 两轮分别以`VERIFICATION_PASS=pass-1/pass-2`和对应`POST_FINISHING_EVIDENCE_OUT=output/verification/qc-post-finishing-full-flow/<pass>/domain-evidence.json`运行`npm run check:post-finishing-full-flow`：均通过。
- 两轮分别以独立端口、`POST_FINISHING_CROSS_TERMINAL_EVIDENCE_OUT=output/verification/qc-post-finishing-full-flow/<pass>/cross-terminal-evidence.json`、`POST_FINISHING_CROSS_TERMINAL_SCREENSHOT_DIR=.../<pass>/browser`和Playwright `--output=.../<pass>/playwright --trace=on`运行`npm run test:post-finishing-full-flow:cross-terminal`：串行重跑均1/1通过，最终两轮分别用时约8.0分钟和8.4分钟。
- 最终反向核查先发现测试会话准备写入未被证据文字完整披露，修正为“清空状态并写入PDA测试会话，除此之外业务写入全部来自页面”；随后发现一次页面导航执行上下文竞态和并行运行导致的15分钟总超时。测试加固为导航落定后重试、页面断言最长45秒、单轮上限30分钟，并取消双轮并行。clean-main 发布核查又复现验收产物写入 `output/` 触发 Vite 监听、PDA 停留骨架屏的问题，因此 `vite.config.ts`明确忽略`output/`和`test-results/`；修正后第2轮从空状态完整重跑通过。失败和中断目录仅作调试材料，不计入通过证据。
- `npm run check:post-finishing-cross-terminal-ui`：通过；确认10个命名路由、10个跨端阶段、3×5×5规模及14个禁止直接调用的领域写入。
- `npm run check:post-finishing-cross-terminal-evidence`：通过；确认两轮各15链、28张连续链截图、7张分页面回归截图、1份非空trace、15次收货、最终数量和场景结构一致。
- 两轮原8个命名页面E2E、`check:post-finishing-full-flow-surface`和`check:post-finishing-sewing-self-return`均重跑通过，作为页面级与旧入口相邻回归。
- `node --import tsx scripts/check-post-finishing-qc-result-buckets.ts`：通过。
- `node --import tsx scripts/check-post-finishing-qc-print-templates.ts`：通过。
- `node --import tsx scripts/check-post-finishing-web-mobile-action-dialog.ts`：通过。
- `node --import tsx scripts/check-process-factory-tabs-and-post-finishing.ts`：通过。
- `npm run build`：通过，2,367 个模块完成转换。
- `npm run check:post-finishing-full-flow-traceability`：通过；文档回填后连续执行两遍，每遍均确认 115/115 条原子需求、33/33 个原文来源段落、13/13 项用户确认和 115/115 个最终证据映射，状态全部为“已验证”。
- `npm run check:list-page-governance:static`：通过；第一次发现新 PDA 页缺页面模式声明，补齐本次三个新增执行/打印/质检页面的 `pda`、`detail`、`form`声明后重跑通过，共扫描 366 个页面、17 个历史基线页面。
- `npm run check:prototype-design-governance`：通过；暂存区内本次受管文件全部由本审查记录覆盖。
- `npm run check:prototype-design-governance -- --all`：通过；在隔离干净工作树中确认 35 个用户可见受管文件、0 个纯技术受管文件和 1 份关联审查记录。
- `git diff --check`：通过。
- `codegraph init -i .`与后续`codegraph sync`：通过；隔离工作树索引最终状态为 1,516 个文件、46,659 个节点、182,968 条边，待同步文件为 0，工作树匹配。
- `npm run workflow:verify -- --output /private/tmp/qc-post-finishing-task-receipt.json --task-boundary "QC后道全流程Web/PDA/打印与3×5×5双轮验收"`：通过；提交前最终任务收据状态为 `verified`。

### 真实图片验证

- 三个生产单分别绑定 `/shirt-sample.jpg`、`/dress-sample-1.jpg`、`/jacket-sample.jpg`，每张生产单的 5 个 SKU 使用该生产单对应款式图片，不用色块、图标或无关网络图冒充。
- Web质检、公共回货PDA、回货确认PDA、后道PDA、复检PDA和仓库PDA把图片与 SPU/SKU、颜色、尺码放在同一信息块。
- 图片组件均有“图片加载中…”和“图片加载失败”状态；Web/PDA支持点击大图，并有关闭按钮、遮罩和 Esc 关闭路径。
- 两轮浏览器场景均等待代表图片自然加载后留存页面截图；参考资料未上传时显示明确空态，不伪造色差图或尺寸标准。

### 例外

- 本次发布使用独立干净工作树，仅包含本任务 56 个文件；原工作树的其他未提交修改未进入任务差异。提交前最终 `workflow:verify` 回执输出到 `/private/tmp/qc-post-finishing-task-receipt.json`，临时回执不纳入仓库。
- 本仓库是产品原型；真实服务端鉴权、动态码密钥、数据库持久化、离线队列、实体扫码枪和生产部署不在本次范围。本次 PDA 结论来自项目小屏浏览器验收。
