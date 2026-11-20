import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';

const peso = (value) => `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

export default function OrderDetailsPage() {
  const { orderId } = useParams();
  const { user, checking } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api.getOrder(orderId).then(setOrder).catch((caught) => setError(caught.message));
  }, [user, orderId]);

  if (checking) return <section><p>Checking your session…</p></section>;
  if (!user) return <Navigate to={`/signin?next=/account/orders/${orderId}`} replace />;

  return (
    <section>
      <Link to="/account">← My orders</Link>
      <StatusMessage type="error">{error}</StatusMessage>
      {!order && !error && <p>Loading order…</p>}
      {order && (
        <div className="summary">
          <p className="eyebrow">SIMULATED ORDER</p>
          <h1>Order #{order.id}</h1>
          <p><span>Status</span><strong>{order.status}</strong></p>
          <p><span>Deliver to</span><span>{order.customerName}, {order.address}</span></p>
          {order.items.map((item) => (
            <p key={item.id}><span>{item.product?.name || `Product #${item.productId}`} (×{item.quantity})</span><strong>{peso(item.unitPrice * item.quantity)}</strong></p>
          ))}
          <p className="summary-total"><span>Total</span><strong>{peso(order.total)}</strong></p>
        </div>
      )}
    </section>
  );
}
