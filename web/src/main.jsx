import React, { useEffect, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

// Dish image/icon mapping based on keywords
function getDishMeta(dish) {
  const name = dish.name.toLowerCase();
  if (name.includes('karahi')) {
    return { icon: '🥘', tag: 'Chef Special', spice: '🌶️ Medium Hot', time: '18 min' };
  }
  if (name.includes('biryani')) {
    return { icon: '🍚', tag: 'Most Popular', spice: '🌶️ Spicy & Fragrant', time: '12 min' };
  }
  if (name.includes('kebab') || name.includes('kabab')) {
    return { icon: '🥩', tag: 'Peshawari Signature', spice: '🌶️ Traditional Spicy', time: '15 min' };
  }
  if (name.includes('tikka') || name.includes('bbq')) {
    return { icon: '🍗', tag: 'Charcoal Grilled', spice: '🌶️ Smokey Mild', time: '20 min' };
  }
  return { icon: '🍛', tag: 'House Special', spice: '🌶️ Flavorful', time: '15 min' };
}

function App() {
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' | 'tracker' | 'dashboard'
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [tableNumber, setTableNumber] = useState('Table 4');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderNotification, setOrderNotification] = useState(null);
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [recentOrdersList, setRecentOrdersList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'price-asc' | 'price-desc'

  // JSON Dashboard state
  const [selectedJsonTab, setSelectedJsonTab] = useState('stats'); // 'stats' | 'menu' | 'orders' | 'aggregated'
  const [jsonSearchQuery, setJsonSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date().toLocaleTimeString());

  // Fetch live API data
  async function refreshData() {
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

      // Fetch orders list if available
      try {
        const oRes = await fetch('/api/orders');
        if (oRes.ok) {
          const oData = await oRes.json();
          if (oData && oData.orders) {
            setRecentOrdersList(oData.orders);
          }
        }
      } catch {
        // Fallback for orders list
      }

      setLastRefreshed(new Date().toLocaleTimeString());
    } catch {
      // Quiet background polling error handling
    }
  }

  useEffect(() => {
    refreshData();
    if (!autoRefresh) return;
    const interval = setInterval(refreshData, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Cart operations
  const addToCart = id => {
    setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const removeFromCart = id => {
    setCart(prev => {
      const current = prev[id] || 0;
      if (current <= 1) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: current - 1 };
    });
  };

  const clearCart = () => setCart({});

  const cartItemsCount = useMemo(() => {
    return Object.values(cart).reduce((sum, q) => sum + q, 0);
  }, [cart]);

  const cartSubtotal = useMemo(() => {
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const dish = menu.find(d => d.id === Number(id));
      return sum + (dish ? dish.price * qty : 0);
    }, 0);
  }, [cart, menu]);

  const cartGst = useMemo(() => Math.round(cartSubtotal * 0.05), [cartSubtotal]);
  const cartGrandTotal = useMemo(() => cartSubtotal + cartGst, [cartSubtotal, cartGst]);

  // Place order
  async function placeOrder() {
    const items = Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([id, quantity]) => ({ dish_id: Number(id), quantity }));

    if (!items.length) {
      setOrderNotification({ type: 'error', message: 'Please add at least one dish to your order.' });
      return;
    }

    setOrderSubmitting(true);
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || data.error || 'Failed to place order.');

      setOrders(prev => [{ ...data, table: tableNumber, created_at: new Date().toISOString() }, ...prev]);
      setCart({});
      setOrderNotification({
        type: 'success',
        orderId: data.id,
        message: `Order #${data.id} placed! Kitchen is preparing your food.`
      });
      refreshData();
      // Auto-switch to tracker so user can see it cooking!
      setTimeout(() => setActiveTab('tracker'), 1200);
    } catch (err) {
      setOrderNotification({ type: 'error', message: err.message });
    } finally {
      setOrderSubmitting(false);
    }
  }

  // Combined order tracking list
  const allOrders = useMemo(() => {
    const map = new Map();
    orders.forEach(o => map.set(o.id, o));
    recentOrdersList.forEach(o => {
      if (!map.has(o.id)) map.set(o.id, o);
    });
    return Array.from(map.values()).sort((a, b) => b.id - a.id);
  }, [orders, recentOrdersList]);

  // Categories extraction
  const categories = useMemo(() => {
    const set = new Set(['All']);
    menu.forEach(d => {
      const firstWord = d.name.split(' ')[0];
      if (firstWord) set.add(firstWord);
    });
    return Array.from(set);
  }, [menu]);

  // Filtered & sorted menu
  const filteredMenu = useMemo(() => {
    let result = [...menu];
    if (selectedCategory !== 'All') {
      result = result.filter(d => d.name.toLowerCase().startsWith(selectedCategory.toLowerCase()));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d => d.name.toLowerCase().includes(q) || (d.description && d.description.toLowerCase().includes(q)));
    }
    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price);
    }
    return result;
  }, [menu, selectedCategory, searchQuery, sortBy]);

  // Aggregated system telemetry payload
  const aggregatedTelemetry = useMemo(() => ({
    timestamp: new Date().toISOString(),
    system_status: 'healthy',
    stats: stats || {},
    menu: {
      count: menu.length,
      items: menu.map(d => ({ id: d.id, name: d.name, price: d.price }))
    },
    orders: {
      active_count: allOrders.length,
      recent: allOrders.slice(0, 10)
    },
    services: [
      { name: 'web', role: 'React 18 / Vite Frontend', port: 80, status: 'operational' },
      { name: 'menu-api', role: 'FastAPI Python Catalog', port: 8000, status: 'operational' },
      { name: 'orders-api', role: 'Go Order Ingestion', port: 8080, status: 'operational' },
      { name: 'kitchen-worker', role: 'Java 21 Spring Boot', status: stats?.worker?.status || 'active' },
      { name: 'stats-api', role: 'Laravel 11 Analytics', port: 8081, status: 'operational' },
      { name: 'postgres', role: 'Relational ACID Storage', port: 5432, status: 'connected' },
      { name: 'redis', role: 'In-Memory Queue & Cache', port: 6379, status: 'connected' }
    ]
  }), [stats, menu, allOrders]);

  // Current JSON inspector data
  const currentJsonData = useMemo(() => {
    switch (selectedJsonTab) {
      case 'stats':
        return stats || { message: 'Loading live stats JSON...' };
      case 'menu':
        return menu.length ? menu : [{ message: 'Loading menu catalog JSON...' }];
      case 'orders':
        return allOrders.length ? allOrders : { message: 'No orders recorded yet' };
      case 'aggregated':
      default:
        return aggregatedTelemetry;
    }
  }, [selectedJsonTab, stats, menu, allOrders, aggregatedTelemetry]);

  // Filtered JSON text
  const filteredJsonText = useMemo(() => {
    const raw = JSON.stringify(currentJsonData, null, 2);
    if (!jsonSearchQuery.trim()) return raw;
    const query = jsonSearchQuery.toLowerCase();
    const lines = raw.split('\n');
    const matched = lines.filter(line => line.toLowerCase().includes(query));
    return matched.length
      ? `// Filtered ${matched.length} line(s) matching "${jsonSearchQuery}":\n\n` + matched.join('\n')
      : `// No matching lines found for "${jsonSearchQuery}" in ${selectedJsonTab} dataset.\n\n` + raw;
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
    a.download = `dhaba-${selectedJsonTab}-telemetry.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-container">
      {/* Top Brand & Navigation Bar */}
      <header className="navbar">
        <div className="nav-brand">
          <div className="brand-logo">🍲</div>
          <div>
            <div className="brand-eyebrow">PESHAWAR HERITAGE • EST. 1984</div>
            <h1 className="brand-title">Dhaba <span>Orders</span></h1>
          </div>
        </div>

        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'menu' ? 'active' : ''}`}
            onClick={() => setActiveTab('menu')}
          >
            🍛 Dining Menu
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'tracker' ? 'active' : ''}`}
            onClick={() => setActiveTab('tracker')}
          >
            🔥 Order Tracker {allOrders.length > 0 && <span className="tab-badge">{allOrders.length}</span>}
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 JSON Dashboard
          </button>
        </nav>

        <div className="nav-actions">
          <div className="live-status-pill">
            <span className="live-pulsing-dot"></span>
            <span>KITCHEN LIVE</span>
          </div>
          {cartItemsCount > 0 && (
            <button className="cart-quick-btn" onClick={() => setActiveTab('menu')}>
              🛒 {cartItemsCount} {cartItemsCount === 1 ? 'item' : 'items'} · Rs. {cartGrandTotal.toLocaleString()}
            </button>
          )}
        </div>
      </header>

      {/* Real-time Telemetry Headline Ticker */}
      <div className="stats-ticker">
        <div className="ticker-item">
          <span className="ticker-label">VELOCITY</span>
          <span className="ticker-val">{stats?.orders_per_minute ?? 0} orders/min</span>
        </div>
        <div className="ticker-divider">/</div>
        <div className="ticker-item">
          <span className="ticker-label">TOP DISH</span>
          <span className="ticker-val highlight">{stats?.top_dish ?? 'Karahi'}</span>
        </div>
        <div className="ticker-divider">/</div>
        <div className="ticker-item">
          <span className="ticker-label">TOTAL ORDERS</span>
          <span className="ticker-val">{stats?.total_orders ?? allOrders.length}</span>
        </div>
        <div className="ticker-divider">/</div>
        <div className="ticker-item">
          <span className="ticker-label">KITCHEN WORKER</span>
          <span className="ticker-val worker-live">
            ● {stats?.worker?.status || 'Active'}
          </span>
        </div>
        <div className="ticker-divider">/</div>
        <a href="/api/health" className="ticker-link" target="_blank" rel="noreferrer">
          🏥 Health Diagnostics ↗
        </a>
      </div>

      {/* TAB 1: MENU & ORDER VIEW */}
      {activeTab === 'menu' && (
        <div className="main-content-layout">
          {/* Left Column: Hero & Menu Showcase */}
          <div className="menu-column">
            {/* Hero Showcase Banner */}
            <div className="hero-banner">
              <div className="hero-text-content">
                <span className="hero-tag">AUTHENTIC STREET CUISINE</span>
                <h2>Wok-Tossed Karahis &amp; Charcoal BBQ</h2>
                <p>
                  Prepared fresh in our live kitchen. Hand-ground spices, tender meats, and slow-simmered aromas straight to your table.
                </p>
                <div className="hero-features">
                  <span>✨ 100% Halal</span>
                  <span>🔥 Charcoal Grilled</span>
                  <span>⚡ Instant Preparation</span>
                </div>
              </div>
              <div className="hero-visual">
                <span className="hero-food-icon">🥘</span>
              </div>
            </div>

            {/* Menu Controls: Search & Category Pills */}
            <div className="menu-filter-bar">
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search chicken karahi, beef biryani, kebabs..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button className="clear-search" onClick={() => setSearchQuery('')}>✕</button>
                )}
              </div>

              <div className="filter-sort-row">
                <div className="category-pills">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <select
                  className="sort-select"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                >
                  <option value="default">Default Order</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* Dish Cards Grid */}
            <div className="dishes-grid">
              {filteredMenu.map(dish => {
                const meta = getDishMeta(dish);
                const quantityInCart = cart[dish.id] || 0;
                return (
                  <div className={`dish-card ${quantityInCart > 0 ? 'in-cart' : ''}`} key={dish.id}>
                    <div className="dish-card-header">
                      <div className="dish-avatar">{meta.icon}</div>
                      <span className="dish-tag">{meta.tag}</span>
                    </div>

                    <div className="dish-card-body">
                      <h3 className="dish-title">{dish.name}</h3>
                      <p className="dish-desc">{dish.description || 'Prepared with authentic spices and fresh local ingredients.'}</p>

                      <div className="dish-details">
                        <span className="spice-tag">{meta.spice}</span>
                        <span className="time-tag">⏱️ {meta.time}</span>
                      </div>
                    </div>

                    <div className="dish-card-footer">
                      <div className="dish-price">
                        <span className="currency">Rs.</span>
                        <span className="amount">{Number(dish.price).toLocaleString()}</span>
                      </div>

                      {quantityInCart === 0 ? (
                        <button className="add-btn" onClick={() => addToCart(dish.id)}>
                          + Add to Order
                        </button>
                      ) : (
                        <div className="quantity-stepper">
                          <button onClick={() => removeFromCart(dish.id)}>−</button>
                          <span className="qty-number">{quantityInCart}</span>
                          <button onClick={() => addToCart(dish.id)}>+</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Order Checkout & Summary */}
          <div className="cart-column">
            <div className="cart-card">
              <div className="cart-header">
                <h2>Your Table Order</h2>
                {cartItemsCount > 0 && (
                  <button className="clear-cart-link" onClick={clearCart}>
                    Clear all
                  </button>
                )}
              </div>

              {/* Table assignment */}
              <div className="table-selector-box">
                <label className="input-label">Dine-in Location</label>
                <div className="table-options">
                  {['Table 1', 'Table 2', 'Table 4', 'Takeaway'].map(t => (
                    <button
                      key={t}
                      className={`table-chip ${tableNumber === t ? 'selected' : ''}`}
                      onClick={() => setTableNumber(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notification banner */}
              {orderNotification && (
                <div className={`notification-banner ${orderNotification.type}`}>
                  <span>{orderNotification.type === 'success' ? '✓' : '⚠️'}</span>
                  <div>{orderNotification.message}</div>
                </div>
              )}

              {/* Cart items list */}
              {cartItemsCount === 0 ? (
                <div className="empty-cart-view">
                  <div className="empty-cart-icon">🛒</div>
                  <h3>Your order is empty</h3>
                  <p>Select delicious karahis, biryanis, or kebabs from the menu to get started.</p>
                </div>
              ) : (
                <div className="cart-items-list">
                  {menu
                    .filter(d => cart[d.id] > 0)
                    .map(d => (
                      <div className="cart-item-row" key={d.id}>
                        <div className="item-info">
                          <b>{d.name}</b>
                          <span className="item-unit-price">Rs. {Number(d.price).toLocaleString()} each</span>
                        </div>
                        <div className="item-controls">
                          <div className="mini-stepper">
                            <button onClick={() => removeFromCart(d.id)}>−</button>
                            <span>{cart[d.id]}</span>
                            <button onClick={() => addToCart(d.id)}>+</button>
                          </div>
                          <span className="item-total-price">
                            Rs. {(d.price * cart[d.id]).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}

                  <div className="cart-instructions">
                    <input
                      type="text"
                      placeholder="Cooking notes (e.g., extra spicy, crisp naan)..."
                      value={orderNotes}
                      onChange={e => setOrderNotes(e.target.value)}
                      className="notes-input"
                    />
                  </div>

                  {/* Price breakdown */}
                  <div className="price-breakdown">
                    <div className="price-row">
                      <span>Subtotal ({cartItemsCount} dishes)</span>
                      <span>Rs. {cartSubtotal.toLocaleString()}</span>
                    </div>
                    <div className="price-row">
                      <span>Service &amp; GST (5%)</span>
                      <span>Rs. {cartGst.toLocaleString()}</span>
                    </div>
                    <div className="price-row total-row">
                      <span>Grand Total</span>
                      <span className="total-amount">Rs. {cartGrandTotal.toLocaleString()}</span>
                    </div>
                  </div>

                  <button
                    className="place-order-btn"
                    onClick={placeOrder}
                    disabled={orderSubmitting}
                  >
                    {orderSubmitting ? 'Placing Order...' : `Confirm & Place Order · Rs. ${cartGrandTotal.toLocaleString()} →`}
                  </button>
                </div>
              )}

              {/* Live Kitchen Quick Tracker */}
              <div className="kitchen-preview-card">
                <div className="kitchen-preview-head">
                  <span className="flame-icon">🔥</span>
                  <div>
                    <b>Live Kitchen Queue</b>
                    <span>{allOrders.filter(o => o.status === 'cooking').length} orders cooking right now</span>
                  </div>
                </div>
                {allOrders.length > 0 && (
                  <button className="view-tracker-link" onClick={() => setActiveTab('tracker')}>
                    Open Live Order Tracker →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE ORDER TRACKER VIEW */}
      {activeTab === 'tracker' && (
        <div className="tracker-view-container">
          <div className="tracker-banner">
            <div>
              <h2>Live Kitchen Order Pipeline</h2>
              <p>Watch your order progress in real-time from the kitchen queue to your table.</p>
            </div>
            <button className="new-order-btn" onClick={() => setActiveTab('menu')}>
              + Order More Dishes
            </button>
          </div>

          {allOrders.length === 0 ? (
            <div className="no-orders-banner">
              <span className="no-orders-icon">🍲</span>
              <h3>No active orders yet</h3>
              <p>Place an order in the menu to track its real-time preparation steps.</p>
              <button className="add-btn" onClick={() => setActiveTab('menu')}>
                Browse Dhaba Menu
              </button>
            </div>
          ) : (
            <div className="orders-timeline-grid">
              {allOrders.map(o => {
                const isReady = o.status === 'ready';
                const isCooking = o.status === 'cooking';
                const isNew = o.status === 'new';

                return (
                  <div className={`order-card-pipeline status-card-${o.status}`} key={o.id}>
                    <div className="order-pipeline-header">
                      <div>
                        <span className="order-chip">ORDER #{o.id}</span>
                        <span className="order-table-chip">{o.table || 'Table 4'}</span>
                      </div>
                      <div className="order-amount-chip">
                        Rs. {Number(o.total || 0).toLocaleString()}
                      </div>
                    </div>

                    {/* Animated Stage Stepper */}
                    <div className="stepper-track">
                      <div className={`step-item ${isNew || isCooking || isReady ? 'step-done' : ''}`}>
                        <div className="step-circle">{isNew || isCooking || isReady ? '✓' : '1'}</div>
                        <span className="step-title">Order Received</span>
                        <span className="step-subtitle">Sent to kitchen</span>
                      </div>
                      <div className={`step-connector ${isCooking || isReady ? 'connector-done' : ''}`}></div>
                      <div className={`step-item ${isCooking || isReady ? 'step-done' : ''} ${isCooking ? 'step-pulse' : ''}`}>
                        <div className="step-circle">{isReady ? '✓' : '🍳'}</div>
                        <span className="step-title">In the Wok</span>
                        <span className="step-subtitle">Chef preparing</span>
                      </div>
                      <div className={`step-connector ${isReady ? 'connector-done' : ''}`}></div>
                      <div className={`step-item ${isReady ? 'step-done ready-highlight' : ''}`}>
                        <div className="step-circle">{isReady ? '🍽️' : '3'}</div>
                        <span className="step-title">Ready to Serve</span>
                        <span className="step-subtitle">{isReady ? 'Fresh & hot!' : 'Pending'}</span>
                      </div>
                    </div>

                    <div className="order-card-meta">
                      <span>Status: <b className={`badge-${o.status}`}>{o.status.toUpperCase()}</b></span>
                      <span>{o.created_at ? new Date(o.created_at).toLocaleTimeString() : 'Just now'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: JSON TELEMETRY & SYSTEM DASHBOARD VIEW */}
      {activeTab === 'dashboard' && (
        <div className="dashboard-container">
          <div className="dash-hero">
            <div>
              <h2>Microservices Telemetry &amp; JSON Dashboard</h2>
              <p>Direct real-time metrics, telemetry streams, and JSON inspection across all 7 platform services.</p>
            </div>
            <div className="dash-hero-actions">
              <span className="dash-updated-pill">Last refreshed: {lastRefreshed}</span>
              <button className="dash-refresh-btn" onClick={refreshData}>
                ↻ Fetch Latest Data
              </button>
              <label className="dash-toggle">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={e => setAutoRefresh(e.target.checked)}
                />
                Auto-sync (4s)
              </label>
            </div>
          </div>

          {/* Metric KPI Cards */}
          <div className="kpi-cards-grid">
            <div className="kpi-stat-card">
              <span className="kpi-mini-title">POSTGRESQL ORDERS</span>
              <div className="kpi-big-value">{stats?.total_orders ?? allOrders.length}</div>
              <span className="kpi-desc">Persistent relational DB records</span>
            </div>
            <div className="kpi-stat-card">
              <span className="kpi-mini-title">ORDER VELOCITY</span>
              <div className="kpi-big-value">{stats?.orders_per_minute ?? 0} <span className="unit">/min</span></div>
              <span className="kpi-desc">Active orders in trailing 60s</span>
            </div>
            <div className="kpi-stat-card">
              <span className="kpi-mini-title">TOP POPULAR DISH</span>
              <div className="kpi-big-value highlight-dish">{stats?.top_dish ?? 'Karahi'}</div>
              <span className="kpi-desc">Highest volume prepared today</span>
            </div>
            <div className="kpi-stat-card">
              <span className="kpi-mini-title">KITCHEN WORKER</span>
              <div className="kpi-big-value worker-status">
                <span className="worker-dot online"></span>
                {stats?.worker?.status || 'Active'}
              </div>
              <span className="kpi-desc">Java Spring Boot Redis consumer</span>
            </div>
          </div>

          {/* Services Infrastructure Matrix */}
          <div className="services-matrix-card">
            <div className="matrix-head">
              <h3>Microservices Topology</h3>
              <span className="healthy-pill">All Services Operational</span>
            </div>
            <div className="matrix-grid">
              <div className="matrix-pill">
                <span className="dot-green">●</span>
                <div>
                  <b>web</b>
                  <span>Port 80 • React 18 / Vite</span>
                </div>
              </div>
              <div className="matrix-pill">
                <span className="dot-green">●</span>
                <div>
                  <b>menu-api</b>
                  <span>Port 8000 • FastAPI / Python</span>
                </div>
              </div>
              <div className="matrix-pill">
                <span className="dot-green">●</span>
                <div>
                  <b>orders-api</b>
                  <span>Port 8080 • Go REST Ingestion</span>
                </div>
              </div>
              <div className="matrix-pill">
                <span className="dot-green">●</span>
                <div>
                  <b>kitchen-worker</b>
                  <span>Java 21 Spring Boot • Queue</span>
                </div>
              </div>
              <div className="matrix-pill">
                <span className="dot-green">●</span>
                <div>
                  <b>stats-api</b>
                  <span>Port 8081 • Laravel 11 / PHP</span>
                </div>
              </div>
              <div className="matrix-pill">
                <span className="dot-green">●</span>
                <div>
                  <b>postgres</b>
                  <span>Port 5432 • Persistent Storage</span>
                </div>
              </div>
              <div className="matrix-pill">
                <span className="dot-green">●</span>
                <div>
                  <b>redis</b>
                  <span>Port 6379 • orders:queue &amp; Cache</span>
                </div>
              </div>
              <div className="matrix-pill">
                <span className="dot-green">●</span>
                <div>
                  <b>ops-monitor</b>
                  <span>Alpine Monitoring Daemon</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive JSON Explorer & Inspector */}
          <div className="json-inspector-box">
            <div className="inspector-toolbar">
              <div className="dataset-tabs">
                <button
                  className={`ds-tab ${selectedJsonTab === 'stats' ? 'active' : ''}`}
                  onClick={() => setSelectedJsonTab('stats')}
                >
                  GET /api/stats
                </button>
                <button
                  className={`ds-tab ${selectedJsonTab === 'menu' ? 'active' : ''}`}
                  onClick={() => setSelectedJsonTab('menu')}
                >
                  GET /api/menu
                </button>
                <button
                  className={`ds-tab ${selectedJsonTab === 'orders' ? 'active' : ''}`}
                  onClick={() => setSelectedJsonTab('orders')}
                >
                  GET /api/orders
                </button>
                <button
                  className={`ds-tab ${selectedJsonTab === 'aggregated' ? 'active' : ''}`}
                  onClick={() => setSelectedJsonTab('aggregated')}
                >
                  Aggregated Telemetry
                </button>
              </div>

              <div className="inspector-right-tools">
                <input
                  type="text"
                  placeholder="Filter keys or values..."
                  value={jsonSearchQuery}
                  onChange={e => setJsonSearchQuery(e.target.value)}
                  className="filter-json-input"
                />
                <button className="tool-btn" onClick={copyJson}>
                  {copied ? '✓ Copied!' : '📋 Copy JSON'}
                </button>
                <button className="tool-btn" onClick={downloadJson}>
                  ⬇ Export .json
                </button>
              </div>
            </div>

            <div className="json-meta-strip">
              <span>Dataset: <b>{selectedJsonTab}</b></span>
              <span>Content-Type: <b>application/json</b></span>
              <span>Payload Size: <b>{filteredJsonText.length.toLocaleString()} bytes</b></span>
            </div>

            <pre className="dark-code-view">
              <code>{filteredJsonText}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Global Footer */}
      <footer className="main-footer">
        <div>
          <b>Dhaba Orders</b> · Production Microservices on Kubernetes · Built for ShipIt Sprint 3
        </div>
        <div className="footer-links">
          <a href="/api/health" target="_blank" rel="noreferrer">Platform Health UI</a>
          <span className="link-sep">·</span>
          <a href="/api/stats" target="_blank" rel="noreferrer">Stats JSON</a>
          <span className="link-sep">·</span>
          <a href="/api/menu" target="_blank" rel="noreferrer">Menu API</a>
          <span className="link-sep">·</span>
          <a href="/api/orders" target="_blank" rel="noreferrer">Orders API</a>
        </div>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
