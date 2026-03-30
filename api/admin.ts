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
      <title>Panel de Control - Voto Informado</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #f3f4f6; color: #111827; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .container { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 400px; width: 100%; }
        h1 { font-size: 1.5rem; text-align: center; color: #b91c1c; margin-top: 0; }
        .stat-card { background: #fee2e2; border-left: 4px solid #b91c1c; padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem; }
        .stat-value { font-size: 2rem; font-weight: bold; }
        .stat-label { font-size: 0.875rem; color: #4b5563; }
        input { width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box; margin-bottom: 1rem; }
        button { width: 100%; background: #b91c1c; color: white; border: none; padding: 0.75rem; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background 0.2s; margin-bottom: 0.5rem; }
        button:hover { background: #991b1b; }
        button.standby-on { background: #ea580c; }
        button.standby-on:hover { background: #c2410c; }
        .hidden { display: none; }
        #toast { text-align: center; margin-top: 1rem; font-weight: 500; font-size: 0.9rem; }
      </style>
    </head>
    <body>
      <div class="container" id="login-screen">
        <h1>Centro de Comando</h1>
        <p style="text-align:center; font-size:0.9rem; color:#4b5563">Ingresa la clave maestra para continuar</p>
        <input type="password" id="password" placeholder="Contraseña">
        <button onclick="login()">Ingresar</button>
        <div id="login-error" style="color:red; text-align:center; display:none; margin-top:10px;">Contraseña incorrecta</div>
      </div>

      <div class="container hidden" id="dashboard-screen">
        <h1>Voto Informado - Admin</h1>
        
        <div class="stat-card">
          <div class="stat-label">Consultas de IA Hoy</div>
          <div class="stat-value" id="queries-today">0</div>
        </div>

        <button id="toggle-btn" onclick="toggleStandby()">Cargando estado...</button>
        <button onclick="refreshStats()" style="background:#4b5563; margin-top:10px;">Refrescar Datos</button>
        
        <div id="toast"></div>
      </div>

      <script>
        let currentPassword = '';
        async function apiCall(action, data = {}) {
          const res = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, password: currentPassword, ...data })
          });
          return await res.json();
        }

        async function login() {
          currentPassword = document.getElementById('password').value;
          const res = await apiCall('login');
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
            if (res.isStandby) {
              btn.innerText = '🔴 ReActivar Aplicación';
              btn.className = 'standby-on';
            } else {
              btn.innerText = '🟢 Poner en Pausa (Standby)';
              btn.className = '';
            }
          }
        }

        async function toggleStandby() {
          const btn = document.getElementById('toggle-btn');
          const isCurrentlyStandby = btn.innerText.includes('Activar');
          btn.innerText = 'Procesando...';
          const res = await apiCall('toggle_standby', { newState: !isCurrentlyStandby });
          if (res.success) {
            const toast = document.getElementById('toast');
            toast.innerText = !isCurrentlyStandby ? '¡Aplicación apagada nacionalmente!' : '¡Aplicación reactivada!';
            toast.style.color = !isCurrentlyStandby ? '#ea580c' : 'green';
            setTimeout(() => toast.innerText='', 3000);
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

      if (body.action === 'login') {
        return new Response(JSON.stringify({ success: true }));
      }

      if (body.action === 'stats') {
        const today = new Date().toISOString().split('T')[0];
        const globalKey = `usage:global:${today}`;
        const todayUsage = await redis.get(globalKey);
        
        const redisStandby = await redis.get('APP_STANDBY_MODE');
        return new Response(JSON.stringify({ 
          success: true, 
          todayUsage: todayUsage || 0,
          isStandby: redisStandby === 'true' || redisStandby === true
        }));
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
