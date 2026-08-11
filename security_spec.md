# Security Specification - Sweta's Atelier

## Data Invariants
1. An item must have a valid price (>= 0).
2. An order must be linked to a valid user.
3. Users can only read their own orders unless they are admins.
4. Admins have full access to all collections for management.
5. Items are publicly readable for browsing.
6. User profiles are only readable/writable by the owner or admin.

## The Dirty Dozen Payloads

1. **Identity Theft (Profile)**: Attempt to update another user's role to 'admin'.
2. **Price Poisoning**: Create an item with a negative price.
3. **Ghost Order**: Create an order for a different user ID.
4. **Mass Scraping**: Read all orders in the system without admin permissions.
5. **Inventory Sabotage**: Delete an item as a guest user.
6. **Self-Promotion**: Sign up and set role as 'admin' in the same write.
7. **Phantom Status**: Update order status to 'delivered' as a customer.
8. **Resource Exhaustion**: Send a 1MB string as an item name.
9. **Relational Bypass**: Create an order with an item ID that doesn't exist.
10. **Timestamp Fraud**: Set `createdAt` to a future date manually.
11. **Idempotency Overflow**: Repeatedly add fields to an array without bounds.
12. **PII Leak**: Access the `users` collection to get email addresses of others.

## Deployment Strategy
We will use a `users` collection to store roles. A global `isAdmin()` helper will check this collection.
The first admin will be hardcoded in the rules for bootstrapping (avishekreg@gmail.com).

```ts
// Hardcoded admin in rules for start
const INITIAL_ADMIN = "avishekreg@gmail.com";
```
