import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db.js'

const router = Router()

// ── POST /api/auth/register ──────────────────────────────────
// Creates the first (and only) admin account.
// You run this ONCE manually (e.g. with curl or Postman) to set
// yourself up, then either delete/disable this route or add a
// guard so it can't be called a second time.
//
// Body: { "email": "admin@pcp.com", "password": "yourpassword" }

router.post('/register', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  try {
    // Check if ANY admin already exists — this keeps register as a
    // one-time setup call, not an open signup endpoint
    const { rows: existing } = await pool.query('SELECT id FROM admin_users LIMIT 1')
    if (existing.length > 0) {
      return res.status(403).json({ error: 'Admin account already exists. Use /login.' })
    }

    // bcrypt.hash(password, 10) — the "10" is the salt rounds.
    // Higher = slower to crack if DB is ever leaked, but also slower
    // to run. 10 is the standard sweet spot.
    const passwordHash = await bcrypt.hash(password, 10)

    const { rows } = await pool.query(
      'INSERT INTO admin_users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    )

    res.status(201).json({ message: 'Admin account created', admin: rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// ── POST /api/auth/login ─────────────────────────────────────
// This replaces Firebase's signInWithEmailAndPassword().
// On success it returns a JWT token. The frontend stores that
// token and sends it in the Authorization header on every
// admin request.
//
// Body: { "email": "admin@pcp.com", "password": "yourpassword" }

router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM admin_users WHERE email = $1',
      [email]
    )

    if (rows.length === 0) {
      // We return the same message for "wrong email" and "wrong password"
      // on purpose — telling attackers which one is wrong is a security
      // leak (it confirms that the email exists in your system).
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const admin = rows[0]

    // bcrypt.compare hashes the incoming password and checks it against
    // the stored hash — we never store or compare plain passwords
    const passwordMatch = await bcrypt.compare(password, admin.password_hash)

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Sign a token that expires in 7 days.
    // The payload { adminId, email } gets decoded by the protect middleware.
    const token = jwt.sign(
      { adminId: admin.id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      message: 'Login successful',
      token,
      admin: { id: admin.id, email: admin.email }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Login failed' })
  }
})

export default router
