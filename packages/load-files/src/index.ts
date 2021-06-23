import globby, { sync as globbySync, GlobbyOptions } from 'globby';
import unixify from 'unixify';
import { extname } from 'path';
import { statSync, readFileSync, promises as fsPromises } from 'fs';

const { readFile, stat } = fsPromises;

const DEFAULT_IGNORED_EXTENSIONS = ['spec', 'test', 'd', 'map'];
const DEFAULT_EXTENSIONS = ['gql', 'graphql', 'graphqls', 'ts', 'js'];
const DEFAULT_EXPORT_NAMES = ['schema', 'typeDef', 'typeDefs', 'resolver', 'resolvers'];
const DEFAULT_EXTRACT_EXPORTS_FACTORY =
  (exportNames: string[]) =>
  (fileExport: any): any | null => {
    if (!fileExport) {
      return null;
    }

    if (fileExport.default) {
      for (const exportName of exportNames) {
        if (fileExport.default[exportName]) {
          return fileExport.default[exportName];
        }
      }

      return fileExport.default;
    }

    for (const exportName of exportNames) {
      if (fileExport[exportName]) {
        return fileExport[exportName];
      }
    }

    return fileExport;
  };

function asArray<T>(obj: T | T[]): T[] {
  if (obj instanceof Array) {
    return obj;
  } else {
    return [obj];
  }
}

function isDirectorySync(path: string) {
  try {
    const pathStat = statSync(path);
    return pathStat.isDirectory();
  } catch (e) {
    return false;
  }
}

async function isDirectory(path: string) {
  try {
    const pathStat = await stat(path);
    return pathStat.isDirectory();
  } catch (e) {
    return false;
  }
}

function scanForFilesSync(globStr: string | string[], globOptions: GlobbyOptions = {}): string[] {
  return globbySync(globStr, { absolute: true, ...globOptions });
}

function formatExtension(extension: string): string {
  return extension.charAt(0) === '.' ? extension : `.${extension}`;
}

function buildGlob(
  basePath: string,
  extensions: string[] = [],
  ignoredExtensions: string[] = [],
  recursive?: boolean
): string {
  const ignored =
    ignoredExtensions.length > 0 ? `!(${ignoredExtensions.map(e => `*${formatExtension(e)}`).join('|')})` : '*';
  const ext = extensions.map(e => `*${formatExtension(e)}`).join('|');

  return `${basePath}${recursive ? '/**' : ''}/${ignored}+(${ext})`;
}

/**
 * Additional options for loading files
 */
export interface LoadFilesOptions {
  // Extensions to explicitly ignore. Defaults to `['spec', 'test', 'd', 'map']`
  ignoredExtensions?: string[];
  // Extensions to include when loading files. Defaults to `['gql', 'graphql', 'graphqls', 'ts', 'js']`
  extensions?: string[];
  // Load files using `require` regardless of the file extension
  useRequire?: boolean;
  // An alternative to `require` to use if `require` would be used to load a file
  requireMethod?: any;
  // Additional options to pass to globby
  globOptions?: GlobbyOptions;
  // Named exports to extract from each file. Defaults to ['typeDefs', 'schema']
  exportNames?: string[];
  // Load files from nested directories. Set to `false` to only search the top-level directory.
  recursive?: boolean;
  // Set to `true` to ignore files named `index.js` and `index.ts`
  ignoreIndex?: boolean;
  // Custom export extractor function
  extractExports?: (fileExport: any) => any;
}

const LoadFilesDefaultOptions: LoadFilesOptions = {
  ignoredExtensions: DEFAULT_IGNORED_EXTENSIONS,
  extensions: DEFAULT_EXTENSIONS,
  useRequire: false,
  requireMethod: null,
  globOptions: {
    absolute: true,
  },
  exportNames: DEFAULT_EXPORT_NAMES,
  recursive: true,
  ignoreIndex: false,
};

/**
 * Synchronously loads files using the provided glob pattern.
 * @param pattern Glob pattern or patterns to use when loading files
 * @param options Additional options
 */
