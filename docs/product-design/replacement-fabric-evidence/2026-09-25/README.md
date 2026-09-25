# 换片布菲票实施证据（2026-09-25）

**当前总体状态：未完成。** 本目录保存实际执行证据，不是产品接受、物理打印或发布回执。逐条状态以[实施追踪](../../换片布菲票实施追踪-2026-09-24.md)为准。

## 版本与环境

- 分支：`codex/replacement-fabric-tickets`。
- 基线：`aac68249a0d32dcd71807811684ebf94dbf7cc79` 加未提交任务差异。
- 工作树：`/Users/laoer/.codex/worktrees/replacement-fabric-tickets/higoods`。
- 开发服务：43225；同工作树构建预览：43226；LAN：192.168.5.10。
- 源文件摘要见 `source-manifest.json`；浏览器与设备信息见 `environment.txt`。
- 路由性能在构建预览测量；业务夹具使用开发服务的模块入口。两类服务的结果分别保存，不能互相替代。
- 测试数据均为隔离浏览器上下文中的原型演示，不是工厂事实；没有清除用户浏览器数据。

## 主要结果

| 验证 | 脚本 / 结果 | 说明 |
| --- | --- | --- |
| 固定长度、排朴、SKU用料、身份、补打、历史、备份、防错 | tests/unit/replacement-fabric-*.test.ts / unit.log | 21 条契约 |
| 同任务分批、同单两家工厂、旧票拒用 | check-two-factories.js / check-two-factories-result.txt | 700片+1票；次批200片+0票；另一工厂720片+第2票 |
| 多袋并集及三类混装 | check-mixed-ui.js / check-mixed-ui-final-version.txt | 缺票不落盘；袋先后不影响结果；片、米、Yard分别展示 |
| 新增、部分打印、补打保持票数 | check-print-and-images.js / check-print-and-images-final-version.txt | 6票中只确认1票；补打仍6票 |
| 新列表交互、图片失败和恢复 | check-hpb-ui-interactions-preview.js、check-hpb-extra-controls-preview.js | 37项各5次；原始开发服务慢样本保留 |
| 8路由冷启动、刷新、站内切换 | check-route-performance-navigation.js / check-route-performance-complete.txt | 120样本均通过，最大466.9ms；每场景5次；保留此前慢样本及每轮完整结果 |
| 局域网HTTP | check-lan-flow.js / check-lan-flow-lan-version.txt | 5次实际IP访问、新增、打印确认、刷新；无secure-context APIs也可使用 |
| 持久事务、CAS、命令重放、满额、上游竞争、版本升级 | check-storage-isolated.js、check-storage-extra.js | 原记录保留；无假成功 |
| 显式分批迁移、中断恢复、共享键保留 | check-migration-isolated.js / check-migration-isolated-final-version.txt | 101条；旧页变化、目标冲突、完成标记失败均有原始结果 |
| 新浏览器备份恢复 | check-backup-fresh-browser.js | 5个新上下文各恢复2张票；错误文件不改变已有数据 |
| 打印边界及二维码 | check-label-boundary.js、label-boundary.pdf、label-qr-decoded.json | 100×100mm；长名称及第1001号；两页软件解码正确，不代表现场实物验收 |
| 构建及治理 | build.log、design-governance.log、list-governance.log | 当前差异检查结果 |
| 基线失败 | tsc.log、baseline-assembly.log、baseline-special.log | 6个既有类型错误；既有部位票标题/特殊工艺检查失败，未按通过计算 |

## 复现方法

1. 在上述工作树安装既有依赖，执行 `npm run build`，再以 `npm run preview -- --host 0.0.0.0 --port 43226` 启动构建预览；开发夹具使用43225的Vite服务。
2. 创建 `output/playwright/hpb/`，把本目录脚本复制到该目录。恢复错误文件测试使用同目录的 `invalid.higcut`；测试产生的备份、图片仍写入该目录。
3. 用已配置的 Playwright CLI 会话执行相应 `run-code` 脚本。PDA脚本使用演示裁床角色；所有改动在新隔离上下文中执行。LAN脚本按当前机器IP替换地址后运行。
4. 路由性能开始前停止构建、索引等CPU密集操作；每个样本从导航或路由事件开始，等待目标DOM、必要图片及两帧绘制。保存动作同时断言可读结果。
5. 不从历史通过记录推断当前通过。实质修改后重新运行受影响脚本并更新源文件摘要。

## 尚未满足的门禁

- 上游生产单、任务分配、既有部位票及PCS资料尚有localStorage业务源；全部禁用localStorage时当前页明确阻断，未达到完整迁移门禁。
- 八条主要路由与新列表不代表所有受影响入口已经测完；其余Web/PDA详情、打印和操作的完整性能覆盖仍缺。
- 物理纸张、实际打印机与现场扫描验收未执行；100×100mm仅为当前原型设定。
- 全部92条原子需求仍需逐项闭环，不能据本目录中部分通过项把总体状态改成完成。
