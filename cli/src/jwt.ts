import crypto from 'node:crypto';

function base64urlEncode(data: Buffer): string {
  return data.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function createToken(secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + 300,
    jti: crypto.randomUUID(),
  };

  const encodedHeader = base64urlEncode(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64urlEncode(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest();
  const encodedSignature = base64urlEncode(signature);

  return `${signingInput}.${encodedSignature}`;
}
