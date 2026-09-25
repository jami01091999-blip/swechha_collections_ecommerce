import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { XRW, startTestApp } from './helpers.js';

let ctx;
let app;

beforeAll(async () => {
  ctx = await startTestApp();
  app = ctx.app;
});
afterAll(() => ctx?.stop());
beforeEach(async () => {
  await Promise.all([ctx.User.deleteMany({}), ctx.OtpCode.deleteMany({}), ctx.Session.deleteMany({})]);
  ctx.testOutbox.length = 0;
});

const post = (path, body, headers = XRW) => request(app).post(path).set(headers).send(body);
const askCode = (email, headers) => post('/api/auth/otp/request', { email }, headers);
const verify = (email, code) => post('/api/auth/otp/verify', { email, code });
const HOUR = 60 * 60 * 1000;
/** Moves every OTP document back in time (skips the cool-down or the hourly window). */
const ageCodes = (ms) => ctx.OtpCode.updateMany({}, [{ $set: { createdAt: { $subtract: ['$createdAt', ms] } } }], { timestamps: false });
const cookieNames = (res) => (res.headers['set-cookie'] || []).map((c) => c.split('=')[0]);
const cookie = (res, name) => (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${name}=`));

describe('OTP request', () => {
  it('emails a branded 6-digit code and returns timings', async () => {
    const res = await askCode('ana@example.com');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, resendIn: 60, expiresIn: 600 });
    const mail = ctx.testOutbox.at(-1);
    expect(mail.to).toBe('ana@example.com');
    expect(mail.subject).toMatch(/^Your Swechha sign-in code: \d{6}$/);
    expect(mail.text).toContain('valid for 10 minutes');
    expect(mail.text).toContain("If you didn't ask for this, ignore this email.");
    expect(mail.html).toContain('#6b1d2f');
    const doc = await ctx.OtpCode.findOne({ email: 'ana@example.com' }).lean();
    expect(doc.codeHash).not.toContain(ctx.lastCode('ana@example.com'));
  });

  it('normalises the email (case and spaces)', async () => {
    await askCode('  Ana.Rao @Example.COM ').expect(200);
    expect(ctx.testOutbox.at(-1).to).toBe('ana.rao@example.com');
  });

  it('rejects an invalid email', async () => {
    const res = await askCode('not-an-email');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Enter a valid email address.');
  });

  it('60 s cool-down → 429 with retryAfter', async () => {
    await askCode('ana@example.com').expect(200);
    const res = await askCode('ana@example.com');
    expect(res.status).toBe(429);
    expect(res.body.retryAfter).toBeGreaterThan(50);
    expect(res.body.retryAfter).toBeLessThanOrEqual(60);
    expect(res.headers['retry-after']).toBe(String(res.body.retryAfter));
    expect(res.body.error).toMatch(/^Wait \d+ seconds before asking for a new code\.$/);
  });

  it('max 5 codes per email per hour', async () => {
    for (let i = 0; i < 5; i++) {
      await askCode('ana@example.com').expect(200);
      await ageCodes(61 * 1000);
    }
    const res = await askCode('ana@example.com');
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/Too many codes for this email/);
    expect(res.body.retryAfter).toBeGreaterThan(0);
    await ageCodes(HOUR);
    await askCode('ana@example.com').expect(200);
  });

  it('max 20 codes per IP per hour', async () => {
    const ip = { ...XRW, 'X-Forwarded-For': '203.0.113.9' };
    for (let i = 0; i < 20; i++) await askCode(`user${i}@example.com`, ip).expect(200);
    const res = await askCode('user99@example.com', ip);
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/from this network/);
    await askCode('user99@example.com', { ...XRW, 'X-Forwarded-For': '198.51.100.7' }).expect(200);
  });
});

describe('OTP verify', () => {
  it('signs in, creates the user and sets both cookies', async () => {
    await askCode('ana@example.com');
    const res = await verify('ana@example.com', ctx.lastCode('ana@example.com'));
    expect(res.status).toBe(200);
    expect(res.body.isNew).toBe(true);
    expect(res.body.user).toMatchObject({ email: 'ana@example.com', name: '', role: 'customer' });
    expect(Object.keys(res.body.user).sort()).toEqual(['_id', 'createdAt', 'email', 'name', 'phone', 'role']);
    const at = cookie(res, 'sw_at');
    const rt = cookie(res, 'sw_rt');
    expect(at).toMatch(/HttpOnly/);
    expect(at).toMatch(/SameSite=Lax/);
    expect(at).toMatch(/Path=\//);
    expect(at).not.toMatch(/Domain=/);
    expect(rt).toMatch(/Path=\/api\/auth/);
    expect(rt).toMatch(/HttpOnly/);
    expect(await ctx.Session.countDocuments()).toBe(1);
  });

  it('second sign-in is not new', async () => {
    await ctx.signIn('ana@example.com');
    await askCode('ana@example.com');
    const res = await verify('ana@example.com', ctx.lastCode('ana@example.com'));
    expect(res.body.isNew).toBe(false);
  });

  it('wrong code decrements attempts; the 5th wrong kills the code', async () => {
    await askCode('ana@example.com');
    const good = ctx.lastCode('ana@example.com');
    const bad = good === '000000' ? '111111' : '000000';
    for (let left = 4; left >= 1; left--) {
      const res = await verify('ana@example.com', bad);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'OTP_WRONG', attemptsLeft: left });
      expect(res.body.error).toBe(`That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
    }
    const fifth = await verify('ana@example.com', bad);
    expect(fifth.body).toMatchObject({ code: 'OTP_LOCKED', error: 'Too many wrong tries. Ask for a new code.' });
    const afterwards = await verify('ana@example.com', good);
    expect(afterwards.status).toBe(400);
    expect(afterwards.body.code).toBe('OTP_LOCKED');
  });

  it('expired code is rejected', async () => {
    await askCode('ana@example.com');
    await ctx.OtpCode.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await verify('ana@example.com', ctx.lastCode('ana@example.com'));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'OTP_EXPIRED', error: 'This code has expired. Ask for a new one.' });
  });

  it('a used code cannot be reused', async () => {
    await askCode('ana@example.com');
    const code = ctx.lastCode('ana@example.com');
    await verify('ana@example.com', code).expect(200);
    const again = await verify('ana@example.com', code);
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('OTP_EXPIRED');
  });

  it('a new request invalidates the earlier code', async () => {
    await askCode('ana@example.com');
    const first = ctx.lastCode('ana@example.com');
    await ageCodes(61 * 1000);
    await askCode('ana@example.com').expect(200);
    const second = ctx.lastCode('ana@example.com');
    if (first !== second) expect((await verify('ana@example.com', first)).status).toBe(400);
    expect((await verify('ana@example.com', second)).status).toBe(200);
  });

  it('needs 6 digits', async () => {
    const res = await verify('ana@example.com', '12ab');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Enter the 6-digit code.');
  });

  it('blocked user → 403', async () => {
    await ctx.User.create({ email: 'blocked@example.com', isBlocked: true });
    await askCode('blocked@example.com');
    const res = await verify('blocked@example.com', ctx.lastCode('blocked@example.com'));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('This account is blocked. Contact us on WhatsApp.');
    expect(cookieNames(res)).not.toContain('sw_at');
  });

  it('ADMIN_EMAILS become admin on login (case-insensitive)', async () => {
    await ctx.User.create({ email: 'second.owner@swechha.test', role: 'customer' });
    const { user } = await ctx.signIn('Second.Owner@swechha.test');
    expect(user.role).toBe('admin');
    const other = await ctx.signIn('shopper@example.com');
    expect(other.user.role).toBe('customer');
  });
});

