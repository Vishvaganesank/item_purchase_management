const express = require("express");
const pool = require("../db");

const router = express.Router();

function validDate(value) {
  return value && !Number.isNaN(new Date(value).getTime());
}

function validateLines(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "Purchase must contain at least one item";
  }

  const seen = new Set();

  for (const line of items) {
    const itemId = Number(line.item_id);
    const quantity = Number(line.quantity);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return "Invalid item ID";
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return "Quantity must be greater than zero";
    }

    if (seen.has(itemId)) {
      return "Duplicate items are not allowed in one order";
    }

    seen.add(itemId);
  }

  return null;
}

// Purchase list
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        p.id,
        p.order_id,
        p.purchase_date,
        p.created_at,
        COUNT(pi.id) AS item_count
      FROM purchases p
      LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
      GROUP BY p.id
      ORDER BY p.id DESC
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to get purchases" });
  }
});

// Mandatory JOIN: purchase + purchase_items + items + item_types
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid purchase ID" });
    }

    const [rows] = await pool.query(`
      SELECT
        p.id,
        p.order_id,
        p.purchase_date,
        pi.item_id,
        i.name AS item_name,
        it.type_name,
        pi.quantity,
        i.stock_available
      FROM purchases p
      JOIN purchase_items pi ON p.id = pi.purchase_id
      JOIN items i ON pi.item_id = i.id
      JOIN item_types it ON i.item_type_id = it.id
      WHERE p.id = ?
      ORDER BY pi.id
    `, [id]);

    if (!rows.length) {
      const [purchase] = await pool.query(
        "SELECT id, order_id, purchase_date FROM purchases WHERE id = ?",
        [id]
      );

      if (!purchase.length) {
        return res.status(404).json({ message: "Purchase not found" });
      }

      return res.json({
        id: purchase[0].id,
        order_id: purchase[0].order_id,
        purchase_date: purchase[0].purchase_date,
        items: []
      });
    }

    res.json({
      id: rows[0].id,
      order_id: rows[0].order_id,
      purchase_date: rows[0].purchase_date,
      items: rows.map(row => ({
        item_id: row.item_id,
        item_name: row.item_name,
        type_name: row.type_name,
        quantity: row.quantity,
        stock_available: row.stock_available
      }))
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to get purchase details" });
  }
});

