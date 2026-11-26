// Mobile check: day sheet docks to the bottom, map stays visible, swipe switches days.
const { chromium } = await import(process.env.RORK_PLAYWRIGHT_MODULE ?? "/usr/local/lib/node_modules/playwright/index.mjs");

const url = process.argv[2] ?? "https://uk3zldcwsxcglwotqxwj7-web.rork.live";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await context.addInitScript(() => { try { sessionStorage.setItem("rorkQA", "1"); } catch {} });
const page = await context.newPage();
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".leaflet-container", { timeout: 30000 });
  await page.waitForTimeout(3000);
  const canvas = page.locator(".leaflet-container").first();

  const clickMap = async (x, y) => {
    const box = await canvas.boundingBox();
    await page.touchscreen.tap(box.x + x, box.y + y);
  };

  const closePanel = async () => {
    const x = page.getByRole("button", { name: "Close panel" });
    if (await x.isVisible().catch(() => false)) await x.click();
    await page.waitForTimeout(500);
  };
  const addVia = async (x, y, label) => {
    await closePanel();
    await clickMap(x, y);
    try {
      await page.getByRole("button", { name: label }).first().waitFor({ timeout: 20000 });
    } catch {
      await page.screenshot({ path: `.rork/web-verification/debug-${label.replace(/\s+/g, "-")}.png` });
      const box2 = await canvas.boundingBox();
      await page.mouse.click(box2.x + x, box2.y + y);
      await page.getByRole("button", { name: label }).first().waitFor({ timeout: 20000 });
    }
    await page.getByRole("button", { name: label }).first().click();
    await page.waitForTimeout(2500);
  };

  // 1. Start point, then two stops (day panel auto-opens after the first stop)
  await addVia(195, 430, "Confirm");
  await addVia(150, 300, "Add as stop");
  await addVia(330, 200, "Add as stop");

  // Reopen the day sheet: open the days dock (if closed), tap a day chip (onSelect opens the sheet).
  await page.screenshot({ path: ".rork/web-verification/debug-state.png" });
  const labels = await page.evaluate(() => [...document.querySelectorAll("button,[role=button]")].filter((b) => b.checkVisibility()).map((b) => b.getAttribute("aria-label") || b.textContent?.trim()).filter(Boolean));
  console.log("visible buttons:", labels.slice(0, 30).join(" | "));
  const showDays = page.getByRole("button", { name: "Show days" });
  if (await showDays.isVisible().catch(() => false)) { await showDays.click(); await page.waitForTimeout(800); }
  await page.locator("div.glass-card .truncate").first().click();
  await page.waitForTimeout(800);

  const sheet = page.locator("div[class*='glass-panel']").filter({ has: page.getByRole("button", { name: "Close panel" }) }).first();
  const box = await sheet.boundingBox();
  if (!box) { fail("day sheet not found"); process.exit(1); }
  console.log(`sheet: top=${box.y.toFixed(0)} height=${box.height.toFixed(0)} viewport=844 -> map visible above: ${box.y > 120}`);
  const mapVisible = box.y > 120;
  const halfScreen = box.height >= 480 && box.height <= 530 && box.y >= 250 && box.y <= 340; // sheet = ~60dvh
  console.log(`sheet is ~60% of screen (height≈506): ${halfScreen}`);

  // 2b. Real photo or centered satellite in the day sheet cover.
  await page.waitForTimeout(2500); // let the Wikipedia lookup resolve
  const cover = sheet.locator("img").first();
  const src = await cover.getAttribute("src");
  const coverBox = await cover.boundingBox();
  const coverLoaded = await cover.evaluate((img) => img.complete && img.naturalWidth > 10).catch(() => false);
  console.log(`cover: loaded=${coverLoaded} src=${src?.slice(0, 90)}`);

  // 3. Swipe left -> next day
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => d.querySelector(':scope > [aria-label="Close panel"]'));
    if (!el) throw new Error("no sheet");
    const touch = (type, x, y) => {
      const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === "touchend" ? [] : [t], changedTouches: [t] }));
    };
    touch("touchstart", 320, 700);
    touch("touchend", 60, 700);
  });
  await page.waitForTimeout(800);
  const day2 = await sheet.textContent();
  const swiped = day2?.includes("Day 2");
  console.log(`after left-swipe: sheet shows Day 2: ${swiped}`);

  // 4. Swipe right -> back to day 1
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => d.querySelector(':scope > [aria-label="Close panel"]'));
    const touch = (type, x, y) => {
      const t = new Touch({ identifier: 2, target: el, clientX: x, clientY: y });
      el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === "touchend" ? [] : [t], changedTouches: [t] }));
    };
    touch("touchstart", 60, 700);
    touch("touchend", 320, 700);
  });
  await page.waitForTimeout(800);
  const back = await sheet.textContent();
  console.log(`after right-swipe: back on Day 1: ${back?.includes("Day 1")}`);

  // 5. Dock hidden while sheet open (mobile)
  const dockVisible = await page.locator('[aria-label^="Remove"], [aria-label^="Move day"]').first().isVisible().catch(() => false);
  console.log(`days dock hidden while sheet open: ${!dockVisible}`);

  if (!mapVisible || !swiped || !halfScreen || !coverLoaded) process.exitCode = 1;
  await page.screenshot({ path: ".rork/web-verification/day-sheet.png" });
} catch (e) {
  fail(e.message);
} finally {
  await browser.close();
}
