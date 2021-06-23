import {
  GraphQLSchema,
  GraphQLFieldResolver,
  GraphQLNonNull,
  graphql,
  GraphQLObjectType,
  GraphQLFieldConfigMap,
} from 'graphql';

import { mapSchema, MapperKind, addTypes, modifyObjectFields, assertSome } from '@graphql-tools/utils';
import { wrapSchema, RenameTypes } from '../src';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { addMocksToSchema } from '@graphql-tools/mock';

// see https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby-source-graphql/src/transforms.js
// and https://github.com/gatsbyjs/gatsby/issues/22128
// and https://github.com/ardatan/graphql-tools/issues/1462

class NamespaceUnderFieldTransform {
  private readonly typeName: string;
  private readonly fieldName: string;
  private readonly resolver: GraphQLFieldResolver<any, any>;

  constructor({
    typeName,
    fieldName,
    resolver,
  }: {
    typeName: string;
    fieldName: string;
    resolver: GraphQLFieldResolver<any, any>;
  }) {
    this.typeName = typeName;
    this.fieldName = fieldName;
    this.resolver = resolver;
  }

  transformSchema(schema: GraphQLSchema) {
    const QueryType = schema.getQueryType();
    assertSome(QueryType)
    const queryConfig = QueryType.toConfig();

    const nestedQuery = new GraphQLObjectType({
      ...queryConfig,
      name: this.typeName,
    });

    let newSchema = addTypes(schema, [nestedQuery]);

    const newRootFieldConfigMap: GraphQLFieldConfigMap<any, any> = {
      [this.fieldName]: {
        type: new GraphQLNonNull(nestedQuery),
        resolve: (parent, args, context, info) => {
          if (this.resolver != null) {
            return this.resolver(parent, args, context, info);
          }

          return {};
        },
      },
    };

    [newSchema] = modifyObjectFields(newSchema, queryConfig.name, () => true, newRootFieldConfigMap);

    return newSchema;
  }
}

class StripNonQueryTransform {
  transformSchema(schema: GraphQLSchema) {
    return mapSchema(schema, {
      [MapperKind.MUTATION]() {
        return null;
      },
      [MapperKind.SUBSCRIPTION]() {
        return null;
      },
    });
  }
}

describe('Gatsby transforms', () => {
  test('work', async () => {
    let schema = makeExecutableSchema({
      typeDefs: `
      directive @cacheControl(maxAge: Int, scope: CacheControlScope) on FIELD_DEFINITION | OBJECT | INTERFACE

      enum CacheControlScope {
        PUBLIC
        PRIVATE
      }

      type Continent {
        code: String
        name: String
        countries: [Country]
      }

      type Country {
        code: String
        name: String
        native: String
        phone: String
        continent: Continent
        currency: String
        languages: [Language]
        emoji: String
        emojiU: String
        states: [State]
      }

      type Language {
        code: String
        name: String
        native: String
        rtl: Int
      }

      type Query {
        continents: [Continent]
        continent(code: String): Continent
        countries: [Country]
        country(code: String): Country
        languages: [Language]
        language(code: String): Language
      }

      type State {
        code: String
        name: String
        country: Country
      }

      scalar Upload
      `,
    });

    schema = addMocksToSchema({ schema });

    const transformedSchema = wrapSchema({
      schema,
      transforms: [
        new StripNonQueryTransform(),
        new RenameTypes((name) => `CountriesQuery_${name}`),
        new NamespaceUnderFieldTransform({
          typeName: 'CountriesQuery',
          fieldName: 'countries',
          resolver: () => ({}),
        }),
      ],
    });

    expect(transformedSchema).toBeInstanceOf(GraphQLSchema);

    const result = await graphql(
      transformedSchema,
      `
        {
          countries {
            language(code: "en") {
              name
            }
          }
        }
      `,
    );
    expect(result).toEqual({
      data: {
        countries: {
          language: {
            name: 'Hello World',
          },
        },
      },
    });
  });
});
