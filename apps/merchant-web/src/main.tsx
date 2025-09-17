import React, { useState, useMemo } from "react";
import { createRoot } from "react-dom/client";

const API_BASE = "http://localhost:4000/api";

function UploadCSV() {
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  async function handleUpload() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setLoading(true);
    setRes(null);
    try {
      const r = await fetch(`${API_BASE}/merchants/import-menu`, { method: "POST", body: fd });
      const j = await r.json();
      setRes(j);
    } catch (e: any) {
      setRes({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">Importer CSV</h2>
      <p className="text-sm mb-3">Sélectionne <code>templates/menu_template.csv</code> puis clique “Téléverser”.</p>
      <input type="file" accept=".csv" onChange={e => setFile(e.target.files?.[0] || null)} />
      <button className="ml-2 px-3 py-1 rounded bg-black text-white disabled:opacity-50" disabled={!file || loading} onClick={handleUpload}>
        {loading ? "Envoi..." : "Téléverser"}
      </button>
      {res && (
        <pre className="mt-4 p-3 bg-gray-100 rounded text-sm overflow-auto">{JSON.stringify(res, null, 2)}</pre>
      )}
    </div>
  );
}

function MenuViewer() {
  const [merchantId, setMerchantId] = useState("MERCH1");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function fetchMenu() {
    setLoading(true);
    setData(null);
    try {
      const r = await fetch(`${API_BASE}/merchants/${encodeURIComponent(merchantId)}/menu`);
      const j = await r.json();
      setData(j);
    } finally {
      setLoading(false);
    }
  }

  const items = useMemo(() => data?.items || [], [data]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">Menu du marchand</h2>
      <div className="mb-3">
        <label className="text-sm mr-2">merchantId</label>
        <input className="border rounded px-2 py-1" value={merchantId} onChange={e => setMerchantId(e.target.value)} />
        <button className="ml-2 px-3 py-1 rounded bg-black text-white" onClick={fetchMenu} disabled={loading}>
          {loading ? "Chargement..." : "Charger"}
        </button>
      </div>
      {data && (
        <>
          <p className="text-sm mb-2"><b>{data.merchant?.name || data.merchant?.id}</b> — {items.length} produits</p>
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((it: any) => (
              <div key={it.id} className="border rounded p-3">
                <div className="font-medium">{it.name}</div>
                <div className="text-sm text-gray-600">{it.category}</div>
                <div className="text-sm mt-1">{it.description}</div>
                <div className="text-sm mt-1">Prix: {it.price} € — {it.available ? "disponible" : "indisponible"}</div>
                {it.spicyLevel ? <div className="text-xs mt-1">🌶️ x {it.spicyLevel}</div> : null}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function App() {
  const [tab, setTab] = useState<"upload"|"menu">("upload");
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold p-4">Merchant PWA — Import & Menu</h1>
      <div className="px-4 mb-2">
        <button className={`px-3 py-1 rounded mr-2 ${tab==="upload"?"bg-black text-white":"border"}`} onClick={()=>setTab("upload")}>Importer CSV</button>
        <button className={`px-3 py-1 rounded ${tab==="menu"?"bg-black text-white":"border"}`} onClick={()=>setTab("menu")}>Voir Menu</button>
      </div>
      {tab === "upload" ? <UploadCSV /> : <MenuViewer />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
