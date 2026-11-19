import { notFound } from "next/navigation";
// Retired without an equivalent replacement. Preserve a genuine HTTP 404.
export default function RetiredResourcePage() { notFound(); }
