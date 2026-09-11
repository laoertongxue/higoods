# 染色交出页面与旧入口清理验收

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-12 |
| 相关需求 / 任务 | 2026-09-11-dyeing-dispatch-design.md；原子矩阵 23 项 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PFOS / FCS |
| 涉及页面路径 | /fcs/craft/dyeing/pending-handover；/fcs/craft/dyeing/handover-documents |
| 端类型 | 管理端 / 主管端 |
| 主要角色与任务 | 染厂仓管按实物卷建交出单、核对、登记运输和实际交出；下游独立登记实收 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：移除旧批次菜单、路由、页面、领域、投影、样例与检查，保留单张加工单、水溶和已执行变更保护；增加独立待交出列表、交出单据及打印，复用卷码和实际交接事实。更新历史文档中的旧名称并标明相应旧规范已失效；未改变无关历史业务结论。
- 基线：AGENTS.md 第 4、5、7 节；使用本项目工厂设计技能，未加载被禁用的工作流。
- 分支 codex/dyeing-dispatch-pages；基准 HEAD 75f85bad068276f60fe968f7186aa30e74368574 + 本次工作区差异。
- 服务：同一工作树 /Users/laoer/Documents/higoods，Vite PID 28328，端口 5188；当前局域网地址 192.168.5.6:5188 已返回 200（网络地址已由旧网段变化）；验收是本地 Mock，没有操作线上业务。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 两个标准管理列表，批量动作位于列表表头，纱线有独立入口 |
| 文案、状态、数量与单位 | 通过 | 草稿仅占卷；实物交出才记交出；不同单位分别统计，实收回传原单位 |
| 扫码、真实图片与对象识别 | 通过 | 错卷与重复扫码阻断；12 张列表缩略图加载正常，点击大图和失败提示已验证 |
| 防错、危险确认与主管兜底 | 通过 | 未维护/未打印/跨厂/占用/超量阻断；实物交出和作废二次确认，存储失败回滚 |
| 交接、跨端事实与异常追溯 | 通过 | 新交出回写原 PDA 交出事实，工厂下游生成独立待接收；58 Yard 实收回传且入库不重复 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768、1280×720；页面宽度 1280/1280，宽表内部滚动；本次无新 PDA/上传流程，库存接收沿用已验证入口 |
| 命名路由、交互、图片大图与打印 | 通过 | 两轮路线验收；查询输入和查询后根节点不替换；条码返回刷新；大图 Esc 仅关闭最上层；A4 横向 PDF 一页 |

## 4. 问题标签

- 无（以下验收发现已修复）

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 首次操作经大型事件入口延迟 | 组件误用 | 仓管 | 对命名页面使用轻量事件入口，局部更新 | 否 |
| 卷标签变更后旧打印标记仍有效 | 点错风险 | 仓管 | 标签字段变更清除打印标记，未变化保留；要求重打 | 否 |
| 条码关闭未刷新列表、子弹窗关闭后焦点丢失 | 协作断裂 | 仓管 | 关闭回调刷新待交状态，恢复主弹窗焦点 | 否 |
| 大图 Esc 连带关闭详情 | 点错风险 | 仓管 | 保留详情，只关闭大图；两个场景复测通过 | 否 |
| 下游 Yard 直接回填米单据 | 算不准 | 上下游仓管 | 按原单单位换算；58 Yard = 53.0352 米契约通过 | 否 |

## 6. 最终结论

结论：通过

