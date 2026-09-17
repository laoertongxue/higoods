# 简易裁片交出 PDA 布局调整

## 1. 基本信息

2026-09-17；完整产品审查。分支 codex/task-sheets-simple-cut-piece-handover-20260916，基线 aafd12ad，当前工作树 ec9a。角色为裁床仓管，员工执行 PDA；需求 PDA-002/003/007，用户本轮截图。服务同工作树4175。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：PDA扫描入口合并到输入框右侧，隐藏重复提示及账号行，底部按钮全宽，成功页改为移动卡片并删除查看交出记录入口。
- 依据：AGENTS.md 第4、5、7节。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 扫描、核对、确认、继续扫描；成功页只有一个主动作。 |
| 文案、数量与状态 | 通过 | 700片、5张菲票、接收工厂和PPIC同确认事实；时间使用本地易读格式。 |
| 扫码、真实图片 | 通过 | 保留扫码枪回车和输入读取；真实款图及大图原流程回归通过。 |
| 防错与交接 | 通过 | 已接收口径、两批、防重、权限与袋/工艺隔离保持原规则。 |
| 小屏与交互 | 通过 | 360×640及390×844：输入扫描同排、确认按钮全宽可见、继续扫描清空聚焦、无横向溢出。 |
| 页面边界 | 通过 | PDA成功页无记录链接；Web仍有查看记录入口。 |

## 4. 问题标签

字段过载、视觉干扰。

## 5. 主要问题与处理

移除PDA重复扫描区及账号提示；移动结果页以成功状态和本次片数为主，接收方信息用卡片，底部全宽继续扫描。Web保留原详情入口，不修改交出事实及接收规则。

## 6. 最终结论

结论：通过

浏览器验证通过；治理和构建结果见 output/verification/pda-layout-0917/final-checks.log。未宣称实体设备验收或远端发布。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/simple-cut-piece-handover-ui.ts`

### 页面路由

- `/fcs/pda/cutting/simple-cut-piece-handover`
- `/fcs/craft/cutting/warehouse-management/wait-handover`

### 验证命令

- `npx playwright test tests/simple-cut-piece-pda-layout.spec.ts tests/simple-cut-piece-handover.spec.ts`：通过；新布局2例及两批/双标签2例首轮通过；袋与工艺1例首次弹窗打开超时，未改代码独立复验通过（15.1秒）。
- `npm run build`：通过；101项测试、工程类型检查和Vite构建通过。
- `npm run check:prototype-design-governance -- --all`：通过；当前1个用户可见源文件已覆盖。
- `git diff --check`：通过。
- `codegraph sync`：通过。
- `npm run workflow:verify`：失败；收据脚本要求吸收原有无关swp，不能限定任务文件。按AGENTS第7节例外不生成全量收据，单独执行治理与构建。

### 页面和图片证据

output/verification/pda-layout-0917/：360/390 preview.png、success.png；主流程各截图及失败trace保留。output/verification/pda-layout-0917-regression/：袋/工艺复验截图。已目视360预览及成功页：单手按钮触达、款图清晰、工厂名称自然换行、无记录链接。

### 例外

- 扫码沿用现有扫码枪输入/回车与手动输入读取；未新增摄像头扫描能力。未新增数据或后端。实体设备未测试。原编辑器swp不属于本任务。
