import {
  Kind,
  validate,
  GraphQLSchema,
  GraphQLError,
  specifiedRules,
  FragmentDefinitionNode,
  ValidationContext,
  ASTVisitor,
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
  const allFragments: FragmentDefinitionNode[] = [];

  documentFiles.forEach(documentFile => {
    if (documentFile.document) {
      for (const definitionNode of documentFile.document.definitions) {
        if (definitionNode.kind === Kind.FRAGMENT_DEFINITION) {
          allFragments.push(definitionNode);
        }
      }
    }
  });

  const allErrors: LoadDocumentError[] = [];

  await Promise.all(
    documentFiles.map(async documentFile => {
      const documentToValidate = {
        kind: Kind.DOCUMENT,
        definitions: [...allFragments, ...(documentFile.document?.definitions ?? [])].filter(
          (definition, index, list) => {
            if (definition.kind === Kind.FRAGMENT_DEFINITION) {
              const firstIndex = list.findIndex(
                def => def.kind === Kind.FRAGMENT_DEFINITION && def.name.value === definition.name.value
              );
              const isDuplicated = firstIndex !== index;

              if (isDuplicated) {
                return false;
              }
            }

            return true;
          }
        ),
      };

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
        graphQLError.locations?.forEach(
          location => (error.stack += `\n    at ${loadDocumentError.filePath}:${location.line}:${location.column}`)
        );

        errors.push(error);
      }
    }

    throw new AggregateError(errors, 'Validation failed');
  }
}

function createDefaultRules() {
  const ignored = ['NoUnusedFragmentsRule', 'NoUnusedVariablesRule', 'KnownDirectivesRule'];

  // GraphQL v14 has no Rule suffix in function names
  // Adding `*Rule` makes validation backwards compatible
  ignored.forEach(rule => {
    ignored.push(rule.replace(/Rule$/, ''));
  });

  return specifiedRules.filter((f: (...args: any[]) => any) => !ignored.includes(f.name));
}
