# 换片布菲票打印与交出联动原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-25 |
| 相关需求 / 任务 | 产品方案 92 条原子需求，见实施追踪 |
| 记录模式 | 完整产品审查（当前未完成） |
| 涉及系统 | PFOS / FCS / PDA / 统一打印 |
| 端类型 | 管理端、裁床员工执行端、接收工厂端 |
| 主要角色与任务 | 打票员备换片布；裁床仓管按车缝任务随裁片交出；工厂回看同次接收事实 |
| 分支 / 基线 | codex/replacement-fabric-acceptance-20260925 / 3a3d16481156a8858155f992aab492cd2cf6bfde + 本次验收修复差异 |
| 工作树 / 服务 | /private/tmp/higoods-replacement-fabric-release-20260925；dev 43235，构建预览 43236；1366×768、1280×720、1024×768、PDA 360/390×800/844 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：新增裁后菜单、换片布票列表和标签；三类混装；交出时需料门禁；Web/PDA/工厂接收历史明细；记录级保存、迁移、备份及失败提示。
- 按 AGENTS.md 第 4、5、7 节执行。存储按第 2.4 节；未达标项仍开放。
- 上游性能和只读调整仅服务本次读取链路：同款技术版本一次读取、初始化期间复用票据来源、读取演示数据不整包写入旧存储；用户主动动作与既有业务范围不因性能调整改变。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 不通过 | 已有标准列表和 PDA 主动作；全部角色入口和权限边界证据未齐 |
| 文案、状态、数量与单位 | 通过 | 固定 5 Yard；新增与补打分开；片/米/Yard 分开；缺票说明材料与恢复动作 |
| 扫码、真实图片与对象识别 | 不通过 | 当前灰面料/卫衣/混装图片与唯一二维码可见；完整失败态与各类历史数据素材待齐 |
| 防错、危险确认与主管兜底 | 不通过 | 缺票、已用票、冲突阻断及保存撤回已有证据；全部入口仍须重放 |
| 交接、跨端事实与异常追溯 | 不通过 | 多袋同次提交和直接随交可回读；全回收周期与全部接收路径待验 |
| 低分辨率、PDA、弱网与上传恢复 | 不通过 | 新列表1366/1280/1024、混装PDA360×800无溢出；无上传入口；全部受影响页尚未覆盖 |
| 命名路由、交互、图片大图与打印 | 不通过 | 部分命名路由、图片预览、PDF软件解码已验；物理出纸/现场扫码与所有交互未齐 |
| 存储与迁移 | 不通过 | 新动作IDB、事务/CAS/幂等通过部分故障测试；满额开页/新增、全新浏览器恢复已通过；旧上下游依赖尚未完整迁移 |
| 页面与交互性能 | 不通过 | 8路由120加载/站内切换样本、列表185交互样本通过；最终版本路由复验最大466.9ms；其余交互仍缺覆盖 |

## 4. 问题标签

- 追溯不足：完整当前证据尚未闭环。
- 协作断裂：旧上游存储禁用时尚不能完成全部链路。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 原袋快照只按片展示 | 算不准 | 仓管/工厂 | 类型和长度独立；保存当次快照；混装详情回读 | 全场景待复核 |
| 缺料校验可能依赖逐袋先后 | 选不对 | 仓管 | 整次提交按任务+工厂求并集再事务保存 | 全入口待验 |
| localStorage 满额/禁用 | 协作断裂 | 全部 | 移除相关静态种子写入；IDB动作失败保留原记录；旧上游未迁移项登记 | 是 |
| 页面冷启动超时 | 视觉干扰 | 仓管 | 限定同步计算复用，不减少验收数据；保留失败和修复后原始样本 | 完整性能证据待齐 |

## 6. 最终结论

结论：不通过

本记录用于明确当前实现、证据与缺口，不作为交付通过回执。总体未完成，不能标记 verified / delivered / accepted。先前版本 3a3d1648 已合并 main、推送 GitHub 并完成演示部署，但当时整体验收未完成。本次继续修复的差异尚未发布；代码发布不代替产品验收。没有生产业务或物理打印完成声明。

## 7. 变更覆盖与验证

### 受管文件

