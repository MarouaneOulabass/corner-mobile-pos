import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';

const ISSUER = 'Corner Mobile POS';
const ALGORITHM = 'SHA1';
const DIGITS = 6;
const PERIOD = 30;

// ─── TOTP Secret Generation ─────────────────────────────────────────────

export async function generateTOTPSecret(email: string): Promise<{
  secret: string;
  uri: string;
  qrCodeUrl: string;
}> {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: new OTPAuth.Secret({ size: 20 }),
  });

  const uri = totp.toString();
  const qrCodeUrl = await QRCode.toDataURL(uri);

  return {
    secret: totp.secret.base32,
    uri,
    qrCodeUrl,
  };
}

// ─── TOTP Verification ──────────────────────────────────────────────────

export function verifyTOTP(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // delta returns null if invalid, otherwise the step difference
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

// ─── Recovery Codes ─────────────────────────────────────────────────────

export function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    codes.push(hex);
  }
  return codes;
}

export function verifyRecoveryCode(
  codes: string[],
  code: string
): { valid: boolean; remaining: string[] } {
  const normalised = code.toLowerCase().trim();
  const index = codes.findIndex((c) => c.toLowerCase() === normalised);
  if (index === -1) {
    return { valid: false, remaining: codes };
  }
  const remaining = [...codes.slice(0, index), ...codes.slice(index + 1)];
  return { valid: true, remaining };
}

// ─── Secret Encryption (AES-256-GCM via Web Crypto) ─────────────────────

function getEncryptionKey(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('NEXTAUTH_SECRET must be set and at least 32 characters');
  }
  // Use first 32 bytes of the secret as key material
  return new TextEncoder().encode(secret.slice(0, 32));
}

async function importKey(): Promise<CryptoKey> {
  const rawKey = getEncryptionKey();
  return crypto.subtle.importKey('raw', rawKey.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  // Format: base64(iv + ciphertext)
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(Array.from(combined, (b) => String.fromCharCode(b)).join(''));
}

export async function decryptSecret(encrypted: string): Promise<string> {
  const key = await importKey();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
