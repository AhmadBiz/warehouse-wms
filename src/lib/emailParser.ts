// Reads a shipment or release email and pulls out what the warehouse needs.
// Works offline with pattern matching; if ANTHROPIC_API_KEY is set, Claude does the
// extraction and the patterns become the fallback. Either way, anything missing is
// listed so the office can fill it in before the truck arrives.

import type { Customer } from "@/db/schema";

export type ParsedEmail = {
  kind: "INBOUND" | "OUTBOUND" | "OTHER";
  customerId: number | null;
  customerName: string | null;
  reference: string | null;
  containerNumber: string | null;
  carrier: string | null;
  expectedAt: string | null; // ISO date
  pallets: number | null;
  cartons: number | null;
  weightLb: number | null;
  looseCartons: boolean;
  isCrossDock: boolean;
  expectedStayDays: number | null;
  bonded: boolean;
  cargoControlNumber: string | null;
  transactionNumber: string | null;
  palletCodes: string[]; // for release requests
  cartonsRequested: number | null;
  neededBy: string | null;
  missing: string[];
  confidence: number; // 0..1
  method: "patterns" | "claude";
};

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|janv|févr|mars|avr|mai|juin|juil|août|oct|nov|déc";

function toISO(d: Date | null) {
  if (!d || isNaN(d.getTime())) return null;
  // Local calendar date, not UTC: a 23:00 email in Montréal is still "today".
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateNear(text: string, keywords: RegExp): string | null {
  const now = new Date();
  const m = keywords.exec(text);
  const window = m ? text.slice(m.index, m.index + 80) : text;
  if (/\btomorrow\b|\bdemain\b/i.test(window)) return toISO(new Date(now.getTime() + 86400000));
  if (/\btoday\b|\baujourd'hui\b/i.test(window)) return toISO(now);
  const iso = /(\d{4}-\d{2}-\d{2})/.exec(window);
  if (iso) return toISO(new Date(iso[1] + "T12:00:00"));
  const mdy = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(window);
  if (mdy) {
    const y = mdy[3] ? (mdy[3].length === 2 ? 2000 + Number(mdy[3]) : Number(mdy[3])) : now.getFullYear();
    return toISO(new Date(y, Number(mdy[1]) - 1, Number(mdy[2]), 12));
  }
  const monthDay = new RegExp(`\\b(${MONTHS})[a-zé]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`, "i").exec(window);
  if (monthDay) {
    const d = new Date(`${monthDay[1].slice(0, 3)} ${monthDay[2]}, ${monthDay[3] ?? now.getFullYear()} 12:00`);
    if (!isNaN(d.getTime())) return toISO(d);
  }
  const dayMonth = new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS})[a-zé]*\\.?(?:\\s+(\\d{4}))?`, "i").exec(window);
  if (dayMonth) {
    const d = new Date(`${dayMonth[2].slice(0, 3)} ${dayMonth[1]}, ${dayMonth[3] ?? now.getFullYear()} 12:00`);
    if (!isNaN(d.getTime())) return toISO(d);
  }
  return null;
}

function num(s: string | undefined) {
  if (!s) return null;
  const n = Number(s.replace(/[,\s]/g, ""));
  return isNaN(n) ? null : n;
}

export function parseWithPatterns(from: string, subject: string, body: string, customers: Customer[]): ParsedEmail {
  const text = `${subject}\n${body}`;
  const lower = text.toLowerCase();
  const domain = from.split("@")[1]?.toLowerCase() ?? "";

  let customer = customers.find((c) => c.emailDomain && domain.endsWith(c.emailDomain.toLowerCase())) ?? null;
  if (!customer) customer = customers.find((c) => lower.includes(c.name.toLowerCase())) ?? null;

  const outboundHint = /\b(release|pick ?up|pickup|ship out|outbound|retrieve|send out|libér|enlèvement|expédier|ramasser|collect)/i.test(text);
  const inboundHint = /\b(arriv|inbound|container|shipment|deliver|eta|incoming|réception|livraison|conteneur|arrivée)/i.test(text);
  const kind: ParsedEmail["kind"] = outboundHint && !/\b(arriving|will arrive|eta)\b/i.test(text) ? "OUTBOUND" : inboundHint ? "INBOUND" : "OTHER";

  const container = /\b([A-Z]{4}\s?\d{7})\b/.exec(text)?.[1]?.replace(/\s/, "") ?? null;
  const reference =
    /(?:\bref(?:erence)?|\bPO|\border|\bbooking|\bBL|\bdossier|\bcommande)\s*(?:no\.?|number|#|:)?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,})/i.exec(text)?.[1] ?? null;
  const carrier = /(?:carrier|transporteur|trucking|via)\s*[:\-]?\s*([A-Z][A-Za-z&\- ]{2,30})/.exec(text)?.[1]?.trim().replace(/[.,;]+$/, "") ?? null;

  const pallets = num(/(\d{1,3})\s*(?:x\s*)?(?:pallets?|palettes?|skids?)/i.exec(text)?.[1]);
  const cartons = num(/(\d[\d,]{0,6})\s*(?:cartons?|boxes?|cases?|boîtes?|colis)/i.exec(text)?.[1]);
  const w = /([\d,]+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?)/i.exec(text);
  let weightLb = w ? num(w[1]) : null;
  if (weightLb != null && /kg|kilo/i.test(w![2])) weightLb = Math.round(weightLb * 2.2046);

  const looseCartons = /\b(loose|floor[- ]loaded|not palleti[sz]ed|en vrac|non palettis)/i.test(text);
  const isCrossDock = /\b(cross[- ]?dock|same[- ]day|transload|direct transfer)/i.test(text);
  const stayM = /(?:stay|store|keep|storage|hold|entrepos|garder)\D{0,30}?(\d{1,3})\s*(days?|weeks?|months?|jours?|semaines?|mois)/i.exec(text) ?? /(\d{1,3})\s*(days?|weeks?|months?|jours?|semaines?|mois)\D{0,20}(?:stay|storage|store|entrepos)/i.exec(text);
  let expectedStayDays: number | null = null;
  if (stayM) {
    const n = Number(stayM[1]);
    const unit = stayM[2].toLowerCase();
    expectedStayDays = unit.startsWith("w") || unit.startsWith("sem") ? n * 7 : unit.startsWith("mo") ? n * 30 : n;
  }
  if (isCrossDock) expectedStayDays = 1; // the whole shipment is staged; longer-stay pallets are marked at the dock

  const bonded = /\b(in[- ]bond|bonded|customs hold|sous douane|entreposage douanier)\b/i.test(text);
  const cargoControlNumber = /(?:cargo control (?:number|no\.?|#)?|CCN)\s*[:#]?\s*([A-Z0-9]{4}[A-Z0-9-]{4,})/i.exec(text)?.[1] ?? null;
  const transactionNumber = /(?:transaction (?:number|no\.?|#)?)\s*[:#]?\s*(\d{14}|[A-Z0-9-]{8,})/i.exec(text)?.[1] ?? null;

  const palletCodes = Array.from(text.matchAll(/\bPLT-[A-Z]{3}-\d{5}\b/g)).map((m) => m[0]);
  const cartonsRequested = kind === "OUTBOUND" ? cartons : null;

  const expectedAt = kind === "INBOUND" ? parseDateNear(text, /\b(eta|arriv\w*|deliver\w*|expected|incoming|livraison|arrivée|scheduled)\b/i) : null;
  const neededBy = kind === "OUTBOUND" ? parseDateNear(text, /\b(by|before|needed|pick ?up|pickup|on|le|pour|d'ici)\b/i) : null;

  const missing: string[] = [];
  if (!customer) missing.push("customer");
  if (kind === "INBOUND") {
    if (!reference && !container) missing.push("reference");
    if (!expectedAt) missing.push("arrival date");
    if (pallets == null) missing.push("pallet count");
    if (weightLb == null) missing.push("weight");
    missing.push("dimensions"); // never in the email, captured at the dock
  } else if (kind === "OUTBOUND") {
    if (!palletCodes.length && cartonsRequested == null) missing.push("pallets or cartons to release");
    if (!neededBy) missing.push("pickup date");
  }

  const found = [customer, reference ?? container, expectedAt ?? neededBy, (pallets ?? palletCodes.length) || null].filter(Boolean).length;
  return {
    kind,
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? null,
    reference: reference ?? container,
    containerNumber: container,
    carrier,
    expectedAt,
    pallets,
    cartons,
    weightLb,
    looseCartons,
    isCrossDock,
    expectedStayDays,
    bonded,
    cargoControlNumber,
    transactionNumber,
    palletCodes,
    cartonsRequested,
    neededBy,
    missing,
    confidence: Math.min(1, found / 4),
    method: "patterns",
  };
}

export async function parseEmail(from: string, subject: string, body: string, customers: Customer[]): Promise<ParsedEmail> {
  const base = parseWithPatterns(from, subject, body, customers);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return base;
  try {
    const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
    const customerList = customers.map((c) => `${c.id}: ${c.name} (${c.emailDomain ?? "no domain"})`).join("\n");
    const prompt = `You read emails for a third-party warehouse in Montreal. Extract the fields below as JSON only.
Known customers (id: name (email domain)):
${customerList}

Email from: ${from}
Subject: ${subject}
Body:
${body.slice(0, 6000)}

Return JSON with keys: kind ("INBOUND" for goods arriving, "OUTBOUND" for a release/pickup request, else "OTHER"), customerId (number or null), reference (string|null), containerNumber (string|null), carrier (string|null), expectedAt (YYYY-MM-DD|null, today is ${new Date().toISOString().slice(0, 10)}), pallets (int|null), cartons (int|null), weightLb (int|null, convert kg), looseCartons (bool: goods arrive as loose boxes, not on pallets), isCrossDock (bool), expectedStayDays (int|null), bonded (bool), cargoControlNumber (string|null), transactionNumber (string|null), palletCodes (string[] of PLT-XXX-NNNNN), cartonsRequested (int|null), neededBy (YYYY-MM-DD|null).`;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 800, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return base;
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Partial<ParsedEmail>;
    const merged: ParsedEmail = { ...base, ...json, method: "claude" } as ParsedEmail;
    merged.customerName = customers.find((c) => c.id === merged.customerId)?.name ?? base.customerName;
    merged.palletCodes = Array.isArray(json.palletCodes) ? json.palletCodes : base.palletCodes;
    merged.missing = [];
    if (!merged.customerId) merged.missing.push("customer");
    if (merged.kind === "INBOUND") {
      if (!merged.reference && !merged.containerNumber) merged.missing.push("reference");
      if (!merged.expectedAt) merged.missing.push("arrival date");
      if (merged.pallets == null) merged.missing.push("pallet count");
      if (merged.weightLb == null) merged.missing.push("weight");
      merged.missing.push("dimensions");
    } else if (merged.kind === "OUTBOUND") {
      if (!merged.palletCodes.length && merged.cartonsRequested == null) merged.missing.push("pallets or cartons to release");
      if (!merged.neededBy) merged.missing.push("pickup date");
    }
    merged.confidence = 0.9;
    return merged;
  } catch {
    return base;
  }
}
