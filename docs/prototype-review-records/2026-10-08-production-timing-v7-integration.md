# 生产单时效监控 V7 正式原型接入审查

## 1. 基本信息

- 日期：2026-10-08；记录模式：完整产品审查。
- 系统：DDS，以及登记单据对应的 PCS / PMS / FCS / WLS；管理端、一线跟单、业务主管及高管在同屏读图。
- 用户依据：本会话确认的业务事实、认可的 V7 图示、除具体单号外其他能一致尽量一致的要求。Mock 不代表实际业务已经发生。
- 工作树：`/Users/laoer/.codex/worktrees/d29f/higoods`；分支 `codex/dds-task-business-review`；基线 HEAD `3ba8e323d12c7cf4f8f524bb908e5d95b8a54417`。开工干净，本次未提交、未合并、未推送。
- 服务：同工作树的 Vite preview，PID 19929、`0.0.0.0:4179`；`lsof -a -p 19929 -d cwd -Fn` 已核实路径。当前资产 `index-DSPY5QtO.js`、`index-BysvPE4E.css`；532 tests / 532 pass / 0 fail。
- 构建HTML SHA256：`f1c7dc5e8b80e9e9415042bfb39da3132c7b922dfb37bdac703ca1ed8d19a898`；PDA专用静态modulepreload在本次导航内发起下载/编译，仍由原hydration控制模块执行，不提前执行业务。
- 基准：认可 V7 文件与 SHA256 见总体设计 §1，固定查看时点 2026-10-07 09:00（北京时间）。当前 20 场景、19 生产单、1 采购待关联、1,761 单据；原19场景的业务事实语义哈希保持不变，独立 SCENE-20 增补交接及不计时历史准备项。
- 设计、计划、106 条原子矩阵：`docs/product-design/production-fulfillment-timeliness/v7-integration-design.md`、`v7-integration-plan.md`、`v7-integration-matrix.csv`。最终状态以矩阵和本记录的剩余门禁为准。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：DDS 主对象由过渡需求任务调整为生产单，默认详情改为认可图示；八入口共用同一事实，图中摘要进入对应原模块详情，涉及合同自然日共享计算和受影响的原页面消费者、继续跟进保存及图片显示。
- 基线：AGENTS.md 第 2、3.1、4、5、7、8 节；用户本会话确认优先于历史发货、星期日排除和系统自动放行口径。

## 3. 自查结论

| 检查项 | 结论 | 当前证据与限制 |
| --- | --- | --- |
| 业务对象与终点 | 通过 | 最早关联采购 +28自然日，全量入成衣仓；不计消费者取消及发货，不猜过渡需求归属 |
| 图示与场景 | 不通过 | 原19场景离线结构/业务归一化无未解释差异；最终20场景已加载/刷新/SPA各5；原设计同宽resize最新授权重试仍被保存权限拒绝，不能宣称像素完全一致 |
| 数量和责任 | 通过 | 同厂200/500不冲抵B-01欠90；600袖片不折成成衣；加工/交接分别记录；47工作行排除两项未启用/变更结束历史项 |
| 单据追溯 | 通过 | 同源登记单据、本页摘要及原模块新浏览器标签；只适配登记详情，不宣称全部原模块原列表已经加单 |
| 三设备与图片 | 通过 | Arc三屏120组最终加载/定位/按钮/Esc/遮罩检查最大90.3ms，无页面横溢、滚动展开保持，截图已逐屏查看；已知缩略/大图/失败态与未知缺图分别记录 |
| 打印 | 通过 | 实际PDF引擎输出25份、5种场景各5；A4横向、数量/合同/历史/影响文本逐份核对；不是实物打印或操作系统打印对话框验收 |
| 跟进持久化 | 不通过 | 普通保存、连续点击去重、读回、刷新及新标签读取已有证据；实际浏览器故障和冲突被审批阻断，专项契约不替代浏览器 |
| 表格查询与导出 | 通过 | 统计/状态图同页过滤已完成3或当前工作逾期11各5；八类CSV真实下载各5、40文件最大367ms，独立校对每张采购28天/原数量/分母/未知/全页范围/无操作列；列宽固定 |
| 统一性能 | 不通过 | 最终已执行图示200加载/100SPA、模块80、三屏120、CSV40及PDA25均≤1000ms；PDA最大884.2ms，旧慢样本全部保留。本轮原生缺日期/已知日期PDA及看板85完整样本≤842.9ms；两个受权限拒绝动作未验，不能关闭总体门禁 |
| 保存失败与旧资料 | 不通过 | 当前读取不写静态种子、只读键/已存在IDB哈希保留；本浏览器旧库为空，不能声称验过非空旧需求资料；真实故障门禁仍缺 |