两轮功能与页面验收完成；项目治理与任务收据已通过，最终文档状态更新后复核收据绑定。此记录不代表已提交 GitHub 或产品接受。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/combined-dyeing-deep-link.ts`
- `src/data/fcs/combined-dyeing-domain.ts`
- `src/data/fcs/dye-work-order-combined-dyeing-view.ts`
- `src/data/fcs/dye-work-order-demo-details.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/process-order-image-manifest.ts`
- `src/data/fcs/process-order-input-transfer-fixtures.ts`
- `src/data/fcs/process-work-order-domain.ts`
- `src/data/fcs/production-process-work-order-service.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/pages/process-factory/dyeing/barcode-dialog.ts`
- `src/pages/process-factory/dyeing/combined-dyeing.ts`
- `src/pages/process-factory/dyeing/dispatch-print.ts`
- `src/pages/process-factory/dyeing/events.ts`
- `src/pages/process-factory/dyeing/output-documents.ts`
- `src/pages/process-factory/dyeing/work-order-detail.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/routes-fcs.ts`

其他：src/main.ts 的命名根节点事件入口；package.json 的专项命令；相关删除/数量/菜单检查；22 份历史文档。清理 75 份旧输出文本引用，删除已定位的过期临时 TS 和旧 diff，不改写 Git 历史或依赖。

### 页面路由

- /fcs/craft/dyeing/pending-handover
- /fcs/craft/dyeing/handover-documents
- /fcs/craft/dyeing/pending-receipts?sourceId=DYE-DISPATCH-SJ-DYE-1789143872806-5-DYE-DISPATCH-DEMO-1
- /fcs/craft/dyeing/work-orders（字段、图片和既有操作契约）
- 旧批次路由实测显示页面未找到。

### 验证命令

- `npm run check:dyeing-dispatch`：通过；多单多卷、逐卷扫码、打印门槛、跨厂/重复/超量、实物交出、下游实际接收、刷新库存不重复、事务回滚。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过；工程类型检查 0 错误，25/25 单元测试，Vite 构建成功；既有包体积警告。
- `node --import tsx scripts/check-dyeing-workflow.ts`：通过。
- `node --import tsx scripts/check-production-process-work-order-generation.ts`：通过。
- `node --import tsx scripts/check-production-order-changes.ts`：通过。
- `node --import tsx scripts/check-dye-work-order-online-alignment.ts`：通过。
- `node --import tsx scripts/check-process-factory-warehouse-menu-consolidation.ts`：通过。
- `node --import tsx scripts/check-process-route-full-stage-delivery.ts`：通过，56 项登记契约。
- `node --import tsx scripts/check-dyeing-parity-20260910.ts`：通过，22 张完整资料/图片。
- `node --import tsx scripts/check-factory-receiving-integration.ts`：通过，含纱线三种管重、毛重上限和库存净重。
- `node --import tsx scripts/check-dyeing-list-sections.ts`：通过，22 行资料、上下游、数量分段及备注。
- `node --import tsx scripts/check-menu-routes.mjs`：通过，180 路由、0 缺失、0 重复。
- `npm run check:prototype-design-governance -- --all`：通过，21 个可见受管文件及 5 份记录覆盖。
- `npm run workflow:verify`：通过；所有受影响检查退出 0，CodeGraph 同工作树、待同步 0。收据位于 output/verification/dyeing-dispatch/task-receipt.json。首次因记录命令格式未通过已修正。


### 两轮直接证据

证据目录：output/playwright/dyeing-dispatch-20260911/。

第一轮：round1-pending-final.png、round1-scanned-final.png、round1-confirmed-final.png、round1-print-final.png、round1-dispatch.pdf。从两张加工单各选 1 卷，120 Yard / 109.73 米，逐卷扫描，运输保存，实际交出；两个下游来源各 60 Yard。专项子进程证实草稿/已交出/原交出记录/58 Yard 实收冷启动恢复。

第二轮：round2-documents-1280.png、round2-joined.png、round2-void.png、round2-barcode.png、round2-image-preview.png、round2-image-failure.png、round2-pending-final.png、round2-downstream.png。合入已有单变为 3 张加工单/3 卷；作废释放可选。页大小 10 刷新保留，拖动顺序和冻结/显示保留。展开筛选按钮 Y=390，收起 Y=322，均为查询、重置、更多筛选同一行。页面宽度 1280，内容宽度 1280。图片加载 12/12，失败态经拦截单个图片请求验证并恢复。

### 真实图片验证

复用 public/materials/process-orders 和 public/materials/fei-ticket 已有对应棉布、针织布、里布、卫衣布图；与具体名称、SKU 同列。打印的 4 张图（两种物料各商品/产出）均加载成功。大图保持比例，1280 下可读，关闭按钮/遮罩/Esc 使用既有图片组件；Esc 修复后保持单据详情。

### 例外

- 历史 check-process-work-order-unification.ts 的印花详情静态文案断言失败（要求“需求来源”）。印花详情文件与 HEAD 完全一致，基准文件也没有这个字串；本次未改无关印花界面。相关染色、生产变更、水溶、接收和菜单用专项检查覆盖，不把此旧检查声称为通过。
- 浏览器验收若因等待旧文案或控件选择器不匹配而中断，已按实际页面修正并重跑；只有上列最终证据作为验收结论。首次旧截图不作为最终交付依据。
