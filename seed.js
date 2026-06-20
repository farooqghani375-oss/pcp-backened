// One-time script to load your existing 12 products (the same ones
// from DEFAULT_PRODUCTS in your Firebase services.js) into Postgres.
// Run with: npm run seed

import { pool } from './db.js'

const products = [
  { name: 'Clay Plant Pot', price: 500, category: 'pots', description: 'High-quality terracotta clay pot, perfect for indoor and outdoor plants.', featured: true, inStock: true, stockQty: 20, images: ['27.jpeg'], colors: ['#c0392b', '#8e44ad', '#2980b9'] },
  { name: 'Money Plant', price: 500, category: 'plants', description: 'The beloved Money Plant (Pothos) is known for its air-purifying qualities.', featured: true, inStock: true, stockQty: 15, images: ['12.webp', '13.webp', '14.webp', '15.webp'], colors: [] },
  { name: 'Marble Pot', price: 700, category: 'pots', description: 'Elegant marble-finish decorative pot that adds a touch of luxury.', featured: false, inStock: true, stockQty: 12, images: ['19.webp'], colors: ['#ecf0f1', '#2c3e50', '#f39c12'] },
  { name: 'Decorative Ceramic Pot', price: 950, category: 'pots', description: 'Hand-painted decorative ceramic pot with traditional Peshawar motifs.', featured: true, inStock: true, stockQty: 8, images: ['20.webp'], colors: ['#ffffff', '#1a3a2a', '#c0392b'] },
  { name: 'Indoor Sansevieria', price: 600, category: 'plants', description: 'The Snake Plant is nearly indestructible and one of the best air-purifying plants.', featured: true, inStock: true, stockQty: 10, images: ['15.webp', '16.webp'], colors: [] },
  { name: 'Indoor Flower Pot', price: 750, category: 'pots', description: 'Colourful glazed flower pot with drainage holes. Perfect for balconies.', featured: true, inStock: true, stockQty: 18, images: ['25.webp'], colors: ['#27ae60', '#e74c3c', '#3498db'] },
  { name: 'Organic Fertilizer Mix', price: 350, category: 'fertilizers', description: '100% organic fertilizer blend enriched with bone meal, neem cake, and vermicompost.', featured: false, inStock: true, stockQty: 30, images: ['3.jpg'], colors: [] },
  { name: 'Hanging Planter', price: 650, category: 'pots', description: 'Macramé-style hanging planter perfect for trailing plants.', featured: false, inStock: true, stockQty: 14, images: ['22.webp', '23.webp'], colors: ['#8b5e3c', '#1a3a2a', '#ffffff'] },
  { name: 'Aloe Vera Plant', price: 400, category: 'plants', description: 'Fresh Aloe Vera plant in a 4-inch pot. Great for skin care and medicinal use.', featured: true, inStock: true, stockQty: 25, images: ['17.webp'], colors: [] },
  { name: 'Garden Starter Kit', price: 1200, category: 'tools', description: 'Complete starter kit for new gardeners. Includes gloves, trowel, pruner, watering can.', featured: false, inStock: true, stockQty: 7, images: ['2.jpg'], colors: [] },
  { name: 'Succulent Collection', price: 850, category: 'plants', description: 'A curated set of 4 different succulent plants in matching mini pots.', featured: true, inStock: true, stockQty: 9, images: ['24.webp', '25.webp'], colors: [] },
  { name: 'Fertilizer Spray Bottle', price: 280, category: 'fertilizers', description: 'Ready-to-use liquid fertilizer in a convenient spray bottle.', featured: false, inStock: true, stockQty: 22, images: ['3.jpg'], colors: [] }
]

async function seed() {
  for (const p of products) {
    const { rows } = await pool.query(
      `INSERT INTO products (name, price, category, description, featured, in_stock, stock_qty)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [p.name, p.price, p.category, p.description, p.featured, p.inStock, p.stockQty]
    )
    const productId = rows[0].id

    for (const [i, url] of p.images.entries()) {
      await pool.query(
        'INSERT INTO product_images (product_id, image_url, sort_order) VALUES ($1,$2,$3)',
        [productId, url, i]
      )
    }
    for (const hex of p.colors) {
      await pool.query('INSERT INTO product_colors (product_id, hex_color) VALUES ($1,$2)', [productId, hex])
    }
  }

  console.log(`Seeded ${products.length} products into Postgres.`)
  await pool.end()
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
