import { parse } from 'graphql';

import { createRequest } from '@graphql-tools/delegate';
import { parseSelectionSet } from '@graphql-tools/utils';

function removeLocations(value: any): any {
  if (value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => removeLocations(v));
  } else if (typeof value === 'object') {
    const newValue = {};
    for (const key in value) {
      if (key !== 'loc') {
        newValue[key] = removeLocations(value[key]);
      }
    }
    return newValue;
  }

  return value;
}

describe('requests', () => {
  test('should create requests', () => {
    const request = removeLocations(
      createRequest({
        targetOperation: 'query',
        targetFieldName: 'version',
        selectionSet: parseSelectionSet(`{
          major
          minor
          patch
        }`),
        targetOperationName: 'test'
      }),
    );

    const expectedRequest = removeLocations({
      document: parse(`
        query test {
          version {
            major
            minor
            patch
          }
        }
      `),
      variables: {},
      operationName: 'test'
    });

    expect(expectedRequest).toMatchObject(request);
  });
});
