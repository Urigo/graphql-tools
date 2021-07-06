/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import * as path from 'path';
import { CodeFileLoader } from '../src';
import { parse } from 'graphql';

describe('loadFromCodeFile', () => {
  const loader = new CodeFileLoader();

  it('Should throw an error when a document is loaded using AST and the document is not valid', async () => {
    try {
      const loaded = await loader.load('./test-files/invalid-anon-doc.js', {
        noRequire: true,
        cwd: __dirname
      });
      const doc = loaded?.document ? loaded?.document : parse(loaded?.rawSDL!);

      expect(doc).toBeFalsy();
    } catch (e) {
      expect(e.message).toContain('Syntax Error: Unexpected Name "InvalidGetUser"');
    }
  });

  it('should load a valid file', async () => {
    const loaded = await loader.load('./test-files/valid-doc.js', {
      noRequire: true,
      cwd: __dirname
    });
    const doc = loaded?.document ? loaded?.document : parse(loaded?.rawSDL!);

    expect(doc?.kind).toEqual('Document');
  });

  it('should consider options.cwd', async () => {
    const loaded = await loader.load('valid-doc.js', {
      cwd: path.resolve(__dirname, 'test-files'),
      noRequire: true,
    });
    const doc = loaded?.document ? loaded?.document : parse(loaded?.rawSDL!);

    expect(doc?.kind).toEqual('Document');
  });

  it('should load a TypeScript file using decorator', async () => {
    const loaded = await loader.load('./test-files/with-decorator-doc.ts', {
      noRequire: true,
      cwd: __dirname
    });
    const doc = loaded?.document ? loaded?.document : parse(loaded?.rawSDL!);

    expect(doc?.kind).toEqual('Document');
  });

  it('should support string interpolation', async () => {
    const loaded = await loader.load('./test-files/string-interpolation.js', {
      cwd: __dirname
    });
    const doc = loaded?.document ? loaded?.document : parse(loaded?.rawSDL!);

    expect(doc?.kind).toEqual('Document');
  });
});

describe('loadFromCodeFileSync', () => {
  const loader = new CodeFileLoader();

  it('Should throw an error when a document is loaded using AST and the document is not valid', () => {
    expect(() => {
      const loaded = loader.loadSync('./test-files/invalid-anon-doc.js', {
        noRequire: true,
        cwd: __dirname
      });
      const doc = loaded?.document ? loaded?.document : parse(loaded?.rawSDL!);

      expect(doc?.kind).toEqual('Document');
    }).toThrowError('Syntax Error: Unexpected Name "InvalidGetUser"')
  });

  it('should load a valid file', () => {
    const loaded = loader.loadSync('./test-files/valid-doc.js', {
      noRequire: true,
      cwd: __dirname
    });
    const doc = loaded?.document;

    expect(doc?.kind).toEqual('Document');
  });

  it('should consider options.cwd', () => {
    const loaded = loader.loadSync('valid-doc.js', {
      cwd: path.resolve(__dirname, 'test-files'),
      noRequire: true,
    });
    const doc = loaded?.document;

    expect(doc?.kind).toEqual('Document');
  });

  it('should support string interpolation', () => {
    const loaded = loader.loadSync('./test-files/string-interpolation.js', {
      cwd: __dirname
    });

    const doc = loaded?.document;

    expect(doc?.kind).toEqual('Document');
  });
});
