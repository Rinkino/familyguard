/** In-memory, per-launch flags shared between screens. */
export const flags = {
  /** Set when onboarding finishes so the Map can offer "Add your first person" once. */
  offerAddPerson: false,
  /** Set after saving a zone so the Map flies in to it, then eases out. */
  focusZone: null as null | { center: { latitude: number; longitude: number }; radiusM: number },
};
