const { chromium } = await import(process.env.RORK_PLAYWRIGHT_MODULE ?? "/usr/local/lib/node_modules/playwright/index.mjs");
const base = "https://uk3zldcwsxcglwotqxwj7-web.rork.live";
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const email = `qa+${Date.now()}@gmail.com`;
  await page.goto(`${base}/auth`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /No account\? Create one/ }).click();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("TestPass123!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: /Have an account\? Sign in/ }).click();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("TestPass123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(`${base}/`, { timeout: 20000 });
  console.log("signed in:", email);
  // Build a trip; autosave should fire without pressing anything.
  await page.waitForSelector(".leaflet-container", { timeout: 40000 });
  await page.waitForTimeout(2500);
  const box = await page.locator(".leaflet-container").first().boundingBox();
  await page.mouse.click(box.x + 500, box.y + 300);
  await page.getByRole("button", { name: "Confirm" }).first().waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Confirm" }).first().click();
  await page.waitForTimeout(2500);
  await page.mouse.click(box.x + 420, box.y + 220);
  await page.getByRole("button", { name: "Add as stop" }).first().waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Add as stop" }).first().click();
  await page.waitForTimeout(500);
  const saving = page.locator("text=Saving…").first();
  const saved = page.locator("text=Saved").first();
  console.log("status shows Saving…:", await saving.isVisible({ timeout: 4000 }).catch(() => false));
  await saved.waitFor({ timeout: 15000 });
  console.log("status shows Saved:", await saved.isVisible());
  await page.waitForTimeout(1500);
  const url = page.url();
  console.log("url now:", url, "| has trip id:", url.includes("trip="));
  // Reload: continue where you left off.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".leaflet-container", { timeout: 40000 });
  await page.waitForTimeout(4000);
  console.log("status after reload:", await page.locator("text=Saved").first().isVisible().catch(() => false));
  await page.screenshot({ path: ".rork/web-verification/app-autosave.png" });
  console.log("SIGNED-IN CHECK OK");
} catch (e) {
  console.log("FAIL:", e.message.slice(0, 300));
  process.exitCode = 1;
} finally { await browser.close(); }
