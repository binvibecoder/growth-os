import { useState } from 'react';
import { useSection } from './useSection';
import { parseFinancialFiles, parseHealthFile, parseCareerFiles } from './upload';
import { CONFIGURED } from './db';

// ── DEFAULT DATA ──────────────────────────────────────────────────────────

const D_FIN = {
  monthlyIncome: '16427', monthlyExpenses: '14177',
  debtTarget: '32462', debtCurrent: '32462',
  savingsGoal: '10000', savingsCurrent: '',
  notes: 'Avalanche strategy: clear high-APR cards first.\n1. Binoy Tangerine (~19.99%) — PRIORITY\n2. SreejaTangy (~19.99%)\n3. Scotia Visa Infinite+ (20.99%)\n4. CIBC, Walmart\n5. Scotia LoC #1 & #2 (7.5%) — last\n\nMonthly surplus ~$2,250.',
  debts: [
    { label: 'Scotia LoC #1',      balance: '14920.37', apr: '7.5',   minPayment: '150', dueDate: '' },
    { label: 'Scotia LoC #2',      balance: '9585.59',  apr: '7.5',   minPayment: '100', dueDate: '' },
    { label: 'Binoy Tangerine CC', balance: '3824.85',  apr: '19.99', minPayment: '76',  dueDate: '' },
    { label: 'SreejaTangy CC',     balance: '1775.85',  apr: '19.99', minPayment: '36',  dueDate: '' },
    { label: 'Scotia Visa Infinite+', balance: '1222.29', apr: '20.99', minPayment: '25', dueDate: '' },
    { label: 'CIBC Costco MC',     balance: '675.41',   apr: '19.99', minPayment: '14',  dueDate: '' },
    { label: 'Walmart MC',         balance: '457.87',   apr: '19.99', minPayment: '10',  dueDate: '' },
    { label: 'Canadian Tire MC',   balance: '0',        apr: '19.99', minPayment: '0',   dueDate: '' },
  ],
  goals: [
    { label: 'Clear all CC balances', detail: 'Tangy, SreejaTangy, Scotia Visa, CIBC, Walmart', targetDate: '2026-08-31', status: 'In Progress' },
    { label: 'Pay down Scotia LoC #1 & #2', detail: '$24,505 combined at 7.5%', targetDate: '2027-06-30', status: 'Not Started' },
    { label: 'Build 3-month emergency fund', detail: '~$49,000 target', targetDate: '2027-12-31', status: 'Not Started' },
  ],
  uploadHistory: [],
};

const D_EX = {
  currentWeight: '87.2', startWeight: '87.65', weightGoal: '82',
  bodyFat: '28.2', bodyFatGoal: '22', visceralFat: '13', visceralFatGoal: '12',
  muscleMass: '62.6', avgRestingHR: '89', avgDailySteps: '4424',
  notes: 'Schedule: Mon/Wed/Fri = HIIT. Tue/Thu = Swim.\nKnee: ACL graft re-torn (Jan 2026) + lateral meniscus. Avoid jumping/squats.\nHR cleared for high intensity.',
  log: [
    { date: '2026-06-01', type: 'HIIT', duration: '62', calories: '447', notes: 'PB — 447 cal' },
    { date: '2026-04-22', type: 'Swim', duration: '50', calories: '318', notes: '648m PB' },
  ],
  goals: [
    { label: 'Reach 82 kg',          detail: 'Now 87.2kg · 5.2kg to go', targetDate: '2026-09-30', status: 'In Progress' },
    { label: 'Body fat below 22%',   detail: 'Currently 28.2%',          targetDate: '2026-12-31', status: 'In Progress' },
    { label: 'Swim 1km non-stop',    detail: 'Best: 648m',               targetDate: '2026-08-31', status: 'Active' },
    { label: 'HIIT 500+ cal',        detail: 'Best: 447 cal',            targetDate: '2026-07-31', status: 'Active' },
  ],
  uploadHistory: [],
};

const D_PRO = {
  currentRole: 'Product Lead, EY Canada',
  focusArea: 'Project Vibe Phase 2 – FinCrime 3.0',
  quarterlyGoals: [],
  learningItems: [],
  wins: [],
  notes: '',
  uploadHistory: [],
};

// ── SHARED UI ─────────────────────────────────────────────────────────────

const SM = {
  'In Progress': { c: '#FFE600', bg: '#FFE60018' },
  'Active':      { c: '#FFE600', bg: '#FFE60018' },
  'Completed':   { c: '#4ade80', bg: '#4ade8018' },
  'Done':        { c: '#4ade80', bg: '#4ade8018' },
  'Not Started': { c: '#64748b', bg: '#64748b18' },
  'Planned':     { c: '#64748b', bg: '#64748b18' },
  'Blocked':     { c: '#f87171', bg: '#f8717118' },
};

