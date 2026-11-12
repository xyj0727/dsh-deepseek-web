# DeepSeek Chat and Grok inside DeepSeek Harness

A plugin for the **[DeepSeek Harness](https://github.com/deepseek-ai)** desktop app that puts
[chat.deepseek.com](https://chat.deepseek.com) and [grok.com](https://grok.com) into the Harness
window itself: one sidebar entry each, a chrome-less chat page that fills the whole main area,
and — with the bundled one-line patch — a login that survives restarts.

No browser tab, no second app window, no private API.

> **Unofficial.** Not affiliated with, endorsed by, or supported by DeepSeek or xAI.
> It is a client-side plugin plus a local patch script for your own installation.

---

## What you get

| | |
| --- | --- |
| Sidebar entries | “DeepSeek Chat” (blue whale icon) and “Grok” (Grok mark), pinned above the other entries |
| Main panels | the site in a `<webview>`, 100 % full-bleed — no Harness toolbar, no address bar |
| On launch | DeepSeek Chat is selected automatically, so DSH opens straight into the chat page |
| Switching | click the other sidebar entry to move between DeepSeek Chat and Grok; each keeps its own login |
| Login | persists across restarts **after** the patch below is applied (otherwise you re-login every launch) |

---

## ⚠️ This project has two parts

| Part | Files | Purpose | Required? |
| --- | --- | --- | --- |
| **1. Plugin** | `index.js`, `client.js`, `cordis.patch.yml`, `locale/`, `icon.*` | sidebar entries + chat panels | yes |
| **2. Harness patch** | `patch-dsh.cjs` | makes the webview session persistent → no daily login | **needed for “stay logged in”**, not for rendering the page |

The patch modifies **your local copy** of the Harness `app.asar` (one string, same byte length).
It contains no third-party code and is not a redistribution of anything.

---

## Requirements

- DeepSeek Harness **desktop** app (Electron), tested with `0.2.2-rc.1` on Windows.
  A Harness build that exposes the `main` and `sidebar.panellist` client slots is required.
- A DSH profile you can edit (default: `%USERPROFILE%\.dsh\profiles\desktop`).
- Node.js + pnpm on `PATH` (DSH ships both; a system install is fine).
- Network access to `grok.com` (may require your own connectivity setup in some regions);
  the Grok account itself is yours to provide.

---

## Install

### Step 1 — put the plugin somewhere

```powershell
git clone https://github.com/xyj0727/dsh-deepseek-web.git D:\tools\dsh-deepseek-web
```

### Step 2 — register it in your DSH profile

The profile is a small pnpm package. Edit `%USERPROFILE%\.dsh\profiles\desktop\package.json`
and add the package to **both** places — dependencies *and* the bundle list:

```jsonc
{
  "dependencies": {
    "@local/dsh-deepseek-web": "link:D:/tools/dsh-deepseek-web"
  },
  "dsh": {
    "profile": {
      "bundles": [
        // ... the bundles that were already there ...
        "@local/dsh-deepseek-web"
      ]
    }
  }
}
```

Then install it in the profile directory so the junction/lockfile is created:

```powershell
cd $env:USERPROFILE\.dsh\profiles\desktop
pnpm install
```

> The package name `@local/dsh-deepseek-web` is just the name this repo was developed under.
> A `link:` install accepts any name — if you rename it, keep the dependency key and the
> bundle entry identical.

Restart DSH (or reload the renderer). You should now see the “DeepSeek Chat” and “Grok” entries
in the sidebar.

### Step 3 — apply the patch (this is the part that keeps you logged in)

```powershell
cd D:\tools\dsh-deepseek-web
node patch-dsh.cjs --check   # prints the fuse state and whether the asar is patched
node patch-dsh.cjs          # applies the patch (idempotent, creates a .bak)
```

Then **fully quit DSH and start it again** (the patch touches main-process code),
and log in to DeepSeek and to Grok once each. From then on both sessions persist;
the same patch covers both sites, no second patch is needed.

Undo at any time:

```powershell
node patch-dsh.cjs --revert
```

> **After every DSH update, re-run `node patch-dsh.cjs`.**
> An update replaces `app.asar` and therefore removes the patch; the symptom is simply
> “the chat asks me to log in again”.

---

## The two sites

| | DeepSeek Chat | Grok |
| --- | --- | --- |
| Sidebar label | DeepSeek Chat | Grok |
| Site | `https://chat.deepseek.com` | `https://grok.com` |
| Selected on launch | ✅ yes | no (click the sidebar entry) |
| Login | phone / e-mail / WeChat, inside the panel | X / Google / Apple, popup inside the panel |

- **Independent logins.** Both panels use the same persistent partition, but cookies are
  per-domain, so the two accounts never interfere.
- **Grok sign-in uses a popup.** The plugin allows popups (`allowpopups`); the popup shares the
  persistent partition, so once the OAuth round-trip finishes the panel comes back logged in.
- What you get is the web page itself — no address bar, no Harness chrome; the site's own
  navigation and reloads behave normally.

---

## How it works

**Plugin.** A client-side module declares the two sites in a `CHATS` table and, for each, registers
a `sidebar.panellist` entry and a `main` panel (keys `deepseek-chat` and `grok-chat`).
A panel asks the desktop host for a browser lease (`window.dshDesktop.browser.acquire()`), mounts
a `<webview>` on that lease, and loads its URL **once** — see the note on the reload loop below.
On startup the module selects `deepseek-chat` a single time, so DSH opens on the DeepSeek chat page;
Grok is never auto-selected, so it cannot steal the launch view.

**Patch.** The Harness creates the webview session partition as
`` `dsh-sidebar-browser-${randomUUID()}` `` — a fresh, non-persistent partition per lease, so
all cookies are thrown away when the app exits. `patch-dsh.cjs` rewrites that one expression to
the fixed partition `` `persist:dsh-sidebar-browser` `` (a same-length or shorter replacement,
so no asar offsets move), after verifying that the `EnableEmbeddedAsarIntegrityValidation`
fuse is disabled. It is idempotent and keeps `app.asar.dsh-deepseek-web.bak`. Because cookies are
stored per domain, this one change keeps both DeepSeek and Grok signed in.

---

## Known behaviour & caveats

- **Switching panels reloads the page.** The Harness layout unmounts a panel when another main
  panel becomes active, so the webview is destroyed and re-created. The login survives the
  reload (persistent partition); unsent text in the box does not.
- **One shared partition.** Because the patched partition is a single fixed name, every Harness
  workspace/tab shares it; each site still keeps its own cookies.
- **Reload loop (fixed).** `dom-ready` fires once per guest document; navigating again from that
  handler makes the page reload itself forever. Each panel now loads once per lease. If you write
  your own panel, do not call `loadURL()` inside `dom-ready` unconditionally.
- **Grok challenges.** `grok.com` sits behind Cloudflare bot management; a plain load normally
  passes, but if a challenge page appears, solve it inside the panel — it is the real page,
  not a Harness dialog.
- **Grok user agent.** The Grok panel strips the `Electron/x.y.z` token from its user agent to
  reduce embedded-browser filtering by the site.
- **DSH is a moving target.** The plugin depends on DSH-internal slot names and window APIs
  (`main`, `sidebar.panellist`, `ctx.layout`, `window.dshDesktop.browser`). A Harness refactor
  can break it; the patch depends on an exact string in `lib/main.js` and fails loudly
  (keeping the backup) when it is not found.
- **Trademarks.** The whale icon comes from the MIT-licensed
  [Gle-Res/DeepSeek](https://github.com/Gle-Res/DeepSeek) wrapper; the Grok mark comes from xAI's
  public site assets. Each mark belongs to its owner and is used here only to label the embedded
  service. The MIT licence of this repo covers the code in this repository only.

---

## Uninstall

1. Remove `@local/dsh-deepseek-web` from the profile's `dependencies` and `bundles`, then
   `pnpm install` in the profile directory.
2. `node patch-dsh.cjs --revert` to restore `app.asar` from the backup.
3. Restart DSH.

---

## License

[MIT](LICENSE) © 2026 xyj0727

Chinese version: [README.md](README.md).
