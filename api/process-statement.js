const Anthropic = require('@anthropic-ai/sdk')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function safeParseJSON(text) {
  text = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    return JSON.parse(text)
  } catch (e) {
    // Find last complete transaction object
    const lastComplete = text.lastIndexOf('}]}')
    if (lastComplete > 0) {
      try { return JSON.parse(text.substring(0, lastComplete + 3)) } catch {}
    }
    // Find last closing brace of a transaction
    let depth = 0
    let lastGood = 0
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') depth++
      if (text[i] === '}') {
        depth--
        if (depth === 1) lastGood = i
      }
    }
    if (lastGood > 0) {
      try {
        return JSON.parse(text.substring(0, lastGood + 1) + ']}')
      } catch {}
    }
    throw new Error('Could not parse response')
  }
}

function parseCSVLine(line) {
  // Handle quoted fields with commas inside
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; continue }
    if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue }
    current += line[i]
  }
  result.push(current.trim())
  return result
}

function parseDate(dateStr) {
  // Handle MM/DD/YYYY format
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      const [m, d, y] = parts
      return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
    }
  }
  // Handle DD-Mon-YYYY or YYYY-MM-DD
  return dateStr.substring(0, 10)
}

function detectFormat(lines) {
  const first = parseCSVLine(lines[0])
  const hasHeader = isNaN(parseFloat(first[0])) && !first[0].includes('/')
  
  if (hasHeader) {
    const headers = first.map(h => h.toLowerCase())
    return {
      hasHeader: true,
      dateIdx: headers.findIndex(h => h.includes('date')),
      descIdx: headers.findIndex(h => h.includes('desc') || h.includes('merchant') || h.includes('name') || h.includes('payee') || h.includes('narr')),
      amtIdx: headers.findIndex(h => h.includes('amount') || h.includes('debit') || h.includes('withdrawal')),
      creditIdx: headers.findIndex(h => h.includes('credit') || h.includes('deposit')),
    }
  }
  
  // No header - detect by content of first data row
  // Format: Date, Description, Amount, Credit, Balance  (your format)
  const sample = parseCSVLine(lines[0])
  const isDateFirst = sample[0].includes('/') || sample[0].match(/\d{4}-\d{2}-\d{2}/)
  
  if (isDateFirst) {
    return { hasHeader: false, dateIdx: 0, descIdx: 1, amtIdx: 2, creditIdx: 3 }
  }
  
  // Amount first format (some banks)
  return { hasHeader: false, dateIdx: 2, descIdx: 3, amtIdx: 0, creditIdx: 1 }
}

function parseCSVLocally(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 1) return []

  const fmt = detectFormat(lines)
  const dataLines = fmt.hasHeader ? lines.slice(1) : lines

  return dataLines.map(line => {
    const cols = parseCSVLine(line)
    if (cols.length < 3) return null
    
    const dateRaw = cols[fmt.dateIdx] || ''
    const merchant = (cols[fmt.descIdx] || 'Unknown').substring(0, 60)
    const amtRaw = parseFloat((cols[fmt.amtIdx] || '0').replace(/[$,]/g, '')) || 0
    const creditRaw = fmt.creditIdx >= 0 ? parseFloat((cols[fmt.creditIdx] || '0').replace(/[$,]/g, '')) || 0 : 0

    const amount = Math.abs(amtRaw) || creditRaw
    if (amount === 0) return null

    const date = parseDate(dateRaw)
    const isPayment = creditRaw > 0 || merchant.toLowerCase().includes('payment') || merchant.toLowerCase().includes('thank you') || merchant.toLowerCase().includes('credit')
    const isIncome = merchant.toLowerCase().includes('salary') || merchant.toLowerCase().includes('payroll') || merchant.toLowerCase().includes('direct dep')

    return {
      date,
      merchant,
      amount,
      category: guessCategory(merchant),
      is_payment: isPayment,
      is_income: isIncome,
    }
  }).filter(Boolean)
}

