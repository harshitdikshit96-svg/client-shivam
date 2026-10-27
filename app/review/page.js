import { notFound } from "next/navigation";
import Review from "@/components/Review";
export const dynamic = "force-dynamic";
export const metadata = { title: "Review — Field Selection" };
// the field-selection review exists only in prototype mode
export default function Page() {
  if (process.env.NEXT_PUBLIC_APP_MODE !== "prototype") notFound();
  return <Review />;
}
