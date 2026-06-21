import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

// POST /api/chat
// Body: { message: "do you have aloe vera?", history: [{role, content}, ...] }
//
// Uses Google's Gemini API — free tier, no credit card required.
// Pulls a lightweight product list from your own database first, so the
// assistant can answer real questions about your actual catalog.

router.post('/', async (req, res) => {
  const { message, history = [] } = req.body

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' })
  }

  try {
    const { rows: products } = await pool.query(
      'SELECT name, category, price, in_stock FROM products ORDER BY id LIMIT 50'
    )
    const catalogSummary = products
      .map(p => `${p.name} (${p.category}) - Rs ${p.price}${p.in_stock ? '' : ' [out of stock]'}`)
      .join('\n')

    const systemPrompt = `You are a friendly, brief customer support assistant for Plant Center Peshawar, an online plant and gardening store in Peshawar, Pakistan.

Store facts:
- We sell plants, pots, fertilizers, tools, and seeds
- Delivery is available across Peshawar
- Payment is Cash on Delivery only
- Shipping fee is Rs 250 per order
- Customers can browse everything at /shop, or message us directly on WhatsApp for anything you can't help with

Current product catalog:
${catalogSummary}

Keep answers short and warm, like a helpful shop assistant texting back. Only mention products and prices that appear in the catalog above — never invent a product, price, or stock status that isn't listed. If you don't know something, suggest the customer check the Shop page or message on WhatsApp.`

    // Gemini expects "model" instead of "assistant" for its own previous replies
    const contents = [
      ...history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ]

    const response = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 400 },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Gemini API error:', data)
      return res.status(500).json({ error: 'Chat assistant is unavailable right now' })
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
      || "Sorry, I couldn't generate a response. Please try again."

    res.json({ reply })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to get a response from the assistant' })
  }
})

export default router
