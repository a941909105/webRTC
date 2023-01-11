// JavaScript variables holding stream and connection information
var localStream, remotePeerConnection;
var localPeerConnection = new RTCPeerConnection(null);

// JavaScript variables associated with HTML5 video elements in the page
var localVideo = document.getElementById("localVideo");
var remoteVideo = document.getElementById("remoteVideo");
var currentOffer = document.getElementById("currentOffer");

// JavaScript variables assciated with call management buttons in the page
var startButton = document.getElementById("startButton");
var callButton = document.getElementById("callButton");
var hangupButton = document.getElementById("hangupButton");
var pushButton = document.getElementById("push");
var pushText = document.getElementById("pushText");

// Just allow the user to click on the Call button at start-up
startButton.disabled = false;
callButton.disabled = true;
hangupButton.disabled = true;

// Associate JavaScript handlers with click events on the buttons
startButton.onclick = start;
callButton.onclick = call;
hangupButton.onclick = hangup;
pushButton.onclick=push
// Utility function for logging information to the JavaScript console
function log(text) {
	// console.log("At time: " + (performance.now() / 1000).toFixed(3) + " --> " + text);
}
function copyOffer(text) { 
    // 创建输入框
var textarea = document.createElement('textarea');
document.body.appendChild(textarea);
// 隐藏此输入框
textarea.style.position = 'absolute';
// 赋值
    textarea.value = text;
// 选中
textarea.select();
// 复制
document.execCommand('copy', true);

}
// Callback in case of success of the getUserMedia() call
function successCallback(stream) {
	console.log("Received local stream",stream);

	// Associate the local video element with the retrieved stream
	if (window.URL) {
		localVideo.srcObject = stream;
	} else {
		localVideo.src = stream;
	}

	localStream = stream;
    localStream.getTracks().forEach(track => {
        localPeerConnection.addTrack(track, localStream);
    });
    
	// We can now enable the Call button
	callButton.disabled = false;
}


// Function associated with clicking on the Start button
// This is the event triggering all other actions
function start() {
	log("Requesting local stream");

	// First of all, disable the Start button on the page
	startButton.disabled = true;

	// Get ready to deal with different browser vendors...
	navigator.getUserMedia = navigator.getUserMedia ||
		navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

	// Now, call getUserMedia()
	navigator.getUserMedia({audio:true, video:true}, successCallback, function(error) {
		log("navigator.getUserMedia error: ", error);
	});
}

// Function associated with clicking on the Call button
// This is enabled upon successful completion of the Start button handler
function call() {
	// First of all, disable the Call button on the page...
	callButton.disabled = true;

	// ...and enable the Hangup button
	hangupButton.disabled = false;
	log("Starting call");

	// Note that getVideoTracks() and getAudioTracks() are not currently
	// supported in Firefox...
	// ...just use them with Chrome
	if (navigator.webkitGetUserMedia) {
		// Log info about video and audio device in use
		if (localStream.getVideoTracks().length > 0) {
			log('Using video device: ' + localStream.getVideoTracks()[0].label);
		} if (localStream.getAudioTracks().length > 0) {
			log('Using audio device: ' + localStream.getAudioTracks()[0].label);
		}
	}

	// Chrome
	if (navigator.webkitGetUserMedia) {
		RTCPeerConnection = webkitRTCPeerConnection;

		// Firefox
	} else if(navigator.mozGetUserMedia) {
		RTCPeerConnection = mozRTCPeerConnection;
		RTCSessionDescription = mozRTCSessionDescription;
		RTCIceCandidate = mozRTCIceCandidate;
	}  log("RTCPeerConnection object: " + RTCPeerConnection);

	// This is an optional configuration string, associated with
	// NAT traversal setup

	// Add a handler associated with ICE protocol events
    
    
    
	// Add the local stream (as returned by getUserMedia())
	// to the local PeerConnection.
	// localPeerConnection.addStream(localStream);
    log("Added localStream to localPeerConnection");
    localPeerConnection.createOffer().then(async res => {
       await localPeerConnection.setLocalDescription(res);
        // currentOffer.innerText = JSON.stringify(res)
        copyOffer(JSON.stringify(res))
        console.log(localPeerConnection);
    })

	// We're all set! Create an Offer to be 'sent' to the callee as soon
	// as the local SDP is ready.
}
async function push() { 

    await localPeerConnection.setRemoteDescription(JSON.parse(pushText.value))
    localPeerConnection.ontrack = (event) => {
        if (window.URL) {
            const [remoteStream] = event.streams;

            // Chrome;
            remoteVideo.srcObject = remoteStream;
        } else {
            // Firefox;
            remoteVideo.src = event.stream;
        }  
    }
	localPeerConnection.onicecandidate = gotLocalIceCandidate;

}
function onSignalingError(error) {
	console.log('Failed to create signaling message : ' + error.name);
}

// Handler to be called when hanging up the call
function hangup() {
	log("Ending call");

	// Close PeerConnection(s)
	localPeerConnection.close();
	remotePeerConnection.close();

	// Reset local variables
	localPeerConnection = null;
	remotePeerConnection = null;

	// Disable Hangup button
	hangupButton.disabled = true;

	// Enable Call button to allow for new calls to be established
	callButton.disabled = false;
}

// Handler to be called as soon as the remote stream becomes available
function gotRemoteStream(event){
	// Associate the remote video element with the retrieved stream
	if (window.URL) {
		// Chrome;
		remoteVideo.srcObject = event.stream;
	} else {
		// Firefox;
		remoteVideo.src = event.stream;
	}  log("Received remote stream");
}

// Handler to be called whenever a new local ICE candidate becomes available
function gotLocalIceCandidate(event){
	if (event.candidate) {
		// Add candidate to the remote PeerConnection;
        // localPeerConnection.addIceCandidate()
        localPeerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
        console.log('====================================');
        console.log(event.candidate,new RTCIceCandidate(event.candidate));
        console.log('====================================');
        log("Local ICE candidate: \n" + event.candidate.candidate);
	}
}
