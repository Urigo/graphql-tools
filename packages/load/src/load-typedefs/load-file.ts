import { Source, Maybe } from '@graphql-tools/utils';
import { env } from 'process';
import { LoadTypedefsOptions } from '../load-typedefs';

export async function loadFile(pointer: string, options: LoadTypedefsOptions): Promise<Maybe<Source>> {
  const cached = useCache({ pointer, options });

  if (cached) {
    return cached;
  }

  for await (const loader of options.loaders) {
    try {
      const canLoad = await loader.canLoad(pointer, options);

      if (canLoad) {
        const loadedValue = await loader.load(pointer, options);
        return loadedValue;
      }
    } catch (error) {
      if (env['DEBUG']) {
        console.error(`Failed to find any GraphQL type definitions in: ${pointer} - ${error.message}`);
      }
      throw error;
    }
  }

  return undefined;
}

export function loadFileSync(pointer: string, options: LoadTypedefsOptions): Maybe<Source> {
  const cached = useCache({ pointer, options });

  if (cached) {
    return cached;
  }

  for (const loader of options.loaders) {
    try {
      const canLoad = loader.canLoadSync && loader.loadSync && loader.canLoadSync(pointer, options);

      if (canLoad) {
        // We check for the existence so it is okay to force non null
        return loader.loadSync!(pointer, options);
      }
    } catch (error) {
      if (env['DEBUG']) {
        console.error(`Failed to find any GraphQL type definitions in: ${pointer} - ${error.message}`);
      }
      throw error;
    }
  }

  return undefined;
}

function useCache<T extends any>({ pointer, options }: { pointer: string; options: T }) {
  if (options['cache']) {
    return options['cache'][pointer];
  }
}
