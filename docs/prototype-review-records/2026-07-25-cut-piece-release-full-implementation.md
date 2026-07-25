# HiGood 原型审查记录

> 任务5：日报同步 + 原型审查收口验证 — 裁片放行全日程实现收口

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-25 |
| 相关需求 / 任务 | 裁片放行功能全链路实现收口（任务5） |
| 涉及系统 | FCS / PFOS |
| 涉及页面路径 | `/fcs/craft/cutting/cut-piece-release`, `/fcs/dispatch/sewing-dispatch-workbench`, `/fcs/craft/cutting/handover-orders`, `/fcs/material-prep/sewing`, 日报 |
| 端类型 | 主管端 / 管理端 |
| 主要角色 | 裁床主管、PPIC |
| 主要任务 | 日报接入裁片放行确认版本数据、裁片放行 Mock 数据收口、PPIC 派工接入可做数量优先、交接包按袋最小归还、原型设计治理全量验证 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 裁床主管使用主管端放行页面，PPIC 跟单使用管理端派工工作台，角色对应正确 |
| 任务清晰度 | 通过 | 各页面以当前可放行/当前可派为主口径，状态和数据说明清晰 |
| 信息架构与导航 | 通过 | 放行→派工→交接→日报形成完整链路，页面间可跳转 |
| 页面模式 | 通过 | 复用列表、抽屉、弹窗、卡片等已有模式 |
| 信息负荷 | 通过 | 日报摘要卡片 48px 单行布局，关键数据优先展示 |
| 文案 | 通过 | 全中文，状态值全部中文化（按齐套放行/风险放行/暂不放行等） |
| 数量与状态 | 通过 | 日报指标和明细从 decision/releaseQty 切换为 releaseAvailableStatus/releaseConfirmQty，口径一致 |
| Mock 数据覆盖 | 通过 | 裁片放行 Mock 已覆盖 8 条生产单、6 种放行状态、风险放行、多版本日志、暂不放行、确认后需复核、数据不完整和暂无裁片边界；PPIC 工作台摘要覆盖按齐套、风险、暂不放行和确认后需复核；PO14672 已贯穿放行、PPIC 和交出最低应回 |
| 扫码与识别 | 通过 | 裁片放行页面支持扫码触发入仓判断 |
| 防错 | 通过 | 超可派派工不再被候选行前置过滤拦截，按生产单累计超可派后触发二次确认；按袋最小归还已加已区分标签 |
| UI 样式 | 通过 | 复用 badge、table、dialog 等已有组件，风格统一 |
| 组件交互 | 通过 | 弹窗/抽屉局部刷新，不触发整页重绘 |
| 协作关系 | 通过 | 裁床确认放行→PPIC 派工→执行→日报，状态链完整；PO14672 使用同一展示生产单号贯穿放行、PPIC 和中转袋交出最低应回 |
| 异常与追溯 | 通过 | 派工草稿保存当时引用的裁床放行版本快照；放行风险说明、确认人和时间可追溯 |
| 现场设备可用性 | 通过 | PDA 执行端页面以动作优先、首屏精简 |

## 4. 问题标签

- `状态抽象`：旧口径 decision/releaseQty 不能体现 PPIC 可做数量和确认版本数据，已切换为 releaseAvailableStatus/releaseConfirmQty

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 日报裁片放行指标和明细使用旧口径 decision/releaseQty | `状态抽象` | 裁床主管 | 切换为 releaseAvailableStatus/releaseConfirmQty，保持与放行页面一致 | 否 |
| 裁片放行 Mock 数据需补充四色补充字段 | `状态抽象` | 裁床主管、PPIC | 补充 layerCompletedCount/perSuppleCount/lateMaterialCount/missingProcessCount | 否 |
| PPIC 派工缺少可做数量优先 | `状态抽象` | PPIC 跟单 | 接入 releaseAvailableStatus + ppicAvailableDispatchQty | 否 |
| PPIC 超可派派工被候选行前置过滤，部分超派场景进不了二次确认 | `点错风险` | PPIC 跟单 | 候选行恢复按齐套/剩余判断，超可派校验改为按生产单累计派工量与当前可派总量比较 | 否 |
| PPIC 派工历史未保留当时引用的裁床放行版本 | `追溯缺失` | PPIC 跟单、裁床主管 | 派工草稿新增裁床放行版本快照，记录生产单、放行状态、当前可派总量和版本号 | 否 |
| 裁片放行风险原因入口不能随数量变化动态出现，且逐颜色尺码风险可能被汇总抵消 | `异常兜底` | 裁床主管 | 可做数量输入变化后局部刷新风险放行摘要和风险原因输入区；风险放行按颜色尺码逐行累计，不允许用汇总数抵消 | 否 |
| Mock 数据只覆盖部分放行状态，无法完整演示 PRD 场景 | `状态覆盖不足` | 裁床主管、PPIC 跟单 | 增加 PO14676/PO14677/PO14678，并调整 PO14672/PO14673，覆盖待维护目标、待裁床确认、按齐套放行、风险放行、暂不放行、确认后需复核；检查脚本同步加严 | 否 |
| PPIC 工作台只有单个任务能读到裁片放行摘要，跨页面 Mock 不足 | `链路断点` | PPIC 跟单 | 将 PPIC 任务映射到按齐套、风险、暂不放行、确认后需复核 4 类摘要，并加严 `check:ppic-dispatch-priority` | 否 |
| 放行、PPIC、交出最低应回没有完全同一生产单号贯穿 | `链路断点` | 裁床主管、PPIC 跟单、仓管 | 将生产单展示号 PO14672 贯穿裁片风险放行、PPIC 工作台、车缝交出单和 `calculateMinimumReturnQtyByBags` 最低应回；`check:minimum-return-by-bags` 新增加严断言 | 否 |
| 交接包按袋最小归还异常 | `点错风险` | 操作员 | 增加已区分标签，禁止未区分状态归还 | 否 |

## 6. 最终结论

结论：通过

说明：
- 日报 `fulfillment` tab 的裁片放行指标和明细从 old decision/releaseQty 全面切换为 releaseAvailableStatus/releaseConfirmQty
- 日报 helperText 同步更新为「来自裁片放行确认版本的当前可放行数量」
- PPIC 页面接入可做数量优先，全链路口径一致
- PPIC 超可派二次确认已按生产单累计判断，候选行不再因为超过当前可派总量而提前消失
- 派工草稿已保留当时引用的裁床放行版本快照，支持后续追溯
- 裁片放行确认面板的风险原因入口已支持随可做数量输入局部刷新，风险判断与提交逻辑一致，按颜色尺码逐行累计
- 裁片放行 Mock 数据已覆盖 8 条生产单和 6 种放行状态，`check-cut-piece-release-mock-records` 已加严为硬门禁
- PPIC 工作台 Mock 已能读到多类裁片放行摘要，不再只有单个稳定放行样例
- PO14672 已作为风险放行样例完全贯穿：PPIC 展示生产单号 PO14672，裁床放行生产单号 PO14672，交出最低应回生产单号 PO14672；已交出 2 个中转袋、3 张菲票、630 片，最低应回 210 件
- `calculateMinimumReturnQtyByBags` 已支持 `piecesPerGarmentByPart` 参数进行 BOM 部位用量折算，未提供时默认 1:1
- 已导出 `markCutPieceReleaseVersionsNeedReview(productionOrderId)` 供外部模块（菲票数量变化、铺布事件等）调用，原型阶段手动调用即可
- 所有验证脚本通过，构建成功
