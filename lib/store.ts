// In-memory fake database for frontend work. Resets when the dev server restarts.
export type Parcel = {
  tracking: string; status: "PENDING_ACTIVATION" | "ACTIVATED_AT_ORIGIN";
  senderName?: string; senderPhone?: string; receiverName?: string; receiverPhone?: string;
  destination?: string; weightLbs?: number; chargeable?: number; total?: number; shelf?: string;
};

const seed: Parcel[] = [
  { tracking: "JP1000001", status: "PENDING_ACTIVATION", destination: "Port-au-Prince" },
  { tracking: "JP1000002", status: "PENDING_ACTIVATION", destination: "Cap-Haitien" },
  { tracking: "JP1000003", status: "PENDING_ACTIVATION", destination: "Les Cayes" },
];

const g = globalThis as unknown as { __jpParcels?: Map<string, Parcel> };
export const parcels = (g.__jpParcels ??= new Map(seed.map((p) => [p.tracking, p])));
