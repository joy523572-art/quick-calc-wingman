export const HISTORY_STORAGE_KEY = "calc.history.v1";
export const HISTORY_UPDATED_EVENT = "nume:history-updated";

export type HistoryRecord = { expr: string; result: string; createdAt: string };

export function readCalculationHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const records = JSON.parse(raw) as Array<Partial<HistoryRecord>>;
    return records.filter((record) => typeof record.expr === "string" && typeof record.result === "string")
      .map((record) => ({
        expr: record.expr ?? "",
        result: record.result ?? "",
        createdAt: record.createdAt ?? new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

export function broadcastHistoryUpdate() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(HISTORY_UPDATED_EVENT));
}