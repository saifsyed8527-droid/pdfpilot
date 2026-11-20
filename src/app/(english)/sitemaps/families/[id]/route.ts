import { familySitemapChunks, familyXml } from '@/lib/seo/sitemap-families';
// All entries come from the versioned site inventory, never request data.
export const dynamic = 'force-static';
export const dynamicParams = false;
export function generateStaticParams() {
 const chunks=familySitemapChunks();
 const ids=new Set(chunks.map(chunk=>chunk.id));
 const families=new Map<string,number>();
 for(const {family} of chunks) families.set(family,(families.get(family)??0)+1);
 for(const [family,count] of families) if(count>1) ids.add(family);
 return [...ids].map(id=>({id:id+'.xml'}));
}
export async function GET(_request: Request,{params}:{params:Promise<{id:string}>}){
 const id=(await params).id;
 const xml=id.endsWith('.xml')?familyXml(id.slice(0,-4)):undefined;
 return xml?new Response(xml,{headers:{'Content-Type':'application/xml; charset=utf-8'}}):new Response('Not found',{status:404});
}
