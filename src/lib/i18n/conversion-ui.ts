import { previewRows } from "./preview-copy";
import type { LocaleCode } from "./locales";
export const CONVERSION_UI_KEYS = ["Ready to convert","Your file is ready","Download PDF again","Download ZIP again","Preparing your files…","Preparing your download…","Building your PDF…","complete","Try Again","One PDF per Word document","Images, tables and visual formatting","Browser-local conversion · nothing is uploaded","Preview updates instantly","No margin","One page per image, in the order shown.","Get one PDF per image in a ZIP file."] as const;
export const CONVERSION_UI_ROWS: Record<Exclude<LocaleCode, "en">, string> = {
  ...previewRows("CONVERSION_UI_ROWS"),
  "es": "Listo para convertir|Tu archivo está listo|Descargar PDF de nuevo|Descargar ZIP de nuevo|Preparando tus archivos…|Preparando la descarga…|Creando tu PDF…|completado|Reintentar|Un PDF por documento Word|Imágenes, tablas y formato visual|Conversión local · no se sube nada|La vista previa se actualiza al instante|Sin margen|Una página por imagen, en el orden mostrado.|Un PDF por imagen en un archivo ZIP.",
  "pt-BR": "Pronto para converter|Seu arquivo está pronto|Baixar PDF novamente|Baixar ZIP novamente|Preparando seus arquivos…|Preparando o download…|Criando seu PDF…|concluído|Tentar novamente|Um PDF por documento Word|Imagens, tabelas e formatação visual|Conversão local · nada é enviado|A prévia é atualizada instantaneamente|Sem margem|Uma página por imagem, na ordem mostrada.|Um PDF por imagem em um arquivo ZIP.",
  "de": "Bereit zur Konvertierung|Ihre Datei ist fertig|PDF erneut herunterladen|ZIP erneut herunterladen|Dateien werden vorbereitet…|Download wird vorbereitet…|PDF wird erstellt…|abgeschlossen|Erneut versuchen|Ein PDF pro Word-Dokument|Bilder, Tabellen und visuelle Formatierung|Lokale Konvertierung · kein Upload|Vorschau wird sofort aktualisiert|Ohne Rand|Eine Seite pro Bild in der angezeigten Reihenfolge.|Ein PDF pro Bild in einer ZIP-Datei.",
  "fr": "Prêt à convertir|Votre fichier est prêt|Télécharger à nouveau le PDF|Télécharger à nouveau le ZIP|Préparation des fichiers…|Préparation du téléchargement…|Création de votre PDF…|terminé|Réessayer|Un PDF par document Word|Images, tableaux et mise en forme|Conversion locale · aucun envoi|L’aperçu se met à jour immédiatement|Sans marge|Une page par image, dans l’ordre affiché.|Un PDF par image dans un fichier ZIP.",
  "hi": "कन्वर्ज़न के लिए तैयार|आपकी फ़ाइल तैयार है|PDF फिर डाउनलोड करें|ZIP फिर डाउनलोड करें|फ़ाइलें तैयार हो रही हैं…|डाउनलोड तैयार हो रहा है…|आपका PDF बन रहा है…|पूरा|फिर कोशिश करें|हर Word दस्तावेज़ के लिए एक PDF|चित्र, टेबल और विज़ुअल फ़ॉर्मेटिंग|डिवाइस पर कन्वर्ज़न · कुछ अपलोड नहीं होता|प्रीव्यू तुरंत अपडेट होता है|बिना मार्जिन|दिखाए गए क्रम में हर चित्र का एक पेज।|हर चित्र का अलग PDF, एक ZIP में।",
  "id": "Siap dikonversi|File Anda siap|Unduh PDF lagi|Unduh ZIP lagi|Menyiapkan file…|Menyiapkan unduhan…|Membuat PDF Anda…|selesai|Coba lagi|Satu PDF per dokumen Word|Gambar, tabel dan format visual|Konversi lokal · tanpa unggahan|Pratinjau langsung diperbarui|Tanpa margin|Satu halaman per gambar, sesuai urutan.|Satu PDF per gambar dalam file ZIP.",
  "zh-CN": "准备转换|文件已准备就绪|再次下载 PDF|再次下载 ZIP|正在准备文件…|正在准备下载…|正在创建 PDF…|完成|重试|每个 Word 文档生成一个 PDF|图片、表格和视觉格式|本地转换 · 无需上传|预览即时更新|无边距|每张图片一页，按显示顺序排列。|每张图片生成一个 PDF，打包为 ZIP。",
  "ja": "変換の準備完了|ファイルの準備ができました|PDF を再ダウンロード|ZIP を再ダウンロード|ファイルを準備中…|ダウンロードを準備中…|PDF を作成中…|完了|再試行|Word 文書ごとに一つの PDF|画像、表、視覚的な書式|端末内で変換 · アップロードなし|プレビューを即時更新|余白なし|表示順に画像一枚につき一ページ。|画像ごとの PDF を ZIP にまとめます。",
  "ko": "변환 준비 완료|파일이 준비되었습니다|PDF 다시 다운로드|ZIP 다시 다운로드|파일 준비 중…|다운로드 준비 중…|PDF 생성 중…|완료|다시 시도|Word 문서당 PDF 하나|이미지, 표 및 시각적 서식|기기 내 변환 · 업로드 없음|미리보기 즉시 업데이트|여백 없음|표시된 순서대로 이미지당 한 페이지.|이미지당 PDF 하나를 ZIP으로 묶습니다.",
  "ar": "جاهز للتحويل|ملفك جاهز|تنزيل PDF مجددًا|تنزيل ZIP مجددًا|جارٍ تجهيز الملفات…|جارٍ تجهيز التنزيل…|جارٍ إنشاء PDF…|مكتمل|حاول مجددًا|PDF واحد لكل مستند Word|الصور والجداول والتنسيق المرئي|تحويل محلي · دون رفع ملفات|تتحدث المعاينة فورًا|دون هامش|صفحة لكل صورة بالترتيب المعروض.|PDF لكل صورة ضمن ملف ZIP.",
  "ru": "Готово к преобразованию|Ваш файл готов|Скачать PDF ещё раз|Скачать ZIP ещё раз|Подготовка файлов…|Подготовка скачивания…|Создание PDF…|завершено|Повторить|Один PDF на документ Word|Изображения, таблицы и оформление|Локальное преобразование · без загрузки|Предпросмотр обновляется сразу|Без полей|Одна страница на изображение в указанном порядке.|Один PDF на изображение в ZIP-архиве."
};
const OCR_NOTICES: Record<LocaleCode, readonly [string, string]> = {
  en: ["OCR reads text; it does not translate. The original language and appearance stay unchanged.", "OCR was unavailable. Original pages and selectable text were kept."],
  es: ["El OCR reconoce texto; no lo traduce. Se conservan el idioma y el aspecto originales.", "El OCR no estaba disponible. Se conservaron las páginas originales y el texto seleccionable."],
  "pt-BR": ["O OCR reconhece texto; não traduz. O idioma e a aparência originais são preservados.", "O OCR estava indisponível. As páginas originais e o texto selecionável foram preservados."],
  de: ["OCR erkennt Text, übersetzt ihn aber nicht. Sprache und Aussehen des Originals bleiben erhalten.", "OCR war nicht verfügbar. Originalseiten und auswählbarer Text wurden beibehalten."],
  fr: ["L’OCR reconnaît le texte sans le traduire. La langue et l’apparence originales sont conservées.", "L’OCR était indisponible. Les pages originales et le texte sélectionnable ont été conservés."],
  hi: ["OCR टेक्स्ट पहचानता है, अनुवाद नहीं करता। मूल भाषा और रूप वही रहते हैं।", "OCR उपलब्ध नहीं था। मूल पेज और चुनने योग्य टेक्स्ट सुरक्षित रखे गए हैं।"],
  id: ["OCR mengenali teks, bukan menerjemahkannya. Bahasa dan tampilan asli tetap dipertahankan.", "OCR tidak tersedia. Halaman asli dan teks yang dapat dipilih tetap dipertahankan."],
  "zh-CN": ["OCR 识别文字，不进行翻译。原始语言和外观保持不变。", "OCR 不可用。已保留原始页面和可选择的文字。"],
  ja: ["OCR は文字を認識しますが、翻訳はしません。元の言語と外観は維持されます。", "OCR を利用できませんでした。元のページと選択可能な文字は保持されています。"],
  ko: ["OCR은 문자를 인식하며 번역하지 않습니다. 원래 언어와 모양이 유지됩니다.", "OCR을 사용할 수 없었습니다. 원본 페이지와 선택 가능한 텍스트는 유지되었습니다."],
  ar: ["يتعرّف OCR على النص ولا يترجمه. تبقى اللغة والمظهر الأصليان دون تغيير.", "لم يكن OCR متاحًا. تم الاحتفاظ بالصفحات الأصلية والنص القابل للتحديد."],
  ru: ["OCR распознаёт текст, но не переводит его. Исходный язык и внешний вид сохраняются.", "OCR был недоступен. Исходные страницы и выделяемый текст сохранены."],
  it: ["L’OCR riconosce il testo, non lo traduce. La lingua e l’aspetto originali restano invariati.", "L’OCR non era disponibile. Le pagine originali e il testo selezionabile sono stati conservati."],
  "zh-TW": ["OCR 辨識文字，不進行翻譯。原始語言和外觀保持不變。", "OCR 無法使用。已保留原始頁面和可選取的文字。"],
  bg: ["OCR разпознава текст, но не го превежда. Оригиналният език и изглед се запазват.", "OCR не беше достъпен. Оригиналните страници и избираемият текст са запазени."],
  ca: ["L’OCR reconeix el text, no el tradueix. Es conserven l’idioma i l’aspecte originals.", "L’OCR no estava disponible. S’han conservat les pàgines originals i el text seleccionable."],
  nl: ["OCR herkent tekst, maar vertaalt deze niet. De oorspronkelijke taal en opmaak blijven behouden.", "OCR was niet beschikbaar. De oorspronkelijke pagina’s en selecteerbare tekst zijn behouden."],
  el: ["Το OCR αναγνωρίζει κείμενο, δεν το μεταφράζει. Η αρχική γλώσσα και εμφάνιση διατηρούνται.", "Το OCR δεν ήταν διαθέσιμο. Οι αρχικές σελίδες και το επιλέξιμο κείμενο διατηρήθηκαν."],
  ms: ["OCR mengenali teks, bukan menterjemahkannya. Bahasa dan rupa asal dikekalkan.", "OCR tidak tersedia. Halaman asal dan teks yang boleh dipilih dikekalkan."],
  pl: ["OCR rozpoznaje tekst, ale go nie tłumaczy. Oryginalny język i wygląd zostają zachowane.", "OCR był niedostępny. Oryginalne strony i tekst możliwy do zaznaczenia zostały zachowane."],
  sv: ["OCR känner igen text men översätter den inte. Ursprungligt språk och utseende bevaras.", "OCR var inte tillgängligt. Originalsidorna och den markerbara texten bevarades."],
  th: ["OCR รู้จำข้อความ แต่ไม่ได้แปลภาษา ภาษาต้นฉบับและรูปลักษณ์ยังคงเดิม", "ไม่สามารถใช้ OCR ได้ ระบบเก็บหน้าต้นฉบับและข้อความที่เลือกได้ไว้แล้ว"],
  tr: ["OCR metni tanır, çeviri yapmaz. Özgün dil ve görünüm korunur.", "OCR kullanılamadı. Özgün sayfalar ve seçilebilir metin korundu."],
  uk: ["OCR розпізнає текст, але не перекладає його. Початкова мова та вигляд зберігаються.", "OCR був недоступний. Початкові сторінки та текст, який можна виділити, збережено."],
  vi: ["OCR nhận dạng văn bản, không dịch. Ngôn ngữ và hình thức gốc được giữ nguyên.", "OCR không khả dụng. Các trang gốc và văn bản có thể chọn đã được giữ lại."],
  sw: ["OCR hutambua maandishi, haitafsiri. Lugha na mwonekano wa asili huhifadhiwa.", "OCR haikupatikana. Kurasa asili na maandishi yanayoweza kuchaguliwa yamehifadhiwa."],
};
const PPTX_NOTES: Record<LocaleCode, readonly [string, string, string]> = {
  en: ["Page images preserve the PDF appearance. Extracted text is saved in speaker notes.", "text entries ·", "in speaker notes"],
  es: ["Las imágenes de página conservan el aspecto del PDF. El texto extraído se guarda en las notas del orador.", "fragmentos de texto ·", "en las notas del orador"],
  "pt-BR": ["As imagens das páginas preservam a aparência do PDF. O texto extraído é salvo nas notas do apresentador.", "trechos de texto ·", "nas notas do apresentador"],
  de: ["Seitenbilder bewahren das Aussehen der PDF. Extrahierter Text wird in den Sprechernotizen gespeichert.", "Texteinträge ·", "in den Sprechernotizen"],
  fr: ["Les images des pages préservent l’apparence du PDF. Le texte extrait est enregistré dans les notes du présentateur.", "fragments de texte ·", "dans les notes du présentateur"],
  hi: ["पेज की तस्वीरें PDF का मूल रूप बनाए रखती हैं। निकाला गया टेक्स्ट स्पीकर नोट्स में सेव होता है।", "टेक्स्ट अंश ·", "स्पीकर नोट्स में"],
  id: ["Gambar halaman mempertahankan tampilan PDF. Teks yang diekstrak disimpan dalam catatan pembicara.", "bagian teks ·", "dalam catatan pembicara"],
  "zh-CN": ["页面图像保留 PDF 的原始外观。提取的文字保存在演讲者备注中。", "段文字 ·", "在演讲者备注中"],
  ja: ["ページ画像で PDF の見た目を保持します。抽出したテキストは発表者ノートに保存されます。", "テキスト項目 ·", "発表者ノート内"],
  ko: ["페이지 이미지가 PDF의 원래 모습을 유지합니다. 추출한 텍스트는 발표자 노트에 저장됩니다.", "텍스트 항목 ·", "발표자 노트에"],
  ar: ["تحافظ صور الصفحات على مظهر PDF الأصلي. يُحفظ النص المستخرج في ملاحظات المتحدث.", "مقاطع نصية ·", "في ملاحظات المتحدث"],
  ru: ["Изображения страниц сохраняют внешний вид PDF. Извлечённый текст сохраняется в заметках докладчика.", "текстовых фрагментов ·", "в заметках докладчика"],
  it: ["Le immagini delle pagine preservano l’aspetto del PDF. Il testo estratto viene salvato nelle note del relatore.", "frammenti di testo ·", "nelle note del relatore"],
  "zh-TW": ["頁面影像保留 PDF 的原始外觀。擷取的文字儲存在演講者備忘稿中。", "段文字 ·", "在演講者備忘稿中"],
  bg: ["Изображенията на страниците запазват вида на PDF. Извлеченият текст се записва в бележките на говорителя.", "текстови фрагменти ·", "в бележките на говорителя"],
  ca: ["Les imatges de les pàgines conserven l’aspecte del PDF. El text extret es desa a les notes del presentador.", "fragments de text ·", "a les notes del presentador"],
  nl: ["Pagina-afbeeldingen behouden de weergave van de PDF. Geëxtraheerde tekst wordt opgeslagen in de sprekersnotities.", "tekstfragmenten ·", "in de sprekersnotities"],
  el: ["Οι εικόνες των σελίδων διατηρούν την εμφάνιση του PDF. Το εξαγόμενο κείμενο αποθηκεύεται στις σημειώσεις ομιλητή.", "τμήματα κειμένου ·", "στις σημειώσεις ομιλητή"],
  ms: ["Imej halaman mengekalkan rupa PDF. Teks yang diekstrak disimpan dalam nota pembentang.", "bahagian teks ·", "dalam nota pembentang"],
  pl: ["Obrazy stron zachowują wygląd pliku PDF. Wyodrębniony tekst jest zapisywany w notatkach prelegenta.", "fragmentów tekstu ·", "w notatkach prelegenta"],
  sv: ["Sidbilder bevarar PDF-filens utseende. Extraherad text sparas i talaranteckningar.", "textavsnitt ·", "i talaranteckningar"],
  th: ["ภาพแต่ละหน้าคงรูปลักษณ์เดิมของ PDF ข้อความที่ดึงออกมาจะบันทึกไว้ในบันทึกย่อของผู้บรรยาย", "ส่วนข้อความ ·", "ในบันทึกย่อของผู้บรรยาย"],
  tr: ["Sayfa görüntüleri PDF’nin görünümünü korur. Çıkarılan metin konuşmacı notlarına kaydedilir.", "metin parçası ·", "konuşmacı notlarında"],
  uk: ["Зображення сторінок зберігають вигляд PDF. Видобутий текст зберігається в нотатках доповідача.", "текстових фрагментів ·", "у нотатках доповідача"],
  vi: ["Hình ảnh trang giữ nguyên hình thức của PDF. Văn bản trích xuất được lưu trong ghi chú của người thuyết trình.", "đoạn văn bản ·", "trong ghi chú của người thuyết trình"],
  sw: ["Picha za kurasa huhifadhi mwonekano wa PDF. Maandishi yaliyotolewa huhifadhiwa katika madokezo ya mwasilishaji.", "vipande vya maandishi ·", "katika madokezo ya mwasilishaji"],
};
export function conversionUiText(locale: LocaleCode, text: string) {
  const notes = PPTX_NOTES.en.indexOf(text);
  if (notes >= 0) return PPTX_NOTES[locale][notes];
  const notice = OCR_NOTICES.en.indexOf(text);
  if (notice >= 0) return OCR_NOTICES[locale][notice];
  const index = (CONVERSION_UI_KEYS as readonly string[]).indexOf(text);
  return locale === "en" || index < 0 ? text : CONVERSION_UI_ROWS[locale].split("|")[index];
}
