# HiGood 原型仓库

这是 HiGood/FCS/PCS/PDA 原型仓库，默认以页面演示、Mock 数据和业务链路表达为主。

## 常用命令

```bash
npm install
npm run build
```

## 裁片域检查与 E2E

完整运行顺序见：

- [docs/cutting-e2e.md](/Users/laoer/Documents/higoods/docs/cutting-e2e.md)

最小可复制命令：

```bash
npm install
npm run test:cutting:install-browsers
npm run test:cutting:bootstrap
npm run check:cutting:release
npm run test:cutting:all:e2e
```
