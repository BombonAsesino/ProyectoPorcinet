// src/PantallaGestionUsuarios.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db, realtimeDb } from "../database";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

// 🔹 RTDB helpers
import { ref as rRef, set as rSet, update as rUpdate } from "firebase/database";

const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  card: "#F1E9D6",
  border: "rgba(0,0,0,0.08)",
  danger: "#b42318",
};

const EMPTY_PERMS = {
  reproduccion: true,
  costos: false,
  analytics: true,
  cerdas: true,
  respaldo: true,
};

// 🔸 traduce el objeto de booleanos a etiquetas que HomeApp entiende
const permsToModules = (p = {}) => {
  const out = [];
  if (p.reproduccion) out.push("reproduccion");
  if (p.costos) out.push("costos");
  if (p.analytics) out.push("analytics");
  if (p.cerdas) out.push("cerdas");
  if (p.respaldo) out.push("respaldo");
  return out;
};

export default function PantallaGestionUsuarios() {
  const owner = auth.currentUser;
  const [loading, setLoading] = useState(true);
  const [subcuentas, setSubcuentas] = useState([]);

  // ====== Crear subcuenta ======
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [nombre, setNombre] = useState("");
  const [perms, setPerms] = useState(EMPTY_PERMS);

  // ====== Editar permisos ======
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editPerms, setEditPerms] = useState(EMPTY_PERMS);

  useEffect(() => {
    if (!owner?.uid) return;

    // Asegurar doc del dueño
    (async () => {
      const meRef = doc(db, "users", owner.uid);
      const snap = await getDoc(meRef);
      if (!snap.exists()) {
        await setDoc(meRef, {
          nombre: owner.displayName || owner.email || "Dueño",
          rol: "principal",
          ownerUid: owner.uid,
          permisos: {
            reproduccion: true,
            costos: true,
            analytics: true,
            cerdas: true,
            respaldo: true,
          },
          creadoEn: new Date().toISOString(),
        });
      }
    })();

    // Subscribirse a subcuentas del dueño
    const q = query(collection(db, "users"), where("ownerUid", "==", owner.uid));
    const off = onSnapshot(
      q,
      (snap) => {
        const arr = [];
        snap.forEach((d) => {
          const data = d.data() || {};
          if (data.rol !== "principal") {
            arr.push({ id: d.id, ...data });
          }
        });
        setSubcuentas(arr);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => off();
  }, [owner?.uid]);

  const togglePerm = (key, state, setter) => {
    setter((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ====== Crear sin cerrar la sesión del dueño (app secundaria) ======
  const crearSubcuenta = async () => {
    try {
      if (!owner) return Alert.alert("Sesión", "Debes iniciar sesión.");
      if (!email.trim() || !pwd.trim() || pwd.length < 6) {
        return Alert.alert("Datos", "Correo y contraseña (mínimo 6 caracteres) son obligatorios.");
      }
      if (!nombre.trim()) return Alert.alert("Datos", "El nombre es obligatorio.");

      // 1) App secundaria para no tocar auth del dueño
      const primary = getApp();
      const cfg = primary.options;
      const aux = getApps().find((a) => a.name === "subadmin") || initializeApp(cfg, "subadmin");
      const auxAuth = getAuth(aux);

      // 2) Crear usuario en app secundaria
      const cred = await createUserWithEmailAndPassword(auxAuth, email.trim(), pwd.trim());

      // 3) Guardar perfil en Firestore
      await setDoc(doc(db, "users", cred.user.uid), {
        email: email.trim().toLowerCase(),
        nombre: nombre.trim(),
        rol: "subcuenta",
        ownerUid: owner.uid,
        permisos: { ...perms },
        disabled: false,
        creadoEn: new Date().toISOString(),
      });

      // 4) 🔸 Guardar permisos también en RTDB (lo que usa HomeApp)
      await rSet(rRef(realtimeDb, `userPerms/${cred.user.uid}`), {
        modules: permsToModules(perms), // p.ej. ["costos"]
      });

      // 5) Cerrar sesión del app secundario
      try {
        await signOut(auxAuth);
      } catch {}

      Alert.alert("Listo", "Subcuenta creada correctamente.");
      setEmail("");
      setPwd("");
      setNombre("");
      setPerms(EMPTY_PERMS);
    } catch (e) {
      console.error("crearSubcuenta:", e);
      Alert.alert("Error", e?.message || "No se pudo crear la subcuenta.");
    }
  };

  // ====== Editar permisos ======
  const openEdit = (user) => {
    setEditTarget(user);
    setEditPerms(user.permisos || EMPTY_PERMS);
    setEditOpen(true);
  };

  const savePerms = async () => {
    try {
      if (!editTarget) return;

      // Firestore
      await updateDoc(doc(db, "users", editTarget.id), {
        permisos: { ...editPerms },
        actualizadoEn: new Date().toISOString(),
      });

      // 🔸 RTDB (lo que lee HomeApp)
      await rUpdate(rRef(realtimeDb, `userPerms/${editTarget.id}`), {
        modules: permsToModules(editPerms),
      });

      setEditOpen(false);
      setEditTarget(null);
      Alert.alert("Listo", "Permisos actualizados.");
    } catch (e) {
      console.error("savePerms:", e);
      Alert.alert("Error", "No se pudieron guardar los permisos.");
    }
  };

  const toggleDisabled = async (user) => {
    try {
      await updateDoc(doc(db, "users", user.id), {
        disabled: !user.disabled,
        actualizadoEn: new Date().toISOString(),
      });
    } catch (e) {
      console.error("toggleDisabled:", e);
      Alert.alert("Error", "No se pudo cambiar el estado.");
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.beige }}
      contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      showsVerticalScrollIndicator
    >
      <Text style={styles.title}>Gestión de usuarios</Text>

      {/* Crear nueva subcuenta */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Nueva subcuenta</Text>

        <Text style={styles.smallLabel}>Nombre</Text>
        <TextInput
          value={nombre}
          onChangeText={setNombre}
          placeholder="Nombre"
          style={styles.input}
        />

        <Text style={styles.smallLabel}>Correo</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="correo@dominio.com"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />

        <Text style={styles.smallLabel}>Contraseña temporal</Text>
        <TextInput
          value={pwd}
          onChangeText={setPwd}
          placeholder="mínimo 6 caracteres"
          secureTextEntry
          style={styles.input}
        />

        <Text style={[styles.smallLabel, { marginTop: 6 }]}>Permisos</Text>
        <View style={styles.permsRow}>
          <PermChip
            label="Reproducción"
            on={perms.reproduccion}
            onPress={() => togglePerm("reproduccion", perms, setPerms)}
          />
          <PermChip
            label="Costos"
            on={perms.costos}
            onPress={() => togglePerm("costos", perms, setPerms)}
          />
          <PermChip
            label="Dashboard"
            on={perms.analytics}
            onPress={() => togglePerm("analytics", perms, setPerms)}
          />
          <PermChip
            label="Cerdas"
            on={perms.cerdas}
            onPress={() => togglePerm("cerdas", perms, setPerms)}
          />
          <PermChip
            label="Respaldo"
            on={perms.respaldo}
            onPress={() => togglePerm("respaldo", perms, setPerms)}
          />
        </View>

        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={crearSubcuenta}>
          <MaterialCommunityIcons name="account-plus" size={18} color={Colors.white} />
          <Text style={styles.btnText}>Crear subcuenta</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de subcuentas */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Subcuentas</Text>

        {loading ? (
          <Text style={{ color: Colors.muted, fontWeight: "800" }}>Cargando…</Text>
        ) : subcuentas.length === 0 ? (
          <Text style={{ color: Colors.muted, fontWeight: "800" }}>
            Aún no has creado subcuentas.
          </Text>
        ) : (
          subcuentas.map((u) => (
            <View key={u.id} style={styles.userRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{u.nombre || u.email || u.id}</Text>
                <Text style={styles.userSub}>
                  {u.email || "—"} · {u.disabled ? "Desactivada" : "Activa"}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => openEdit(u)}
                accessibilityLabel="Editar permisos"
              >
                <MaterialCommunityIcons name="pencil" size={18} color={Colors.green} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => toggleDisabled(u)}
                accessibilityLabel="Activar/Desactivar"
              >
                <MaterialCommunityIcons
                  name={u.disabled ? "toggle-switch-off-outline" : "toggle-switch"}
                  size={20}
                  color={u.disabled ? Colors.muted : Colors.green}
                />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* Modal editar permisos */}
      <Modal visible={editOpen} animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <ScrollView
          style={{ flex: 1, backgroundColor: Colors.beige }}
          contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
        >
          <Text style={styles.title}>Permisos de {editTarget?.nombre || editTarget?.email}</Text>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Editar</Text>
            <View style={styles.permsRow}>
              <PermChip
                label="Reproducción"
                on={editPerms.reproduccion}
                onPress={() => togglePerm("reproduccion", editPerms, setEditPerms)}
              />
              <PermChip
                label="Costos"
                on={editPerms.costos}
                onPress={() => togglePerm("costos", editPerms, setEditPerms)}
              />
              <PermChip
                label="Dashboard"
                on={editPerms.analytics}
                onPress={() => togglePerm("analytics", editPerms, setEditPerms)}
              />
              <PermChip
                label="Cerdas"
                on={editPerms.cerdas}
                onPress={() => togglePerm("cerdas", editPerms, setEditPerms)}
              />
              <PermChip
                label="Respaldo"
                on={editPerms.respaldo}
                onPress={() => togglePerm("respaldo", editPerms, setEditPerms)}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setEditOpen(false)}>
                <Text style={[styles.btnText, { color: Colors.green }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={savePerms}>
                <MaterialCommunityIcons name="content-save" size={18} color={Colors.white} />
                <Text style={styles.btnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

/* ====== Subcomponentes ====== */
function PermChip({ label, on, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: on ? Colors.green : Colors.border, backgroundColor: on ? Colors.white : Colors.card },
      ]}
    >
      <Text style={[styles.chipText, { color: on ? Colors.green : Colors.muted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ====== Estilos ====== */
const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "900", color: Colors.text, marginBottom: 8 },
  panel: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginTop: 12,
    gap: 8,
  },
  panelTitle: { fontSize: 16, fontWeight: "900", color: Colors.text },
  smallLabel: { color: Colors.muted, fontWeight: "800", fontSize: 12 },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: "#D6D3C8",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontWeight: "800",
    color: Colors.text,
  },
  permsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  chipText: { fontWeight: "900" },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnPrimary: { backgroundColor: Colors.green, borderColor: Colors.green },
  btnGhost: { backgroundColor: Colors.white },
  btnText: { color: Colors.white, fontWeight: "900" },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  userName: { fontWeight: "900", color: Colors.text },
  userSub: { color: Colors.muted, fontWeight: "700" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
  },
});
