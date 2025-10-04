import { describe, it, expect, vi } from 'vitest';
import * as oai from '../src/oai_client.mjs';

describe('oai_client httpJson and helpers', () => {
  it('listModels returns parsed json on 200', async () => {
    const mock = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ data: [{ id: 'm1' }] }),
    });
    const out = await oai.listModels();
    expect(out).toEqual({ data: [{ id: 'm1' }] });
    mock.mockRestore();
  });

  it('chatCompletion extracts text', async () => {
    const payload = { choices: [{ message: { content: 'hello' } }] };
    const mock = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(payload),
    });
    const out = await oai.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });
    expect(out.text).toBe('hello');
    expect(out.raw).toEqual(payload);
    mock.mockRestore();
  });

  it('httpJson times out with AbortController', async () => {
    const original = process.env.OAI_TIMEOUT_MS;
    process.env.OAI_TIMEOUT_MS = '10';
    const mock = vi.spyOn(global, 'fetch').mockImplementation(async () => {
      return new Promise((_, reject) => setTimeout(() => reject(new Error('aborted')), 20));
    });
    await expect(oai.listModels()).rejects.toBeInstanceOf(Error);
    mock.mockRestore();
    process.env.OAI_TIMEOUT_MS = original;
  });
});
