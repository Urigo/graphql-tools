import { execFile, execFileSync } from 'child_process';

type Input = { ref: string; path: string };

const createLoadError = (error: any) => new Error('Unable to load file from git: ' + error);
const createShowCommand = ({ ref, path }: Input): string[] => {
  return ['show', `${ref}:${path}`];
};

const createTreeError = (error: Error) => new Error('Unable to load the file tree from git: ' +  error);
const createTreeCommand = ({ ref }):string[] => {
  return [
    'ls-tree',
    '-r',
    '--name-only',
    ref,
  ]
}

/**
 * @internal
 */
export async function readTreeAtRef(ref: string): Promise<string[] | never> {
  try {
    return await new Promise((resolve, reject) => {
      execFile('git', createTreeCommand({ ref }), { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 1024 }, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.split('\n'));
        }
      });
    });
  } catch (error) {
    throw createTreeError(error);
  }
}

/**
 * @internal
 */
export function readTreeAtRefSync(ref: string): string[] | never {
  try {
    return execFileSync('git', createTreeCommand({ ref }), { encoding: 'utf-8' }).split('\n');
  } catch (error) {
    throw createTreeError(error);
  }
}

/**
 * @internal
 */
export async function loadFromGit(input: Input): Promise<string | never> {
  try {
    return await new Promise((resolve, reject) => {
      execFile('git', createShowCommand(input), { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 1024 }, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  } catch (error) {
    throw createLoadError(error);
  }
}

/**
 * @internal
 */
export function loadFromGitSync(input: Input): string | never {
  try {
    return execFileSync('git', createShowCommand(input), { encoding: 'utf-8' });
  } catch (error) {
    throw createLoadError(error);
  }
}
