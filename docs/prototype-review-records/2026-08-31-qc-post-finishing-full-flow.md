# QC 后道全流程原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-01 |
| 相关需求 / 任务 | 按《QC后道全流程系统功能需求》、用户 23 项补充规则、完整调整方案、实施计划和 141 条原子需求矩阵实施；在当前线上两仓标准库存台账基础上增量调整，并执行两轮 3 个生产单 × 5 个 SKU × 5 次回货的领域规则测试及 UI-only 全量跨端连续验收 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS 后道工厂管理 / 公共 PDA / 后道员工 PDA / 仓库 PDA / 打印预览 |
| 涉及页面路径 | 后道任务、后道待加工仓、统一质检任务、后道单、复检单、后道待交出仓、后道出货单、差异与操作日志主从页、我的动态授权码、公共回货PDA、回货确认PDA、后道执行PDA、复检PDA、仓库收货PDA、后道打印 |
| 端类型 | 管理端 / 主管端 / 员工执行端 |
| 主要角色与任务 | 工厂回货登记人、回货确认人、质检员、质检主管、买手、后道操作员、复检员、仓库收货人、指定授权人、管理追溯人员 |
| 当前交付状态 | 本记录覆盖版本已达到本地 `verified`；远端 `delivered` 状态以 GitHub 发布 SHA 回执为准；未做生产部署 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：后道全流程由旧的生产单级自由建质检、PDA质检和多个旧回货确认入口，调整为送货单驱动的一单到底链路；在当前线上后道待加工仓和后道待交出仓的四指标、既有页签、紧凑筛选、密集 SKU 表和分页骨架内增量补充批次、动作与追溯；新增两仓独立出入库事实、统一 Web 质检菜单与任务号输入、授权人本人动态码入口、日志主从页、默认 3×5×5 Mock、后道 PDA 动作、独立质检参考资料、复检错码重贴恢复及四类打印；同时收口数量、状态、术语、导航和防错反馈。

审查基线：