## 4. 问题标签

- 业务口径冲突
- 对象归属与数量误判
- 图示与单据追溯
- 性能未达标
- 验收审批阻断

## 5. 主要问题与处理

| 问题 | 本次处理 | 剩余门禁 |
| --- | --- | --- |
| 发货终点及需求主键不符 | 仓库终点、生产单独立主键，待关联采购分区；旧DDS任务/示例/发货入口撤下；FCS历史桥接保留 | 最终反向扫描及标签检查按下方证据 |
| V7字段/图形易在接入改写 | 九区域、支线/合同/样衣/数量/影响同屏移植，共用静态来源 | 最新同宽像素审批仍阻断；原19场景离线DOM精确对照不是像素验收 |
| 未启用/变更结束仅有说明无场景 | 仅SCENE-20补未启用调色和变更结束花型两单，无工作时钟，准备已闭；灰色历史区可开摘要/原详情 | 原19场景不修改，不自动推断其他任务适用性 |
| 原详情仍将全量工作显示未知剩余 | 仅同单位应做减完成；未知不填0；受影响原详情按命名路由重放 | 原模块其他记录不是本轮迁移范围 |
| 同厂汇总掩盖具体任务 | 工厂总比例与逐任务30/70/100节点并存，任务编号开该合同摘要 | 不跨任务冲抵 |
| 合同晚达成仍似当前未完成 | 实際达成点、历史晚多久、当前欠0与未来节点分别画 | 不替样衣审批改变回货要求 |
| 新生产单详情未获得壳层正确标签 | 删除旧tasks/examples/teams详情注册，增加orders/pending详情身份；只清掉已撤销DDS界面标签，不动业务资料 | 新增实际控制流专项及冷刷/站内标签验收 |
| 焦点恢复可能挤动页面 | 弹窗进入/恢复焦点均使用preventScroll；初次滚动差异和诊断保留 | Arc三设备按钮/Esc/遮罩各5通过；实际坐标点击保持原滚动，工具自动滚动诊断保留 |
| PDA整域索引重复与无关PMS初始化 | 同一详情一次fresh只读索引、相同请求复用、单任务同投影读取、hydration后并行必要处理器；仅普通TASK-SEW及已确认独立TASKGEN车缝不启动无关全PMS；后者直接使用原详情渲染器与同一runtime单任务查询，不初始化无关全域清单 | 必要事实/QR/权限保留；Arc940件25样本仍为未改记录适用历史证据。本轮DSPY原生缺日期/已知日期及看板85完整样本通过，最大842.9ms；单任务全域枚举契约修复前失败、修复后通过，旧超时/CPU证据不删除 |
| 旧验收脚本仍指向过渡需求和六Tab图 | 移除无package入口的 `scripts/check-dds-task-business-review.mjs`，不按旧采购/发货及存储故障脚本验收新图示 | MIGRATE-001同源码与路由收口追踪 |
| 最新权限重试 | CSV实际下载已解锁且40次内容通过；原61122 resize和127临时配额注入仍拒绝，代码未注入、验收标签已关闭 | UI-011/BASE-003及STORE-005保持已阻塞；PAGE-009已验证 |

## 6. 最终结论

结论：不通过（总体未完成）。本地原型可评审，101条原子需求已验证，5条已阻塞，无已实现待验证行。CONTRACT-005已由当前原生PDA与看板实际页面及性能闭环。独立未关闭条件只有认可原设计同宽像素验收、真实浏览器存储故障/冲突验收；用户报告已改设置后，两动作仍被当前会话保存拒绝直接阻断。设计认可、实现、验证、产品接受及远端发布分别记录；本次未发布。

## 7. 变更覆盖与验证

### 受管文件

