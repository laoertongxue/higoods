# 本轮当前原型证据与调整差距

日期：2026-10-05（Asia/Shanghai）。这是设计依据，**不是目标方案的实现验收**。业务规则来自用户指定的三份文件；历史线上/数据库调查使用其已有证据，本轮没有重新连接数据库。

## 1. 版本、工作树、服务与操作范围

- 工作目录：`/Users/laoer/Documents/higoods`。
- 分支/HEAD：`main / 88324f65506f47c678b17d1b51879f8fd7c2488a`，本轮开始与后续核对相同。
- 实际观察服务：`http://127.0.0.1:5173`；Vite 进程工作目录经 lsof 核对为上述仓库。另有4173预览服务，本轮没有拿它作现状证据。
- 页面设备：Codex 内置浏览器，DOM实际视口1280×720。只打开页面、切换菜单/配置面板、读取已渲染内容，没有提交业务表单。
- CodeGraph 已初始化，读取时未报告相关文件待同步；通过 context/explore 查询档案、配置、渠道及毛织对象。本轮直接读已定位文件补充字段与文字证据。
- 调查前已有脏文件：`AGENTS.md`、`src/main.ts`、`src/router/route-renderers.ts`，`src/pages/pcs-local-data.ts` 已删除，`pcs-storage-error.ts`及前轮review文档未跟踪。它们属于此前工作，本次没有吸收、重写、提交或发布。
- 本次只新增本目录方案、表格及文档生成/验证材料。初始来源哈希保存在 [source-baseline.json](source-baseline.json)，结束核对见 [一致性检查](document-validation.md)。

## 2. 当前页面观察

以下数量是**本轮浏览器原型数据**，不是线上经营规模。页面内容通过 CUA 的只读 DOM 观察记录。

| 观察号 | 实际URL | 直接观察 | 对目标方案的影响 |
|---|---|---|---|
| UI01 | `/pcs/products/styles` | 21款式；“已启用21”的说明是已有当前生效技术包；“映射冲突12”；表格将编码/款式名分列 | 档案审核/启用与技术包解耦；无渠道不是缺陷；不保留历史治理统计；图码名合列 |
| UI02 | `/pcs/settings/config-workspace` | 商品类目面板＋13个属性面板＋人民币兑印尼盾汇率；商品定位5、尺码9、颜色86、风格13、风格编号116 | 当前配置入口确实存在，应在此扩展物料分类、属性模板和单位，而非另造配置中心 |
| UI03 | 同上，风格编号面板 | 显示CODE、配置名称、别名/英文、排序、状态、更新时间/人；条目含 `1-Casul Shirt...` 等 | 当前 `styleCodes` 的业务内容应归品类编号，不能只改显示标题而保留错误字段语义 |
| UI04 | `/pcs/materials/fabric` | 当前3主档；CNIDML360、DR-COTTON-001、FAB-COTTON-180；已有查询、重置、导出、列设置、分页及打印 | 复用已有专业列表；增加SKU视图和新字段，不另写通用大框架 |
| UI05 | `/pcs/materials/fabric/material_fabric_001` | CNIDML360；按钮“新增SKU、维护单位换算、查看日志、打印条码”；Tab“概览、物料SKU、变种、技术包引用、日志” | 不是“完全没有单位功能”；需要将现有根档案换算入口调整为每SKU的单位Tab，同时统一SKU和变种 |
| UI06 | `/pcs/products/channel-products` | 当前浏览器列表为空；仍显示“库存/SKU”“链路状态”等列，搜索含项目 | 只能确认列表结构；有数据详情/多对一映射以代码证据分析，未声称实际页面已走通 |
| UI07 | `/pcs/channels/stores` | 5店铺、4启用、1停用，统计“已关联项目3”；渠道选项TikTok/虾皮/独立站；市场含ID/VN/MY/PH/GLOBAL | 新经营范围增加Shopify并限制当前新建为三渠道两市场；项目统计退出；历史保留查询 |

UI01/UI04/UI05 出现“图片加载失败”文字，须在未来实施验收中核对真实可用素材，本轮没有替换图或断言原因。UI05的实物主档/图与线上同码是否完全一致不在本轮证据范围，不能把Mock当作真实采购物料。

配置数量需区分来源：前轮 `prototype-config-options.csv` 是343行，其中特殊工艺8；UI02本轮特殊工艺显示9，其他12组数量与快照一致，合计344。原因尚未调查。方案承接前轮逐项语义并保留当前有效新增/修改，不用343快照覆盖浏览器当前配置。

## 3. 当前代码确认

这里列的是当前已存在的结构，不是目标新模型。行号用于本轮定位，实施时以实际版本为准。

