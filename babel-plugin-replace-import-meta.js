/**
 * Babel plugin: replace `import.meta` (Vite-specific syntax)
 * with safe fallbacks so Metro/Web can bundle zustand v5.
 *
 *   import.meta.env.MODE  →  "development"
 *   import.meta.env       →  { MODE: "development" }
 *   import.meta.url        →  ""   (safe empty string)
 *   import.meta            →  {}
 */

module.exports = function babelPluginImportMeta() {
  return {
    name: 'babel-plugin-replace-import-meta',
    visitor: {
      MemberExpression(path) {
        const obj = path.get('object');
        if (!obj.isMetaProperty({ meta: { name: 'import' }, property: { name: 'meta' })) {
          return;
        }

        const propName = path.node.property.name;

        if (propName === 'env') {
          // import.meta.env  →  { MODE: "development" }
          path.replaceWith(
            this.types.objectExpression([
              this.types.objectProperty(
                this.types.identifier('MODE'),
                this.types.stringLiteral('development'),
              ),
            ]),
          );
          return;
        }

        if (propName === 'url') {
          // import.meta.url  →  ""
          path.replaceWith(this.types.stringLiteral(''));
          return;
        }

        // import.meta.<other>  →  {}
        path.replaceWith(this.types.objectExpression([]));
      },

      MetaProperty(path) {
        // bare import.meta  →  { url: "" }
        path.replaceWith(
          this.types.objectExpression([
            this.types.objectProperty(
              this.types.identifier('url'),
              this.types.stringLiteral(''),
            ),
            this.types.objectProperty(
              this.types.identifier('env'),
              this.types.objectExpression([
                this.types.objectProperty(
                  this.types.identifier('MODE'),
                  this.types.stringLiteral('development'),
                ),
              ]),
            ),
          ]),
        );
      },
    },
  };
};
