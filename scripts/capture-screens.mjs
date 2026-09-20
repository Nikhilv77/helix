/**
 * Deterministic full-page screenshot capture tool using Chrome DevTools Protocol (CDP).
 *
 * Launches headless Chromium, overrides device metrics (desktop 1280x800 and mobile 390x844),
 * forces prefers-reduced-motion, pre-configures theme via new-document scripts before hydration,
 * and waits for fonts, images, and layout stability before capturing PNGs into scratch/screenshots/.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = process.env.CAPTURE_BASE_URL ?? "http://localhost:3001";
const COMMAND_TIMEOUT_MS = 10_000;
const PAGE_LOAD_TIMEOUT_MS = 15_000;
const IMAGE_WAIT_TIMEOUT_MS = 5_000;
const SETTLE_MS = Number(process.env.CAPTURE_SETTLE_MS ?? "150");
const REDUCED_MOTION = process.env.CAPTURE_REDUCED_MOTION !== "false";
const ROUTE_FILTER = process.env.CAPTURE_ROUTE;
const VIEWPORT_FILTER = process.env.CAPTURE_VIEWPORT;
const THEME_FILTER = process.env.CAPTURE_THEME;
const TARGET_SELECTOR = process.env.CAPTURE_TARGET;

const allRoutes = [
  { name: "home", path: "/" },
  { name: "blog", path: "/blog" },
  { name: "blog-post", path: "/blog/turn-your-resume-into-interview-evidence" },
  { name: "privacy", path: "/privacy" },
  { name: "terms", path: "/terms" }
];

const routes = ROUTE_FILTER
  ? allRoutes.filter((route) => route.name === ROUTE_FILTER)
  : allRoutes;

const allViewports = [
  { name: "desktop", width: 1280, height: 800, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true }
];

const viewports = VIEWPORT_FILTER
  ? allViewports.filter((viewport) => viewport.name === VIEWPORT_FILTER)
  : allViewports;

const themes = THEME_FILTER ? [THEME_FILTER] : ["dark", "light"];

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = globalThis.setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  return Promise.race([promise, timeout]).finally(() => globalThis.clearTimeout(timer));
}

async function waitForDevTools(port) {
  const deadline = Date.now() + COMMAND_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return response.json();
    } catch {
      // Chrome has not opened the debugging endpoint yet.
    }
    await delay(100);
  }

  throw new Error(`Chrome DevTools did not start on port ${port}`);
}

async function run() {
  const targetDir = process.argv[2] || "before";
  const outputDir = path.resolve(process.cwd(), "scratch/screenshots", targetDir);
  fs.mkdirSync(outputDir, { recursive: true });

  // A unique profile and high random port keep concurrent capture runs from
  // attaching to one another's browser process.
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "trailgrad-screens-"));
  const port = 10_000 + Math.floor(Math.random() * 40_000);

  const chrome = spawn(CHROME_PATH, [
    "--headless",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--disable-gpu",
    "--no-sandbox",
    "--remote-allow-origins=*"
  ], { stdio: "ignore" });

  try {
    const version = await waitForDevTools(port);
    const wsUrl = version.webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);
    let id = 1;
    const pending = new Map();
    const eventWaiters = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject, timer } = pending.get(msg.id);
        pending.delete(msg.id);
        globalThis.clearTimeout(timer);
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
        else resolve(msg);
        return;
      }

      if (msg.sessionId && msg.method) {
        const key = `${msg.sessionId}:${msg.method}`;
        const waiter = eventWaiters.get(key);
        if (waiter) {
          eventWaiters.delete(key);
          globalThis.clearTimeout(waiter.timer);
          waiter.resolve(msg.params);
        }
      }
    };

    await withTimeout(new Promise((resolve) => {
      if (ws.readyState === WebSocket.OPEN) resolve();
      else ws.onopen = resolve;
    }), COMMAND_TIMEOUT_MS, "DevTools WebSocket connection");

    function send(method, params = {}) {
      const msgId = id++;
      return new Promise((resolve, reject) => {
        const timer = globalThis.setTimeout(() => {
          pending.delete(msgId);
          reject(new Error(`${method} timed out after ${COMMAND_TIMEOUT_MS}ms`));
        }, COMMAND_TIMEOUT_MS);
        pending.set(msgId, { resolve, reject, timer });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    const target = await send("Target.createTarget", { url: "about:blank" });
    const pageTargetId = target.result.targetId;

    const attach = await send("Target.attachToTarget", {
      targetId: pageTargetId,
      flatten: true
    });
    const sessionId = attach.result.sessionId;

    function sendSession(method, params = {}) {
      const msgId = id++;
      return new Promise((resolve, reject) => {
        const timer = globalThis.setTimeout(() => {
          pending.delete(msgId);
          reject(new Error(`${method} timed out after ${COMMAND_TIMEOUT_MS}ms`));
        }, COMMAND_TIMEOUT_MS);
        pending.set(msgId, { resolve, reject, timer });
        ws.send(JSON.stringify({ id: msgId, sessionId, method, params }));
      });
    }

    function waitForSessionEvent(method, timeoutMs = PAGE_LOAD_TIMEOUT_MS) {
      const key = `${sessionId}:${method}`;
      return new Promise((resolve, reject) => {
        const timer = globalThis.setTimeout(() => {
          eventWaiters.delete(key);
          reject(new Error(`${method} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        eventWaiters.set(key, { resolve, reject, timer });
      });
    }

    await sendSession("Page.enable");
    await sendSession("DOM.enable");

    // Keep deterministic reduced-motion captures by default, while allowing
    // animation-specific visual checks when explicitly requested.
    await sendSession("Emulation.setEmulatedMedia", {
      features: [
        {
          name: "prefers-reduced-motion",
          value: REDUCED_MOTION ? "reduce" : "no-preference"
        }
      ]
    });

    for (const route of routes) {
      for (const vp of viewports) {
        for (const theme of themes) {
          console.log(`Capturing ${route.name} - ${vp.name} - ${theme}`);

          await sendSession("Emulation.setDeviceMetricsOverride", {
            width: vp.width,
            height: vp.height,
            deviceScaleFactor: 1,
            mobile: vp.mobile
          });

          // Inject theme initialization script so localStorage and root DOM classes are established
          // before any application script executes or React hydrates.
          const initScript = await sendSession("Page.addScriptToEvaluateOnNewDocument", {
            source: `
              try {
                localStorage.setItem("trailgrad-theme", "${theme}");
                document.documentElement.classList.remove("light", "dark");
                document.documentElement.classList.add("${theme}");
                document.documentElement.setAttribute("data-theme", "${theme}");
              } catch(e) {}
            `
          });

          const pageLoaded = waitForSessionEvent("Page.loadEventFired");
          await sendSession("Page.navigate", {
            url: `${BASE_URL}${route.path}`
          });
          await pageLoaded;

          // Wait for web fonts to finish loading
          await sendSession("Runtime.evaluate", {
            expression: `document.fonts.ready.then(() => true)`,
            awaitPromise: true,
            returnByValue: true
          });

          // Lazy images below the viewport may intentionally never start
          // loading. Wait only for eager or currently visible images, with a
          // hard upper bound so a broken asset cannot stall the whole run.
          await sendSession("Runtime.evaluate", {
            expression: `
              Promise.race([
                Promise.all(
                  Array.from(document.images)
                    .filter((img) => {
                      if (img.complete) return false;
                      if (img.loading !== "lazy") return true;
                      const rect = img.getBoundingClientRect();
                      return rect.bottom >= 0 && rect.top <= window.innerHeight;
                    })
                    .map((img) => new Promise((resolve) => {
                      img.addEventListener("load", resolve, { once: true });
                      img.addEventListener("error", resolve, { once: true });
                    }))
                ),
                new Promise((resolve) => setTimeout(resolve, ${IMAGE_WAIT_TIMEOUT_MS}))
              ]).then(() => true)
            `,
            awaitPromise: true,
            returnByValue: true
          });

          if (TARGET_SELECTOR) {
            await sendSession("Runtime.evaluate", {
              expression: `document.querySelector(${JSON.stringify(TARGET_SELECTOR)})?.scrollIntoView({ block: "center" })`
            });
          }

          // Double requestAnimationFrame to ensure layout & compositing have settled
          await sendSession("Runtime.evaluate", {
            expression: `
              new Promise((resolve) => {
                requestAnimationFrame(() => {
                  requestAnimationFrame(resolve);
                });
              })
            `,
            awaitPromise: true,
            returnByValue: true
          });

          await delay(SETTLE_MS);

          if (route.name === "home") {
            const ambience = await sendSession("Runtime.evaluate", {
              expression: `(() => {
                const root = document.querySelector(".home-theme-arrival");
                const hero = document.querySelector(".marketing-theme-hero");
                return {
                  state: root?.getAttribute("data-home-ambience") ?? null,
                  daylightOpacity: hero
                    ? getComputedStyle(hero, "::after").opacity
                    : null
                };
              })()`,
              returnByValue: true
            });
            console.log("Home ambience", ambience.result.result.value);

            const pitches = await sendSession("Runtime.evaluate", {
              expression: `Array.from(document.querySelectorAll(".marketing-hero-title")).map((title) => ({
                text: title.textContent,
                parentInlineVisibility: title.parentElement?.style.visibility ?? null,
                parentVisibility: getComputedStyle(title.parentElement).visibility,
                titleVisibility: getComputedStyle(title).visibility,
                wordVisibility: getComputedStyle(title.querySelector(".stagger-word")).visibility,
                phase: title.getAttribute("data-phase")
              }))`,
              returnByValue: true
            });
            console.log("Hero pitches", pitches.result.result.value);
          }

          const shot = await sendSession("Page.captureScreenshot", {
            format: "png"
          });

          // Clean up the evaluation script for next navigation
          if (initScript.result?.identifier) {
            await sendSession("Page.removeScriptToEvaluateOnNewDocument", {
              identifier: initScript.result.identifier
            });
          }

          const buffer = Buffer.from(shot.result.data, "base64");
          const filename = `${route.name}-${vp.name}-${theme}.png`;
          fs.writeFileSync(path.join(outputDir, filename), buffer);
        }
      }
    }

    ws.close();
    console.log(`Successfully captured screenshots in ${outputDir}`);
  } finally {
    if (chrome.exitCode === null) {
      const exited = once(chrome, "exit");
      chrome.kill();
      await Promise.race([exited, delay(3_000)]);
    }
    fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

run().catch((e) => {
  console.error("Screenshot capture failed:", e);
  process.exit(1);
});
