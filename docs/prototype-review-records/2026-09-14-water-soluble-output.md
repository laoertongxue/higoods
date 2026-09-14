# 水溶待交出与交出单据原型审查

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 日期、需求 | 2026-09-14；用户要求补齐水溶待交出列表、水溶交出单据；WOUT-001～016 |
| 记录模式 | 完整产品审查 |
| 系统、端、角色 | PFOS 染厂管理；桌面管理端；管理人员建单，水溶工厂交接员/管理员确认实物交出 |
| 版本与运行环境 | codex/water-soluble-handover-pages；基于 main 4e44bea51d6c8ba8a61acc75f2f8b609e935ec96；/Users/laoer/Documents/higoods；Vite 5188 同工作树 |
| 事实依据 | 用户提供的两张线上截图与可访问性文本；现有水溶领域和染色交出原型；不把线上空表推断为隐藏流程的行为证据 |
| 设计与矩阵 | docs/water-soluble-output-plan.md；产品确认人为本任务用户（2026-09-14 请求），技术验收人为 Codex；无用户 accepted 回执 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：增加两个菜单/路由、筛选表格、批量建单、合入、卷码维护打印、逐卷扫码、运输、确认交出、草稿作废、详情和交出打印。复用既有标准列表和染色交出显示，水溶单号、任务、完成量、原单位、批次、实收各自读取原水溶事实。
- 原三条派厂/加工/暂停案例保留，新增四条具名水溶演示单：240、180、120、160 米，各 2 卷；独立来源标识，沿用原款式/BOM 物料并明确演示来源，不冒充真实工厂数据。
- 当前基线：AGENTS.md 第 4、5、7 节。没有修改全局布局、鉴权体系、部署配置和其他工厂业务规则。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理标准列表；建单与实物交出分开，实际交出沿用本厂可信交接身份 |
| 文案、状态、数量与单位 | 通过 | 原单数量保留米/Yard/非长度单位；重量不加入长度；建单占用但不产生交出或实收 |
| 扫码、真实图片与对象识别 | 通过 | 一卷一码、逐卷核对；款式和花边图片同列/同块展示；错误/重复扫码有明确反馈 |
| 防错与危险确认 | 通过 | 未打印、跨厂、超完成量、重复占用、占用卷修改、无身份/操作员角色均阻断；实物交出/作废使用确认框 |
| 交接、跨端事实与追溯 | 通过 | 写原水溶批次和通用交接记录；分次实收独立记录、刷新保留；历史交接缺卷码明确提示 |
| 低分辨率与局部更新 | 通过 | 两页1366×768/1280×720主体无横溢；表格内部滚动；筛选展开保留页面根节点，输入不整页重绘 |
| 图片大图与打印 | 通过 | 图加载失败可见、点击原图及 Esc 关闭；A4横向交出单和100×70mm条码 PDF |

## 4. 问题标签

- 已处理：协作断裂、追溯不足。
- 范围内没有未处理的阻断问题。额外旧接收链脚本失败见第 7 节例外。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 分次接收后原单已保存、交接详情刷新归零 | 协作断裂 | 下游接收与上游管理 | 原接收命令纳入已有事务；持久化有明确原单身份的水溶交接头/记录；失败整体回退；冷启动核对两次明细 | 否 |
| 新演示单沿用了原来源标识 | 追溯不足 | PDA 汇总 | 四条案例独立来源标识，明确保留原演示来源单号，避免重复消费 | 否 |
| 历史通用交接没有卷码/建单时间 | 追溯不足 | 管理与打印 | 投影原交出数量，不生成推算卷、不填造假时间；明确历史未登记 | 历史缺失信息仍按原记录呈现 |

## 6. 最终结论

结论：通过。

两轮专项、相关旧功能回归、项目构建、列表模板和原型治理检查已闭环；最终全部文件内容与 CodeGraph 状态以本次任务收据为准。仅交付本地原型，不表示线上业务已执行，也不声明 GitHub 发布或用户接受。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/process-order-image-manifest.ts`
- `src/data/fcs/process-order-three-axis-view.ts`
- `src/data/fcs/water-soluble-task-domain.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/pages/process-factory/dyeing/dispatch-print.ts`
- `src/pages/process-factory/dyeing/output-documents.ts`
- `src/pages/process-factory/dyeing/water-soluble-orders.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/routes-fcs.ts`
- `src/data/fcs/process-output-types.ts`
- `src/data/fcs/process-output-view.ts`
- `src/data/fcs/water-soluble-output-demos.ts`
- `src/data/fcs/water-soluble-output.ts`
- `src/pages/process-factory/dyeing/water-output-barcode.ts`

### 页面路由

- `/fcs/craft/dyeing/water-soluble-pending-handover`
- `/fcs/craft/dyeing/water-soluble-handover-documents`
- 关联回跳 `/fcs/craft/dyeing/water-soluble-orders?orderId=WATER-OUTPUT-DEMO-3`
- 回归 `/fcs/craft/dyeing/pending-handover`
- 局域网地址 `http://192.168.0.17:5188`，命名页面实测 HTTP 200。

