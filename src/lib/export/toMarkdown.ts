interface TipTapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, any> }[];
}

export function toMarkdown(doc: TipTapNode): string {
  if (doc.type !== 'doc' || !doc.content) return '';
  return doc.content.map((node) => blockToMarkdown(node)).join('\n\n');
}

function blockToMarkdown(node: TipTapNode): string {
  switch (node.type) {
    case 'paragraph':
      return inlineContent(node.content);

    case 'heading': {
      const level = node.attrs?.level ?? 1;
      const prefix = '#'.repeat(level);
      return `${prefix} ${inlineContent(node.content)}`;
    }

    case 'bulletList':
      return (node.content ?? [])
        .map((item) => listItemToMarkdown(item, '- '))
        .join('\n');

    case 'orderedList':
      return (node.content ?? [])
        .map((item, i) => listItemToMarkdown(item, `${i + 1}. `))
        .join('\n');

    case 'taskList':
      return (node.content ?? [])
        .map((item) => {
          const checked = item.attrs?.checked ? 'x' : ' ';
          return listItemToMarkdown(item, `- [${checked}] `);
        })
        .join('\n');

    case 'listItem':
    case 'taskItem':
      return inlineContent(node.content);

    case 'codeBlock': {
      const lang = node.attrs?.language ?? '';
      return `\`\`\`${lang}\n${plainText(node.content)}\n\`\`\``;
    }

    case 'blockquote': {
      const inner = (node.content ?? [])
        .map((child) => blockToMarkdown(child))
        .join('\n');
      return inner
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    }

    case 'horizontalRule':
      return '---';

    case 'image': {
      const src = node.attrs?.src ?? '';
      const alt = node.attrs?.alt ?? '';
      return `![${alt}](${src})`;
    }

    default:
      return inlineContent(node.content);
  }
}

function listItemToMarkdown(item: TipTapNode, prefix: string): string {
  const blocks = item.content ?? [];
  return blocks
    .map((block, i) => {
      const text = blockToMarkdown(block);
      if (i === 0) return `${prefix}${text}`;
      return `  ${text}`;
    })
    .join('\n');
}

function inlineContent(content?: TipTapNode[]): string {
  if (!content) return '';
  return content.map((node) => inlineNodeToMarkdown(node)).join('');
}

function inlineNodeToMarkdown(node: TipTapNode): string {
  if (node.type === 'text') {
    let text = node.text ?? '';
    if (node.marks) {
      for (const mark of node.marks) {
        text = applyMark(text, mark);
      }
    }
    return text;
  }

  if (node.type === 'wikilink') {
    return `[[${node.attrs?.label ?? ''}]]`;
  }

  if (node.type === 'image') {
    const src = node.attrs?.src ?? '';
    const alt = node.attrs?.alt ?? '';
    return `![${alt}](${src})`;
  }

  if (node.type === 'hardBreak') {
    return '\n';
  }

  return inlineContent(node.content);
}

function applyMark(text: string, mark: { type: string; attrs?: Record<string, any> }): string {
  switch (mark.type) {
    case 'bold':
      return `**${text}**`;
    case 'italic':
      return `*${text}*`;
    case 'code':
      return `\`${text}\``;
    case 'strike':
      return `~~${text}~~`;
    case 'link':
      return `[${text}](${mark.attrs?.href ?? ''})`;
    default:
      return text;
  }
}

function plainText(content?: TipTapNode[]): string {
  if (!content) return '';
  return content.map((node) => node.text ?? '').join('');
}
