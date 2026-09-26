import type { WorkBook } from "xlsx";
import { type ExcelPackage, xmlChild as child, xmlChildren as children, xmlDescendants as descendants, xmlElements as elements, xmlValue as val, xmlOn as on } from "./excel-package";

export type ExcelChartSeries = {
  name: string; values: (number | null)[]; categories: string[]; x: (number | null)[]; bubbles: (number | null)[];
  colour: string; pointColours: Map<number, string>; format: string; smooth: boolean; marker: string;
  labels: { value: boolean; category: boolean; series: boolean; percent: boolean }; lineWidth: number; lineVisible: boolean;
};
export type ExcelChartGroup = { kind: string; horizontal: boolean; grouping: string; axes: string[]; series: ExcelChartSeries[]; hole: number; angle: number; filled: boolean; lines: boolean };
export type ExcelChartAxis = { id: string; kind: string; position: string; title: string; min?: number; max?: number; log?: number; inverse: boolean; format: string; hidden: boolean };
export type ExcelChart = { title: string; groups: ExcelChartGroup[]; axes: ExcelChartAxis[]; palette: string[]; legend: string | null; background: string; border: string; blanks: string; text: string };
const supported = new Set(["barChart", "lineChart", "areaChart", "pieChart", "doughnutChart", "scatterChart", "bubbleChart", "radarChart", "stockChart"]);
const palette = ["4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47", "264478", "9E480E"];
const MAX_POINTS = 20000;
const titleText = (node?: Element) => descendants(node, "t").map(n => n.textContent || "").join(" ") || descendants(node, "v").map(n => n.textContent || "").join(" ");
const number = (value: string | undefined): number | undefined => value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : undefined;

/** Read saved chart caches first; fall back to in-workbook cell references.
 * No Excel formulas are executed and external workbook URLs are never fetched. */
