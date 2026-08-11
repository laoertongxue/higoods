# 印花加工单投入产出、双状态与打印完整调整审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-10 |
| 相关需求 / 任务 | 印花加工单需求来源、加工投入、固定加工产出、投入调整、加工/交出双状态和三类打印完整调整 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PFOS / 统一打印预览 |
| 涉及页面路径 | `/fcs/craft/printing/work-orders`、详情、产出接收、统计、大屏、三类 `/fcs/print/preview` |
| 端类型 | 管理端 / 主管端 |
| 主要角色与任务 | 计划/管理维护来源与投入；加工厂接收并完成；交出人员交出；下游清点接收；主管处理换料和差异 |
| 当前分支 / 基准 HEAD | `main` / `ecad0a17ef4dc47d020a3bcef15346b5f0eeffd2` |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：重组印花加工单列表、详情、筛选、汇总、状态、动作和打印入口；新增计划/实际投入、单位用量与投入调整；固定加工产出；加工状态与交出状态分离；把下游“审核/回写”改为接收；补齐信息单、确认单和产出卷条码的预览、下载/打印、编辑与批量能力；所有款式、面料和花型补齐对应图片、失败态及大图。

审查基线为 `AGENTS.md` 第 4、5、7 节。本次没有修改治理基线，也没有使用历史长文档替代当前代码和命名页面证据。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理列表保持标准宽表；详情围绕来源、投入、产出、当前动作；接收页只承担下游接收。 |
| 文案、状态、数量与单位 | 通过 | 加工五态、交出六态分别展示；可见文案统一“交出、接收”；Y/M 两位、KG 三位、单位用量四位、卷数整数。 |
| 扫码、真实图片与对象识别 | 通过 | 商品、投入、产出、正/里面花型均有本地对应图片；缩略图与标识绑定；可打开大图；打印含二维码/条码。 |
| 防错、危险确认与主管兜底 | 通过 | 跨规格必须重确认单位用量；有完成数量阻断整单换料；数量逐层上限、重复条码和无效卷属性阻断；取消/换料保留原因。 |
| 交接、跨端事实与异常追溯 | 通过 | 加工状态与交出状态独立；交出、接收、差异、异议分别记录；业务完成派生；投入变更和打印历史可追溯。 |
| 低分辨率、PDA、弱网与上传恢复 | 有条件通过 | 本次是管理端原型，1366×768 已验收；不新增 PDA、真实接口、上传或离线能力，相关项不在范围。 |
| 命名路由、交互、图片大图与打印 | 通过 | 列表、详情、换料、接收投入、完成、条码编辑、三类打印和批量确认均在最终版本回放；3/3 Playwright 通过。 |

## 4. 问题标签

- 无未解决的本次范围产品问题。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 旧页面把等花型/打印/转印与交出接收揉成一套状态 | `状态抽象` | 管理、加工厂、下游接收 | 改为加工五态 + 交出六态；旧细状态只读提示；旧进度渲染入口收口到新版列表 | 否 |
| 临时换面料只有 SKU，没有用量依据和实际接收事实 | `算不准`、`追溯不足` | 计划、加工厂接收 | 同屏维护标准/加工单单位用量、计划/实际 SKU 与数量；跨规格重确认并重算；完整变更历史 | 否 |
| `待审核/待回写` 不能表达下游清点收货 | `读不懂`、`协作断裂` | 交出人员、下游接收 | 页面动作和状态统一为交出、接收；可见源码反向扫描不再出现审核/回写动作 | 否 |
| 线上打印能力遗漏或成为第四套状态维护 | `协作断裂` | 加工执行、仓管 | 仅保留信息单、确认单、产出卷条码三类入口；确认单纸面区不变成系统状态；卷属性含完整单位和精度 | 否 |
| 款式、投入、产出或花型图片与对象分离 | `选不对` | 管理、加工厂 | 每个对象同块缩略图、替代说明、失败态、大图；打印同步显示真实对象图 | 否 |

## 6. 最终结论

结论：通过（本次命名范围）

说明：

