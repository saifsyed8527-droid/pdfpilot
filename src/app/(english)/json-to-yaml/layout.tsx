import RouteRelatedLinks from "@/components/seo/RouteRelatedLinks";
export default function ToolLayout({children}:{children:React.ReactNode}) {
 return <RouteRelatedLinks path="/json-to-yaml">{children}</RouteRelatedLinks>;
}
