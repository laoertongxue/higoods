# 染厂待接收筛选操作行调整

## 1. 基本信息

- 日期：2026-09-11。
- 任务：展开和收起时，更多筛选／收起更多均排在查询、重置、导出之后。
- 验证版本：main，HEAD `f6f3f945a46711265ad6f0eaf7086e9533134fcb`，叠加本任务工作区修改。
- 服务：本工作树 `/Users/laoer/Documents/higoods` 的 5188 端口；浏览器验证同一服务。
- 本任务修改前快照：`/tmp/higood-receiving-filter-placement/pending-receipts.before.ts`。
- 验证人：Codex；此记录为本地原型验证，不代表产品接受或远端交付。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：筛选展开控件的位置与展开时文案变化，筛选字段及其顺序、数据和其他操作保持原样。
- 依据：用户本次截图与文字要求；`AGENTS.md` 第 4、5、7 节。

## 3. 自查结论

| 适用项 | 结论 | 证据 |
| --- | --- | --- |
| 管理列表筛选操作顺序 | 通过 | 两种状态均为查询、重置、导出、更多筛选／收起更多 |
| 字段顺序与输入保留 | 通过 | 展开和收起不替换输入 DOM，已输入值保留；查询保持展开，重置清空条件 |
| 局部更新 | 通过 | 展开控件仅更新隐藏属性、文案及 aria-expanded，不调用页面刷新 |
| 分辨率与横向溢出 | 通过 | 1366×768、1280×768、1024×768 六组展开／收起检查，按钮同排且文档无横向溢出 |
| 图片、数量、单据与打印 | 通过 | 本次未修改对象、图片、数量计算、单据动作及打印内容；按任务前快照审查三处局部差异 |

## 4. 问题标签

- 视觉干扰：已处理。原 summary 独占一行，现合并到筛选操作行末尾。

## 5. 主要问题与处理

移除原 details 的独立 summary，使用现有按钮与独立高级筛选区。展开状态由页面变量保存；点击仅切换筛选区显隐与按钮文案，保留已填条件及页面节点。展开内容始终位于完整操作行之前。

## 6. 最终结论

结论：通过。本次按钮位置、两种状态、输入保留及三个宽度均已在最终源代码修改后验证。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/dyeing/pending-receipts.ts`

### 页面路由

- `/fcs/craft/dyeing/pending-receipts`

### 验证命令

- `node node_modules/typescript/bin/tsc --noEmit --pretty false`：通过，记录于 `/tmp/higood-receiving-filter-placement/typecheck.log`。
- `npm run check:list-page-governance:static`：通过，扫描 386 个页面，记录于 `/tmp/higood-receiving-filter-placement/list-governance.log`。
- `playwright-cli -s=receiving-round-2 run-code`：通过，六组状态、按钮顺序和坐标、输入节点及值保留断言，记录于 `output/playwright/receiving-filter-placement/browser.log`；同目录保存各宽度 expanded/collapsed 截图。
- `codegraph sync`：通过，记录于 `/tmp/higood-receiving-filter-placement/codegraph-sync.log`。
- `codegraph status`：通过，最终检查显示 Index is up to date。
- `validatePrototypeReviewCoverage`：通过，仅覆盖本任务一个源文件及本审查记录，结果位于 `/tmp/higood-receiving-filter-placement/scoped-governance.log`。
- `npm run check:prototype-design-governance`：通过，暂存区无受管改动；实际任务覆盖由上一项限定文件的校验确认。

### 例外

- 工作区包含此前任务的未提交修改；本任务以修改前文件快照界定差异，不运行会吸收无关差异的完整 workflow:verify，不暂存、提交或推送。
- 本次是单页控件位置调整，未重跑此前收货、库存及打印业务验收；不将历史业务证据视为本次新增验证。
