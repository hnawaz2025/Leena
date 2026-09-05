/**
 * Rewrites `import.meta` to a plain object at build time.
 *
 * Why this exists: zustand 4.x ships an ESM build that reads
 * `import.meta.env.MODE` to decide whether to print dev warnings. Its exports
 * map gives React Native the CJS build, so native never sees this -- but the
 * web build resolves the ESM one, and Metro emits the result into a classic
 * <script>. `import.meta` is a syntax error outside a module, so the browser
 * throws before React mounts and the page renders completely blank with no
 * visible error.
 *
 * Fixing it here rather than in Metro's resolver is deliberate: the offending
 * file is reached through zustand's own internal imports, which never pass
 * through a custom resolveRequest, so resolution-level fixes miss it.
 *
 * Substitutes an object rather than `undefined` on purpose -- the call site is
 * `import.meta.env ? import.meta.env.MODE : void 0`, which would throw on
 * `undefined.env`. Reporting production also keeps the library's deprecation
 * warning quiet, which is accurate for an exported build.
 */
module.exports = function importMetaToObject({ types: t }) {
  return {
    name: "import-meta-to-object",
    visitor: {
      MetaProperty(path) {
        const { meta, property } = path.node;
        // Also matches `new.target`, which must be left alone.
        if (meta.name !== "import" || property.name !== "meta") return;
        path.replaceWith(
          t.objectExpression([
            t.objectProperty(
              t.identifier("env"),
              t.objectExpression([
                t.objectProperty(t.identifier("MODE"), t.stringLiteral("production")),
              ])
            ),
          ])
        );
      },
    },
  };
};
