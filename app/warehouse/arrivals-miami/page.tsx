import { ArrivalsView } from "@/components/arrivals-view";

export const metadata = { title: "Arrivals Miami · JP's Logistics" };
type SP = Promise<Record<string, string | undefined>>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  return <ArrivalsView q={await searchParams} usa />;
}
