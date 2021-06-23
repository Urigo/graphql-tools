// adapted from https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby-source-graphql/src/batching/merge-queries.js

export function createPrefix(index: number): string {
  return `graphqlTools${index}_`;
}

export function parseKey(prefixedKey: string): null | { index: number; originalKey: string } {
  const match = /^graphqlTools([\d]+)_(.*)$/.exec(prefixedKey);
  if (match && match.length === 3 && !isNaN(Number(match[1])) && match[2]) {
    return { index: Number(match[1]), originalKey: match[2] };
  }
  return null;
}
