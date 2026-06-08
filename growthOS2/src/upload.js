// ── FILE READING HELPERS ─────────────────────────────────────────────────

export function readAsBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function readAsText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsText(file);
  });
}

// Build Claude message content array from a list of files
export async function filesToContent(files) {
  const content = [];
  for (const file of files) {
    const name = file.name.toLowerCase();
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
      const b64 = await readAsBase64(file);
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } });
    } else if (file.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|heic)$/.test(name)) {
      const b64 = await readAsBase64(file);
      const mt = file.type.startsWith('image/') ? file.type : 'image/jpeg';
      content.push({ type: 'image', source: { type: 'base64', media_type: mt, data: b64 } });
    } else {
      // CSV, Excel, TXT, JSON — read as text
      const text = await readAsText(file);
      content.push({ type: 'text', text: `=== FILE: ${file.name} ===\n${text.slice(0, 12000)}` });
    }
  }
  return content;
}

// Call Claude API
export async function callClaude(system, userContent) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.content?.find(b => b.type === 'text')?.text || '';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// ── FINANCIAL STATEMENT PARSER ────────────────────────────────────────────

const FIN_SYSTEM = `You are a financial data extractor for a Canadian household dashboard.
Extract ALL credit card, line of credit, and loan data from the uploaded files.
Files can be PDFs, screenshots, CSV, or Excel — handle all formats.
Return ONLY valid JSON, no explanation, no markdown fences.

Known accounts in this household:
- Scotia LoC #1, Scotia LoC #2
- Binoy Tangerine CC, SreejaTangy CC  
- Scotia Visa Infinite+
- CIBC Costco MC
- Walmart MC
- Canadian Tire MC

JSON structure:
{
  "debts": [
    {
      "label": "match to known account name above if possible",
      "balance": "current outstanding balance as string number",
      "statementBalance": "statement balance if different",
      "apr": "interest rate % as string",
      "minPayment": "minimum payment as string",
      "dueDate": "due date as YYYY-MM-DD if found"
    }
  ],
  "totalDebt": "sum of all balances as string",
  "monthlyIncome": "if found in documents",
  "topCategories": [
    { "category": "Groceries", "amount": "450.00" }
  ],
  "uploadDate": "today YYYY-MM-DD",
  "summary": "2-sentence plain English summary"
}

Match extracted accounts to the known account names as closely as possible.
If you see a Tangerine card for Binoy, label it "Binoy Tangerine CC".
Extract every account you find even if not in the known list.`;

export async function parseFinancialFiles(files, onProgress) {
  onProgress('Reading files...');
  const content = await filesToContent(files);
  content.push({ type: 'text', text: `Today is ${new Date().toISOString().split('T')[0]}. Extract all financial data from these ${files.length} file(s) and return the JSON.` });
  onProgress(`Analysing ${files.length} file${files.length > 1 ? 's' : ''} with Claude...`);
  return callClaude(FIN_SYSTEM, content);
}

// ── HEALTH DATA PARSER ────────────────────────────────────────────────────

const HEALTH_SYSTEM = `You are a health data extractor. Parse Apple Health / Health Auto Export / Renpho JSON export data.
Return ONLY valid JSON, no explanation, no markdown.

{
  "latestWeight": "kg as string",
  "latestBodyFat": "% as string",
  "latestMuscleMass": "kg as string",
  "latestVisceralFat": "number as string",
  "avgRestingHR": "bpm as string",
  "avgDailySteps": "number as string",
  "avgSleepHours": "number as string",
  "newSessions": [
    {
      "date": "YYYY-MM-DD",
      "type": "HIIT|Swim|Walk|Run|Other",
      "duration": "minutes as string",
      "calories": "kcal as string",
      "notes": "brief note e.g. Avg HR: 158, Max: 198"
    }
  ],
  "summary": "2-sentence summary"
}

For weight: Renpho syncs to Apple Health in lbs — convert to kg (divide by 2.205).
For workouts: duration is in seconds in Apple Health — convert to minutes.
activeEnergyBurned is an object {qty, units} — use .qty value.
Workout name mapping: "Pool Swim" → Swim, "Functional Strength Training" → HIIT, "Outdoor Walk" → Walk.
Limit newSessions to last 20 entries sorted by date descending.`;

export async function parseHealthFile(file, onProgress) {
  onProgress('Reading health file...');

  const name = file.name.toLowerCase();
  const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|heic|gif|webp)$/.test(name);
  const isPDF = file.type === 'application/pdf' || name.endsWith('.pdf');

  // Images and PDFs — send directly to Claude for visual parsing
  if (isImage || isPDF) {
    onProgress('Sending screenshot to Claude...');
    const b64 = await readAsBase64(file);
    const mt = isImage ? (file.type.startsWith('image/') ? file.type : 'image/jpeg') : 'application/pdf';
    const contentType = isImage ? 'image' : 'document';
    return callClaude(HEALTH_SYSTEM, [
      { type: contentType, source: { type: 'base64', media_type: mt, data: b64 } },
      { type: 'text', text: 'Extract all health and fitness data from this screenshot/image and return the JSON.' }
    ]);
  }

  // JSON file — try native parser first, fall back to Claude
  onProgress('Parsing JSON structure...');
  const text = await readAsText(file);
  let raw;
  try { raw = JSON.parse(text); }
  catch (e) { throw new Error('Not valid JSON. Export from Health Auto Export as Format: JSON, or upload a screenshot instead.'); }

  const metrics = raw?.data?.metrics || raw?.metrics || [];
  const workouts = raw?.data?.workouts || raw?.workouts || [];

  if (metrics.length || workouts.length) {
    onProgress('Extracting metrics...');
    return parseHealthNative(metrics, workouts);
  }

  // Unknown JSON structure — send to Claude
  onProgress('Sending to Claude for parsing...');
  const sample = JSON.stringify(raw).slice(0, 15000);
  return callClaude(HEALTH_SYSTEM, [{ type: 'text', text: `Parse this health export:\n\n${sample}` }]);
}

