# build15 两路由冷启动诊断

这是每条路由一次的原因定位，**不是严格验收重跑**。原始 pda-simple 656.7 / 575.1 / 528.7 ms 与 bags 598.1 / 556.5 ms 仍保留失败状态，不能以本轮较快数值替换。

环境：独立 CLI `hpb-source-final`，preview `http://127.0.0.1:43236` 的 build15；当前工作树 HEAD 已快进到 `5ba805510f3cf70339db6e3ddd072b9c5d255a01`（菜单 icon 差异，dist 未重建），诊断对象明确为 build15 dist。真实登录 OWN-CUTTING-001_admin 后，分别新建独立 context；PDA 390×844、Web 1366×768。未修改源码、构建或其他 session。

| 指标 | PDA 简易裁片交出 | 中转袋列表 |
| --- | ---: | ---: |
| 本轮实际可读终点 | 404.1 ms | 256.6 ms |
| 页面根首次可见 | 377.3 ms | 223.3 ms |
| 图片等待完成 | 同根节点时点 | 同根节点时点 |
| HTML responseEnd | 2.5 ms | 1.5 ms |
| 最慢单个资源时长 | 34.3 ms | 23.1 ms |
| 资源请求数量 / transfer bytes | 108 / 1,511,851 | 53 / 1,182,332 |
| 长任务开始 / 持续 | 94.5 / 68；272.7 / 95 ms | 55.7 / 52；154.2 / 69 ms |
| CPU 采样中 GC | 17.9 ms | 10.1 ms |
| 业务 console / pageerror | 0 | 0 |

与严格脚本同样使用页面命名根节点、`[data-page-content-root]` 图片 complete 和两帧作为终点；本轮两页该根范围内没有图片元素，不能把延迟归因于该范围图片加载。

CDP 同时保存 Profiler 1ms 采样及完整 `devtools.timeline / v8 / v8.gc` trace。采样停止晚于页面终点：PDA JS 读取证据时421.5ms，CPU profile总447.5ms；Web分别264.5ms/288.7ms，因此采样包含少量导航与采集尾部开销，不能直接拿 profile总时长作为页面耗时。

观察到的真实计算：

- PDA 模块 evaluate 长片段 67.5ms、23.6ms，后台模块解析31.4ms；页面渲染链 inclusive约57.4ms，PDA shell/topbar链54.9ms，其中裁床执行来源36.2ms。来源共享包的单个最大 self采样7.5ms。
- 中转袋模块 evaluate 51.6ms、45.2ms，后台解析29.6ms；列表 projection/render链38.3ms，layout17.4ms；二维码 applyMask self采样7.9ms。
- inclusive调用栈互相包含，不可把这些时间相加当总耗时。完整 minified函数名、chunk URL、时间戳和调用树见JSON。
- 未出现单个数百毫秒网络等待、图片等待或GC；本轮也没有复现原500ms以上耗时。正常模块初始化/渲染有成本，但没有证据表明它们解释了原样本额外200–300ms。原慢样本没有对应trace，无法可靠判断是外部CPU、磁盘、调度或其他因素。

诊断结束后的本session只读清单：browser.contexts().length = 1，唯一页为 `about:blank`；两个profile context已关闭。本session不存在遗留业务页；该结论不覆盖主代理 `hpb-release` 或其他浏览器实例。

证据：

- `profile-two-routes-build15.js`：诊断脚本。
- `profile-two-routes-build15.txt`：CLI原始返回，保留完整CPU/trace。
- `profile-two-routes-build15.json`：解析后的原始数据，无慢样本筛除。
- `profile-two-routes-context-inventory.txt`：session清单。

CPU / 浏览器窗口已释放。下一轮最终严格验收仍由主代理按同版、完整样本执行，本次不提出无证据产品源码优化。
