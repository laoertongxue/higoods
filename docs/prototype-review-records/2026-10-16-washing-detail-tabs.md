# 洗水加工单详情分视图调整

依据：[AGENTS.md](../../AGENTS.md) 的 SCOPE-02、TRACE-01、UI-01、REVIEW-01、PERF-01、EVIDENCE-01 和 RECEIPT-01。本次属于详情页交互调整，按 T3 验证；继承的业务边界见下文。

## 基本信息

- 日期：2026-10-16
- 任务 / 需求编号：WASH-270～WASH-280
- 验证人：Codex 主代理（技术验证；用户接受另行确认）

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：用户指出详情将七组列表字段铺成大卡片，要求按 Tab 展示不同视图。本次调整 Web 详情的信息分组和局部切换，保留原执行、交接、日志、打印及 PDA 权限事实。

## 范围、继承与实施计划

继承 V1.3 已确认业务：实际印花完成后触摸决定是否洗水，按目标手感建单，GTG 承接、原下游不丢失、实际路线与追溯保持；助剂与配比在线下处理。替代 V1.3 详情页七块平铺的展示方式，列表七组列不变。本次不提交、不合并、不发布。

实施顺序：1. 紧凑单据摘要；2. 加工执行、基本信息、交接记录、操作日志、打印五个视图，默认加工执行；3. 切换仅隐藏/显示本地面板，保留填写与扫码；4. 验证直接入口、保存回读、Web 三种桌面尺寸及共享 PDA；5. 固定构建测量、最终差异审查和技术收据。

