// End-to-end check of the live site and public relays: an owner and a friend
// on two separate browsers must end up seeing each other.
import { chromium } from 'playwright';

const URL = process.argv[2];
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const browser = await chromium.launch();

async function person(name, geo) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, geolocation: geo, permissions: ['geolocation', 'clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() !== 'debug' && log(name, 'console', m.type(), m.text()));
  page.on('pageerror', (e) => log(name, 'pageerror', e.message));
  page.on('websocket', (ws) => {
    log(name, 'ws open', ws.url());
    ws.on('socketerror', (e) => log(name, 'ws error', ws.url(), e));
    ws.on('close', () => log(name, 'ws close', ws.url()));
  });
  return page;
}
const enter = async (p, name, url) => {
  await p.goto(url, { waitUntil: 'load' });
  await p.fill('#reader-name', name);
  await p.click('.intro button[type=submit]');
};
const panel = (p) => p.locator('.panel').innerText().catch(() => '(no panel)');

let ok = false;
const A = await person('owner', { longitude: 77.2195, latitude: 28.6315 });
const B = await person('friend', { longitude: 77.2295, latitude: 28.6129 });
try {
  await enter(A, 'Owner', URL);
  await A.click('[aria-label^="Your group"]');
  await A.click('text=Start a new group');
  await A.waitForSelector('text=Connected. Locations are end-to-end encrypted.', { timeout: 30_000 });
  log('owner connected');
  await A.click('text=Invite friends');
  const link = await A.evaluate(() => navigator.clipboard.readText());
  log('invite', link.replace(/#.*/, '#…'));

  await enter(B, 'Friend', link);
  await B.click('text=Ask to join');
  await B.waitForSelector('text=Your request has been sent.', { timeout: 30_000 });
  log('friend request sent');

  await A.waitForSelector('.request button:has-text("Approve")', { timeout: 60_000 });
  log('owner sees request');
  await A.click('.request button:has-text("Approve")');
  await B.waitForSelector('text=Connected. Locations are end-to-end encrypted.', { timeout: 60_000 });
  log('friend approved and connected');

  await Promise.all([
    A.waitForSelector('.members .member:has-text("Friend")', { timeout: 60_000 }).then(() => log('owner sees friend')),
    B.waitForSelector('.members .member:has-text("Owner")', { timeout: 60_000 }).then(() => log('friend sees owner')),
  ]);
  ok = true;
} catch (e) {
  log('FAILED', e.message.split('\n')[0]);
}
// The offline worker must not break the map: reload under it and see tiles arrive through it.
try {
  const C = await (await browser.newContext()).newPage();
  await C.goto(URL, { waitUntil: 'load' });
  await C.evaluate(() => navigator.serviceWorker.ready);
  let viaWorker = 0;
  C.on('response', (r) => r.url().includes('tiles.openfreemap.org') && r.status() === 200 && r.fromServiceWorker() && viaWorker++);
  await C.reload({ waitUntil: 'load' });
  await C.fill('#reader-name', 'Checker');
  await C.click('.intro button[type=submit]');
  await C.waitForTimeout(8000);
  log('tiles served through the worker:', viaWorker);
  if (!viaWorker) ok = false;
} catch (e) {
  log('worker check FAILED', e.message.split('\n')[0]);
  ok = false;
}
log('owner panel:\n' + (await panel(A)));
log('friend panel:\n' + (await panel(B)));
await browser.close();
process.exit(ok ? 0 : 1);
