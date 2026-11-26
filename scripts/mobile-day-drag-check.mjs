// Mobile check: drag the day sheet down to close it, swipe up on the days dock to reopen it.
const { chromium } = await import(process.env.RORK_PLAYWRIGHT_MODULE ?? "/usr/local/lib/node_modules/playwright/index.mjs");

const url = process.argv[2] ?? "https://uk3zldcwsxcglwotqxwj7-web.rork.live";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await context.addInitScript(() => { try { sessionStorage.setItem("rorkQA", "1"); } catch {} });
const page = await context.newPage();
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };

const swipeOn = (el, x1, y1, x2, y2) => {
  const touch = (type, x, y, touches) => {
    const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches, changedTouches: [t] }));
  };
  touch("touchstart", x1, y1, [1]);
  if (y2 !== y1) touch("touchmove", x1, y1 + (y2 - y1) / 2, [1]); // one intermediate move for drag tracking
  touch("touchend", x2, y2, []);
};

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".leaflet-container", { timeout: 30000 });
  await page.waitForTimeout(3000);
  const canvas = page.locator(".leaflet-container").first();

  const closePanel = async () => {
    const x = page.getByRole("button", { name: "Close panel" });
    if (await x.isVisible().catch(() => false)) await x.click();
    await page.waitForTimeout(500);
  };
  // Build a trip: start point + one stop (day panel auto-opens after the first stop).
  await closePanel();
  {
    const box = await canvas.boundingBox();
    await page.touchscreen.tap(box.x + 195, box.y + 430);
    await page.getByRole("button", { name: "Confirm" }).first().waitFor({ timeout: 20000 });
    await page.getByRole("button", { name: "Confirm" }).first().click();
    await page.waitForTimeout(2000);
    await page.touchscreen.tap(box.x + 150, box.y + 300);
    await page.getByRole("button", { name: "Add as stop" }).first().waitFor({ timeout: 20000 });
    await page.getByRole("button", { name: "Add as stop" }).first().click();
    await page.waitForTimeout(2500);
  }

  const sheet = page.locator("div[class*='glass-panel']").filter({ has: page.getByRole("button", { name: "Close panel" }) }).first();
  const dockWrap = page.locator('div[class*="z-\\[540\\]"]').first();

  // Open the day sheet the way users do: open the days dock (if closed), tap a day chip.
  const showDays = page.getByRole("button", { name: "Show days" });
  if (await showDays.isVisible().catch(() => false)) { await showDays.click(); await page.waitForTimeout(800); }
  await page.locator("div.glass-card .truncate").first().click();
  await page.waitForTimeout(800);

  // 1. Drag the sheet down -> closes
  if (!(await sheet.isVisible().catch(() => false))) { await page.screenshot({ path: ".rork/web-verification/debug-drag.png" }); fail("day sheet did not open"); process.exit(1); }
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => d.querySelector(':scope > [aria-label="Close panel"]'));
    if (!el) throw new Error("no sheet");
    const touch = (type, x, y, withTouches) => {
      const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: withTouches ? [t] : [], changedTouches: [t] }));
    };
    touch("touchstart", 195, 500, true);
    touch("touchmove", 195, 600, true);
    touch("touchmove", 195, 720, true);
    touch("touchend", 195, 760, false);
  });
  await page.waitForTimeout(600);
  const closed = !(await sheet.isVisible().catch(() => false));
  console.log(`drag down closes the sheet: ${closed}`);
  await page.screenshot({ path: ".rork/web-verification/day-drag-closed.png" });

  // 2. Swipe up on the days dock -> sheet reopens
  await dockWrap.waitFor({ state: "visible", timeout: 10000 });
  await page.evaluate(() => {
    const el = document.querySelector('div[class*="z-[540]"]');
    if (!el) throw new Error("no dock wrapper");
    const touch = (type, x, y, withTouches) => {
      const t = new Touch({ identifier: 2, target: el, clientX: x, clientY: y });
      el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: withTouches ? [t] : [], changedTouches: [t] }));
    };
    touch("touchstart", 60, 790, true);
    touch("touchend", 60, 590, false);
  });
  await page.waitForTimeout(800);
  const reopened = await sheet.isVisible().catch(() => false);
  console.log(`swipe up on dock opens the sheet: ${reopened}`);
  await page.screenshot({ path: ".rork/web-verification/day-drag-reopened.png" });

  if (!closed || !reopened) process.exitCode = 1;
} catch (e) {
  fail(e.message);
} finally {
  await browser.close();
}
