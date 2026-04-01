import { describe, it, expect } from 'vitest';
import { extractWikilinkIds } from './wikilinks';

describe('extractWikilinkIds', () => {
  it('returns empty array for null/undefined doc', () => {
    expect(extractWikilinkIds(null)).toEqual([]);
    expect(extractWikilinkIds(undefined)).toEqual([]);
  });

  it('returns empty array for doc with no wikilinks', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] };
    expect(extractWikilinkIds(doc)).toEqual([]);
  });

  it('extracts noteId from wikilink nodes', () => {
    const doc = {
      type: 'doc', content: [{
        type: 'paragraph', content: [
          { type: 'wikilink', attrs: { noteId: 'note-1', entityId: 'ent-1', label: 'Kira' } },
        ]
      }]
    };
    expect(extractWikilinkIds(doc)).toEqual(['note-1']);
  });

  it('extracts multiple unique noteIds', () => {
    const doc = {
      type: 'doc', content: [{
        type: 'paragraph', content: [
          { type: 'wikilink', attrs: { noteId: 'note-1', entityId: null, label: 'A' } },
          { type: 'text', text: ' and ' },
          { type: 'wikilink', attrs: { noteId: 'note-2', entityId: null, label: 'B' } },
        ]
      }]
    };
    expect(extractWikilinkIds(doc)).toEqual(['note-1', 'note-2']);
  });

  it('deduplicates noteIds', () => {
    const doc = {
      type: 'doc', content: [
        { type: 'paragraph', content: [{ type: 'wikilink', attrs: { noteId: 'note-1', label: 'A' } }] },
        { type: 'paragraph', content: [{ type: 'wikilink', attrs: { noteId: 'note-1', label: 'A' } }] },
      ]
    };
    expect(extractWikilinkIds(doc)).toEqual(['note-1']);
  });

  it('ignores wikilinks without noteId', () => {
    const doc = {
      type: 'doc', content: [{
        type: 'paragraph', content: [
          { type: 'wikilink', attrs: { noteId: null, entityId: 'ent-1', label: 'Kira' } },
        ]
      }]
    };
    expect(extractWikilinkIds(doc)).toEqual([]);
  });

  it('finds wikilinks in nested content (lists)', () => {
    const doc = {
      type: 'doc', content: [{
        type: 'bulletList', content: [{
          type: 'listItem', content: [{
            type: 'paragraph', content: [
              { type: 'wikilink', attrs: { noteId: 'note-deep', label: 'Deep' } },
            ]
          }]
        }]
      }]
    };
    expect(extractWikilinkIds(doc)).toEqual(['note-deep']);
  });
});
