export const createHiddenCustomerId = () =>
  `CUS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
