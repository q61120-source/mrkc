import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

type Row = Record<string, any>;
type ColumnMeta = { key: string; index: number; label: string; top: string; bottom: string };

const CATEGORY_LABEL: Record<string, string> = {
  WRK: "작업대(WRK)",
  SNK: "싱크대(SNK)",
  SHF: "선반(SHF)",
  GAS: "가스장비(GAS)",
  KIT: "주방키트(KIT)",
  EQP: "설비(EQP)",
  DWR: "서랍(DWR)",
  ETC: "기타(ETC)",
  ACC: "악세사리(ACC)",
};

const DEFAULT_KEYS = ["code", "name", "size", "deal", "discountRate", "cost", "online", "naver", "eleven"];

export default function App() {
  const [items, setItems] = useState<Row[]>([]);
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [status, setStatus] = useState("초기화…");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(""); // 품목 코드 필터(WRK 등)
  const [visible, setVisible] = useState<Set<string>>(new Set(DEFAULT_KEYS)); // 표시열 토글
  const [sortKey, setSortKey] = useState<string>("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // 페이지네이션
  const [page, setPage] = useState(1);
  const pageSize = 100;

  const GAS_URL = import.meta.env.VITE_GAS_WEBAPP_URL;

  useEffect(() => {
    (async () => {
      try {
        if (!GAS_URL) {
          setStatus("❌ VITE_GAS_WEBAPP_URL이 비어있음 (.env 확인)");
          return;
        }
        setStatus("요청 전송 중 (GET listProducts) …");
        const res = await axios.get(GAS_URL, {
          params: { action: "listProducts" },
          responseType: "text",
        });
        const raw = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
        const payload = raw?.data;
        const list: Row[] = payload?.items ?? [];
        const cols: ColumnMeta[] = payload?.columns ?? [];
        setItems(list);
        setColumns(cols);
        setStatus(`완료: ${list.length}건`);
      } catch (e: any) {
        console.error(e);
        setStatus("❌ 요청 실패 – 네트워크 응답 확인");
      }
    })();
  }, []);

  // 필터링
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (category && String(it.category || "") !== category) return false;
      if (!q) return true;
      const hay = `${it.code||""} ${it.name||""} ${it.size||""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, category]);

  // 정렬
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return (String(av ?? "")).localeCompare(String(bv ?? ""), "ko") * (sortDir === "asc" ? 1 : -1);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // 페이지
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageItems = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page]);

  const toggleVisible = (k: string) => {
    setVisible((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };

  const setSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => { if (it.category) set.add(String(it.category)); });
    return Array.from(set).sort();
  }, [items]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <h1 style={{ fontSize: 36, margin: "4px 0 8px" }}>📦 제품 리스트 (Google Sheets 연동)</h1>
      <div style={{ marginBottom: 12, color: "#666" }}>상태: {status}</div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="코드/명칭/규격 검색"
          style={{ padding: "8px 10px", minWidth: 240, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: 8 }}
        >
          <option value="">전체 품목</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c] || c}
            </option>
          ))}
        </select>

        {/* 표시열 토글 */}
        <details>
          <summary style={{ cursor: "pointer" }}>표시열 선택</summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: 6, paddingTop: 8 }}>
            {/* 표준 필드 */}
            {["code","name","size","deal","discountRate","cost","online","naver","eleven"].map((k) => (
              <label key={k} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={visible.has(k)} onChange={() => toggleVisible(k)} />
                <span>{k}</span>
              </label>
            ))}
            {/* 원본 전체 컬럼(합성 헤더)도 토글 가능 */}
            {columns.map((c) => (
              <label key={c.key} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={visible.has(c.key)}
                  onChange={() => toggleVisible(c.key)}
                />
                <span title={`${c.top}/${c.bottom}`}>{c.label || c.bottom || `열${c.index+1}`}</span>
              </label>
            ))}
          </div>
        </details>
      </div>

      {/* Table */}
      <div style={{ overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {/* 표준 필드 헤더 */}
              {["code","name","size","deal","discountRate","cost","online","naver","eleven"]
                .filter((k) => visible.has(k))
                .map((k) => (
                  <th
                    key={k}
                    onClick={() => setSort(k)}
                    style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #eee", cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    {k}{sortKey===k ? (sortDir==="asc"?" ▲":" ▼") : ""}
                  </th>
                ))}
              {/* 추가(원본) 컬럼 헤더 */}
              {columns.filter(c => visible.has(c.key)).map((c) => (
                <th key={c.key} style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                  {c.label || c.bottom || `열${c.index+1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((row, i) => (
              <tr key={row.code ?? i} style={{ borderTop: "1px solid #f3f4f6" }}>
                {/* 표준 필드 값 */}
                {["code","name","size","deal","discountRate","cost","online","naver","eleven"]
                  .filter((k) => visible.has(k))
                  .map((k) => (
                    <td key={k} style={{ padding: "8px 12px", borderBottom: "1px solid #f8fafc" }}>
                      {k==="discountRate" ? (row[k] ? (row[k]*100).toFixed(1)+"%" : "0%") : String(row[k] ?? "")}
                    </td>
                  ))}

                {/* 추가(원본) 컬럼 값: _raw + columns.index 이용 */}
                {columns.filter(c => visible.has(c.key)).map((c) => (
                  <td key={c.key} style={{ padding: "8px 12px", borderBottom: "1px solid #f8fafc" }}>
                    {String(row._raw?.[c.index] ?? "")}
                  </td>
                ))}
              </tr>
            ))}

            {pageItems.length===0 && (
              <tr><td colSpan={99} style={{ padding: 20, color: "#999" }}>조건에 맞는 데이터가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page<=1}>이전</button>
        <div>페이지 {page} / {totalPages}</div>
        <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page>=totalPages}>다음</button>
      </div>
    </div>
  );
}
