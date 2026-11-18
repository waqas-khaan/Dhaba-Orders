import React, { useEffect, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' | 'dashboard'
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [recentOrdersList, setRecentOrdersList] = useState([]);
  const [selectedJsonTab, setSelectedJsonTab] = useState('stats'); // 'stats' | 'menu' | 'orders' | 'aggregated'
  const [jsonSearchQuery, setJsonSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date().toLocaleTimeString());

  async function refresh() {
    try {
      const [mRes, sRes] = await Promise.all([
        fetch('/api/menu').catch(() => null),
        fetch('/api/stats').catch(() => null)
      ]);

      if (mRes && mRes.ok) {
        const mData = await mRes.json();
        setMenu(mData);
      }
      if (sRes && sRes.ok) {
        const sData = await sRes.json();
        setStats(sData);
      }

      // Fetch recent orders if available
      try {
        const oRes = await fetch('/api/orders');
        if (oRes.ok) {
          const oData = await oRes.json();
          if (oData && oData.orders) {
            setRecentOrdersList(oData.orders);
          }
        }
      } catch {
        // Fallback or optional
      }

      setLastRefreshed(new Date().toLocaleTimeString());
    } catch {
      setMessage('API services are starting. Please retry shortly.');
    }
  }

  useEffect(() => {
    refresh();
    if (!autoRefresh) return;
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const add = id => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));

  async function placeOrder() {
    const items = Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([id, quantity]) => ({ dish_id: Number(id), quantity }));
    if (!items.length) return setMessage('Add at least one dish first.');
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || data.error || 'Order failed');
      setOrders(o => [data, ...o]);
      setCart({});
      setMessage(`Order #${data.id} placed successfully.`);
      refresh();
    } catch (e) {
      setMessage(e.message);
    }
  }

  // Combined orders data for dashboard
  const combinedOrders = useMemo(() => {
    const map = new Map();
    orders.forEach(o => map.set(o.id, o));
    recentOrdersList.forEach(o => {
      if (!map.has(o.id)) map.set(o.id, o);
    });
    return Array.from(map.values()).sort((a, b) => b.id - a.id);
  }, [orders, recentOrdersList]);

  // Aggregated system telemetry JSON
  const aggregatedTelemetry = useMemo(() => ({
    timestamp: new Date().toISOString(),
    system_status: 'healthy',
    stats: stats || {},
    menu_summary: {
      total_items: menu.length,
      sample_dishes: menu.map(d => ({ id: d.id, name: d.name, price: d.price }))
    },
    orders_summary: {
      session_orders: orders.length,
      tracked_orders: combinedOrders.length,
      recent: combinedOrders.slice(0, 5)
    },
    services: [
      { name: 'web', role: 'React/Vite Frontend', port: 80, status: 'operational' },
      { name: 'menu-api', role: 'FastAPI Menu Catalog', port: 8000, status: 'operational' },
      { name: 'orders-api', role: 'Go Orders Ingestion', port: 8080, status: 'operational' },
      { name: 'kitchen-worker', role: 'Java Spring Processor', status: stats?.worker?.status || 'active' },
      { name: 'stats-api', role: 'Laravel Analytics Engine', port: 8081, status: 'operational' },
      { name: 'postgres', role: 'Relational Database', port: 5432, status: 'connected' },
      { name: 'redis', role: 'Queue & Cache Broker', port: 6379, status: 'connected' }
    ]
  }), [stats, menu, orders, combinedOrders]);

  // Active dataset for JSON Viewer
  const currentJsonData = useMemo(() => {
    switch (selectedJsonTab) {
      case 'stats':
        return stats || { message: 'Loading stats JSON...' };
      case 'menu':
        return menu.length ? menu : [{ message: 'Loading menu JSON...' }];
      case 'orders':
        return combinedOrders.length ? combinedOrders : { message: 'No orders recorded yet' };
      case 'aggregated':
      default:
        return aggregatedTelemetry;
    }
  }, [selectedJsonTab, stats, menu, combinedOrders, aggregatedTelemetry]);

  // Filter JSON by search query
  const filteredJsonText = useMemo(() => {
    const raw = JSON.stringify(currentJsonData, null, 2);
    if (!jsonSearchQuery.trim()) return raw;
    const query = jsonSearchQuery.toLowerCase();
    const lines = raw.split('\n');
    const matched = lines.filter(line => line.toLowerCase().includes(query));
    return matched.length
      ? `// Filtered ${matched.length} line(s) matching "${jsonSearchQuery}":\n\n` + matched.join('\n')
      : `// No matching lines found for "${jsonSearchQuery}" in ${selectedJsonTab} JSON dataset.\n\n` + raw;
  }, [currentJsonData, jsonSearchQuery, selectedJsonTab]);

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(currentJsonData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(currentJsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dhaba-${selectedJsonTab}-data.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">PESHAWAR • FRESH FROM THE KITCHEN</p>
          <h1>Dhaba <span>Orders</span></h1>
        </div>
        <div className="nav-controls">
          <div className="tab-buttons">
            <button
              className={`tab-btn ${activeTab === 'menu' ? 'active' : ''}`}
              onClick={() => setActiveTab('menu')}
            >
              🍲 Menu &amp; Order
            </button>
            <button
              className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 JSON Data Dashboard
            </button>
          </div>
          <div className="live">● LIVE KITCHEN</div>
        </div>
      </header>

      {activeTab === 'menu' ? (
        <>
          <section className="hero">
            <div>
              <p className="eyebrow">GOOD FOOD. NO WAIT.</p>
              <h2>Your favourite dhaba meals,<br />delivered to your table.</h2>
              <p>Order fresh, watch the kitchen prepare it.</p>
              <div style={{ marginTop: '16px' }}>
                <button className="dashboard-shortcut" onClick={() => setActiveTab('dashboard')}>
                  View Live JSON Dashboard →
                </button>
              </div>
            </div>
            <div className="hero-mark">🍲</div>
          </section>

          <section className="layout">
            <div>
              <div className="section-head">
                <h2>Today&apos;s Menu</h2>
                <span>{menu.length} dishes</span>
              </div>
              <div className="menu">
                {menu.map(d => (
                  <article className="dish" key={d.id}>
                    <div className="dish-icon">🍛</div>
                    <div className="dish-info">
                      <h3>{d.name}</h3>
                      <p>{d.description}</p>
                      <b>Rs. {Number(d.price).toLocaleString()}</b>
                    </div>
                    <button onClick={() => add(d.id)}>+ Add</button>
                  </article>
                ))}
              </div>
            </div>

            <aside>
              <h2>Your order</h2>
              {menu.filter(d => cart[d.id]).map(d => (
                <p key={d.id}>{d.name} × {cart[d.id]}</p>
              ))}
              <button className="checkout" onClick={placeOrder}>Place order</button>
              {message && <p className="message">{message}</p>}
              <div className="stats">
                <h3>Live stats</h3>
                <p>Orders/min <b>{stats?.orders_per_minute ?? '—'}</b></p>
                <p>Total orders <b>{stats?.total_orders ?? '—'}</b></p>
                <p>Top dish <b>{stats?.top_dish ?? '—'}</b></p>
              </div>
              <div className="stats">
                <h3>Recent orders</h3>
                {combinedOrders.slice(0, 5).map(o => (
                  <p key={o.id}>#{o.id} — <span className={`status-badge status-${o.status}`}>{o.status}</span></p>
                ))}
              </div>
            </aside>
          </section>
        </>
      ) : (
        <section className="dashboard-section">
          <div className="dashboard-header">
            <div>
              <h2>JSON Data Dashboard</h2>
              <p className="dashboard-subtitle">
                Real-time JSON telemetry from Dhaba Orders microservices platform
              </p>
            </div>
            <div className="dashboard-actions">
              <span className="last-refresh">Last updated: {lastRefreshed}</span>
              <button
                className={`refresh-btn ${autoRefresh ? 'active-pulse' : ''}`}
                onClick={refresh}
                title="Fetch latest JSON metrics"
              >
                ↻ Refresh Now
              </button>
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={e => setAutoRefresh(e.target.checked)}
                />
                Auto-refresh (5s)
              </label>
            </div>
          </div>

          {/* Metric KPI Cards */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">TOTAL ORDERS</span>
              <div className="kpi-value">{stats?.total_orders ?? 0}</div>
              <span className="kpi-sub">Lifetime PostgreSQL records</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">VELOCITY</span>
              <div className="kpi-value">{stats?.orders_per_minute ?? 0} <span className="unit">/min</span></div>
              <span className="kpi-sub">Orders in last 60 seconds</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">TOP DISH</span>
              <div className="kpi-value kpi-highlight">{stats?.top_dish ?? 'None'}</div>
              <span className="kpi-sub">Highest quantity ordered</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">KITCHEN WORKER</span>
              <div className="kpi-value">
                <span className="status-indicator online"></span>
                {stats?.worker?.status || 'Active'}
              </div>
              <span className="kpi-sub">Spring Boot Redis Consumer</span>
            </div>
          </div>

          {/* Microservices Health Grid */}
          <div className="services-health-card">
            <h3>Microservices &amp; Infrastructure Health</h3>
            <div className="services-grid">
              <div className="service-pill">
                <span className="indicator active">●</span>
                <div className="service-details">
                  <b>web</b>
                  <span>Port 80 • React 18 / Vite</span>
                </div>
              </div>
              <div className="service-pill">
                <span className="indicator active">●</span>
                <div className="service-details">
                  <b>menu-api</b>
                  <span>Port 8000 • FastAPI / Python</span>
                </div>
              </div>
              <div className="service-pill">
                <span className="indicator active">●</span>
                <div className="service-details">
                  <b>orders-api</b>
                  <span>Port 8080 • Go REST</span>
                </div>
              </div>
              <div className="service-pill">
                <span className="indicator active">●</span>
                <div className="service-details">
                  <b>kitchen-worker</b>
                  <span>Java 21 Spring Boot • Queue</span>
                </div>
              </div>
              <div className="service-pill">
                <span className="indicator active">●</span>
                <div className="service-details">
                  <b>stats-api</b>
                  <span>Port 8081 • Laravel 11 / PHP</span>
                </div>
              </div>
              <div className="service-pill">
                <span className="indicator active">●</span>
                <div className="service-details">
                  <b>postgres</b>
                  <span>Port 5432 • Persistent DB</span>
                </div>
              </div>
              <div className="service-pill">
                <span className="indicator active">●</span>
                <div className="service-details">
                  <b>redis</b>
                  <span>Port 6379 • Broker &amp; Cache</span>
                </div>
              </div>
              <div className="service-pill">
                <span className="indicator active">●</span>
                <div className="service-details">
                  <b>ops-monitor</b>
                  <span>Alpine Monitoring Daemon</span>
                </div>
              </div>
            </div>
          </div>

          {/* JSON Explorer / Inspector */}
          <div className="json-inspector-card">
            <div className="inspector-header">
              <div className="json-tabs">
                <button
                  className={`json-tab ${selectedJsonTab === 'stats' ? 'active' : ''}`}
                  onClick={() => setSelectedJsonTab('stats')}
                >
                  GET /api/stats
                </button>
                <button
                  className={`json-tab ${selectedJsonTab === 'menu' ? 'active' : ''}`}
                  onClick={() => setSelectedJsonTab('menu')}
                >
                  GET /api/menu
                </button>
                <button
                  className={`json-tab ${selectedJsonTab === 'orders' ? 'active' : ''}`}
                  onClick={() => setSelectedJsonTab('orders')}
                >
                  GET /api/orders
                </button>
                <button
                  className={`json-tab ${selectedJsonTab === 'aggregated' ? 'active' : ''}`}
                  onClick={() => setSelectedJsonTab('aggregated')}
                >
                  Aggregated Telemetry
                </button>
              </div>

              <div className="inspector-controls">
                <input
                  type="text"
                  placeholder="Filter keys or values..."
                  value={jsonSearchQuery}
                  onChange={e => setJsonSearchQuery(e.target.value)}
                  className="json-search-input"
                />
                <button className="json-btn" onClick={copyJson}>
                  {copied ? '✓ Copied!' : '📋 Copy JSON'}
                </button>
                <button className="json-btn" onClick={downloadJson}>
                  ⬇ Export .json
                </button>
              </div>
            </div>

            <div className="json-viewer-container">
              <div className="json-viewer-meta">
                <span>Dataset: <b>{selectedJsonTab}</b></span>
                <span>Format: <b>application/json</b></span>
                <span>Size: <b>{filteredJsonText.length} bytes</b></span>
              </div>
              <pre className="json-code-block">
                <code>{filteredJsonText}</code>
              </pre>
            </div>
          </div>

          {/* Orders Pipeline Real-Time Table */}
          <div className="orders-pipeline-card">
            <h3>Recent Orders Lifecycle</h3>
            {combinedOrders.length === 0 ? (
              <p className="no-orders-note">No orders placed yet. Place an order in the menu to observe real-time status transitions!</p>
            ) : (
              <div className="orders-table-wrapper">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Created At</th>
                      <th>Pipeline Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedOrders.slice(0, 10).map(o => (
                      <tr key={o.id}>
                        <td><b>#{o.id}</b></td>
                        <td>
                          <span className={`status-badge status-${o.status}`}>
                            {o.status}
                          </span>
                        </td>
                        <td>Rs. {Number(o.total || 0).toLocaleString()}</td>
                        <td>{o.created_at ? new Date(o.created_at).toLocaleTimeString() : 'Just now'}</td>
                        <td>
                          <div className="pipeline-steps">
                            <span className={`step-dot ${o.status === 'new' || o.status === 'cooking' || o.status === 'ready' ? 'done' : ''}`} title="Order Received">● new</span>
                            <span className="step-arrow">→</span>
                            <span className={`step-dot ${o.status === 'cooking' || o.status === 'ready' ? 'done' : ''}`} title="Kitchen Cooking">● cooking</span>
                            <span className="step-arrow">→</span>
                            <span className={`step-dot ${o.status === 'ready' ? 'done' : ''}`} title="Ready for Pickup">● ready</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      <footer>
        Dhaba Orders · High Performance Microservices on Kubernetes · Built for ShipIt Sprint 3
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
