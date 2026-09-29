import { generateCandidate, fingerprint } from './content';
import type { Classification } from './classify';
import type { Keyword, PseoPage } from './schema';
import help from '../content/pt-br-tool-help.json';
export const isPortugueseRecipe = (intent: Classification) => (intent.toolId==='jpg-to-pdf'&&intent.family==='format'&&intent.modifier==='png-to-pdf') || (intent.toolId==='edit-pdf'&&intent.family==='use-case'&&intent.modifier==='resume');
export function generatePortugueseCandidate(intent: Classification, rows: Keyword[], date: string, previous?: PseoPage): PseoPage|undefined {
 if(!isPortugueseRecipe(intent))return undefined;
 const base=generateCandidate(intent,rows,date,previous);if(!base)return undefined;
 const png=intent.modifier==='png-to-pdf',toolHelp=help[png?'jpg-to-pdf':'edit-pdf'];
 const slug=png?'png-para-pdf':'editar-curriculo-pdf';
 const title=png?'PNG para PDF':'Editar currículo em PDF';
 const intro=png?'Transforme capturas de tela e imagens PNG em um PDF. Organize as imagens e confira transparência, margens e tamanho das páginas antes de compartilhar.':'Atualize informações e faça anotações em um currículo PDF. Guarde o original, edite os elementos compatíveis e confira a cópia exportada antes de enviar.';
 const details=png?[
  'PNG é comum em capturas de tela, gráficos e imagens com transparência. Escolha o tamanho ajustado à imagem para manter suas proporções, ou A4 e Carta quando o documento será impresso.',
  'Organize as imagens na ordem de leitura. Confira como as áreas transparentes aparecem no leitor de PDF e verifique se textos pequenos permanecem legíveis. Converter a imagem não recupera detalhes que já foram perdidos.'
 ]:[
  'Antes de mudar datas, contatos ou descrições, salve uma cópia do currículo. Verifique se o texto desejado permite edição. Fontes incorporadas e páginas digitalizadas podem limitar a alteração do conteúdo existente.',
  'Depois de exportar, abra o PDF e confira quebras de linha, espaçamento, número de páginas e informações de contato. Para reorganizar o currículo inteiro, o documento original pode ser mais adequado. Esta ferramenta não avalia compatibilidade com sistemas de recrutamento.'
 ];
 const body={h1:title,subtitle:intro,intro,howToSteps:png?['Selecione as imagens PNG salvas no dispositivo.','Organize as imagens, o tamanho das páginas e as margens.','Converta e confira transparência e legibilidade no PDF baixado.']:['Selecione uma cópia do currículo em PDF.','Faça as alterações compatíveis e revise as áreas modificadas.','Salve, baixe e confira o currículo antes de enviar.'],useCaseContent:details,compatibilityContent:[png?'A ferramenta aceita PNG, JPG e JPEG no mesmo conjunto. Não aceita HEIC, TIFF ou WebP.':'Use os controles existentes para alterações de texto, imagens e anotações. Esta página não cria currículos automaticamente.'],limitationsContent:[toolHelp.limitation],faqItems:[{question:'Como meus arquivos são processados?',answer:toolHelp.privacy},{question:'O que conferir antes de usar o resultado?',answer:toolHelp.limitation}],recipeId:png?'pt-br-png-layout-v1':'pt-br-resume-edits-v1'};
 return {...base,...body,slug:previous?.slug??slug,language:'pt-BR',locale:'pt-br',metaTitle:`${title} | PDFPilot`,metaDescription:intro,canonicalUrl:`https://pdfpilot.net/pt-br/${previous?.slug??slug}`,contentFingerprint:fingerprint(body)};
}