| 证据号 | 当前文件/位置 | 已确认事实 | 方案处置 |
|---|---|---|---|
| CODE01 | [物料类型](../../../src/data/pcs-material-archive-types.ts) | 主档有mainUnit/auxiliaryUnits/unitConversions；SKU另有costPrice/freightCost/pricingUnit及零散色花/加工引用 | 每SKU主辅单位；金额从身份中分离为标准成本；阶段规格结构化 |
| CODE02 | [物料仓库:22](../../../src/data/pcs-material-archive-repository.ts:22) | 五类子类硬编码；面料6、辅料8、纱线4、耗材4、配件5；通用SKU字段复用颜色/规格 | 作为模板种子承接；针织用纱与子类适用字段补齐，设备不占colorName |
| CODE03 | [单位入口:106](../../../src/pages/pcs-material-archive-detail.ts:106) | 单位编辑以materialId打开；保存到主档；当前权限通过技术包审核人目录的“买手”角色判断 | SKU级Tab；独立维护职责；主单位已用锁定 |
| CODE04 | [变种类型](../../../src/data/pcs-material-variant-types.ts)；[变种仓库](../../../src/data/pcs-material-variant-repository.ts) | 独立variantId/code、前驱variantId/layerIndex；materialSkuId可选；工艺中含finish/wash，未按确认四工艺收口；有重复工艺限制 | 合并唯一SKU；工艺适用对象明确；后整理/水洗不默认成为新增永久SKU工艺 |
| CODE05 | [设计改款:37](../../../src/data/pcs-design-revision-material-sku.ts:37) | `requiresDye = !requiresPrint && processes.includes('DYEING')`，印花存在时该判定排除了染色 | 连续染后再印按显式前驱建立，不用互斥布尔替代工艺顺序 |
| CODE06 | [规格渠道关联:1942](../../../src/pages/pcs-product-archives.ts:1942) | 按styleId筛渠道，platformSkuId由渠道码与内部SKU拼接并截32位；来源用projectCode | 改为真实持久平台规格逐行反查，保留外部ID字符串完整性 |
| CODE07 | [渠道父记录:295](../../../src/data/pcs-project-domain-contract.ts:295) | 必需projectId/code/name/node；父层单个skuId/code/name；双份PID/价格/币种；发布批次与商品混合状态 | PID父层只归属一个SPU；SKU映射在每条外部规格；发布操作和商品身份分离 |
| CODE08 | [渠道规格类型](../../../src/data/pcs-channel-listing-spec-types.ts) | 有upstreamSkuId和stockQty；缺每行明确internalSkuId | 外部ID与内部映射分开；删除库存事实；旧手填值不能伪装成平台回执 |
| CODE09 | [基础维度:45](../../../src/data/pcs-config-dimensions.ts:45) | 13个扁平维度，包括风格、品类与名为风格编号的styleCodes；配置业务code有数组序号生成逻辑 | 独立属性、稳定业务码及明确旧值映射；不是把三个字段合为一个 |
| CODE10 | [汇率面板:251](../../../src/pages/pcs-config-workspace.ts:251) | 提示“BOM与价格统一读取当前最新汇率” | 标准成本展示换算与冻结的历史金额分开；不新增汇率变动成本生效流程 |
| CODE11 | [店铺主数据](../../../src/data/pcs-channel-store-master.ts)；[渠道店铺页面](../../../src/pages/pcs-channel-stores.ts) | 主店铺与项目店铺关联并存；主数据已有pricingCurrency/settlementCurrency；页面存在多种库存来源策略 | 一店铺身份；销售/结算币种都展示；WMS共享唯一来源 |
| CODE12 | [渠道页面](../../../src/pages/pcs-channel-products.ts) | 列表与详情有项目来源/步骤、库存/SKU、旧上游ID和混合状态文案 | 重组内容/规格映射/价格/发布同步/测款关联六Tab；移除开发项目依赖 |
| CODE13 | [技术BOM类型:454](../../../src/data/pcs-technical-data-version-types.ts:454) | 同时含materialSkuId/variantId、用量/单位/损耗、供应商及印染绣需求/正反花型引用 | 只统一本任务涉及的SKU、工艺、标准参考；BOM损耗等本领域字段不因本次成本公式排除而全删 |
| CODE14 | [毛织类型](../../../src/data/fcs/wool-domain/types.ts)；[毛织存储](../../../src/data/fcs/wool-domain/store.ts) | 已有GARMENT/WOOL_PANEL、KNITTING/LINKING、requiredYarnSkus、BOM行引用、externalPieces、KG领发、片/件交接 | 复用既有成片/缝盘对象；不另建第六物料类型、不任挑纱线当唯一前驱 |
| CODE15 | [物料旧保存:1023](../../../src/data/pcs-material-archive-repository.ts:1023) | `higood-pcs-material-archive-store-v2`读取/写入整包快照仍在此仓库可见 | 未来业务调整时同时收口相关存储链，不把藏起维护面板当成存储改造完成 |
| CODE16 | [PCS路由](../../../src/router/routes-pcs.ts) | 主要款式、规格、渠道、店铺、五类物料及详情入口已经存在 | 优先保留主要命名入口；只为独立物料SKU详情增加明确地址 |

`CODE13`尤其要避免误用：用户排除损耗、供应商进入**档案/本次综合标准成本**，不等于授权删除采购/技术等其他领域的所有同名字段。处置必须看对象归属和真实用途。

## 4. 使用历史调查的边界

本轮复用前一轮的403字段清单、69组线上观察与数据库调查文件；逐项处置详见本目录CSV。403是前轮选定对象/DTO中的字段出现次数，不是全仓全部字段数；69是观察字段组，不是全站全表总字段数。

当前线上页面与旧测试数据库之间仍有字段/枚举来源需要真实接入前核实。用户要求暂不考虑历史坏数据，目标原型按历史身份完整设计；这不会把已有调查里的异常记录改写为“已修复”。本次未执行SQL，也不披露数据库凭据。

## 5. 本轮没有得到的证据

- 本方案新增页面、交易与字段尚未实施，没有新方案性能和持久化通过证据。
- 未对三渠道真实API做发布或双向同步，没有实际店铺连接成功结论。
- 渠道列表为空，不把源码里的详情功能说成当前浏览器已验证。
- 没有对打印机/扫描设备做长码实测，也没有重放全部毛织/PDA链路。
- 旧维护面板移除已有单独历史收据；本轮保留原改动，未重复宣称完整性/附件来源故障已经解决。

上述限制已反映在工作包与验收矩阵中；已确认规则不再列为业务方向待问。
