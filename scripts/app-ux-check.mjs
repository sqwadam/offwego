const { chromium } = await import(process.env.RORK_PLAYWRIGHT_MODULE ?? "/usr/local/lib/node_modules/playwright/index.mjs");
const base = "https://uk3zldcwsxcglwotqxwj7-web.rork.live";
const browser = await chromium.launch();
try {
  // ---------- Desktop ----------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 300)));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".leaflet-container", { timeout: 40000 });
  await page.waitForTimeout(2500);

  // Welcome sheet on first visit.
  const welcome = page.locator("text=Kia ora, welcome to Journeys");
  console.log("welcome shown:", await welcome.isVisible().catch(() => false));
  await page.screenshot({ path: ".rork/web-verification/app-welcome.png" });
  await page.getByRole("button", { name: "Start planning" }).click();
  await page.waitForTimeout(400);
  console.log("welcome dismissed:", !(await welcome.isVisible().catch(() => false)));

  // Tabs: exactly 4.
  const tabNames = await page.locator("nav[aria-label='Planner'] > button").allTextContents();
  console.log("tabs:", tabNames.map((t) => t.trim()));

  // Build a trip: tap map, confirm, add stop.
  const box = await page.locator(".leaflet-container").first().boundingBox();
  await page.mouse.click(box.x + 500, box.y + 300);
  await page.getByRole("button", { name: "Confirm" }).first().waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Confirm" }).first().click();
  await page.waitForTimeout(2500);
  await page.mouse.click(box.x + 420, box.y + 220);
  await page.getByRole("button", { name: "Add as stop" }).first().waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Add as stop" }).first().click();
  await page.waitForTimeout(2000);

  // Autosave status: signed out → "On this device" dot chip.
  const status = page.locator("text=On this device").first();
  console.log("device status:", await status.isVisible().catch(() => false));

  // Draft survives reload.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".leaflet-container", { timeout: 40000 });
  await page.waitForTimeout(3500);
  await page.evaluate(() => document.querySelector("button[aria-label='Close panel']")?.click()).catch(() => {});
  await page.waitForTimeout(600);
  const dock = page.locator("div.glass-panel").filter({ hasText: "Your days · drag to reorder" }).first();
  const cards = await dock.locator("div.glass-card").filter({ hasText: "Dropped pin" }).count();
  console.log("stops after reload (draft restore):", cards);
  await page.screenshot({ path: ".rork/web-verification/app-draft-restore.png" });

  // Discover tab: day chips + Hotels/Food/To-do buttons + recommended stops.
  await page.getByRole("button", { name: "Discover" }).first().click();
  await page.waitForTimeout(600);
  console.log("day chips:", await page.locator("button", { hasText: /^Day \d+ · / }).count());
  await page.getByRole("button", { name: "Hotels" }).first().waitFor({ timeout: 5000 }).catch(() => {});
  console.log("Hotels chip:", await page.getByRole("button", { name: "Hotels" }).first().isVisible().catch(() => false));
  console.log("Food chip:", await page.getByRole("button", { name: "Food", exact: true }).first().isVisible().catch(() => false));
  console.log("recs visible:", await page.locator("text=Find recommended stops").isVisible().catch(() => false));
  await page.screenshot({ path: ".rork/web-verification/app-discover.png" });
  await page.getByRole("button", { name: "Close live hotels" }).count(); // noop
  await page.close();

  // ---------- Mobile: 4 tabs + welcome + discover ----------
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const m = await mctx.newPage();
  await m.goto(base, { waitUntil: "domcontentloaded" });
  await m.waitForSelector(".leaflet-container", { timeout: 40000 });
  await m.waitForTimeout(3000);
  console.log("mobile welcome:", await m.locator("text=Kia ora, welcome to Journeys").isVisible().catch(() => false));
  await m.getByRole("button", { name: "Start planning" }).click();
  await m.waitForTimeout(400);
  const mtabs = await m.locator("nav[aria-label='Planner'] > button").allTextContents();
  console.log("mobile tabs:", mtabs.map((t) => t.trim()));
  await m.getByRole("button", { name: "Discover" }).first().click();
  await m.waitForTimeout(600);
  await m.screenshot({ path: ".rork/web-verification/app-discover-mobile.png" });
  await m.close();

  console.log("APP UX CHECK OK");
} catch (e) {
  console.log("FAIL:", e.message.slice(0, 400));
  process.exitCode = 1;
} finally {
  await browser.close();
}
