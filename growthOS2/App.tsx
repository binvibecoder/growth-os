import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
  Dimensions, Modal, FlatList, Alert
} from 'react-native'
import { supabase } from './lib/supabase'
import { MENU, searchMenu, Dish } from './lib/malayaliMenu'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const TAB_HEIGHT = 60
const API_URL = 'https://growth-os-ivory-mu.vercel.app/api'

type Tab = 'Today' | 'Health' | 'Finance' | 'Insights'

interface Card { id: string; card_name: string; current_balance: number; credit_limit: number | null; apr: number; due_date: string | null; is_active: boolean }
interface Transaction { id?: string; transaction_date: string; merchant: string; amount: number; category: string; is_payment: boolean }
interface Budget { id?: string; category: string; monthly_limit: number; month: string }
interface LoggedItem { dish: Dish; qty: number }

const CATEGORIES = ['groceries','dining','gas','transport','utilities','subscriptions','shopping','kids','medical','entertainment','fees','interest','other']
const CATEGORY_ICONS: Record<string, string> = {
  groceries:'🛒', dining:'🍽️', gas:'⛽', transport:'🚗', utilities:'💡',
  subscriptions:'📱', shopping:'🛍️', kids:'👶', medical:'💊',
  entertainment:'🎬', fees:'🏦', interest:'💸', other:'📦', payment:'💳'
}

