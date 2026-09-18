# 毛织两阶段调整原型审查记录

## 1. 基本信息

- 日期：2026-09-18。
- 需求：[126项原子矩阵](../product-design/wool-two-stage-adjustment/requirements.md)，状态为119条已实现待验证、7条实施中、0条已验证。
- 分支：`codex/work-20260918`，基准 HEAD `4804328a822eec3c77eee1ffa5b10911bb77c9fe`，本次实现尚未提交。
- 工作树：`/Users/laoer/Documents/higoods/.worktrees/work-20260918`。
- 证据记录时服务：开发 `http://192.168.5.2:5186`，同工作树生产预览 `http://192.168.5.2:4186`；性能脚本实际访问同服务 `http://127.0.0.1:4186`。
- 本记录加载与交互测量对应当前冻结构建 `a2055fb5b136a4d37a77effb92b55b08662b9dc4c754bab157f06fb1d34641d7`；包含工艺仓独立副本、PDA 交接冻结读取及待办提示修复。源码摘要见 [实现清单](../product-design/wool-two-stage-adjustment/evidence/implementation-manifest.json)。
- 核验责任人：Codex 主代理及限定范围审查子代理；产品实现验收人及接受版本：未确认。用户的业务确认及设计实施授权不等于接受实现。
- 系统：PCS 技术包快照、FCS/PFOS 毛织与辅助/特种工艺、仓储、裁厂及后道来源；管理 Web 与员工 PDA。
- 角色：计划/跟单查看两阶段；横机员工织片；工艺厂接收加工交出；毛织员工收回工艺片缝盘；仓管记录实际收发；指定下游确认实收。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：原单拆为横机/缝盘；逐片工艺路线、实际分批接收、自动内部衔接、工厂隔离、数量单位、列表/详情/打印/PDA、旧单清理与新演示事实均改变。

依据 `AGENTS.md` 第 4、5、7 节；性能、真实图片和跨端事实均无豁免。

## 3. 自查结论

下表“通过”只表示说明栏所指已执行功能样本通过；不表示所有适用页面/设备或性能已验收。总体结论保持不通过，开放项见 [尚未关闭的验收项](../product-design/wool-two-stage-adjustment/evidence/open-acceptance-items.md)。

| 检查项 | 结论 | 说明 |
|---|---|---|
| 角色、任务与页面模式 | 通过 | 两阶段列表六状态、八列；PDA 接收/填报/仓储分别按职责；具体交互见浏览器记录 |
| 文案、状态、数量与单位 | 通过 | 不外发片按对应件数；kg/片/件分开；阶段加工完成与交接完单分开；不承诺未经维护的物理齐套 |
| 扫码、真实图片与对象识别 | 不通过 | 缩略图、真实款式/纱线图和阶段 QR 已实现；完整多端大图、失败态及全部打印分页证据仍须闭合 |
| 防错、危险确认与主管兜底 | 通过 | 超量、错片/错厂、重复载荷、非法状态有零写反例；确认页面显示数量、操作者及来源 |
| 交接、跨端事实与异常追溯 | 通过 | 真实共享实收投影；下一厂未接收前零实收；初始保存失败反例和异厂备料串量反例已修复 |
| 低分辨率、PDA、弱网与上传恢复 | 不通过 | 已有 1280×720 管理端、360×800 和 400×806 PDA 核心回放；适用1024×768和全部受影响页面的设备/失败组合仍未齐；无新增上传基础设施 |
| 命名路由、交互、图片大图与打印 | 不通过 | 路由迁移、阶段错配阻断和真实打印专项通过；性能超时/完整证据仍未闭合 |

## 4. 问题标签

- 性能不达标：25条路由的375个加载样本中198个失败，0页面错误；全部25条路由各有失败样本。
- 交互范围未闭合：已测89个命名操作、445样本全部通过，最大95.59999999403954ms，但不能代表尚未覆盖的全部入口。
- 场景及接受记录缺口：部位裁厂/后道完整页面、多SKU/路线阻断组合、1024适用页面和长内容打印分页等仍待补；产品实现接受尚未发生。

## 5. 需求对应与发现处理

详见 [验证索引](../product-design/wool-two-stage-adjustment/evidence/verification-index.md)、[开放验收项](../product-design/wool-two-stage-adjustment/evidence/open-acceptance-items.md) 与专项对抗式审查。审查发现的备料入口、只分配纱线的筛选/时间、初始化半提交、异厂备料串量、PDA 返回、出库负调整口径、最终成衣工艺计划库存、底层超量实收均须保留回归。单个专项通过不代表总体通过。

