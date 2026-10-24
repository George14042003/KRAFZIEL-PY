import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const DURATION = 40.9; // slightly over the 40.777s narration; ffmpeg -shortest trims to audio
const TOTAL_FRAMES = Math.ceil(DURATION * FPS);
const FRAMES_DIR = path.join(__dirname, "frames");

if (!fs.existsSync(FRAMES_DIR)) fs.mkdirSync(FRAMES_DIR, { recursive: true });
for (const f of fs.readdirSync(FRAMES_DIR)) fs.unlinkSync(path.join(FRAMES_DIR, f));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto("file://" + path.join(__dirname, "slideshow.html"));
await page.waitForTimeout(200);

const start = Date.now();
for (let i = 0; i < TOTAL_FRAMES; i++) {
  const t = i / FPS;
  await page.evaluate((t) => window.render(t), t);
  const name = String(i + 1).padStart(5, "0");
  await page.screenshot({ path: path.join(FRAMES_DIR, `f${name}.jpg`), type: "jpeg", quality: 92 });
  if (i % 100 === 0) console.log(`frame ${i}/${TOTAL_FRAMES}`);
}
console.log(`Done in ${(Date.now() - start) / 1000}s, ${TOTAL_FRAMES} frames`);

await browser.close();
