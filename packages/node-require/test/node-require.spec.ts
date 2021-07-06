import { handleModule } from '../src';
import { print } from 'graphql';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('GraphQL Node Import', () => {
  it('should import correct definitions', () => {
    const filePath = './fixtures/test.graphql';
    const m: any = {};
    handleModule(m, join(__dirname, filePath));
    const typeDefs = m.exports;
    expect(print(typeDefs).replace(/\s\s+/g, ' ')).toBe(
      readFileSync(require.resolve(filePath), 'utf8').replace(/\s\s+/g, ' ')
    );
  });
});
