import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Le moteur ne dépend d'aucune API navigateur : pas de jsdom, tests plus rapides.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
