/**
 * A tiny end to end harness. No framework: it drives the real HTTP API of a
 * running server, holding cookies the way a browser does, so what it proves is
 * what a real user gets.
 */

export const BASE = process.env.TEST_BASE ?? 'http://127.0.0.1:3000';

let passed = 0;
let failed = 0;
const failures: string[] = [];
let group = '';

export function section(name: string) {
  group = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

export function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32mPASS\x1b[0m  ${label}`);
  } else {
    failed++;
    failures.push(`${group} :: ${label}${detail !== undefined ? `\n        ${JSON.stringify(detail).slice(0, 400)}` : ''}`);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${label}`);
    if (detail !== undefined) console.log(`        ${JSON.stringify(detail).slice(0, 400)}`);
  }
}

export function summary(): number {
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  return failed === 0 ? 0 : 1;
}

/** A cookie jar, so a session survives across calls like it does in a browser. */
export class Client {
  private jar = new Map<string, string>();

  constructor(public name = 'client') {}

  get cookieHeader() {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private absorb(res: Response) {
    const raw = res.headers.getSetCookie?.() ?? [];
    for (const line of raw) {
      const [pair] = line.split(';');
      const idx = pair.indexOf('=');
      if (idx < 0) continue;
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (v === '') this.jar.delete(k);
      else this.jar.set(k, v);
    }
  }

  async raw(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      redirect: 'manual',
      headers: {
        'user-agent': 'nfcy-e2e/1.0 TestRunner',
        ...(this.jar.size ? { cookie: this.cookieHeader } : {}),
        ...(init.headers ?? {}),
      },
    });
    this.absorb(res);
    return res;
  }

  async json<T = unknown>(
    path: string,
    init: (RequestInit & { json?: unknown }) = {},
  ): Promise<{ status: number; ok: boolean; data: T; error?: { message: string; code?: string; fields?: Record<string, string> } }> {
    const { json, ...rest } = init;
    const res = await this.raw(path, {
      ...rest,
      method: rest.method ?? (json !== undefined ? 'POST' : 'GET'),
      headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });

    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text.slice(0, 300) };
    }

    return {
      status: res.status,
      ok: Boolean(body.ok),
      data: (body.data ?? body) as T,
      error: body.error as { message: string; code?: string } | undefined,
    };
  }

  async text(path: string, init: RequestInit = {}): Promise<{ status: number; body: string; headers: Headers }> {
    const res = await this.raw(path, init);
    return { status: res.status, body: await res.text(), headers: res.headers };
  }

  /** A multipart upload, the way the browser sends one. */
  async form<T = unknown>(
    path: string,
    body: FormData,
  ): Promise<{ status: number; ok: boolean; data: T; error?: { message: string; code?: string } }> {
    // no content-type header: fetch sets the multipart boundary itself
    const res = await this.raw(path, { method: 'POST', body });
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text.slice(0, 300) };
    }
    return {
      status: res.status,
      ok: Boolean(parsed.ok),
      data: (parsed.data ?? parsed) as T,
      error: parsed.error as { message: string; code?: string } | undefined,
    };
  }
}

/**
 * A stranger following a link, with no session and no cookies: the redirect is
 * returned rather than followed, so what it points at can be checked.
 */
export async function anonOpen(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    redirect: 'manual',
    headers: { 'user-agent': 'Mozilla/5.0 (iPhone) AppleWebKit/605.1 Mobile Safari/604.1' },
  });
}

export const uniq = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
