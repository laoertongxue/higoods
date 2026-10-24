# HiGood 原型架构说明

本文描述当前代码组织，不制定项目规则。技术边界和改动要求见 [AGENTS.md](AGENTS.md)，启动方式见 [README.md](README.md)。

核对日期：2026-10-10。业务源码基准：`99e25a0b846188176516a882b8c8d30fb915f6ef`；下列链接指向各实现入口。之后的结构变化以目标版本源码为准。

## 技术与入口

应用由 [index.html](index.html) 加载 [src/main.ts](src/main.ts)，在浏览器中把 HTML 字符串写入 DOM。它不是服务端渲染；React 目前用于 [二维码挂载](src/components/real-qr.ts)等隔离功能，不承担页面组件树。

构建使用 Vite，业务与页面使用 TypeScript，样式同时来自 Tailwind 类和 [src/styles.css](src/styles.css)。图标由 Lucide 处理，浏览器测试使用 Playwright。依赖声明及解析版本分别在 [package.json](package.json) 和 [package-lock.json](package-lock.json)，本文不复制版本表。

## 系统入口与终端形态

[app-shell-config.ts](src/data/app-shell-config.ts) 的 `systems` 配置包含以下入口。菜单存在只说明导航已配置，不代表该系统所有业务能力均已完成。

| 系统 | 中文名称 | 默认入口 |
| --- | --- | --- |
| PCS | 商品中心系统 | `/pcs/products/styles` |
| PMS | 采购管理系统 | `/pms/workbench/overview` |
| FCS | 工厂生产协同系统 | `/fcs/workbench/overview` |
| PFOS | 工艺工厂运营系统 | `/fcs/craft/workbench/overview` |
| WLS | 仓储物流系统 | `/wls/fabric-demand-board` |
| LOS | 直播运营系统 | `/los/live-schedule` |
| OMS | 订单管理系统 | `/oms/order-list` |
| BFIS | 业财一体化系统 | `/bfis/financial-report` |
| DDS | 数据决策系统 | `/dds/dashboard` |

PDA 是终端形态，不是第十个业务系统。PDA 页面主要位于 `/fcs/pda/*`，也存在 WLS PDA 入口；打印同样有独立呈现形态。[renderAppShell](src/components/shell.ts) 根据路由选择桌面外壳、PDA 或独立打印容器。

## 代码职责

| 位置 | 当前职责 |
| --- | --- |
| [src/main.ts](src/main.ts) | 启动、按路由准备数据、组装页面与外壳、事件分派、局部或整体刷新 |
| [src/state/store.ts](src/state/store.ts) | `AppStore` 管理路径、系统标签页、菜单展开等外壳状态及浏览器历史 |
| [src/router/](src/router/) | 精确／动态路由匹配、按需加载路由注册表与专项页面、重定向和兜底页 |
| [src/pages/](src/pages/) | 页面渲染及部分页面内状态、事件处理 |
| [src/main-handlers/](src/main-handlers/) | 系统或业务交互分派；并非所有页面事件都经过同一个 Handler |
| [src/components/](src/components/) | 外壳、共用业务展示与 UI 渲染、图标及二维码挂载 |
| [src/data/](src/data/) | 演示数据、查询／业务动作、浏览器存储与运行数据适配 |
| [src/domain/](src/domain/) | 部分业务领域的类型、规则、对象关联和视图适配 |
| [src/helpers/](src/helpers/) | 已存在的共用辅助能力 |

目录名称不构成严格单向依赖保证。业务数据与操作状态也不都位于 `AppStore`；分析某项保存或数量规则时，需要沿该动作的实际读取、计算和提交入口定位。

路由入口 [routes.ts](src/router/routes.ts) 先处理部分专项和精确路径，再按路径选择 FCS、PCS、PDA、PMS、WLS、LOS、织带等注册表；未命中时还有菜单兜底。它不是只向三个注册表分派，也不是每个系统都恰好对应一份注册表。

## 三条不同的运行路径

### 导航与整体组装

`AppStore` 同步导航和标签页，`main.ts` 的 `render()` 获取当前页内容，再调用 `renderAppShell(state, pageContent)` 包装并挂载。页面模块返回内容；外壳由主入口组装，不是每个页面自行调用外壳。

下图箭头表示调用或数据传递，节点标明责任：

```mermaid
flowchart TD
    N[导航 / 浏览器历史] --> S[AppStore 更新路径与标签]
    S --> M[main.ts render]
    M --> P[renderCurrentPageContent 准备对应数据]
    P --> R[resolvePage / 专项路由渲染]
    R --> V[页面函数生成 HTML]
    V --> C[main.ts 获得 pageContent]
    C --> H[renderAppShell 包装内容]
    H --> D[挂载到 app DOM]
    D --> Q[图标及二维码挂载]
```

