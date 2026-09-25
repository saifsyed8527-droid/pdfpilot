import type { LocaleCode } from "./locales";

export const CONVERSION_TOOL_SLUGS = ["jpg-to-pdf", "word-to-pdf", "powerpoint-to-pdf"] as const;
export type ConversionToolSlug = typeof CONVERSION_TOOL_SLUGS[number];
export function isConversionTool(slug: string): slug is ConversionToolSlug {
  return (CONVERSION_TOOL_SLUGS as readonly string[]).includes(slug);
}
// Product facts, not promises of native Office fidelity. No document translation.
export const CONVERSION_COPY: Record<LocaleCode, readonly string[]> = {
  "en": [
    "Convert JPG and PNG images to PDF in your browser. Reorder, rotate and choose A4, US Letter or image-sized pages.",
    "Convert DOCX to PDF locally with embedded images, tables and supported links. Preview the image-based pages before sharing.",
    "Convert PPTX to PDF locally with slide dimensions, vector drawings, embedded pictures and text. No document upload.",
    "JPG and PNG only. Image text stays an image; conversion does not add OCR. Check orientation, margins and page order before sharing.",
    "PDF pages are images: text is not selectable or searchable. Fonts and page breaks may differ from Word. Unsupported media or artwork requires export from the original editor. Up to 200 pages; 100 MB per file.",
    "Fonts may be substituted and text wrapping can differ. Charts, SmartArt and other unsupported content stop conversion with an error. Use PowerPoint’s PDF export when exact appearance is required. PPTX only; 100 MB per file.",
    "How to convert",
    "Check before sharing",
    "Conversion workflows (English)",
    "Choose supported files from your device.",
    "Check the order, rotation and available options.",
    "Convert, download and review the result before sharing."
  ],
  "es": [
    "Convierte imágenes JPG y PNG a PDF en tu navegador. Reordena, gira y elige páginas A4, Carta o del tamaño de la imagen.",
    "Convierte DOCX a PDF localmente con imágenes incrustadas, tablas y enlaces compatibles. Revisa las páginas basadas en imágenes antes de compartir.",
    "Convierte PPTX a PDF localmente con dimensiones de diapositiva, dibujos vectoriales, imágenes incrustadas y texto. Sin subir documentos.",
    "Solo JPG y PNG. El texto de las imágenes sigue siendo una imagen; no se aplica OCR. Comprueba la orientación, los márgenes y el orden.",
    "Las páginas PDF son imágenes: el texto no se puede seleccionar ni buscar. Las fuentes y los saltos de página pueden variar respecto a Word. Exporta desde el editor original si contiene elementos no compatibles. Hasta 200 páginas; 100 MB por archivo.",
    "Las fuentes pueden sustituirse y los saltos de línea variar. Los gráficos, SmartArt y otros contenidos no compatibles detienen la conversión con un error. Para un aspecto exacto, exporta a PDF desde PowerPoint. Solo PPTX; 100 MB por archivo.",
    "Cómo convertir",
    "Comprueba antes de compartir",
    "Guías de conversión (inglés)",
    "Elige archivos compatibles de tu dispositivo.",
    "Comprueba el orden, la rotación y las opciones disponibles.",
    "Convierte, descarga y revisa el resultado antes de compartir."
  ],
  "pt-BR": [
    "Converta imagens JPG e PNG em PDF no navegador. Reordene, gire e escolha páginas A4, Carta ou do tamanho da imagem.",
    "Converta DOCX em PDF localmente com imagens incorporadas, tabelas e links compatíveis. Confira as páginas baseadas em imagens antes de compartilhar.",
    "Converta PPTX em PDF localmente com dimensões dos slides, desenhos vetoriais, imagens incorporadas e texto. Sem enviar documentos.",
    "Apenas JPG e PNG. O texto das imagens continua como imagem; a conversão não aplica OCR. Confira orientação, margens e ordem das páginas.",
    "As páginas PDF são imagens: o texto não pode ser selecionado nem pesquisado. Fontes e quebras de página podem diferir do Word. Conteúdo não compatível exige exportação pelo editor original. Até 200 páginas; 100 MB por arquivo.",
    "As fontes podem ser substituídas e as quebras de linha podem variar. Gráficos, SmartArt e outros conteúdos não compatíveis interrompem a conversão com um erro. Para aparência exata, exporte o PDF pelo PowerPoint. Apenas PPTX; 100 MB por arquivo.",
    "Como converter",
    "Confira antes de compartilhar",
    "Guias de conversão (inglês)",
    "Escolha arquivos compatíveis no seu dispositivo.",
    "Confira a ordem, a rotação e as opções disponíveis.",
    "Converta, baixe e confira o resultado antes de compartilhar."
  ],
  "de": [
    "Wandeln Sie JPG- und PNG-Bilder im Browser in PDF um. Sortieren, drehen und wählen Sie A4, US Letter oder bildgroße Seiten.",
    "Wandeln Sie DOCX lokal mit eingebetteten Bildern, Tabellen und unterstützten Links in PDF um. Prüfen Sie die bildbasierten Seiten vor dem Teilen.",
    "Wandeln Sie PPTX lokal mit Folienmaßen, Vektorzeichnungen, eingebetteten Bildern und Text in PDF um. Kein Dokument-Upload.",
    "Nur JPG und PNG. Bildtext bleibt ein Bild; es erfolgt keine OCR. Prüfen Sie Ausrichtung, Ränder und Seitenreihenfolge.",
    "PDF-Seiten sind Bilder: Text ist nicht auswählbar oder durchsuchbar. Schriften und Seitenumbrüche können von Word abweichen. Nicht unterstützte Inhalte erfordern den Export im ursprünglichen Editor. Bis zu 200 Seiten; 100 MB pro Datei.",
    "Schriften können ersetzt werden und Zeilenumbrüche abweichen. Diagramme, SmartArt und andere nicht unterstützte Inhalte stoppen die Konvertierung mit einer Fehlermeldung. Für exaktes Aussehen nutzen Sie den PDF-Export von PowerPoint. Nur PPTX; 100 MB pro Datei.",
    "So konvertieren Sie",
    "Vor dem Teilen prüfen",
    "Konvertierungsanleitungen (Englisch)",
    "Wählen Sie unterstützte Dateien auf Ihrem Gerät.",
    "Prüfen Sie Reihenfolge, Drehung und verfügbare Optionen.",
    "Konvertieren, herunterladen und das Ergebnis vor dem Teilen prüfen."
  ],
  "fr": [
    "Convertissez des images JPG et PNG en PDF dans votre navigateur. Réorganisez, pivotez et choisissez A4, Lettre US ou la taille de l’image.",
    "Convertissez DOCX en PDF localement avec images intégrées, tableaux et liens compatibles. Vérifiez les pages sous forme d’images avant le partage.",
    "Convertissez PPTX en PDF localement avec dimensions des diapositives, dessins vectoriels, images intégrées et texte. Aucun envoi de document.",
    "JPG et PNG uniquement. Le texte des images reste une image ; aucune reconnaissance OCR n’est effectuée. Vérifiez orientation, marges et ordre.",
    "Les pages PDF sont des images : le texte n’est ni sélectionnable ni consultable par recherche. Polices et sauts de page peuvent différer de Word. Les éléments non pris en charge nécessitent un export depuis l’éditeur d’origine. Jusqu’à 200 pages ; 100 Mo par fichier.",
    "Les polices peuvent être remplacées et les retours à la ligne varier. Graphiques, SmartArt et autres contenus non pris en charge interrompent la conversion avec une erreur. Pour un rendu exact, exportez en PDF depuis PowerPoint. PPTX uniquement ; 100 Mo par fichier.",
    "Comment convertir",
    "Vérifier avant de partager",
    "Guides de conversion (anglais)",
    "Choisissez des fichiers compatibles sur votre appareil.",
    "Vérifiez l’ordre, la rotation et les options disponibles.",
    "Convertissez, téléchargez et vérifiez le résultat avant de partager."
  ],
  "hi": [
    "ब्राउज़र में JPG और PNG को PDF में बदलें। क्रम और दिशा बदलें तथा A4, US Letter या चित्र के आकार वाले पेज चुनें।",
    "एम्बेडेड चित्रों, टेबल और समर्थित लिंक के साथ DOCX को अपने डिवाइस पर PDF में बदलें। शेयर करने से पहले चित्र-आधारित पेज जाँचें।",
    "स्लाइड के आकार, वेक्टर ड्रॉइंग, एम्बेडेड चित्रों और टेक्स्ट के साथ PPTX को डिवाइस पर PDF में बदलें। दस्तावेज़ अपलोड नहीं होता।",
    "केवल JPG और PNG। चित्र का टेक्स्ट चित्र ही रहता है; OCR नहीं होता। शेयर करने से पहले दिशा, मार्जिन और पेजों का क्रम जाँचें।",
    "PDF पेज चित्र होते हैं: टेक्स्ट चुन या खोज नहीं सकते। फ़ॉन्ट और पेज ब्रेक Word से अलग हो सकते हैं। असमर्थित मीडिया या आर्टवर्क के लिए मूल एडिटर से PDF निकालें। अधिकतम 200 पेज; प्रति फ़ाइल 100 MB।",
    "फ़ॉन्ट बदले जा सकते हैं और टेक्स्ट की लाइनें अलग हो सकती हैं। चार्ट, SmartArt या असमर्थित सामग्री होने पर कन्वर्ज़न त्रुटि दिखाकर रुकता है। बिल्कुल वही रूप चाहिए तो PowerPoint से PDF एक्सपोर्ट करें। केवल PPTX; प्रति फ़ाइल 100 MB।",
    "PDF कैसे बनाएँ",
    "शेयर करने से पहले जाँचें",
    "कन्वर्ज़न गाइड (अंग्रेज़ी)",
    "अपने डिवाइस से समर्थित फ़ाइलें चुनें।",
    "क्रम, दिशा और उपलब्ध विकल्प जाँचें।",
    "कन्वर्ट करें, डाउनलोड करें और शेयर करने से पहले परिणाम जाँचें।"
  ],
  "id": [
    "Ubah gambar JPG dan PNG menjadi PDF di browser. Urutkan, putar dan pilih A4, US Letter atau ukuran gambar.",
    "Ubah DOCX menjadi PDF secara lokal dengan gambar tertanam, tabel dan tautan yang didukung. Periksa halaman berbasis gambar sebelum dibagikan.",
    "Ubah PPTX menjadi PDF secara lokal dengan ukuran slide, gambar vektor, gambar tertanam dan teks. Tanpa mengunggah dokumen.",
    "Hanya JPG dan PNG. Teks gambar tetap berupa gambar; konversi tidak menjalankan OCR. Periksa orientasi, margin dan urutan halaman.",
    "Halaman PDF berupa gambar: teks tidak dapat dipilih atau dicari. Font dan pemisah halaman dapat berbeda dari Word. Konten yang tidak didukung perlu diekspor dari editor asal. Maksimal 200 halaman; 100 MB per file.",
    "Font dapat diganti dan pergantian baris dapat berbeda. Grafik, SmartArt dan konten lain yang tidak didukung menghentikan konversi dengan pesan kesalahan. Untuk tampilan persis, gunakan ekspor PDF PowerPoint. Hanya PPTX; 100 MB per file.",
    "Cara mengonversi",
    "Periksa sebelum berbagi",
    "Panduan konversi (Inggris)",
    "Pilih file yang didukung dari perangkat Anda.",
    "Periksa urutan, rotasi dan opsi yang tersedia.",
    "Konversi, unduh dan periksa hasil sebelum dibagikan."
  ],
  "zh-CN": [
    "在浏览器中将 JPG 和 PNG 图片转换为 PDF。调整顺序、旋转，并选择 A4、US Letter 或与图片相同大小的页面。",
    "在本地将 DOCX 转换为 PDF，包含嵌入图片、表格和支持的链接。分享前请检查图像格式的页面。",
    "在本地将 PPTX 转换为 PDF，保留幻灯片尺寸、矢量图形、嵌入图片和文字。无需上传文档。",
    "仅支持 JPG 和 PNG。图片中的文字仍是图像，不会进行 OCR。请检查方向、边距和页面顺序。",
    "PDF 页面为图像，文字不可选中或搜索。字体和分页可能与 Word 不同。不支持的媒体或图形需从原编辑器导出。最多 200 页，每个文件最大 100 MB。",
    "字体可能被替换，换行可能不同。图表、SmartArt 等不支持的内容会使转换停止并提示错误。需要完全一致的外观时，请使用 PowerPoint 的 PDF 导出。仅支持 PPTX，每个文件最大 100 MB。",
    "转换方法",
    "分享前检查",
    "转换指南（英语）",
    "从设备中选择支持的文件。",
    "检查顺序、旋转和可用选项。",
    "转换、下载，并在分享前检查结果。"
  ],
  "ja": [
    "ブラウザで JPG・PNG 画像を PDF に変換。並べ替え、回転、A4・US Letter・画像サイズのページを選べます。",
    "埋め込み画像、表、対応するリンクを含む DOCX を端末内で PDF に変換。共有前に画像形式のページを確認してください。",
    "スライドの寸法、ベクター図形、埋め込み画像、文字を含む PPTX を端末内で PDF に変換。文書のアップロードは不要です。",
    "JPG と PNG のみ対応。画像内の文字は画像のままで、OCR は行いません。向き、余白、ページ順を確認してください。",
    "PDF ページは画像のため文字の選択・検索はできません。フォントや改ページが Word と異なる場合があります。非対応のメディアや図形は元の編集ソフトから書き出してください。最大 200 ページ、1 ファイル 100 MB。",
    "フォントが置換され、改行が異なる場合があります。グラフ、SmartArt など非対応の内容があるとエラーで変換を停止します。正確な見た目が必要な場合は PowerPoint の PDF 書き出しを使用してください。PPTX のみ、1 ファイル 100 MB。",
    "変換の手順",
    "共有前に確認",
    "変換ガイド（英語）",
    "端末から対応するファイルを選びます。",
    "順序、回転、利用できる設定を確認します。",
    "変換してダウンロードし、共有前に結果を確認します。"
  ],
  "ko": [
    "브라우저에서 JPG와 PNG 이미지를 PDF로 변환하세요. 순서와 회전을 조정하고 A4, US Letter 또는 이미지 크기 페이지를 선택하세요.",
    "포함된 이미지, 표 및 지원되는 링크와 함께 DOCX를 기기에서 PDF로 변환하세요. 공유 전에 이미지 기반 페이지를 확인하세요.",
    "슬라이드 크기, 벡터 도형, 포함된 이미지와 텍스트가 있는 PPTX를 기기에서 PDF로 변환하세요. 문서를 업로드하지 않습니다.",
    "JPG와 PNG만 지원합니다. 이미지의 텍스트는 이미지로 유지되며 OCR을 수행하지 않습니다. 방향, 여백, 페이지 순서를 확인하세요.",
    "PDF 페이지는 이미지이므로 텍스트를 선택하거나 검색할 수 없습니다. 글꼴과 페이지 나누기가 Word와 다를 수 있습니다. 지원되지 않는 미디어나 도형은 원래 편집기에서 내보내세요. 최대 200페이지, 파일당 100 MB.",
    "글꼴이 대체되거나 줄 바꿈이 달라질 수 있습니다. 차트, SmartArt 등 지원되지 않는 내용은 오류와 함께 변환을 중지합니다. 정확한 모양이 필요하면 PowerPoint에서 PDF로 내보내세요. PPTX만 지원, 파일당 100 MB.",
    "변환 방법",
    "공유 전 확인",
    "변환 가이드 (영어)",
    "기기에서 지원되는 파일을 선택하세요.",
    "순서, 회전 및 사용 가능한 옵션을 확인하세요.",
    "변환하고 다운로드한 후 공유 전에 결과를 확인하세요."
  ],
  "ar": [
    "حوّل صور JPG وPNG إلى PDF في المتصفح. رتّب الصور ودوّرها واختر A4 أو US Letter أو حجم الصورة للصفحات.",
    "حوّل DOCX محليًا إلى PDF مع الصور المضمّنة والجداول والروابط المدعومة. راجع الصفحات المصوّرة قبل المشاركة.",
    "حوّل PPTX محليًا إلى PDF مع أبعاد الشرائح والرسومات المتجهية والصور المضمّنة والنص. دون رفع المستند.",
    "يدعم JPG وPNG فقط. يبقى نص الصور صورة؛ لا يتم تطبيق OCR. راجع الاتجاه والهوامش وترتيب الصفحات.",
    "صفحات PDF صور، لذا لا يمكن تحديد النص أو البحث فيه. قد تختلف الخطوط وفواصل الصفحات عن Word. يتطلب المحتوى غير المدعوم التصدير من المحرر الأصلي. حتى 200 صفحة؛ 100 ميغابايت لكل ملف.",
    "قد تُستبدل الخطوط وتختلف فواصل الأسطر. توقف المخططات وSmartArt والمحتويات غير المدعومة التحويل مع ظهور خطأ. للمظهر المطابق استخدم تصدير PDF في PowerPoint. يدعم PPTX فقط؛ 100 ميغابايت لكل ملف.",
    "طريقة التحويل",
    "راجع قبل المشاركة",
    "أدلة التحويل (بالإنجليزية)",
    "اختر ملفات مدعومة من جهازك.",
    "راجع الترتيب والتدوير والخيارات المتاحة.",
    "حوّل الملف ونزّله وراجع النتيجة قبل المشاركة."
  ],
  "ru": [
    "Преобразуйте JPG и PNG в PDF в браузере. Меняйте порядок, поворот и выбирайте A4, US Letter или размер изображения.",
    "Преобразуйте DOCX в PDF локально со встроенными изображениями, таблицами и поддерживаемыми ссылками. Проверьте страницы-изображения перед отправкой.",
    "Преобразуйте PPTX в PDF локально с размерами слайдов, векторными рисунками, встроенными изображениями и текстом. Без загрузки документа на сервер.",
    "Только JPG и PNG. Текст на изображении остаётся изображением; OCR не выполняется. Проверьте ориентацию, поля и порядок страниц.",
    "Страницы PDF являются изображениями: текст нельзя выделить или найти поиском. Шрифты и разрывы страниц могут отличаться от Word. Неподдерживаемое содержимое нужно экспортировать из исходного редактора. До 200 страниц; 100 МБ на файл.",
    "Шрифты могут заменяться, а переносы строк отличаться. Диаграммы, SmartArt и другое неподдерживаемое содержимое останавливают преобразование с ошибкой. Для точного вида используйте экспорт PDF в PowerPoint. Только PPTX; 100 МБ на файл.",
    "Как преобразовать",
    "Проверьте перед отправкой",
    "Руководства по конвертации (английский)",
    "Выберите поддерживаемые файлы на устройстве.",
    "Проверьте порядок, поворот и доступные параметры.",
    "Преобразуйте, скачайте и проверьте результат перед отправкой."
  ]
};
export function conversionCopy(locale: LocaleCode, slug: ConversionToolSlug) {
  const row = CONVERSION_COPY[locale];
  const index = CONVERSION_TOOL_SLUGS.indexOf(slug);
  return { description: row[index], limitations: row[index + 3], how: row[6], check: row[7], workflows: row[8], steps: row.slice(9,12) };
}
