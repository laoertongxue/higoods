# 采购原型多余入口清退

依据 `AGENTS.md` 的 SCOPE-02、TRACE-01、REVIEW-01、EVIDENCE-01。本次继承已发布采购原型12a1820b，执行用户新增的一键下单删除和本地资料维护入口简化要求；原806条清单及来源证据保留其原版本，本记录覆盖其中单条和批量一键下单的目标行为。

## 基本信息

- 日期：2026-10-14
- 任务 / 需求编号：PMS-REMOVE-EXTRA-CONTROLS
- 验证人：Codex 主代理，技术验证不代表用户产品接受

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：商品采购单行内和批量操作删除第三方一键下单入口，解除专用提示分支，旧动作不再被通用边界事件识别；删除PMS页头的本地资料按钮、专用弹窗及挂载处理器。

## 范围、计划与原子追踪

范围为`/pms/product-purchase-orders`的一键下单功能及PMS页头本地资料维护入口。用户要求简化原型交互，优先于STORE-05提供维护入口的默认规则；删除维护界面，不新增替代入口。商品采购单仍使用原模型、主键、IndexedDB仓库及保存入口；此功能原本仅显示待对接提示，没有专用业务记录、接口、路由、附件或Mock对象，因此没有数据迁移或清空步骤。

计划：删除行内与批量入口 → 删除提示分支并限定剩余边界动作 → 删除本地资料按钮、弹窗文件及事件挂载 → 在现有采购浏览器用例验证入口消失和相邻详情 → 核验管理视口、局部交互与适用门禁 → 冻结记录并生成技术收据。

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / PDA / 打印 / 性能证据或不适用理由 | 状态 | 证据位置 | 确认人和确认版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PMS-RPO-01 | 用户本轮删除要求 | 行内操作不再提供一键下单 | 采购单入口 | src/pages/pms/product-purchase-orders.ts / columns | 现有采购详情用例 | 管理页面更多操作 | 已验证 | pms-extra-controls-20261014/extra-controls-browser.log | Codex，基准12a1820b |
| PMS-RPO-02 | 用户本轮删除要求 | 批量操作不再提供一键下单 | 采购单入口 | src/pages/pms/product-purchase-orders.ts / renderPmsProductPurchaseOrdersPage | 现有采购详情用例 | 管理页面批量操作 | 已验证 | pms-extra-controls-20261014/extra-controls-browser.log | Codex，基准12a1820b |
| PMS-RPO-03 | 用户本轮删除要求 | 专用分支删除，旧动作不能被通用事件接收 | 采购单事件 | src/pages/pms/product-purchase-orders.ts / handlePmsProductPurchaseOrdersEvent | 运行源码清理检查、采购页面回归 | 无专用PDA、打印或存储对象 | 已验证 | pms-extra-controls-20261014/cleanup-evidence.json | Codex，基准12a1820b |
| PMS-RPO-04 | 用户本轮删除要求 | 相邻采购详情和合法边界操作保持可用 | 回归验收 | tests/pms-purchase-chain.spec.ts / 商品采购单详情用例 | 现有PMS专项 | 管理视口与局部弹窗 | 已验证 | pms-extra-controls-20261014/extra-controls-browser.log | Codex，基准12a1820b |
| PMS-RPO-05 | 用户本轮原型简化要求 | PMS页头不再显示本地资料入口 | 页头 | src/components/shell.ts / renderHeader | 现有采购详情用例 | 管理页面页头 | 已验证 | pms-extra-controls-20261014/extra-controls-1366.png | Codex，基准12a1820b |
| PMS-RPO-06 | 用户本轮原型简化要求 | 专用维护弹窗及其事件挂载代码退役 | 维护界面 | src/components/pms-storage-panel.ts（删除）、src/main.ts / click | 文件和引用检查 | 无替代入口或隐藏跳转 | 已验证 | pms-extra-controls-20261014/cleanup-evidence.json | Codex，基准12a1820b |
| PMS-RPO-07 | 用户本轮原型简化要求 | 业务保存、刷新回读和失败重读仍可用 | 相邻回归 | src/main.ts / data-pms-record-retry及原PMS保存动作 | 现有PMS专项 | 列表、详情独立读取 | 已验证 | pms-extra-controls-20261014/extra-controls-browser.log | Codex，基准12a1820b |

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 单条和批量入口清退 | 通过 | 实际打开两类菜单，均无一键下单；现有用例检查隐藏控件与旧动作属性也不存在。 |
| 一键下单事件清退 | 通过 | 专用提示分支删除，通用前缀识别改为五个现存边界动作；旧动作进入未识别返回，运行代码与静态资源引用为零。 |
| 本地资料入口和弹窗清退 | 通过 | 页头按钮、main动态挂载删除，121行专用组件文件删除；无隐藏入口、替代弹窗或新维护步骤。 |
| 相邻业务交互 | 通过 | 采购详情、金额、SKU、关联物料入口及合作商提示实际回归通过；P1查询、列设置、详情和建单表单的当前性能专项通过。 |
| 业务记录与附件保护 | 通过 | 没有修改idb-storage、业务模型、数据读取或保存逻辑，没有清空操作；复用12a1820b版本的原子保存和恢复合同，页面点击分发除删除维护分支外保持原行为。 |
| 管理端设备 | 通过 | Chrome1366×768及1280×720检查页头、行内和批量菜单，主体无横向溢出；截图见本次证据目录。 |
| 性能 | 通过 | 当前资产60个完整响应样本全部不超过1000ms，最大535.5999999642372ms；原始值保留在本次浏览器日志。 |
| 图片 | 通过 | 未改对象图片、原图预览、失败处理或加载链；当前详情与首屏性能用例仍等待必要图片decode。 |
| PDA和打印 | 不适用 | 本次移除PMS管理端两个功能入口，未修改PDA或打印映射。 |

