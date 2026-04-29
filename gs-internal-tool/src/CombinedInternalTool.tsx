import React, { useEffect, useMemo, useState, useRef } from "react";
import * as XLSX from "xlsx";


/* ───────────────────────── 공통 타입/유틸 ───────────────────────── */

type AnyRow = Record<string, any>;
type ColumnMeta = { key: string; index: number; label: string; top: string; bottom: string };
type ListProductsEnvelope = {
  ok: boolean;
  data?: {
    headerTop: string[];
    headerBottom: string[];
    header: string[];
    columns: ColumnMeta[];
    count: number;
    items: AnyRow[];
  };
  message?: string;
};

const GAS_URL = import.meta.env?.VITE_GAS_WEBAPP_URL;
const ensureGas = () => {
  if (!GAS_URL) throw new Error("❌ .env의 VITE_GAS_WEBAPP_URL이 비어있습니다.");
  return GAS_URL!;
};
const won = (n: number) => (Number(n) || 0).toLocaleString();

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

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");
const card = "bg-white rounded-2xl border border-slate-200 shadow-sm";
const buttonBaseClass =
  "flex items-center gap-2 px-[11px] py-[7px] rounded-[10px] text-[15px] leading-[146.7%] tracking-[0.144px] font-medium transition-colors disabled:opacity-50";
const buttonStyle: React.CSSProperties = {
  fontFeatureSettings: "'ss10' on",
  fontFamily: '"Pretendard JP", "Pretendard Variable", "Noto Sans KR", sans-serif',
};

/* ───────────────────────── 작은 UI 조각 ───────────────────────── */

function Badge({
  tone = "slate",
  children,
}: {
  tone?: "slate" | "green" | "blue" | "orange" | "red";
  children: React.ReactNode;
}) {
  const map = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    orange: "bg-amber-100 text-amber-800",
    red: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={cx("px-2.5 h-6 inline-flex items-center rounded-full text-xs font-semibold", map[tone])}>
      {children}
    </span>
  );
}

