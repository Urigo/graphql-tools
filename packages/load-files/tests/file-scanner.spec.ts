import { loadFilesSync, loadFiles, LoadFilesOptions } from '@graphql-tools/load-files';
import { print } from 'graphql';
import { join } from 'path';
import {jest} from '@jest/globals';

const syncAndAsync = Object.entries({ 'SYNC': loadFilesSync, 'ASYNC': loadFiles });

function testSchemaDir({ path, expected, note, extensions, ignoreIndex }: TestDirOptions) {
  let options: LoadFilesOptions;

  beforeEach(() => {
    options = {
      ignoreIndex,
      globOptions: {
        cwd: __dirname
      },
      requireMethod: jest.requireActual,
      ...(extensions && { extensions }),
    };
  });

  for (const [type, loadFiles] of syncAndAsync) {
    describe(type, () => {
      it(`should return the correct schema results for path: ${path} (${note})`, async () => {
        const result = await loadFiles(path, options);

        expect(result.length).toBe(expected.length);
        expect(result.map(res => {
          if (res.kind === 'Document') {
            res = print(res);
          }
          return stripWhitespaces(res);
        })).toEqual(expected.map(stripWhitespaces));
      });
    });
  }

}

function testResolversDir({ path, expected, note, extensions, compareValue, ignoreIndex, ignoredExtensions }: TestDirOptions) {
  if (typeof compareValue === 'undefined') {
    compareValue = true;
  }
  let options: LoadFilesOptions;

  beforeEach(() => {
    options = {
      ignoreIndex,
      globOptions: {
        cwd: __dirname
      },
      requireMethod: jest.requireActual,
      ...(extensions && { extensions }),
      ...(ignoredExtensions && { ignoredExtensions }),
    };
  });

  for (const [type, loadFiles] of syncAndAsync) {
    describe(type, () => {
      it(`should return the correct resolvers results for path: ${path} (${note})`, async () => {
        const result = await loadFiles(path, options);

        expect(result.length).toBe(expected.length);

        if (compareValue) {
          expect(result).toEqual(expected);
        }
      });
    })
  }
}

function stripWhitespaces(str: any): string {
  return str.toString().replace(/\s+/g, ' ').trim();
}

