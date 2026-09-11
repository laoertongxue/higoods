# 染色加工单、条码与流程卡审查记录

## 1. 基本信息

- 日期：2026-09-10；完整产品审查；PFOS 管理端，主管维护染色资料、产出卷与打印单据。
- 需求：用户四项反馈；[设计与计划](../dyeing-online-parity-20260910.md)、[原子需求矩阵](../dyeing-online-parity-matrix-20260910.md)。负责 SCOPE-001、FACTORY-001/002、DATA-001～005、IMG-001、BAR-001～012、PRINT-001～006、VERIFY-001。
- 分支：main；基础 HEAD：f6f3f945a46711265ad6f0eaf7086e9533134fcb；工作树：/Users/laoer/Documents/higoods。
- 实际服务：该工作树 Vite，0.0.0.0:5188；5174 是旧静态预览，未作为证据。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：工厂 Tab、预设资料与图片、条码管理弹窗、打印卡模板及打印按钮路由发生变化。
- 基线：AGENTS.md 第 4、5、7 节。真实线上记录仅作用户提供的参考，没有操作线上业务。

## 3. 自查结论

| 检查项 | 结论 | 证据 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 保留现有标准列表及操作入口；条码维护位于原列表上层弹窗 |
| 文案、状态、数量与单位 | 通过 | 16 张预设资料契约通过；补齐三张历史演示投入记录，下单时间保留染色原始日期；接收、包装、交出回归通过 |
| 扫码、真实图片与对象识别 | 有条件通过 | 物料实拍/效果图、缩略图及大图可用；二维码/Code128 真实生成，未用实体扫码枪验证 |
| 防错、危险确认与主管兜底 | 通过 | 非法导入整批阻断；批量空字段不覆盖；占用保护与删除确认通过 |
| 交接、跨端事实与异常追溯 | 通过 | 原有接收和交出专项通过，条码维护不增加完成或已交数量；预设交出仍为会话演示 |
| 低分辨率、PDA、弱网与上传恢复 | 有条件通过 | 1280×720 页面宽度 1280、无主体溢出，大图和条码表单完整；PDA/弱网/上传不适用本次范围 |
| 命名路由、交互、图片大图与打印 | 有条件通过 | 切厂、复制、换算、导入、重开刷新、大图关闭实测；普通/补料卡页面完整；系统打印分页仍待人工确认 |

## 4. 问题标签

- 追溯不足（仅系统打印面板验证尚缺）

## 5. 主要问题与处理

| 问题 | 标签 | 角色 | 处理 | 剩余风险 |
| --- | --- | --- | --- | --- |
| Chrome 系统打印面板自动化连接超时 | 追溯不足 | 打印人 | 已修复 task-route-card 打印事件入口，屏幕预览和 A4 CSS 已检查；向用户请求普通/补料各一页及页尾确认 | 未确认实际纸张分页及标签实打 |
| goto_global 本地没有对应染色工单 | 选不对 | 管理员 | 保留独立空 Tab，不混用仅有车缝权限的 kol goto 工厂 | 该 Tab 当前 0 条 |

## 6. 最终结论

结论：有条件通过。四项实现和命名页面操作已完成，打印面板验收尚未闭环；不声明完整 verified / delivered / accepted。用户为产品确认人，当前工作区待确认。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/dye-work-order-demo-details.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/process-order-image-manifest.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/pages/process-factory/dyeing/work-orders.ts`
- `src/pages/process-factory/dyeing/barcode-dialog.ts`
- `src/pages/process-factory/dyeing/output-documents.ts`
- `src/pages/process-factory/dyeing/work-order-overlays.ts`
- `src/pages/print/templates/dye-work-order-flow-card-template.ts`

### 页面路由与直接证据

- `/fcs/craft/dyeing/work-orders`：Chrome 及 Codex 内置浏览器，localhost:5188 / 192.168.0.21:5188，同一服务。全部 16、GTG 2、MJS 2、goto_global 0、测试 11、待分配 1。GTG 选择一行后切 MJS，表格 2 行、已选 0。
- 同页条码：DWO-001 复制新增 23 米，自动 23.00 米、8.10 kg；保存后重开并刷新，0002 同记录仍存在。导入 12/13 米两行校验成功；修改文本后旧预览失效；负数阻断。批量只改缸号，两卷长度 23/12 保留。标签预览显示物料图、实际 Code128、SKU、缸号和备注；仅预览仍显示尚未打印。Chrome 临时 0002～0004 已通过界面删除。局域网内置浏览器另外导入 11 卷，共 12 卷 / 66 米 / 23.232 kg；10条每页，第2页2条，跳转1页通过；卷码2～12筛出11卷，全选并确认下架后均显示待出库区；随后删除这11卷、重置，只剩原卷。
- 1280×720：文档宽度 1280、所有首屏图片加载完成；物料大图在视口内，Esc 关闭；条码补充表单的确认和取消可见。1366×768 文档宽度 1366，列表 10 行；截图在本任务 2026-09-10 浏览器工具证据中。
- `/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=DWO-001%2CDWO-002`：两卡顺序 1/2，普通卡无补料标识，补料卡红色横条与斜章，8 张图均加载，连续表格完整至出货；各卡资料和二维码分开。屏幕全页截图在本任务工具证据中。

### 验证命令

- `node --import tsx scripts/check-dyeing-parity-20260910.ts`：通过。
- `node --import tsx scripts/check-dyeing-online-gap.ts`：通过。
- `node --import tsx scripts/check-dye-work-order-online-alignment.ts`：通过。
- `node --import tsx scripts/check-dye-list-snapshot.ts`：通过，筛选快照 0.095ms；初次资料投影约 1138ms（非浏览器按钮耗时）。
- `node --import tsx scripts/check-dye-material-receipts.ts`：通过。
- `npm run build`：通过（25 个单元测试通过；Vite 构建通过）。
- `npm run check:fcs-end-to-end`、`npm run check:prototype-design-governance -- --all`：通过。
- `npm run check:list-page-governance`：失败（首次沙箱 Chromium 启动受限；第二次文档结果用词不符合治理格式）。标准列表模板与 Chromium 列拖动检查已通过；本文结果格式已修正，最终重跑结论见收据。
- `codegraph sync` / `codegraph status`：通过，收据运行同步成功，pending 0、工作树一致。
- [最终任务收据](/tmp/higoods-dyeing-parity-20260910/task-receipt.json)、[检查日志](/tmp/higoods-dyeing-parity-verify.log)：已运行，最终检查状态以文件为准；即使技术检查全绿，也不代替系统打印分页验收。

### 真实图片验证

- 复用 `process-order-image-manifest.ts` 中商品图、物料实拍/效果图；DWO-009 修正为对应浅灰 50D 里布。
- 玫瑰红棉氨针织、雾蓝梭织产出采用按原物料参考生成的效果图，来源记录在 `public/materials/process-orders/sources.json`，明确是原型效果图。
- 列表同列、条码同块、流程卡对应 SPU 信息块展示；图片保持比例，首屏与双卡图片均成功加载。大图关闭和 Esc 实测。失败提示处理存在，未人为断网测试失败态。

### 例外

- 物理打印与扫码未验收；系统打印面板连接故障已向用户说明，没有把屏幕截图作为实际出纸证据。
- 预设业务事件仍是会话演示，条码单独保存；未接入真实后台或线上数据库。
