import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import StatusMessage from '../components/StatusMessage.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../services/api.js';
import { calculateItemSubtotal } from '../utils/cart.js';

export default function CheckoutPage() {
  const { cart, total, clearCart } = useCart();
  const { user, checking } = useAuth();
  const [form, setForm] = useState({ customerName: user?.name || '', email: user?.email || '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);

  // Prefill delivery name and email once the signed-in customer is known.
  useEffect(() => {
    if (user) setForm((current) => ({ ...current, customerName: current.customerName || user.name, email: current.email || user.email }));
  }, [user]);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitOrder(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const created = await api.createOrder({
        ...form,
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity }))
      });
      setOrder(created);
      clearCart();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (order) return (
    <section className="success-card">
      <p className="eyebrow">ORDER RECEIVED</p>
      <h1>Thank you, {order.customerName}!</h1>
      <p>Your simulated order number is <strong>#{order.id}</strong>.</p>
      <p><Link to={`/account/orders/${order.id}`}>View this order in My account</Link></p>
      <p>Total: <strong>₱{Number(order.total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></p>
      <Link className="button" to="/">Continue shopping</Link>
    </section>
  );

  if (cart.length === 0) return <section><div className="empty-state"><h1>Your cart is empty</h1><Link className="button" to="/">Browse products</Link></div></section>;

  if (checking) return <section><p>Checking your session…</p></section>;
  if (!user) return (
    <section><div className="empty-state">
      <p className="eyebrow">SIGN-IN REQUIRED</p>
      <h1>Sign in to place your simulated order</h1>
      <p>Orders are saved to your test account so only you can view them.</p>
      <Link className="button" to="/signin?next=/checkout">Sign in or create a test account</Link>
    </div></section>
  );

  return (
    <section className="checkout-layout">
      <form onSubmit={submitOrder}>
        <p className="eyebrow">SIMULATED CHECKOUT</p><h1>Delivery information</h1>
        <StatusMessage type="error">{error}</StatusMessage>
        <label>Full name<input name="customerName" value={form.customerName} onChange={updateField} minLength="2" maxLength="80" required /></label>
        <label>Email address<input name="email" type="email" value={form.email} onChange={updateField} required /></label>
        <label>Delivery address<textarea name="address" value={form.address} onChange={updateField} minLength="10" maxLength="300" required /></label>
        <button disabled={submitting}>{submitting ? 'Submitting order…' : 'Place simulated order'}</button>
      </form>
      <aside className="summary">
        <h2>Order summary</h2>
        {cart.map((item) => (
          <p key={item.productId}>
            <span>{item.name} (×{item.quantity})</span>
            <strong>₱{calculateItemSubtotal(item).toLocaleString('en-PH')}</strong>
          </p>
        ))}
        <p className="summary-total"><span>Total</span><strong>₱{total.toLocaleString('en-PH')}</strong></p>
        <small>No actual payment will be collected.</small>
      </aside>
    </section>
  );
}
