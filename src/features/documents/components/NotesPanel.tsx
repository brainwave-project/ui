import { useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNotes, useAddNote, useUpdateNote, useDeleteNote } from '../hooks/useNotes';
import type { DocumentNote } from '@/api/notes.api';

interface Props {
  documentId: string;
}

export function NotesPanel({ documentId }: Props) {
  const { data: notes = [], isLoading } = useNotes(documentId);
  const addNote    = useAddNote(documentId);
  const updateNote = useUpdateNote(documentId);
  const deleteNote = useDeleteNote(documentId);

  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');

  async function handleAdd() {
    if (!draft.trim()) return;
    await addNote.mutateAsync(draft.trim());
    setDraft('');
  }

  function startEdit(note: DocumentNote) {
    setEditingId(note.id);
    setEditingBody(note.body);
  }

  async function saveEdit() {
    if (!editingId || !editingBody.trim()) return;
    await updateNote.mutateAsync({ noteId: editingId, body: editingBody.trim() });
    setEditingId(null);
    setEditingBody('');
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Notes</h3>
        <span className="text-xs text-muted-foreground">{notes.length}</span>
      </div>

      {/* Add new note */}
      <Card>
        <CardContent className="p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note about this document…"
            rows={3}
            className="w-full resize-none rounded-md border border-input bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              disabled={!draft.trim() || addNote.isPending}
              onClick={handleAdd}
            >
              {addNote.isPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Plus className="mr-2 h-4 w-4" />}
              Add note
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && notes.length === 0 && (
        <p className="text-xs text-muted-foreground">No notes yet.</p>
      )}

      {/* Existing notes */}
      <div className="space-y-2">
        {notes.map((note) => (
          <Card key={note.id}>
            <CardContent className="p-3 space-y-2">
              {editingId === note.id ? (
                <>
                  <textarea
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-md border border-input bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditingId(null); setEditingBody(''); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      disabled={!editingBody.trim() || updateNote.isPending}
                      onClick={saveEdit}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(note.createdAt).toLocaleString()}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => startEdit(note)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        disabled={deleteNote.isPending}
                        onClick={() => deleteNote.mutate(note.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
