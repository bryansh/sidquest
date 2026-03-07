export interface Note {
  id: string;
  entityId: string;
  gameId: string;
  title: string;
  content: any; // TipTap JSON
}

export const noteState = $state<{
  activeEntityId: string | null;
  activeNoteId: string | null;
  notes: Note[];
}>({
  activeEntityId: null,
  activeNoteId: null,
  notes: [],
});
