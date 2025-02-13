import type { UserConfig as _ViteUserConfig } from "vite";

export type UserConfig = {
  vite: _ViteUserConfig;
};

export const defineConfig = (config: UserConfig) => config;

