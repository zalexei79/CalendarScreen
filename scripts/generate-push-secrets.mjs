import { createECDH, randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';

const subject = process.argv[2];
if (!subject || !/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject)) throw new Error('Usage: node scripts/generate-push-secrets.mjs mailto:YOUR_EMAIL');
const path = '.env.push-secrets';
if (existsSync(path)) throw new Error('Secrets already exist. Do not rotate VAPID keys casually.');
const pair = createECDH('prime256v1');
pair.generateKeys();
writeFileSync(path, `VAPID_PUBLIC_KEY=${pair.getPublicKey().toString('base64url')}\nVAPID_PRIVATE_KEY=${pair.getPrivateKey().toString('base64url')}\nVAPID_SUBJECT=${subject}\nDAYRIS_CRON_SECRET=${randomBytes(32).toString('hex')}\n`, { mode: 0o600, flag: 'wx' });
console.log('Private values saved locally in .env.push-secrets. Do not share this file.');
console.log(`Frontend public value: VITE_VAPID_PUBLIC_KEY=${pair.getPublicKey().toString('base64url')}`);
