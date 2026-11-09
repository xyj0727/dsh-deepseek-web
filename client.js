window.__ModuleLoader__.load({
  id: '@local/dsh-deepseek-web',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NAMESPACE = 'deepseekWeb';
    /** Main-panel key; also the sidebar panellist entry id and the browser workspace key. */
    const PANEL_ID = 'deepseek-chat';
    const WORKSPACE_KEY = 'deepseek-chat';
    const CHAT_URL = 'https://chat.deepseek.com/';

    const EN = {
      'panel.label': 'DeepSeek Chat',
      'panel.loading': 'Connecting to DeepSeek…',
      'panel.retry': 'Retry',
      'error.lease': 'The chat view could not be opened. Use the desktop Harness app and try again.',
      'error.load': 'The page failed to load. Check the network connection and try again.',
      'error.crash': 'The page stopped unexpectedly. Click retry to reload it.',
      'error.unsupported': 'Embedded pages are unavailable in this environment. Use the desktop Harness app.',
    };
    const ZH = {
      'panel.label': 'DeepSeek Chat',
      'panel.loading': '正在连接 DeepSeek…',
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

    /** The official DeepSeek whale mark, 64px, inlined so the sidebar glyph needs no asset route. */
    const ICON_URL = 'data:image/png;base64,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';

    /** The blue whale mark: sidebar glyph first, loading splash second. */
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
     * burst of mount/unmount cycles would hammer chat.deepseek.com and trip its
     * rate limiter. The stamp lives in sessionStorage so it also covers remounts.
     */
    const LOAD_STAMP_KEY = 'dsh-deepseek-web:last-load';
    const MIN_LOAD_INTERVAL = 2500;
    const readLoadStamp = () => {
      try {
        const value = Number(window.sessionStorage.getItem(LOAD_STAMP_KEY));
        return Number.isFinite(value) ? value : 0;
      } catch (error) {
        return 0;
      }
    };
    const writeLoadStamp = (value) => {
      try {
        window.sessionStorage.setItem(LOAD_STAMP_KEY, String(value));
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
     * The chat surface: one full-bleed guest webview holding chat.deepseek.com.
     * Mounting acquires a browser lease, unmounting releases it (closing the guest).
     * @param props.t - locale translator for this plugin's namespace.
     */
    function ChatPanel({ t }) {
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
        bridge.acquire(WORKSPACE_KEY).then((reservation) => {
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
            const startAt = Date.now();
            const wait = Math.max(0, MIN_LOAD_INTERVAL - (startAt - readLoadStamp()));
            const load = () => {
              if (cancelled || element === undefined) return;
              writeLoadStamp(Date.now());
              element.loadURL(CHAT_URL).catch((error) => {
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
        h('img', {
          key: 'mark',
          src: ICON_URL,
          alt: '',
          width: 52,
          height: 52,
          'aria-hidden': 'true',
          draggable: false,
          style: {
            display: 'block',
            width: '52px',
            height: '52px',
            objectFit: 'contain',
            opacity: phase === 'loading' ? 1 : 0.55,
          },
        }),
        phase === 'failed'
          ? h('span', { key: 'text' }, t('error.' + detail))
          : phase === 'unsupported'
            ? h('span', { key: 'text' }, t('error.unsupported'))
            : h('span', { key: 'text' }, t('panel.loading')),
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
    }

    /**
     * Keep the chat page as the default main view on startup.
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
          return ctx.layout.hasMainPanel(PANEL_ID) === true;
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
          ctx.layout.selectPanel(PANEL_ID);
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
        if (activePanelId() === PANEL_ID) {
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
          if (selections < 2 && activePanelId() !== PANEL_ID) select();
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
      ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: -10,
        locale: NAMESPACE,
        label: () => t('panel.label'),
      }, WhaleGlyph)), 'deepseek-web: sidebar entry');
      ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NAMESPACE,
        inject: () => ({ t }),
      }, ChatPanel)), 'deepseek-web: chat panel');
      ctx.effect(() => installHomePanel(ctx), 'deepseek-web: home panel');
    }

    return { inject: ['slots', 'locale', 'layout'], apply };
  },
});
