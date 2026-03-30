import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'edge',
};

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456';

export default async function handler(req: Request) {
  const url = new URL(req.url);

  // === RUTA DE LA INTERFAZ HTML ===
  if (req.method === 'GET') {
    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Centro de Mando | Voto Informado</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg-dark: #0f172a;
          --panel-bg: rgba(30, 41, 59, 0.7);
          --accent: #ef4444;
          --accent-hover: #dc2626;
          --text-main: #f8fafc;
          --text-muted: #94a3b8;
          --success: #10b981;
          --warning: #f59e0b;
        }

        body { 
          font-family: 'Outfit', sans-serif; 
          background: radial-gradient(circle at top right, #1e1b4b, var(--bg-dark), #000); 
          color: var(--text-main); 
          display: flex; justify-content: center; align-items: center; 
          min-height: 100vh; margin: 0; 
          overflow: hidden;
        }

        /* Ambient Background Glows */
        .glow-1 { position: absolute; width: 300px; height: 300px; background: rgba(239, 68, 68, 0.2); filter: blur(100px); top: -100px; left: -100px; border-radius: 50%; z-index: -1; }
        .glow-2 { position: absolute; width: 400px; height: 400px; background: rgba(59, 130, 246, 0.15); filter: blur(120px); bottom: -150px; right: -100px; border-radius: 50%; z-index: -1; }

        .container { 
          background: var(--panel-bg); 
          backdrop-filter: blur(16px); 
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 2.5rem; 
          border-radius: 24px; 
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); 
          max-width: 480px; 
          width: 90%;
          transition: all 0.4s ease;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0; transform: translateY(30px);
        }

        @keyframes slideUp { to { opacity: 1; transform: translateY(0); } }

        .header { text-align: center; margin-bottom: 2rem; }
        h1 { font-size: 2rem; font-weight: 800; margin: 0; background: linear-gradient(to right, #ffffff, #94a3b8); -webkit-background-clip: text; color: transparent; letter-spacing: -0.5px; }
        .subtitle { color: var(--text-muted); font-size: 0.95rem; margin-top: 5px; }

        .metric-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; margin-bottom: 1.5rem; }
        .metric-card { 
          background: rgba(15, 23, 42, 0.6); 
          border: 1px solid rgba(255, 255, 255, 0.05); 
          padding: 1.5rem; 
          border-radius: 16px; 
          position: relative;
          overflow: hidden;
        }
        .metric-card::before {
          content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%;
          background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
        }

        .metric-label { font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
        .metric-value { font-size: 3rem; font-weight: 800; line-height: 1.1; margin-top: 0.5rem; text-shadow: 0 4px 10px rgba(0,0,0,0.3); }

        .status-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2);
          color: var(--success); padding: 6px 14px; border-radius: 20px;
          font-size: 0.85rem; font-weight: 600; margin-top: 10px;
        }
        .status-badge.standby { background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); color: var(--accent); }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 10px var(--success); animation: pulse 2s infinite; }
        .standby .status-dot { background: var(--accent); box-shadow: 0 0 10px var(--accent); }

        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }

        input { 
          width: 100%; padding: 1rem; 
          background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); 
          color: white; border-radius: 12px; font-family: 'Outfit'; font-size: 1rem;
          box-sizing: border-box; margin-bottom: 1rem; transition: border 0.3s;
        }
        input:focus { outline: none; border-color: #3b82f6; }

        button { 
          width: 100%; 
          padding: 1.1rem; 
          border: none; border-radius: 12px; 
          font-family: 'Outfit'; font-weight: 600; font-size: 1rem; letter-spacing: 0.5px;
          cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          color: white; display: flex; justify-content: center; align-items: center; gap: 10px;
        }
        
        .btn-primary { 
          background: linear-gradient(135deg, #3b82f6, #2563eb); 
          box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(37, 99, 235, 0.5); }

        .btn-danger {
          background: linear-gradient(135deg, #ef4444, #b91c1c);
          box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
        }
        .btn-danger:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(239, 68, 68, 0.5); }

        .btn-success {
          background: linear-gradient(135deg, #10b981, #059669);
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
        }
        .btn-success:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(16, 185, 129, 0.5); }

        .hidden { display: none !important; }
        
        .toast {
          position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px);
          background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255,255,255,0.1);
          padding: 12px 24px; border-radius: 30px; font-size: 0.9rem; font-weight: 600;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); z-index: 1000;
        }
        .toast.show { transform: translateX(-50%) translateY(0); }
      </style>
    </head>
    <body>
      <div class="glow-1"></div>
      <div class="glow-2"></div>

      <!-- PANTALLA DE LOGIN -->
      <div class="container" id="login-screen">
        <div class="header">
          <h1>Sistema Central</h1>
          <div class="subtitle">Acceso Restringido Nivel 1</div>
        </div>
        <input type="password" id="password" placeholder="Clave de encriptación..." onkeypress="if(event.key === 'Enter') login()">
        <button class="btn-primary" onclick="login()">Desbloquear Panel</button>
        <div id="login-error" style="color:var(--accent); text-align:center; display:none; margin-top:15px; font-size: 0.9rem;">Credenciales rechazadas</div>
      </div>

      <!-- PANTALLA DASHBOARD -->
      <div class="container hidden" id="dashboard-screen" style="max-width: 600px;">
        <div class="header">
          <h1>Voto Informado Admin</h1>
          <div id="status-badge" class="status-badge">
            <div class="status-dot"></div> <span id="status-text">Sistema En Línea</span>
          </div>
        </div>
        
        <div class="metric-grid" style="grid-template-columns: 1fr 1fr;">
          <div class="metric-card">
            <div class="metric-label">Tráfico Global Hoy</div>
            <div class="metric-value" id="queries-today">0</div>
          </div>
          <div class="metric-card" style="display:flex; flex-direction:column; justify-content:center;">
             <button id="toggle-btn" class="btn-danger" onclick="toggleStandby()" style="margin-bottom:0;">🛑 APAGADO NACIONAL</button>
          </div>
        </div>

        <h3 style="margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">Gestión de VIP Codes</h3>
        <div id="codes-list" style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
          <!-- Se llena por JS -->
        </div>

        <button class="btn-primary" style="background: rgba(255,255,255,0.05); box-shadow: none; border: 1px solid rgba(255,255,255,0.1);" onclick="refreshStats()">
          🔄 Sincronizar Datos
        </button>
      </div>

      <div class="toast" id="toast">Acción completada con éxito.</div>

      <script>
        let currentPassword = '';
        
        function showToast(msg, color = 'white') {
          const t = document.getElementById('toast');
          t.innerText = msg;
          t.style.color = color;
          t.classList.add('show');
          setTimeout(() => t.classList.remove('show'), 3500);
        }

        async function apiCall(action, data = {}) {
          try {
            const res = await fetch('/api/admin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, password: currentPassword, ...data })
            });
            return await res.json();
          } catch(e) {
            return { success: false, error: 'Network Error' };
          }
        }

        async function login() {
          const btn = document.querySelector('#login-screen button');
          btn.innerText = 'Verificando...';
          currentPassword = document.getElementById('password').value;
          const res = await apiCall('login');
          btn.innerText = 'Desbloquear Panel';
          
          if (res.success) {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('dashboard-screen').classList.remove('hidden');
            refreshStats();
          } else {
            document.getElementById('login-error').style.display = 'block';
          }
        }

        async function refreshStats() {
          const res = await apiCall('stats');
          if (res.success) {
            document.getElementById('queries-today').innerText = res.todayUsage || '0';
            
            const btn = document.getElementById('toggle-btn');
            const badge = document.getElementById('status-badge');
            const statusTxt = document.getElementById('status-text');

            if (res.isStandby) {
              btn.innerText = '⚡ REACTIVAR SISTEMA';
              btn.className = 'btn-success';
              badge.className = 'status-badge standby';
              statusTxt.innerText = 'SISTEMA PAUSADO (STANDBY)';
            } else {
              btn.innerText = '🛑 APAGADO NACIONAL';
              btn.className = 'btn-danger';
              badge.className = 'status-badge';
              statusTxt.innerText = 'SISTEMA EN LÍNEA';
            }

            renderCodes(res.codes);
          }
        }

        function renderCodes(codes) {
          const container = document.getElementById('codes-list');
          container.innerHTML = '';
          codes.forEach(c => {
            const isBlocked = c.status === 'bloqueado';
            container.innerHTML += \`
              <div style="background: rgba(0,0,0,0.3); border-radius:12px; padding:15px; display:flex; justify-content:space-between; align-items:center; border: 1px solid \${isBlocked ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.05)'}">
                <div>
                  <div style="font-weight:bold; font-size:1.1rem; color: \${isBlocked ? 'var(--accent)' : 'white'}">\${c.code}</div>
                  <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Uso de hoy: <strong style="color:var(--text-main)">\${c.usage}</strong> / \${c.limit}</div>
                </div>
                <div style="display:flex; gap:8px;">
                  <button onclick="updateLimit('\${c.code}', \${c.limit})" style="padding:6px 12px; font-size:0.8rem; width:auto; background:rgba(255,255,255,0.1)">⚙️ Límite</button>
                  <button onclick="toggleCodeStatus('\${c.code}', '\${c.status}')" style="padding:6px 12px; font-size:0.8rem; width:auto; \${isBlocked ? 'background:var(--success)' : 'background:var(--accent)'}">
                    \${isBlocked ? '✅ Reactivar' : '🚫 Bloquear'}
                  </button>
                </div>
              </div>
            \`;
          });
        }

        async function updateLimit(code, currentLimit) {
          const newLimit = prompt(\`Nuevo límite diario para \${code}:\`, currentLimit);
          if (newLimit && !isNaN(newLimit)) {
            const res = await apiCall('update_code', { code, limit: parseInt(newLimit) });
            if(res.success) refreshStats();
          }
        }

        async function toggleCodeStatus(code, currentStatus) {
          const newStatus = currentStatus === 'activo' ? 'bloqueado' : 'activo';
          const res = await apiCall('update_code', { code, status: newStatus });
          if(res.success) refreshStats();
        }

        async function toggleStandby() {
          const btn = document.getElementById('toggle-btn');
          const isCurrentlyStandby = btn.innerText.includes('REACTIVAR');
          btn.innerText = 'Ejecutando...';
          
          const res = await apiCall('toggle_standby', { newState: !isCurrentlyStandby });
          if (res.success) {
            showToast(!isCurrentlyStandby ? '¡APAGADO NACIONAL EJECUTADO!' : '¡SISTEMA REACTIVADO CON ÉXITO!', !isCurrentlyStandby ? '#ef4444' : '#10b981');
            refreshStats();
          } else {
            showToast('Error de conexión', '#ef4444');
            refreshStats();
          }
        }
      </script>
    </body>
    </html>
    `;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  // === RUTA DE API (POST ACTIONS) ===
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (body.password !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 });
      }

      if (!redis) {
        return new Response(JSON.stringify({ success: false, error: 'Redis no detectado' }), { status: 500 });
      }

      const VALID_CODES = ['GHS1129', 'GHS2129', 'GHS3129', 'GHS4129', 'GHS5129'];

      if (body.action === 'login') {
        return new Response(JSON.stringify({ success: true }));
      }

      if (body.action === 'stats') {
        const today = new Date().toISOString().split('T')[0];
        const globalKey = `usage:global:${today}`;
        const todayUsage = await redis.get(globalKey);
        const redisStandby = await redis.get('APP_STANDBY_MODE');

        const codesData = [];
        for (const code of VALID_CODES) {
          let config: any = await redis.get(`config:${code}`);
          if (!config) config = { status: 'activo', limit: 20 };
          const usage: any = await redis.get(`usage:${code}:${today}`);
          
          codesData.push({
            code,
            status: config.status,
            limit: config.limit,
            usage: usage || 0
          });
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          todayUsage: todayUsage || 0,
          isStandby: redisStandby === 'true' || redisStandby === true,
          codes: codesData
        }));
      }

      if (body.action === 'update_code') {
        const { code, limit, status } = body;
        if (!VALID_CODES.includes(code)) return new Response(JSON.stringify({ success: false }));
        
        let config: any = await redis.get(`config:${code}`);
        if (!config) config = { status: 'activo', limit: 20 };
        
        if (limit !== undefined) config.limit = limit;
        if (status !== undefined) config.status = status;
        
        await redis.set(`config:${code}`, config);
        return new Response(JSON.stringify({ success: true }));
      }

      if (body.action === 'toggle_standby') {
        await redis.set('APP_STANDBY_MODE', body.newState ? 'true' : 'false');
        return new Response(JSON.stringify({ success: true, isStandby: body.newState }));
      }

      return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), { status: 400 });

    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
