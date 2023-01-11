const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = function (env) {
    return {
        mode: env.production ? 'production' : 'development',
        devtool: env.production ? undefined : 'cheap-module-source-map',
        entry: {
            background: [path.resolve(__dirname, 'js/background')],
            devtools: path.resolve(__dirname, 'js/devtools'),
            content: [path.resolve(__dirname, 'js/content')],
        },
        output: {
            filename: '[name].bundle.js',
            path: path.resolve(__dirname, 'dist/js'),
            clean: true,
        },
        module: {
            rules: [
                {
                    test: /\.(js|ts)x?$/,
                    use: ['babel-loader'],
                    exclude: /node_modules/,
                },
                // {
                //     test: /\.(scss|css)$/,
                //     use: [MiniCssExtractPlugin.loader, 'css-loader'],
                // },
            ],
        },
        resolve: {
            extensions: ['.js'],
        },
        plugins: [
            // new MiniCssExtractPlugin({
            //     filename: 'css/[name].css',
            // }),
            new CopyPlugin({
                patterns: [
                    {
                        from: path.join(__dirname, 'manifest.json'),
                        to: path.join(__dirname, 'dist/manifest.json'),
                    },
                    {
                        from: path.join(__dirname, 'assets'),
                        to: path.join(__dirname, 'dist/assets'),
                    },
                    {
                        from: path.join(__dirname, 'css'),
                        to: path.join(__dirname, 'dist/css'),
                    },
                    {
                        from: path.join(__dirname, 'html'),
                        to: path.join(__dirname, 'dist/html'),
                    },
                ],
            }),
        ],
    };
};
