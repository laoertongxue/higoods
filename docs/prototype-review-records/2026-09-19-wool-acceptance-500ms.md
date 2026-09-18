# 毛织两阶段补充验收与性能修复审查记录

## 1. 基本信息

| 项目 | 内容 |
|---|---|
| 记录日期 | 2026-09-19 |
| 相关需求 / 任务 | 毛织两阶段此前性能及完整验收未通过项收口；A01—A20、126项需求追踪；本轮重点 PRINT-003、PAGE-019/020、VERIFY-001—007 及共享接收事实保持 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS、FCS、PFOS、PDA；仅本地原型 |
| 涉及页面路径 | 第7节列出的两阶段、接收、仓库、设备、工艺上下游、打印及PDA路径 |
| 端类型 | 管理端、主管端、员工执行端 |
| 主要角色与任务 | 管理员核查来源与阶段；主管接收、加工、交出、仓库和设备操作；员工PDA执行和跨厂收货 |
| 分支 / 工作树 | `codex/wool-main-release-20260918` / `/private/tmp/higoods-wool-main-release-20260918` |
| 基准 HEAD | `4ea0f03d81035608e3c9f4afe7933013ab28a57b`，本轮未提交增量以最终源码清单固定 |
| 服务 / 浏览器 | 同工作树dev `http://127.0.0.1:5198`，build preview `http://127.0.0.1:4198`；Playwright Chromium隔离上下文 |
| 最终版本和运行状态 | [最终源码清单](../product-design/wool-two-stage-adjustment/evidence/acceptance-500/final-source-manifest.json)、[最终收口记录](../product-design/wool-two-stage-adjustment/evidence/acceptance-500/final-verification.md)；warehouse最后修改后最终证据已全部生成并通过；当前build SHA-256 `5628743d94d6f72e96d1c30a866fccfeb4be8850ef8479c4ea077d6daad89266` |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：四批交出此前屏幕预览四页但实际PDF仅第一页，现释放打印祖先容器高度与裁切、保持分批分页并调整长备注列宽；仓库筛选旧debounce会在change/reset后覆盖后续分页选择，现取消迟到timer。共享接收和读取优化以保持业务事实、角色权限和路由结果不变为目标，但仍须验收相关工艺厂及PDA页面，不能只作为内部重构豁免。
- 当前基线：`AGENTS.md` 第4节工厂现场、第5节UI/列表/真实图片、第7节验证与证据新鲜度；用户最近明确允许的单页冷进入例外见第7节。
- 本轮不增加生产后端、离线队列、历史迁移或新的业务状态；不将Mock实收表述为真实工厂收货。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
|---|---|---|
| 角色、任务与页面模式 | 通过 | 管理两阶段列表、主管1024接收仓库、PDA360/400实际入口已有回放；工厂及阶段隔离有契约与页面负例 |
| 文案、状态、数量与单位 | 通过 | 六状态和时间/数量列保留；纱线kg、外发片片、缝盘件分别表达；计划80实际100完整链不二次放大；不外发片仅记录对应件数 |
| 扫码、真实图片与对象识别 | 通过 | 阶段扫码候选、错厂拒绝、真实款图纱线图、大图关闭、失败提示及打印QR就绪已回放 |
| 防错、危险确认与主管兜底 | 通过 | 超量、坏路线、错阶段及未闭合完单阻断；写入失败显示未保存并保留输入，恢复UI重试只有一组事实 |
| 交接、跨端事实与异常追溯 | 通过 | A08真实横机100片同来源分60/40接收，刷新后累计与库存100、两笔唯一且无重复接收入口；split-receipt.log |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1024和两PDA尺寸已有直接回放；warehouse四种迟到事件反例和158项1024操作各五轮已通过。存储失败/图片网络失败已测；真实离线队列和上传功能非本需求 |
| 命名路由、交互、图片大图与打印 | 通过 | 打印4批4页及长备注可读已有证据；最后源码后的业务、3695性能样本与最终审查均通过 |

“阶段业务证据”不代表126项矩阵可以提前标记已验证；最终结论仍受当前源码、完整运行和性能门禁约束。

## 4. 问题标签

- `视觉干扰`：原PDF祖先滚动裁切导致后续页面丢失。
- `点错风险`：迟到筛选刷新覆盖用户后续页大小选择。
- `追溯不足`：A08缺同来源连续两次UI接收直接场景证据。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
|---|---|---|---|---|
| 四批交出PDF只出一页 | 视觉干扰 | 交接人员、主管 | 仅print媒体释放祖先高度/滚动、隐藏非打印区域；每批独立A4，固定列宽并换行；4批实测4页 | 最终构建五轮打印通过，构建已绑定 |
| 仓库input旧timer在change/reset之后触发 | 点错风险 | 仓管、主管 | warehouse.ts取消旧debounce；确定性红绿用例覆盖后续页大小不被覆盖 | 四种事件反例及最终实际分页/1024五轮通过 |
| 同来源分批实收UI证据不足 | 追溯不足 | 首工艺厂收货员 | 保留领域累计/防重证据；主代理补100交出后60、40实际接收并读回来源、待收和库存 | 真实UI补测已通过，首笔未收齐、末笔累计和库存100 |
| 共享读取和批量初始化曾造成冷启动/接收超时 | 视觉干扰 | PDA执行人员 | 批量接收、窄读取和详情延迟加载等优化；等价契约确认事实不变 | 最后源码后五样本齐全，全部通过 |

