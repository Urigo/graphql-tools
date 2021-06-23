import { Source } from '@graphql-tools/utils';
import { Kind } from 'graphql';
import { LoadTypedefsOptions, loadTypedefs, loadTypedefsSync, UnnormalizedTypeDefPointer } from './load-typedefs';

type KindList = Array<typeof Kind[keyof typeof Kind]>;

/**
 * Kinds of AST nodes that are included in executable documents
 */
export const OPERATION_KINDS: KindList = [Kind.OPERATION_DEFINITION, Kind.FRAGMENT_DEFINITION];

/**
 * Kinds of AST nodes that are included in type system definition documents
 */
export const NON_OPERATION_KINDS = Object.keys(Kind)
  .reduce((prev, v) => [...prev, Kind[v]], [] as KindList)
  .filter(v => !OPERATION_KINDS.includes(v));

/**
 * Asynchronously loads executable documents (i.e. operations and fragments) from
 * the provided pointers. The pointers may be individual files or a glob pattern.
 * The files themselves may be `.graphql` files or `.js` and `.ts` (in which
 * case they will be parsed using graphql-tag-pluck).
 * @param pointerOrPointers Pointers to the files to load the documents from
 * @param options Additional options
 */
export function loadDocuments(
  pointerOrPointers: UnnormalizedTypeDefPointer | UnnormalizedTypeDefPointer[],
  options: LoadTypedefsOptions
): Promise<Source[]> {
  return loadTypedefs(pointerOrPointers, { noRequire: true, filterKinds: NON_OPERATION_KINDS, ...options });
}

/**
 * Synchronously loads executable documents (i.e. operations and fragments) from
 * the provided pointers. The pointers may be individual files or a glob pattern.
 * The files themselves may be `.graphql` files or `.js` and `.ts` (in which
 * case they will be parsed using graphql-tag-pluck).
 * @param pointerOrPointers Pointers to the files to load the documents from
 * @param options Additional options
 */
export function loadDocumentsSync(
  pointerOrPointers: UnnormalizedTypeDefPointer | UnnormalizedTypeDefPointer[],
  options: LoadTypedefsOptions
): Source[] {
  return loadTypedefsSync(pointerOrPointers, { noRequire: true, filterKinds: NON_OPERATION_KINDS, ...options });
}
