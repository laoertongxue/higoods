# 盘扣及新增辅助工艺原型变更治理记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-20 |
| 相关需求 / 任务 | 新增盘扣（捆条）、花朵／打褶／烫钻（裁片），补齐工厂、技术包、加工单、仓库、Web、PDA、打印和中央辅料仓闭环 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS / FCS / PFOS / WLS |
| 涉及页面路径 | 工艺字典、技术包纸样池、四个工艺加工单、盘扣详情、捆条菲票工作台与打印预览、PDA 交接／执行、中央辅料仓收货 |
| 端类型 | 管理端 / 主管端 / 员工执行端（PDA） |
| 主要角色与任务 | 技术包维护人逐条维护捆条；辅助工艺厂计划／操作员接收、加工、交出、完成；中央辅料仓按个收货 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：新增四项工艺和独立菜单；技术包纸样包新增多捆条及逐条盘扣选择；盘扣加工单新增投入张／追溯米／产出个双口径；Web、PDA、厂内仓、中央辅料仓和 100mm × 100mm 黄白捆条菲票均产生新的页面、字段、状态、数量、Mock、路由和交互；同时调整工厂名称与归属。

当前审查以 `AGENTS.md` 第 4、5、7 节为基线；未出现基线未覆盖的争议项，因此未读取两份历史长文档。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | Web 保持管理端信息密度；PDA 以当前对象和当前动作组织，交接与执行分面明确。 |
| 文案、状态、数量与单位 | 通过 | 投入“张”、长度“米（仅追溯）”、产出／交出／收货“个”均带单位；不计算每件衣服盘扣数。 |
| 扫码、真实图片与对象识别 | 通过 | PDA 保留生产单／加工单扫码入口及当前款式图片；盘扣投入逐张展示菲票号、捆条名称和长度。 |
| 防错、危险确认与主管兜底 | 通过 | 未接收不能填报、非正整数阻断、超待交出量阻断、待交出不为零不能完成、黄白混打阻断。 |
| 交接、跨端事实与异常追溯 | 通过 | Web/PDA 共用动作事实；厂内待加工／待交出与中央辅料仓读取同一盘扣流转事实；分两次交出和收货后累计数量仍一致。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | PDA 命名页面小屏场景完成四动作；本次没有上传；写回沿用现有即时反馈和失败提示。 |
| 命名路由、交互、图片大图与打印 | 通过 | 命名 Web/PDA/WLS 路由已真实浏览器重放；黄色盘扣菲票实际边界约 100mm × 100mm。 |

## 4. 问题标签

- 无。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 纸样池演示包重建时未继承源技术包捆条，页面错误显示零条 | 协作断裂 | 技术包维护人 | 演示包首包继承源捆条，浏览器确认显示两条且仅一条选择盘扣 | 否 |
| 盘扣黄票使用未注册模板码，打印预览无法生成 | 点错风险 | 打印操作员 | 复用已注册黄色／白色热敏菲票模板码，继续用纸色和内容区分 | 否 |
| PDA 盘扣页面套用了通用裁片逐票“完工／交出张数”，与盘扣产出“个”冲突 | 算不准 | APF 操作员 | 盘扣隐藏通用裁片进度，只显示投入菲票和盘扣累计产出／交出个数；增加浏览器回归断言 | 否 |
| FLOWER 原默认仓只覆盖烫画／直喷的部分加工对象组合 | 协作断裂 | FLOWER 仓管 | 补齐烫画／直喷各自“成衣”和“裁片”四组默认库区，综合契约精确反查 | 否 |
| 盘扣首次部分交出后，待交出仓剩余数量被错误清零 | 算不准 | APF 交出人员 | 只在全部交出后归零；首次交出 10 个后保留待交出 14 个和“待交出”状态 | 否 |
| 中央辅料仓先收 10 个后，第二次交出会覆盖前次已收数量 | 协作断裂 | 中央辅料仓收货人员 | 同一加工单保留一条累计收货记录，第二批只新增待收 14 个，最终累计已收 24 个 | 否 |
| 旧捆条需求明细没有 `specialCrafts` 字段，新代码直接 `.map()` 导致既有捆条流程报错 | 历史兼容 | 裁床与打印人员 | 旧字段缺失统一按空数组读取；正式收据中的既有捆条全流程已恢复通过 | 否 |
| 捆条菲票从 A4 多列改为单张 100mm × 100mm 后，普通票标题和 SPU 没有进入单张标签 | 识别不清 | 打印与收货人员 | 白票／黄票均在单张标签中保留标题和 SPU；旧专项逐字段回归，黄票浏览器截图再次核对 | 否 |

## 6. 最终结论

结论：通过。

