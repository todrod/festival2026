import { format } from "date-fns";
import { FESTIVAL_START, FESTIVAL_END } from "@/lib/festival";
import { LandingContent } from "@/components/public/landing-content";

export default function HomePage() {
  const datesLabel = `${format(FESTIVAL_START, "MMM d, yyyy")} - ${format(FESTIVAL_END, "MMM d, yyyy")}`;
  return <LandingContent datesLabel={datesLabel} />;
}