function Btn({
      ghost: "text-slate-700 hover:bg-slate-100",
    },
    black: {
      solid: "bg-black text-white hover:bg-black/90",
      outline: "border border-gray-300 text-gray-900 hover:bg-gray-50",
      ghost: "text-gray-900 hover:bg-gray-100",
    },
    green: {
      solid: "bg-emerald-600 text-white hover:bg-emerald-500",
      outline: "border border-emerald-300 text-emerald-700 hover:bg-emerald-50",
      ghost: "text-emerald-700 hover:bg-emerald-50",
    },
    red: {
      solid: "bg-rose-600 text-white hover:bg-rose-500",
      outline: "border border-rose-300 text-rose-700 hover:bg-rose-50",
      ghost: "text-rose-700 hover:bg-rose-50",
    },
    blue: {
      solid: "bg-blue-600 text-white hover:bg-blue-500",
      outline: "border border-blue-300 text-blue-700 hover:bg-blue-50",
      ghost: "text-blue-700 hover:bg-blue-50",
    },
  };
  return (
    <button
      className={cx(buttonBaseClass, "justify-center", tones[tone][variant], className)}
      style={buttonStyle}
      {...p}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
const inputBase =
  "h-10 px-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 bg-white";

/* ───────────────────────── 레이아웃 (좌측 네비 + 상단 툴바) ───────────────────────── */

type Tab = "list" | "estimate" | "price" | "option" | "coupang-info";

function Sidebar({
  tab,
  setTab,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const Item = (id: Tab, label: string, icon?: React.ReactNode) => (
    <button
      onClick={() => setTab(id)}
      className={cx(
        buttonBaseClass,
        "w-full justify-start hover:bg-slate-100",
        tab === id ? "bg-slate-900 text-white hover:bg-slate-900" : "text-slate-600"
      )}
      style={buttonStyle}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <aside className="w-64 min-h-screen border-r bg-white">
      <div className="p-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-emerald-600" />
        <div className="font-bold">내부툴</div>
        <div className="ml-auto text-[11px] text-slate-400">v0.3</div>
      </div>

      <div className="px-3 pb-3 space-y-1">
        {Item("list", "제품 리스트", <span>📦</span>)}
        {Item("estimate", "견적서 작성", <span>🧾</span>)}
        <div className="mt-4 mb-1 text-[11px] font-semibold text-slate-400 px-2">플레이오토 양식</div>
        {Item("price", "💙 판매가 수정")}
        {Item("option", "💙 옵션가 수정")}
        <div className="mt-4 mb-1 text-[11px] font-semibold text-slate-400 px-2">쿠팡 양식</div>
        {Item("coupang-info", "🟡 상품정보 변경")}
      </div>
    </aside>
  );
}

function Topbar({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
      <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center gap-3">
        <h1 className="text-[18px] font-bold">{title}</h1>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
    </div>
  );
}

/* ───────────────────────── 제품 리스트 ───────────────────────── */

function ProductList({ items, columns, status }: { items: AnyRow[]; columns: ColumnMeta[]; status: string }) {
  const baseColumns = ["code", "name", "size", "deal", "online", "cost"] as const;
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [visible, setVisible] = useState<Set<string>>(new Set(baseColumns));

  const cats = useMemo(() => {
    const s = new Set<string>();
    items.forEach((x) => x.category && s.add(String(x.category)));
    return Array.from(s).sort();
  }, [items]);

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((x) => {
      if (category && String(x.category || "") !== category) return false;
      if (!qq) return true;
      return `${x.code} ${x.name} ${x.size}`.toLowerCase().includes(qq);
    });
  }, [items, q, category]);

  const toggle = (k: string) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(k)) {
        next.delete(k);
      } else {
        next.add(k);
      }
      return next;
    });

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8 space-y-6">
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-blue-100 via-blue-50 to-indigo-100">
        <div className="grid gap-10 p-10 md:grid-cols-[1.25fr_1fr]">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-4 py-1 text-sm font-semibold text-blue-700">
              <span className="text-base">📦</span>
              Google Sheets 실시간 연동
            </span>
            <h1 className="text-3xl font-bold leading-tight text-slate-900 md:text-[40px]">
              주방 제품 재고와 가격을 <span className="text-blue-700">한 화면</span>에서 관리하세요
            </h1>
            <p className="text-base leading-relaxed text-slate-600">
              최신 시트 데이터를 기반으로 제품 정보를 빠르게 탐색하고, 필터를 통해 원하는 항목만 추려보세요.
            </p>
            <div className="inline-flex flex-col gap-1 rounded-2xl border border-blue-200/60 bg-white/70 px-5 py-4 text-blue-700 shadow-sm backdrop-blur">
              <span className="text-xs font-semibold uppercase tracking-widest text-blue-500">동기화 상태</span>
              <span className="text-lg font-semibold text-slate-900">{status}</span>
            </div>
          </div>
          <div className="relative hidden md:block">
            <div className="absolute -top-6 right-10 h-20 w-52 rounded-3xl border border-white/40 bg-white/60 shadow-lg backdrop-blur" />
            <div className="absolute top-24 right-2 h-40 w-40 rounded-full bg-blue-200/50 blur-3xl" />
            <div className="absolute inset-y-8 left-4 w-60 rounded-[28px] border border-blue-200/50 bg-white p-5 shadow-xl">
              <div className="space-y-3">
                <div className="h-6 w-28 rounded-full bg-blue-100" />
                <div className="h-4 w-full rounded-full bg-slate-100" />
                <div className="h-4 w-11/12 rounded-full bg-slate-100" />
                <div className="grid gap-2 rounded-2xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>온라인 판매가</span>
                    <span className="text-slate-900">₩{won(790000)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>도매가</span>
                    <span className="text-slate-900">₩{won(640000)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-500">
                  <span className="rounded-xl bg-blue-50 px-3 py-2 text-blue-700">싱크대</span>
                  <span className="rounded-xl bg-slate-100 px-3 py-2">가스장비</span>
                  <span className="rounded-xl bg-slate-100 px-3 py-2">주방키트</span>
                  <span className="rounded-xl bg-slate-100 px-3 py-2">설비</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-lg md:grid-cols-[minmax(260px,1fr)_minmax(320px,2fr)]">
        <div className="space-y-4">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">검색</span>
            <input
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm shadow-inner focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
              placeholder="코드, 제품명 또는 규격을 입력하세요"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">품목</span>
              <button
                className={cx(buttonBaseClass, "bg-transparent text-blue-600 hover:text-blue-500")}
                style={buttonStyle}
                onClick={() => setCategory("")}
                disabled={!category}
              >
                전체보기
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {cats.map((c) => {
                const active = category === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCategory(active ? "" : c)}
                    className={cx(
                      buttonBaseClass,
                      active
                        ? "border border-blue-500 bg-blue-600 text-white shadow"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600"
                    )}
                    style={buttonStyle}
                  >
                    {CATEGORY_LABEL[c] || c}
                  </button>
                );
              })}
              {cats.length === 0 && <span className="text-xs text-slate-400">품목 정보가 없습니다.</span>}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">표시할 열 선택</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600 md:grid-cols-3">
              {baseColumns.map((k) => (
                <label key={k} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={visible.has(k)}
                    onChange={() => toggle(k)}
                  />
                  <span className="capitalize">{k}</span>
                </label>
              ))}
            </div>
          </div>
          {columns.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">시트 원본 컬럼</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600 md:grid-cols-3">
                {columns.map((c) => (
                  <span key={c.key} className="truncate rounded-xl bg-white px-3 py-2 shadow-sm">
                    {c.label || c.bottom || `열 ${c.index + 1}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={cx(card, "overflow-hidden border border-slate-200 shadow-xl")}> 
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">제품 목록</h2>
            <p className="text-sm text-slate-500">총 {list.length.toLocaleString()}건의 결과가 있습니다.</p>
          </div>
          <Badge tone="blue">표시 중 {visible.size}개 열</Badge>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-slate-50/80">
              <tr className="text-slate-600">
                {baseColumns
                  .filter((k) => visible.has(k))
                  .map((k) => (
                    <th key={k} className="border-b border-slate-200 px-4 py-3 text-left font-semibold capitalize">
                      {k}
                    </th>
                  ))}
                {columns.map((c) => (
                  <th key={c.key} className="border-b border-slate-200 px-4 py-3 text-left font-semibold">
                    {c.label || c.bottom || `열 ${c.index + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.code ?? i} className="border-b border-slate-100 transition hover:bg-blue-50/40">
                  {baseColumns
                    .filter((k) => visible.has(k))
                    .map((k) => (
                      <td key={k} className="px-4 py-3 text-slate-700">
                        {k === "deal" || k === "online" || k === "cost" ? won(Number(r[k] || 0)) : String(r[k] ?? "")}
                      </td>
                    ))}
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 text-slate-600">
                      {String(r._raw?.[c.index] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-400" colSpan={999}>
                    조건에 맞는 데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ───────────────────────── 견적서 페이지 ───────────────────────── */

function EstimatePage({ source }: { source: AnyRow[] }) {
  type Line = {
    code: string;
    name: string;
    size: string;
    qty: number;
    unitPrice: number;
    supply: number;
    note?: string;
  };

  const [discountPct, setDiscountPct] = useState<number>(0);
  const [lines, setLines] = useState<Line[]>(
    Array.from({ length: 10 }, () => ({ code: "", name: "", size: "", qty: 1, unitPrice: 0, supply: 0 }))
  );
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


/* ───────────────────────── 쿠팡 상품정보 변경 ───────────────────────── */

function tokenize(s: string): string[] {
  return s
    .replace(/[()【】[\]\/\\,·\-_]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean);
}

function buildMatchKey(exposedName: string, ...opts: string[]): string {
  const tokens = tokenize([exposedName, ...opts].filter(Boolean).join(' '));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of tokens) {
    const k = t.toLowerCase();
    if (!seen.has(k)) { seen.add(k); result.push(t); }
  }
  return result.join(' ');
}

function skuSimilarity(matchKey: string, product: AnyRow): number {
  const coupangSet = new Set(tokenize(matchKey).map(t => t.toLowerCase()));
  const productText = `${product.name ?? ''} ${product.size ?? ''}`;
  const productTokens = tokenize(productText).map(t => t.toLowerCase()).filter(Boolean);
  if (!productTokens.length || !coupangSet.size) return 0;
  const common = productTokens.filter(t => coupangSet.has(t)).length;
  return Math.round((common / productTokens.length) * 100);
}

type CoupangInfoRow = {
  rowIdx: number;
  registeredId: string;
  optionId: string;
  optionName: string;
  exposedName: string;
  opt1: string;
  opt2: string;
  opt3: string;
  matchKey: string;
  currentModelNo: string;
};

type InfoMatchResult = {
  row: CoupangInfoRow;
  matched: AnyRow | null;
  score: number;
  code: string;
};

function CoupangInfoPage({ source }: { source: AnyRow[] }) {
  const [threshold, setThreshold] = useState(70);
  const [fileBuf, setFileBuf] = useState<ArrayBuffer | null>(null);
  const [parsedRows, setParsedRows] = useState<CoupangInfoRow[]>([]);
  const [results, setResults] = useState<InfoMatchResult[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = (buf: ArrayBuffer) => {
    try {
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      const ws = wb.Sheets['Template'];
      if (!ws) { alert("'Template' 시트를 찾을 수 없습니다."); return; }
      const allRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' }) as any[][];
      const hi = allRows.findIndex(r => (r as any[]).includes('등록상품ID'));
      if (hi < 0) { alert("헤더 행(등록상품ID)을 찾을 수 없습니다."); return; }
      const h = allRows[hi] as string[];
      const c = (n: string) => h.indexOf(n);
      const rows: CoupangInfoRow[] = [];
      for (let i = hi + 1; i < allRows.length; i++) {
        const r = allRows[i];
        const id = String(r[c('등록상품ID')] ?? '').trim();
        if (!id) continue;
        const en = String(r[c('쿠팡 노출상품명')] ?? '').trim();
        const o1 = String(r[c('구매옵션값1')] ?? '').trim();
        const o2 = String(r[c('구매옵션값2')] ?? '').trim();
        const o3 = String(r[c('구매옵션값3')] ?? '').trim();
        rows.push({
          rowIdx: i,
          registeredId: id,
          optionId: String(r[c('옵션 ID')] ?? '').trim(),
          optionName: String(r[c('등록 옵션명')] ?? '').trim(),
          exposedName: en,
          opt1: o1, opt2: o2, opt3: o3,
          matchKey: buildMatchKey(en, o1, o2, o3),
          currentModelNo: String(r[c('모델번호')] ?? '').trim(),
        });
      }
      setParsedRows(rows);
    } catch (e) {
      console.error(e);
      alert('파일 파싱 오류: ' + String(e));
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const buf = evt.target?.result as ArrayBuffer;
      setFileBuf(buf);
      parseFile(buf);
    };
    reader.readAsArrayBuffer(file);
  };

  useEffect(() => {
    if (!parsedRows.length) return;
    setResults(parsedRows.map(row => {
      let best: AnyRow | null = null;
      let bestScore = 0;
      source.forEach(p => {
        const s = skuSimilarity(row.matchKey, p);
        if (s > bestScore) { bestScore = s; best = p; }
      });
      return { row, matched: best, score: bestScore, code: (best as AnyRow)?.code ?? '' };
    }));
  }, [parsedRows, source]);

  const updateCode = (idx: number, code: string) =>
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, code } : r));

  const handleDownload = () => {
    if (!fileBuf || !results.length) return;
    try {
      const wb = XLSX.read(new Uint8Array(fileBuf), { type: 'array' });
      const ws = wb.Sheets['Template'];
      const allRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' }) as any[][];
      const hi = allRows.findIndex(r => (r as any[]).includes('등록상품ID'));
      const mCol = (allRows[hi] as string[]).indexOf('모델번호');
      if (mCol < 0) { alert("모델번호 열을 찾을 수 없습니다."); return; }
      results.forEach(({ row, code }) => {
        if (!code) return;
        const addr = XLSX.utils.encode_cell({ r: row.rowIdx, c: mCol });
        ws[addr] = { v: code, t: 's' };
      });
      XLSX.writeFile(wb, '쿠팡상품정보_모델번호수정.xlsx');
    } catch (e) {
      console.error(e);
      alert('다운로드 오류: ' + String(e));
    }
  };

  const displayed = useMemo(
    () => results.map(r => ({ ...r, needsReview: r.score < threshold })),
    [results, threshold]
  );
  const autoN = displayed.filter(r => !r.needsReview).length;
  const reviewN = displayed.filter(r => r.needsReview).length;

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8 space-y-6">
      <section className={cx(card, "p-6 space-y-5")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">쿠팡 상품정보 · 모델번호 SKU 매칭</h2>
            <p className="text-sm text-slate-500 mt-1">
              쿠팡 노출상품명 + 구매옵션값을 조합해 내부 SKU코드와 매칭 후 모델번호 열에 채워 다운로드합니다.
            </p>
          </div>
          {displayed.length > 0 && (
            <div className="flex gap-2 shrink-0">
              <Badge tone="green">자동 매칭 {autoN}개</Badge>
              {reviewN > 0 && <Badge tone="orange">검토 필요 {reviewN}개</Badge>}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <Field label="쿠팡상품정보 엑셀 업로드 (.xlsx)">
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
            <Btn tone="blue" variant="outline" onClick={() => fileRef.current?.click()}>
              📂 파일 선택
            </Btn>
          </Field>

          <Field label={`검토 필요 기준 — 유사도 ${threshold}% 미만`}>
            <div className="flex items-center gap-3">
              <input
                type="range" min={0} max={100} value={threshold}
                onChange={e => setThreshold(Number(e.target.value))}
                className="w-36 accent-blue-600"
              />
              <input
                type="number" min={0} max={100} value={threshold}
                onChange={e => setThreshold(Number(e.target.value))}
                className={cx(inputBase, "w-20")}
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
          </Field>

          {displayed.length > 0 && (
            <Btn tone="green" onClick={handleDownload}>📥 수정 파일 다운로드</Btn>
          )}
        </div>
      </section>

      {displayed.length > 0 && (
        <section className={cx(card, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 text-xs font-semibold">
                  <th className="border-b border-slate-200 px-4 py-3 text-left whitespace-nowrap">상태</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left whitespace-nowrap">쿠팡 노출상품명</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left whitespace-nowrap">구매옵션값</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left whitespace-nowrap">매칭용 이름</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left whitespace-nowrap">매칭 내부제품</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-center whitespace-nowrap">유사도</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left whitespace-nowrap">모델번호(SKU)</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((r, i) => (
                  <tr
                    key={i}
                    className={cx(
                      "border-b border-slate-100 transition",
                      r.needsReview ? "bg-amber-50/60 hover:bg-amber-100/60" : "hover:bg-blue-50/30"
                    )}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.needsReview
                        ? <Badge tone="orange">검토 필요</Badge>
                        : <Badge tone="green">자동 매칭</Badge>}
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="truncate text-slate-700 text-xs" title={r.row.exposedName}>{r.row.exposedName}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{r.row.optionName}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                      {[r.row.opt1, r.row.opt2, r.row.opt3].filter(Boolean).join(' / ')}
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="truncate text-xs text-slate-500" title={r.row.matchKey}>{r.row.matchKey}</div>
                    </td>
                    <td className="px-4 py-3">
                      {r.matched ? (
                        <div>
                          <div className="font-semibold text-slate-900 text-xs">{(r.matched as AnyRow).code}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[180px]" title={(r.matched as AnyRow).name}>
                            {(r.matched as AnyRow).name}
                          </div>
                        </div>
                      ) : <span className="text-slate-400 text-xs">-</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cx(
                        "font-bold text-sm",
                        r.score >= threshold ? "text-emerald-600" :
                        r.score >= Math.round(threshold * 0.7) ? "text-amber-600" : "text-rose-600"
                      )}>{r.score}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className={cx(inputBase, "w-36 text-sm")}
                        value={r.code}
                        onChange={e => updateCode(i, e.target.value)}
                        placeholder="SKU 코드"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}


/* ───────────────────────── 루트 ───────────────────────── */

function App() {
  const [tab, setTab] = useState<Tab>("price");
  const [items, setItems] = useState<AnyRow[]>([]);
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [status, setStatus] = useState("초기화…");

  useEffect(() => {
    (async () => {
      try {
        setStatus("GAS에서 제품리스트 불러오는 중…");
        const res = await fetch(`${ensureGas()}?action=listProducts`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const raw: ListProductsEnvelope = JSON.parse(text);
        if (!raw.ok) throw new Error(raw.message || "GAS 오류");
        setItems(raw.data?.items || []);
        setColumns(raw.data?.columns || []);
        setStatus(`불러오기 완료: ${raw.data?.count ?? 0}건`);
      } catch (e) {
        console.error(e);
        setStatus("❌ 연동 실패 – .env/GAS 확인");
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <Sidebar tab={tab} setTab={setTab} />
        <div className="flex-1 min-w-0">
          <Topbar
            title={
              tab === "list" ? "제품 리스트" :
              tab === "estimate" ? "견적서 작성" :
              tab === "price" ? "플레이오토 · 판매가 수정" :
              tab === "option" ? "플레이오토 · 옵션가 수정" :
              "쿠팡 · 상품정보 변경"
            }
            right={<Badge tone="slate">{status}</Badge>}
          />

          {tab === "list" && <ProductList items={items} columns={columns} status={status} />}
          {tab === "estimate" && <EstimatePage source={items} />}
          {tab === "price" && <UploadCenter source={items} mode="price" />}
          {tab === "option" && <UploadCenter source={items} mode="option" />}
          {tab === "coupang-info" && <CoupangInfoPage source={items} />}
        </div>
      </div>
    </div>
  );
}

export default App;