## 6. 最终结论

结论：通过

47个不同浏览器业务用例均有最终通过证据，266单元、17组契约、事实等价、3695性能样本和对抗式复审通过；A08同来源60/40及仓库迟到事件均有直接回放。源码、原始失败/修复记录、逐样本统计及126条需求追踪以[最终收口记录](../product-design/wool-two-stage-adjustment/evidence/acceptance-500/final-verification.md)为准。此结论是本地原型内部验收，不代表已再次推送main或用户产品接受。

## 7. 变更覆盖与验证

### 受管文件

文档核对时 `git diff --name-only` 的12个源码文件如下。最终增量摘要由主代理写入源码清单，撤回的KOL懒初始化、Vite预加载、排序等试验不列入交付。

- `src/data/fcs/factory-internal-warehouse.ts`
- `src/data/fcs/factory-receiving.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/printing-factory-demos.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/store-domain-progress.ts`
- `src/data/fcs/warehouse-material-execution.ts`
- `src/data/fcs/water-soluble-task-domain.ts`
- `src/main.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/process-factory/wool/handover-print.ts`
- `src/pages/process-factory/wool/warehouse.ts`

### 页面路由

- `/fcs/craft/wool/knitting-orders`、`/fcs/craft/wool/linking-orders`，对应实际单号详情及 `/handover-print`。
- `/fcs/craft/wool/pending-receipts`、`?view=stock`、指定 `workOrderId` 接收。
- `/fcs/craft/wool/wait-process-warehouse`、`/fcs/craft/wool/wait-handover-warehouse`。
- `/fcs/craft/wool/machines`、`/fcs/process-factory/wool/machine-associations`。
- `/fcs/pda/exec`、毛织执行与接收路径、实际裁厂交出批次收货详情；精确参数路径见最终路由/动作JSON。
- PCS款式详情版本页：`/pcs/products/styles/{styleId}`；绑定生产单旧版本与新版启用后的毛织详情。
- 工艺链、裁厂待装袋、指定后道任务的参数化路径由实际来源导航，见 [A01—A20映射](../product-design/wool-two-stage-adjustment/evidence/acceptance-500ms/business-gap-coverage.md) 和测试保存的路由。
- 旧毛织work-orders、详情、打印、tasks、orders入口仅作拒绝恢复验证。

### 验证命令

- `npm run build`：通过，266项单测及Vite最终构建。
- `npm run check:list-page-governance:static`：通过，436页及17项历史基线。
- `npm run check:standard-list-page-template`：通过，真实Chromium列拖拽及持久化。
- `node --import tsx scripts/check-wool-fact-workflow.ts`：通过，17组专项。
- `node scripts/check-wool-route-performance.mjs`：通过，555个最终加载样本。
- `node scripts/check-wool-remaining-action-performance.mjs`：通过，375项操作各五轮。
- `npm run check:prototype-design-governance -- --all`：通过；原命令表格格式失败保留，补齐规范清单后重测通过。


以下“通过”只表示指定阶段实际结果。未把文档编写时未执行的命令伪称运行；当前主代理最终结果以链接日志更新。

