# 币安强平订单监控系统

一个实时监控币安期货市场强平订单的Web应用程序，提供实时数据展示和15分钟统计分析功能。

## 功能特性

### 🔥 实时监控
- 实时接收币安期货强平订单数据
- 支持按交易对过滤显示
- 显示强平方向（多头/空头）、价格、数量和价值
- 自动计算强平订单的总价值
- 支持开启/关闭独立行情窗口

### 📊 15分钟统计
- 统计15分钟内各交易对的强平数据
- 显示多头/空头强平次数对比
- 计算总价值、最大单笔价值
- 显示平均价格、最新价格和振幅
- 按总价值排序展示

### 💾 数据存储
- 使用Redis存储历史数据
- 自动清理过期数据
- 支持数据持久化

## 技术栈

- **后端**: Node.js + Express
- **WebSocket**: 实时数据传输
- **数据库**: Redis
- **前端**: HTML5 + CSS3 + JavaScript
- **API**: 币安WebSocket API

## 系统要求

- Node.js 14.0 或更高版本
- Redis 服务器
- 现代Web浏览器（支持WebSocket）

## 安装和运行

### 1. 克隆项目
```bash
git clone <repository-url>
cd binance01
```

### 2. 安装依赖
```bash
npm install
```

### 3. 启动Redis服务
确保Redis服务器在localhost:6379端口运行

### 4. 启动应用
```bash
node server.js
```

### 5. 访问应用
- 实时监控页面: http://localhost:3000
- 15分钟统计页面: http://localhost:3000/15min.html

## 项目结构

```
binance01/
├── server.js              # 主服务器文件
├── client.js              # 客户端WebSocket连接
├── index.html             # 实时监控页面
├── 15min.html             # 15分钟统计页面
├── package.json           # 项目配置和依赖
├── package-lock.json      # 依赖锁定文件
└── README.md              # 项目说明文档
```

## 依赖包说明

- **express**: Web服务器框架
- **socket.io**: WebSocket通信库
- **redis**: Redis数据库客户端
- **cors**: 跨域资源共享中间件
- **ws**: WebSocket库

## 使用说明

### 实时监控页面
1. 访问主页面查看实时强平订单
2. 使用交易对过滤器筛选特定币种
3. 点击"开启行情"按钮打开独立行情窗口
4. 观察强平订单的实时变化

### 15分钟统计页面
1. 访问统计页面查看15分钟内的汇总数据
2. 数据按总价值降序排列
3. 可以筛选特定交易对的统计信息
4. 查看多空对比和价格变化情况

## API接口

### WebSocket连接
- **连接地址**: `ws://localhost:3000/ws`
- **数据格式**: JSON
- **功能**: 接收实时强平订单数据

### HTTP接口
- **GET /**: 返回实时监控页面
- **GET /15min.html**: 返回15分钟统计页面
- **GET /api/liquidation**: 获取15分钟统计数据
- **GET /api/symbols**: 获取活跃交易对列表

## 数据格式

### 强平订单数据结构
```json
{
  "o": {
    "s": "BTCUSDT",        // 交易对
    "S": "SELL",          // 强平方向
    "q": "0.001",         // 数量
    "p": "50000.00",      // 价格
    "ap": "49999.50",     // 平均价格
    "T": 1640995200000    // 时间戳
  }
}
```

## 注意事项

1. **网络连接**: 确保网络连接稳定，以接收实时数据
2. **Redis配置**: 确保Redis服务正常运行
3. **浏览器兼容性**: 建议使用Chrome、Firefox等现代浏览器
4. **数据延迟**: 数据可能存在1-2秒的延迟
5. **资源占用**: 长时间运行可能占用较多内存，建议定期重启

## 故障排除

### 常见问题

1. **无法连接到Redis**
   - 检查Redis服务是否启动
   - 确认Redis端口配置正确

2. **WebSocket连接失败**
   - 检查防火墙设置
   - 确认端口3000未被占用

3. **数据不更新**
   - 检查网络连接
   - 重启服务器

## 开发计划

- [ ] 添加更多统计维度
- [ ] 支持自定义时间范围
- [ ] 添加数据导出功能
- [ ] 优化界面响应式设计
- [ ] 添加告警功能

## 许可证

ISC License
## 联系方式

如有问题或建议，请通过以下方式联系：

- 📧 Email: [coffee.liu@gmail.com]
- 🐛 Issues: [项目Issues页面]
- 📖 文档: 查看项目中的指导书
## 贡献

欢迎提交Issue和Pull Request来改进这个项目。

---

**免责声明**: 本项目仅用于学习和研究目的，不构成投资建议。使用本系统进行交易决策的风险由用户自行承担。
