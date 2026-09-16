# 简易裁片交出下游接收与交出台账审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-16 |
| 相关需求 / 任务 | 任务单打印与简易裁片交出，WP05 下游读取与旧入口收口 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PFOS / FCS / PDA |
| 工作树 | `/Users/laoer/.codex/worktrees/ec9a/higoods` |
| 分支与基线 | `codex/task-sheets-simple-cut-piece-handover-20260916` / `1749a918e1e65bde6dd0285491f5d6b3cb915f8f`，验收包含未提交的本任务改动 |
| 验收服务 | `http://127.0.0.1:4174`，同工作树 Vite 服务 |
| 端类型 | 仓储管理 / 工厂员工 PDA |
| 主要角色与任务 | 仓库查看交出事实；工厂查看仓库已经确认的裁片接收历史 |
| 验收执行人 | Codex；产品业务口径来自本次用户确认，未冒充用户完成现场接受 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：交出台账、工厂接收历史、数量与旧裁片入口的可见行为改变。
- 交出单列表增加简易交出记录、任务单/PPIC/方式/数量字段及标准查询、统计、导出、分页和列设置。
- 工厂存在简易裁片接收事实时显示“接收记录”页签，独立于“待接收”；详情直接显示已接收，不出现第二次完成接收按钮。
- 详情展示真实仓管身份、领取 PPIC、来源端、时间及逐菲票片数；明确不使用中转袋。
- 旧裁片领料码不再显示手填数量和新交出按钮；辅料、面辅料分支保留。
- 当前基线遵循 AGENTS.md 第 4、5、7 节。此记录只覆盖 WP05 负责文件，不替代总体矩阵或主流程验收。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | Web 标准列表；PDA 独立接收记录页签与卡片详情。 |
| 文案、状态、数量与单位 | 通过 | 本批已接收，片/张明确；任务进度保持进行中，不因本批接收完成生产任务。 |
| 真实图片与对象识别 | 通过 | 灰色拉链连帽卫衣正式原型效果图与对象编码/名称同块；大图及失败恢复已实测。 |
| 防错与历史收口 | 通过（本包范围） | 旧 CUT_PIECE PDA 活动入口及提交分支阻断；工厂接收详情限制当前工厂；不伪造袋/库存 ID 或工厂操作人。提交权限、版本核验归 WP04/WP06/WP07。 |
| 交接事实与追溯 | 通过（读取侧） | 同一事件生成只读交出/接收视图，无重复持久化；冻结部位用量参与回货数量计算。 |
| 低分辨率及恢复 | 通过 | Web 1366×768、1024×768；PDA 360×640、390×844；图片失败可见，重试恢复。无上传或离线写入功能。 |
| 命名路由与交互 | 通过 | 命名列表、记录详情、PDA 历史/详情、刷新重读、筛选/导出/分页已验；打印、扫码提交属于其他工作包。 |

## 4. 问题标签

本包已处理：`状态抽象`、`追溯不足`、`协作断裂`。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 已接收记录被待办过滤遗漏 | 协作断裂 | 工厂员工 | 接收记录独立页签，从同一事件读取 | 否 |
| 已接收详情顶部仍显示确认接收 | 状态抽象 | 工厂员工 | 简易记录顶部改为接收记录；无再次确认动作 | 否 |
| 初次查询落入大型通用处理器，交互被阻塞 | 组件误用 | 仓库管理 | 主代理在 main.ts 增加本页快速事件路径并处理 query；本页查询改局部刷新 | 已重放通过 |
| 无袋交出缺库存 ID | 追溯不足 | 仓库管理 | 标注真实完裁产出来源，不生成假袋或库存 ID | 否 |
| 旧 PDA 检查要求只读袋详情出现“移除菲票” | 既存契约差异 | 研发验收 | 保留失败证据及基线定位，未新增虚假按钮或修改旧袋业务 | 项目级旧检查仍需主代理处理 |

## 6. 最终结论

结论：通过（本记录限定的下游读取与页面验收范围）。

