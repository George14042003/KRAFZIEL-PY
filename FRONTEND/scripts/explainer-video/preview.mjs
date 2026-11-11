import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto("file://" + path.join(__dirname, "slideshow.html"));
await page.waitForTimeout(200);

const times = [1.4, 3.2, 6.5, 12.5, 18.3, 24.5, 29.1, 33.5, 39.0];
for (const t of times) {
  await page.evaluate((t) => window.render(t), t);
  await page.screenshot({ path: path.join(__dirname, `preview-${t}.png`) });
}
await browser.close();
console.log("done");
