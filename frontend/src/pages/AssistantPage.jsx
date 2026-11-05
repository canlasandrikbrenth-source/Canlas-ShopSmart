import { useState } from 'react';
import { Link } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { api } from '../services/api.js';

export default function AssistantPage() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function ask(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      setResult(await api.askAssistant(question));
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="assistant-layout">
      <div>
        <p className="eyebrow">GROUNDED PRODUCT ASSISTANT</p>
        <h1>Find a product</h1>
        <p>Ask ShopSmart for product recommendations grounded in our live active catalog.</p>
        <form onSubmit={ask}>
          <label>
            Your question
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              minLength="3"
              maxLength="300"
              placeholder="Which keyboard is below ₱2,000?"
              required
            />
          </label>
          <button disabled={loading}>
            {loading ? 'Consulting catalog & AI…' : 'Ask ShopSmart'}
          </button>
        </form>
      </div>

      <div className="assistant-answer">
        <h2>Assistant response</h2>
        <StatusMessage type="error">{error}</StatusMessage>

        {loading && (
          <p className="assistant-loading">Searching active catalog and drafting recommendation…</p>
        )}

        {!loading && !result && !error && (
          <p>Your answer will appear here.</p>
        )}

        {!loading && result && (
          <>
            <p className="assistant-text">{result.answer}</p>

            {result.recommendedProducts?.length > 0 && (
              <div className="recommendations">
                <h3>Recommended Products</h3>
                {result.recommendedProducts.map((product) => (
                  <Link key={product.id} to={`/products/${product.id}`} className="recommendation-link">
                    {product.name} — ₱{Number(product.price).toLocaleString('en-PH')}
                  </Link>
                ))}
              </div>
            )}

            {result.sources?.length > 0 && (
              <div className="sources-container" style={{ marginTop: '1.2rem', paddingTop: '1rem', borderTop: '1px solid #dce3eb' }}>
                <p className="eyebrow" style={{ marginBottom: '0.4rem' }}>Authoritative Sources</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {result.sources.map((source) => (
                    <Link
                      key={source.id}
                      to={`/products/${source.id}`}
                      style={{
                        fontSize: '0.85rem',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.4rem',
                        padding: '0.3rem 0.6rem',
                        textDecoration: 'none',
                        color: '#334155'
                      }}
                    >
                      Source #{source.id}: {source.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
