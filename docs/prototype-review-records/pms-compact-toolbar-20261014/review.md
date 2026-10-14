# 采购管理全部列表工具栏紧凑化审查记录

依据 `AGENTS.md` 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01，使用当前完整产品审查模板。

## 基本信息

- 日期：2026-10-14
- 任务 / 需求编号：PMS-TOOLBAR-01～PMS-TOOLBAR-08
- 验证人：Codex 主代理；1个独立只读代理提供改前页面证据，主代理检查产物、修改代码并完成改后验收。技术验证不代表用户产品接受。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：用户将范围由面辅料采购单扩为采购管理所有页面。沿用现有标准列表、工具栏动作和列设置；20个页面渲染配置对应21条路由，使用仅PMS生效的紧凑样式。跨页共享可见样式按T4验收，不新增业务功能。原有动作、数据和路由契约不变。

## 范围、继承与实施计划

本轮继承当前工作树已完成的面辅料采购功能对齐。此前审查、原始证据与技术收据保留原版本；本轮不把旧性能或截图改标为新版本。这里只调整采购列表工具栏的尺寸、间距和面辅料批量动作短名称；查询、新建和表单主操作保持原有层级。不是重新核查采购全部业务流程，也不实施委托加工方案。

先只读盘点21个页面及相邻详情，记录实际按钮和换行；再在已存在的标准列表配置加PMS样式作用域，在样式表收紧高度和间距，仅拥挤的面辅料工具栏缩短文字并保留完整提示及可访问名称。条码列表子页复用相同尺寸。最后在同工作树生产预览逐页验1366×768、1280×720、列设置、原批量菜单、未选记录守卫及条码子页，检查非PMS页面并按受影响布局采样。

直接文件和本轮完整增量见[evidence/incremental-diff.txt](evidence/incremental-diff.txt)，前后23个源码哈希见[evidence/source-hashes.json](evidence/source-hashes.json)。业务记录、静态Mock、IndexedDB、Blob、localStorage键、路由和依赖均未修改；此前任务仍存在的未提交业务差异不作为本轮UI新增。

## 原子需求与实施结果

| 编号 | 来源 | 原子需求 | 文件 / 位置 | 验证及证据 | 状态 |
|---|---|---|---|---|---|
| PMS-TOOLBAR-01 | 用户要求采购管理所有页面逐页检查 | 覆盖采购管理21个菜单页面 | 20个页面配置的renderStandardListPage | 改前42、改后42个页面样本，逐页表 | 已验证 |
| PMS-TOOLBAR-02 | 用户要求缩小功能按钮 | 列表工具栏按钮高28px、字号12px | src/styles.css作用域pms-compact-list | after-result.json controls逐个尺寸 | 已验证 |
| PMS-TOOLBAR-03 | 用户要求与列设置同一行 | 面辅料11个动作和列设置保持单行 | renderMpoParityToolbar及列表header | 两设备189px/3行→45px/1行 | 已验证 |
| PMS-TOOLBAR-04 | 继承现有全部功能 | 每个面辅料短按钮保留完整操作名称 | material-purchase-order-parity.ts compactAction | title和aria-label保留11个原名，原data-action和data-field未变，未选记录守卫 | 已验证 |
| PMS-TOOLBAR-05 | 继承现有交互 | 21个列设置能打开和关闭 | 原有事件处理器保持不变 | after-result.json actions逐页实点 | 已验证 |
| PMS-TOOLBAR-06 | 同类子页 | 条码列表六个工具栏动作保持单行 | material-purchase-barcodes.ts renderLedger | barcode-toolbar-1280.png和六个按钮几何 | 已验证 |
| PMS-TOOLBAR-07 | UI-01 | 1366和1280主体无横向溢出 | 所有21个PMS页面 | 42样本bodyOverflow=false/rightOverflow=false | 已验证 |
| PMS-TOOLBAR-08 | SCOPE-03范围 | 紧凑样式不影响其他系统 | pms-compact-list/pms-compact-toolbar作用域 | 染色加工单实际36px按钮，无PMS作用域 | 已验证 |

