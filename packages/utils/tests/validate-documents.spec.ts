import { checkValidationErrors, validateGraphQlDocuments } from '../src';
import { buildSchema, parse, GraphQLError } from 'graphql';

describe('validateGraphQlDocuments', () => {
  it('Should throw an informative error when validation errors happens, also check for fragments validation even why they are duplicated', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type OtherStuff {
        foo: String
      }

      type Pizzeria {
        id: Int
        name: String
        location: String
      }

      type Query {
        otherStuff: OtherStuff
      }
    `);

    const fragment = /* GraphQL */ `
      fragment pizzeriaFragment on Pizzeria {
        name
      }
    `;

    const result = await validateGraphQlDocuments(schema, [
      {
        location: 'fragment.graphql',
        document: parse(fragment),
      },
      {
        location: 'query.graphql',
        document: parse(/* GraphQL */ `
          query searchPage {
            otherStuff {
              foo
            }
            ...pizzeriaFragment
          }

          ${fragment}
        `),
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe('query.graphql');
    expect(result[0].errors[0] instanceof GraphQLError).toBeTruthy();
    expect(result[0].errors[0].message).toBe('Fragment "pizzeriaFragment" cannot be spread here as objects of type "Query" can never be of type "Pizzeria".');

    try {
      checkValidationErrors(result);
      expect(true).toBeFalsy();
    } catch (aggregateError) {
      const { errors } = aggregateError;
      expect(Symbol.iterator in errors).toBeTruthy();
      const generator = errors[Symbol.iterator]();

      const error = generator.next().value;

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toEqual('GraphQLDocumentError');
      expect(error.message).toEqual('GraphQLDocumentError: Fragment "pizzeriaFragment" cannot be spread here as objects of type "Query" can never be of type "Pizzeria".');
      expect(error.stack).toEqual(['GraphQLDocumentError: Fragment "pizzeriaFragment" cannot be spread here as objects of type "Query" can never be of type "Pizzeria".', '    at query.graphql:6:13'].join('\n'));
    }
  });
});

describe('checkValidationErrors', () => {
  it('Should throw errors source files and locations', async () => {
    const loadDocumentErrors = [
      {
        filePath: 'packages/server/src/modules/github-check-run/providers/documents/create-check-run.mutation.graphql',
        errors: [
          {
            message: 'Cannot query field "randomField" on type "CheckRun".',
            locations: [
              {
                line: 7,
                column: 13,
              },
            ],
          },
          {
            message: 'Cannot query field "randomField2" on type "CheckRun".',
            locations: [
              {
                line: 8,
                column: 13,
              },
            ],
          },
        ],
      },
      {
        filePath: 'packages/server/src/modules/github-check-run/providers/documents/check-run.query.graphql',
        errors: [
          {
            message: 'Cannot query field "randomField" on type "CheckRun".',
            locations: [
              {
                line: 7,
                column: 13,
              },
            ],
          },
        ],
      },
    ];

    let errors;
    try {
      checkValidationErrors(loadDocumentErrors as any);
    } catch (aggregateError) {
      errors = aggregateError.errors;
    }

    expect(Symbol.iterator in errors).toBeTruthy();

    let error;
    const generator = errors[Symbol.iterator]();

    error = generator.next().value;

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toEqual('GraphQLDocumentError');
    expect(error.message).toEqual('GraphQLDocumentError: Cannot query field "randomField" on type "CheckRun".');
    expect(error.stack).toEqual(['GraphQLDocumentError: Cannot query field "randomField" on type "CheckRun".', '    at packages/server/src/modules/github-check-run/providers/documents/create-check-run.mutation.graphql:7:13'].join('\n'));

    error = generator.next().value;

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toEqual('GraphQLDocumentError');
    expect(error.message).toEqual('GraphQLDocumentError: Cannot query field "randomField2" on type "CheckRun".');
    expect(error.stack).toEqual(['GraphQLDocumentError: Cannot query field "randomField2" on type "CheckRun".', '    at packages/server/src/modules/github-check-run/providers/documents/create-check-run.mutation.graphql:8:13'].join('\n'));

    error = generator.next().value;

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toEqual('GraphQLDocumentError');
    expect(error.message).toEqual('GraphQLDocumentError: Cannot query field "randomField" on type "CheckRun".');
    expect(error.stack).toEqual(['GraphQLDocumentError: Cannot query field "randomField" on type "CheckRun".', '    at packages/server/src/modules/github-check-run/providers/documents/check-run.query.graphql:7:13'].join('\n'));
  });
});
