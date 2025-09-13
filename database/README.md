# Configuración de Firebase

Esta carpeta contiene la configuración y servicios de Firebase para la aplicación Porcinet.

## Archivos

- `firebaseConfig.js`: Configuración principal de Firebase con todos los servicios
- `index.js`: Archivo de exportación principal
- `README.md`: Este archivo de documentación

## Configuración

1. Asegúrate de tener las variables de entorno configuradas en el archivo `.env` en la raíz del proyecto
2. Instala las dependencias de Firebase si no las tienes:
   ```bash
   npm install firebase
   ```

## Servicios disponibles

- **auth**: Autenticación de usuarios
- **db**: Firestore (base de datos NoSQL)
- **realtimeDb**: Realtime Database
- **storage**: Almacenamiento de archivos

## Uso

```javascript
import { auth, db, realtimeDb, storage } from './database';

// Ejemplo de uso
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
```