## 6. 最终结论

结论：不通过

当前已有业务实现与多轮反例修复；当前冻结构建有198个加载样本不满足严格<200ms，适用交互完整证据也未齐。31个真实浏览器功能用例及123个工程单元测试通过；全量tsc仍有61条诊断（本次改动/新增文件0条），全量类型检查不通过。不得标记需求矩阵全已验证，不得称已交付/已接受。业务专项审查与本次总体审查分开记录。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/cutting/generated-fei-tickets.ts`
- `src/data/fcs/cutting/sewing-dispatch.ts`
- `src/data/fcs/cutting/transfer-bag-operations.ts`
- `src/data/fcs/factory-internal-warehouse.ts`
- `src/data/fcs/factory-mobile-todos.ts`
- `src/data/fcs/factory-mobile-warehouse.ts`
- `src/data/fcs/factory-receiving-links.ts`
- `src/data/fcs/factory-receiving-types.ts`
- `src/data/fcs/factory-receiving-wool.ts`
- `src/data/fcs/factory-receiving.ts`
- `src/data/fcs/fcs-route-links.ts`
- `src/data/fcs/page-adapters/task-execution-adapter.ts`
- `src/data/fcs/pda-cutting-execution-source.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/pda-handover-handout-registry.ts`
- `src/data/fcs/post-finishing-authorization.ts`
- `src/data/fcs/post-finishing-document-numbering.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/post-finishing-operation-log.ts`
- `src/data/fcs/post-finishing-qc-reference.ts`
- `src/data/fcs/post-finishing-return-source-adapter.ts`
- `src/data/fcs/printing-factory-demos.ts`
- `src/data/fcs/process-action-writeback-service.ts`
- `src/data/fcs/process-order-task-links.ts`
- `src/data/fcs/process-tasks.ts`
- `src/data/fcs/process-warehouse-domain.ts`
- `src/data/fcs/process-warehouse-linkage-service.ts`
- `src/data/fcs/process-web-status-actions.ts`
- `src/data/fcs/production-order-tech-pack-runtime.ts`
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`
- `src/data/fcs/special-craft-task-generation.ts`
- `src/data/fcs/special-craft-task-orders.ts`
- `src/data/fcs/wool-domain/commands.ts`
- `src/data/fcs/wool-domain/craft-flow.ts`
- `src/data/fcs/wool-domain/craft-warehouse.ts`
- `src/data/fcs/wool-domain/cutting-receipts.ts`
- `src/data/fcs/wool-domain/demo-assets.ts`
- `src/data/fcs/wool-domain/final-craft.ts`
- `src/data/fcs/wool-domain/legacy-reset.ts`
- `src/data/fcs/wool-domain/machine-associations.ts`
- `src/data/fcs/wool-domain/mobile.ts`
- `src/data/fcs/wool-domain/mock-data.ts`
- `src/data/fcs/wool-domain/mock-receiving.ts`
- `src/data/fcs/wool-domain/piece-source.ts`
- `src/data/fcs/wool-domain/queries.ts`
- `src/data/fcs/wool-domain/stage-correction.ts`
- `src/data/fcs/wool-domain/stage-facts.ts`
- `src/data/fcs/wool-domain/stage-rules.ts`
- `src/data/fcs/wool-domain/store.ts`
- `src/data/fcs/wool-domain/tech-pack-source.ts`
- `src/data/fcs/wool-domain/types.ts`
- `src/data/fcs/wool-pda-scan.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/main-handlers/pda-handlers.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-handover.ts`
- `src/pages/pda-warehouse-inbound-records.ts`
- `src/pages/pda-warehouse-outbound-records.ts`
- `src/pages/pda-warehouse-shared.ts`
- `src/pages/pda-wool-fact-execution.ts`
- `src/pages/pda-wool-warehouse-flows.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/process-factory/special-craft/task-detail.ts`
- `src/pages/process-factory/special-craft/task-orders.ts`
- `src/pages/process-factory/special-craft/warehouse.ts`
- `src/pages/process-factory/wool/craft-actions.ts`
- `src/pages/process-factory/wool/handover-print.ts`
- `src/pages/process-factory/wool/pending-receipts.ts`
- `src/pages/process-factory/wool/shared.ts`
- `src/pages/process-factory/wool/stage-display.ts`
- `src/pages/process-factory/wool/stage-order-detail.ts`
- `src/pages/process-factory/wool/stage-orders.ts`
- `src/pages/process-factory/wool/stock-allocations.ts`
- `src/pages/process-factory/wool/warehouse.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes-pda.ts`

