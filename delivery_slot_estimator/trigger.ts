import 'dotenv/config';
import { TaskClient, textPart, decodeInlineArtifact } from '@blocks-network/sdk';
import type { ProgressEvent, ArtifactEvent, TerminalEvent } from '@blocks-network/sdk';

/**
 * Calls the delivery_slot_estimator agent (agent-to-agent / consumer path) and
 * prints the estimated delivery window.
 * Usage: npx tsx trigger.ts
 *
 * Note: there is no jsonPart helper, so the structured order is JSON.stringify'd
 * into a text part (see FRICTION-LOG F3).
 */
async function main() {
  const apiKey = process.env.BLOCKS_API_KEY;
  if (!apiKey) {
    console.error(
      "BLOCKS_API_KEY not set. Run 'blocks login --write-env' to copy your key into .env, or set it yourself.",
    );
    process.exit(1);
  }

  const order = {
    region: 'EU-East',
    weightKg: 45,
    serviceTier: 'standard',
    orderDate: '2026-10-30',
  };

  const client = await TaskClient.create({ billingMode: 'free', apiKey });

  const session = await client.sendMessage({
    agentName: 'delivery_slot_estimator',
    requestParts: [textPart(JSON.stringify(order), 'request')],
  });

  console.log('Task created:', session.taskId);
  console.log('Order sent:', order);

  session.onProgress((event: ProgressEvent) => {
    console.log('[progress]', event.message ?? event.progress ?? '');
  });
  session.onArtifact(async (event: ArtifactEvent) => {
    const ref = event.artifactRef;
    const bytes =
      ref.kind === 'inline' && ref.data
        ? decodeInlineArtifact(ref)
        : (await session.downloadArtifact(ref)).data;
    console.log('[result]\n' + new TextDecoder().decode(bytes));
  });
  session.onTerminal((_event: TerminalEvent) => {
    console.log('[done] Task complete');
    session.close();
    client.destroy();
    process.exit(0);
  });
}

main().catch(console.error);
