# PDA 全工序移动界面对齐 V34

依据 `AGENTS.md` 的 SCOPE-02、TRACE-01、REVIEW-01、PERF-01、EVIDENCE-01。

## 基本信息

- 日期：2026-10-24
- 任务 / 需求编号：PDA-V34-MOBILE-ALIGN-20261024
- 任务：按用户指定的 V34 PDA 设计稿统一全部中央工厂 PDA 工序入口、列表和详情，并把“后整”显示更名为“后道”
- 验证人：代理技术核验；用户接受未代填
- 工作树 / 分支：`publish-newpda-v34/higoods` / `codex/pda-factory-split`，基线 main `fa2e82324`

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：重做中央 PDA 工序选择器，覆盖裁剪、毛织、染色、印花、水溶、后道、定型机手感、捆条、辅助工艺、特种工艺、辅料厂；统一各工序列表卡、详情身份卡、输入、折叠区和全宽操作；把“后整”显示更名为“后道”；同步收紧共享中央框架顶栏。
- 契约变化：有（共享呈现结构、移动交互和显示名称变化；业务命令、数量规则、状态校验、保存和交接事实未变）

## 自查结论

| 检查项 | 结论 | 证据 / 边界 |
| --- | --- | --- |
| V34 设计基准 | 通过 | 对照 V34 `op=后整` 接收/执行/任务详情、`op=毛织` 执行/仓管及全部工序菜单：大单号与状态、图片卡、动作行、折叠历史、固定底部主按钮；不引入 Web 筛选面板、列设置或分页。 |
| 全工序选择器 | 通过 | 320×640 打开工序菜单：基础工序 8 项（裁剪、毛织、染色、印花、水溶、后道、定型机手感、捆条），辅助工艺、特种工艺、辅料厂按工厂数据分组；输入“后”只剩“后道”，选择“打揽”后当前工序切换成功；当前工厂可展开切换。 |
| 共享 PDA 框架 | 通过 | 顶栏改为“工厂 + 账号”两行并单行截断；底栏保留业务需要的接单/执行/交接/仓管/结算五项，选中项使用 V34 顶部指示条；详情页可隐藏底栏并显示固定主按钮；中央内容底色统一为 `#f2f5f9`，按钮和输入统一为 48/52px。 |
| 毛织执行与接收 | 通过 | 320×640 打开 `HJ260918-012`：大单号与状态、款式图片卡、两块 SKU 大数字卡、折叠事实记录、全宽固定“完成加工单”；中央毛织接收页改为图片卡、关键信息、25 kg 余量和“接收”全宽动作行；无横向溢出、无表格、无分页。 |
| 毛织仓库流水 | 通过 | 320×640 入库记录：按单位汇总卡、52 笔总数、20 条卡片、“加载更多 20/52”；点击后 40/52，仍无上一页/下一页和表格；批次/库位/来源改为折叠。 |
| 后道更名与后道页面 | 通过 | 中央菜单、后道页面标题、空态、后道回货页均显示“后道”；源码扫描仅剩“后整理”“越华后整厂”“确认后整单”和旧标签映射别名，不再把工序显示为“后整”。 |
| 后道生产任务与执行详情 | 通过 | 320×640 打开 `PF-PO-QC-202608-001` 与 `PF-POST-PF-ACCEPT-PO-3-5`：大任务号与状态、后道来源卡、数量卡、全宽主次动作、折叠摘要与操作记录；无横向溢出、无表格、无分页。 |
| 辅助/特种工艺列表与详情 | 通过 | 320×640 打开 APF 接收：任务卡含图片、任务号、待接收状态、款名与部位；详情含大商品卡、上游来源条、大数字余量、52px 数量输入、折叠操作记录和固定“确认接收”。SPF 列表同样显示待接收/加工中卡片。 |
| 染色/定型机/其他工序 | 通过 | 染色接收页 2 张真实单据卡（图片、单号、面料、未收原卷）为 V34 卡片；定型机列表卡改为图片 + 标题 + 状态 + 手感/卷数 + “继续本单”动作行；毛织片共用同一选择器和卡片/输入规范。 |
| 印花/水溶/捆条/花边真实数据 | 通过 | 用现有夹具在隔离浏览器生成并核验：印花 F090 两张待接收单、备料关联、`PWO-PRINT-005` 加工单 7 卷产出；水溶 F090 6 张执行单（加工中/暂停/待交出）；捆条 F090 24 张、首单详情 21.84 m；花边 TMF 3 张待接收单和详情。四类列表/详情均无横向溢出、无表格、无分页。 |
| 深层业务表单 | 通过 | 印花接收/加工/产出表单统一为 V34 卡片、52px 输入、来源条和固定主按钮；水溶详情把“扫下一单”改为全宽动作行，保留加工/交出/实收三态；捆条规格、数量、历史与实收使用 V34 卡片/输入；花边详情使用商品卡、折叠投入/记录和固定接收按钮。 |
| 印尼语 | 通过 | 印花（Terima/Pencetakan/Pindai/Cari/Alokasi bahan/Dalam proses）、水溶（Proses/Larut air/Total diterima/Simpan total hasil）、捆条（Bis/Sisa tersedia）、花边（Renda/Belum diterima/Terima tugas produksi）切换后主要界面为印尼语，未发现工序级中文标签。 |
| 打印预览 | 通过 | 印花 `PH-20260328-005` 的 `M_..._0001` 卷标签预览成功渲染真实二维码、CODE128 条码、面料图、113.71 m、理论重量和幅宽/克重；按钮为“Cetak label / Kembali ke hasil”，未调用物理打印机。 |
| 性能 | 通过 | 生产预览 `127.0.0.1:43180`、320×640、站内切换各 5 个有效样本：印花列表 max 34.5ms、详情 33.5ms；水溶列表 49.8ms、详情 50.7ms；捆条列表 50.0ms、详情 133.1ms；花边列表 33.3ms、详情 33.3ms；辅助工艺列表 33.8ms；工序菜单打开 34.2ms。均 ≤1000ms。 |
| 完整单测 / 类型 / 构建 | 通过 | 1902/1902 单测；`npx tsc --noEmit` 的 19 项与 main 基线逐条一致；`npx vite build` 通过。 |

