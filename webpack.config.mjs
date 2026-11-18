/**
 * webpack.config.js
 * 
 * Cấu hình Webpack cho dự án NotDore.
 * Mục tiêu: Bundle tất cả các module JavaScript (API, Utility, Logic) thành các file JS
 * tối ưu, đồng thời xử lý các thư viện bên ngoài (Bootstrap, etc.).
 * 
 * Lưu ý: Cấu hình này giả định rằng các thư viện JS của bạn đều cần được xử lý
 * qua Babel để tương thích đa trình duyệt.
 */
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    mode: 'production', // Dùng 'development' khi debug
    entry: {
        // Điểm vào chính cho các trang công cụ.
        'tools/tinh-phan-bo-bhxh': './assets/js/tools/tinh-phan-bo-bhxh.js',
        // Thêm các điểm vào khác tại đây:
        // 'main-page': './assets/js/main.js', 
    },
    output: {
        // Tên file bundle sẽ được tạo ra
        filename: '[name].[contenthash].js',
        // Nơi lưu trữ các file bundle
        path: path.resolve(__dirname, 'dist/js'), 
        // Đảm bảo đường dẫn là tuyệt đối
        publicPath: '/', 
        clean: true, // Xóa thư mục output mỗi lần build
    },
    module: {
        rules: [
            // 1. Xử lý JavaScript Module (Babel)
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                ['@babel/preset-env', {
                                    useBuiltIns: 'usage', // Chỉ polyfill những gì cần thiết
                                    corejs: { version: 3, maskable: true }
                                }],
                            ],
                        }
                    }
                ]
            },
            // 2. Xử lý CSS (CSS Modules & PostCSS)
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader, // Trích xuất CSS thành file riêng
                    'css-loader', 
                    'postcss-loader',
                ],
            },
            // 3. Xử lý Assets (Images, Fonts)
            {
                test: /\.(png|svg|jpg|jpeg|gif|woff|woff2|eot|ttf|otf)$/i,
                type: 'asset/resource', // Webpack 5 asset modules
                generator: {
                    filename: 'assets/[name][ext][hash:sha1]',
                }
            }
        ]
    },
    plugins: [
        // Plugin này sẽ tạo ra các file HTML và nhúng các script/style đã được bundle.
        new HtmlWebpackPlugin({
            template: './tools/tinh-phan-bo-bhxh.html', // Sử dụng file HTML hiện tại làm template
            filename: 'index.html',
            chunks: ['tools/tinh-phan-bo-bhxh'], // Nhúng bundle cho tool này
            inject: 'body'
        }),
        new MiniCssExtractPlugin({
            filename: '[name].[contenthash].css',
            content: ['assets/css/tools.css'], // Chỉ cần trích xuất CSS của công cụ
        }),
    ],
    // Thiết lập độ phân giải đường dẫn
    resolve: {
        modules: [
            path.resolve(__dirname, 'node_modules'),
            path.resolve(__dirname, 'assets/js') // Cho phép import từ thư mục assets/js/
        ],
        extensions: ['.js', '.json', '.css', '.html']
    },
    // Thiết lập cấu trúc alias (giúp import ngắn gọn hơn)
    resolveJsonModule: true,
};