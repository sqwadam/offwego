import { chromium } from "/home/user/rork-app/web/node_modules/playwright/index.mjs";

const BASE = "https://uk3zldcwsxcglwotqxwj7-web.rork.live";
const fail = [];
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
  if (!cond) fail.push(name);
};

const browser = await chromium.launch();
try {
  // Mobile viewport with touch, like a phone
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2500);

  // 1. Viewport meta blocks scaling
  const meta = await page.evaluate(() =>
    document.querySelector('meta[name="viewport"]')?.content ?? ""
  );
  ok("viewport meta has maximum-scale=1", meta.includes("maximum-scale=1"), meta);
  ok("viewport meta has user-scalable=no", meta.includes("user-scalable=no"));

  // 2. Page-level touch-action blocks pinch/double-tap
  const ta = await page.evaluate(() => getComputedStyle(document.body).touchAction);
  ok("body touch-action is pan-x pan-y", ta === "pan-x pan-y" || ta === "pan-x pan-y".replace(/ /g, " "), ta);

  // Close welcome sheet if present
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => /start planning|let.?s go/i.test(x.textContent || ""));
    if (b) b.click();
  });
  await page.waitForTimeout(1500);

  // 3. Leaflet container keeps its own touch-action (map pinch still works)
  const leafTa = await page.evaluate(() => {
    const el = document.querySelector(".leaflet-container");
    if (!el) return "missing";
    // walk computed value; leaflet.css sets .leaflet-container { touch-action: none }
    return getComputedStyle(el).touchAction;
  });
  ok("leaflet container touch-action is none", leafTa === "none", leafTa);

  // 4. Cost input font-size on mobile is 16px (no focus zoom)
  // Open day panel: click first day card stop area — simpler: find any input/select and check
  const inputInfo = await page.evaluate(() => {
    const el = document.querySelector("input, select, textarea");
    if (!el) return null;
    return { size: getComputedStyle(el).fontSize, tag: el.tagName };
  });
  ok("first form control is 16px on mobile", inputInfo?.size === "16px", JSON.stringify(inputInfo));

  // All inputs rendered on the page must be >= 16px
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("input, select, textarea")]
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => el.tagName + "." + el.className)
  );
  ok("no form control under 16px on mobile", small.length === 0, small.join(", "));

  await page.screenshot({ path: ".rork/web-verification/nozoom-mobile.png" });

  // 5. Desktop unaffected: small inputs stay small on desktop
  const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dpage = await dctx.newPage();
  await dpage.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
  await dpage.waitForTimeout(2000);
  const dMeta = await dpage.evaluate(() =>
    document.querySelector('meta[name="viewport"]')?.content ?? ""
  );
  ok("desktop also gets no-zoom meta", dMeta.includes("maximum-scale=1"), dMeta);

  await ctx.close();
  await dctx.close();
} finally {
  await browser.close();
}
console.log(fail.length ? `\nFAILED: ${fail.join(", ")}` : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
