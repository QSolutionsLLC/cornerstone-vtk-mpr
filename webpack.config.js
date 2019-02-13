const path = require('path')

// https://kitware.github.io/vtk-js/docs/intro_vtk_as_es6_dependency.html#Webpack-config
const vtkRules = require('vtk.js/Utilities/config/dependency.js').webpack.core
  .rules
// Optional if you want to load *.css and *.module.css files
const cssRules = require('vtk.js/Utilities/config/dependency.js').webpack.css
  .rules

const entry = path.join(__dirname, './src/index.js')
const sourcePath = path.join(__dirname, './src')
const outputPath = path.resolve(__dirname, 'public')

module.exports = {
  entry,
  mode: 'development',
  output: {
    path: outputPath
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      { test: /\.html$/, loader: 'html-loader' },
      { test: /\.(png|jpg)$/, use: 'url-loader?limit=81920' },
      { test: /\.svg$/, use: [{ loader: 'raw-loader' }] },
      {
        test: /\.css$/,
        use: [
          { loader: 'style-loader' },
          {
            loader: 'css-loader',
            options: {
              modules: true
            }
          }
        ]
      }
    ].concat(vtkRules)
  },
  resolve: {
    modules: [path.resolve(__dirname, 'node_modules'), sourcePath]
  },
  devServer: {
    contentBase: path.join(__dirname, 'public'),
    compress: false,
    port: 9000
  }
}
