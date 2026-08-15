"use strict";

/*
=========================================================
                 MEETSPACE MEETING CLIENT
=========================================================

Features:
- Camera
- Microphone
- Multiple participants
- WebRTC video/audio
- Screen sharing
- Socket.IO signaling
- Participant count
- Chat
- Leave meeting
- Reconnection support
- Remote video/audio
- Camera ON/OFF
- Microphone ON/OFF

IMPORTANT:
Socket.IO client is expected at:

/static/js/socket.io.min.js

Do NOT depend on the external CDN.
=========================================================
*/


/* =========================================================
   1. MEETING INFORMATION
========================================================= */

const meetingApp =
    document.getElementById("meetingApp");

if (!meetingApp) {

    console.error(
        "MeetSpace: #meetingApp not found."
    );

}

const meetingId =
    meetingApp?.dataset?.meetingId || "";

const userName =
    meetingApp?.dataset?.userName ||
    "Participant";


console.log("========================================");
console.log("        MEETSPACE MEETING CLIENT");
console.log("========================================");
console.log("Meeting ID:", meetingId);
console.log("User:", userName);
console.log("========================================");


/* =========================================================
   2. HTML ELEMENTS
========================================================= */

const localVideo =
    document.getElementById("localVideo");

const localPlaceholder =
    document.getElementById("localPlaceholder");

const remoteVideos =
    document.getElementById("remoteVideos");

const emptyState =
    document.getElementById("emptyState");


/* =========================================================
   BUTTONS
========================================================= */

const micBtn =
    document.getElementById("micBtn");

const cameraBtn =
    document.getElementById("cameraBtn");

const screenShareBtn =
    document.getElementById("screenShareBtn");

const leaveMeetingBtn =
    document.getElementById("leaveMeetingBtn");

const leaveMeetingBtn2 =
    document.getElementById("leaveMeetingBtn2");


/* =========================================================
   CONNECTION STATUS
========================================================= */

const connectionStatus =
    document.getElementById("connectionStatus");

const connectionText =
    document.getElementById("connectionText");


/* =========================================================
   PARTICIPANTS
========================================================= */

const participantCount =
    document.getElementById("participantCount");

const participantsList =
    document.getElementById("participantsList");


/* =========================================================
   CHAT
========================================================= */

const chatForm =
    document.getElementById("chatForm");

const chatInput =
    document.getElementById("chatInput");

const chatMessages =
    document.getElementById("chatMessages");


/* =========================================================
   SIDEBAR
========================================================= */

const meetingSidebar =
    document.getElementById("meetingSidebar");

const chatBtn =
    document.getElementById("chatBtn");

const meetingChatBtn =
    document.getElementById("meetingChatBtn");

const participantsBtn =
    document.getElementById("participantsBtn");

const meetingParticipantsBtn =
    document.getElementById(
        "meetingParticipantsBtn"
    );

const sidebarClose =
    document.getElementById("sidebarClose");


/* =========================================================
   TOAST
========================================================= */

const meetingToast =
    document.getElementById("meetingToast");

const toastMessage =
    document.getElementById("toastMessage");

const toastIcon =
    document.getElementById("toastIcon");


/* =========================================================
   3. WEBRTC VARIABLES
========================================================= */

let localStream = null;

let screenStream = null;

let socket = null;


/*
One RTCPeerConnection per remote participant.
*/

const peerConnections = {};


/*
Participant names indexed by Socket.IO SID.
*/

const participants = {};


/*
Pending ICE candidates.
*/

const pendingIceCandidates = {};


/*
Remote MediaStreams.
*/

const remoteStreams = {};


/* =========================================================
   LOCAL MEDIA STATE
========================================================= */

let microphoneEnabled = true;

let cameraEnabled = true;


/* =========================================================
   INITIALIZATION FLAGS
========================================================= */

let meetingInitialized = false;

let socketRoomJoined = false;

let hasLeftMeeting = false;

let socketInitialized = false;

let mediaInitializationStarted = false;

let socketEventsRegistered = false;

let socketScriptLoading = false;


/* =========================================================
   WEBRTC CONFIGURATION
========================================================= */

const rtcConfiguration = {

    iceServers: [

        {
            urls:
                "stun:stun.l.google.com:19302"
        },

        {
            urls:
                "stun:stun1.l.google.com:19302"
        },

        {
            urls:
                "stun:stun2.l.google.com:19302"
        }

    ]

};


/* =========================================================
   4. SOCKET.IO CLIENT LOADER
========================================================= */

/*
IMPORTANT FIX

Your previous version tried:

https://cdn.socket.io/4.8.1/socket.io.min.js

Your browser reported:

ERR_CONNECTION_TIMED_OUT

Therefore this version first loads the LOCAL copy:

/static/js/socket.io.min.js

This means your meeting does not depend on Internet access
just to load the Socket.IO JavaScript client.
*/

function initializeSocket() {

    if (socketInitialized) {

        console.log(
            "Socket initialization already started."
        );

        return;

    }


    socketInitialized = true;


    /*
    =====================================================
    SOCKET.IO ALREADY LOADED
    =====================================================
    */

    if (typeof window.io === "function") {

        console.log(
            "Socket.IO client already available."
        );

        createSocket();

        return;

    }


    /*
    =====================================================
    LOAD LOCAL SOCKET.IO CLIENT
    =====================================================
    */

    console.log(
        "Socket.IO client not found."
    );

    console.log(
        "Loading local Socket.IO client..."
    );


    loadLocalSocketIO();

}


/* =========================================================
   LOAD LOCAL SOCKET.IO
========================================================= */

function loadLocalSocketIO() {

    if (socketScriptLoading) {

        return;

    }


    socketScriptLoading = true;


    const existingScript =
        document.querySelector(
            'script[data-meetspace-socketio="true"]'
        );


    if (existingScript) {

        console.log(
            "Socket.IO local script already loading."
        );

        return;

    }


    const script =
        document.createElement("script");


    script.src =
        "/static/js/socket.io.min.js";


    script.async = false;


    script.dataset.meetspaceSocketio =
        "true";


    script.onload =
        function () {

            console.log(
                "================================="
            );

            console.log(
                "LOCAL SOCKET.IO CLIENT LOADED"
            );

            console.log(
                "================================="
            );


            socketScriptLoading = false;


            if (
                typeof window.io === "function"
            ) {

                console.log(
                    "Socket.IO client detected."
                );

                createSocket();

            } else {

                console.error(
                    "Socket.IO file loaded but 'io' is unavailable."
                );


                updateConnectionStatus(
                    "error",
                    "Socket.IO unavailable"
                );


                showToast(
                    "error",
                    "Socket.IO client could not be initialized."
                );

            }

        };


    script.onerror =
        function () {

            socketScriptLoading = false;


            console.error(
                "================================="
            );

            console.error(
                "LOCAL SOCKET.IO CLIENT FAILED"
            );

            console.error(
                "Expected file:"
            );

            console.error(
                "/static/js/socket.io.min.js"
            );

            console.error(
                "================================="
            );


            updateConnectionStatus(
                "error",
                "Socket.IO client missing"
            );


            showToast(
                "error",
                "Socket.IO client file is missing."
            );

        };


    document.head.appendChild(
        script
    );

}


