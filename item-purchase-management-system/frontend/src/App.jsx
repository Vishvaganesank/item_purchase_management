import { useEffect, useState } from "react";
import api from "./api";

const today = new Date().toISOString().slice(0, 10);

function Message({ message, type = "success" }) {
  if (!message) return null;
  return <div className={`message ${type}`}>{message}</div>;
}

function App() {
  const [tab, setTab] = useState("items");
  const [items, setItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [itemForm, setItemForm] = useState({
    id: null,
    name: "",
    item_type_id: "",
    purchase_date: today,
    stock_available: 0,
    active: true
  });

  const [typeName, setTypeName] = useState("");

  const [purchaseForm, setPurchaseForm] = useState({
    id: null,
    order_id: "",
    purchase_date: today,
    item_id: "",
    quantity: 1,
    lines: []
  });

  const [purchaseDetails, setPurchaseDetails] = useState(null);

  function showMessage(text) {
    setError("");
    setMessage(text);
    setTimeout(() => setMessage(""), 3000);
  }

  function showError(err) {
    setMessage("");
    setError(err.response?.data?.message || "Something went wrong");
  }

  async function loadAll() {
    try {
      const [itemRes, typeRes, purchaseRes] = await Promise.all([
        api.get("/items"),
        api.get("/item-types"),
        api.get("/purchases")
      ]);
      setItems(itemRes.data);
      setTypes(typeRes.data);
      setPurchases(purchaseRes.data);
    } catch (err) {
      showError(err);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function resetItemForm() {
    setItemForm({
      id: null,
      name: "",
      item_type_id: "",
      purchase_date: today,
      stock_available: 0,
      active: true
    });
  }

  async function submitItem(e) {
    e.preventDefault();

    try {
      if (itemForm.id) {
        await api.put(`/items/${itemForm.id}`, itemForm);
        showMessage("Item updated successfully");
      } else {
        await api.post("/items", itemForm);
        showMessage("Item created successfully");
      }

      resetItemForm();
      await loadAll();
    } catch (err) {
      showError(err);
    }
  }

  function editItem(item) {
    setItemForm({
      id: item.id,
      name: item.name,
      item_type_id: item.item_type_id,
      purchase_date: item.purchase_date,
      stock_available: item.stock_available,
      active: Boolean(item.active)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleItem(item) {
    try {
      await api.patch(`/items/${item.id}/status`, {
        active: !item.active
      });
      showMessage("Item status updated");
      loadAll();
    } catch (err) {
      showError(err);
    }
  }

  async function deleteItem(id) {
    if (!window.confirm("Delete this item?")) return;

    try {
      await api.delete(`/items/${id}`);
      showMessage("Item deleted");
      loadAll();
    } catch (err) {
      showError(err);
    }
  }

  async function addType(e) {
    e.preventDefault();

    try {
      await api.post("/item-types", { type_name: typeName });
      setTypeName("");
      showMessage("Item type added");
      loadAll();
    } catch (err) {
      showError(err);
    }
  }

  async function deleteType(id) {
    if (!window.confirm("Delete this item type?")) return;

    try {
      await api.delete(`/item-types/${id}`);
      showMessage("Item type deleted");
      loadAll();
    } catch (err) {
      showError(err);
    }
  }

  function addPurchaseLine() {
    const itemId = Number(purchaseForm.item_id);
    const quantity = Number(purchaseForm.quantity);

    if (!itemId || quantity <= 0) {
      setError("Select an item and enter a quantity greater than zero");
      return;
    }

    if (purchaseForm.lines.some(x => x.item_id === itemId)) {
      setError("This item is already added to the order");
      return;
    }

    const item = items.find(x => x.id === itemId);

    if (!item) {
      setError("Item not found");
      return;
    }

    if (!item.active) {
      setError("Inactive item cannot be purchased");
      return;
    }

    if (quantity > item.stock_available) {
      setError(`Only ${item.stock_available} units are available`);
      return;
    }

    setError("");

    setPurchaseForm({
      ...purchaseForm,
      item_id: "",
      quantity: 1,
      lines: [...purchaseForm.lines, {
        item_id: itemId,
        item_name: item.name,
        quantity
      }]
    });
  }

  function removeLine(itemId) {
    setPurchaseForm({
      ...purchaseForm,
      lines: purchaseForm.lines.filter(x => x.item_id !== itemId)
    });
  }

  function resetPurchaseForm() {
    setPurchaseForm({
      id: null,
      order_id: "",
      purchase_date: today,
      item_id: "",
      quantity: 1,
      lines: []
    });
  }

  async function submitPurchase(e) {
    e.preventDefault();

    if (!purchaseForm.order_id.trim()) {
      setError("Order ID is required");
      return;
    }

    if (!purchaseForm.lines.length) {
      setError("Add at least one item to the purchase");
      return;
    }

    try {
      const payload = {
        order_id: purchaseForm.order_id,
        purchase_date: purchaseForm.purchase_date,
        items: purchaseForm.lines.map(x => ({
          item_id: x.item_id,
          quantity: x.quantity
        }))
      };

      if (purchaseForm.id) {
        await api.put(`/purchases/${purchaseForm.id}`, payload);
        showMessage("Purchase updated successfully");
      } else {
        await api.post("/purchases", payload);
        showMessage("Purchase created successfully");
      }

      resetPurchaseForm();
      await loadAll();
    } catch (err) {
      showError(err);
    }
  }

  async function viewPurchase(id) {
    try {
      const res = await api.get(`/purchases/${id}`);
      setPurchaseDetails(res.data);
    } catch (err) {
      showError(err);
    }
  }

  async function editPurchase(id) {
    try {
      const res = await api.get(`/purchases/${id}`);
      const data = res.data;

      setPurchaseForm({
        id: data.id,
        order_id: data.order_id,
        purchase_date: data.purchase_date,
        item_id: "",
        quantity: 1,
        lines: data.items.map(x => ({
          item_id: x.item_id,
          item_name: x.item_name,
          quantity: x.quantity
        }))
      });

      setTab("purchases");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      showError(err);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Item & Purchase Management System</h1>
        <p>Node.js + Express.js + MySQL</p>
      </header>

      <nav className="nav">
        {[
          ["items", "Items"],
          ["types", "Item Types"],
          ["purchases", "Purchases"],
          ["stock", "Stock"]
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main>
        <Message message={message} />
        <Message message={error} type="error" />

        {tab === "items" && (
          <>
            <section className="card">
              <h2>{itemForm.id ? "Update Item" : "Add Item"}</h2>

              <form onSubmit={submitItem} className="form-grid">
                <label>
                  Item Name
                  <input
                    value={itemForm.name}
                    onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                    required
                  />
                </label>

                <label>
                  Item Type
                  <select
                    value={itemForm.item_type_id}
                    onChange={e => setItemForm({ ...itemForm, item_type_id: e.target.value })}
                    required
                  >
                    <option value="">Select type</option>
                    {types.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.type_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Purchase Date
                  <input
                    type="date"
                    value={itemForm.purchase_date}
                    onChange={e => setItemForm({ ...itemForm, purchase_date: e.target.value })}
                    required
                  />
                </label>

                <label>
                  Stock Available
                  <input
                    type="number"
                    min="0"
                    value={itemForm.stock_available}
                    onChange={e => setItemForm({ ...itemForm, stock_available: e.target.value })}
                    required
                  />
                </label>

                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={itemForm.active}
                    onChange={e => setItemForm({ ...itemForm, active: e.target.checked })}
                  />
                  Active
                </label>

                <div>
                  <button className="primary" type="submit">
                    {itemForm.id ? "Update Item" : "Create Item"}
                  </button>
                  {itemForm.id && (
                    <button type="button" onClick={resetItemForm}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="card">
              <h2>Item List</h2>
              <Table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Purchase Date</th>
                    <th>Stock</th>
                    <th>Availability</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.name}</td>
                      <td>{item.type_name}</td>
                      <td>{item.purchase_date}</td>
                      <td>{item.stock_available}</td>
                      <td>
                        <span className={`badge ${item.stock_available > 0 ? "green" : "red"}`}>
                          {item.stock_available > 0 ? "In Stock" : "Out of Stock"}
                        </span>
                      </td>
                      <td>{item.active ? "Active" : "Inactive"}</td>
                      <td className="actions">
                        <button onClick={() => editItem(item)}>Edit</button>
                        <button onClick={() => toggleItem(item)}>
                          {item.active ? "Deactivate" : "Activate"}
                        </button>
                        <button className="danger" onClick={() => deleteItem(item.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </section>
          </>
        )}

        {tab === "types" && (
          <section className="card">
            <h2>Item Type Management</h2>

            <form onSubmit={addType} className="inline-form">
              <input
                placeholder="Example: Electronics"
                value={typeName}
                onChange={e => setTypeName(e.target.value)}
                required
              />
              <button className="primary">Add Type</button>
            </form>

            <Table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type Name</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {types.map(type => (
                  <tr key={type.id}>
                    <td>{type.id}</td>
                    <td>{type.type_name}</td>
                    <td>
                      <button className="danger" onClick={() => deleteType(type.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>
        )}

        {tab === "purchases" && (
          <>
            <section className="card">
              <h2>{purchaseForm.id ? "Update Purchase" : "Create Purchase"}</h2>

              <form onSubmit={submitPurchase}>
                <div className="form-grid">
                  <label>
                    Order ID
                    <input
                      placeholder="PO-00001"
                      value={purchaseForm.order_id}
                      disabled={Boolean(purchaseForm.id)}
                      onChange={e => setPurchaseForm({ ...purchaseForm, order_id: e.target.value })}
                      required
                    />
                  </label>

                  <label>
                    Purchase Date
                    <input
                      type="date"
                      value={purchaseForm.purchase_date}
                      onChange={e => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })}
                      required
                    />
                  </label>
                </div>

                <div className="add-line">
                  <select
                    value={purchaseForm.item_id}
                    onChange={e => setPurchaseForm({ ...purchaseForm, item_id: e.target.value })}
                  >
                    <option value="">Select active item</option>
                    {items.filter(x => x.active && x.stock_available > 0).map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} (Stock: {item.stock_available})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={purchaseForm.quantity}
                    onChange={e => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                  />

                  <button type="button" onClick={addPurchaseLine}>
                    Add Item
                  </button>
                </div>

                {purchaseForm.lines.length > 0 && (
                  <Table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseForm.lines.map(line => (
                        <tr key={line.item_id}>
                          <td>{line.item_name}</td>
                          <td>{line.quantity}</td>
                          <td>
                            <button type="button" onClick={() => removeLine(line.item_id)}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}

                <br />

                <button className="primary" type="submit">
                  {purchaseForm.id ? "Update Purchase" : "Submit Purchase"}
                </button>

                {purchaseForm.id && (
                  <button type="button" onClick={resetPurchaseForm}>
                    Cancel
                  </button>
                )}
              </form>
            </section>

            <section className="card">
              <h2>Purchase History</h2>
              <Table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map(purchase => (
                    <tr key={purchase.id}>
                      <td>{purchase.id}</td>
                      <td>{purchase.order_id}</td>
                      <td>{purchase.purchase_date}</td>
                      <td>{purchase.item_count}</td>
                      <td className="actions">
                        <button onClick={() => viewPurchase(purchase.id)}>
                          View Details
                        </button>
                        <button onClick={() => editPurchase(purchase.id)}>
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </section>

            {purchaseDetails && (
              <section className="card">
                <div className="details-head">
                  <h2>Purchase Details</h2>
                  <button onClick={() => setPurchaseDetails(null)}>Close</button>
                </div>

                <p><strong>Order ID:</strong> {purchaseDetails.order_id}</p>
                <p><strong>Date:</strong> {purchaseDetails.purchase_date}</p>

                <Table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Quantity</th>
                      <th>Current Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseDetails.items.map(item => (
                      <tr key={item.item_id}>
                        <td>{item.item_name}</td>
                        <td>{item.type_name}</td>
                        <td>{item.quantity}</td>
                        <td>{item.stock_available}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </section>
            )}
          </>
        )}

        {tab === "stock" && (
          <section className="card">
            <h2>Stock / Availability</h2>

            <Table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Current Stock</th>
                  <th>Availability</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.type_name}</td>
                    <td>{item.stock_available}</td>
                    <td>
                      <span className={`badge ${
                        item.stock_available === 0
                          ? "red"
                          : item.stock_available <= 5
                          ? "yellow"
                          : "green"
                      }`}>
                        {item.stock_available === 0
                          ? "Out of Stock"
                          : item.stock_available <= 5
                          ? "Low Stock"
                          : "In Stock"}
                      </span>
                    </td>
                    <td>{item.active ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>
        )}
      </main>
    </div>
  );
}

function Table({ children }) {
  return <div className="table-wrap"><table>{children}</table></div>;
}

export default App;
