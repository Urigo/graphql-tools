import { GraphQLError } from 'graphql';
import { relocatedError } from '../src/errors';

describe('Errors', () => {
  describe('relocatedError', () => {
    test('should adjust the path of a GraphqlError', () => {
      const originalError = new GraphQLError('test', null as any, null, null, [
        'test',
      ]);
      const newError = relocatedError(originalError, ['test', 1]);
      const expectedError = new GraphQLError('test', null as any, null, null, [
        'test',
        1,
      ]);
      expect(newError).toEqual(expectedError);
    });
  });
});
