import { useEffect, useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard.jsx';
import StatusMessage from '../components/StatusMessage.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../services/api.js';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sortOption, setSortOption] = useState('default');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { addToCart, cartMessage } = useCart();

  useEffect(() => {
    let active = true;
    api.getProducts()
      .then((data) => active && setProducts(data.products))
      .catch((caught) => active && setError(caught.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const categories = useMemo(
    () => ['All', ...new Set(products.map((product) => product.category))],
    [products]
  );

  const query = search.trim().toLowerCase();
  const visibleProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query);
    const matchesCategory = category === 'All' || product.category === category;
    return matchesSearch && matchesCategory;
  });

  // Sort a shallow copy so the original filtered list is never mutated.
  // Number() coerces prices that may arrive as numeric strings from the API.
  const sortedProducts = useMemo(() => {
    const copy = [...visibleProducts];
    switch (sortOption) {
      case 'price-asc':
        return copy.sort((a, b) => Number(a.price) - Number(b.price));
      case 'price-desc':
        return copy.sort((a, b) => Number(b.price) - Number(a.price));
      case 'name-asc':
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return copy;
    }
  }, [visibleProducts, sortOption]);

  return (
    <section>
      <div className="hero">
        <div>
          <p className="eyebrow">BSIT FULL-STACK PROJECT</p>
          <h1>Technology for study, work and play</h1>
          <p>Browse the starter catalog, build a cart and complete a simulated order.</p>
        </div>
      </div>

      <div className="toolbar">
        <label>
          <span>Search products</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try keyboard" />
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select id="sort-select" value={sortOption} onChange={(event) => setSortOption(event.target.value)}>
            <option value="default">Default</option>
            <option value="price-asc">Price low to high</option>
            <option value="price-desc">Price high to low</option>
            <option value="name-asc">Name A to Z</option>
          </select>
        </label>
      </div>

      <StatusMessage>{cartMessage}</StatusMessage>
      {loading && <StatusMessage>Loading products…</StatusMessage>}
      {error && <StatusMessage type="error">{error} Make sure the backend is running.</StatusMessage>}
      {!loading && !error && sortedProducts.length === 0 && <StatusMessage>No products match your filters.</StatusMessage>}

      <div className="product-grid">
        {sortedProducts.map((product) => (
          <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
        ))}
      </div>
    </section>
  );
}
