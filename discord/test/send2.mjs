import crypto from 'node:crypto';
import fs from 'node:fs';
const PORT = process.env.PORT || 8788;
const sk = crypto.createPrivateKey(fs.readFileSync('/tmp/sk.pem'));
async function send(obj) {
  const body = JSON.stringify(obj);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.sign(null, Buffer.from(ts + body), sk).toString('hex');
  const r = await fetch(`http://127.0.0.1:${PORT}/`, { method: 'POST', headers: { 'X-Signature-Ed25519': sig, 'X-Signature-Timestamp': ts, 'content-type': 'application/json' }, body });
  return r.status + ' ' + (await r.text()).slice(0, 1200);
}
const u = { user: { username: 'dave', global_name: 'Dave' } };
console.log(await send({ type: 4, locale: 'de', member: u, data: { name: 'table', options: [{ name: 'name', value: 'artef', focused: true }] } }));
console.log(await send({ type: 4, locale: 'en-US', member: u, data: { name: 'threat', options: [{ name: 'name', value: 'hybrid', focused: true }] } }));
console.log(await send({ type: 4, locale: 'de', member: u, data: { name: 'rule', options: [{ name: 'topic', value: '', focused: true }] } }));
console.log(await send({ type: 2, locale: 'de', member: u, data: { name: 'table', options: [{ name: 'name', value: '0' }] } }));
console.log(await send({ type: 2, locale: 'de', member: u, data: { name: 'table', options: [{ name: 'name', value: 'Artefakt: Wirkung' }] } }));
console.log(await send({ type: 2, locale: 'de', member: u, data: { name: 'threat', options: [{ name: 'name', value: 'Hybridhunde' }] } }));
console.log(await send({ type: 2, locale: 'de', member: u, data: { name: 'rule', options: [{ name: 'topic', value: 'Schwierigkeiten' }, { name: 'show', value: true }] } }));
console.log(await send({ type: 3, locale: 'de', member: u, data: { custom_id: 'v|3|3|0|0|0|Biss (Schaden 3)' } }));
console.log(await send({ type: 3, locale: 'de', member: u, data: { custom_id: 't|de|5|0' } }));
console.log(await send({ type: 2, locale: 'de', member: u, data: { name: 'table', options: [{ name: 'name', value: 'gibtsnicht' }] } }));
