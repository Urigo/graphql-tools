const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const TypeDoc = require('typedoc');
const { execSync } = require('child_process');
const fsPromises = require('fs/promises');
const workspacePackageJson = require('../package.json');

const MONOREPO = workspacePackageJson.name.replace('-monorepo', '');

async function buildApiDocs() {
  // Where to generate the API docs
  const outputDir = path.join(__dirname, '../website/docs/api');
  const sidebarsPath = path.join(__dirname, '../website/api-sidebar.json');

  // Get the upstream git remote -- we don't want to assume it exists or is named "upstream"
  const gitRemote = execSync('git remote -v', { encoding: 'utf-8' })
    .split('\n')
    .map(line => line.split('\t'))
    .find(([_name, description]) => description.includes('(fetch)'));
  const gitRemoteName = gitRemote && gitRemote[0];
  if (!gitRemoteName) {
    console.log('Unable to locate upstream git remote');
    process.exit(1);
  }

  // An array of tuples where the first element is the package's name and the
  // the second element is the relative path to the package's entry point
  const packageJsonFiles = require('globby').sync(
    workspacePackageJson.workspaces.packages.map(f => `${f}/package.json`)
  );
  const modules = [];
  for (const packageJsonPath of packageJsonFiles) {
    const packageJsonContent = require(path.join(__dirname, '..', packageJsonPath));
    // Do not include private and large npm package that contains rest
    if (
      !packageJsonPath.includes('./website/') &&
      !packageJsonContent.private &&
      packageJsonContent.name !== MONOREPO &&
      !packageJsonContent.name.endsWith('/container')
    ) {
      modules.push([
        packageJsonContent.name,
        packageJsonPath.replace('./', '').replace('package.json', 'src/index.ts'),
      ]);
    }
  }

  // Delete existing docs
  rimraf.sync(outputDir);

  // Initialize TypeDoc
  const typeDoc = new TypeDoc.Application();

  typeDoc.options.addReader(new TypeDoc.TSConfigReader());

  typeDoc.bootstrap({
    // mode: 'library',
    theme: path.resolve(__dirname, 'typedoc-theme'),
    // ignoreCompilerErrors: true,
    excludePrivate: true,
    excludeProtected: true,
    // stripInternal: true,
    readme: 'none',
    hideGenerator: true,
    hideBreadcrumbs: true,
    // skipSidebar: true,
    gitRemote: gitRemoteName,
    gitRevision: 'master',
    tsconfig: path.resolve(__dirname, '../tsconfig.build.json'),
    entryPoints: modules.map(([_name, filePath]) => filePath),
  });

  // Generate the API docs
  const project = typeDoc.convert(typeDoc.expandInputFiles(modules.map(([_name, filePath]) => filePath)));
  await typeDoc.generateDocs(project, outputDir);

  async function patchMarkdownFile(filePath) {
    const contents = await fsPromises.readFile(filePath, 'utf-8');
    const contentsTrimmed = contents
      // Escape angle brackets
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Fix title
      .replace(/^# .+/g, function (match) {
        return `---
title: '${match.replace('# ', '')}'
---
${match}`;
      })
      // Fix links
      .replace(/\[([^\]]+)\]\(([^)]+).md\)/g, '[$1]($2)')
      .replace(/\[([^\]]+)\]\((\.\.\/(classes|interfaces|enums)\/([^\)]+))\)/g, '[$1](/docs/api/$3/$4)');
    await fsPromises.writeFile(filePath, contentsTrimmed);
  }

  async function visitMarkdownFile(filePath) {
    if (!fs.existsSync(filePath)) {
      console.warn(`${filePath} doesn't exist! Ignoring.`);
      return;
    }
    const lsStat = await fsPromises.lstat(filePath);
    if (lsStat.isFile()) {
      await patchMarkdownFile(filePath);
    } else {
      const filesInDirectory = await fsPromises.readdir(filePath);
      await Promise.all(filesInDirectory.map(fileName => visitMarkdownFile(path.join(filePath, fileName))));
    }
  }

  // Patch the generated markdown
  // See https://github.com/tgreyuk/typedoc-plugin-markdown/pull/128
  await Promise.all(
    ['classes', 'enums', 'interfaces', 'modules'].map(async dirName => {
      const subDirName = path.join(outputDir, dirName);
      await visitMarkdownFile(subDirName);
    })
  );

  // Remove the generated "index.md" file
  // fs.unlinkSync(path.join(outputDir, 'index.md'));

  // Update each module 's frontmatter and title
  await Promise.all(
    modules.map(async ([name, originalFilePath]) => {
      const filePath = path.join(outputDir, 'modules', convertEntryFilePath(originalFilePath));
      const ifExists = await fsPromises
        .stat(filePath)
        .then(() => true)
        .catch(() => false);
      if (!ifExists) {
        console.warn(`Module ${name} not found!`);
        return;
      }
      const id = convertNameToId(name);
      const oldContent = fs.readFileSync(filePath, 'utf-8');
      const necessaryPart = oldContent.split('\n').slice(5).join('\n');
      const finalContent =
        `
---
id: "${id}"
title: "${name}"
sidebar_label: "${id}"
---
`.substring(1) + necessaryPart;
      await fsPromises.writeFile(filePath, finalContent);
    })
  );

  fs.writeFileSync(
    sidebarsPath,
    JSON.stringify(
      {
        $name: 'API Reference',
        _: {
          modules: {
            $name: 'Modules',
            $routes: getSidebarItemsByDirectory(path.join(outputDir, 'modules')),
          },
          classes: {
            $name: 'Classes',
            $routes: getSidebarItemsByDirectory(path.join(outputDir, 'classes')),
          },
          interfaces: {
            $name: 'Interfaces',
            $routes: getSidebarItemsByDirectory(path.join(outputDir, 'interfaces')),
          },
          enums: {
            $name: 'Enums',
            $routes: getSidebarItemsByDirectory(path.join(outputDir, 'enums')),
          },
        },
      },
      null,
      2
    )
  );

  function convertEntryFilePath(filePath) {
    const { dir, name } = path.parse(filePath);
    return `_${dir.split('/').join('_').replace(/-/g, '_')}_${name}_.md`
      .replace('_index_', '')
      .replace('_packages_', '');
  }

  function convertNameToId(name) {
    return name.replace(`@${MONOREPO}/`, '');
  }

  function getSidebarItemsByDirectory(dirName) {
    if (!fs.existsSync(dirName)) {
      console.warn(`${dirName} doesn't exist! Ignoring.`);
      return [];
    }
    const filesInDirectory = fs.readdirSync(dirName);
    return filesInDirectory
      .map(fileName => {
        const absoluteFilePath = path.join(dirName, fileName);
        const fileLstat = fs.lstatSync(absoluteFilePath);
        if (fileLstat.isFile()) {
          return path.parse(fileName).name;
        } else {
          return getSidebarItemsByDirectory(absoluteFilePath);
        }
      })
      .flat()
      .sort((a, b) => {
        const aName = a.split('.').pop();
        const bName = b.split('.').pop();
        if (aName < bName) {
          return -1;
        } else if (aName > bName) {
          return 1;
        }
        return 0;
      });
  }
}

buildApiDocs().catch(e => {
  console.error(e);
  process.exit(1);
});