/* =========================================================
   5. CREATE SOCKET CONNECTION
========================================================= */

function createSocket() {

    if (socket) {

        console.log(
            "Socket already exists."
        );

        return;

    }


    if (typeof window.io !== "function") {

        console.error(
            "Cannot create socket: io() unavailable."
        );

        updateConnectionStatus(
            "error",
            "Socket.IO unavailable"
        );

        return;

    }


    try {

        console.log(
            "Creating Socket.IO connection..."
        );


        socket =
            window.io(
                window.location.origin,
                {

                    path:
                        "/socket.io/",

                    transports: [
                        "polling",
                        "websocket"
                    ],

                    reconnection:
                        true,

                    reconnectionAttempts:
                        Infinity,

                    reconnectionDelay:
                        1000,

                    reconnectionDelayMax:
                        5000,

                    timeout:
                        20000,

                    autoConnect:
                        true

                }
            );


        registerSocketEvents();


    } catch (error) {

        console.error(
            "Socket creation failed:",
            error
        );


        socket = null;


        updateConnectionStatus(
            "error",
            "Socket.IO unavailable"
        );

    }

}


/* =========================================================
   6. SOCKET EVENTS
========================================================= */

function registerSocketEvents() {

    if (!socket) {

        return;

    }


    if (socketEventsRegistered) {

        return;

    }


    socketEventsRegistered = true;


    /* =====================================================
       CONNECT
    ===================================================== */

    socket.on(
        "connect",
        async function () {

            console.log(
                "================================="
            );

            console.log(
                "SOCKET.IO CONNECTED"
            );

            console.log(
                "Socket ID:",
                socket.id
            );

            console.log(
                "Meeting ID:",
                meetingId
            );

            console.log(
                "User:",
                userName
            );

            console.log(
                "================================="
            );


            hasLeftMeeting = false;

            socketRoomJoined = false;


            updateConnectionStatus(
                "connecting",
                "Connected to server"
            );


            /*
            Initialize camera/microphone.
            */

            await initializeMeeting();


            /*
            Join meeting room only after
            Socket.IO connection is ready.
            */

            joinMeetingRoom();

        }
    );


    /* =====================================================
       CONNECT ERROR
    ===================================================== */

    socket.on(
        "connect_error",
        function (error) {

            console.error(
                "Socket.IO connection error:",
                error
            );


            updateConnectionStatus(
                "error",
                "Server connection failed"
            );

        }
    );


    /* =====================================================
       RECONNECT ATTEMPT
    ===================================================== */

    if (socket.io) {

        socket.io.on(
            "reconnect_attempt",
            function (attempt) {

                console.log(
                    "Socket reconnect attempt:",
                    attempt
                );


                socketRoomJoined = false;


                updateConnectionStatus(
                    "connecting",
                    "Reconnecting..."
                );

            }
        );


        socket.io.on(
            "reconnect",
            function (attempt) {

                console.log(
                    "Socket reconnected:",
                    attempt
                );


                socketRoomJoined = false;

            }
        );

    }


    /* =====================================================
       DISCONNECT
    ===================================================== */

    socket.on(
        "disconnect",
        function (reason) {

            console.warn(
                "Socket.IO disconnected:",
                reason
            );


            socketRoomJoined = false;


            if (!hasLeftMeeting) {

                updateConnectionStatus(
                    "error",
                    "Disconnected"
                );

            }

        }
    );


    /* =====================================================
       EXISTING PARTICIPANTS
    ===================================================== */

    socket.on(
        "existing-participants",
        async function (data) {

            console.log(
                "Existing participants:",
                data
            );


            const list =
                Array.isArray(
                    data?.participants
                )
                    ? data.participants
                    : [];


            for (
                const participant of list
            ) {

                let remoteSocketId =
                    participant?.sid ||
                    participant?.socket_id ||
                    participant?.id;


                let remoteName =
                    participant?.name ||
                    participant?.username ||
                    "Participant";


                /*
                Server may send plain SID.
                */

                if (
                    typeof participant ===
                    "string"
                ) {

                    remoteSocketId =
                        participant;

                    remoteName =
                        "Participant";

                }


                if (!remoteSocketId) {

                    continue;

                }


                if (
                    remoteSocketId ===
                    socket.id
                ) {

                    continue;

                }


                participants[
                    remoteSocketId
                ] = remoteName;


                const peerConnection =
                    createPeerConnection(
                        remoteSocketId,
                        remoteName
                    );


                try {

                    /*
                    New participant creates offer
                    to existing participant.
                    */

                    const offer =
                        await peerConnection
                            .createOffer({

                                offerToReceiveAudio:
                                    true,

                                offerToReceiveVideo:
                                    true

                            });


                    await peerConnection
                        .setLocalDescription(
                            offer
                        );


                    socket.emit(
                        "offer",
                        {

                            target:
                                remoteSocketId,

                            offer:
                                peerConnection
                                    .localDescription,

                            name:
                                userName

                        }
                    );


                    console.log(
                        "OFFER SENT ->",
                        remoteName,
                        remoteSocketId
                    );


                } catch (error) {

                    console.error(
                        "Offer creation failed:",
                        error
                    );

                }

            }


            updateParticipantCount();

        }
    );


    /* =====================================================
       USER JOINED
    ===================================================== */

    socket.on(
        "user-joined",
        function (data) {

            console.log(
                "USER JOINED:",
                data
            );


            const remoteSocketId =
                data?.sid ||
                data?.socket_id ||
                data?.id;


            const remoteName =
                data?.name ||
                data?.username ||
                "Participant";


            if (!remoteSocketId) {

                return;

            }


            if (
                remoteSocketId ===
                socket.id
            ) {

                return;

            }


            participants[
                remoteSocketId
            ] = remoteName;


            updateParticipantCount();


            showToast(
                "info",
                `${remoteName} joined the meeting.`
            );

        }
    );


    /* =====================================================
       RECEIVE OFFER
    ===================================================== */

    socket.on(
        "offer",
        async function (data) {

            console.log(
                "OFFER RECEIVED:",
                data
            );


            const remoteSocketId =
                data?.sender ||
                data?.from ||
                data?.socket_id;


            const remoteName =
                data?.name ||
                data?.username ||
                "Participant";


            if (
                !remoteSocketId ||
                !data?.offer
            ) {

                return;

            }


            if (
                remoteSocketId ===
                socket.id
            ) {

                return;

            }


            participants[
                remoteSocketId
            ] = remoteName;


            const peerConnection =
                createPeerConnection(
                    remoteSocketId,
                    remoteName
                );


            try {

                await peerConnection
                    .setRemoteDescription(
                        new RTCSessionDescription(
                            data.offer
                        )
                    );


                await flushPendingIceCandidates(
                    remoteSocketId
                );


                const answer =
                    await peerConnection
                        .createAnswer({

                            offerToReceiveAudio:
                                true,

                            offerToReceiveVideo:
                                true

                        });


                await peerConnection
                    .setLocalDescription(
                        answer
                    );


                socket.emit(
                    "answer",
                    {

                        target:
                            remoteSocketId,

                        answer:
                            peerConnection
                                .localDescription

                    }
                );


                console.log(
                    "ANSWER SENT ->",
                    remoteName
                );


            } catch (error) {

                console.error(
                    "Offer handling failed:",
                    error
                );

            }

        }
    );


    /* =====================================================
       RECEIVE ANSWER
    ===================================================== */

    socket.on(
        "answer",
        async function (data) {

            console.log(
                "ANSWER RECEIVED:",
                data
            );


            const remoteSocketId =
                data?.sender ||
                data?.from ||
                data?.socket_id;


            if (
                !remoteSocketId ||
                !data?.answer
            ) {

                return;

            }


            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            if (!peerConnection) {

                console.warn(
                    "Peer connection not found:",
                    remoteSocketId
                );

                return;

            }


            try {

                await peerConnection
                    .setRemoteDescription(
                        new RTCSessionDescription(
                            data.answer
                        )
                    );


                await flushPendingIceCandidates(
                    remoteSocketId
                );


                console.log(
                    "Remote answer applied:",
                    remoteSocketId
                );


            } catch (error) {

                console.error(
                    "Answer handling failed:",
                    error
                );

            }

        }
    );


    /* =====================================================
       ICE CANDIDATE
    ===================================================== */

    socket.on(
        "ice-candidate",
        async function (data) {

            const remoteSocketId =
                data?.sender ||
                data?.from ||
                data?.socket_id;


            const candidate =
                data?.candidate;


            if (
                !remoteSocketId ||
                !candidate
            ) {

                return;

            }


            if (
                remoteSocketId ===
                socket.id
            ) {

                return;

            }


            const peerConnection =
                peerConnections[
                    remoteSocketId
                ];


            if (!peerConnection) {

                queueIceCandidate(
                    remoteSocketId,
                    candidate
                );

                return;

            }


            if (
                !peerConnection
                    .remoteDescription
            ) {

                queueIceCandidate(
                    remoteSocketId,
                    candidate
                );

                return;

            }


            try {

                await peerConnection
                    .addIceCandidate(
                        new RTCIceCandidate(
                            candidate
                        )
                    );

            } catch (error) {

                console.error(
                    "ICE candidate error:",
                    error
                );

            }

        }
    );


    /* =====================================================
       CHAT
    ===================================================== */

    socket.on(
        "chat-message",
        function (data) {

            addChatMessage(
                data?.name ||
                data?.username ||
                "Participant",

                data?.message ||
                ""
            );

        }
    );


    /* =====================================================
       USER LEFT
    ===================================================== */

    socket.on(
        "user-left",
        function (data) {

            console.log(
                "USER LEFT:",
                data
            );


            const remoteSocketId =
                data?.sid ||
                data?.socket_id ||
                data?.id;


            const remoteName =
                data?.name ||
                data?.username ||
                "Participant";


            if (!remoteSocketId) {

                return;

            }


            removeRemoteParticipant(
                remoteSocketId
            );


            showToast(
                "info",
                `${remoteName} left the meeting.`
            );

        }
    );


    /* =====================================================
       PARTICIPANT COUNT
    ===================================================== */

    socket.on(
        "participant-count",
        function (data) {

            console.log(
                "Server participant count:",
                data?.count
            );


            if (
                typeof data?.count ===
                "number"
            ) {

                if (participantCount) {

                    participantCount.textContent =
                        data.count;

                }

            }

        }
    );

}


