# 款式与规格档案技术引用删除

本轮来源：用户要求款式档案、规格档案删除截图中的技术引用，并删除专属代码。基线abc80b6a5716fb62b031dbdbd66f2c561a2b8b9c；分支codex/product-archive-technical-reference-cleanup；工作树simple-materials-main-integration/higoods；同树生产预览127.0.0.1:43222；管理端1366×768、1280×720。

## 范围、计划与关联

两页共用pcs-product-archives.ts。旧technicalTab反查技术版本和核价方案，并生成跳转链接；旧产品专项还要求技术引用存在。删除两页的引用浏览，不删除技术包和核价自身的业务数据、模块或有效关联，不删除档案的身份与生命周期防错。

- W1 删除两页technical页签、两个正文分支、technicalTab及专属查询导入；不留隐藏入口。
- W2 共享有效页签清单控制渲染与事件，旧/伪造页签不能重新打开已删除内容；修正冲突的历史断言。
- W3 在关联技术版本的演示款式及对应SKU上验证删除和原数据保全；验两个详情冷加载、刷新和保留页签，核对两个视口和完整响应。
- W4 两轮正反向审查、矩阵、治理与收据，文件冻结后输出收据，不改历史已发布记录。

存储：本轮仅减少只读查询，没有新增保存入口、格式或迁移；款式/SKU、技术版本、核价方案沿用原静态与IndexedDB来源，没有删除记录、Blob或关联。浏览器验收使用独立上下文，用户截图中的本地自建数据不作为可复制的演示种子。

## 原子矩阵

确认人：用户明确删除范围；Codex技术验收，不代签用户接受。

|编号|来源|原子要求|工作包|实现位置|自动化|页面/性能|状态|证据及版本|
|---|---|---|---|---|---|---|---|---|
|REF-01|用户要求|款式详情无技术引用页签及正文|W1|DETAIL_TABS/styleBody|产品专项|款式直达/刷新|已验证|REF-v1|
|REF-02|用户要求|规格详情无技术引用页签及正文|W1|DETAIL_TABS/skuBody|产品专项|SKU直达/刷新|已验证|REF-v1|
|REF-03|清洁代码|专属查询依赖、渲染函数、引用跳转代码删除|W1|pcs-product-archives.ts|源码删除断言|无隐藏引用区|已验证|REF-v1|
|REF-04|清洁代码|旧/伪造页签事件不重开已删除内容|W2|详情事件及渲染清单|旧事件注入|页面内容及选中态保持|已验证|REF-v1|
|REF-05|关联保全|技术包、核价自身关联及档案数据不因删除浏览而改动|W3|原仓库/命令未修改|BOM/生命周期/只读快照|技术包独立页面|已验证|REF-v1|
|REF-06|页面验收|保留页签、两个视口布局、图片可用|W3|原详情及页签正文|浏览器断言|1366×768/1280×720|已验证|REF-v1|
|REF-07|性能|受影响加载/刷新/切换每家族5样本<=1000ms|W3|浏览器契约|原始采样|内容/图片/字体/两帧完成|已验证|REF-v1|
|REF-08|交付|两轮逐项正反向审查及最终收据|W4|审查记录|治理与收据|不重复无关流程|已验证|REF-v1|

## 实质审查

第一轮：从两个详情页签走到正文、查询、跳转和事件。共享technicalTab及两条导入/两条分支删除；有效清单同时控制事件，旧事件不进入DOM更新。历史PROD-010还要求该页签，且沿用旧销售页签名称，已经同步到当前目标。原基线失败日志 `/tmp/product-tech-baseline.log` 保留；修改后29项通过。

第二轮：对关联技术版本的演示款式与其SKU执行冷加载、刷新、每个保留页签切换；两类旧technical事件在单元与真实页面均无法重开，页面内容和活动页签保持。源码没有technicalTab、引用区域文案、引用跳转及两条专属导入；只有原详情文件的只读浏览逻辑变化，仓库、命令、路由、技术版本与核价数据没有改动。技术包独立直达页面及工程BOM核价工作流通过；产品29项专项涵盖档案审批、引用防错、销售内容、包装和身份。正向8条与反向实际diff均一致，通过。

## 当前版本证据

REF-v1实际HEAD仍为基线加未提交差异；源码SHA256 `1edbb87db76860598712d56739692f529d4788c880f3038cc0ae7a96375263be`，浏览器脚本SHA256 `6f4ef95aceeabc14bf22bd67360b275b511b26e261acf2cf328d50d4913af139`，运行index SHA256 `29b3fa4cfa3c5784db8479d7f097030eb52d00515d8c55e659fe5eeae2d9a5f9`。Chromium149.0.7827.55，上海时区，禁用网络缓存；独立浏览器上下文。服务PID96414及cwd已核对为同一工作树。款式ID `style_demand_SPU_QC_001`、SKU ID `skuSeed_style_demand_SPU_QC_001_001` 是带真实演示关联的原型记录，非用户截图中自建记录。

[原始浏览器证据](verification-evidence/2026-10-12-product-technical-reference/evidence.json)和[性能汇总](verification-evidence/2026-10-12-product-technical-reference/performance-summary.json)覆盖REF-01～08。75样本、15家族，每家族5次，最大261.69999998807907ms，全部<=1000ms；四轮1366×768，一轮1280×720。导航/真实事件为起点，目标内容、可视实物图片、字体和两帧绘制为终点。新增保存、文件迁移、PDA、打印、导入导出均不适用，本轮未改这些动作或格式。

[款式页面](verification-evidence/2026-10-12-product-technical-reference/style-1366.png)、[规格页面](verification-evidence/2026-10-12-product-technical-reference/sku-1280.png)。REF-01～04自动化为 `tests/pcs-r1-product-rules.test.ts`；REF-05另绑定 `tests/pcs-engineering-bom-version-workflow.spec.ts` 和浏览器技术包直达；REF-06/07为当前浏览器契约；REF-08绑定两轮审查及最终收据。所有实现位置均为 `src/pages/pcs-product-archives.ts` 的DETAIL_TABS、styleBody、skuBody、renderDetail和页签事件；REF-05相关业务消费者未改。

构建815项单元检查及Vite构建通过；产品29项专项和BOM工作流通过。精确运行器路由测试通过，新浏览器和产品专项不使用构建代替运行。原失败日志与本轮日志存放 `/tmp/product-tech-*.log`，收据最终输出 `/tmp/product-technical-reference-final/task-receipt.json`，冻结文件后生成；工具会再次执行必要浏览器/构建检查，旧原始证据保留原版本。该技术交付不代表本轮已合并main或发布。
