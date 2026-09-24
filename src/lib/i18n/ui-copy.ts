import type { LocaleCode } from "./locales";
import { LAUNCH_TOOL_SLUGS } from "../launch-catalog";
import { homeText } from "./home-copy";
import { CORE_COPY } from "./core-content";
import { workspaceText } from "./workspace-copy";

// Explicit, reviewed UI copy only. Never send uploaded documents to a translator.
const TOOL_NAMES: Record<LocaleCode, string> = {
  en: "PDF to JPG|JPG to PDF|Word to PDF|PowerPoint to PDF|Excel to PDF|HTML to PDF|PDF to Word|PDF to PowerPoint|PDF to Excel|PDF to PDF/A|Remove PDF Pages|Merge PDF|Compress PDF|Split PDF|Extract Pages|Organize PDF|Scan to PDF|Repair PDF|OCR PDF|Rotate PDF|Add Page Numbers|Watermark PDF|Crop PDF|PDF Editor|PDF Forms|Excel to XML",
  es: "PDF a JPG|JPG a PDF|Word a PDF|PowerPoint a PDF|Excel a PDF|HTML a PDF|PDF a Word|PDF a PowerPoint|PDF a Excel|PDF a PDF/A|Eliminar páginas PDF|Unir PDF|Comprimir PDF|Dividir PDF|Extraer páginas|Organizar PDF|Escanear a PDF|Reparar PDF|OCR PDF|Rotar PDF|Añadir números de página|Añadir marca de agua|Recortar PDF|Editor de PDF|Formularios PDF|Excel a XML",
  "pt-BR": "PDF para JPG|JPG para PDF|Word para PDF|PowerPoint para PDF|Excel para PDF|HTML para PDF|PDF para Word|PDF para PowerPoint|PDF para Excel|PDF para PDF/A|Remover páginas do PDF|Juntar PDF|Comprimir PDF|Dividir PDF|Extrair páginas|Organizar PDF|Digitalizar para PDF|Reparar PDF|OCR PDF|Girar PDF|Adicionar números de página|Marca d’água no PDF|Recortar PDF|Editor de PDF|Formulários PDF|Excel para XML",
  de: "PDF in JPG|JPG in PDF|Word in PDF|PowerPoint in PDF|Excel in PDF|HTML in PDF|PDF in Word|PDF in PowerPoint|PDF in Excel|PDF in PDF/A|PDF-Seiten entfernen|PDF zusammenfügen|PDF komprimieren|PDF teilen|Seiten extrahieren|PDF organisieren|Scannen in PDF|PDF reparieren|PDF-Texterkennung|PDF drehen|Seitenzahlen hinzufügen|PDF mit Wasserzeichen|PDF zuschneiden|PDF-Editor|PDF-Formulare|Excel in XML",
  fr: "PDF en JPG|JPG en PDF|Word en PDF|PowerPoint en PDF|Excel en PDF|HTML en PDF|PDF en Word|PDF en PowerPoint|PDF en Excel|PDF en PDF/A|Supprimer des pages PDF|Fusionner PDF|Compresser PDF|Diviser PDF|Extraire des pages|Organiser PDF|Numériser en PDF|Réparer PDF|OCR PDF|Pivoter PDF|Numéroter les pages|Ajouter un filigrane|Recadrer PDF|Éditeur PDF|Formulaires PDF|Excel en XML",
  hi: "PDF से JPG|JPG से PDF|Word से PDF|PowerPoint से PDF|Excel से PDF|HTML से PDF|PDF से Word|PDF से PowerPoint|PDF से Excel|PDF से PDF/A|PDF के पेज हटाएँ|PDF जोड़ें|PDF कंप्रेस करें|PDF बाँटें|पेज निकालें|PDF व्यवस्थित करें|स्कैन से PDF|PDF सुधारें|PDF में टेक्स्ट पहचानें|PDF घुमाएँ|पेज नंबर जोड़ें|PDF में वॉटरमार्क|PDF क्रॉप करें|PDF एडिटर|PDF फ़ॉर्म|Excel से XML",
  id: "PDF ke JPG|JPG ke PDF|Word ke PDF|PowerPoint ke PDF|Excel ke PDF|HTML ke PDF|PDF ke Word|PDF ke PowerPoint|PDF ke Excel|PDF ke PDF/A|Hapus halaman PDF|Gabungkan PDF|Kompres PDF|Pisahkan PDF|Ekstrak halaman|Atur PDF|Pindai ke PDF|Perbaiki PDF|OCR PDF|Putar PDF|Tambahkan nomor halaman|Tanda air PDF|Pangkas PDF|Editor PDF|Formulir PDF|Excel ke XML",
  "zh-CN": "PDF 转 JPG|JPG 转 PDF|Word 转 PDF|PowerPoint 转 PDF|Excel 转 PDF|HTML 转 PDF|PDF 转 Word|PDF 转 PowerPoint|PDF 转 Excel|PDF 转 PDF/A|删除 PDF 页面|合并 PDF|压缩 PDF|拆分 PDF|提取页面|整理 PDF|扫描为 PDF|修复 PDF|PDF 文字识别|旋转 PDF|添加页码|添加 PDF 水印|裁剪 PDF|PDF 编辑器|PDF 表单|Excel 转 XML",
  ja: "PDF を JPG に変換|JPG を PDF に変換|Word を PDF に変換|PowerPoint を PDF に変換|Excel を PDF に変換|HTML を PDF に変換|PDF を Word に変換|PDF を PowerPoint に変換|PDF を Excel に変換|PDF を PDF/A に変換|PDF のページを削除|PDF を結合|PDF を圧縮|PDF を分割|ページを抽出|PDF を整理|スキャンして PDF に変換|PDF を修復|PDF の文字認識|PDF を回転|ページ番号を追加|PDF に透かしを追加|PDF をトリミング|PDF エディター|PDF フォーム|Excel を XML に変換",
  ko: "PDF를 JPG로|JPG를 PDF로|Word를 PDF로|PowerPoint를 PDF로|Excel을 PDF로|HTML을 PDF로|PDF를 Word로|PDF를 PowerPoint로|PDF를 Excel로|PDF를 PDF/A로|PDF 페이지 삭제|PDF 병합|PDF 압축|PDF 분할|페이지 추출|PDF 정리|PDF로 스캔|PDF 복구|PDF 문자 인식|PDF 회전|페이지 번호 추가|PDF 워터마크|PDF 자르기|PDF 편집기|PDF 양식|Excel을 XML로",
  ar: "PDF إلى JPG|JPG إلى PDF|Word إلى PDF|PowerPoint إلى PDF|Excel إلى PDF|HTML إلى PDF|PDF إلى Word|PDF إلى PowerPoint|PDF إلى Excel|PDF إلى PDF/A|حذف صفحات PDF|دمج PDF|ضغط PDF|تقسيم PDF|استخراج الصفحات|تنظيم PDF|المسح إلى PDF|إصلاح PDF|التعرف على نص PDF|تدوير PDF|إضافة أرقام الصفحات|إضافة علامة مائية|قص PDF|محرر PDF|نماذج PDF|Excel إلى XML",
  ru: "PDF в JPG|JPG в PDF|Word в PDF|PowerPoint в PDF|Excel в PDF|HTML в PDF|PDF в Word|PDF в PowerPoint|PDF в Excel|PDF в PDF/A|Удалить страницы PDF|Объединить PDF|Сжать PDF|Разделить PDF|Извлечь страницы|Упорядочить PDF|Сканировать в PDF|Восстановить PDF|Распознать текст PDF|Повернуть PDF|Добавить номера страниц|Водяной знак PDF|Обрезать PDF|Редактор PDF|Формы PDF|Excel в XML",
};

