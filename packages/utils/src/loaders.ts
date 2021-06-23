import { DocumentNode, GraphQLSchema, BuildSchemaOptions } from 'graphql';
import { GraphQLParseOptions } from './Interfaces';

export interface Source {
  document?: DocumentNode;
  schema?: GraphQLSchema;
  rawSDL?: string;
  location?: string;
}

export type SingleFileOptions = GraphQLParseOptions &
  BuildSchemaOptions & {
    cwd?: string;
  };

export type WithList<T> = T | T[];
export type ElementOf<TList> = TList extends Array<infer TElement> ? TElement : never;
export type SchemaPointer = WithList<string>;
export type SchemaPointerSingle = ElementOf<SchemaPointer>;
export type DocumentGlobPathPointer = string;
export type DocumentPointer = WithList<DocumentGlobPathPointer>;
export type DocumentPointerSingle = ElementOf<DocumentPointer>;

export interface Loader<TPointer = string, TOptions extends SingleFileOptions = SingleFileOptions> {
  loaderId(): string;
  canLoad(pointer: TPointer, options?: TOptions): Promise<boolean>;
  canLoadSync?(pointer: TPointer, options?: TOptions): boolean;
  resolveGlobs?(globs: ResolverGlobs, options?: TOptions): Promise<TPointer[] | never>;
  resolveGlobsSync?(globs: ResolverGlobs, options?: TOptions): TPointer[];
  load(pointer: TPointer, options?: TOptions): Promise<Source | null | never>;
  loadSync?(pointer: TPointer, options?: TOptions): Source | null | never;
}

export type SchemaLoader<TOptions extends SingleFileOptions = SingleFileOptions> = Loader<
  SchemaPointerSingle,
  TOptions
>;

export type DocumentLoader<TOptions extends SingleFileOptions = SingleFileOptions> = Loader<
  DocumentPointerSingle,
  TOptions
>;

export type UniversalLoader<TOptions extends SingleFileOptions = SingleFileOptions> = Loader<
  SchemaPointerSingle | DocumentPointerSingle,
  TOptions
>;

export type ResolverGlobs = {
  globs: string[];
  ignores: string[];
};
