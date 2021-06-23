const { writeFileSync } = require('fs');
const { resolve } = require('path');
const { argv, cwd } = require('process');

const typeDocsVersion = require('typedoc/package.json');
const pkgPath = resolve(cwd(), './package.json');

const pkg = require(pkgPath);

const version = argv[2];

pkg.resolutions = pkg.resolutions || {};

pkg.resolutions.typescript = typeDocsVersion.peerDependencies.typescript;

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