- `public/images/production-timing/A01-effect.jpg`
- `public/images/production-timing/A02-effect.jpg`
- `public/images/production-timing/A03-effect.jpg`
- `public/images/production-timing/F02-effect.jpg`
- `public/images/production-timing/material-effect-sources.json`
- `public/images/production-timing/shirt-086-print.jpg`
- `public/images/production-timing/shirt-086.jpg`
- `scripts/check-dds-task-business-review.mjs`
- `scripts/check-sewing-outsourcing-return-fulfillment.ts`
- `src/data/app-shell-config.ts`
- `src/data/fcs/process-mobile-task-binding.ts`
- `src/data/fcs/production-object-overview.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/sewing-delivery-sla.ts`
- `src/data/fcs/sewing-outsourcing-return-tracking.ts`
- `src/data/fcs/sewing-return-calendar.ts`
- `src/data/production-timing/fixtures.json`
- `src/data/production-timing/material-images.ts`
- `src/data/production-timing/source.ts`
- `src/main.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/production-fulfillment/boundary-evidence.ts`
- `src/pages/production-fulfillment/calculations.ts`
- `src/pages/production-fulfillment/catalog.ts`
- `src/pages/production-fulfillment/common.ts`
- `src/pages/production-fulfillment/config-model.ts`
- `src/pages/production-fulfillment/configuration.ts`
- `src/pages/production-fulfillment/dashboards.ts`
- `src/pages/production-fulfillment/data-issues.ts`
- `src/pages/production-fulfillment/dependency-graph.ts`
- `src/pages/production-fulfillment/events.ts`
- `src/pages/production-fulfillment/evidence.ts`
- `src/pages/production-fulfillment/examples.ts`
- `src/pages/production-fulfillment/fixtures.ts`
- `src/pages/production-fulfillment/index.ts`
- `src/pages/production-fulfillment/material-image-view.ts`
- `src/pages/production-fulfillment/mock-data.json`
- `src/pages/production-fulfillment/model.ts`
- `src/pages/production-fulfillment/order-pages.css`
- `src/pages/production-fulfillment/order-pages.ts`
- `src/pages/production-fulfillment/production-order-diagrams.css`
- `src/pages/production-fulfillment/production-order-diagrams.ts`
- `src/pages/production-fulfillment/rule-recalculation.ts`
- `src/pages/production-fulfillment/scenarios.ts`
- `src/pages/production-fulfillment/source-document-detail.ts`
- `src/pages/production-fulfillment/source-document-facts.ts`
- `src/pages/production-fulfillment/source-tasks.ts`
- `src/pages/production-fulfillment/source-views.css`
- `src/pages/production-fulfillment/source-views.ts`
- `src/pages/production-fulfillment/task-detail.ts`
- `src/pages/production-fulfillment/task-overview.ts`
- `src/pages/production-fulfillment/tasks.ts`
- `src/pages/production-fulfillment/timeline.ts`
- `src/pages/production-fulfillment/timing-followups.ts`
- `src/pages/production-fulfillment/ui-state.ts`
- `src/pages/production-fulfillment/work-labels.ts`
- `src/pages/progress-board/task-domain.ts`
- `src/pages/sewing-outsourcing/returns.ts`
- `src/router/routes.ts`
- `src/state/store.ts`
- `tests/unit/pda-sewing-detail-canonical-task.test.ts`
- `tests/unit/pda-sewing-route-preload.test.ts`
- `tests/unit/ppic-counting-calendar.test.ts`
- `tests/unit/production-fulfillment-boundary-evidence.test.ts`
- `tests/unit/production-fulfillment-calculations.test.ts`
- `tests/unit/production-fulfillment-configuration.test.ts`
- `tests/unit/production-fulfillment-data-issues.test.ts`
- `tests/unit/production-fulfillment-dependencies.test.ts`
- `tests/unit/production-fulfillment-project-definition.test.ts`
- `tests/unit/production-fulfillment-source-entry-relations.test.ts`
- `tests/unit/production-fulfillment-sources.test.ts`
- `tests/unit/production-fulfillment-task-rule-mappings.test.ts`
- `tests/unit/production-timing-followups.test.ts`
- `tests/unit/production-timing-scenarios.test.ts`
- `tests/unit/production-timing-source-detail.test.ts`
- `tests/unit/production-timing-tabs.test.ts`
- `tests/unit/sewing-return-business-start.test.ts`
- `vite.config.ts`
- `src/data/fcs/warehouse-material-execution.ts`
- `src/data/fcs/pda-handover-events.ts`
- `tests/unit/sewing-missing-business-date-demo.test.ts`

### 页面路由

- `/dds/supply-chain/production-fulfillment/overview`
- `/dds/supply-chain/production-fulfillment/orders`
- `/dds/supply-chain/production-fulfillment/orders/PO-202610-0086`
- `/dds/supply-chain/production-fulfillment/pending-purchases`
- `/dds/supply-chain/production-fulfillment/follow-up`
- `/dds/supply-chain/production-fulfillment/work-items`
- `/dds/supply-chain/production-fulfillment/teams`
- `/dds/supply-chain/production-fulfillment/inbound-analysis`
- `/dds/supply-chain/production-fulfillment/configuration`
- 已登记PCS/PMS/FCS/WLS原详情家族、`/fcs/pda/exec/TASK-SEW-000513-F090-3`、原回货列表/进度看板；各具体路径在对应原始JSON中。

