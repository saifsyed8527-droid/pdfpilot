import RouteRelatedLinks from "@/components/seo/RouteRelatedLinks";
export default function ToolLayout({children}:{children:React.ReactNode}) {
 return <RouteRelatedLinks path="/ocr-pdf">{children}</RouteRelatedLinks>;
}
