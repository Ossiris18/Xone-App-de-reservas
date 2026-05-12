# 🏨 Xone - Ecosistema Integral de Gestión Hotelera

Xone es una plataforma completa de administración hotelera con arquitectura Cloud-Native. Este repositorio contiene el **ecosistema completo**, dividido en dos aplicaciones independientes que consumen la misma infraestructura centralizada en la nube.

## 📂 Estructura del Proyecto
1. **`/Admin_Web`**: Panel Administrativo Web desarrollado en React para la gestión operativa, catálogos y auditoría en tiempo real.
2. **`/App_Movil`**: Aplicación móvil orientada a la experiencia del huésped para realizar reservas y consultas.

## 🚀 Tecnologías Utilizadas
* **Frontend Web:** React.js, Vite, Node.js
* **Base de Datos:** Cloud Firestore (NoSQL)
* **Autenticación:** Firebase Auth
* **Mapas y Geolocalización:** Leaflet & OpenStreetMap
* **Despliegue:** Firebase Hosting

## ⚙️ Características Principales (Arquitectura Core)
* **Prevención de Overbooking:** Sincronización bidireccional en tiempo real utilizando WebSockets (`onSnapshot`) y Transacciones Atómicas.
* **Seguridad y Auditoría:** Bitácora inmutable protegida mediante Firestore Security Rules (IaC) para prevenir la alteración de registros.
* **Procesamiento Multimedia:** Conversión nativa de imágenes a Base64.

---
*Desarrollado como Proyecto Integrador.*"# Xone-App-de-reservas" 
