import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://delishafrica.me",
  output: "static",
  trailingSlash: "always",
  compressHTML: true,
  build: { format: "directory" }
});
