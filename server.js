const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const redis = require('redis');
const cors = require('cors');

// 创建Express应用
const app = express();
app.use(cors());
app.use(express.static('.'));

// 创建HTTP服务器
const server = http.createServer(app);

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 创建Redis客户端
const redisClient = redis.createClient({
    url: 'redis://localhost:6379'
});
let redisConnected = false;

// 连接到Redis
(async () => {
    try {
        await redisClient.connect();
        redisConnected = true;
        console.log('已连接到Redis');
    } catch (err) {
        console.error('Redis连接错误:', err);
    }
})();

// 处理Redis连接错误
redisClient.on('error', (err) => {
    console.error('Redis错误:', err);
});

// 处理WebSocket连接
wss.on('connection', (ws) => {
    console.log('客户端已连接');
    
    // 处理来自客户端的消息
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.o) {
                // 处理清算数据
                await processLiquidationData(data);
            }
        } catch (error) {
            console.error('处理客户端消息时出错:', error);
        }
    });
    
    // 处理连接关闭
    ws.on('close', () => {
        console.log('客户端连接已关闭');
    });
    
    // 处理错误
    ws.on('error', (error) => {
        console.error('WebSocket错误:', error);
    });
});

// 连接到币安WebSocket API - 仅用于服务器直接获取数据的情况
let binanceWs = null;

// 初始化币安WebSocket连接
function initBinanceWebSocket() {
    // 关闭现有连接
    if (binanceWs) {
        binanceWs.close();
    }
    
    // 连接到币安WebSocket API
    binanceWs = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');
    
    // 处理WebSocket连接
    binanceWs.on('open', () => {
        console.log('已连接到币安WebSocket API');
    });
    
    // 处理WebSocket消息
    binanceWs.on('message', async (data) => {
        try {
            const parsedData = JSON.parse(data.toString());
            if (parsedData.o) {
                // 处理清算数据
                await processLiquidationData(parsedData);
            }
        } catch (error) {
            console.error('处理WebSocket消息时出错:', error);
        }
    });
    
    // 处理WebSocket错误
    binanceWs.on('error', (error) => {
        console.error('币安WebSocket错误:', error);
    });
    
    // 处理WebSocket关闭
    binanceWs.on('close', () => {
        console.log('币安WebSocket连接已关闭，尝试重新连接...');
        setTimeout(initBinanceWebSocket, 5000);
    });
}

// 启动币安WebSocket连接
initBinanceWebSocket();

// 处理清算数据并存储到Redis
async function processLiquidationData(data) {
    if (!data.o || !redisConnected) return;

    const order = data.o;
    const symbol = order.s;
    // 计算清算价值 (保留这个计算用于统计)
    const value = parseFloat(order.p) * parseFloat(order.q);
    // 为原始订单对象添加value属性，方便后续统计
    order.value = value;

    // 获取当前时间戳（毫秒）
    const currentTime = Date.now();
    // 15分钟前的时间戳
    const fifteenMinutesAgo = currentTime - 15 * 60 * 1000;

    try {
        // 从Redis获取现有数据
        let liquidationData = { orders: [] };
        const existingData = await redisClient.get(`liquidation:${symbol}`);
        
        if (existingData) {
            liquidationData = JSON.parse(existingData);
        }

        // 直接添加原始订单对象到订单列表
        liquidationData.orders.push(order);

        // 过滤掉15分钟前的订单
        liquidationData.orders = liquidationData.orders.filter(order => order.T > fifteenMinutesAgo);

        // 将更新后的数据存储回Redis
        await redisClient.set(`liquidation:${symbol}`, JSON.stringify({
            orders: liquidationData.orders
        }));

        // 获取当前活跃交易对列表
        const activeSymbolsStr = await redisClient.get('active_symbols');
        const activeSymbols = activeSymbolsStr ? JSON.parse(activeSymbolsStr) : [];
        
        // 如果当前交易对不在列表中，添加它
        if (!activeSymbols.includes(symbol)) {
            activeSymbols.push(symbol);
            await redisClient.set('active_symbols', JSON.stringify(activeSymbols));
        }

    } catch (error) {
        console.error(`处理${symbol}的清算数据时出错:`, error);
    }
}

// 定期清理过期数据（每分钟运行一次）
setInterval(async () => {
    if (!redisConnected) return;
    
    try {
        // 获取当前时间戳（毫秒）
        const currentTime = Date.now();
        // 15分钟前的时间戳
        const fifteenMinutesAgo = currentTime - 15 * 60 * 1000;

        // 获取所有活跃交易对
        const activeSymbolsStr = await redisClient.get('active_symbols');
        const activeSymbols = activeSymbolsStr ? JSON.parse(activeSymbolsStr) : [];

        // 遍历所有活跃交易对，清理过期数据
        for (const symbol of activeSymbols) {
            const existingData = await redisClient.get(`liquidation:${symbol}`);
            if (existingData) {
                const liquidationData = JSON.parse(existingData);
                
                // 过滤掉15分钟前的订单，使用T字段作为时间戳
                liquidationData.orders = liquidationData.orders.filter(order => order.T > fifteenMinutesAgo);
                
                // 如果没有订单，则删除该交易对的数据
                if (liquidationData.orders.length === 0) {
                    await redisClient.del(`liquidation:${symbol}`);
                } else {
                    // 将更新后的数据存储回Redis，只保存订单数组
                    await redisClient.set(`liquidation:${symbol}`, JSON.stringify({
                        orders: liquidationData.orders
                    }));
                }
            }
        }
        
        // 更新活跃交易对列表
        const keys = await redisClient.keys('liquidation:*');
        const updatedSymbols = keys.map(key => key.replace('liquidation:', ''));
        await redisClient.set('active_symbols', JSON.stringify(updatedSymbols));
        
    } catch (error) {
        console.error('清理过期数据时出错:', error);
    }
}, 60000); // 每分钟运行一次

