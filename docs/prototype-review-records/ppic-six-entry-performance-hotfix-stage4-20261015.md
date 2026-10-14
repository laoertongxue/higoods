# PPIC 六入口性能专项第四阶段本地冻结记录

依据[AGENTS.md](../../AGENTS.md)::SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01、RELEASE-01。继承[专项H01-H13](../product-design/ppic-six-entry-performance-hotfix-20261015.md)。前三正式版本失败原件保留；此记录绑定本地冻结，正式另验。

## 基本信息

- 日期：2026-10-15
- 任务 / 需求编号：PPIC六入口性能专项H12-H13
- 验证人：Codex技术验证，一个独立只读审查

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：同次PPIC同步读取共用现有裁片事实准备；关键首屏资源离线压缩。T4。原时间戳、历史截止、业务公式和写事务不变。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 数量事实与来源失效 | 通过 | 原taskViews函数体原样迁入readTaskViews；lazy作用域保留原逐任务数量错误捕获，成功后才标记已准备；真实矩阵嵌套12一致、退出后23、连续失败阻断、恢复34及下一次45；22专项及971单元通过 |
| 静态压缩与发布 | 通过 | 预览与打包关键正则一致，17文件旧质量7共586609B→质量11共541217B，逐字节解压相同；生产其余7、预览其余原5、gzip不变；14打包契约含hot夹具原字节/manifest/receiver验包通过 |
| 业务上下游 | 通过 | 当前人/角色拒绝、三方逐任务、原截止、两节点合同及真实打印、后道100/PPIC10、失败事务/重试/刷新一致；最终Web116/PDA21断言通过 |
| 本地闭环与性能 | 通过 | 28类140样本全部≤1000ms，含指定六类各5，六类最大482.5ms；终点仍等待全部目标内容和必要图片、有限动画与两次绘制 |
| 新正式性能/设备接受 | 不适用 | 此记录只绑定本地冻结；新正式SHA另验，不冒称物理PDA或实际工厂接受 |

## 最终结论

结论：通过

本地通过；b1804c88正式冷加载1137.2ms仍保留，H03/H04需新正式版本验证后关闭。

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/cut-piece-release.ts`
- `src/data/fcs/ppic-daily-return-records.ts`
- `vite.config.ts`
- `scripts/deploy/prepare-release.py`
- `tests/unit/cut-piece-release-read-snapshot.test.ts`
- `tests/deploy/test_prepare.py`

### 页面证据

- 版本：/Users/laoer/.codex/worktrees/5f34/higoods；b1804c88加H12/H13；真实生产预览5529、Chromium149、Asia/Jakarta、真实时钟、原隔离来源规模不变；源码与HTML摘要见stage4-local-summary.json。
- 证据：output/ppic-performance-hotfix-20261015内stage4-local-summary.json、compression-stage4.json、read-snapshot-stage4.log、deploy-stage4.log、build-stage4.log、local-stage4.log、online-acceptance-stage4-local.json和online-pda-acceptance-stage4-local.json。原始目录含全部值、截图、合同canvas像素及保存回读。

### 性能结论

- 结论：通过
- 依据：28类140样本均≤1000ms；指定六类最大分别324.6/185.8/314.8/482.5/436.0/197.5ms；全范围最大769.9ms。首五日报冷context、成员首个1024边界、PDA新文档自然缓存；未减数据、未替换资源、未改终点，前三正式失败保留。

### 验证命令

- `npm run build`：通过
- `node --import tsx --test tests/unit/cut-piece-release-read-snapshot.test.ts tests/unit/ppic-return-quantity-basis.test.ts`：通过
- `python3 -m unittest discover -s tests/deploy -p 'test_prepare.py'`：通过
- `node output/ppic-performance-hotfix-20261015/local-stage4-check.mjs`：通过

### 例外

- 无

收据output/ppic-performance-hotfix-20261015/task-receipt-stage4.json最终冻结后实际生成；独立审查无P1/P2；正式部署与性能另记外部发布记录，不改此冻结记录冒充正式结果。
