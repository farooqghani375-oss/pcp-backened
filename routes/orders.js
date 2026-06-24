import { Router } from 'express'
import { pool } from '../db.js'
import protect from '../middleware/auth.js'

const router = Router()

// ── POST /api/orders ─────────────────────────────────────────
// Called when customer clicks "Place Order" in Cart.jsx.
// No auth needed — any customer can place an order.
//
// Body shape (mirrors your current Cart.jsx placeOrder() call):
// {
//   customer: { name, phone, email, address, city, notes },
//   items: [{ productId, name, price, quantity, color }],
//   subtotal, shipping, total,
//   payment: 'cod' | 'bank'
// }

router.post('/', async (req, res) => {
  const { customer, items, subtotal, shipping, total, payment } = req.body

  if (!customer?.name || !customer?.phone || !customer?.address) {
    return res.status(400).json({ error: 'Customer name, phone and address are required' })
  }
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Order must have at least one item' })
  }

  // We use a transaction here so that if something fails halfway
  // (e.g. inserting order items), the whole order gets rolled back
  // rather than leaving an empty order with no items in the DB.
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Insert the main order row
    const { rows } = await client.query(
      `INSERT INTO orders
        (customer_name, customer_phone, customer_email, customer_address,
         customer_city, notes, subtotal, shipping, total, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        customer.name, customer.phone, customer.email || null,
        customer.address, customer.city || null, customer.notes || null,
        subtotal, shipping, total, payment
      ]
    )
    const order = rows[0]

    // 2. Insert each line item (we snapshot name + price here so old
    //    orders don't change if you rename/reprice a product later)
    for (const item of items) {
  await client.query(
    `INSERT INTO order_items
      (order_id, product_id, product_name, price, quantity, color, size)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      order.id,
      item.productId || null,
      item.name,
      item.price,
      item.quantity,
      item.color || null,
      item.size || null
    ]
  )
}

    await client.query('COMMIT')

    res.status(201).json({
      message: 'Order placed successfully',
      orderId: order.id
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Failed to place order' })
  } finally {
    client.release()
  }
})

// ── GET /api/orders ──────────────────────────────────────────
// Admin only — list all orders, newest first, with their items.
// Replaces getOrders() + subscribeToOrders() from Firebase.

router.get('/', protect, async (req, res) => {
  try {
    const { rows: orders } = await pool.query(
      'SELECT * FROM orders ORDER BY created_at DESC'
    )

    if (orders.length === 0) return res.json([])

    // Fetch all items for these orders in one query (not N queries)
    const orderIds = orders.map(o => o.id)
    const { rows: items } = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ANY($1)',
      [orderIds]
    )

    // Attach items array to each order (mirrors your Firestore shape)
    const result = orders.map(o => ({
      ...o,
      items: items.filter(i => i.order_id === o.id)
    }))

    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch orders' })
  }
})

// ── GET /api/orders/:id ──────────────────────────────────────
// Admin only — get a single order with its items.

router.get('/:id', protect, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' })

    const { rows: items } = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [req.params.id]
    )

    res.json({ ...rows[0], items })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch order' })
  }
})

// ── PATCH /api/orders/:id/status ────────────────────────────
// Admin only — update order status (Pending → Confirmed → Delivered)
// Replaces updateOrderStatus() from Firebase.
//
// Body: { "status": "Confirmed" }

router.patch('/:id/status', protect, async (req, res) => {
  const { status } = req.body
  const VALID_STATUSES = ['Pending', 'Confirmed', 'Delivered', 'Cancelled']

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Status must be one of: ${VALID_STATUSES.join(', ')}`
    })
  }

  try {
    const { rows } = await pool.query(
      'UPDATE orders SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update order status' })
  }
})

// ── DELETE /api/orders/:id ───────────────────────────────────
// Admin only — delete an order (and its items, via CASCADE in schema)
// Replaces deleteOrder() from Firebase.

router.delete('/:id', protect, async (req, res) => {
  try {
    await pool.query('DELETE FROM orders WHERE id = $1', [req.params.id])
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete order' })
  }
})

export default router
