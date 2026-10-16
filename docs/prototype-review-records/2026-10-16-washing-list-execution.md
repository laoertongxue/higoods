# 洗水列表直接办理

依据：[AGENTS.md](../../AGENTS.md) 的 SCOPE-02、REVIEW-01、UI-01、STORE-02、PERF-01、EVIDENCE-01。

## 基本信息

- 日期：2026-10-16
- 任务 / 需求编号：WASH-303～WASH-310
- 验证人：Codex 主代理；产品接受由用户确认

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：T3。Web 洗水加工单列表的操作栏按可操作实物卷提供逐卷实收、投入洗水、登记实际产出、交回原接收方四个入口。继承 d689e384 的独立弹窗、GTG、原下游、数量、日志和原子保存规则。本轮不提交或发布。

## 范围、计划与直接影响

列表操作栏保留查看，同时按卷的实际进度显示可用办理动作。一张单中不同卷处于不同阶段时可以同时显示多个动作；已完成、作废或异常单不提供这四个动作。弹窗只显示当前单、当前操作可办理的卷，复用详情页相同字段与提交命令。保存成功留在列表，局部更新记录、统计和分页，保留查询条件、列设置和滚动容器；当前状态筛选不再匹配时移出结果并明确保存结果。取消不写数据，失败保留输入，关闭后可恢复焦点，过期单据不可覆盖最新事实。

直接写入入口仍为 submitWashingCommand：原同源 IndexedDB 的洗水单、明细、动作和必要工厂实物关联共同保存。静态源、对象仓库、版本、迁移、附件及业务模型不变；新增的只是列表调用入口。直接消费者为列表、详情、PDA、交接、日志和现有打印。PDA 列表卡片不增加四项按钮；详情和 PDA 原入口保留。既有打印映射、备份和迁移不变，复用 d689e384 的原版本证据，不再全套复测。

