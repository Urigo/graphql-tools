// Will use the shortest indention as an axis
export const freeText = (text: string | string[], skipIndentation = false) => {
  if (text instanceof Array) {
    text = text.join('');
  }

  // This will allow inline text generation with external functions, same as ctrl+shift+c
  // As long as we surround the inline text with ==>text<==
  text = text.replace(/( *)==>((?:.|\n)*?)<==/g, (_match, baseIndent, content: string) => {
    return content
      .split('\n')
      .map(line => `${baseIndent}${line}`)
      .join('\n');
  });

  if (skipIndentation) {
    return text;
  }

  const lines = text.split('\n');

  const minIndent = lines
    .filter(line => line.trim())
    .reduce<number>((minIndent, line) => {
      const currIndent = line.match(/^ */)?.[0].length;
      if (currIndent == null) {
        return minIndent;
      }

      return currIndent < minIndent ? currIndent : minIndent;
    }, Infinity);

  return lines
    .map(line => line.slice(minIndent))
    .join('\n')
    .trim()
    .replace(/\n +\n/g, '\n\n');
};

// foo_barBaz -> ['foo', 'bar', 'Baz']
export const splitWords = (str: string) => {
  return str.replace(/[A-Z]/, ' $&').split(/[^a-zA-Z0-9]+/);
};

// upper -> Upper
export const toUpperFirst = (str: string) => {
  return str.substr(0, 1).toUpperCase() + str.substr(1).toLowerCase();
};

// foo-bar-baz -> fooBarBaz
export const toCamelCase = (str: string) => {
  const words = splitWords(str);
  const first = words.shift()?.toLowerCase() ?? '';
  const rest = words.map(toUpperFirst);

  return [first, ...rest].join('');
};
