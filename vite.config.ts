import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Vite serves public/content in development and copies it during builds.
export default defineConfig({ plugins: [react()] });
