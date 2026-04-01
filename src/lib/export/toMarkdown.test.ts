import { describe, it, expect } from 'vitest';
import { toMarkdown } from './toMarkdown';

function doc(...content: any[]) { return { type: 'doc', content }; }
function p(...content: any[]) { return { type: 'paragraph', content }; }
function text(t: string, marks?: any[]) { const n: any = { type: 'text', text: t }; if (marks) n.marks = marks; return n; }
function heading(level: number, ...content: any[]) { return { type: 'heading', attrs: { level }, content }; }
function wikilink(label: string) { return { type: 'wikilink', attrs: { label } }; }

describe('toMarkdown', () => {
  it('returns empty string for non-doc', () => {
    expect(toMarkdown({ type: 'paragraph' })).toBe('');
  });

  it('converts a paragraph', () => {
    expect(toMarkdown(doc(p(text('Hello world'))))).toBe('Hello world');
  });

  it('converts headings', () => {
    expect(toMarkdown(doc(heading(1, text('Title'))))).toBe('# Title');
    expect(toMarkdown(doc(heading(2, text('Sub'))))).toBe('## Sub');
    expect(toMarkdown(doc(heading(3, text('Deep'))))).toBe('### Deep');
  });

  it('converts bold text', () => {
    expect(toMarkdown(doc(p(text('hello ', ), text('bold', [{ type: 'bold' }]))))).toBe('hello **bold**');
  });

  it('converts italic text', () => {
    expect(toMarkdown(doc(p(text('hello ', ), text('italic', [{ type: 'italic' }]))))).toBe('hello *italic*');
  });

  it('converts inline code', () => {
    expect(toMarkdown(doc(p(text('use '), text('foo()', [{ type: 'code' }]))))).toBe('use `foo()`');
  });

  it('converts strikethrough', () => {
    expect(toMarkdown(doc(p(text('no '), text('bad', [{ type: 'strike' }]))))).toBe('no ~~bad~~');
  });

  it('converts links', () => {
    expect(toMarkdown(doc(p(text('click ', ), text('here', [{ type: 'link', attrs: { href: 'https://example.com' } }]))))).toBe('click [here](https://example.com)');
  });

  it('converts wikilinks', () => {
    expect(toMarkdown(doc(p(text('See '), wikilink('Kira'))))).toBe('See [[Kira]]');
  });

  it('converts bullet lists', () => {
    const list = {
      type: 'bulletList', content: [
        { type: 'listItem', content: [p(text('Item 1'))] },
        { type: 'listItem', content: [p(text('Item 2'))] },
      ]
    };
    expect(toMarkdown(doc(list))).toBe('- Item 1\n- Item 2');
  });

  it('converts ordered lists', () => {
    const list = {
      type: 'orderedList', content: [
        { type: 'listItem', content: [p(text('First'))] },
        { type: 'listItem', content: [p(text('Second'))] },
      ]
    };
    expect(toMarkdown(doc(list))).toBe('1. First\n2. Second');
  });

  it('converts code blocks', () => {
    const code = { type: 'codeBlock', attrs: { language: 'js' }, content: [text('const x = 1')] };
    expect(toMarkdown(doc(code))).toBe('```js\nconst x = 1\n```');
  });

  it('converts blockquotes', () => {
    const quote = { type: 'blockquote', content: [p(text('wise words'))] };
    expect(toMarkdown(doc(quote))).toBe('> wise words');
  });

  it('converts horizontal rule', () => {
    expect(toMarkdown(doc(p(text('above')), { type: 'horizontalRule' }, p(text('below'))))).toBe('above\n\n---\n\nbelow');
  });

  it('converts images', () => {
    const img = { type: 'image', attrs: { src: 'img.png', alt: 'photo' } };
    expect(toMarkdown(doc(img))).toBe('![photo](img.png)');
  });

  it('handles multiple paragraphs', () => {
    expect(toMarkdown(doc(p(text('Para 1')), p(text('Para 2'))))).toBe('Para 1\n\nPara 2');
  });
});