/* =========================================================
   7. INITIALIZE CAMERA + MICROPHONE
========================================================= */

async function initializeMeeting() {

    if (meetingInitialized) {

        return;

    }


    if (mediaInitializationStarted) {

        return;

    }


    mediaInitializationStarted = true;


    if (!meetingId) {

        console.error(
            "Meeting ID is missing."
        );


        updateConnectionStatus(
            "error",
            "Meeting ID missing"
        );


        return;

    }


    try {

        updateConnectionStatus(
            "connecting",
            "Requesting camera & microphone..."
        );


        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "getUserMedia is not supported by this browser."
            );

        }


        localStream =
            await navigator.mediaDevices
                .getUserMedia({

                    video: {

                        width: {
                            ideal: 1280
                        },

                        height: {
                            ideal: 720
                        },

                        frameRate: {
                            ideal: 30,
                            max: 30
                        },

                        facingMode:
                            "user"

                    },

                    audio: {

                        echoCancellation:
                            true,

                        noiseSuppression:
                            true,

                        autoGainControl:
                            true

                    }

                });


        console.log(
            "================================="
        );

        console.log(
            "CAMERA + MICROPHONE OBTAINED"
        );

        console.log(
            "Video tracks:",
            localStream
                .getVideoTracks()
                .length
        );

        console.log(
            "Audio tracks:",
            localStream
                .getAudioTracks()
                .length
        );

        console.log(
            "================================="
        );


        const videoTracks =
            localStream.getVideoTracks();


        const audioTracks =
            localStream.getAudioTracks();


        microphoneEnabled =
            audioTracks.length > 0 &&
            audioTracks.some(
                track =>
                    track.enabled
            );


        cameraEnabled =
            videoTracks.length > 0 &&
            videoTracks.some(
                track =>
                    track.enabled
            );


        /*
        =====================================================
        LOCAL VIDEO
        =====================================================
        */

        if (localVideo) {

            localVideo.srcObject =
                null;

            localVideo.muted =
                true;

            localVideo.defaultMuted =
                true;

            localVideo.autoplay =
                true;

            localVideo.playsInline =
                true;

            localVideo.setAttribute(
                "autoplay",
                ""
            );

            localVideo.setAttribute(
                "muted",
                ""
            );

            localVideo.setAttribute(
                "playsinline",
                ""
            );


            localVideo.style.display =
                "block";


            localVideo.srcObject =
                localStream;


            if (
                localVideo.readyState >= 1
            ) {

                await playLocalVideo();

            } else {

                localVideo.addEventListener(
                    "loadedmetadata",
                    playLocalVideo,
                    {
                        once: true
                    }
                );

            }


            setTimeout(
                playLocalVideo,
                300
            );


            setTimeout(
                function () {

                    console.log(
                        "========== LOCAL VIDEO CHECK =========="
                    );

                    console.log(
                        "Video width:",
                        localVideo.videoWidth
                    );

                    console.log(
                        "Video height:",
                        localVideo.videoHeight
                    );

                    console.log(
                        "Video readyState:",
                        localVideo.readyState
                    );

                    console.log(
                        "Video paused:",
                        localVideo.paused
                    );

                    console.log(
                        "Video source:",
                        localVideo.srcObject
                    );


                    if (videoTracks[0]) {

                        console.log(
                            "Camera track readyState:",
                            videoTracks[0]
                                .readyState
                        );

                        console.log(
                            "Camera track enabled:",
                            videoTracks[0]
                                .enabled
                        );

                    }


                    console.log(
                        "========================================"
                    );

                },
                1500
            );

        }


        if (localPlaceholder) {

            localPlaceholder.style.display =
                cameraEnabled
                    ? "none"
                    : "flex";

        }


        updateMicrophoneButton();

        updateCameraButton();


        meetingInitialized =
            true;


        updateConnectionStatus(
            "connected",
            "Camera & microphone ready"
        );


        console.log(
            "Camera and microphone are ready."
        );


    } catch (error) {

        console.error(
            "Media initialization error:",
            error
        );


        if (localVideo) {

            localVideo.srcObject =
                null;

            localVideo.style.display =
                "none";

        }


        if (localPlaceholder) {

            localPlaceholder.style.display =
                "flex";

        }


        microphoneEnabled =
            false;

        cameraEnabled =
            false;


        updateMicrophoneButton();

        updateCameraButton();


        updateConnectionStatus(
            "error",
            "Camera unavailable"
        );


        showToast(
            "error",
            getMediaErrorMessage(error)
        );

    }

}