- `AGENTS.md` 第 3.1 节：总体设计、实施计划、原子需求矩阵、实现证据闭环。
- `AGENTS.md` 第 4 节：印尼工厂员工端扫码优先、单一主动作、数量单位、防错与恢复。
- `AGENTS.md` 第 5 节：组件、管理列表、真实图片、大图和失败态门禁。
- `AGENTS.md` 第 7 节：最后一次实质修改后的分层验证与证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 质检仅在 Web；“质检任务”同一菜单页面同时提供普通质检员任务号输入和主管任务管理；公共 PDA 只登记回货；员工 PDA 分别处理回货确认、后道、复检和仓库收货；授权人从“我的动态授权码”查看本人码。 |
| 文案、状态、数量与单位 | 通过 | 用户可见术语统一为“瑕疵”，数量统一为件和非负整数；回货数量必须大于 0；回货 ±5%与后续零阈值分开；差异逐 SKU 判断，不能整单抵消。 |
| 扫码、真实图片与对象识别 | 通过 | 送检、后道、复检、出货分别使用正确单号；PDA 扫描后显示款式图、SKU、颜色、尺码和数量；三张生产单样式分别使用对应的衬衫、连衣裙和外套图片。 |
| 防错、危险确认与主管兜底 | 通过 | 0数量、部分单号、任务占用、无授权、授权过期/复用、条码错误、内部交接号收货和重复入库均有明确阻断及恢复动作；危险差异要求指定授权人动态码。 |
| 交接、跨端事实与异常追溯 | 通过 | 工厂登记先形成待加工仓待确认记录；Web/PDA确认形成唯一入库流水与可用量，Web送检形成唯一出库流水并清零；复检完成形成待交出入仓，仓库收货按出货数量形成交出扣减且实收独立记录；Web、PDA和打印读取同一根送货链；日志外层按每次回货聚合，详情展示单据链、逐 SKU 差异和时间线。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过（原型范围） | 公共 PDA 覆盖 360×800和400×806；其余后道 PDA 使用项目小屏视口，无初始全量任务。文件上传有选择、成功/失败提示和可重选动作；原型明确不宣称真实离线队列。 |
| 命名路由、交互、图片大图与打印 | 通过 | 两轮各完成 15 条链逐条跨端连续 UI 操作并各保留50张截图与完整trace；其中包含后道生产任务、待加工仓、待交出仓、统一质检页和日志链详情5张关键 Web 页面图。全部业务写入由 Web/PDA 页面操作产生；另有11个命名场景通过并保留13张截图，覆盖默认 Mock、回货/质检关联弹窗、两仓台账、大图、低分辨率、异常页和打印DOM。 |

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
| 质检存在 PDA 入口且任务可能被多人处理 | `协作断裂` | 质检员、主管 | 质检改为 Web-only输入完整任务号领取，一单一人；占用提示当前质检员，提供退领和再领取 | 否 |
| 色差图和尺寸标准曾可能被误解为技术包内容 | `协作断裂` | 买手、QC | 建立独立质检参考资料，由买手上传或当前 QC 代上传，记录来源和上传人并按质检任务冻结；未上传不伪造 | 否 |
| 后道“次品”与质检瑕疵可能形成两套口径 | `算不准`、`追溯不足` | QC、后道、管理人员 | 用户可见词统一为“瑕疵”；原因、证据、责任和后续处理共用结构，保留发现环节且后道只追加 | 否 |
| 数量一致时 SKU 条码错误可能仍被放行 | `点错风险`、`缺扫码识别` | 复检员、仓库 | 条码错误设为独立绝对阻断；数量授权不可绕过；必须打印正确贴标、确认重贴并复扫正确 | 否 |
| 复检与出货、出货与仓库扫码身份可能重复或混淆 | `协作断裂` | 复检员、仓库 | 一复检单幂等对应一出货单；现场仓库只接受 `FCK...`，内部交接号只作后台关联；重复扫描只读 | 否 |
| 回货确认只有表单、没有真实待加工仓库存与 Web 操作入口 | `协作断裂`、`追溯不足` | 回货确认人、送检人 | 登记即形成待确认仓记录；Web/PDA确认形成入库和逐 SKU 可用量；Web库存卡发起送检并形成出库流水 | 否 |
| Web 质检工作台与任务管理分散，且 Web 文案误写为扫码 | `点错风险` | 质检员、主管 | 菜单只保留“质检任务”；同页上方输入完整任务号领取，下方主管管理；扫码仅保留在 PDA 语境 | 否 |
| 日志页面平铺原始操作，无法按一次回货理解完整链路 | `追溯不足` | 管理追溯人员 | 外层一行一条具体回货链，详情拆为单据链、逐 SKU 差异、操作时间线和统一瑕疵记录 | 否 |
| 指定人员动态码没有正常查看入口 | `协作断裂` | 指定授权人 | 新增“我的动态授权码”菜单；只读取当前身份，非授权身份拒绝显示，日志页不再展示当前码 | 否 |
| 默认页面没有足够 Mock，无法直接验证多状态业务 | `追溯不足` | 产品、测试、演示人员 | 全新浏览器默认加载3个生产单×每单5个SKU×每单5次回货，并分布于待确认、在仓、质检、后道、复检和已出货状态；空状态全链测试单独关闭默认数据 | 否 |
| 两张仓库页曾被改成流程卡片或跳转占位，偏离当前线上库存台账 | `点错风险`、`协作断裂` | 后道仓管、送检人、管理人员 | 恢复线上四项指标、既有页签、紧凑筛选、密集 SKU 表和分页；新增动作放在原页签、行操作、批次明细和抽屉内，不改变库存台账认知 | 否 |
| 出货单曾替代待交出仓，无法表达复检后仍在后道工厂的物理库存 | `算不准`、`追溯不足` | 复检员、后道仓管、收货仓管 | 新增独立待交出记录与流水；复检合格入仓，仓库收货按出货数量交出扣减，实收数量独立保存；重复完成和重复收货均幂等 | 否 |
| 当前是本地原型，不具备真实后端动态码、权限和持久化服务 | `追溯不足` | 未来研发与验收人员 | 文档明确原型边界；本次只验证共享 Mock 事实和页面门禁，不把 LocalStorage 演示表述为生产能力 | 是，属于生产化范围外 |

## 6. 最终结论

结论：通过（本地原型）

说明：

