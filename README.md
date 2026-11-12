# 在 DeepSeek Harness 里内嵌 DeepSeek Chat 和 Grok

把 [chat.deepseek.com](https://chat.deepseek.com) 和 [grok.com](https://grok.com) 直接放进
**DeepSeek Harness 桌面版**：侧栏各一个入口，主区域一整块无边框的网页聊天界面；
再配合仓库里的补丁脚本，登录状态跨重启保持。

不开浏览器、不开第二个窗口、不用任何私有 API。

> **非官方项目**。与 DeepSeek、xAI 均无关，未获其背书。它是给**你自己的安装**用的客户端插件 + 本地补丁脚本。

English version: [README.en.md](README.en.md)

---

## 效果

| | |
| --- | --- |
| 侧栏入口 | 「DeepSeek Chat」（蓝色鲸鱼图标）和「Grok」（Grok 标志），排在其它入口之前 |
| 主面板 | 用 `<webview>` 加载对应站点，100% 铺满，外面没有 DSH 工具栏、没有地址栏 |
| 启动时 | 自动选中 DeepSeek Chat，打开 DSH 就直接是聊天页 |
| 切换 | 点侧栏另一个入口即可在 DeepSeek Chat 和 Grok 之间切换，各自独立登录 |
| 登录 | 打了下面的补丁后跨重启保持；不打补丁则每次启动都要重新登录 |

---

## ⚠️ 这个项目由两部分组成

| 部分 | 文件 | 作用 | 必须吗 |
| --- | --- | --- | --- |
| **1. 插件** | `index.js`、`client.js`、`cordis.patch.yml`、`locale/`、`icon.*` | 侧栏入口 + 聊天主面板 | 必须 |
| **2. 本体补丁** | `patch-dsh.cjs` | 让 webview 的会话分区持久化，免去每次登录 | **只为「免登录」所必需**，不影响页面能不能显示 |

补丁改的是**你本机** Harness 的 `app.asar`（一个字符串，等长替换），不包含任何 DeepSeek 代码，
也不是对任何东西的再分发。

---

## 环境要求

- DeepSeek Harness **桌面版**（Electron），在 `0.2.2-rc.1` / Windows 上验证通过；
  需要该版本暴露 `main`、`sidebar.panellist` 这两个客户端槽位。
- 一个可编辑的 DSH profile（默认 `%USERPROFILE%\.dsh\profiles\desktop`）。
- Node.js 与 pnpm（DSH 自带，系统装也行）。
- Grok 需要能直接访问 `grok.com`（部分地区需自备网络条件）；Grok 账号本身由你自己准备。

---

## 安装

### 第 1 步：把插件放到位

```powershell
git clone https://github.com/xyj0727/dsh-deepseek-web.git D:\tools\dsh-deepseek-web
```

### 第 2 步：在 DSH profile 里注册

profile 本身是个小 pnpm 包。编辑 `%USERPROFILE%\.dsh\profiles\desktop\package.json`，
**两处都要加**：依赖列表 + bundle 列表。

```jsonc
{
  "dependencies": {
    "@local/dsh-deepseek-web": "link:D:/tools/dsh-deepseek-web"
  },
  "dsh": {
    "profile": {
      "bundles": [
        // ... 原有的 bundle ...
        "@local/dsh-deepseek-web"
      ]
    }
  }
}
```

然后在 profile 目录里装一次，生成链接和锁文件：

```powershell
cd $env:USERPROFILE\.dsh\profiles\desktop
pnpm install
```

> `@local/dsh-deepseek-web` 只是开发时用的包名，`link:` 安装对名字没有限制；
> 如要改名，依赖键和 bundle 列表里的名字保持一致即可。

重启 DSH（或重载渲染进程），侧栏应出现「DeepSeek Chat」和「Grok」两个入口。

### 第 3 步：打补丁（免登录就靠这一步）

```powershell
cd D:\tools\dsh-deepseek-web
node patch-dsh.cjs --check   # 打印 fuse 状态、是否已打补丁
node patch-dsh.cjs           # 打补丁（幂等，自动备份 .bak）
```

然后**完全退出 DSH 再启动**（改的是主进程代码），各自登录一次 DeepSeek 和 Grok，
之后就一直免登录。同一个补丁对两个站点都有效，不需要为 Grok 再打一次。

想撤销：

```powershell
node patch-dsh.cjs --revert
```

> **DSH 每次更新后都要重跑一次 `node patch-dsh.cjs`。**
> 更新会把 `app.asar` 换掉，补丁随之失效；表现就是「又开始要求重新登录」。

---

## 两个站点怎么用

| | DeepSeek Chat | Grok |
| --- | --- | --- |
| 侧栏名称 | DeepSeek Chat | Grok |
| 站点 | `https://chat.deepseek.com` | `https://grok.com` |
| 启动默认 | ✅ 是 | 否（点一下侧栏进入） |
| 登录方式 | 手机号 / 邮箱 / 微信，在面板内完成 | X / Google / Apple 账号，弹窗在面板内完成 |

- 两个面板是**各自独立的登录**：cookie 分区是同一个持久分区，但站点不同，互不影响。
- Grok 的第三方登录会开一个弹窗（插件已允许 `allowpopups`），弹窗走的是同一个持久分区，
  所以授权完成后回到面板即是已登录状态。
- 面板里就是网页本身，没有 DSH 的地址栏/工具栏；网页自己的刷新、跳转都正常。

---

## 实现原理

**插件侧**：客户端模块在 `CHATS` 表里声明两个站点，为每个站点注册一个 `sidebar.panellist` 入口
和一个 `main` 主面板（键分别是 `deepseek-chat`、`grok-chat`）。面板向桌面宿主申请浏览器租约
（`window.dshDesktop.browser.acquire()`），在租约上挂 `<webview>`，然后**只加载一次**目标 URL
（原因见下）。启动时它只把 `deepseek-chat` 选中一次，因此 DSH 打开即 DeepSeek 聊天页；
Grok 永远不自动选中，避免抢走启动画面。

**补丁侧**：Harness 给 webview 建会话分区时用的是
`` `dsh-sidebar-browser-${randomUUID()}` `` —— 一次性、非持久分区，退出即丢 cookie。
`patch-dsh.cjs` 把这一句改成固定分区 `` `persist:dsh-sidebar-browser` ``（等长或更短的替换，
不动 asar 偏移），替换前会校验 `EnableEmbeddedAsarIntegrityValidation` fuse 处于关闭状态。
脚本幂等，并保留 `app.asar.dsh-deepseek-web.bak`。分区是按域名存 cookie 的，所以一个补丁
同时让 DeepSeek 和 Grok 都保持登录。

---

## 已知行为与注意事项

- **切换面板会重新加载页面**：DSH 布局在切换主面板时会卸载旧面板，webview 随之销毁重建。
  因为是持久分区，登录态不会丢；输入框里没发送的文字会丢。
- **共用一个分区**：补丁后的分区名是固定的，所以所有工作区/标签共用同一个分区；
  站点之间仍然各自记各自的 cookie。
- **刷新死循环（已修）**：`dom-ready` 是按 document 触发的，若在这个回调里再 `loadURL()`，
  页面会自己刷新自己，永远停不下来。现在每个租约只加载一次。自己写面板时别在 `dom-ready`
  里无条件 `loadURL()`。
- **Grok 的验证码**：`grok.com` 有 Cloudflare 人机校验，普通加载一般不会拦；万一出现验证页，
  在面板里手动完成即可（它就是网页本身，不是 DSH 弹窗）。
- **Grok 的 UA**：面板会去掉 UA 里的 `Electron/x.y.z` 标记，减少站点对嵌入式浏览器的额外拦截。
- **DSH 改版会失效**：插件依赖 DSH 内部的槽位名和窗口 API（`main`、`sidebar.panellist`、
  `ctx.layout`、`window.dshDesktop.browser`）；补丁依赖 `lib/main.js` 里的一段确切字符串，
  找不到时会明确报错并保留备份，不会写坏文件。
- **商标**：DeepSeek 鲸鱼图标取自 MIT 许可的 [Gle-Res/DeepSeek](https://github.com/Gle-Res/DeepSeek)，
  Grok 标志取自 xAI 公开的站点标识；两个图形分别属于 DeepSeek 和 xAI，这里只用于标识所嵌入的服务。
  本仓库 MIT 只覆盖仓库内的代码。

---

## 卸载

1. 从 profile 的 `dependencies` 和 `bundles` 里删掉 `@local/dsh-deepseek-web`，在 profile 目录
   `pnpm install`。
2. `node patch-dsh.cjs --revert` 用备份还原 `app.asar`。
3. 重启 DSH。

---

## 许可

[MIT](LICENSE) © 2026 xyj0727

English version: [README.en.md](README.en.md)
