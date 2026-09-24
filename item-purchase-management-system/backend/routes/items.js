const express = require("express");
const pool = require("../db");

const router = express.Router();

function validateItem(body) {
  const name = String(body.name || "").trim();
  const purchaseDate = body.purchase_date;
  const stock = Number(body.stock_available);
  const itemTypeId = Number(body.item_type_id);
  const active = body.active === undefined ? true : Boolean(body.active);

  if (!name) return "Item name is required";
  if (!purchaseDate || Number.isNaN(new Date(purchaseDate).getTime())) {
    return "Valid purchase date is required";
  }
  if (!Number.isInteger(itemTypeId) || itemTypeId <= 0) {
    return "Valid item type is required";
  }
  if (!Number.isInteger(stock) || stock < 0) {
    return "Stock cannot be negative";
  }

  return null;
}

// JOIN: items + item_types
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        i.id,
        i.name,
        it.type_name,
        i.item_type_id,
        i.purchase_date,
        i.stock_available,
        i.active,
        i.created_at,
        i.updated_at
      FROM items i
      JOIN item_types it ON i.item_type_id = it.id
      ORDER BY i.id DESC
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to get items" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid item ID" });
    }

    const [rows] = await pool.query(`
      SELECT
        i.id,
        i.name,
        it.type_name,
        i.item_type_id,
        i.purchase_date,
        i.stock_available,
        i.active,
        i.created_at,
        i.updated_at
      FROM items i
      JOIN item_types it ON i.item_type_id = it.id
      WHERE i.id = ?
    `, [id]);

    if (!rows.length) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Failed to get item" });
  }
});

router.post("/", async (req, res) => {
  try {
    const error = validateItem(req.body);
    if (error) return res.status(400).json({ message: error });

    const { name, purchase_date, stock_available, item_type_id } = req.body;
    const active = req.body.active === undefined ? true : Boolean(req.body.active);

    const [types] = await pool.query(
      "SELECT id FROM item_types WHERE id = ?",
      [Number(item_type_id)]
    );

    if (!types.length) {
      return res.status(400).json({ message: "Invalid item type" });
    }

    const [result] = await pool.query(`
      INSERT INTO items
        (name, purchase_date, stock_available, item_type_id, active)
      VALUES (?, ?, ?, ?, ?)
    `, [
      String(name).trim(),
      purchase_date,
      Number(stock_available),
      Number(item_type_id),
      active
    ]);

    res.status(201).json({
      message: "Item created",
      id: result.insertId
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to create item" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid item ID" });
    }

    const error = validateItem(req.body);
    if (error) return res.status(400).json({ message: error });

    const [types] = await pool.query(
      "SELECT id FROM item_types WHERE id = ?",
      [Number(req.body.item_type_id)]
    );

    if (!types.length) {
      return res.status(400).json({ message: "Invalid item type" });
    }

    const [result] = await pool.query(`
      UPDATE items
      SET name = ?, purchase_date = ?, stock_available = ?,
          item_type_id = ?, active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      String(req.body.name).trim(),
      req.body.purchase_date,
      Number(req.body.stock_available),
      Number(req.body.item_type_id),
      Boolean(req.body.active),
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json({ message: "Item updated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update item" });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const active = Boolean(req.body.active);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid item ID" });
    }

    const [result] = await pool.query(
      "UPDATE items SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [active, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json({ message: active ? "Item activated" : "Item deactivated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update item status" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid item ID" });
    }

    const [history] = await pool.query(
      "SELECT id FROM purchase_items WHERE item_id = ? LIMIT 1",
      [id]
    );

    if (history.length) {
      return res.status(409).json({
        message: "Item has purchase history. Mark it inactive instead of deleting it."
      });
    }

    const [result] = await pool.query(
      "DELETE FROM items WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete item" });
  }
});

module.exports = router;