/* =========================================================
   PLAY LOCAL VIDEO
========================================================= */

async function playLocalVideo() {

    if (!localVideo) {

        return;

    }


    if (!localVideo.srcObject) {

        return;

    }


    try {

        localVideo.muted =
            true;

        localVideo.defaultMuted =
            true;

        localVideo.autoplay =
            true;

        localVideo.playsInline =
            true;


        await localVideo.play();


        localVideo.style.display =
            "block";


        if (localPlaceholder) {

            localPlaceholder.style.display =
                "none";

        }


        console.log(
            "Local camera video is PLAYING."
        );


    } catch (error) {

        console.warn(
            "Local video play attempt failed:",
            error
        );

    }

}


/* =========================================================
   MEDIA ERROR MESSAGE
========================================================= */

function getMediaErrorMessage(error) {

    if (!error) {

        return (
            "Camera or microphone unavailable."
        );

    }


    switch (error.name) {

        case "NotAllowedError":

            return (
                "Camera/microphone permission was denied. " +
                "Allow camera and microphone access in Chrome."
            );


        case "NotFoundError":

            return (
                "Camera or microphone was not found."
            );


        case "NotReadableError":

            return (
                "Camera or microphone is already being used " +
                "by another application."
            );


        case "OverconstrainedError":

            return (
                "Camera does not support the requested settings."
            );


        case "SecurityError":

            return (
                "Browser security prevented camera access."
            );


        case "AbortError":

            return (
                "Camera initialization was interrupted."
            );


        default:

            return (
                "Unable to access camera or microphone."
            );

    }

}


/* =========================================================
   8. JOIN SOCKET.IO ROOM
========================================================= */

function joinMeetingRoom() {

    if (!socket) {

        console.error(
            "Cannot join meeting: socket unavailable."
        );

        return;

    }


    if (!socket.connected) {

        console.warn(
            "Cannot join meeting: socket not connected."
        );

        return;

    }


    if (!meetingId) {

        console.error(
            "Cannot join meeting: meeting ID missing."
        );

        return;

    }


    if (socketRoomJoined) {

        console.log(
            "Already joined Socket.IO room."
        );

        return;

    }


    console.log(
        "================================="
    );

    console.log(
        "JOINING SOCKET.IO ROOM"
    );

    console.log(
        "Meeting:",
        meetingId
    );

    console.log(
        "User:",
        userName
    );

    console.log(
        "Socket:",
        socket.id
    );

    console.log(
        "================================="
    );


    socket.emit(
        "join-meeting",
        {

            meeting_id:
                meetingId,

            name:
                userName

        }
    );


    socketRoomJoined =
        true;

}


/* =========================================================
   9. CREATE PEER CONNECTION
========================================================= */

