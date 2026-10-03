import { IntakeClient } from "./intake-client";

export const metadata = { title: "Intake · JP's Logistics" };

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <IntakeClient />
    </main>
  );
}
