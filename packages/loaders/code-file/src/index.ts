import type { GlobbyOptions } from 'globby';

import { isSchema, GraphQLSchema, DocumentNode, concatAST, parse } from 'graphql';
import {
  SchemaPointerSingle,
  DocumentPointerSingle,
  SingleFileOptions,
  Source,
  UniversalLoader,
  asArray,
  isValidPath,
  parseGraphQLSDL,
  isDocumentNode,
  ResolverGlobs,
} from '@graphql-tools/utils';
import {
  GraphQLTagPluckOptions,
  gqlPluckFromCodeString,
  gqlPluckFromCodeStringSync,
} from '@graphql-tools/graphql-tag-pluck';
import globby from 'globby';
import isGlob from 'is-glob';
import unixify from 'unixify';
import { tryToLoadFromExport, tryToLoadFromExportSync } from './load-from-module';
import { isAbsolute, resolve } from 'path';
import { cwd, env } from 'process';
import { readFileSync, promises as fsPromises, existsSync } from 'fs';
import { createRequire } from 'module';

const { readFile, access } = fsPromises;

/**
 * Additional options for loading from a code file
 */
export type CodeFileLoaderOptions = {
  require?: string | string[];
  pluckConfig?: GraphQLTagPluckOptions;
  noPluck?: boolean;
  noRequire?: boolean;
} & SingleFileOptions;

const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.vue'];

function createGlobbyOptions(options: CodeFileLoaderOptions): GlobbyOptions {
  return { absolute: true, ...options, ignore: [] };
}

/**
 * This loader loads GraphQL documents and type definitions from code files
 * using `graphql-tag-pluck`.
 *
 * ```js
 * const documents = await loadDocuments('queries/*.js', {
 *   loaders: [
 *     new CodeFileLoader()
 *   ]
 * });
 * ```
 *
 * Supported extensions include: `.ts`, `.tsx`, `.js`, `.jsx`, `.vue`
 */
export class CodeFileLoader implements UniversalLoader<CodeFileLoaderOptions> {
  loaderId(): string {
    return 'code-file';
  }

  async canLoad(
    pointer: SchemaPointerSingle | DocumentPointerSingle,
    options: CodeFileLoaderOptions
  ): Promise<boolean> {
    if (isGlob(pointer)) {
      // FIXME: parse to find and check the file extensions?
      return true;
    }

    if (isValidPath(pointer)) {
      if (FILE_EXTENSIONS.find(extension => pointer.endsWith(extension))) {
        const normalizedFilePath = isAbsolute(pointer) ? pointer : resolve(options.cwd || cwd(), pointer);
        try {
          await access(normalizedFilePath);
          return true;
        } catch {
          return false;
        }
      }
    }

    return false;
  }

  canLoadSync(pointer: SchemaPointerSingle | DocumentPointerSingle, options: CodeFileLoaderOptions): boolean {
    if (isGlob(pointer)) {
      // FIXME: parse to find and check the file extensions?
      return true;
    }

    if (isValidPath(pointer)) {
      if (FILE_EXTENSIONS.find(extension => pointer.endsWith(extension))) {
        const normalizedFilePath = isAbsolute(pointer) ? pointer : resolve(options.cwd || cwd(), pointer);
        return existsSync(normalizedFilePath);
      }
    }

    return false;
  }

  async resolveGlobs({ globs, ignores }: ResolverGlobs, options: CodeFileLoaderOptions) {
    return globby(
      globs.concat(ignores.map(v => `!(${v})`)).map(v => unixify(v)),
      createGlobbyOptions(options)
    );
  }

  resolveGlobsSync({ globs, ignores }: ResolverGlobs, options: CodeFileLoaderOptions) {
    return globby.sync(
      globs.concat(ignores.map(v => `!(${v})`)).map(v => unixify(v)),
      createGlobbyOptions(options)
    );
  }

  async load(
    pointer: SchemaPointerSingle | DocumentPointerSingle,
    options: CodeFileLoaderOptions
  ): Promise<Source | null> {
    const normalizedFilePath = ensureAbsolutePath(pointer, options);

    const errors: Error[] = [];

    if (!options.noPluck) {
      try {
        const content = await readFile(normalizedFilePath, { encoding: 'utf-8' });
        const sources = await gqlPluckFromCodeString(normalizedFilePath, content, options.pluckConfig);

        if (sources.length) {
          return {
            document: concatAST(sources.map(source => parse(source, options))),
            location: pointer,
          };
        }
      } catch (e) {
        if (env['DEBUG']) {
          console.error(`Failed to load schema from code file "${normalizedFilePath}": ${e.message}`);
        }
        errors.push(e);
      }
    }

    if (!options.noRequire) {
      try {
        if (options && options.require) {
          await Promise.all(asArray(options.require).map(m => import(m)));
        }

        const loaded = await tryToLoadFromExport(normalizedFilePath);
        const source = resolveSource(pointer, loaded, options);

        if (source) {
          return source;
        }
      } catch (e) {
        errors.push(e);
      }
    }

    if (errors.length > 0) {
      throw errors[0];
    }

    return null;
  }

  loadSync(pointer: SchemaPointerSingle | DocumentPointerSingle, options: CodeFileLoaderOptions): Source | null {
    const normalizedFilePath = ensureAbsolutePath(pointer, options);

    const errors: Error[] = [];

    if (!options.noPluck) {
      try {
        const content = readFileSync(normalizedFilePath, { encoding: 'utf-8' });
        const sources = gqlPluckFromCodeStringSync(normalizedFilePath, content, options.pluckConfig);

        if (sources.length) {
          return {
            document: concatAST(sources.map(source => parse(source, options))),
            location: pointer,
          };
        }
      } catch (e) {
        if (env['DEBUG']) {
          console.error(`Failed to load schema from code file "${normalizedFilePath}": ${e.message}`);
        }
        errors.push(e);
      }
    }

    if (!options.noRequire) {
      try {
        if (options && options.require) {
          const cwdRequire = createRequire(options.cwd || cwd());
          for (const m of asArray(options.require)) {
            cwdRequire(m);
          }
        }

        const loaded = tryToLoadFromExportSync(normalizedFilePath);
        const source = resolveSource(pointer, loaded, options);

        if (source) {
          return source;
        }
      } catch (e) {
        errors.push(e);
      }
    }

    if (errors.length > 0) {
      throw errors[0];
    }

    return null;
  }
}

function resolveSource(
  pointer: string,
  value: GraphQLSchema | DocumentNode | string | null,
  options: CodeFileLoaderOptions
): Source | null {
  if (typeof value === 'string') {
    return parseGraphQLSDL(pointer, value, options);
  } else if (isSchema(value)) {
    return {
      location: pointer,
      schema: value,
    };
  } else if (isDocumentNode(value)) {
    return {
      location: pointer,
      document: value,
    };
  }

  return null;
}

function ensureAbsolutePath(
  pointer: SchemaPointerSingle | DocumentPointerSingle,
  options: CodeFileLoaderOptions
): string {
  return isAbsolute(pointer) ? pointer : resolve(options.cwd || cwd(), pointer);
}
