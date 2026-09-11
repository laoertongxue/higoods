# 染色、印花加工单筛选操作调整

## 1. 基本信息

- 需求：更多筛选／收起更多参照染厂待接收；染色的导出、导出投入接收、导出超期单直接展示，删除专项导出折叠入口。仅修改上述内容。
- 日期：2026-09-11；分支 main；HEAD `f6f3f945a46711265ad6f0eaf7086e9533134fcb` 加本次工作区差异。
- 运行工作树：`/Users/laoer/Documents/higoods`；5188 端口由同目录服务提供。
- 本任务前快照：`/tmp/higood-work-order-filter-actions/` 内 dyeing.before.ts、printing.before.ts、presentation.before.ts。
- 确认人：Codex 本地验证；尚无产品接受或远端交付回执。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：两页筛选按钮改为标准次要按钮，文案随展开状态切换；染色三项导出直接同排展示。
- 适用基线：`AGENTS.md` 第 4、5、7 节及用户本次明确限定范围。

## 3. 自查结论

| 检查项 | 结论 | 当前证据 |
| --- | --- | --- |
| 角色与范围 | 通过 | 管理列表原筛选操作行内调整，无菜单、数据、字段或业务处理改动 |
| 按钮顺序 | 通过 | 染色为查询、重置、导出、导出投入接收、导出超期单、更多筛选／收起更多；印花为查询、重置、导出、更多筛选／收起更多 |
| 展开与收起 | 通过 | 两页在 1366×768 和 1280×720 均完成收起→展开→收起，文案、aria-expanded、可见状态一致 |
| 输入与局部更新 | 通过 | 切换保留输入值与原输入节点；操作行同排，页面不横向溢出 |
| 三项导出 | 通过 | 分别点击成功下载全部、投入接收、超期未完结 CSV，沿用原事件入口 |
| 图片、数量、打印与单据 | 通过 | 本次差异未触及上述内容；不将旧业务验收冒充本次新证据 |
| 公共控件影响面 | 通过 | 新外观通过显式 button 参数仅在染色、印花启用；原默认外观和计数、箭头逻辑保留 |

## 4. 问题标签

- 视觉与操作一致性：已处理。
- 冗余折叠入口：已处理。

## 5. 主要问题与处理

复用现有次要按钮，更多筛选位于操作行最后。点击仅切换高级筛选区显隐和按钮文案，不刷新页面。三个导出沿用已有处理函数，仅将两个嵌套按钮提到操作行。未新增导出类型或修改 CSV 内容规则。

## 6. 最终结论

结论：通过。本次两页的目标交互及三项下载均已由最终源码运行验证；仅代表本地原型调整。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/dyeing/work-orders.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/components/ui/process-order-list-presentation.ts`

### 页面路由

- `/fcs/craft/dyeing/work-orders`
- `/fcs/craft/printing/work-orders`

### 验证命令

- `node node_modules/typescript/bin/tsc --noEmit --pretty false`：通过，日志 `/tmp/higood-work-order-filter-actions/typecheck.log`。
- `npm run check:list-page-governance:static`：通过，386 个页面；日志 `/tmp/higood-work-order-filter-actions/list-governance.log`。
- `playwright-cli -s=receiving-round-2 run-code`：通过，12 组页面状态及三项导出下载；日志 `/tmp/higood-work-order-filter-actions/browser.log`、`exports.log`，截图和 CSV 位于 `output/playwright/work-order-filter-actions/`。
- `codegraph sync`：通过，日志 `/tmp/higood-work-order-filter-actions/codegraph-sync.log`。
- `codegraph status`：通过，索引最新，日志 `/tmp/higood-work-order-filter-actions/codegraph-status.log`。
- `npm run build`：通过，类型、现有测试与构建全部完成；日志 `/tmp/higood-work-order-filter-actions/build.log`。

### 例外

- 工作区存在此前任务的未提交差异。以任务前快照审查本次三个源文件差异，不暂存、提交或推送，不运行吸收整个脏工作区的 workflow:verify。
- 未新增或更改 Mock 数据；不扩大到收货、库存和打印业务改造。
