// IP allowlist middleware
// Configure via ALLOWED_IPS env var (comma-separated IPs and/or CIDR ranges).
// If ALLOWED_IPS is empty, all IPs are allowed (safe for local dev).
// Localhost is always allowed regardless of the list.

const ALWAYS_ALLOWED = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

const ALLOWED = (process.env.ALLOWED_IPS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const CONFIGURED = ALLOWED.length > 0;

if (!CONFIGURED) {
  console.warn('[ipFilter] ALLOWED_IPS nao configurado - acesso liberado para todos os IPs.');
} else {
  console.log('[ipFilter] IPs/ranges permitidos:', ALLOWED.join(', '));
}

function getClientIp(req) {
  // Vercel / proxies: primeiro IP do X-Forwarded-For eh o cliente real
  const fwd   = req.headers['x-forwarded-for'];
  const xreal = req.headers['x-real-ip'];
  const raw   = fwd  ? fwd.split(',')[0].trim()
              : xreal ? xreal.trim()
              : (req.socket?.remoteAddress || req.ip || '');
  return raw.replace(/^::ffff:/, '');
}

function ipToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function ipInCidr(ip, cidr) {
  const [base, bits] = cidr.split('/');
  const mask = ~((1 << (32 - parseInt(bits, 10))) - 1) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(base) & mask);
}

function isAllowed(ip) {
  if (ALWAYS_ALLOWED.includes(ip)) return true;
  if (!CONFIGURED)                 return true; // sem restricao configurada

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

  // Rota de diagnostico: /api/myip retorna o IP detectado (util para configurar allowlist)
  if (req.path === '/api/myip') {
    return res.json({
      ip,
      allowed:    isAllowed(ip),
      configured: CONFIGURED,
      allowlist:  CONFIGURED ? ALLOWED : 'nao configurado',
      headers: {
        'x-forwarded-for': req.headers['x-forwarded-for'] || null,
        'x-real-ip':       req.headers['x-real-ip']       || null,
      },
    });
  }

  if (isAllowed(ip)) return next();

  console.warn('[ipFilter] Acesso negado para IP:', ip);
  res.status(403).send(DENIED_HTML);
};