export function readExcelChart(root: Element, workbook: WorkBook, XLSX: typeof import("xlsx"), pkg: ExcelPackage, sheetName: string): ExcelChart {
  const chart = child(root, "chart"), plot = child(chart, "plotArea");
  if (!plot) throw new Error("This chart has no readable plot data. Save a new XLSX copy in Excel.");
  const visibleOnly = on(chart, "plotVisOnly", true);
  const themePalette = Array.from({ length: 8 }, (_, i) => pkg.themeColours.get(`accent${i % 6 + 1}`) || palette[i]);
  const cellsFor = (formula: string) => {
    const match = /^(?:'((?:[^']|'')+)'|([^'!]+))!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/i.exec(formula.replace(/^=/, ""));
    if (!match || /\[|\]/.test(match[1] || match[2])) return null;
    const sheet = workbook.Sheets[(match[1]?.replace(/''/g, "'") || match[2])];
    if (!sheet) return null;
    const range = XLSX.utils.decode_range(`${match[3]}${match[4]}:${match[5] || match[3]}${match[6] || match[4]}`.toUpperCase());
    if ((range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1) > MAX_POINTS) throw new Error("A chart contains more than 20,000 data points. Reduce its data range before converting.");
    const out: { value: unknown; hidden: boolean; missingFormula: boolean; format: string }[] = [];
    for (let r = range.s.r; r <= range.e.r; r++) for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      const value = cell?.v instanceof Date ? (cell.v.getTime() - Date.UTC(1899, 11, 30)) / 86400000 - (workbook.Workbook?.WBProps?.date1904 ? 1462 : 0) : cell?.v;
      out.push({ value, hidden: Boolean(sheet["!rows"]?.[r]?.hidden || sheet["!cols"]?.[c]?.hidden), missingFormula: Boolean(cell?.f && cell.v == null), format: cell?.z || "General" });
    }
    return out;
  };
  const data = (node?: Element): { values: (string | null)[]; hidden: boolean[]; format: string } => {
    if (!node) return { values: [], hidden: [], format: "General" };
    const source = elements(node).find(n => /^(numRef|strRef|numLit|strLit|multiLvlStrRef)$/.test(n.localName)) || node;
    const formula = child(source, "f")?.textContent || "";
    const cells = formula ? cellsFor(formula) : null;
    const cache = elements(source).find(n => /Cache$/.test(n.localName)) || source;
    const levels = children(cache, "lvl"), pointNodes = levels.length ? levels.flatMap(l => children(l, "pt")) : children(cache, "pt");
    const count = Math.max(Number(val(cache, "ptCount", "0")), cells?.length || 0, ...pointNodes.map(n => Number(n.getAttribute("idx")) + 1), 0);
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_POINTS) throw new Error("A chart contains too many or invalid data points.");
    const values: (string | null)[] = Array(count).fill(null);
    for (const point of pointNodes) {
      const index = Number(point.getAttribute("idx"));
      if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error("A chart contains an invalid point index.");
      const text = child(point, "v")?.textContent ?? null;
      values[index] = levels.length && values[index] ? `${values[index]} / ${text || ""}` : text;
    }
    // Missing cache points are intentionally blanks, not a reason to shift the
    // subsequent category/value pairs. Only an absent cache uses source cells.
    if (!pointNodes.length && cells) {
      if (cells.some(c => c.missingFormula)) throw new Error("A chart formula has no saved result. Recalculate and save the workbook in Excel before converting.");
      cells.forEach((cell, i) => { values[i] = cell.value == null ? null : String(cell.value); });
    }
    if (!values.length && formula) throw new Error(`A chart in “${sheetName}” has no saved data for ${formula}. Open it in Excel, refresh the chart and save it before converting.`);
    return { values, hidden: cells?.map(c => visibleOnly && c.hidden) || [], format: child(cache, "formatCode")?.textContent || cells?.find(c => c.format !== "General")?.format || "General" };
  };
  const groups: ExcelChartGroup[] = [];
  let total = 0, colourIndex = 0;
  for (const group of elements(plot).filter(n => /Chart$/.test(n.localName))) {
    if (!supported.has(group.localName)) throw new Error(`The ${group.localName.replace(/Chart$/, "")} chart in “${sheetName}” needs Excel's native PDF export. It will not be silently removed or changed into another chart type.`);
    const series = children(group, "ser").sort((a, b) => Number(val(a, "order", "0")) - Number(val(b, "order", "0"))).map((ser, index): ExcelChartSeries => {
      if (children(ser, "trendline").length || child(ser, "errBars")) throw new Error(`A chart in “${sheetName}” uses trendlines or error bars. Use Excel's PDF export to preserve those details.`);
      const values = data(child(ser, "val") || child(ser, "yVal"));
      const categories = data(child(ser, "cat")), xs = data(child(ser, "xVal")), sizes = data(child(ser, "bubbleSize"));
      const keep = values.values.map((_, i) => i).filter(i => !values.hidden[i] && !categories.hidden[i] && !xs.hidden[i]);
      const numeric = (items: (string | null)[]) => keep.map(i => items[i] === null || items[i] === undefined || items[i] === "" || /^#/.test(items[i]!) ? null : number(items[i]!) ?? null);
      const labelNode = child(ser, "dLbls") || child(group, "dLbls");
      const sp = child(ser, "spPr"), line = child(sp, "ln");
      const colour = pkg.colour(child(sp, "solidFill") || child(line, "solidFill"), themePalette[colourIndex++ % themePalette.length]);
      const pointColours = new Map<number, string>();
      for (const point of children(ser, "dPt")) {
        const originalIndex = Number(val(point, "idx")), keptIndex = keep.indexOf(originalIndex);
        if (keptIndex >= 0) pointColours.set(keptIndex, pkg.colour(child(child(point, "spPr"), "solidFill"), colour));
      }
      const tx = child(ser, "tx"), txData = data(tx);
      const name = txData.values.filter(v => v !== null).join(" ") || child(tx, "v")?.textContent || `Series ${index + 1}`;
      total += keep.length;
      return {
        name, values: numeric(values.values), categories: keep.map(i => {
          const value = categories.values[i];
          if (value == null) return String(i + 1);
          if (categories.format !== "General" && number(value) !== undefined) {
            try { return XLSX.SSF.format(categories.format, Number(value), { date1904: Boolean(workbook.Workbook?.WBProps?.date1904) }); } catch { /* keep the original label */ }
          }
          return value;
        }), x: numeric(xs.values), bubbles: numeric(sizes.values),
        colour, pointColours, format: values.format, smooth: on(ser, "smooth") || /smooth/i.test(val(group, "scatterStyle")), marker: val(child(ser, "marker"), "symbol", "circle"), lineWidth: Number(line?.getAttribute("w") || 19050) / 12700,
        lineVisible: !child(line, "noFill") && (Boolean(line) || /line|smooth/i.test(val(group, "scatterStyle")) || !child(group, "scatterStyle")),
        labels: { value: on(labelNode, "showVal"), category: on(labelNode, "showCatName"), series: on(labelNode, "showSerName"), percent: on(labelNode, "showPercent") },
      };
    });
    if (!series.length || !series.some(s => s.values.some(v => v !== null))) throw new Error(`A chart in “${sheetName}” has no saved numeric data. Refresh it in Excel and save the workbook.`);
    if (total > 50000 || series.length > 128) throw new Error("The chart is too large for browser conversion. Reduce its series or data points.");
    const kind = group.localName;
    if (["pieChart", "doughnutChart"].includes(kind) && series.some(s => s.values.some(v => v !== null && v < 0))) throw new Error("A pie chart contains negative values. Export it from Excel to preserve its interpretation.");
    const style = val(group, "scatterStyle", "marker");
    groups.push({ kind, series, horizontal: val(group, "barDir") === "bar", grouping: val(group, "grouping", "standard"), axes: children(group, "axId").map(n => n.getAttribute("val") || ""), hole: Number(val(group, "holeSize", "50")), angle: Number(val(group, "firstSliceAng", "0")), filled: val(group, "radarStyle") === "filled", lines: /line|smooth/i.test(style) });
  }
  if (!groups.length) throw new Error(`A chart in “${sheetName}” uses a chart format that needs Excel's native PDF export.`);
  const readTitle = (node?: Element) => titleText(node) || data(child(node, "tx")).values.filter(v => v !== null).join(" ");
  const axes = elements(plot).filter(n => /^(catAx|dateAx|valAx)$/.test(n.localName)).map((axis): ExcelChartAxis => {
    const scaling = child(axis, "scaling");
    return { id: val(axis, "axId"), kind: axis.localName, position: val(axis, "axPos"), title: readTitle(child(axis, "title")), min: number(val(scaling, "min")), max: number(val(scaling, "max")), log: number(val(scaling, "logBase")), inverse: val(scaling, "orientation") === "maxMin", format: child(axis, "numFmt")?.getAttribute("formatCode") || "General", hidden: on(axis, "delete") };
  });
  const legend = child(chart, "legend"), title = readTitle(child(chart, "title"));
  return { title, groups, axes, palette: themePalette, legend: legend ? val(legend, "legendPos", "b") : null, background: pkg.colour(child(child(root, "spPr"), "solidFill"), "FFFFFF"), border: pkg.colour(child(child(child(root, "spPr"), "ln"), "solidFill"), "D9DEE5"), blanks: val(chart, "dispBlanksAs", "gap"), text: [title, ...axes.map(a => a.title), ...groups.flatMap(g => g.series.flatMap(s => [s.name, ...s.categories]))].join(" ") };
}

