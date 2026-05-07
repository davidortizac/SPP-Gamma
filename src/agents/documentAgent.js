// src/agents/documentAgent.js
import { LlmAgent } from '@google/adk';

export const documentAgent = new LlmAgent({
  name: 'document-agent',
  model: 'gemini-2.5-flash',
  instruction: `Eres el consolidador final de un sistema multi-agente de inteligencia de preventa.
Tu tarea es consolidar TODA la información generada por los agentes anteriores (investigación, riesgo, pitch) y el catálogo en un JSON ESTRICTAMENTE con el siguiente esquema. No omitas ningún campo. Rellena cada campo con contenido real y detallado basado en la información disponible.

DEVUELVE ÚNICAMENTE un bloque JSON válido, sin texto adicional, sin markdown, sin comillas triples. Solo el JSON:

{
  "empresa": "nombre completo de la empresa objetivo",
  "fabricante": "nombre del fabricante/vendor de la solución",
  "solucion": "nombre de la solución del portafolio",
  "resumenEjecutivo": "2-3 oraciones que resuman el perfil de la empresa, su industria y por qué es un prospecto relevante",
  "perfilamiento": {
    "sector": "sector industrial (ej: Educación, Manufactura, Finanzas)",
    "geografia": "ciudad y país donde opera",
    "rol": "descripción del rol de la empresa en su industria",
    "activosCriticos": ["activo crítico 1", "activo crítico 2", "activo crítico 3"]
  },
  "riesgos": {
    "riesgoPrincipal": "descripción en una oración del riesgo cibernético más crítico para esta empresa",
    "impacto": "descripción del impacto potencial si el riesgo se materializa: operacional, financiero y reputacional",
    "tiposDatos": [
      {"label": "tipo de dato (máx 25 chars)", "value": 80},
      {"label": "tipo de dato", "value": 60}
    ]
  },
  "pitch": {
    "apertura": "frase de apertura consultiva para iniciar la conversación con el decisor",
    "valor": "propuesta de valor diferencial de la solución para este cliente específico (2-3 oraciones)",
    "cierre": "frase de cierre para proponer siguiente paso concreto"
  },
  "casosDeUso": [
    {
      "titulo": "Nombre del caso de uso",
      "dolor": "descripción del dolor o problema del cliente",
      "solucion": "cómo la solución lo resuelve",
      "resultado": "resultado o beneficio esperado para el cliente"
    }
  ],
  "arquitecturaSugerida": [
    "Capa 1: descripción de la capa de arquitectura sugerida",
    "Capa 2: descripción de la segunda capa"
  ],
  "competencias": ["competencia o diferenciador clave 1", "competencia 2", "competencia 3"],
  "normativo": [
    {"norma": "Nombre de la regulación", "descripcion": "cómo aplica y cómo la solución ayuda a cumplirla"}
  ],
  "preguntasDescubrimiento": [
    "Pregunta de descubrimiento 1 para el decisor?",
    "Pregunta de descubrimiento 2?"
  ],
  "objeciones": [
    {
      "objecion": "objeción típica del cliente",
      "respuesta": "respuesta comercial y técnica para refutar la objeción"
    }
  ],
  "herramientas": {
    "email": {
      "asunto": "Asunto del email de prospección",
      "cuerpo": "Cuerpo completo del email de prospección personalizado para este cliente"
    },
    "resumenCISO": null
  },
  "impactoEsperado": {
    "financiero": "impacto financiero esperado",
    "operacional": "impacto operacional esperado",
    "reputacional": "impacto reputacional esperado"
  },
  "fuentes": []
}`,
});
