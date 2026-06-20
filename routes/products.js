import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// Helper: given a list of product rows, fetch their images/colors
// and attach them as arrays -- this is us doing in JavaScript what
// Firestore did automatically (a product object with images[] and
// colors[] baked in), but now built from two separate tables.
async function attachExtras(products) {
  if (products.length === 0) return products
  const ids = products.map(p => p.id)

  const { rows: images } = await pool.query(
    'SELECT * FROM product_images WHERE product_id = ANY($1) ORDER BY sort_order',
    [ids]
  )
  const { rows: colors } = await pool.query(
    'SELECT * FROM product_colors WHERE product_id = ANY($1)',
    [ids]
  )

  return products.map(p => ({
    ...p,
    images: images.filter(i => i.product_id === p.id).map(i => i.image_url),
    colors: colors.filter(c => c.product_id === p.id).map(c => c.hex_color)
  }))
}

// GET /api/products -- list everything (used by Shop.jsx / Home.jsx)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products ORDER BY id')
    res.json(await attachExtras(rows))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch products' })
  }
})

// GET /api/products/:id -- single product (used by ProductDetail.jsx)
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' })
    const [product] = await attachExtras(rows)
    res.json(product)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch product' })
  }
})

// POST /api/products -- create (used by Admin.jsx)
router.post('/', async (req, res) => {
  const {
    name, price, category, description,
    featured = false, inStock = true, stockQty = 0,
    images = [], colors = []
  } = req.body

  if (!name || !price || !category) {
    return res.status(400).json({ error: 'name, price and category are required' })
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO products (name, price, category, description, featured, in_stock, stock_qty)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, price, category, description, featured, inStock, stockQty]
    )
    const product = rows[0]

    for (const [i, url] of images.entries()) {
      await pool.query(
        'INSERT INTO product_images (product_id, image_url, sort_order) VALUES ($1,$2,$3)',
        [product.id, url, i]
      )
    }
    for (const hex of colors) {
      await pool.query(
        'INSERT INTO product_colors (product_id, hex_color) VALUES ($1,$2)',
        [product.id, hex]
      )
    }

    res.status(201).json({ ...product, images, colors })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create product' })
  }
})

// PUT /api/products/:id -- update core fields (used by Admin.jsx)
router.put('/:id', async (req, res) => {
  const { name, price, category, description, featured, inStock, stockQty } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE products
       SET name=$1, price=$2, category=$3, description=$4, featured=$5, in_stock=$6, stock_qty=$7
       WHERE id=$8 RETURNING *`,
      [name, price, category, description, featured, inStock, stockQty, req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update product' })
  }
})

// DELETE /api/products/:id (used by Admin.jsx)
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id])
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete product' })
  }
})

export default router
