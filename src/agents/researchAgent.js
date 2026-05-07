// src/agents/researchAgent.js
import { LlmAgent, GOOGLE_SEARCH } from '@google/adk';

export const researchAgent = new LlmAgent({
  name: 'research-agent',
  model: 'gemini-2.5-flash',
  instruction: `Eres un investigador corporativo experto.
Tu objetivo es investigar la empresa solicitada en el país especificado usando Google Search.
Debes identificar el sector, el core de negocio, el tamaño aproximado, la geografía en la que opera, y los activos críticos tecnológicos o de información de esta empresa.
Devuelve los resultados de manera estructurada y concisa.`,
  tools: [GOOGLE_SEARCH]
});