type Option = Record<string, unknown>;
/** Deliberately separate data interpretation from painting, so zeroes, gaps,
 * cached values, stacking and secondary axes can be regression-tested. */
export function excelChartOption(chart: ExcelChart, width: number, height: number, format: (code: string, value: number) => string): Option {
  const px = Math.min(1, width / 450, height / 260);
  const font = Math.max(7, 11 * px);
  const formatNumber = (code: string, value: number) => { try { return code && code !== "General" ? format(code, value) : String(Number(value.toPrecision(8))); } catch { return String(value); } };
  const series: Option[] = [], xAxes: Option[] = [], yAxes: Option[] = [];
  const axisIndices = new Map<string, number>();
  const axis = (id: string, dimension: "x" | "y", category: boolean, categories: string[], percent: boolean) => {
    const key = `${dimension}:${id}`;
    if (axisIndices.has(key)) return axisIndices.get(key)!;
    const source = chart.axes.find(a => a.id === id), output = dimension === "x" ? xAxes : yAxes;
    const valueFormat = source?.format || "General";
    const option: Option = { type: category ? "category" : source?.log ? "log" : "value", data: category ? categories : undefined, inverse: source?.inverse || false, show: !source?.hidden, name: source?.title || "", nameLocation: "middle", nameGap: (dimension === "x" ? 32 : 44) * px, nameTextStyle: { fontSize: font }, axisLabel: { fontSize: font, color: "#334155", hideOverlap: true, ...(category ? { interval: "auto" } : { formatter: (v: number) => percent ? `${Number(v.toFixed(1))}%` : formatNumber(valueFormat, v) }) }, axisLine: { show: true, lineStyle: { color: "#94A3B8" } }, splitLine: { show: !category, lineStyle: { color: "#E2E8F0" } }, ...(source?.min !== undefined && { min: source.min }), ...(source?.max !== undefined && { max: source.max }), ...(source?.log && { logBase: source.log }), position: dimension === "x" ? source?.position === "t" ? "top" : "bottom" : source?.position === "r" ? "right" : "left" };
    const index = output.push(option) - 1;
    axisIndices.set(key, index);
    return index;
  };
  let radar: Option | undefined;
  for (const [groupIndex, group] of chart.groups.entries()) {
    const pie = /^(pieChart|doughnutChart)$/.test(group.kind), radial = group.kind === "radarChart";
    const xy = group.kind === "scatterChart" || group.kind === "bubbleChart";
    if ((pie || radial) && chart.groups.length > 1) throw new Error("This workbook combines incompatible chart coordinate systems. Export that chart from Excel.");
    const cats = group.series.reduce((best, s) => s.categories.length > best.length ? s.categories : best, [] as string[]);
    const percent = group.grouping === "percentStacked";
    // Axis ids describe the chart's dimensions. Some producers use axPos=l
    // even for a category/X axis, so position alone cannot identify them.
    const categoryId = group.axes.find(id => /^(catAx|dateAx)$/.test(chart.axes.find(a => a.id === id)?.kind || "")) || group.axes[0];
    const valueId = group.axes.find(id => chart.axes.find(a => a.id === id)?.kind === "valAx") || group.axes[1];
    const xId = (xy ? group.axes[0] : group.horizontal ? valueId : categoryId) || "x";
    const yId = (xy ? group.axes[1] : group.horizontal ? categoryId : valueId) || "y";
    const xAxisIndex = pie || radial ? undefined : axis(xId, "x", !xy && !group.horizontal, cats, percent && group.horizontal);
    const yAxisIndex = pie || radial ? undefined : axis(yId, "y", !xy && group.horizontal, cats, percent && !group.horizontal);
    if (radial) {
      const savedAxis = chart.axes.find(a => a.kind === "valAx");
      const maximum = savedAxis?.max ?? Math.max(1, ...group.series.flatMap(s => s.values.map(v => v || 0))) * 1.1;
      const minimum = savedAxis?.min ?? Math.min(0, ...group.series.flatMap(s => s.values.map(v => v || 0)));
      radar = { indicator: cats.map(name => ({ name, max: maximum, min: minimum })), radius: "60%", center: ["50%", "53%"], axisName: { fontSize: font, color: "#334155" } };
    }
    if (group.kind === "stockChart") {
      if (![3, 4].includes(group.series.length)) throw new Error("This stock chart needs three (high/low/close) or four (open/high/low/close) series.");
      const s = group.series;
      series.push({ type: "candlestick", name: chart.title || "Stock", xAxisIndex, yAxisIndex, data: cats.map((_, i) => s.length === 4 ? [s[0].values[i], s[3].values[i], s[2].values[i], s[1].values[i]] : [s[2].values[i], s[2].values[i], s[1].values[i], s[0].values[i]]), itemStyle: { color: "#FFFFFF", color0: "#4472C4", borderColor: "#4472C4", borderColor0: "#4472C4" } });
      continue;
    }
    for (const [index, s] of group.series.entries()) {
      const label = { show: Object.values(s.labels).some(Boolean), fontSize: font, color: "#1E293B", formatter: (p: { dataIndex: number; percent?: number }) => [s.labels.series ? s.name : "", s.labels.category ? s.categories[p.dataIndex] : "", s.labels.value && s.values[p.dataIndex] !== null ? formatNumber(s.format, s.values[p.dataIndex]!) : "", s.labels.percent && p.percent !== undefined ? `${p.percent.toFixed(1)}%` : ""].filter(Boolean).join("\n") };
      const base: Option = { name: s.name, animation: false, xAxisIndex, yAxisIndex, itemStyle: { color: `#${s.colour}` }, lineStyle: { color: `#${s.colour}`, width: s.lineWidth }, label, labelLayout: { hideOverlap: true }, emphasis: { disabled: true }, silent: true, connectNulls: chart.blanks === "span", smooth: s.smooth, symbol: ["none", "circle", "rect", "diamond", "triangle"].includes(s.marker) ? s.marker : "circle", symbolSize: 5 * px };
      const values = s.values.map((v, i) => {
        if (v === null) return chart.blanks === "zero" ? 0 : null;
        const denominator = percent ? group.series.reduce((sum, item) => sum + Math.abs(item.values[i] || 0), 0) : 1;
        return percent ? denominator ? v / denominator * 100 : 0 : v;
      });
      if (pie) {
        const outer = Math.max(12, Math.min(width * 0.30, height * 0.32) / group.series.length);
        const ringOuter = outer * (index + 1), ringInner = group.kind === "doughnutChart" ? index ? outer * index + 3 : ringOuter * group.hole / 100 : index ? outer * index + 3 : 0;
        series.push({ ...base, type: "pie", center: ["50%", "53%"], radius: [ringInner, ringOuter], startAngle: 90 - group.angle, avoidLabelOverlap: true, label: { ...label, position: "outside" }, data: s.values.map((v, i) => ({ name: s.categories[i], value: v, itemStyle: { color: `#${s.pointColours.get(i) || chart.palette[i % chart.palette.length]}` } })) });
      } else if (radial) {
        series.push({ ...base, type: "radar", ...(group.filled && { areaStyle: { opacity: 0.2 } }), data: [{ name: s.name, value: values }] });
      } else if (xy) {
        if (s.x.every(v => v === null)) throw new Error("A scatter or bubble chart has no saved X values. Refresh and save it in Excel.");
        const bubbleMax = Math.max(1, ...s.bubbles.map(v => Math.abs(v || 0)));
        series.push({ ...base, type: group.kind === "scatterChart" && s.lineVisible ? "line" : "scatter", data: values.map((v, i) => v === null || s.x[i] === null ? null : [s.x[i], v, s.bubbles[i]]), ...(group.kind === "bubbleChart" && { symbol: "circle", symbolSize: (v: number[]) => Math.sqrt(Math.abs(v[2] || 0) / bubbleMax) * 36 * px, itemStyle: { color: `#${s.colour}`, opacity: 0.7 } }) });
      } else {
        series.push({ ...base, type: group.kind === "barChart" ? "bar" : "line", data: values.map((value, i) => ({ value, ...(s.pointColours.has(i) && { itemStyle: { color: `#${s.pointColours.get(i)}` } }) })), ...(group.grouping.toLowerCase().includes("stacked") && { stack: `stack-${groupIndex}` }), ...(group.kind === "areaChart" && { areaStyle: { opacity: 0.55 }, symbol: "none" }), ...(group.kind === "barChart" && { barMaxWidth: 48 * px }) });
      }
    }
  }
  const sideLegend = chart.legend === "l" || chart.legend === "r";
  return { animation: false, backgroundColor: `#${chart.background}`, textStyle: { fontFamily: "PDFPilotChart, Arial, sans-serif", fontSize: font, color: "#1E293B" }, title: { show: Boolean(chart.title), text: chart.title, left: "center", top: 8 * px, textStyle: { fontSize: 14 * px, fontWeight: "bold", width: width - 24 * px, overflow: "break" } }, legend: { show: Boolean(chart.legend), orient: sideLegend ? "vertical" : "horizontal", ...(sideLegend ? { [chart.legend === "l" ? "left" : "right"]: 6 * px, top: "middle", width: width * 0.2 } : chart.legend === "t" ? { top: chart.title ? 32 * px : 8 * px } : { bottom: 6 * px }), textStyle: { fontSize: font, width: sideLegend ? width * 0.16 : width * 0.4, overflow: "break" }, itemWidth: 12 * px, itemHeight: 8 * px }, grid: { left: chart.legend === "l" ? "25%" : 42 * px, right: chart.legend === "r" ? "25%" : yAxes.length > 1 ? 55 * px : 20 * px, top: chart.title ? chart.legend === "t" ? 68 * px : 48 * px : 26 * px, bottom: chart.legend && !sideLegend && chart.legend !== "t" ? 58 * px : 38 * px, containLabel: true }, ...(xAxes.length && { xAxis: xAxes, yAxis: yAxes }), ...(radar && { radar }), series };
}
