import { makeExecutableSchema } from '@graphql-tools/schema';
import { splitMergedTypeEntryPointsTransformer } from '@graphql-tools/stitch';
import { assertSome } from '@graphql-tools/utils';

const schema = makeExecutableSchema({ typeDefs: 'type Query { go:Int }' });

describe('splitMergedTypeEntryPointsTransformer', () => {
  it('applies merged type config entryPoints', () => {
    const results = splitMergedTypeEntryPointsTransformer({
      schema,
      merge: {
        Product: {
          entryPoints: [{
            selectionSet: '{ yep }',
            fieldName: 'yep',
          }],
        }
      }
    });

    expect(results.length).toEqual(1);
    assertSome(results[0].merge)
    expect(results[0].merge['Product']).toEqual({
      selectionSet: '{ yep }',
      fieldName: 'yep',
    });
  });

  it('raises for entryPoints with selectionSet, fieldName, or resolver', () => {
    expect(() => {
      splitMergedTypeEntryPointsTransformer({
        schema,
        merge: {
          Product: {
            entryPoints: [{ selectionSet: '{ yep }', fieldName: 'yep' }],
            selectionSet: '{ nope }',
          }
        }
      });
    }).toThrow();

    expect(() => {
      splitMergedTypeEntryPointsTransformer({
        schema,
        merge: {
          Product: {
            entryPoints: [{ selectionSet: '{ yep }', fieldName: 'yep' }],
            fieldName: 'thing',
          }
        }
      });
    }).toThrow();

    expect(() => {
      splitMergedTypeEntryPointsTransformer({
        schema,
        merge: {
          Product: {
            entryPoints: [{ resolve: () => null }],
            resolve: () => null,
          }
        }
      });
    }).toThrow();
  });

  it('builds multiple subschemas for separate entryPoints', () => {
    const results = splitMergedTypeEntryPointsTransformer({
      schema,
      merge: {
        Product: {
          entryPoints: [{
            selectionSet: '{ id }',
            fieldName: 'productById',
          }, {
            selectionSet: '{ upc }',
            fieldName: 'productByUpc',
          }]
        }
      }
    });

    expect(results.length).toEqual(2);
    assertSome(results[0].merge)
    expect(results[0].merge['Product']).toEqual({
      selectionSet: '{ id }',
      fieldName: 'productById',
    });
    assertSome(results[1].merge)
    expect(results[1].merge['Product']).toEqual({
      selectionSet: '{ upc }',
      fieldName: 'productByUpc',
    });
  });

  it('consolidates type permutations into shared subschemas', () => {
    const results = splitMergedTypeEntryPointsTransformer({
      schema,
      merge: {
        Product: {
          entryPoints: [{
            selectionSet: '{ id }',
            fieldName: 'productById',
          }, {
            selectionSet: '{ upc }',
            fieldName: 'productByUpc',
          }, {
            selectionSet: '{ key }',
            fieldName: 'productByKey',
          }]
        },
        Video: {
          entryPoints: [{
            selectionSet: '{ id }',
            fieldName: 'videoById',
          }, {
            selectionSet: '{ key }',
            fieldName: 'videoByKey',
          }],
          fields: {
            duration: { canonical: true },
          },
          canonical: true,
        },
        User: {
          entryPoints: [{
            selectionSet: '{ id }',
            fieldName: 'userById',
          }]
        },
        Thing: {
          selectionSet: '{ id }',
          fieldName: 'thingById',
        }
      }
    });

    expect(results.length).toEqual(3);
    expect(results[0].merge).toEqual({
      Product: {
        selectionSet: '{ id }',
        fieldName: 'productById',
      },
      Video: {
        selectionSet: '{ id }',
        fieldName: 'videoById',
        canonical: true,
        fields: {
          duration: { canonical: true },
        },
      },
      User: {
        selectionSet: '{ id }',
        fieldName: 'userById',
      },
      Thing: {
        selectionSet: '{ id }',
        fieldName: 'thingById',
      },
    });

    expect(results[1].merge).toEqual({
      Product: {
        selectionSet: '{ upc }',
        fieldName: 'productByUpc',
      },
      Video: {
        selectionSet: '{ key }',
        fieldName: 'videoByKey',
        fields: {
          duration: {},
        },
      },
    });

    expect(results[2].merge).toEqual({
      Product: {
        selectionSet: '{ key }',
        fieldName: 'productByKey',
      },
    });
  });
});
