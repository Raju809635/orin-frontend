import { Alert, Platform, ToastAndroid } from "react-native";

export function notify(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }

  Alert.alert("ORIN", message);
}
