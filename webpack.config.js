const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: {
    app: './src/app.ts',
    vendorApis: './src/vendorApis.ts',
    sessionService: './src/sessionService.ts',
    standardizationService: './src/standardizationService.ts'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist/frontend'),
    clean: true,
    library: {
      type: 'module'
    }
  },
  experiments: {
    outputModule: true
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.frontend.json'
          }
        },
        exclude: /node_modules/
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            allowTsInNodeModules: true,
            configFile: 'tsconfig.frontend.json'
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
      filename: 'index.html',
      inject: false // We'll manually inject scripts to maintain ES modules
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'style.css', to: 'style.css' },
        { from: 'lib', to: 'lib' }
      ]
    })
  ],
  devtool: 'source-map',
  target: 'web'
};