function parseHealthNative(metrics, workouts) {
  const findM = (name) => metrics.find(m => m.name === name);
  const latestQty = (name, convert) => {
    const m = findM(name);
    if (!m?.data?.length) return null;
    const sorted = [...m.data].sort((a, b) => new Date(b.date) - new Date(a.date));
    const v = parseFloat(sorted[0]?.qty);
    if (isNaN(v)) return null;
    return convert ? convert(v) : v;
  };
  const avgQty = (name, convert) => {
    const m = findM(name);
    if (!m?.data?.length) return null;
    const vals = m.data.map(d => parseFloat(d.qty)).filter(v => !isNaN(v) && v > 0);
    if (!vals.length) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return convert ? convert(avg) : avg;
  };

  const lbToKg = v => parseFloat((v * 0.453592).toFixed(1));
  const weight = latestQty('weight_body_mass', lbToKg);
  const bodyFat = latestQty('body_fat_percentage', v => parseFloat(v.toFixed(1)));
  const muscleMass = latestQty('lean_body_mass', lbToKg);
  const restingHR = latestQty('resting_heart_rate', v => Math.round(v));
  const avgSteps = avgQty('step_count', v => Math.round(v));

  const newSessions = [];
  const sorted = [...workouts].sort((a, b) => new Date(b.start) - new Date(a.start)).slice(0, 20);
  sorted.forEach(w => {
    const n = (w.name || '').toLowerCase();
    let type = 'Other';
    if (n.includes('swim') || n.includes('pool')) type = 'Swim';
    else if (n.includes('functional') || n.includes('strength') || n.includes('hiit') || n.includes('elliptical') || n.includes('crossfit')) type = 'HIIT';
    else if (n.includes('walk')) type = 'Walk';
    else if (n.includes('run')) type = 'Run';
    else if (n.includes('yoga')) type = 'Yoga';
    else if (n.includes('cycl') || n.includes('bike')) type = 'Cycle';

    const date = w.start ? w.start.split(' ')[0] : '';
    const duration = w.duration ? Math.round(parseFloat(w.duration) / 60).toString() : '';
    const calories = w.activeEnergyBurned?.qty ? Math.round(parseFloat(w.activeEnergyBurned.qty)).toString()
      : w.activeEnergy?.qty ? Math.round(parseFloat(w.activeEnergy.qty)).toString() : '';
    const avgHR = w.avgHeartRate?.qty ? Math.round(w.avgHeartRate.qty) : null;
    const maxHR = w.maxHeartRate?.qty ? Math.round(w.maxHeartRate.qty) : null;
    const notes = avgHR ? `Avg HR: ${avgHR}${maxHR ? `, Max: ${maxHR}` : ''}` : (w.name || type);
    if (date) newSessions.push({ date, type, duration, calories, notes });
  });

  return {
    latestWeight: weight?.toString() || null,
    latestBodyFat: bodyFat?.toString() || null,
    latestMuscleMass: muscleMass?.toString() || null,
    latestVisceralFat: null,
    avgRestingHR: restingHR?.toString() || null,
    avgDailySteps: avgSteps?.toString() || null,
    avgSleepHours: null,
    newSessions,
    summary: `${newSessions.length} workouts parsed. ${newSessions.filter(s => s.type === 'Swim').length} swims, ${newSessions.filter(s => s.type === 'HIIT').length} HIIT.${weight ? ` Latest weight: ${weight}kg.` : ''}`,
  };
}

// ── CAREER PARSER ─────────────────────────────────────────────────────────

const CAREER_SYSTEM = `You are a career data extractor. Parse any document (CV, performance review, project notes, email, screenshot) and extract career-relevant information.
Return ONLY valid JSON, no explanation, no markdown.

{
  "currentRole": "job title and company if found",
  "focusArea": "current project or focus area",
  "newWins": [
    { "label": "achievement description", "date": "YYYY-MM-DD" }
  ],
  "newGoals": [
    { "label": "goal description", "detail": "context", "targetDate": "YYYY-MM-DD", "status": "Not Started" }
  ],
  "newLearning": [
    { "label": "course/skill/book", "status": "Planned" }
  ],
  "notes": "any other relevant career notes",
  "summary": "1-sentence summary of what was extracted"
}

Today is ${new Date().toISOString().split('T')[0]}.
Only include fields that are clearly present in the document.`;

export async function parseCareerFiles(files, onProgress) {
  onProgress('Reading files...');
  const content = await filesToContent(files);
  content.push({ type: 'text', text: 'Extract career information from these files and return the JSON.' });
  onProgress('Analysing with Claude...');
  return callClaude(CAREER_SYSTEM, content);
}
