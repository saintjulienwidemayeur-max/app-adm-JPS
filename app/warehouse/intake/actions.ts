"use server";

import { calcPricing } from "@/lib/pricing";
import { usToday } from "@/lib/clock";
import { parcels } from "@/lib/store";

export type ScanResult =
  | { kind: "new"; tracking: string }
  | { kind: "activated"; tracking: string; destination: string | null }
  | { kind: "already"; tracking: string; status: string }
  | { kind: "error"; message: string };

export async function scanParcel(raw: string, shelf?: string): Promise<ScanResult> {
  const tracking = raw.trim().toUpperCase();
  if (!tracking) return { kind: "error", message: "Empty scan." };

  const p = parcels.get(tracking);
  if (!p) return { kind: "new", tracking };
  if (p.status !== "PENDING_ACTIVATION") return { kind: "already", tracking, status: p.status };

  p.status = "ACTIVATED_AT_ORIGIN";
  p.shelf = shelf || undefined;
  return { kind: "activated", tracking, destination: p.destination ?? null };
}

export type ActivateInput = {
  tracking: string;
  senderName: string; senderPhone: string;
  receiverName: string; receiverPhone: string; destination: string;
  weightLbs: number; length: number; width: number; height: number;
  shelf?: string;
};

export type LabelData = {
  tracking: string; senderName: string; senderPhone: string;
  receiverName: string; receiverPhone: string; destination: string;
  weightLbs: number; volumetric: number; chargeable: number; total: number;
  dims: string; shelf?: string; date: string;
};

export async function activateParcel(
  input: ActivateInput
): Promise<{ ok: true; label: LabelData } | { ok: false; message: string }> {
  const nums = [input.weightLbs, input.length, input.width, input.height];
  if (nums.some((n) => !Number.isFinite(n) || n <= 0)) return { ok: false, message: "Enter weight and all dimensions." };
  if (!input.tracking || !input.senderName || !input.senderPhone || !input.receiverName || !input.destination)
    return { ok: false, message: "Fill in the required fields." };
  if (parcels.get(input.tracking)?.status === "ACTIVATED_AT_ORIGIN")
    return { ok: false, message: "This tracking number already exists." };

  const price = calcPricing(input);
  parcels.set(input.tracking, {
    tracking: input.tracking, status: "ACTIVATED_AT_ORIGIN",
    senderName: input.senderName, senderPhone: input.senderPhone,
    receiverName: input.receiverName, receiverPhone: input.receiverPhone,
    destination: input.destination, weightLbs: input.weightLbs,
    chargeable: price.chargeable, total: price.total, shelf: input.shelf,
  });

  return {
    ok: true,
    label: {
      tracking: input.tracking, senderName: input.senderName, senderPhone: input.senderPhone,
      receiverName: input.receiverName, receiverPhone: input.receiverPhone, destination: input.destination,
      weightLbs: input.weightLbs, volumetric: price.volumetric, chargeable: price.chargeable, total: price.total,
      dims: `${input.length}x${input.width}x${input.height} in`, shelf: input.shelf,
      date: usToday(),
    },
  };
}
