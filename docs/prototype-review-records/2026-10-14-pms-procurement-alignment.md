# 采购管理逐页对齐的完整产品审查

依据 `AGENTS.md`，使用当前唯一治理记录模板；继承测试站冻结功能清单及用户明确六对象删除范围。技术验收与用户产品接受分开登记。

## 基本信息

- 日期：2026-10-14
- 任务 / 需求编号：PMS-TEST-CORE、PMS-TEST-BASIC、PMS-TEST-OPS、PMS-TEST-TAIL、PMS-TEST-ROOT及六对象退役，806条追踪
- 验证人：Codex 主代理（原子追踪、实际浏览器及最终整合），原独立审查者 procurement_cleanup；不是用户产品接受

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：采购管理9组30项含图标菜单、21个列表/详情/表单/关联状态，六对象菜单至数据和路由删除；IndexedDB原子写入、真实文件导入和关联采购/物流/库存/请付款读取产生可见结果。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 来源页与按钮清单 | 通过 | inventory七批测试环境观察先冻结，806条记录与source-checklist.md双向覆盖；正式站历史记录单列，测试站业务最终提交未执行。 |
| 菜单顺序与图标 | 通过 | 9组21页30项均有SVG和文字，315个页面样本包含menu完整读回。 |
| 六对象完整删除 | 通过 | 14个对象代码/测试文件删除，路由、处理器、Mock、导入导出及直接消费者解除；pms-cleanup-implementation.json与源码检查。无旧地址跳转。 |
| 数量与金额守恒 | 通过 | PPO实际拆分/合并、MPO到货与QC、货箱换箱、库存及物流100/80/30/20/50，页面case及原native读回；复制清旧事实，混币/汇率与超量阻断。 |
| 状态及门禁 | 通过 | 已确认发货采购已到货后实际拒绝保存；审核驳回/重开/QC/售后终结、KOL占用/借出、空选和必填合法/边界分支；final-functional-closure.json逐家族绑定。 |
| 保存与失败恢复 | 通过 | 主单+关联+日志+附件共同事务complete后发布；静态不落盘、原子冲突与稳定操作去重合同；25次备份恢复含20次非法整次阻断及5份ABC原始Blob独立回读。 |
| 本地数据保护 | 通过 | 显式HGPMS001二进制备份/恢复、旧采购迁移人工入口；无登录/云库、无业务localStorage保存后备；retired物理旧库历史保留且无活动消费，不清用户资料。 |
| 标准管理列表与Mock | 通过 | 21页默认固定演示均两页，标准标题/查询/统计/表格/分页，列宽表内滚动、偏好按路由；用户新增不受两页限制。 |
| 页面与设备布局 | 通过 | Chrome1366×768及1280×720截图实际核验；页面加载布局无主体横向溢出，表格滚动保留，局部操作shellPreserved。 |
| 图片 | 通过 | 合法PCS商品/物料来源与存量明确快照，thumbnail及同对象原图；共享原图关闭/遮罩/Esc/加载失败重试保输入。final截图及owner/raw图片合同保留原版本。 |
| 电子打印与导出 | 通过 | Code128、包装二维码、货箱/标签电子预览对应来源数量；BIFF8有效字节与独立xlrd结果、OOXML实际导入；真实跨页PPO12/MPO8 CSV含原币/单位/数量而无操作列。 |
| 物理打印和真实生产 | 不适用 | 本次为单浏览器演示原型，未执行真实打印机、银行付款或工厂业务；电子预览的技术验证不作实物业务事实。 |
| PDA | 不适用 | 用户范围为PMS管理端采购21页，未新增员工PDA页面或其动作。 |
| 性能 | 通过 | 315有效Chrome首访/SPA/刷新最大895.1999999880791ms；每入口各5。V12MPO1150.1失败原样保留，实际图片预取后V13该页15样本最大647.9ms。其它依赖未变按原版本复用；实际保存/导入/文件生成及边界家族原始采样，FLS重置5次最大54.6ms。 |
| 审查与直接消费者 | 通过 | 原101文件独立审查及6P2实际修复补证保留；主代理复核当前105代码/测试变更，后续5产品文件增量按实际影响复验，TMF/PCS/WLS只读直接消费者不引双写。 |

## 最终结论

结论：通过

