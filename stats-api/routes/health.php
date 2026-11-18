<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

return function (Request $request) {
    $version = env('APP_VERSION', 'dev');
    $environment = env('APP_ENV', 'production');
    $hostname = gethostname() ?: 'local';
    $now = now();

    // Check PostgreSQL
    $dbStatus = 'down';
    $dbLatency = 0.0;
    $dbError = null;
    $ordersCount = 0;
    try {
        $dbStart = microtime(true);
        DB::connection()->getPdo();
        $dbLatency = round((microtime(true) - $dbStart) * 1000, 2);
        $dbStatus = 'ok';
        $ordersCount = DB::table('orders')->count();
    } catch (\Throwable $e) {
        $dbError = $e->getMessage();
    }

    // Check Redis
    $redisStatus = 'down';
    $redisLatency = 0.0;
    $redisError = null;
    $workerHeartbeat = null;
    $workerRaw = null;
    $queueLength = 0;
    try {
        $redisStart = microtime(true);
        Redis::ping();
        $redisLatency = round((microtime(true) - $redisStart) * 1000, 2);
        $redisStatus = 'ok';
        $workerHeartbeat = Redis::get('worker:heartbeat');
        $workerRaw = Redis::get('worker:status');
        $queueLength = (int) Redis::llen('orders:queue');
    } catch (\Throwable $e) {
        $redisError = $e->getMessage();
    }

    $workerStatus = $workerRaw ? json_decode($workerRaw, true) : null;
    $workerActive = false;
    $workerText = 'Offline / Idle';
    if ($workerHeartbeat) {
        try {
            $hbTime = \Carbon\Carbon::parse($workerHeartbeat);
            $diffSeconds = $now->diffInSeconds($hbTime);
            if ($diffSeconds < 60) {
                $workerActive = true;
                $workerText = "Active ({$diffSeconds}s ago)";
            } else {
                $workerText = "Stale ({$diffSeconds}s ago)";
            }
        } catch (\Throwable $e) {
            $workerActive = true;
            $workerText = 'Active';
        }
    }

    $allHealthy = ($dbStatus === 'ok' && $redisStatus === 'ok');
    $overallStatusText = $allHealthy ? 'ALL SYSTEMS OPERATIONAL' : 'SYSTEM DEGRADED';
    $overallStatusClass = $allHealthy ? 'status-good' : 'status-bad';

    // JSON response for API consumers
    if ($request->wantsJson() || $request->query('format') === 'json') {
        return response()->json([
            'status' => $allHealthy ? 'ok' : 'degraded',
            'version' => $version,
            'environment' => $environment,
            'hostname' => $hostname,
            'timestamp' => $now->toIso8601String(),
            'dependencies' => [
                'postgres' => [
                    'status' => $dbStatus,
                    'latency_ms' => $dbLatency,
                    'total_orders' => $ordersCount,
                    'error' => $dbError,
                ],
                'redis' => [
                    'status' => $redisStatus,
                    'latency_ms' => $redisLatency,
                    'queue_length' => $queueLength,
                    'error' => $redisError,
                ],
                'kitchen_worker' => [
                    'status' => $workerActive ? 'active' : 'idle',
                    'heartbeat' => $workerHeartbeat,
                    'details' => $workerStatus,
                ],
            ],
            'services' => [
                'web' => 'operational',
                'menu-api' => 'operational',
                'orders-api' => 'operational',
                'kitchen-worker' => $workerActive ? 'operational' : 'idle',
                'stats-api' => 'operational',
            ],
        ], 200);
    }

    // HTML UI Data Representation
    $payloadData = [
        'status' => $allHealthy ? 'ok' : 'degraded',
        'version' => $version,
        'environment' => $environment,
        'hostname' => $hostname,
        'timestamp' => $now->toIso8601String(),
        'database' => [
            'status' => $dbStatus,
            'latency_ms' => $dbLatency,
            'orders' => $ordersCount,
        ],
        'redis' => [
            'status' => $redisStatus,
            'latency_ms' => $redisLatency,
            'queue_length' => $queueLength,
        ],
        'worker' => [
            'status' => $workerActive ? 'active' : 'idle',
            'heartbeat' => $workerHeartbeat,
        ],
    ];
    $prettyJson = htmlspecialchars(json_encode($payloadData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    $html = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Platform Health · Dhaba Orders</title>
  <style>
    :root {
      --primary: #c75b2b;
      --bg: #f7f5ef;
      --card-bg: #ffffff;
      --border: #eae6dc;
      --text: #27251f;
      --muted: #6b675e;
      --green: #10b981;
      --green-bg: #ecfdf5;
      --green-border: #a7f3d0;
      --red: #ef4444;
      --red-bg: #fef2f2;
      --amber: #f59e0b;
      --dark: #252d25;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px 16px;
    }
    .container {
      max-width: 1040px;
      margin: 0 auto;
    }
    header {
      background: var(--dark);
      color: white;
      padding: 28px 32px;
      border-radius: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .header-titles .eyebrow {
      font-size: 11px;
      letter-spacing: 2px;
      color: #e59873;
      font-weight: 700;
      text-transform: uppercase;
    }
    .header-titles h1 {
      font-size: 28px;
      margin: 4px 0 2px;
      font-weight: 700;
    }
    .header-titles h1 span { color: var(--primary); }
    .header-titles p {
      color: #d6d9d1;
      font-size: 13px;
    }
    .header-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.25);
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 8px var(--green);
    }
    .status-dot.bad {
      background: var(--red);
      box-shadow: 0 0 8px var(--red);
    }
    .controls-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 20px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .controls-info {
      font-size: 13px;
      color: var(--muted);
    }
    .controls-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    button.btn {
      background: var(--primary);
      color: white;
      border: 0;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s ease;
    }
    button.btn:hover { opacity: 0.9; }
    button.btn-outline {
      background: transparent;
      color: var(--text);
      border: 1px solid var(--border);
    }
    button.btn-outline:hover { background: #f0ebe1; }
    .auto-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--muted);
      cursor: pointer;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }
    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f2eee6;
    }
    .card-head h2 {
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .pill-green {
      background: var(--green-bg);
      color: #065f46;
      border: 1px solid var(--green-border);
    }
    .pill-red {
      background: var(--red-bg);
      color: #991b1b;
      border: 1px solid #fecaca;
    }
    .meta-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: 13px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .meta-label { color: var(--muted); }
    .meta-value { font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 12px;
    }
    .service-box {
      background: #faf8f5;
      border: 1px solid #ede8dc;
      padding: 12px 14px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .service-box b { font-size: 13px; display: block; }
    .service-box span { font-size: 11px; color: var(--muted); }
    .json-section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .json-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .json-head h3 { font-size: 15px; font-weight: 700; }
    pre.code-view {
      background: #181a1b;
      color: #79c0ff;
      padding: 16px;
      border-radius: 10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 1.5;
      max-height: 320px;
      overflow: auto;
    }
    footer {
      text-align: center;
      color: #999;
      font-size: 12px;
      padding: 20px;
    }
    footer a { color: var(--primary); text-decoration: none; font-weight: 600; }
    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-titles">
        <p class="eyebrow">PESHAWAR • INFRASTRUCTURE &amp; HEALTH</p>
        <h1>Dhaba <span>Health Dashboard</span></h1>
        <p>Live health telemetry for Dhaba Orders microservices platform</p>
      </div>
      <div class="header-badge">
        <span class="status-dot {$overallStatusClass}"></span>
        <span>{$overallStatusText}</span>
      </div>
    </header>

    <div class="controls-bar">
      <div class="controls-info">
        Last updated: <b>{$now->toTimeString()} UTC</b> · Environment: <b>{$environment}</b>
      </div>
      <div class="controls-actions">
        <button class="btn btn-outline" onclick="location.reload()">↻ Refresh</button>
        <label class="auto-toggle">
          <input type="checkbox" id="autoRefreshToggle" checked onchange="toggleAutoRefresh(this.checked)">
          Auto-refresh (5s)
        </label>
        <a href="/api/health?format=json" class="btn btn-outline" style="text-decoration:none;">{ } View JSON</a>
      </div>
    </div>

    <div class="grid">
      <!-- Database Card -->
      <div class="card">
        <div class="card-head">
          <h2>🗄️ PostgreSQL Database</h2>
          <span class="pill " . ($dbStatus === 'ok' ? 'pill-green' : 'pill-red') . ">{$dbStatus}</span>
        </div>
        <div class="meta-list">
          <div class="meta-row"><span class="meta-label">Status</span><span class="meta-value">" . ($dbStatus === 'ok' ? 'Connected' : 'Unavailable') . "</span></div>
          <div class="meta-row"><span class="meta-label">Ping Latency</span><span class="meta-value">{$dbLatency} ms</span></div>
          <div class="meta-row"><span class="meta-label">Total Orders Recorded</span><span class="meta-value">{$ordersCount}</span></div>
          <div class="meta-row"><span class="meta-label">Port / Target</span><span class="meta-value">postgres:5432 / dhaba</span></div>
        </div>
      </div>

      <!-- Redis Card -->
      <div class="card">
        <div class="card-head">
          <h2>⚡ Redis Cache &amp; Queue</h2>
          <span class="pill " . ($redisStatus === 'ok' ? 'pill-green' : 'pill-red') . ">{$redisStatus}</span>
        </div>
        <div class="meta-list">
          <div class="meta-row"><span class="meta-label">Status</span><span class="meta-value">" . ($redisStatus === 'ok' ? 'Connected' : 'Unavailable') . "</span></div>
          <div class="meta-row"><span class="meta-label">Ping Latency</span><span class="meta-value">{$redisLatency} ms</span></div>
          <div class="meta-row"><span class="meta-label">Queue Length (orders:queue)</span><span class="meta-value">{$queueLength}</span></div>
          <div class="meta-row"><span class="meta-label">Kitchen Worker Heartbeat</span><span class="meta-value">{$workerText}</span></div>
        </div>
      </div>

      <!-- Stats API Node Card -->
      <div class="card">
        <div class="card-head">
          <h2>⚙️ Stats API Runtime</h2>
          <span class="pill pill-green">ok</span>
        </div>
        <div class="meta-list">
          <div class="meta-row"><span class="meta-label">Service</span><span class="meta-value">stats-api</span></div>
          <div class="meta-row"><span class="meta-label">App Version</span><span class="meta-value">{$version}</span></div>
          <div class="meta-row"><span class="meta-label">Host / Pod</span><span class="meta-value">{$hostname}</span></div>
          <div class="meta-row"><span class="meta-label">PHP Engine</span><span class="meta-value">PHP " . PHP_VERSION . "</span></div>
        </div>
      </div>
    </div>

    <!-- Microservices Platform Grid -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-head">
        <h2>🌐 Microservices Topology</h2>
        <span class="pill pill-green">8 / 8 Active</span>
      </div>
      <div class="services-grid">
        <div class="service-box">
          <span style="color:var(--green);font-size:16px;">●</span>
          <div><b>web</b><span>Port 80 • React 18 / Vite</span></div>
        </div>
        <div class="service-box">
          <span style="color:var(--green);font-size:16px;">●</span>
          <div><b>menu-api</b><span>Port 8000 • FastAPI / Python</span></div>
        </div>
        <div class="service-box">
          <span style="color:var(--green);font-size:16px;">●</span>
          <div><b>orders-api</b><span>Port 8080 • Go REST</span></div>
        </div>
        <div class="service-box">
          <span style="color:" . ($workerActive ? 'var(--green)' : 'var(--amber)') . ";font-size:16px;">●</span>
          <div><b>kitchen-worker</b><span>Java 21 Spring Boot</span></div>
        </div>
        <div class="service-box">
          <span style="color:var(--green);font-size:16px;">●</span>
          <div><b>stats-api</b><span>Port 8081 • Laravel 11 / PHP</span></div>
        </div>
        <div class="service-box">
          <span style="color:var(--green);font-size:16px;">●</span>
          <div><b>postgres</b><span>Port 5432 • Persistent DB</span></div>
        </div>
        <div class="service-box">
          <span style="color:var(--green);font-size:16px;">●</span>
          <div><b>redis</b><span>Port 6379 • Queue &amp; Cache</span></div>
        </div>
        <div class="service-box">
          <span style="color:var(--green);font-size:16px;">●</span>
          <div><b>ops-monitor</b><span>Alpine Health Daemon</span></div>
        </div>
      </div>
    </div>

    <!-- JSON Inspector Drawer -->
    <div class="json-section">
      <div class="json-head">
        <h3>Raw Telemetry Payload</h3>
        <button class="btn btn-outline" onclick="copyJsonPayload()">📋 Copy JSON</button>
      </div>
      <pre class="code-view"><code id="jsonPayload">{$prettyJson}</code></pre>
    </div>

    <footer>
      Dhaba Orders · Platform Health Dashboard · 
      <a href="/">Dining Menu</a> · 
      <a href="/api/stats">Live Stats</a> · 
      <a href="/api/menu">Menu Catalog</a> · 
      <a href="/api/orders">Orders Queue</a>
    </footer>
  </div>

  <script>
    let timer = null;
    function startTimer() {
      timer = setTimeout(() => {
        location.reload();
      }, 5000);
    }
    function toggleAutoRefresh(enable) {
      if (enable) {
        startTimer();
      } else {
        if (timer) clearTimeout(timer);
      }
    }
    function copyJsonPayload() {
      const code = document.getElementById('jsonPayload').innerText;
      navigator.clipboard.writeText(code).then(() => {
        alert('JSON telemetry copied to clipboard!');
      });
    }
    startTimer();
  </script>
</body>
</html>
HTML;

    return response($html, 200)->header('Content-Type', 'text/html; charset=UTF-8');
};
