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
  const [roomId, setRoomId] = useState();
  const [uniqueId, setUniqueId] = useState();
  const [join, setJoin] = useState(false);
  const [pConn,setPConn] = useState();
  const [rpConn,setRPConn] = useState();
  const scrollViewRef = useRef(ScrollView);

  const [answerData, setAnswerData] = useState();
  const [answerDataBoolean, setAnswerDataBoolean] = useState(false);
  const sdpAnswers = useRef([]);




  let hostId;


 
  
  const configuration = {
    iceServers: [
      {
        url: "stun:stun.l.google.com:19302",
      },
    ],
  };
  
  let PC = new RTCPeerConnection(configuration);
  // Set new peerConn for the remote
  let PCRemote = new RTCPeerConnection(configuration);

  const dataChannel = PC.createDataChannel("chat_channel");





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
        PC.addTrack(track, newStream._tracks);
      });
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
    console.log("datachannel " + event);
    // Now you've got the datachannel.
    // You can hookup and use the same events as above ^
  });

  dataChannel.addEventListener("open", (event) => {
    console.log("dataChannel is open " + JSON.stringify(event));
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

    get(child(dbRef, "calls/" + hostId + "/" + "offerCandidate"))
      .then((snapshot) => {
        if (snapshot.exists()) {
          console.log(snapshot.val());
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

    console.log("canditate: " + JSON.stringify(event));
  });


  //ICECandidate listener for remote
  PCRemote.addEventListener("icecandidate", (event) => {

    if (!event.candidate) {
      return;
    }

    const dbRef = ref(DB);
  
    get(child(dbRef, "calls/" + roomId + "/" + "answerCandidate"))
      .then((snapshot) => {
        if (snapshot.exists()) {
          console.log(snapshot.val());
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
      console.log("remote canditate: " + JSON.stringify(event));
  });


  //Add remote stream to the video obj
  PC.addEventListener("track", (event) => {
    event.streams[0].getTracks().forEach((track) => {
      setRemoteStream([...remoteStream, track]);
    });
    console.log("track event");
  });

   //Add remote stream to the video obj
   PCRemote.addEventListener("track", (event) => {
    event.streams[0].getTracks().forEach((track) => {
      setRemoteStream([...remoteStream, track]);
    });
    console.log("track event - REMOTE");
  });





  // Initiate the offer and  localDesc then add it to the db
  const startCall = async () => {
    const offerDescription = await PC.createOffer();
    await PC.setLocalDescription(offerDescription);

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

   
    setPConn(PC);
    console.log("start PC: "+JSON.stringify(PC))
  };

  
  //Listen for the answer and add it into remoteDesc
  onValue(ref(DB, "calls/" + uniqueId + "/"+ "answer"), (snapshot) => {
    const data = snapshot.val();
    if (data !== null && uniqueId !== undefined) {

      const answerDescription = data.answer;
      sdpAnswers.current.push(data.answer);

      console.log("sdpAnswerRef Len: "+sdpAnswers.current.length)

     let infiniteLoop = sdpAnswers.current.includes(data.answer);

      if(sdpAnswers.current.length >= 2){
        console.log("2 oldu")
        if(infiniteLoop === false){
          console.log("infinite yok girdi")
          if(!answerDataBoolean){
            setAnswerData(answerDescription)
            setAnswerDataBoolean(true)
          }
        }
        if(infiniteLoop){
          console.log("infinite");
          sdpAnswers.current.pop();
        }
      }
      else{
        console.log("1 oldu")
        if(!answerDataBoolean){
          console.log("1 oldu girdi")
          setAnswerData(answerDescription)
          setAnswerDataBoolean(true)
        }
      }
    }
  });


  if(answerDataBoolean){
    console.log("oldu: "+ JSON.stringify(answerData))
    console.log("local: "+ JSON.stringify(pConn))

    // set PC == pConn
    PC.setRemoteDescription(answerData);
    setAnswerDataBoolean(false)
  }


  //APPLY SAME LOGIC
  //Listen for the answerCandidate and add it into ICE Candidate
  // onValue(
  //   ref(DB, "calls/" + uniqueId + "/" + "answerCandidate"),
  //   (snapshot) => {
  //     if(snapshot.val() !== null){
  //       snapshot?.forEach((candidateObj) => {
  //         const newCandidate = new RTCIceCandidate(candidateObj);
  //         PC.addIceCandidate(new RTCIceCandidate(newCandidate));
  //         console.log("RTC Candidate: " + JSON.stringify(newCandidate));
  //       });
  //     }
     
  //   }
  // );

  //Listen for the offerCandidate and add it into ICE Candidate
  onValue(ref(DB, "calls/" + roomId + "/" + "offerCandidate"), (snapshot) => {
    if(join){
      snapshot?.forEach((candidateObj) => {
        const newCandidate = new RTCIceCandidate(candidateObj);
        PCRemote.addIceCandidate(new RTCIceCandidate(newCandidate));
        console.log("RTC Remote Candidate: " + JSON.stringify(newCandidate));
      });
    }
  });

 

  // Join the remote call
  const joinCall = async () => {
   
    // Get the offer from db and answer it
    const dbRef = ref(DB);
    let snapshot = await get(child(dbRef, "calls/" + roomId));
    if (snapshot !== null) {
      const data = snapshot.val();
      const offerDesc = data.offer?.offer;
      await PCRemote.setRemoteDescription(offerDesc);

      const answerDescription = await PCRemote.createAnswer();
      await PCRemote.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      };

      const SdpAnswer = ref(DB, "calls/" + roomId + "/" + "answer");
      await set(SdpAnswer, {
        answer: answer,
      });
    }

    setRPConn(PCRemote);
    setJoin(true);

  };


  const sendMessage = () => {
   
  };

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
