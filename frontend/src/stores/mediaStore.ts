import { create } from 'zustand';

interface MediaStore {
  // Media viewer state
  viewerOpen: boolean;
  currentMediaId: string | null;
  currentMediaIndex: number;
  mediaList: string[]; // List of media IDs for navigation

  // Upload modal state
  uploadModalOpen: boolean;
  uploadProgress: number;
  uploadingFileName: string | null;

  // Actions
  openViewer: (mediaId: string, mediaList: string[], index: number) => void;
  closeViewer: () => void;
  navigateNext: () => void;
  navigatePrevious: () => void;

  openUploadModal: () => void;
  closeUploadModal: () => void;
  setUploadProgress: (progress: number, fileName?: string) => void;
  resetUploadProgress: () => void;
}

export const useMediaStore = create<MediaStore>((set, get) => ({
  // Initial state
  viewerOpen: false,
  currentMediaId: null,
  currentMediaIndex: 0,
  mediaList: [],

  uploadModalOpen: false,
  uploadProgress: 0,
  uploadingFileName: null,

  // Viewer actions
  openViewer: (mediaId, mediaList, index) =>
    set({
      viewerOpen: true,
      currentMediaId: mediaId,
      mediaList,
      currentMediaIndex: index,
    }),

  closeViewer: () =>
    set({
      viewerOpen: false,
      currentMediaId: null,
      currentMediaIndex: 0,
      mediaList: [],
    }),

  navigateNext: () => {
    const { currentMediaIndex, mediaList } = get();
    const nextIndex = (currentMediaIndex + 1) % mediaList.length;
    set({
      currentMediaIndex: nextIndex,
      currentMediaId: mediaList[nextIndex],
    });
  },

  navigatePrevious: () => {
    const { currentMediaIndex, mediaList } = get();
    const prevIndex =
      currentMediaIndex === 0 ? mediaList.length - 1 : currentMediaIndex - 1;
    set({
      currentMediaIndex: prevIndex,
      currentMediaId: mediaList[prevIndex],
    });
  },

  // Upload modal actions
  openUploadModal: () => set({ uploadModalOpen: true }),

  closeUploadModal: () =>
    set({
      uploadModalOpen: false,
      uploadProgress: 0,
      uploadingFileName: null,
    }),

  setUploadProgress: (progress, fileName) =>
    set({
      uploadProgress: progress,
      uploadingFileName: fileName ?? get().uploadingFileName,
    }),

  resetUploadProgress: () =>
    set({
      uploadProgress: 0,
      uploadingFileName: null,
    }),
}));
