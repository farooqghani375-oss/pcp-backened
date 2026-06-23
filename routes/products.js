import { Router } from 'express'
import { pool } from '../db.js'
import { cloudinary, upload } from '../cloudinary.js'

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

const router = Router()

// Helper: attach images, colors (with stock+image), and sizes to products
async function attachExtras(products) {
  if (products.length === 0) return products
  const ids = products.map(p => p.id)

  const { rows: images } = await pool.query(
    'SELECT * FROM product_images WHERE product_id = ANY($1) ORDER BY sort_order',
    [ids]
  )
  const { rows: colors } = await pool.query(
    'SELECT id, product_id, hex_color, stock_qty, image_url FROM product_colors WHERE product_id = ANY($1)',
    [ids]
  )
  const { rows: sizes } = await pool.query(
    'SELECT id, product_id, size_label, unit FROM product_sizes WHERE product_id = ANY($1)',
    [ids]
  )

  return products.map(p => ({
    ...p,
    images: images.filter(i => i.product_id === p.id).map(i => i.image_url),
    colors: colors.filter(c => c.product_id === p.id).map(c => ({
      id: c.id,
      hex_color: c.hex_color,
      stock_qty: c.stock_qty,
      image_url: c.image_url
    })),
    sizes: sizes.filter(s => s.product_id === p.id).map(s => ({
      id: s.id,
      size_label: s.size_label,
      unit: s.unit
    }))
  }))
}

// POST /api/products/upload-image
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' })
    res.json({ url: req.file.path })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Image upload failed' })
  }
})

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products ORDER BY id')
    res.json(await attachExtras(rows))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch products' })
  }
})

// GET /api/products/slug/:slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM products WHERE slug = $1', [req.params.slug]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' })
    const [product] = await attachExtras(rows)
    res.json(product)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch product' })
  }
})

// GET /api/products/:id
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

// POST /api/products
router.post('/', async (req, res) => {
  const {
    name, price, category, description,
    featured = false, inStock = true, stockQty = 0,
    images = [], colors = [], sizes = []
  } = req.body

  if (!name || !price || !category) {
    return res.status(400).json({ error: 'name, price and category are required' })
  }

  try {
    const slug = generateSlug(name)
    const { rows } = await pool.query(
      `INSERT INTO products (name, price, category, description, featured, in_stock, stock_qty, slug)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, price, category, description, featured, inStock, stockQty, slug]
    )
    const product = rows[0]

    // Insert images
    for (const [i, url] of images.entries()) {
      await pool.query(
        'INSERT INTO product_images (product_id, image_url, sort_order) VALUES ($1,$2,$3)',
        [product.id, url, i]
      )
    }

    // Insert colors with stock_qty and image_url
    for (const color of colors) {
      await pool.query(
        'INSERT INTO product_colors (product_id, hex_color, stock_qty, image_url) VALUES ($1,$2,$3,$4)',
        [product.id, color.hex, color.stock_qty || 0, color.image_url || null]
      )
    }

    // Insert sizes
    for (const size of sizes) {
      await pool.query(
        'INSERT INTO product_sizes (product_id, size_label, unit) VALUES ($1,$2,$3)',
        [product.id, size.size_label, size.unit]
      )
    }

    const [full] = await attachExtras([product])
    res.status(201).json(full)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create product' })
  }
})

// PUT /api/products/:id
router.put('/:id', async (req, res) => {
  const {
    name, price, category, description,
    featured, inStock, stockQty,
    images = [], colors = [], sizes = []
  } = req.body

  try {
    const { rows } = await pool.query(
      `UPDATE products
       SET name=$1, price=$2, category=$3, description=$4, featured=$5, in_stock=$6, stock_qty=$7
       WHERE id=$8 RETURNING *`,
      [name, price, category, description, featured, inStock, stockQty, req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' })

    const product = rows[0]
    const pid = product.id

    // Replace images
    await pool.query('DELETE FROM product_images WHERE product_id = $1', [pid])
    for (const [i, url] of images.entries()) {
      await pool.query(
        'INSERT INTO product_images (product_id, image_url, sort_order) VALUES ($1,$2,$3)',
        [pid, url, i]
      )
    }

    // Replace colors
    await pool.query('DELETE FROM product_colors WHERE product_id = $1', [pid])
    for (const color of colors) {
      await pool.query(
        'INSERT INTO product_colors (product_id, hex_color, stock_qty, image_url) VALUES ($1,$2,$3,$4)',
        [pid, color.hex, color.stock_qty || 0, color.image_url || null]
      )
    }

    // Replace sizes
    await pool.query('DELETE FROM product_sizes WHERE product_id = $1', [pid])
    for (const size of sizes) {
      await pool.query(
        'INSERT INTO product_sizes (product_id, size_label, unit) VALUES ($1,$2,$3)',
        [pid, size.size_label, size.unit]
      )
    }

    const [full] = await attachExtras([product])
    res.json(full)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update product' })
  }
})

// PATCH /api/products/:id/color-stock — update stock for a specific color
router.patch('/:id/color-stock', async (req, res) => {
  const { color_id, stock_qty } = req.body
  try {
    const { rows } = await pool.query(
      'UPDATE product_colors SET stock_qty=$1 WHERE id=$2 AND product_id=$3 RETURNING *',
      [stock_qty, color_id, req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Color not found' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update color stock' })
  }
})

// DELETE /api/products/:id
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