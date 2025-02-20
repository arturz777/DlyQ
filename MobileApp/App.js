import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CourierScreen from "./src/screens/CourierScreen";
import LoginScreen from "./src/screens/LoginScreen";
import { View, ActivityIndicator } from "react-native";

const Stack = createNativeStackNavigator();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem("token");
      setIsAuthenticated(!!token);
    };
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={isAuthenticated ? "Courier" : "Login"}>
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Вход" }} />
        <Stack.Screen name="Courier" component={CourierScreen} options={{ title: "Курьер" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

