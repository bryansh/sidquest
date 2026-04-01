import { describe, it, expect } from 'vitest';
import { formatBytes, filenameFromUrl, getModelInvokeParams, type LocalModelDef } from './models';

describe('formatBytes', () => {
  it('formats gigabytes', () => {
    expect(formatBytes(7_840_000_000)).toBe('7.8 GB');
    expect(formatBytes(1_000_000_000)).toBe('1.0 GB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(148_000_000)).toBe('148 MB');
    expect(formatBytes(1_000_000)).toBe('1 MB');
  });

  it('formats small values as bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(0)).toBe('0 B');
  });
});

describe('filenameFromUrl', () => {
  it('extracts filename from HuggingFace URL', () => {
    expect(filenameFromUrl('https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf'))
      .toBe('Qwen2.5-7B-Instruct-Q4_K_M.gguf');
  });

  it('extracts filename from simple URL', () => {
    expect(filenameFromUrl('https://example.com/models/model.gguf')).toBe('model.gguf');
  });

  it('handles URL with no path', () => {
    expect(filenameFromUrl('https://example.com/')).toBe('model.gguf');
  });

  it('handles invalid URL gracefully', () => {
    expect(filenameFromUrl('not-a-url/model.gguf')).toBe('model.gguf');
  });
});

describe('getModelInvokeParams', () => {
  it('returns empty object for undefined model', () => {
    expect(getModelInvokeParams(undefined)).toEqual({});
  });

  it('returns empty object for non-custom model', () => {
    const model = { id: 'gemma3-12b', custom: false } as LocalModelDef;
    expect(getModelInvokeParams(model)).toEqual({});
  });

  it('returns filename, chatTemplate, contextWindow for custom model', () => {
    const model: LocalModelDef = {
      id: 'custom-test', name: 'Test', filename: 'test.gguf', url: 'https://example.com',
      size_bytes: 0, context_window: 4096, chat_template: 'llama3',
      model_type: 'generation', embedding_dim: null, custom: true,
    };
    expect(getModelInvokeParams(model)).toEqual({
      filename: 'test.gguf',
      chatTemplate: 'llama3',
      contextWindow: 4096,
    });
  });
});
