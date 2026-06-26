import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CATEGORIES = [
  'groceries', 'dining', 'gas', 'transport',
  'utilities', 'subscriptions', 'shopping',
  'kids', 'medical', 'entertainment',
  'fees', 'interest', 'payment', 'other'
]

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { file_base64, file_type, media_type } = req.body

  if (!file_base64) return res.status(400).json({ error: 'file_base64 required' })

  try {
    let contentBlock

    if (file_type === 'pdf') {
      contentBlock = {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: file_base64 }
      }
    } else {
      contentBlock = {
        type: 'image',
        source: { type: 'base64', media_type: media_type || 'image/jpeg', data: file_base64 }
      }
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          contentBlock,
          {
            type: 'text',
            text: `Extract all transactions from this credit card statement.
Return ONLY valid JSON. No markdown. No explanation.

Rules:
- Extract every transaction line
- DO NOT include card numbers, account numbers or personal info
- Categorize each transaction using ONLY these categories: ${CATEGORIES.join(', ')}
- Payments to the card are is_payment: true, amount should be negative
- All other transactions are positive amounts
- Date format: YYYY-MM-DD
- If date year is missing assume 2026

{
  "statement_period": "YYYY-MM",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "merchant": "string",
      "amount": number,
      "category": "string",
      "is_payment": boolean
    }
  ]
}`
          }
        ]
      }]
    })

    const text = response.content[0].text
    const clean = text.replace(/```json|```/g, '').trim()
    const data = JSON.parse(clean)
    return res.json(data)

  } catch (error) {
    console.error('Statement processing error:', error)
    return res.status(500).json({ error: error.message })
  }
}