业务对象和持久化边界：洗水单、实物卷、操作记录继续读取既有 IndexedDB 仓库；不新增写入字段、存储键、迁移或业务副本。Tab 选择只属于当前详情 DOM。打开只读 Tab 不执行保存或登记打印。

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / PDA / 打印 / 性能证据或不适用理由 | 状态 | 证据位置 | 确认人和确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WASH-270 | 本次用户指正 | Web 详情使用五个职责清楚的 Tab，默认加工执行。 | 展示 | detail-views.ts；work-orders.ts/detailContent | 专项浏览器检查 | Web 1366、1280、1024；PDA 保留原任务视图并通过接单回读 | 已验证 | ../verification-evidence/2026-10-16-washing-detail-tabs/final-report.json | Codex；15ba48c6 + b8fe106f65ef |
| WASH-271 | 首屏任务 | 摘要展示单号、状态、面料、手感及真实流向，主要可用动作在执行区顶部。 | 展示 | detail-views.ts；work-orders.ts/detailContent | 专项浏览器检查 | 待承接、待接单、部分完成、已完成单均通过 | 已验证 | ../verification-evidence/2026-10-16-washing-detail-tabs/final-report.json | Codex；15ba48c6 + b8fe106f65ef |
| WASH-272 | 原业务信息继承 | 基本信息完整保留商品、来源、面料属性、加工要求和上下游关联。 | 展示 | detail-views.ts | 专项浏览器检查 | 不再平铺七个等高大卡片 | 已验证 | ../verification-evidence/2026-10-16-washing-detail-tabs/final-report.json | Codex；15ba48c6 + b8fe106f65ef |
| WASH-273 | 原交接事实继承 | 交接视图展示逐卷实交、实收、去向、数量和发生时间。 | 展示 | detail-views.ts | 专项浏览器检查 | 无交接时明确尚未发生 | 已验证 | ../verification-evidence/2026-10-16-washing-detail-tabs/final-report.json | Codex；15ba48c6 + b8fe106f65ef |
| WASH-274 | 原日志继承 | 操作日志保留动作、人员、时间、卷码与原因。 | 展示 | detail-views.ts | 专项浏览器检查 | 发起记录及后续动作可查 | 已验证 | ../verification-evidence/2026-10-16-washing-detail-tabs/final-report.json | Codex；15ba48c6 + b8fe106f65ef |
| WASH-275 | 原打印继承 | 打印视图保留两类预览、面料图、真实卷码及打印入口。 | 展示 | work-orders.ts/renderWashingPrint | 专项浏览器检查 | 打开 Tab 不登记打印，预览动作沿用原保存 | 已验证 | ../verification-evidence/2026-10-16-washing-detail-tabs/final-report.json | Codex；15ba48c6 + b8fe106f65ef |
| WASH-276 | UI-01、STORE-02 | 切换 Tab 不重建执行 DOM，不丢数量、选卷、库位、扫码和未确认原因。 | 交互 | detail-views.ts/switchWashingDetailTab | 专项浏览器检查 | 双向切换与确认区验证 | 已验证 | ../verification-evidence/2026-10-16-washing-detail-tabs/final-report.json | Codex；15ba48c6 + b8fe106f65ef |
| WASH-277 | UI-01 | Tab 有可理解名称、选中状态、面板关联及方向键、Home、End 操作。 | 交互 | detail-views.ts | 专项浏览器检查 | 焦点、键盘和小屏可读性 | 已验证 | ../verification-evidence/2026-10-16-washing-detail-tabs/final-report.json | Codex；15ba48c6 + b8fe106f65ef |
| WASH-278 | STORE-02、直接上下游 | 成功保存后保留当前视图并回读，失败不丢输入、不假成功；直达和刷新独立可读。 | 集成 | work-orders.ts/refresh、save | 专项浏览器检查 | 不改领域命令、GTG、印花、技术包和仓库事实 | 已验证 | ../verification-evidence/2026-10-16-washing-detail-tabs/final-report.json | Codex；15ba48c6 + b8fe106f65ef |
| WASH-279 | UI-01、IMAGE-01 | Web 无主体横向溢出，面料图可放大关闭，PDA 执行不回归。 | 设备 | detail-views.ts；work-orders.ts | 专项浏览器检查 | 1366×768、1280×720、1024×768；PDA 390×844 | 已验证 | ../verification-evidence/2026-10-16-washing-detail-tabs/final-report.json | Codex；15ba48c6 + b8fe106f65ef |
| WASH-280 | PERF-01、REVIEW-01 | 适用加载与 Tab 交互各家族五次完整响应 ≤1000ms，完成差异审查。 | 验证 | 本轮专项脚本与记录 | 固定产物验收、治理、技术收据 | 含图片、字体和绘制，保存还含持久回读 | 已验证 | ../verification-evidence/2026-10-16-washing-detail-tabs/final-report.json | Codex；15ba48c6 + b8fe106f65ef |

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 信息分组与首屏操作 | 通过 | 默认加工执行，5 个关联面板；主操作在首屏，未再平铺七组大卡。三种 Web 尺寸、待接单、历史待承接、部分完成、已完成单通过；见 final-report.json 和 execution-1366.jpg。 |
| 交互、保存及直接上下游 | 通过 | 切换保留同一个执行 DOM、数量、选卷、库位、扫码、重包码和未提交原因；错误输入不写实物事实；成功保存、刷新与直达回读一致。新窗口入口、两张不同手感单、GTG 接单拒单再派、实际路线、原工厂与中央仓两条完整闭环通过；见 final-report.json、upstream-downstream-report.json。 |
| 设备、图片与打印 | 通过 | Web 1366×768、1280×720、1024×768 主体无横向溢出；交接表在自身容器滚动；面料和商品对应原有正式图片，大图可打开及 Esc 关闭。PDA 390×844 接单并回读通过；两类打印预览、真实条码与去向通过。见 base-1280.png、handover-1280.png、PDA-390.png、print-transfer.png。原图片加载失败处理、打印纸面映射函数未改，沿用 V1.3 原证据身份。 |
| 性能与完整差异审查 | 通过 | 20 家族各 5 样本，共 100 个，最大 325.5ms，无超时或页面异常；最重代表为同单 6 卷。两轮主代理审查见下文。 |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/dyeing/washing/detail-views.ts`
- `src/pages/process-factory/dyeing/washing/work-orders.ts`

### 页面证据

- 版本：codex/post-print-fabric-washing；HEAD 15ba48c625157d58fec75f340466bd83938e99ed；工作树 /Users/laoer/.codex/worktrees/a266/higoods；4 个实现及验证脚本的组合摘要 b8fe106f65efbf5df106fbfaa39c81ad038871f694d39ae3e6d31079a03ad0f7，详见 source-manifest.json；固定 Vite 构建预览 http://127.0.0.1:43159，服务 index.html 与记录的运行产物 SHA256 相同。
- 证据：[本轮证据目录](../verification-evidence/2026-10-16-washing-detail-tabs/)；路由 /fcs/craft/dyeing/washing/work-orders/:id；真实本地单 WS-20261015-2783B509，6 卷 300 Yard 的首屏见 execution-1366.jpg。隔离上下文从真实印花入口建出 6 卷有效单，再以原生 IndexedDB 复制到新的验收上下文，未读取或清理用户浏览器数据；部分实物完成、旧单及完整闭环分别记录。运行资产、环境、源码哈希和全部原始样本均在 final-report.json。原用户截图保留为 user-reported-before.png。

### 性能结论

- 结论：通过
- 依据：[正式报告](../verification-evidence/2026-10-16-washing-detail-tabs/final-report.json)；20 家族各 5 次，共 100 个样本，最大 325.5ms。起点为 navigationStart 或真实 pointer/key/input/change，终点包含正确内容、可交互、可见图片、字体和两帧绘制；保存包含 IndexedDB 事务结束后的原生回读。新建隔离上下文的冷直达、刷新、五个 Tab、键盘、接单、六类实物流转保存、输入差错、两种打印、PDA 登录后直达和接单分别登记。Web 相同模板/规模的设备差异另作功能与布局核验；不把登录后 PDA 导航冒称浏览器冷启动。

### 验证命令

- `WASH_TAB_RUNS=5 WASH_TAB_FORMAL=1 WASH_BASE_URL=http://127.0.0.1:43159 node scripts/check-washing-detail-tabs.mjs`：通过
- `WASH_UI_RUNS=1 WASH_UI_SECTION=main WASH_UI_OUT=output/washing-detail-tabs/upstream-downstream WASH_RUNTIME_ASSETS=output/washing-detail-tabs/runtime-assets.json WASH_BASE_URL=http://127.0.0.1:43159 node scripts/check-washing-gtg-ui.mjs`：通过
- `npm exec vite -- build`：通过
- `git diff --check`：通过

