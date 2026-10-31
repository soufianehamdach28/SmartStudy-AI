module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Zod 4 ships ESM files using `export * as ns from`, which Metro's Babel
    // preset does not transform on its own.
    '@babel/plugin-transform-export-namespace-from',
  ],
};
