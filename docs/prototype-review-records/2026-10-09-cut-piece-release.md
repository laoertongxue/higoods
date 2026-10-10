# 裁片放行管理与上下游原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-10-09 |
| 相关需求 / 任务 | 经用户确认的产品方案及 COPY-001～COPY-004，共 88 条原子需求 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS / PFOS / PDA / 车缝外发 / PPIC |
| 涉及页面路径 | 见第 7 节 |
| 端类型 | 管理端、主管端、员工执行端 |
| 主要角色与任务 | 裁床仓管逐票实收、主管放行、计划分配车缝任务、PPIC 跟进裁片与辅料差异 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：移动菜单，目标与放行改为成衣颜色×尺码矩阵；数量读取有效已装袋票和最终工艺逐票实收；保留人工决定与历史交接责任；车缝共享放行余量；默认界面及打印精简文案，隐藏内部来源路径。

当前基线为 AGENTS.md 第 4、5、7 节；文案依据用户指定的[华为《界面用语》](https://developer.huawei.com/consumer/cn/doc/doccenter-ux-design/design-ui-language-0000001795698453)。本记录中的 Mock 与浏览器操作均为原型验证，不是工厂真实生产记录。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 菜单、矩阵、回仓与车缝分配命名页面实际验收 |
| 文案、状态、数量与单位 | 通过 | 必要信息、简短动作、中文状态与片/件单位；内部身份不默认显示 |
| 扫码、真实图片与对象识别 | 通过 | 原二维码身份保持；真实图片与原打印 PDF 已核 |
| 防错、危险确认与主管兜底 | 通过 | 整票、数量、冲突、危险确认与失败输入保留实际验证 |
| 交接、跨端事实与异常追溯 | 通过 | Web/PDA逐票实收、连续工艺、最终回仓和更正历史一致 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1024/1280/1366与390PDA适用场景通过；本次无新增上传或离线队列 |
| 命名路由、交互、图片大图与打印 | 通过 | 适用动作均有5样本≤1000ms原证据；原失败不重标 |

## 4. 问题标签

- 算不准
- 协作断裂
- 追溯不足
- 字段过载
- 视觉干扰

## 5. 主要问题与处理

发现、修复及重放依据详见第一轮和第二轮审查文件，不以代码修复记录代替运行通过。历史超时、事务失败和现场原型边界均保留原始样本。

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 最终工艺实收、每票阶段身份与实际承接厂 | 算不准、协作断裂 | 仓管、计划 | 精确核对来源、工艺顺序和最终实收；专项与真实 UI 已通过 | 已验证 |
| 旧页面保存、未保存输入与数据读取失败 | 追溯不足 | 主管、仓管 | 保存版本与事务完整性校验，保留输入及具体恢复动作 | 已验证 |
| 内部路径、重复提示及技术文案 | 视觉干扰、字段过载 | 所有角色 | 默认呈现短业务名称，保留二维码稳定身份及必要危险影响 | 已验证 |

## 6. 最终结论

结论：通过

本地实现与验证完成：88条需求与S01～S24均有对应实现和证据，两轮对抗审查各88/88通过。应用保持v48，v49仅同步三个旧检查前置；原运行保留v47/v48真实SHA。没有远端发布或最终用户接受回执。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/cutting/transfer-bags-model.ts`
- `src/pages/process-factory/cutting/wait-handover-dialogs.ts`

- `src/main.ts`
- `src/components/ui/mixed-bag-contents.ts`
- `src/data/app-shell-config.ts`
- `src/data/fcs/cut-piece-release-domain.ts`
- `src/data/fcs/cut-piece-release.ts`
- `src/data/fcs/cutting/cut-piece-release-facts.ts`
- `src/data/fcs/cutting/cut-piece-ticket-validity.ts`
- `src/data/fcs/cutting/cutting-event-repository.ts`
- `src/data/fcs/cutting/cutting-record-repository.ts`
- `src/data/fcs/cutting/cutting-runtime-chronology.ts`
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `src/data/fcs/cutting/fei-ticket-numbering.ts`
- `src/data/fcs/cutting/generated-cut-orders.ts`
- `src/data/fcs/cutting/generated-cut-release.ts`
- `src/data/fcs/cutting/manual-fei-tickets.ts`
- `src/data/fcs/cutting/replacement-fabric-event-validation.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/replacement-fabric-fei-tickets.ts`
- `src/data/fcs/cutting/sewing-dispatch.ts`
- `src/data/fcs/cutting/simple-cut-piece-handover.ts`
- `src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts`
- `scripts/check-cutting-sewing-dispatch.ts`
- `src/data/fcs/cutting/special-craft-fei-ticket-flow.ts`
- `src/data/fcs/cutting/special-craft-release-demo-tasks.ts`
- `src/data/fcs/cutting/supplement-order-registry.ts`
- `src/data/fcs/cutting/transfer-bag-operations.ts`
- `src/data/fcs/cutting/transfer-bag-lifecycle.ts`
- `src/data/fcs/process-tasks.ts`
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/special-craft-task-orders.ts`：裁床工艺来源只读取任务资料，工艺厂入口保留原仓库来源校验。
- `src/data/fcs/production-context-actions.ts`
- `src/data/fcs/sewing-assignment-readiness.ts`
- `src/pages/pda-cutting-handover.ts`
- `src/pages/pda-cutting-inbound.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/print/templates/replacement-fabric-label-template.ts`
- `src/pages/print/templates/dispatch-task-sheet-template.ts`
- `src/pages/print/replacement-fabric-preview.ts`
- `src/pages/print/print-preview.ts`
- `src/pages/process-factory/cutting/cut-piece-release.ts`
- `src/pages/process-factory/cutting/fei-tickets.ts`
- `src/pages/process-factory/cutting/marker-plan-model.ts`
- `src/pages/process-factory/cutting/replacement-fabric-fei-tickets.ts`
- `src/pages/process-factory/cutting/supplement-management.ts`
- `src/pages/process-factory/cutting/wait-handover-actions.ts`
- `src/pages/process-factory/cutting/wait-handover-dialogs.ts`
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/sewing-outsourcing/tasks.ts`
- `src/pages/simple-cut-piece-handover-ui.ts`
- `src/pages/unified-dispatch-workbench.ts`

### 页面路由

- `/fcs/craft/cutting/cut-piece-release`
- `/fcs/craft/cutting/fei-tickets`
- `/fcs/craft/cutting/marker-list` / `/fcs/craft/cutting/marker-create` / `/fcs/craft/cutting/marker-detail/:id`
- `/fcs/craft/cutting/replacement-fabric-fei-tickets`
- `/fcs/craft/cutting/supplement-management`
- `/fcs/craft/cutting/warehouse-management/wait-handover`
- `/fcs/dispatch/workbench?type=SEWING`
- `/fcs/sewing-outsourcing/tasks`
- `/fcs/craft/cutting/handover-orders`
- `/fcs/pda/cutting/simple-cut-piece-handover`
- `/fcs/pda/cutting/inbound/TASK-CUT-PDA-NO-PICKUP-0301?action=inbound-location`（390×844，原逐票实收入口）
- `/fcs/print/preview`

本轮 Web 逐票实收、交出及入仓使用 `wait-handover` 原操作窗口；PDA 使用上述实际入仓路由。未将未运行的通用 PDA 交接详情路由作为本轮验收证据；最终截图、动作与地址仍须按当前原始记录联查。

### 验证命令

- `npm run build`：通过，741项单元检查及Vite构建。
- `npm run check:cutting:all`：通过，13项全部通过。
- `npm run check:prototype-design-governance -- --all`：通过，51份用户可见文件。
- `npm run check:list-page-governance`：通过，包含真实Chromium列拖动。
- `npm run workflow:verify`：通过，最终检查全部通过，见task-receipt.json和final-checks-v49.json。此后仅更新审查结果记录，不改应用源码、资产或检查脚本。

### 真实图片验证

原型使用现有正式款式 / 物料图片及 `public/materials/sources.json` 记录的来源。最终浏览器证据已核对对象与缩略图、原图预览、关闭 / Esc / 失败状态及必要图片解码。ROOT亲看原18张页面图、打印关键图及v48真实视口回仓/库存图。

### 例外

- 无性能例外；尚未通过的样本不作有条件通过处理。
- 本次不新增文件上传、云端业务、真实身份鉴权或离线队列，文件新上传不适用；现有备份/恢复仍核对新增业务记录、原有文件引用和冲突保护。
- 旧编号动作的存储未被本轮迁移；本轮真实手动无铺布层序票免编号且不产生新编号写入，不声称全站 localStorage 改造完成。

### v47 当前已完成的页面证据

ROOT 命名页面 630 个原始性能样本全部通过，包含首次加载、保存、事务中止、版本冲突、未保存离开、低分辨率、图片、补料和资料迁移。18 张截图已由 ROOT 实际逐张阅读。结果在 `evidence/2026-10-09-cut-piece-release/root-final-evidence-index.json`、`ui-browser.json` 及其关联原始文件；回仓、车缝、打印与最终两轮审查均另有完整证据，见receipt-browser.json、dispatch-browser.json与两轮审查记录。

冷页面外部采集器曾把额外全库审计放入物理绘制时间，原 v47 1002.6 ms 样本原样保留。新采集采用导航前只读观察器记录真实页面就绪端点，全库审计仍为另行必须通过的功能门禁；只能用新实际样本验收，不能扣减旧样本生成通过结果。
