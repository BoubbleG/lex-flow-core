// Utilitários para validação e parsing do número CNJ.
// Formato: NNNNNNN-DD.AAAA.J.TR.OOOO (20 dígitos)

export type CNJSegments = {
  sequential: string;
  digit: string;
  year: string;
  segment: string; // J — tipo de órgão (1..9)
  tribunal: string; // TR
  origin: string;
};

const CNJ_REGEX = /^(\d{7})-?(\d{2})\.?(\d{4})\.?(\d)\.?(\d{2})\.?(\d{4})$/;

export function normalizeCNJ(input: string): string {
  return input.replace(/\D/g, "");
}

export function formatCNJ(input: string): string {
  const d = normalizeCNJ(input).slice(0, 20);
  const m = d.match(/^(\d{0,7})(\d{0,2})(\d{0,4})(\d{0,1})(\d{0,2})(\d{0,4})$/);
  if (!m) return input;
  const [, a, b, c, j, t, o] = m;
  let r = a;
  if (b) r += "-" + b;
  if (c) r += "." + c;
  if (j) r += "." + j;
  if (t) r += "." + t;
  if (o) r += "." + o;
  return r;
}

export function parseCNJ(input: string): CNJSegments | null {
  const clean = normalizeCNJ(input);
  if (clean.length !== 20) return null;
  const formatted = `${clean.slice(0, 7)}-${clean.slice(7, 9)}.${clean.slice(9, 13)}.${clean.slice(13, 14)}.${clean.slice(14, 16)}.${clean.slice(16, 20)}`;
  const m = formatted.match(CNJ_REGEX);
  if (!m) return null;
  return { sequential: m[1], digit: m[2], year: m[3], segment: m[4], tribunal: m[5], origin: m[6] };
}

export function isValidCNJ(input: string): boolean {
  return parseCNJ(input) !== null;
}

// Mapa segmento → família de tribunais para o endpoint DataJud
// Referência: https://datajud-wiki.cnj.jus.br/api-publica/endpoints
const STATE_TRIBUNAL_BY_CODE: Record<string, string> = {
  "01": "ac", "02": "al", "03": "ap", "04": "am", "05": "ba", "06": "ce",
  "07": "df", "08": "es", "09": "go", "10": "ma", "11": "mt", "12": "ms",
  "13": "mg", "14": "pa", "15": "pb", "16": "pr", "17": "pe", "18": "pi",
  "19": "rj", "20": "rn", "21": "rs", "22": "ro", "23": "rr", "24": "sc",
  "25": "se", "26": "sp", "27": "to",
};

export function getDataJudAlias(seg: CNJSegments): string | null {
  switch (seg.segment) {
    case "1": return "stf";
    case "3": return "stj";
    case "4": {
      const n = parseInt(seg.tribunal, 10);
      if (n >= 1 && n <= 6) return `trf${n}`;
      return null;
    }
    case "5": {
      const n = parseInt(seg.tribunal, 10);
      if (n >= 1 && n <= 24) return `trt${n}`;
      return null;
    }
    case "7": return "stm";
    case "8": {
      const uf = STATE_TRIBUNAL_BY_CODE[seg.tribunal];
      return uf ? `tj${uf}` : null;
    }
    default: return null;
  }
}

export function getTribunalLabel(seg: CNJSegments): string {
  const alias = getDataJudAlias(seg);
  if (!alias) return "Tribunal não identificado";
  return alias.toUpperCase();
}