const UI_KEYS = ["Convert to PDF", "Convert from PDF", "Organize PDF", "Optimize & scan", "Edit PDF", "Spreadsheet tools", "All Tools", "Convert PDF", "Guides", "About", "Back to Home", "Search tools", "All", "Optimize PDF", "Recent", "Clear", "Download", "Cancel", "Remove", "Add files", "Processing", "Select Word files", "Select PowerPoint files", "Select Excel files", "Add HTML", "Select files", "Drop files here", "Up to 100MB per file", "Continue with your PDF", "Popular Tools", "Categories", "Resources", "Company", "Legal", "Privacy Policy", "Terms of Service", "All Categories", "Browse all categories →", "See all conversions →"] as const;
export type UiKey = typeof UI_KEYS[number];
const UI_ROWS: Record<Exclude<LocaleCode, "en">, string> = {
  es: "Convertir a PDF|Convertir desde PDF|Organizar PDF|Optimizar y escanear|Editar PDF|Hojas de cálculo|Todas las herramientas|Convertir PDF|Guías|Acerca de|Volver al inicio|Buscar herramientas|Todo|Optimizar PDF|Recientes|Borrar|Descargar|Cancelar|Eliminar|Añadir archivos|Procesando|Seleccionar archivos Word|Seleccionar archivos PowerPoint|Seleccionar archivos Excel|Añadir HTML|Seleccionar archivos|Suelta los archivos aquí|Hasta 100 MB por archivo|Continúa con tu PDF|Herramientas populares|Categorías|Recursos|Empresa|Información legal|Política de privacidad|Términos del servicio|Todas las categorías|Ver todas las categorías →|Ver todas las conversiones →",
  "pt-BR": "Converter para PDF|Converter de PDF|Organizar PDF|Otimizar e digitalizar|Editar PDF|Planilhas|Todas as ferramentas|Converter PDF|Guias|Sobre|Voltar ao início|Buscar ferramentas|Todos|Otimizar PDF|Recentes|Limpar|Baixar|Cancelar|Remover|Adicionar arquivos|Processando|Selecionar arquivos Word|Selecionar arquivos PowerPoint|Selecionar arquivos Excel|Adicionar HTML|Selecionar arquivos|Solte os arquivos aqui|Até 100 MB por arquivo|Continue com seu PDF|Ferramentas populares|Categorias|Recursos|Empresa|Informações legais|Política de privacidade|Termos de serviço|Todas as categorias|Ver todas as categorias →|Ver todas as conversões →",
  de: "In PDF umwandeln|Aus PDF umwandeln|PDF organisieren|Optimieren und scannen|PDF bearbeiten|Tabellenwerkzeuge|Alle Tools|PDF konvertieren|Anleitungen|Über uns|Zur Startseite|Tools suchen|Alle|PDF optimieren|Zuletzt gesucht|Löschen|Herunterladen|Abbrechen|Entfernen|Dateien hinzufügen|Verarbeitung|Word-Dateien auswählen|PowerPoint-Dateien auswählen|Excel-Dateien auswählen|HTML hinzufügen|Dateien auswählen|Dateien hier ablegen|Bis zu 100 MB pro Datei|Mit Ihrem PDF fortfahren|Beliebte Tools|Kategorien|Ressourcen|Unternehmen|Rechtliches|Datenschutzerklärung|Nutzungsbedingungen|Alle Kategorien|Alle Kategorien ansehen →|Alle Konvertierungen ansehen →",
  fr: "Convertir en PDF|Convertir depuis PDF|Organiser PDF|Optimiser et numériser|Modifier PDF|Outils de tableur|Tous les outils|Convertir PDF|Guides|À propos|Retour à l’accueil|Rechercher des outils|Tous|Optimiser PDF|Récentes|Effacer|Télécharger|Annuler|Supprimer|Ajouter des fichiers|Traitement|Sélectionner des fichiers Word|Sélectionner des fichiers PowerPoint|Sélectionner des fichiers Excel|Ajouter du HTML|Sélectionner des fichiers|Déposez les fichiers ici|Jusqu’à 100 Mo par fichier|Continuer avec votre PDF|Outils populaires|Catégories|Ressources|Entreprise|Mentions légales|Politique de confidentialité|Conditions d’utilisation|Toutes les catégories|Voir toutes les catégories →|Voir toutes les conversions →",
  hi: "PDF में बदलें|PDF से बदलें|PDF व्यवस्थित करें|सुधारें और स्कैन करें|PDF एडिट करें|स्प्रेडशीट टूल|सभी टूल|PDF बदलें|गाइड|हमारे बारे में|होम पर लौटें|टूल खोजें|सभी|PDF अनुकूलित करें|हाल की खोज|साफ करें|डाउनलोड करें|रद्द करें|हटाएँ|फ़ाइलें जोड़ें|प्रोसेस हो रहा है|Word फ़ाइलें चुनें|PowerPoint फ़ाइलें चुनें|Excel फ़ाइलें चुनें|HTML जोड़ें|फ़ाइलें चुनें|फ़ाइलें यहाँ छोड़ें|प्रति फ़ाइल 100 MB तक|अपने PDF पर आगे काम करें|लोकप्रिय टूल|श्रेणियाँ|संसाधन|कंपनी|कानूनी जानकारी|गोपनीयता नीति|सेवा की शर्तें|सभी श्रेणियाँ|सभी श्रेणियाँ देखें →|सभी कन्वर्ज़न देखें →",
  id: "Konversi ke PDF|Konversi dari PDF|Atur PDF|Optimalkan dan pindai|Edit PDF|Alat spreadsheet|Semua alat|Konversi PDF|Panduan|Tentang|Kembali ke beranda|Cari alat|Semua|Optimalkan PDF|Terbaru|Hapus|Unduh|Batal|Hapus|Tambah file|Memproses|Pilih file Word|Pilih file PowerPoint|Pilih file Excel|Tambah HTML|Pilih file|Letakkan file di sini|Hingga 100 MB per file|Lanjutkan dengan PDF Anda|Alat populer|Kategori|Sumber daya|Perusahaan|Legal|Kebijakan privasi|Ketentuan layanan|Semua kategori|Lihat semua kategori →|Lihat semua konversi →",
  "zh-CN": "转换为 PDF|从 PDF 转换|整理 PDF|优化与扫描|编辑 PDF|电子表格工具|所有工具|转换 PDF|指南|关于|返回首页|搜索工具|全部|优化 PDF|最近搜索|清除|下载|取消|移除|添加文件|正在处理|选择 Word 文件|选择 PowerPoint 文件|选择 Excel 文件|添加 HTML|选择文件|将文件拖放到此处|每个文件最大 100 MB|继续处理 PDF|热门工具|分类|资源|公司|法律信息|隐私政策|服务条款|所有分类|查看所有分类 →|查看所有转换 →",
  ja: "PDF に変換|PDF から変換|PDF を整理|最適化とスキャン|PDF を編集|表計算ツール|すべてのツール|PDF を変換|ガイド|サイトについて|ホームに戻る|ツールを検索|すべて|PDF を最適化|最近の検索|クリア|ダウンロード|キャンセル|削除|ファイルを追加|処理中|Word ファイルを選択|PowerPoint ファイルを選択|Excel ファイルを選択|HTML を追加|ファイルを選択|ここにファイルをドロップ|1 ファイルにつき最大 100 MB|PDF の作業を続ける|人気のツール|カテゴリー|リソース|運営情報|法的情報|プライバシーポリシー|利用規約|すべてのカテゴリー|すべてのカテゴリーを見る →|すべての変換を見る →",
  ko: "PDF로 변환|PDF에서 변환|PDF 정리|최적화 및 스캔|PDF 편집|스프레드시트 도구|모든 도구|PDF 변환|가이드|소개|홈으로 돌아가기|도구 검색|전체|PDF 최적화|최근 검색|지우기|다운로드|취소|삭제|파일 추가|처리 중|Word 파일 선택|PowerPoint 파일 선택|Excel 파일 선택|HTML 추가|파일 선택|여기에 파일 놓기|파일당 최대 100 MB|PDF 작업 계속하기|인기 도구|카테고리|자료|회사|법적 고지|개인정보 처리방침|이용약관|모든 카테고리|모든 카테고리 보기 →|모든 변환 보기 →",
  ar: "تحويل إلى PDF|تحويل من PDF|تنظيم PDF|تحسين ومسح|تحرير PDF|أدوات جداول البيانات|جميع الأدوات|تحويل PDF|أدلة|حول الموقع|العودة للرئيسية|البحث عن أدوات|الكل|تحسين PDF|الأخيرة|مسح|تنزيل|إلغاء|إزالة|إضافة ملفات|جارٍ المعالجة|اختيار ملفات Word|اختيار ملفات PowerPoint|اختيار ملفات Excel|إضافة HTML|اختيار ملفات|أفلت الملفات هنا|حتى 100 ميغابايت لكل ملف|متابعة العمل على PDF|أدوات شائعة|فئات|موارد|الشركة|معلومات قانونية|سياسة الخصوصية|شروط الخدمة|جميع الفئات|عرض جميع الفئات ←|عرض جميع التحويلات ←",
  ru: "Конвертировать в PDF|Конвертировать из PDF|Упорядочить PDF|Оптимизация и сканирование|Редактировать PDF|Инструменты для таблиц|Все инструменты|Конвертировать PDF|Руководства|О нас|На главную|Поиск инструментов|Все|Оптимизировать PDF|Недавние|Очистить|Скачать|Отмена|Удалить|Добавить файлы|Обработка|Выбрать файлы Word|Выбрать файлы PowerPoint|Выбрать файлы Excel|Добавить HTML|Выбрать файлы|Перетащите файлы сюда|До 100 МБ на файл|Продолжить работу с PDF|Популярные инструменты|Категории|Ресурсы|Компания|Правовая информация|Политика конфиденциальности|Условия использования|Все категории|Все категории →|Все конвертации →",
};

