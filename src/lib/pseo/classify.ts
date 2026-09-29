import { CAPABILITIES, CAPABILITY_BY_ID } from "./capabilities";
import type { families } from "./schema";
export type Family = typeof families[number];
export interface Classification { family: Family; toolId?: string; signature: string; modifier: string; reason: string; sourceFormat?: string; targetFormat?: string; targetSize?: number }
export function normalizeKeyword(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/pdf\/a/g, "pdfa").replace(/[’']/g, "").replace(/(\d)\s+(kb|mb|gb)\b/g, "$1$2").replace(/[^\p{L}\p{N}/.+-]+/gu, " ").trim().replace(/\s+/g, " ");
}
const formatAliases: Record<string, string> = { jpeg: "jpg", images: "jpg", image: "jpg", pictures: "jpg", picture: "jpg", photos: "jpg", photo: "jpg", pics: "jpg", word: "docx", powerpoint: "pptx", excel: "xlsx", "pdf/a": "pdfa" };
const format = (s: string) => formatAliases[s] ?? s;
const aliases: [string, RegExp][] = [
  ["add-page-numbers", /\b(?:numbering|page numbers?|number pages)\b/], ["delete-pages", /\b(?:remove|delete|remover)\b.*\bpages?\b|\bpages?\b.*\b(?:remove|delete|remover)\b/],
  ["extract-pages", /\bextract\b.*\bpages?\b/], ["organize-pdf", /\b(?:organize|organise|organizer|reorder|rearrange)\b/],
  ["rotate-pdf", /\brotate\b/], ["watermark-pdf", /\bwatermark\b/], ["crop-pdf", /\b(?:crop|cropper)\b/],
  ["fill-pdf", /\b(?:fill|fillable|forms?)\b/], ["repair-pdf", /\b(?:repair|recover|fix corrupted)\b/],
  ["ocr-pdf", /\b(?:ocr|searchable)\b/], ["scan-pdf", /\bscan(?:ned)?\b/],
  ["merge-pdf", /\b(?:merge|marge|merging|combine|combining|combiner|join|joining|joiner|merger)\b/], ["split-pdf", /\b(?:split|splitting|splitter|cutter|separate|separating)\b/],
  ["compress-pdf", /\b(?:compress|compressing|compression|compressor|reduce|reducing|reducer|shrink|shrinking|smaller)\b|\bmake\b.*\b\d+(?:\.\d+)?(?:kb|mb)\b/],
  ["edit-pdf", /\b(?:edit|editing|editor|editer|annotate|annotation)\b/],
];
/** Keyword language is assessed from the query, never from competitor URL or market. */
export function needsLocalizationReview(q: string): boolean {
  return /[^\p{Script=Latin}\p{N}\p{P}\p{Z}\p{S}]/u.test(q)
    || /[à-öø-ÿā-ž]/i.test(q)
    || /\b(?:convertir|convertere|conversie|conversor|transforma|transformare|editar|editovanie|juntar|unir|comprimir|comprime|compresser|reduzir|redimensionar|convertire|unisci|combinar|fusionner|zusammen|naar|para|ke|hai|kaise|kare|karen|karna|banao|banaye|karu|karne|banaen|menjadi|ubah|gabung|menggabungkan|dalam|avec|pour|gratuit|gratis|gratuito|gratuita|archivo|arquivos|fichier)\b/.test(q)
    || /\b(?:en|em) pdf\b|\bpdf (?:en|em|a|se) (?:word|jpg|excel)\b/.test(q) && !/\b(?:to|into|convert|turn|change|make|create|from)\b/.test(q);
}

export function classifyKeyword(input: string): Classification {
  const original = normalizeKeyword(input).replaceAll("résumé","resume");
  const q = original.replace(/\bpdfs\b/g,"pdf").replace(/\bpower point\b/g,"powerpoint").replace(/\bjpe?g\b/g,"jpg");
  const end = (family: Family, reason: string, toolId?: string, modifier = "", extra = {}): Classification => ({ family, reason, toolId, modifier, signature: `${toolId ?? family}:${family}:${modifier || q}`, ...extra });
  if (!q) return end("irrelevant", "empty_keyword");
  if (/\b(?:crack|torrent|serial key|license key)\b/.test(q)) return end("irrelevant", "software_license_intent");
  if (needsLocalizationReview(q)) return end("informational", "localization_review");
  if (!/\bpdf\b/.test(q) && !/\b(?:excel|xlsx|xls)\b.*\bxml\b/.test(q) && q!=="ocr") return end("irrelevant", "outside_pdf_and_excel_scope");
  const operations=aliases.filter(([,pattern])=>pattern.test(q));
  let toolId: string | undefined, sourceFormat: string | undefined, targetFormat: string | undefined;
  // Remove connecting words before parsing the formats, rather than treating 'file' or 'a' as formats.
  const conversionText=q.replace(/\bto editable (word|docx)\b/g,"to $1").replace(/\b(?:high[- ](?:quality|resolution)|hd quality|best quality)\b/g," ").replace(/\b(?:files?|documents?|format|convert|converting|converted|conversion|a|an|the)\b/g," ").replace(/\s+/g," ").trim();
  const knownFormats=new Set("pdf pdfa jpg jpeg png heic webp tiff tif bmp gif svg avif word docx doc rtf odt powerpoint pptx ppt odp excel xlsx xls csv ods html htm url xml txt text epub dwg dxf psd zip json md image images photo photos picture pictures pics".split(" "));
  const conversions=[...conversionText.matchAll(/(?=\b([a-z]+(?:\/a)?)\s+(?:to|into|2)\s+([a-z]+(?:\/a)?)\b)/g)].filter(m=>(m[1].startsWith("pdf")||m[2].startsWith("pdf")||m[2]==="xml")&&knownFormats.has(m[1])&&knownFormats.has(m[2])&&!["scan","scans","scanned","numbers","add","back","how","what","why","where","get","go","save","export","print","turn","change"].includes(m[1]));
  const compact=q.match(/\b(word|docx|jpg|png|photo|image|excel|xlsx|powerpoint|pptx|html) (pdf)\b/)??q.match(/\b(pdf) (word|docx|jpg|png|excel|xlsx|powerpoint|pptx)\b/);
  const editingAction=/\b(?:add|insert) (?:an? )?(?:image|picture|photo|text|png|jpg) (?:in|into|to) (?:a )?pdf\b/.test(q);
  const conversion=editingAction?undefined:conversions[0]??compact;
  if (conversion) {
    sourceFormat=format(conversion[1]); targetFormat=format(conversion[2]);
    if(sourceFormat!==targetFormat) {
      const tool=CAPABILITIES.find(t=>t.inputFormats.includes(sourceFormat!)&&t.outputFormats.includes(targetFormat!)&&(t.category.startsWith("convert")||(t.toolId==="excel-to-xml"&&targetFormat==="xml")));
      if(!tool) {
        const near=targetFormat==="pdf" ? ({heic:"jpg-to-pdf",webp:"jpg-to-pdf",tiff:"jpg-to-pdf",tif:"jpg-to-pdf",bmp:"jpg-to-pdf",gif:"jpg-to-pdf",doc:"word-to-pdf",ppt:"powerpoint-to-pdf",xls:"excel-to-pdf",htm:"html-to-pdf"} as Record<string,string>)[sourceFormat] : sourceFormat==="pdf" ? ({png:"pdf-to-jpg",txt:"ocr-pdf",text:"ocr-pdf",csv:"pdf-to-excel",doc:"pdf-to-word",ppt:"pdf-to-powerpoint",xls:"pdf-to-excel"} as Record<string,string>)[targetFormat] : undefined;
        return end("unsupported",`unsupported_conversion:${sourceFormat}:${targetFormat}`,near,`${sourceFormat}-to-${targetFormat}`,{sourceFormat,targetFormat});
      }
      toolId=tool.toolId;
    }
  }
  if(!toolId)toolId=operations[0]?.[0];
  const extractingImages=/\bextract(?:ing)?\b/.test(q)&&/\b(?:images?|pictures?|photos?|jpg|png)\b/.test(q)&&!editingAction;
  if(extractingImages)toolId="pdf-to-jpg";
  if(!toolId&&/\bpdf\b/.test(q)&&(/\b\d+(?:\.\d+)?(?:kb|mb|gb)\b/.test(q)||/\b(?:kb|mb) (?:reducer|converter)|\b(?:decrease|resize|resizer)\b/.test(q)))toolId="compress-pdf";
  if(/\b(?:add|insert) (?:an? )?(?:image|picture|photo|text|png|jpg) (?:in|into|to) (?:a )?pdf\b/.test(q))toolId="edit-pdf";
  if(/\b(?:full form|meaning|definition|stand for|form means)\b/.test(q))return end("informational","pdf_definition_review");
  if(!toolId&&/\b(?:change|modify)\b.*\b(?:content|text)\b|\b(?:add|insert)\b.*\b(?:text|image)\b/.test(q))toolId="edit-pdf";
  if(/\b(?:ilovepdf|i love pdf|smallpdf|small pdf|adobe|acrobat|foxit|sejda|soda|pdf24|nitro|pdfescape|pdfelement|wondershare|xodo|pdf candy|pdfcandy|ilove|avepdf|camscanner|lightpdf)\b/.test(q))return end("informational","competitor_brand_review",toolId);
  const gap=q.match(/\b(unlock|unlocker|password|encrypt|encryption|redact|redaction|translate|translation|translator|sign|signature|summarize|summarizer|compare|comparison|epub|dwg)\b|remove watermark|watermark remover/);
  if(gap)return end("unsupported","unsupported_or_out_of_scope_operation",toolId,gap[0]);
  if(/\b(?:api|python|java|javascript|csharp|c#|php|code|library|command line)\b/.test(q))return end("informational","developer_integration_review",toolId);
  if(/\b(?:app|apps|apk|software|extension|offline|install|installation|freeware)\b|\bdownload (?:for|free|windows)|\bfree download\b|\busing preview\b/.test(q))return end("informational","desktop_or_app_review",toolId);
  if(!toolId)return end("informational","operation_or_content_review");
  if(conversions.length>1||(/\b(?:and|then)\b/.test(q)&&new Set(operations.map(x=>x[0])).size>1))return end("workflow","multi_step_requires_review",toolId,[...new Set(operations.map(x=>x[0]).concat(conversions.map(m=>`${format(m[1])}-to-${format(m[2])}`)))].sort().join("+"));
  if((toolId==="ocr-pdf"||(toolId==="pdf-to-word"&&/\b(?:scanned|scan|ocr)\b/.test(q)))&&/\b(?:hindi|arabic|chinese|tamil|telugu|bengali|marathi|sanskrit|japanese)\b/.test(q))return end("unsupported","ocr_language_not_supported",toolId);
  if(/\b(?:ai|chatgpt)\b/.test(q))return end("unsupported","ai_processing_not_supported",toolId,"ai");
  if(toolId==="scan-pdf"&&/\bpdf (?:to|into) (?:a )?(?:scan|scanned)\b/.test(q))return end("unsupported","pdf_rasterization_not_supported_by_scan_tool",toolId,"pdf-to-scanned-pdf");
  if(toolId==="scan-pdf"&&/\bpdf a scan\b/.test(q))return end("informational","localization_review",toolId);
  if(toolId==="scan-pdf"&&/\b(?:camera|webcam)\b/.test(q))return end("unsupported","camera_disabled_by_current_policy",toolId,"camera");
  if(toolId==="repair-pdf"&&/\bdeleted\b/.test(q))return end("unsupported","deleted_file_recovery_not_supported",toolId,"deleted-files");
  if(toolId==="merge-pdf"&&/\b(?:2|4|6|8|multiple|several|two|four) pages? (?:into|on|to) (?:1|one|single) page\b/.test(q))return end("unsupported","n_up_page_layout_not_supported",toolId,"n-up");
  const size=q.match(/\b(\d+(?:\.\d+)?)(kb|mb|gb)\b/);
  if(size){const bytes=Math.round(Number(size[1])*({kb:1000,mb:1000000,gb:1000000000}[size[2]]??1));return end("size",CAPABILITY_BY_ID.get(toolId)?.supportsExactTargetSize?"size_candidate":"exact_target_not_supported_by_core_tool",toolId,`${bytes}bytes`,{targetSize:bytes});}
  const platform=q.match(/\b(iphone|ipad|ios|android|macos|mac|macbook|windows|chromebook|linux)\b/);
  if(platform){const p=({macos:"mac",macbook:"mac",ios:"iphone"} as Record<string,string>)[platform[1]]??platform[1];return end(["iphone","ipad","android"].includes(p)?"device":"platform","platform_verification_required",toolId,p);}
  if(toolId==="pdf-to-jpg") {
    if(/\b(?:600|1200|2400)\s*dpi\b/.test(q))return end("unsupported","resolution_not_supported",toolId,"resolution");
    if(extractingImages)return end("use-case","use_case_candidate",toolId,"extract-images");
    if(sourceFormat==="pdf"&&targetFormat==="png")return end("format","supported_format_candidate",toolId,"pdf-to-png",{sourceFormat,targetFormat});
    if(/\b(?:high[- ](?:quality|resolution)|hd(?: quality)?|best quality|300\s*dpi)\b/.test(q))return end("use-case","use_case_candidate",toolId,"high-quality");
  }
  if(toolId==="pdf-to-excel"&&/\bbank statements?\b/.test(q))return end("use-case","use_case_candidate",toolId,"bank-statements");
  if(toolId==="pdf-to-word"&&/\b(?:scanned|scan|ocr)\b/.test(q))return end("use-case","use_case_candidate",toolId,"scanned");
  const useCase=q.match(/\b(?:for|via)\s+(email|e mail|upload|application|applications|gmail|whatsapp|discord|google drive)\b/);
  if(useCase)return end("use-case","use_case_candidate",toolId,useCase[1]==="e mail"?"email":useCase[1].replace(/applications/,"application"));
  if(toolId==="jpg-to-pdf"&&/\bwhatsapp\b/.test(q))return end("use-case","use_case_candidate",toolId,"whatsapp-images");
  if(toolId==="edit-pdf"&&/\b(?:resume|cv)\b/.test(q))return end("use-case","use_case_candidate",toolId,"resume");
  if(toolId==="excel-to-pdf"&&/\blandscape\b/.test(q))return end("use-case","use_case_candidate",toolId,"landscape");
  if (/^(?:what|why|how|can|does|is|where|which)\b/.test(q)||/\b(?:tutorial|meaning|vs|versus|alternative)\b/.test(q))return end("informational","supporting_content_review",toolId);
  // Unknown requirements stay reviewable rather than being misreported as product capability gaps.
  const residual=q.replace(/\b(?:export|transfer|save|saving|turning|switch|put|insert|inserting|adding|docs|documet|presentation|presentations|slide|slides|sheet|sheets|spreadsheet|spreadsheets|web|based|service|use|easy|easily|utility|free|online|best|pdf|pdfa|to|into|in|from|for|with|without|and|as|at|on|converter|convert|converting|converted|conversion|change|changing|turn|make|making|create|creating|file|files|document|documents|format|formats|tool|tools|a|an|the|of|my|your|size|smaller|jpg|jpeg|png|word|docx|powerpoint|pptx|excel|xlsx|xls|html|xml|image|images|photo|photos|picture|pictures|compress|compressing|compression|compressor|reduce|reducing|reducer|shrink|shrinking|merge|marge|merging|combine|combining|combiner|join|joining|joiner|merger|split|splitting|splitter|cutter|separate|separating|remove|delete|deleting|removing|page|pages|extract|organize|organise|organizer|reorder|rearrange|rotate|watermark|crop|fill|fillable|form|forms|repair|recover|fix|corrupted|ocr|searchable|scan|scanned|scanner|edit|editing|editor|editer|annotate|annotation|add|numbers|number|numbering|out|up|together|single|one|two|three|multiple|several|many|different|more|than|2|3|4|5|6|7|8|9|10)\b/g,"").replace(/[.\s]+/g,"");
  const supportingModifiers:Record<string,RegExp>={"compress-pdf":/^(?:decrease|resize|resizer|resizein(?:kb|mb)|mbtokb|inkb|inmb)$/, "delete-pages":/^(?:first|last|blank|individual|1)$/, "merge-pdf":/^(?:all|large|big|1)$/, "split-pdf":/^(?:individual|large|big|by)$/, "extract-pages":/^(?:individual)$/, "repair-pdf":/^(?:damaged|corrupt|broken)$/, "fill-pdf":/^(?:filler|filling|complete|any)$/, "ocr-pdf":/^(?:textrecognition|recognition|apply|readable|textgenerator)$/};
  const supportedResidual=supportingModifiers[toolId]?.test(residual)?"":residual;
  const broadResidual=supportedResidual.replace(/^(?:doc|text|content|ms|microsoft|microsoftoffice|office|convertor|covert|creator|maker|easy|easytouse|service|small|kb|mb|inkb|inmb|kbtomb|mbtokb|editable|extreme|hyper|highquality|cropper|remover|editer)$/," ").trim();
  if(broadResidual)return end("informational","unreviewed_modifier",toolId,residual);
  if(sourceFormat==="png"&&targetFormat==="pdf")return end("format","supported_format_candidate",toolId,"png-to-pdf",{sourceFormat,targetFormat});
  return end("core","owned_by_core_page",toolId,"core");
}
