import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';

const peso = (value) => `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

export default function AccountPage() {
  const { user, checking, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api.getMyOrders().then((data) => setOrders(data.orders)).catch((caught) => setError(caught.message));
  }, [user]);

  if (checking) return <section><p>Checking your session…</p></section>;
  if (!user) return <Navigate to="/signin?next=/account" replace />;

  async function signOut() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <section>
      <p className="eyebrow">MY ACCOUNT</p>
      <h1>Hello, {user.name}</h1>
      <p>Signed in as <strong>{user.email}</strong>. <button type="button" className="link-button" onClick={signOut}>Sign out</button></p>
      <h2>My simulated orders</h2>
      <StatusMessage type="error">{error}</StatusMessage>
      {orders === null && !error && <p>Loading orders…</p>}
      {orders?.length === 0 && <div className="empty-state"><p>You have no orders yet.</p><Link className="button" to="/">Browse products</Link></div>}
      {orders?.length > 0 && (
        <ul className="order-list">
          {orders.map((order) => (
            <li key={order.id}>
              <Link to={`/account/orders/${order.id}`}>Order #{order.id}</Link>
              <span>{new Date(order.createdAt).toLocaleString('en-PH')}</span>
              <span>{order.items.length} item(s)</span>
              <strong>{peso(order.total)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
