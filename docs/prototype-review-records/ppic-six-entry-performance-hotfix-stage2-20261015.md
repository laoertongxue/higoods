# PPIC 六入口性能专项第二阶段本地冻结记录

依据[AGENTS.md](../../AGENTS.md)::SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01、RELEASE-01。继承H01-H04及[专项方案H05-H09](../product-design/ppic-six-entry-performance-hotfix-20261015.md)，不改业务目标。第一阶段09868d6e发布成功、43资源和136业务断言通过，但正式性能未通过，原始失败保留。

## 基本信息

- 日期：2026-10-15
- 任务 / 需求编号：PPIC六入口性能专项H05-H09
- 验证人：Codex技术验证，一个独立只读审查

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：共享打包与三个精确入口初始化加载优化、现有缩略图复用；业务事实、数量规则、事务和真实原图不变。T4。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 纯规则与完整交出契约 | 通过 | DDS约1.89MB案例源码退出日报静态/预抓闭包；19个完整校验声明与09868d6e逐字等值，旧模块121声明及公开API保留。cut-piece-release仍使用真实特殊工艺/仓库读取，不冒称整图已完全轻量化 |
| 来源恢复与保存 | 通过 | 三条精确入口没有effects时跳过无必要capture/restore；非空effects仍原await。dispatch原运行任务解析器、progress原PPIC wrapper/裁片来源/特殊工艺注册保留。实际UI分配创建两节点合同、独立新文档及回货100/PPIC10、事务失败/唯一重试均由生产预览回放 |
| 页面与图片 | 通过 | 四页小图使用现有映射；7原图SHA等于登记sourceSha256，原图URL/高清弹窗保持；PDA五图961088B→11896B。1366/1280/1024 Web及390×844 PDA，22浏览器含加载/高清图实际完成和Esc |
| 本地性能 | 通过 | 实际生产预览5529、真实时钟、27类135样本全部≤1000ms；六类30样本最大424.9ms。Web111/PDA21业务断言通过；正式SHA断言不适用于本地 |
| 正式性能及硬件接受 | 不适用 | 本记录仅本地阶段；新正式SHA部署后另验。PDA为Chromium小屏，合同为完整电子两页，未代填工厂/设备接受 |

## 最终结论

结论：通过

只支持第二阶段本地冻结，正式性能未以本地结果替代。

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/cutting/whole-bag-handover-read-contract.ts`
- `src/data/fcs/cutting/transfer-bag-operations.ts`
- `src/data/fcs/ppic-return-quantity-basis.ts`
- `src/main.ts`
- `src/pages/sewing-outsourcing/daily-return-report.ts`
- `src/pages/pda-post-finishing-flow.ts`
- `src/pages/production-order-progress-tracking.ts`
- `src/pages/unified-dispatch-workbench.ts`
- `src/pages/production-contract-print.ts`
- `vite.config.ts`

### 页面证据

- 版本：工作树/Users/laoer/.codex/worktrees/5f34/higoods；基准09868d6e加H05-H09；生产预览5529、源浏览器5497、Chromium149、Asia/Jakarta、真实时钟；源/资产哈希见stage2-local-summary.json。
- 证据：output/ppic-performance-hotfix-20261015内stage2-local-summary.json、生产预览Web原件online-1792001873429、PDA原件online-pda-1792001908922、browser-stage2-final.log与截图。local-check遗留sha说明文字3b+H01-H02仅为标签错误，实际资产与新源绑定summary；正式脚本使用完整SHA，不能用该文字冒充提交版本。未访问真实数据库或修改用户本机资料。

### 性能结论

- 结论：通过
- 依据：六类max为日报256.5、成员186.7、分配265.4、生产单进度415.9、两页合同424.9、PDA后道确认193.0，六类30样本均≤1000ms，27类135样本通过；原件及资产绑定见stage2-local-summary.json。
- 原采集终点不变：目标内容、必要实际小图/两页纸面、有限动画与两次绘制；当前身份、实收及原子保存可用。图片弹窗另核真实原图完成，不用空图达标。正式六类待同版本另验。

### 验证命令

- `npm run build`：通过
- `npx vite build`：通过
- `npm run check:cutting:all`：通过
- `npx playwright test tests/ppic-daily-return-pages.spec.ts tests/ppic-daily-return-receipts.spec.ts tests/ppic-shared-consumers.spec.ts --workers=1`：通过
- `node output/ppic-performance-hotfix-20261015/audit-pure-handover.mjs`：通过
- `node output/ppic-performance-hotfix-20261015/local-check.mjs`：通过

### 例外

- 无

无门禁豁免。第一阶段及第二阶段原始慢值全部保留；独立diff审查H05-H09无阻断，源注册未拆。收据output/ppic-performance-hotfix-20261015/task-receipt-stage2.json在最终冻结后实际生成，不改旧收据。本地与正式及硬件接受边界分开。
