// src/agents/riskAgent.js
import { LlmAgent } from '@google/adk';

export const riskAgent = new LlmAgent({
  name: 'risk-agent',
  model: 'gemini-2.5-flash',
  instruction: `Eres un analista experto en ciberseguridad y evaluación de riesgos corporativos.
Basado en el perfil de la empresa investigado (su sector, geografía, core de negocio y activos críticos), tu objetivo es generar un análisis de riesgos.
Identifica y evalúa los niveles de exposición (Alto, Medio, Bajo) para diferentes tipos de datos.
Determina el riesgo principal al que se enfrenta la empresa en su contexto tecnológico actual y el impacto potencial si dicho riesgo se materializa.
Genera un análisis de riesgos fundamentado en la realidad operativa del cliente.`,
});
