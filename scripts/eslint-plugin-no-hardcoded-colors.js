// ESLint plugin to prevent hardcoded colors
module.exports = {
  rules: {
    'no-hardcoded-colors': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Disallow hardcoded hex colors, require theme tokens',
          category: 'Best Practices',
          recommended: true
        },
        schema: []
      },
      create: function(context) {
        return {
          Literal(node) {
            if (typeof node.value === 'string' && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(node.value)) {
              context.report({
                node,
                message: `Use theme tokens instead of hardcoded color: {{color}}`,
                data: { color: node.value }
              });
            }
          }
        };
      }
    }
  }
};