- `src/components/real-qr.ts`
- `src/components/ui/mixed-bag-contents.ts`
- `src/data/app-shell-config.ts`
- `src/data/browser-storage.ts`
- `src/data/fcs/cutting/cutting-backup-file.ts`
- `src/data/fcs/cutting/cutting-event-migration.ts`
- `src/data/fcs/cutting/cutting-event-repository.ts`
- `src/data/fcs/cutting/cutting-record-repository.ts`
- `src/data/fcs/cutting/cutting-record-identity.ts`
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `src/data/fcs/cutting/generated-cut-orders.ts`
- `src/data/fcs/cutting/generated-fei-tickets.ts`
- `src/data/fcs/cutting/handover-orders.ts`
- `src/data/fcs/cutting/mixed-transfer-bag-ticket.ts`
- `src/data/fcs/cutting/replacement-fabric-bag-selection.ts`
- `src/data/fcs/cutting/replacement-fabric-event-validation.ts`
- `src/data/fcs/cutting/replacement-fabric-fei-tickets.ts`
- `src/data/fcs/cutting/replacement-fabric-repository.ts`
- `src/data/fcs/cutting/replacement-fabric-scan.ts`
- `src/data/fcs/cutting/replacement-fabric-source.ts`
- `src/data/fcs/cutting/sewing-dispatch.ts`
- `src/data/fcs/cutting/simple-cut-piece-handover.ts`
- `src/data/fcs/cutting/transfer-bag-goods-label.ts`
- `src/data/fcs/cutting/transfer-bag-operations.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/print-service.ts`
- `src/data/fcs/print-template-registry.ts`
- `src/data/fcs/production-orders.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/runtime-task-read-bridge.ts`
- `src/data/pcs-config-workspace-repository.ts`
- `src/data/pcs-style-archive-repository.ts`
- `src/pages/pda-cutting-context.ts`
- `src/pages/pda-cutting-handover.ts`
- `src/pages/pda-cutting-inbound.ts`
- `src/pages/pda-cutting-save.ts`
- `src/pages/pda-cutting-shared.ts`
- `src/pages/pda-cutting-transfer-bag-recovery.ts`
- `src/pages/pda-cutting-transfer-bag-repack.ts`
- `src/pages/pda-cutting-transfer-bag-scrap.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/pda-transfer-bag-detail.ts`
- `src/pages/print/print-preview.ts`
- `src/pages/print/replacement-fabric-preview.ts`
- `src/pages/print/templates/label-print-template.ts`
- `src/pages/print/templates/replacement-fabric-label-template.ts`
- `src/pages/process-factory/cutting/handover-orders.ts`
- `src/pages/process-factory/cutting/marker-plan-model.ts`
- `src/pages/process-factory/cutting/meta.ts`
- `src/pages/process-factory/cutting/mixed-bag-candidates.ts`
- `src/pages/process-factory/cutting/replacement-fabric-data-tools.ts`
- `src/pages/process-factory/cutting/replacement-fabric-fei-tickets.ts`
- `src/pages/process-factory/cutting/transfer-bags-model.ts`
- `src/pages/process-factory/cutting/transfer-bags-projection.ts`
- `src/pages/process-factory/cutting/transfer-bags/detail.ts`
- `src/pages/process-factory/cutting/wait-handover-actions.ts`
- `src/pages/process-factory/cutting/wait-handover-dialogs.ts`
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/simple-cut-piece-handover-ui.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/routes-fcs.ts`

### 页面路由

- `/fcs/craft/cutting/replacement-fabric-fei-tickets`
- `/fcs/craft/cutting/warehouse-management/wait-handover`
- `/fcs/craft/cutting/transfer-bags`
- `/fcs/craft/cutting/transfer-bag-detail`
- `/fcs/craft/cutting/handover-orders`
- `/fcs/craft/cutting/handover-records/:id`
- `/fcs/pda/cutting/inbound/:taskId`
- `/fcs/pda/cutting/transfer-bag/repack`
- `/fcs/pda/cutting/transfer-bag/recovery`
- `/fcs/pda/cutting/transfer-bag/scrap`
- `/fcs/pda/transfer-bag-detail`
- `/fcs/pda/cutting/simple-cut-piece-handover`
- `/fcs/pda/handover/:id`
- `/fcs/print/preview?documentType=REPLACEMENT_FABRIC_LABEL`

路由存在不代表全部已验；逐项状态见实施追踪矩阵和 `output/playwright/hpb/` 脚本/原始结果。

### 验证命令

- `node --import tsx --test tests/unit/replacement-fabric-*.test.ts`：通过，21条；覆盖最终身份与事件版本规则。
- 装袋/重装回收/货物标识/接收投影/车缝交出/PDA裁床上下文/唛架公式相关专项：已执行结果见证据目录；最后差异重新核查中。
- `npm run build`：通过；最终差异已重测。
- `npx tsc --noEmit`：失败，6处原有基线错误，无本任务新增错误；最终差异已重测。
- 后道默认演示/完整流程专项：源模块不落盘改动后均通过。
- `npm run check:list-page-governance`：通过，含静态、模板浏览器和原型治理检查。
- `npm run check:prototype-design-governance -- --all`：通过，63个受管文件均有记录。
- `workflow:verify`：未运行（总体尚未达到verified，未以收据替代未通过门禁）。

### 真实图片验证

- 面料来自生产技术资料对应图片，示例 `/materials/fei-ticket/grey-main-fabric.png`；卫衣来自该生产单技术包的款图。没有用色块/图标代替素材。
- 列表/详情中缩略图与物料编码、名称、颜色同块；混装裁片按生产单对应款图。
- 新列表大图5次可打开，关闭按钮和 Esc 可关闭；长字段与第1001号标签完整放入100×100mm，PDF两页软件二维码识别成功。现场实物打印/扫码未验收。
- 当前证据不覆盖所有缺图/失败/遮罩关闭及全部历史票，UX-002/003保持开放。

### 证据和例外

- [实施追踪](../product-design/换片布菲票实施追踪-2026-09-24.md)登记全部92条需求、实际文件、证据和缺口。
- 无性能豁免授权，不采用1秒例外。未通过项不能以本记录关闭。

### 例外

- 无

### 本轮高风险审查

- 检查了票据身份、整个提交集合、直接交出、历史读取、源变化保护、事务提交时点和局部原型存储范围。修复备份回执借用原票编号但改变面料的缺口；原始失败契约和修复后契约均保留。
- 源读取失败不再作为稳定哨兵继续提交，明确未保存；完整上游迁移问题仍不通过。
- 固定派单演示数据跳过落盘仅限两处静态种子，用户主动分配默认写入行为保留，未声称该上游已迁移。
- 开发服务出现过两个交互慢样本，保留原始结果；优化构建上的对应37项交互共185样本通过，不能混为同一服务的结果。

- TKT-005/STORE：局域网HTTP下缺少Web Crypto安全上下文API，已复现原页面打不开；增加相同SHA-256摘要和getRandomValues随机编号后，票身份算法保持一致。21条契约包括UTF-8/块边界摘要比对和1000次UUID无重复。LAN下开页、新增、打印确认、刷新回读5次通过，票号保持一致。

- HAND-008/FACT：第二批裁剪追加后部位票缓存曾未失效，已复现；缓存签名补充静态与已提交事件版本，避免改用记录级存储后继续只看旧键。版本不变时仍复用缓存。

- 同单跨厂复验：第一家700片+1票、后续200片+0票；第二家先缺票阻断、旧票拒绝，再新增第2票后交720片。两条换片布回执分别属于两个任务/工厂。

## 2026-09-25 main 发布复验

用户明确要求本地合并并推送 GitHub。以 main `416f760adfe93d906aeb1f724ee55d2f769ed0f0` 为发布集成基线，源文件无重叠冲突。补齐 `scripts/check-pda-cutting-transfer-bag-handover.ts` 对事务参数的契约（SCOPE-002、HAND-001、STORE-003），保留原有业务断言；未修改业务实现或基线检查脚本。合并复验结果、原始失败和收据说明见 [发布复验记录](../product-design/replacement-fabric-evidence/2026-09-25/publication/README.md)。本记录总体结论仍为 **未完成**，不因 Git 提交或远端部署而改成产品通过。

## 本次继续验收的新增覆盖

本节以当前工作树实际差异为准。前文未关闭结论将在同版实测全部通过后逐项更新，旧失败证据保留。

- 上游生产来源：7 类来源按实体读取、迁移与动作事务；样衣演示基线先构造再叠加用户记录，刷新不覆盖已移交事实。
- 部位票来源：8 个旧键（票、打印任务、草稿、手工票、铺布、唛架来源、旧袋账、唛架定义），复用同一记录库、CAS 和明确迁移；正常读取不落盘种子。
- 交出与历史：裁后事件、换片布回执、旧裁片领取归档同事务关联；归档只处理 CUT_PIECE，不清理辅料记录；附件按 Blob 和引用保存。
- 改派：独立裁剪任务整单改派；改派审计身份参与责任范围键，返回同一工厂且填写相同业务日期也不恢复旧票资格。
- 保存反馈：事务失败保留用户输入；部分落盘不被提示为成功；同动作幂等重试。
- 性能修复：菲票动作直接分派；铺布与 PDA 复用当次真实来源计算，避免无关模块初始化。

### 本次差异中的受管文件

- `src/data/fcs/cut-piece-release.ts`
- `src/data/fcs/cutting/cut-piece-return-domain.ts`
- `src/data/fcs/cutting/cutting-event-migration.ts`
- `src/data/fcs/cutting/cutting-event-repository.ts`
- `src/data/fcs/cutting/cutting-event-scope.ts`
- `src/data/fcs/cutting/cutting-file-maintenance.ts`
- `src/data/fcs/cutting/cutting-record-identity.ts`
- `src/data/fcs/cutting/cutting-record-repository.ts`
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `src/data/fcs/cutting/generated-fei-tickets.ts`
- `src/data/fcs/cutting/handover-orders.ts`
- `src/data/fcs/cutting/manual-fei-tickets.ts`
- `src/data/fcs/cutting/marker-plan-source.ts`
- `src/data/fcs/cutting/material-ledger.ts`
- `src/data/fcs/cutting/part-ticket-records.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/replacement-fabric-repository.ts`
- `src/data/fcs/cutting/replacement-fabric-scan.ts`
- `src/data/fcs/cutting/replacement-fabric-source.ts`
- `src/data/fcs/cutting/retired-cut-piece-pickup-history.ts`
- `src/data/fcs/cutting/runtime-inputs.ts`
- `src/data/fcs/cutting/sewing-dispatch.ts`
- `src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts`
- `src/data/fcs/cutting/simple-cut-piece-handover.ts`
- `src/data/fcs/cutting/transfer-bag-operations.ts`
- `src/data/fcs/cutting/transfer-bag-repack-mock.ts`
- `src/data/fcs/dispatch-task-sheet.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/effective-task-assignments.ts`
- `src/data/fcs/garment-spu-replacement.ts`
- `src/data/fcs/pda-cutting-execution-source.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/production-context-actions.ts`
- `src/data/fcs/production-context-records.ts`
- `src/data/fcs/production-contracts.ts`
- `src/data/fcs/production-created-process-source-types.ts`
- `src/data/fcs/production-created-process-sources.ts`
- `src/data/fcs/production-order-demo-tech-packs.json`
- `src/data/fcs/production-order-runtime-store.ts`
- `src/data/fcs/production-orders.ts`
- `src/data/fcs/production-return-fulfillment.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/sewing-cut-piece-responsibility.ts`
- `src/data/fcs/sewing-cut-piece-return-workflow.ts`
- `src/data/fcs/sewing-material-handover.ts`
- `src/data/fcs/sewing-outsourcing-demo.ts`
- `src/data/fcs/sewing-outsourcing-responsibility.ts`
- `src/data/fcs/sewing-outsourcing-return-tracking.ts`
- `src/data/fcs/sewing-outsourcing-workbench.ts`
- `src/data/fcs/sewing-sample-approval-suggestion.ts`
- `src/data/fcs/special-craft-task-orders.ts`
- `src/data/fcs/wool-domain/cutting-receipts.ts`
- `src/data/fcs/wool-domain/store.ts`
- `src/data/pcs-sku-archive-repository.ts`
- `src/pages/dispatch-tenders.ts`
- `src/pages/pda-cutting-spreading.ts`
- `src/pages/pda-cutting-task-detail.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/pda-shell.ts`
- `src/pages/pda-task-receive.ts`
- `src/pages/print/print-preview.ts`
- `src/pages/print/replacement-fabric-preview.ts`
- `src/pages/print/task-delivery-card.ts`
- `src/pages/print/task-route-card.ts`
- `src/pages/print/templates/label-print-template.ts`
- `src/pages/process-factory/cutting/craft-trace-projection.ts`
- `src/pages/process-factory/cutting/cut-orders-model.ts`
- `src/pages/process-factory/cutting/fei-ticket-print-projection.ts`
- `src/pages/process-factory/cutting/fei-tickets-model.ts`
- `src/pages/process-factory/cutting/fei-tickets-projection.ts`
- `src/pages/process-factory/cutting/fei-tickets.ts`
- `src/pages/process-factory/cutting/marker-plan-model.ts`
- `src/pages/process-factory/cutting/marker-plan-occupancy.ts`
- `src/pages/process-factory/cutting/marker-plan-projection.ts`
- `src/pages/process-factory/cutting/marker-plan.ts`
- `src/pages/process-factory/cutting/marker-spreading-submit-actions.ts`
- `src/pages/process-factory/cutting/marker-spreading.ts`
- `src/pages/process-factory/cutting/material-prep-model.ts`
- `src/pages/process-factory/cutting/replacement-fabric-data-tools.ts`
- `src/pages/process-factory/cutting/runtime-projections.ts`
- `src/pages/process-factory/cutting/traceability-projection-helpers.ts`
- `src/pages/process-factory/cutting/transfer-bags-projection.ts`
- `src/pages/process-factory/cutting/transfer-bags.ts`
- `src/pages/process-factory/cutting/transfer-bags/handlers.ts`
- `src/pages/process-factory/cutting/transfer-bags/state.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/production-context-recovery.ts`
- `src/pages/production-contract-print.ts`
- `src/pages/production/confirmation-print.ts`
- `src/pages/production/context.ts`
- `src/pages/production/demand-domain.ts`
- `src/pages/production/events.ts`
- `src/pages/progress-handover.ts`
- `src/pages/sewing-outsourcing/responsibility-transfers.ts`
- `src/pages/sewing-outsourcing/sample-approval-suggestions.ts`
- `src/pages/unified-dispatch-workbench.ts`