### 局部交互

主入口委托 click、input、change、submit 等事件，页面也可能有自己的局部处理。当前存在 `renderSidebarOnly()`、`renderPageContentOnly()` 及页面内部的局部更新；并非每次输入都经过完整的 `AppStore → resolvePage → root.innerHTML` 路径。

```mermaid
flowchart LR
    E[用户动作] --> H[对应页面 / 系统处理器]
    H --> B[校验与业务计算]
    B --> U[按实际处理分支更新区域]
    U --> S[侧栏 / 页面内容 / 对话框等 DOM]
```

具体动作是否局部更新、是否保留焦点和滚动，以其处理器与运行证据为准；这张结构图不证明全部页面已经完成局部刷新治理。

### 读取与保存

现状同时包含静态演示、页面内存、IndexedDB 和遗留存储入口，不能概括为纯 TypeScript Mock，也不能认定全站都已迁移到 IndexedDB。

| 数据形态 | 已核对的实现例子 |
| --- | --- |
| 随应用发布的演示基线 | [pcs-record-bootstrap.ts](src/data/pcs-record-bootstrap.ts) 读取静态 JSON 并准备内存基线 |
| 页面／运行内存 | 页面状态与 [pcs-record-runtime.ts](src/data/pcs-record-runtime.ts) 的工作副本、读取缓存和提交协调 |
| IndexedDB 记录与附件 | [pcs-record-db.ts](src/data/pcs-record-db.ts) 保存记录、Blob、操作标识及迁移信息，并等待事务完成 |
| 外壳偏好 | [state/store.ts](src/state/store.ts) 的标签页和菜单状态 |
| 遗留或适配入口 | [browser-storage.ts](src/data/browser-storage.ts) 仍提供 localStorage / sessionStorage 访问和业务工作副本适配；是否已被迁移路径接管取决于调用方 |

以下是 PCS 已接入记录存储的概念路径，不代表其他模块都具有相同实现：

```mermaid
flowchart LR
    A[静态基线] --> R[运行读取视图]
    I[(IndexedDB 已保存记录)] --> R
    R --> V[页面展示]
    V --> W[动作工作副本 / 校验]
    W --> T[记录与附件事务]
    T --> C[事务 complete]
    C --> I
    C --> U[发布提交结果 / 更新页面]
```

未保存输入与保存结果的边界、错误恢复和迁移目标由 `AGENTS.md` 的 STORE 规则约束；是否已满足仍需按具体模块核验。

## 裁床领域定位示例

[src/domain/cutting-core/](src/domain/cutting-core/) 中的类型、注册表和引用解析用于关联生产单、裁片任务等对象；`resolveXxxRef()` 这类函数负责解析关联，不等同于持久化仓库。其余裁床业务还分布在 [src/data/fcs/cutting/](src/data/fcs/cutting/) 与 [src/pages/process-factory/cutting/](src/pages/process-factory/cutting/)。这些路径用于定位，不是完整性或推荐架构评分。

## 构建、测试与部署入口

- [vite.config.ts](vite.config.ts) 包含分块、部分路由预加载、静态资源及预览压缩处理；构建行为以该配置为准。
- [package.json](package.json) 的 `build` 执行工程类型检查、单元测试和 Vite 构建；专项检查另有命名入口。
- [scripts/](scripts/) 保存专项与治理检查，[tests/](tests/) 保存单元、契约及浏览器测试；数量不等于覆盖率，每项结果只证明其断言范围。
- [playwright.config.ts](playwright.config.ts) 定义浏览器、服务和产物设置；裁片使用方式见 [专项手册](docs/cutting-e2e.md)。
- [vercel.json](vercel.json) 提供 SPA 路径重写。构建、Git 推送与 Vercel Production 成功是不同证据，发布口径见 `AGENTS.md` 的 RELEASE 规则。

## PPIC 每日回货与两节点（2026-10-14 范围补充）

本节核对本次未提交工作树；上文其他模块仍保留其原核对版本。具体业务来源、替代关系和验收矩阵见 [实施方案](docs/product-design/PPIC每日回货跟进与两节点履约调整具体方案-2026-10-14.md)。

