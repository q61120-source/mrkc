export type ProductRow = Record<string, any>;

export type ColumnMeta = {
  key: string;
  index: number;
  label: string;
  top: string;
  bottom: string;
};

export type ProductListPayload = {
  headerTop: string[];
  headerBottom: string[];
  header: string[];
  columns: ColumnMeta[];
  count: number;
  items: ProductRow[];
};

export type ListProductsEnvelope = {
  ok?: boolean;
  data?: Partial<ProductListPayload> | null;
  message?: string;
};

export class GasConfigError extends Error {
  constructor(message = "VITE_GAS_WEBAPP_URL이 설정되지 않았습니다.") {
    super(message);
    this.name = "GasConfigError";
  }
}

const EMPTY_PAYLOAD: ProductListPayload = {
  headerTop: [],
  headerBottom: [],
  header: [],
  columns: [],
  count: 0,
  items: [],
};

const ensureGasUrl = () => {
  const url = import.meta.env.VITE_GAS_WEBAPP_URL;
  if (!url) throw new GasConfigError();
  return url;
};

const parseEnvelope = (text: string) => {
  try {
    return JSON.parse(text) as ListProductsEnvelope;
  } catch {
    throw new Error("응답 JSON 파싱 실패");
  }
};

const normalizePayload = (envelope: ListProductsEnvelope | undefined) => {
  const raw = envelope?.data ?? {};
  return {
    headerTop: Array.isArray(raw.headerTop) ? raw.headerTop : [],
    headerBottom: Array.isArray(raw.headerBottom) ? raw.headerBottom : [],
    header: Array.isArray(raw.header) ? raw.header : [],
    columns: Array.isArray(raw.columns) ? (raw.columns as ColumnMeta[]) : [],
    count: typeof raw.count === "number" ? raw.count : Array.isArray(raw.items) ? raw.items.length : 0,
    items: Array.isArray(raw.items) ? (raw.items as ProductRow[]) : [],
  } satisfies ProductListPayload;
};

export const fetchProductList = async (signal?: AbortSignal) => {
  const url = `${ensureGasUrl()}?action=listProducts`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const envelope = parseEnvelope(text);
  if (envelope.ok === false) {
    throw new Error(envelope.message || "GAS 오류");
  }
  return {
    envelope,
    payload: normalizePayload(envelope),
  };
};

export const emptyPayload = () => ({ ...EMPTY_PAYLOAD });
