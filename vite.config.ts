import { defineConfig } from 'vite';

// pipeline-rom/ADR-002: assets extraídos da ROM ficam fora do Git, então um worktree novo não os tem.
// ALPHA_PUBLIC_DIR aponta para o `public/` de outro checkout em vez de copiar ~670 MB por worktree.
export default defineConfig({
  publicDir: process.env.ALPHA_PUBLIC_DIR ?? 'public',
});
