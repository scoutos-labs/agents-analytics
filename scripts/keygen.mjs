import crypto from 'crypto';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function sign(message) {
  return crypto.sign(null, Buffer.from(message, 'utf-8'), privateKey).toString('base64');
}

const timestamp = new Date().toISOString();
const label = 'my-agent';
const metadata = JSON.stringify({ env: 'dev' });
const payload = JSON.stringify({ publicKey, label, metadata: JSON.parse(metadata), timestamp });
const signature = sign(payload);

console.log('Public Key PEM:');
console.log(publicKey);
console.log('Private Key PEM:');
console.log(privateKey);
console.log('\nSample registration body:');
console.log(JSON.stringify({
  public_key: publicKey,
  label,
  metadata: JSON.parse(metadata),
  signature,
  timestamp,
}, null, 2));
