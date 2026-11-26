const { chromium } = await import(process.env.RORK_PLAYWRIGHT_MODULE ?? "/usr/local/lib/node_modules/playwright/index.mjs");
const base = "https://uk3zldcwsxcglwotqxwj7-web.rork.live";
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 300)));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".leaflet-container", { timeout: 40000 });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Start planning" }).click();
  await page.waitForTimeout(400);

  const card = page.locator("div[aria-label^='Tutorial step']");
  console.log("step 1 visible:", await card.isVisible().catch(() => false));
  console.log("step 1 label:", await card.getAttribute("aria-label"));
  await page.screenshot({ path: ".rork/web-verification/tut-step1.png" });

  // Step 1: set start on the map.
  const box = await page.locator(".leaflet-container").first().boundingBox();
  await page.mouse.click(box.x + 500, box.y + 300);
  await page.getByRole("button", { name: "Confirm" }).first().waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Confirm" }).first().click();
  await page.waitForTimeout(1000);
  console.log("after start, step:", await card.getAttribute("aria-label").catch(() => "GONE"));

  // Step 2: add a stop.
  await page.mouse.click(box.x + 420, box.y + 220);
  await page.getByRole("button", { name: "Add as stop" }).first().waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Add as stop" }).first().click();
  await page.waitForTimeout(1000);
  console.log("after stop, step:", await card.getAttribute("aria-label").catch(() => "GONE"));

  // Step 3: save a place (quick hotel save from the day panel).
  await page.getByRole("button", { name: "Stay", exact: true }).first().waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: /Live hotel prices/ }).first().click();
  const saveBtn = page.getByRole("button", { name: /Save to Day \d/ });
  await saveBtn.waitFor({ timeout: 20000 });
  await saveBtn.click();
  const input = page.locator("input[placeholder*='Hotel name']:visible");
  await input.waitFor({ timeout: 5000 });
  await input.fill("Franz Josef Oasis");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Close live hotels" }).click();
  await page.waitForTimeout(600);
  console.log("after save, step:", await card.getAttribute("aria-label").catch(() => "GONE"));

  // Step 4: open the Trip costs pill.
  await page.getByRole("button", { name: /Trip costs ·/ }).first().click();
  await page.waitForTimeout(600);
  console.log("after pill, step:", await card.getAttribute("aria-label").catch(() => "GONE"));
  await page.screenshot({ path: ".rork/web-verification/tut-final.png" });

  // Finish via Done, confirm it never comes back, then replay via Help.
  await card.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(400);
  console.log("dismissed:", !(await card.isVisible().catch(() => false)));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".leaflet-container", { timeout: 40000 });
  await page.waitForTimeout(3500);
  console.log("after reload, tutorial stays away:", !(await page.locator("div[aria-label^='Tutorial step']").isVisible().catch(() => false)));

  // Replay from the Help button.
  await page.getByRole("button", { name: /Help — replay the tutorial/ }).click();
  await page.waitForTimeout(400);
  const card2 = page.locator("div[aria-label^='Tutorial step']");
  const replayed = await card2.getAttribute("aria-label").catch(() => "GONE");
  console.log("replayed step (resumes at first undone):", replayed);
  if (!/Tutorial step \d of 5/.test(replayed ?? "")) throw new Error("replay did not open a step card");
  await card2.getByRole("button", { name: "Skip tutorial" }).click();
  await page.waitForTimeout(300);
  console.log("skip works:", !(await card2.isVisible().catch(() => false)));
  await page.screenshot({ path: ".rork/web-verification/tut-done.png" });
  await page.close();

  // ---------- Mobile: tutorial card appears and skips ----------
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    await m.goto(base, { waitUntil: "domcontentloaded" });
    await m.waitForSelector(".leaflet-container", { timeout: 40000 });
    await m.waitForTimeout(3000);
    await m.getByRole("button", { name: "Start planning" }).click();
    await m.waitForTimeout(500);
    const mcard = m.locator("div[aria-label^='Tutorial step']");
    console.log("mobile step 1:", await mcard.getAttribute("aria-label").catch(() => "GONE"));
    await m.screenshot({ path: ".rork/web-verification/tut-mobile.png" });
    await mcard.getByRole("button", { name: "Skip tutorial" }).click();
    await m.waitForTimeout(300);
    console.log("mobile skip works:", !(await mcard.isVisible().catch(() => false)));
    await m.close();
  } catch (e) {
    await m.close();
    throw e;
  }

  console.log("TUTORIAL CHECK OK");
} catch (e) {
  console.log("FAIL:", e.message.slice(0, 400));
  process.exitCode = 1;
} finally {
  await browser.close();
}
