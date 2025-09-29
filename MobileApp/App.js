import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import CourierScreen from './src/screens/CourierScreen';
import {checkAuth} from './src/api/authAPI';

const Stack = createNativeStackNavigator();

export default function App() {
  const [booted, setBooted] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Login');

  useEffect(() => {
    (async () => {
      try {
        await checkAuth();
        setInitialRoute('Courier');
      } catch {
        setInitialRoute('Login');
      } finally {
        setBooted(true);
      }
    })();
  }, []);

  if (!booted) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{headerShown: false}}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Courier" component={CourierScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
