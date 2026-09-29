import { familyXml } from '@/lib/seo/sitemap-families';
export async function GET(_request: Request,{params}:{params:Promise<{id:string}>}){
 const id=(await params).id;
 const xml=id.endsWith('.xml')?familyXml(id.slice(0,-4)):undefined;
 return xml?new Response(xml,{headers:{'Content-Type':'application/xml; charset=utf-8'}}):new Response('Not found',{status:404});
}
