import type { FaqInput } from "@/lib/seo";
import type { LocaleCode } from "./locales";

export type CorePageKey = "home" | "merge" | "split" | "compress" | "pdfToJpg" | "jpgToPdf";
export type CoreToolKey = Exclude<CorePageKey, "home">;

export const CORE_PAGE_PATHS: Record<LocaleCode, Record<CorePageKey, string>> = {
  en: { home: "", merge: "merge-pdf", split: "split-pdf", compress: "compress-pdf", pdfToJpg: "pdf-to-jpg", jpgToPdf: "jpg-to-pdf" },
  es: { home: "", merge: "unir-pdf", split: "dividir-pdf", compress: "comprimir-pdf", pdfToJpg: "pdf-a-jpg", jpgToPdf: "jpg-a-pdf" },
  "pt-BR": { home: "", merge: "juntar-pdf", split: "dividir-pdf", compress: "comprimir-pdf", pdfToJpg: "pdf-para-jpg", jpgToPdf: "jpg-para-pdf" },
  de: { home: "", merge: "pdf-zusammenfuegen", split: "pdf-teilen", compress: "pdf-komprimieren", pdfToJpg: "pdf-in-jpg", jpgToPdf: "jpg-in-pdf" },
  fr: { home: "", merge: "fusionner-pdf", split: "diviser-pdf", compress: "compresser-pdf", pdfToJpg: "pdf-en-jpg", jpgToPdf: "jpg-en-pdf" },
  hi: { home: "", merge: "merge-pdf", split: "split-pdf", compress: "compress-pdf", pdfToJpg: "pdf-to-jpg", jpgToPdf: "jpg-to-pdf" },
  id: { home: "", merge: "gabungkan-pdf", split: "pisahkan-pdf", compress: "kompres-pdf", pdfToJpg: "pdf-ke-jpg", jpgToPdf: "jpg-ke-pdf" },
};

export const CORE_TOOL_KEYS: readonly CoreToolKey[] = ["merge", "split", "compress", "pdfToJpg", "jpgToPdf"];

