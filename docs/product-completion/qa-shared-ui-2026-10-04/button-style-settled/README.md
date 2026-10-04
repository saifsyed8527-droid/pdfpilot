# Codec button contrast diagnosis

Tested the combined local candidate at `http://127.0.0.1:4400/url-decode`, after the parent integrated A's shared shell and overflow correction. Input `A%20B` produced `A B` (3 bytes). One isolated headless Chrome context checked 1440px light and 375px dark, with no server/build started by A.

The muted buttons in E's prior screenshots were intermediate frames of the existing 150ms `transition-colors` CSS transition. The harness changes the root theme and takes a screenshot immediately; its buttons interpolate between slate/white and amber/slate. Initial inspection recorded intermediate colors with opacity 1 and no disabled state. Waiting for actual CSS transitions to finish restored the intended colors, without changing product code.

| Button | Light text/background | Dark text/background |
| --- | --- | --- |
| Download | `rgb(255,255,255)` / `rgb(2,6,23)` | `rgb(2,6,23)` / `rgb(245,158,11)` |
| Copy | `rgb(15,23,41)` / `rgb(255,255,255)` | `rgb(248,250,252)` / `rgb(7,10,19)` |

Download, Copy, primary action and Reset were all enabled (`disabled=false`, `:disabled=false`) with own/ancestor opacity 1, no filter/backdrop filter, and no blocking overlay. Browser page-error count: 0. Both final screenshots were visually inspected. The styling blocker is cleared; no client/shared styling fix is required.

For future theme screenshots, wait for transitions before capture:

```js
await page.evaluate(() => Promise.all(
  document.getAnimations()
    .filter(animation => animation instanceof CSSTransition)
    .map(animation => animation.finished.catch(() => {}))
));
```

The first attempt filled before React hydration completed after DOMContentLoaded and could not enable the action. Repeating after network-idle loading succeeded. The successful diagnostic was then repeated with the transition-completion wait. The browser closed after each attempt.

- [1440 light](url-decode-1440-light.png)
- [375 dark](url-decode-375-dark.png)
- [Actual computed styles, matched rules and ancestors](computed-styles.json)

The installed Playwright module was `/Users/apple/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`; Chrome executable `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. These are emulated desktop viewports, not native-device certification. Production verification remains with the integration owner.
