import crypto from 'node:crypto';
import fs from 'node:fs';
const PORT = process.env.PORT || 8788;
const sk = crypto.createPrivateKey(fs.readFileSync('/tmp/sk.pem'));
async function send(obj, bad = false) {
  const body = JSON.stringify(obj);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.sign(null, Buffer.from(ts + body), sk).toString('hex');
  const r = await fetch(`http://127.0.0.1:${PORT}/`, { method: 'POST', headers: { 'X-Signature-Ed25519': bad ? '00'.repeat(64) : sig, 'X-Signature-Timestamp': ts, 'content-type': 'application/json' }, body });
  return r.status + ' ' + (await r.text()).slice(0, 900);
}
console.log(await send({ type: 1 }));
console.log(await send({ type: 1 }, true));
console.log(await send({ type: 2, locale: 'de', member: { user: { username: 'dave', global_name: 'Dave' } }, data: { name: 'roll', options: [{ name: 'white', value: 3 }, { name: 'coloured', value: 2 }, { name: 'difficulty', value: 2 }, { name: 'check', value: 'Heimlichkeit' }] } }));
console.log(await send({ type: 3, locale: 'en-US', user: { username: 'tim' }, data: { custom_id: 'n|0|0|1|0|0|Luck' } }));
console.log(await send({ type: 2, locale: 'de', user: { username: 'x' }, data: { name: 'odin' } }));
