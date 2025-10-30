import { useEffect, useMemo, useState } from "react";

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
        const res = await fetch(`${GAS_URL}?action=listProducts`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const raw = JSON.parse(text);
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
@@ -89,138 +87,206 @@ export default function App() {

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
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand">GS Internal</div>
        <nav className="nav-links" aria-label="주요 링크">
          <a href="#" onClick={(e) => e.preventDefault()}>대시보드</a>
          <a href="#" onClick={(e) => e.preventDefault()}>제품</a>
          <a href="#" onClick={(e) => e.preventDefault()}>데이터 허브</a>
          <a href="#" onClick={(e) => e.preventDefault()}>지원</a>
        </nav>
        <button className="profile-button button-base" type="button" aria-label="사용자 메뉴">
          <span className="profile-avatar">GS</span>
          <span className="profile-name">운영팀</span>
        </button>
      </header>

      <section className="hero">
        <div className="hero-content">
          <span className="hero-pill">실시간 Google Sheets 동기화</span>
          <h1>
            주방 제품 재고와 가격을 <br />한 곳에서 빠르게 관리하세요
          </h1>
          <p>
            최신 시트 데이터를 기반으로 제품 판매 정보를 탐색하고, 필요한 항목만 필터링하여 빠르게 비교할 수 있습니다.
          </p>
          <div className="status-card">
            <span className="status-label">동기화 상태</span>
            <strong>{status}</strong>
          </div>
        </div>
        <div className="hero-illustration" aria-hidden="true">
          <div className="bubble bubble-lg" />
          <div className="bubble bubble-md" />
          <div className="bubble bubble-sm" />
        </div>
      </section>

      <section className="filters" aria-label="검색 및 필터">
        <div className="search-group">
          <label className="input-label" htmlFor="searchInput">검색</label>
          <input
            id="searchInput"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="코드, 제품명 또는 규격을 입력하세요"
          />
        </div>
        <div className="category-group">
          <div className="group-header">
            <span className="input-label">품목</span>
            <button
              type="button"
              className="clear-button button-base"
              onClick={() => { setCategory(""); setPage(1); }}
              disabled={!category}
            >
              전체 보기
            </button>
          </div>
          <div className="chip-row">
            {allCategories.map((c) => {
              const label = CATEGORY_LABEL[c] || c;
              const active = category === c;
              return (
                <button
                  key={c}
                  className={`chip button-base${active ? " active" : ""}`}
                  type="button"
                  onClick={() => { setCategory(active ? "" : c); setPage(1); }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="column-toggle">
          <details>
            <summary>표시열 선택</summary>
            <div className="column-grid">
              {["code","name","size","deal","discountRate","cost","online","naver","eleven"].map((k) => (
                <label key={k}>
                  <input type="checkbox" checked={visible.has(k)} onChange={() => toggleVisible(k)} />
                  <span>{k}</span>
                </label>
              ))}
              {columns.map((c) => (
                <label key={c.key}>
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
      </section>

      <section className="table-section">
        <header className="table-header">
          <div>
            <h2>제품 목록</h2>
            <p>정렬하려는 열을 클릭하면 오름차순/내림차순으로 전환됩니다.</p>
          </div>
          <div className="meta">총 {filtered.length}건</div>
        </header>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {["code","name","size","deal","discountRate","cost","online","naver","eleven"]
                  .filter((k) => visible.has(k))
                  .map((k) => (
                    <th
                      key={k}
                      onClick={() => setSort(k)}
                      className="sortable"
                      scope="col"
                    >
                      {k}
                      {sortKey===k && (
                        <span className="sort-indicator" aria-hidden="true">{sortDir==="asc"?"▲":"▼"}</span>
                      )}
                    </th>
                  ))}
                {columns.filter(c => visible.has(c.key)).map((c) => (
                  <th key={c.key} scope="col">
                    {c.label || c.bottom || `열${c.index+1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row, i) => (
                <tr key={row.code ?? i}>
                  {["code","name","size","deal","discountRate","cost","online","naver","eleven"]
                    .filter((k) => visible.has(k))
                    .map((k) => (
                      <td key={k} data-label={k}>
                        {k==="discountRate" ? (row[k] ? (row[k]*100).toFixed(1)+"%" : "0%") : String(row[k] ?? "")}
                      </td>
                    ))}
                  {columns.filter(c => visible.has(c.key)).map((c) => (
                    <td key={c.key} data-label={c.label || c.bottom || `열${c.index+1}`}>
                      {String(row._raw?.[c.index] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}

              {pageItems.length===0 && (
                <tr>
                  <td colSpan={99} className="empty">조건에 맞는 데이터가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button
            className="button-base pagination-button"
            onClick={() => setPage(p => Math.max(1, p-1))}
            disabled={page<=1}
          >
            이전
          </button>
          <span>페이지 {page} / {totalPages}</span>
          <button
            className="button-base pagination-button"
            onClick={() => setPage(p => Math.min(totalPages, p+1))}
            disabled={page>=totalPages}
          >
            다음
          </button>
        </div>
      </section>
    </div>
  );
}