## 边界与未关闭项

- V34 参考稿是设计预览，使用示例数据；本轮只对齐呈现与交互，不改变当前 Web 已确认的业务规则和数量校验。
- 印花、水溶、捆条、花边已用现有夹具在隔离浏览器补出真实数据并核验列表和详情；夹具仍是演示数据，不代表真实工厂业务或现场设备。
- 中央毛织仓库仍是库位/库存视图，没有照搬 V34 毛织仓管的四宫格动作入口；当前 Web 的库位盘点和移库业务优先。
- 定型机手感本轮仍无 GTG 手感单，只验证菜单、空态和列表/详情结构；其内容文案仍为中文，作为独立本地化缺口保留。
- 部分深层业务状态（如毛织执行详情、后道复检/出货、水溶卷标、印花产出卷编辑）仍使用既有业务专用控件，只统一了进入路径、公共卡片、输入和按钮，不是逐字段的完整 V34 重绘。
- 打印已验证标签预览和真实二维码/条码渲染，未调用物理打印机；扫码枪、真实工厂设备和现场接受不能由代理代填，需真实用户按以下清单执行：实际 PDA 小屏可读可点、扫码枪逐卷/逐单、标签与 A4 打印、中文/印尼语切换、存储失败恢复、两页 Mock 下任务完成、操作人/交接责任确认。

### 性能结论

- 结论：通过
- 依据：生产预览 `127.0.0.1:43180`、320×640 设备模拟，10 个场景各 5 个有效样本，最大值 133.1ms，全部低于 1000ms；采样从站内切换/菜单点击到目标标记并完成两帧绘制。
- 采样定义：站内切换从 `history.pushState` + `popstate` 开始，到目标列表/详情标记出现并完成两帧绘制结束；工序菜单从点击“选择工序”到分组出现并完成两帧绘制结束。每个场景 5 个有效样本，无 0ms、无超时。
- 原始值：印花列表 33.4/33.4/33.3/34.5/33.4ms（max 34.5）；印花详情 33.5/33.4/33.3/33.4/33.5（max 33.5）；水溶列表 49.8/36.3/33.2/33.3/33.3（max 49.8）；水溶详情 50.7/47.4/47.9/47.9/48.1（max 50.7）；捆条列表 50.0/33.4/33.3/33.7/33.3（max 50.0）；捆条详情 85.9/83.0/83.2/84.2/133.1（max 133.1）；花边列表 33.2/33.2/33.2/33.3/33.3（max 33.3）；花边详情 32.7/33.3/33.2/33.2/33.2（max 33.3）；辅助工艺列表 33.5/33.3/33.4/32.3/33.8（max 33.8）；工序菜单 33.3/33.2/33.2/34.2/32.9（max 34.2）。
- 结论依据：所有有效样本最大值 133.1ms，低于 1000ms 门限；未包含冷启动、物理打印、扫码枪和现场设备。

### 页面证据

