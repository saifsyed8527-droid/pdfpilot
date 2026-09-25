import { TOOLS, type Tool } from "@/lib/tools";
import type { LocaleCode } from "./locales";
import { localizedToolName } from "./ui-copy";
import { conversionCopy, isConversionTool } from "./conversion-copy";

/**
 * Every production tool gets a locale-aware SEO landing URL.  The tool slug
 * stays stable across locales (the locale segment carries the language), which
 * keeps links durable while allowing search engines to index the translated
 * landing shell independently from the English application route.
 */
export const LOCALIZED_TOOL_SLUGS = new Set(TOOLS.map((tool) => tool.slug));

export function getLocalizedToolBySlug(slug: string): Tool | undefined {
  return LOCALIZED_TOOL_SLUGS.has(slug) ? TOOLS.find((tool) => tool.slug === slug) : undefined;
}

interface LocalizedLabels {
  online: string;
  free: string;
  private: string;
  useTool: string;
  overview: string;
  stepsHeading: string;
  faqHeading: string;
  stepOne: string;
  stepTwo: string;
  stepThree: string;
  faqFree: string;
  faqFreeAnswer: string;
  faqInstall: string;
  faqInstallAnswer: string;
}

const LABELS: Record<LocaleCode, LocalizedLabels> = {
  en: { online: "Online", free: "Free", private: "Private", useTool: "Open tool", overview: "About this tool", stepsHeading: "How it works", faqHeading: "Frequently asked questions", stepOne: "Open the tool and choose your file or input.", stepTwo: "Adjust the available options for the result you need.", stepThree: "Process the file and download the result.", faqFree: "Is PDFPilot free?", faqFreeAnswer: "PDFPilot tools are free to use with no account required.", faqInstall: "Do I need to install software?", faqInstallAnswer: "No. The tool runs in a modern web browser." },
  es: { online: "Online", free: "Gratis", private: "Privado", useTool: "Abrir herramienta", overview: "Sobre esta herramienta", stepsHeading: "Cómo funciona", faqHeading: "Preguntas frecuentes", stepOne: "Abre la herramienta y elige tu archivo o entrada.", stepTwo: "Ajusta las opciones disponibles para obtener el resultado que necesitas.", stepThree: "Procesa el archivo y descarga el resultado.", faqFree: "¿PDFPilot es gratis?", faqFreeAnswer: "Las herramientas de PDFPilot son gratis y no requieren una cuenta.", faqInstall: "¿Necesito instalar software?", faqInstallAnswer: "No. La herramienta funciona en un navegador moderno." },
  "pt-BR": { online: "Online", free: "Grátis", private: "Privado", useTool: "Abrir ferramenta", overview: "Sobre esta ferramenta", stepsHeading: "Como funciona", faqHeading: "Perguntas frequentes", stepOne: "Abra a ferramenta e escolha seu arquivo ou entrada.", stepTwo: "Ajuste as opções disponíveis para obter o resultado desejado.", stepThree: "Processe o arquivo e baixe o resultado.", faqFree: "O PDFPilot é grátis?", faqFreeAnswer: "As ferramentas do PDFPilot são grátis e não exigem conta.", faqInstall: "Preciso instalar software?", faqInstallAnswer: "Não. A ferramenta funciona em um navegador moderno." },
  de: { online: "Online", free: "Kostenlos", private: "Privat", useTool: "Tool öffnen", overview: "Über dieses Tool", stepsHeading: "So funktioniert es", faqHeading: "Häufige Fragen", stepOne: "Öffnen Sie das Tool und wählen Sie Ihre Datei oder Eingabe.", stepTwo: "Passen Sie die verfügbaren Optionen an.", stepThree: "Verarbeiten Sie die Datei und laden Sie das Ergebnis herunter.", faqFree: "Ist PDFPilot kostenlos?", faqFreeAnswer: "Die PDFPilot-Tools sind kostenlos und erfordern kein Konto.", faqInstall: "Muss ich Software installieren?", faqInstallAnswer: "Nein. Das Tool läuft in einem modernen Browser." },
  fr: { online: "en ligne", free: "gratuit", private: "privé", useTool: "Ouvrir l’outil", overview: "À propos de cet outil", stepsHeading: "Comment ça marche", faqHeading: "Questions fréquentes", stepOne: "Ouvrez l’outil et choisissez votre fichier ou votre entrée.", stepTwo: "Réglez les options disponibles selon votre besoin.", stepThree: "Traitez le fichier et téléchargez le résultat.", faqFree: "PDFPilot est-il gratuit ?", faqFreeAnswer: "Les outils PDFPilot sont gratuits et sans compte obligatoire.", faqInstall: "Faut-il installer un logiciel ?", faqInstallAnswer: "Non. L’outil fonctionne dans un navigateur moderne." },
  hi: { online: "ऑनलाइन", free: "मुफ़्त", private: "प्राइवेट", useTool: "टूल खोलें", overview: "इस टूल के बारे में", stepsHeading: "यह कैसे काम करता है", faqHeading: "अक्सर पूछे जाने वाले सवाल", stepOne: "टूल खोलें और अपनी फ़ाइल या इनपुट चुनें।", stepTwo: "ज़रूरत के अनुसार उपलब्ध विकल्प बदलें।", stepThree: "फ़ाइल प्रोसेस करें और परिणाम डाउनलोड करें।", faqFree: "क्या PDFPilot मुफ़्त है?", faqFreeAnswer: "PDFPilot के टूल मुफ़्त हैं और अकाउंट की ज़रूरत नहीं है।", faqInstall: "क्या सॉफ्टवेयर इंस्टॉल करना होगा?", faqInstallAnswer: "नहीं। यह टूल आधुनिक ब्राउज़र में चलता है।" },
  id: { online: "Online", free: "Gratis", private: "Privat", useTool: "Buka alat", overview: "Tentang alat ini", stepsHeading: "Cara kerja", faqHeading: "Pertanyaan umum", stepOne: "Buka alat dan pilih file atau masukan Anda.", stepTwo: "Atur opsi yang tersedia sesuai kebutuhan.", stepThree: "Proses file dan unduh hasilnya.", faqFree: "Apakah PDFPilot gratis?", faqFreeAnswer: "Alat PDFPilot gratis digunakan dan tidak memerlukan akun.", faqInstall: "Perlu memasang perangkat lunak?", faqInstallAnswer: "Tidak. Alat berjalan di browser modern." },
  "zh-CN": { online: "在线", free: "免费", private: "隐私", useTool: "打开工具", overview: "工具介绍", stepsHeading: "使用方法", faqHeading: "常见问题", stepOne: "打开工具并选择文件或输入内容。", stepTwo: "根据需要调整可用选项。", stepThree: "处理文件并下载结果。", faqFree: "PDFPilot 免费吗？", faqFreeAnswer: "PDFPilot 工具免费使用，无需注册账号。", faqInstall: "需要安装软件吗？", faqInstallAnswer: "不需要，工具可在现代浏览器中运行。" },
  ja: { online: "オンライン", free: "無料", private: "プライベート", useTool: "ツールを開く", overview: "このツールについて", stepsHeading: "使い方", faqHeading: "よくある質問", stepOne: "ツールを開き、ファイルまたは入力を選択します。", stepTwo: "必要に応じて利用可能なオプションを調整します。", stepThree: "処理して結果をダウンロードします。", faqFree: "PDFPilot は無料ですか？", faqFreeAnswer: "PDFPilot のツールは無料で、アカウントも不要です。", faqInstall: "ソフトウェアのインストールは必要ですか？", faqInstallAnswer: "いいえ。最新のブラウザで動作します。" },
  ko: { online: "온라인", free: "무료", private: "비공개", useTool: "도구 열기", overview: "도구 소개", stepsHeading: "사용 방법", faqHeading: "자주 묻는 질문", stepOne: "도구를 열고 파일 또는 입력을 선택하세요.", stepTwo: "필요한 결과에 맞게 옵션을 조정하세요.", stepThree: "파일을 처리하고 결과를 다운로드하세요.", faqFree: "PDFPilot은 무료인가요?", faqFreeAnswer: "PDFPilot 도구는 계정 없이 무료로 사용할 수 있습니다.", faqInstall: "소프트웨어를 설치해야 하나요?", faqInstallAnswer: "아니요. 최신 브라우저에서 작동합니다." },
  ar: { online: "عبر الإنترنت", free: "مجاني", private: "خاص", useTool: "فتح الأداة", overview: "حول هذه الأداة", stepsHeading: "طريقة الاستخدام", faqHeading: "الأسئلة الشائعة", stepOne: "افتح الأداة واختر الملف أو الإدخال.", stepTwo: "اضبط الخيارات المتاحة حسب حاجتك.", stepThree: "عالج الملف ونزّل النتيجة.", faqFree: "هل PDFPilot مجاني؟", faqFreeAnswer: "أدوات PDFPilot مجانية ولا تتطلب حسابًا.", faqInstall: "هل أحتاج إلى تثبيت برنامج؟", faqInstallAnswer: "لا. تعمل الأداة في متصفح حديث." },
  ru: { online: "онлайн", free: "бесплатно", private: "приватно", useTool: "Открыть инструмент", overview: "Об этом инструменте", stepsHeading: "Как это работает", faqHeading: "Частые вопросы", stepOne: "Откройте инструмент и выберите файл или ввод.", stepTwo: "Настройте доступные параметры.", stepThree: "Обработайте файл и скачайте результат.", faqFree: "PDFPilot бесплатен?", faqFreeAnswer: "Инструменты PDFPilot бесплатны и не требуют аккаунта.", faqInstall: "Нужно устанавливать программу?", faqInstallAnswer: "Нет. Инструмент работает в современном браузере." },
};