function createPeerConnection(
    remoteSocketId,
    remoteName = "Participant"
) {

    if (
        peerConnections[
            remoteSocketId
        ]
    ) {

        return peerConnections[
            remoteSocketId
        ];

    }


    console.log(
        "Creating WebRTC peer:",
        remoteName,
        remoteSocketId
    );


    const peerConnection =
        new RTCPeerConnection(
            rtcConfiguration
        );


    peerConnections[
        remoteSocketId
    ] =
        peerConnection;


    participants[
        remoteSocketId
    ] =
        remoteName;


    remoteStreams[
        remoteSocketId
    ] =
        new MediaStream();


    pendingIceCandidates[
        remoteSocketId
    ] =
        pendingIceCandidates[
            remoteSocketId
        ] || [];


    /*
    =====================================================
    ADD LOCAL CAMERA + MICROPHONE
    =====================================================
    */

    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                function (track) {

                    try {

                        peerConnection.addTrack(
                            track,
                            localStream
                        );


                        console.log(
                            "Local track added:",
                            track.kind
                        );


                    } catch (error) {

                        console.error(
                            "Unable to add local track:",
                            error
                        );

                    }

                }
            );

    }


    /*
    =====================================================
    REMOTE TRACK
    =====================================================
    */

    peerConnection.ontrack =
        function (event) {

            console.log(
                "REMOTE TRACK:",
                remoteSocketId,
                event.track.kind
            );


            let stream =
                remoteStreams[
                    remoteSocketId
                ];


            if (!stream) {

                stream =
                    new MediaStream();


                remoteStreams[
                    remoteSocketId
                ] =
                    stream;

            }


            const alreadyAdded =
                stream
                    .getTracks()
                    .some(
                        track =>
                            track.id ===
                            event.track.id
                    );


            if (!alreadyAdded) {

                stream.addTrack(
                    event.track
                );

            }


            createRemoteVideo(
                remoteSocketId,
                remoteName,
                stream
            );


            event.track.onended =
                function () {

                    console.log(
                        "Remote track ended:",
                        remoteSocketId,
                        event.track.kind
                    );

                };

        };


    /*
    =====================================================
    ICE CANDIDATE
    =====================================================
    */

    peerConnection.onicecandidate =
        function (event) {

            if (
                !event.candidate ||
                !socket ||
                !socket.connected
            ) {

                return;

            }


            socket.emit(
                "ice-candidate",
                {

                    target:
                        remoteSocketId,

                    candidate:
                        event.candidate

                }
            );

        };


    /*
    =====================================================
    CONNECTION STATE
    =====================================================
    */

    peerConnection.onconnectionstatechange =
        function () {

            const state =
                peerConnection.connectionState;


            console.log(
                `WebRTC ${remoteName}:`,
                state
            );


            if (
                state === "connected"
            ) {

                updateConnectionStatus(
                    "connected",
                    "Connected"
                );


                showToast(
                    "success",
                    `${remoteName} connected.`
                );

            }


            if (
                state === "connecting"
            ) {

                updateConnectionStatus(
                    "connecting",
                    "Connecting..."
                );

            }


            if (
                state === "failed"
            ) {

                console.error(
                    "WebRTC connection failed:",
                    remoteSocketId
                );


                updateConnectionStatus(
                    "error",
                    "WebRTC connection failed"
                );


                try {

                    peerConnection.restartIce();

                } catch (error) {

                    console.warn(
                        "ICE restart unavailable:",
                        error
                    );

                }

            }


            if (
                state === "disconnected"
            ) {

                setTimeout(
                    function () {

                        const current =
                            peerConnections[
                                remoteSocketId
                            ];


                        if (
                            current &&
                            (
                                current.connectionState ===
                                "disconnected" ||

                                current.connectionState ===
                                "failed"
                            )
                        ) {

                            removeRemoteParticipant(
                                remoteSocketId
                            );

                        }

                    },
                    5000
                );

            }


            if (
                state === "closed"
            ) {

                removeRemoteParticipant(
                    remoteSocketId
                );

            }

        };


    /*
    =====================================================
    ICE CONNECTION STATE
    =====================================================
    */

    peerConnection
        .oniceconnectionstatechange =
        function () {

            console.log(
                "ICE:",
                remoteSocketId,
                peerConnection
                    .iceConnectionState
            );

        };


    /*
    =====================================================
    ICE GATHERING STATE
    =====================================================
    */

    peerConnection
        .onicegatheringstatechange =
        function () {

            console.log(
                "ICE gathering:",
                remoteSocketId,
                peerConnection
                    .iceGatheringState
            );

        };


    return peerConnection;

}


/* =========================================================
   10. ICE QUEUE
========================================================= */

function queueIceCandidate(
    socketId,
    candidate
) {

    if (
        !pendingIceCandidates[
            socketId
        ]
    ) {

        pendingIceCandidates[
            socketId
        ] = [];

    }


    pendingIceCandidates[
        socketId
    ].push(
        candidate
    );

}


/* =========================================================
   FLUSH ICE CANDIDATES
========================================================= */

async function flushPendingIceCandidates(
    socketId
) {

    const peerConnection =
        peerConnections[
            socketId
        ];


    if (!peerConnection) {

        return;

    }


    if (
        !peerConnection.remoteDescription
    ) {

        return;

    }


    const candidates =
        pendingIceCandidates[
            socketId
        ] || [];


    for (
        const candidate of candidates
    ) {

        try {

            await peerConnection
                .addIceCandidate(
                    new RTCIceCandidate(
                        candidate
                    )
                );

        } catch (error) {

            console.error(
                "Queued ICE candidate error:",
                error
            );

        }

    }


    pendingIceCandidates[
        socketId
    ] = [];

}


/* =========================================================
   11. CREATE REMOTE VIDEO
========================================================= */

function createRemoteVideo(
    socketId,
    name,
    stream
) {

    if (!remoteVideos) {

        console.error(
            "#remoteVideos not found."
        );

        return;

    }


    let card =
        document.getElementById(
            `remote-${socketId}`
        );


    /*
    =====================================================
    CARD ALREADY EXISTS
    =====================================================
    */

    if (card) {

        const video =
            card.querySelector(
                "video"
            );


        if (video) {

            video.autoplay =
                true;

            video.playsInline =
                true;

            video.controls =
                false;

            video.muted =
                false;

            video.volume =
                1;


            video.setAttribute(
                "autoplay",
                ""
            );

            video.setAttribute(
                "playsinline",
                ""
            );


            if (
                video.srcObject !==
                stream
            ) {

                video.srcObject =
                    stream;

            }


            video.play().catch(
                function (error) {

                    console.warn(
                        "Remote video playback:",
                        error
                    );

                }
            );

        }


        if (emptyState) {

            emptyState.style.display =
                "none";

        }


        return;

    }


    /*
    =====================================================
    CREATE CARD
    =====================================================
    */

    card =
        document.createElement(
            "div"
        );


    card.className =
        "video-card remote-video-card";


    card.id =
        `remote-${socketId}`;


    /*
    =====================================================
    VIDEO
    =====================================================
    */

    const video =
        document.createElement(
            "video"
        );


    video.autoplay =
        true;

    video.playsInline =
        true;

    video.controls =
        false;

    video.muted =
        false;

    video.volume =
        1;


    video.setAttribute(
        "autoplay",
        ""
    );

    video.setAttribute(
        "playsinline",
        ""
    );


    video.srcObject =
        stream;


    /*
    =====================================================
    NAME
    =====================================================
    */

    const label =
        document.createElement(
            "div"
        );


    label.className =
        "video-name";


    label.textContent =
        name;


    /*
    =====================================================
    ADD TO DOM
    =====================================================
    */

    card.appendChild(
        video
    );

    card.appendChild(
        label
    );


    remoteVideos.appendChild(
        card
    );


    if (emptyState) {

        emptyState.style.display =
            "none";

    }


    /*
    =====================================================
    PLAY REMOTE VIDEO
    =====================================================
    */

    video.play().then(
        function () {

            console.log(
                "Remote video playing:",
                name
            );

        }
    ).catch(
        function (error) {

            console.warn(
                "Remote autoplay blocked:",
                error
            );


            const resumePlayback =
                function () {

                    video.play().catch(
                        function () {}
                    );

                };


            document.addEventListener(
                "click",
                resumePlayback,
                {
                    once: true
                }
            );

        }
    );


    /*
    =====================================================
    VIDEO DEBUG
    =====================================================
    */

    video.addEventListener(
        "loadedmetadata",
        function () {

            console.log(
                "Remote video metadata loaded:",
                name,
                video.videoWidth,
                video.videoHeight
            );


            video.play().catch(
                function () {}
            );

        }
    );


    updateParticipantCount();


    console.log(
        "Remote participant video created:",
        name
    );

}


