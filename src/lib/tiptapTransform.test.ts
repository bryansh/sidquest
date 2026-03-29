import { describe, it, expect } from 'vitest';
import { insertWikilinksInDoc, type WikilinkTarget } from './tiptapTransform';

function makeDoc(...content: any[]) {
  return { type: 'doc', content };
}

function p(...content: any[]) {
  return { type: 'paragraph', content };
}

function text(t: string, marks?: any[]) {
  const node: any = { type: 'text', text: t };
  if (marks) node.marks = marks;
  return node;
}

function wikilink(entityId: string, label: string) {
  return {
    type: 'mention',
    attrs: { id: null, noteId: null, entityId, label },
  };
}

function entityMap(entries: [string, string][]): Map<string, WikilinkTarget> {
  return new Map(entries.map(([name, id]) => [name, { entityId: id, label: name }]));
}

describe('insertWikilinksInDoc', () => {
  it('returns doc unchanged when entity map is empty', () => {
    const doc = makeDoc(p(text('Hello world')));
    const result = insertWikilinksInDoc(doc, new Map());
    expect(result).toEqual(doc);
  });

  it('returns doc unchanged when no matches found', () => {
    const doc = makeDoc(p(text('Hello world')));
    const result = insertWikilinksInDoc(doc, entityMap([['Kira', 'e1']]));
    expect(result).toEqual(doc);
  });

  it('replaces a single entity name with a wikilink', () => {
    const doc = makeDoc(p(text('We met Kira at the keep')));
    const result = insertWikilinksInDoc(doc, entityMap([['Kira', 'e1']]));
    expect(result).toEqual(
      makeDoc(p(
        text('We met '),
        wikilink('e1', 'Kira'),
        text(' at the keep'),
      ))
    );
  });

  it('replaces multiple entity names in the same text node', () => {
    const doc = makeDoc(p(text('Kira fought Theron in the arena')));
    const result = insertWikilinksInDoc(doc, entityMap([['Kira', 'e1'], ['Theron', 'e2']]));
    expect(result).toEqual(
      makeDoc(p(
        wikilink('e1', 'Kira'),
        text(' fought '),
        wikilink('e2', 'Theron'),
        text(' in the arena'),
      ))
    );
  });

  it('handles entity name at start of text', () => {
    const doc = makeDoc(p(text('Kira is a rogue')));
    const result = insertWikilinksInDoc(doc, entityMap([['Kira', 'e1']]));
    expect(result).toEqual(
      makeDoc(p(
        wikilink('e1', 'Kira'),
        text(' is a rogue'),
      ))
    );
  });

  it('handles entity name at end of text', () => {
    const doc = makeDoc(p(text('We spoke with Kira')));
    const result = insertWikilinksInDoc(doc, entityMap([['Kira', 'e1']]));
    expect(result).toEqual(
      makeDoc(p(
        text('We spoke with '),
        wikilink('e1', 'Kira'),
      ))
    );
  });

  it('handles entity name as entire text', () => {
    const doc = makeDoc(p(text('Kira')));
    const result = insertWikilinksInDoc(doc, entityMap([['Kira', 'e1']]));
    expect(result).toEqual(
      makeDoc(p(wikilink('e1', 'Kira')))
    );
  });

  it('is case-insensitive', () => {
    const doc = makeDoc(p(text('we met KIRA and kira was nice')));
    const result = insertWikilinksInDoc(doc, entityMap([['Kira', 'e1']]));
    expect(result.content[0].content).toHaveLength(5);
    expect(result.content[0].content[1]).toEqual(wikilink('e1', 'Kira'));
    expect(result.content[0].content[3]).toEqual(wikilink('e1', 'Kira'));
  });

  it('preserves marks on split text nodes', () => {
    const boldMark = [{ type: 'bold' }];
    const doc = makeDoc(p(text('Bold Kira here', boldMark)));
    const result = insertWikilinksInDoc(doc, entityMap([['Kira', 'e1']]));
    expect(result).toEqual(
      makeDoc(p(
        text('Bold ', boldMark),
        wikilink('e1', 'Kira'),
        text(' here', boldMark),
      ))
    );
  });

  it('does not touch existing wikilinks', () => {
    const doc = makeDoc(p(
      text('See '),
      wikilink('e1', 'Kira'),
      text(' for details'),
    ));
    const result = insertWikilinksInDoc(doc, entityMap([['Kira', 'e1']]));
    expect(result).toEqual(doc);
  });

  it('handles multiple paragraphs', () => {
    const doc = makeDoc(
      p(text('Kira was there')),
      p(text('Theron fought')),
    );
    const result = insertWikilinksInDoc(doc, entityMap([['Kira', 'e1'], ['Theron', 'e2']]));
    expect(result.content[0].content[0]).toEqual(wikilink('e1', 'Kira'));
    expect(result.content[1].content[0]).toEqual(wikilink('e2', 'Theron'));
  });

  it('handles nested content (bullet lists)', () => {
    const doc = makeDoc({
      type: 'bulletList',
      content: [{
        type: 'listItem',
        content: [p(text('Met Kira'))],
      }],
    });
    const result = insertWikilinksInDoc(doc, entityMap([['Kira', 'e1']]));
    expect(result.content[0].content[0].content[0].content).toEqual([
      text('Met '),
      wikilink('e1', 'Kira'),
    ]);
  });

  it('handles null/empty doc gracefully', () => {
    expect(insertWikilinksInDoc(null, entityMap([['Kira', 'e1']]))).toBeNull();
    expect(insertWikilinksInDoc({}, entityMap([['Kira', 'e1']]))).toEqual({});
    expect(insertWikilinksInDoc({ type: 'doc' }, entityMap([['Kira', 'e1']]))).toEqual({ type: 'doc' });
  });

  it('prefers longer entity names over shorter ones', () => {
    const doc = makeDoc(p(text('The Iron Keep was abandoned')));
    const result = insertWikilinksInDoc(doc, entityMap([['Iron Keep', 'e1'], ['Iron', 'e2']]));
    expect(result).toEqual(
      makeDoc(p(
        text('The '),
        wikilink('e1', 'Iron Keep'),
        text(' was abandoned'),
      ))
    );
  });

  it('does not match partial words', () => {
    const doc = makeDoc(p(text('The Kiran people live here')));
    const result = insertWikilinksInDoc(doc, entityMap([['Kira', 'e1']]));
    // "Kiran" should NOT match "Kira" — word boundary
    expect(result).toEqual(doc);
  });
});
