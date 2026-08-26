import { defineConfig } from 'vite';

/**
 * Dev convenience only. Production serves the source files straight out of the
 * cPanel checkout, so nothing here affects the live site.
 *
 * The port comes from the environment rather than being hardcoded, so the
 * tooling can place this server on whatever port happens to be free. With no
 * PORT set, Vite picks its own default and steps to the next free port if that
 * one is taken.
 */
export default defineConfig({
    server: {
        port: process.env.PORT ? Number(process.env.PORT) : undefined,
        strictPort: false,
    },
});
