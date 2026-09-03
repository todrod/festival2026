import { format } from "date-fns";
import { FESTIVAL_START, FESTIVAL_END } from "@/lib/festival";
import { prisma } from "@/lib/prisma";
import { LandingContent } from "@/components/public/landing-content";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const datesLabel = `${format(FESTIVAL_START, "MMM d")} – ${format(FESTIVAL_END, "MMM d, yyyy")}`;
  const positions = await prisma.role.findMany({ orderBy: [{ module: "asc" }, { name: "asc" }] });
  return <LandingContent datesLabel={datesLabel} positions={positions} />;
}
