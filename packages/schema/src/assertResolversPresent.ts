import { GraphQLSchema, GraphQLField, getNamedType, isScalarType } from 'graphql';

import { IResolverValidationOptions, forEachField, ValidatorBehavior } from '@graphql-tools/utils';

export function assertResolversPresent(
  schema: GraphQLSchema,
  resolverValidationOptions: IResolverValidationOptions = {}
): void {
  const { requireResolversForArgs, requireResolversForNonScalar, requireResolversForAllFields } =
    resolverValidationOptions;

  if (requireResolversForAllFields && (requireResolversForArgs || requireResolversForNonScalar)) {
    throw new TypeError(
      'requireResolversForAllFields takes precedence over the more specific assertions. ' +
        'Please configure either requireResolversForAllFields or requireResolversForArgs / ' +
        'requireResolversForNonScalar, but not a combination of them.'
    );
  }

  forEachField(schema, (field, typeName, fieldName) => {
    // requires a resolver for *every* field.
    if (requireResolversForAllFields) {
      expectResolver('requireResolversForAllFields', requireResolversForAllFields, field, typeName, fieldName);
    }

    // requires a resolver on every field that has arguments
    if (requireResolversForArgs && field.args.length > 0) {
      expectResolver('requireResolversForArgs', requireResolversForArgs, field, typeName, fieldName);
    }

    // requires a resolver on every field that returns a non-scalar type
    if (requireResolversForNonScalar !== 'ignore' && !isScalarType(getNamedType(field.type))) {
      expectResolver('requireResolversForNonScalar', requireResolversForNonScalar, field, typeName, fieldName);
    }
  });
}

function expectResolver(
  validator: string,
  behavior: ValidatorBehavior | undefined,
  field: GraphQLField<any, any>,
  typeName: string,
  fieldName: string
) {
  if (!field.resolve) {
    const message = `Resolver missing for "${typeName}.${fieldName}".
To disable this validator, use:
  resolverValidationOptions: {
    ${validator}: 'ignore'
  }`;

    if (behavior === 'error') {
      throw new Error(message);
    }

    if (behavior === 'warn') {
      // eslint-disable-next-line no-console
      console.warn(message);
    }

    return;
  }
  if (typeof field.resolve !== 'function') {
    throw new Error(`Resolver "${typeName}.${fieldName}" must be a function`);
  }
}