- 核查第 1 遍：从空浏览器状态由页面完成15/15链、75/75 SKU，形成两仓各15条记录/30条流水、370条日志、6次跨阶段授权、50张截图和1份完整trace。
- 核查第 2 遍：在新的空状态和独立目录再次完成相同15/15链、75/75 SKU；最终数量与第1遍一致，同样形成370条日志、6次授权、50张截图和1份trace。
- 连续跨端测试不调用送货、确认、送检、质检、后道、复检、出货或收货领域写入；准备写操作仅限清空测试浏览器本地状态并写入PDA测试登录会话，后者只建立页面操作身份，不生成或修改业务单据。结束时只读回查链路列表和快照以生成JSON证据。
- 两轮连续UI均覆盖正常一致、±5%边界、超5%复点授权、回货后1件差异、领取冲突/退领、参考资料上传冻结、后道和直达复检、统一瑕疵、条码错误阻断/重贴/复扫、一复检一出货、FCK扫码收货、差异授权和重复入库幂等。动态码30秒刷新、过期/复用和数量变更后失效由两轮领域规则套件补足。
- 最终11个命名页面场景在最后一次实质修改后全量重跑通过并保留13张截图，覆盖默认3×5×5 Mock、后道生产任务及回货/质检关联弹窗、两张线上骨架仓库页、统一质检页、个人授权码、日志链详情和A4出货单；它们不替代从空状态运行的双轮全链UI证据。
- 正式命名页面首次冷启动运行在第9条综合场景耗尽60秒测试总时限；trace已确认授权拒绝页实际成功渲染，失败发生在页面关闭阶段。该测试时限修正为180秒后，全部9个场景从头重跑通过；首次10张截图保留在`2026-09-01-online-baseline-named-ui-failed-attempt-1/`，不计入通过证据。
- 开启trace的首次正式尝试暴露PDA后道数量输入仍触发整页重绘、填写值可能恢复默认；修复为数量输入只局部更新合计后，受影响专项、当前11个命名场景和双轮全链全部重新执行。失败/中断产物不计入通过证据。
- 最终反向核查发现“未设置当前授权身份”曾错误兜底为授权名单第一人；已改为无明确授权身份即拒绝显示动态码，并在命名页面和两轮跨端取码流程中分别验证“先不可见、再设置指定人员后可见”。
- 最终证据核查发现旧检查脚本曾读取上一轮 `qc-post-finishing-full-flow` 目录；该次检查结果已作废。检查器、计划、矩阵和本记录现统一读取本次 `post-finishing-full-flow` 目录，并以当前两轮时间、数量和 SHA-256 重新通过。
- 本结论是当前本地工作树的原型 `verified`，不等于远端 `delivered`或用户 `accepted`。

### 两遍追踪审查

- 第 1 遍（正向）：从 33 个需求来源段落和用户 23 项确认逐条进入 141 个原子需求，再检查工作包、实现位置、自动化与 Web/PDA/打印证据；确认两仓、根任务链、默认 Mock 和双轮验收均有当前版本证据。
- 第 2 遍（反向）：从菜单、12 个 Web 路由、5 个 PDA 路由、4 类打印、两仓数据、默认 Mock、领域脚本和浏览器测试逐项回到需求编号；确认不存在以出货单替代待交出仓、URL切换身份、旧PDA质检、旧回货直确认或无来源页面能力。

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
- `src/pages/process-factory/post-finishing/authorization-code.ts`
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
- `scripts/check-post-finishing-default-demo.ts`
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

- `/fcs/craft/post-finishing/tasks`
- `/fcs/craft/post-finishing/wait-process-warehouse`
- `/fcs/craft/post-finishing/qc-workbench`
- `/fcs/craft/post-finishing/qc-orders`
- `/fcs/craft/post-finishing/work-orders`
- `/fcs/craft/post-finishing/recheck-orders`
- `/fcs/craft/post-finishing/wait-handover-warehouse`
- `/fcs/craft/post-finishing/outbound-orders`
- `/fcs/craft/post-finishing/audit-records`
- `/fcs/craft/post-finishing/authorization-code`
- `/fcs/craft/post-finishing/print`
- `/fcs/pda/handover/sewing-self-return`
- `/fcs/pda/post-finishing/return-confirm`
- `/fcs/pda/post-finishing/execute`
- `/fcs/pda/post-finishing/recheck`
- `/fcs/pda/post-finishing/outbound-receive`

### 两轮全流程证据

