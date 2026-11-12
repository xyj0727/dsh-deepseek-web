window.__ModuleLoader__.load({
  id: '@local/dsh-deepseek-web',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NAMESPACE = 'deepseekWeb';

    /**
     * Web chats hosted as main panels. Each entry gets its own sidebar row (sorted by
     * `order`), its own main-panel key and its own browser workspace key, so the guest
     * webviews never collide. `HOME_CHAT_ID` is the one selected automatically on launch.
     */
    const CHATS = [
      {
        id: 'deepseek-chat',
        url: 'https://chat.deepseek.com/',
        order: -10,
        label: 'chat.deepseek',
        loading: 'panel.loadingDeepseek',
        glyph: 'deepseek',
      },
      {
        id: 'grok-chat',
        url: 'https://grok.com/',
        order: -9,
        label: 'chat.grok',
        loading: 'panel.loadingGrok',
        glyph: 'grok',
        /* grok.com sits behind Cloudflare; a plain Chrome UA avoids Electron fingerprints. */
        stripElectronUA: true,
      },
    ];
    const HOME_CHAT_ID = 'deepseek-chat';

    const EN = {
      'chat.deepseek': 'DeepSeek Chat',
      'chat.grok': 'Grok',
      'panel.loadingDeepseek': 'Connecting to DeepSeek…',
      'panel.loadingGrok': 'Connecting to Grok…',
      'panel.retry': 'Retry',
      'error.lease': 'The chat view could not be opened. Use the desktop Harness app and try again.',
      'error.load': 'The page failed to load. Check the network connection and try again.',
      'error.crash': 'The page stopped unexpectedly. Click retry to reload it.',
      'error.unsupported': 'Embedded pages are unavailable in this environment. Use the desktop Harness app.',
    };
    const ZH = {
      'chat.deepseek': 'DeepSeek Chat',
      'chat.grok': 'Grok',
      'panel.loadingDeepseek': '正在连接 DeepSeek…',
      'panel.loadingGrok': '正在连接 Grok…',
      'panel.retry': '重试',
      'error.lease': '无法打开聊天视图，请在桌面版 Harness 中重试。',
      'error.load': '页面加载失败，请检查网络后重试。',
      'error.crash': '页面意外退出，点击重试可重新加载。',
      'error.unsupported': '当前环境不支持内嵌页面，请使用桌面版 Harness。',
    };
    const DICTIONARIES = {
      zh: ZH,
      en: EN,
      ja: EN,
      es: EN,
      fr: EN,
      de: EN,
      ru: EN,
      pt: EN,
    };

    /**
     * The desktop preload exposes `window.dshDesktop.browser` with an acquire/release
     * lease protocol for guest webviews; the main process only accepts `about:blank#<lease>`.
     * @returns the bridge, or undefined when this client runs without it.
     */
    function desktopBridge() {
      const desktop = typeof globalThis === 'undefined' ? undefined : globalThis.dshDesktop;
      const bridge = desktop === undefined || desktop === null ? undefined : desktop.browser;
      if (bridge === undefined || bridge === null) return undefined;
      if (typeof bridge.acquire !== 'function' || typeof bridge.release !== 'function') return undefined;
      return bridge;
    }

    /** Same Chromium build, minus the `Electron/x.y.z` token some bot filters look for. */
    function chromeUserAgent() {
      const raw = typeof navigator === 'undefined' ? '' : String(navigator.userAgent || '');
      const stripped = raw.replace(/\sElectron\/[\d.]+/g, '').replace(/\s{2,}/g, ' ').trim();
      return stripped === '' ? undefined : stripped;
    }

    /** The official DeepSeek whale mark, 64px, inlined so the sidebar glyph needs no asset route. */
    const ICON_URL = 'data:image/png;base64,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';

    /** Grok mark, 64px, inlined for the same reason. */
    const GROK_ICON_URL = 'data:image/png;base64,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';

    /** Sidebar glyphs: the DeepSeek whale and the Grok mark, both inlined as data URIs. */
    function WhaleGlyph({ size }) {
      const pixels = typeof size === 'number' && size > 0 ? size : 18;
      return h('img', {
        src: ICON_URL,
        alt: '',
        width: pixels,
        height: pixels,
        'aria-hidden': 'true',
        draggable: false,
        style: { display: 'block', width: pixels + 'px', height: pixels + 'px', objectFit: 'contain' },
      });
    }

    function GrokGlyph({ size }) {
      const pixels = typeof size === 'number' && size > 0 ? size : 18;
      return h('img', {
        src: GROK_ICON_URL,
        alt: '',
        width: pixels,
        height: pixels,
        'aria-hidden': 'true',
        draggable: false,
        style: {
          display: 'block',
          width: pixels + 'px',
          height: pixels + 'px',
          objectFit: 'contain',
          borderRadius: Math.round(pixels * 0.22) + 'px',
        },
      });
    }

    /** Which glyph a chat uses, kept in one place so new entries are a one-line change. */
    function ChatGlyph({ name, size }) {
      return name === 'deepseek' ? h(WhaleGlyph, { size }) : h(GrokGlyph, { size });
    }

    const CONTAINER_STYLE = {
      position: 'relative',
      display: 'flex',
      flex: '1 1 auto',
      minWidth: 0,
      minHeight: 0,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--dsw-alias-bg-base, #ffffff)',
    };
    const HOST_STYLE = {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      minWidth: 0,
      minHeight: 0,
    };
    const WEBVIEW_STYLE = 'display:flex;width:100%;height:100%;border:0;margin:0;padding:0;background:#ffffff';

    /**
     * Reload guard: the guest page is destroyed whenever the panel unmounts, so a
     * burst of mount/unmount cycles would hammer the site and trip its rate limiter.
     * The stamp lives in sessionStorage (per chat) so it also covers remounts.
     */
    const LOAD_STAMP_PREFIX = 'dsh-deepseek-web:last-load:';
    const MIN_LOAD_INTERVAL = 2500;
    const readLoadStamp = (chatId) => {
      try {
        const value = Number(window.sessionStorage.getItem(LOAD_STAMP_PREFIX + chatId));
        return Number.isFinite(value) ? value : 0;
      } catch (error) {
        return 0;
      }
    };
    const writeLoadStamp = (chatId, value) => {
      try {
        window.sessionStorage.setItem(LOAD_STAMP_PREFIX + chatId, String(value));
      } catch (error) {
        /* a blocked sessionStorage only loses the throttle */
      }
    };

    const OVERLAY_STYLE = {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      padding: '24px',
      textAlign: 'center',
      background: 'var(--dsw-alias-bg-base, #ffffff)',
      color: 'var(--dsw-alias-label-secondary, #6b7280)',
      fontSize: '13px',
      lineHeight: '20px',
      pointerEvents: 'none',
    };
    const BUTTON_STYLE = {
      pointerEvents: 'auto',
      padding: '5px 14px',
      border: '1px solid var(--dsw-alias-border-l2, #d0d5dd)',
      borderRadius: '8px',
      background: 'var(--dsw-alias-bg-layer-1, #ffffff)',
      color: 'var(--dsw-alias-label-primary, #111827)',
      fontSize: '13px',
      lineHeight: '18px',
      cursor: 'pointer',
    };

    /**
     * One chat surface: a full-bleed guest webview holding `chat.url`.
     * Mounting acquires a browser lease, unmounting releases it (closing the guest).
     * @param props.t - locale translator for this plugin's namespace.
     */
    function createChatPanel(chat) {
      return function ChatPanel({ t }) {
        const hostRef = React.useRef(null);
        const [attempt, setAttempt] = React.useState(0);
        const [phase, setPhase] = React.useState('loading');
        const [detail, setDetail] = React.useState('load');

        React.useEffect(() => {
          const host = hostRef.current;
          if (host === null) return undefined;
          const bridge = desktopBridge();
          if (bridge === undefined) {
            setPhase('unsupported');
            return undefined;
          }
          let cancelled = false;
          let lease;
          let element;
          let loadTimer;
          let requested = false;
          const listeners = [];
          const on = (target, name, handler) => {
            target.addEventListener(name, handler);
            listeners.push([target, name, handler]);
          };
          const fail = (reason) => {
            if (cancelled) return;
            setDetail(reason);
            setPhase('failed');
          };
          setPhase('loading');
          bridge.acquire(chat.id).then((reservation) => {
            if (cancelled) {
              bridge.release(reservation.lease).catch(() => {});
              return;
            }
            lease = reservation.lease;
            element = document.createElement('webview');
            element.setAttribute('name', lease);
            element.setAttribute('partition', reservation.partition);
            element.setAttribute('allowpopups', '');
            element.setAttribute('src', 'about:blank#' + lease);
            element.setAttribute('style', WEBVIEW_STYLE);
            on(element, 'dom-ready', () => {
              /* dom-ready fires once per guest document. Navigating again here would
               * fire it again and turn the navigation into an endless reload loop. */
              if (cancelled || element === undefined || requested) return;
              requested = true;
              if (chat.stripElectronUA) {
                try {
                  const ua = chromeUserAgent();
                  if (ua !== undefined) element.setUserAgent(ua);
                } catch (error) {
                  /* an older guest ignores setUserAgent; the default UA still works */
                }
              }
              const startAt = Date.now();
              const wait = Math.max(0, MIN_LOAD_INTERVAL - (startAt - readLoadStamp(chat.id)));
              const load = () => {
                if (cancelled || element === undefined) return;
                writeLoadStamp(chat.id, Date.now());
                element.loadURL(chat.url).catch((error) => {
                  const message = error === null || error === undefined ? '' : String(error.message ?? error);
                  if (message.includes('ERR_ABORTED')) return;
                  fail('load');
                });
              };
              if (wait === 0) load();
              else loadTimer = setTimeout(load, Math.min(wait, MIN_LOAD_INTERVAL));
            });
            on(element, 'did-finish-load', () => {
              if (requested && !cancelled) setPhase('ready');
            });
            on(element, 'did-fail-load', (event) => {
              if (event.isMainFrame && event.errorCode !== -3) fail('load');
            });
            on(element, 'render-process-gone', () => fail('crash'));
            host.append(element);
          }).catch(() => {
            fail('lease');
          });
          return () => {
            cancelled = true;
            if (loadTimer !== undefined) clearTimeout(loadTimer);
            for (const [target, name, handler] of listeners) {
              try {
                target.removeEventListener(name, handler);
              } catch (error) {
                /* the guest may already be gone */
              }
            }
            if (element !== undefined) element.remove();
            if (lease !== undefined) bridge.release(lease).catch(() => {});
          };
        }, [attempt]);

        const overlay = phase === 'ready' ? null : h('div', { style: OVERLAY_STYLE }, [
          h('span', {
            key: 'mark',
            'aria-hidden': 'true',
            style: { display: 'block', opacity: phase === 'loading' ? 1 : 0.55 },
          }, h(ChatGlyph, { name: chat.glyph, size: 52 })),
          phase === 'failed'
            ? h('span', { key: 'text' }, t('error.' + detail))
            : phase === 'unsupported'
              ? h('span', { key: 'text' }, t('error.unsupported'))
              : h('span', { key: 'text' }, t(chat.loading)),
          phase === 'failed'
            ? h('button', {
              key: 'retry',
              type: 'button',
              style: BUTTON_STYLE,
              onClick: () => setAttempt((value) => value + 1),
            }, t('panel.retry'))
            : null,
        ]);

        return h('div', { style: CONTAINER_STYLE }, [
          h('div', { key: 'host', ref: hostRef, style: HOST_STYLE }),
          overlay,
        ]);
      };
    }

    /**
     * Keep the DeepSeek chat page as the default main view on startup.
     *
     * Selection happens at most twice: once after the main-panel slot registers,
     * then one verification pass in case the workspace restored a session right
     * after boot and flipped the panel back to the Conversation. After that the
     * plugin stays out of the way - a continuous re-select loop would unmount and
     * reload the guest page over and over and trip the site's rate limiter.
     */
    function installHomePanel(ctx) {
      let finished = false;
      let timer;
      let selections = 0;
      const activePanelId = () => {
        try {
          const info = ctx.layout === undefined ? undefined : ctx.layout.panelInfo;
          const snapshot = info === undefined || info === null ? undefined : info.getSnapshot();
          return snapshot === undefined ? undefined : snapshot.activePanelId;
        } catch (error) {
          return undefined;
        }
      };
      const isRegistered = () => {
        try {
          return ctx.layout.hasMainPanel(HOME_CHAT_ID) === true;
        } catch (error) {
          return false;
        }
      };
      const stop = () => {
        finished = true;
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
      };
      const select = () => {
        try {
          ctx.layout.selectPanel(HOME_CHAT_ID);
          selections += 1;
          return true;
        } catch (error) {
          return false;
        }
      };
      const tick = (attempt) => {
        timer = undefined;
        if (finished) return;
        if (selections >= 2) {
          stop();
          return;
        }
        if (!isRegistered()) {
          if (attempt >= 40) {
            stop();
            return;
          }
          timer = setTimeout(() => tick(attempt + 1), 150);
          return;
        }
        if (activePanelId() === HOME_CHAT_ID) {
          stop();
          return;
        }
        if (!select()) {
          if (attempt >= 40) {
            stop();
            return;
          }
          timer = setTimeout(() => tick(attempt + 1), 150);
          return;
        }
        timer = setTimeout(() => {
          timer = undefined;
          if (finished) return;
          if (selections < 2 && activePanelId() !== HOME_CHAT_ID) select();
          stop();
        }, 2000);
      };
      tick(0);
      window.addEventListener('pointerdown', stop, true);
      window.addEventListener('keydown', stop, true);
      return () => {
        stop();
        window.removeEventListener('pointerdown', stop, true);
        window.removeEventListener('keydown', stop, true);
      };
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NAMESPACE, DICTIONARIES), 'deepseek-web: dictionaries');
      const t = ctx.locale.bind(NAMESPACE);
      for (const chat of CHATS) {
        const icon = (props) => h(ChatGlyph, {
          name: chat.glyph,
          size: props === undefined ? undefined : props.size,
        });
        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: chat.id,
          order: chat.order,
          locale: NAMESPACE,
          label: () => t(chat.label),
        }, icon)), 'deepseek-web: sidebar entry ' + chat.id);
        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: chat.id,
          locale: NAMESPACE,
          inject: () => ({ t }),
        }, createChatPanel(chat))), 'deepseek-web: chat panel ' + chat.id);
      }
      ctx.effect(() => installHomePanel(ctx), 'deepseek-web: home panel');
    }

    return { inject: ['slots', 'locale', 'layout'], apply };
  },
});