- 版本：worktree `publish-newpda-v34/higoods`，基线 main `fa2e82324`；功能核验使用 Vite dev/生产预览 `127.0.0.1:43180`，隔离上下文 `pda-mobile-sweep-2`，320×640 设备模拟。
- 证据：工序选择器 8 项基础工序 + 辅助/特种/辅料分组，搜索“后”过滤为“后道”，选择“打揽”切换成功；APF 列表两张任务卡、详情大商品卡/来源条/52px 输入/固定按钮；SPF 两张状态卡；染色两张真实单据卡；中央毛织接收图片卡/25 kg/接收动作行；TMF 织带三张真实任务卡；定型机工序菜单高亮“定型机手感”；后道页面标题、空态和扫码行显示“后道”。印花 F090 两张待接收单 + `PWO-PRINT-005` 7 卷输出和印尼语表单；水溶 F090 6 张执行单/加工详情（id）；捆条 F090 24 张列表和 21.84 m 详情（id）；花边 TMF 3 张待接收单和详情（id）。印花卷标预览真实二维码、CODE128、面料图、113.71 m 和理论重量/幅宽/克重均可见。上述页面 `document.documentElement.scrollWidth === clientWidth`，表格数 0，上一页/下一页数 0。

### 技术证据

- 对象与结果：共享中央工序选择器、V34 中央内容样式、各工序列表/详情卡和深层表单、后道显示更名、生产预览性能。
- 证据：`npx tsc --noEmit` 输出与 `/tmp/main-ts-errors.txt` 规范化后逐条一致（19 项既有 PCS/技术包错误，无新增）；`npm test` 1902/1902；`npx vite build` 通过；生产预览 `127.0.0.1:43180` 的 10 个场景各 5 个性能样本全部 ≤133.1ms。`tests/unit/central-pda-stenter.test.ts` 已从“每个工序页各自包含定型机链接”改为“共享 `operation-menu.ts` 包含定型机链接且各工序页引用共享菜单”，继续守住中央工序入口。

## 最终结论

中央 PDA 全部工序入口、主要列表/详情和印花/水溶/捆条/花边的有数据界面已按 V34 设计稿完成移动化对齐，后道显示名称完成更名，印花标签预览和主要界面印尼语通过本机核验，生产预览 5 样本性能为 33–134ms；中央毛织仓库、定型机内容文案、部分深层业务状态和现场接受仍未关闭，用户接受未代填。

结论：通过

### 受管文件

- `src/pages/pda-mobile-ui.ts`
- `src/pages/pda-shell.ts`
- `src/pages/pda-wool-fact-execution.ts`
- `src/pages/pda-wool-warehouse-flows.ts`
- `src/pages/pda-post-finishing-exec-detail.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-exec.ts`
- `src/pages/process-factory/dyeing/stenter-handfeel/work-orders.ts`
- `src/pages/central-pda/operation-menu.ts`
- `src/pages/central-pda/page.ts`
- `src/pages/central-pda/entry.ts`
- `src/pages/central-pda/frame.ts`
- `src/pages/central-pda/ui.ts`
- `src/pages/central-pda/post-page.ts`
- `src/pages/central-pda/post-view.ts`
- `src/pages/central-pda/post-sewing-page.ts`
- `src/pages/central-pda/dye-page.ts`
- `src/pages/central-pda/print-page.ts`
- `src/pages/central-pda/print-view.ts`
- `src/pages/central-pda/print-ui.ts`
- `src/pages/central-pda/print-material-view.ts`
- `src/pages/central-pda/water-page.ts`
- `src/pages/central-pda/cutting-page.ts`
- `src/pages/central-pda/cutting-view.ts`
- `src/pages/central-pda/binding-page.ts`
- `src/pages/central-pda/binding-view.ts`
- `src/pages/central-pda/webbing-page.ts`
- `src/pages/central-pda/webbing-view.ts`
- `src/pages/central-pda/lace-page.ts`
- `src/pages/central-pda/lace-view.ts`
- `src/pages/central-pda/wool-page.ts`
- `src/pages/central-pda/wool-ui.ts`
- `src/pages/central-pda/wool-execution-view.ts`
- `src/pages/central-pda/wool-warehouse-page.ts`
- `src/pages/central-pda/stenter-page.ts`
- `src/pages/wls/finished/basic-processor.ts`
- `src/data/fcs/factory-mock-data.ts`
- `src/data/fcs/indonesia-factories.ts`
- `src/data/fcs/process-platform-status-adapter.ts`
- `src/data/fcs/third-party-factory-rating.ts`
- `src/main.ts`
- `tests/unit/central-pda-stenter.test.ts`
- `docs/product-design/pda-factory-split/requirements-plan-matrix.md`
- `docs/prototype-review-records/2026-10-24-pda-v34-mobile-alignment.md`

## 验证命令

- `npm test`：通过
- `npx tsc --noEmit`：通过
- `npx vite build`：通过

浏览器：Vite `127.0.0.1:43180`，隔离上下文 `pda-mobile-sweep-2`，320×640 设备模拟。

## 例外

- 无
