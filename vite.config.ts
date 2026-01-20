import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  base: "/Planning-Assistant/",
  plugins: [react()],
  server: {
    port: 5173,
  },
});
