import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchSchemas } from '@graphql-tools/stitch';
import { GraphQLInputObjectType, GraphQLObjectType, GraphQLInterfaceType, } from 'graphql';

function assertGraphQLObjectType(input: unknown): asserts input is GraphQLObjectType {
  if (input instanceof GraphQLObjectType) {
    return
  }
  throw new Error("Expected GraphQLObjectType.")
}
function assertGraphQLInterfaceType(input: unknown): asserts input is GraphQLInterfaceType {
  if (input instanceof GraphQLInterfaceType) {
    return
  }
  throw new Error("Expected GraphQLInterfaceType.")
}
function assertGraphQLInputObjectType(input: unknown): asserts input is GraphQLInputObjectType {
  if (input instanceof GraphQLInputObjectType) {
    return
  }
  throw new Error("Expected GraphQLInputObjectType.")
}

describe('merge conflict handlers', () => {
  const listings1Schema = makeExecutableSchema({
    typeDefs: `
      "ignore! - do not document here"
      type Listing implements IListing {
        "type identifier"
        id: ID!
      }
      interface IListing {
        "interface identifier"
        id: ID!
      }
      "An input"
      input ListingInput {
        "input identifier"
        id: ID!
      }
    `
  });

  const listings2Schema = makeExecutableSchema({
    typeDefs: `
      "A type"
      type Listing implements IListing {
        "ignore! - do not document here"
        id: ID!
      }
      "An interface"
      interface IListing {
        id: ID!
      }
      input ListingInput {
        "ignore! - do not document here"
        id: ID!
      }
    `
  });

  it('handles description merges', () => {
    const gatewaySchema = stitchSchemas({
      subschemas: [
        { schema: listings1Schema },
        { schema: listings2Schema },
      ],
      typeMergingOptions: {
        typeDescriptionsMerger(candidates) {
          const candidate = candidates.find(({ type }) => {
            const description = (type.description || '').trim();
            return description.length && !description.startsWith('ignore!');
          }) || candidates[candidates.length-1];
          return candidate.type.description;
        },
        fieldConfigMerger(candidates) {
          const fieldConfigs = candidates.map(c => c.fieldConfig);
          return fieldConfigs.find(({ description }) => {
            description = (description || '').trim();
            return description && !description.startsWith('ignore!');
          }) || fieldConfigs[fieldConfigs.length-1];
        },
        inputFieldConfigMerger(candidates) {
          const inputFieldConfig = candidates.map(c => c.inputFieldConfig);
          return inputFieldConfig.find(({ description }) => {
            description = (description || '').trim();
            return description && !description.startsWith('ignore!');
          }) || inputFieldConfig[inputFieldConfig.length-1];
        }
      },
    });
    const Listing = gatewaySchema.getType('Listing')
    assertGraphQLObjectType(Listing)
    const IListing = gatewaySchema.getType('IListing')
    assertGraphQLInterfaceType(IListing)
    const ListingInput = gatewaySchema.getType('ListingInput')
    assertGraphQLInputObjectType(ListingInput)
    expect(Listing.description).toEqual('A type');
    expect(IListing.description).toEqual('An interface');
    expect(ListingInput.description).toEqual('An input');
    expect(Listing.getFields()['id'].description).toEqual('type identifier');
    expect(IListing.getFields()['id'].description).toEqual('interface identifier');
    expect(ListingInput.getFields()['id'].description).toEqual('input identifier');
  });
});
