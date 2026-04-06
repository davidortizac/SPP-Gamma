# Gamma Portfolio Explorer

Aplicación multimarca para explorar portafolio por fabricante y generar análisis comerciales/técnicos asistidos por IA.

## Qué incluye

- Selector de fabricante y solución
- Catálogo base multimarca editable
- Backend en Node.js para proteger el uso de la API
- Integración con Gemini usando búsqueda web
- Vista de riesgos, casos de uso, pitch, normativo y arquitectura sugerida
- Ejemplo demo cargable sin consumir API
- Dockerfile y docker-compose listos

## Estructura

- `server.js`: backend Express con proxy hacia Gemini
- `public/index.html`: interfaz principal
- `public/app.js`: lógica frontend
- `public/catalog.js`: catálogo inicial de fabricantes y soluciones
- `Dockerfile`: imagen de la app
- `docker-compose.yml`: despliegue local simple

## Ejecutar con Docker Compose

> 💡 **¿Eres nuevo en esto?** Revisa el [Manual de Usuario completo (MANUAL.md)](MANUAL.md) para ver la "Configuración rápida para usuarios Cero Experto" paso a paso.

1. Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

2. Edita `.env` y pega tu API key de Gemini.

3. Levanta el contenedor:

```bash
docker compose up --build
```

4. Abre en navegador:

```text
http://localhost:3000
```

## Ejecutar sin guardar la key en archivo

También puedes dejar vacía la variable `GEMINI_API_KEY` y pegar la key directamente en la interfaz.

## Cómo extender el catálogo

Edita `public/catalog.js` y agrega fabricantes con este formato:

```javascript
{
  name: 'Fabricante',
  description: 'Descripción',
  solutions: [
    {
      name: 'Nombre de la solución',
      products: ['Producto 1', 'Producto 2'],
      value: ['Valor 1', 'Valor 2']
    }
  ]
}
```

## Mejoras recomendadas

- Persistencia en PostgreSQL
- Autenticación
- Historial de cuentas analizadas
- Exportación a PDF y PowerPoint
- Modo RAG con base documental propia de tu compañía
- Integración con CRM