### 验证命令

证据目录：`/private/tmp/water-output-acceptance/`。

- `node --import tsx scripts/check-water-soluble-output.ts`：通过。第一轮领域验收：具体演示值/真实资源、独立来源、数量精度、打印门槛、跨厂/占用/重复防错、合入、扫码、可信身份、实际交出、分次实收、幂等、作废、历史投影、米/Yard/非长度、存储失败回退及冷恢复。`domain.log`；失败复现 `receipt-red.log`。
- `node /private/tmp/water-output-acceptance/browser.mjs`：通过。第二轮浏览器验收，`browser-results.json`：两页真实操作，筛选/排序/工厂、分页偏好、条码维护打印、双单4卷420米建单、扫码、无身份拦截、本厂交出、80+160米实收后冷刷新、合入、作废、历史交接、原单回跳、染色/水溶往返。接收通过既有领域入口写入本浏览器隔离数据，不声称验收了下游PDA收货页面。
- `node --import tsx scripts/check-water-soluble-pages.ts`：通过，`water-pages.log`。
- `node --import tsx scripts/check-water-soluble-pda.ts`：通过，`water-pda.log`。新增待交出样例后，检查明确选择加工中任务验收 IN_PROGRESS 页面，保持原校验内容；不依赖全列表第一条的排序。
- `node --import tsx scripts/check-dyeing-online-gap.ts`：通过，`dye-gap.log`。
- `node --import tsx scripts/check-water-soluble-partial-handover.ts`：通过，`partial.log`。
- `node scripts/check-typescript-scope.mjs <本次相关源文件>`：通过，`types.log`；全量 TypeScript 错误 0。
- `npm run check:fcs-end-to-end`：通过；`npm run check:menu-routes`：通过；首次收据已执行，见 `workflow.log`。
- `npm run build`：通过，25项单元检查通过，Vite构建完成。仅既有大分包体积提示，未改构建配置。
- `npm run check:prototype-design-governance -- --all`：通过，`governance.log`。首次记录格式失败已修订并重新运行，未修改检查脚本。
- `npm run check:list-page-governance`：失败（首次仅最后记录格式检查失败）；静态和模板部分通过，记录格式已另行复验通过；完整复验结果见最终 `workflow.log`。
- `npm run workflow:verify`：失败（首次仅审查记录格式阻断，CodeGraph同步成功）；本记录定稿后执行最终完整复验，结果保存在 `/private/tmp/water-output-acceptance/task-receipt.json` 和 `workflow.log`。最终收据绑定全部任务变更（含文档），不以首轮结果或省略路径代替。

### 真实图片和打印

- 款式：`public/tshirt-sample.jpg`，对应 SPU-TSHIRT-081；物料：`public/materials/process-orders/white-water-soluble-lace-12-15mm.jpg`，对应 MAT-WATER-ONLY-081 本白水溶花边。沿用既有真实图片清单。
- 待交出列表中款式/物料各在自己名称编码同一列；建单详情和条码维护同块展示；打印含两类图。浏览器等待全部图片自然尺寸大于零，并验证故障提示、打开大图、Esc 关闭。
- `pending-1366.png`、`pending-1280.png`、`documents-1366.png`、`documents-1280.png`、`actual-receipt.png`、`historical-detail.png`。
- `dispatch.pdf`：1页A4横向，2单4卷420米/459.32Yard，运输和签名区完整；`barcodes.pdf`：2页100×70mm，各80米/87.49Yard。已渲染并目视核对图文未截断、条码和合计。

### 例外

- 线上只提供了两个空表截图。隐藏交互按当前原型既有染色交出能力补齐；没有操作或修改生产环境数据。
- 既有 `check-preparation-real-receipt-chain.ts` 使用已失效的接收方式，在 `WAIT_MATERIAL` 阶段就尝试交出。本任务版本与干净基线 main 4e44bea5 均在同一处失败（`preparation.log` / `preparation-baseline.log`），不将其计为通过，也不修改无关旧脚本；本次水溶批次和实际交接通过新专项及既有 partial-handover 检查验证。
- 此次未新增 PDA 页面/上传/弱网功能；无此类页面验收声明。本地存储写入失败以明确错误和整体回退验证。
