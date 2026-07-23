import { createServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, toNodeListener, type EventHandler } from 'h3';

export interface CallResult {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export interface CallOptions {
  method?: string;
  path?: string;
  cookie?: string;
  body?: unknown;
}

/**
 * Run one request through a real h3 app built from `handlers`, driven by a raw
 * node http client. Using a real server (not a mocked H3Event) exercises the
 * genuine getCookie/setCookie/readBody/sendRedirect pipeline; the node client
 * keeps `globalThis.fetch` free for tests that stub the middleware's renew call.
 */
export async function call(handlers: EventHandler[], opts: CallOptions = {}): Promise<CallResult> {
  const app = createApp();
  for (const handler of handlers) app.use(handler);
  const server = createServer(toNodeListener(app));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  const payload = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;

  try {
    return await new Promise<CallResult>((resolve, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port,
          path: opts.path ?? '/',
          method: opts.method ?? 'GET',
          headers: {
            ...(opts.cookie ? { cookie: opts.cookie } : {}),
            ...(payload
              ? { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(payload)) }
              : {}),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data }));
        }
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  } finally {
    server.close();
  }
}

/** The response Set-Cookie header(s) joined into one string for matching. */
export function setCookieHeader(res: CallResult): string {
  const h = res.headers['set-cookie'];
  return Array.isArray(h) ? h.join('; ') : h ?? '';
}
