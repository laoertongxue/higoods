# PPIC每日回货与两节点履约本地原型审查记录

依据 [AGENTS.md](../../AGENTS.md) 的 SCOPE-02、TRACE-01、REVIEW-01、PERF-01、EVIDENCE-01；本记录只绑定本轮实际范围与证据。

## 基本信息

- 日期：2026-10-14
- 任务 / 需求编号：PPIC每日回货与两节点履约 R01～R73
- 验证人：Codex主代理（本地原型技术验证）；独立只读审查代理（需求与变更核对）。业务方接受未登记。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：新增任务维度的每日承诺、欠回补回、日确认、组长汇总；后道确认增加双时间并同事务分摊；累计回货从三个节点改为35%及100%，涉及分配、合同、回货、看板、耗时及PDA。属于T4共享业务改动。本轮没有发布操作。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 范围与数量来源 | 通过 | R01～R08、R45、R65：正式简易/袋交出、缺片放行矩阵、三合一分配量；来源歧义阻断，19个依据契约及真实适配器。已确认来源的审批授权沿原链接追溯，不构造缺失审批。 |
| 两节点与时序 | 通过 | R09～R15、R44、R67～R70：三类型4/9、5/10、6/12天，35%向上取整，Asia/Jakarta，分配日第1自然日。正式数据未知不造零量完成；毫秒边界不截断。 |
| 承诺及补回状态 | 通过 | R19～R39、R46、R66、R73：容量只占一次，原承诺数量/截止不覆盖；逾期补齐保留原准时率；多分支补回、迟录解除及历史兑现不重复计数。边界契约18项。 |
| 角色和历史读取 | 通过 | R17、R18、R43、R60：成员只操作当前责任任务；组长团队读取；正式实收沿后道授权。真实11时A→B、13时B→C移交，12时到期责任仍B、原填报人仍A；他人历史阻断。免登录演示身份不代表生产鉴权。 |
| 日确认和汇总范围 | 通过 | R22～R24、R39～R42、R61～R64：17:00初始截止/生效日配置/原提交快照；无安排及无任务确认；首版数量加权，补回不加分母；筛选、统计、全量导出一致。30成员含10补充Mock。 |
| 原子保存和恢复 | 通过 | R48～R52、R71：承诺、补回、分摊等8种记录与后道主单/仓库/QC同PCS事务；TX complete后发布；中止完整回滚/保留输入/唯一重试；多标签旧版本拒绝；关闭刷新及独立PDA直达；IDB打开/读取失败恢复。 |
| 存储边界 | 通过 | 普通读取不写业务种子、无业务localStorage后备、无Base64新增；偏好仅列顺序/显示/冻结/每页条数，单键4096字节，失败回默认。裁片来源跨库只读并校验来源版本，不声称跨库原子写入。 |
| 旧版本与迁移 | 通过 | R53：旧三节点及签署合同保留原身份，当前活动监控受控读取为两节点。新合同禁止旧规则新写；本轮没有物理旧数据迁移或删除，所以R54中断迁移不适用。 |
| 管理列表设备 | 通过 | R55：1366×768和1280×720，主体无横向溢出；新汇总复用标准列表、分页与列管理。 |
| 员工Web设备 | 通过 | R56：1024×768完成新增、修改、补回、原因、日确认及失败恢复；弹窗/筛选局部更新，根节点保持。 |
| PDA设备与直接上下游 | 通过 | R68、R71、R72：Chrome模拟390×844执行、交接列表/详情/现场实收预览、后道正式确认；现场交接不计正式回货；普通车缝PDA加载保留PCS/FCS读取，避免无关PMS整批初始化。 |
| 真实图片 | 通过 | R57：按现有正式SKU/款式静态图片展示；缩略图与对象对应，高清、关闭、Esc和加载失败提示；后道实收映射5张真实SKU图。截图及imageSHA保留。 |
| 合同打印 | 通过 | R13、R47：由真实分配动作生成的新合同2页，第一页面两节点累计量和数量依据、第二页面三类型规则；无字段截断/遮挡；历史原件不覆盖。浏览器电子预览验收，未验证实体打印机。 |
| 性能门禁 | 通过 | 68家族各5样本，共340个样本，同一最终生产资产下全部≤1000ms，最大932.9ms。原失败不覆盖，来源与终点见性能结论。 |
| 完整差异与需求追踪 | 通过 | 73项矩阵正向绑定源码/契约/页面，反向核对所有运行变更；独立审查无遗留P1/P2。生产单跟踪43行保留独立静态Mock，不声称动态接入所有正式交出。 |
| 外部生产系统 / 数据库 / 消息 / 真实工厂接受 | 不适用 | 本轮仅浏览器本地原型，无真实数据库写入、外部消息、部署或真实用户接受操作。 |