确认人：本轮实现与技术核验为Codex主代理。确认版本：下述源码集合哈希及实际生产资产；用户未作本轮产品接受。

## 逐页清单

下表的改前/改后1280记录代表最低管理端设备；每一页同时完成1366验收，结果均为单行、记录数与列设置同一行、无主体和工具栏横向溢出。唯一原先三行的主页面是面辅料采购单；其他20页已是一行，本轮统一缩小其列表工具栏尺寸。

| 页面 | 路由 | 改前1280表头 / 控件行数 | 改后1280表头 / 控件行数 | 状态 |
|---|---|---|---|---|
| 商品采购建议 | `/pms/purchase-suggestions` | 61px / 1行 | 45px / 1行 | 已验证 |
| KOL 采购需求 | `/pms/kol-demands` | 61px / 1行 | 45px / 1行 | 已验证 |
| 商品采购单 | `/pms/product-purchase-orders` | 61px / 1行 | 45px / 1行 | 已验证 |
| 备货列表 | `/pms/reorder` | 61px / 1行 | 45px / 1行 | 已验证 |
| 商品采购售后 | `/pms/product-purchase-order-aftersales` | 61px / 1行 | 45px / 1行 | 已验证 |
| 面辅料需求分析 | `/pms/material-requirements` | 61px / 1行 | 45px / 1行 | 已验证 |
| 面辅料采购单 | `/pms/material-purchase-orders` | 189px / 3行 | 45px / 1行 | 已验证 |
| 面辅料采购跟踪 | `/pms/material-purchase-tracking` | 61px / 1行 | 45px / 1行 | 已验证 |
| 面辅料采购时效 | `/pms/fitting-timeliness` | 61px / 1行 | 45px / 1行 | 已验证 |
| 面辅料供应商确认单 | `/pms/material-supplier-confirmations` | 61px / 1行 | 45px / 1行 | 已验证 |
| 头程物流 | `/pms/first-leg-shipments` | 61px / 1行 | 45px / 1行 | 已验证 |
| 头程物流商管理 | `/pms/first-leg-carriers` | 61px / 1行 | 45px / 1行 | 已验证 |
| KOL 库存 | `/pms/kol-sample-stock` | 61px / 1行 | 45px / 1行 | 已验证 |
| 锁定操作记录 | `/pms/kol-sample-stock/lock-log` | 61px / 1行 | 45px / 1行 | 已验证 |
| 手动寄样申请 | `/pms/kol-sample-apply` | 61px / 1行 | 45px / 1行 | 已验证 |
| 对外样品池链接 | `/pms/kol-sample-link` | 61px / 1行 | 45px / 1行 | 已验证 |
| 商品供应商管理 | `/pms/suppliers` | 61px / 1行 | 45px / 1行 | 已验证 |
| 供应商供货档案 | `/pms/supplier-supply-archives` | 61px / 1行 | 45px / 1行 | 已验证 |
| 面辅料采购请款 | `/pms/material-payment-requests` | 61px / 1行 | 45px / 1行 | 已验证 |
| 物流费用请款 | `/pms/logistics-payment-requests` | 61px / 1行 | 45px / 1行 | 已验证 |
| 原料仓库存查询 | `/pms/material-inventory` | 61px / 1行 | 45px / 1行 | 已验证 |

