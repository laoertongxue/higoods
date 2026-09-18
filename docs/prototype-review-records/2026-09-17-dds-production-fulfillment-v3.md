# DDS 生产与履约时效 V3 来源与页面审查记录

## 1. 基本信息

|项目|内容|
|---|---|
|记录日期|2026-09-17|
|相关需求 / 任务|V3-UI-001～003、V3-SOURCE-001～004、V3-VERIFY-001；删除顶部角色和时间选择、组合责任筛选、嵌入表对齐、准备与工艺路线来源对齐|
|记录模式|完整产品审查|
|涉及系统|DDS 供应链域；只读引用 PCS/FCS 原型来源|
|端类型|管理端 / 主管端 Web|
|主要角色与任务|跟单查看本需求准备和路线，管理端按团队及工厂筛选，追溯缺失事实|
|分支 / HEAD|codex/dds-production-fulfillment / 4804328a822eec3c77eee1ffa5b10911bb77c9fe；本轮工作树修改未提交|
|工作树 / 服务|/Users/laoer/Documents/higoods；4178 dev；4179 同工作树构建 /tmp/higoods-dds-pf-build|
|验收环境|隔离 Chromium；1366×768、1280×720、1024×768、1920×1080；逐项环境与原始耗时见 verification.json|

## 2. 影响判定

- 用户可见影响：有
- 判定依据：删除顶部 Mock 标识、角色与时区选择；业务筛选变为检索、跟单、责任团队、责任工厂；详情表与页签左沿统一。主任务从独立演算切换到当前原型需求、准备关联、正式技术包路线及工序执行来源。时点改为本次读取时刻，固定按北京时间解释与显示。
- 当前基线：AGENTS.md 第4、5、7节；已应用 higood-indonesia-factory-design 技能。当前 AGENTS.md 差异由用户所有，本轮未编辑。
- 主数据来源仍为本地原型，不是线上采购或真实生产库。本轮没有修改 PCS/FCS 来源业务记录，只保存 DDS 明确关联、跟进和规则本地配置。

## 3. 自查结论

|检查项|结论|说明|
|---|---|---|
|角色、任务与页面模式|通过|角色选择删除；六个业务查询入口提供跟单/责任团队/责任工厂；规则页保留配置目录到编辑弹窗|
|信息密度与层级|通过|四列等宽条件，操作行位于全部条件下，紧凑统计；嵌入工作表去重复标题，列设置移至分页工具区|
|文案、状态、数量与单位|部分有证据，整体不通过|需求数量保留；未知合格数/实发数/标准不补零。正式时效及全部履约事实尚未接入，不能宣称全程可计算|
|准备与工艺来源|部分通过|准备按适用/明确复用投影；路线保留直接前置、工序实例与投入产出 SKU；执行按生产单ID及唯一工序ID关联，不能按名称合并|
|交接及订单事实|不通过|材料供给分配、到仓/调拨/目标厂实收、合格产出、实际订单发货全链仍未完整关联|
|真实图片与对象识别|不通过（完整素材覆盖）|款图直接取生产需求已有 imageUrl，与款号同单元格；不再使用全任务同一卫衣图。新增路线 SKU 尚未逐一具备物料图，保留素材覆盖缺口|
|防错与来源写入|通过|同款既存准备单、正式技术版本校验；只写 DDS 关联键，不创建来源业务单据|
|低分辨率和命名交互|通过|本轮脚本逐路由验收并保存截图；不引用 V2 通过结论|
|性能|不通过|本轮已观测冷加载/刷新超过200ms；最终原始样本须保留全部失败，交互达标也不能豁免页面加载|
|PDA / 扫码 / 上传 / 真实鉴权|不适用|本轮没有新增上述能力|

## 4. 问题标签

- 字段过载、视觉干扰：删除顶部无用控件、重复标题和多重内边距。
- 追溯不足、算不准、协作断裂：独立假数据已退出主任务；未接入事实仍待补，不能用固定天数假装完整。

## 5. 主要问题与处理

|问题|标签|影响角色|处理方式|是否仍有风险|
|---|---|---|---|---|
|全任务固定流程和独立Mock|追溯不足|跟单|主列表读取33条原型需求；30条明确技术版本映射；14条需求关联76项既有执行记录。PCS准备单只读显式关联|是，准备库默认无记录且缺正式SLA等事实|
|工艺名称代替实例关系|算不准|跟单/工厂|使用明确前置与SKU，唯一 sourceEntryId 才合并执行；拆分执行保持独立|是，多执行份额与合格数量尚未全接入|
|未知数量与截止显示0|算不准|管理/跟单|未知显示待同步/待配置/待判定；要求量与合格量分别表示是否已知|是，全程仍不可完整判断|
|顶部角色/时区、表格重复标题|视觉干扰|所有管理角色|删除指定控件，改责任筛选，固定北京时间，嵌入表直接显示表头与分页|布局检查通过，仍受整体性能门槛限制|
|读取来源模块冷启动超时|性能|所有页面角色|当前已缩短模块等待、缓存日期格式器，保留完整计时；主要耗时在既有FCS模块初始化|是，未满足200ms硬门槛|