本结论仅为本任务适用的本地原型技术验收。806条追踪是控件、字段、状态与观察结果，800条已验证含删除对象、6条原来源未可执行分支不适用；不是806次独立按钮测试或用户产品接受。31个独立页面case已在最终首轮收据中单批真实通过（2.1m），全工程866/866单测通过，失败只测试定位/旧流程及预期对象就地排序，原失败和复验均留存。最终工程收据在文件冻结后单独生成，不预填其机器状态。

## 变更覆盖与验证

### 受管文件

- `src/components/pms-storage-panel.ts`
- `src/components/shell.ts`
- `src/data/app-shell-config.ts`
- `src/data/pms/bom-detail.ts`
- `src/data/pms/bom-templates.ts`
- `src/data/pms/canonical-purchase-references.ts`
- `src/data/pms/core-write-contract.ts`
- `src/data/pms/first-leg-logistics.ts`
- `src/data/pms/fitting-timeliness.ts`
- `src/data/pms/idb-storage.ts`
- `src/data/pms/inventory-monitor.ts`
- `src/data/pms/kol-sample-apply.ts`
- `src/data/pms/kol-sample-link.ts`
- `src/data/pms/kol-sample-stock-lock-log.ts`
- `src/data/pms/kol-sample-stock.ts`
- `src/data/pms/legacy-purchase-migration.ts`
- `src/data/pms/material-inventory.ts`
- `src/data/pms/material-purchase-orders.ts`
- `src/data/pms/material-requirements.ts`
- `src/data/pms/materials.ts`
- `src/data/pms/payment-requests.ts`
- `src/data/pms/product-purchase-orders.ts`
- `src/data/pms/product-skus.ts`
- `src/data/pms/purchase-order-aftersales.ts`
- `src/data/pms/purchase-suggestions.ts`
- `src/data/pms/reconciliations.ts`
- `src/data/pms/reorder-suggestions.ts`
- `src/data/pms/runtime.ts`
- `src/data/pms/supplier-confirmations.ts`
- `src/data/pms/supplier-supply-archives.ts`
- `src/data/pms/suppliers.ts`
- `src/data/pms/tmf-master-registry.ts`
- `src/data/pms/tmf-material-purchases.ts`
- `src/data/pms/units.ts`
- `src/data/pms/warehouses.ts`
- `src/icons/shell-icons.ts`
- `src/main-handlers/pms-handlers.ts`
- `src/main.ts`
- `src/pages/pms/bom-detail.ts`
- `src/pages/pms/bom-templates.ts`
- `src/pages/pms/core-interactions.ts`
- `src/pages/pms/first-leg-carriers.ts`
- `src/pages/pms/first-leg-shipments.ts`
- `src/pages/pms/fitting-timeliness.ts`
- `src/pages/pms/kol-demands.ts`
- `src/pages/pms/kol-sample-apply.ts`
- `src/pages/pms/kol-sample-link.ts`
- `src/pages/pms/kol-sample-stock-lock-log.ts`
- `src/pages/pms/kol-sample-stock.ts`
- `src/pages/pms/local-list-interactions.ts`
- `src/pages/pms/material-archives.ts`
- `src/pages/pms/material-inventory.ts`
- `src/pages/pms/material-purchase-barcodes.ts`
- `src/pages/pms/material-purchase-orders.ts`
- `src/pages/pms/material-purchase-tracking.ts`
- `src/pages/pms/material-requirements.ts`
- `src/pages/pms/payment-requests.ts`
- `src/pages/pms/product-purchase-orders.ts`
- `src/pages/pms/product-skus.ts`
- `src/pages/pms/purchase-order-aftersales.ts`
- `src/pages/pms/purchase-suggestions.ts`
- `src/pages/pms/reorder-suggestions.ts`
- `src/pages/pms/shared.ts`
- `src/pages/pms/supplier-confirmations.ts`
- `src/pages/pms/supplier-supply-archives.ts`
- `src/pages/pms/suppliers.ts`
- `src/pages/pms/units.ts`
- `src/pages/pms/warehouses.ts`
- `src/pages/wls/raw/fabric-inventory-count.ts`
- `src/pages/wls/raw/stock-flow.ts`
- `src/router/route-renderers-pms.ts`
- `src/router/routes-pms.ts`
- `src/utils/pms-business-number.ts`
- `src/utils/pms-excel-binary-import.ts`
- `src/utils/pms-excel-import.ts`
- `src/utils/pms-export.ts`

### 页面证据

