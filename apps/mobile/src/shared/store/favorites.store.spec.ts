import { useFavoritesStore } from './favorites.store';

describe('useFavoritesStore', () => {
  beforeEach(() => {
    useFavoritesStore.getState().clearFavorites();
  });

  it('toggles favorites correctly for flashcards and conversations', () => {
    const store = useFavoritesStore.getState();

    expect(store.isFavorite('FLASHCARD', 'card-1')).toBe(false);

    // Toggle on
    store.toggleFavorite('FLASHCARD', 'card-1');
    expect(useFavoritesStore.getState().isFavorite('FLASHCARD', 'card-1')).toBe(
      true,
    );

    // Toggle off
    useFavoritesStore.getState().toggleFavorite('FLASHCARD', 'card-1');
    expect(useFavoritesStore.getState().isFavorite('FLASHCARD', 'card-1')).toBe(
      false,
    );
  });

  it('separates namespaces between conversation and flashcard targets', () => {
    const store = useFavoritesStore.getState();

    store.toggleFavorite('CONVERSATION', 'id-100');
    expect(
      useFavoritesStore.getState().isFavorite('CONVERSATION', 'id-100'),
    ).toBe(true);
    expect(
      useFavoritesStore.getState().isFavorite('FLASHCARD', 'id-100'),
    ).toBe(false);
  });

  it('returns list of favorite IDs for a target type', () => {
    const store = useFavoritesStore.getState();

    store.toggleFavorite('FLASHCARD', 'card-1');
    store.toggleFavorite('FLASHCARD', 'card-2');
    store.toggleFavorite('CONVERSATION', 'conv-1');

    const cardIds = useFavoritesStore.getState().getFavoriteIds('FLASHCARD');
    const convIds = useFavoritesStore
      .getState()
      .getFavoriteIds('CONVERSATION');

    expect(cardIds).toEqual(['card-1', 'card-2']);
    expect(convIds).toEqual(['conv-1']);
  });

  it('clears all favorites when clearFavorites is called', () => {
    const store = useFavoritesStore.getState();

    store.toggleFavorite('FLASHCARD', 'card-1');
    store.toggleFavorite('CONVERSATION', 'conv-1');

    useFavoritesStore.getState().clearFavorites();

    expect(useFavoritesStore.getState().getFavoriteIds('FLASHCARD')).toEqual([]);
    expect(
      useFavoritesStore.getState().getFavoriteIds('CONVERSATION'),
    ).toEqual([]);
  });
});
