import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);

  async function refresh() {
    try {
      const [m, s] = await Promise.all([fetch('/api/menu'), fetch('/api/stats')]);
      if (m.ok) setMenu(await m.json());
      if (s.ok) setStats(await s.json());
    } catch { setMessage('API services are starting. Please retry shortly.'); }
  }
  useEffect(() => { refresh(); const t = setInterval(refresh, 10000); return () => clearInterval(t); }, []);
  const add = id => setCart(c => ({...c, [id]: (c[id] || 0) + 1}));
  async function placeOrder() {
    const items = Object.entries(cart).filter(([,q]) => q > 0).map(([id,quantity]) => ({dish_id:Number(id),quantity}));
    if (!items.length) return setMessage('Add at least one dish first.');
    try {
      const r = await fetch('/api/orders', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})});
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || data.error || 'Order failed');
      setOrders(o => [data, ...o]); setCart({}); setMessage(`Order #${data.id} placed successfully.`); refresh();
    } catch(e) { setMessage(e.message); }
  }
  return <main>
    <header><div><p className="eyebrow">PESHAWAR • FRESH FROM THE KITCHEN</p><h1>Dhaba <span>Orders</span></h1></div><div className="live">● LIVE KITCHEN</div></header>
    <section className="hero"><div><p className="eyebrow">GOOD FOOD. NO WAIT.</p><h2>Your favourite dhaba meals,<br/>delivered to your table.</h2><p>Order fresh, watch the kitchen prepare it.</p></div><div className="hero-mark">🍲</div></section>
    <section className="layout"><div><div className="section-head"><h2>Today's Menu</h2><span>{menu.length} dishes</span></div>
      <div className="menu">{menu.map(d=><article className="dish" key={d.id}><div className="dish-icon">🍛</div><div className="dish-info"><h3>{d.name}</h3><p>{d.description}</p><b>Rs. {Number(d.price).toLocaleString()}</b></div><button onClick={()=>add(d.id)}>+ Add</button></article>)}</div>
    </div><aside><h2>Your order</h2>{menu.filter(d=>cart[d.id]).map(d=><p key={d.id}>{d.name} × {cart[d.id]}</p>)}<button className="checkout" onClick={placeOrder}>Place order</button>{message && <p className="message">{message}</p>}
      <div className="stats"><h3>Live stats</h3><p>Orders/min <b>{stats?.orders_per_minute ?? '—'}</b></p><p>Total orders <b>{stats?.total_orders ?? '—'}</b></p><p>Top dish <b>{stats?.top_dish ?? '—'}</b></p></div>
      <div className="stats"><h3>Recent orders</h3>{orders.map(o=><p key={o.id}>#{o.id} — {o.status}</p>)}</div>
    </aside></section><footer>Dhaba Orders · Built for ShipIt Sprint 3</footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
