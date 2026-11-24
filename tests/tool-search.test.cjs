const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");
const { searchToolSuggestions } = require("./load-ts.cjs").loadTs("src/lib/search.ts");

const tools = [
  ["merge-pdf", "Merge PDF"], ["compress-pdf", "Compress PDF"], ["split-pdf", "Split PDF"],
  ["organize-pdf", "Organize PDF"], ["repair-pdf", "Repair PDF"], ["delete-pages", "Delete Pages"],
  ["extract-pages", "Extract Pages"], ["compare-pdf", "Compare PDF"], ["docx-merge", "Merge Word Files"],
].map(([slug, name]) => ({slug,name,path:"/"+slug,tagline:name+" in your browser",domain:"pdf"}));
const index = [
  { type:"category", name:"Merge PDF", path:"/categories/organize-pdf", description:"", haystack:"merge pdf combine pdf" },
  { type:"guide", name:"Compress PDF", path:"/guides/compress", description:"", haystack:"compress pdf shrink pdf" },
  ...tools.map(tool => ({type:"tool",toolSlug:tool.slug,path:tool.path,name:tool.name,description:tool.tagline,haystack:tool.tagline})),
];

test("tool names and task terms rank direct routes first with up to four context-specific choices", () => {
  const paths = q => searchToolSuggestions(index, q).map(({path})=>path);
  assert.deepEqual(paths("Merge PDF"), ["/merge-pdf","/split-pdf","/organize-pdf","/compress-pdf"]);
  assert.deepEqual(paths("Compress PDF"), ["/compress-pdf","/merge-pdf","/split-pdf","/repair-pdf"]);
  assert.equal(paths("combine pdfs")[0],"/merge-pdf");
  assert.equal(paths("shrink PDF")[0],"/compress-pdf");
  assert.equal(paths("mrege")[0],"/merge-pdf");
  assert.equal(paths("compare pdf")[0],"/compare-pdf");
  assert.deepEqual(paths("   "),[]);
  assert.deepEqual(paths("definitely not a tool"),[]);
  assert.deepEqual(paths("constructor"),[]);
  assert.deepEqual(searchToolSuggestions(index.slice(0,2),"merge pdf"),[]);
});

test("translated result paths retain same-locale related links", () => {
  const localized = index.filter(e=>e.type==="tool").map(e=>({
    ...e, name:e.toolSlug==="merge-pdf"?"Fusionner un PDF":e.name,
    path:e.toolSlug==="merge-pdf"?"/fr/fusionner-pdf":"/fr/"+e.toolSlug,
  }));
  assert.deepEqual(searchToolSuggestions(localized,"Fusionner un PDF").map(x=>x.path),
    ["/fr/fusionner-pdf","/fr/split-pdf","/fr/organize-pdf","/fr/compress-pdf"]);
});

function render(entry, fn, states, pathname = "/", props = {}) {
  let state = 0;
  const locale = pathname === "/fr" ? "fr" : "en";
  const localizedToolName = (slug, lang, name) => lang === "fr" && slug === "merge-pdf" ? "Fusionner un PDF" : name;
  const localizedToolPath = (slug, lang) => lang === "fr" ? "/fr/"+(slug === "merge-pdf"?"fusionner-pdf":slug):"/"+slug;
  const stubs = {
    "react":{...React,useState:(initial)=>[states[state++] ?? initial, ()=>{}]},
    "lucide-react":new Proxy({}, {get:()=>()=>null}),
    "next/link":({children,href,...attrs})=>React.createElement("a",{...attrs,href},children),
    "next/navigation":{usePathname:()=>pathname},
    "@/lib/tools":{TOOLS:tools},
    "@/lib/tool-navigation":{getToolNavigation:()=>[{navCategory:"Organize PDF",groups:[{tools}]}]},
    "@/lib/search":{searchToolSuggestions},
    "@/lib/category-colors":{getCategoryStyle:()=>({label:"organize"})},
    "@/lib/i18n/locales":{getLocale:()=>({code:locale,dir:"ltr"})},
    "@/lib/i18n/url-strategy":{parseLocalizedPath:()=>({locale}),localizedPath:path=>path,localizedCorePath:()=>"/",localizedToolPath},
    "@/lib/i18n/ui-copy":{uiText:(_,s)=>s,localizedToolName},
    "@/lib/i18n/tool-summaries":{localizedToolSummary:(_slug,_lang,description)=>description},
    "@/lib/i18n/core-content":{CORE_COPY:{fr:{home:{h1:"PDF",intro:"Outils"}}}},
    "@/components/language-switcher":{LanguageSwitcher:()=>null},
    "@/components/theme-toggle":{ThemeToggle:()=>null},
    "@/lib/recent-searches":{getRecentSearches:()=>[],recordSearch:()=>{},clearRecentSearches:()=>{}},
    "@/lib/analytics/events":{trackSearchPerformed:()=>{},trackSearchResultClicked:()=>{}},
  };
  const js=ts.transpileModule(fs.readFileSync(entry,"utf8"),{
    fileName:entry,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}
  }).outputText;
  const exports={};
  new Function("require","exports",js)(id=>Object.hasOwn(stubs,id)?stubs[id]:require(id),exports);
  return renderToStaticMarkup(React.createElement(exports[fn],props));
}
const hrefs = (html) => [...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);

test("actual navbar JSX uses only direct result links for typed mobile/desktop searches", () => {
  const region = (query, locale="/", desktop=false) => render("src/components/navbar.tsx","Navbar",[desktop?"all":null,!desktop,null,false,query],locale)
    .split(desktop?'id="all-tools-menu"':'id="mobile-menu"')[1];
  const mobile = region("merge pdf");
  assert.deepEqual(hrefs(mobile),["/merge-pdf","/split-pdf","/organize-pdf","/compress-pdf"]);
  assert.doesNotMatch(mobile,/aria-controls="mobile-tools-|Browse all categories/);
  assert.deepEqual(hrefs(region("Compress PDF","/",true)),["/compress-pdf","/merge-pdf","/split-pdf","/repair-pdf"]);
  assert.match(region(""),/aria-controls="mobile-tools-0"/);
  assert.match(region("","/",true),/href="\/categories"/);
  assert.match(region("unmatched query"),/No matching tools/);
  assert.equal(hrefs(region("Fusionner un PDF","/fr"))[0],"/fr/fusionner-pdf");
});

test("actual homepage JSX uses only tools in search but keeps category filters when clear", () => {
  const state = (query) => render("src/app/home-client.tsx","HomeClient",["all",query,[]],"/",{searchIndex:index});
  const results = state("merge pdf");
  assert.deepEqual(hrefs(results),["/merge-pdf","/split-pdf","/organize-pdf","/compress-pdf"]);
  assert.doesNotMatch(results,/categories\/organize|aria-controls="home-tool-grid"/);
  assert.match(state(""),/aria-controls="home-tool-grid"/);
});
