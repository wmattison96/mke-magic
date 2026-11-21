export type CsvRecord = Record<string, string>;

/** Small RFC-4180-style parser for the local, read-only historical CSVs. */
export function parseCsv(text: string, sourceName = "CSV"): CsvRecord[] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
      if (char === "\r" && input[index + 1] === "\n") index += 1;
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error(`${sourceName}: unterminated quoted CSV field.`);
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  if (rows.length === 0) throw new Error(`${sourceName}: file is empty.`);

  const [headers, ...values] = rows;
  if (new Set(headers).size !== headers.length) throw new Error(`${sourceName}: duplicate CSV header.`);
  return values.map((valuesRow, rowIndex) => {
    if (valuesRow.length !== headers.length) throw new Error(`${sourceName}: row ${rowIndex + 2} has ${valuesRow.length} fields; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header, index) => [header, valuesRow[index]]));
  });
}