#### 删除的受管文件

以下为已删除路径，列出是为追踪完整迁移，不是当前可访问实现：

- `src/pages/process-factory/wool/work-order-detail.ts`
- `src/pages/process-factory/wool/work-orders.ts`

### 页面路由

- `/fcs/craft/wool/knitting-orders` 及阶段详情/交出打印。
- `/fcs/craft/wool/linking-orders` 及阶段详情/交出打印。
- `/fcs/craft/wool/pending-receipts`，含纱线、片、备料分配。
- `/fcs/craft/wool/wait-process-warehouse`、`/fcs/craft/wool/wait-handover-warehouse`。
- `/fcs/craft/wool/machines`、`/fcs/process-factory/wool/machine-associations`。
- `/fcs/process-factory/special-craft/:operationId/work-orders/:taskOrderId` 及工艺仓储。
- `/fcs/pda/wool/pending-receipts`、`/fcs/pda/exec/:taskId`、`/fcs/pda/warehouse/inbound-records`、`/fcs/pda/warehouse/outbound-records`。

### 验证命令

- `node --import tsx scripts/check-wool-fact-workflow.ts`：通过；冻结版本17组业务专项已重新运行并归档。
- `node --import tsx scripts/check-wool-adversarial-regressions.ts`：通过；7 组失败恢复/隔离/方向反例。
- `node --import tsx scripts/check-factory-receiving-integration.ts`：通过；实际称重、分批、冷重启、物理库位与守恒。
- 四个 `tests/wool-*.spec.ts` 指定用例集：通过；冻结版本31项（1.8m），包括最终成衣工艺PDA及工艺片导出身份。
- `npm run build`：通过；123 单元测试及 Vite 构建通过；最后待办提示修复后另跑 `vite build` 通过，构建不替代业务/性能验收。
- `node scripts/check-wool-route-performance.mjs`：失败；25路由、375样本，198失败、0页面错误，最大1603ms；[原始加载证据](../product-design/wool-two-stage-adjustment/evidence/route-performance.json)。
- `node scripts/check-wool-action-performance.mjs`：通过（仅命名范围）；71个命名操作、355样本全部通过，最大95.59999999403954ms；[原始交互证据](../product-design/wool-two-stage-adjustment/evidence/action-performance.json)。未覆盖入口不算通过。
- `tsc --noEmit`：失败；全量61条诊断，本次改动/新增文件0条；[诊断原文](../product-design/wool-two-stage-adjustment/evidence/typescript-diagnostics.log)，不记为全量类型通过。
- `npm run check:list-page-governance:static`：通过；411 页面检查。
- `npm run check:prototype-design-governance -- --all`：通过；本任务隔离工作树80个受管文件关联本记录，见 [design-governance.log](../product-design/wool-two-stage-adjustment/evidence/design-governance.log)；较早72项日志不作为最新覆盖。默认 staged 模式没有受检文件，未把它用作覆盖证明。

- `node scripts/check-wool-extra-action-performance.mjs`：通过（仅命名范围）；补充18项、90样本全部通过，最大65.69999998807907ms；[补充原始证据](../product-design/wool-two-stage-adjustment/evidence/extra-action-performance.json)。已测交互合计89项、445样本；未覆盖入口仍不算通过。

### 真实图片验证

- 新毛织演示款对应仓库已有 `/cardigan-sample.jpg`，演示毛纱对应 `/materials/process-orders/cotton-yarn-cone.jpg`；技术包真实来源保留对应款式/纱线图。
- 外发片未伪造片实拍，使用真实款式参考图并明确说明；缩略图与对象标识同块。
- 打印按钮等待图片和真实 QR 就绪；图片失败不得视作就绪。本轮31项中已实际回放款式/纱线大图、关闭按钮、遮罩、Esc及加载失败反馈；全部打印分页和剩余受影响页面仍未完全覆盖。

### 例外

- 无。性能和图片门禁未获豁免；记录“未通过”不构成豁免。

文档旁路仅校正绑定；主代理随后继续执行当前源码复测并归档，矩阵仍保留未通过状态。