- 版本：分支codex/pms-test-alignment-20261013、HEAD ee14949905b08b260e9c6309eebc59bfa5b32764；未提交运行差异SHA256 b19d723ac4fd3d23a5a8a124ff32247f84bea6408896bacec5a30d1a41fbe9fa；工作树/Users/laoer/.codex/worktrees/7eaf/higoods，V16 frozen生产资产/tmp/pms-final-prod-v16-20261014，manifest digest 3279d61646e0e47bd4be447eb2e26e3ed2c92758ddc508f61f51a58d3f232c28；Chrome本地5393预览，1366×768/1280×720，Asia/Shanghai。旧不变处理器证据保留各自V3/V9/V11/V12环境，V13MPO加载与V14PPO复制清事实按影响追加。
- 证据：pms-alignment-20261013/final-evidence/final-functional-closure.json列35个实际功能家族、独立持久读取与31页面case日志；source-checklist.md是先冻结来源合同，requirements-matrix.json逐项实际文件/符号/证据；final-purchase-suggestions-1366.png、final-material-purchase-1280.png已视觉核验。CSV及恢复ABC Blob保留真实字节。采集错误和版本误标记录单列，不计入有效样本。

### 性能结论

- 结论：通过
- 依据：final-evidence/final-loading-coverage-report-20261014.json的315个accepted原始完整响应值与原版本/哈希，目标h1/路由、真实必要图片decode、字体及两次绘制就绪；导航从加载/真实切换/刷新开始。操作从真实点击/输入开始，保存还验transaction complete和独立持久读回，导出含实际Blob生成；每等价家族至少5有效样本。V16 headless21×5隔离context首访和P1原始性能在真实执行日志保留；隔离context首访不冒称新浏览器进程冷启动。任何历史有效超时保持原记录及明确修复复验，不取平均或删除慢样本。

### 验证命令

- `npx vite build --outDir /tmp/pms-final-prod-v16-20261014 --emptyOutDir`：通过
- `node --import tsx --test tests/unit/pms-product-purchase-orders.test.ts`：通过
- `git diff --check`：通过

完整31单批旧结果及局部直接复验均保留原命令参数、origin、文件SHA和日志。31独立case各自最终均已通过，原六文件完整批次退出失败仍为历史失败，未将它填为通过；冻结后workflow聚合强制重新执行的单批结果与build/治理/CodeGraph见独立输出 /tmp/pms-final-receipt-r2-20261014/task-receipt.json，生成前不预填。已实际执行的治理命令完整路径参数和退出码见final-evidence两份governance日志，列表检查覆盖23个变更页面、排除0项；后续收据继续真实记录。条码模块仅补详情抽屉模式声明两行注释，运行内容及原证据不变，当前源码哈希单列。

### 例外

- 来源测试站的单/批合作商暂无候选、店小秘一键下单待对接、面辅料样衣待对接、尾部烫包质检合作商待对接、创建工单待对接共6条不适用，展示可理解边界，不伪造第三方或真实工单集成。
- 用户明确删除六独立基础对象；同单位/仓库/PCS BOM引用由现有有效来源承担，不删除合法共享事实或用户旧库历史。
- 用户授权既有Playwright项目本地测试，仅访问127.0.0.1；测试环境观察只读，不对正式站或测试数据库写入。未要求Git推送/部署，本地技术结论不声明发布。

## 最后工程收口与首轮真实失败

首轮workflow实际所有31个页面case单批通过、866个业务单元测试通过；机器状态仍为implemented，原因是固定锁定日志地址只注册在literal dynamicRoutes而菜单规则要求exactRoutes，及4个测试文件没有检查映射。已把同一固定地址与同一renderer移至exactRoutes，菜单检查208个唯一地址0缺失/0重复；该入口5次首访、5次真实SPA、5次刷新共15样本最大488ms。没有改变URL、对象、存储或状态。

治理映射仅补冷加载→原六suite、memory-idb→实际所有单位消费者、旧audit/style退役ROUTES→窄AST/源码合同，保留未知测试路径阻断。两旧驱动本次只删除退役对象7地址（BOM含detail），ROUTES外逐字不变，窄合同覆盖新增/选择器/重排/驱动修改负例，不称泛点击或旧截图驱动已执行。专项47/47、治理回归318/318真实通过，后续最终收据按工具必需检查重新执行，原失败收据与31/866成功日志原样留存。

最新产品源码/资产与具体路由补验见final-evidence/final-production-v17-manifest.json和formal-v17-lock-route.json。原315页面样本与业务操作未变化处理器保留其身份，不改标V17。最终机器状态登记在外置第二轮收据，正文不预填未来结果。
