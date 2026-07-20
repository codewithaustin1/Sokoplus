/**
 * Pure TypeScript, zero-dependency, browser-native TOTP (Time-based One-Time Password) implementation.
 * Uses window.crypto.subtle for secure HMAC-SHA1 calculation.
 */

/**
 * Decodes a Base32 string to a Uint8Array.
 * Base32 alphabet: A-Z, 2-7.
 */
export function base32ToBuf(base32Str: string): Uint8Array {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleanStr = base32Str.toUpperCase().replace(/=+$/, "");
  const len = cleanStr.length;
  const buf = new Uint8Array(Math.floor((len * 5) / 8));
  
  let bits = 0;
  let val = 0;
  let index = 0;
  
  for (let i = 0; i < len; i++) {
    const c = cleanStr[i];
    const idx = base32chars.indexOf(c);
    if (idx === -1) continue;
    
    val = (val << 5) | idx;
    bits += 5;
    
    if (bits >= 8) {
      buf[index++] = (val >> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  
  return buf;
}

/**
 * Encodes a Uint8Array buffer to a Base32 string.
 */
export function bufToBase32(buf: Uint8Array): string {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += base32chars[(value >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += base32chars[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Computes the HMAC-SHA1 signature using browser Web Crypto APIs.
 */
async function hmacSha1(keyBuf: Uint8Array, messageBuf: Uint8Array): Promise<ArrayBuffer> {
  const key = await window.crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: { name: "SHA-1" } },
    false,
    ["sign"]
  );
  return await window.crypto.subtle.sign("HMAC", key, messageBuf);
}

/**
 * Generates a 16-character secure random Base32 TOTP secret.
 */
export function generateSecret(): string {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  let secret = "";
  for (let i = 0; i < 16; i++) {
    secret += base32chars[array[i] % 32];
  }
  return secret;
}

/**
 * Generates a 6-digit TOTP code for a given Base32 secret at a specified time (defaults to now).
 */
export async function generateTOTP(secret: string, time: number = Date.now()): Promise<string> {
  const keyBuf = base32ToBuf(secret);
  const counter = Math.floor(time / 1000 / 30);
  const counterBuf = new Uint8Array(8);
  
  // Convert counter to 8-byte big-endian integer
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBuf[i] = tmp & 0xff;
    tmp = tmp >> 8;
  }

  const hmacSig = await hmacSha1(keyBuf, counterBuf);
  const hmacBytes = new Uint8Array(hmacSig);
  
  // Dynamic truncation
  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
  const binary =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff);
  
  const otp = binary % 1000000;
  return otp.toString().padStart(6, "0");
}

/**
 * Verifies a 6-digit TOTP code against a Base32 secret with +/- 1 time step drift tolerance.
 */
export async function verifyTOTP(secret: string, code: string): Promise<boolean> {
  const cleanCode = code.trim();
  if (cleanCode.length !== 6 || isNaN(Number(cleanCode))) return false;
  
  const now = Date.now();
  // Check current, previous, and next time step for drift (standard Authenticator app behavior)
  for (let i = -1; i <= 1; i++) {
    const time = now + (i * 30000);
    const generated = await generateTOTP(secret, time);
    if (generated === cleanCode) {
      return true;
    }
  }
  return false;
}

/**
 * Formats a secure standard otpauth:// URL that can be encoded in a QR code.
 */
export function getOtpauthUrl(email: string, secret: string, issuer: string = "SokoPlus"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}
