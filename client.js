// 客户端脚本，用于将WebSocket数据发送到服务器进行Redis存储

// 检查是否已经存在WebSocket连接
let wsClient = null;

// 初始化与服务器的WebSocket连接
function initServerConnection() {
    // 关闭现有连接
    if (wsClient) {
        wsClient.close();
    }

    // 连接到本地服务器
    wsClient = new WebSocket('ws://localhost:3000/ws');

    // 连接打开时的处理
    wsClient.onopen = function() {
        console.log('已连接到本地服务器');
    };

    // 连接关闭时的处理
    wsClient.onclose = function() {
        console.log('与本地服务器的连接已关闭，尝试重新连接...');
        // 尝试重新连接
        setTimeout(initServerConnection, 5000);
    };

    // 连接错误时的处理
    wsClient.onerror = function(error) {
        console.error('与本地服务器的WebSocket连接错误:', error);
    };
}

// 将清算数据发送到服务器
function sendLiquidationDataToServer(data) {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        wsClient.send(JSON.stringify(data));
    }
}

// 导出函数
window.initServerConnection = initServerConnection;
window.sendLiquidationDataToServer = sendLiquidationDataToServer;