# 染色条码及交出功能补齐审查

## 基本信息
- 日期：2026-09-10
- 端与角色：PFOS 管理端，染色跟单、条码维护员、交出员。
- 需求来源：本次用户提供线上截图，保留当前原型页面结构。
- 分支：codex/process-route-full-stage-incremental
- HEAD：8d8f8ffd43d1000d9c852a1cffbb4c73e16bee12 + 本次增量差异。
- 用户可见影响：有。现有行增加打印条码；现有标题操作区增加待交出、交出单据；均采用局部弹窗。

### 受管文件
- `src/data/fcs/dyeing-task-domain.ts`
- `src/pages/process-factory/dyeing/work-orders.ts`
- `src/pages/process-factory/dyeing/output-documents.ts`

另含 `scripts/check-dyeing-online-gap.ts`；不修改现有仓库、流程卡、水溶单、全局菜单和样式。

### 页面路由
- `/fcs/craft/dyeing/work-orders`
- 同页条码、待交出、交出单详情和打印 iframe 预览。

## 3. 自查结论
|项目|结论|证据|
|---|---|---|
|角色与主动作|通过|原列表结构保留，条码维护和交出操作在独立弹窗|
|状态和数量|通过|包装完成事实限制可交数量，按单位分别合计；草稿不交出，交出不接收|
|防错与恢复|通过|占用卷不可删改、重复交出阻断、导入失败事务回滚；删除、下架、作废、交出二次确认|
|局部更新|通过|输入不刷新列表，弹窗局部更新；交出后刷新原列表数量区所在工作区|
|低分辨率|通过|1366×768 与1280×720，主体无横向溢出；弹窗内部滚动|
|真实图片|有条件通过|商品图复用原对象素材；产出实物图仍缺失并明确提示，不以投入图冒充；未宣称完整素材交付|
|打印|通过|Code128标签和SURAT JALAN预览，按原单位显示；未进行打印机出纸验收|
|历史数据|通过|原交接记录继续可追溯；不推断历史卷号或扫码次数|
|保存范围|有条件通过|正式生成单沿用现有事务保存；预置演示单刷新重置|

## 检查与证据
`output/playwright/dyeing-online-gap/`：domain.log、regression.log、types.log、build.log、browser.js、browser.log、list.png、list-1280.png、barcode.png、detail.png、dispatch-print.png。

本次范围之外的仓库手工库存操作和空白水溶页隐藏能力未扩展。根据AGENTS.md 4、5、7节及用户结构保留要求执行。图片素材与真实打印机验证仍待产品补充，结论为有条件通过。产品确认人：待用户确认当前版本；未提交、未推送。

### 验证命令
- `node --import tsx scripts/check-dyeing-online-gap.ts`：通过。
- `node --import tsx scripts/check-dyeing-workflow.ts`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过。
- `npm run check:list-page-governance:static`：通过。
- `npm run check:prototype-design-governance`：通过（默认暂存区无变更，另用任务文件范围覆盖检查）。

### 例外
- 产出实物图片缺失，沿用当前明确缺失提示；真实打印机出纸未验证。
- 工作区包含已有大量无关差异，未运行会吸收整个工作区的 workflow:verify 收据；使用本次任务差异、文件哈希和专项记录。

## 6. 最终结论

结论：有条件通过。条码和交出核心闭环已经实现并验证，真实产出图片与打印机验证保留为明确例外。

补充实际页面验证：`barcodes.js` / `barcodes.log` 已通过导入16行、两页切换、卷号范围、批量修改、下架标记、删除、复制零草稿。最终 `browser.log` 无页面错误，`coverage.log` 覆盖三个本次业务文件。
