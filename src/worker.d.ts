declare module "*.worker.ts" {
  declare class _W extends Worker {}
  export default _W;
}