async function savePurchase(connection, purchaseId, orderId, purchaseDate, items) {
  const validationError = validateLines(items);
  if (validationError) {
    const error = new Error(validationError);
    error.status = 400;
    throw error;
  }

  if (!orderId || !String(orderId).trim()) {
    const error = new Error("Order ID is required");
    error.status = 400;
    throw error;
  }

  if (!validDate(purchaseDate)) {
    const error = new Error("Valid purchase date is required");
    error.status = 400;
    throw error;
  }

  const itemIds = items.map(x => Number(x.item_id));

  // Lock item rows during validation/update.
  const placeholders = itemIds.map(() => "?").join(",");
  const [itemRows] = await connection.query(`
    SELECT id, name, stock_available, active
    FROM items
    WHERE id IN (${placeholders})
    FOR UPDATE
  `, itemIds);

  const itemMap = new Map(itemRows.map(item => [item.id, item]));

  for (const line of items) {
    const item = itemMap.get(Number(line.item_id));

    if (!item) {
      const error = new Error(`Item ${line.item_id} not found`);
      error.status = 404;
      throw error;
    }

    if (!item.active) {
      const error = new Error(`${item.name} is inactive and cannot be purchased`);
      error.status = 409;
      throw error;
    }
  }

  let oldLines = [];

  if (purchaseId) {
    const [purchaseRows] = await connection.query(
      "SELECT id, order_id FROM purchases WHERE id = ? FOR UPDATE",
      [purchaseId]
    );

    if (!purchaseRows.length) {
      const error = new Error("Purchase not found");
      error.status = 404;
      throw error;
    }

    if (String(orderId).trim() !== purchaseRows[0].order_id) {
      const error = new Error("Order ID cannot be changed");
      error.status = 400;
      throw error;
    }

    const [oldRows] = await connection.query(
      "SELECT item_id, quantity FROM purchase_items WHERE purchase_id = ?",
      [purchaseId]
    );

    oldLines = oldRows;
  } else {
    const [existing] = await connection.query(
      "SELECT id FROM purchases WHERE order_id = ?",
      [String(orderId).trim()]
    );

    if (existing.length) {
      const error = new Error("Order ID already exists");
      error.status = 409;
      throw error;
    }
  }

  const oldMap = new Map(oldLines.map(x => [x.item_id, x.quantity]));
  const newMap = new Map(items.map(x => [Number(x.item_id), Number(x.quantity)]));

  // Check final stock after reversing old purchase and applying new purchase.
  for (const itemId of new Set([...oldMap.keys(), ...newMap.keys()])) {
    const item = itemMap.get(Number(itemId));

    if (!item) {
      // An old line should normally always exist. This is a safety check.
      const [found] = await connection.query(
        "SELECT id, name, stock_available, active FROM items WHERE id = ? FOR UPDATE",
        [itemId]
      );
      if (!found.length) {
        const error = new Error(`Item ${itemId} not found`);
        error.status = 404;
        throw error;
      }
      itemMap.set(itemId, found[0]);
    }

    const oldQty = oldMap.get(itemId) || 0;
    const newQty = newMap.get(itemId) || 0;
    const finalStock = itemMap.get(itemId).stock_available + oldQty - newQty;

    if (finalStock < 0) {
      const error = new Error(
        `Insufficient stock for ${itemMap.get(itemId).name}. Available: ${itemMap.get(itemId).stock_available + oldQty}`
      );
      error.status = 409;
      throw error;
    }
  }

  if (!purchaseId) {
    const [result] = await connection.query(
      "INSERT INTO purchases (order_id, purchase_date) VALUES (?, ?)",
      [String(orderId).trim(), purchaseDate]
    );
    purchaseId = result.insertId;
  } else {
    await connection.query(
      "UPDATE purchases SET purchase_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [purchaseDate, purchaseId]
    );
  }

  if (purchaseId) {
    // Return old stock first, then apply new quantities.
    for (const [itemId, oldQty] of oldMap) {
      if (oldQty > 0) {
        await connection.query(
          "UPDATE items SET stock_available = stock_available + ? WHERE id = ?",
          [oldQty, itemId]
        );
      }
    }

    await connection.query(
      "DELETE FROM purchase_items WHERE purchase_id = ?",
      [purchaseId]
    );

    for (const line of items) {
      await connection.query(
        "INSERT INTO purchase_items (purchase_id, item_id, quantity) VALUES (?, ?, ?)",
        [purchaseId, Number(line.item_id), Number(line.quantity)]
      );

      await connection.query(
        "UPDATE items SET stock_available = stock_available - ? WHERE id = ?",
        [Number(line.quantity), Number(line.item_id)]
      );
    }
  }

  return purchaseId;
}

router.post("/", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const purchaseId = await savePurchase(
      connection,
      null,
      req.body.order_id,
      req.body.purchase_date,
      req.body.items
    );

    await connection.commit();

    res.status(201).json({
      message: "Purchase created successfully",
      id: purchaseId
    });
  } catch (err) {
    await connection.rollback();

    res.status(err.status || 500).json({
      message: err.status ? err.message : "Failed to create purchase"
    });
  } finally {
    connection.release();
  }
});

router.put("/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const purchaseId = Number(req.params.id);

    if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
      const error = new Error("Invalid purchase ID");
      error.status = 400;
      throw error;
    }

    await savePurchase(
      connection,
      purchaseId,
      req.body.order_id,
      req.body.purchase_date,
      req.body.items
    );

    await connection.commit();

    res.json({ message: "Purchase updated successfully" });
  } catch (err) {
    await connection.rollback();

    res.status(err.status || 500).json({
      message: err.status ? err.message : "Failed to update purchase"
    });
  } finally {
    connection.release();
  }
});

// Intentionally NO DELETE /:id route.
// Purchases are historical records and must not be deleted.

module.exports = router;
