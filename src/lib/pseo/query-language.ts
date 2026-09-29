/** Query evidence only. Never inspect market or competitor URL to infer language. */
export function detectQueryLanguage(input: string): string {
 const q=input.normalize('NFKC').toLowerCase();
 if (/[^\p{Script=Latin}\p{N}\p{P}\p{Z}\p{S}]/u.test(q)) return 'und';
 if (/\b(?:convertir|archivo|archivos|hacer|contraseña|comprimir un|a word|a jpg|a excel|a powerpoint|a pdf|imagen|imagenes|imágenes|paginas de|páginas de|cómo|conversor de archivos)\b/.test(q)) return 'es';
 if (/\b(?:convertire|unisci|unire|fichier|fusionner|compresser|zusammen|naar|gabung|ubah|menjadi|kaise|kare|hai|banao)\b/.test(q)) return 'und';
 if (/\b(?:to|into|how|what|why|with|without|merge|compress|split|edit|convert|free)\b/.test(q) && !/\b(?:em|para|arquivo|arquivos|como|sem|com)\b/.test(q)) return 'en';
 if (/^(?:pdf|jpg|png|word|excel|powerpoint|image|photo) converter(?: online)?$/.test(q)) return 'en';
 if (/\beditor de\b/.test(q)) return 'pt-BR';
 if (/\b(?:change|modify|editing|combining|several|creating|creator|merging|compression|compressor|reducer|splitter|convertor|pdfs)\b/.test(q)) return 'en';
 if (/\b(?:juntarpdf|unir|documento|documentos|resumo|resumir|resumidor|leitor|leitura|abrir|formulario|formulário|escanear|digitalizador|assinador|cadeado|inserir|retirar|adicionar|juntar|junte|unificar|mesclar|mescle|agrupar|separar|dividir|comprimir|compactar|compactador|compactação|compressão|reduzir|diminuir|tamanho|arquivo|arquivos|transformar|converter|conversor|conversão|converta|transforme|editar|editavel|editável|edição|consertar|reparar|recuperar|girar|rotacionar|recortar|cortar|organizar|ordenar|numerar|preencher|remover|excluir|extrair|assinatura|assinar|senha|desbloquear|proteger|traduzir|tradutor|tradução|digitalizar|digitalizado|escaneado|pesquisável|pesquisavel|foto|fotos|imagem|imagens|página|páginas|planilha|planilhas|currículo|curriculo|paisagem|gratuito|gratuita|grátis|baixar|portugues|português|marca d|em|para)\b/.test(q)) return 'pt-BR';
 if (/\b(?:to|into|convert|merge|compress|split|edit|how|what|why|is|are|from|with|without|word|jpg|pdf)\b/.test(q) && /\b(?:to|into|convert|merge|compress|split|edit|how|what|why|is|are|from|with|without|free|online converter|page|pages|image|images|photo|photos|bank|scanned|reduce|resize|repair|crop|rotate|extract|combine|join|unlock|password|watermark|fill)\b/.test(q)) return 'en';
 return 'und';
}
