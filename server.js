import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import productsRouter from './routes/products.js'
import ordersRouter from './routes/orders.js'
import authRouter from './routes/auth.js'
import chatRouter from './routes/chat.js'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

// Health check — visit /api/health to confirm server is up
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

app.use('/api/auth', authRouter)
app.use('/api/products', productsRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/chat', chatRouter)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`))
