// src/FarmLocationScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Network from "expo-network";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapView, { Marker } from "react-native-maps";

import { auth, db } from "../database";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  border: "rgba(0,0,0,0.08)",
};

const LOCAL_KEY = "farm_location_v1";

export default function FarmLocationScreen() {
  const [location, setLocation] = useState(null); // { lat, lng, accuracy, savedAt }
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(false);

  // ----------------- UTILIDADES OFFLINE -----------------
  const checkNetwork = async () => {
    try {
      const status = await Network.getNetworkStateAsync();
      const connected = !!status.isConnected;
      setIsOnline(connected);
      return connected;
    } catch (e) {
      setIsOnline(false);
      return false;
    }
  };

  const loadFromCache = async () => {
    try {
      const raw = await AsyncStorage.getItem(LOCAL_KEY);
      if (raw) {
        setLocation(JSON.parse(raw));
      }
    } catch (e) {
      console.log("FarmLocation: error leyendo cache", e);
    }
  };

  const saveToCache = async (locObj) => {
    try {
      await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(locObj));
    } catch (e) {
      console.log("FarmLocation: error guardando cache", e);
    }
  };

  // ----------------- CARGA INICIAL -----------------
  useEffect(() => {
    (async () => {
      await loadFromCache(); // mostramos lo último guardado

      const online = await checkNetwork();
      if (!online) return;

      const user = auth.currentUser;
      if (!user) return;

      try {
        const ref = doc(db, "farmLocations", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const locObj = {
            lat: data.lat,
            lng: data.lng,
            accuracy: data.accuracy ?? null,
            savedAt: data.savedAt?.toDate
              ? data.savedAt.toDate().toISOString()
              : data.savedAt || null,
          };
          setLocation(locObj);
          await saveToCache(locObj);
        }
      } catch (e) {
        console.log("FarmLocation: error leyendo Firestore", e);
      }
    })();
  }, []);

  // ----------------- OBTENER COORDENADAS -----------------
  const requestAndSaveLocation = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Sesión", "Debes iniciar sesión para guardar la ubicación.");
      return;
    }

    try {
      setLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permiso denegado",
          "No se otorgó permiso para acceder a la ubicación."
        );
        setLoading(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locObj = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null, // metros
        savedAt: new Date().toISOString(),
      };

      setLocation(locObj);
      await saveToCache(locObj);

      const online = await checkNetwork();
      if (online) {
        const ref = doc(db, "farmLocations", user.uid);
        await setDoc(
          ref,
          {
            lat: locObj.lat,
            lng: locObj.lng,
            accuracy: locObj.accuracy,
            savedAt: serverTimestamp(),
            updatedBy: user.uid,
          },
          { merge: true }
        );
        Alert.alert("Guardado", "Coordenadas GPS almacenadas correctamente.");
      } else {
        Alert.alert(
          "Guardado offline",
          "Las coordenadas se guardaron solo en el dispositivo. Cuando haya internet se pueden subir manualmente."
        );
      }
    } catch (e) {
      console.log("FarmLocation: error obteniendo GPS", e);
      Alert.alert("Error", "No se pudo obtener la ubicación.");
    } finally {
      setLoading(false);
    }
  };

  // ----------------- RENDER -----------------
  const hasLocation = !!location && typeof location.lat === "number";

  const accuracyText =
    location?.accuracy != null
      ? `${location.accuracy.toFixed(1)} m`
      : "No disponible";

  const savedAtText = location?.savedAt
    ? new Date(location.savedAt).toLocaleString("es-NI")
    : "Aún no se ha guardado ubicación.";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Geolocalización de granja</Text>
        <Text style={styles.headerSubtitle}>
          Guarda las coordenadas GPS de la granja y visualízalas en un mapa.
        </Text>
        <Text style={styles.statusText}>
          Estado de conexión:{" "}
          <Text style={{ fontWeight: "700" }}>
            {isOnline ? "En línea" : "Offline"}
          </Text>
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Bloque de coordenadas */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Coordenadas GPS</Text>
          {hasLocation ? (
            <>
              <Text style={styles.textRow}>
                Latitud:{" "}
                <Text style={styles.textValue}>
                  {location.lat.toFixed(6)}
                </Text>
              </Text>
              <Text style={styles.textRow}>
                Longitud:{" "}
                <Text style={styles.textValue}>
                  {location.lng.toFixed(6)}
                </Text>
              </Text>
              <Text style={styles.textRow}>
                Precisión: <Text style={styles.textValue}>{accuracyText}</Text>
              </Text>
              <Text style={styles.textRow}>
                Última actualización:{" "}
                <Text style={styles.textValue}>{savedAtText}</Text>
              </Text>
            </>
          ) : (
            <Text style={styles.emptyText}>
              Aún no se han guardado coordenadas. Presiona el botón para
              capturar la ubicación actual de la granja.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
            onPress={requestAndSaveLocation}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="crosshairs-gps"
                  size={20}
                  color={Colors.white}
                />
                <Text style={styles.btnPrimaryText}>
                  Obtener ubicación actual
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Bloque de mapa */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mapa de ubicación</Text>
          <Text style={styles.helperText}>
            Vista aproximada de la granja según las coordenadas GPS
            almacenadas. El mapa requiere conexión a internet.
          </Text>

          {hasLocation ? (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: location.lat,
                  longitude: location.lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                region={{
                  latitude: location.lat,
                  longitude: location.lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: location.lat,
                    longitude: location.lng,
                  }}
                  title="Granja"
                  description={`Precisión ~ ${accuracyText}`}
                />
              </MapView>
              {!isOnline && (
                <Text style={styles.mapWarning}>
                  El mapa puede no cargar completamente porque estás sin
                  conexión. Las coordenadas sí quedan guardadas.
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              Primero guarda las coordenadas GPS para ver la granja en el mapa.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ------------------------- ESTILOS -------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.beige,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: Colors.white,
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.green,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 4,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 6,
  },
  textRow: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 2,
  },
  textValue: {
    color: Colors.text,
    fontWeight: "700",
  },
  helperText: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 4,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  btnPrimary: {
    backgroundColor: Colors.green,
  },
  btnPrimaryText: {
    color: Colors.white,
    fontWeight: "700",
    marginLeft: 6,
    fontSize: 14,
  },
  mapContainer: {
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  map: {
    width: "100%",
    height: 220,
  },
  mapWarning: {
    padding: 6,
    fontSize: 11,
    color: "#b45309",
    backgroundColor: "#fffbeb",
  },
});
