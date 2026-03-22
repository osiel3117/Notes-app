import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    LayoutAnimation,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    UIManager,
    View,
} from 'react-native';

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

const STORAGE_KEY = 'notes-app:notes';

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editorError, setEditorError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    tone: 'success' | 'info';
  } | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isReadyToPersist, setIsReadyToPersist] = useState(false);
  const trimmedSearchQuery = searchQuery.trim().toLowerCase();
  const isSaveDisabled = !title.trim() || !content.trim();
  const filteredNotes = notes.filter((note) => {
    if (!trimmedSearchQuery) {
      return true;
    }

    return (
      note.title.toLowerCase().includes(trimmedSearchQuery) ||
      note.content.toLowerCase().includes(trimmedSearchQuery)
    );
  });

  useEffect(() => {
    if (!feedbackMessage) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setFeedbackMessage(null);
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [feedbackMessage]);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    const loadNotes = async () => {
      try {
        const storedNotes = await AsyncStorage.getItem(STORAGE_KEY);

        if (storedNotes) {
          const parsedNotes = JSON.parse(storedNotes) as unknown;

          if (Array.isArray(parsedNotes)) {
            const safeNotes = parsedNotes.filter(
              (note): note is Note =>
                typeof note === 'object' &&
                note !== null &&
                'id' in note &&
                'title' in note &&
                'content' in note &&
                'updatedAt' in note
            );

            setNotes(safeNotes);
          } else {
            setNotes([]);
          }
        }
      } catch {
        Alert.alert('Unable to load notes', 'Your saved notes could not be loaded.');
      } finally {
        setIsLoading(false);
        setIsReadyToPersist(true);
      }
    };

    void loadNotes();
  }, []);

  useEffect(() => {
    if (!isReadyToPersist) {
      return;
    }

    const persistNotes = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      } catch {
        Alert.alert('Unable to save notes', 'Changes could not be saved locally.');
      }
    };

    void persistNotes();
  }, [notes, isReadyToPersist]);

  const resetEditor = () => {
    setTitle('');
    setContent('');
    setEditorError('');
    setSelectedNoteId(null);
  };

  const openCreateNote = () => {
    resetEditor();
    setFeedbackMessage(null);
    setIsEditorVisible(true);
  };

  const openEditNote = (note: Note) => {
    setTitle(note.title);
    setContent(note.content);
    setEditorError('');
    setFeedbackMessage(null);
    setSelectedNoteId(note.id);
    setIsEditorVisible(true);
  };

  const closeEditor = () => {
    setIsEditorVisible(false);
    resetEditor();
  };

  const saveNote = () => {
    const validationError = getNoteValidationError(title, content);

    if (validationError) {
      setEditorError(validationError);
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    setEditorError('');

    const updatedAt = new Date().toISOString();

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (selectedNoteId) {
      setNotes((currentNotes) =>
        currentNotes
          .map((note) =>
            note.id === selectedNoteId
              ? {
                  ...note,
                  title: trimmedTitle,
                  content: trimmedContent,
                  updatedAt,
                }
              : note
          )
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      );
      setFeedbackMessage({ text: 'Note updated.', tone: 'success' });
    } else {
      const newNote: Note = {
        id: Date.now().toString(),
        title: trimmedTitle,
        content: trimmedContent,
        updatedAt,
      };

      setNotes((currentNotes) => [newNote, ...currentNotes]);
      setFeedbackMessage({ text: 'Note created.', tone: 'success' });
    }

    closeEditor();
  };

  const performDeleteNote = (noteId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNotes((currentNotes) => currentNotes.filter((note) => note.id !== noteId));
    setFeedbackMessage({ text: 'Note deleted.', tone: 'info' });

    if (selectedNoteId === noteId) {
      closeEditor();
    }
  };

  const deleteNote = (noteId: string) => {
    if (Platform.OS === 'web') {
      const confirmed = typeof globalThis.confirm === 'function'
        ? globalThis.confirm('Delete this note? This action cannot be undone.')
        : true;

      if (!confirmed) {
        return;
      }

      performDeleteNote(noteId);
      return;
    }

    Alert.alert('Delete note', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => performDeleteNote(noteId),
      },
    ]);
  };

  const renderNote = ({ item }: { item: Note }) => (
    <View style={styles.noteCard}>
      <View style={styles.noteHeader}>
        <Pressable
          style={({ pressed }) => [styles.noteMainPressable, pressed && styles.noteCardPressed]}
          onPress={() => openEditNote(item)}>
          <View style={styles.noteTitleBlock}>
            <Text style={styles.noteTitle}>{item.title}</Text>
            <Text style={styles.noteDate}>{formatNoteDate(item.updatedAt)}</Text>
          </View>

          <Text numberOfLines={3} style={styles.noteContent}>
            {item.content}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.deleteChip, pressed && styles.deleteChipPressed]}
          onPress={(event) => {
            event.stopPropagation?.();
            deleteNote(item.id);
          }}
          hitSlop={10}>
          <Feather name="trash-2" size={13} color="#8d6e63" />
        </Pressable>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3f5b4b" />
          <Text style={styles.loadingText}>Loading notes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <View>
                <Text style={styles.eyebrow}>Workspace</Text>
                <Text style={styles.heading}>My notes</Text>
              </View>
              <View style={styles.headerPill}>
                <Text style={styles.headerPillText}>{notes.length}</Text>
              </View>
            </View>
            <Text style={styles.subheading}>
              {notes.length === 0
                ? 'No notes yet'
                : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
            </Text>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search notes"
              placeholderTextColor="#98a29b"
              style={styles.searchInput}
            />
          </View>

          {notes.length === 0 && !trimmedSearchQuery ? (
            <Text style={styles.noNotesHint}>No notes yet. Tap New note to create your first one.</Text>
          ) : null}
        </View>

        {feedbackMessage ? (
          <View
            style={[
              styles.feedbackBanner,
              feedbackMessage.tone === 'success' ? styles.feedbackBannerSuccess : styles.feedbackBannerInfo,
            ]}>
            <Text style={styles.feedbackText}>{feedbackMessage.text}</Text>
          </View>
        ) : null}

        <FlatList
          data={filteredNotes}
          keyExtractor={(item) => item.id}
          renderItem={renderNote}
          contentContainerStyle={filteredNotes.length === 0 ? styles.emptyListContent : styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.noteSpacer} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyBadge}>
                <Text style={styles.emptyBadgeText}>{trimmedSearchQuery ? 'SEARCH' : 'NOTES'}</Text>
              </View>
              <Text style={styles.emptyTitle}>
                {trimmedSearchQuery ? 'No matching notes' : 'Nothing here yet'}
              </Text>
              <Text style={styles.emptyText}>
                {trimmedSearchQuery
                  ? 'Try a different keyword or clear the search to browse all notes.'
                  : 'Create your first note and keep quick thoughts, plans, or reminders in one place.'}
              </Text>
              {trimmedSearchQuery ? (
                <Pressable
                  style={({ pressed }) => [styles.emptyAction, pressed && styles.emptyActionPressed]}
                  onPress={() => setSearchQuery('')}>
                  <Text style={styles.emptyActionText}>Clear Search</Text>
                </Pressable>
              ) : null}
            </View>
          }
        />

        <Pressable
          style={({ pressed }) => [styles.floatingButton, pressed && styles.floatingButtonPressed]}
          onPress={openCreateNote}>
          <View style={styles.floatingButtonIconWrap}>
            <Text style={styles.floatingButtonPlus}>+</Text>
          </View>
          <Text style={styles.floatingButtonText}>New Note</Text>
        </Pressable>

        <Modal visible={isEditorVisible} animationType="slide" transparent onRequestClose={closeEditor}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>{selectedNoteId ? 'Editing' : 'New note'}</Text>
                  <Text style={styles.modalTitle}>{selectedNoteId ? 'Update note' : 'Create note'}</Text>
                </View>
                <Pressable style={({ pressed }) => pressed && styles.inlinePressed} onPress={closeEditor} hitSlop={10}>
                  <Text style={styles.modalClose}>Close</Text>
                </Pressable>
              </View>

              <TextInput
                value={title}
                onChangeText={(value) => {
                  setTitle(value);

                  if (editorError) {
                    setEditorError('');
                  }
                }}
                placeholder="Title"
                placeholderTextColor="#9ca3af"
                selectionColor="#31473a"
                style={styles.titleInput}
              />

              <TextInput
                value={content}
                onChangeText={(value) => {
                  setContent(value);

                  if (editorError) {
                    setEditorError('');
                  }
                }}
                placeholder="Write your note..."
                placeholderTextColor="#9ca3af"
                multiline
                textAlignVertical="top"
                selectionColor="#31473a"
                style={styles.contentInput}
              />

              {editorError ? <Text style={styles.validationText}>{editorError}</Text> : null}

              <View style={styles.modalActions}>
                {selectedNoteId ? (
                  <Pressable
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                    onPress={() => deleteNote(selectedNoteId)}>
                    <Feather name="trash-2" size={14} color="#7d6b61" />
                    <Text style={styles.secondaryButtonText}>Delete</Text>
                  </Pressable>
                ) : (
                  <View style={styles.modalActionSpacer} />
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.modalPrimaryButton,
                    isSaveDisabled && styles.modalPrimaryButtonDisabled,
                    pressed && !isSaveDisabled && styles.modalPrimaryButtonPressed,
                  ]}
                  disabled={isSaveDisabled}
                  onPress={saveNote}>
                  <Text style={styles.modalPrimaryButtonText}>Save note</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function formatNoteDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date();

  yesterday.setDate(now.getDate() - 1);

  if (isSameDay) {
    return `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getNoteValidationError(titleValue: string, contentValue: string) {
  const trimmedTitle = titleValue.trim();
  const trimmedContent = contentValue.trim();

  if (!trimmedTitle && !trimmedContent) {
    return 'Add a title and some content before saving.';
  }

  if (!trimmedTitle) {
    return 'Add a title before saving.';
  }

  if (!trimmedContent) {
    return 'Add some content before saving.';
  }

  return '';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#efe9df',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: 16,
    color: '#6f746f',
  },
  headerSection: {
    marginBottom: 20,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    borderRadius: 30,
    backgroundColor: '#fdf9f2',
    borderWidth: 1,
    borderColor: '#e7ddcf',
    shadowColor: '#7a6f61',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  header: {
    marginBottom: 16,
    gap: 6,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerPill: {
    minWidth: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 21,
    backgroundColor: '#f3eee5',
    borderWidth: 1,
    borderColor: '#e6dccf',
  },
  headerPillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#31473a',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#7f877d',
  },
  heading: {
    marginTop: 4,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
    color: '#18222b',
  },
  subheading: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 23,
    color: '#616973',
  },
  searchContainer: {
    marginBottom: 2,
  },
  noNotesHint: {
    marginTop: 10,
    fontSize: 13,
    color: '#7a8179',
  },
  feedbackBanner: {
    marginBottom: 14,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  feedbackBannerSuccess: {
    backgroundColor: '#eaf4ee',
    borderColor: '#cfe4d5',
  },
  feedbackBannerInfo: {
    backgroundColor: '#f2f4f7',
    borderColor: '#dce1e8',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#344054',
  },
  searchInput: {
    height: 54,
    borderRadius: 20,
    paddingHorizontal: 18,
    fontSize: 15,
    color: '#1f2933',
    backgroundColor: '#fffdfa',
    borderWidth: 1,
    borderColor: '#e2d7c8',
    shadowColor: '#7f7568',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  listContent: {
    paddingBottom: 120,
  },
  noteSpacer: {
    height: 16,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 120,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 42,
    borderRadius: 34,
    backgroundColor: '#fffdfa',
    borderWidth: 1,
    borderColor: '#e7ddcf',
    shadowColor: '#8f8476',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 5,
  },
  emptyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eef2ec',
    marginBottom: 18,
  },
  emptyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: '#5f6f63',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: '#1f2933',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    color: '#6f746f',
  },
  emptyAction: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#eef2ec',
  },
  emptyActionPressed: {
    opacity: 0.82,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3f5b4b',
  },
  noteCard: {
    backgroundColor: '#fffdfa',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#e6ddcf',
    gap: 16,
    shadowColor: '#7f7468',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 5,
  },
  noteCardPressed: {
    opacity: 0.97,
    transform: [{ scale: 0.988 }],
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  noteMainPressable: {
    flex: 1,
    gap: 16,
    borderRadius: 12,
  },
  noteTitleBlock: {
    gap: 7,
  },
  noteTitle: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    color: '#18222b',
  },
  deleteChip: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#f4eee5',
    borderWidth: 1,
    borderColor: '#e9dfd2',
  },
  deleteChipPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.94 }],
  },
  noteContent: {
    fontSize: 15,
    lineHeight: 24,
    color: '#56616b',
  },
  noteDate: {
    fontSize: 13,
    color: '#879089',
  },
  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2f4738',
    paddingLeft: 14,
    paddingRight: 19,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: '#2f4738',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 8,
  },
  floatingButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  floatingButtonIconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  floatingButtonPlus: {
    fontSize: 18,
    fontWeight: '500',
    color: '#ffffff',
  },
  floatingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(24, 30, 36, 0.3)',
  },
  modalCard: {
    backgroundColor: '#fffdfa',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 34,
    gap: 20,
    minHeight: '72%',
    shadowColor: '#161b21',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#ddd3c6',
    marginBottom: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modalEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#7f877d',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.7,
    color: '#18222b',
  },
  modalClose: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6a726b',
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#e4d9cb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    fontWeight: '600',
    color: '#18222b',
    backgroundColor: '#faf6ef',
  },
  contentInput: {
    flex: 1,
    minHeight: 240,
    borderWidth: 1,
    borderColor: '#e4d9cb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    lineHeight: 24,
    color: '#334155',
    backgroundColor: '#faf6ef',
  },
  validationText: {
    marginTop: -6,
    fontSize: 13,
    color: '#b54708',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  modalActionSpacer: {
    flex: 1,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e7ded1',
    backgroundColor: '#f5efe7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  secondaryButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7d6b61',
  },
  modalPrimaryButton: {
    backgroundColor: '#2f4738',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 18,
    shadowColor: '#2f4738',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 3,
  },
  modalPrimaryButtonDisabled: {
    opacity: 0.55,
  },
  modalPrimaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  modalPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  inlinePressed: {
    opacity: 0.72,
  },
});
