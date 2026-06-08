import { createClient } from '@supabase/supabase-js';

const URL = process.env.REACT_APP_SUPABASE_URL || '';
const KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
export const supabase = createClient(URL, KEY);
export const CONFIGURED = !!(URL && KEY);
export const UID = 'binoy';

// Load a section from Supabase (falls back to localStorage)
export async function loadSection(section, defaultVal) {
  if (!CONFIGURED) {
    try {
      const s = localStorage.getItem(`gos_${section}`);
      return s ? { ...defaultVal, ...JSON.parse(s) } : defaultVal;
    } catch { return defaultVal; }
  }
  const { data, error } = await supabase
    .from('dashboard_data')
    .select('data')
    .eq('id', `${UID}_${section}`)
    .single();
  if (error || !data?.data || !Object.keys(data.data).length) return defaultVal;
  return { ...defaultVal, ...data.data };
}

// Save a section (debounced by caller)
export async function saveSection(section, val) {
  if (!CONFIGURED) {
    try { localStorage.setItem(`gos_${section}`, JSON.stringify(val)); } catch {}
    return;
  }
  await supabase.from('dashboard_data').upsert({
    id: `${UID}_${section}`,
    user_id: UID,
    section,
    data: val,
    updated_at: new Date().toISOString(),
  });
}
