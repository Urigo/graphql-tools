import { Source, SingleFileOptions, Loader, compareStrings } from '@graphql-tools/utils';
import { normalizePointers } from './utils/pointers';
import { applyDefaultOptions } from './load-typedefs/options';
import { collectSources, collectSourcesSync } from './load-typedefs/collect-sources';
import { parseSource } from './load-typedefs/parse';
import { useLimit } from './utils/helpers';

const CONCURRENCY_LIMIT = 100;

export type LoadTypedefsOptions<ExtraConfig = { [key: string]: any }> = SingleFileOptions &
  ExtraConfig & {
    cache?: { [key: string]: Source };
    loaders: Loader[];
    filterKinds?: string[];
    ignore?: string | string[];
    sort?: boolean;
  };

export type UnnormalizedTypeDefPointer = { [key: string]: any } | string;

/**
 * Asynchronously loads any GraphQL documents (i.e. executable documents like
 * operations and fragments as well as type system definitions) from the
 * provided pointers.
 * @param pointerOrPointers Pointers to the sources to load the documents from
 * @param options Additional options
 */
export async function loadTypedefs<AdditionalConfig = Record<string, unknown>>(
  pointerOrPointers: UnnormalizedTypeDefPointer | UnnormalizedTypeDefPointer[],
  options: LoadTypedefsOptions<Partial<AdditionalConfig>>
): Promise<Source[]> {
  const pointerOptionMap = normalizePointers(pointerOrPointers);
  const globOptions: any = {};

  applyDefaultOptions<AdditionalConfig>(options);

  const sources = await collectSources({
    pointerOptionMap,
    options,
  });

  const validSources: Source[] = [];

  // If we have few k of files it may be an issue
  const limit = useLimit(CONCURRENCY_LIMIT);

  await Promise.all(
    sources.map(partialSource =>
      limit(() =>
        parseSource({
          partialSource,
          options,
          globOptions,
          pointerOptionMap,
          addValidSource(source) {
            validSources.push(source);
          },
        })
      )
    )
  );

  return prepareResult({ options, pointerOptionMap, validSources });
}

/**
 * Synchronously loads any GraphQL documents (i.e. executable documents like
 * operations and fragments as well as type system definitions) from the
 * provided pointers.
 * @param pointerOrPointers Pointers to the sources to load the documents from
 * @param options Additional options
 */
export function loadTypedefsSync<AdditionalConfig = Record<string, unknown>>(
  pointerOrPointers: UnnormalizedTypeDefPointer | UnnormalizedTypeDefPointer[],
  options: LoadTypedefsOptions<Partial<AdditionalConfig>>
): Source[] {
  const pointerOptionMap = normalizePointers(pointerOrPointers);
  const globOptions: any = {};

  applyDefaultOptions<AdditionalConfig>(options);

  const sources = collectSourcesSync({
    pointerOptionMap,
    options,
  });

  const validSources: Source[] = [];

  for (const partialSource of sources) {
    parseSource({
      partialSource,
      options,
      globOptions,
      pointerOptionMap,
      addValidSource(source) {
        validSources.push(source);
      },
    });
  }

  return prepareResult({ options, pointerOptionMap, validSources });
}

//

function prepareResult({
  options,
  pointerOptionMap,
  validSources,
}: {
  options: any;
  pointerOptionMap: any;
  validSources: Source[];
}) {
  const pointerList = Object.keys(pointerOptionMap);

  if (pointerList.length > 0 && validSources.length === 0) {
    throw new Error(`
      Unable to find any GraphQL type definitions for the following pointers:
        ${pointerList.map(
          p => `
          - ${p}
          `
        )}`);
  }

  return options.sort
    ? validSources.sort((left, right) => compareStrings(left.location, right.location))
    : validSources;
}