- 每日回货填报位于 `/fcs/sewing-outsourcing/daily-return-report`，以标准列表全量展示第三方车缝任务的回货情况，并支持按 PPIC 下拉筛选；原 `/fcs/sewing-outsourcing/daily-return-summary` 页面、菜单和地址已并入该页。页面写操作按任务当前负责 PPIC 记录，不提供身份切换；其他 PPIC 页面仍使用当前浏览器上下文的演示身份，不代表真实登录或多人权限系统。
- 每日填报统计位于 `/fcs/sewing-outsourcing/daily-return-statistics`，按业务日期和近7／14／30天展示应填报任务、已填报／未填报 PPIC、已覆盖任务、每日趋势和每个 PPIC 的完成情况；统计口径为当前第三方车缝任务及负责人，完成数来自有效日确认。
- [应回数量依据](src/data/fcs/ppic-return-quantity-basis.ts) 只读有效任务、实际简易／中转袋交出和已确认放行版本。无缺片按交出齐套件数，有缺片按对应任务放行数量，裁剪到包装按任务分配数量；不明来源保持待核对。历史节点按各自截止时的来源计算。
- [共享日历](src/data/fcs/sewing-return-calendar.ts) 和 [任务履约策略](src/data/fcs/task-fulfillment-policy.ts) 提供35%和100%两节点，业务时区为Asia/Jakarta。新合同／分配预览、有效监控、进度和PDA使用同一规则；旧签署合同和失效历史快照保留原内容。
- [每日回货计算](src/data/fcs/ppic-daily-return.ts) 保存原承诺、安排修订和补回链。正式实收按原截止优先分摊，原准时率以原数量和原截止计算；补录及更正重算结果并保留旧分摊／评估。补录解除的补回义务单独显示，不修改原安排，也不虚构补回建立前的实收。
- [每日记录入口](src/data/fcs/ppic-daily-return-records.ts) 复用 [后道记录仓库](src/data/fcs/post-finishing-records.ts) 和已有 `higood-pcs-records` IndexedDB。八类记录按稳定主键保存至 `higood-fcs-post-finishing-records` 命名空间；后道确认、更正、库存／待送检质检单及PPIC分摊在同一事务完成。普通FCS与PDA后道入口均在开放操作前注册分摊并读取持久资料。
- 每日截止默认17:00，截止设置保留生效日期，提交记录保留配置身份。每日确认绑定所选 PPIC 的当前任务、原承诺、当日补回和改约动作；失效历史任务只读，不进入当日确认集合。
- 裁片来源仍属于已有裁床库，后道及PPIC记录属于PCS库。跨库不假称共同事务：新承诺在保存前核对来源版本；后道正式确认及其直接下游结果在PCS同库事务保存。页面普通读取不生成演示数据副本。


### 后道逐项加工与多次复检出货（本地原型）

- [后道事实](src/data/fcs/post-finishing-full-flow.ts)以QC选择的四项筛选链执行。加工完成记录按加工单、加工项与SKU保存本次增量，分别记录责任人与录入人；统一进度查询计算前后序可用量、末项完成量和复检占用。
- 同一加工单可显式多次交复检；复检建立即占用本次量，每张有效完成复检对应独立出货及成衣仓实收。主单与直接关联记录、日志及必要PPIC投影继续复用同库事务，不增加加工批次对象或服务器。
- [记录仓库](src/data/fcs/post-finishing-records.ts)增加逐条完成记录与格式3读取/显式转换。历史合并完成H与剩余N分离；原分项未知量保留未知，通过主管核对后续办。备份恢复先构造候选并核验数量/关系，错误不写入；旧源转Blob、归档和分批续跑保持既有库边界。
- 保存前保留一份独立回滚副本；已分离候选与回滚快照通过仓库赋值切换，避免反复克隆整套历史。调用方结果另行分离，事务complete后才发布候选；读/恢复候选不原地修改先前仓库值。
- Web、PDA、任务/统计和两套打印读取同一数量事实；通用后道打印直达时独立读取持久记录。实际方案、冻结选择、原子矩阵和本地验收证据见[本期调整方案](docs/product-design/2026-10-19-后道逐项加工与多次复检出货调整方案.md)，验证状态以本期矩阵与审查记录为准。
- [当前读取模型](src/data/fcs/post-finishing-current-read-model.ts)在一次同步查询中取得所需来源快照，指定动作类型只生成该类结果；不跨动作保存长期缓存。后道统计从实际回货、加工、复检、出货及逐张仓收读取，生产任务范围与实际后道单范围分别筛选；生成出货和成衣仓实收分别计数，不引用通用演示仓的收发量。
- 共享资料准备失败可能早于后道自身读取。[主入口](src/main.ts)在后道范围核对共享读取的实际失败原因后，显示[入口恢复提示](src/pages/process-factory/post-finishing/storage-notice.ts)并复用重新读取按钮；该PDA错误页不继续加载尚未准备好的执行处理器。恢复不清库、不复制静态种子。
- 与辅料仓归属整合后，含受管原辅料的混合旧包仍可转换服装加工事实。原辅料进入完整只读归档，保存原来源身份与图片转换前指纹；已有PCS原辅料不重写、不删除。辅料专用归档既读取原源，也读取这份同身份历史，不重复建立库存。后道备份恢复同样只保留受管原辅料历史，不改辅料仓余额；两库的显式业务动作分别提交。
- 普通路由由辅料读取边界统一准备一次后道记录，避免紧邻重复全量读取。原辅料只读保护在每次核对中取得一份当前生产归属集合，仍在保存时比对原事实，没有跨动作来源缓存。

