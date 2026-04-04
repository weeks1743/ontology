// Teach TypeScript that *.yaml imports are typed as `any`
// This is handled at runtime by @modyfi/vite-plugin-yaml
declare module '*.yaml' {
  const content: any;
  export default content;
}