### 例外

- 无。本次按详情页实际影响验证，业务、存储与设备规则沿用已确认范围，没有申请性能或验证门禁豁免。


## 直接上下游影响核查

- 印花来源和发起入口：仍由真实印花完成实物触摸判断创建，固定 GTG、三种手感、部分分单、新窗口追溯均未改。完整回放创建 3 单（其中同印花来源分两种手感），印花日志、GTG 下游筛选与导出继续正确。
- 技术包与生产单：仍按实际洗水单反映执行路线，源技术版本、生产快照、其他技术版本隔离均通过；本次未改路线或拆解规则。
- 染厂与原下游：原工厂和面料中央仓两条交接分别完成 50→49→49 Yard、人工完单及刷新回读；执行 Tab 仅承载原命令，权限、扫码校验、数量及库位事实不变。
- 列表和仓库：列表七组列、工厂投影、仓库数量读写均未改；没有新增快照、迁移、存储键、助剂或配比。共享 PDA 保留任务视图；新桌面 Tab 不进入 PDA。
- 打印：切换到打印 Tab 不写 PRINT，点击预览才沿用既有原子保存；预览后局部更新日志及旧版提示，不重建执行输入。原渲染及纸面输出函数未改；本轮重放两种预览、原工厂/中央仓、面料图和真实条码。

## 两轮主代理审查

第一轮从用户截图和字段逐项反查：删去七组大卡平铺、去掉面料重复展示，将来源/商品、手感、上下游、逐卷时点、动作人员和预览分别放入对应视图；主动作前移。审查发现改写消息区时遗漏原迁移异常警示，已抽出同一提示函数并在详情与原判断入口复用；保留故障事实，不静默掩盖。修正后重新构建并完整采样。最初两次校准错误均来自验收脚本过早读取异步 Tab 状态及旧成功提示，分别改为等待选中状态和具体动作的持久结果；失败日志与原报告保留，没有据此误改业务逻辑。

第二轮从变更反向核查需求边界：两处运行文件只涉及详情分组、局部隐藏、键盘焦点、动作位置、日志及提示刷新；未改领域命令、路由身份、GTG、技术包、生产拆解、列表七列、仓库事实或存储事务。校验所有隐藏面板仍在同一单据下、执行输入 DOM 不重建、Tab 不写业务、打印不丢执行草稿；错误提示处于所有视图之外，任何视图都可见。4 个实现/脚本文件摘要与正式报告一致，无无关差异。

最终技术门禁与收据在绑定文件冻结后执行，输出到 `output/washing-detail-tabs/task-receipt.json`；其实际状态和完整构建结果在交付回复报告，不修改本记录以冒称收据已运行。聚合工具仍要求重复完整构建（包含类型检查和单测），属于工具门禁范围，不扩大本次业务验收。用户接受与发布状态均不由本记录代填。