### 验证命令

- `npm run build`：通过，532 tests / 532 pass / 0 fail，工程入口/指定渐进类型范围通过；3个范围外既有全量类型错误仍登记，日志 `production-timing-v7-evidence/final-build.log`。
- `node --import tsx --test tests/unit/production-timing-tabs.test.ts`：通过，2项；新路由正确标签、旧地址不注册、DDS存量界面标签筛除且其它系统/原输入不变。
- `node --import tsx --test tests/unit/pda-sewing-detail-canonical-task.test.ts tests/unit/sewing-return-business-start.test.ts`：通过；本轮四文件15专项均通过，另含缺日期静态场景与预加载契约；PMS范围、hydration/handlers顺序、单任务与完整投影/权限、只读索引；生成任务带query的结论为源码核查，不冒充新增专项。
- `git diff --check`：通过；本轮最后源码变更后的DSPY页面证据已生成，原图示/Mock/CSS未改。
- `codegraph sync`、`status --json`：通过，同工作树、pending0；本轮最后源码变更后的pending0、worktreeMismatch=null已保存missing-date-codegraph-final.json，技术收据再记录。
- `npm run check:prototype-design-governance -- --all`：通过，51用户可见文件、0伪内部改动、1关联审查记录；原日志 `prototype-governance-final.log`。
- `npm run check:list-page-governance`：通过，扫描560页/12历史基线，标准组件列顺序验证通过；上次静态检查无法识别common.ts实际三组件调用，补注释后闭环。没有改检查脚本、加空导入或伪造组件调用，实际调用已由主代理核对。日志 `list-governance-final.log`；旧失败保留 `workflow-before-list-callpath.log`。
- `npm run workflow:verify -- --paths <全部明确任务路径> --output .tmp-timing-v7-final-receipt.json --task-boundary <本轮范围>`：通过，本轮冻结前487个明确任务文件、5个检查退出码均0、技术状态verified。命令结果写回后将再次冻结收据，最终文件数/hash以根目录临时收据为准；原始通过回执workflow-missing-date-before-final-result-binding.json/.log保留。技术收据不关闭同宽像素和127存储故障两项受权限拒绝的浏览器门禁。

### 真实图片验证

款式蓝白衬衫图片复用PCS已有同款静态实图，不是新生成的工厂实物；主图SHA256 `b5b19d31c1a663eb437cf18fb4353e52804749b0b1d0bcbec83727e93425517e`。F01复用PCS白坯布示意，蓝底/花型是目标，不冒充已染成原料。F02捆条布、A01纽扣、A02衬布、A03织标由内置imagegen生成并明确Mock效果图，不能补真实规格。四次完整提示词与调用结果见 `production-timing-v7-evidence/image-generation-prompts.json`，资源/hash见 `public/images/production-timing/material-effect-sources.json`。188px `shirt-086-print.jpg`为同图打印尺寸派生，仅减小PDF字节体积。

正常缩略图与大图、F02摘要/原详情加载失败各5次已有JSON；失败明示对象与恢复入口，没有替换为无关物料。未知SPU保留明确缺图，未拿通用衬衫冒充真实款式；图示内主链保持认可V7布局，物料图在单据摘要和原详情查看。

### 存储范围与登记

- 静态业务对象：20场景/1761登记单据/照片资源；图示/列表/摘要/原详情均只读静态来源，不首访批量落盘。
- 用户跟进：已有 `higood-dds-followups` 的followups/forecasts/forecast-events，新增保存使用同一事务complete后读回，稳定操作ID去重；本轮不填写forecast第二套事实。
- 界面偏好：已有 `higood-tabs`、`sidebar-collapsed` 和表格列/分页少量偏好，异常使用默认；本轮只有DDS撤销界面标签筛除，业务数据/附件/旧需求归属不删、不迁移、不猜关联。
- 旧DDS来源绑定/配置/资料事项保存入口移除；旧键保留。`migrateLegacyFollowups`为未调用的历史显式接口，本轮没有触发。
- `storage-read-preservation-final.json`只读核对两旧键及已存在库的记录数/hash：该origin旧键缺失、三store为空，5次刷新无业务变化；不能据此证明非空旧数据场景已通过。普通保存/读回/独立标签读取与故障专项分别引用，不代替真实故障模拟。
- 未连接测试站数据库，无数据库写入、业务迁移、旧源清理或PCS本地维护工具新增。

