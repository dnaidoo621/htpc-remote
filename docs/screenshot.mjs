// Regenerate the README screenshots.
//
// Drives the system Chrome with iPhone emulation (390×844 at 2×) against a
// running Glide server, so the layout matches the phone rather than a desktop
// window. Needs Node and a one-off `npm i playwright-core` beside this file
// (or anywhere on NODE_PATH); no browser download — it uses the Chrome you
// already have.
//
//   node docs/screenshot.mjs http://127.0.0.1:8765
//
// The TV scenes need a configured device on that server; the PC scenes don't.
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] || 'http://127.0.0.1:8765';
const out  = dirname(fileURLToPath(import.meta.url));   // docs/

const SCENES = [
  ['screen-phone-controller', 'screenshots.html?scene=controller&tab=pad'],
  ['screen-phone-media',      'screenshots.html?scene=controller&tab=media'],
  ['screen-phone-nav',        'screenshots.html?scene=controller&tab=nav'],
  ['screen-phone-apps',       'screenshots.html?scene=controller&tab=apps'],
  ['screen-phone-tv',         'screenshots.html?scene=controller&device=tv&tab=nav'],
  ['screen-phone-tv-media',   'screenshots.html?scene=controller&device=tv&tab=media'],
  ['screen-phone-tv-power',   'screenshots.html?scene=controller&device=tv&tab=power'],
  ['screen-phone-connect',    'screenshots.html?scene=connect'],
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'dark',
});
await mkdir(out, { recursive: true });

for (const [name, path] of SCENES) {
  const page = await ctx.newPage();
  await page.goto(`${base}/${path}`, { waitUntil: 'load' });
  // Give the WebSocket time to connect and deliver the device list.
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log(`  ${name}.png`);
  await page.close();
}
await browser.close();
