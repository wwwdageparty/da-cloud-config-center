# 🌩️ DaDemo Cloud Config Center (DCCC) — 演示页面

这是 **DaCloud Config Center (DCCC)** 的在线演示项目。  
本演示展示了如何通过简单的前端界面，与 Cloudflare Workers 版本的配置中心 API 进行交互。

Demo 网址：  
🔗 **https://democcc.pages.dev/**  

---

## 🚀 功能简介

该演示页面可直接连接到 DCCC 云端服务（默认已配置示例 API）。  
你可以在网页上输入 `readToken` 和 `writeToken`，然后：

- 🔍 查询配置键值  
- 🧾 列出指定 service/instance 下的所有配置  
- ✍️ 创建或更新配置项  
- ❌ 删除配置项  
- 🔐 查询机密（Secret）值（只读）

---

## 🧰 默认设置

| 项目 | 值 |
|------|----|
| API 基础地址 | `https://dccc.dagedemo.workers.dev/` |
| 默认写入令牌 (writeToken) | `Demo111+` |
| 默认读取令牌 (readToken) | `Demo222-` |
| 默认服务名 (service) | `dademo` |
| 默认实例名 (instance) | `test` |
| 默认查询键 (key) | `timeout` |

---

## 🔒 Secret 示例

该服务已在云端配置一个不可更改的测试 Secret：

| Secret 名称 | 值 |
|--------------|----|
| `DASECRET_TEST1` | `SECRET_TEST1` |

可以通过演示界面的 “Secret 查询” 区域，输入  
`DASECRET_TEST1` 来查看其值。

---

## ⚙️ API 端点说明

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/config?service=&instance=&key=` | 获取配置项（支持层级回退） |
| `PUT` | `/config` | 设置或更新配置项 |
| `DELETE` | `/config?service=&instance=&key=` | 删除配置项 |
| `GET` | `/configs?service=&instance=` | 列出配置项 |
| `GET` | `/secret?name=DASECRET_xxx` | 获取指定 Secret 值 |

---

## 🌍 一键部署到 Cloudflare Pages

该演示站点的源码托管在 GitHub 仓库：  
🔗 **https://github.com/wwwdageparty/dademo-cloud-config-center**

你可以直接 Fork 或导入该仓库，然后在  
Cloudflare Pages 上创建新项目，即可自动部署。

---

## 🧩 技术栈

- **HTML + Tailwind CSS** — 轻量美观的前端页面  
- **Vanilla JavaScript (ES6)** — 调用 Cloudflare Workers API  
- **DCCC Cloud API** — 实现分布式配置与 Secret 管理  

---

## 🧪 本地开发（可选）

如果你希望在本地修改并预览：

```bash
git clone https://github.com/wwwdageparty/dademo-cloud-config-center.git
cd dademo-cloud-config-center
npx serve .
```

然后在浏览器打开 `http://localhost:3000` 即可。

---

## 🧠 注意事项

- 此演示仅用于功能展示，请勿存储真实生产密钥。  
- 所有请求均通过前端直接发往 Cloudflare Workers。  
- 每次刷新页面后，需重新输入令牌（不会持久化）。  

---

## 💡 版权信息

© dage.party — DaSystem Cloud Suite  
本项目可自由 Fork，用于学习和演示。