## 最终结论

结论：通过

本记录补充用户两项新增清退要求，不改写原来源核查和已发布版本证据。底层存储保护合同继续存在，不再通过产品维护弹窗暴露。最终完整技术收据在记录冻结后生成，不预填聚合状态、main推送或正式站结果。

## 变更覆盖与验证

### 受管文件

- `src/components/pms-storage-panel.ts`
- `src/components/shell.ts`
- `src/main.ts`
- `src/pages/pms/product-purchase-orders.ts`

### 页面证据

- 版本：codex/pms-test-alignment-20261013，基准HEAD12a1820b0b2fbcb121534fd1913a27d9063bbd55及本轮未提交差异，实际源码SHA256在pms-extra-controls-20261014/cleanup-evidence.json；工作树/Users/laoer/.codex/worktrees/7eaf/higoods，生产资产/tmp/pms-remove-extra-controls-preview-20261014，本地5408，Chrome1366×768/1280×720，Asia/Shanghai。
- 证据：pms-extra-controls-20261014/extra-controls-1366.png与extra-controls-1280.png显示本轮批量和行内菜单；extra-controls-browser.log是当前两个实际页面用例，cleanup-evidence.json登记删除文件、零运行引用和源文件哈希。

### 性能结论

- 结论：通过
- 依据：extra-controls-browser.log的15个隔离context首访和45个真实SPA点击、查询、列设置及局部弹窗样本；起点为导航或实际用户事件，终点含真实目标DOM、必要图片decode、字体及两次绘制，60个样本全部不超过1000ms，最大535.5999999642372ms。没有修改保存、导入导出、打印的实现，相关合同及不变依赖复用原12a1820b版本证据。

### 验证命令

- `npx vite build --outDir /tmp/pms-remove-extra-controls-preview-20261014 --emptyOutDir`：通过
- `npx playwright test tests/pms-purchase-chain.spec.ts --grep 详情展示采购员|首次访问与关键交互 --workers=1 --reporter=line --max-failures=1`：通过
- `git diff --check`：通过

最终聚合技术收据输出/tmp/pms-remove-platform-order-20261014/task-receipt.json，记录当前实际工程类型、构建、治理、PMS浏览器与CodeGraph检查结果；生成期间不修改绑定文件。

### 例外

- 用户明确要求原型不展示本地资料维护入口，覆盖STORE-05的默认维护入口要求；保留业务记录和附件，没有清空数据。其他原来源未对接功能按12a1820b原版本保持。
