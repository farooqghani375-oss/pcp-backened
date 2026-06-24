import { Router } from 'express'
import webpush from 'web-push'
import { pool } from '../db.js'
import protect from '../middleware/auth.js'

const router = Router()

// Configure VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_MAILTO,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// POST /api/push/subscribe — save a new subscription (called from frontend)
router.post('/subscribe', async (req, res) => {
  const { endpoint, keys } = req.body
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription object' })
  }
  try {
    await pool.query(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth)
       VALUES ($1, $2, $3)
       ON CONFLICT (endpoint) DO NOTHING`,
      [endpoint, keys.p256dh, keys.auth]
    )
    res.status(201).json({ message: 'Subscribed successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to save subscription' })
  }
})

// POST /api/push/unsubscribe — remove a subscription
router.post('/unsubscribe', async (req, res) => {
  const { endpoint } = req.body
  if (!endpoint) return res.status(400).json({ error: 'Endpoint required' })
  try {
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint])
    res.json({ message: 'Unsubscribed successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to unsubscribe' })
  }
})

// POST /api/push/send — send notification to all subscribers (admin only)
router.post('/send', protect, async (req, res) => {
  const { title, body, url } = req.body
  if (!title || !body) return res.status(400).json({ error: 'Title and body required' })

  try {
    const { rows: subscriptions } = await pool.query('SELECT * FROM push_subscriptions')
    if (subscriptions.length === 0) {
      return res.json({ message: 'No subscribers', sent: 0 })
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      icon: '/android-chrome-192x192.png',
      badge: '/android-chrome-192x192.png',
    })

    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        ).catch(async err => {
          // If subscription is expired/invalid, remove it from DB
          if (err.statusCode === 410 || err.statusCode === 404) {
            await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint])
          }
          throw err
        })
      )
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    res.json({ message: `Sent ${sent}, Failed ${failed}`, sent, failed })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to send notifications' })
  }
})

// GET /api/push/vapid-public-key — frontend fetches this to subscribe
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY })
})

export default router