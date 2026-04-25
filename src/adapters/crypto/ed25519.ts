import crypto from 'crypto';

/**
 * Convert a raw base64 Ed25519 public key (32 bytes) to a Node.js KeyObject via JWK.
 */
function rawPublicKeyToKeyObject(publicKeyBase64: string): crypto.KeyObject {
  const raw = Buffer.from(publicKeyBase64, 'base64');
  if (raw.length !== 32) {
    throw new Error(`Invalid Ed25519 public key length: ${raw.length} (expected 32)`);
  }
  const x = raw.toString('base64url');
  return crypto.createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x },
    format: 'jwk',
  });
}

export function generateKeypair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

export function verifyEd25519(
  message: Buffer | string,
  signatureBase64: string,
  publicKeyPemOrBase64: string
): boolean {
  try {
    let publicKey: crypto.KeyObject;
    if (publicKeyPemOrBase64.includes('-----BEGIN')) {
      publicKey = crypto.createPublicKey(publicKeyPemOrBase64);
    } else {
      publicKey = rawPublicKeyToKeyObject(publicKeyPemOrBase64);
    }
    const msg = typeof message === 'string' ? Buffer.from(message, 'utf-8') : message;
    return crypto.verify(null, msg, publicKey, Buffer.from(signatureBase64, 'base64'));
  } catch {
    return false;
  }
}

export function signEd25519(
  message: Buffer | string,
  privateKeyPem: string
): string {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const msg = typeof message === 'string' ? Buffer.from(message, 'utf-8') : message;
  return crypto.sign(null, msg, privateKey).toString('base64');
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function randomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
