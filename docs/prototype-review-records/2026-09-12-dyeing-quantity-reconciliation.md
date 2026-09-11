# 染厂收发与库存数量统一修复审查记录

## 1. 基本信息
- 日期：2026-09-12。
- 需求：用户本轮授权的接收与库存扣减、交出与下游实收、统计口径统一。
- 记录模式：完整产品审查；FCS/PFOS 管理端、染厂主管端；PDA 仅收口旧交出旁路。
- 版本：`codex/dyeing-dispatch-pages`，起始 HEAD `75f85bad068276f60fe968f7186aa30e74368574`，本次工作区文件哈希见 `output/playwright/dye-quantity-reconciliation/verified-version.json`。
- 服务：当前工作树 `/Users/laoer/Documents/higoods`，5188，局域网 `192.168.5.6`。

## 2. 影响判定
- 用户可见影响：有
- 判定依据：实际投料扣库存，交出与下游实收分别展示；阻断旧数量交出和发送方代收；报表按单位读取同一事实；仓库分页、原单跳转、物料图片同步保持可用。
- 基线：`AGENTS.md` 第 4、5、7 节。

## 3. 自查结论
| 检查项 | 结论 | 证据 |
|---|---|---|
| 角色、任务与页面模式 | 通过 | 染厂登记使用和交出；接收方记录实际接收；管理端查看，不能代收 |
| 文案、状态、数量与单位 | 通过 | 米/Yard/kg 分组；未登记与登记 0 区分；完工不能修改已扣库投入 |
| 图片与对象识别 | 通过 | 物料名称、SKU、缩略图同列；复用现有对应物料图；大图、Esc 与加载失败提示实测 |
| 数量防错 | 通过 | 重复收货、超用、跨厂/错 SKU、重复卷码、旧入口及无包装产出交出阻断 |
| 交接与追溯 | 通过 | 原交出记录回写；仓库、明细和报表一致；未关联备料返回待接收入口 |
| 设备与交互 | 通过 | 1366×768、1280×720；页面无整体横向溢出，宽表内部滚动；列设置/分页局部更新且刷新保留 |
| 命名页面与打印 | 通过 | 7 个染厂模块、加工单统计明细、任务流程卡预览；检查见 browser-results.json |

## 4. 问题标签
- 算不准、协作断裂、追溯不足：本次三项修复范围已处理。

## 5. 主要问题与处理
| 问题 | 处理 | 剩余限制 |
|---|---|---|
| 开工不扣库、重复投料 | 按实际接收行/卷分配本批用料，保存同一事务并阻断超用；完工投入不可修改 | 历史已加工数据仅按原有汇总保留 |
| 备料关联重复库存 | 关联只分配加工单份额；物理库存不再复制 | 不构建生产后端 |
| 多套交出账和代收 | 包装入仓读取节点；逐卷交出才扣产出；原 PDA 实收为唯一回执，旧旁路阻断 | 纱线继续按既有毛重限制及净重库存 |
| 报表混用数量/单位 | 当前库、原交出记录、实际接收、累计包装共用事实；单据筛选保留本单备料份额 | 不扩展差异结案 |

## 6. 最终结论
结论：通过（本轮本地原型范围）。两轮验收为：业务回放及冷启动数量守恒；当前服务页面、局部交互、图片与打印预览。产品接受仍待用户查看，不代表真实仓储已经收发。

## 7. 变更覆盖与验证
### 受管文件
- `src/pages/pda-handover-detail.ts`
- `src/pages/process-factory/dyeing/work-order-detail.ts`
- `src/pages/process-factory/dyeing/reports.ts`
- `src/pages/process-factory/dyeing/events.ts`
- `src/pages/process-factory/dyeing/warehouse.ts`
- `src/data/fcs/factory-receiving.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/process-statistics-domain.ts`
- `src/data/fcs/process-action-writeback-service.ts`
- `src/data/fcs/factory-internal-warehouse.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/factory-receiving-links.ts`
- `src/data/fcs/process-warehouse-linkage-service.ts`
- `src/data/fcs/process-execution-writeback.ts`
- `src/data/fcs/process-web-status-actions.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/dyeing-quantity-facts.ts`
- `src/data/fcs/dyeing-warehouse-view.ts`

