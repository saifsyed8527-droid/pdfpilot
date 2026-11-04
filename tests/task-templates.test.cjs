const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { load } = require("../scripts/load-pseo-modules.cjs");
const stockTools = require("../src/lib/tools-data.json");
const tasks = require("../src/lib/content/task-templates.json");
const { DATA_WORKFLOWS } = load("src/lib/content/data-workflows.ts");
const { runDataWorkflow, WORKFLOW_INPUT_LIMIT } = load("src/lib/engines/data-workflow-engine.ts");
const bySlug = slug => DATA_WORKFLOWS.find(row => row.slug === slug);
const sample = name => fs.readFileSync("public/task-examples/" + name, "utf8");

test("each tool owns a distinct practice task, real sample downloads and a working next tool", () => {
  const slugs = new Set(stockTools.map(tool => tool.slug));
  assert.deepEqual(new Set(tasks.map(row => row.tool)), slugs);
  assert.equal(new Set(tasks.map(row => row.slug)).size, tasks.length);
  assert.equal(new Set(tasks.map(row => row.title)).size, tasks.length);
  assert.equal(new Set(tasks.map(row => row.check)).size, tasks.length);
  for (const task of tasks) {
    assert.ok(slugs.has(task.nextTool));
    for (const source of task.samples) {
      assert.match(source, /^\/(task-examples|template-samples)\/[a-z0-9.-]+$/);
      assert.ok(fs.statSync("public" + source).size > 0, source);
    }
  }
});

test("all paired workflows run the published example through to a readable download", async () => {
  for (const flow of DATA_WORKFLOWS) {
    const output = await runDataWorkflow(flow, sample(flow.sample));
    assert.ok(output.size > 0, flow.slug);
    if (flow.output === "xlsx") {
      const xlsx = require("xlsx");
      const workbook = xlsx.read(await output.arrayBuffer(), { type: "array" });
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      assert.equal(rows.length, 3);
      assert.equal(rows[0].sku, "A17");
    } else {
      const value = await output.text();
      assert.match(value, /A17/);
      if (flow.output === "json" || flow.output === "yaml") {
        const data = flow.output === "json" ? JSON.parse(value) : require("js-yaml").load(value);
        assert.equal(data.length, 3, flow.slug);
        assert.equal(data[1].item, "Pens, blue");
        assert.equal(String(data[1].units), "8");
      } else if (flow.output === "md") {
        assert.equal(value.trim().split("\n").length, 5);
        assert.match(value, /Pens, blue/);
      } else if (flow.output === "sql") {
        assert.match(value, /INSERT INTO/i); assert.match(value, /stock/i); assert.match(value, /C21/);
      } else if (flow.output === "csv") {
        assert.equal(value.match(/A17/g).length, 1);
        assert.equal(value.trim().split(/\r?\n/).length, 4);
      }
    }
  }
});

test("file workflows reject unusable input and can process a valid file after an error", async () => {
  const flow = bySlug("deduplicate-csv-and-export-json");
  for (const input of ["", "a,a\n1,2", "a,b\n1", "a\n" + "x".repeat(WORKFLOW_INPUT_LIMIT)]) {
    await assert.rejects(runDataWorkflow(flow, input));
  }
  assert.equal(JSON.parse(await (await runDataWorkflow(flow, sample(flow.sample))).text()).length, 3);
  const sql = bySlug("turn-tab-separated-data-into-sql-inserts");
  await assert.rejects(runDataWorkflow(sql, sample(sql.sample), "bad name"));
  assert.match(await (await runDataWorkflow(sql, sample(sql.sample), "items")).text(), /items/);
});
