import { describe, it, expect } from 'vitest';
import { serialize, restoreWikilinks, deserialize } from './cleanupRoundtrip';

describe('serialize', () => {
  it('serializes a simple paragraph', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }] };
    const { text } = serialize(doc);
    expect(text).toContain('Hello world');
  });

  it('serializes wikilinks as [[label]]', () => {
    const doc = {
      type: 'doc', content: [{
        type: 'paragraph', content: [
          { type: 'text', text: 'Met ' },
          { type: 'wikilink', attrs: { noteId: 'n1', entityId: 'e1', label: 'Kira' } },
          { type: 'text', text: ' today' },
        ]
      }]
    };
    const { text, wikilinkMap } = serialize(doc);
    expect(text).toContain('Met [[Kira]] today');
    expect(wikilinkMap.get('kira')).toBeDefined();
    expect(wikilinkMap.get('kira')?.entityId).toBe('e1');
  });

  it('serializes headings with # prefix', () => {
    const doc = {
      type: 'doc', content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
      ]
    };
    const { text } = serialize(doc);
    expect(text).toContain('## Title');
  });

  it('serializes bullet lists', () => {
    const doc = {
      type: 'doc', content: [{
        type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }] },
        ]
      }]
    };
    const { text } = serialize(doc);
    expect(text).toContain('- Item 1');
    expect(text).toContain('- Item 2');
  });

  it('collects multiple wikilinks into map', () => {
    const doc = {
      type: 'doc', content: [{
        type: 'paragraph', content: [
          { type: 'wikilink', attrs: { noteId: null, entityId: 'e1', label: 'Kira' } },
          { type: 'text', text: ' and ' },
          { type: 'wikilink', attrs: { noteId: null, entityId: 'e2', label: 'Theron' } },
        ]
      }]
    };
    const { wikilinkMap } = serialize(doc);
    expect(wikilinkMap.size).toBe(2);
    expect(wikilinkMap.has('kira')).toBe(true);
    expect(wikilinkMap.has('theron')).toBe(true);
  });
});

describe('restoreWikilinks', () => {
  const map = new Map([
    ['kira', { id: '', noteId: null, entityId: 'e1', label: 'Kira' }],
    ['iron keep', { id: '', noteId: null, entityId: 'e2', label: 'Iron Keep' }],
  ]);

  it('restores bare entity names to [[wikilinks]]', () => {
    expect(restoreWikilinks('Met Kira at the tavern', map)).toBe('Met [[Kira]] at the tavern');
  });

  it('preserves already-bracketed wikilinks', () => {
    expect(restoreWikilinks('Met [[Kira]] at the tavern', map)).toBe('Met [[Kira]] at the tavern');
  });

  it('is case insensitive', () => {
    expect(restoreWikilinks('met KIRA today', map)).toBe('met [[Kira]] today');
  });

  it('handles multi-word entities', () => {
    expect(restoreWikilinks('Went to Iron Keep', map)).toBe('Went to [[Iron Keep]]');
  });

  it('strips wikilinks invented by the model (not in map)', () => {
    expect(restoreWikilinks('Met [[Unknown Person]] there', map)).toBe('Met Unknown Person there');
  });

  it('handles empty map — strips all wikilinks', () => {
    const emptyMap = new Map();
    expect(restoreWikilinks('Met [[Kira]] and [[Bob]]', emptyMap)).toBe('Met Kira and Bob');
  });
});

describe('deserialize', () => {
  const map = new Map([
    ['kira', { id: '', noteId: null, entityId: 'e1', label: 'Kira' }],
  ]);

  it('deserializes a simple paragraph', () => {
    const doc = deserialize('Hello world', map);
    expect(doc.type).toBe('doc');
    expect(doc.content?.length).toBe(1);
    expect(doc.content?.[0].type).toBe('paragraph');
  });

  it('deserializes headings', () => {
    const doc = deserialize('## My Heading', map);
    expect(doc.content?.[0].type).toBe('heading');
    expect(doc.content?.[0].attrs?.level).toBe(2);
  });

  it('deserializes wikilinks in text', () => {
    const doc = deserialize('Met [[Kira]] today', map);
    const para = doc.content?.[0];
    expect(para?.content?.length).toBe(3);
    expect(para?.content?.[0]).toEqual({ type: 'text', text: 'Met ' });
    expect(para?.content?.[1].type).toBe('wikilink');
    expect(para?.content?.[1].attrs?.entityId).toBe('e1');
    expect(para?.content?.[2]).toEqual({ type: 'text', text: ' today' });
  });

  it('deserializes bullet lists', () => {
    const doc = deserialize('- Item 1\n- Item 2', map);
    expect(doc.content?.[0].type).toBe('bulletList');
    expect(doc.content?.[0].content?.length).toBe(2);
  });

  it('deserializes ordered lists', () => {
    const doc = deserialize('1. First\n2. Second', map);
    expect(doc.content?.[0].type).toBe('orderedList');
    expect(doc.content?.[0].content?.length).toBe(2);
  });

  it('deserializes blockquotes', () => {
    const doc = deserialize('> wise words', map);
    expect(doc.content?.[0].type).toBe('blockquote');
  });

  it('deserializes code blocks', () => {
    const doc = deserialize('```\nconst x = 1\n```', map);
    expect(doc.content?.[0].type).toBe('codeBlock');
  });

  it('returns at least one paragraph for empty text', () => {
    const doc = deserialize('', map);
    expect(doc.content?.length).toBe(1);
    expect(doc.content?.[0].type).toBe('paragraph');
  });

  it('roundtrips: serialize then deserialize preserves structure', () => {
    const original = {
      type: 'doc' as const, content: [
        { type: 'heading' as const, attrs: { level: 2 }, content: [{ type: 'text' as const, text: 'NPCs' }] },
        { type: 'paragraph' as const, content: [
          { type: 'text' as const, text: 'Met ' },
          { type: 'wikilink' as const, attrs: { id: '', noteId: null, entityId: 'e1', label: 'Kira' } },
          { type: 'text' as const, text: ' at the keep' },
        ]},
      ]
    };
    const { text, wikilinkMap } = serialize(original);
    const restored = deserialize(text, wikilinkMap);
    expect(restored.content?.length).toBeGreaterThanOrEqual(2);
    // Find the paragraph with the wikilink
    const paraWithLink = restored.content?.find(n =>
      n.content?.some((c: any) => c.type === 'wikilink')
    );
    expect(paraWithLink).toBeDefined();
    const wl = paraWithLink?.content?.find((c: any) => c.type === 'wikilink');
    expect(wl?.attrs?.entityId).toBe('e1');
  });
});
