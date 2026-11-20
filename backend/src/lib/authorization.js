// Returns the HTTP outcome for reading an order: guests 401, non-owners 403, owner 200.
export function orderAccess(user, order) {
  if (!user) return 401;
  if (!order) return 404;
  return order.userId === user.id ? 200 : 403;
}