/* =========================================================
   12. REMOVE REMOTE PARTICIPANT
========================================================= */

function removeRemoteParticipant(
    socketId
) {

    console.log(
        "Removing participant:",
        socketId
    );


    const card =
        document.getElementById(
            `remote-${socketId}`
        );


    if (card) {

        const video =
            card.querySelector(
                "video"
            );


        if (video) {

            try {

                video.pause();

            } catch (error) {}


            video.srcObject =
                null;

        }


        card.remove();

    }


    const peerConnection =
        peerConnections[
            socketId
        ];


    if (peerConnection) {

        try {

            peerConnection.ontrack =
                null;

            peerConnection.onicecandidate =
                null;

            peerConnection.close();

        } catch (error) {

            console.error(
                "Peer close error:",
                error
            );

        }

    }


    delete peerConnections[
        socketId
    ];

    delete participants[
        socketId
    ];

    delete pendingIceCandidates[
        socketId
    ];

    delete remoteStreams[
        socketId
    ];


    if (
        Object.keys(
            peerConnections
        ).length === 0
    ) {

        if (emptyState) {

            emptyState.style.display =
                "flex";

        }

    }


    updateParticipantCount();

}


/* =========================================================
   13. MICROPHONE
========================================================= */

if (micBtn) {

    micBtn.addEventListener(
        "click",
        toggleMicrophone
    );

}


function toggleMicrophone() {

    if (!localStream) {

        showToast(
            "error",
            "Microphone is unavailable."
        );

        return;

    }


    const tracks =
        localStream.getAudioTracks();


    if (tracks.length === 0) {

        showToast(
            "error",
            "No microphone found."
        );

        return;

    }


    microphoneEnabled =
        !microphoneEnabled;


    tracks.forEach(
        function (track) {

            track.enabled =
                microphoneEnabled;

        }
    );


    updateMicrophoneButton();


    showToast(
        "info",
        microphoneEnabled
            ? "Microphone turned on."
            : "Microphone muted."
    );

}


/* =========================================================
   MICROPHONE UI
========================================================= */

function updateMicrophoneButton() {

    if (!micBtn) {

        return;

    }


    const icon =
        micBtn.querySelector(
            ".control-icon"
        );


    if (microphoneEnabled) {

        micBtn.classList.add(
            "active"
        );

        micBtn.classList.remove(
            "off"
        );


        if (icon) {

            icon.textContent =
                "🎤";

        }


        micBtn.title =
            "Mute microphone";


    } else {

        micBtn.classList.remove(
            "active"
        );

        micBtn.classList.add(
            "off"
        );


        if (icon) {

            icon.textContent =
                "🔇";

        }


        micBtn.title =
            "Unmute microphone";

    }

}


/* =========================================================
   14. CAMERA
========================================================= */

if (cameraBtn) {

    cameraBtn.addEventListener(
        "click",
        toggleCamera
    );

}


function toggleCamera() {

    if (!localStream) {

        showToast(
            "error",
            "Camera is unavailable."
        );

        return;

    }


    const tracks =
        localStream.getVideoTracks();


    if (tracks.length === 0) {

        showToast(
            "error",
            "No camera found."
        );

        return;

    }


    cameraEnabled =
        !cameraEnabled;


    tracks.forEach(
        function (track) {

            track.enabled =
                cameraEnabled;

        }
    );


    if (cameraEnabled) {

        if (localVideo) {

            localVideo.srcObject =
                localStream;

            localVideo.muted =
                true;

            localVideo.defaultMuted =
                true;

            localVideo.autoplay =
                true;

            localVideo.playsInline =
                true;

            localVideo.style.display =
                "block";


            localVideo.play().catch(
                function () {}
            );

        }


        if (localPlaceholder) {

            localPlaceholder.style.display =
                "none";

        }

    } else {

        if (localVideo) {

            localVideo.style.display =
                "none";

        }


        if (localPlaceholder) {

            localPlaceholder.style.display =
                "flex";

        }

    }


    updateCameraButton();


    showToast(
        "info",
        cameraEnabled
            ? "Camera turned on."
            : "Camera turned off."
    );

}


/* =========================================================
   CAMERA UI
========================================================= */

function updateCameraButton() {

    if (!cameraBtn) {

        return;

    }


    const icon =
        cameraBtn.querySelector(
            ".control-icon"
        );


    if (cameraEnabled) {

        cameraBtn.classList.add(
            "active"
        );

        cameraBtn.classList.remove(
            "off"
        );


        if (icon) {

            icon.textContent =
                "📹";

        }


        cameraBtn.title =
            "Turn camera off";


    } else {

        cameraBtn.classList.remove(
            "active"
        );

        cameraBtn.classList.add(
            "off"
        );


        if (icon) {

            icon.textContent =
                "🚫";

        }


        cameraBtn.title =
            "Turn camera on";

    }

}


/* =========================================================
   15. SCREEN SHARE
========================================================= */

if (screenShareBtn) {

    screenShareBtn.addEventListener(
        "click",
        toggleScreenShare
    );

}


