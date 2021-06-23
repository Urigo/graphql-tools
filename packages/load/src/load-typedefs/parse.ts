import { Source, printSchemaWithDirectives, fixSchemaAst, parseGraphQLSDL } from '@graphql-tools/utils';
import { printWithComments, resetComments } from '@graphql-tools/merge';
import { filterKind } from '../filter-document-kind';

type Options = any;
type Input = {
  options: Options;
  source: Source;
};
type AddValidSource = (source: Source) => void;
type ParseOptions = {
  partialSource: Source;
  options: any;
  globOptions: any;
  pointerOptionMap: any;
  addValidSource: AddValidSource;
};

export function parseSource({ partialSource, options, globOptions, pointerOptionMap, addValidSource }: ParseOptions) {
  if (partialSource) {
    const input = prepareInput({
      source: partialSource,
      options,
      globOptions,
      pointerOptionMap,
    });

    parseSchema(input);
    parseRawSDL(input);

    if (input.source.document) {
      useKindsFilter(input);
      useComments(input);
      collectValidSources(input, addValidSource);
    }
  }
}

//

function prepareInput({
  source,
  options,
  globOptions,
  pointerOptionMap,
}: {
  source: Source;
  options: any;
  globOptions: any;
  pointerOptionMap: any;
}): Input {
  let specificOptions = {
    ...options,
  };

  if (source.location) {
    specificOptions = {
      ...specificOptions,
      ...(source.location in pointerOptionMap ? globOptions : pointerOptionMap[source.location]),
    };
  }

  return { source: { ...source }, options: specificOptions };
}

function parseSchema(input: Input) {
  if (input.source.schema) {
    input.source.schema = fixSchemaAst(input.source.schema, input.options);
    input.source.rawSDL = printSchemaWithDirectives(input.source.schema, input.options);
  }
}

function parseRawSDL(input: Input) {
  if (input.source.rawSDL) {
    input.source.document = parseGraphQLSDL(input.source.location, input.source.rawSDL, input.options).document;
  }
}

function useKindsFilter(input: Input) {
  if (input.options.filterKinds) {
    input.source.document = filterKind(input.source.document, input.options.filterKinds);
  }
}

function useComments(input: Input) {
  if (!input.source.rawSDL && input.source.document) {
    input.source.rawSDL = printWithComments(input.source.document);
    resetComments();
  }
}

function collectValidSources(input: Input, addValidSource: AddValidSource) {
  if (input.source.document?.definitions && input.source.document.definitions.length > 0) {
    addValidSource(input.source);
  }
}
