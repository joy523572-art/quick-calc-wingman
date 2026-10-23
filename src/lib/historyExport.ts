import type { HistoryRecord } from "./historyStore";

const ascii = (text: string) => text
  .replaceAll("×", "x").replaceAll("÷", "/").replaceAll("−", "-")
  .replaceAll("π", "pi").replaceAll("Δ", "D").replaceAll("√", "sqrt").replaceAll("±", "+/-").replaceAll("²", "^2").replaceAll("³", "^3")
  .replace(/[^\x20-\x7E]/g, "?");
const pdfEscape = (text: string) => ascii(text).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");

export function makeHistoryPdf(records: HistoryRecord[]) {
  return makeTextPdf("Scientific Calculator Pro - History", records.flatMap((item) => [
    `${new Date(item.createdAt).toLocaleString()}  ${item.expr} = ${item.result}`,
    "",
  ]));
}

const wrap = (line: string, width = 95) => {
  const out: string[] = [];
  let rest = line;
  while (rest.length > width) { out.push(rest.slice(0, width)); rest = rest.slice(width); }
  out.push(rest);
  return out;
};

export function makeTextPdf(title: string, inputLines: string[]) {
  const lines = inputLines.flatMap((l) => wrap(l));
  const pages: string[][] = [];
  while (lines.length) pages.push(lines.splice(0, 46));
  if (pages.length === 0) pages.push(["No calculations saved."]);

  const objects: string[] = ["", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const pageRefs: number[] = [];
  pages.forEach((pageLines, pageIndex) => {
    const pageId = objects.length;
    const streamId = pageId + 1;
    pageRefs.push(pageId);
    const text = [
      "BT", "/F1 14 Tf", "50 790 Td", `(${pdfEscape(title)}) Tj`,
      "/F1 9 Tf", "0 -22 Td", `(Exported ${pdfEscape(new Date().toLocaleString())}) Tj`, "0 -20 Td",
      ...pageLines.flatMap((line, lineIndex) => lineIndex === 0 ? [`(${pdfEscape(line)}) Tj`] : ["0 -14 Td", `(${pdfEscape(line)}) Tj`]),
      "ET",
    ].join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects.push(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
    void pageIndex;
  });
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`;
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets.push(output.length);
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([output], { type: "application/pdf" });
}

export function downloadHistoryPdf(records: HistoryRecord[]) {
  downloadBlob(makeHistoryPdf(records), "scientific-calculator-history.pdf");
}

export function downloadTextPdf(title: string, lines: string[], filename: string) {
  downloadBlob(makeTextPdf(title, lines), filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
