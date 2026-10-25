/** One-time owner setup: the private key is sent only in a JSON POST, never a URL query. */
export async function resolveAdminEnvironment(env) {
  if (env.ADMIN_PASSWORD_HASH) return env;
  const row = await env.DB.prepare('SELECT password_hash FROM admin_credentials WHERE id=1').first();
  return {...env, ADMIN_PASSWORD_HASH: row?.password_hash || ''};
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function adminSetup(req, env, helpers) {
  const {json, error, sameOrigin, throttle, content, makeSession} = helpers;
  if (!sameOrigin(req)) return error('غير مصرح', 403);
  if (env.ADMIN_PASSWORD_HASH) return error('تم إعداد الإدارة مسبقًا. استخدم تسجيل الدخول.', 409);
  if (env.SETUP_TOKEN?.length < 32 || !env.SETUP_TOKEN || env.SESSION_SECRET?.length < 32 || !env.SESSION_SECRET) {
    return error('رابط إعداد الإدارة غير مفعّل', 503);
  }
  if (!(await throttle(req, env, 'setup', 5, 900))) return error('محاولات كثيرة؛ يرجى المحاولة لاحقًا', 429);
  let body;
  try { body = await content(req); } catch { return error('بيانات غير صالحة'); }
  if (typeof body?.token !== 'string' || body.token.length > 100) return error('رابط الإعداد غير صالح', 403);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), {name:'HMAC', hash:'SHA-256'}, false, ['sign', 'verify']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(env.SETUP_TOKEN));
  if (!(await crypto.subtle.verify('HMAC', key, signature, encoder.encode(body.token)))) return error('رابط الإعداد غير صالح', 403);
  if (typeof body.password !== 'string' || body.password.length < 14 || body.password.length > 200) {
    return error('اختر كلمة مرور من 14 حرفًا إلى 200 حرف');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordKey = await crypto.subtle.importKey('raw', encoder.encode(body.password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({name:'PBKDF2', salt, iterations:100000, hash:'SHA-256'}, passwordKey, 256);
  const encoded = `pbkdf2_sha256$100000$${base64url(salt)}$${base64url(hash)}`;
  try {
    await env.DB.prepare('INSERT INTO admin_credentials (id,password_hash) VALUES (1,?)').bind(encoded).run();
  } catch {
    // The singleton primary key also closes concurrent attempts to claim ownership.
    return error('تعذر إكمال الإعداد؛ قد يكون تم تفعيله مسبقًا', 409);
  }
  const session = await makeSession(env);
  return json({ok:true}, 201, {'set-cookie':`ts_admin=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`});
}