- 后道事件中已发生站内导航时，由既有store订阅负责目标渲染；主入口的通用事件、独立click及扫码Enter三处不再重复启动同一目标准备。未导航、失败及局部表单仍保留原刷新/输入恢复路径，不忽略来源锁错误。
- 详情页直接展示符合数量和状态前提的加工登记、交复检、订正和历史核对入口；不提供演示身份切换。加工责任与录入人分别记录，订正和历史核对在本次表单明确选择实际核对主管并填写依据，沿用领域主管约束与原记录保留。这是原型的本次责任确认，不代表真实鉴权。

- 安装原辅料读取保护时，按原材料实际涉及的生产身份（包括保存配料记录的旧单号别名）映射候选生产单，再复用现有配料投影的生产单筛选读取实际辅料归属。共享预留、来源签名、全部库存合法性及失读/格式错误保护保持；不复制未使用的全准备单可用量，不改业务页问题目录，不跨调用缓存。

后道任务目录的Q/F/可交复检量使用同一计算函数的独立primitive摘要；完整执行详情仍读取各项SKU、责任与登记历史。单父单详情在深复制前过滤本父单的复检、出货与待交出记录，PDA仅在同一次同步render共享结果，不跨动作缓存。后道读取特殊工艺来源使用专用来源getter，保留原正式成衣烫图／直喷筛选和纯毛织末工艺数量；首次来源构造不提前建立工艺厂仓展示。原生成过程的中间仓参数仅于内存暂存一次，首次普通工艺入口按原次序补齐，失败恢复仓快照并保留重试批次，重置清理旧批次，直接restore在旧store补齐后再替换。普通工艺与裁床入口保持各自职责；未使用的仓链接在普通仓投影后补齐，后道不以这些链接作为正式回货依据。

评级使用的车缝席位值直接从当前工厂记录按精确ID或代码读取独立primitive，再执行原正整数／评级快照回退规则；不为每次单字段查询复制全部工厂档案。工厂完整列表、加载归一化、保存校验和带别名的完整对象查找保持各自语义，席位查询不加跨动作缓存。

后道当前读取在同一次同步投影内避免重复工作：R合并记录后按集合稳定分组；内部严格校验读取原明细但公开getter继续复制。任务目录读取每张复检／出货／待交出primitive摘要，保留原状态、日期、数量和张数。加工单列表只在本次渲染内按精确生产单号复用辅料状态，下次渲染和独立弹窗均重新读取；无跨动作缓存或新增可写事实。

通用打印预览的两种后道出货类型直接动态加载原post-finishing-outbound模板，复用原registry中的构建/渲染函数与来源限制；避免初始化未使用的领料、裁床及采购来源。原统一registry、其他打印类型、后道独立持久读取和模板内容保持。

交接目录的pickup/handout/类型/完成选择器复用原构造与排序，仅将原纯类型/状态筛选放在最终structuredClone之前；全量getter和返回对象隔离不变。F090染色实际交出来源、仓异常和相关待办继续完整读取。

统一后道出货单与条码打印在主入口按与后道质检打印相同的只读范围加载，不提前初始化采购列表。已保存生产来源effects仍按原规则恢复；PCS、部位票、裁床及后道自身持久来源读取保持。菲票导入和打印保存时序保持原实现。

后道辅料readiness先以既有实时精确生产归属判断，不受辅料仓管理的生产单继续原后道历史调拨/QC兜底；受管单保留完整配料/归档/当前调拨及实收判断。治理路径读取使用16MiB有界Git输出，任务门禁长命令超过32KiB时使用同一冻结基线的完整工作区范围，短范围仍精确传递路径。

后道共享交接的辅料精确单号查询、整单收货后带materialOrderNo的路径变化，只有前后均为/fcs/pda/handover且至少一端有单号才复用main既有导航去重。进入或退出自助回货管理，以及任一端属于专用后道的实际路径变化，同样由原store订阅渲染目的页，避免外层再次并发准备生产来源；非导航错误、受管收货的原局部替换、工厂和仓管限制保持。
