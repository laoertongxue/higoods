# 印花、染色筛选按钮行调整

## 1. 基本信息
当前分支 codex/process-route-full-stage-incremental，HEAD 8d8f8ffd43d1000d9c852a1cffbb4c73e16bee12 加本次局部差异；服务5188对应同一工作树。管理端桌面，依据用户截图及AGENTS.md当前治理基线。

## 2. 影响判定
- 用户可见影响：有
- 判定依据：查询、重置、导出、更多筛选以及染色专项导出移至全部筛选字段之后，按钮区独占整行。

## 3. 自查结论
|项目|结论|证据|
|---|---|---|
|页面结构|通过|仅调整筛选按钮区DOM顺序，保留字段、事件、数据及其他页面区域|
|展开和收起|通过|按钮区始终是筛选容器最后一个子元素，位于所有可见字段下方|
|低分辨率|通过|1366和1280宽度，展开/收起均验证几何位置|
|图片与业务状态|通过|本次不改图片、数量和业务操作|

### 受管文件
- `src/pages/process-factory/printing/work-orders.ts`
- `src/pages/process-factory/dyeing/work-orders.ts`

### 页面路由
- `/fcs/craft/printing/work-orders`
- `/fcs/craft/dyeing/work-orders`

### 验证命令
- `Playwright output/playwright/filter-actions/browser.js`：通过，browser.log记录两页两种宽度的展开/收起检查及截图。
- `npm run check:prototype-design-governance`：通过，默认暂存区检查；另执行限定本次两文件的审查覆盖。

### 例外
- 工作区包含之前任务改动，不运行吸收全量差异的workflow收据；本次只移动两个按钮区，未改共享组件或业务逻辑。

## 6. 最终结论
结论：通过。本次小范围布局修正已验证，未提交推送。产品确认人：待用户确认当前版本。
