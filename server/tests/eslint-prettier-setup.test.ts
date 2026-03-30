import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT_DIR = resolve(__dirname, '../../');
const CLIENT_DIR = resolve(ROOT_DIR, 'client');
const SERVER_DIR = resolve(ROOT_DIR, 'server');
const SHARED_DIR = resolve(ROOT_DIR, 'shared');

function run(cmd: string, cwd: string = ROOT_DIR): string {
  return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 30000 });
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

describe('ESLint & Prettier configuration', () => {
  // ─── Config files exist ──────────────────────────────────────────

  describe('Config files existence', () => {
    it('should have .prettierrc at root', () => {
      expect(existsSync(resolve(ROOT_DIR, '.prettierrc'))).toBe(true);
    });

    it('should have .prettierignore at root', () => {
      expect(existsSync(resolve(ROOT_DIR, '.prettierignore'))).toBe(true);
    });

    it('should have eslint.config.mjs in client', () => {
      expect(existsSync(resolve(CLIENT_DIR, 'eslint.config.mjs'))).toBe(true);
    });

    it('should have eslint.config.mjs in server', () => {
      expect(existsSync(resolve(SERVER_DIR, 'eslint.config.mjs'))).toBe(true);
    });

    it('should have eslint.config.mjs in shared', () => {
      expect(existsSync(resolve(SHARED_DIR, 'eslint.config.mjs'))).toBe(true);
    });
  });

  // ─── Prettier config validation ──────────────────────────────────

  describe('Prettier config validation', () => {
    let prettierConfig: Record<string, unknown>;

    beforeAll(() => {
      prettierConfig = readJson(resolve(ROOT_DIR, '.prettierrc'));
    });

    it('should be valid JSON', () => {
      expect(prettierConfig).toBeDefined();
      expect(typeof prettierConfig).toBe('object');
    });

    it('should have semi option defined', () => {
      expect(prettierConfig).toHaveProperty('semi');
    });

    it('should have singleQuote option defined', () => {
      expect(prettierConfig).toHaveProperty('singleQuote');
    });

    it('should enforce single quotes', () => {
      expect(prettierConfig.singleQuote).toBe(true);
    });

    it('should have trailingComma option defined', () => {
      expect(prettierConfig).toHaveProperty('trailingComma');
    });

    it('should have printWidth option defined', () => {
      expect(prettierConfig).toHaveProperty('printWidth');
    });

    it('should have tabWidth option defined', () => {
      expect(prettierConfig).toHaveProperty('tabWidth');
      expect(prettierConfig.tabWidth).toBe(2);
    });

    it('should have endOfLine option defined', () => {
      expect(prettierConfig).toHaveProperty('endOfLine');
      expect(prettierConfig.endOfLine).toBe('lf');
    });
  });

  // ─── .prettierignore validation ──────────────────────────────────

  describe('.prettierignore validation', () => {
    let ignoreContent: string;

    beforeAll(() => {
      ignoreContent = readFileSync(
        resolve(ROOT_DIR, '.prettierignore'),
        'utf-8',
      );
    });

    it('should ignore node_modules', () => {
      expect(ignoreContent).toContain('node_modules');
    });

    it('should ignore dist', () => {
      expect(ignoreContent).toContain('dist');
    });

    it('should ignore .next', () => {
      expect(ignoreContent).toContain('.next');
    });

    it('should ignore build output', () => {
      expect(ignoreContent).toContain('build');
    });

    it('should ignore coverage', () => {
      expect(ignoreContent).toContain('coverage');
    });

    it('should ignore yarn.lock', () => {
      expect(ignoreContent).toContain('yarn.lock');
    });
  });

  // ─── Package.json scripts ───────────────────────────────────────

  describe('Package.json scripts', () => {
    describe('Root package.json', () => {
      let rootPkg: Record<string, unknown>;

      beforeAll(() => {
        rootPkg = readJson(resolve(ROOT_DIR, 'package.json'));
      });

      it('should have lint script', () => {
        expect((rootPkg.scripts as Record<string, string>).lint).toBeDefined();
      });

      it('should have lint:fix script', () => {
        expect(
          (rootPkg.scripts as Record<string, string>)['lint:fix'],
        ).toBeDefined();
      });

      it('should have format script', () => {
        expect(
          (rootPkg.scripts as Record<string, string>).format,
        ).toBeDefined();
      });

      it('should have format:check script', () => {
        expect(
          (rootPkg.scripts as Record<string, string>)['format:check'],
        ).toBeDefined();
      });

      it('lint script should run linting for all workspaces', () => {
        const lintScript = (rootPkg.scripts as Record<string, string>).lint;
        expect(lintScript).toContain('@holon/client');
        expect(lintScript).toContain('@holon/server');
        expect(lintScript).toContain('@holon/shared');
      });

      it('format script should use prettier --write', () => {
        const formatScript = (rootPkg.scripts as Record<string, string>).format;
        expect(formatScript).toContain('prettier --write');
      });

      it('format:check script should use prettier --check', () => {
        const checkScript = (rootPkg.scripts as Record<string, string>)[
          'format:check'
        ];
        expect(checkScript).toContain('prettier --check');
      });
    });

    describe('Client package.json', () => {
      let clientPkg: Record<string, unknown>;

      beforeAll(() => {
        clientPkg = readJson(resolve(CLIENT_DIR, 'package.json'));
      });

      it('should have lint script', () => {
        expect(
          (clientPkg.scripts as Record<string, string>).lint,
        ).toBeDefined();
      });

      it('should have lint:fix script', () => {
        expect(
          (clientPkg.scripts as Record<string, string>)['lint:fix'],
        ).toBeDefined();
      });
    });

    describe('Server package.json', () => {
      let serverPkg: Record<string, unknown>;

      beforeAll(() => {
        serverPkg = readJson(resolve(SERVER_DIR, 'package.json'));
      });

      it('should have lint script', () => {
        expect(
          (serverPkg.scripts as Record<string, string>).lint,
        ).toBeDefined();
      });

      it('should have lint:fix script', () => {
        expect(
          (serverPkg.scripts as Record<string, string>)['lint:fix'],
        ).toBeDefined();
      });

      it('should have eslint as devDependency', () => {
        expect(
          (serverPkg.devDependencies as Record<string, string>).eslint,
        ).toBeDefined();
      });

      it('should have typescript-eslint as devDependency', () => {
        expect(
          (serverPkg.devDependencies as Record<string, string>)[
            'typescript-eslint'
          ],
        ).toBeDefined();
      });
    });

    describe('Shared package.json', () => {
      let sharedPkg: Record<string, unknown>;

      beforeAll(() => {
        sharedPkg = readJson(resolve(SHARED_DIR, 'package.json'));
      });

      it('should have lint script', () => {
        expect(
          (sharedPkg.scripts as Record<string, string>).lint,
        ).toBeDefined();
      });

      it('should have lint:fix script', () => {
        expect(
          (sharedPkg.scripts as Record<string, string>)['lint:fix'],
        ).toBeDefined();
      });

      it('should have eslint as devDependency', () => {
        expect(
          (sharedPkg.devDependencies as Record<string, string>).eslint,
        ).toBeDefined();
      });

      it('should have typescript-eslint as devDependency', () => {
        expect(
          (sharedPkg.devDependencies as Record<string, string>)[
            'typescript-eslint'
          ],
        ).toBeDefined();
      });
    });
  });

  // ─── ESLint execution ───────────────────────────────────────────

  describe('ESLint execution', () => {
    it('should lint client without errors', () => {
      expect(() => {
        run('yarn workspace @holon/client lint');
      }).not.toThrow();
    });

    it('should lint server without errors', () => {
      expect(() => {
        run('yarn workspace @holon/server lint');
      }).not.toThrow();
    });

    it('should lint shared without errors', () => {
      expect(() => {
        run('yarn workspace @holon/shared lint');
      }).not.toThrow();
    });

    it('should lint all workspaces from root without errors', () => {
      expect(() => {
        run('yarn lint');
      }).not.toThrow();
    });
  });

  // ─── Prettier execution ─────────────────────────────────────────

  describe('Prettier execution', () => {
    it('should pass format:check (all files are formatted)', () => {
      expect(() => {
        run('yarn format:check');
      }).not.toThrow();
    });
  });

  // ─── ESLint and Prettier consistency ────────────────────────────

  describe('ESLint and Prettier consistency (no conflicts)', () => {
    it('should have eslint-config-prettier in root devDependencies', () => {
      const rootPkg = readJson(resolve(ROOT_DIR, 'package.json'));
      expect(
        (rootPkg.devDependencies as Record<string, string>)[
          'eslint-config-prettier'
        ],
      ).toBeDefined();
    });

    it('should have prettier in root devDependencies', () => {
      const rootPkg = readJson(resolve(ROOT_DIR, 'package.json'));
      expect(
        (rootPkg.devDependencies as Record<string, string>).prettier,
      ).toBeDefined();
    });

    it('client ESLint config should include eslint-config-prettier', () => {
      const configContent = readFileSync(
        resolve(CLIENT_DIR, 'eslint.config.mjs'),
        'utf-8',
      );
      expect(configContent).toContain('eslint-config-prettier');
    });

    it('server ESLint config should include eslint-config-prettier', () => {
      const configContent = readFileSync(
        resolve(SERVER_DIR, 'eslint.config.mjs'),
        'utf-8',
      );
      expect(configContent).toContain('eslint-config-prettier');
    });

    it('shared ESLint config should include eslint-config-prettier', () => {
      const configContent = readFileSync(
        resolve(SHARED_DIR, 'eslint.config.mjs'),
        'utf-8',
      );
      expect(configContent).toContain('eslint-config-prettier');
    });
  });

  // ─── ESLint config content validation ───────────────────────────

  describe('ESLint config content', () => {
    it('client config should use Next.js ESLint rules', () => {
      const content = readFileSync(
        resolve(CLIENT_DIR, 'eslint.config.mjs'),
        'utf-8',
      );
      expect(content).toContain('eslint-config-next');
    });

    it('server config should use typescript-eslint', () => {
      const content = readFileSync(
        resolve(SERVER_DIR, 'eslint.config.mjs'),
        'utf-8',
      );
      expect(content).toContain('typescript-eslint');
    });

    it('shared config should use typescript-eslint', () => {
      const content = readFileSync(
        resolve(SHARED_DIR, 'eslint.config.mjs'),
        'utf-8',
      );
      expect(content).toContain('typescript-eslint');
    });

    it('server config should ignore dist directory', () => {
      const content = readFileSync(
        resolve(SERVER_DIR, 'eslint.config.mjs'),
        'utf-8',
      );
      expect(content).toContain('dist/**');
    });

    it('shared config should ignore dist directory', () => {
      const content = readFileSync(
        resolve(SHARED_DIR, 'eslint.config.mjs'),
        'utf-8',
      );
      expect(content).toContain('dist/**');
    });

    it('client config should ignore .next directory', () => {
      const content = readFileSync(
        resolve(CLIENT_DIR, 'eslint.config.mjs'),
        'utf-8',
      );
      expect(content).toContain('.next/**');
    });
  });
});
