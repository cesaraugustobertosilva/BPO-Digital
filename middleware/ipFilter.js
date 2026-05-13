// IP allowlist middleware
// Configure via ALLOWED_IPS env var (comma-separated IPs and/or CIDR ranges).
// If ALLOWED_IPS is empty, all IPs are allowed (safe for local dev).
// Localhost is always allowed regardless of the list.

const ALWAYS_ALLOWED = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

const ALLOWED = (process.env.ALLOWED_IPS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  const raw = fwd ? fwd.split(',')[0].trim()
                  : (req.socket?.remoteAddress || req.ip || '');
  return raw.replace(/^::ffff:/, '');
}

function ipToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function ipInCidr(ip, cidr) {
  const [base, bits] = cidr.split('/');
  const mask   = ~((1 << (32 - parseInt(bits, 10))) - 1) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(base) & mask);
}

function isAllowed(ip) {
  if (ALWAYS_ALLOWED.includes(ip)) return true;
  if (!ALLOWED.length) return true; // no restriction configured

  return ALLOWED.some(entry =>
    entry.includes('/') ? ipInCidr(ip, entry) : ip === entry
  );
}

const DENIED_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>403 - Acesso Restrito</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,sans-serif;background:#0f172a;color:#94a3b8;
         display:flex;align-items:center;justify-content:center;min-height:100vh}
    .box{text-align:center;max-width:380px;padding:40px 24px}
    .code{font-size:80px;font-weight:700;color:#1e293b;line-height:1;letter-spacing:-4px}
    .title{font-size:18px;font-weight:600;color:#475569;margin:12px 0 8px}
    .msg{font-size:13px;line-height:1.6;color:#64748b}
  </style>
</head>
<body>
  <div class="box">
    <div class="code">403</div>
    <div class="title">Acesso Restrito</div>
    <div class="msg">Este recurso nao esta disponivel a partir da sua rede.<br>
    Contate o administrador caso precise de acesso.</div>
  </div>
</body>
</html>`;

module.exports = function ipFilter(req, res, next) {
  const ip = getClientIp(req);
  if (isAllowed(ip)) return next();
  res.status(403).send(DENIED_HTML);
};