function guessCategory(merchant) {
  const m = merchant.toLowerCase()
  if (m.includes('loblaws') || m.includes('metro') || m.includes('sobeys') || m.includes('walmart') || m.includes('costco') || m.includes('grocery') || m.includes('food basic') || m.includes('no frills') || m.includes('whole foods')) return 'groceries'
  if (m.includes('tim hortons') || m.includes('mcdonalds') || m.includes('starbucks') || m.includes('restaurant') || m.includes('pizza') || m.includes('sushi') || m.includes('cafe') || m.includes('bar ') || m.includes('grill') || m.includes('kitchen') || m.includes('eatery')) return 'dining'
  if (m.includes('shell') || m.includes('esso') || m.includes('petro') || m.includes('gas') || m.includes('fuel') || m.includes('sunoco') || m.includes('ultramar')) return 'gas'
  if (m.includes('ttc') || m.includes('uber') || m.includes('lyft') || m.includes('transit') || m.includes('presto') || m.includes('parking') || m.includes('car wash')) return 'transport'
  if (m.includes('netflix') || m.includes('spotify') || m.includes('amazon prime') || m.includes('apple') || m.includes('google') || m.includes('disney') || m.includes('subscription') || m.includes('membership')) return 'subscriptions'
  if (m.includes('hydro') || m.includes('enbridge') || m.includes('rogers') || m.includes('bell ') || m.includes('telus') || m.includes('internet') || m.includes('phone') || m.includes('insurance')) return 'utilities'
  if (m.includes('shoppers') || m.includes('pharmacy') || m.includes('drug') || m.includes('clinic') || m.includes('doctor') || m.includes('dental') || m.includes('medical') || m.includes('hospital')) return 'medical'
  if (m.includes('amazon') || m.includes('ebay') || m.includes('etsy') || m.includes('ikea') || m.includes('best buy') || m.includes('home depot') || m.includes('canadian tire') || m.includes('winners') || m.includes('shopify')) return 'shopping'
  if (m.includes('cineplex') || m.includes('theatre') || m.includes('sport') || m.includes('recreation') || m.includes('gym') || m.includes('fitness') || m.includes('raptors') || m.includes('leafs')) return 'entertainment'
  if (m.includes('interest') || m.includes('fee') || m.includes('charge') || m.includes('annual')) return 'fees'
  if (m.includes('payment') || m.includes('transfer') || m.includes('thank you') || m.includes('credit')) return 'payment'
  return 'other'
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action, file_base64, file_type, media_type, csv_text, transactions, debts, monthly_income, context } = req.body

  try {

    // ── Extract from CSV (local parsing + AI categorization) ─────
    if ((action === 'extract' || !action) && (file_type === 'csv' || file_type === 'excel')) {
      const parsed = parseCSVLocally(csv_text || '')

      if (parsed.length === 0) {
        return res.status(400).json({ error: 'Could not read CSV. Make sure it has date, amount, and description columns.' })
      }

      // Detect statement period from dates
      const dates = parsed.map(t => t.date).filter(d => d && d.length >= 7).sort()
      const period = dates.length > 0 ? dates[0].substring(0, 7) : new Date().toISOString().substring(0, 7)

      return res.json({
        statement_period: period,
        account_name: null,
        transactions: parsed
      })
    }

    // ── Extract from PDF/image ───────────────────────────────────
    if ((action === 'extract' || !action) && (file_type === 'pdf' || file_type === 'image')) {
      const contentBlock = file_type === 'pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file_base64 } }
        : { type: 'image', source: { type: 'base64', media_type: media_type || 'image/jpeg', data: file_base64 } }

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: `Extract transactions from this statement. Return ONLY JSON, no markdown.

{"statement_period":"YYYY-MM","account_name":"string or null","transactions":[{"date":"YYYY-MM-DD","merchant":"string max 50 chars","amount":number,"category":"groceries|dining|gas|transport|utilities|subscriptions|shopping|kids|medical|entertainment|fees|interest|payment|income|other","is_payment":false,"is_income":false}]}

Important: Keep merchant names short (max 50 chars). If there are many transactions, include all of them but keep names brief.`
            }
          ]
        }]
      })

      const text = response.content[0].text
      try {
        const data = safeParseJSON(text)
        return res.json(data)
      } catch (e) {
        return res.status(500).json({ error: 'Could not parse statement. Try uploading as CSV instead — export from your bank website.' })
      }
    }

    // ── Full financial analysis ──────────────────────────────────
    if (action === 'analyse') {
      // Summarize transactions by category to reduce token count
      const byCategory = {}
      const spend = (transactions || []).filter(t => !t.is_payment && !t.is_income)
      const income = (transactions || []).filter(t => t.is_income)
      spend.forEach(t => {
        byCategory[t.category] = (byCategory[t.category] || 0) + t.amount
      })
      const totalSpend = spend.reduce((s, t) => s + t.amount, 0)
      const totalIncome = income.reduce((s, t) => s + t.amount, 0)

      // Top merchants per category
      const topMerchants = {}
      spend.forEach(t => {
        if (!topMerchants[t.category]) topMerchants[t.category] = {}
        topMerchants[t.category][t.merchant] = (topMerchants[t.category][t.merchant] || 0) + t.amount
      })

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `You are a personal financial advisor for a Canadian household. Return ONLY JSON, no markdown.

Total transactions: ${(transactions || []).length}
Total spend: $${totalSpend.toFixed(2)}
Total income detected: $${totalIncome.toFixed(2)}
${monthly_income ? `Stated monthly income: $${monthly_income} CAD` : ''}
Spend by category: ${JSON.stringify(byCategory)}
${debts ? `Current debts: ${JSON.stringify(debts)}` : ''}
${context || ''}

{"summary":{"total_spend":number,"total_income":number,"net":number,"top_category":"string","biggest_win":"string","biggest_concern":"string"},"by_category":[{"category":"string","amount":number,"pct":number,"verdict":"good|ok|high","tip":"string"}],"anomalies":[{"type":"string","description":"string","amount":number}],"debt_strategy":{"method":"avalanche","monthly_interest_cost":number,"recommendation":"string","priority_actions":["string"]},"action_plan":[{"priority":1,"action":"string","impact":"string","difficulty":"easy|medium|hard"}],"monthly_budget_suggestion":[{"category":"string","current":number,"suggested":number,"reason":"string"}],"overall_health_score":number,"health_verdict":"string"}`
        }]
      })

      const text = response.content[0].text
      try {
        return res.json(safeParseJSON(text))
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
