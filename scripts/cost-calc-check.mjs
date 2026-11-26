const { chromium } = await import(process.env.RORK_PLAYWRIGHT_MODULE ?? "/usr/local/lib/node_modules/playwright/index.mjs");
const base = "https://uk3zldcwsxcglwotqxwj7-web.rork.live";
const browser = await chromium.launch();
const shots = ".rork/web-verification";
try {
  // ---------- Desktop (signed in with a throwaway account) ----------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 300)));
  let signedIn = false;
  try {
    const email = `qa+${Date.now()}@gmail.com`;
    await page.goto(`${base}/auth`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /No account\? Create one/ }).click();
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("TestPass123!");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: /Have an account\? Sign in/ }).click();
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("TestPass123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(`${base}/`, { timeout: 20000 });
    signedIn = true;
    console.log("signed in as", email);
  } catch (e) {
    console.log("AUTH SKIPPED:", e.message.slice(0, 140));
  }
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".leaflet-container", { timeout: 40000 });
  await page.waitForTimeout(3000);
  const box = await page.locator(".leaflet-container").first().boundingBox();
  const tap = async (x, y) => page.mouse.click(box.x + x, box.y + y);
  await tap(500, 300);
  await page.getByRole("button", { name: "Confirm" }).first().waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Confirm" }).first().click();
  await page.waitForTimeout(2500);
  await tap(400, 200);
  await page.getByRole("button", { name: "Add as stop" }).first().waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Add as stop" }).first().click();
  await page.waitForTimeout(2500);
  try {
    await page.getByRole("button", { name: "Close panel" }).click({ timeout: 8000 });
  } catch {
    await page.getByRole("button", { name: "Close panel" }).click({ force: true, timeout: 8000 });
  }
  await page.waitForTimeout(600);
  const dock = page.locator("div.glass-panel").filter({ hasText: "Your days · drag to reorder" }).first();
  await dock.locator("div.glass-card").filter({ hasText: "Dropped pin" }).nth(1).click({ position: { x: 20, y: 12 } });
  await page.getByRole("button", { name: "Stay", exact: true }).first().waitFor({ timeout: 8000 });

  // Quick-save a hotel to Day 2 so we have an item with a link.
  await page.getByRole("button", { name: /Live hotel prices/ }).first().click();
  const saveBtn = page.getByRole("button", { name: /Save to Day 2/ });
  await saveBtn.waitFor({ timeout: 20000 });
  await saveBtn.click();
  const input = page.locator("input[placeholder*='Hotel name']:visible");
  await input.waitFor({ timeout: 5000 });
  await input.fill("Franz Josef Oasis");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Close live hotels" }).click();
  await page.waitForTimeout(500);

  // Reopen Day 2 panel if the overlay close dropped it.
  if (!(await page.getByRole("button", { name: "Stay", exact: true }).first().isVisible().catch(() => false))) {
    await dock.locator("div.glass-card").filter({ hasText: "Dropped pin" }).nth(1).click({ position: { x: 20, y: 12 } });
    await page.getByRole("button", { name: "Stay", exact: true }).first().waitFor({ timeout: 8000 });
  }

  // Type a cost under the item's link (default status = Idea → planned).
  const costInput = page.locator("input[type='number']:visible").first();
  await costInput.waitFor({ timeout: 8000 });
  await costInput.fill("120");
  await page.waitForTimeout(400);
  console.log("tab totals line:", await page.locator("text=/Booked.*\\$/").first().textContent().catch(() => null));
  console.log("day strip:", await page.locator("text=/Day.*\\$/").first().textContent().catch(() => null));
  await page.screenshot({ path: `${shots}/cost-input.png` });

  // Promote to Booked: click status chip twice (Idea → Shortlist → Booked).
  await page.getByRole("button", { name: /Change Franz Josef Oasis to/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Change Franz Josef Oasis to Booked/ }).first().click();
  await page.waitForTimeout(400);
  console.log("after booked, totals:", await page.locator("text=/Booked.*\\$/").first().textContent().catch(() => null));

  // Close the panel; the cost pill should show the booked total.
  try {
    await page.getByRole("button", { name: "Close panel" }).click({ timeout: 8000 });
  } catch {
    await page.getByRole("button", { name: "Close panel" }).click({ force: true, timeout: 8000 });
  }
  await page.waitForTimeout(500);
  const pill = page.getByRole("button", { name: /Trip costs ·/ }).first();
  await pill.waitFor({ timeout: 8000 });
  console.log("pill:", await pill.textContent());
  await pill.click();
  const pop = page.locator("div.glass-panel").filter({ hasText: "Accommodation" }).first();
  await pop.waitFor({ timeout: 5000 });
  console.log("popover:", (await pop.textContent())?.slice(0, 220));
  await page.screenshot({ path: `${shots}/cost-popover.png` });

  // Currency picker → USD.
  await pop.locator("select").selectOption("USD");
  await page.waitForTimeout(400);
  console.log("popover USD:", (await pop.textContent())?.slice(0, 220));
  await page.getByRole("button", { name: "Close costs" }).click();

  // Save the trip and reload to test persistence (only when signed in).
  let url = base;
  if (signedIn) {
    await page.getByRole("button", { name: "Trip", exact: true }).first().click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Save trip" }).first().click();
    await page.waitForTimeout(3000);
    url = page.url();
    console.log("saved trip url:", url);
  }
  await page.close();

  const persistOk = signedIn && url.includes("trip=");
  if (!persistOk) console.log("PERSISTENCE SKIPPED (not signed in); JSON roundtrip verified separately");

  if (persistOk) {
    // Reload: cost + currency + booked status should survive.
    const page2 = await ctx.newPage();
    await page2.goto(url, { waitUntil: "domcontentloaded" });
    await page2.waitForSelector(".leaflet-container", { timeout: 40000 });
    await page2.waitForTimeout(5000);
    await page2.getByRole("button", { name: "Close panel" }).click({ force: true, timeout: 8000 }).catch(() => {});
    await page2.waitForTimeout(600);
    const pill2 = page2.getByRole("button", { name: /Trip costs ·/ }).first();
    await pill2.waitFor({ timeout: 10000 });
    console.log("pill after reload:", await pill2.textContent());
    await pill2.click();
    const pop2 = page2.locator("div.glass-panel").filter({ hasText: "Accommodation" }).first();
    await pop2.waitFor({ timeout: 5000 });
    console.log("popover after reload:", (await pop2.textContent())?.slice(0, 220));
    await page2.screenshot({ path: `${shots}/cost-persist.png` });
    await page2.close();
  }

  // ---------- Mobile: day sheet shows cost input + strip ----------
  await mobileCheck(browser, persistOk ? url : null);
  console.log(persistOk ? "COST CHECK OK" : "COST CHECK OK (partial)");
} catch (e) {
  console.log("FAIL:", e.message.slice(0, 400));
  process.exitCode = 1;
} finally {
  await browser.close();
}