async function toggleScreenShare() {

    if (screenStream) {

        await stopScreenSharing();

        return;

    }


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getDisplayMedia
    ) {

        showToast(
            "error",
            "Screen sharing is not supported."
        );

        return;

    }


    try {

        screenStream =
            await navigator.mediaDevices
                .getDisplayMedia({

                    video: {

                        cursor:
                            "always"

                    },

                    audio:
                        true

                });


        const screenTrack =
            screenStream
                .getVideoTracks()[0];


        if (!screenTrack) {

            throw new Error(
                "Screen track unavailable."
            );

        }


        /*
        =====================================================
        REPLACE VIDEO TRACK FOR ALL PEERS
        =====================================================
        */

        for (
            const socketId in peerConnections
        ) {

            const peerConnection =
                peerConnections[
                    socketId
                ];


            const sender =
                peerConnection
                    .getSenders()
                    .find(
                        function (item) {

                            return (
                                item.track &&
                                item.track.kind ===
                                "video"
                            );

                        }
                    );


            if (sender) {

                try {

                    await sender.replaceTrack(
                        screenTrack
                    );

                } catch (error) {

                    console.error(
                        "Screen track replacement error:",
                        error
                    );

                }

            }

        }


        /*
        =====================================================
        LOCAL SCREEN PREVIEW
        =====================================================
        */

        if (localVideo) {

            localVideo.srcObject =
                screenStream;

            localVideo.muted =
                true;

            localVideo.defaultMuted =
                true;

            localVideo.autoplay =
                true;

            localVideo.playsInline =
                true;

            localVideo.style.display =
                "block";


            localVideo.play().catch(
                function () {}
            );

        }


        if (localPlaceholder) {

            localPlaceholder.style.display =
                "none";

        }


        /*
        =====================================================
        BUTTON
        =====================================================
        */

        screenShareBtn.classList.add(
            "active"
        );


        const label =
            screenShareBtn.querySelector(
                ".control-label"
            );


        if (label) {

            label.textContent =
                "Stop Share";

        }


        showToast(
            "success",
            "Screen sharing started."
        );


        /*
        =====================================================
        BROWSER STOP SHARING
        =====================================================
        */

        screenTrack.onended =
            function () {

                stopScreenSharing();

            };


    } catch (error) {

        console.error(
            "Screen sharing error:",
            error
        );


        if (screenStream) {

            screenStream
                .getTracks()
                .forEach(
                    function (track) {

                        track.stop();

                    }
                );

        }


        screenStream =
            null;


        showToast(
            "info",
            "Screen sharing cancelled."
        );

    }

}


/* =========================================================
   STOP SCREEN SHARING
========================================================= */

async function stopScreenSharing() {

    if (!screenStream) {

        return;

    }


    screenStream
        .getTracks()
        .forEach(
            function (track) {

                track.stop();

            }
        );


    screenStream =
        null;


    const cameraTrack =
        localStream
            ?.getVideoTracks()
            ?.find(
                function (track) {

                    return (
                        track.kind ===
                        "video"
                    );

                }
            );


    if (cameraTrack) {

        for (
            const socketId in peerConnections
        ) {

            const peerConnection =
                peerConnections[
                    socketId
                ];


            const sender =
                peerConnection
                    .getSenders()
                    .find(
                        function (item) {

                            return (
                                item.track &&
                                item.track.kind ===
                                "video"
                            );

                        }
                    );


            if (sender) {

                try {

                    await sender.replaceTrack(
                        cameraTrack
                    );

                } catch (error) {

                    console.error(
                        "Camera restore error:",
                        error
                    );

                }

            }

        }


        if (localVideo) {

            localVideo.srcObject =
                localStream;

            localVideo.muted =
                true;

            localVideo.defaultMuted =
                true;

            localVideo.autoplay =
                true;

            localVideo.playsInline =
                true;


            if (cameraEnabled) {

                localVideo.style.display =
                    "block";


                localVideo.play().catch(
                    function () {}
                );

            }

        }

    }


    if (screenShareBtn) {

        screenShareBtn.classList.remove(
            "active"
        );


        const label =
            screenShareBtn.querySelector(
                ".control-label"
            );


        if (label) {

            label.textContent =
                "Share Screen";

        }

    }


    showToast(
        "info",
        "Screen sharing stopped."
    );

}


/* =========================================================
   16. PARTICIPANT COUNT
========================================================= */

function updateParticipantCount() {

    const remoteCount =
        Object.keys(
            participants
        ).length;


    const total =
        remoteCount + 1;


    if (participantCount) {

        participantCount.textContent =
            total;

    }


    updateParticipantsList();

}


/* =========================================================
   PARTICIPANT LIST
========================================================= */

function updateParticipantsList() {

    if (!participantsList) {

        return;

    }


    participantsList.innerHTML =
        "";


    addParticipantToList(
        userName,
        "You"
    );


    Object.values(
        participants
    ).forEach(
        function (name) {

            addParticipantToList(
                name,
                "Connected"
            );

        }
    );

}


/* =========================================================
   ADD PARTICIPANT TO LIST
========================================================= */

function addParticipantToList(
    name,
    status
) {

    if (!participantsList) {

        return;

    }


    const item =
        document.createElement(
            "div"
        );


    item.className =
        "participant-item";


    const avatar =
        document.createElement(
            "div"
        );


    avatar.className =
        "participant-small-avatar";


    avatar.textContent =
        (name || "P")
            .charAt(0)
            .toUpperCase();


    const details =
        document.createElement(
            "div"
        );


    details.className =
        "participant-details";


    const strong =
        document.createElement(
            "strong"
        );


    strong.textContent =
        name;


    const span =
        document.createElement(
            "span"
        );


    span.textContent =
        status;


    details.appendChild(
        strong
    );

    details.appendChild(
        span
    );


    item.appendChild(
        avatar
    );

    item.appendChild(
        details
    );


    participantsList.appendChild(
        item
    );

}


/* =========================================================
   17. CHAT
========================================================= */

if (chatForm) {

    chatForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const message =
                chatInput?.value?.trim();


            if (!message) {

                return;

            }


            if (
                !socket ||
                !socket.connected
            ) {

                showToast(
                    "error",
                    "Chat connection unavailable."
                );

                return;

            }


            socket.emit(
                "chat-message",
                {

                    meeting_id:
                        meetingId,

                    name:
                        userName,

                    message:
                        message

                }
            );


            addChatMessage(
                userName,
                message
            );


            if (chatInput) {

                chatInput.value =
                    "";

            }

        }
    );

}


/* =========================================================
   ADD CHAT MESSAGE
========================================================= */

function addChatMessage(
    name,
    message
) {

    if (!chatMessages) {

        return;

    }


    if (!message) {

        return;

    }


    const messageItem =
        document.createElement(
            "div"
        );


    messageItem.className =
        "chat-message";


    const nameElement =
        document.createElement(
            "strong"
        );


    nameElement.textContent =
        name;


    const textElement =
        document.createElement(
            "span"
        );


    textElement.textContent =
        message;


    messageItem.appendChild(
        nameElement
    );


    messageItem.appendChild(
        textElement
    );


    chatMessages.appendChild(
        messageItem
    );


    chatMessages.scrollTop =
        chatMessages.scrollHeight;

}


/* =========================================================
   18. SIDEBAR
========================================================= */

function openChat() {

    if (!meetingSidebar) {

        return;

    }


    meetingSidebar.classList.add(
        "show-chat"
    );


    meetingSidebar.classList.remove(
        "show-participants"
    );

}


function openParticipants() {

    if (!meetingSidebar) {

        return;

    }


    meetingSidebar.classList.add(
        "show-participants"
    );


    meetingSidebar.classList.remove(
        "show-chat"
    );


    updateParticipantsList();

}