// ─── Menu Picker ──────────────────────────
function MenuPicker({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (item: LoggedItem) => void }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Dish | null>(null)
  const [qty, setQty] = useState(1)
  const [activeSection, setActiveSection] = useState(0)
  const results = search ? searchMenu(search) : null

  const handleAdd = () => {
    if (!selected) return
    onAdd({ dish: selected, qty })
    setSelected(null); setQty(1); setSearch('')
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={M.container}>
        <View style={M.header}>
          <TouchableOpacity onPress={onClose} style={M.closeBtn}><Text style={M.closeTxt}>✕</Text></TouchableOpacity>
          <Text style={M.title}>Indian / Malayali Menu</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={M.searchWrap}>
          <TextInput style={M.searchInput} placeholder="Search dishes..." placeholderTextColor="#555" value={search} onChangeText={setSearch} />
        </View>
        {!results && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={M.catScroll}>
            {MENU.map((section, i) => (
              <TouchableOpacity key={i} onPress={() => setActiveSection(i)} style={[M.catBtn, activeSection === i && M.catBtnOn]}>
                <Text style={M.catTxt}>{section.emoji} {section.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        <FlatList
          data={results || MENU[activeSection].data}
          keyExtractor={item => item.id}
          style={M.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={[M.dishRow, selected?.id === item.id && M.dishRowOn]} onPress={() => { setSelected(item); setQty(1) }}>
              <View style={M.dishInfo}>
                <Text style={M.dishName}>{item.name}</Text>
                <Text style={M.dishMl}>{item.nameMl}</Text>
              </View>
              <View style={M.dishMeta}>
                <Text style={M.dishCal}>{item.cal} cal</Text>
                <Text style={M.dishUnit}>per {item.unit}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
        {selected && (
          <View style={M.selectedPanel}>
            <Text style={M.selName}>{selected.name}</Text>
            <View style={M.macroRow}>
              <View style={M.macroItem}><Text style={[M.macroVal,{color:'#6BFF9F'}]}>{Math.round(selected.cal*qty)}</Text><Text style={M.macroLbl}>cal</Text></View>
              <View style={M.macroItem}><Text style={[M.macroVal,{color:'#6C63FF'}]}>{(selected.protein*qty).toFixed(1)}g</Text><Text style={M.macroLbl}>protein</Text></View>
              <View style={M.macroItem}><Text style={[M.macroVal,{color:'#FF9F43'}]}>{(selected.carbs*qty).toFixed(1)}g</Text><Text style={M.macroLbl}>carbs</Text></View>
              <View style={M.macroItem}><Text style={[M.macroVal,{color:'#FF6B6B'}]}>{(selected.fat*qty).toFixed(1)}g</Text><Text style={M.macroLbl}>fat</Text></View>
            </View>
            <View style={M.qtyRow}>
              <Text style={M.qtyLbl}>Qty ({selected.unit})</Text>
              <View style={M.qtyControls}>
                <TouchableOpacity style={M.qtyBtn} onPress={() => setQty(q => Math.max(0.5, +(q-0.5).toFixed(1)))}><Text style={M.qtyBtnTxt}>−</Text></TouchableOpacity>
                <Text style={M.qtyNum}>{qty}</Text>
                <TouchableOpacity style={M.qtyBtn} onPress={() => setQty(q => +(q+0.5).toFixed(1))}><Text style={M.qtyBtnTxt}>+</Text></TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={M.addBtn} onPress={handleAdd}>
              <Text style={M.addBtnTxt}>Add {Math.round(selected.cal*qty)} cal →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  )
}

// ─── Log Meal ─────────────────────────────
function LogMealScreen({ onBack }: { onBack: () => void }) {
  const [showMenu, setShowMenu] = useState(false)
  const [items, setItems] = useState<LoggedItem[]>([])
  const [mealType, setMealType] = useState<'breakfast'|'lunch'|'dinner'|'snack'>('lunch')
  const [saving, setSaving] = useState(false)
  const totalCal = items.reduce((sum, i) => sum + Math.round(i.dish.cal * i.qty), 0)

  const saveMeal = async () => {
    if (items.length === 0) { Alert.alert('No items', 'Add at least one item.'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: meal } = await supabase.from('meal_logs').insert({
      user_id: user.id, meal_type: mealType, input_method: 'menu',
      total_calories: totalCal,
      total_protein: +items.reduce((s,i) => s+i.dish.protein*i.qty,0).toFixed(1),
      total_carbs: +items.reduce((s,i) => s+i.dish.carbs*i.qty,0).toFixed(1),
      total_fat: +items.reduce((s,i) => s+i.dish.fat*i.qty,0).toFixed(1),
    }).select().single()
    if (meal) {
      await supabase.from('meal_items').insert(items.map(i => ({
        meal_log_id: meal.id, food_name: i.dish.name, quantity: i.qty, unit: i.dish.unit,
        calories: Math.round(i.dish.cal*i.qty),
        protein: +(i.dish.protein*i.qty).toFixed(1),
        carbs: +(i.dish.carbs*i.qty).toFixed(1),
        fat: +(i.dish.fat*i.qty).toFixed(1),
        fiber: 0, sodium: 0, source: 'malayali_menu',
      })))
    }
    setSaving(false)
    onBack()
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <View style={L.header}>
        <TouchableOpacity onPress={onBack} style={L.backBtn}><Text style={L.backTxt}>← Back</Text></TouchableOpacity>
        <Text style={L.title}>Log Meal</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
        <View style={L.typeRow}>
          {(['breakfast','lunch','dinner','snack'] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setMealType(t)} style={[L.typeBtn, mealType===t && L.typeBtnOn]}>
              <Text style={[L.typeTxt, mealType===t && L.typeTxtOn]}>{t.charAt(0).toUpperCase()+t.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={S.card}>
          <Text style={S.label}>INPUT METHOD</Text>
          <TouchableOpacity style={L.methodBtn} onPress={() => setShowMenu(true)}>
            <Text style={L.methodIcon}>📋</Text>
            <View style={{ flex: 1 }}><Text style={L.methodName}>Indian / Malayali Menu</Text><Text style={L.methodSub}>75+ dishes with macros</Text></View>
            <Text style={L.methodArrow}>›</Text>
          </TouchableOpacity>
        </View>
        {items.length > 0 && (
          <View style={S.card}>
            <Text style={S.label}>ITEMS — {totalCal} cal total</Text>
            {items.map((item, i) => (
              <View key={i} style={L.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={L.itemName}>{item.dish.name}</Text>
                  <Text style={L.itemMeta}>{item.qty} {item.dish.unit} · {Math.round(item.dish.cal*item.qty)} cal</Text>
                </View>
                <TouchableOpacity onPress={() => setItems(prev => prev.filter((_,j) => j!==i))}><Text style={L.removeBtn}>✕</Text></TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={[L.saveBtn, saving && { opacity: 0.5 }]} onPress={saveMeal} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={L.saveBtnTxt}>Save Meal — {totalCal} cal</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      <MenuPicker visible={showMenu} onClose={() => setShowMenu(false)} onAdd={item => { setItems(p => [...p, item]); setShowMenu(false) }} />
    </View>
  )
}

// ─── Statement Upload Screen ──────────────
function UploadStatementScreen({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const [processing, setProcessing] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [statementPeriod, setStatementPeriod] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const handleFileUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.png,.jpg,.jpeg,.webp'
    input.onchange = async (e: any) => {
      const file = e.target.files[0]
      if (!file) return
      setProcessing(true)
      setMsg('Analyzing statement with AI...')
      setTransactions([])

      try {
        const reader = new FileReader()
        reader.onload = async (ev) => {
          const base64 = (ev.target?.result as string).split(',')[1]
          const isPdf = file.type === 'application/pdf'

          const response = await fetch(`${API_URL}/process-statement`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_base64: base64,
              file_type: isPdf ? 'pdf' : 'image',
              media_type: file.type,
            })
          })

          const data = await response.json()
          if (data.error) {
            setMsg('Error: ' + data.error)
          } else {
            setTransactions(data.transactions || [])
            setStatementPeriod(data.statement_period || '')
            setMsg(`Found ${data.transactions?.length || 0} transactions. Review and save.`)
          }
          setProcessing(false)
        }
        reader.readAsDataURL(file)
      } catch (err: any) {
        setMsg('Upload failed: ' + err.message)
        setProcessing(false)
      }
    }
    input.click()
  }

  const updateCategory = (index: number, category: string) => {
    setTransactions(prev => prev.map((t, i) => i === index ? { ...t, category } : t))
  }

  const removeTransaction = (index: number) => {
    setTransactions(prev => prev.filter((_, i) => i !== index))
  }

  const saveTransactions = async () => {
    if (transactions.length === 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const rows = transactions.map(t => ({
      user_id: user.id,
      transaction_date: t.transaction_date,
      merchant: t.merchant,
      amount: t.amount,
      category: t.category,
      is_payment: t.is_payment,
      month: statementPeriod || t.transaction_date.substring(0, 7),
      source: 'pdf_ocr',
    }))

    const { error } = await supabase.from('transactions').insert(rows)
    setSaving(false)
    if (error) {
      setMsg('Save failed: ' + error.message)
    } else {
      onSaved()
    }
  }

  const spendOnly = transactions.filter(t => !t.is_payment)
  const totalSpend = spendOnly.reduce((s, t) => s + t.amount, 0)

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <View style={L.header}>
        <TouchableOpacity onPress={onBack} style={L.backBtn}><Text style={L.backTxt}>← Back</Text></TouchableOpacity>
        <Text style={L.title}>Upload Statement</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

        <View style={S.card}>
          <Text style={S.label}>UPLOAD FILE</Text>
          <Text style={UP.hint}>PDF, screenshot or photo of your CC statement. No card numbers are stored — only merchant, amount, date and category.</Text>
          <TouchableOpacity style={UP.uploadBtn} onPress={handleFileUpload} disabled={processing}>
            {processing
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Text style={UP.uploadIcon}>📄</Text>
                  <Text style={UP.uploadTxt}>Choose PDF or Image</Text>
                </>
            }
          </TouchableOpacity>
          {msg !== '' && <Text style={[UP.msg, msg.startsWith('Error') || msg.startsWith('Upload') ? { color: '#FF6B6B' } : { color: '#6BFF9F' }]}>{msg}</Text>}
        </View>

        {transactions.length > 0 && (
          <>
            <View style={S.card}>
              <Text style={S.label}>SUMMARY</Text>
              <View style={S.row3}>
                <View style={S.center}><Text style={[S.big, { color: '#FF9F43' }]}>{spendOnly.length}</Text><Text style={S.tiny}>transactions</Text></View>
                <View style={S.center}><Text style={[S.big, { color: '#FF6B6B' }]}>${totalSpend.toFixed(2)}</Text><Text style={S.tiny}>total spend</Text></View>
                <View style={S.center}><Text style={[S.big, { color: '#6C63FF' }]}>{statementPeriod}</Text><Text style={S.tiny}>period</Text></View>
              </View>
            </View>

            <View style={S.card}>
              <Text style={S.label}>REVIEW TRANSACTIONS — tap category to change</Text>
              {transactions.map((txn, i) => (
                <View key={i} style={UP.txnRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={UP.txnMerchant}>{txn.merchant}</Text>
                      <Text style={[UP.txnAmount, { color: txn.is_payment ? '#6BFF9F' : '#FF9F43' }]}>
                        {txn.is_payment ? '-' : ''}${Math.abs(txn.amount).toFixed(2)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={UP.txnDate}>{txn.transaction_date}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          {CATEGORIES.slice(0, 6).map(cat => (
                            <TouchableOpacity
                              key={cat}
                              onPress={() => updateCategory(i, cat)}
                              style={[UP.catChip, txn.category === cat && UP.catChipOn]}
                            >
                              <Text style={[UP.catChipTxt, txn.category === cat && UP.catChipTxtOn]}>
                                {CATEGORY_ICONS[cat]} {cat}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removeTransaction(i)} style={{ paddingLeft: 10 }}>
                    <Text style={{ color: '#FF6B6B', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <TouchableOpacity style={[L.saveBtn, saving && { opacity: 0.5 }]} onPress={saveTransactions} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={L.saveBtnTxt}>Save {transactions.length} Transactions</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  )
}

// ─── Budget Setup ─────────────────────────
function BudgetScreen({ onBack }: { onBack: () => void }) {
  const [budgets, setBudgets] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const month = new Date().toISOString().substring(0, 7) + '-01'

  useEffect(() => {
    supabase.from('budgets').select('*').eq('month', month).then(({ data }) => {
      if (data) {
        const b: Record<string, string> = {}
        data.forEach((d: Budget) => { b[d.category] = String(d.monthly_limit) })
        setBudgets(b)
      }
    })
  }, [])

  const save = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const rows = Object.entries(budgets)
      .filter(([_, v]) => v && parseFloat(v) > 0)
      .map(([category, monthly_limit]) => ({
        user_id: user.id, category, monthly_limit: parseFloat(monthly_limit), month
      }))
    await supabase.from('budgets').upsert(rows, { onConflict: 'user_id,category,month' })
    setSaving(false)
    setMsg('Budgets saved!')
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <View style={L.header}>
        <TouchableOpacity onPress={onBack} style={L.backBtn}><Text style={L.backTxt}>← Back</Text></TouchableOpacity>
        <Text style={L.title}>Set Budgets</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={UP.hint}>Set monthly spending limits per category. You'll get an alert when you exceed them.</Text>
        {msg !== '' && <Text style={{ color: '#6BFF9F', marginBottom: 12, textAlign: 'center' }}>{msg}</Text>}
        {CATEGORIES.filter(c => c !== 'interest' && c !== 'fees' && c !== 'payment').map(cat => (
          <View key={cat} style={UP.budgetRow}>
            <Text style={UP.budgetIcon}>{CATEGORY_ICONS[cat]}</Text>
            <Text style={UP.budgetCat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
            <View style={UP.budgetInputWrap}>
              <Text style={UP.budgetDollar}>$</Text>
              <TextInput
                style={UP.budgetInput}
                placeholder="0"
                placeholderTextColor="#555"
                value={budgets[cat] || ''}
                onChangeText={v => setBudgets(prev => ({ ...prev, [cat]: v }))}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        ))}
        <TouchableOpacity style={[L.saveBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={L.saveBtnTxt}>Save Budgets</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

// ─── Finance Screen ───────────────────────
function FinanceScreen() {
  const [view, setView] = useState<'main'|'upload'|'budget'>('main')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  const month = new Date().toISOString().substring(0, 7) + '-01'

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: txns }, { data: bdgs }] = await Promise.all([
      supabase.from('transactions').select('*').eq('month', month).order('transaction_date', { ascending: false }),
      supabase.from('budgets').select('*').eq('month', month),
    ])
    setTransactions((txns as Transaction[]) ?? [])
    setBudgets((bdgs as Budget[]) ?? [])
    setLoading(false)
  }, [month])

  useEffect(() => { fetchData() }, [fetchData])

  if (view === 'upload') return <UploadStatementScreen onBack={() => setView('main')} onSaved={() => { setView('main'); fetchData() }} />
  if (view === 'budget') return <BudgetScreen onBack={() => { setView('main'); fetchData() }} />

  const spendOnly = transactions.filter(t => !t.is_payment)
  const totalSpend = spendOnly.reduce((s, t) => s + t.amount, 0)

  // Spend by category
  const byCategory: Record<string, number> = {}
  spendOnly.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount
  })
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1])

  // Over-budget alerts
  const alerts = budgets.filter(b => (byCategory[b.category] || 0) > b.monthly_limit)

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <ScrollView style={S.fill} contentContainerStyle={S.scrollPad}>
        <View style={S.spaceBetween}>
          <Text style={S.pageTitle}>Finance</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={AC.addBtn} onPress={() => setView('budget')}>
              <Text style={AC.addBtnTxt}>💰 Budget</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[AC.addBtn, { backgroundColor: '#1A2E1A' }]} onPress={() => setView('upload')}>
              <Text style={AC.addBtnTxt}>📄 Upload</Text>
            </TouchableOpacity>
          </View>
        </View>

        {alerts.length > 0 && (
          <View style={UP.alertBox}>
            <Text style={UP.alertTitle}>🚨 Over Budget</Text>
            {alerts.map(b => (
              <Text key={b.category} style={UP.alertRow}>
                {CATEGORY_ICONS[b.category]} {b.category}: ${(byCategory[b.category] || 0).toFixed(2)} / ${b.monthly_limit.toFixed(2)} limit
              </Text>
            ))}
          </View>
        )}

        {loading ? (
          <ActivityIndicator color="#6C63FF" style={{ marginTop: 40 }} />
        ) : transactions.length === 0 ? (
          <View style={[S.card, { alignItems: 'center', paddingVertical: 40 }]}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📄</Text>
            <Text style={{ color: '#888', fontSize: 14, textAlign: 'center' }}>
              No transactions yet.{'\n'}Tap Upload to import your CC statement.
            </Text>
          </View>
        ) : (
          <>
            <View style={S.card}>
              <Text style={S.label}>THIS MONTH</Text>
              <View style={S.row3}>
                <View style={S.center}><Text style={[S.big,{color:'#FF9F43'}]}>${totalSpend.toFixed(0)}</Text><Text style={S.tiny}>total spend</Text></View>
                <View style={S.center}><Text style={[S.big,{color:'#6C63FF'}]}>{spendOnly.length}</Text><Text style={S.tiny}>transactions</Text></View>
                <View style={S.center}><Text style={[S.big,{color:'#FF6B6B'}]}>{alerts.length}</Text><Text style={S.tiny}>over budget</Text></View>
              </View>
            </View>

            <View style={S.card}>
              <Text style={S.label}>SPEND BY CATEGORY</Text>
              {sortedCategories.map(([cat, amt]) => {
                const budget = budgets.find(b => b.category === cat)
                const pct = budget ? Math.min((amt / budget.monthly_limit) * 100, 100) : 0
                const over = budget && amt > budget.monthly_limit
                return (
                  <View key={cat} style={UP.catRow}>
                    <Text style={UP.catIcon}>{CATEGORY_ICONS[cat] || '📦'}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={UP.catName}>{cat}</Text>
                        <Text style={[UP.catAmt, over && { color: '#FF6B6B' }]}>
                          ${amt.toFixed(2)}{budget ? ` / $${budget.monthly_limit}` : ''}
                        </Text>
                      </View>
                      {budget && (
                        <View style={UP.catBar}>
                          <View style={[UP.catBarFill, { width: pct + '%' as any, backgroundColor: over ? '#FF6B6B' : '#6C63FF' }]} />
                        </View>
                      )}
                    </View>
                  </View>
                )
              })}
            </View>

            <View style={S.card}>
              <Text style={S.label}>RECENT TRANSACTIONS</Text>
              {transactions.slice(0, 15).map((txn, i) => (
                <View key={i} style={[UP.txnRow, { borderBottomWidth: i < 14 ? 1 : 0, borderBottomColor: '#252540' }]}>
                  <Text style={{ fontSize: 20, marginRight: 10 }}>{CATEGORY_ICONS[txn.category] || '📦'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={UP.txnMerchant}>{txn.merchant}</Text>
                    <Text style={UP.txnDate}>{txn.transaction_date} · {txn.category}</Text>
                  </View>
                  <Text style={[UP.txnAmount, { color: txn.is_payment ? '#6BFF9F' : '#FF9F43' }]}>
                    {txn.is_payment ? '-' : ''}${Math.abs(txn.amount).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

// ─── Today ────────────────────────────────
function TodayScreen() {
  const [period, setPeriod] = useState<'day'|'week'|'month'>('day')
  const [alerts, setAlerts] = useState<string[]>([])
  const meals    = { day: { count: 2, cal: 850 }, week: { count: 14, cal: 9240 }, month: { count: 52, cal: 38400 } }
  const exercise = { day: { count: 1, cal: 320 }, week: { count: 4,  cal: 1480 }, month: { count: 14, cal: 5200 } }
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    const month = new Date().toISOString().substring(0, 7) + '-01'
    Promise.all([
      supabase.from('transactions').select('category, amount').eq('month', month).eq('is_payment', false),
      supabase.from('budgets').select('*').eq('month', month),
    ]).then(([{ data: txns }, { data: bdgs }]) => {
      if (!txns || !bdgs) return
      const byCategory: Record<string, number> = {}
      txns.forEach((t: any) => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount })
      const overBudget = bdgs.filter((b: any) => (byCategory[b.category] || 0) > b.monthly_limit)
      setAlerts(overBudget.map((b: any) => `${CATEGORY_ICONS[b.category]} ${b.category} over budget`))
    })
  }, [])

  return (
    <ScrollView style={S.fill} contentContainerStyle={S.scrollPad}>
      <Text style={S.greeting}>{greeting} 👋</Text>
      <Text style={S.sub}>{new Date().toDateString()}</Text>

      {alerts.length > 0 && (
        <View style={UP.alertBox}>
          <Text style={UP.alertTitle}>🚨 Budget Alerts</Text>
          {alerts.map((a, i) => <Text key={i} style={UP.alertRow}>{a}</Text>)}
        </View>
      )}

      <View style={S.card}>
        <Text style={S.label}>CALORIES TODAY</Text>
        <View style={S.row3}>
          <View style={S.center}><Text style={S.big}>850</Text><Text style={S.tiny}>eaten</Text></View>
          <Text style={S.sep}>—</Text>
          <View style={S.center}><Text style={S.big}>320</Text><Text style={S.tiny}>burned</Text></View>
          <Text style={S.sep}>=</Text>
          <View style={S.center}><Text style={[S.big,{color:'#6BFF9F'}]}>530</Text><Text style={S.tiny}>net</Text></View>
        </View>
        <View style={S.bar}><View style={[S.fill2,{width:'43%'}]} /></View>
        <Text style={S.barLabel}>850 of 2000 cal goal (43%)</Text>
      </View>

      <View style={S.card}>
        <Text style={S.label}>MACROS TODAY</Text>
        <View style={S.row3}>
          <View style={S.center}><Text style={[S.big,{color:'#6C63FF'}]}>48g</Text><Text style={S.tiny}>Protein</Text></View>
          <View style={S.center}><Text style={[S.big,{color:'#FF9F43'}]}>112g</Text><Text style={S.tiny}>Carbs</Text></View>
          <View style={S.center}><Text style={[S.big,{color:'#FF6B6B'}]}>28g</Text><Text style={S.tiny}>Fat</Text></View>
        </View>
      </View>

      <View style={S.card}>
        <View style={S.spaceBetween}>
          <Text style={S.label}>MEALS & EXERCISE</Text>
          <View style={S.toggle}>
            {(['day','week','month'] as const).map(p => (
              <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={[S.toggleBtn, period===p && S.toggleBtnOn]}>
                <Text style={[S.toggleTxt, period===p && S.toggleTxtOn]}>{p==='day'?'Day':p==='week'?'Week':'Month'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={S.statRow}>
          <View style={S.statBox}>
            <Text style={S.statIcon}>🍽️</Text>
            <Text style={S.statNum}>{meals[period].count}</Text>
            <Text style={S.statLbl}>Meals</Text>
            <Text style={S.statCal}>{meals[period].cal.toLocaleString()} cal in</Text>
          </View>
          <View style={S.statLine} />
          <View style={S.statBox}>
            <Text style={S.statIcon}>💪</Text>
            <Text style={S.statNum}>{exercise[period].count}</Text>
            <Text style={S.statLbl}>Sessions</Text>
            <Text style={S.statCal}>{exercise[period].cal.toLocaleString()} cal burned</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

// ─── Health ───────────────────────────────
function HealthScreen() {
  const [showLogMeal, setShowLogMeal] = useState(false)
  if (showLogMeal) return <LogMealScreen onBack={() => setShowLogMeal(false)} />
  return (
    <ScrollView style={S.fill} contentContainerStyle={S.scrollPad}>
      <Text style={S.pageTitle}>Health</Text>
      <View style={S.card}>
        <Text style={S.label}>TODAY'S MEALS</Text>
        <View style={S.logRow}><Text style={S.logIco}>🍛</Text><View><Text style={S.logName}>Chicken Rice Bowl</Text><Text style={S.logMeta}>Lunch · 480 cal</Text></View></View>
        <View style={S.logRow}><Text style={S.logIco}>☕</Text><View><Text style={S.logName}>Chai + Idli x2</Text><Text style={S.logMeta}>Breakfast · 170 cal</Text></View></View>
        <TouchableOpacity style={S.btn} onPress={() => setShowLogMeal(true)}><Text style={S.btnTxt}>+ Log Meal</Text></TouchableOpacity>
      </View>
      <View style={S.card}>
        <Text style={S.label}>TODAY'S EXERCISE</Text>
        <View style={S.logRow}><Text style={S.logIco}>🏊</Text><View><Text style={S.logName}>Swimming</Text><Text style={S.logMeta}>45 min · 320 cal burned</Text></View></View>
        <TouchableOpacity style={S.btn}><Text style={S.btnTxt}>+ Log Exercise</Text></TouchableOpacity>
      </View>
    </ScrollView>
  )
}

// ─── Insights ─────────────────────────────
function InsightsScreen() {
  const [topCategories, setTopCategories] = useState<[string,number][]>([])
  const [totalSpend, setTotalSpend] = useState(0)
  const month = new Date().toISOString().substring(0, 7) + '-01'

  useEffect(() => {
    supabase.from('transactions').select('category, amount').eq('month', month).eq('is_payment', false).then(({ data }) => {
      if (!data) return
      const by: Record<string, number> = {}
      data.forEach((t: any) => { by[t.category] = (by[t.category] || 0) + t.amount })
      setTopCategories(Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5))
      setTotalSpend(data.reduce((s: number, t: any) => s + t.amount, 0))
    })
  }, [month])

  return (
    <ScrollView style={S.fill} contentContainerStyle={S.scrollPad}>
      <Text style={S.pageTitle}>Insights</Text>
      {topCategories.length > 0 && (
        <View style={S.card}>
          <Text style={S.label}>💡 TOP SPENDING THIS MONTH</Text>
          {topCategories.map(([cat, amt]) => (
            <View key={cat} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={S.insightTxt}>{CATEGORY_ICONS[cat]} {cat}</Text>
              <Text style={{ color: '#FF9F43', fontWeight: '700' }}>${amt.toFixed(2)} ({((amt/totalSpend)*100).toFixed(0)}%)</Text>
            </View>
          ))}
        </View>
      )}
      <View style={S.card}>
        <Text style={S.label}>🏠 MORTGAGE RENEWAL</Text>
        <Text style={S.insightTxt}>August 31 renewal. Broker at 3.7% saves $20,880 vs Scotia over 3 years.</Text>
      </View>
      <View style={S.card}>
        <Text style={S.label}>⚠️ CT CARD DEADLINE</Text>
        <Text style={S.insightTxt}>Pay $500/month to clear $2,000 BT before Oct 11. 4 months left.</Text>
      </View>
    </ScrollView>
  )
}

// ─── Main App ─────────────────────────────
function MainApp() {
  const [tab, setTab] = useState<Tab>('Today')
  const tabs: { name: Tab; icon: string }[] = [
    { name: 'Today', icon: '🏠' }, { name: 'Health', icon: '🥗' },
    { name: 'Finance', icon: '💳' }, { name: 'Insights', icon: '💡' },
  ]
  return (
    <View style={{ flex: 1, height: SCREEN_HEIGHT }}>
      <View style={{ flex: 1 }}>
        {tab === 'Today'    && <TodayScreen />}
        {tab === 'Health'   && <HealthScreen />}
        {tab === 'Finance'  && <FinanceScreen />}
        {tab === 'Insights' && <InsightsScreen />}
      </View>
      <View style={S.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity key={t.name} style={S.tabItem} onPress={() => setTab(t.name)}>
            {tab === t.name && <View style={S.tabLine} />}
            <Text style={S.tabIcon}>{t.icon}</Text>
            <Text style={[S.tabTxt, tab === t.name && S.tabTxtOn]}>{t.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

// ─── Auth ─────────────────────────────────
function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [isErr, setIsErr] = useState(false)
  const show = (m: string, e = false) => { setMsg(m); setIsErr(e) }
  const login = async () => {
    if (!email || !password) { show('Enter email and password', true); return }
    setLoading(true); setMsg('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) show(error.message, true)
  }
  const signup = async () => {
    if (!fullName || !email || !password) { show('Fill in all fields', true); return }
    if (password.length < 6) { show('Password min 6 characters', true); return }
    setLoading(true); setMsg('')
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
    if (!error && data.user) await supabase.from('profiles').insert({ id: data.user.id, email: email.trim(), full_name: fullName.trim() })
    setLoading(false)
    if (error) show(error.message, true)
    else { show('Account created! Sign in now.'); setIsLogin(true) }
  }
  return (
    <View style={S.authWrap}>
      <Text style={S.logo}>GrowthOS</Text>
      <Text style={S.tagline}>Health · Finance · Life</Text>
      {msg !== '' && <View style={[S.msgBox, isErr ? S.msgErr : S.msgOk]}><Text style={S.msgTxt}>{msg}</Text></View>}
      {!isLogin && <TextInput style={S.input} placeholder="Full name" placeholderTextColor="#666" value={fullName} onChangeText={setFullName} />}
      <TextInput style={S.input} placeholder="Email" placeholderTextColor="#666" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={S.input} placeholder="Password" placeholderTextColor="#666" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={[S.authBtn, loading && S.authBtnOff]} onPress={isLogin ? login : signup} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.authBtnTxt}>{isLogin ? 'Sign In' : 'Create Account'}</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={S.link} onPress={() => { setIsLogin(!isLogin); setMsg('') }}>
        <Text style={S.linkTxt}>{isLogin ? 'New here? ' : 'Have an account? '}<Text style={S.linkAcc}>{isLogin ? 'Create account' : 'Sign in'}</Text></Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Root ─────────────────────────────────
export default function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    supabase.auth.onAuthStateChange((_, s) => setSession(s))
  }, [])
  if (loading) return <View style={S.authWrap}><ActivityIndicator size="large" color="#6C63FF" /></View>
  return session ? <MainApp /> : <AuthScreen />
}

// ─── Styles ───────────────────────────────
const S = StyleSheet.create({
  fill:         { flex: 1, backgroundColor: '#0A0A0F' },
  scrollPad:    { padding: 20, paddingBottom: 30 },
  authWrap:     { flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', paddingHorizontal: 24 },
  tabBar:       { height: TAB_HEIGHT, flexDirection: 'row', backgroundColor: '#111', borderTopWidth: 1, borderTopColor: '#1A1A2E' },
  tabItem:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLine:      { position: 'absolute', top: 0, width: 32, height: 2, backgroundColor: '#6C63FF', borderRadius: 1 },
  tabIcon:      { fontSize: 18 },
  tabTxt:       { fontSize: 10, color: '#555', marginTop: 2 },
  tabTxtOn:     { color: '#6C63FF', fontWeight: '700' },
  greeting:     { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  sub:          { fontSize: 12, color: '#888', marginBottom: 18 },
  pageTitle:    { fontSize: 26, fontWeight: '700', color: '#FFF', marginBottom: 18 },
  label:        { fontSize: 10, fontWeight: '700', color: '#888', letterSpacing: 1.5, marginBottom: 12 },
  card:         { backgroundColor: '#1A1A2E', borderRadius: 14, padding: 18, marginBottom: 14 },
  row3:         { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 14 },
  center:       { alignItems: 'center' },
  big:          { fontSize: 26, fontWeight: '700', color: '#FFF' },
  tiny:         { fontSize: 10, color: '#666', marginTop: 2 },
  sep:          { fontSize: 18, color: '#444' },
  bar:          { height: 5, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  fill2:        { height: '100%', backgroundColor: '#6C63FF', borderRadius: 3 },
  barLabel:     { fontSize: 10, color: '#666', textAlign: 'right' },
  spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  toggle:       { flexDirection: 'row', backgroundColor: '#0F0F1A', borderRadius: 8, padding: 2 },
  toggleBtn:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  toggleBtnOn:  { backgroundColor: '#6C63FF' },
  toggleTxt:    { fontSize: 11, color: '#666' },
  toggleTxtOn:  { color: '#FFF', fontWeight: '600' },
  statRow:      { flexDirection: 'row', alignItems: 'center' },
  statBox:      { flex: 1, alignItems: 'center', paddingVertical: 6 },
  statLine:     { width: 1, height: 60, backgroundColor: '#333' },
  statIcon:     { fontSize: 22, marginBottom: 4 },
  statNum:      { fontSize: 26, fontWeight: '700', color: '#FFF' },
  statLbl:      { fontSize: 10, color: '#888', marginTop: 2 },
  statCal:      { fontSize: 11, color: '#6C63FF', marginTop: 3, fontWeight: '600' },
  logRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  logIco:       { fontSize: 22 },
  logName:      { color: '#FFF', fontSize: 13, fontWeight: '500' },
  logMeta:      { color: '#666', fontSize: 11, marginTop: 2 },
  btn:          { backgroundColor: '#6C63FF', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 6 },
  btnTxt:       { color: '#FFF', fontWeight: '600', fontSize: 14 },
  insightTxt:   { fontSize: 13, color: '#CCC', lineHeight: 20 },
  logo:         { fontSize: 38, fontWeight: '700', color: '#FFF', textAlign: 'center', marginBottom: 6 },
  tagline:      { fontSize: 13, color: '#888', textAlign: 'center', letterSpacing: 2, marginBottom: 30 },
  msgBox:       { borderRadius: 10, padding: 12, marginBottom: 14 },
  msgErr:       { backgroundColor: '#2E1A1A', borderWidth: 1, borderColor: '#5A2727' },
  msgOk:        { backgroundColor: '#1A2E1A', borderWidth: 1, borderColor: '#2D5A27' },
  msgTxt:       { color: '#FFF', fontSize: 13, textAlign: 'center' },
  input:        { backgroundColor: '#1A1A2E', borderRadius: 12, padding: 16, fontSize: 15, color: '#FFF', borderWidth: 1, borderColor: '#333', marginBottom: 10 },
  authBtn:      { backgroundColor: '#6C63FF', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 6 },
  authBtnOff:   { opacity: 0.5 },
  authBtnTxt:   { color: '#FFF', fontSize: 16, fontWeight: '600' },
  link:         { alignItems: 'center', paddingVertical: 14 },
  linkTxt:      { color: '#888', fontSize: 13 },
  linkAcc:      { color: '#6C63FF', fontWeight: '600' },
})

const M = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0A0A0F' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  closeBtn:     { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeTxt:     { color: '#888', fontSize: 18 },
  title:        { color: '#FFF', fontSize: 17, fontWeight: '600' },
  searchWrap:   { padding: 12 },
  searchInput:  { backgroundColor: '#1A1A2E', borderRadius: 10, padding: 12, color: '#FFF', fontSize: 14, borderWidth: 1, borderColor: '#333' },
  catScroll:    { maxHeight: 44, paddingHorizontal: 12, marginBottom: 4 },
  catBtn:       { paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderRadius: 20, backgroundColor: '#1A1A2E' },
  catBtnOn:     { backgroundColor: '#6C63FF' },
  catTxt:       { color: '#AAA', fontSize: 12 },
  list:         { flex: 1 },
  dishRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111' },
  dishRowOn:    { backgroundColor: '#1A1A2E' },
  dishInfo:     { flex: 1 },
  dishName:     { color: '#FFF', fontSize: 14, fontWeight: '500' },
  dishMl:       { color: '#555', fontSize: 11, marginTop: 2 },
  dishMeta:     { alignItems: 'flex-end' },
  dishCal:      { color: '#6C63FF', fontSize: 14, fontWeight: '600' },
  dishUnit:     { color: '#444', fontSize: 10, marginTop: 2 },
  selectedPanel:{ backgroundColor: '#1A1A2E', padding: 20, borderTopWidth: 1, borderTopColor: '#333' },
  selName:      { color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  macroRow:     { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#0F0F1A', borderRadius: 10, padding: 12, marginBottom: 14 },
  macroItem:    { alignItems: 'center' },
  macroVal:     { fontSize: 18, fontWeight: '700' },
  macroLbl:     { color: '#666', fontSize: 10, marginTop: 2 },
  qtyRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  qtyLbl:       { color: '#AAA', fontSize: 13 },
  qtyControls:  { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn:       { width: 34, height: 34, borderRadius: 17, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  qtyBtnTxt:    { color: '#FFF', fontSize: 20, lineHeight: 22 },
  qtyNum:       { color: '#FFF', fontSize: 20, fontWeight: '700', minWidth: 30, textAlign: 'center' },
  addBtn:       { backgroundColor: '#6C63FF', borderRadius: 12, padding: 14, alignItems: 'center' },
  addBtnTxt:    { color: '#FFF', fontSize: 15, fontWeight: '700' },
})

const L = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A2E' },
  backBtn:      { width: 60 },
  backTxt:      { color: '#6C63FF', fontSize: 14, fontWeight: '600' },
  title:        { color: '#FFF', fontSize: 17, fontWeight: '600' },
  typeRow:      { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn:      { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1A1A2E', alignItems: 'center' },
  typeBtnOn:    { backgroundColor: '#6C63FF' },
  typeTxt:      { color: '#666', fontSize: 12 },
  typeTxtOn:    { color: '#FFF', fontWeight: '600' },
  methodBtn:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#252540', gap: 12 },
  methodIcon:   { fontSize: 24, width: 36 },
  methodName:   { color: '#FFF', fontSize: 14, fontWeight: '500' },
  methodSub:    { color: '#666', fontSize: 11, marginTop: 2 },
  methodArrow:  { color: '#444', fontSize: 20, marginLeft: 'auto' },
  itemRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#252540' },
  itemName:     { color: '#FFF', fontSize: 14, fontWeight: '500' },
  itemMeta:     { color: '#666', fontSize: 11, marginTop: 2 },
  removeBtn:    { color: '#FF6B6B', fontSize: 16, paddingLeft: 12 },
  saveBtn:      { backgroundColor: '#6C63FF', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 14 },
  saveBtnTxt:   { color: '#FFF', fontSize: 15, fontWeight: '700' },
})

const AC = StyleSheet.create({
  addBtn:       { backgroundColor: '#6C63FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnTxt:    { color: '#FFF', fontWeight: '700', fontSize: 13 },
})

const UP = StyleSheet.create({
  hint:         { color: '#888', fontSize: 12, lineHeight: 18, marginBottom: 16 },
  uploadBtn:    { backgroundColor: '#1A2E1A', borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#2D5A27', borderStyle: 'dashed' },
  uploadIcon:   { fontSize: 32, marginBottom: 8 },
  uploadTxt:    { color: '#6BFF9F', fontSize: 14, fontWeight: '600' },
  msg:          { marginTop: 12, fontSize: 13, textAlign: 'center' },
  txnRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  txnMerchant:  { color: '#FFF', fontSize: 13, fontWeight: '500' },
  txnDate:      { color: '#666', fontSize: 11, marginTop: 2 },
  txnAmount:    { fontSize: 14, fontWeight: '700' },
  catChip:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: '#252540' },
  catChipOn:    { backgroundColor: '#6C63FF' },
  catChipTxt:   { color: '#888', fontSize: 10 },
  catChipTxtOn: { color: '#FFF' },
  alertBox:     { backgroundColor: '#2E1A1A', borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#5A2727' },
  alertTitle:   { color: '#FF6B6B', fontWeight: '700', fontSize: 14, marginBottom: 8 },
  alertRow:     { color: '#FFAAAA', fontSize: 13, marginBottom: 4 },
  catRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  catIcon:      { fontSize: 20, width: 32 },
  catName:      { color: '#FFF', fontSize: 13, fontWeight: '500' },
  catAmt:       { color: '#FF9F43', fontSize: 13, fontWeight: '600' },
  catBar:       { height: 4, backgroundColor: '#333', borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  catBarFill:   { height: '100%', borderRadius: 2 },
  budgetRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A2E', borderRadius: 10, padding: 14, marginBottom: 8 },
  budgetIcon:   { fontSize: 20, width: 32 },
  budgetCat:    { flex: 1, color: '#FFF', fontSize: 14 },
  budgetInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F0F1A', borderRadius: 8, paddingHorizontal: 10 },
  budgetDollar: { color: '#888', fontSize: 14, marginRight: 4 },
  budgetInput:  { color: '#FFF', fontSize: 14, width: 70, padding: 8 },
})