| 项目 | 核查第 1 遍 | 核查第 2 遍 |
|---|---|---|
| 领域规则证据 | `output/verification/post-finishing-full-flow/2026-09-03-auto-qc-final-pass-1/domain-evidence.json` | `output/verification/post-finishing-full-flow/2026-09-03-auto-qc-final-pass-2/domain-evidence.json` |
| 领域证据生成时间 | `2026-09-02T16:54:24.881Z` | `2026-09-02T16:54:24.880Z`（独立进程/独立状态） |
| 领域结果 | 15/15链、75/75 SKU、两仓各15条记录/30条流水、352条日志、15次授权消费 | 15/15链、75/75 SKU、两仓各15条记录/30条流水、352条日志、15次授权消费 |
| 连续UI JSON | `output/verification/post-finishing-full-flow/2026-09-03-auto-qc-final-pass-1/evidence.json` | `output/verification/post-finishing-full-flow/2026-09-03-auto-qc-final-pass-2/evidence.json` |
| 连续UI执行时间 | `2026-09-02T16:39:06.471Z`至`2026-09-02T16:45:49.798Z` | `2026-09-02T16:46:11.674Z`至`2026-09-02T16:53:22.907Z` |
| 连续UI结果 | 15/15链、75/75 SKU、15个确认自动建单阶段、两仓各15条记录/30条流水、348条日志、5次跨环节授权、15次仓库收货，待交出15/15已交出 | 15/15链、75/75 SKU、15个确认自动建单阶段、两仓各15条记录/30条流水、348条日志、5次跨环节授权、15次仓库收货，待交出15/15已交出 |
| 页面截图 | `2026-09-03-auto-qc-final-pass-1/screenshots/`共49张 | `2026-09-03-auto-qc-final-pass-2/screenshots/`共49张 |
| 关键 Web 页面 | 每轮5张：后道生产任务、待加工仓、待交出仓、统一质检、日志链详情 | 每轮5张：后道生产任务、待加工仓、待交出仓、统一质检、日志链详情 |
| 命名页面回归 | 11/11通过；`2026-09-03-auto-qc-named-ui-final/`共13张截图，质检单弹窗为4张 | 不重复制造第二份相同证据；两轮各自仍保留5张关键 Web 页面截图 |
| Playwright trace | `2026-09-03-auto-qc-final-pass-1/playwright/`共1份，78,444,601字节 | `2026-09-03-auto-qc-final-pass-2/playwright/`共1份，79,105,094字节 |
| 连续UI JSON SHA-256 | `2455273d1f25e1a9f320821ec3ca3631ce20a28ae1123ebbfe480589f36522a6` | `a8e3328a57ebae6d222c94c8bda893ccf79105b3493386e1fdcee9abe70226e3` |
| trace SHA-256 | `65c1c27af7aa27d19f22d4dc14cee10a09d32aee8a25b60641b983a941fdb883` | `911a2a115b6527844eca57a56da9dc094c76a53e969b307d21e18b85edaefa3d` |

### 验证命令

