// auth.ts
import crypto from 'crypto';

export function generateSigna(appId: string, secretKey: string, ts: number): string {
    const baseString = appId + ts;
    const md5Hash = crypto.createHash('md5').update(baseString).digest('hex');
    const hmac = crypto.createHmac('sha1', secretKey).update(md5Hash).digest('base64');
    return hmac
}
