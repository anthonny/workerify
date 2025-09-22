import workerify from "@workerify/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [workerify()],
});
