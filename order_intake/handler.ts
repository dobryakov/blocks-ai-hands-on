import type { StartTaskMessage, TaskContext, HandlerResult } from '@blocks-network/sdk';
import { decodeInlineArtifact } from '@blocks-network/sdk';

/**
 * order_intake
 * ------------
 * Online-shop order processor. It validates an incoming order, derives the
 * destination region and total weight from the line items, then calls the
 * delivery_slot_estimator agent OVER THE NETWORK (agent-to-agent) to get a
 * promised delivery window, and returns an enriched, confirmed order.
 *
 * This is the orchestrator↔specialist pattern: order_intake does not re-implement
 * delivery logic — it discovers and reuses delivery_slot_estimator on Blocks.
 *
 * Input (JSON string in the `request` part):
 *   { orderId, country, items:[{sku,qty,weightKg,price}], serviceTier? }
 * Output (JSON artifact):
 *   { orderId, region, totalWeightKg, totalPrice, estimatedDays, deliveryWindow, status }
 */

const ESTIMATOR = 'delivery_slot_estimator';

// ISO country code -> estimator region bucket.
const COUNTRY_REGION: Record<string, string> = {
  DE: 'EU-West', FR: 'EU-West', NL: 'EU-West', BE: 'EU-West', AT: 'EU-West',
  PL: 'EU-East', CZ: 'EU-East', HU: 'EU-East', RO: 'EU-East', BG: 'EU-East', SK: 'EU-East',
  RS: 'Balkans', BA: 'Balkans', ME: 'Balkans', MK: 'Balkans', AL: 'Balkans', HR: 'Balkans',
};

type Item = { sku?: string; qty?: number; weightKg?: number; price?: number };

function fail(message: string, detail?: unknown): HandlerResult {
  return {
    artifacts: [
      { data: JSON.stringify({ status: 'rejected', error: message, detail: detail ?? null }), mimeType: 'application/json' },
    ],
  };
}

export default async function handler(task: StartTaskMessage, ctx?: TaskContext): Promise<HandlerResult> {
  ctx?.reportStatus('Parsing order…');

  const raw = (task.requestParts?.[0] as Record<string, unknown> | undefined)?.text;
  let order: Record<string, unknown> = {};
  try {
    order = typeof raw === 'string' && raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return fail('Order part was not valid JSON', raw ?? null);
  }

  // --- validate ---
  const orderId = typeof order.orderId === 'string' ? order.orderId : 'UNKNOWN';
  const country = typeof order.country === 'string' ? order.country.toUpperCase() : '';
  const items = Array.isArray(order.items) ? (order.items as Item[]) : [];
  const serviceTier = order.serviceTier === 'express' ? 'express' : 'standard';
  if (items.length === 0) return fail('Order has no line items');
  if (!country) return fail('Order has no destination country');

  // --- derive region, weight, total ---
  const region = COUNTRY_REGION[country] ?? 'unknown';
  let totalWeightKg = 0;
  let totalPrice = 0;
  for (const it of items) {
    const qty = Number(it.qty) || 0;
    if (qty <= 0) return fail(`Line item ${it.sku ?? '?'} has non-positive qty`);
    totalWeightKg += qty * (Number(it.weightKg) || 0);
    totalPrice += qty * (Number(it.price) || 0);
  }
  totalWeightKg = Math.round(totalWeightKg * 100) / 100;
  totalPrice = Math.round(totalPrice * 100) / 100;

  // --- agent-to-agent call to the estimator ---
  if (!ctx?.taskClient) return fail('No taskClient in context — cannot reach the estimator');
  ctx.reportStatus(`Asking ${ESTIMATOR} for a delivery window (${region}, ${totalWeightKg}kg)…`);

  let estimate: Record<string, unknown>;
  try {
    const session = await ctx.taskClient.sendMessage({
      agentName: ESTIMATOR,
      ownerId: task.ownerId,
      requestParts: [{ partId: 'request', text: JSON.stringify({ region, weightKg: totalWeightKg, serviceTier }) }],
    });
    await session.waitForTerminal(20_000);
    const refs = session.listArtifacts();
    if (refs.length === 0) {
      await session.asyncClose();
      return fail(`${ESTIMATOR} returned no artifact`);
    }
    const ref = refs[0];
    const bytes =
      ref.kind === 'inline' && ref.data ? decodeInlineArtifact(ref) : (await session.downloadArtifact(ref)).data;
    estimate = JSON.parse(new TextDecoder().decode(bytes));
    await session.asyncClose();
  } catch (err) {
    return fail(`Call to ${ESTIMATOR} failed`, err instanceof Error ? err.message : String(err));
  }

  ctx.reportStatus('Confirming order…');

  const result = {
    orderId,
    region,
    totalWeightKg,
    totalPrice,
    serviceTier,
    estimatedDays: estimate.estimatedDays ?? null,
    deliveryWindow: estimate.deliveryWindow ?? null,
    estimatorNotes: estimate.notes ?? [],
    status: 'confirmed',
  };

  return { artifacts: [{ data: JSON.stringify(result, null, 2), mimeType: 'application/json' }] };
}