顺序：复用可操作卷推导添加行按钮 → 行身份接入现有弹窗 → 保存后局部更新及焦点 → 专项浏览器契约与失败恢复 → 固定构建后的页面和五次性能验证 → 最终差异审查与技术收据。

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / PDA / 打印 / 性能证据或不适用理由 | 状态 | 证据位置 | 确认人和确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WASH-303 | 用户本轮 | 列表操作栏直接打开四项办理弹窗，保留查看 | 列表 | work-orders.ts/renderWashingListActions、handleFabricWashingEvent | 专项浏览器 | Web 列表 | 已验证 | ../verification-evidence/2026-10-16-washing-list-execution/final-report.json | Codex；d689e384 + 0ef6b23210cb |
| WASH-304 | 用户本轮 | 只按本单当前可办理的卷显示动作，支持混合阶段 | 状态 | renderWashingListActions → washingExecutionRolls | 专项浏览器 | 正常、混合、结束与异常 | 已验证 | 同上 | 同上 |
| WASH-305 | 继承弹窗 | 字段及卷范围与详情一致，不把其他单或阶段混入 | 表单 | handleFabricWashingEvent → openWashingExecutionDialog | 专项浏览器 / 人工页面 | Web、详情相邻回归 | 已验证 | 同上、manual-ui-proof.json | 同上 |
| WASH-306 | UI-01 | 保存留在列表，局部刷新并保留条件、分页、列设置和焦点 | 结果 | refreshWashingListResults | 专项浏览器 | 状态筛选移出、页码夹取 | 已验证 | final-report.json | 同上 |
| WASH-307 | STORE-02 | 取消不写，失败保留，冲突不覆盖，重试不重复 | 恢复 | save、列表 submit 回调、原命令及事务 | 原生持久回读 / 事务中止 | 隔离原生 IndexedDB | 已验证 | final-report.json | 同上 |
| WASH-308 | 直接影响 | 持久化、详情、PDA、日志、交接读取列表办理事实 | 消费 | 原 submitWashingCommand 及记录读取 | 专项浏览器 | 打印映射未变，原证据复用 | 已验证 | final-report.json、d689e384 原证据 | 同上 |
| WASH-309 | UI-01 / IMAGE-01 | 列表操作与弹窗在命名 Web 视口可见可用，图片对应 | 页面 | renderWashingListActions、原生 dialog | 专项浏览器 / 截图复核 | 1366×768、1280×720、1024×768 | 已验证 | list-*.png、list-four-actions.jpg、list-output-dialog.jpg | 同上 |
| WASH-310 | PERF-01 / REVIEW-01 | 受影响操作五次完整响应不超 1 秒，记录差异与检查收据 | 验证 | check-washing-detail-tabs.mjs / list 分支、记录及最终收据 | 五次 / 家族；收据单独输出 | 固定生产预览 | 已验证 | final-report.json、raw-samples.jsonl；收据实际状态另记 delivery.json | 同上 |

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 列表操作、状态、卷范围 | 通过 | 四项操作按可办理卷显示；混合状态同时提供多个动作，已完成 / 作废 / 异常 / 未派厂不提供。20 单规模及六卷操作通过。 |
| 数量、保存及直接回读 | 通过 | 列表连续实收 300、产出 294、交回 294 Yard；刷新及详情日志 / 交接读回一致。共享按钮状态恢复另由 PDA 原实收保存 300 Yard 和刷新回读验证。 |
| 取消、失败、冲突和焦点 | 通过 | 取消不写，原生事务中止无半套，表单和禁用分页状态保留；真实重试只有一条实收动作。并发旧表单和旧按钮不可覆盖对方。 |
| 查询、分页、列与局部更新 | 通过 | 实收后移出当前状态筛选，最后一页归位；已填写条件、列显示 / 顺序 / 冻结保留。列表、查询卡片、表头和实际滚动容器 DOM 身份保留，横向滚动 300px 不变；保存后焦点到行操作或结果。 |
| 页面及图片 | 通过 | 三种 Web 视口无主体横向溢出，操作列固定右侧，按钮高度至少 40px；弹窗脚部可见，图片大图 / Esc 与焦点恢复通过。图片对应 FAB-P200-BLUE-FLORAL 与 SPU-2024-009 的原正式素材；已人工看图复核。 |
| 性能 | 通过 | 23 个家族各 5 次，共 115 个有效样本，最大 437.1001ms，超时 0，页面异常 0。 |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/dyeing/washing/work-orders.ts`

### 页面证据

- 版本：codex/post-print-fabric-washing，基准 d689e38429ad483a6bb9c8c2518ee012e50fc16d；工作树 /Users/laoer/.codex/worktrees/a266/higoods；固定生产预览 http://127.0.0.1:43162；产物 output/washing-list-execution/dist，1179 文件哈希由 report 保存。源码 / 检查依赖摘要 0ef6b23210cbd3f8686cc550798fd044bdcb766cadf0e3ca40ee9837c0db8844，见 source-manifest.json。
- 证据：[本轮证据目录](../verification-evidence/2026-10-16-washing-list-execution/)，final-report.json、raw-samples.jsonl、三种 Web 列表与 1024 弹窗截图，以及人工列表四项动作 / 产出弹窗截图。路由 /fcs/craft/dyeing/washing/work-orders，直接回读 /:id 和 /fcs/pda/washing/:id。人工演示单 WS-20261016-FD2D6F48 经原生业务操作形成 2 卷待实收、1 卷待投入、1 卷待产出、1 卷待交回、1 卷已交回；列表四按钮及产出弹窗仅含当前可产出的 WS-1-R3。刷新后四动作仍在，关闭弹窗无执行输入、控制台错误为 0。

### 性能结论

- 结论：通过
- 依据：final-report.json，23 家族 × 5 次 = 115 个样本，最大 437.1001ms。冷加载、刷新、站内进入、查询 / 重置 / 页大小 / 翻页 / 排序、四项打开、三项保存与实收失败重试、取消、过期表单 / 按钮、筛选移出和页码夹取分别记录。四项操作的最重代表为每单六卷；显示规模为 20 单共 120 卷，分页 10 / 20 条；最后一页退出分支为 11 单。规模夹具包含 1 张原生业务链及 19 张明确的只读状态 / 规模单，不冒称来源均经现场创建。起点为真实原生输入 / 导航，终点包含可用结果、必要图片、字体、两帧及保存后的原生持久读回。浏览器、时区、Node、机器负载及固定产物哈希均在原报告。

### 验证命令

- `npm exec vite -- build --outDir output/washing-list-execution/dist`：通过
- `WASH_TAB_SECTION=list WASH_TAB_RUNS=5 WASH_TAB_FORMAL=1 WASH_TAB_OUT=output/playwright/washing-list-execution/formal WASH_RUNTIME_ASSETS=output/washing-list-execution/runtime-assets.json WASH_BASE_URL=http://127.0.0.1:43162 node scripts/check-washing-detail-tabs.mjs`：通过
- `git diff --check`：通过

### 例外

- 无。未修改的数据模型、打印渲染、附件、迁移和备份保留原证据身份；本轮列表入口的保存及直接回读另验。

最终技术收据在任务文件冻结后写入 output/washing-list-execution/task-receipt.json，交付状态单独登记，不回写本绑定记录。

## 最终差异审查及采集校准

主代理正向核对四个入口、各自可操作卷、共用字段和原命令；反向核对仅 work-orders.ts 改变产品行为，execution-dialog.ts、模型、事务和打印渲染器未改，不新增业务存储或权限体系。列表的操作身份只来自该行，打开前强制读取持久记录，提交再核对打开时版本；旧入口不能绕过步骤。保存后只替换表体、统计、分页、标题及状态选项，保留列表壳、查询输入、表头、滚动和偏好。保存过程中保留各按钮原禁用状态，失败不把禁用分页错误启用。原有详情及 PDA 办理入口仍调用同一保存逻辑并已回归。

校准中的问题属于采集夹具 / 选择器：混合状态记录在另一分页，随机业务 ID 导致夹具排序不确定，误选了外层而非真实滚动容器，以及 about:blank 的初始化脚本不能访问 localStorage。已分别显式切换页大小、固定只读规模记录的排序身份、使用 data-standard-list-scroll，以及只在 HTTP 文档初始化偏好；后者另做最小验证。原始校准日志保留，正式批次在这些问题修正后运行；没有删除有效慢样本或修改产品逻辑迎合采集器。
