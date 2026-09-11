# 染整生产流程卡排版整理审查

## 1. 基本信息

- 日期：2026-09-11；页面类型：管理端打印预览与 A4 流程卡。
- 来源：用户截图及“内容、分类、顺序、整体结构不变，只优化整齐度”要求。
- 版本：main / f6f3f945a46711265ad6f0eaf7086e9533134fcb 当前染色累计工作区。
- 服务：/Users/laoer/Documents/higoods，PID 59149，0.0.0.0:5188；局域网地址192.168.0.17。
- 本轮范围：仅染色流程卡模板内的样式，不变更 HTML、数据、字段映射、图片、事件、单元格跨度和顺序。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：字体、颜色、表格线、标签与数值对齐、图片边距及打印留白改变。
- 沿用 AGENTS.md 第4、5、7节和 HiGood 工厂设计技能；不新增字段、分区、控件或业务能力。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 原打印预览和六列表格保持，标题、二维码及工序区位置不变 |
| 文案、状态、数量与单位 | 通过 | 修改前后样式块以外代码逐字一致；浏览器15行内容和单元格跨度逐格一致 |
| 扫码、真实图片与对象识别 | 通过 | 原二维码数据和140px尺寸不变，原四张对象图片沿用并加载成功 |
| 防错、危险确认与主管兜底 | 通过 | 未改动作、校验或危险操作；纯视觉调整 |
| 交接、跨端事实与异常追溯 | 通过 | 原字段映射、数量计算、来源单号及生成规则完全不变 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 1366×768页面无横向溢出；普通/补料卡字段无溢出；PDA和上传不适用 |
| 命名路由、交互、图片大图与打印 | 通过 | 同服务页面和A4 PDF均检查；普通/补料各一页，无截断；色样大图打开后Esc关闭 |

## 4. 问题标签

- 无。

## 5. 主要问题与处理

- 双语标签与数值原本混排易换行：保留原字段顺序和四列/双列跨度，仅标签独立一行。
- 表格线、字重与间距不一致：统一浅灰边线与标签底色、文字行高、数值等宽数字和单元格内边距。
- 图片和长编号拥挤：保留图左文右排列，统一图片边框与间距，长编码按词断行。
- 纸张保持160mm卡宽、A4纵向8mm纸边距，微调打印行高，保留全部空白填写单元格。

## 6. 最终结论

结论：通过。内容、分类、顺序及表格结构保持，普通/补料页面与A4分页已核对。仅为本地原型验证，未提交、推送或宣称用户已接受。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/print/templates/dye-work-order-flow-card-template.ts`

### 页面路由

- `/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=DWO-001`
- `/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=DWO-001%2CDWO-002`

### 验证命令

- `node --import tsx scripts/check-dyeing-parity-20260910.ts`：通过；现有普通/补料/批量卡、图片、数量和条码契约保持。
- `git diff --check`：通过。
- `curl http://192.168.0.17:5188/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=DWO-001`：通过，返回200，运行进程cwd与修改目录一致。
- `pdfinfo output/playwright/dyeing-flow-style-0911.pdf`：通过；A4，2页。
- `npm run workflow:verify`：未运行（记录准备时）；最终结果见 `/tmp/higoods-dyeing-flow-style-0911/task-receipt.json`。

### 浏览器证据

- `/tmp/higoods-dyeing-flow-style-0911/before.ts` 保存本轮修改前源文件；排除样式块后与本轮源文件完全一致。
- `/tmp/higoods-dyeing-flow-style-0911/browser-evidence.json`：普通卡15行文本/标签/跨度一致，图片地址一致；普通/补料卡均无字段溢出。
- `/tmp/higoods-dyeing-flow-style-0911/ordinary.png`：1366×768浏览器全页图，页面宽1366，无主体横向溢出。
- `/tmp/higoods-dyeing-flow-style-0911/batch.png`：普通/补料卡全页图。
- `output/playwright/dyeing-flow-style-0911.pdf`：同局域网服务生成，preferCSSPageSize与printBackground开启；关闭浏览器页眉页脚。
- `/tmp/higoods-dyeing-flow-style-0911/a4-1.png`、`a4-2.png`：逐页光栅化目视检查，包含全部工序行、页脚及补料标识，无截断。

### 真实图片验证

- 未新增或替换图片；沿用已登记的色样、商品SPU、投入物料图片及既有对象映射。
- 两张卡的图片全部加载成功；二维码仍由原组件渲染。色样大图打开成功，Esc关闭成功；原失败态处理与图片按钮事件完全不变。

### 例外

- 未连接实物打印机；上述打印结论限于浏览器A4 PDF输出。
- 仅单模板静态排版，不创建新的实施计划或测试基础设施；既有累计需求、代码和未提交差异均保留。
