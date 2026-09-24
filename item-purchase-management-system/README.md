# Item & Purchase Management System



## Technologies

- Frontend: React + Vite
- Backend: Node.js + Express.js
- Database: MySQL
- HTTP client: Axios

## Features

- Item Type CRUD
- Item CRUD
- Active / Inactive item status
- Item stock and availability
- Purchase with multiple items
- Backend validation
- Stock validation
- MySQL transactions
- Purchase update with stock adjustment
- Purchase history
- Purchase details using SQL JOIN
- Purchase deletion is intentionally not implemented
- Item deletion is blocked when purchase history exists
- Basic responsive CSS

## Project Structure

```text
item-purchase-management-system/
  backend/
    routes/
      items.js
      itemTypes.js
      purchases.js
    db.js
    server.js
    schema.sql
    package.json
    .env.example
  frontend/
    src/
      App.jsx
      api.js
      main.jsx
      style.css
    index.html
    vite.config.js
    package.json
  README.md
```

## 1. Database Setup

Open MySQL Workbench or MySQL command line.

Run:

```sql
SOURCE path/to/backend/schema.sql;
```

The script creates:

- item_types
- items
- purchases
- purchase_items

It also inserts a few sample item types and items.

## 2. Backend Setup

Open a terminal:

```bash
cd backend
npm install
```

Copy `.env.example` to `.env`.

Example:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=item_purchase_db
```

Start backend:

```bash
npm start
```

For development:

```bash
npm run dev
```

Backend runs at:

```text
http://localhost:5000
```

## 3. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL shown by Vite, normally:

```text
http://localhost:5173
```

## API Endpoints

### Items

```text
POST   /api/items
GET    /api/items
GET    /api/items/:id
PUT    /api/items/:id
PATCH  /api/items/:id/status
DELETE /api/items/:id
```

### Item Types

```text
GET    /api/item-types
POST   /api/item-types
PUT    /api/item-types/:id
DELETE /api/item-types/:id
```

### Purchases

```text
POST   /api/purchases
GET    /api/purchases
GET    /api/purchases/:id
PUT    /api/purchases/:id
```

There is intentionally no:

```text
DELETE /api/purchases/:id
```

because purchases are historical transactions.

## Example Purchase JSON

```json
{
  "order_id": "PO-00001",
  "purchase_date": "2026-08-25",
  "items": [
    {
      "item_id": 1,
      "quantity": 2
    },
    {
      "item_id": 2,
      "quantity": 5
    },
    {
      "item_id": 3,
      "quantity": 3
    }
  ]
}
```

## Important Business Logic

When a purchase is created:

1. Begin transaction.
2. Validate all items.
3. Check that every item exists.
4. Check that every item is active.
5. Check available stock.
6. Insert purchase.
7. Insert purchase items.
8. Deduct stock.
9. Commit transaction.

If any step fails, rollback is performed.

For purchase updates, the old quantities are returned to stock first and the new quantities are deducted. This handles cases such as changing quantity from 3 to 5 or from 5 to 2.

## SQL JOIN Demonstration

The item list uses:

```sql
SELECT
  i.id,
  i.name,
  it.type_name,
  i.purchase_date,
  i.stock_available,
  i.active
FROM items i
JOIN item_types it ON i.item_type_id = it.id;
```

Purchase details use:

```sql
SELECT
  p.order_id,
  p.purchase_date,
  i.id AS item_id,
  i.name AS item_name,
  it.type_name,
  pi.quantity
FROM purchases p
JOIN purchase_items pi ON p.id = pi.purchase_id
JOIN items i ON pi.item_id = i.id
JOIN item_types it ON i.item_type_id = it.id
WHERE p.id = ?;
```

## Testing the Assignment Example

The sample data contains:

- Laptop - Electronics - 10
- Mouse - Electronics - 20
- Chair - Furniture - 15

Create:

```text
PO-00001

Laptop  2
Mouse   5
Chair   3
```

Expected stock:

```text
Laptop  8
Mouse   15
Chair   12
```

Then try to purchase 10 laptops. The backend should reject it because only 8 are available.




