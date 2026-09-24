export const canonicalizeProblemInput = (input: string): string => (
  input.trim().replace(/\s+/g, ' ')
);