const mono = { fontFamily: "'SF Mono','Fira Code',monospace" };
const pill = (status) => { const m = SM[status] || SM['Not Started']; return { fontSize: 11, padding: '3px 9px', borderRadius: 99, background: m.bg, color: m.c, border: `1px solid ${m.c}33`, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', ...mono }; };

function Card({ children, style = {} }) { return <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 14, padding: 14, marginBottom: 10, ...style }}>{children}</div>; }
function CT({ children }) { return <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#FFE600', textTransform: 'uppercase', marginBottom: 12, ...mono }}>{children}</div>; }
function SH({ title, sub }) { return <div style={{ marginBottom: 20 }}><div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#FFE600', textTransform: 'uppercase', marginBottom: 3, ...mono }}>{sub}</div><h2 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{title}</h2></div>; }
function PB({ value, max, color = '#FFE600', h = 7 }) { const p = max > 0 ? Math.min(100, (parseFloat(value) / parseFloat(max)) * 100) : 0; return <div style={{ background: '#1e293b', borderRadius: 99, height: h, overflow: 'hidden' }}><div style={{ width: `${p}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.4s' }} /></div>; }
function MR({ items }) { return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length},1fr)`, gap: 8, marginBottom: 10 }}>{items.map((m, i) => <div key={i} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '11px 8px', textAlign: 'center' }}><div style={{ fontSize: 9, letterSpacing: '0.1em', color: '#64748b', textTransform: 'uppercase', marginBottom: 4, lineHeight: 1.3, ...mono }}>{m.label}</div><div style={{ fontSize: 17, fontWeight: 700, color: m.color || '#FFE600', lineHeight: 1 }}>{m.value || '—'}</div>{m.sub && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, ...mono }}>{m.sub}</div>}</div>)}</div>; }
function Inp({ label, value, onChange, type = 'text', placeholder = '' }) { return <div style={{ marginBottom: 10 }}>{label && <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase', marginBottom: 4, ...mono }}>{label}</label>}<input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', padding: '11px 12px', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#f1f5f9', fontSize: 16, outline: 'none', boxSizing: 'border-box', ...mono }} onFocus={e => e.target.style.borderColor = '#FFE600'} onBlur={e => e.target.style.borderColor = '#1e293b'} /></div>; }
function TA({ label, value, onChange, placeholder = '', rows = 3 }) { return <div style={{ marginBottom: 10 }}>{label && <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase', marginBottom: 4, ...mono }}>{label}</label>}<textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ width: '100%', padding: '11px 12px', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#f1f5f9', fontSize: 15, outline: 'none', resize: 'vertical', boxSizing: 'border-box', ...mono }} onFocus={e => e.target.style.borderColor = '#FFE600'} onBlur={e => e.target.style.borderColor = '#1e293b'} /></div>; }
function Sel({ label, value, onChange, options }) { return <div style={{ marginBottom: 10 }}>{label && <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase', marginBottom: 4, ...mono }}>{label}</label>}<select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '11px 10px', background: '#020817', border: '1px solid #1e293b', borderRadius: 8, color: '#f1f5f9', fontSize: 15, outline: 'none', ...mono }}>{options.map(o => <option key={o}>{o}</option>)}</select></div>; }
function AddBtn({ onClick, label = 'Add' }) { return <button onClick={onClick} style={{ background: 'transparent', border: '1px dashed #334155', color: '#64748b', borderRadius: 8, padding: '12px 16px', fontSize: 14, cursor: 'pointer', width: '100%', marginTop: 4, ...mono }}>+ {label}</button>; }
function YBtn({ onClick, children, disabled = false }) { return <button onClick={onClick} disabled={disabled} style={{ background: disabled ? '#334155' : '#FFE600', border: 'none', borderRadius: 8, padding: 13, fontSize: 14, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', color: disabled ? '#64748b' : '#020817', width: '100%', ...mono }}>{children}</button>; }

function GoalCard({ goal, onChange, onRemove, statusOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: '#020817', border: '1px solid #1e293b', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <div style={{ padding: 14, display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, color: '#f1f5f9', lineHeight: 1.4, marginBottom: 6 }}>{goal.label || <span style={{ color: '#334155' }}>Untitled goal</span>}</div>
          {goal.detail && <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>{goal.detail}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={pill(goal.status)}>{goal.status}</span>
            {goal.targetDate && <span style={{ fontSize: 11, color: '#64748b', ...mono }}>by {goal.targetDate}</span>}
          </div>
        </div>
        <span style={{ color: '#334155', fontSize: 16, paddingTop: 2 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ padding: '0 14px 14px', borderTop: '1px solid #1e293b' }}>
        <div style={{ marginTop: 12 }}>
          <Inp label="Goal" value={goal.label} onChange={v => onChange({ ...goal, label: v })} placeholder="Describe the goal" />
          <Inp label="Details" value={goal.detail || ''} onChange={v => onChange({ ...goal, detail: v })} placeholder="Context, amount..." />
          <Inp label="Target Date" value={goal.targetDate || ''} onChange={v => onChange({ ...goal, targetDate: v })} type="date" />
          <Sel label="Status" value={goal.status} onChange={v => onChange({ ...goal, status: v })} options={statusOptions} />
          <button onClick={onRemove} style={{ background: '#f8717114', border: '1px solid #f8717133', color: '#f87171', borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer', width: '100%', ...mono }}>Remove</button>
        </div>
      </div>}
    </div>
  );
}

function DebtCard({ debt, onChange, onRemove }) {
  const [open, setOpen] = useState(false);
  const bal = parseFloat(debt.balance) || 0;
  return (
    <div style={{ background: '#020817', border: '1px solid #1e293b', borderRadius: 10, marginBottom: 8 }}>
      <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: '#f1f5f9', marginBottom: 4 }}>{debt.label || 'Unnamed'}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: bal > 0 ? '#f87171' : '#4ade80' }}>
              {bal > 0 ? `$${bal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}` : '✓ Paid'}
            </span>
            {debt.apr && bal > 0 && <span style={{ fontSize: 11, color: '#64748b', ...mono }}>{debt.apr}% APR</span>}
            {debt.dueDate && <span style={{ fontSize: 11, color: '#64748b', ...mono }}>due {debt.dueDate}</span>}
          </div>
        </div>
        <span style={{ color: '#334155', fontSize: 16 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ padding: '0 14px 14px', borderTop: '1px solid #1e293b' }}>
        <div style={{ marginTop: 12 }}>
          <Inp label="Label" value={debt.label} onChange={v => onChange({ ...debt, label: v })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Inp label="Balance ($)" value={debt.balance} onChange={v => onChange({ ...debt, balance: v })} type="number" />
            <Inp label="APR (%)" value={debt.apr} onChange={v => onChange({ ...debt, apr: v })} type="number" />
            <Inp label="Min Pay ($)" value={debt.minPayment} onChange={v => onChange({ ...debt, minPayment: v })} type="number" />
            <Inp label="Due Date" value={debt.dueDate || ''} onChange={v => onChange({ ...debt, dueDate: v })} type="date" />
          </div>
          <button onClick={onRemove} style={{ background: '#f8717114', border: '1px solid #f8717133', color: '#f87171', borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer', width: '100%', marginTop: 4, ...mono }}>Remove</button>
        </div>
      </div>}
    </div>
  );
}

// ── UPLOAD ZONE (reusable) ────────────────────────────────────────────────

function UploadZone({ label, accept, multiple = true, files, setFiles, icon = '📎' }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px dashed ${files.length ? '#FFE60066' : '#334155'}`, borderRadius: 12, padding: '20px 14px', cursor: 'pointer', background: files.length ? '#FFE60008' : 'transparent', transition: 'all 0.2s', marginBottom: 10 }}>
      <span style={{ fontSize: 28, marginBottom: 8 }}>{icon}</span>
      <span style={{ fontSize: 14, color: files.length ? '#FFE600' : '#64748b', textAlign: 'center', ...mono }}>
        {files.length ? `${files.length} file${files.length > 1 ? 's' : ''} ready` : label}
      </span>
      <span style={{ fontSize: 11, color: '#334155', marginTop: 4, ...mono }}>PDF · Excel · CSV · Screenshots · Any format</span>
      {files.length > 0 && (
        <div style={{ marginTop: 10, width: '100%' }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1e293b' }}>
              <span style={{ fontSize: 12, color: '#94a3b8', ...mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{f.name}</span>
              <span style={{ fontSize: 11, color: '#334155', ...mono }}>{(f.size / 1024).toFixed(0)}kb</span>
            </div>
          ))}
        </div>
      )}
      <input type="file" multiple={multiple} accept={accept} style={{ display: 'none' }} onChange={e => setFiles(Array.from(e.target.files))} />
    </label>
  );
}

// Status bar
function SBar({ status, msg }) {
  if (!msg) return null;
  const map = { success: ['#4ade80', '#4ade8018', '#4ade8033'], error: ['#f87171', '#f8717118', '#f8717133'], loading: ['#FFE600', '#FFE60018', '#FFE60033'] };
  const [c, bg, br] = map[status] || map.loading;
  return <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, fontSize: 13, color: c, background: bg, border: `1px solid ${br}`, ...mono }}>{msg}</div>;
}

// Upload history row
function UploadHistoryRow({ entry }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #1e293b' }}>
      <div>
        <div style={{ fontSize: 12, color: '#94a3b8', ...mono }}>{entry.date}</div>
        <div style={{ fontSize: 11, color: '#64748b', ...mono }}>{entry.summary}</div>
      </div>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: '#4ade8018', color: '#4ade80', border: '1px solid #4ade8033', ...mono }}>✓</span>
    </div>
  );
}

// ── FINANCIAL SECTION ─────────────────────────────────────────────────────

function FinancialSection({ data, save, replace, onAdvisor }) {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState(null);

  const income = parseFloat(data.monthlyIncome) || 0;
  const expenses = parseFloat(data.monthlyExpenses) || 0;
  const surplus = income - expenses;
  const cur = parseFloat(data.debtCurrent) || 0;
  const start = parseFloat(data.debtTarget) || 0;
  const cleared = start > 0 ? Math.max(0, start - cur) : 0;
  const pct = start > 0 ? Math.min(100, (cleared / start) * 100) : 0;

  const processFiles = async () => {
    if (!files.length) return;
    setStatus('loading'); setMsg(''); setPreview(null);
    try {
      const result = await parseFinancialFiles(files, setMsg);
      setPreview(result);
      setStatus('preview');
      setMsg(`Found ${result.debts?.length || 0} accounts. Review below then confirm.`);
    } catch (err) { setStatus('error'); setMsg(`Error: ${err.message}`); }
  };

  const applyUpdate = () => {
    const updated = { ...data };
    if (preview.totalDebt) updated.debtCurrent = preview.totalDebt;
    if (preview.monthlyIncome) updated.monthlyIncome = preview.monthlyIncome;

    // Merge debts — match by label, update balance/APR/minPayment
    if (preview.debts?.length) {
      const newDebts = [...(updated.debts || [])];
      preview.debts.forEach(pd => {
        const idx = newDebts.findIndex(d =>
          d.label.toLowerCase().replace(/[^a-z]/g, '').includes(pd.label.toLowerCase().replace(/[^a-z]/g, '').slice(0, 6)) ||
          pd.label.toLowerCase().replace(/[^a-z]/g, '').includes(d.label.toLowerCase().replace(/[^a-z]/g, '').slice(0, 6))
        );
        if (idx >= 0) {
          newDebts[idx] = { ...newDebts[idx], balance: pd.balance, apr: pd.apr || newDebts[idx].apr, minPayment: pd.minPayment || newDebts[idx].minPayment, dueDate: pd.dueDate || newDebts[idx].dueDate };
        } else if (pd.label) {
          newDebts.push({ label: pd.label, balance: pd.balance, apr: pd.apr || '', minPayment: pd.minPayment || '', dueDate: pd.dueDate || '' });
        }
      });
      updated.debts = newDebts;
    }

    // Add to upload history
    updated.uploadHistory = [
      { date: new Date().toLocaleDateString('en-CA'), files: files.map(f => f.name).join(', '), summary: preview.summary || `${preview.debts?.length || 0} accounts updated` },
      ...(updated.uploadHistory || []).slice(0, 9),
    ];

    replace(updated);
    setFiles([]); setPreview(null); setStatus('success');
    setMsg('✓ Dashboard updated — running advisor...');
    setTimeout(() => { onAdvisor(updated); }, 1800);
  };

  return (
    <div>
      <SH title="Financial Plan" sub="Money · Debt · Goals" />

      {/* Upload zone at the top */}
      <Card style={{ border: '1px solid #FFE60033' }}>
        <CT>📄 Upload Statements</CT>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, lineHeight: 1.6 }}>
          Upload any CC statements — PDF, Excel, CSV, or screenshots. Claude reads everything and updates your balances.
        </div>
        <UploadZone label="Tap to select statement files" accept=".pdf,.csv,.xlsx,.xls,image/*,.png,.jpg,.jpeg,.heic" files={files} setFiles={setFiles} icon="📄" />
        <YBtn onClick={processFiles} disabled={!files.length || status === 'loading'}>
          {status === 'loading' ? msg || 'Processing...' : 'Process Statements ✦'}
        </YBtn>
        <SBar status={status} msg={msg} />

        {/* Preview before applying */}
        {preview && status === 'preview' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, ...mono }}>Preview — confirm to apply</div>
            {preview.debts?.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #1e293b' }}>
                <span style={{ fontSize: 13, color: '#f1f5f9', ...mono }}>{d.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f87171', ...mono }}>${parseFloat(d.balance || 0).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            {preview.summary && <div style={{ fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 1.5, ...mono }}>{preview.summary}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <YBtn onClick={applyUpdate}>Apply Update ✓</YBtn>
              <button onClick={() => { setPreview(null); setStatus('idle'); setMsg(''); }} style={{ background: '#1e293b', border: 'none', borderRadius: 8, padding: 13, fontSize: 14, cursor: 'pointer', color: '#64748b', ...mono }}>Cancel</button>
            </div>
          </div>
        )}
      </Card>

      <MR items={[
        { label: 'Income',   value: income   ? `$${(income/1000).toFixed(1)}k`   : null, color: '#4ade80' },
        { label: 'Expenses', value: expenses ? `$${(expenses/1000).toFixed(1)}k` : null, color: '#f87171' },
        { label: 'Surplus',  value: surplus  ? `$${surplus.toLocaleString()}`     : null, color: surplus >= 0 ? '#4ade80' : '#f87171' },
        { label: 'Cleared',  value: `${pct.toFixed(0)}%`, sub: 'of debt',               color: '#FFE600' },
      ]} />

      <Card>
        <CT>Income & Expenses</CT>
        <Inp label="Monthly Income ($)" value={data.monthlyIncome} onChange={v => save({ ...data, monthlyIncome: v })} type="number" />
        <Inp label="Monthly Expenses ($)" value={data.monthlyExpenses} onChange={v => save({ ...data, monthlyExpenses: v })} type="number" />
      </Card>

      <Card>
        <CT>Debt Overview</CT>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <Inp label="Debt at Start ($)" value={data.debtTarget} onChange={v => save({ ...data, debtTarget: v })} type="number" />
          <Inp label="Current Debt ($)" value={data.debtCurrent} onChange={v => save({ ...data, debtCurrent: v })} type="number" />
        </div>
        <PB value={cleared} max={start || 1} color="#4ade80" />
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 5, ...mono }}>{cur > 0 ? `$${cur.toLocaleString('en-CA', { minimumFractionDigits: 2 })} remaining · $${cleared.toLocaleString('en-CA', { minimumFractionDigits: 2 })} cleared` : 'Enter values above'}</div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, ...mono }}>Individual Debts — tap to edit</div>
          {(data.debts || []).map((d, i) => (
            <DebtCard key={i} debt={d}
              onChange={v => { const debts = [...data.debts]; debts[i] = v; save({ ...data, debts }); }}
              onRemove={() => save({ ...data, debts: data.debts.filter((_, j) => j !== i) })} />
          ))}
          <AddBtn onClick={() => save({ ...data, debts: [...(data.debts||[]), { label: '', balance: '', apr: '', minPayment: '', dueDate: '' }] })} label="Add Debt" />
        </div>
      </Card>

      <Card>
        <CT>Savings Goal</CT>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <Inp label="Target ($)" value={data.savingsGoal} onChange={v => save({ ...data, savingsGoal: v })} type="number" />
          <Inp label="Current ($)" value={data.savingsCurrent} onChange={v => save({ ...data, savingsCurrent: v })} type="number" />
        </div>
        <PB value={data.savingsCurrent} max={data.savingsGoal || 1} color="#FFE600" />
      </Card>

      <Card>
        <CT>Financial Goals — tap to edit</CT>
        {(data.goals || []).map((g, i) => (
          <GoalCard key={i} goal={g}
            onChange={v => { const goals = [...data.goals]; goals[i] = v; save({ ...data, goals }); }}
            onRemove={() => save({ ...data, goals: data.goals.filter((_, j) => j !== i) })}
            statusOptions={['Not Started', 'In Progress', 'Completed', 'Blocked']} />
        ))}
        <AddBtn onClick={() => save({ ...data, goals: [...(data.goals||[]), { label: '', detail: '', targetDate: '', status: 'Not Started' }] })} label="Add Goal" />
      </Card>

      <Card>
        <CT>Strategy Notes</CT>
        <TA value={data.notes} onChange={v => save({ ...data, notes: v })} placeholder="Debt strategy..." rows={5} />
      </Card>

      {(data.uploadHistory || []).length > 0 && (
        <Card>
          <CT>Upload History</CT>
          {data.uploadHistory.map((e, i) => <UploadHistoryRow key={i} entry={e} />)}
        </Card>
      )}
    </div>
  );
}

// ── EXERCISE SECTION ──────────────────────────────────────────────────────

function ExerciseSection({ data, save, replace }) {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState(null);
  const [newEntry, setNewEntry] = useState({ date: '', type: 'HIIT', duration: '', calories: '', notes: '' });

  const weightLost = (parseFloat(data.startWeight) || 0) - (parseFloat(data.currentWeight) || 0);
  const weightToGo = (parseFloat(data.currentWeight) || 0) - (parseFloat(data.weightGoal) || 0);
  const thisWeekSessions = (data.log || []).filter(r => { const d = new Date(r.date); const now = new Date(); const ws = new Date(now); ws.setDate(now.getDate() - now.getDay()); return d >= ws; }).length;

  const processHealth = async () => {
    if (!files.length) return;
    setStatus('loading'); setMsg(''); setPreview(null);
    try {
      const result = await parseHealthFile(files[0], setMsg);
      setPreview(result);
      setStatus('preview');
      setMsg(`Found ${result.newSessions?.length || 0} sessions. Review then confirm.`);
    } catch (err) { setStatus('error'); setMsg(`Error: ${err.message}`); }
  };

  const applyUpdate = () => {
    const updated = { ...data };
    if (preview.latestWeight) updated.currentWeight = preview.latestWeight;
    if (preview.latestBodyFat) updated.bodyFat = preview.latestBodyFat;
    if (preview.latestMuscleMass) updated.muscleMass = preview.latestMuscleMass;
    if (preview.latestVisceralFat) updated.visceralFat = preview.latestVisceralFat;
    if (preview.avgRestingHR) updated.avgRestingHR = preview.avgRestingHR;
    if (preview.avgDailySteps) updated.avgDailySteps = preview.avgDailySteps;
    if (preview.newSessions?.length) {
      const existingDates = new Set((updated.log || []).map(l => l.date));
      const newEntries = preview.newSessions.filter(s => !existingDates.has(s.date));
      updated.log = [...newEntries, ...(updated.log || [])];
    }
    updated.uploadHistory = [
      { date: new Date().toLocaleDateString('en-CA'), files: files.map(f => f.name).join(', '), summary: preview.summary || `${preview.newSessions?.length || 0} sessions imported` },
      ...(updated.uploadHistory || []).slice(0, 9),
    ];
    replace(updated);
    setFiles([]); setPreview(null); setStatus('success');
    setMsg(`✓ ${preview.newSessions?.length || 0} new sessions added${preview.latestWeight ? ` · ${preview.latestWeight}kg` : ''}`);
  };

  const addManual = () => {
    if (!newEntry.date) return;
    save({ ...data, log: [newEntry, ...(data.log || [])] });
    setNewEntry({ date: '', type: 'HIIT', duration: '', calories: '', notes: '' });
  };

  return (
    <div>
      <SH title="Exercise Plan" sub="HIIT · Swimming · Body Goals" />

      <Card style={{ border: '1px solid #38bdf833' }}>
        <CT>📱 Upload Health Data</CT>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, lineHeight: 1.6 }}>
          Upload your Health Auto Export JSON, a screenshot from Renpho, or any health app screenshot. Claude reads any format.
        </div>
        <UploadZone label="Tap to select Health export, screenshot or photo" accept=".json,application/json,image/*,.png,.jpg,.jpeg,.heic,.pdf" multiple={false} files={files} setFiles={setFiles} icon="🏃" />
        <button onClick={processHealth} disabled={!files.length || status === 'loading'} style={{ background: files.length && status !== 'loading' ? '#38bdf8' : '#1e293b', border: 'none', borderRadius: 8, padding: 13, fontSize: 14, fontWeight: 700, cursor: files.length ? 'pointer' : 'default', color: files.length ? '#020817' : '#64748b', width: '100%', ...mono }}>
          {status === 'loading' ? msg || 'Importing...' : 'Import Health Data ✦'}
        </button>
        <SBar status={status} msg={msg} />

        {preview && status === 'preview' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
              {preview.latestWeight    && <div style={{ background: '#020817', border: '1px solid #1e293b', borderRadius: 8, padding: 10, textAlign: 'center' }}><div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', ...mono }}>Weight</div><div style={{ fontSize: 17, fontWeight: 700, color: '#4ade80' }}>{preview.latestWeight}kg</div></div>}
              {preview.latestBodyFat   && <div style={{ background: '#020817', border: '1px solid #1e293b', borderRadius: 8, padding: 10, textAlign: 'center' }}><div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', ...mono }}>Body Fat</div><div style={{ fontSize: 17, fontWeight: 700, color: '#FFE600' }}>{preview.latestBodyFat}%</div></div>}
              {preview.latestMuscleMass && <div style={{ background: '#020817', border: '1px solid #1e293b', borderRadius: 8, padding: 10, textAlign: 'center' }}><div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', ...mono }}>Muscle</div><div style={{ fontSize: 17, fontWeight: 700, color: '#4ade80' }}>{preview.latestMuscleMass}kg</div></div>}
              {preview.avgRestingHR    && <div style={{ background: '#020817', border: '1px solid #1e293b', borderRadius: 8, padding: 10, textAlign: 'center' }}><div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', ...mono }}>Resting HR</div><div style={{ fontSize: 17, fontWeight: 700, color: '#f87171' }}>{preview.avgRestingHR}bpm</div></div>}
              {preview.avgDailySteps   && <div style={{ background: '#020817', border: '1px solid #1e293b', borderRadius: 8, padding: 10, textAlign: 'center' }}><div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', ...mono }}>Avg Steps</div><div style={{ fontSize: 17, fontWeight: 700, color: '#38bdf8' }}>{parseInt(preview.avgDailySteps).toLocaleString()}</div></div>}
            </div>
            {preview.newSessions?.slice(0,5).map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1e293b' }}>
                <span style={{ fontSize: 12, color: s.type === 'Swim' ? '#38bdf8' : '#FFE600', ...mono }}>{s.type} · {s.date}</span>
                <span style={{ fontSize: 12, color: '#94a3b8', ...mono }}>{s.duration}min {s.calories ? `· ${s.calories}cal` : ''}</span>
              </div>
            ))}
            {(preview.newSessions?.length || 0) > 5 && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, ...mono }}>+{preview.newSessions.length - 5} more sessions</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <YBtn onClick={applyUpdate}>Apply Update ✓</YBtn>
              <button onClick={() => { setPreview(null); setStatus('idle'); setMsg(''); }} style={{ background: '#1e293b', border: 'none', borderRadius: 8, padding: 13, fontSize: 14, cursor: 'pointer', color: '#64748b', ...mono }}>Cancel</button>
            </div>
          </div>
        )}
      </Card>

      <MR items={[
        { label: 'Weight',    value: data.currentWeight ? `${data.currentWeight}kg` : null, sub: `goal ${data.weightGoal}kg`, color: '#4ade80' },
        { label: 'Body Fat',  value: data.bodyFat ? `${data.bodyFat}%` : null, sub: `goal ${data.bodyFatGoal}%`, color: '#FFE600' },
        { label: 'Visceral',  value: data.visceralFat || null, sub: `goal <${data.visceralFatGoal}`, color: '#38bdf8' },
        { label: 'This Week', value: `${thisWeekSessions}`, sub: 'sessions', color: '#a78bfa' },
      ]} />

      <Card>
        <CT>Weight Progress</CT>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <Inp label="Start (kg)" value={data.startWeight} onChange={v => save({ ...data, startWeight: v })} type="number" />
          <Inp label="Current (kg)" value={data.currentWeight} onChange={v => save({ ...data, currentWeight: v })} type="number" />
          <Inp label="Goal (kg)" value={data.weightGoal} onChange={v => save({ ...data, weightGoal: v })} type="number" />
        </div>
        <PB value={weightLost} max={(parseFloat(data.startWeight) - parseFloat(data.weightGoal)) || 1} color="#4ade80" />
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 5, ...mono }}>{weightLost > 0 ? `${weightLost.toFixed(2)}kg lost · ${weightToGo.toFixed(1)}kg to go` : 'Enter weight values'}</div>
      </Card>

      <Card>
        <CT>Body Composition</CT>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Inp label="Body Fat %" value={data.bodyFat} onChange={v => save({ ...data, bodyFat: v })} type="number" />
          <Inp label="BF Goal %" value={data.bodyFatGoal} onChange={v => save({ ...data, bodyFatGoal: v })} type="number" />
          <Inp label="Visceral Fat" value={data.visceralFat} onChange={v => save({ ...data, visceralFat: v })} type="number" />
          <Inp label="Muscle Mass (kg)" value={data.muscleMass || ''} onChange={v => save({ ...data, muscleMass: v })} type="number" />
        </div>
      </Card>

      <Card>
        <CT>Log a Session Manually</CT>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Inp label="Date" value={newEntry.date} onChange={v => setNewEntry({ ...newEntry, date: v })} type="date" />
          <Sel label="Type" value={newEntry.type} onChange={v => setNewEntry({ ...newEntry, type: v })} options={['HIIT', 'Swim', 'Walk', 'Run', 'Other']} />
          <Inp label="Duration (min)" value={newEntry.duration} onChange={v => setNewEntry({ ...newEntry, duration: v })} type="number" placeholder="45" />
          <Inp label="Calories" value={newEntry.calories} onChange={v => setNewEntry({ ...newEntry, calories: v })} type="number" placeholder="0" />
        </div>
        <Inp label="Notes" value={newEntry.notes} onChange={v => setNewEntry({ ...newEntry, notes: v })} placeholder="HR, distance, how it felt..." />
        <YBtn onClick={addManual}>Log Session</YBtn>

        {(data.log || []).length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, ...mono }}>Session History</div>
            {(data.log || []).slice(0, 12).map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #1e293b' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: r.type === 'Swim' ? '#38bdf8' : r.type === 'Walk' ? '#4ade80' : '#FFE600', ...mono }}>{r.type}</span>
                    {r.duration && <span style={{ fontSize: 13, color: '#f1f5f9', ...mono }}>{r.duration} min</span>}
                    {r.calories && <span style={{ fontSize: 13, color: '#4ade80', ...mono }}>{r.calories} cal</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', ...mono }}>{r.date}{r.notes ? ` · ${r.notes}` : ''}</div>
                </div>
                <button onClick={() => save({ ...data, log: (data.log || []).filter((_, j) => j !== i) })} style={{ background: 'transparent', border: 'none', color: '#334155', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}>×</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CT>Fitness Goals — tap to edit</CT>
        {(data.goals || []).map((g, i) => (
          <GoalCard key={i} goal={g}
            onChange={v => { const goals = [...(data.goals||[])]; goals[i] = v; save({ ...data, goals }); }}
            onRemove={() => save({ ...data, goals: (data.goals||[]).filter((_, j) => j !== i) })}
            statusOptions={['Planned', 'Active', 'In Progress', 'Done', 'Blocked']} />
        ))}
        <AddBtn onClick={() => save({ ...data, goals: [...(data.goals||[]), { label: '', detail: '', targetDate: '', status: 'Planned' }] })} label="Add Goal" />
      </Card>

      <Card>
        <CT>Notes & Schedule</CT>
        <TA value={data.notes} onChange={v => save({ ...data, notes: v })} placeholder="Schedule, injuries, notes..." rows={5} />
      </Card>

      {(data.uploadHistory || []).length > 0 && (
        <Card>
          <CT>Upload History</CT>
          {data.uploadHistory.map((e, i) => <UploadHistoryRow key={i} entry={e} />)}
        </Card>
      )}
    </div>
  );
}

// ── CAREER SECTION ────────────────────────────────────────────────────────

function CareerSection({ data, save, replace }) {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState(null);

  const processFiles = async () => {
    if (!files.length) return;
    setStatus('loading'); setMsg(''); setPreview(null);
    try {
      const result = await parseCareerFiles(files, setMsg);
      setPreview(result);
      setStatus('preview');
      setMsg(`Extracted career data. Review then confirm.`);
    } catch (err) { setStatus('error'); setMsg(`Error: ${err.message}`); }
  };

  const applyUpdate = () => {
    const updated = { ...data };
    if (preview.currentRole) updated.currentRole = preview.currentRole;
    if (preview.focusArea) updated.focusArea = preview.focusArea;
    if (preview.notes) updated.notes = (updated.notes ? updated.notes + '\n\n' : '') + preview.notes;
    if (preview.newWins?.length) updated.wins = [...preview.newWins, ...(updated.wins || [])];
    if (preview.newGoals?.length) updated.quarterlyGoals = [...(updated.quarterlyGoals || []), ...preview.newGoals];
    if (preview.newLearning?.length) updated.learningItems = [...(updated.learningItems || []), ...preview.newLearning];
    updated.uploadHistory = [
      { date: new Date().toLocaleDateString('en-CA'), files: files.map(f => f.name).join(', '), summary: preview.summary || 'Career data updated' },
      ...(updated.uploadHistory || []).slice(0, 9),
    ];
    replace(updated);
    setFiles([]); setPreview(null); setStatus('success');
    setMsg('✓ Career data updated');
  };

  const ul = (field, i, val) => { const list = [...(data[field]||[])]; list[i] = val; save({ ...data, [field]: list }); };
  const ai = (field, empty) => save({ ...data, [field]: [...(data[field]||[]), empty] });
  const ri = (field, i) => save({ ...data, [field]: (data[field]||[]).filter((_, j) => j !== i) });
  const done = (data.quarterlyGoals||[]).filter(g => g.status === 'Completed' || g.status === 'Done').length;
  const total = (data.quarterlyGoals||[]).length;

  return (
    <div>
      <SH title="Professional Growth" sub="Career · EY · Project Vibe" />

      <Card style={{ border: '1px solid #a78bfa33' }}>
        <CT>📁 Upload Career Documents</CT>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, lineHeight: 1.6 }}>Upload CVs, performance reviews, project notes, emails, screenshots — Claude extracts wins, goals, and learning items.</div>
        <UploadZone label="Tap to select career documents" accept=".pdf,.docx,.txt,.csv,image/*,.png,.jpg,.jpeg" files={files} setFiles={setFiles} icon="💼" />
        <button onClick={processFiles} disabled={!files.length || status === 'loading'} style={{ background: files.length && status !== 'loading' ? '#a78bfa' : '#1e293b', border: 'none', borderRadius: 8, padding: 13, fontSize: 14, fontWeight: 700, cursor: files.length ? 'pointer' : 'default', color: files.length ? '#020817' : '#64748b', width: '100%', ...mono }}>
          {status === 'loading' ? msg || 'Analysing...' : 'Extract Career Data ✦'}
        </button>
        <SBar status={status} msg={msg} />
        {preview && status === 'preview' && (
          <div style={{ marginTop: 14 }}>
            {preview.currentRole && <div style={{ fontSize: 13, color: '#f1f5f9', marginBottom: 6, ...mono }}>Role: {preview.currentRole}</div>}
            {preview.newWins?.map((w, i) => <div key={i} style={{ fontSize: 12, color: '#4ade80', padding: '4px 0', ...mono }}>✓ {w.label}</div>)}
            {preview.newGoals?.map((g, i) => <div key={i} style={{ fontSize: 12, color: '#FFE600', padding: '4px 0', ...mono }}>◈ {g.label}</div>)}
            {preview.newLearning?.map((l, i) => <div key={i} style={{ fontSize: 12, color: '#38bdf8', padding: '4px 0', ...mono }}>→ {l.label}</div>)}
            {preview.summary && <div style={{ fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 1.5, ...mono }}>{preview.summary}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <YBtn onClick={applyUpdate}>Apply Update ✓</YBtn>
              <button onClick={() => { setPreview(null); setStatus('idle'); setMsg(''); }} style={{ background: '#1e293b', border: 'none', borderRadius: 8, padding: 13, fontSize: 14, cursor: 'pointer', color: '#64748b', ...mono }}>Cancel</button>
            </div>
          </div>
        )}
      </Card>

      <MR items={[
        { label: 'Role',     value: 'Prod Lead', sub: 'EY Canada', color: '#FFE600' },
        { label: 'Goals',    value: `${done}/${total}`, sub: 'done', color: '#4ade80' },
        { label: 'Learning', value: `${(data.learningItems||[]).length}`, sub: 'items', color: '#38bdf8' },
        { label: 'Wins',     value: `${(data.wins||[]).length}`, sub: 'logged', color: '#a78bfa' },
      ]} />

      <Card>
        <CT>Context</CT>
        <Inp label="Current Role" value={data.currentRole} onChange={v => save({ ...data, currentRole: v })} placeholder="Title, Company" />
        <Inp label="Focus Area" value={data.focusArea} onChange={v => save({ ...data, focusArea: v })} placeholder="Project / Focus" />
      </Card>

      <Card>
        <CT>Quarterly Goals — tap to edit</CT>
        {(data.quarterlyGoals||[]).map((g, i) => (
          <GoalCard key={i} goal={g} onChange={v => ul('quarterlyGoals', i, v)} onRemove={() => ri('quarterlyGoals', i)} statusOptions={['Not Started', 'In Progress', 'Completed', 'Blocked']} />
        ))}
        <PB value={done} max={total||1} color="#4ade80" />
        <div style={{ marginTop: 8 }}><AddBtn onClick={() => ai('quarterlyGoals', { label: '', detail: '', targetDate: '', status: 'Not Started' })} label="Add Goal" /></div>
      </Card>

      <Card>
        <CT>Learning & Development</CT>
        {(data.learningItems||[]).map((item, i) => (
          <div key={i} style={{ background: '#020817', border: '1px solid #1e293b', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
            <Inp value={item.label} onChange={v => ul('learningItems', i, { ...item, label: v })} placeholder="Topic / Course / Book..." />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}><Sel value={item.status} onChange={v => ul('learningItems', i, { ...item, status: v })} options={['Planned', 'In Progress', 'Done']} /></div>
              <button onClick={() => ri('learningItems', i)} style={{ background: 'transparent', border: 'none', color: '#334155', fontSize: 22, cursor: 'pointer', padding: '4px 8px' }}>×</button>
            </div>
          </div>
        ))}
        <AddBtn onClick={() => ai('learningItems', { label: '', status: 'Planned' })} label="Add Item" />
      </Card>

      <Card>
        <CT>Wins Log</CT>
        {(data.wins||[]).map((w, i) => (
          <div key={i} style={{ background: '#020817', border: '1px solid #1e293b', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
            <Inp value={w.label} onChange={v => ul('wins', i, { ...w, label: v })} placeholder="What did you accomplish?" />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}><Inp value={w.date} onChange={v => ul('wins', i, { ...w, date: v })} type="date" /></div>
              <button onClick={() => ri('wins', i)} style={{ background: 'transparent', border: 'none', color: '#334155', fontSize: 22, cursor: 'pointer', padding: '4px 8px', marginBottom: 10 }}>×</button>
            </div>
          </div>
        ))}
        <AddBtn onClick={() => ai('wins', { label: '', date: '' })} label="Log a Win" />
      </Card>

      <Card>
        <CT>Reflections</CT>
        <TA value={data.notes} onChange={v => save({ ...data, notes: v })} placeholder="Feedback, things to improve..." rows={4} />
      </Card>

      {(data.uploadHistory||[]).length > 0 && (
        <Card>
          <CT>Upload History</CT>
          {data.uploadHistory.map((e, i) => <UploadHistoryRow key={i} entry={e} />)}
        </Card>
      )}
    </div>
  );
}

// ── ADVISOR SECTION ───────────────────────────────────────────────────────

function AdvisorSection({ financial, exercise, autoRun }) {
  const [advice, setAdvice] = useState(null);
  const [status, setStatus] = useState('idle');
  const [activeIdx, setActiveIdx] = useState(null);

  // eslint-disable-next-line
  const runAnalysis = async () => {
    setStatus('loading'); setAdvice(null);
    const inc = parseFloat(financial.monthlyIncome) || 0;
    const exp = parseFloat(financial.monthlyExpenses) || 0;
    const debt = parseFloat(financial.debtCurrent) || 0;
    const ann = inc * 12;
    const sr = inc > 0 ? ((inc - exp) / inc) : 0;
    const dti = ann > 0 ? debt / ann : 0;
    const breakdown = (financial.debts||[]).filter(d => parseFloat(d.balance) > 0).map(d => `${d.label}: $${parseFloat(d.balance).toLocaleString()} @ ${d.apr}% APR`).join('\n');
    const SYSTEM = `You are a certified Canadian financial advisor. Provide structured, actionable analysis.
CANADIAN BENCHMARKS 2024: avg household debt $85k, avg DTI 1.73x, avg savings rate 6.5%, avg CC APR 19.99%, avg household income $92k/yr, avg monthly expenses $5,800.
Return ONLY valid JSON:
{ "score": 0-100, "scoreLabel": "Critical|Poor|Fair|Good|Excellent", "headline": "one punchy sentence", "benchmarks": [{ "metric": "string", "yours": "string", "canada": "string", "status": "better|worse|similar", "note": "string" }], "priorities": [{ "rank": 1, "title": "string", "detail": "2-3 sentences with numbers", "impact": "High|Medium|Low", "timeframe": "Immediate|30 days|3 months|6 months" }], "warnings": ["string"], "positives": ["string"], "monthlyPlan": { "debtPayment": "string", "savings": "string", "discretionary": "string", "note": "string" } }`;
    try {
      const { callClaude } = await import('./upload');
      const parsed = await callClaude(SYSTEM, [{ type: 'text', content: `Monthly income: $${inc.toLocaleString()}, expenses: $${exp.toLocaleString()}, surplus: $${(inc-exp).toLocaleString()}, total debt: $${debt.toLocaleString()}, annual income: $${ann.toLocaleString()}, DTI: ${dti.toFixed(2)}x, savings rate: ${(sr*100).toFixed(1)}%\n\nDebt breakdown:\n${breakdown}\n\nGoals: ${(financial.goals||[]).map(g=>`${g.label} (${g.status})`).join(', ')}` }]);
      setAdvice(parsed); setStatus('success');
    } catch { setStatus('error'); }
  };

  useState(() => { if (autoRun) runAnalysis(); }, [autoRun]); // eslint-disable-line

  const sc = s => s >= 70 ? '#4ade80' : s >= 50 ? '#FFE600' : s >= 30 ? '#fb923c' : '#f87171';
  const stc = s => s === 'better' ? '#4ade80' : s === 'worse' ? '#f87171' : '#FFE600';
  const ic = i => i === 'High' ? '#f87171' : i === 'Medium' ? '#FFE600' : '#64748b';

  return (
    <div>
      <SH title="Financial Advisor" sub="AI Analysis · Canadian Benchmarks" />
      <Card>
        <CT>Your Snapshot</CT>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[{ l: 'Monthly Income', v: `$${(parseFloat(financial.monthlyIncome)||0).toLocaleString()}`, c: '#4ade80' },
            { l: 'Monthly Expenses', v: `$${(parseFloat(financial.monthlyExpenses)||0).toLocaleString()}`, c: '#f87171' },
            { l: 'Total Debt', v: `$${(parseFloat(financial.debtCurrent)||0).toLocaleString()}`, c: '#f87171' },
            { l: 'Surplus', v: `$${((parseFloat(financial.monthlyIncome)||0)-(parseFloat(financial.monthlyExpenses)||0)).toLocaleString()}`, c: '#4ade80' }
          ].map((m, i) => (
            <div key={i} style={{ background: '#020817', border: '1px solid #1e293b', borderRadius: 8, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, ...mono }}>{m.l}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: m.c }}>{m.v}</div>
            </div>
          ))}
        </div>
        <YBtn onClick={runAnalysis} disabled={status === 'loading'}>
          {status === 'loading' ? 'Analysing...' : status === 'success' ? 'Re-run Analysis ✦' : 'Run Financial Analysis ✦'}
        </YBtn>
        {status === 'error' && <div style={{ marginTop: 8, fontSize: 12, color: '#f87171', ...mono }}>Analysis failed — try again.</div>}
      </Card>
      {advice && (<>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 42, fontWeight: 700, color: sc(advice.score), lineHeight: 1 }}>{advice.score}</div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', ...mono }}>/ 100</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: sc(advice.score), marginBottom: 4 }}>{advice.scoreLabel}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{advice.headline}</div>
            </div>
          </div>
        </Card>
        <Card>
          <CT>You vs. Canadian Average</CT>
          {(advice.benchmarks||[]).map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: i < advice.benchmarks.length-1 ? '1px solid #1e293b' : 'none' }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: '#f1f5f9', marginBottom: 2 }}>{b.metric}</div><div style={{ fontSize: 11, color: '#64748b', ...mono }}>{b.note}</div></div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}><div style={{ fontSize: 14, fontWeight: 700, color: stc(b.status) }}>{b.yours}</div><div style={{ fontSize: 10, color: '#334155', ...mono }}>CA avg: {b.canada}</div></div>
            </div>
          ))}
        </Card>
        <Card>
          <CT>Priority Actions</CT>
          {(advice.priorities||[]).map((p, i) => (
            <div key={i} style={{ background: '#020817', border: '1px solid #1e293b', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', cursor: 'pointer' }} onClick={() => setActiveIdx(activeIdx === i ? null : i)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#FFE600' }}>#{p.rank}</span>
                    <span style={{ fontSize: 14, color: '#f1f5f9' }}>{p.title}</span>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: ic(p.impact)+'22', color: ic(p.impact), border: `1px solid ${ic(p.impact)}44`, whiteSpace: 'nowrap', marginLeft: 8, ...mono }}>{p.impact}</span>
                </div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', ...mono }}>{p.timeframe}</div>
              </div>
              {activeIdx === i && <div style={{ padding: '0 14px 14px', borderTop: '1px solid #1e293b' }}><div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginTop: 10 }}>{p.detail}</div></div>}
            </div>
          ))}
        </Card>
        {advice.monthlyPlan && (
          <Card>
            <CT>Recommended Monthly Plan</CT>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              {[{ l: 'Debt Paydown', v: `$${advice.monthlyPlan.debtPayment}`, c: '#4ade80' }, { l: 'Savings', v: `$${advice.monthlyPlan.savings}`, c: '#FFE600' }, { l: 'Discretionary', v: `$${advice.monthlyPlan.discretionary}`, c: '#38bdf8' }].map((m, i) => (
                <div key={i} style={{ background: '#020817', border: '1px solid #1e293b', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, lineHeight: 1.3, ...mono }}>{m.l}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: m.c }}>{m.v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, ...mono }}>{advice.monthlyPlan.note}</div>
          </Card>
        )}
        {(advice.warnings?.length > 0 || advice.positives?.length > 0) && (
          <Card>
            <CT>Key Observations</CT>
            {(advice.warnings||[]).map((w, i) => <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid #1e293b' }}><span style={{ color: '#f87171', flexShrink: 0 }}>⚠</span><span style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.4 }}>{w}</span></div>)}
            {(advice.positives||[]).map((p, i) => <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: i < advice.positives.length-1 ? '1px solid #1e293b' : 'none' }}><span style={{ color: '#4ade80', flexShrink: 0 }}>✓</span><span style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.4 }}>{p}</span></div>)}
          </Card>
        )}
      </>)}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────

export default function App() {
  const [fin, saveFin, replaceFin, finReady]     = useSection('financial',    D_FIN);
  const [ex,  saveEx,  replaceEx,  exReady]      = useSection('exercise',     D_EX);
  const [pro, savePro, replacePro]               = useSection('professional', D_PRO);
  const [tab, setTab]                            = useState('financial');
  const [advisorAutoRun, setAdvisorAutoRun]      = useState(false);

  const goAdvisor = (updatedFin) => {
    setAdvisorAutoRun(true);
    setTab('advisor');
    setTimeout(() => setAdvisorAutoRun(false), 600);
  };

  const ready = finReady && exReady;

  const tabs = [
    { id: 'financial',    label: 'Finance',  icon: '💰' },
    { id: 'exercise',     label: 'Exercise', icon: '⚡' },
    { id: 'professional', label: 'Career',   icon: '◈'  },
    { id: 'advisor',      label: 'Advisor',  icon: '🎯' },
  ];

  if (!ready) return (
    <div style={{ minHeight: '100vh', background: '#020817', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 28 }}>⚡</div>
      <div style={{ fontSize: 13, color: '#FFE600', letterSpacing: '0.15em', ...mono }}>
        {CONFIGURED ? 'SYNCING FROM SUPABASE...' : 'LOADING...'}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#020817', maxWidth: 480, margin: '0 auto' }}>
      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        input, textarea, select { font-size: 16px !important; font-family: 'SF Mono','Fira Code',monospace; }
        select option { background: #0f172a; }
        @media (display-mode: standalone) { body { padding-top: env(safe-area-inset-top); } }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #1e293b', padding: '14px 16px 12px', background: '#020817', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.25em', color: '#FFE600', textTransform: 'uppercase', ...mono }}>Personal Dashboard</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginTop: 2 }}>Binoy's Growth OS</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <div style={{ fontSize: 10, color: '#334155', ...mono }}>{new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</div>
          <div style={{ fontSize: 9, color: CONFIGURED ? '#4ade80' : '#334155', ...mono }}>{CONFIGURED ? '● LIVE' : '○ LOCAL'}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '14px 14px 100px' }}>
        {tab === 'financial'    && <FinancialSection data={fin} save={saveFin} replace={replaceFin} onAdvisor={goAdvisor} />}
        {tab === 'exercise'     && <ExerciseSection  data={ex}  save={saveEx}  replace={replaceEx} />}
        {tab === 'professional' && <CareerSection    data={pro} save={savePro} replace={replacePro} />}
        {tab === 'advisor'      && <AdvisorSection   financial={fin} exercise={ex} autoRun={advisorAutoRun} />}
      </div>

      {/* Bottom tab bar */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, borderTop: '1px solid #1e293b', background: '#020817', display: 'flex', zIndex: 20, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: 'transparent', border: 'none', color: tab === t.id ? '#FFE600' : '#334155', padding: '8px 4px 14px', fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, borderTop: `2px solid ${tab === t.id ? '#FFE600' : 'transparent'}`, ...mono }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
