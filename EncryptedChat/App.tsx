import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Button,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  SnapshotViewIOS,
} from "react-native";
import {
  ScreenCapturePickerView,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
  registerGlobals,
} from "react-native-webrtc";

import uuid from "react-native-uuid";

import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, get, child } from "firebase/database";
import {
  API_KEY,
  AUTH_DOMAIN,
  PROJECT_ID,
  STORAGE_BUCKET,
  MESSAGING_SENDER_ID,
  APP_ID,
} from "@env";

const firebaseConfig = {
  apiKey: API_KEY,
  authDomain: AUTH_DOMAIN,
  projectId: PROJECT_ID,
  storageBucket: STORAGE_BUCKET,
  messagingSenderId: MESSAGING_SENDER_ID,
  appId: APP_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const DB = getDatabase(firebaseApp);

export default function App() {
  const [localStream, setLocalStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [myMessage, setMyMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [join, setJoin] = useState(false);
  const [pConn, setPConn] = useState();
  const scrollViewRef = useRef(ScrollView);

  const [answerData, setAnswerData] = useState();
  const [answerDataBoolean, setAnswerDataBoolean] = useState(false);
  const sdpAnswers = useRef(new Array());

  const [offerCandidateData, setOfferCandidateData] = useState(new Array());
  const [offerCandidateDataBoolean, setOfferCandidateDataBoolean] =
    useState(false);
  const offerCandidates = useRef(new Array());

  const [answerCandidateData, setAnswerCandidateData] = useState(new Array());
  const [answerCandidateDataBoolean, setAnswerCandidateDataBoolean] =
    useState(false);
  const answerCandidates = useRef(new Array());

  const [roomId, setRoomId] = useState();
  const [uniqueId, setUniqueId] = useState();
  const [uniqueHostId, setUniqueHostId] = useState();
  let hostId;

  let localCandidate = false;
  let remoteCandidate = false;

  const configuration = {
    iceServers: [
      {
        url: "stun:stun.l.google.com:19302",
      },
    ],
  };
  let PC = new RTCPeerConnection(configuration);
  let dataChannel = PC.createDataChannel("my_channel",{negotiated:true});

  const startLocalStream = async () => {
    const isFront = true;
    const devices = await mediaDevices.enumerateDevices();

    const facing = isFront ? "front" : "back";
    const videoSourceId = devices.find(
      (device) => device.kind === "videoinput" && device.facing === facing
    );

    const facingMode = isFront ? "user" : "environment";
    const constraints = {
      audio: true,
      video: {
        mandatory: {
          minWidth: 500, // Provide your own width, height and frame rate here
          minHeight: 300,
          minFrameRate: 30,
        },
        facingMode,
        optional: videoSourceId ? [{ sourceId: videoSourceId }] : [],
      },
    };

    const newStream = await mediaDevices.getUserMedia(constraints);
    setLocalStream(newStream);
    setRemoteStream(undefined);

    try {
      newStream._tracks.forEach((track) => {
        let trackObJ = PC.addTrack(track, newStream._tracks);
      });
      setPConn(PC);
    } catch (error) {
      console.log("error localStream getTracks: " + error);
    }
  };

  // EVENT LISTENERS
  PC.addEventListener("connectionstatechange", (event) => {
    switch (PC.connectionState) {
      case "new":
        console.log("new " + JSON.stringify(event));
        break;

      case "connecting":
        console.log("connecting " + JSON.stringify(event));
        break;

      case "connected":
        console.log("connected: " + JSON.stringify(event));
        break;

      case "disconnected":
        console.log("disconnected " + JSON.stringify(event));
        break;

      case "closed":
        // You can handle the call being disconnected here.
        break;
      case "failed":
        console.log("failed " + JSON.stringify(event));
        break;

      default:
        console.log("default");
        break;
    }
  });

  PC.addEventListener("iceconnectionstatechange", (event) => {
    switch (PC.iceConnectionState) {
      case "connected":
        console.log("connected " + event);
        break;

      case "completed":
        // You can handle the call being connected here.
        // Like setting the video streams to visible.
        console.log("completed " + JSON.stringify(event));
        break;

      default:
        break;
    }
  });

  PC.addEventListener("negotiationneeded", (event) => {
    // You can start the offer stages here.
    // Be careful as this event can be called multiple times.
    console.log("negotiate " + JSON.stringify(event));
  });

  PC.addEventListener("signalingstatechange", (event) => {
    switch (PC.signalingState) {
      case "closed":
        // You can handle the call being disconnected here.
        break;

      case "stable":
        console.log("stable " + JSON.stringify(event));
        break;

      case "have-local-offer":
        console.log("local offer " + JSON.stringify(event));
        break;

      case "have-remote-offer":
        console.log("remote offer " + JSON.stringify(event));
        break;

      default:
        break;
    }
  });

  PC.addEventListener("addstream", (event) => {
    // Grab the remote stream from the connected participant.
    setRemoteStream(event.stream);
    console.log("remote stream " + JSON.stringify(event));
  });

  PC.addEventListener("datachannel", (event) => {
    console.log("datachannel stringify " + JSON.stringify(event));
  });

  dataChannel.addEventListener("open", (event) => {
    console.log("dataChannel is open " + JSON.stringify(event));
    dataChannel._id = 0
    console.log("_id: "+dataChannel._id)
    console.log("id: "+dataChannel.id)
    dataChannel.send("mesaj deneme")
  });

  dataChannel.addEventListener("close", (event) => {
    console.log("dataChannel is closed " + JSON.stringify(event));
  });

  dataChannel.addEventListener("message", (message) => {
    console.log("dataChannel message " + JSON.stringify(message));
  });

  PC.addEventListener("icecandidate", (event) => {
    // When you find a null candidate then there are no more candidates.
    // Gathering of candidates has finished.
    if (!event.candidate) {
      return;
    }

    const dbRef = ref(DB);


    if (localCandidate) {
      get(child(dbRef, "calls/" + hostId + "/" + "offerCandidate"))
        .then((snapshot) => {
          if (snapshot.exists()) {
            // console.log(snapshot.val());
          } else {
            const offerCandidate = ref(
              DB,
              "calls/" + hostId + "/" + "offerCandidate/"
            );
            set(offerCandidate, {
              candidate: event.candidate,
            });
          }
        })
        .catch((error) => {
          console.error(error);
        });
      localCandidate = false;
    }

    if (remoteCandidate) {
      get(child(dbRef, "calls/" + roomId + "/" + "answerCandidate"))
        .then((snapshot) => {
          if (snapshot.exists()) {
            // console.log(snapshot.val());
          } else {
            const answerCandidate = ref(
              DB,
              "calls/" + roomId + "/" + "answerCandidate/"
            );
            set(answerCandidate, {
              candidate: event.candidate,
            });
          }
        })
        .catch((error) => {
          console.error(error);
        });
      remoteCandidate = false;
    }

    // console.log("canditate: " + JSON.stringify(event));
  });

  //Add remote stream to the video obj
  PC.addEventListener("track", (event) => {
    event.streams[0].getTracks().forEach((track) => {
      setRemoteStream([...remoteStream, track]);
    });
    console.log("track event");
  });

  //Listener for the answer and add it into remoteDesc
  onValue(ref(DB, "calls/" + uniqueId + "/" + "answer"), (snapshot) => {
    const data = snapshot.val();
    if (data !== null && uniqueId !== undefined) {
      const answerDescription = data.answer;
      sdpAnswers.current.push(data.answer.sdp);
      // console.log("sdpAnswerRef Len: " + sdpAnswers.current.length);
      let infiniteLoop;
      if (sdpAnswers.current.length >= 2) {
        infiniteLoop = sdpAnswers.current[
          sdpAnswers.current.length - 2
        ].includes(data.answer.sdp);
      }

      // console.log("sdp: " + JSON.stringify(sdpAnswers.current, null, 4));
      // console.log("loop: " + infiniteLoop);

      if (sdpAnswers.current.length >= 2) {
        // console.log("2 oldu");

        if (infiniteLoop === false) {
          // console.log("infinite yok girdi");

          if (!answerDataBoolean) {
            setAnswerData(answerDescription);
            setAnswerDataBoolean(true);
          }
        }
        if (infiniteLoop) {
          // console.log("infinite");

          sdpAnswers.current.pop();

          // console.log("sdpAnswerRef Len: " + sdpAnswers.current.length);
          // console.log(
          //   "sdp popped: " + JSON.stringify(sdpAnswers.current, null, 4)
          // );
        }
      } else {
        // console.log("1 oldu");

        if (!answerDataBoolean) {
          // console.log("1 oldu girdi");

          setAnswerData(answerDescription);
          setAnswerDataBoolean(true);
        }
      }
    }
  });

  if (answerDataBoolean) {
    const assignAnswerDataFunc = async () => {
      PC = pConn;
      await PC.setLocalDescription(pConn.localDescription);
      await PC.setRemoteDescription(answerData);
      // console.log("pc after: " + JSON.stringify(PC));
      setAnswerDataBoolean(false);
      setPConn(PC);
    };
    assignAnswerDataFunc();
  }

  //Listener for the answerCandidate and add it into ICE Candidate
  onValue(
    ref(DB, "calls/" + uniqueId + "/" + "answerCandidate"),
    (snapshot) => {
      const data = snapshot.val();
      if (data !== null && uniqueId !== undefined) {
        // console.log("type: "+typeof data)
        // console.log("type candidate: "+typeof data?.candidate)
        // console.log("data: "+JSON.stringify(data.candidate.candidate))

        answerCandidates.current.push(data);

        let infiniteLoop;
        if (answerCandidates.current.length >= 2) {
          infiniteLoop = answerCandidates.current[
            answerCandidates.current.length - 2
          ].candidate.candidate.includes(data.candidate.candidate);
        }

        // console.log("answerCandidates: " + JSON.stringify(answerCandidates.current, null, 4));
        // console.log("loop: " + infiniteLoop);

        if (answerCandidates.current.length >= 2) {
          // console.log("2 oldu");

          if (infiniteLoop === false) {
            // console.log("infinite yok girdi");

            if (!answerCandidateDataBoolean) {
              setAnswerCandidateData([...answerCandidateData, data]);
              setAnswerCandidateDataBoolean(true);
            }
          }
          if (infiniteLoop) {
            // console.log("infinite");

            answerCandidates.current.pop();

            // console.log("answerCandidates Len: " + answerCandidates.current.length);
            // console.log(
            //   "answerCandidates popped: " +
            //     JSON.stringify(answerCandidates.current, null, 4)
            // );
          }
        } else {
          // console.log("1 oldu");

          if (!answerCandidateDataBoolean) {
            // console.log("1 oldu girdi");
            setAnswerCandidateData([...answerCandidateData, data]);
            setAnswerCandidateDataBoolean(true);
          }
        }
      }
    }
  );

  if (answerCandidateDataBoolean) {
    const assignAnswerCandidateFunc = async () => {
      PC = pConn;
      // console.log("RTC Local Candidate Before: " + JSON.stringify(PC));

      // console.log("offer type: "+typeof answerCandidateData)
      // console.log("inside offer: "+JSON.stringify(answerCandidateData))

      answerCandidateData.forEach(async (candidateObj) => {
        // console.log("obj: " + JSON.stringify(candidateObj));

        await PC.addIceCandidate(candidateObj.candidate);

        // console.log("eklendi");
        // console.log("RTC Local Candidate After: " + JSON.stringify(PC));
      });
      setPConn(PC);
      // console.log("pc local: " + JSON.stringify(PC));
      setAnswerCandidateDataBoolean(false);
    };
    assignAnswerCandidateFunc();
    // console.log("pc local again: " + JSON.stringify(PC));
  }

  //Listener for the offerCandidate and add it into ICE Candidate
  onValue(
    ref(DB, "calls/" + uniqueHostId + "/" + "offerCandidate"),
    (snapshot) => {
      const data = snapshot.val();
      if (data !== null && uniqueHostId !== undefined) {
        // console.log("type: "+typeof data)
        // console.log("type candidate: "+typeof data?.candidate)
        // console.log("data: "+JSON.stringify(data.candidate.candidate))

        offerCandidates.current.push(data);

        let infiniteLoop;
        if (offerCandidates.current.length >= 2) {
          infiniteLoop = offerCandidates.current[
            offerCandidates.current.length - 2
          ].candidate.candidate.includes(data.candidate.candidate);
        }

        // console.log("offerCandidates: " + JSON.stringify(offerCandidates.current, null, 4));
        // console.log("loop: " + infiniteLoop);

        if (offerCandidates.current.length >= 2) {
          // console.log("2 oldu");

          if (infiniteLoop === false) {
            // console.log("infinite yok girdi");

            if (!offerCandidateDataBoolean) {
              setOfferCandidateData([...offerCandidateData, data]);
              setOfferCandidateDataBoolean(true);
            }
          }
          if (infiniteLoop) {
            // console.log("infinite");
            offerCandidates.current.pop();

            // console.log("offerCandidates Len: " + offerCandidates.current.length);
            // console.log(
            //   "offerCandidates popped: " +
            //     JSON.stringify(offerCandidates.current, null, 4)
            // );
          }
        } else {
          // console.log("1 oldu");

          if (!offerCandidateDataBoolean) {
            // console.log("1 oldu girdi");
            setOfferCandidateData([...offerCandidateData, data]);
            setOfferCandidateDataBoolean(true);
          }
        }
      }
    }
  );

  if (offerCandidateDataBoolean) {
    const assignOfferCandidateFunc = async () => {
      PC = pConn;
      // console.log("offer type: "+typeof offerCandidateData)
      // console.log("inside offer: "+JSON.stringify(offerCandidateData))

      offerCandidateData.forEach(async (candidateObj) => {
        // console.log("obj: " + JSON.stringify(candidateObj));

        await PC.addIceCandidate(candidateObj.candidate);
      });

      setPConn(PC);
      console.log("pc remote: " + JSON.stringify(PC));
      setOfferCandidateDataBoolean(false);
    };
    assignOfferCandidateFunc();
    console.log("pc remote again: " + JSON.stringify(PC));
  }

  // Initiate the offer and  localDesc then add it to the db
  const startCall = async () => {
    console.log("girdi");
    localCandidate = true;
    const offerDescription = await PC.createOffer();
    await PC.setLocalDescription(offerDescription);

    pConn.localDescription = offerDescription;
    pConn._peerConnectionId = PC._peerConnectionId;
    for (let i = 0; i < pConn._transceivers.length; i++) {
      pConn._transceivers[i].transceiver._peerConnectionId =
        PC._peerConnectionId;
      pConn._transceivers[i].transceiver._sender._peerConnectionId =
        PC._peerConnectionId;
      pConn._transceivers[i].transceiver._receiver._peerConnectionId =
        PC._peerConnectionId;
      pConn._transceivers[i].transceiver._receiver._track._peerConnectionId =
        PC._peerConnectionId;
    }
    PC._transceivers = pConn._transceivers;
    setPConn(PC);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    hostId = uuid.v4();
    setUniqueId(hostId);

    const SdpOffer = ref(DB, "calls/" + hostId + "/" + "offer");
    await set(SdpOffer, {
      offer: offer,
    });

    console.log("PC IN THE CALL: " + JSON.stringify(PC));
    // console.log("start PC: " + JSON.stringify(PC));
  };

  // Join the remote call
  const joinCall = async () => {
    // Get the offer from db and answer it
    const dbRef = ref(DB);
    let snapshot = await get(child(dbRef, "calls/" + roomId));
    if (snapshot !== null) {
      const data = snapshot.val();
      remoteCandidate = true;
      const offerDescription = data.offer?.offer;
      await PC.setRemoteDescription(offerDescription);

      const answerDescription = await PC.createAnswer();
      await PC.setLocalDescription(answerDescription);

      pConn.localDescription = answerDescription;
      pConn.remoteDescription = offerDescription;
      pConn._peerConnectionId = PC._peerConnectionId;
      for (let i = 0; i < pConn._transceivers.length; i++) {
        pConn._transceivers[i].transceiver._peerConnectionId =
          PC._peerConnectionId;
        pConn._transceivers[i].transceiver._sender._peerConnectionId =
          PC._peerConnectionId;
        pConn._transceivers[i].transceiver._receiver._peerConnectionId =
          PC._peerConnectionId;
        pConn._transceivers[i].transceiver._receiver._track._peerConnectionId =
          PC._peerConnectionId;
      }
      PC._transceivers = pConn._transceivers;
      setPConn(PC);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      };

      const SdpAnswer = ref(DB, "calls/" + roomId + "/" + "answer");
      await set(SdpAnswer, {
        answer: answer,
      });
    }

    setUniqueHostId(roomId);

    //setJoin(true);
    console.log("PC Remote IN THE CALL: " + JSON.stringify(PC));
  };

  const sendMessage = () => {};

  // Close
  const closeStreams = () => {
    setLocalStream();
    setRemoteStream();
    setJoin(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.chatButton}>
        {!localStream && (
          <View style={styles.buttonItem}>
            <Button title="Click to start stream" onPress={startLocalStream} />
          </View>
        )}
        {!join && localStream && (
          <View style={styles.buttonItem}>
            <Button
              title="Click to start call"
              onPress={startCall}
              disabled={remoteStream}
            />
          </View>
        )}
        {!join && localStream && (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.roomWrapper}
          >
            <TextInput
              style={styles.roomInput}
              placeholder={"Room Id"}
              onChangeText={(text) => setRoomId(text)}
              value={roomId}
            />
            <TouchableOpacity onPress={() => joinCall()}>
              <View>
                <Text style={styles.roomWrapperButton}>Join Call</Text>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        )}
        {localStream && remoteStream && (
          <View style={styles.buttonItem}>
            <Button
              title="Click to stop call"
              onPress={closeStreams}
              disabled={!remoteStream}
            />
          </View>
        )}
      </View>

      <View style={styles.rtcView}>
        {localStream && (
          <RTCView
            style={styles.rtc}
            streamURL={localStream.toURL()}
            mirror={true}
          />
        )}
      </View>
      <View style={styles.rtcView}>
        {remoteStream && (
          <RTCView
            style={styles.rtc}
            streamURL={remoteStream.toURL()}
            mirror={true}
          />
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        ref={scrollViewRef}
        onContentSizeChange={() =>
          scrollViewRef.current.scrollToEnd({ animated: true })
        }
      >
        <View style={styles.chatBox}>
          <Text style={[styles.chatItems, styles.chatItemsSender]}>Deneme</Text>
          <Text style={[styles.chatItems, styles.chatItemsReceiver]}>
            Deneme
          </Text>
          <Text style={[styles.chatItems]}> Deneme </Text>
          <Text style={[styles.chatItems]}> Deneme </Text>
          <Text style={[styles.chatItems]}> Deneme </Text>
          <Text style={[styles.chatItems]}> Deneme </Text>
          <Text style={[styles.chatItems]}> Deneme </Text>
          <Text style={[styles.chatItems]}> Deneme </Text>
          <Text style={[styles.chatItems]}> Deneme </Text>
          <Text style={[styles.chatItems]}> Deneme </Text>
          <Text style={[styles.chatItems]}> Deneme2 </Text>
        </View>
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.messageWrapper}
      >
        <TextInput
          style={styles.messageInput}
          placeholder={"Message"}
          onChangeText={(text) => setMyMessage(text)}
          value={myMessage}
        />
        <TouchableOpacity onPress={() => sendMessage()}>
          <View style={styles.messageWrapperButton}>
            <Text>+</Text>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "black",
    justifyContent: "space-between",
    alignItems: "center",
    height: "100%",
  },
  chatButton: {
    margin: 5,
    padding: 5,
    justifyContent: "space-evenly",
    display: "flex",
    flexDirection: "row",
  },
  buttonItem: {
    margin: 10,
  },
  text: {
    fontSize: 30,
  },
  rtcView: {
    justifyContent: "center",
    alignItems: "center",
    height: "30%",
    width: "80%",
    backgroundColor: "black",
  },
  rtc: {
    width: "80%",
    height: "100%",
  },
  scrollView: {
    position: "relative",
    backgroundColor: "black",
    marginHorizontal: 10,
    width: "100%",
    padding: 10,
    margin: 10,
    bottom: 55,
  },
  chatBox: {
    position: "relative",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    display: "flex",
    flexDirection: "column",
  },
  chatItems: {
    borderRadius: 50,
    margin: 5,
    padding: 5,
    color: "white",
    flex: 1,
  },
  chatItemsSender: {
    position: "absolute",
    right: 0,
    backgroundColor: "red",
  },
  chatItemsReceiver: {
    position: "absolute",
    left: 0,
    backgroundColor: "blue",
  },
  roomInput: {
    paddingVertical: 2,
    paddingHorizontal: 5,
    backgroundColor: "#FFF",
    width: 150,
    borderColor: "#C0C0C0",
    borderWidth: 1,
  },
  messageInput: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: "#FFF",
    borderRadius: 60,
    width: 300,
    borderColor: "#C0C0C0",
    borderWidth: 1,
  },
  roomWrapperButton: {
    width: 60,
    height: 35,
    paddingVertical: 6,
    paddingHorizontal: 3,
    backgroundColor: "#2196F3",
    color: "white",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  messageWrapperButton: {
    width: 60,
    height: 30,
    backgroundColor: "white",
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C0C0C0",
  },
  roomWrapper: {
    width: "50%",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  messageWrapper: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#f2f0f0",
  },
});