// API路由 - 获取所有活跃交易对
app.get('/api/symbols', async (req, res) => {
    if (!redisConnected) {
        return res.status(503).json({ error: 'Redis服务不可用' });
    }
    
    try {
        const activeSymbolsStr = await redisClient.get('active_symbols');
        const activeSymbols = activeSymbolsStr ? JSON.parse(activeSymbolsStr) : [];
        res.json(activeSymbols);
    } catch (error) {
        console.error('获取活跃交易对时出错:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// API路由 - 获取特定交易对的15分钟数据
app.get('/api/liquidation/:symbol', async (req, res) => {
    if (!redisConnected) {
        return res.status(503).json({ error: 'Redis服务不可用' });
    }
    
    try {
        const { symbol } = req.params;
        const data = await redisClient.get(`liquidation:${symbol}`);
        
        if (data) {
            const liquidationData = JSON.parse(data);
            // 计算统计数据
            const orders = liquidationData.orders || [];
            const longOrders = orders.filter(order => order.S === 'SELL');
            const shortOrders = orders.filter(order => order.S === 'BUY');
            const totalValue = orders.reduce((sum, order) => sum + order.value, 0);
            
            // 找出最大清算量
            const maxOrder = orders.reduce((max, order) => 
                order.value > max.value ? order : max, { value: 0 });
            
            // 找出最新订单
            const latestOrder = orders.reduce((latest, order) => 
                order.T > latest.T ? order : latest, { T: 0 });
            
            // 计算平均价格
            // 检查订单中是否包含ap字段作为平均价格
            // 如果不存在ap字段，则使用订单价格p的平均值
            const avgPrice = orders.length > 0 ? 
                orders.reduce((sum, order) => sum + (order.ap ? parseFloat(order.ap) : parseFloat(order.p)), 0) / orders.length : 0;
            
            // 计算振幅
            const latestP = latestOrder.T > 0 ? parseFloat(latestOrder.p) : 0;
            const amplitude = avgPrice > 0 ? ((latestP - avgPrice) / avgPrice) * 100 : 0;
            
            // 返回包含统计数据的响应
            res.json({
                orders,
                longCount: longOrders.length,
                shortCount: shortOrders.length,
                totalValue,
                lastPrice: latestP,
                avgPrice: avgPrice,
                amplitude: amplitude,
                maxValue: maxOrder.value > 0 ? maxOrder.value : 0,
                maxValueSide: maxOrder.value > 0 ? maxOrder.S : '',
                lastUpdateTime: latestOrder.T > 0 ? latestOrder.T : 0
            });
        } else {
            res.status(404).json({ error: '未找到数据' });
        }
    } catch (error) {
        console.error('获取清算数据时出错:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// API路由 - 获取所有交易对的15分钟数据
app.get('/api/liquidation', async (req, res) => {
    if (!redisConnected) {
        return res.status(503).json({ error: 'Redis服务不可用' });
    }
    
    try {
        const activeSymbolsStr = await redisClient.get('active_symbols');
        const activeSymbols = activeSymbolsStr ? JSON.parse(activeSymbolsStr) : [];
        const result = {};
        
        for (const symbol of activeSymbols) {
            const data = await redisClient.get(`liquidation:${symbol}`);
            if (data) {
                const liquidationData = JSON.parse(data);
                const orders = liquidationData.orders || [];
                
                // 计算统计数据
                const longOrders = orders.filter(order => order.S === 'SELL');
                const shortOrders = orders.filter(order => order.S === 'BUY');
                const totalValue = orders.reduce((sum, order) => sum + order.value, 0);
                
                // 找出最大清算量
                const maxOrder = orders.reduce((max, order) => 
                    order.value > max.value ? order : max, { value: 0 });
                
                // 找出最新订单
                const latestOrder = orders.reduce((latest, order) => 
                    order.T > latest.T ? order : latest, { T: 0 });
                
                // 计算平均价格
                // 检查订单中是否包含ap字段作为平均价格
                // 如果不存在ap字段，则使用订单价格p的平均值
                const avgPrice = orders.length > 0 ? 
                    orders.reduce((sum, order) => sum + (order.ap ? parseFloat(order.ap) : parseFloat(order.p)), 0) / orders.length : 0;
                
                // 计算振幅
                const latestP = latestOrder.T > 0 ? parseFloat(latestOrder.p) : 0;
                const amplitude = avgPrice > 0 ? ((latestP - avgPrice) / avgPrice) * 100 : 0;
                
                // 添加到结果中
                result[symbol] = {
                    orders,
                    longCount: longOrders.length,
                    shortCount: shortOrders.length,
                    totalValue,
                    lastPrice: latestP,
                    avgPrice: avgPrice,
                    amplitude: amplitude,
                    maxValue: maxOrder.value > 0 ? maxOrder.value : 0,
                    maxValueSide: maxOrder.value > 0 ? maxOrder.S : '',
                    lastUpdateTime: latestOrder.T > 0 ? latestOrder.T : 0
                };
            }
        }
        
        res.json(result);
    } catch (error) {
        console.error('获取所有清算数据时出错:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});