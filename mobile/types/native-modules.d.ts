/**
 * Ambient module declarations for native packages whose published
 * `exports` field does not advertise a bare entry point (so the
 * TypeScript bundler resolver fails on `import "whisper.rn"`).
 *
 * Both modules are loaded lazily via dynamic `import(...)` and treated
 * as `any` at runtime; this shim just keeps tsc happy.
 */
declare module "whisper.rn";
declare module "react-native-litert-lm";
