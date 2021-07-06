import { UniversalLoader, SingleFileOptions, ResolverGlobs } from '@graphql-tools/utils';
import {
  GraphQLTagPluckOptions,
  gqlPluckFromCodeString,
  gqlPluckFromCodeStringSync,
} from '@graphql-tools/graphql-tag-pluck';
import micromatch from 'micromatch';
import unixify from 'unixify';

import { loadFromGit, loadFromGitSync, readTreeAtRef, readTreeAtRefSync } from './load-git';
import { parse as handleStuff } from './parse';
import { concatAST, parse } from 'graphql';

// git:branch:path/to/file
function extractData(pointer: string): {
  ref: string;
  path: string;
} {
  const parts = pointer.replace(/^git\:/i, '').split(':');

  if (!parts || parts.length !== 2) {
    throw new Error('Schema pointer should match "git:branchName:path/to/file"');
  }

  return {
    ref: parts[0],
    path: parts[1],
  };
}

/**
 * Additional options for loading from git
 */
export type GitLoaderOptions = SingleFileOptions & {
  /**
   * Additional options to pass to `graphql-tag-pluck`
   */
  pluckConfig?: GraphQLTagPluckOptions;
};

/**
 * This loader loads a file from git.
 *
 * ```js
 * const typeDefs = await loadTypedefs('git:someBranch:some/path/to/file.js', {
 *   loaders: [new GitLoader()],
 * })
 * ```
 */
export class GitLoader implements UniversalLoader {
  loaderId() {
    return 'git-loader';
  }

  async canLoad(pointer: string) {
    return this.canLoadSync(pointer);
  }

  canLoadSync(pointer: string) {
    return typeof pointer === 'string' && pointer.toLowerCase().startsWith('git:');
  }

  async resolveGlobs({ globs, ignores }: ResolverGlobs) {
    const refsForPaths = new Map();

    for (const glob of globs) {
      const { ref, path } = extractData(glob);
      if (!refsForPaths.has(ref)) {
        refsForPaths.set(ref, []);
      }
      refsForPaths.get(ref).push(unixify(path));
    }

    for (const ignore of ignores) {
      const { ref, path } = extractData(ignore);
      if (!refsForPaths.has(ref)) {
        refsForPaths.set(ref, []);
      }
      refsForPaths.get(ref).push(`!(${unixify(path)})`);
    }

    const resolved: string[] = [];
    for await (const [ref, paths] of refsForPaths.entries()) {
      resolved.push(...micromatch(await readTreeAtRef(ref), paths).map(filePath => `git:${ref}:${filePath}`));
    }
    return resolved;
  }

  resolveGlobsSync({ globs, ignores }: ResolverGlobs) {
    const refsForPaths = new Map();

    for (const glob of globs) {
      const { ref, path } = extractData(glob);
      if (!refsForPaths.has(ref)) {
        refsForPaths.set(ref, []);
      }
      refsForPaths.get(ref).push(unixify(path));
    }

    for (const ignore of ignores) {
      const { ref, path } = extractData(ignore);
      if (!refsForPaths.has(ref)) {
        refsForPaths.set(ref, []);
      }
      refsForPaths.get(ref).push(`!(${unixify(path)})`);
    }

    const resolved: string[] = [];
    for (const [ref, paths] of refsForPaths.entries()) {
      resolved.push(...micromatch(readTreeAtRefSync(ref), paths).map(filePath => `git:${ref}:${filePath}`));
    }
    return resolved;
  }

  async load(pointer: string, options: GitLoaderOptions) {
    const { ref, path } = extractData(pointer);
    const content = await loadFromGit({ ref, path });
    const parsed = handleStuff({ path, options, pointer, content });

    if (parsed) {
      return parsed;
    }

    const sources = await gqlPluckFromCodeString(pointer, content, options.pluckConfig);

    const documents = sources.map(source => parse(source, options));

    return {
      location: pointer,
      document: concatAST(documents),
    };
  }

  loadSync(pointer: string, options: GitLoaderOptions) {
    const { ref, path } = extractData(pointer);
    const content = loadFromGitSync({ ref, path });
    const parsed = handleStuff({ path, options, pointer, content });

    if (parsed) {
      return parsed;
    }

    const sources = gqlPluckFromCodeStringSync(pointer, content, options.pluckConfig);

    const documents = sources.map(source => parse(source, options));

    return {
      location: pointer,
      document: concatAST(documents),
    };
  }
}
