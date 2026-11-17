import { create } from 'zustand';

export type FavoriteTargetType = 'CONVERSATION' | 'FLASHCARD';

export interface FavoritesState {
  favorites: Record<string, boolean>;
  toggleFavorite: (targetType: FavoriteTargetType, targetId: string) => void;
  isFavorite: (targetType: FavoriteTargetType, targetId: string) => boolean;
  getFavoriteIds: (targetType: FavoriteTargetType) => string[];
  clearFavorites: () => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: {},

  toggleFavorite: (targetType: FavoriteTargetType, targetId: string) => {
    const key = `${targetType}:${targetId}`;
    set((state) => {
      const next = { ...state.favorites };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return { favorites: next };
    });
  },

  isFavorite: (targetType: FavoriteTargetType, targetId: string) => {
    const key = `${targetType}:${targetId}`;
    return Boolean(get().favorites[key]);
  },

  getFavoriteIds: (targetType: FavoriteTargetType) => {
    const prefix = `${targetType}:`;
    return Object.keys(get().favorites)
      .filter((k) => k.startsWith(prefix) && get().favorites[k])
      .map((k) => k.slice(prefix.length));
  },

  clearFavorites: () => {
    set({ favorites: {} });
  },
}));
