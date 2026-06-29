import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import productsRouter from './routes/products.js'
import ordersRouter from './routes/orders.js'
import authRouter from './routes/auth.js'
import chatRouter from './routes/chat.js'
import pushRouter from './routes/push.js'

dotenv.config()

const app = express()

// ── Security ──
app.use(helmet())
app.disable('x-powered-by')
app.use(cors({
  origin: 'https://pcp-frontend-gdqp.vercel.app',
  credentials: true
}))

// ── Rate limiting on auth ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, try again in 15 minutes' }
})
app.use('/api/auth', authLimiter)

app.use(express.json())

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

app.use('/api/auth', authRouter)
app.use('/api/products', productsRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/chat', chatRouter)
app.use('/api/push', pushRouter)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`))