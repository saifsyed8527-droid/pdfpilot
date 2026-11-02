export interface TableText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rtl?: boolean;
}
interface TableRow {
  y: number;
  height: number;
  items: TableText[];
}
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
function joinCell(items: TableText[]) {
  const rtl =
    items.filter(
      (item) =>
        item.rtl || /[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(item.text),
    ).length >
    items.length / 2;
  return [...items]
    .sort((a, b) => (rtl ? b.x - a.x : a.x - b.x))
    .map((item) => item.text)
    .join(" ")
    .replace(
      /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])\s+(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu,
      "$1",
    )
    .trim();
}
function segments(items: TableText[]) {
  const groups: TableText[][] = [];
  for (const item of items.sort((a, b) => a.x - b.x)) {
    const group = groups.at(-1),
      previous = group?.at(-1);
    if (
      previous &&
      item.x - previous.x - previous.width <=
        Math.max(2, Math.min(previous.height, item.height) * 0.9)
    )
      group!.push(item);
    else groups.push([item]);
  }
  return groups.map((group) => ({
    text: joinCell(group),
    x: group[0].x,
    y: Math.min(...group.map((item) => item.y)),
    width: Math.max(...group.map((item) => item.x + item.width)) - group[0].x,
    height: Math.max(...group.map((item) => item.height)),
    rtl: group.some((item) => item.rtl),
  }));
}
/** Whitespace/alignment inference, not semantic table reconstruction. Repeated
 * left OR right edges keep right-aligned numbers in the same column. */
export function detectTableGrids(input: TableText[]): string[][][] {
  if (input.length > 100_000)
    throw new Error(
      "A page has too many text objects. Choose fewer or simpler pages.",
    );
  const items = input.filter(
    (item) =>
      item.text.trim() &&
      [item.x, item.y, item.width, item.height].every(Number.isFinite) &&
      item.height > 0 &&
      item.width >= 0,
  );
  const rows: TableRow[] = [];
  for (const item of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows
      .slice(-4)
      .find(
        (row) =>
          Math.abs(row.y - item.y) <=
          Math.max(2.5, Math.min(row.height, item.height) * 0.55),
      );
    if (row) {
      if (
        !row.items
          .slice(-8)
          .some(
            (old) =>
              old.text === item.text &&
              Math.abs(old.x - item.x) < 0.8 &&
              Math.abs(old.y - item.y) < 0.8,
          )
      )
        row.items.push(item);
      if (row.items.length > 2048)
        throw new Error(
          "A table row has too many text fragments. Choose a simpler PDF.",
        );
      row.height = Math.max(row.height, item.height);
    } else rows.push({ y: item.y, height: item.height, items: [item] });
  }
  rows.sort((a, b) => a.y - b.y);
  for (const row of rows) row.items = segments(row.items);
  const body = median(rows.map((row) => row.height)) || 12;
  const gaps = rows
    .slice(1)
    .map((row, i) => row.y - rows[i].y)
    .filter((value) => value > body * 0.5);
  const separation = Math.max(body * 3, (median(gaps) || body * 1.5) * 1.8);
  const blocks: TableRow[][] = [];
  for (const row of rows) {
    const block = blocks.at(-1);
    if (!block || row.y - block.at(-1)!.y > separation) blocks.push([row]);
    else block.push(row);
  }
  const grids: string[][][] = [];
  let allocatedRows = 0,
    allocatedCells = 0;
  for (const block of blocks) {
    const multiple = block.filter((row) => row.items.length >= 2);
    if (multiple.length < 2) continue;
    const anchors: {
      left: number[];
      right: number[];
      x: number;
      end: number;
      rows: Set<TableRow>;
    }[] = [];
    const tolerance = Math.max(4, Math.min(20, body));
    for (const row of multiple)
      for (const item of row.items) {
        const end = item.x + item.width;
        let nearest: (typeof anchors)[number] | undefined,
          distance = Infinity;
        for (const anchor of anchors) {
          if (anchor.rows.has(row)) continue;
          const delta = Math.min(
            Math.abs(anchor.x - item.x),
            Math.abs(anchor.end - end),
          );
          if (delta < distance) {
            distance = delta;
            nearest = anchor;
          }
        }
        if (nearest && distance <= tolerance) {
          nearest.left.push(item.x);
          nearest.right.push(end);
          if (nearest.left.length > 31) {
            nearest.left.shift();
            nearest.right.shift();
          }
          nearest.x = median(nearest.left);
          nearest.end = median(nearest.right);
          nearest.rows.add(row);
        } else
          anchors.push({
            left: [item.x],
            right: [end],
            x: item.x,
            end,
            rows: new Set([row]),
          });
        if (anchors.length > 1024)
          throw new Error(
            "This page has too many possible table columns. Use a simpler table.",
          );
      }
    const columns = anchors
      .filter((anchor) => anchor.rows.size >= 2)
      .sort((a, b) => a.x - b.x);
    if (columns.length < 2) continue;
    if (columns.length > 256)
      throw new Error("Tables may contain up to 256 detected columns.");
    const first = block.indexOf(multiple[0]),
      last = block.indexOf(multiple.at(-1)!);
    const selectedRows = block.slice(first, last + 1);
    allocatedRows += selectedRows.length;
    allocatedCells += selectedRows.length * columns.length;
    if (allocatedRows > 50_000 || allocatedCells > 1_000_000)
      throw new Error(
        "Detected tables exceed 50,000 rows or one million cells. Choose fewer or simpler pages.",
      );
    const grid = selectedRows.map((row) => {
      const cells: TableText[][] = Array.from(
        { length: columns.length },
        () => [],
      );
      for (const item of row.items) {
        let index = 0,
          distance = Infinity;
        columns.forEach((column, i) => {
          const delta = Math.min(
            Math.abs(item.x - column.x),
            Math.abs(item.x + item.width - column.end),
          );
          if (delta < distance) {
            distance = delta;
            index = i;
          }
        });
        cells[index].push(item);
      }
      return cells.map(joinCell);
    });
    if (grid.filter((row) => row.filter(Boolean).length >= 2).length >= 2)
      grids.push(grid);
  }
  return grids;
}
