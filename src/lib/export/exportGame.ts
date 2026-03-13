import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { db } from '$lib/db/client';
import { notes, entities, entityTypes } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { toMarkdown } from './toMarkdown';

export async function exportGameAsZip(gameId: string, gameName: string) {
  const path = await save({
    defaultPath: `${gameName}.zip`,
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
  });
  if (!path) return;

  const { default: JSZip } = await import('jszip');

  const allNotes = await db.select().from(notes).where(eq(notes.gameId, gameId));
  const allEntities = await db.select().from(entities).where(eq(entities.gameId, gameId));
  const allTypes = await db.select().from(entityTypes).where(eq(entityTypes.gameId, gameId));

  const typeMap = new Map(allTypes.map((t) => [t.id, t.name]));
  const entityMap = new Map(allEntities.map((e) => [e.id, e]));

  const zip = new JSZip();

  for (const note of allNotes) {
    const entity = entityMap.get(note.entityId);
    if (!entity) continue;
    const typeName = typeMap.get(entity.entityTypeId) ?? 'Unknown';
    const safeName = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '-');
    const dir = `${safeName(typeName)}/${safeName(entity.name)}`;
    const filename = `${dir}/${safeName(note.title)}.md`;
    const md = note.content ? toMarkdown(note.content as any) : '';
    zip.file(filename, md);
  }

  const base64Data = await zip.generateAsync({ type: 'base64' });
  await invoke('save_export_file_binary', { path, base64Data });
}