export function uiText(locale: LocaleCode, text: string): string {
  if (locale === "en") return text;
  const common = CORE_COPY[locale].common;
  const commonKey = Object.entries(CORE_COPY.en.common).find(([, value]) => typeof value === "string" && value === text)?.[0];
  if (commonKey) return common[commonKey as keyof typeof common] as string;
  const toolIndex = TOOL_NAMES.en.split("|").indexOf(text);
  if (toolIndex >= 0) return TOOL_NAMES[locale].split("|")[toolIndex];
  if (text === "Select PDF file" || text === "Select PDF") return common.pdfButton;
  if (text === "or drop PDF here" || text === "or drop PDFs here") return common.pdfDrop;
  const index = UI_KEYS.indexOf(text as UiKey);
  return index < 0 ? workspaceText(locale, homeText(locale, text)) : UI_ROWS[locale].split("|")[index];
}

export function localizedToolName(slug: string, locale: LocaleCode, fallback: string): string {
  if (locale === "en") return fallback;
  const index = LAUNCH_TOOL_SLUGS.indexOf(slug);
  return index < 0 ? fallback : TOOL_NAMES[locale].split("|")[index];
}

export function validateUiCopy(): string[] {
  const errors: string[] = [];
  for (const [locale, row] of Object.entries(TOOL_NAMES)) {
    if (row.split("|").length !== LAUNCH_TOOL_SLUGS.length) errors.push(`${locale}: incomplete tool names`);
  }
  for (const [locale, row] of Object.entries(UI_ROWS)) {
    if (row.split("|").length !== UI_KEYS.length) errors.push(`${locale}: incomplete UI labels`);
  }
  return errors;
}
