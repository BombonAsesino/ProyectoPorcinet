## Porcinet

## Descripción del Proyecto

Porcinet es una aplicación móvil desarrollada con React Native + Expo y Firebase.
Su propósito es digitalizar y simplificar la gestión de granjas porcinas, ofreciendo a los productores una herramienta práctica para registrar sus operaciones,
visualizar métricas de productividad y asegurar sus datos mediante respaldos en la nube.

El sistema implementa un esquema de roles diferenciados: el Productor, que accede a su panel con indicadores clave (cerdos totales, productividad y número de madres),
registra costos y gastos (alimentación, salud y mantenimiento),
gestiona procesos de reproducción y puede crear/restaurar respaldos;
y el Administrador, que cuenta con un panel exclusivo donde puede visualizar la lista de productores registrados y consultar su información básica.
El registro como administrador está restringido para mayor seguridad.

Entre sus principales funcionalidades se encuentran la autenticación con Firebase Auth,
el dashboard del productor con KPIs, la gestión de costos y gastos por categoría, el respaldo y restauración de datos en Firestore,
el control de reproducción, el uso de un asistente IA integrado y la persistencia local con AsyncStorage que garantiza
la disponibilidad de la información incluso en contextos de conectividad limitada.
Con estas herramientas, Porcinet fortalece la productividad y la toma de decisiones de los productores porcinos.

## Requerimientos Técnicos

## Software

Node.js
Expo SDK
React Native
Firebase
AsyncStorage
Git/GitHub

## Hardware

Dispositivo Android (8.0 o superior).
RAM mínima: 3 GB.
Conexión a internet (soporte offline incluido).

## instalación
Descargamos este repositorio en formato ZIP desde GitHub y extraemos los archivos en la computadora.
Luego abrimos la carpeta del proyecto en el editor (VS Code) y ejecutamos npm install en la terminal para instalar las dependencias.
Es necesario tener Node.js, Expo CLI y una cuenta de Firebase configurada con Authentication, Firestore y Realtime Database habilitados. 
Finalmente, iniciamos la aplicación con npx expo start y escaneamos el código QR en el dispositivo móvil para probarla en tiempo real.

## usabilidad

Al iniciar la aplicación, los usuarios pueden registrarse o iniciar sesión según su rol.
Los productores se registran con sus datos (nombre, correo, teléfono, número de granja y tamaño del hato), mientras que el administrador utiliza una cuenta predefinida. 
Al autenticarse, el sistema redirige automáticamente: los productores ingresan a una pantalla de bienvenida y luego a su dashboard principal, y el administrador accede directamente al Panel de Administración,
desde donde puede visualizar a todos los productores registrados.

Dentro de la app, el productor puede gestionar sus costos y gastos (alimentación, salud, mantenimiento), 
crear y restaurar respaldos en la nube, y acceder a módulos clave como el control de reproducción,
el dashboard de productividad (con datos locales y en tiempo real desde Firebase) y un asistente IA para futuras funciones.
El administrador, por su parte, puede consultar en tiempo real la lista de productores registrados y cerrar sesión en cualquier momento.
