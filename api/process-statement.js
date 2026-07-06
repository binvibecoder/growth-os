const Anthropic = require('@anthropic-ai/sdk')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action, file_base64, file_type, media_type, csv_text, context, transactions, debts, monthly_income } = req.body

  try {

    // ── Extract transactions ─────────────────────────────────────
    if (action === 'extract' || !action) {
      let messages

      if (file_type === 'csv' || file_type === 'excel') {
        messages = [{
          role: 'user',
          content: `Extract transactions from this financial data. Return ONLY a JSON object, no markdown, no explanation.

Data:
${csv_text}

Required format:
{"statement_period":"YYYY-MM","account_name":"string or null","transactions":[{"date":"YYYY-MM-DD","merchant":"string","amount":number,"category":"groceries|dining|gas|transport|utilities|subscriptions|shopping|kids|medical|entertainment|fees|interest|payment|income|other","is_payment":false,"is_income":false}]}`
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
              text: `Extract all transactions from this statement. Return ONLY a JSON object, no markdown, no explanation.

Required format:
{"statement_period":"YYYY-MM","account_name":"string or null","transactions":[{"date":"YYYY-MM-DD","merchant":"string","amount":number,"category":"groceries|dining|gas|transport|utilities|subscriptions|shopping|kids|medical|entertainment|fees|interest|payment|income|other","is_payment":false,"is_income":false}]}`
            }
          ]
        }]
      }

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages
      })

      let text = response.content[0].text.trim()

      // Strip markdown if present
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

      // Fix truncated JSON by finding last complete transaction
      let data
      try {
        data = JSON.parse(text)
      } catch (e) {
        // Try to recover truncated JSON
        const lastBracket = text.lastIndexOf('}')
        if (lastBracket > 0) {
          let recovered = text.substring(0, lastBracket + 1)
          // Close any open arrays/objects
          const openBrackets = (recovered.match(/\[/g) || []).length - (recovered.match(/\]/g) || []).length
          const openBraces = (recovered.match(/\{/g) || []).length - (recovered.match(/\}/g) || []).length
          for (let i = 0; i < openBrackets; i++) recovered += ']'
          for (let i = 0; i < openBraces; i++) recovered += '}'
          try {
            data = JSON.parse(recovered)
          } catch (e2) {
            return res.status(500).json({ error: 'Could not parse statement. Try uploading a clearer image or smaller file.' })
          }
        } else {
          return res.status(500).json({ error: 'Could not parse statement. Try uploading a clearer image or smaller file.' })
        }
      }

      return res.json(data)
    }

    // ── Full financial analysis ──────────────────────────────────
    if (action === 'analyse') {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `You are a personal financial advisor for a Canadian household. Analyse this data and give specific actionable advice. Return ONLY a JSON object, no markdown.

${monthly_income ? `Monthly income: $${monthly_income} CAD` : ''}
${debts ? `Current debts: ${JSON.stringify(debts)}` : ''}
Total transactions: ${transactions.length}
Transaction summary: ${JSON.stringify(transactions.slice(0, 100))}
${context ? `Context: ${context}` : ''}

Return this exact structure:
{
  "summary": { "total_spend": number, "total_income": number, "net": number, "top_category": "string", "biggest_win": "string", "biggest_concern": "string" },
  "by_category": [{ "category": "string", "amount": number, "pct": number, "verdict": "good|ok|high", "tip": "string" }],
  "anomalies": [{ "type": "string", "description": "string", "amount": number }],
  "debt_strategy": { "method": "avalanche", "monthly_interest_cost": number, "recommendation": "string", "priority_actions": ["string"] },
  "action_plan": [{ "priority": 1, "action": "string", "impact": "string", "difficulty": "easy|medium|hard" }],
  "monthly_budget_suggestion": [{ "category": "string", "current": number, "suggested": number, "reason": "string" }],
  "overall_health_score": number,
  "health_verdict": "string"
}`
        }]
      })

      let text = response.content[0].text.trim()
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

      try {
        return res.json(JSON.parse(text))
      } catch (e) {
        return res.status(500).json({ error: 'Analysis failed. Please try again.' })
      }
    }

    return res.status(400).json({ error: 'Unknown action' })

  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: error.message })
  }
}
