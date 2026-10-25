
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, supabaseReady } from "@/lib/supabase";
import {
  LayoutDashboard, Package, ShoppingBag, Wallet, RefreshCw, Plus,
  Menu, X, ArrowUpRight, AlertCircle, Download, LogOut, TrendingUp,
  TrendingDown, CalendarDays
} from "lucide-react";

type Product = {
  id: string; name: string; sku?: string; purchase_price: number;
  sale_price: number; packaging_cost: number; other_unit_cost: number;
  stock_quantity: number; low_stock_limit: number; active: boolean;
};
type Order = {
  id: string; order_number: number; customer_name: string; order_date: string;
  status: string; delivery_charge: number; cod_charge: number;
  discount: number; amount_paid: number; return_fee?: number;
};
type Expense = {
  id: string; expense_date: string; category: string;
  description?: string; amount: number;
};

const money = (n: number) =>
  "৳" + Number(n || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 });

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const currentMonth = () => today().slice(0, 7);

const initialForm = () => ({
  name: "", sku: "", purchase_price: "0", sale_price: "0",
  packaging_cost: "0", other_unit_cost: "0", stock_quantity: "0",
  low_stock_limit: "5", customer_name: "", order_date: today(),
  status: "pending", delivery_charge: "0", cod_charge: "0",
  discount: "0", amount_paid: "0", product_id: "", quantity: "1",
  category: "Facebook Ads", expense_date: today(), description: "", amount: ""
});