隔离浏览器使用 `WP05-*` 专用事件作为输入，验证记录读取、数量、状态及交互。**这些测试不是仓库确认提交的正常端到端证据**，不能用于证明提交校验、并发互斥、实际库存扣减或跨设备同步。总体完成须由主代理合并正常主流程证据后按总矩阵判定。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/cutting/handover-orders.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/pages/process-factory/cutting/handover-orders.ts`
- `src/pages/pda-handover.ts`
- `src/pages/pda-handover-detail.ts`

协同依赖：`src/main.ts` 快速事件路径由主代理负责，其验证使用同一运行版本。

### 页面路由

- `/fcs/craft/cutting/handover-orders`
- `/fcs/craft/cutting/handover-records/WP05-HR-01`
- `/fcs/pda/handover?tab=pickup` → 实际点击“接收记录”
- `/fcs/pda/handover/RECEIPT-WP05-HR-01`

### 实际证据矩阵

以下状态仅指本列限定的验证，不改写总体需求状态。

| 来源需求 | 本包验证结果 | 实现位置 | 自动化证据 | 页面证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| FACT-001/002 | 同一确认事件只读映射，不造袋和库存 ID；保留真实操作人 | buildSimpleCutPieceHandoverProjection / buildSimpleCutPieceFactoryReceipts | 37 条投影断言 | web-record、pda-record 截图 | 已验证（读取侧） |
| FACT-007 | 现有交出单列表与记录详情读到本批 | listHandoverOrders / listHandoverRecords | 投影断言、Web 用例 | web-list、web-record | 已验证 |
| FACT-008/009/010/011 | 已接收、数量与仓库实交相同、时间相同、不伪造工厂点击、不要求再次完成 | buildSimpleCutPieceFactoryReceipts / renderPickupHeadDetail | 投影断言、PDA 用例 | pda-record | 已验证 |
| FACT-012 | 已接收记录在独立接收记录页签可见 | renderPdaHandoverPage | PDA 实际页签点击 | pda-history | 已验证 |
| FACT-015/019 | 回货读取包含无袋交出，齐套使用冻结单件用量且考虑整部位缺失 | calculateMinimumReturnQtyByBags | 37 条投影断言中的冻结用量与缺部位案例 | 数量公式以专项为证，不依靠截图推断 | 已验证（本查询） |
| FACT-016 | 刷新后读取同一事件与记录身份 | 公共只读查询 | Web/PDA reload 断言 | web-list、pda-record | 已验证（隔离同浏览器） |
| HIST-001/002 | 共用原交出台账，方式可识别，不使用中转袋 | 交出页/记录页/接收详情 | Web/PDA 用例 | web-record、pda-record | 已验证 |
| HIST-003 | 关键词/方式/日期筛选、统计、全结果导出、分页、列设置与刷新保持 | 标准列表及事件处理函数 | Web 1366/1024 用例，刷新后再次分页 | web-list，export CSV | 已验证 |
| HIST-004 | 接收记录页签、标题和详情使用接收语义 | PDA 两页面 | PDA 用例 | pda-history、pda-record | 已验证（本页面） |
| HIST-008/009 | 旧 CUT_PIECE 扫码页面返回历史提示，提交分支阻断；面辅料分支保留 | renderSewingPickupScanPage / handlePdaHandoverEvent | check-sewing-outsourcing-pickup-slips：历史 V1/V2 读取、实交历史量恢复、重复命令不新增、新签发/新实交阻断、辅料及面辅料签发补打与实交保留 | 本包未造旧单模拟扫码 | 已验证（数据契约）；旧码页面联调归主代理 |
| IMG-001/002/003/004/006 | 对象与真实效果图对应、同块缩略图、大图关闭、失败与恢复 | 两端详情、共用图片预览 | Web/PDA 图片用例 | pda-image-failure，record 图片 | 已验证（本包灰色卫衣场景） |

### 验证命令

- `node --import tsx scripts/check-simple-cut-piece-receipt-projections.ts`：通过，37 条断言。
- `node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-list-page-governance.ts`：通过，404 页面、17 基线项。
- `CUTTING_E2E_PORT=4174 PLAYWRIGHT_HTML_OUTPUT_DIR=output/playwright/wp05/report npx playwright test tests/simple-cut-piece-receipts.spec.ts --workers=1 --output=output/playwright/wp05/test-results`：通过，4 个用例；后续 getter 优化后 Web 两例重跑通过（6.8 秒）；关闭列设置后等待弹窗确实关闭再选择方式，避免测试与异步关闭刷新竞争。
- `node --import tsx scripts/check-sewing-outsourcing-pickup-slips.ts`：通过。原脚本要求新建 CUT_PIECE 与 HIST-008/009 冲突，改用真实旧格式持久化夹具，保留历史数量、旧版本、幂等和打印断言，并覆盖非裁片签发/补打/实交及角色门禁。
- `node --import tsx scripts/check-sewing-outsourcing-task-boundary.ts`：通过。
- `node --import tsx scripts/check-sewing-outsourcing-ppic-responsibility.ts`：通过；主代理修复无浏览器 storage 时责任读取保留内存事实后重跑通过；测试未修改。日志 `output/playwright/wp05/ppic-responsibility-final.log`。
- `node --import tsx scripts/check-pda-handover-detail-source.ts`：失败；既有染色旧契约，第 108 行调用已关闭的 `submitDyeHandover`，当前业务要求逐卷交出；未修改无关染色业务或删除来源断言。原日志 `output/playwright/wp05/legacy-detail-source.log`。
- 受管文件 `git diff --check`：通过。
- `npx tsc --noEmit`：失败；本包当次无报错；全量存在其他 PCS 文件问题，不将全量声明为通过，主代理统一收尾。
- `node --import tsx scripts/check-pda-handover-pages.ts`：失败于既存“移除菲票”断言；`git show HEAD:<两个目标文件>` 均确认基线无此文本。此前只豁免已确认新业务的固定文案“仓库确认即 PPIC 和工厂已接收”，未放宽其他旧业务文案契约。
- `workflow:verify`：未运行；CodeGraph 同步和总体治理由主代理在最终合并改动后执行，本包不重复执行。

### 证据目录

`output/playwright/wp05/`。

- `README.md`：环境、重放方式及隔离范围说明。
- `web-list-1366.png`、`web-list-1024.png`：列表。
- `web-record-1366.png`、`web-record-1024.png`：交出记录。
- `pda-history-360.png`、`pda-history-390.png`：接收记录页签。
- `pda-record-360.png`、`pda-record-390.png`：逐菲票接收详情。
- `pda-image-failure-360.png`、`pda-image-failure-390.png`：图片失败态。
- `export-1366.csv`、`export-1024.csv`：筛选后的全部 11 条记录，含表头 12 行，无操作列。
- `report/`、`report-web/`：可重放测试报告。

### 真实图片验证

- 图片：`/production-confirmation-demo/grey-zip-hoodie.png`，来源及原始文件记录于 `public/production-confirmation-demo/sources.json`。
- 测试对象 `WP05-GREY-HOODIE` 明确是相同灰色拉链连帽卫衣的隔离验收引用，不冒充线上 PO18901。
- Web/PDA 缩略图与款号、款名同块；检查自然宽度大于零。Web 测试按 Esc 关闭，PDA 点击关闭；图片失败通过拦截该图片请求复现，解除拦截后点击失败提示重新打开并确认原图加载成功。
- 已人工目视 Web 1024 列表、1366 详情、PDA 360 历史与390详情截图：字段可读，图片保持比例，无页面主体横向溢出。

### 例外

- 隔离下游测试不能替代 WP04/WP06/WP07 正常交出主链路。
- 未修改总体需求追踪矩阵；旧码完整链路、其他商品/物料图片、打印与实体 PDA 扫码由主代理以对应证据验收。
- 测试资源竞争存在于其他用户的 PCS 测试进程，本包未停止或操作这些进程。

### HIST 文案语义只读复核

- HIST-004：本包三方车缝裁片页面使用“接收记录 / 已接收”，简易详情不显示“确认接收”或再次完成按钮。领取 PPIC 是现场动作身份，不属于旧“领料”对象命名。
- HIST-005：本包复用 `/fcs/pda/handover` 共享业务页面及通用 `PdaPickupRecord`，未新增专属领料对象、旧专属路由或兼容跳转。专属 PPIC 页面及路由的完整迁移由主代理核验。
- HIST-006：保留辅料/面辅料“领料扫码确认”与其他工艺“待接收 / 确认接收”，这些分支不属于此次无二次确认的简易裁片事实。
- HIST-008：旧 CUT_PIECE 扫码早返回历史提示，无法渲染数量表单，提交分支再次阻断；脚本证明新签发及旧码新交出均被拒绝。
- HIST-009：旧码提示历史用途和当前任务单入口；历史版本、交出事实、数量与重复命令仍可读，原始领料标题只用于历史文档。

本次只读复核未发现本包范围内需要进一步替换的活动“领料”文案，没有为统一文案改动其他物料业务。

### 历史实交累计修正

确认事件新增可选 `previousHandedOverLines`，从确认时责任汇总冻结此前已交量。台账任务累计与欠片使用“冻结此前量 + 本批实际量”，本单已交/已收继续只累计本单批次，避免旧交出单重复计入列表总数。列表和详情明确区分“本单”与“任务累计”。旧事件未携带字段时继续使用已有简易批次累计。

- 投影专项 37 条通过：历史 40 + 本批 60 = 任务累计 100，本单 60，旧单 40 + 新单 60 的台账合计 100；历史批次欠量不会随新增交出改变。
- 完整事务专项通过：首批冻结空此前量、第二批冻结此前 700；第二批确认后第一批缺帽片 200 的历史结果不变。
- 新日志：`output/playwright/wp05/frozen-projection.log`、`frozen-integration.log`。
- 本次列文案和累计展示变更后的最终浏览器验收由主代理新服务统一重放；此前截图不能单独证明新增字段展示。

### 读取存储异常隔离

工厂简易接收只读投影在账本不可读时返回明确 `readError`，不写回、不清空持久化，也不把缓存当当前事实。PDA 接收内容区域显示恢复存储后刷新提示，即使没有任何简易记录也显示。其他工厂页不再因这个可选读取旁路崩溃。resolve、confirm 和旧袋消费的严格账本守卫未修改。

专项最新 43 条通过：模拟 getItem 抛错，确认命令仍拒绝、零写入、既有持久化内容不变，恢复读取后错误消失。日志 `output/playwright/wp05/storage-projection.log`。

`npm run check:standard-list-page-template` 最终通过，包括原 Storage 抛错补料渲染和 Chromium 列拖拽；日志 `output/playwright/wp05/storage-standard-list-final.log`。本轮仅调用数据专项和标准列表原生命令，未将错误的 tsx 浏览器序列化运行算作业务失败或通过。