export function getLocalizedToolLabels(locale: LocaleCode): LocalizedLabels {
  return LABELS[locale];
}

export function getLocalizedToolTitle(tool: Tool, locale: LocaleCode): string {
  const labels = LABELS[locale];
  if (locale === "en") return `${tool.name} — ${labels.free} ${labels.online} | PDFPilot`;
  return `${localizedToolName(tool.slug, locale, tool.name)} — ${labels.free} ${labels.online} | PDFPilot`;
}

export function getLocalizedToolDescription(tool: Tool, locale: LocaleCode): string {
  if (isConversionTool(tool.slug)) return conversionCopy(locale, tool.slug).description;
  if (locale === "en") return `${tool.description} Use PDFPilot online for free.`;
  const descriptions: Record<Exclude<LocaleCode, "en">, string> = {
    es: `Usa ${tool.name} gratis en PDFPilot. Funciona directamente en tu navegador, sin subir archivos ni crear una cuenta.`,
    "pt-BR": `Use ${tool.name} grátis no PDFPilot. Funciona diretamente no navegador, sem enviar arquivos nem criar uma conta.`,
    de: `${tool.name} kostenlos mit PDFPilot nutzen. Die Verarbeitung läuft direkt im Browser, ohne Upload und ohne Konto.`,
    fr: `Utilisez ${tool.name} gratuitement avec PDFPilot. Le traitement se fait dans votre navigateur, sans envoi de fichier ni compte.`,
    hi: `PDFPilot पर ${tool.name} का मुफ़्त इस्तेमाल करें। प्रोसेसिंग सीधे आपके ब्राउज़र में होती है—फ़ाइल अपलोड या अकाउंट की ज़रूरत नहीं।`,
    id: `Gunakan ${tool.name} gratis di PDFPilot. Pemrosesan berjalan langsung di browser tanpa unggah file atau membuat akun.`,
    "zh-CN": `免费使用 PDFPilot 的 ${tool.name}。所有处理均在浏览器中完成，无需上传文件或注册账号。`,
    ja: `PDFPilot の ${tool.name} を無料で利用できます。処理はブラウザ内で完了し、ファイルのアップロードやアカウント登録は不要です。`,
    ko: `PDFPilot에서 ${tool.name}을 무료로 사용하세요. 파일 업로드나 계정 생성 없이 브라우저에서 바로 처리됩니다.`,
    ar: `استخدم أداة ${tool.name} مجانًا على PDFPilot. تتم المعالجة داخل المتصفح من دون رفع الملفات أو إنشاء حساب.`,
    ru: `Используйте ${tool.name} бесплатно в PDFPilot. Обработка выполняется прямо в браузере без загрузки файлов и регистрации.`,
  };
  return descriptions[locale];
}