export default function Home() {
  const [tab, setTab] = useState("Dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(initialForm());
  const [editingRecord, setEditingRecord] = useState<{ type: string; id: string } | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());

  const nav = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Products & Stock", icon: Package },
    { name: "Orders", icon: ShoppingBag },
    { name: "Expenses", icon: Wallet }
  ];

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError("");

    try {
      const [p, o, e, it] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
        supabase.from("order_items").select("*")
      ]);

      const problem = p.error || o.error || e.error || it.error;
      if (problem) {
        setError(problem.message);
      } else {
        setProducts((p.data || []) as Product[]);
        setOrders((o.data || []) as Order[]);
        setExpenses((e.data || []) as Expense[]);
        setItems(it.data || []);
      }
    } catch {
      setError("ডেটা লোড করা যায়নি। ইন্টারনেট ও Supabase connection যাচাই করো।");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabaseReady || !supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    async function checkSession() {
      const { data, error } = await supabase!.auth.getSession();
      if (!mounted) return;

      if (error) setAuthError(error.message);
      setIsAuthenticated(Boolean(data.session));
      setAuthLoading(false);

      if (data.session) void load();
    }

    void checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setIsAuthenticated(Boolean(session));
        setAuthLoading(false);

        if (session) {
          void load();
        } else {
          setProducts([]);
          setOrders([]);
          setExpenses([]);
          setItems([]);
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [load]);

  async function handleLogin(ev: React.FormEvent) {
    ev.preventDefault();
    if (!supabase) return;

    setLoginBusy(true);
    setAuthError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword
    });

    if (error) {
      setAuthError("Login হয়নি। Admin email ও password যাচাই করো।");
    } else {
      setLoginPassword("");
    }

    setLoginBusy(false);
  }

  async function handleLogout() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
      return;
    }

    setIsAuthenticated(false);
    setProducts([]);
    setOrders([]);
    setExpenses([]);
    setItems([]);
    setShowForm(false);
    setNotice("");
    setError("");
  }

  const itemTotals = useMemo(() => {
    const result: Record<string, { revenue: number; cost: number }> = {};

    for (const it of items) {
      const id = it.order_id;
      if (!id) continue;

      if (!result[id]) result[id] = { revenue: 0, cost: 0 };

      result[id].revenue +=
        Number(it.quantity || 0) * Number(it.unit_sale_price || 0);

      result[id].cost +=
        Number(it.quantity || 0) *
        (
          Number(it.unit_purchase_cost || 0) +
          Number(it.unit_packaging_cost || 0) +
          Number(it.unit_other_cost || 0)
        );
    }

    return result;
  }, [items]);

  // Lifetime: delivered orders only
  const delivered = orders.filter(o => o.status === "delivered");
  const lifetimeSales = delivered.reduce(
    (sum, o) => sum + (itemTotals[o.id]?.revenue || 0), 0
  );
  const lifetimeOrderCosts = delivered.reduce(
    (sum, o) => sum + (itemTotals[o.id]?.cost || 0), 0
  );
  const lifetimeDiscounts = delivered.reduce(
    (sum, o) => sum + Number(o.discount || 0), 0
  );
  const lifetimeDeliveryAndCod = delivered.reduce(
    (sum, o) => sum + Number(o.delivery_charge || 0) + Number(o.cod_charge || 0), 0
  );
  // Product Purchase and Packaging costs are already counted per sold item
  // from order_items. Exclude these categories here to avoid double counting.
  const overheadExpenses = expenses.filter(
    e => !["product purchase", "packaging"].includes(
      String(e.category || "").trim().toLowerCase()
    )
  );

  const lifetimeBusinessExpenses = overheadExpenses.reduce(
    (sum, e) => sum + Number(e.amount || 0), 0
  );

  const returnedOrders = orders.filter(o => o.status === "returned");
  const lifetimeReturnFees = returnedOrders.reduce(
    (sum, o) => sum + Number(o.return_fee || 0), 0
  );

  const lifetimeProfit =
    lifetimeSales -
    lifetimeOrderCosts -
    lifetimeDiscounts -
    lifetimeDeliveryAndCod -
    lifetimeBusinessExpenses -
    lifetimeReturnFees;

  // Monthly P&L: selected month
  const monthlyOrders = delivered.filter(
    o => (o.order_date || "").slice(0, 7) === selectedMonth
  );
  const monthlyExpenses = overheadExpenses.filter(
    e => (e.expense_date || "").slice(0, 7) === selectedMonth
  );

  const monthlySales = monthlyOrders.reduce(
    (sum, o) => sum + (itemTotals[o.id]?.revenue || 0), 0
  );
  const monthlyOrderCosts = monthlyOrders.reduce(
    (sum, o) => sum + (itemTotals[o.id]?.cost || 0), 0
  );
  const monthlyDiscounts = monthlyOrders.reduce(
    (sum, o) => sum + Number(o.discount || 0), 0
  );
  const monthlyDeliveryAndCod = monthlyOrders.reduce(
    (sum, o) => sum + Number(o.delivery_charge || 0) + Number(o.cod_charge || 0), 0
  );
  const monthlyExpenseTotal = monthlyExpenses.reduce(
    (sum, e) => sum + Number(e.amount || 0), 0
  );

  const monthlyReturnedOrders = returnedOrders.filter(
    o => (o.order_date || "").slice(0, 7) === selectedMonth
  );
  const monthlyReturnFees = monthlyReturnedOrders.reduce(
    (sum, o) => sum + Number(o.return_fee || 0), 0
  );

  const monthlyProfit =
    monthlySales -
    monthlyOrderCosts -
    monthlyDiscounts -
    monthlyDeliveryAndCod -
    monthlyExpenseTotal -
    monthlyReturnFees;

  const stockValue = products.reduce(
    (sum, p) => sum + Number(p.stock_quantity || 0) * Number(p.purchase_price || 0), 0
  );
  const pending = orders.filter(
    o => !["delivered", "cancelled", "returned"].includes(o.status)
  ).length;

  function openAdd() {
    setNotice("");
    setError("");
    setForm(initialForm());
    setEditingRecord(null);
    setShowForm(true);
  }

  function editRecord(type: string, record: any) {
    setError("");
    setNotice("");
    setEditingRecord({ type, id: record.id });
    if (type === "product") {
      setTab("Products & Stock");
      setForm({ ...initialForm(), name: record.name || "", sku: record.sku || "", purchase_price: String(record.purchase_price ?? 0), sale_price: String(record.sale_price ?? 0), packaging_cost: String(record.packaging_cost ?? 0), other_unit_cost: String(record.other_unit_cost ?? 0), stock_quantity: String(record.stock_quantity ?? 0), low_stock_limit: String(record.low_stock_limit ?? 5) });
    } else if (type === "order") {
      setTab("Orders");
      const item = items.find((it: any) => it.order_id === record.id);
      setForm({ ...initialForm(), customer_name: record.customer_name || "", order_date: record.order_date || today(), status: record.status || "pending", delivery_charge: String(record.delivery_charge ?? 0), cod_charge: String(record.cod_charge ?? 0), discount: String(record.discount ?? 0), amount_paid: String(record.amount_paid ?? 0), product_id: item?.product_id || "", quantity: String(item?.quantity ?? 1), sale_price: String(item?.unit_sale_price ?? 0) });
    } else {
      setTab("Expenses");
      setForm({ ...initialForm(), expense_date: record.expense_date || today(), category: record.category || "Other", description: record.description || "", amount: String(record.amount ?? 0) });
    }
    setShowForm(true);
  }

  async function deleteRecord(type: string, record: any) {
    if (!supabase) return;
    const label = type === "product" ? "এই Product" : type === "order" ? `Order #${record.order_number}` : "এই Expense";
    if (!window.confirm(`${label} Delete করতে চান? এই কাজটি ফিরিয়ে আনা যাবে না।`)) return;
    setError(""); setNotice("");
    try {
      let error: any = null;
      if (type === "product") {
        const result = await supabase.from("products").delete().eq("id", record.id);
        error = result.error;
      } else if (type === "expense") {
        const result = await supabase.from("expenses").delete().eq("id", record.id);
        error = result.error;
      } else {
        if (record.status === "delivered") {
          const restore = await supabase.rpc("set_order_status_stock", { p_order_id: record.id, p_status: "cancelled", p_return_fee: 0 });
          if (restore.error) throw new Error(restore.error.message);
        }
        const itemResult = await supabase.from("order_items").delete().eq("order_id", record.id);
        if (itemResult.error) throw new Error(itemResult.error.message);
        const orderResult = await supabase.from("orders").delete().eq("id", record.id);
        error = orderResult.error;
      }
      if (error) throw new Error(error.message);
      setNotice("রেকর্ড Delete হয়েছে।");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete করা যায়নি।");
    }
  }

  async function saveRecord(ev: React.FormEvent) {
    ev.preventDefault();
    if (!supabase) return;

    setSaving(true);
    setError("");
    setNotice("");

    let result: any;

    if (tab === "Products & Stock") {
      const productPayload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        purchase_price: Number(form.purchase_price || 0),
        sale_price: 0,
        packaging_cost: Number(form.packaging_cost || 0),
        other_unit_cost: Number(form.other_unit_cost || 0),
        stock_quantity: Number(form.stock_quantity || 0),
        low_stock_limit: Number(form.low_stock_limit || 5)
      };
      result = editingRecord?.type === "product"
        ? await supabase.from("products").update(productPayload).eq("id", editingRecord.id)
        : await supabase.from("products").insert(productPayload);
    } else if (tab === "Orders") {
      const selectedProduct = products.find(
        p => p.id === form.product_id && p.active !== false
      );
      const quantity = Math.floor(Number(form.quantity || 0));

      if (!selectedProduct) {
        setError("অর্ডারের জন্য আগে একটি পণ্য নির্বাচন করো।");
        setSaving(false);
        return;
      }
      if (!Number.isFinite(quantity) || quantity < 1) {
        setError("পণ্যের পরিমাণ কমপক্ষে ১ হতে হবে।");
        setSaving(false);
        return;
      }

      const orderPayload = {
        customer_name: form.customer_name.trim(),
        order_date: form.order_date,
        delivery_charge: Number(form.delivery_charge || 0),
        cod_charge: Number(form.cod_charge || 0),
        discount: Number(form.discount || 0),
        amount_paid: Number(form.amount_paid || 0)
      };

      if (editingRecord?.type === "order") {
        // Editing an existing order changes its details only; stock-sensitive status changes stay in the status dropdown.
        result = await supabase.from("orders").update(orderPayload).eq("id", editingRecord.id);
      } else {
      const orderResult = await supabase.from("orders").insert({ ...orderPayload, status: form.status }).select("id").single();

      if (orderResult.error) {
        result = orderResult;
      } else {
        const itemResult = await supabase.from("order_items").insert({
          order_id: orderResult.data.id,
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          quantity,
          unit_sale_price: Number(form.sale_price || 0),
          unit_purchase_cost: Number(selectedProduct.purchase_price || 0),
          unit_packaging_cost: Number(selectedProduct.packaging_cost || 0),
          unit_other_cost: Number(selectedProduct.other_unit_cost || 0)
        });

        if (itemResult.error) {
          // Avoid leaving an order without its product line if item saving fails.
          await supabase.from("orders").delete().eq("id", orderResult.data.id);
          result = itemResult;
        } else {
          result = { error: null };
        }
      }
      }
    } else {
      const expensePayload = {
        expense_date: form.expense_date,
        category: form.category,
        description: form.description.trim() || null,
        amount: Number(form.amount),
        payment_method: "cash"
      };
      result = editingRecord?.type === "expense"
        ? await supabase.from("expenses").update(expensePayload).eq("id", editingRecord.id)
        : await supabase.from("expenses").insert(expensePayload);
    }

    if (result.error) {
      setError(result.error.message);
    } else {
      setNotice(editingRecord ? "রেকর্ড আপডেট হয়েছে।" : "রেকর্ড সফলভাবে যোগ হয়েছে।");
      setShowForm(false);
      setEditingRecord(null);
      await load();
    }

    setSaving(false);
  }

  async function changeStatus(order: Order, status: string) {
    if (!supabase) return;

    let returnFee = Number(order.return_fee || 0);
    if (status === "returned") {
      const answer = window.prompt(
        "Return/Courier fee কত টাকা? (না থাকলে 0 লিখুন)",
        String(returnFee)
      );
      if (answer === null) return;
      returnFee = Number(answer);
      if (!Number.isFinite(returnFee) || returnFee < 0) {
        setError("Return fee সঠিকভাবে লিখুন।");
        return;
      }
    }

    setError("");
    setNotice("");
    try {
      const { error } = await supabase.rpc("set_order_status_stock", {
        p_order_id: order.id,
        p_status: status,
        p_return_fee: returnFee
      });
      if (error) {
        setError("স্ট্যাটাস পরিবর্তন হয়নি: " + error.message);
        return;
      }
      setNotice("অর্ডারের স্ট্যাটাস ও স্টক আপডেট হয়েছে।");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "অর্ডার আপডেট করা যায়নি।");
    }
  }

  function exportCsv() {
    const rows =
      tab === "Products & Stock"
        ? products.map(p => [p.name, p.sku || "", p.stock_quantity, p.purchase_price, p.sale_price])
        : tab === "Orders"
          ? orders.map(o => [o.order_number, o.customer_name, o.order_date, o.status, o.amount_paid])
          : expenses.map(e => [e.expense_date, e.category, e.description || "", e.amount]);

    const header =
      tab === "Products & Stock"
        ? ["Product", "SKU", "Stock", "Purchase price", "Sale price"]
        : tab === "Orders"
          ? ["Order no", "Customer", "Date", "Status", "Paid"]
          : ["Date", "Category", "Description", "Amount"];

    const csv = [header, ...rows]
      .map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = tab.toLowerCase().replaceAll(" ", "-") + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (authLoading) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      Gift Vibes নিরাপদভাবে লোড হচ্ছে...
    </div>;
  }

  if (!supabaseReady || !supabase) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div><h2>Gift Vibes</h2><p>Supabase connection পাওয়া যাচ্ছে না। Vercel Environment Variables যাচাই করে Redeploy করো।</p></div>
    </div>;
  }

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: "100vh", display: "grid", placeItems: "center",
        padding: 20, background: "#f7f5fb", fontFamily: "Arial, sans-serif"
      }}>
        <form onSubmit={handleLogin} style={{
          width: "100%", maxWidth: 400, padding: 32, borderRadius: 20,
          background: "#fff", boxShadow: "0 12px 40px rgba(30,20,50,.09)",
          boxSizing: "border-box"
        }}>
          <div style={{
            width: 54, height: 54, display: "grid", placeItems: "center",
            borderRadius: 16, background: "#6d42a5", color: "#fff",
            fontSize: 21, fontWeight: 800, marginBottom: 20
          }}>GV</div>
          <h1 style={{ margin: "0 0 8px" }}>Gift Vibes</h1>
          <p style={{ color: "#777", marginBottom: 26 }}>Admin Login — ব্যবসার হিসাব</p>

          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ display: "block", marginBottom: 7 }}>Admin Email</span>
            <input type="email" value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)} required
              autoComplete="username" style={{
                width: "100%", padding: 13, border: "1px solid #ddd",
                borderRadius: 9, boxSizing: "border-box"
              }} />
          </label>

          <label style={{ display: "block", marginBottom: 20 }}>
            <span style={{ display: "block", marginBottom: 7 }}>Password</span>
            <input type="password" value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)} required
              autoComplete="current-password" style={{
                width: "100%", padding: 13, border: "1px solid #ddd",
                borderRadius: 9, boxSizing: "border-box"
              }} />
          </label>

          {authError && <p style={{ color: "#c62828", fontSize: 14 }}>{authError}</p>}

          <button type="submit" disabled={loginBusy} style={{
            width: "100%", padding: 14, border: 0, borderRadius: 9,
            background: "#6d42a5", color: "#fff", fontWeight: 700,
            cursor: loginBusy ? "wait" : "pointer"
          }}>
            {loginBusy ? "লগইন হচ্ছে..." : "Admin Login"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">GV</div>
          <div><strong>Gift Vibes</strong><small>Business Manager</small></div>
          <button className="mobile-close" onClick={() => setMobileNav(false)}><X size={19} /></button>
        </div>
        <div className="nav-label">WORKSPACE</div>
        {nav.map(n => (
          <button key={n.name}
            className={`nav-item ${tab === n.name ? "active" : ""}`}
            onClick={() => {
              setTab(n.name); setShowForm(false); setMobileNav(false);
              setError(""); setNotice("");
            }}>
            <n.icon size={18} /><span>{n.name}</span>
            {n.name === "Orders" && pending > 0 && <em>{pending}</em>}
          </button>
        ))}
        <div className="sidebar-bottom">
          <div className="online-dot"></div>
          <div><b>Private workspace</b><small>Admin account only</small></div>
        </div>
      </aside>

      {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Close menu" />}

      <main className="main-area">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setMobileNav(true)}><Menu /></button>
          <div>
            <div className="eyebrow">GIFT VIBES / BUSINESS</div>
            <h1>{tab}</h1>
          </div>
          <div className="top-actions">
            <span className="today-pill">
              {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
            <button className="icon-btn" title="Refresh" onClick={() => void load()}><RefreshCw size={17} /></button>
            <button className="btn secondary" onClick={() => void handleLogout()}><LogOut size={15} /> Logout</button>
          </div>
        </header>

        {error && <div className="alert error"><AlertCircle size={19} /><div><b>সমস্যা হয়েছে</b><p>{error}</p></div></div>}
        {notice && <div className="notice">{notice}</div>}

        {tab === "Dashboard" && (
          <div className="content">
            <div className="welcome">
              <div>
                <div className="eyebrow light">YOUR BUSINESS AT A GLANCE</div>
                <h2>আজকের হিসাব, এক জায়গায়।</h2>
                <p>Gift Vibes-এর বিক্রি, খরচ ও লাভ-লোকসান দেখুন।</p>
              </div>
              <div className="welcome-orb">GV</div>
            </div>

            <div className="section-heading">
              <div><h3><CalendarDays size={18} /> Lifetime Profit & Loss</h3>
                <p>ব্যবসার শুরু থেকে এখন পর্যন্ত — Delivered orders</p></div>
            </div>
            <div className="stats-grid">
              <Stat title="Lifetime Sales" value={money(lifetimeSales)} detail={`${delivered.length} delivered orders`} tone="purple" />
              <Stat title="Order Product Cost" value={money(lifetimeOrderCosts)} detail="ক্রয় + প্যাকেজিং + অন্যান্য ইউনিট খরচ" tone="orange" />
              <Stat title="Business Expenses" value={money(lifetimeBusinessExpenses)} detail={`${overheadExpenses.length} overhead entries`} tone="blue" />
              <Stat title="Lifetime Net Profit / Loss" value={money(lifetimeProfit)} detail={lifetimeProfit >= 0 ? "নিট লাভ" : "নিট লোকসান"} tone={lifetimeProfit >= 0 ? "green" : "red"} />
            </div>

            <div className="panel" style={{ marginBottom: 24 }}>
              <div className="panel-title">
                <div><h3>Lifetime P&L Breakdown</h3><p>সম্পূর্ণ ব্যবসার আয়-ব্যয়ের সারাংশ</p></div>
                {lifetimeProfit >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
              </div>
              <div className="status-list">
                <div className="status-row"><span>Delivered sales</span><b>{money(lifetimeSales)}</b></div>
                <div className="status-row"><span>Product costs</span><b>− {money(lifetimeOrderCosts)}</b></div>
                <div className="status-row"><span>Discounts</span><b>− {money(lifetimeDiscounts)}</b></div>
                <div className="status-row"><span>Delivery + COD charges</span><b>− {money(lifetimeDeliveryAndCod)}</b></div>
                <div className="status-row"><span>Overhead expenses (excluding Product Purchase/Packaging)</span><b>− {money(lifetimeBusinessExpenses)}</b></div>
                <div className="status-row"><span>Return fees</span><b>− {money(lifetimeReturnFees)}</b></div>
                <div className="status-row"><strong>Lifetime Net Profit / Loss</strong><strong>{money(lifetimeProfit)}</strong></div>
              </div>
            </div>

            <div className="section-heading">
              <div><h3><CalendarDays size={18} /> Monthly Profit & Loss</h3>
                <p>যে মাসের হিসাব দেখতে চাও সেটি নির্বাচন করো</p></div>
              <input aria-label="Select month" type="month" value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                style={{ padding: 10, border: "1px solid #ddd", borderRadius: 9 }} />
            </div>

            <div className="stats-grid">
              <Stat title="Monthly Sales" value={money(monthlySales)} detail={`${monthlyOrders.length} delivered orders`} tone="purple" />
              <Stat title="Monthly Product Cost" value={money(monthlyOrderCosts)} detail="পণ্যের মোট ইউনিট খরচ" tone="orange" />
              <Stat title="Monthly Expenses" value={money(monthlyExpenseTotal)} detail={`${monthlyExpenses.length} overhead entries`} tone="blue" />
              <Stat title="Monthly Net Profit / Loss" value={money(monthlyProfit)} detail={monthlyProfit >= 0 ? "নির্বাচিত মাসে নিট লাভ" : "নির্বাচিত মাসে নিট লোকসান"} tone={monthlyProfit >= 0 ? "green" : "red"} />
            </div>

            <div className="panel" style={{ marginBottom: 24 }}>
              <div className="panel-title">
                <div><h3>{selectedMonth} — Monthly P&L Breakdown</h3><p>শুধু নির্বাচিত মাসের Delivered orders ও ওই মাসের expenses</p></div>
                {monthlyProfit >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
              </div>
              <div className="status-list">
                <div className="status-row"><span>Delivered sales</span><b>{money(monthlySales)}</b></div>
                <div className="status-row"><span>Product costs</span><b>− {money(monthlyOrderCosts)}</b></div>
                <div className="status-row"><span>Discounts</span><b>− {money(monthlyDiscounts)}</b></div>
                <div className="status-row"><span>Delivery + COD charges</span><b>− {money(monthlyDeliveryAndCod)}</b></div>
                <div className="status-row"><span>Overhead expenses (excluding Product Purchase/Packaging)</span><b>− {money(monthlyExpenseTotal)}</b></div>
                <div className="status-row"><span>Return fees</span><b>− {money(monthlyReturnFees)}</b></div>
                <div className="status-row"><strong>Monthly Net Profit / Loss</strong><strong>{money(monthlyProfit)}</strong></div>
              </div>
            </div>

            <div className="stats-grid">
              <Stat title="Stock Value" value={money(stockValue)} detail={`${products.length} products`} tone="blue" />
              <Stat title="Pending Orders" value={String(pending)} detail="Delivered/cancelled/returned বাদে" tone="orange" />
            </div>

            <div className="overview-grid">
              <div className="panel">
                <div className="panel-title"><div><h3>Order status</h3><p>সব অর্ডারের বর্তমান অবস্থা</p></div><ShoppingBag size={20} /></div>
                <div className="status-list">
                  {["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"].map(s => (
                    <div className="status-row" key={s}>
                      <span className={`status-dot ${s}`}></span><span className="capitalize">{s}</span>
                      <b>{orders.filter(o => o.status === s).length}</b>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel">
                <div className="panel-title"><div><h3>Stock alerts</h3><p>কম স্টক থাকা পণ্য</p></div><Package size={20} /></div>
                {products.filter(p => p.stock_quantity <= p.low_stock_limit).length === 0
                  ? <div className="empty-state">কম স্টক থাকা পণ্য নেই।</div>
                  : products.filter(p => p.stock_quantity <= p.low_stock_limit).slice(0, 5).map(p => (
                    <div className="stock-row" key={p.id}>
                      <div className="product-avatar">{p.name.slice(0, 1).toUpperCase()}</div>
                      <div className="grow"><b>{p.name}</b><small>Stock: {p.stock_quantity}</small></div>
                      <span className="low-badge">Low stock</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="panel recent">
              <div className="panel-title"><div><h3>Recent orders</h3><p>সর্বশেষ যোগ করা অর্ডার</p></div>
                <button className="text-btn" onClick={() => setTab("Orders")}>সব অর্ডার <ArrowUpRight size={15} /></button>
              </div>
              <OrdersTable orders={orders.slice(0, 5)} changeStatus={changeStatus} items={items} editRecord={editRecord} deleteRecord={deleteRecord} />
            </div>
          </div>
        )}

        {tab !== "Dashboard" && (
          <div className="content">
            <div className="section-heading">
              <div>
                <h3>{tab === "Products & Stock" ? "পণ্য ও স্টক ম্যানেজমেন্ট" : tab === "Orders" ? "অর্ডার ম্যানেজমেন্ট" : "ব্যবসার খরচ"}</h3>
                <p>{tab === "Products & Stock" ? "ক্রয়মূল্য ও স্টক রাখুন; বিক্রয়মূল্য অর্ডারে লিখুন" : tab === "Orders" ? "অর্ডার ও ডেলিভারি স্ট্যাটাস ট্র্যাক করুন" : "বিজ্ঞাপন, প্যাকেজিং ও অন্যান্য খরচ যোগ করুন"}</p>
              </div>
              <div className="row-actions">
                <button className="btn secondary" onClick={exportCsv}><Download size={15} /> Export CSV</button>
                <button className="btn primary" onClick={openAdd}><Plus size={17} /> Add {tab === "Products & Stock" ? "Product" : tab === "Orders" ? "Order" : "Expense"}</button>
              </div>
            </div>

            {showForm && (
              <form className="panel form-panel" onSubmit={saveRecord}>
                <div className="panel-title">
                  <div><h3>{editingRecord ? "রেকর্ড Edit করুন" : `নতুন ${tab === "Products & Stock" ? "পণ্য" : tab === "Orders" ? "অর্ডার" : "খরচ"} যোগ করুন`}</h3><p>প্রয়োজনীয় তথ্য পূরণ করুন</p></div>
                  <button type="button" className="icon-btn" onClick={() => { setShowForm(false); setEditingRecord(null); }}><X size={17} /></button>
                </div>

                {tab === "Products & Stock" && (
                  <div className="form-grid">
                    <Field label="Product name *" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
                    <Field label="SKU (optional)" value={form.sku} onChange={v => setForm({ ...form, sku: v })} />
                    <Field label="Purchase price (৳)" type="number" value={form.purchase_price} onChange={v => setForm({ ...form, purchase_price: v })} required />
                    <Field label="Packaging cost per unit (৳)" type="number" value={form.packaging_cost} onChange={v => setForm({ ...form, packaging_cost: v })} />
                    <Field label="Other unit cost (৳)" type="number" value={form.other_unit_cost} onChange={v => setForm({ ...form, other_unit_cost: v })} />
                    <Field label="Opening stock" type="number" value={form.stock_quantity} onChange={v => setForm({ ...form, stock_quantity: v })} />
                    <Field label="Low stock alert at" type="number" value={form.low_stock_limit} onChange={v => setForm({ ...form, low_stock_limit: v })} />
                  </div>
                )}

                {tab === "Orders" && (
                  <div className="form-grid">
                    <Field label="Customer name *" value={form.customer_name} onChange={v => setForm({ ...form, customer_name: v })} required />
                    <Field label="Order date" type="date" value={form.order_date} onChange={v => setForm({ ...form, order_date: v })} />
                    <label className="field"><span>Product *</span>
                      <select value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })} required>
                        <option value="">পণ্য নির্বাচন করো</option>
                        {products.filter(p => p.active !== false).map(p => (
                          <option key={p.id} value={p.id}>{p.name} — Buy Price: {money(p.purchase_price)}</option>
                        ))}
                      </select>
                    </label>
                    <Field label="Quantity *" type="number" value={form.quantity} onChange={v => setForm({ ...form, quantity: v })} required />
                    <Field label="Sale price per unit (৳) *" type="number" value={form.sale_price} onChange={v => setForm({ ...form, sale_price: v })} required />
                    <label className="field"><span>Status</span>
                      <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                        {["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </label>
                    <Field label="Delivery charge (৳)" type="number" value={form.delivery_charge} onChange={v => setForm({ ...form, delivery_charge: v })} />
                    <Field label="COD charge (৳)" type="number" value={form.cod_charge} onChange={v => setForm({ ...form, cod_charge: v })} />
                    <Field label="Discount (৳)" type="number" value={form.discount} onChange={v => setForm({ ...form, discount: v })} />
                    <Field label="Amount paid (৳)" type="number" value={form.amount_paid} onChange={v => setForm({ ...form, amount_paid: v })} />
                  </div>
                )}

                {tab === "Expenses" && (
                  <div className="form-grid">
                    <label className="field"><span>Category</span>
                      <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                        {["Facebook Ads", "Product purchase", "Packaging", "Courier", "COD fee", "Transport", "Salary", "Commission", "Other"].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </label>
                    <Field label="Expense date" type="date" value={form.expense_date} onChange={v => setForm({ ...form, expense_date: v })} />
                    <Field label="Amount (৳) *" type="number" value={form.amount} onChange={v => setForm({ ...form, amount: v })} required />
                    <Field label="Description" value={form.description} onChange={v => setForm({ ...form, description: v })} />
                    <p className="footnote" style={{ gridColumn: "1 / -1" }}>
                      Product purchase ও Packaging খরচ এখানে নথিভুক্ত করা যাবে, তবে Net Profit-এ এই দুই category আবার বাদ হবে না—কারণ বিক্রি হওয়া পণ্যের খরচ order_items থেকে হিসাব করা হয়।
                    </p>
                  </div>
                )}

                <div className="form-footer">
                  <button type="button" className="btn secondary" onClick={() => { setShowForm(false); setEditingRecord(null); }}>Cancel</button>
                  <button className="btn primary" disabled={saving}>{saving ? "Saving..." : editingRecord ? "Update record" : "Save record"}</button>
                </div>
              </form>
            )}

            {loading ? <div className="panel empty-state">লোড হচ্ছে...</div> :
              tab === "Products & Stock" ? (
                <div className="panel table-panel">
                  <table><thead><tr><th>Product</th><th>Stock</th><th>Purchase</th><th>Sale</th><th>Unit margin*</th><th>Actions</th></tr></thead>
                    <tbody>{products.map(p => <tr key={p.id}>
                      <td><b>{p.name}</b><small>{p.sku || "No SKU"}</small></td>
                      <td><span className={p.stock_quantity <= p.low_stock_limit ? "low-badge" : "pill"}>{p.stock_quantity}</span></td>
                      <td>{money(p.purchase_price)}</td><td>{money(p.sale_price)}</td>
                      <td>{money(Number(p.sale_price) - Number(p.purchase_price) - Number(p.packaging_cost) - Number(p.other_unit_cost))}</td>
                      <td><button className="btn secondary" onClick={() => editRecord("product", p)}>Edit</button> <button className="btn secondary" onClick={() => void deleteRecord("product", p)}>Delete</button></td>
                    </tr>)}</tbody>
                  </table>
                  {products.length === 0 && <div className="empty-state">এখনো কোনো পণ্য যোগ করা হয়নি। Add Product চাপুন।</div>}
                  <p className="footnote">* আনুমানিক unit margin; বিজ্ঞাপন ও অন্যান্য ব্যবসায়িক খরচ বাদ দেওয়ার আগের হিসাব।</p>
                </div>
              ) : tab === "Orders" ? (
                <div className="panel table-panel">
                  <OrdersTable orders={orders} changeStatus={changeStatus} items={items} editRecord={editRecord} deleteRecord={deleteRecord} />
                  {orders.length === 0 && <div className="empty-state">এখনো কোনো অর্ডার নেই। Add Order চাপুন।</div>}
                  <p className="footnote">নতুন অর্ডারে একটি পণ্য ও তার পরিমাণ সেভ হয়। এক অর্ডারে একাধিক পণ্য যোগ করার ব্যবস্থা এই সংস্করণে নেই। আগের অর্ডারগুলোর order_items তথ্য না থাকলে পুরোনো লাভের হিসাব অসম্পূর্ণ হতে পারে।</p>
                </div>
              ) : (
                <div className="panel table-panel">
                  <table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Actions</th></tr></thead>
                    <tbody>{expenses.map(e => <tr key={e.id}>
                      <td>{e.expense_date}</td><td>{e.category}</td><td>{e.description || "—"}</td><td className="amount">{money(e.amount)}</td>
                      <td><button className="btn secondary" onClick={() => editRecord("expense", e)}>Edit</button> <button className="btn secondary" onClick={() => void deleteRecord("expense", e)}>Delete</button></td>
                    </tr>)}</tbody>
                  </table>
                  {expenses.length === 0 && <div className="empty-state">এখনো কোনো খরচ যোগ করা হয়নি।</div>}
                </div>
              )
            }
          </div>
        )}

        <footer className="footer">Gift Vibes Business Manager <span>•</span> Private business workspace</footer>
      </main>
    </div>
  );
}

function Stat({ title, value, detail, tone }: {
  title: string; value: string; detail: string; tone: string;
}) {
  return <div className="stat-card">
    <div className={`stat-icon ${tone}`}><Wallet size={19} /></div>
    <span className="stat-title">{title}</span>
    <strong className="stat-value">{value}</strong>
    <small>{detail}</small>
  </div>;
}

function Field({ label, value, onChange, type = "text", required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean;
}) {
  return <label className="field"><span>{label}</span>
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      required={required} min={type === "number" ? "0" : undefined}
      step={type === "number" ? "0.01" : undefined} />
  </label>;
}

function OrdersTable({
  orders,
  changeStatus,
  items,
  editRecord,
  deleteRecord
}: {
  orders: Order[];
  changeStatus: (o: Order, s: string) => void;
  items: any[];
  editRecord: (type: string, record: any) => void;
  deleteRecord: (type: string, record: any) => void;
}) {
  function getOrderProfit(order: Order): number | null {
    const orderItems = items.filter(item => item.order_id === order.id);
    const revenue = orderItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_sale_price || 0),
      0
    );
    const productCost = orderItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * (
        Number(item.unit_purchase_cost || 0) +
        Number(item.unit_packaging_cost || 0) +
        Number(item.unit_other_cost || 0)
      ),
      0
    );

    if (order.status === "returned") {
      return -(Number(order.return_fee || 0) + Number(order.delivery_charge || 0) + Number(order.cod_charge || 0));
    }
    if (order.status !== "delivered") return null;
    return revenue - productCost - Number(order.discount || 0) - Number(order.delivery_charge || 0) - Number(order.cod_charge || 0);
  }

  return <div className="table-scroll">
    <table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th>Paid</th><th>Profit / Loss</th><th>Actions</th></tr></thead>
      <tbody>{orders.map(o => {
        const profit = getOrderProfit(o);
        return <tr key={o.id}>
          <td><b>#{o.order_number}</b></td><td>{o.customer_name}</td><td>{o.order_date}</td>
          <td>
            <select className={`status-select ${o.status}`} value={o.status}
              onChange={e => changeStatus(o, e.target.value)}>
              {["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {o.status === "returned" && <small style={{ display: "block", marginTop: 4 }}>Return fee: {money(Number(o.return_fee || 0))}</small>}
          </td>
          <td>{money(o.amount_paid)}</td>
          <td>{profit === null ? "—" : <b style={{ color: profit < 0 ? "#c62828" : "#16803c" }}>{profit < 0 ? "−" : ""}{money(Math.abs(profit))}</b>}</td>
          <td><button className="btn secondary" onClick={() => editRecord("order", o)}>Edit</button> <button className="btn secondary" onClick={() => void deleteRecord("order", o)}>Delete</button></td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