describe('file scanner', function() {
  describe('schema', () => {
    const schemaContent = `type MyType { f: String }`;
    testSchemaDir({
      path: './test-assets/1',
      expected: [schemaContent],
      note: 'one file',
    });
    testSchemaDir({
      path: './test-assets/2',
      expected: [schemaContent, schemaContent, schemaContent],
      note: 'multiple files',
    });
    testSchemaDir({
      path: './test-assets/3',
      expected: [schemaContent, schemaContent, schemaContent],
      note: 'recursive',
    });
    testSchemaDir({
      path: './test-assets/4',
      expected: [schemaContent],
      note: 'custom extension',
      extensions: ['schema'],
    });
    testSchemaDir({
      path: './test-assets/5',
      expected: [schemaContent, schemaContent],
      note: 'custom extensions',
      extensions: ['schema', 'myschema'],
    });
    testSchemaDir({
      path: './test-assets/10',
      expected: [schemaContent, schemaContent, schemaContent],
      note: 'code files with gql tag',
      extensions: ['js'],
    });
    testSchemaDir({
      path: './test-assets/10',
      expected: [schemaContent, schemaContent, schemaContent],
      note: 'code files with gql tag',
      extensions: ['js'],
    });
    testSchemaDir({
      path: './test-assets/12',
      expected: [schemaContent],
      note: 'should ignore index on demand',
      extensions: ['graphql'],
      ignoreIndex: true,
    });
    testSchemaDir({
      path: './test-assets/12',
      expected: [schemaContent, `type IndexType { f: Int }`],
      note: 'should include index by default',
      extensions: ['graphql'],
    });
    testSchemaDir({
      path: './test-assets/1/*.graphql',
      expected: [schemaContent],
      note: 'non-directory pattern',
    });
  });

  describe('resolvers', () => {
    testResolversDir({
      path: './test-assets/6',
      expected: [{ MyType: { f: 1 } }],
      note: 'one file',
    });
    testResolversDir({
      path: './test-assets/7',
      expected: [{ MyType: { f: 1 } }, { MyType: { f: 2 } }],
      note: 'multiple files',
    });
    testResolversDir({
      path: './test-assets/8',
      expected: [{ MyType: { f: 1 } }],
      note: 'default export',
    });
    testResolversDir({
      path: './test-assets/9',
      expected: [{ MyType: { f: 1 } }, { MyType: { f: 2 } }],
      note: 'named exports',
    });
    //
    // XXX: I have no idea what this suppose to test
    //
    // testResolversDir({
    //   path: './test-assets/11',
    //   expected: new Array(2).fill(''),
    //   note: 'ignored extensions',
    //   extensions: null,
    //   compareValue: false,
    // });
    testResolversDir({
      path: './test-assets/12',
      expected: [
        {
          MyType: {
            f: '12',
          },
        },
        {
          IndexType: {
            f: '12',
          },
        },
      ],
      note: 'includes index files but only if it matches extensions',
      extensions: ['js'],
      compareValue: true,
    });
    testResolversDir({
      path: './test-assets/12',
      expected: [
        {
          MyType: {
            f: '12',
          },
        },
      ],
      note: 'ignore index files',
      extensions: ['js'],
      compareValue: true,
      ignoreIndex: true,
    });
    testResolversDir({
      path: './test-assets/6/*.resolvers.js',
      expected: [{ MyType: { f: 1 } }],
      note: 'non-directory pattern',
    });
    testResolversDir({
      path: './test-assets/13',
      extensions: ['js'],
      ignoredExtensions: ['s.js'],
      expected: [{ MyType: { f: 1 } }],
      note: 'include path finishing in s.js but do not include paths finishing in .s.js',
    });
    testResolversDir({
      path: './test-assets/13',
      extensions: ['.js'],
      ignoredExtensions: ['.s.js'],
      expected: [{ MyType: { f: 1 } }],
      note: 'extensions and ignored extensions works with a trailing dot',
    });
  });
  for (const [type, loadFiles] of syncAndAsync) {
    it(`${type}: should process custom extractExports properly`, async () => {
      const customQueryTypeName = 'root_query';
      const customExtractExports = (fileExport: any) => {
        fileExport = fileExport.default || fileExport;
        // Incoming exported value is function
        return fileExport(customQueryTypeName);
      };
      const loadedFiles = await loadFiles(join(__dirname, './test-assets/custom-extractor/factory-func.js'), {
        extractExports: customExtractExports
      });
      expect(loadedFiles).toHaveLength(1);
      expect(customQueryTypeName in loadedFiles[0]).toBeTruthy();
      expect('foo' in loadedFiles[0][customQueryTypeName]).toBeTruthy();
      expect(typeof loadedFiles[0][customQueryTypeName]['foo']).toBe('function');
      expect(loadedFiles[0][customQueryTypeName]['foo']()).toBe('FOO');
    });
    it(`${type}: ignore .d.ts files by default without file glob`, async () => {
      const loadedFiles = await loadFiles(join(__dirname, './test-assets/ignore-extensions'));
      expect(loadedFiles).toHaveLength(1);
      const resolvers = loadedFiles[0];
      expect(typeof resolvers).toBe('object');
      expect(typeof resolvers.Query).toBe('object');
      expect(typeof resolvers.Query.foo).toBe('function');
      expect(resolvers.Query.foo()).toBe('FOO');
    });
    it(`${type}: ignore .d.ts files by default without file glob`, async () => {
      const loadedFiles = await loadFiles(join(__dirname, './test-assets/ignore-extensions/*.*'));
      expect(loadedFiles).toHaveLength(1);
      const resolvers = loadedFiles[0];
      expect(typeof resolvers).toBe('object');
      expect(typeof resolvers.Query).toBe('object');
      expect(typeof resolvers.Query.foo).toBe('function');
      expect(resolvers.Query.foo()).toBe('FOO');
    });
  }
});

interface TestDirOptions {
  path: string;
  expected: any;
  note: string;
  extensions?: string[];
  compareValue?: boolean;
  ignoreIndex?: boolean;
  ignoredExtensions?: string[];
}
