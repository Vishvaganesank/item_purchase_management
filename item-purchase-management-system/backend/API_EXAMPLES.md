# API Examples

## Create Item Type

POST `/api/item-types`

```json
{
  "type_name": "Electronics"
}
```

## Create Item

POST `/api/items`

```json
{
  "name": "Keyboard",
  "item_type_id": 1,
  "purchase_date": "2026-08-25",
  "stock_available": 10,
  "active": true
}
```

## Create Purchase

POST `/api/purchases`

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
    }
  ]
}
```

## Update Purchase

PUT `/api/purchases/1`

```json
{
  "order_id": "PO-00001",
  "purchase_date": "2026-08-26",
  "items": [
    {
      "item_id": 1,
      "quantity": 5
    },
    {
      "item_id": 2,
      "quantity": 2
    }
  ]
}
```