### 页面路由
- `/fcs/craft/dyeing/pending-receipts`
- `/fcs/craft/dyeing/work-orders`
- `/fcs/craft/dyeing/pending-handover`
- `/fcs/craft/dyeing/handover-documents`
- `/fcs/craft/dyeing/wait-process-warehouse`
- `/fcs/craft/dyeing/wait-handover-warehouse`
- `/fcs/craft/dyeing/reports`
- `/fcs/craft/dyeing/work-orders/DYE-DISPATCH-DEMO-1?tab=statistics`
- `/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=DWO-001`

### 验证命令
- `node --import tsx scripts/check-dyeing-quantity-reconciliation.ts`：通过；两轮业务/冷启动，实收 100 Yard、投入 80 米再投入 5 米；备料关联 40 Yard 不重复入库；交出 120 Yard、0→55→121 Yard 实收。
- `node --import tsx scripts/check-dye-material-receipts.ts`：通过；同单两批实际交出、实收差异不可由发送方改写。
- `node --import tsx scripts/check-dyeing-workflow.ts`：通过；来源保留、旁路阻断、包装节点门槛、历史投入不可篡改。
- `node --import tsx scripts/check-factory-material-receiving.ts`：通过；原单、混合来源、分次接收、卷码和位置。
- `node --import tsx scripts/check-factory-receiving-integration.ts`：通过；纱线毛净重、冷启动、实际仓位与净重守恒。
- `node --import tsx scripts/check-dyeing-online-gap.ts`：通过；扫码、逐卷建单、部分交出、下游回传、整体回滚。
- `node --import tsx scripts/check-process-order-three-axis-flow.ts`：通过。
- `node_modules/.bin/tsc --noEmit`：通过。
- `npm run build`：通过（已有大块体积提示，不是数量错误）。
- `npm run check:list-page-governance:static`：通过。
- `npm run check:standard-list-page-template`：通过；列拖动、分页及局部区域稳定。
- `npm run check:prototype-design-governance`：通过；另以 validatePrototypeReviewCoverage 对本次 18 个受管文件精确核查。
- `node /private/tmp/dye-quantity-browser.mjs`：通过；隔离测试会话，未清空用户现场数据；截图在 output/playwright/dye-quantity-reconciliation。
- `codegraph sync`、`codegraph status`：通过；索引同步。
- `node --import tsx scripts/check-statistics-dashboard-real-data.ts`：失败；先在未修改的印花页旧静态断言“getPrintingExecutionStatistics”处终止，本次染色数量改由上列专项守恒检查验证，不将全模块旧脚本标为通过。

### 真实图片验证
- 图片沿用 factory-receiving 原物料图、DYE_DEMO_DETAILS 和 process-order-image-manifest 对应图。
- 待加工/待交出仓每项物料与名称/SKU 同列；真实图加载成功，无破图。
- 大图保持比例且在低分辨率内可关闭；material-preview.png、image-failure.png 为实测证据。

### 例外
- `workflow:verify` 未运行：当前工作区在本轮开始前已有 63 项未提交变更，完整任务收据会混入既有交出页/清理工作。依据 AGENTS.md 第 8.1 节，使用本轮文件哈希、专项检查与命名页面证据明确范围，未暂存、提交或搬移原有工作。
- 仓库历史汇总没有原始卷码/库位，明确显示“历史按单汇总、原记录未分库位”，不编造历史实物记录；新接收按真实卷码和选定位置。
- 仅原型本地数据；没有真实后台、GitHub 发布或真实工厂库存动作。
