const express = require("express");
const cors = require("cors");
require("dotenv").config();

const itemRoutes = require("./routes/items");
const typeRoutes = require("./routes/itemTypes");
const purchaseRoutes = require("./routes/purchases");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Item & Purchase Management API is running" });
});

app.use("/api/items", itemRoutes);
app.use("/api/item-types", typeRoutes);
app.use("/api/purchases", purchaseRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
