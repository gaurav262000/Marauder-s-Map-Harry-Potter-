// Which public MQTT relays accept a browser-style WebSocket connection and keep retained messages?
import mqtt from 'mqtt';

const URLS = process.argv.slice(2);
const topic = `enchanted-atlas/probe/${Math.random().toString(36).slice(2)}`;
const once = (c, ev) => new Promise((ok, fail) => { if (ev === 'connect' && c.connected) return ok(); c.once(ev, ok); c.once('error', fail); });
const timeout = (ms) => new Promise((_, fail) => setTimeout(() => fail(new Error(`timeout ${ms}ms`)), ms));

for (const url of URLS) {
  const t = Date.now();
  const a = mqtt.connect(url, { connectTimeout: 10_000, reconnectPeriod: 0 });
  const b = mqtt.connect(url, { connectTimeout: 10_000, reconnectPeriod: 0 });
  try {
    await Promise.race([once(a, 'connect'), timeout(12_000)]);
    const connectMs = Date.now() - t;
    await new Promise((ok, fail) => a.publish(topic, 'hello', { retain: true, qos: 1 }, (e) => (e ? fail(e) : ok())));
    await Promise.race([once(b, 'connect'), timeout(12_000)]);
    b.subscribe(topic);
    await Promise.race([new Promise((ok) => b.on('message', (_, m) => m.toString() === 'hello' && ok())), timeout(8_000)]);
    a.publish(topic, '', { retain: true, qos: 1 });
    console.log(`OK   ${url}  connect ${connectMs} ms, retained round trip ${Date.now() - t} ms`);
  } catch (e) {
    console.log(`FAIL ${url}  ${e.message}`);
  }
  a.end(true);
  b.end(true);
}
process.exit(0);
