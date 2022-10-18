# REACT NATIVE WEBRTC CHAT APP # 
## Codes are not complete. ##

* [Download](https://github.com/jitsi/webrtc/releases/download/v106.0.0/android-webrtc.zip) this package to be able to use WebRTC on Android <br/>
  * Place these files into `\node_modules\react-native-webrtc\android\libs`
  * Go to your `\android\app\src\main\AndroidManifest.xml`android manifest and give user-permissions: <br/> `uses-permission android:name="android.permission.CAMERA"` etc...
  * Go to your android/graddle.properties and `android.enableDexingArtifactTransform.desugaring=false`
  * Add plugins in `app.json`: <br/> `"plugins": [
      [
        "@config-plugins/react-native-webrtc",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera",
          "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone"
        }
      ],
      [
        "expo-media-library",
        {
          "photosPermission": "Allow $(PRODUCT_NAME) to access your photos.",
          "savePhotosPermission": "Allow $(PRODUCT_NAME) to save photos.",
          "isAccessMediaLocationEnabled": true
        }
      ]
    ],`
  * If you face any problem with "cjs" files go to `node_modules/metro-config/src/defaults/defaults.js` and add "cjs" to your defaults.

