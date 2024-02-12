// rollup.config.mjs

import resolve from "@rollup/plugin-node-resolve";
import svelte from "rollup-plugin-svelte";
import sveltePreprocess from "svelte-preprocess";

export default {
    input: "./svelte/main.js",
    output: {
        format: "es",
        dir: "./../assets",
        name: "app",
        sourcemap: true
    },
    plugins: [
        svelte({
            include: ["./svelte/**/*.svelte", "./node_modules/**/*.svelte"],
            emitCss: false,
            preprocess: sveltePreprocess(),
        }),
        resolve({
            browser: true,
            exportConditions: ["svelte"],
            extensions: [".svelte"],
            dedupe: ['svelte'],
        }),
    ],
};