合同模板末次只补“固定单据详情”分类注释，非管理列表；[编译产物比较](../../output/ppic-daily-return/print-classification-evidence.json)确认没有JavaScript变化，保留既有打印/性能证据原身份。

验证工具补充仅涉及R59：`tests/ppic-daily-return.config.ts`与受影响检查路由登记实际19项浏览器测试；共用列表专项在DOM夹具启用后、导入页面前读取显式空快照。[列表专项恢复结果](../../output/ppic-daily-return/list-template-recovery.log)包含真实Chromium拖列、DOM区域与偏好持久检查；未删业务断言或放开产品读取失败。

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/post-finishing-records.ts`
- `src/data/fcs/ppic-daily-return-records.ts`
- `src/data/fcs/ppic-daily-return.ts`
- `src/data/fcs/ppic-return-quantity-basis.ts`
- `src/data/fcs/production-contracts.ts`
- `src/data/fcs/production-return-fulfillment.ts`
- `src/data/fcs/production-return-progress-mock.ts`
- `src/data/fcs/sewing-delivery-receipt-facts.ts`
- `src/data/fcs/sewing-delivery-sla-view.ts`
- `src/data/fcs/sewing-delivery-sla.ts`
- `src/data/fcs/sewing-outsourcing-return-tracking.ts`
- `src/data/fcs/sewing-production-order-duration.ts`
- `src/data/fcs/sewing-return-calendar.ts`
- `src/data/fcs/task-fulfillment-policy.ts`
- `src/data/production-timing/source.ts`
- `src/main.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/pda-handover.ts`
- `src/pages/pda-post-finishing-flow.ts`
- `src/pages/ppic-return-business-time-ui.ts`
- `src/pages/print/templates/production-contract-master-template.ts`
- `src/pages/print/templates/production-contract-template.ts`
- `src/pages/process-factory/post-finishing/warehouse.ts`
- `src/pages/production-fulfillment/order-pages.ts`
- `src/pages/production-fulfillment/production-order-diagrams.ts`
- `src/pages/production-fulfillment/source-document-detail.ts`
- `src/pages/progress-board/task-domain.ts`
- `src/pages/sewing-outsourcing/daily-return-report.ts`
- `src/pages/sewing-outsourcing/daily-return-summary.ts`
- `src/pages/sewing-outsourcing/responsibility-transfers.ts`
- `src/pages/sewing-outsourcing/returns.ts`
- `src/pages/sewing-outsourcing/workbench.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes.ts`

### 页面证据

- 版本：detached HEAD `3e6412f25bd389985ca1a2045280eff2220f622b`及本任务未提交差异；当前产品源码集合SHA256 `521e2acb70b873d2c6e1e731c15bb20df74c2a82935bbee06add89362899838d`，逐文件见[最终源码清单](../../output/ppic-daily-return/final-source-manifest.json)。服务均在本工作树 `/Users/laoer/.codex/worktrees/5f34/higoods`。技术收据在冻结后绑定全部差异，不手填差异哈希。
- 证据：[原子需求矩阵](../product-design/PPIC每日回货跟进与两节点履约调整具体方案-2026-10-14.md#7-原子验收矩阵)。先前dev页面/汇总5项在`127.0.0.1:43381`，先前后道7项和消费者6项保留各自日志与来源哈希；最后5+8+6共19个不同浏览器契约通过；同秒默认读取与.000/.500边界修复已覆盖；当前命名设备Web1366×768/1280×720/1024×768及Chrome模拟PDA390×844。修复后的末轮受影响回放已绑定[末轮后道与消费者14项](../../output/ppic-daily-return/browser-precision-final.log)及[填报汇总5项](../../output/ppic-daily-return/browser-final-replay.log)及[截图目录](../../output/ppic-daily-return/browser-final-artifacts/)。合同原件素材SHA256及两页图在模板源码和消费者日志，未把Mock当真实工厂履约。

### 性能结论

- 结论：通过
- 依据：本地Vite production preview，Chrome149、Asia/Jakarta、回环网络无节流；41填报/汇总家族和7后道家族已各5样本通过，100原承诺/5补回/30成员及95条全量导出。最终共享消费者/剩余动作20家族已完成，冷资源/浏览器进程冷启动/空库首次初始化/刷新/切换分别记录。起点为导航或控件实际事件；终点含正确内容、必要图片、两次绘制及保存后的持久读回；人工填写/阅读不计，原生确认即时应答开销计入。所有原始值及最大值见[填报汇总](../../output/ppic-daily-return/performance.json)、[后道](../../output/ppic-daily-return/receipt-performance.json)、[消费者](../../output/ppic-daily-return/consumer-performance.json)。既有PDA1.67秒超时保留在`consumer-performance-incomplete-1791973597983.json`；CPU采样发现无关PMS整批初始化，已局部修复。后续测量出现波动亦保留完整文件，不删除慢值；最终数值时间与PDA加载修复后68家族全部通过，源码及资产一致；失败记录继续保留。环境资源快照见`resources-before-final-performance.txt`，仅管理本任务自启服务。

### 验证命令

- `npm run build`：通过
- `node --import tsx --test tests/unit/ppic-daily-return.test.ts tests/unit/ppic-daily-return-summary.test.ts`：通过
- `node --import tsx --test tests/unit/sewing-return-two-nodes.test.ts`：通过
- `npx playwright test --config output/ppic-daily-return/browser-final.config.mjs`：通过
- `npx playwright test --config output/ppic-daily-return/browser-final.config.mjs tests/ppic-daily-return-receipts.spec.ts tests/ppic-shared-consumers.spec.ts`：通过
- `node output/ppic-daily-return/performance.mjs`：通过
- `node output/ppic-daily-return/receipt-performance.mjs`：通过
- `node output/ppic-daily-return/consumer-performance.mjs`：通过
- `npm run check:prototype-design-governance -- --scope worktree`：通过
- `npm run check:list-page-governance -- --scope worktree`：通过
- `npm run test:workflow-governance`：通过
- `npm run check:standard-list-page-template`：通过
- `git diff --check`：通过

治理实际运行包含全部变更路径和本记录的显式路径参数，[完整命令及结果](../../output/ppic-daily-return/governance-final-classified.log)保留未缩写清单；本工作树全部差异属于本任务。

最终项目构建920项零失败，适用工程类型与Vite构建通过（原始收据首轮日志保留）；此前915项构建及之后的18项边界/12项节点专项按原日志身份保留，后道8项和消费者6项已在数值时间修复后重放通过；最终技术收据执行工具按改动路由的工程检查；首轮指出三个浏览器测试缺路由及列表夹具未初始化，已登记独立服务配置并修复只读夹具，原始收据[首轮未完成记录](../../output/ppic-daily-return/task-receipt-first-incomplete.json)以独立文件保留，不改状态；[治理契约322项](../../output/ppic-daily-return/workflow-contracts-final.log)通过。[冻结后技术收据](../../output/ppic-daily-return/task-receipt.json)预先登记位置，生成之后不修改本记录以伪造时效性。[补充全库TypeScript诊断](../../output/ppic-daily-return/full-types-frozen.log)退出2，仅有13项PCS/技术包既有诊断，涉及源码均不在本轮差异中，本任务不覆盖无关源码；工程入口/领域/UI/状态门禁由项目构建执行。历史文档两处百分号地址会使全局链接检查抛URIError，任务文档另做范围核对，不改写历史证据消除错误。

### 例外

- 无。性能未通过项保持开放，不以构建或收据替代；真实业务方接受与实体打印机验收另行登记。
