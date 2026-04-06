# 📘 Manual de Usuario — Gamma Portfolio Explorer (SPP-Gamma)

> **Versión:** 2.0 | **Última actualización:** Abril 2026  
> Aplicación multimarca para explorar portafolio por fabricante y generar análisis comerciales/técnicos asistidos por IA (Gemini).

---

## Tabla de Contenidos

1. [¿Qué es SPP-Gamma?](#1-qué-es-spp-gamma)
2. [Arquitectura de la aplicación](#2-arquitectura-de-la-aplicación)
3. [Requisitos](#3-requisitos)
4. [Instalación y configuración](#4-instalación-y-configuración)
   - [Configuración rápida (Usuarios Cero Experto)](#40-configuración-rápida-para-usuarios-sin-experiencia-cero-experto)
   - [Con Docker Compose (recomendado)](#41-con-docker-compose-recomendado)
   - [Sin Docker (Node.js directo)](#42-sin-docker-nodejs-directo)
5. [Configuración de la API Key de Gemini](#5-configuración-de-la-api-key-de-gemini)
6. [Uso de la interfaz](#6-uso-de-la-interfaz)
   - [Pantalla principal](#61-pantalla-principal)
   - [Generar un perfil de cuenta](#62-generar-un-perfil-de-cuenta)
   - [Secciones del análisis generado](#63-secciones-del-análisis-generado)
7. [Editor de Catálogo](#7-editor-de-catálogo)
   - [Agregar fabricante](#71-agregar-fabricante)
   - [Editar fabricante](#72-editar-fabricante)
   - [Eliminar fabricante](#73-eliminar-fabricante)
   - [Gestionar soluciones](#74-gestionar-soluciones)
8. [API REST — Referencia](#8-api-rest--referencia)
9. [Estructura de archivos](#9-estructura-de-archivos)
10. [Variables de entorno](#10-variables-de-entorno)
11. [Preguntas frecuentes](#11-preguntas-frecuentes)
12. [Mejoras futuras sugeridas](#12-mejoras-futuras-sugeridas)

---

## 1. ¿Qué es SPP-Gamma?

**Gamma Portfolio Explorer** es una herramienta de apoyo a la preventa de ciberseguridad e infraestructura. Permite a los equipos comerciales y de preventa:

- Explorar el portafolio de múltiples fabricantes (Cisco, Palo Alto, Fortinet, etc.)
- Ingresar el nombre de una cuenta objetivo y obtener un **análisis comercial y técnico completo generado por IA**
- Identificar riesgos, casos de uso, normativas aplicables y una arquitectura sugerida
- Obtener un pitch de ventas listo para usar

La IA utilizada es **Google Gemini** con capacidad de búsqueda web, lo que le permite investigar información pública real de la empresa analizada.

---

## 2. Arquitectura de la aplicación

```
┌─────────────────────────────────────────┐
│           Navegador (Frontend)          │
│   HTML + Vanilla JS + CSS               │
│   - index.html  (UI principal)          │
│   - app.js      (lógica frontend)       │
│   - catalog.js  (catálogo inicial)      │
│   - catalog-editor.js (editor CRUD)     │
└────────────────┬────────────────────────┘
                 │ HTTP REST
┌────────────────▼────────────────────────┐
│         Backend (Node.js + Express)     │
│   - server.js                           │
│   - API proxy hacia Gemini              │
│   - CRUD de catálogo (catalog.json)     │
└────────────────┬────────────────────────┘
                 │ HTTPS
┌────────────────▼────────────────────────┐
│      Google Gemini API                  │
│   Modelo: gemini-2.5-flash (default)    │
│   Herramienta: Google Search            │
└─────────────────────────────────────────┘
```

El backend actúa como **proxy seguro**: la API Key de Gemini nunca se expone al navegador si se configura en el servidor.

---

## 3. Requisitos

| Opción | Requisito |
|--------|-----------|
| Docker (recomendado) | Docker Desktop instalado y corriendo |
| Node.js directo | Node.js ≥ 18.x |
| Ambas | API Key de Google Gemini (gratuita en [aistudio.google.com](https://aistudio.google.com)) |

---

## 4. Instalación y configuración

### 4.0 Configuración rápida para usuarios sin experiencia (Cero Experto)

Si es tu primera vez usando este tipo de aplicaciones, sigue estos pasos desde cero:

#### Paso 1: Instalar las herramientas necesarias
1. **Instalar Git:**
   - Descarga e instala Git desde [git-scm.com](https://git-scm.com/downloads).
   - Durante la instalación, puedes dejar todas las opciones por defecto haciendo clic en "Siguiente" hasta finalizar.
2. **Instalar Docker:**
   - Descarga e instala Docker Desktop desde [docker.com](https://www.docker.com/products/docker-desktop/).
   - Ábrelo una vez finalizada la instalación. Es posible que te pida reiniciar la computadora. **Asegúrate de que Docker Desktop esté abierto y ejecutándose** en segundo plano antes de continuar (verás el ícono de la ballena en tu barra de tareas).

#### Paso 2: Ejecutar los comandos
Abre la **Terminal** (Busca "Símbolo del sistema" o "PowerShell" en tu menú de inicio de Windows, o "Terminal" en macOS) y copia y pega, uno por uno, los siguientes comandos y presiona la tecla **Enter** después de cada uno:

```bash
# 1. Descarga el código a tu computadora
git clone https://github.com/davidortizac/SPP-Gamma.git

# 2. Entra a la carpeta que se acaba de crear
cd SPP-Gamma

# 3. Inicia la aplicación usando Docker
docker compose up --build
```

#### Paso 3: Abrir la aplicación
¡Listo! Abre tu navegador web favorito (Chrome, Edge, Safari) e ingresa a: **`http://localhost:3000`**

*(Puedes pegar la clave de Gemini que obtuviste directamente en la interfaz gráfica).*

---

### 4.1 Con Docker Compose (recomendado)

```bash
# 1. Clona el repositorio
git clone https://github.com/davidortizac/SPP-Gamma.git
cd SPP-Gamma

# 2. Crea el archivo de variables de entorno
cp .env.example .env

# 3. Edita .env y pega tu API key de Gemini
#    GEMINI_API_KEY=xxxx

# 4. Levanta el contenedor
docker compose up --build

# 5. Accede a la aplicación
#    http://localhost:3000
```

Para detener el contenedor:
```bash
docker compose down
```

### 4.2 Sin Docker (Node.js directo)

```bash
# 1. Clona el repositorio
git clone https://github.com/davidortizac/SPP-Gamma.git
cd SPP-Gamma

# 2. Instala dependencias
npm install

# 3. Define la variable de entorno (PowerShell)
$env:GEMINI_API_KEY = "xxxx"

# 4. Inicia el servidor
npm start

# 5. Accede a la aplicación
#    http://localhost:3000
```

---

## 5. Configuración de la API Key de Gemini

Tienes **dos formas** de proporcionar la API Key:

### Opción A — En el servidor (`.env`)
Edita el archivo `.env`:
```env
GEMINI_API_KEY=xxxx
GEMINI_MODEL=gemini-2.5-flash
```
✅ Recomendada para producción. La key **nunca se expone al cliente**.

### Opción B — En la interfaz web
Si `GEMINI_API_KEY` está vacío en el servidor, la app mostrará un campo en la UI para pegar la key manualmente. Esta opción es útil para demos rápidas.

> ⚠️ **Advertencia:** La key ingresada en la UI se envía al backend en cada petición. Úsala solo en entornos de confianza.

---

## 6. Uso de la interfaz

### 6.1 Pantalla principal

Al abrir `http://localhost:3000` verás:

```
┌──────────────────────────────────────────────┐
│  🔵 Gamma Portfolio Explorer                 │
│                                              │
│  [Selector de Fabricante ▼]                  │
│  [Selector de Solución   ▼]                  │
│                                              │
│  Empresa objetivo: [________________________]│
│  País:             [________________________]│
│  Notas adicionales:[________________________]│
│                                              │
│  [⚡ Generar Perfil de Cuenta]               │
│                                              │
│  [✏️ Editar Catálogo]                        │
└──────────────────────────────────────────────┘
```

### 6.2 Generar un perfil de cuenta

1. **Selecciona el fabricante** del dropdown (ej: Palo Alto Networks)
2. **Selecciona la solución** que quieres vender (ej: NGFW)
3. **Escribe el nombre de la empresa** objetivo (ej: Bancolombia)
4. *(Opcional)* Indica el **país** y cualquier **nota adicional** relevante
5. Haz clic en **⚡ Generar Perfil de Cuenta**
6. Espera entre 10-30 segundos. La IA investigará la empresa en tiempo real.

### 6.3 Secciones del análisis generado

Una vez generado el perfil, verás estas secciones:

| Sección | Descripción |
|---------|-------------|
| **Resumen Ejecutivo** | Síntesis comercial de la cuenta y la oportunidad |
| **Perfilamiento** | Sector, geografía, giro de negocio, cargo objetivo y activos críticos |
| **Mapa de Riesgos** | Gráfico de tipos de datos con niveles de exposición estimados |
| **Casos de Uso** | Lista de escenarios aplicables: dolor, solución y resultado esperado |
| **Pitch de Ventas** | Apertura consultiva, propuesta de valor y cierre sugerido |
| **Competencias del Fabricante** | Diferenciales técnicos y comerciales relevantes |
| **Marco Normativo** | Regulaciones aplicables al sector/país de la cuenta |
| **Preguntas de Descubrimiento** | Preguntas clave para la reunión con el cliente |
| **Arquitectura Sugerida** | Componentes y productos recomendados |
| **Fuentes** | Referencias públicas usadas por la IA |

> 💡 **Tip:** El botón **"Cargar Demo"** genera un perfil de ejemplo sin consumir la API, ideal para mostrar la herramienta en presentaciones.

---

## 7. Editor de Catálogo

El catálogo de fabricantes y soluciones es **completamente editable** desde la interfaz. Haz clic en **✏️ Editar Catálogo** para abrirlo.

Los cambios se persisten en el archivo `catalog.json` del servidor.

### 7.1 Agregar fabricante

1. Haz clic en **+ Nuevo Fabricante**
2. Ingresa el nombre y una descripción opcional
3. Haz clic en **Guardar**

### 7.2 Editar fabricante

1. Selecciona un fabricante de la lista
2. Haz clic en el ícono ✏️ junto al nombre
3. Modifica nombre y/o descripción
4. Haz clic en **Guardar**

### 7.3 Eliminar fabricante

1. Selecciona el fabricante
2. Haz clic en el ícono 🗑️
3. Confirma la acción en el diálogo

> ⚠️ **Eliminar un fabricante borra también todas sus soluciones.**

### 7.4 Gestionar soluciones

Dentro de cada fabricante puedes:

- **Agregar solución:** nombre, lista de productos y propuestas de valor
- **Editar solución:** modifica nombre, productos o valores
- **Eliminar solución:** acción irreversible

---

## 8. API REST — Referencia

El backend expone los siguientes endpoints:

### Configuración
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/config` | Retorna si hay server key configurada y el modelo por defecto |

### Catálogo
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/catalog` | Retorna el catálogo completo |
| `POST` | `/api/catalog/manufacturers` | Crea un nuevo fabricante |
| `PUT` | `/api/catalog/manufacturers/:name` | Actualiza un fabricante |
| `DELETE` | `/api/catalog/manufacturers/:name` | Elimina un fabricante |
| `POST` | `/api/catalog/manufacturers/:name/solutions` | Agrega una solución |
| `PUT` | `/api/catalog/manufacturers/:mfName/solutions/:solutionName` | Actualiza una solución |
| `DELETE` | `/api/catalog/manufacturers/:mfName/solutions/:solutionName` | Elimina una solución |

### Generación IA
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/generate-profile` | Genera análisis de cuenta con Gemini |

#### Body de `/api/generate-profile`:
```json
{
  "companyName": "Bancolombia",
  "manufacturer": "Palo Alto Networks",
  "solution": "NGFW",
  "country": "Colombia",
  "notes": "Empresa del sector financiero regulada por SFC",
  "apiKey": "xxxx" 
}
```
> El campo `apiKey` es opcional si `GEMINI_API_KEY` está definido en el servidor.

---

## 9. Estructura de archivos

```
SPP-Gamma/
├── server.js              # Backend Express — API y proxy Gemini
├── package.json           # Dependencias Node.js
├── catalog.json           # Catálogo de fabricantes (persistencia)
├── Dockerfile             # Imagen Docker de la aplicación
├── docker-compose.yml     # Orquestación de contenedores
├── .env                   # Variables de entorno (no subir a GitHub)
├── .env.example           # Plantilla de variables de entorno
├── README.md              # Descripción rápida del proyecto
├── MANUAL.md              # Este manual
└── public/
    ├── index.html         # Interfaz principal (HTML + CSS)
    ├── app.js             # Lógica del frontend (generación de perfiles)
    ├── catalog.js         # Catálogo inicial (cargado al iniciar)
    └── catalog-editor.js  # Lógica del editor de catálogo
```

---

## 10. Variables de entorno

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `GEMINI_API_KEY` | No* | `""` | API Key de Google Gemini. Si está vacía, se solicita en la UI. |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Modelo de Gemini a usar |
| `PORT` | No | `3000` | Puerto en que escucha el servidor |

> \* Si no se define en el servidor, **debe** ingresarse manualmente en la interfaz.

---

## 11. Preguntas frecuentes

**¿Cuánto cuesta usar la aplicación?**  
La app en sí es gratuita y open source. Google Gemini ofrece un nivel gratuito generoso. Revisa los límites actuales en [ai.google.dev/pricing](https://ai.google.dev/pricing).

**¿Los datos de mis clientes se almacenan?**  
No. La app no tiene base de datos. El nombre de la empresa se envía a Gemini para generar el análisis, pero no se persiste localmente ni en ningún servidor propio.

**¿Puedo usar otro modelo de Gemini?**  
Sí. Cambia la variable `GEMINI_MODEL` en `.env`. Modelos disponibles: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`, etc.

**¿El análisis es 100% preciso?**  
La IA busca información pública real, pero puede cometer errores. Siempre valida los datos críticos antes de usarlos en una reunión con el cliente.

**¿Puedo agregar mis propios fabricantes?**  
Sí, desde el **Editor de Catálogo** en la interfaz, o editando directamente el archivo `catalog.json`.

**¿Cómo cambio el puerto?**  
Agrega `PORT=8080` (o el puerto deseado) en tu archivo `.env`.

---

## 12. Mejoras futuras sugeridas

| Mejora | Descripción |
|--------|-------------|
| 🗄️ Persistencia en BD | Migrar `catalog.json` a PostgreSQL o MongoDB |
| 🔐 Autenticación | Login con Google o credenciales locales |
| 📜 Historial de análisis | Guardar perfiles generados por cuenta |
| 📄 Exportación PDF/PPT | Descargar el análisis como presentación lista |
| 🤖 Modo RAG | Alimentar la IA con documentos propios de tu empresa |
| 🔗 Integración CRM | Sincronizar cuentas con Salesforce, HubSpot, etc. |
| 🌐 Multi-idioma | Soporte para inglés y otros idiomas |
| 📊 Dashboard analítico | Métricas de uso y fabricantes más consultados |

---

*Manual generado para el proyecto SPP-Gamma — Gamma Portfolio Explorer*  
*Repositorio: [github.com/davidortizac/SPP-Gamma](https://github.com/davidortizac/SPP-Gamma)*
