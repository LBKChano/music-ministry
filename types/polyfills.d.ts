declare module '@stardazed/streams-text-encoding' {
  export const TextEncoderStream: typeof globalThis.TextEncoderStream;
  export const TextDecoderStream: typeof globalThis.TextDecoderStream;
}

declare module '@ungap/structured-clone' {
  const structuredClone: typeof globalThis.structuredClone;
  export default structuredClone;
}
