#!/usr/bin/env node
import { listModels, chatCompletion, chatCompletionStream, embeddings } from './src/oai_client.mjs';

const args = process.argv.slice(2);
const cmd = args[0] || 'help';

function getArg(k, def=null) {
  const i = args.indexOf(k);
  if (i >= 0 && i + 1 < args.length) return args[i+1];
  return def;
}

async function run() {
  if (cmd === 'models') {
    const out = await listModels();
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  if (cmd === 'chat') {
    const model = getArg('--model');
    const text = getArg('-m') || getArg('--message');
    const stream = args.includes('--stream');
    if (!text) { console.error('chat requires -m "message"'); process.exit(2); }
    const messages = [{ role: 'user', content: text }];
    if (stream) {
      for await (const { delta } of chatCompletionStream({ model, messages })) {
        process.stdout.write(delta);
      }
      process.stdout.write('\n');
      return;
    }
    const res = await chatCompletion({ model, messages });
    console.log(res.text);
    return;
  }
  if (cmd === 'embed') {
    const model = getArg('--model');
    const input = getArg('--input');
    if (!input) { console.error('embed requires --input'); process.exit(2); }
    const out = await embeddings({ model, input });
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  console.log(`RanchHand CLI
Usage:
  ranchhand models
  ranchhand chat -m "Hello" [--model llama3:latest] [--stream]
  ranchhand embed --input "some text" [--model llama3:latest]
`);
}

run().catch((e) => { console.error('Error:', e?.message || e); process.exit(1); });

