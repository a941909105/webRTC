/*
 * @Author: mmmmmmmm
 * @Date: 2023-01-11 03:35:50
 * @Description: 通过WebSocket信道来交互信令
 */
const ws = new WebSocket('ws://127.0.0.1:3000');
// const ws = new WebSocket('wss://camera.mcode.top/p2p');

/**@type {RTCPeerConnection} */
let peer;
/**@type {MediaStream} */
let localStream;
ws.onopen = async (e) => {
  console.log('ws已连接');
};
const peerConfig = {
    iceServers: [     // Information about ICE servers - Use your own!
    {
      urls: "turn:webrtc-from-chat.glitch.me",  // A TURN server
      username: "webrtc",
      credential: "turnserver"
    }
  ]
}
ws.onmessage = async function (e) {
  const messageData = JSON.parse(e.data);
  if (messageData.error) {
    // 如果有错误则显示错误内容
    return alert(messageData.message);
  }
  switch (messageData.type) {
    case 'inputToken':
      const token = window.prompt('请输入您想要创建或进入令牌');
      sendServerData({ name: token, type: 'enter' });
      break;
    case 'send-sdp':
      if (messageData.connectionType === 'offer') {
        await createOffer();
      }
    case 'remote-sdp':
      if (!messageData.sdp) {
        return;
      }
      if (messageData.connectionType === 'offer') {
        await setAnswerSdp(messageData.sdp);
      } else if (messageData.connectionType === 'anwser') {
        sendServerData({
          type: 'sdp',
          sdp: await createAnswer(messageData.sdp),
        });
      }
    case 'candidate':
      try {
        await peer.addIceCandidate(messageData.candidate);
      } catch (error) {
        console.error('candidate', error);
      }
      break;
    default:
      break;
  }
};
async function createOffer() {
  peer = new RTCPeerConnection();
  await initPeer();

  console.log('我是offer');
  //   const sdp = await peer.createOffer();
  //   await peer.setLocalDescription(sdp);
  //   return sdp;
}
async function initPeer() {
  console.log(peer);
  peer.oniceconnectionstatechange = handleICEConnectionStateChangeEvent;
  peer.onicegatheringstatechange = handleICEGatheringStateChangeEvent;
  peer.onsignalingstatechange = handleSignalingStateChangeEvent;
  peer.onnegotiationneeded = handleNegotiationNeededEvent;
  peer.addEventListener('track', (ev) => {
    console.log('====================================');
    console.log(ev.streams);
    console.log('====================================');
    document.getElementById('remote').srcObject = ev.streams[0];
  });

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
  document.getElementById('local').srcObject = localStream;
}
async function setAnswerSdp(answerSdp) {
  console.log('====================================');
  console.log(answerSdp);
  console.log('====================================');
    await peer.setRemoteDescription(new RTCSessionDescription(answerSdp));
    peer.addEventListener('icecandidate', (ev) => {
        console.log('====================================');
        console.log(ev.candidate, 'ev.candidate');
        console.log('====================================');
        if (ev.candidate) {
          sendServerData({ type: 'candidate', candidate: ev.candidate });
        }
      });
}
async function createAnswer(offerSdp) {
  peer = new RTCPeerConnection();
  console.log('我是answer');
  await initPeer();

  peer.setRemoteDescription(new RTCSessionDescription(offerSdp));
  const sdp = await peer.createAnswer();
  await peer.setLocalDescription(sdp);
  peer.addEventListener('icecandidate', (ev) => {
    console.log('====================================');
    console.log(ev.candidate, 'ev.candidate');
    console.log('====================================');
    if (ev.candidate) {
      sendServerData({ type: 'candidate', candidate: ev.candidate });
    }
  });
  return sdp;
}
/**@name 给信道发送消息 */
function sendServerData(data) {
  return ws.send(JSON.stringify(data));
}
function handleICEConnectionStateChangeEvent(event) {
  log('*** ICE connection state changed to ' + peer.iceConnectionState);

  switch (peer.iceConnectionState) {
    case 'closed':
    case 'failed':
    case 'disconnected':
      closeVideoCall();
      break;
  }
}

// Set up a |signalingstatechange| event handler. This will detect when
// the signaling connection is closed.
//
// NOTE: This will actually move to the new RTCPeerConnectionState enum
// returned in the property RTCPeerConnection.connectionState when
// browsers catch up with the latest version of the specification!

function handleSignalingStateChangeEvent(event) {
  log('*** WebRTC signaling state changed to: ' + peer.signalingState);
  switch (peer.signalingState) {
    case 'closed':
      closeVideoCall();
      break;
  }
}

// Handle the |icegatheringstatechange| event. This lets us know what the
// ICE engine is currently working on: "new" means no networking has happened
// yet, "gathering" means the ICE engine is currently gathering candidates,
// and "complete" means gathering is complete. Note that the engine can
// alternate between "gathering" and "complete" repeatedly as needs and
// circumstances change.
//
// We don't need to do anything when this happens, but we log it to the
// console so you can see what's going on when playing with the sample.

function handleICEGatheringStateChangeEvent(event) {
  log('*** ICE gathering state changed to: ' + peer.iceGatheringState);
}
async function handleNegotiationNeededEvent() {
  log('*** Negotiation needed');

  try {
    log('---> Creating offer');

    const sdp = await peer.createOffer();
    // If the connection hasn't yet achieved the "stable" state,
    // return to the caller. Another negotiationneeded event
    // will be fired when the state stabilizes.

    if (peer.signalingState != 'stable') {
      log("     -- The connection isn't stable yet; postponing...");
      return;
    }

    // Establish the offer as the local peer's current
    // description.

    log('---> Setting local description to the offer');
    await peer.setLocalDescription(sdp);

    // Send the offer to the remote peer.

    log('---> Sending the offer to the remote peer');
    sendServerData({
      type: 'sdp',
      sdp: sdp,
    });
  } catch (err) {
    log('*** The following error occurred while handling the negotiationneeded event:');
    console.error(err);
  }
}
function log(text) {
  var time = new Date();

  console.log('[' + time.toLocaleTimeString() + '] ' + text);
}
