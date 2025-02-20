import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { login } from "../api/authAPI"; // ❌ Убрали `setAuthToken`, если его нет

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Ошибка", "Введите email и пароль");
      return;
    }

	setLoading(true);
	try {
	  const response = await login(email, password);
	  await AsyncStorage.setItem("token", response.token);
	  Alert.alert("Успешно!", "Вы вошли в систему");
  
	  // ✅ Используем `navigation.navigate` вместо `reset`
	  navigation.navigate("Courier"); 
	} catch (error) {
	  Alert.alert("Ошибка", "Неверные данные");
	} finally {
	  setLoading(false);
	}
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Вход</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title={loading ? "Вход..." : "Войти"} onPress={handleLogin} disabled={loading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
});

export default LoginScreen;
