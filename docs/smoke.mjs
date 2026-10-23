// Smoke test of the running app: signs in, opens every page of the menu (and the first receipt's pages) and fails when one is blank,
// shows "Something went wrong", answers an error, or has no content.   BASE=http://localhost:3000 NAME=jpsadmin1 CODE=4888 node docs/smoke.mjs
// Needs playwright-core and a Chromium (PLAYWRIGHT_BROWSERS_PATH or CHROMIUM=/path/to/chromium).
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3000", NAME = process.env.NAME ?? "jpsadmin1", CODE = process.env.CODE ?? "4888";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
await page.goto(`${BASE}/login`); await page.fill("input[name=name]", NAME); await page.fill("input[name=code]", CODE);
await page.click("button[type=submit]"); await page.waitForURL(`${BASE}/`);
const links = new Set(["/"]);
for (const href of await page.locator("a[href^='/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")))) if (href && !/\.(pdf|csv)$|\/pdf$|\/export$|logout/.test(href)) links.add(href.split("#")[0]);
// the section hubs list their pages too
for (const hub of [...links].filter((l) => l.startsWith("/menu/"))) { await page.goto(BASE + hub); for (const href of await page.locator("a[href^='/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")))) if (href && !/\.(pdf|csv)$|\/pdf$|\/export$|logout/.test(href)) links.add(href.split("#")[0]); }
const first = await page.goto(`${BASE}/warehouse/receipts`).then(() => page.locator("a[href^='/warehouse/receipts/']").first().getAttribute("href")).catch(() => null);
if (first) for (const s of ["", "/report", "/labels"]) links.add(first.replace(/\/(report|labels)$/, "") + s);
let bad = 0;
for (const href of links) {
  const r = await page.goto(BASE + href, { waitUntil: "load" }).catch((e) => ({ status: () => 0, err: e }));
  await page.waitForTimeout(400);
  const body = await page.locator("body").innerText().catch(() => ""), main = await page.locator("main").count();
  const problem = r.status() >= 400 ? `HTTP ${r.status()}` : !main ? "no <main> (blank page)" : /Something went wrong|Application error/.test(body) ? "error page" : body.trim().length < 60 ? "almost empty" : "";
  if (problem) { bad++; console.log("FAIL", href, problem); }
}
console.log(`smoke: ${links.size} pages, ${bad} problem(s)`);
await browser.close(); process.exit(bad ? 1 : 0);
