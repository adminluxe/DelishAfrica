import React, { useState } from "react";

export default function UploadCSV() {
  const [file, setFile] = useState<File | null>(null);
  const [out, setOut] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("http://localhost:4000/merchants/import-menu", { method: "POST", body: fd });
    const json = await res.json();
    setOut(JSON.stringify(json, null, 2));
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Import menu CSV</h1>
      <form onSubmit={onSubmit}>
        <input type="file" accept=".csv" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <button type="submit">Téléverser</button>
      </form>
      <pre>{out}</pre>
    </main>
  );
}
