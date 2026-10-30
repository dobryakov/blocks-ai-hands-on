import type { StartTaskMessage, TaskContext, HandlerResult } from '@blocks-network/sdk';

/**
 * delivery_slot_estimator
 * -----------------------
 * A deterministic agent that estimates a delivery window for a furniture/retail
 * order, given destination region, parcel weight and service tier. No LLM, no
 * external API — the output is fully reproducible, which is exactly what you
 * want for an agent other agents call inside an enterprise flow (an order
 * orchestrator can trust the number instead of re-validating a model guess).
 *
 * Input  (JSON, sent as the `.text` of the `request` part — see FRICTION-LOG F3):
 *   { "region": "EU-West" | "EU-East" | "Balkans" | string,
 *     "weightKg": number,
 *     "serviceTier": "standard" | "express",
 *     "orderDate"?: "YYYY-MM-DD"   // optional; defaults to today (UTC) }
 *
 * Output (JSON artifact):
 *   { region, serviceTier, weightKg, estimatedDays:{min,max},
 *     deliveryWindow:{earliest,latest}, surchargeDays, notes }
 */

type Tier = 'standard' | 'express';

const BASE_DAYS: Record<string, { min: number; max: number }> = {
  'EU-West': { min: 2, max: 4 },
  'EU-East': { min: 3, max: 6 },
  Balkans: { min: 4, max: 7 },
};
const FALLBACK = { min: 5, max: 10 };

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function handler(
  task: StartTaskMessage,
  ctx?: TaskContext,
): Promise<HandlerResult> {
  ctx?.reportStatus('Parsing order…');

  // No jsonPart helper in the SDK, so the structured payload arrives as a
  // JSON string in `.text`. Parse it defensively.
  const raw = (task.requestParts?.[0] as Record<string, unknown> | undefined)?.text;
  let input: Record<string, unknown> = {};
  try {
    input = typeof raw === 'string' && raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {
      artifacts: [
        {
          data: JSON.stringify({ error: 'Input part was not valid JSON', received: raw ?? null }),
          mimeType: 'application/json',
        },
      ],
    };
  }

  const region = typeof input.region === 'string' ? input.region : 'unknown';
  const weightKg = Number.isFinite(Number(input.weightKg)) ? Number(input.weightKg) : 0;
  const serviceTier: Tier = input.serviceTier === 'express' ? 'express' : 'standard';
  const orderDate =
    typeof input.orderDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.orderDate)
      ? input.orderDate
      : new Date().toISOString().slice(0, 10);

  ctx?.reportStatus(`Estimating slot for ${region} (${serviceTier})…`);

  const base = BASE_DAYS[region] ?? FALLBACK;
  const notes: string[] = [];
  if (!BASE_DAYS[region]) notes.push(`Unknown region "${region}" — using conservative fallback.`);

  // Weight surcharge (bulky furniture needs a freight slot).
  let surchargeDays = 0;
  if (weightKg > 100) {
    surchargeDays = 2;
    notes.push('Over 100 kg: freight handling adds 2 days.');
  } else if (weightKg > 30) {
    surchargeDays = 1;
    notes.push('Over 30 kg: palletised handling adds 1 day.');
  }

  let min = base.min + surchargeDays;
  let max = base.max + surchargeDays;

  // Express halves the wait (rounded up), minimum 1 day.
  if (serviceTier === 'express') {
    min = Math.max(1, Math.ceil(min / 2));
    max = Math.max(min, Math.ceil(max / 2));
    notes.push('Express tier: lead time halved.');
  }

  const result = {
    region,
    serviceTier,
    weightKg,
    orderDate,
    estimatedDays: { min, max },
    deliveryWindow: { earliest: addDays(orderDate, min), latest: addDays(orderDate, max) },
    surchargeDays,
    notes,
  };

  return {
    artifacts: [{ data: JSON.stringify(result, null, 2), mimeType: 'application/json' }],
  };
}