| 命令 | 本记录时结果 | 证据 |
|---|---|---|
| `CUTTING_E2E_PORT=5198 PLAYWRIGHT_REUSE_EXISTING_SERVER=true npx playwright test tests/wool-acceptance-gaps.spec.ts --workers=1 --reporter=line --output=/private/tmp/wool-business-final` | 通过，12项 | [business-final.log](../product-design/wool-two-stage-adjustment/evidence/acceptance-500ms/business-final.log) |
| `CUTTING_E2E_PORT=5198 PLAYWRIGHT_REUSE_EXISTING_SERVER=true npx playwright test tests/wool-acceptance-extra.spec.ts --workers=1 --reporter=line --output=/private/tmp/wool-business-extra-final` | 当时A13通过、1024测试等待失败；原失败保留 | [原始日志](../product-design/wool-two-stage-adjustment/evidence/acceptance-500ms/business-extra-a13-with-initial-1024-failure.log) |
| `CUTTING_E2E_PORT=5198 PLAYWRIGHT_REUSE_EXISTING_SERVER=true npx playwright test tests/wool-acceptance-extra.spec.ts --grep 1024 --workers=1 --reporter=line --output=/private/tmp/wool-1024-final5` | 等待修正后通过1项 | [1024日志](../product-design/wool-two-stage-adjustment/evidence/acceptance-500ms/business-1024-final.log) |
| 打印/阶段错配专项（完整原命令见补充映射的代码块） | 通过3项 | `/private/tmp/wool-print-final2.log`，完整原命令见补充映射 |
| `WOOL_BASE_URL=http://127.0.0.1:4198 node scripts/check-wool-print-extra-performance.mjs` | 最终构建15/15通过 | [print-extra-performance.json](../product-design/wool-two-stage-adjustment/evidence/acceptance-500ms/print-extra-performance.json) |
| 最终完整6份spec与新增debounce用例（精确命令由主代理最终日志登记） | 最后46项45通过，1项测试等待竞态失败；等待修正后定向通过，最终通过，另A08独立UI通过 | [browser.log](../product-design/wool-two-stage-adjustment/evidence/acceptance-500/browser.log) |
| `npm run build` | 最后warehouse变更后266单元及构建通过；SHA见第1节 | [build.log](../product-design/wool-two-stage-adjustment/evidence/acceptance-500/build.log) |
| 逐片、路线、两阶段、统一接收、库存、投影与事实等价专项 | 阶段通过；精确脚本及结果见日志和最终记录 | [core.log](../product-design/wool-two-stage-adjustment/evidence/acceptance-500/core.log)、[equivalence.log](../product-design/wool-two-stage-adjustment/evidence/acceptance-500/equivalence.log) |
| `npm run check:prototype-design-governance` | 已通过，11个受管文件 | 最终收口记录及prototype-governance.log |

性能明细：当前曾取得37组路由×3类加载×5轮555样本、71+18组动作五样本通过；这些数目不替代最后warehouse改动后的复测。历史样本已单独归档，不删除慢样本；最后报告以 [route-performance.json](../product-design/wool-two-stage-adjustment/evidence/acceptance-500/route-performance.json)、[action-performance.json](../product-design/wool-two-stage-adjustment/evidence/acceptance-500/action-performance.json)、[extra-action-performance.json](../product-design/wool-two-stage-adjustment/evidence/acceptance-500/extra-action-performance.json)、[remaining-action-performance.json](../product-design/wool-two-stage-adjustment/evidence/acceptance-500/remaining-action-performance.json)、[1024补充](../product-design/wool-two-stage-adjustment/evidence/acceptance-500/remaining-action-performance-1024.json) 为准。

### 真实图片验证

- 原型款式对应针织开衫图 `/cardigan-sample.jpg`；纱线对应实物纱筒图 `/materials/process-orders/cotton-yarn-cone.jpg`，来源映射在 `src/data/fcs/wool-domain/demo-assets.ts`。仅声明原型对象对应，不声称线上款号真实生产图片。
- 列表缩略图与款号/纱线编码同信息块；详情、待收、PDA、打印均沿用原型来源。原workflow用例实际检查解码、大图原比例及按钮/遮罩/Esc关闭；图片失败有可见反馈。
- 打印五轮分别中止实际款图请求：四张均失败时禁打印且显示原因；解除中止、刷新后四图解码及QR就绪才启用；未用隐藏坏图或占位图规避。
- 4批各5件、每批260字备注的PDF实际4页，数量、长备注、签收、QR和款图完整：[PDF样本](../product-design/wool-two-stage-adjustment/evidence/acceptance-500ms/print-four-batch-1.pdf)、[渲染检查图](../product-design/wool-two-stage-adjustment/evidence/acceptance-500ms/business-browser/print-rendered-page1.png)。其余四份PDF与原始时间同目录保存。
- 1024仓库/设备、PDA360/400容量阻断、PCS新版启用仍读旧绑定、裁厂收货后的装袋来源截图见 [补充证据目录](../product-design/wool-two-stage-adjustment/evidence/acceptance-500ms/business-browser)。

### 例外

- 用户明确授权且设计§12.2已同步：仅PDA任务队列 `/fcs/pda/exec` 冷进入 `≤1000ms`；刷新、站内切换、所有操作和其他路由继续严格 `<500ms`。不把该例外扩到保存、接收、打印或其他页面。697.9ms冷进入样本按此例外判断，保留原始耗时。
- A15版本/生产准备/正式生产单快照、A09诊断、A13既有合法实收是隔离夹具；真实UI动作分别为启用新版、观察阻断、后续完整工艺链。数据准备不得冒充UI成功。
- `window.print`仅拦截系统打印对话框，计时继续至Chromium完整PDF缓冲生成；真实打印机排队与纸张送出不属本地原型能力。
- 不豁免A08、不豁免最后源码后证据新鲜度；本记录未代替产品负责人接受回执。
