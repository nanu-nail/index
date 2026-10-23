const repositoryName = 'index'

module.exports = {
  publicPath: process.env.NODE_ENV === 'production' ? `/${repositoryName}/` : '/',
  outputDir: 'dist',
  productionSourceMap: false
}
