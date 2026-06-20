import jwt from 'jsonwebtoken'

// This function runs BEFORE any admin-only route handler.
// If the request has a valid token → it passes through.
// If not → it blocks with 401 Unauthorized.
//
// Usage in a route file:
//   import protect from '../middleware/auth.js'
//   router.delete('/:id', protect, async (req, res) => { ... })

export default function protect(req, res, next) {
  // Tokens arrive in the Authorization header as: "Bearer <token>"
  const header = req.headers['authorization']

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token — please log in first' })
  }

  const token = header.split(' ')[1]

  try {
    // jwt.verify checks the signature AND that it hasn't expired.
    // If either check fails it throws, which lands in the catch below.
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Attach the decoded payload (adminId, email) to the request
    // so route handlers can see who made the request if needed.
    req.admin = decoded
    next() // all good — continue to the actual route handler
  } catch (err) {
    return res.status(401).json({ error: 'Token invalid or expired — please log in again' })
  }
}
