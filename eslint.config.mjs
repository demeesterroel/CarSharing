import nextConfig from "eslint-config-next";

const config = [
  { ignores: ["docs/**", ".next/**", "public/**", "scripts/**", ".worktrees/**"] },
  ...nextConfig,
  {
    rules: {
      // React Compiler rules: intentional patterns in this codebase
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/incompatible-library": "warn",
      // Custom rules for Issue #373
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
];

export default config;