function closeSidebar() {

    if (!meetingSidebar) {

        return;

    }


    meetingSidebar.classList.remove(
        "show-chat"
    );


    meetingSidebar.classList.remove(
        "show-participants"
    );

}


if (chatBtn) {

    chatBtn.addEventListener(
        "click",
        openChat
    );

}


if (meetingChatBtn) {

    meetingChatBtn.addEventListener(
        "click",
        openChat
    );

}


if (participantsBtn) {

    participantsBtn.addEventListener(
        "click",
        openParticipants
    );

}


if (meetingParticipantsBtn) {

    meetingParticipantsBtn.addEventListener(
        "click",
        openParticipants
    );

}


if (sidebarClose) {

    sidebarClose.addEventListener(
        "click",
        closeSidebar
    );

}


/* =========================================================
   19. LEAVE MEETING
========================================================= */

if (leaveMeetingBtn) {

    leaveMeetingBtn.addEventListener(
        "click",
        leaveMeeting
    );

}


if (leaveMeetingBtn2) {

    leaveMeetingBtn2.addEventListener(
        "click",
        leaveMeeting
    );

}


function leaveMeeting() {

    if (hasLeftMeeting) {

        return;

    }


    const confirmed =
        window.confirm(
            "Are you sure you want to leave the meeting?"
        );


    if (!confirmed) {

        return;

    }


    hasLeftMeeting =
        true;


    if (
        socket &&
        socket.connected
    ) {

        socket.emit(
            "leave-meeting",
            {

                meeting_id:
                    meetingId

            }
        );

    }


    stopLocalMedia();

    closeAllPeerConnections();


    if (socket) {

        socket.disconnect();

    }


    window.location.href =
        "/meeting/";

}


/* =========================================================
   20. STOP LOCAL MEDIA
========================================================= */

function stopLocalMedia() {

    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                function (track) {

                    track.stop();

                }
            );


        localStream =
            null;

    }


    if (screenStream) {

        screenStream
            .getTracks()
            .forEach(
                function (track) {

                    track.stop();

                }
            );


        screenStream =
            null;

    }


    if (localVideo) {

        try {

            localVideo.pause();

        } catch (error) {}


        localVideo.srcObject =
            null;

    }

}


/* =========================================================
   21. CLOSE ALL PEERS
========================================================= */

function closeAllPeerConnections() {

    Object.keys(
        peerConnections
    ).forEach(
        function (socketId) {

            try {

                const peer =
                    peerConnections[
                        socketId
                    ];


                peer.ontrack =
                    null;

                peer.onicecandidate =
                    null;

                peer.close();

            } catch (error) {

                console.error(
                    "Peer close error:",
                    error
                );

            }

        }
    );


    Object.keys(
        peerConnections
    ).forEach(
        function (key) {

            delete peerConnections[
                key
            ];

        }
    );


    Object.keys(
        participants
    ).forEach(
        function (key) {

            delete participants[
                key
            ];

        }
    );


    Object.keys(
        pendingIceCandidates
    ).forEach(
        function (key) {

            delete pendingIceCandidates[
                key
            ];

        }
    );


    Object.keys(
        remoteStreams
    ).forEach(
        function (key) {

            delete remoteStreams[
                key
            ];

        }
    );


    if (emptyState) {

        emptyState.style.display =
            "flex";

    }


    updateParticipantCount();

}


/* =========================================================
   22. CONNECTION STATUS
========================================================= */

function updateConnectionStatus(
    type,
    text
) {

    if (!connectionStatus) {

        return;

    }


    connectionStatus.classList.remove(
        "connected",
        "error",
        "connecting"
    );


    if (type === "connected") {

        connectionStatus.classList.add(
            "connected"
        );

    }


    if (type === "error") {

        connectionStatus.classList.add(
            "error"
        );

    }


    if (type === "connecting") {

        connectionStatus.classList.add(
            "connecting"
        );

    }


    if (connectionText) {

        connectionText.textContent =
            text;

    } else {

        connectionStatus.textContent =
            text;

    }

}


/* =========================================================
   23. TOAST
========================================================= */

let toastTimer =
    null;


function showToast(
    type,
    message
) {

    if (
        !meetingToast ||
        !toastMessage
    ) {

        console.log(
            `[${type}] ${message}`
        );

        return;

    }


    toastMessage.textContent =
        message;


    if (toastIcon) {

        if (type === "error") {

            toastIcon.textContent =
                "⚠️";

        } else if (type === "info") {

            toastIcon.textContent =
                "ℹ️";

        } else {

            toastIcon.textContent =
                "✓";

        }

    }


    meetingToast.classList.add(
        "show"
    );


    if (toastTimer) {

        clearTimeout(
            toastTimer
        );

    }


    toastTimer =
        setTimeout(
            function () {

                meetingToast.classList.remove(
                    "show"
                );

            },
            2500
        );

}


/* =========================================================
   24. BEFORE UNLOAD
========================================================= */

window.addEventListener(
    "beforeunload",
    function () {

        if (
            socket &&
            socket.connected &&
            meetingId &&
            !hasLeftMeeting
        ) {

            socket.emit(
                "leave-meeting",
                {

                    meeting_id:
                        meetingId

                }
            );

        }


        stopLocalMedia();

    }
);


/* =========================================================
   25. USER INTERACTION PLAYBACK FALLBACK
========================================================= */

document.addEventListener(
    "click",
    function () {

        /*
        Local video.
        */

        if (
            localVideo &&
            localVideo.srcObject
        ) {

            localVideo.play().catch(
                function () {}
            );

        }


        /*
        Remote videos.
        */

        if (remoteVideos) {

            remoteVideos
                .querySelectorAll(
                    "video"
                )
                .forEach(
                    function (video) {

                        video.play().catch(
                            function () {}
                        );

                    }
                );

        }

    },
    {
        passive: true
    }
);


/* =========================================================
   26. PAGE INITIALIZATION
========================================================= */

function initializeMeetSpacePage() {

    console.log(
        "================================="
    );

    console.log(
        "MeetSpace meeting.js loaded."
    );

    console.log(
        "Meeting:",
        meetingId
    );

    console.log(
        "User:",
        userName
    );

    console.log(
        "================================="
    );


    if (!meetingId) {

        console.error(
            "Meeting ID is missing from #meetingApp."
        );


        updateConnectionStatus(
            "error",
            "Meeting ID missing"
        );


        return;

    }


    updateParticipantCount();


    /*
    Start Socket.IO.
    */

    initializeSocket();

}


/* =========================================================
   27. DOM READY
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeMeetSpacePage,
        {
            once: true
        }
    );

} else {

    initializeMeetSpacePage();

}


/* =========================================================
                    END OF FILE
========================================================= */