describe('/api/auth/me', () => {
  it('200 { user: null } when logged out', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it('returns the signed-in user', async () => {
    const { agent } = await ctx.signIn('ana@example.com');
    const res = await agent.get('/api/auth/me');
    expect(res.body.user.email).toBe('ana@example.com');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('tokens and sessions', () => {
  const expiredToken = (user) =>
    jwt.sign(
      { sub: user._id, role: user.role, iat: Math.floor(Date.now() / 1000) - 3600, exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_ACCESS_SECRET
    );

  it('protected route without a cookie → 401', async () => {
    const res = await post('/api/auth/logout-all', {});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  it('expired access token → 401 TOKEN_EXPIRED', async () => {
    const { user } = await ctx.signIn('ana@example.com');
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `sw_at=${expiredToken(user)}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('tampered access token is ignored', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'sw_at=abc.def.ghi');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  it('refresh rotates the refresh token and issues a new access token', async () => {
    const { agent } = await ctx.signIn('ana@example.com');
    const before = await ctx.Session.findOne().lean();
    const res = await agent.post('/api/auth/refresh').set(XRW);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ana@example.com');
    expect(cookieNames(res)).toEqual(expect.arrayContaining(['sw_at', 'sw_rt']));
    const after = await ctx.Session.findOne().lean();
    expect(after.tokenHash).not.toBe(before.tokenHash);
    expect(after.previousTokenHash).toBe(before.tokenHash);
    expect((await agent.get('/api/auth/me')).body.user.email).toBe('ana@example.com');
  });

  it('previous token inside the 30 s grace works; after the grace it revokes the session', async () => {
    expect(await replayPreviousToken()).toBe(true);
  });

  it('refresh without a cookie → 401 and cookies cleared', async () => {
    const res = await post('/api/auth/refresh', {});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_EXPIRED');
    expect(cookie(res, 'sw_rt')).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('logout revokes this session and clears cookies (idempotent)', async () => {
    const { agent } = await ctx.signIn('ana@example.com');
    const res = await agent.post('/api/auth/logout').set(XRW);
    expect(res.status).toBe(200);
    expect(cookie(res, 'sw_at')).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await ctx.Session.findOne().lean()).revokedAt).toBeInstanceOf(Date);
    expect((await agent.post('/api/auth/logout').set(XRW)).status).toBe(200);
    expect((await agent.post('/api/auth/refresh').set(XRW)).status).toBe(401);
  });

  it('logout-all kills every session of the user', async () => {
    const phone = await ctx.signIn('ana@example.com');
    const laptop = await ctx.signIn('ana@example.com');
    const other = await ctx.signIn('ben@example.com');
    expect(await ctx.Session.countDocuments({ revokedAt: null })).toBe(3);
    await phone.agent.post('/api/auth/logout-all').set(XRW).expect(200);
    expect((await laptop.agent.post('/api/auth/refresh').set(XRW)).status).toBe(401);
    expect((await other.agent.post('/api/auth/refresh').set(XRW)).status).toBe(200);
  });

  it('role and block changes apply on the next request', async () => {
    const { agent, user } = await ctx.signIn('ana@example.com');
    await ctx.User.updateOne({ _id: user._id }, { $set: { role: 'staff' } });
    expect((await agent.get('/api/auth/me')).body.user.role).toBe('staff');
    await ctx.User.updateOne({ _id: user._id }, { $set: { isBlocked: true } });
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
    expect((await agent.post('/api/auth/refresh').set(XRW)).status).toBe(403);
  });

  it('two accounts on two devices stay separate', async () => {
    const a = await ctx.signIn('ana@example.com');
    const b = await ctx.signIn('ben@example.com');
    expect((await a.agent.get('/api/auth/me')).body.user.email).toBe('ana@example.com');
    expect((await b.agent.get('/api/auth/me')).body.user.email).toBe('ben@example.com');
  });

  /** Signs in, captures the raw refresh token, rotates, then replays the old one within and after the grace. */
  async function replayPreviousToken() {
    await askCode('carol@example.com');
    const res = await verify('carol@example.com', ctx.lastCode('carol@example.com'));
    const oldRt = cookie(res, 'sw_rt').split(';')[0];
    const first = await request(app).post('/api/auth/refresh').set(XRW).set('Cookie', oldRt);
    expect(first.status).toBe(200);
    const within = await request(app).post('/api/auth/refresh').set(XRW).set('Cookie', oldRt);
    expect(within.status).toBe(200);
    // Push the last rotation outside the 30 s window, then replay the now-previous token.
    const newestRt = cookie(within, 'sw_rt').split(';')[0];
    const session = await ctx.Session.findOne({ userId: res.body.user._id });
    await ctx.Session.updateOne({ _id: session._id }, { $set: { rotatedAt: new Date(Date.now() - 31_000) } });
    const secondRt = cookie(first, 'sw_rt').split(';')[0];
    const stale = await request(app).post('/api/auth/refresh').set(XRW).set('Cookie', secondRt);
    expect(stale.status).toBe(401);
    expect(stale.body.code).toBe('SESSION_REVOKED');
    // The whole session is gone, including the newest token.
    expect((await request(app).post('/api/auth/refresh').set(XRW).set('Cookie', newestRt)).status).toBe(401);
    return true;
  }
});

describe('CSRF', () => {
  it('missing X-Requested-With → 403', async () => {
    const res = await request(app).post('/api/auth/otp/request').send({ email: 'ana@example.com' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF');
  });

  it('foreign Origin → 403; listed Origin passes', async () => {
    const bad = await askCode('ana@example.com', { ...XRW, Origin: 'https://evil.example' });
    expect(bad.status).toBe(403);
    const good = await askCode('ana@example.com', { ...XRW, Origin: 'https://swechha.example' });
    expect(good.status).toBe(200);
  });

  it('GET requests need no header', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(200);
  });
});
