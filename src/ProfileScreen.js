// src/ProfileScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
  Image,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "../database";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const Colors = {
  green: "#1E5B3F",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#F1E9D6",
  border: "rgba(0,0,0,0.12)",
};

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [producerData, setProducerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        setUser(currentUser);
        
        // Cargar datos del productor desde Firestore
        const producerDoc = await getDoc(doc(db, "producers", currentUser.uid));
        if (producerDoc.exists()) {
          setProducerData(producerDoc.data());
        }
      }
    } catch (error) {
      console.error("Error cargando datos del usuario:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Cerrar sesión",
      "¿Estás seguro de que quieres cerrar sesión?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cerrar sesión",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(auth);
              navigation.reset({ index: 0, routes: [{ name: "Login" }] });
            } catch (error) {
              console.error("Error al cerrar sesión:", error);
              Alert.alert("Error", "No se pudo cerrar sesión");
            }
          },
        },
      ]
    );
  };

  const formatDate = (date) => {
    if (!date) return "No disponible";
    return new Date(date.seconds * 1000).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.beige }}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.green} />
        <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ color: Colors.muted }}>Cargando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.beige }}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.green} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <MaterialCommunityIcons name="logout" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Avatar y info básica */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <MaterialCommunityIcons name="account" size={80} color={Colors.green} />
          </View>
          <Text style={styles.userName}>
            {producerData?.name || user?.email || "Usuario"}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Información del productor */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Información del Productor</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="account" size={20} color={Colors.green} />
              <Text style={styles.infoLabel}>Nombre completo:</Text>
            </View>
            <Text style={styles.infoValue}>
              {producerData?.name || "No disponible"}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="phone" size={20} color={Colors.green} />
              <Text style={styles.infoLabel}>Teléfono:</Text>
            </View>
            <Text style={styles.infoValue}>
              {producerData?.phone || "No disponible"}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="home" size={20} color={Colors.green} />
              <Text style={styles.infoLabel}>Número de granja:</Text>
            </View>
            <Text style={styles.infoValue}>
              {producerData?.farmNumber || "No disponible"}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="pig" size={20} color={Colors.green} />
              <Text style={styles.infoLabel}>Cerdos actuales:</Text>
            </View>
            <Text style={styles.infoValue}>
              {producerData?.herdSize || 0} cerdos
            </Text>
          </View>
        </View>

        {/* Información de la cuenta */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Información de la Cuenta</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="email" size={20} color={Colors.green} />
              <Text style={styles.infoLabel}>Correo electrónico:</Text>
            </View>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="calendar" size={20} color={Colors.green} />
              <Text style={styles.infoLabel}>Cuenta creada:</Text>
            </View>
            <Text style={styles.infoValue}>
              {formatDate(producerData?.createdAt)}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="shield-check" size={20} color={Colors.green} />
              <Text style={styles.infoLabel}>Estado de verificación:</Text>
            </View>
            <Text style={[styles.infoValue, { color: user?.emailVerified ? Colors.green : Colors.muted }]}>
              {user?.emailVerified ? "Verificado" : "No verificado"}
            </Text>
          </View>
        </View>

        {/* Botones de acción */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert("Próximamente", "Función de editar perfil")}>
            <MaterialCommunityIcons name="pencil" size={20} color={Colors.white} />
            <Text style={styles.actionBtnText}>Editar Perfil</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.secondaryActionBtn]} onPress={() => Alert.alert("Próximamente", "Función de configuración")}>
            <MaterialCommunityIcons name="cog" size={20} color={Colors.green} />
            <Text style={[styles.actionBtnText, { color: Colors.green }]}>Configuración</Text>
          </TouchableOpacity>
        </View>

        {/* Espacio para el tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, paddingBottom: 100 },
  
  header: {
    backgroundColor: Colors.green,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: "800",
  },
  logoutBtn: {
    padding: 8,
  },

  content: { flex: 1, padding: 16 },

  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 4,
    borderColor: Colors.green,
  },
  userName: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: Colors.muted,
    fontWeight: "600",
  },

  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 16,
  },

  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.muted,
    marginLeft: 8,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },

  actionsSection: {
    gap: 12,
  },
  actionBtn: {
    backgroundColor: Colors.green,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionBtn: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.green,
  },
  actionBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "800",
    marginLeft: 8,
  },
});
