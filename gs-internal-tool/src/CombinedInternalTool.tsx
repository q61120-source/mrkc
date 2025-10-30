import { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
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
  variant = "solid",
  tone = "slate",
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline" | "ghost";
  tone?: "slate" | "black" | "green" | "red" | "blue";
}) {
  const tones: Record<string, { solid: string; outline: string; ghost: string }> = {
    slate: {
      solid: "bg-slate-900 text-white hover:bg-slate-800",
      outline: "border border-slate-300 text-slate-700 hover:bg-slate-50",
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
      className={cx(
        "h-9 px-3.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50",
        tones[tone][variant],
        className
      )}
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

function Sidebar({
  tab,
  setTab,
}: {
  tab: "list" | "estimate" | "price" | "option";
  setTab: (t: "list" | "estimate" | "price" | "option") => void;
}) {
  const Item = (id: "list" | "estimate" | "price" | "option", label: string, icon?: React.ReactNode) => (
    <button
      onClick={() => setTab(id)}
      className={cx(
        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-slate-100",
        tab === id && "bg-slate-900 text-white hover:bg-slate-900"
      )}
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

function ProductList({ items, columns }: { items: AnyRow[]; columns: ColumnMeta[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [visible, setVisible] = useState<Set<string>>(
    new Set(["code", "name", "size", "deal", "online", "cost"])
  );

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


  return (
    <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-4">
      {/* 컨트롤 바 */}
      <div className={cx(card, "p-4")}>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="검색">
            <input
              className={cx(inputBase, "w-80")}
              placeholder="코드/명칭/규격 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </Field>
          <Field label="품목">
            <select className={inputBase} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">전체</option>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c] || c}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* 표 */}
      <div className={cx(card, "overflow-auto")}>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-slate-600">
              {["code", "name", "size", "deal", "online", "cost"]
                .filter((k) => visible.has(k))
                .map((k) => (
                  <th key={k} className="px-3 py-2 text-left font-semibold border-b">
                    {k}
                  </th>
                ))}
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2 text-left font-semibold border-b">
                  {c.label || c.bottom || `열 ${c.index + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={r.code ?? i} className="border-t hover:bg-slate-50">
                {["code", "name", "size", "deal", "online", "cost"].map((k) => (
                  <td key={k} className="px-3 py-2">
                    {k === "deal" || k === "online" || k === "cost" ? won(Number(r[k] || 0)) : String(r[k] ?? "")}
                  </td>
                ))}
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2">
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
    if (!q) return [];
    return source.filter((x) => `${x.code} ${x.name} ${x.size}`.toLowerCase().includes(q)).slice(0, 30);
  }, [query, source]);

  const pick = (it: AnyRow, idx: number) => {
    const next = [...lines];
    const base = Number(it.deal || it.online || 0);
    next[idx] = {
      code: it.code,
      name: it.name,
      size: it.size,
      qty: 1,
      unitPrice: base,
      supply: Math.round(base * (1 - discountPct / 100)),
    };
    setLines(next);
    setQuery("");
  };

  const change = (i: number, patch: Partial<Line>) => {
    const next = [...lines];
    next[i] = { ...next[i], ...patch };
    const L = next[i];
    L.supply = Math.round((L.unitPrice || 0) * (L.qty || 0) * (1 - discountPct / 100));
    setLines(next);
  };

  const total = useMemo(() => lines.reduce((s, l) => s + (l.supply || 0), 0), [lines]);

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-4">
      <div className={cx(card, "p-4")}>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="거래처(할인율)">
            <select className={cx(inputBase, "w-60")} value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value || 0))}>
              <option value={0}>선택</option>
              <option value={30}>도매처 예시 - 30%</option>
              <option value={20}>특약 예시 - 20%</option>
              <option value={10}>일반 - 10%</option>
            </select>
          </Field>
          <Field label="담당자명">
            <input className={cx(inputBase, "w-48")} placeholder="홍길동" />
          </Field>
        </div>
      </div>

      {lines.map((L, i) => (
        <div key={i} className={cx(card)}>
          <div className="px-4 py-3 border-b flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">{i + 1}</div>
            <div className="font-semibold">명칭(검색 후 선택)</div>
            <div className="ml-auto text-slate-400 text-sm">사이즈 · 수량 · 단가 · 공급가 · 비고</div>
          </div>

          <div className="p-4 space-y-3">
            <div className="relative">
              <input
                className={cx(inputBase, "w-full")}
                placeholder="명칭/모델/사이즈 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {!!query && (
                <div className="absolute left-0 right-0 z-20 mt-2 max-h-72 overflow-auto bg-white border rounded-xl shadow-lg">
                  {results.length === 0 && <div className="px-3 py-2 text-slate-400">검색 결과 없음</div>}
                  {results.map((r) => (
                    <div key={r.code} className="px-3 py-2 hover:bg-slate-50 cursor-pointer" onClick={() => pick(r, i)}>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-slate-500">{r.code} · {r.size}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-12 gap-3">
              <Field label="사이즈">
                <input className={cx(inputBase, "w-full")} value={L.size || ""} onChange={(e) => change(i, { size: e.target.value })} />
              </Field>
              <Field label="수량">
                <input type="number" className={cx(inputBase, "w-full text-right")} value={L.qty || 0} onChange={(e) => change(i, { qty: Number(e.target.value || 0) })} />
              </Field>
              <Field label="단가">
                <input type="number" className={cx(inputBase, "w-full text-right")} value={L.unitPrice || 0} onChange={(e) => change(i, { unitPrice: Number(e.target.value || 0) })} />
              </Field>
              <Field label="공급가">
                <div className={cx(inputBase, "w-full bg-slate-50 text-right")}>₩{won(L.supply || 0)}</div>
              </Field>
              <Field label="비고">
                <input className={cx(inputBase, "w-full")} value={L.note || ""} onChange={(e) => change(i, { note: e.target.value })} />
              </Field>
            </div>
          </div>
        </div>
      ))}

      <div className={cx(card, "p-4 flex items-center gap-2")}>
        <div className="text-sm text-slate-500">할인율 변경 시 공급가가 자동 갱신됩니다.</div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-slate-600">합계 금액</span>
          <span className="text-xl font-bold tracking-tight w-40 text-right">₩{won(total)}</span>
          <Btn variant="outline">미리보기</Btn>
          <Btn tone="black">PDF 저장</Btn>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── 공통: XLSX 저장 유틸 ───────────────────────── */

const downloadXLSX = (headers: string[], rows: AnyRow[], filename: string) => {
  const aoa: any[][] = [headers];
  rows.forEach((r) => aoa.push(headers.map((h) => r[h])));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
};

/* ───────────────────────── 업로드 센터(가격/옵션 공용) ───────────────────────── */

function UploadCenter({
  source,
  mode, // "price" | "option"
}: {
  source: AnyRow[];
  mode: "price" | "option";
}) {
  const [preview, setPreview] = useState<{ headers: string[]; rows: AnyRow[] } | null>(null);
  const [status, setStatus] = useState("파일 업로드 대기");
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [lastFile, setLastFile] = useState<string | null>(null);

  // 파일 입력 직접 클릭용
  const fileInputRef = useRef<HTMLInputElement>(null);

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    source.forEach((x) => (m[x.code] = Number(x.online || x.deal || 0)));
    return m;
  }, [source]);

  const onUpload = async (f: File) => {
    setStatus("읽는 중…");

    const name = f.name.toLowerCase();
    const isExcel =
      name.endsWith(".xlsx") ||
      name.endsWith(".xls") ||
      f.type.includes("spreadsheet") ||
      f.type.includes("excel");

    if (isExcel) {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];

      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
      if (!aoa || aoa.length === 0) {
        setStatus("❌ 엑셀 시트가 비어있습니다.");
        return;
      }
      const headers: string[] = (aoa[0] as any[]).map((h) => String(h ?? "").trim());
      const rows = (aoa.slice(1) as any[]).map((arr: any[]) => {
        const r: AnyRow = {};
        headers.forEach((h, i) => (r[h] = arr[i] ?? ""));
        return r;
      });

      setPreview({ headers, rows });
      setErrors(new Set());
      setStatus(`미리보기 로드 (${wsName})`);
      setLastFile(f.name);
      return;
    }

    // CSV
    const text = await f.text();
    const lines = text.split(/\r?\n/);
    if (!lines.length) {
      setStatus("❌ CSV가 비어있습니다.");
      return;
    }
    const headers = (lines.shift() || "").split(",").map((s) => s.trim());
    const rows = lines
      .filter(Boolean)
      .map((ln) => {
        const cols = ln.split(",");
        const r: AnyRow = {};
        headers.forEach((h, i) => (r[h] = cols[i] ?? ""));
        return r;
      });

    setPreview({ headers, rows });
    setErrors(new Set());
    setStatus("미리보기 로드");
    setLastFile(f.name);
  };

  const findHeader = (cands: string[]) =>
    preview ? cands.find((c) => preview.headers.includes(c)) || "" : "";

  // 판매가 계산
  const applyPrice = () => {
    if (!preview) return;
    const skuCol = findHeader(["SKU", "상품코드", "품목코드"]);
    const priceCol = findHeader(["판매가", "판매가(VAT포함)", "판매가(원)"]);
    if (!skuCol || !priceCol) {
      alert("판매가 수정: SKU/판매가 헤더를 찾을 수 없습니다.");
      return;
    }
    const rows = preview.rows.map((r) => {
      const sku = String(r[skuCol] || "").split("\n")[0].trim();
      const base = priceMap[sku] ?? priceMap[String(r["code"] || "").trim()];
      if (base == null) return r;
      const next = { ...r };
      next[priceCol] = Math.round(Number(base) / 100) * 100;
      return next;
    });
    setPreview({ headers: preview.headers, rows });
    setStatus("판매가 업데이트 완료");
  };

  // 옵션가 계산
  const applyOption = () => {
    if (!preview) return;
    const skuCol = findHeader(["SKU", "상품코드", "품목코드", "상품관리코드", "옵션관리코드"]);
    const optCol = findHeader(["추가 금액", "옵션가", "옵션 추가금"]);
    if (!skuCol || !optCol) {
      alert("옵션가 수정: SKU/옵션가 헤더를 찾을 수 없습니다.");
      return;
    }
    const rows = preview.rows.map((r) => {
      const raw = String(r[optCol] ?? "").replace(/[^\d.-]/g, "");
      const n = Number(raw);
      const next = { ...r };
      next[optCol] = isFinite(n) && n >= 0 ? Math.round(n / 100) * 100 : 0;
      return next;
    });
    setPreview({ headers: preview.headers, rows });
    setStatus("옵션가 업데이트 완료");
  };

  const validate = () => {
    if (!preview) return;
    const skuCol = findHeader(["SKU", "상품코드", "품목코드"]);
    const priceCol =
      mode === "price"
        ? findHeader(["판매가", "판매가(VAT포함)", "판매가(원)"])
        : findHeader(["추가 금액", "옵션가", "옵션 추가금"]);
    const es = new Set<string>();
    preview.rows.forEach((r, i) => {
      const rowIdx = i + 1;
      const sku = String(r[skuCol] || "").split("\n")[0].trim();
      if (!sku) es.add(`${rowIdx}:${skuCol}`);
      const price = Number(String(r[priceCol] || "").replace(/[^\d.-]/g, ""));
      if (isNaN(price) || price < 0) es.add(`${rowIdx}:${priceCol}`);
    });
    setErrors(es);
    alert(es.size ? `오류 ${es.size}건 (노란칸 표시)` : "오류 없음");
  };

  const warnCount = useMemo(() => {
    if (!preview) return 0;
    const skuCol = findHeader(["SKU", "상품코드", "품목코드"]);
    let cnt = 0;
    preview.rows.forEach((r) => {
      const sku = String(r[skuCol] || "").split("\n")[0].trim();
      if (sku && priceMap[sku] == null) cnt += 1;
    });
    return cnt;
  }, [preview, priceMap]);

  const errCount = errors.size;

  const saveResult = () => {
    if (!preview) return;
    const base = mode === "price" ? "판매가_결과" : "옵션가_결과";
    const fname = `${base}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.xlsx`;
    downloadXLSX(preview.headers, preview.rows, fname);
  };

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-4">
      {/* 상단 툴바: 업로드/계산/검증/저장 각각 버튼 분리 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 숨겨진 파일 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
          }}
          style={{ display: "none" }}
        />
        {/* 업로드 버튼에서 input 직접 클릭 */}
        <Btn variant="outline" onClick={() => fileInputRef.current?.click()}>
          📂 파일 업로드
        </Btn>

        {mode === "price" ? (
          <Btn variant="outline" tone="black" onClick={applyPrice}>🧮 판매가 계산</Btn>
        ) : (
          <Btn variant="outline" tone="black" onClick={applyOption}>🧮 옵션가 계산</Btn>
        )}

        <Btn variant="outline" onClick={validate}>✅ 검증</Btn>
        <Btn tone="blue" onClick={saveResult} disabled={!preview}>💾 결과 XLSX 저장</Btn>

        <div className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          <span>상태:</span>
          <Badge tone="slate">{status}</Badge>
        </div>
      </div>

      {/* 메트릭 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className={cx(card, "p-4")}>
          <div className="text-xs text-slate-500">처리 행수</div>
          <div className="mt-1 text-2xl font-bold">{preview ? `${preview.rows.length}건` : "—"}</div>
        </div>
        <div className={cx(card, "p-4")}>
          <div className="text-xs text-slate-500">경고/오류</div>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone="orange">경고 {warnCount}</Badge>
            <Badge tone="red">오류 {errCount}</Badge>
          </div>
        </div>
        <div className={cx(card, "p-4")}>
          <div className="text-xs text-slate-500">마지막 파일</div>
          <div className="mt-1">{lastFile ? <span className="text-blue-600">{lastFile}</span> : <span className="text-slate-400">—</span>}</div>
        </div>
      </div>

      {/* 미리보기 표 */}
      {!preview && <div className="text-slate-400">CSV/XLSX를 업로드하면 미리보기가 표시됩니다.</div>}
      {preview && (
        <div className={cx(card, "overflow-auto")}>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-slate-600">
                {preview.headers.map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold border-b">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 600).map((r, i) => {
                const isErrorRow = Array.from(errors).some((k) => Number(k.split(":")[0]) === i + 1);
                return (
                  <tr key={i} className={cx("border-t", isErrorRow && "bg-amber-50")}>
                    {preview.headers.map((h) => {
                      const bad = errors.has(`${i + 1}:${h}`);
                      return (
                        <td key={h} className="px-3 py-2" style={{ background: bad ? "#fff59d" : "transparent" }}>
                          {String(r[h] ?? "")}
                        </td>
                      );
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


/* ───────────────────────── 루트 ───────────────────────── */

function App() {
  const [tab, setTab] = useState<"list" | "estimate" | "price" | "option">("price");
  const [items, setItems] = useState<AnyRow[]>([]);
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [status, setStatus] = useState("초기화…");

  useEffect(() => {
    (async () => {
      try {
        setStatus("GAS에서 제품리스트 불러오는 중…");
        const res = await axios.get(ensureGas(), { params: { action: "listProducts" }, responseType: "text" });
        const raw: ListProductsEnvelope = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
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
              "플레이오토 · 옵션가 수정"
            }
            right={<Badge tone="slate">{status}</Badge>}
          />

          {tab === "list" && <ProductList items={items} columns={columns} />}
          {tab === "estimate" && <EstimatePage source={items} />}
          {tab === "price" && <UploadCenter source={items} mode="price" />}
          {tab === "option" && <UploadCenter source={items} mode="option" />}
        </div>
      </div>
    </div>
  );
}

export default App;
