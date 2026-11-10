import { describe, expect, it } from 'vitest';
import {
  addProductToCart,
  calculateCartTotal,
  calculateItemSubtotal,
  updateCartQuantity
} from './cart.js';

describe('cart utilities', () => {
  it('calculates the cart total', () => {
    expect(calculateCartTotal([
      { price: 100, quantity: 2 },
      { price: 50, quantity: 3 }
    ])).toBe(350);
  });

  it('calculates an item subtotal', () => {
    expect(calculateItemSubtotal({ price: 250, quantity: 3 })).toBe(750);
  });

  it('adds a new product', () => {
    const result = addProductToCart([], { id: 1, name: 'Mouse', price: 500, stock: 2 });
    expect(result.error).toBe('');
    expect(result.cart[0].quantity).toBe(1);
  });

  it('prevents adding a product beyond available stock limit', () => {
    const cart = [{ productId: 1, name: 'Mouse', price: 500, stock: 2, quantity: 2 }];
    const result = addProductToCart(cart, { id: 1, name: 'Mouse', price: 500, stock: 2 });
    expect(result.error).toContain('Only 2 unit(s) of Mouse are available.');
    expect(result.cart[0].quantity).toBe(2);
  });

  it('increases cart quantity by one', () => {
    const cart = [{ productId: 1, name: 'Mouse', price: 500, stock: 5, quantity: 1 }];
    const result = updateCartQuantity(cart, 1, 2);
    expect(result.error).toBe('');
    expect(result.cart[0].quantity).toBe(2);
  });

  it('decreases cart quantity by one', () => {
    const cart = [{ productId: 1, name: 'Mouse', price: 500, stock: 5, quantity: 2 }];
    const result = updateCartQuantity(cart, 1, 1);
    expect(result.error).toBe('');
    expect(result.cart[0].quantity).toBe(1);
  });

  it('prevents a quantity below 1', () => {
    const cart = [{ productId: 1, name: 'Mouse', price: 500, stock: 5, quantity: 1 }];
    expect(updateCartQuantity(cart, 1, 0).error).toContain('greater than zero');
  });

  it('prevents a quantity above stock', () => {
    const cart = [{ productId: 1, name: 'Mouse', price: 500, stock: 1, quantity: 1 }];
    expect(updateCartQuantity(cart, 1, 2).error).toContain('Only 1');
  });
});