- 40 条原子需求全部达到“已验证”，详见《印花加工单需求追踪与交付矩阵》。
- 页面没有采信线上“采购单数量 572”，不展示也不解释该数字；打印模板不包含 `Edit confirmation`；KG 全链路保持 3 位小数。
- 当前原型使用 6 张组合 Mock 覆盖生产、采购、备货、补料以及五种加工状态、六种交出状态；这些数据仅为原型证据。
- `/fcs/process/print-orders` 是另一个平台页，不计入本审查记录的 40 条印花工厂原子需求；其分页局部刷新问题已由 2026-08-11 独立治理任务修复并单独留证。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/printing-work-order-business.ts`
- `src/data/fcs/print-service.ts`
- `src/data/fcs/print-template-registry.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/pages/process-factory/printing/work-order-detail.ts`
- `src/pages/process-factory/printing/dialogs.ts`
- `src/pages/process-factory/printing/events.ts`
- `src/pages/process-factory/printing/pending-review.ts`
- `src/pages/process-factory/printing/progress.ts`
- `src/pages/process-factory/printing/statistics.ts`
- `src/pages/process-factory/printing/dashboards.ts`
- `src/pages/print/print-preview.ts`
- `src/pages/print/templates/printing-work-order-template.ts`

### 页面路由

- `/fcs/craft/printing/work-orders`
- `/fcs/craft/printing/work-orders/PWO-25336`
- `/fcs/craft/printing/pending-review`（兼容深链，页面业务名为“印花产出接收”）
- `/fcs/craft/printing/statistics`
- `/fcs/craft/printing/dashboards`
- `/fcs/craft/printing/progress`（兼容入口重定向到新版加工单列表）
- `/fcs/print/preview?documentType=PRINTING_INFO_SHEET&sourceType=PRINTING_WORK_ORDER&sourceId=PWO-25336`
- `/fcs/print/preview?documentType=PRINTING_CONFIRMATION&sourceType=PRINTING_WORK_ORDER&sourceId=PWO-24013`
- `/fcs/print/preview?documentType=PRINTING_ROLL_LABEL&sourceType=PRINTING_ROLL_RECORD&sourceId=PWO-24013%3AROLL-YH24013-0001`

### 验证命令

- `npm run check:printing-work-order-redesign`：通过。
- `npm run check:printing-workflow`：通过。
- `npm run check:standard-list-page-template`：通过，含 Chromium 列拖拽与持久化。
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43192 npx playwright test tests/printing-work-order-input-output.spec.ts --workers=1 --reporter=line`：通过，3/3。
- `npm run build`：通过，2338 个模块完成构建。
- `npm run check:list-page-governance`：通过；WLS 页面已由 2026-08-11 独立任务完成标准列表迁移，全仓扫描 355 个页面，历史基线剩余 18 项。
- `npx tsx scripts/check-platform-process-order-events.ts PRINT`：通过，`FACTORY_PRINT` 与 `PRINT` 两段均通过；首次失败及后续修复由 2026-08-11 独立审查记录追踪。
- `npm run check:prototype-design-governance -- --all`：通过（15 个用户可见文件、2 份关联审查记录）。
- `codegraph sync`：通过（Already up to date）；最终 `codegraph status` 为 1484 个文件、45509 个节点、164146 条边，无待同步文件。
- `npm run workflow:verify -- --output /private/tmp/higoods-printing-acceptance/task-receipt.json --task-boundary "印花加工单：需求来源、加工投入、固定加工产出、双状态、换料、三类打印与卷条码"`：失败（治理与构建执行完成，但全仓既有 `src/pages/wls-fabric-demand-board.ts` 列表治理阻塞；收据状态为 `implemented`，不得表述为 `verified`）。

### 真实图片验证

- 商品图：`/shirt-sample.jpg`、`/dress-sample-1.jpg`、`/lace-dress-sample.jpg`、`/tshirt-sample.jpg`、`/jacket-sample.jpg`、`/cardigan-sample.jpg`，逐张绑定具体商品 SPU 与替代说明。
- 投入面料图：`/materials/fabric-main.jpg`；产出/花型图：`/materials/fabric-contrast.jpg`、`/materials/fabric-lining.jpg`。
- 列表与详情中缩略图和名称/SPU/SKU 在同一对象块；`onerror` 显示“图片加载失败”；点击打开高清弹层，支持关闭按钮、遮罩和 `Esc`。
- 打印信息单、确认单使用对应商品/物料图；卷标签以固定产出 SKU、二维码和条码识别。
- 最终截图：`/private/tmp/higoods-printing-acceptance/01-printing-list-1366.png` 至 `06-printing-roll-label.png`。

### 例外

- 原有 WLS 标准列表治理阻塞已由 2026-08-11 独立任务完成真实迁移并关闭，详见 `2026-08-11-list-governance-and-print-local-pagination.md`。
- 本审查记录仍只负责 40 条印花工厂原子需求；平台分页和 WLS 迁移分别使用独立审查记录与直接验收证据，不重复计入本矩阵。
