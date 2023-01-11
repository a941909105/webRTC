/*
 * @Author: mmmmmmmm
 * @Date: 2023-01-11 01:12:05
 * @Description: 文件描述
 */
const wsServer = require('websocket').server;
const http = require('http');
const https = require('https');
const port = 3000;
/**@name 令牌房间列表 */
const tokenList = [];
let increaseSessionId = 0;
function createSession(connection) {
  return increaseSessionId++;
}

/**@name 创建令牌 */
function createToken(name, session) {
  /** 检查令牌是否存在
   *  存在 -> 则判定令牌是否已存在应答者
   *        - 如果已存在且还在线中，则提示token已被使用请求更换，
   *        - 不存在则将当前用户设置为应答者并设置token在线
   *  不存在 -> 则将用户设置为提议者，并将token设置为等待应答者
   */
  const hasToken = tokenList.findIndex((t) => t.name === name);
  const newToken = {
    name,
    offer: session,
    answer: null,
    status: 'pending',
    createdAt: Number(new Date()),
  };
  if (hasToken === -1) {
    tokenList.push(newToken);
  } else {
    const currentToken = tokenList[hasToken];
    if (currentToken.status === 'pending') {
      currentToken.answer = session;
      currentToken.status = 'connecting';
      return {
        error: false,
        status: 'connecting',
        token: currentToken,
      };
    } else if (currentToken.status === 'complete') {
      tokenList[hasToken] = newToken;
    } else {
      return {
        error: true,
        message: '令牌已存在，请重新设置',
      };
    }
  }
  return {
    error: false,
    status: 'pending',
    token: newToken,
    message: '创建令牌成功',
  };
}
function createHttpServer() {
  var webServer = null;
  function handleWebRequest(request, response) {
    console.log('Received request for ' + request.url);
    response.writeHead(404);
    response.end();
  }
  try {
    if (httpsOptions.key && httpsOptions.cert) {
      webServer = https.createServer(httpsOptions, handleWebRequest);
    }
  } catch (err) {
    webServer = null;
  }

  if (!webServer) {
    try {
      webServer = http.createServer({}, handleWebRequest);
    } catch (err) {
      webServer = null;
      console.log(`Error attempting to create HTTP(s) server: ${err.toString()}`);
    }
  }
  webServer.listen(port, () => {
    console.log(`HTTP服务已开启端口${port}`);
  });
  webServer.addListener('error', (error) => {
    console.log('http', error);
  });
  return webServer;
}
const server = new wsServer({ httpServer: createHttpServer(), autoAcceptConnections: true });
if (!server) {
  console.log('ERROR: Unable to create WbeSocket server!');
}
const sessionMap = new Map();
// server.addListener('request', (rq) => {
//     console.log(rq);
//     rq.accept("json", rq.origin);
// });
server.addListener('connect', (connection) => {
  // 当前临时会话ID
  const currentSession = createSession();
  console.log(`有用户进入:${currentSession}`);
  sessionMap.set(currentSession, { token: null, connection });
  // 用户进入时需要填写Token
  sendMessage(connection, { type: 'inputToken' });
  connection.addListener('close', (code, desc) => {
    sessionMap.delete(currentSession);
    console.log(`用户离开，sessionId=${currentSession};code=${code};desc=${desc}`);
  });
  connection.addListener('message', (data) => {
    if (data.type === 'utf8') {
      const messageData = JSON.parse(data.utf8Data);
      switch (messageData.type) {
        // 进入房间或创建房间
        case 'enter':
          const result = createToken(messageData.name, currentSession);
          sessionMap.get(currentSession).token = messageData.name;
          if (result.status === 'connecting') {
            // 如果状态是等待中则表示提议者与应答者都准备就绪可以开始P2P连接
            // 1.先检查双方信道都正常 2.分配双方身份
            if (sessionMap.has(result.token.answer) && sessionMap.has(result.token.offer)) {
              sendMessage(sessionMap.get(result.token.offer).connection, {
                type: 'send-sdp',
                connectionType: 'offer',
              });
            } else {
              sendMessage(connection, { error: true, message: '连接人已不存在，请重试' });
            }
          } else {
            sendMessage(connection, result);
          }
          break;
        case 'sdp':
          (() => {
            const currentTokenName = sessionMap.get(currentSession).token;
            const currentTokenResult = tokenList.find((t) => t.name === currentTokenName);
            if (currentTokenResult) {
              if (currentTokenResult.offer === currentSession) {
                //表示当前的SDP是提议者的则将SDP发送给应答者
                sendMessage(sessionMap.get(currentTokenResult.answer).connection, {
                  type: 'remote-sdp',
                  sdp: messageData.sdp,
                  connectionType: 'anwser',
                });
              } else if (currentTokenResult.answer === currentSession) {
                //表示当前的SDP是应答者的则将SDP发送给提议者
                sendMessage(sessionMap.get(currentTokenResult.offer).connection, {
                  type: 'remote-sdp',
                  sdp: messageData.sdp,
                  connectionType: 'offer',
                });
              } else {
                sendMessage(connection, { error: true, message: '您不属于当前房间' });
              }
            } else {
              sendMessage(connection, { error: true, message: '令牌房间已消失请重新创建令牌' });
            }
          })();
          break;
        case 'candidate':
          (() => {
            const currentTokenName = sessionMap.get(currentSession).token;
            const currentTokenResult = tokenList.find((t) => t.name === currentTokenName);
            if (currentTokenResult) {
              if (currentTokenResult.offer === currentSession) {
                //表示当前的备用SDP是提议者的则将备用SDP发送给应答者
                sendMessage(sessionMap.get(currentTokenResult.answer).connection, {
                  type: 'candidate',
                  candidate: messageData.candidate,
                });
              } else if (currentTokenResult.answer === currentSession) {
                //表示当前的备用SDP是应答者的则将备用SDP发送给提议者
                sendMessage(sessionMap.get(currentTokenResult.offer).connection, {
                  type: 'candidate',
                  candidate: messageData.candidate,
                });
              } else {
                sendMessage(connection, { error: true, message: '您不属于当前房间' });
              }
            } else {
              sendMessage(connection, { error: true, message: '令牌房间已消失请重新创建令牌' });
            }
          })();
          break;
        default:
          break;
      }
    }
  });
});

function sendMessage(connection, data) {
  connection.sendUTF(JSON.stringify(data));
}
