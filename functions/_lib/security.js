// Shared response protection and bounded parsing; never trust Content-Length alone.
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Strict-Transport-Security': 'max-age=31536000',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

export class RequestError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}

export async function boundedRequest(request, limit) {
  if (Number(request.headers.get('Content-Length')) > limit) throw new RequestError('too_large', 413);
  if (!request.body) return request;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RequestError('too_large', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new Request(request.url, { method: request.method, headers: request.headers, body: new Blob(chunks) });
}

export const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export function requireFields(value, strings = [], arrays = [], objects = []) {
  if (!isObject(value) || strings.some(k => typeof value[k] !== 'string') ||
      arrays.some(k => !Array.isArray(value[k])) || objects.some(k => !isObject(value[k]))) {
    throw new RequestError('invalid_fields');
  }
}

// Signatures reject mislabeled files; they do not replace a full media decoder.
export function matchesFileType(buffer, type) {
  const b = new Uint8Array(buffer);
  const at = (offset, bytes) => bytes.every((v, i) => b[offset + i] === v);
  const text = (offset, value) => at(offset, [...value].map(c => c.charCodeAt(0)));
  if (type === 'image/jpeg') return at(0, [255, 216, 255]) && at(b.length - 2, [255, 217]);
  if (type === 'image/png') return at(0, [137, 80, 78, 71, 13, 10, 26, 10]) && text(12, 'IHDR') && b.length >= 33;
  if (type === 'image/gif') return b.length >= 13 && (text(0, 'GIF87a') || text(0, 'GIF89a'));
  if (type === 'image/webp') return b.length >= 20 && text(0, 'RIFF') && text(8, 'WEBP') && ['VP8 ', 'VP8L', 'VP8X'].some(v => text(12, v));
  if (type === 'application/pdf') return b.length >= 12 && text(0, '%PDF-') && new TextDecoder().decode(b.slice(-1024)).includes('%%EOF');
  if (type === 'image/avif' && b.length >= 16 && text(4, 'ftyp')) {
    const view = new DataView(buffer);
    const size = view.getUint32(0);
    if (size < 16 || size > b.length || size % 4) return false;
    for (let i = 8; i < size; i += 4) if (i !== 12 && (text(i, 'avif') || text(i, 'avis'))) return true;
  }
  return false;
}
