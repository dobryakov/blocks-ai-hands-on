import 'dotenv/config';
import { TaskClient, textPart, decodeInlineArtifact } from '@blocks-network/sdk';
import type { ProgressEvent, ArtifactEvent, TerminalEvent } from '@blocks-network/sdk';

/**
 * Sends a sample online-shop order to the order_intake agent and prints the
 * confirmed order. order_intake will itself call delivery_slot_estimator over
 * the network — so this one call exercises a two-hop agent-to-agent chain:
 *
 *   trigger.ts ──► order_intake ──► delivery_slot_estimator
 *
 * Usage: npx tsx trigger.ts
 */
async function main() {
  const apiKey = process.env.BLOCKS_API_KEY;
  if (!apiKey) {
    console.error("BLOCKS_API_KEY not set. Run 'blocks login --write-env' or set it in .env.");
    process.exit(1);
  }

  const order = {
    orderId: 'A-1042',
    country: 'PL',
    items: [
      { sku: 'SOFA-3', qty: 1, weightKg: 48, price: 899 },
      { sku: 'CUSHION', qty: 2, weightKg: 1.5, price: 25 },
    ],
    serviceTier: 'standard',
  };

  const client = await TaskClient.create({ billingMode: 'free', apiKey });

  const session = await client.sendMessage({
    agentName: 'order_intake',
    requestParts: [textPart(JSON.stringify(order), 'request')],
  });

  console.log('Task created:', session.taskId);
  console.log('Order sent:', JSON.stringify(order));

  session.onProgress((event: ProgressEvent) => {
    console.log('[progress]', event.message ?? event.progress ?? '');
  });
  session.onArtifact(async (event: ArtifactEvent) => {
    const ref = event.artifactRef;
    const bytes =
      ref.kind === 'inline' && ref.data ? decodeInlineArtifact(ref) : (await session.downloadArtifact(ref)).data;
    console.log('[confirmed order]\n' + new TextDecoder().decode(bytes));
  });
  session.onTerminal((_event: TerminalEvent) => {
    console.log('[done] Task complete');
    session.close();
    client.destroy();
    process.exit(0);
  });
}

main().catch(console.error);
