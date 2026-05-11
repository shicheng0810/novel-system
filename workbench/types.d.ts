// Workbench-side ambient declarations.
//
// `lunar-javascript` ships as untyped CJS. The wrapper in
// `src/metaphysics/lunar-bazi.ts` casts to its own local types, but TS still
// needs an ambient module shim so transitive type-resolution from
// `@novel` exports doesn't fail with TS7016 when workbench files import
// types that reach into that module graph.
declare module "lunar-javascript";