改前18个成功的详情、日志、渠道只读入口在两设备检查，共36截图，未见其他密集标准列表批量工具栏；原始记录在output/playwright/pms-compact-toolbar-20261014/before/。独立代理条码入口的额外尝试命中隐藏同名项，未获得改前子页布局，保留日志且不判作产品故障。主代理本轮已用实际可见菜单打开条码子页，并取得改后证据。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
|---|---|---|
| 全部采购页面范围 | 通过 | 逐页清单对应21条路由，没有只修面辅料采购单 |
| 按钮、记录数、列设置单行 | 通过 | after-result.json的42个真实矩形和截图，每个header45px、控件28px |
| 工具栏识别和可点 | 通过 | 12px字、完整title和aria-label，首末按钮及列设置未截断；实际点击和关闭 |
| 既有菜单展开 | 通过 | 商品采购单原批量操作11个按钮仍可展开，未给header增加会裁切弹出菜单的overflow |
| 未选记录守卫 | 通过 | 实点短名采购员，显示“选择要操作的采购单”，没有打开批量保存或写业务资料 |
| 条码子页 | 通过 | 6按钮28px/一行，标题与数量信息未截断，原表单保持原有尺寸 |
| 宽表与设备 | 通过 | 1366×768、1280×720全21页，无主体溢出，宽表仍在表格容器内部滚动 |
| 原型图片 | 通过 | 本轮未改变图片来源/对应/预览；42样本必要图片全部完成解码且无失败，截图保留实际物料图 |
| 存储、数量、状态 | 不适用 | 本轮没有新增或修改业务数据、保存、数量和状态；20个配置回退className后与改前源码哈希完全一致 |
| PDA、员工端、打印文件 | 不适用 | 本轮是PMS管理列表工具栏，没有修改这些端点或打印模板 |
| 其他系统作用域 | 通过 | 染色加工单实际按钮36px，CSS仅在两个PMS作用域下覆盖 |
| 页面响应 | 通过 | 21个缓存内导航家族，每家族5样本，共105；最大631.379ms，无>1000ms有效样本 |
| 新增框架、维护功能和业务扩张 | 不适用 | 只复用现有配置和CSS，没有新增依赖、后端、维护入口或加工流程 |
| 发布 | 不适用 | 本轮用户要求修复原型，未提交、合并或推送本轮增量 |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/pages/pms/first-leg-shipments.ts`
- `src/pages/pms/kol-demands.ts`
- `src/pages/pms/material-requirements.ts`
- `src/pages/pms/suppliers.ts`
- `src/pages/pms/supplier-supply-archives.ts`
- `src/pages/pms/material-inventory.ts`
- `src/pages/pms/purchase-suggestions.ts`
- `src/pages/pms/kol-sample-stock.ts`
- `src/pages/pms/material-purchase-orders.ts`
- `src/pages/pms/reorder-suggestions.ts`
- `src/pages/pms/material-purchase-tracking.ts`
- `src/pages/pms/fitting-timeliness.ts`
- `src/pages/pms/kol-sample-stock-lock-log.ts`
- `src/pages/pms/first-leg-carriers.ts`
- `src/pages/pms/product-purchase-orders.ts`
- `src/pages/pms/supplier-confirmations.ts`
- `src/pages/pms/kol-sample-link.ts`
- `src/pages/pms/kol-sample-apply.ts`
- `src/pages/pms/purchase-order-aftersales.ts`
- `src/pages/pms/payment-requests.ts`
- `src/pages/pms/material-purchase-order-parity.ts`
- `src/pages/pms/material-purchase-barcodes.ts`
- `src/styles.css`

### 页面证据

- 版本：工作树/Users/laoer/.codex/worktrees/7eaf/higoods，分支codex/pms-test-alignment-20261013，HEAD 3e6412f25bd389985ca1a2045280eff2220f622b加本轮未提交差异，23源码集合SHA256为4e78fa91000fa5a60395c3151687c1ea662bbaa4bf406800c296aba6c7899a50；本机同源生产预览http://127.0.0.1:43965，npx vite build，Playwright Chromium 149.0.7827.55，Asia/Shanghai，管理1366×768与1280×720。实际资产版本和前后源码哈希见source-hashes.json/after-result.json，PMS资产补证见pms-asset-and-selection-proof.json。开发服务43964仅用来诊断，不作为正式性能证明。
- 证据：evidence/before-layout.json、after-result.json记录命名路由、42个页面的真实矩形、按钮及图片就绪和21次列设置操作；每页两张工具栏截图，以及MPO整页、条码子页和原批量菜单截图均在evidence/；改前清单及MPO两设备截图保留原身份。必要的已选择记录标题场景单列在pms-asset-and-selection-proof.json。本轮无业务提交，不清用户数据。

### 性能结论

- 结论：通过
- 依据：本轮改变布局成本，因此在受影响21页逐个采样。42个功能/设备样本完成后，缓存内导航各5次，共105个。起点为page.goto调用前，终点包括目标列表header可见、字体就绪、必要图片decode以及两个animation frame，最大631.379ms；全部原始值在page-performance.json，脚本字节快照在after-audit-script.txt，环境和源码版本在after-result.json/source-hashes.json。没有声称冷启动性能，也没有将首次访问和缓存内导航混为一个家族。未改变的保存、上传、打印和其他业务事件复用原任务证据原身份，未重新运行所有业务操作。宿主共享浏览器和服务存在，测量前检查CPU/内存及相关进程，不停止其他任务。

### 验证命令

- `npx vite build`：通过
- `node output/playwright/pms-compact-toolbar-20261014/after-audit.mjs`：通过
- `git diff --check`：通过
- `npm run check:prototype-design-governance -- --scope worktree --paths src/pages/pms/first-leg-shipments.ts,src/pages/pms/kol-demands.ts,src/pages/pms/material-requirements.ts,src/pages/pms/suppliers.ts,src/pages/pms/supplier-supply-archives.ts,src/pages/pms/material-inventory.ts,src/pages/pms/purchase-suggestions.ts,src/pages/pms/kol-sample-stock.ts,src/pages/pms/material-purchase-orders.ts,src/pages/pms/reorder-suggestions.ts,src/pages/pms/material-purchase-tracking.ts,src/pages/pms/fitting-timeliness.ts,src/pages/pms/kol-sample-stock-lock-log.ts,src/pages/pms/first-leg-carriers.ts,src/pages/pms/product-purchase-orders.ts,src/pages/pms/supplier-confirmations.ts,src/pages/pms/kol-sample-link.ts,src/pages/pms/kol-sample-apply.ts,src/pages/pms/purchase-order-aftersales.ts,src/pages/pms/payment-requests.ts,src/pages/pms/material-purchase-order-parity.ts,src/pages/pms/material-purchase-barcodes.ts,src/styles.css,docs/prototype-review-records/pms-compact-toolbar-20261014/review.md`：通过
- `npm run check:list-page-governance -- --scope worktree --paths src/pages/pms/first-leg-shipments.ts,src/pages/pms/kol-demands.ts,src/pages/pms/material-requirements.ts,src/pages/pms/suppliers.ts,src/pages/pms/supplier-supply-archives.ts,src/pages/pms/material-inventory.ts,src/pages/pms/purchase-suggestions.ts,src/pages/pms/kol-sample-stock.ts,src/pages/pms/material-purchase-orders.ts,src/pages/pms/reorder-suggestions.ts,src/pages/pms/material-purchase-tracking.ts,src/pages/pms/fitting-timeliness.ts,src/pages/pms/kol-sample-stock-lock-log.ts,src/pages/pms/first-leg-carriers.ts,src/pages/pms/product-purchase-orders.ts,src/pages/pms/supplier-confirmations.ts,src/pages/pms/kol-sample-link.ts,src/pages/pms/kol-sample-apply.ts,src/pages/pms/purchase-order-aftersales.ts,src/pages/pms/payment-requests.ts,src/pages/pms/material-purchase-order-parity.ts,src/pages/pms/material-purchase-barcodes.ts,src/styles.css,docs/prototype-review-records/pms-compact-toolbar-20261014/review.md`：通过

其后按当前实际工作树完整任务文件清单运行治理和技术收据，输出在/tmp/pms-compact-toolbar-20261014-receipt/。记录预先只引用位置，不预填该尚未运行的收据结果，原先面辅料功能对齐收据保留旧版本。

### 例外

- 无