export function loadFilesSync<T = any>(
  pattern: string | string[],
  options: LoadFilesOptions = LoadFilesDefaultOptions
): T[] {
  const execOptions = { ...LoadFilesDefaultOptions, ...options };
  const relevantPaths = scanForFilesSync(
    asArray(pattern).map(path =>
      isDirectorySync(path)
        ? buildGlob(unixify(path), execOptions.extensions, execOptions.ignoredExtensions, execOptions.recursive)
        : unixify(path)
    ),
    options.globOptions
  );

  const extractExports = execOptions.extractExports || DEFAULT_EXTRACT_EXPORTS_FACTORY(execOptions.exportNames ?? []);
  const requireMethod = execOptions.requireMethod || require;

  return relevantPaths
    .map(path => {
      if (!checkExtension(path, options)) {
        return null;
      }

      if (isIndex(path, execOptions.extensions) && options.ignoreIndex) {
        return false;
      }

      const extension = extname(path);

      if (extension === formatExtension('js') || extension === formatExtension('ts') || execOptions.useRequire) {
        const fileExports = requireMethod(path);
        const extractedExport = extractExports(fileExports);
        return extractedExport;
      } else {
        return readFileSync(path, { encoding: 'utf-8' });
      }
    })
    .filter(v => v);
}

async function scanForFiles(globStr: string | string[], globOptions: GlobbyOptions = {}): Promise<string[]> {
  return globby(globStr, { absolute: true, ...globOptions });
}

const checkExtension = (
  path: string,
  { extensions, ignoredExtensions }: { extensions?: string[]; ignoredExtensions?: string[] }
) => {
  if (ignoredExtensions) {
    for (const ignoredExtension of ignoredExtensions) {
      if (path.endsWith(formatExtension(ignoredExtension))) {
        return false;
      }
    }
  }

  if (!extensions) {
    return true;
  }

  for (const extension of extensions) {
    const formattedExtension = formatExtension(extension);
    if (path.endsWith(formattedExtension)) {
      if (ignoredExtensions) {
        for (const ignoredExtension of ignoredExtensions) {
          const formattedIgnoredExtension = formatExtension(ignoredExtension);
          if (path.endsWith(formattedIgnoredExtension + formattedExtension)) {
            return false;
          }
        }
      }
      return true;
    }
  }

  return false;
};

/**
 * Asynchronously loads files using the provided glob pattern.
 * @param pattern Glob pattern or patterns to use when loading files
 * @param options Additional options
 */
export async function loadFiles(
  pattern: string | string[],
  options: LoadFilesOptions = LoadFilesDefaultOptions
): Promise<any[]> {
  const execOptions = { ...LoadFilesDefaultOptions, ...options };
  const relevantPaths = await scanForFiles(
    await Promise.all(
      asArray(pattern).map(async path =>
        (await isDirectory(path))
          ? buildGlob(unixify(path), execOptions.extensions, execOptions.ignoredExtensions, execOptions.recursive)
          : unixify(path)
      )
    ),
    options.globOptions
  );

  const extractExports = execOptions.extractExports || DEFAULT_EXTRACT_EXPORTS_FACTORY(execOptions.exportNames ?? []);
  const defaultRequireMethod = (path: string) => import(path).catch(async () => require(path));
  const requireMethod = execOptions.requireMethod || defaultRequireMethod;

  return Promise.all(
    relevantPaths
      .filter(path => checkExtension(path, options) && !(isIndex(path, execOptions.extensions) && options.ignoreIndex))
      .map(async path => {
        const extension = extname(path);

        if (extension === formatExtension('js') || extension === formatExtension('ts') || execOptions.useRequire) {
          const fileExports = await requireMethod(path);
          const extractedExport = extractExports(fileExports);
          return extractedExport;
        } else {
          return readFile(path, { encoding: 'utf-8' });
        }
      })
  );
}

function isIndex(path: string, extensions: string[] = []): boolean {
  const IS_INDEX = /(\/|\\)index\.[^\/\\]+$/i; // (/ or \) AND `index.` AND (everything except \ and /)(end of line)
  return IS_INDEX.test(path) && extensions.some(ext => path.endsWith(formatExtension(ext)));
}
