import {
  Kind,
  validate,
  GraphQLSchema,
  GraphQLError,
  specifiedRules,
  FragmentDefinitionNode,
  ValidationContext,
  ASTVisitor,
  DefinitionNode,
  concatAST,
  DocumentNode,
} from 'graphql';
import { Source } from './loaders';
import { AggregateError } from './AggregateError';

export type ValidationRule = (context: ValidationContext) => ASTVisitor;

export interface LoadDocumentError {
  readonly filePath?: string;
  readonly errors: ReadonlyArray<GraphQLError>;
}

export async function validateGraphQlDocuments(
  schema: GraphQLSchema,
  documentFiles: Source[],
  effectiveRules?: ValidationRule[]
): Promise<ReadonlyArray<LoadDocumentError>> {
  effectiveRules = effectiveRules || createDefaultRules();
  const allFragmentMap = new Map<string, FragmentDefinitionNode>();
  const documentFileObjectsToValidate: {
    location?: string;
    document: DocumentNode;
  }[] = [];

  for (const documentFile of documentFiles) {
    if (documentFile.document) {
      const definitionsToValidate: DefinitionNode[] = [];
      for (const definitionNode of documentFile.document.definitions) {
        if (definitionNode.kind === Kind.FRAGMENT_DEFINITION) {
          allFragmentMap.set(definitionNode.name.value, definitionNode);
        } else {
          definitionsToValidate.push(definitionNode);
        }
      }
      documentFileObjectsToValidate.push({
        location: documentFile.location,
        document: {
          kind: Kind.DOCUMENT,
          definitions: definitionsToValidate,
        },
      });
    }
  }

  const allErrors: LoadDocumentError[] = [];

  const allFragmentsDocument: DocumentNode = {
    kind: Kind.DOCUMENT,
    definitions: [...allFragmentMap.values()],
  };

  await Promise.all(
    documentFileObjectsToValidate.map(async documentFile => {
      const documentToValidate = concatAST([allFragmentsDocument, documentFile.document]);

      const errors = validate(schema, documentToValidate, effectiveRules);

      if (errors.length > 0) {
        allErrors.push({
          filePath: documentFile.location,
          errors,
        });
      }
    })
  );

  return allErrors;
}

export function checkValidationErrors(loadDocumentErrors: ReadonlyArray<LoadDocumentError>): void | never {
  if (loadDocumentErrors.length > 0) {
    const errors: Error[] = [];

    for (const loadDocumentError of loadDocumentErrors) {
      for (const graphQLError of loadDocumentError.errors) {
        const error = new Error();
        error.name = 'GraphQLDocumentError';
        error.message = `${error.name}: ${graphQLError.message}`;
        error.stack = error.message;
        if (graphQLError.locations) {
          for (const location of graphQLError.locations) {
            error.stack += `\n    at ${loadDocumentError.filePath}:${location.line}:${location.column}`;
          }
        }

        errors.push(error);
      }
    }

    throw new AggregateError(errors, `GraphQL Document Validation failed with ${loadDocumentErrors.length} errors`);
  }
}

function createDefaultRules() {
  const ignored = ['NoUnusedFragmentsRule', 'NoUnusedVariablesRule', 'KnownDirectivesRule'];
  const v4ignored = ignored.map(rule => rule.replace(/Rule$/, ''));

  return specifiedRules.filter(
    (f: (...args: any[]) => any) => !ignored.includes(f.name) && !v4ignored.includes(f.name)
  );
}
