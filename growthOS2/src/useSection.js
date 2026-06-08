import { useState, useEffect, useRef, useCallback } from 'react';
import { loadSection, saveSection } from './db';

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function useSection(section, defaultVal) {
  const [data, setData] = useState(defaultVal);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSection(section, defaultVal).then(d => { setData(d); setReady(true); });
  }, [section]); // eslint-disable-line

  const debouncedSave = useRef(debounce((s, v) => saveSection(s, v), 700)).current;

  const save = useCallback((val) => {
    const next = typeof val === 'function' ? val(data) : val;
    setData(next);
    debouncedSave(section, next);
  }, [data, section, debouncedSave]);

  // Allow external full replace (after upload)
  const replace = useCallback((val) => {
    setData(val);
    saveSection(section, val);
  }, [section]);

  return [data, save, replace, ready];
}
