module.exports = {
  extends: ["airbnb", "plugin:@typescript-eslint/recommended", "plugin:jest/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "jest"],
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"]
    },
    "import/resolver": {
      typescript: {}
    }
  },
  rules: {
    "react/jsx-filename-extension": [
      2,
      { extensions: [".js", ".jsx", ".ts", ".tsx"] }
    ],
    "import/no-extraneous-dependencies": [
      2,
      { devDependencies: ["**/test.tsx", "**/test.ts"] }
    ],
    "@typescript-eslint/indent": [2, 2],
    "@typescript-eslint/interface-name-prefix": 0,
    "import/prefer-default-export": 0,
    "@typescript-eslint/no-explicit-any": 0,
    quotes: [2, "backtick"],
    "import/extensions": 0,
    "@typescript-eslint/explicit-function-return-type": 0
  }
};