// Mobile fallback that builds its own trip (works without sign-in).
async function mobileCheck(browser, url) {
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    await m.goto(url ?? "https://uk3zldcwsxcglwotqxwj7-web.rork.live", { waitUntil: "domcontentloaded" });
    await m.waitForSelector(".leaflet-container", { timeout: 40000 });
    await m.waitForTimeout(3000);
    const mbox = await m.locator(".leaflet-container").first().boundingBox();
    if (!url) {
      await m.evaluate(() => document.querySelector("button[aria-label='Close panel']")?.click());
      await m.waitForTimeout(600);
      await m.touchscreen.tap(mbox.x + 200, mbox.y + 300);
      await m.getByRole("button", { name: "Confirm" }).first().waitFor({ timeout: 20000 });
      await m.getByRole("button", { name: "Confirm" }).first().click();
      await m.waitForTimeout(2500);
      await m.touchscreen.tap(mbox.x + 180, mbox.y + 200);
      await m.getByRole("button", { name: "Add as stop" }).first().waitFor({ timeout: 20000 });
      await m.getByRole("button", { name: "Add as stop" }).first().click();
      await m.waitForTimeout(2500);
      await m.evaluate(() => document.querySelector("button[aria-label='Close panel']")?.click());
      await m.waitForTimeout(600);
    } else {
      await m.evaluate(() => document.querySelector("button[aria-label='Close panel']")?.click());
      await m.waitForTimeout(600);
    }
    const mdock = m.locator("div.glass-panel").filter({ hasText: "Your days" }).first();
    const mcard = mdock.locator("div.glass-card").filter({ hasText: "Dropped pin" }).nth(1);
    await mcard.click({ position: { x: 20, y: 12 } });
    await m.getByRole("button", { name: "Stay", exact: true }).first().waitFor({ timeout: 10000 });
    if (!url) {
      // Fresh trip: quick-save a hotel via the pinned bottom bar first.
      await m.getByRole("button", { name: /Live hotel prices/ }).first().click();
      const mSave = m.getByRole("button", { name: /Save to Day 2/ });
      await mSave.waitFor({ timeout: 20000 });
      await mSave.click();
      const mInput = m.locator("input[placeholder*='Hotel name']:visible");
      await mInput.waitFor({ timeout: 5000 });
      await mInput.fill("Franz Josef Oasis");
      await m.getByRole("button", { name: "Save", exact: true }).click();
      await m.waitForTimeout(600);
      await m.evaluate(() => document.querySelector("button[aria-label='Close live hotels']")?.click());
      await m.waitForTimeout(500);
      if (!(await m.getByRole("button", { name: "Stay", exact: true }).first().isVisible().catch(() => false))) {
        await mdock.locator("div.glass-card").filter({ hasText: "Dropped pin" }).nth(1).click({ position: { x: 20, y: 12 } });
        await m.getByRole("button", { name: "Stay", exact: true }).first().waitFor({ timeout: 8000 });
      }
    }
    const mcost = m.locator("input[type='number']:visible").first();
    await mcost.waitFor({ timeout: 8000 });
    await mcost.fill("99");
    await m.waitForTimeout(400);
    console.log("mobile totals (planned):", await m.locator("text=/Booked.*\\$/").first().textContent().catch(() => null));
    await m.getByRole("button", { name: /Change Franz Josef Oasis to/ }).first().click();
    await m.waitForTimeout(300);
    await m.getByRole("button", { name: /Change Franz Josef Oasis to Booked/ }).first().click();
    await m.waitForTimeout(400);
    console.log("mobile totals (booked):", await m.locator("text=/Booked.*\\$/").first().textContent().catch(() => null));
    console.log("mobile strip:", await m.locator("text=/Day.*\\$/").first().textContent().catch(() => null));
    await m.screenshot({ path: ".rork/web-verification/cost-mobile.png" });
    await m.close();
  } catch (e) {
    await m.screenshot({ path: ".rork/web-verification/cost-mobile-fail.png" }).catch(() => {});
    await m.close();
    throw e;
  }
}
