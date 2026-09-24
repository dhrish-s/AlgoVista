export const measureSerializedBytes = (value: unknown): number => (
  new TextEncoder().encode(JSON.stringify(value)).byteLength
);
