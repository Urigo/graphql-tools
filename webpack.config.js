const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
  entry: 'src/index.ts',
  target: 'node',
  mode: 'development',
  optimization: {
    // We no not want to minimize our code.
    minimizer: [
      new UglifyJsPlugin({
        uglifyOptions: {
          warnings: true,
          mangle: false,
          nameCache: null
        }
      })
    ]
  },
  performance: {
    // Turn off size warnings for entry points
    hints: false
  },
  externals: [nodeExternals()],
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.mjs', '.json', '.js'],
    plugins: [new TsconfigPathsPlugin()]
  },
  output: {
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, 'main'),
    filename: '[name].js',
    sourceMapFilename: '[file].map'
  }
};
