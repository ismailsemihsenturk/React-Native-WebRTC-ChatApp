import React, { useState, useEffect, useMemo } from "react";
import {
  Button,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
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


import uuid from 'react-native-uuid';

import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";
import {
  API_KEY,
  AUTH_DOMAIN,
  PROJECT_ID,
  STORAGE_BUCKET,
  MESSAGING_SENDER_ID,
  APP_ID
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
const DB = getDatabase();

export default function App() {
  const [localStream, setLocalStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  let uniqueId;

  const configuration = {
    iceServers: [
      {
        url: "stun:stun.l.google.com:19302",
      },
    ],
  };
  const PC = useMemo(
    () => new RTCPeerConnection(configuration),
    [configuration]
  );
  const dataChannel = useMemo(() => PC.createDataChannel("chat_channel"), [PC]);

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

  PC.addEventListener("icecandidate", (event) => {
    // When you find a null candidate then there are no more candidates.
    // Gathering of candidates has finished.
    if (!event.candidate) {
      return;
    }

    const offerCandidate = ref(DB, "calls/" + uniqueId + "/" + "offerCandidate");
    set(offerCandidate, {
      candidate: event.candidate,
    });
    // Send the event.candidate onto the person you're calling.
    // Keeping to Trickle ICE Standards, you should send the candidates immediately.
    console.log("event canditate: " + JSON.stringify(event));
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
    let datachannel = event.channel;
    console.log("datachannel " + datachannel);
    // Now you've got the datachannel.
    // You can hookup and use the same events as above ^
  });

  PC.addEventListener("track", (event) => {
    event.streams[0].getTracks().forEach((track) => {
      setRemoteStream([...remoteStream, track]);
    });
    console.log("track event");
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

  const startCall = async () => {

    const offerDescription = await PC.createOffer();

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    uniqueId = uuid.v4();

    const SdpOffer = ref(DB, "calls/" + uniqueId);
    set(SdpOffer, {
      offer: offer,
    });

    await PC.setLocalDescription(offerDescription);
  };

  const closeStreams = () => {
    setLocalStream();
    setRemoteStream();
  };

  return (
    <SafeAreaView style={styles.container}>
      {!localStream && (
        <Button title="Click to start stream" onPress={startLocalStream} />
      )}
      {localStream && (
        <Button
          title="Click to start call"
          onPress={startCall}
          disabled={remoteStream}
        />
      )}

      <View style={styles.rtcview}>
        {localStream && (
          <RTCView
            style={styles.rtc}
            streamURL={localStream.toURL()}
            mirror={true}
          />
        )}
      </View>
      <View style={styles.rtcview}>
        {remoteStream && (
          <RTCView
            style={styles.rtc}
            streamURL={remoteStream.toURL()}
            mirror={true}
          />
        )}
      </View>
      <Button
        title="Click to stop call"
        onPress={closeStreams}
        disabled={!remoteStream}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#313131",
    justifyContent: "space-between",
    alignItems: "center",
    height: "100%",
  },
  text: {
    fontSize: 30,
  },
  rtcview: {
    justifyContent: "center",
    alignItems: "center",
    height: "40%",
    width: "80%",
    backgroundColor: "black",
  },
  rtc: {
    width: "80%",
    height: "100%",
  },
});
