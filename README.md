# Portfolio Explorer - Gamma (v2.0)

Plataforma agéntica multimarca para equipos de preventa, construida con Node.js, Express, PostgreSQL y el **Agent Development Kit (ADK)** de Google. Esta versión reemplaza la lógica monolítica anterior por un pipeline multi-agente que investiga, evalúa riesgos, prepara propuestas comerciales y redacta documentación de forma secuencial y estructurada.

## Novedades en v2.0

- **Arquitectura Multi-Agente (ADK):** Uso de `@google/adk` para orquestar los agentes especializados `ResearchAgent`, `RiskAgent`, `PitchAgent` y `DocumentAgent`.
- **Persistencia y Base de Datos:** PostgreSQL configurado para guardar historial de consultas, configuración de catálogo, macros y estado de sesiones interactivas.
- **Seguridad y Autenticación:** Sistema de usuarios con roles (`admin`, `analyst`) usando JWT y contraseñas cifradas con `bcryptjs`.
- **Frontend SPA Nativo:** Interfaz construida con Vanilla JS y Hash Router que brinda una experiencia de usuario rápida y dinámica.

## Estructura del Proyecto

- `src/agents/`: Definición de los agentes de IA (investigación, riesgo, pitch, etc.) y su orquestador.
- `src/routes/`: Controladores de la API (Auth, Consultas, Chat, Catálogo, Admin).
- `src/db/`: Configuración y esquemas de conexión a PostgreSQL.
- `src/middleware/`: Verificación de acceso (JWT) y seguridad de rutas según roles.
- `public/`: Archivos estáticos de la Single Page Application (HTML, JS, CSS, vistas).
- `docker-compose.yml`: Orquestación completa para levantar la aplicación Node y la base de datos en contenedores.

---

## 🚀 Despliegue con Docker (Recomendado)

La aplicación está lista para ser desplegada en entornos locales o de producción mediante contenedores Docker. El archivo `docker-compose.yml` pre-configura tanto la base de datos PostgreSQL (`gamma-db`) como la aplicación Node.js (`gamma-portfolio-explorer`).

**Paso a paso:**

1. **Configurar el entorno:**
   Genera el archivo `.env` base y configúralo.
   ```bash
   cp .env.example .env
   ```
   Abre `.env` en tu editor favorito. Presta principal atención a:
   - `GEMINI_API_KEY`: Tu llave generada en Google AI Studio.
   - Configuraciones de la base de datos (`DB_PASSWORD`).
   - Secretos (`JWT_SECRET`).

2. **Levantar los contenedores:**
   Ejecuta Docker Compose para construir la imagen e iniciar los servicios en segundo plano.
   ```bash
   docker compose up --build -d
   ```

3. **Acceder a la aplicación:**
   Abre tu navegador y dirígete a:
   ```text
   http://localhost:3080
   ```
   *(Nota: Si usas las configuraciones por defecto, el puerto expuesto al host es el 3080).*

**Nota sobre la cuenta inicial:**
Dependiendo de la configuración en tu entorno, la aplicación permitirá el auto-registro o poseerá un usuario administrador por defecto (definido vía `ADMIN_EMAIL` en las variables de entorno de Docker).

---

## 💻 Desarrollo Local (Sin Docker para la App)

Si prefieres trabajar en el código en caliente y levantar sólo la base de datos en Docker:

1. Levanta únicamente el contenedor de la base de datos:
   ```bash
   docker compose up db -d
   ```
2. Instala las dependencias localmente:
   ```bash
   npm install
   ```
3. Verifica que tu archivo `.env` apunte a `localhost` en el `DB_HOST`.
4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## Mantenimiento

Desde el **Panel de Administración** en la aplicación web, el usuario con rol `admin` puede:
- Modificar o rotar en caliente la API Key de Gemini.
- Editar el catálogo de fabricantes y soluciones.
- Auditar todas las consultas y usuarios.
- Generar respaldos rápidos de la base de datos usando la integración nativa.
