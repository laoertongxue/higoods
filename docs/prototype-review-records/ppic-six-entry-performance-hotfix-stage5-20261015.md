# PPIC 六入口性能专项第五阶段本地冻结记录

依据[AGENTS.md](../../AGENTS.md)::SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01、RELEASE-01。继承[专项H01-H14](../product-design/ppic-six-entry-performance-hotfix-20261015.md)。保留全部正式和首次本地失败原件；此记录绑定最终H14b本地资产，新正式另验。

## 基本信息

- 日期：2026-10-15
- 任务 / 需求编号：PPIC六入口性能专项H14
- 验证人：Codex技术验证，一个独立只读审查

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：只扩离线压缩闭包、严格校验并沿用较小且原内容一致的压缩；直接下游进度看板纳入同范围。T4。857个原始运行/静态资产全部与4862f09a相同。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 业务及资源身份 | 通过 | 857个非压缩资产摘要与4862f09a完整manifest相同；路由/预抓/初始化/renderer/写事务与上版逐字相同；上版Web118业务证据保留原身份，最终本地Web116/PDA21重新通过 |
| 压缩包正确及失败恢复 | 通过 | 发布先生成原q7/q11基线，仅采用更小且独立解压等于当前source的br；损坏/旧内容重建；gzip9、原文件、manifest/receiver机制不改，17打包契约通过 |
| 本地失败处理 | 通过 | 首次邻接看板1045.3ms及原stage5-local文件/原件不覆盖；补齐该静态闭包离线sidecar后最终stage5b复验，5样本最大965.7ms；没改路由/渲染/预抓/终点 |
| 六入口与闭环性能 | 通过 | 最终28类140样本全部≤1000ms，指定六类各5最大432.8ms；当前人、原截止、两节点、正式实收/PPIC分摊和保存失败恢复仍通过 |
| 正式与设备接受 | 不适用 | 本地冻结不代替新正式SHA；未作实际工厂、物理PDA及纸面打印接受声明 |

## 最终结论

结论：通过

本地最终通过；4862f09a正式cold第三1028.8ms保留，H03/H04需新正式SHA闭环。

## 变更覆盖与验证

### 受管文件

- `vite.config.ts`
- `scripts/deploy/prepare-release.py`
- `tests/deploy/test_prepare.py`

### 页面证据

- 版本：/Users/laoer/.codex/worktrees/5f34/higoods；4862f09a加H14b；真实生产预览5529、Chromium149、Asia/Jakarta、真实时钟和原隔离来源规模；源/HTML摘要绑定stage5b-local-summary.json。
- 证据：output/ppic-performance-hotfix-20261015内compression-stage5b.json、deploy-stage5.log、build-stage5b.log、local-stage5b.log、online-acceptance-stage5b-local.json、online-pda-acceptance-stage5b-local.json及stage5b-local-summary.json。原CPU/65资源诊断及首次stage5失败原件保留，未用重采覆盖失败。

### 性能结论

- 结论：通过
- 依据：28类140个最终本地样本均≤1000ms；六类最大379.9/190.8/282.8/432.6/432.8/230.8ms；全范围最大965.7ms。日报65脚本/样式735202B→712315B，解压内容相同；前五日报冷context、成员1024边界、PDA新文档自然缓存、完整目标内容/图片/有限动画/两次绘制。原正式1028.8及首次本地1045.3保留。

### 验证命令

- `npx vite build`：通过
- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/deploy -p 'test_prepare.py'`：通过
- `node output/ppic-performance-hotfix-20261015/local-stage5b-check.mjs`：通过

### 例外

- 无

收据output/ppic-performance-hotfix-20261015/task-receipt-stage5.json最终冻结后实际生成；独立审查无P1/P2；原971单元和正式业务证据保留原版本并以857资产摘要证明复用边界，收据若强制重跑按实际日志记录。新正式另记外部部署记录，不改此冻结记录冒充正式验收。
