const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, type_name FROM item_types ORDER BY type_name"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to get item types" });
  }
});

router.post("/", async (req, res) => {
  try {
    const typeName = String(req.body.type_name || "").trim();

    if (!typeName) {
      return res.status(400).json({ message: "Item type name is required" });
    }

    const [result] = await pool.query(
      "INSERT INTO item_types (type_name) VALUES (?)",
      [typeName]
    );

    res.status(201).json({
      id: result.insertId,
      type_name: typeName
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Item type already exists" });
    }
    res.status(500).json({ message: "Failed to create item type" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const typeName = String(req.body.type_name || "").trim();

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid item type ID" });
    }
    if (!typeName) {
      return res.status(400).json({ message: "Item type name is required" });
    }

    const [result] = await pool.query(
      "UPDATE item_types SET type_name = ? WHERE id = ?",
      [typeName, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Item type not found" });
    }

    res.json({ message: "Item type updated" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Item type already exists" });
    }
    res.status(500).json({ message: "Failed to update item type" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid item type ID" });
    }

    const [items] = await pool.query(
      "SELECT id FROM items WHERE item_type_id = ? LIMIT 1",
      [id]
    );

    if (items.length) {
      return res.status(409).json({
        message: "This item type is already used by an item and cannot be deleted"
      });
    }

    const [result] = await pool.query(
      "DELETE FROM item_types WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Item type not found" });
    }

    res.json({ message: "Item type deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete item type" });
  }
});

module.exports = router;
