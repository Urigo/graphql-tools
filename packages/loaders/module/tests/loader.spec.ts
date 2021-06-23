import { join } from 'path';

import { Source } from '@graphql-tools/utils';

import { ModuleLoader } from '../src';
import { runTests } from '../../../testing/utils';

describe('ModuleLoader', () => {
  const loader = new ModuleLoader();
  const getPointer = (fileName: string, exportName?: string) => {
    const absolutePath = join(process.cwd(), 'packages/loaders/module/tests/test-files', fileName);
    return `module:${absolutePath}${exportName ? `#${exportName}` : ''}`;
  };

  describe('loaderId', () => {
    it('should return a loader id', () => {
      expect(loader.loaderId()).toBeDefined();
    });
  });

  describe('canLoad', () => {
    runTests({
      async: loader.canLoad.bind(loader),
      sync: loader.canLoadSync.bind(loader),
    })(canLoad => {
      it('should return true for a valid pointer', async () => {
        await expect(canLoad(getPointer('schema'))).resolves.toBe(true);
      });

      it('should return false if missing prefix', async () => {
        await expect(canLoad(getPointer('schema').substring(7))).resolves.toBe(false);
      });

      it('should return false if pointer is not a string', async () => {
        await expect(canLoad(42 as any)).resolves.toBe(false);
      });
    });
  });

  describe('load', () => {
    runTests({
      async: loader.load.bind(loader),
      sync: loader.loadSync.bind(loader),
    })(load => {
      it('should load GraphQLSchema object from a file', async () => {
        const result: Source = await load(getPointer('schema'));
        expect(result.schema).toBeDefined();
      });

      it('should load DocumentNode object from a file', async () => {
        const result: Source = await load(getPointer('type-defs'));
        expect(result.document).toBeDefined();
      });

      it('should load string from a file', async () => {
        const result: Source = await load(getPointer('type-defs-string'));
        expect(result.rawSDL).toBeDefined();
      });

      it('should load using a named export', async () => {
        const result: Source = await load(getPointer('type-defs-named-export', 'typeDefs'));
        expect(result.document).toBeDefined();
      });

      it('should throw error when using a bad pointer', async () => {
        await expect(load(getPointer('type-defs-named-export', 'tooMany#'))).rejects.toThrowError(
          'Schema pointer should match'
        );
      });

      it('should throw error when using a bad identifier', async () => {
        await expect(load(getPointer('type-defs-named-export', 'badIdentifier'))).rejects.toThrowError(
          'Unable to load schema from module'
        );
      });

      it('should throw error when loaded object is not GraphQLSchema, DocumentNode or string', async () => {
        await expect(load(getPointer('type-defs-named-export', 'favoriteNumber'))).rejects.toThrowError(
          'Imported object was not a string, DocumentNode or GraphQLSchema'
        );
      });
    });
  });
});
