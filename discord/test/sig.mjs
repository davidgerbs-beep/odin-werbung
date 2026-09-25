import crypto from 'node:crypto';
import fs from 'node:fs';
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
fs.writeFileSync('/tmp/pk.hex', publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex'));
fs.writeFileSync('/tmp/sk.pem', privateKey.export({ format: 'pem', type: 'pkcs8' }));
