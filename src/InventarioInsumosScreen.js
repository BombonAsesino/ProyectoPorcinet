// src/InventarioInsumosScreen.js
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Network from "expo-network";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ⚠️ NUEVO: usar API legacy para evitar el error deprecado
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

// 👇 misma ruta que usas en HomeApp
import { auth, db } from "../database";

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";

/* 🔹 Claves para manejo offline */
const OFFLINE_QUEUE_KEY = "supplies_offline_queue_v1";
const SUPPLIES_CACHE_KEY = "supplies_local_cache_v1";

/* 🔹 Colores Porcinet */
const Colors = {
  green: "#843a3a",
  beige: "#FFF7EA",
  text: "#0f172a",
  white: "#FFFFFF",
  muted: "#6b7280",
  border: "rgba(0,0,0,0.08)",
};

const InventarioInsumosScreen = () => {
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [nota, setNota] = useState("");
  const [fechaCompra, setFechaCompra] = useState("");

  const [insumos, setInsumos] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null); // id/localId del insumo en edición

  /* ----------------------- UTILIDADES OFFLINE ----------------------- */

  const checkNetwork = async () => {
    try {
      const status = await Network.getNetworkStateAsync();
      const connected = !!status.isConnected;
      setIsOnline(connected);
      return connected;
    } catch (error) {
      console.log("Error al verificar red:", error);
      setIsOnline(false);
      return false;
    }
  };

  const loadFromCache = async () => {
    try {
      const cached = await AsyncStorage.getItem(SUPPLIES_CACHE_KEY);
      if (cached) {
        setInsumos(JSON.parse(cached));
      }
    } catch (error) {
      console.log("Error al cargar caché de insumos:", error);
    }
  };

  const saveToCache = async (data) => {
    try {
      await AsyncStorage.setItem(SUPPLIES_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.log("Error al guardar caché de insumos:", error);
    }
  };

  const addToOfflineQueue = async (operation) => {
    try {
      const current = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      const parsed = current ? JSON.parse(current) : [];
      parsed.push(operation);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(parsed));
    } catch (error) {
      console.log("Error al agregar operación offline:", error);
    }
  };

  const processOfflineQueue = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const isConnected = await checkNetwork();
    if (!isConnected) return;

    try {
      const current = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      const queue = current ? JSON.parse(current) : [];

      if (queue.length === 0) return;

      for (const op of queue) {
        if (op.type === "ADD") {
          await addDoc(collection(db, "inventory_supplies"), {
            ...op.payload,
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (op.type === "UPDATE") {
          if (op.payload.idFirebase) {
            const ref = doc(db, "inventory_supplies", op.payload.idFirebase);
            await updateDoc(ref, {
              ...op.payload.data,
              updatedAt: serverTimestamp(),
            });
          }
        } else if (op.type === "DELETE") {
          if (op.payload.idFirebase) {
            const ref = doc(db, "inventory_supplies", op.payload.idFirebase);
            await deleteDoc(ref);
          }
        }
      }

      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
      await fetchFromFirestore();
    } catch (error) {
      console.log("Error al procesar cola offline:", error);
    }
  };

  /* ------------------------- FIRESTORE ONLINE ------------------------ */

  const fetchFromFirestore = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLoading(true);

      // ✅ SIN orderBy -> ya no pide índice
      const q = query(
        collection(db, "inventory_supplies"),
        where("userId", "==", user.uid)
      );

      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setInsumos(list);
      await saveToCache(list);
    } catch (error) {
      // 👇 SOLO LOG, SIN ALERT PARA NO MOLESTAR AL USUARIO
      console.log("Error al cargar insumos de Firestore:", error);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------- CARGA INICIAL -------------------------- */

  useEffect(() => {
    (async () => {
      await loadFromCache(); // muestra lo que haya local
      const online = await checkNetwork();
      if (online) {
        await processOfflineQueue();
        await fetchFromFirestore();
      }
    })();
  }, []);

  /* ----------------- REPORTE AUTOMÁTICO DE INVENTARIO ---------------- */

  const resumenInventario = useMemo(() => {
    if (!Array.isArray(insumos) || insumos.length === 0) {
      return {
        totalRegistros: 0,
        totalCantidad: 0,
        totalValor: 0,
        porCategoria: [],
      };
    }

    let totalCantidad = 0;
    let totalValor = 0;
    const porCat = {};

    insumos.forEach((item) => {
      const cantidadNum = Number(item.cantidad ?? 0) || 0;
      const costoNum = Number(item.costoUnitario ?? 0) || 0;
      totalCantidad += cantidadNum;
      totalValor += cantidadNum * costoNum;

      const catKey =
        (item.categoria || "Sin categoría").trim() || "Sin categoría";
      if (!porCat[catKey]) {
        porCat[catKey] = { cantidad: 0, valor: 0 };
      }
      porCat[catKey].cantidad += cantidadNum;
      porCat[catKey].valor += cantidadNum * costoNum;
    });

    const porCategoria = Object.entries(porCat)
      .map(([nombre, data]) => ({
        nombre,
        cantidad: data.cantidad,
        valor: data.valor,
      }))
      .sort((a, b) => b.valor - a.valor);

    return {
      totalRegistros: insumos.length,
      totalCantidad,
      totalValor,
      porCategoria,
    };
  }, [insumos]);

  /* -------------------------- ACCIONES CRUD -------------------------- */

  const limpiarFormulario = () => {
    setNombre("");
    setCategoria("");
    setCantidad("");
    setUnidad("");
    setCostoUnitario("");
    setNota("");
    setFechaCompra("");
    setEditingId(null);
  };

  const validarFormulario = () => {
    if (!nombre.trim() || !cantidad.trim() || !unidad.trim()) {
      Alert.alert(
        "Campos requeridos",
        "Nombre, cantidad y unidad son obligatorios."
      );
      return false;
    }

    const cantNum = Number(String(cantidad).replace(",", "."));
    const costoNum = costoUnitario
      ? Number(String(costoUnitario).replace(",", "."))
      : 0;

    if (isNaN(cantNum) || cantNum <= 0) {
      Alert.alert("Cantidad inválida", "Ingrese una cantidad numérica mayor a 0.");
      return false;
    }

    if (costoUnitario && (isNaN(costoNum) || costoNum < 0)) {
      Alert.alert("Costo inválido", "El costo unitario debe ser numérico.");
      return false;
    }

    return true;
  };

  const handleGuardar = async () => {
    if (!validarFormulario()) return;

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Sesión", "No se encontró usuario autenticado.");
      return;
    }

    const cantNum = Number(String(cantidad).replace(",", "."));
    const costoNum = costoUnitario
      ? Number(String(costoUnitario).replace(",", "."))
      : 0;

    const itemData = {
      nombre: nombre.trim(),
      categoria: categoria.trim(),
      cantidad: cantNum,
      unidad: unidad.trim(),
      costoUnitario: costoNum,
      nota: nota.trim(),
      fechaCompra: fechaCompra.trim(),
    };

    const isConnected = await checkNetwork();

    try {
      setLoading(true);

      if (editingId) {
        // 🔄 Actualizar insumo existente
        let updatedList = insumos.map((i) =>
          i.localId === editingId || i.id === editingId ? { ...i, ...itemData } : i
        );
        setInsumos(updatedList);
        await saveToCache(updatedList);

        const currentItem = insumos.find(
          (i) => i.localId === editingId || i.id === editingId
        );

        if (isConnected && currentItem && currentItem.id) {
          const ref = doc(db, "inventory_supplies", currentItem.id);
          await updateDoc(ref, {
            ...itemData,
            updatedAt: serverTimestamp(),
          });
        } else {
          await addToOfflineQueue({
            type: "UPDATE",
            payload: {
              idFirebase: currentItem?.id || null,
              data: itemData,
            },
          });
        }

        Alert.alert("Actualizado", "Insumo actualizado correctamente.");
      } else {
        // ➕ Nuevo insumo
        const localId = `local-${Date.now()}`;

        if (isConnected) {
          const docRef = await addDoc(collection(db, "inventory_supplies"), {
            ...itemData,
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const nuevo = {
            id: docRef.id,
            ...itemData,
          };

          const updatedList = [nuevo, ...insumos];
          setInsumos(updatedList);
          await saveToCache(updatedList);
        } else {
          const nuevo = {
            localId,
            ...itemData,
            pendingSync: true,
          };

          const updatedList = [nuevo, ...insumos];
          setInsumos(updatedList);
          await saveToCache(updatedList);

          await addToOfflineQueue({
            type: "ADD",
            payload: {
              ...itemData,
            },
          });

          Alert.alert(
            "Guardado offline",
            "El insumo se guardó localmente y se sincronizará cuando haya internet."
          );
        }
      }

      limpiarFormulario();
    } catch (error) {
      console.log("Error al guardar insumo:", error);
      Alert.alert("Error", "Ocurrió un problema al guardar el insumo.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = (item) => {
    setEditingId(item.localId || item.id);
    setNombre(item.nombre || "");
    setCategoria(item.categoria || "");
    setCantidad(String(item.cantidad ?? ""));
    setUnidad(item.unidad || "");
    setCostoUnitario(
      item.costoUnitario !== undefined ? String(item.costoUnitario) : ""
    );
    setNota(item.nota || "");
    setFechaCompra(item.fechaCompra || "");
  };

  const handleEliminar = async (item) => {
    Alert.alert(
      "Eliminar insumo",
      `¿Desea eliminar el insumo "${item.nombre}" del inventario?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const filtered = insumos.filter(
                (i) => i.id !== item.id && i.localId !== item.localId
              );
              setInsumos(filtered);
              await saveToCache(filtered);

              const isConnected = await checkNetwork();
              if (isConnected && item.id) {
                const ref = doc(db, "inventory_supplies", item.id);
                await deleteDoc(ref);
              } else {
                await addToOfflineQueue({
                  type: "DELETE",
                  payload: {
                    idFirebase: item.id || null,
                  },
                });
              }
            } catch (error) {
              console.log("Error al eliminar insumo:", error);
              Alert.alert("Error", "Ocurrió un problema al eliminar el insumo.");
            }
          },
        },
      ]
    );
  };

  /* ---------------------- EXPORTAR A CSV / EXCEL --------------------- */

  const buildCSVFromSupplies = (items) => {
    const header = [
      "Nombre",
      "Categoría",
      "Cantidad",
      "Unidad",
      "Costo unitario",
      "Valor total",
      "Fecha compra",
      "Nota",
    ].join(",");

    const rows = items.map((item) => {
      const cantidad = Number(item.cantidad ?? 0);
      const costo = Number(item.costoUnitario ?? 0);
      const total = cantidad && costo ? cantidad * costo : 0;

      const safe = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

      return [
        safe(item.nombre),
        safe(item.categoria),
        safe(cantidad),
        safe(item.unidad),
        safe(costo.toFixed(2)),
        safe(total.toFixed(2)),
        safe(item.fechaCompra),
        safe(item.nota),
      ].join(",");
    });

    return [header, ...rows].join("\n");
  };

  const exportInventoryToCSV = async () => {
    if (!insumos || insumos.length === 0) {
      Alert.alert(
        "Inventario vacío",
        "No hay insumos registrados para exportar."
      );
      return;
    }

    try {
      const csv = buildCSVFromSupplies(insumos);
      const fileName = `inventario_insumos_${Date.now()}.csv`;
      const fileUri = FileSystem.cacheDirectory + fileName;

      // ✅ API legacy, sin EncodingType (por defecto UTF-8)
      await FileSystem.writeAsStringAsync(fileUri, csv);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Exportación", `Archivo generado en: ${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Exportar inventario",
      });
    } catch (error) {
      console.log("exportInventoryToCSV/write error:", error);
      Alert.alert("Error", "No se pudo exportar el inventario.");
    }
  };

  /* ----------------------------- RENDER UI ---------------------------- */

  const renderItem = (item) => {
    const cantidadNum = Number(item.cantidad ?? 0);
    const costoNum = Number(item.costoUnitario ?? 0);
    const total = cantidadNum && costoNum ? cantidadNum * costoNum : 0;

    return (
      <View
        key={item.id || item.localId}
        style={[
          styles.cardItem,
          item.pendingSync && { borderStyle: "dashed", borderWidth: 1 },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{item.nombre}</Text>
          {!!item.categoria && (
            <Text style={styles.itemSub}>
              Categoría: <Text style={styles.itemValue}>{item.categoria}</Text>
            </Text>
          )}
          <Text style={styles.itemSub}>
            Cantidad:{" "}
            <Text style={styles.itemValue}>
              {cantidadNum} {item.unidad}
            </Text>
          </Text>
          {!!costoNum && (
            <Text style={styles.itemSub}>
              Costo unitario:{" "}
              <Text style={styles.itemValue}>C$ {costoNum.toFixed(2)}</Text>
            </Text>
          )}
          {!!total && total > 0 && (
            <Text style={styles.itemSub}>
              Valor total:{" "}
              <Text style={styles.itemValue}>C$ {total.toFixed(2)}</Text>
            </Text>
          )}
          {!!item.fechaCompra && (
            <Text style={styles.itemSub}>
              Fecha compra:{" "}
              <Text style={styles.itemValue}>{item.fechaCompra}</Text>
            </Text>
          )}
          {!!item.nota && (
            <Text style={styles.itemSub}>
              Nota: <Text style={styles.itemValue}>{item.nota}</Text>
            </Text>
          )}

          {item.pendingSync && (
            <Text style={styles.pendingText}>
              Pendiente de sincronizar (offline)
            </Text>
          )}
        </View>

        <View style={styles.actionsColumn}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => handleEditar(item)}
          >
            <MaterialCommunityIcons
              name="pencil"
              size={20}
              color={Colors.white}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: "#dc2626" }]}
            onPress={() => handleEliminar(item)}
          >
            <MaterialCommunityIcons
              name="delete"
              size={20}
              color={Colors.white}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventario de insumos</Text>
        <Text style={styles.headerSubtitle}>
          Registre y controle alimento, medicamentos y otros insumos.
        </Text>
        <Text style={styles.statusText}>
          Estado de conexión:{" "}
          <Text style={{ fontWeight: "600" }}>
            {isOnline ? "En línea" : "Offline"}
          </Text>
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 160 }} // espacio para botón y tab bar
      >
        {/* 🔎 Reporte automático del inventario */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reporte automático del inventario</Text>
          <Text style={styles.reportText}>
            Este resumen se genera automáticamente con base en los insumos
            registrados en esta pantalla.
          </Text>

          {resumenInventario.totalRegistros === 0 ? (
            <Text style={styles.emptyText}>
              Aún no hay datos suficientes para generar el reporte.
            </Text>
          ) : (
            <>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Insumos registrados</Text>
                <Text style={styles.reportValue}>
                  {resumenInventario.totalRegistros}
                </Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Cantidad total</Text>
                <Text style={styles.reportValue}>
                  {resumenInventario.totalCantidad}
                </Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>
                  Valor estimado del inventario
                </Text>
                <Text style={styles.reportValue}>
                  C$ {resumenInventario.totalValor.toFixed(2)}
                </Text>
              </View>

              {resumenInventario.porCategoria.length > 0 && (
                <>
                  <Text style={[styles.label, { marginTop: 10 }]}>
                    Detalle por categoría
                  </Text>
                  {resumenInventario.porCategoria.map((cat) => (
                    <View key={cat.nombre} style={styles.reportRow}>
                      <Text style={styles.reportCategoryName}>{cat.nombre}</Text>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.reportCategoryDetail}>
                          Cant: {cat.cantidad}
                        </Text>
                        <Text style={styles.reportCategoryDetail}>
                          Valor: C$ {cat.valor.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </View>

        {/* Formulario */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {editingId ? "Editar insumo" : "Nuevo insumo"}
          </Text>

          <Text style={styles.label}>Nombre del insumo *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Concentrado para engorde"
            placeholderTextColor={Colors.muted}
            value={nombre}
            onChangeText={setNombre}
          />

          <Text style={styles.label}>Categoría</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Alimento, Medicamento, Limpieza"
            placeholderTextColor={Colors.muted}
            value={categoria}
            onChangeText={setCategoria}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={styles.label}>Cantidad *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Ej. 25"
                placeholderTextColor={Colors.muted}
                value={cantidad}
                onChangeText={setCantidad}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={styles.label}>Unidad *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. qq, kg, litros"
                placeholderTextColor={Colors.muted}
                value={unidad}
                onChangeText={setUnidad}
              />
            </View>
          </View>

          <Text style={styles.label}>Costo unitario (opcional)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="Ej. 1200"
            placeholderTextColor={Colors.muted}
            value={costoUnitario}
            onChangeText={setCostoUnitario}
          />

          <Text style={styles.label}>Fecha de compra (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. 14/10/2025"
            placeholderTextColor={Colors.muted}
            value={fechaCompra}
            onChangeText={setFechaCompra}
          />

          <Text style={styles.label}>Nota (opcional)</Text>
          <TextInput
            style={[styles.input, { height: 70 }]}
            multiline
            placeholder="Observaciones sobre este insumo"
            placeholderTextColor={Colors.muted}
            value={nota}
            onChangeText={setNota}
          />

          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={limpiarFormulario}
            >
              <Text style={styles.btnSecondaryText}>Limpiar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={handleGuardar}
              disabled={loading}
            >
              <MaterialCommunityIcons
                name={editingId ? "content-save-edit" : "content-save"}
                size={20}
                color={Colors.white}
              />
              <Text style={styles.btnPrimaryText}>
                {editingId ? "Actualizar" : "Guardar"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Lista de insumos */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Inventario registrado ({insumos.length})
          </Text>

          {insumos.length === 0 ? (
            <Text style={styles.emptyText}>
              Aún no hay insumos registrados. Agregue el primero usando el
              formulario de arriba.
            </Text>
          ) : (
            insumos.map(renderItem)
          )}
        </View>

        {/* Botón exportar */}
        <View style={styles.exportContainer}>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={exportInventoryToCSV}
            disabled={insumos.length === 0}
          >
            <MaterialCommunityIcons
              name="file-excel"
              size={20}
              color={Colors.white}
            />
            <Text style={styles.exportBtnText}>
              Exportar inventario (Excel)
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default InventarioInsumosScreen;

/* ------------------------------ ESTILOS ------------------------------ */

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
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.beige,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    flex: 1,
  },
  btnPrimary: {
    backgroundColor: Colors.green,
    marginLeft: 6,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: Colors.green,
    marginRight: 6,
  },
  btnPrimaryText: {
    color: Colors.white,
    fontWeight: "600",
    marginLeft: 6,
    fontSize: 14,
  },
  btnSecondaryText: {
    color: Colors.green,
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 4,
  },
  cardItem: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 0.6,
    borderBottomColor: Colors.border,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
  },
  itemSub: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
  itemValue: {
    color: Colors.text,
    fontWeight: "500",
  },
  pendingText: {
    marginTop: 4,
    fontSize: 11,
    color: "#b45309",
  },
  actionsColumn: {
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.green,
    marginVertical: 3,
  },
  exportContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: Colors.green,
  },
  exportBtnText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "700",
    color: Colors.white,
  },
  /* 🔎 Estilos para reporte automático */
  reportText: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 6,
  },
  reportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  reportLabel: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: "600",
  },
  reportValue: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: "700",
  },
  reportCategoryName: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: "600",
  },
  reportCategoryDetail: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: "600",
  },
});