### 原始证据与前后追踪

所有证据位于 `docs/prototype-review-records/production-timing-v7-evidence/`。原VIsb、0Tz、DPSy批次、打印/跟进/PDA失败和工具选择器错误全部保留；每个JSON注明实际资产/条件。最终追加仅关闭其直接证明的原子需求，详见矩阵；全量逐条正向与反向审查在最终增量记录。

### 例外

- 无性能或图片门禁豁免。CSV已经实际通过；原设计同宽和浏览器故障两次拒绝不算通过。原PDA缺日期当前实际85样本已验证；两个受权限拒绝动作保留已阻塞，不自动豁免。
- 原模块全列表接入、全站数据迁移、其他工艺初始化性能不在本轮范围；不对范围外源码顺手重写。

### 当前版本补充回执

- 最终Arc图示200冷/刷最大442.8ms、100SPA最大30.4ms、八模块80最大290.4ms；真实三设备120组最大90.3ms。原默认viewport观察独立保存，不作为标准屏证据。
- CSV40真实文件最大367ms；导出1筛选/20全部对象（19生产单＋独立待关联1）/959工作/29任务，5次文件字节一致；每笔采购准确时刻加28天与工厂实领/后道实收逐项核对。
- 图示返回和列表范围5组、总览同页下钻各5、旧DDS需求地址5次显示已移除。生产需求桥接在FCS保留，没有顺手删除其它模块。
- 原PDA最终25/25通过、最大884.2ms，实际扫码图/940件/工厂/日期/权限保持，开工弹窗均取消。CONTRACT-005当前复用一条原生静态任务并已实际PDA/看板验证，新增85样本见下方本轮回执。
- 两项自动审批最新拒绝的具体origin/action/reason及未注入事实见permission-retry-latest.json；原V7服务恢复原文件字节，未复制基准或更换浏览器绕过。
- 106条需求正向追踪、81运行/测试路径反向追踪、原19场景与额外SCENE20同源记录核查见final-source-review.json；当前101已验证/5已阻塞/无已实现待验证。VERIFY-003只表示审查完成，VERIFY-001/002保持总体阻塞。

### 本轮关闭缺日期验收回执

- 原生缺日期800件任务复用既有 TASKGEN-202603-0007-002__ORDER，静态登记而不首访落盘。DSPY5QtO 最后源码变更后，PDA冷5/刷5/列表进入5、已知日期PDA冷5/刷5，两任务看板列表/详情各冷5/刷5、进度Tab各5、列表进详情各5，合计85完整原始样本全部≤1000ms，最大842.9ms。缺日期显示待核实，不以空节点判完成，不把分配量当实领或计划单当已交出；已知日期仍为07-04/08/09截止。详见 missing-date-acceptance-final.json 及6份原始JSON。
- 本轮完整构建532/532通过；15专项通过；故障回归先红后绿日志保留。最后源码变更后的版本为 `index-DSPY5QtO.js`，HTML SHA256 `f1c7dc5e8b80e9e9415042bfb39da3132c7b922dfb37bdac703ca1ed8d19a898`。
- 源码审查见missing-date-source-audit-final.json：PDA既有认证/工厂检查/完整query解释和必需资料/处理器顺序保持。禁用、合并、未知任务保留旧回退边界，由源码确认，未新增独立的这三类专项。
- 原生旧已知日期任务中HDO-SLA-DELAY-DEMO-001的420件为PDA交接Mock；正式后道实收没有对应确认记录。本轮只验证日期分支，不将二者视为同一事实，不新造正式实收。本条CONTRACT-005不代表全旧PDA数量闭环已经完成。
- 用户报告设置已解除限制且CDP开启后，两动作实际重试仍被拒绝。只读核查确认全局 full_cdp_access_enabled=true，而当前会话 full_cdp.denied 仍包含 localhost:61122 和 127.0.0.1:4179；会话拒绝优先于全局允许。当前安装版本没有找到核实有效的会话重置UI，不能承诺重启可解决。不修改权限文件、不换origin/浏览器/复制基准绕过，故障钩子未安装。具体原始拒绝与诊断见 permission-after-user-settings.json、permission-conversation-diagnosis.json。
- 最终计时探针已停止，缓存及viewport覆盖已撤销，浏览器返回PO-202610-0089图示；没有提交开工、回货、收货或催办。