export function getCorePageKeyFromPath(path: string): CorePageKey | undefined {
  if (path === "/" || path === "") return "home";
  const slug = path.replace(/^\//, "").replace(/\/$/, "");
  return (Object.entries(CORE_PAGE_PATHS.en) as [CorePageKey, string][]).find(([, value]) => value === slug)?.[0];
}

export interface ToolLandingCopy {
  title: string;
  description: string;
  buttonLabel: string;
  dropLabel: string;
  limitLabel: string;
}

export interface LocalizedToolContent extends ToolLandingCopy {
  key: CoreToolKey;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  steps: readonly string[];
  faqs: readonly FaqInput[];
}

interface LocaleCopy {
  home: { seoTitle: string; seoDescription: string; h1: string; intro: string; toolsHeading: string; privacyHeading: string; privacyBody: string };
  common: { how: string; faq: string; private: string; noAccount: string; pdfButton: string; imageButton: string; pdfDrop: string; imageDrop: string; pdfLimit: string; imageLimit: string; steps: readonly string[]; freeQ: string; freeA: string; uploadQ: string; uploadA: string; browserQ: string; browserA: string };
  tools: Record<CoreToolKey, { name: string; seoTitle: string; seoDescription: string; hero: string }>;
}

export const CORE_COPY: Record<LocaleCode, LocaleCopy> = {
  en: {
    home: { seoTitle: "Free Online PDF Tools — Private & No Sign-Up | PDFPilot", seoDescription: "Merge, split, compress and convert PDFs free in your browser. No uploads, watermarks or sign-up—your files stay private on your device.", h1: "Free online PDF tools that keep your files private", intro: "Merge, split, compress and convert PDFs directly in your browser. Nothing is uploaded, and no account is required.", toolsHeading: "Popular PDF tools", privacyHeading: "Private by design", privacyBody: "Your documents are processed locally in your browser and never leave your device." },
    common: { how: "How it works", faq: "Frequently asked questions", private: "Files stay on your device", noAccount: "No account needed", pdfButton: "Select PDF files", imageButton: "Select JPG images", pdfDrop: "or drag and drop PDF files here", imageDrop: "or drag and drop JPG or PNG files here", pdfLimit: "100MB max per PDF", imageLimit: "100MB max per image", steps: ["Select the file or files you want to process.", "Choose the order, pages, quality or layout you need.", "Process and download the finished file."], freeQ: "Is this tool free?", freeA: "Yes. PDFPilot is free to use with no sign-up or watermark.", uploadQ: "Are my files uploaded?", uploadA: "No. Your files are processed locally in the browser and stay on your device.", browserQ: "Do I need to install software?", browserA: "No. The tool works directly in a modern web browser." },
    tools: {
      merge: { name: "Merge PDF", seoTitle: "Merge PDF Files Online Free | PDFPilot", seoDescription: "Combine multiple PDFs into one file free. Reorder and merge privately in your browser with no upload, watermark or sign-up.", hero: "Combine multiple PDFs into one document. Arrange their order and merge privately in seconds." },
      split: { name: "Split PDF", seoTitle: "Split PDF Online Free | PDFPilot", seoDescription: "Split a PDF by page ranges or extract pages free. Process privately in your browser with no upload, watermark or sign-up.", hero: "Separate a PDF into the exact pages or ranges you need and download the result in seconds." },
      compress: { name: "Compress PDF", seoTitle: "Compress PDF Online Free | PDFPilot", seoDescription: "Reduce PDF size free with adjustable quality. Compress privately in your browser with no upload, installation or sign-up.", hero: "Make PDF files smaller while keeping the quality you need. Choose a level and download in seconds." },
      pdfToJpg: { name: "PDF to JPG", seoTitle: "Convert PDF to JPG Online Free | PDFPilot", seoDescription: "Convert every PDF page to JPG free. Process privately in your browser and download images with no upload or sign-up.", hero: "Convert each PDF page into a JPG image or extract the images inside a PDF." },
      jpgToPdf: { name: "JPG to PDF", seoTitle: "Convert JPG to PDF Online Free | PDFPilot", seoDescription: "Convert JPG and PNG images to PDF free. Arrange pages and create the document privately with no upload or sign-up.", hero: "Turn JPG and PNG images into a polished PDF. Arrange every page and choose its layout." },
    },
  },
  es: {
    home: { seoTitle: "Herramientas PDF Online Gratis y Privadas | PDFPilot", seoDescription: "Une, divide, comprime y convierte PDF gratis en tu navegador. Sin subir archivos, marcas de agua ni registro. Tus documentos siguen privados.", h1: "Herramientas PDF online gratis y privadas", intro: "Une, divide, comprime y convierte PDF directamente en tu navegador. No se sube nada y no necesitas una cuenta.", toolsHeading: "Herramientas PDF populares", privacyHeading: "Privacidad desde el diseño", privacyBody: "Tus documentos se procesan localmente y nunca salen de tu dispositivo." },
    common: { how: "Cómo funciona", faq: "Preguntas frecuentes", private: "Los archivos permanecen en tu dispositivo", noAccount: "Sin registro", pdfButton: "Seleccionar archivos PDF", imageButton: "Seleccionar imágenes JPG", pdfDrop: "o arrastra aquí tus archivos PDF", imageDrop: "o arrastra aquí archivos JPG o PNG", pdfLimit: "Máximo 100 MB por PDF", imageLimit: "Máximo 100 MB por imagen", steps: ["Selecciona el archivo o los archivos.", "Elige el orden, las páginas, la calidad o el diseño.", "Procesa y descarga el archivo final."], freeQ: "¿Esta herramienta es gratis?", freeA: "Sí. PDFPilot es gratis, sin registro ni marca de agua.", uploadQ: "¿Se suben mis archivos?", uploadA: "No. Se procesan localmente en tu navegador y permanecen en tu dispositivo.", browserQ: "¿Necesito instalar un programa?", browserA: "No. La herramienta funciona directamente en un navegador moderno." },
    tools: {
      merge: { name: "Unir PDF", seoTitle: "Unir PDF Online Gratis y Sin Subir Archivos | PDFPilot", seoDescription: "Une varios PDF en un archivo gratis. Ordena y combina documentos en tu navegador, sin subirlos, sin marcas de agua y sin registro.", hero: "Combina varios PDF en un documento, ordénalos y únelos de forma privada en segundos." },
      split: { name: "Dividir PDF", seoTitle: "Dividir PDF Online Gratis y Privado | PDFPilot", seoDescription: "Divide un PDF por rangos o extrae páginas gratis. Procesa el archivo en tu navegador sin subirlo, sin marcas de agua y sin registro.", hero: "Separa un PDF en las páginas o rangos exactos que necesitas." },
      compress: { name: "Comprimir PDF", seoTitle: "Comprimir PDF Online Gratis y Privado | PDFPilot", seoDescription: "Reduce el tamaño de tus PDF gratis con calidad ajustable. Comprime en el navegador sin subir archivos, instalar programas ni registrarte.", hero: "Reduce el tamaño de tus PDF conservando la calidad que necesitas." },
      pdfToJpg: { name: "PDF a JPG", seoTitle: "Convertir PDF a JPG Online Gratis | PDFPilot", seoDescription: "Convierte cada página de un PDF en JPG gratis. Todo se procesa en tu navegador, sin subir archivos ni registrarte.", hero: "Convierte cada página del PDF en una imagen JPG." },
      jpgToPdf: { name: "JPG a PDF", seoTitle: "Convertir JPG a PDF Online Gratis | PDFPilot", seoDescription: "Convierte imágenes JPG y PNG a PDF gratis. Ordena las páginas y crea el documento sin subir archivos ni registrarte.", hero: "Convierte imágenes JPG y PNG en un PDF ordenado." },
    },
  },
  "pt-BR": {
    home: { seoTitle: "Ferramentas de PDF Online Grátis e Privadas | PDFPilot", seoDescription: "Junte, divida, comprima e converta PDFs grátis no navegador. Sem upload, marca d'água ou cadastro. Seus arquivos ficam no dispositivo.", h1: "Ferramentas de PDF online grátis e privadas", intro: "Junte, divida, comprima e converta PDFs direto no navegador. Nada é enviado e nenhum cadastro é necessário.", toolsHeading: "Ferramentas de PDF populares", privacyHeading: "Privacidade desde o início", privacyBody: "Seus documentos são processados localmente e nunca saem do dispositivo." },
    common: { how: "Como funciona", faq: "Perguntas frequentes", private: "Os arquivos ficam no seu dispositivo", noAccount: "Sem cadastro", pdfButton: "Selecionar arquivos PDF", imageButton: "Selecionar imagens JPG", pdfDrop: "ou arraste os arquivos PDF aqui", imageDrop: "ou arraste arquivos JPG ou PNG aqui", pdfLimit: "Máximo de 100 MB por PDF", imageLimit: "Máximo de 100 MB por imagem", steps: ["Selecione o arquivo ou os arquivos.", "Escolha a ordem, páginas, qualidade ou layout.", "Processe e baixe o arquivo final."], freeQ: "Esta ferramenta é grátis?", freeA: "Sim. O PDFPilot é grátis, sem cadastro ou marca d'água.", uploadQ: "Meus arquivos são enviados?", uploadA: "Não. Eles são processados localmente no navegador.", browserQ: "Preciso instalar um programa?", browserA: "Não. A ferramenta funciona diretamente em um navegador moderno." },
    tools: {
      merge: { name: "Juntar PDF", seoTitle: "Juntar PDF Online Grátis e com Privacidade | PDFPilot", seoDescription: "Junte vários PDFs em um arquivo grátis. Organize e combine documentos no navegador, sem upload, marca d'água ou cadastro.", hero: "Combine vários PDFs em um documento e organize a ordem em segundos." },
      split: { name: "Dividir PDF", seoTitle: "Dividir PDF Online Grátis e com Privacidade | PDFPilot", seoDescription: "Divida um PDF por intervalos ou extraia páginas grátis. Processe no navegador, sem upload, marca d'água ou cadastro.", hero: "Separe um PDF nas páginas ou intervalos exatos que você precisa." },
      compress: { name: "Comprimir PDF", seoTitle: "Comprimir PDF Online Grátis e Privado | PDFPilot", seoDescription: "Reduza o tamanho do PDF grátis com qualidade ajustável. Comprima no navegador sem upload, instalação ou cadastro.", hero: "Deixe seus PDFs menores mantendo a qualidade necessária." },
      pdfToJpg: { name: "PDF para JPG", seoTitle: "Converter PDF para JPG Online Grátis | PDFPilot", seoDescription: "Converta cada página do PDF em JPG grátis. O processamento é privado no navegador, sem upload ou cadastro.", hero: "Converta cada página do PDF em uma imagem JPG." },
      jpgToPdf: { name: "JPG para PDF", seoTitle: "Converter JPG para PDF Online Grátis | PDFPilot", seoDescription: "Converta imagens JPG e PNG em PDF grátis. Organize as páginas e crie o documento no navegador, sem upload ou cadastro.", hero: "Transforme imagens JPG e PNG em um PDF organizado." },
    },
  },
  de: {
    home: { seoTitle: "Kostenlose, private Online-PDF-Tools | PDFPilot", seoDescription: "PDFs kostenlos im Browser zusammenfügen, teilen, komprimieren und konvertieren. Ohne Upload, Wasserzeichen oder Anmeldung – Dateien bleiben privat.", h1: "Kostenlose Online-PDF-Tools mit echtem Datenschutz", intro: "PDFs direkt im Browser zusammenfügen, teilen, komprimieren und konvertieren. Kein Upload und keine Anmeldung.", toolsHeading: "Beliebte PDF-Tools", privacyHeading: "Datenschutz von Anfang an", privacyBody: "Ihre Dokumente werden lokal verarbeitet und verlassen Ihr Gerät nicht." },
    common: { how: "So funktioniert es", faq: "Häufig gestellte Fragen", private: "Dateien bleiben auf Ihrem Gerät", noAccount: "Keine Anmeldung", pdfButton: "PDF-Dateien auswählen", imageButton: "JPG-Bilder auswählen", pdfDrop: "oder PDF-Dateien hier ablegen", imageDrop: "oder JPG- und PNG-Dateien hier ablegen", pdfLimit: "Maximal 100 MB pro PDF", imageLimit: "Maximal 100 MB pro Bild", steps: ["Wählen Sie die gewünschte Datei aus.", "Bestimmen Sie Reihenfolge, Seiten, Qualität oder Layout.", "Verarbeiten und laden Sie die fertige Datei herunter."], freeQ: "Ist dieses Tool kostenlos?", freeA: "Ja. PDFPilot ist kostenlos, ohne Anmeldung oder Wasserzeichen.", uploadQ: "Werden meine Dateien hochgeladen?", uploadA: "Nein. Die Verarbeitung erfolgt lokal in Ihrem Browser.", browserQ: "Muss ich Software installieren?", browserA: "Nein. Das Tool funktioniert direkt in einem modernen Browser." },
    tools: {
      merge: { name: "PDF zusammenfügen", seoTitle: "PDF kostenlos online zusammenfügen | PDFPilot", seoDescription: "Mehrere PDFs kostenlos verbinden. Dokumente im Browser sortieren und privat zusammenfügen – ohne Upload oder Anmeldung.", hero: "Mehrere PDFs in Sekunden sortieren und zu einem Dokument verbinden." },
      split: { name: "PDF teilen", seoTitle: "PDF kostenlos online teilen | PDFPilot", seoDescription: "PDF kostenlos nach Seitenbereichen teilen oder Seiten extrahieren. Private Verarbeitung im Browser ohne Upload oder Anmeldung.", hero: "Trennen Sie ein PDF genau in die Seiten oder Bereiche, die Sie benötigen." },
      compress: { name: "PDF komprimieren", seoTitle: "PDF kostenlos online komprimieren | PDFPilot", seoDescription: "PDF-Dateien kostenlos mit einstellbarer Qualität verkleinern. Private Komprimierung im Browser ohne Upload oder Anmeldung.", hero: "Verkleinern Sie PDFs und wählen Sie die passende Qualität." },
      pdfToJpg: { name: "PDF in JPG", seoTitle: "PDF kostenlos online in JPG umwandeln | PDFPilot", seoDescription: "PDF-Seiten kostenlos in JPG-Bilder umwandeln. Private Konvertierung im Browser ohne Upload oder Anmeldung.", hero: "Wandeln Sie jede PDF-Seite in ein JPG-Bild um." },
      jpgToPdf: { name: "JPG in PDF", seoTitle: "JPG kostenlos online in PDF umwandeln | PDFPilot", seoDescription: "JPG- und PNG-Bilder kostenlos in PDF umwandeln. Seiten im Browser anordnen – ohne Upload oder Anmeldung.", hero: "Erstellen Sie aus JPG- und PNG-Bildern ein geordnetes PDF." },
    },
  },
  fr: {
    home: { seoTitle: "Outils PDF en ligne gratuits et privés | PDFPilot", seoDescription: "Fusionnez, divisez, compressez et convertissez vos PDF gratuitement. Sans envoi, filigrane ni inscription. Vos fichiers restent privés.", h1: "Outils PDF en ligne gratuits et respectueux de votre vie privée", intro: "Fusionnez, divisez, compressez et convertissez vos PDF dans le navigateur. Aucun envoi ni compte requis.", toolsHeading: "Outils PDF populaires", privacyHeading: "La confidentialité dès la conception", privacyBody: "Vos documents sont traités localement et ne quittent jamais votre appareil." },
    common: { how: "Comment ça marche", faq: "Questions fréquentes", private: "Les fichiers restent sur votre appareil", noAccount: "Sans inscription", pdfButton: "Sélectionner des fichiers PDF", imageButton: "Sélectionner des images JPG", pdfDrop: "ou déposez vos fichiers PDF ici", imageDrop: "ou déposez des fichiers JPG ou PNG ici", pdfLimit: "100 Mo maximum par PDF", imageLimit: "100 Mo maximum par image", steps: ["Sélectionnez le ou les fichiers.", "Choisissez l'ordre, les pages, la qualité ou la mise en page.", "Lancez le traitement et téléchargez le résultat."], freeQ: "Cet outil est-il gratuit ?", freeA: "Oui. PDFPilot est gratuit, sans inscription ni filigrane.", uploadQ: "Mes fichiers sont-ils envoyés ?", uploadA: "Non. Ils sont traités localement dans votre navigateur.", browserQ: "Dois-je installer un logiciel ?", browserA: "Non. L'outil fonctionne directement dans un navigateur moderne." },
    tools: {
      merge: { name: "Fusionner PDF", seoTitle: "Fusionner des PDF en ligne gratuitement | PDFPilot", seoDescription: "Fusionnez plusieurs PDF gratuitement. Triez et combinez vos documents dans le navigateur, sans envoi de fichier ni inscription.", hero: "Combinez plusieurs PDF en un document et organisez leur ordre en quelques secondes." },
      split: { name: "Diviser PDF", seoTitle: "Diviser un PDF en ligne gratuitement | PDFPilot", seoDescription: "Divisez un PDF par plages ou extrayez des pages gratuitement. Traitement privé dans le navigateur, sans envoi ni inscription.", hero: "Séparez un PDF selon les pages ou plages exactes dont vous avez besoin." },
      compress: { name: "Compresser PDF", seoTitle: "Compresser un PDF en ligne gratuitement | PDFPilot", seoDescription: "Réduisez gratuitement la taille d'un PDF avec une qualité réglable. Compression privée dans le navigateur, sans envoi ni inscription.", hero: "Réduisez la taille de vos PDF en conservant la qualité dont vous avez besoin." },
      pdfToJpg: { name: "PDF en JPG", seoTitle: "Convertir PDF en JPG en ligne gratuitement | PDFPilot", seoDescription: "Convertissez gratuitement chaque page PDF en JPG. Traitement privé dans le navigateur, sans envoi ni inscription.", hero: "Transformez chaque page PDF en image JPG." },
      jpgToPdf: { name: "JPG en PDF", seoTitle: "Convertir JPG en PDF en ligne gratuitement | PDFPilot", seoDescription: "Convertissez gratuitement des images JPG et PNG en PDF. Organisez les pages dans le navigateur, sans envoi ni inscription.", hero: "Transformez vos images JPG et PNG en un PDF bien organisé." },
    },
  },
  hi: {
    home: { seoTitle: "मुफ़्त और प्राइवेट ऑनलाइन PDF टूल्स | PDFPilot", seoDescription: "ब्राउज़र में PDF मर्ज, स्प्लिट, कंप्रेस और कन्वर्ट करें। कोई अपलोड, वॉटरमार्क या साइन-अप नहीं—फ़ाइलें आपके डिवाइस पर रहती हैं।", h1: "मुफ़्त ऑनलाइन PDF टूल्स जो आपकी फ़ाइलें प्राइवेट रखें", intro: "PDF को सीधे ब्राउज़र में मर्ज, स्प्लिट, कंप्रेस और कन्वर्ट करें। कोई फ़ाइल अपलोड नहीं होती और अकाउंट नहीं चाहिए।", toolsHeading: "लोकप्रिय PDF टूल्स", privacyHeading: "प्राइवेसी सबसे पहले", privacyBody: "डॉक्यूमेंट ब्राउज़र में ही प्रोसेस होते हैं और आपके डिवाइस से बाहर नहीं जाते।" },
    common: { how: "यह कैसे काम करता है", faq: "अक्सर पूछे जाने वाले सवाल", private: "फ़ाइलें आपके डिवाइस पर रहती हैं", noAccount: "अकाउंट की जरूरत नहीं", pdfButton: "PDF फ़ाइलें चुनें", imageButton: "JPG इमेज चुनें", pdfDrop: "या PDF फ़ाइलें यहाँ ड्रैग करें", imageDrop: "या JPG/PNG फ़ाइलें यहाँ ड्रैग करें", pdfLimit: "हर PDF अधिकतम 100MB", imageLimit: "हर इमेज अधिकतम 100MB", steps: ["अपनी फ़ाइल या फ़ाइलें चुनें।", "क्रम, पेज, क्वालिटी या लेआउट चुनें।", "प्रोसेस करके तैयार फ़ाइल डाउनलोड करें।"], freeQ: "क्या यह टूल मुफ़्त है?", freeA: "हाँ। PDFPilot बिना साइन-अप और वॉटरमार्क के मुफ़्त है।", uploadQ: "क्या फ़ाइलें अपलोड होती हैं?", uploadA: "नहीं। फ़ाइलें ब्राउज़र में लोकली प्रोसेस होती हैं।", browserQ: "क्या सॉफ्टवेयर इंस्टॉल करना होगा?", browserA: "नहीं। यह टूल आधुनिक वेब ब्राउज़र में चलता है।" },
    tools: {
      merge: { name: "PDF मर्ज करें", seoTitle: "PDF ऑनलाइन मुफ़्त मर्ज करें | PDFPilot", seoDescription: "कई PDF को एक फ़ाइल में मुफ़्त मर्ज करें। ब्राउज़र में क्रम बदलें और बिना अपलोड या साइन-अप के प्राइवेट तरीके से जोड़ें।", hero: "कई PDF को सही क्रम में लगाकर कुछ सेकंड में एक डॉक्यूमेंट बनाएं।" },
      split: { name: "PDF स्प्लिट करें", seoTitle: "PDF ऑनलाइन मुफ़्त स्प्लिट करें | PDFPilot", seoDescription: "PDF को पेज रेंज से बाँटें या पेज निकालें। ब्राउज़र में मुफ़्त और प्राइवेट प्रोसेसिंग—बिना अपलोड या साइन-अप।", hero: "PDF से वही पेज या रेंज अलग करें जिनकी आपको जरूरत है।" },
      compress: { name: "PDF कंप्रेस करें", seoTitle: "PDF ऑनलाइन मुफ़्त कंप्रेस करें | PDFPilot", seoDescription: "एडजस्टेबल क्वालिटी के साथ PDF का साइज़ मुफ़्त घटाएँ। ब्राउज़र में प्राइवेट कंप्रेशन—बिना अपलोड या साइन-अप।", hero: "अपनी जरूरत के अनुसार क्वालिटी रखते हुए PDF को छोटा करें।" },
      pdfToJpg: { name: "PDF से JPG", seoTitle: "PDF को JPG में ऑनलाइन मुफ़्त बदलें | PDFPilot", seoDescription: "हर PDF पेज को JPG इमेज में मुफ़्त बदलें। ब्राउज़र में प्राइवेट कन्वर्ज़न—बिना फ़ाइल अपलोड या साइन-अप।", hero: "हर PDF पेज को अलग JPG इमेज में बदलें।" },
      jpgToPdf: { name: "JPG से PDF", seoTitle: "JPG को PDF में ऑनलाइन मुफ़्त बदलें | PDFPilot", seoDescription: "JPG और PNG इमेज को PDF में मुफ़्त बदलें। पेजों का क्रम लगाकर ब्राउज़र में डॉक्यूमेंट बनाएं—बिना अपलोड या साइन-अप।", hero: "JPG और PNG इमेज को सही क्रम में लगाकर PDF बनाएं।" },
    },
  },
  id: {
    home: { seoTitle: "Alat PDF Online Gratis dan Privat | PDFPilot", seoDescription: "Gabungkan, pisahkan, kompres, dan konversi PDF gratis di browser. Tanpa unggah, watermark, atau daftar—file tetap privat di perangkat Anda.", h1: "Alat PDF online gratis yang menjaga privasi file", intro: "Gabungkan, pisahkan, kompres, dan konversi PDF langsung di browser. Tidak ada unggahan dan tidak perlu akun.", toolsHeading: "Alat PDF populer", privacyHeading: "Privasi sejak awal", privacyBody: "Dokumen diproses secara lokal dan tidak pernah meninggalkan perangkat Anda." },
    common: { how: "Cara kerja", faq: "Pertanyaan umum", private: "File tetap di perangkat Anda", noAccount: "Tanpa akun", pdfButton: "Pilih file PDF", imageButton: "Pilih gambar JPG", pdfDrop: "atau tarik file PDF ke sini", imageDrop: "atau tarik file JPG/PNG ke sini", pdfLimit: "Maksimal 100MB per PDF", imageLimit: "Maksimal 100MB per gambar", steps: ["Pilih file yang ingin diproses.", "Atur urutan, halaman, kualitas, atau tata letak.", "Proses dan unduh file hasilnya."], freeQ: "Apakah alat ini gratis?", freeA: "Ya. PDFPilot gratis tanpa pendaftaran atau watermark.", uploadQ: "Apakah file saya diunggah?", uploadA: "Tidak. File diproses secara lokal di browser.", browserQ: "Apakah perlu memasang aplikasi?", browserA: "Tidak. Alat ini bekerja langsung di browser modern." },
    tools: {
      merge: { name: "Gabungkan PDF", seoTitle: "Gabungkan PDF Online Gratis dan Privat | PDFPilot", seoDescription: "Gabungkan beberapa PDF menjadi satu file gratis. Atur urutan dan proses di browser tanpa unggah, watermark, atau pendaftaran.", hero: "Gabungkan beberapa PDF menjadi satu dokumen dan atur urutannya dalam hitungan detik." },
      split: { name: "Pisahkan PDF", seoTitle: "Pisahkan PDF Online Gratis dan Privat | PDFPilot", seoDescription: "Pisahkan PDF berdasarkan rentang atau ekstrak halaman gratis. Pemrosesan privat di browser tanpa unggah atau pendaftaran.", hero: "Pisahkan PDF menjadi halaman atau rentang yang Anda butuhkan." },
      compress: { name: "Kompres PDF", seoTitle: "Kompres PDF Online Gratis dan Privat | PDFPilot", seoDescription: "Kecilkan ukuran PDF gratis dengan kualitas pilihan. Kompres secara privat di browser tanpa unggah, instalasi, atau pendaftaran.", hero: "Kecilkan PDF sambil mempertahankan kualitas yang Anda perlukan." },
      pdfToJpg: { name: "PDF ke JPG", seoTitle: "Konversi PDF ke JPG Online Gratis | PDFPilot", seoDescription: "Konversi setiap halaman PDF menjadi JPG gratis. Proses privat di browser tanpa unggah file, instalasi, atau pendaftaran.", hero: "Ubah setiap halaman PDF menjadi gambar JPG." },
      jpgToPdf: { name: "JPG ke PDF", seoTitle: "Konversi JPG ke PDF Online Gratis | PDFPilot", seoDescription: "Konversi gambar JPG dan PNG menjadi PDF gratis. Atur halaman dan buat dokumen di browser tanpa unggah atau pendaftaran.", hero: "Ubah gambar JPG dan PNG menjadi PDF yang tersusun rapi." },
    },
  },
};

export function getLocalizedToolContent(locale: LocaleCode, key: CoreToolKey): LocalizedToolContent {
  const localeCopy = CORE_COPY[locale];
  const content = localeCopy.tools[key];
  const images = key === "jpgToPdf";
  return {
    key,
    slug: CORE_PAGE_PATHS[locale][key],
    title: content.name,
    seoTitle: content.seoTitle,
    seoDescription: content.seoDescription,
    description: content.hero,
    buttonLabel: images ? localeCopy.common.imageButton : localeCopy.common.pdfButton,
    dropLabel: images ? localeCopy.common.imageDrop : localeCopy.common.pdfDrop,
    limitLabel: images ? localeCopy.common.imageLimit : localeCopy.common.pdfLimit,
    steps: localeCopy.common.steps,
    faqs: [
      { question: localeCopy.common.freeQ, answer: localeCopy.common.freeA },
      { question: localeCopy.common.uploadQ, answer: localeCopy.common.uploadA },
      { question: localeCopy.common.browserQ, answer: localeCopy.common.browserA },
    ],
  };
}