- 两轮分别以`VERIFICATION_PASS=auto-qc-final-pass-1/auto-qc-final-pass-2`和对应`POST_FINISHING_EVIDENCE_OUT=.../<final-pass>/domain-evidence.json`运行`npm run check:post-finishing-full-flow`：均通过；每轮明确落地待加工仓和待交出仓各15条记录/30条流水，并验证确认时建单、送检前不可领取、送检沿用同号。
- 两轮分别以新端口、空浏览器状态、独立`evidence.json`/`screenshots/`/`playwright/`目录及Playwright `--trace=on`串行运行连续跨端套件：均1/1通过；当前最终两轮连续 UI 执行时长分别约6分13秒和5分58秒。
- 输入局部更新回归：通过；开启trace后复现PDA后道数量输入整页重绘，根因是局部合计处理后全局输入监听仍重新渲染页面；修复为数量输入标记跳过整页重绘。受影响专项、最终11个命名页面和双轮全链均在修复后重跑。失败和中断产物不计入通过证据。
- 两仓分页提示回归：通过；最终人工截图复核发现“每页条数”下拉先触发的`input`事件会越过仅处理`change`的分支，误入需要送货单的业务动作并残留“缺少送货单。”红色提示。处理器改为对分页字段的所有事件就地消费、仅在`change`时刷新；跨端测试对两仓分别增加无错误提示断言，11个命名页面和两轮3×5×5全部重新执行，人工复核两轮两仓截图确认提示消失且线上骨架未变。
- `npm run check:post-finishing-cross-terminal-ui`：通过；确认正常菜单、12个命名路由、13个跨端阶段、3×5×5规模及禁止直接调用的领域写入。
- `npm run check:post-finishing-cross-terminal-evidence`：通过；确认两轮各15链、49张跨端截图（含5张关键Web页面）、1份非空trace、15次收货、两仓各15条记录/30条流水、待交出15/15已交出、最终数量和场景结构一致；另确认13张命名页面回归截图。
- 最终11个命名页面E2E：通过；全量重跑并保留13张截图，`check:post-finishing-full-flow-surface`和默认3×5×5 Mock专项也通过，覆盖后道生产任务关联弹窗、两仓标准台账、页面级异常与旧入口相邻回归。
- `node --import tsx scripts/check-post-finishing-qc-result-buckets.ts`：通过。
- `node --import tsx scripts/check-post-finishing-qc-print-templates.ts`：通过。
- `node --import tsx scripts/check-post-finishing-web-mobile-action-dialog.ts`：通过。
- `node --import tsx scripts/check-process-factory-tabs-and-post-finishing.ts`：通过。
- `npm run build`：通过；2,394 个模块完成转换。
- `npm run check:post-finishing-full-flow-traceability`：通过；文档回填后分别以正向/反向审计标签独立执行，证据落在`output/verification/post-finishing-full-flow/2026-09-03-auto-qc-traceability-forward.json`和`output/verification/post-finishing-full-flow/2026-09-03-auto-qc-traceability-reverse.json`；每遍确认 141/141 条原子需求、33/33 个原文来源段落、23/23 项用户确认和 141/141 个最终证据映射，状态全部为“已验证”。
- `npm run check:list-page-governance:static`：通过；共扫描 378 个页面、17 个历史基线页面。
- `npm run check:list-page-governance`：通过；静态扫描、标准列表 TypeScript 契约、Chromium 列拖拽/存储/取消拖拽回归和全量原型治理均通过。
- `npm run check:prototype-design-governance`：通过；当前没有暂存文件，命令如实报告`no governed prototype changes`；本次工作树全部 14 个用户可见受管文件由下面的`--all`结果验收。
- `npm run check:prototype-design-governance -- --all`：通过；在隔离工作树中确认 14 个用户可见受管文件、0 个纯技术受管文件和 1 份关联审查记录。
- `git diff --check`：通过。
- `codegraph status`：通过；文件监听已同步本轮 TypeScript 变更，索引1,577个文件、48,527个节点、168,884条边；状态查询无待同步提示或工作树不匹配。
- `npm run workflow:verify -- --output output/verification/post-finishing-full-flow/2026-09-03-auto-qc-task-receipt.json --task-boundary "QC后道全流程：统一后道生产任务/后道加工单；回货确认自动建待送检质检单；待加工仓仅送检激活；关联弹窗、Web/PDA/打印及3×5×5双轮证据"`：通过；最终收据状态为`verified`、`blockers=[]`。

### 真实图片验证

- 三个生产单分别绑定 `/shirt-sample.jpg`、`/dress-sample-1.jpg`、`/jacket-sample.jpg`，每张生产单的 5 个 SKU 使用该生产单对应款式图片，不用色块、图标或无关网络图冒充。
- Web质检、公共回货PDA、回货确认PDA、后道PDA、复检PDA和仓库PDA把图片与 SPU/SKU、颜色、尺码放在同一信息块。
- 图片组件均有“图片加载中…”和“图片加载失败”状态；Web/PDA支持点击大图，并有关闭按钮、遮罩和 Esc 关闭路径。
- 两轮浏览器场景均等待代表图片自然加载后留存页面截图；参考资料未上传时显示明确空态，不伪造色差图或尺寸标准。

### 例外

- 本次使用独立工作树；原工作树的其他未提交修改未进入任务差异。正式证据和任务收据均落在`output/verification/post-finishing-full-flow/`。
- 本仓库是产品原型；真实服务端鉴权、动态码密钥、数据库持久化、离线队列、实体扫码枪和生产部署不在本次范围。本次 PDA 结论来自项目小屏浏览器验收。
