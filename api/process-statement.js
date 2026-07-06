const Anthropic = require('@anthropic-ai/sdk')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action, file_base64, file_type, media_type, csv_text, context } = req.body

  try {

    // ── Extract transactions from file ──────────────────────────
    if (action === 'extract' || !action) {
      let messages

      if (file_type === 'csv' || file_type === 'excel') {
        messages = [{
          role: 'user',
          content: `Extract all transactions from this financial data and return ONLY valid JSON.

Data:
${csv_text}

Return this exact structure, no markdown:
{
  "statement_period": "YYYY-MM",
  "account_name": "string or null",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "merchant": "string",
      "amount": number,
      "category": "groceries|dining|gas|transport|utilities|subscriptions|shopping|kids|medical|entertainment|fees|interest|payment|income|other",
      "is_payment": boolean,
      "is_income": boolean
    }
  ]
}`
        }]
      } else {
        const contentBlock = file_type === 'pdf'
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file_base64 } }
          : { type: 'image', source: { type: 'base64', media_type: media_type || 'image/jpeg', data: file_base64 } }

        messages = [{
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: `Extract all transactions from this financial statement and return ONLY valid JSON, no markdown.

{
  "statement_period": "YYYY-MM",
  "account_name": "string or null",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "merchant": "string",
      "amount": number,
      "category": "groceries|dining|gas|transport|utilities|subscriptions|shopping|kids|medical|entertainment|fees|interest|payment|income|other",
      "is_payment": boolean,
      "is_income": boolean
    }
  ]
}`
            }
          ]
        }]
      }

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages
      })

      const text = response.content[0].text
      const clean = text.replace(/```json|```/g, '').trim()
      return res.json(JSON.parse(clean))
    }

    // ── Full financial analysis ──────────────────────────────────
    if (action === 'analyse') {
      const { transactions, debts, monthly_income } = req.body

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `You are a personal financial advisor for a Canadian household. Analyze this financial data and give specific, actionable advice.

${monthly_income ? `Monthly income: $${monthly_income} CAD` : ''}
${debts ? `Current debts: ${JSON.stringify(debts)}` : ''}

Transactions:
${JSON.stringify(transactions)}

Additional context: ${context || 'None'}

Return ONLY valid JSON, no markdown:
{
  "summary": {
    "total_spend": number,
    "total_income": number,
    "net": number,
    "top_category": "string",
    "biggest_win": "string",
    "biggest_concern": "string"
  },
  "by_category": [
    { "category": "string", "amount": number, "pct": number, "verdict": "good|ok|high", "tip": "string" }
  ],
  "anomalies": [
    { "type": "string", "description": "string", "amount": number }
  ],
  "debt_strategy": {
    "method": "avalanche",
    "monthly_interest_cost": number,
    "recommendation": "string",
    "priority_actions": ["string"]
  },
  "action_plan": [
    { "priority": 1, "action": "string", "impact": "string", "difficulty": "easy|medium|hard" }
  ],
  "monthly_budget_suggestion": [
    { "category": "string", "current": number, "suggested": number, "reason": "string" }
  ],
  "overall_health_score": number,
  "health_verdict": "string"
}`
        }]
      })

      const text = response.content[0].text
      const clean = text.replace(/```json|```/g, '').trim()
      return res.json(JSON.parse(clean))
    }

    return res.status(400).json({ error: 'Unknown action' })

  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
