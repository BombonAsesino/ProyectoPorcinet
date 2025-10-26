// src/utils/notifications.js
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Mostrar alert y sonido cuando llega la notificación (en foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Llama una sola vez al iniciar la app
export async function ensureNotificationSetup() {
  // Android: canal por defecto
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "General",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: true,
    });
  }

  // Permisos
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    if (newStatus !== "granted") {
      // Permiso denegado; devuelve false para que la UI lo maneje si querés
      return false;
    }
  }
  return true;
}

/**
 * Programa una notificación ÚNICA en una fecha/hora específica.
 * @param {{id?: string, title: string, body: string, date: Date}} p
 * @returns {Promise<string>} notificationId
 */
export async function scheduleOnce({ id, title, body, date }) {
  return Notifications.scheduleNotificationAsync({
    identifier: id, // opcional (Expo la genera si no la pasás)
    content: { title, body, sound: true },
    trigger: date, // Date nativa
  });
}

/**
 * Programa una notificación REPETITIVA.
 * Opciones comunes:
 *  - every: "hour" | "day" | "week" | "month" (simple)
 *  - o trigger en base a timeParts: { hour, minute, weekday } con repeats=true
 * @param {{
 *   id?: string,
 *   title: string,
 *   body: string,
 *   every?: "hour"|"day"|"week"|"month",
 *   hour?: number, minute?: number, weekday?: 1|2|3|4|5|6|7
 * }} p
 */
export async function scheduleRepeating({
  id,
  title,
  body,
  every,
  hour,
  minute,
  weekday,
}) {
  let trigger;
  if (every) {
    // Simple: cada X (ej. cada 8h no está soportado directo; ver abajo)
    trigger = { repeats: true, every }; // hour/day/week/month
  } else {
    // Avanzado: hora/minuto (y opcional weekday) repetitivo
    trigger = {
      hour: hour ?? 8,
      minute: minute ?? 0,
      repeats: true,
      ...(weekday ? { weekday } : {}), // 1=Lunes ... 7=Domingo
    };
  }

  return Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, sound: true },
    trigger,
  });
}

/**
 * Repite cada N horas creando N jobs diarios (workaround Expo)
 * Ej.: cada 8h => 3 notificaciones diarias (08:00, 16:00, 00:00)
 */
export async function scheduleEveryNHours({
  idPrefix = "feed",
  title,
  body,
  hours = 8,
  startHour = 8,
}) {
  const ids = [];
  const slots = Math.floor(24 / hours);
  for (let i = 0; i < slots; i++) {
    const hour = (startHour + i * hours) % 24;
    const nid = await Notifications.scheduleNotificationAsync({
      identifier: `${idPrefix}_${hour}`,
      content: { title, body, sound: true },
      trigger: { hour, minute: 0, repeats: true },
    });
    ids.push(nid);
  }
  return ids;
}

export async function cancelNotification(id) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduled() {
  return Notifications.getAllScheduledNotificationsAsync();
}