说明：最后一次实质修改后，正向需求验收与反向历史兼容审查均已重跑；任务专项、真实浏览器、既有捆条主流程、裁床全链路、列表／原型治理、构建和 CodeGraph 均闭环，正式任务收据状态为 `verified`、无 blocker。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/button-loop-accessory-receipts.ts`
- `src/data/fcs/button-loop-craft-flow.ts`
- `src/data/fcs/factory-internal-warehouse-locations.ts`
- `src/data/fcs/factory-master-store.ts`
- `src/data/fcs/process-action-writeback-service.ts`
- `src/data/fcs/process-craft-dict.ts`
- `src/data/fcs/process-warehouse-linkage-service.ts`
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`
- `src/data/fcs/production-tech-pack-snapshot-types.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/special-craft-dedicated-factories.ts`
- `src/data/fcs/special-craft-operations.ts`
- `src/data/fcs/special-craft-pda-scope.ts`
- `src/data/fcs/special-craft-task-orders.ts`
- `src/data/fcs/store-domain-pda.ts`
- `src/data/fcs/tech-packs.ts`
- `src/data/pcs-tech-pack-review-diff.ts`
- `src/data/pcs-technical-data-version-bootstrap.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-technical-data-version-types.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/print/templates/label-print-template.ts`
- `src/pages/process-factory/cutting/binding-strip-orders.ts`
- `src/pages/process-factory/cutting/fei-tickets.ts`
- `src/pages/process-factory/cutting/special-processes-model.ts`
- `src/pages/process-factory/special-craft/shared.ts`
- `src/pages/process-factory/special-craft/task-detail.ts`
- `src/pages/process-factory/special-craft/task-orders.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/tech-pack/events.ts`
- `src/pages/tech-pack/pattern-domain.ts`
- `src/pages/wls-accessory-receipts.ts`

### 页面路由

- `/fcs/production/craft-dict`
- `/pcs/products/styles/style_demand_SPU_2024_009/technical-data/tdv_demand_SPU_2024_009`
- `/pcs/products/styles/style_seed_project_018/technical-data/tdv_seed_project_018_review_skip_demo`
- `/fcs/process-factory/special-craft/aux-op-button-loop/tasks`
- `/fcs/process-factory/special-craft/aux-op-button-loop/tasks/AUX-BUTTON-981f14ec`
- `/fcs/craft/cutting/binding-fei-tickets`
- `/fcs/print/preview?templateCode=FEI_TICKET_YELLOW_THERMAL&paperColor=YELLOW&...`
- `/fcs/pda/exec/AUX-BUTTON-981f14ec?surface=handover&handoverAction=receive`
- `/fcs/pda/exec/AUX-BUTTON-981f14ec`
- `/fcs/pda/exec/AUX-BUTTON-981f14ec?surface=handover&handoverAction=handout`
- `/wls/accessory-receipts`

### 验证命令

- `npm run check:button-loop-auxiliary-crafts`：通过；最后一次实质修改后重跑，覆盖字典、工厂、技术包快照、任务聚合、张／米／个、分次交出、累计收货、仓储和打印。
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=4224 npx playwright test tests/button-loop-auxiliary-crafts.spec.ts --workers=1 --reporter=line`：通过；最终 2/2 通过（18.3s），正向和反向两轮均实际重放。
- `node --import tsx scripts/check-cutting-binding-strip-flow.ts`：通过；20 条既有捆条需求、17 张加工单、22 张唯一菲票及旧字段兼容均通过。
- `npm run build`：通过，2354 个模块完成构建；仅保留既有大 chunk 提示。
- 技术包目标对象／版本、纸样详情／解析、弹窗稳定、快照消费、工艺分类、菜单、厂内仓、领交仓、工厂拆分、PDA 单一事实和 Web 弹窗专项：全部通过。
- `npm run check:list-page-governance`：通过；扫描 358 个页面，Chromium 列拖拽及模板检查通过。
- `npm run check:prototype-design-governance -- --all`：通过；33 个用户可见文件全部关联本记录。
- `npm run workflow:verify -- --output /private/tmp/higoods-button-loop-task-receipt.json --task-boundary "盘扣、花朵、打褶、烫钻辅助工艺；技术包多捆条、工厂与仓库、加工单、Web/PDA、100mm菲票及中央辅料仓"`：通过；授权环境最终状态 `verified`，blocker 为空，其中 `check:cutting:all`、治理和构建全部通过。
- CodeGraph：1521 个文件、46938 个节点、160022 条边，无待同步文件。

### 当前页面证据

- `test-results/playwright/button-loop-auxiliary-crafts-*/01-tech-pack-binding-strips.png`
- `test-results/playwright/button-loop-auxiliary-crafts-*/01b-tech-pack-binding-strip-editor.png`
- `test-results/playwright/button-loop-auxiliary-crafts-*/02-web-button-loop-task.png`
- `test-results/playwright/button-loop-auxiliary-crafts-*/03-button-loop-yellow-fei-ticket.png`
- `test-results/playwright/button-loop-auxiliary-crafts-*/04-central-accessory-warehouse.png`
- `test-results/playwright/button-loop-auxiliary-crafts-*/05-pda-button-loop-process-report.png`
- `test-results/playwright/button-loop-auxiliary-crafts-*/06-pda-button-loop-handover.png`
- `test-results/playwright/button-loop-auxiliary-crafts-*/07-pda-button-loop-complete.png`
- `test-results/playwright/button-loop-auxiliary-crafts-*/08-central-accessory-warehouse-received.png`

### 真实图片验证

- 本次没有新增款式或物料对象；技术包、加工单和 PDA 复用 `SPU_2024_009` 的对应款式真实图片事实源。
- PDA 页面保留款式缩略图、加载失败提示及既有大图能力；浏览器截图已核对对象与款号同块展示。
- 捆条菲票属于生产标签，不新增物料照片；打印预览使用对应捆条名称、编码和二维码完成识别。

### 例外

- 无。
