/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore',
      'constitutional', // for changes touching constitutional boundaries
      'corpus', // for corpus schema changes
      'migration', // for database migrations
    ]],
    'subject-max-length': [2, 'always', 100],
  },
};
