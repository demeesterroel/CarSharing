import nextConfig from "eslint-config-next";

const config = [
  { ignores: ["docs/**", ".next/**", "public/**", "scripts/**"] },
  ...nextConfig,
  {
    rules: {
      // React Compiler rules: intentional patterns in this codebase
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },
];

export default config;