## 6. 最终结论

结论：不通过

本轮不能标记完整交付：冷加载/刷新未达到 `<200ms`，完整供给、合格数量、正式SLA与实际发货来源仍待接入。通过的布局或单元测试不替代这些缺口；旧 V1/V2 演算证据不继承为 V3 业务来源已验证。产品接受待用户查看。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/production-fulfillment/model.ts`
- `src/pages/production-fulfillment/ui-state.ts`
- `src/pages/production-fulfillment/common.ts`
- `src/pages/production-fulfillment/styles.css`
- `src/pages/production-fulfillment/index.ts`
- `src/pages/production-fulfillment/calculations.ts`
- `src/pages/production-fulfillment/tasks.ts`
- `src/pages/production-fulfillment/task-detail.ts`
- `src/pages/production-fulfillment/timeline.ts`
- `src/pages/production-fulfillment/dashboards.ts`
- `src/pages/production-fulfillment/source-tasks.ts`
- `src/pages/production-fulfillment/source-views.ts`
- `src/pages/production-fulfillment/source-views.css`
- index.html：DDS 入口模块与外壳同时加载；不提前构造假页面替代就绪。

既有本模块未提交接入差异（src/data/app-shell-config.ts、src/main.ts、src/router/routes.ts、src/state/store.ts）沿用，非本轮新增业务改动。

### 页面路由

基路径 `/dds/supply-chain/production-fulfillment/`：overview、tasks、follow-up、work-items、teams、fulfillment、configuration、tasks/DEM-202603-0001、tasks/DEM-202603-0005、团队详情。最终实际URL以浏览器原始样本为准。

### 验证命令

- `node --import tsx --test tests/unit/production-fulfillment-*.test.ts`：通过66项，原始记录 `output/playwright/dds-pf-v3/unit.log`。
- `node scripts/check-typescript-scope.mjs src/pages/production-fulfillment/`：通过，模块范围0错误；61个范围外既有错误未改动。
- `npx vite build --outDir /tmp/higoods-dds-pf-build`：通过，记录 `output/playwright/dds-pf-v3/build.log`；只证明构建，不证明业务/性能通过。
- `node scripts/check-dds-production-fulfillment.mjs --v3`：失败（性能），最后实质修改后6组功能检查通过，1050个原始样本、0页面错误；最大440.20000000298023ms。原始证据 `output/playwright/dds-pf-v3/verification.json`，校验源码哈希见同目录 `source-manifest.json`。
- `npm run check:prototype-design-governance`：通过，但只扫描暂存区且当前未暂存，不作为工作树覆盖证明。
- `npm run check:prototype-design-governance -- --all`：通过，26个可见受管文件、3份记录；本次工作树受管差异均为DDS文件与既有入口，已审计这些未暂存差异。
- `npm run check:list-page-governance:static`：通过，427个页面、17个既有基线；不代替视觉验收。

### 最后一次浏览器验证原始统计

|场景|原始样本数|最大耗时ms|达到或超过200ms|判定|
|---|---:|---:|---:|---|
|cold|40|440.20000000298023|40|失败|
|refresh|137|317.3999999910593|137|失败|
|click|687|34.20000000298023|0|通过|
|select|146|33.79999999701977|0|通过|
|fill|40|32.30000001192093|0|通过|

每次加载与交互均等待目标内容及页面内必要图片可用，再等待绘制；冷加载在隔离浏览器清缓存。站内路由、图片失败态、打印、配置所有发布边界尚未在当前来源版逐项补齐，因此没有声称覆盖第7.2节全部入口。完整通过仍需解决已知超时并补齐这些证据。

截图：`configuration-1366.png`、`work-detail-1366.png`、`route-1366.png`、`execution-1366.png`、`execution-route-1366.png` 及七菜单截图均位于上述证据目录。

### 真实图片验证

- 需求款图读取 productionDemands[].imageUrl；名称/款号和缩略图同列，大图使用同一原始图片。
- 本轮图片加载检查等待页面需要的图片完成；大图交互截图及关闭结果见浏览器证据。
- 工艺路线输入/输出SKU来自技术包，物料图尚未逐对象对齐；不能因此称“全部真实图片验收通过”。

### 例外

- 无200ms或图片门禁豁免。缺失证据和已知超时保持失败，未宣布完成。
- 未进行线上访问、线上数据更改、提交、推送或部署。
