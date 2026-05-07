// src/agents/runner.js
import { SequentialAgent, Runner, InMemorySessionService } from '@google/adk';
import { researchAgent } from './researchAgent.js';
import { riskAgent } from './riskAgent.js';
import { pitchAgent } from './pitchAgent.js';
import { documentAgent } from './documentAgent.js';

export const gammaOrchestrator = new SequentialAgent({
  name: 'gamma-orchestrator',
  subAgents: [
    researchAgent,
    riskAgent,
    pitchAgent,
    documentAgent
  ]
});

/**
 * Función principal para ejecutar el análisis de la cuenta a través del ADK
 */
export async function runAccountAnalysis(companyName, manufacturer, solution, country, notes, catalogContext) {
  // Configurar el estado inicial para la sesión del ADK
  const initialState = {
    companyName,
    manufacturer,
    solution,
    country,
    notes,
    catalogContext
  };

  // Inyectar el modelo configurado en todos los subagentes (LlmAgent)
  const selectedModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  for (const agent of gammaOrchestrator.subAgents) {
    if ('model' in agent) {
      agent.model = selectedModel;
    }
  }

  // Iniciar la ejecución secuencial de los agentes usando Runner
  const runner = new Runner({
    appName: 'GammaPortfolio',
    agent: gammaOrchestrator,
    sessionService: new InMemorySessionService(),
  });

  const stream = runner.runEphemeral({
    userId: 'user',
    newMessage: { role: 'user', parts: [{text: `Inicia el análisis para la empresa ${companyName} (${country}).`}] },
    stateDelta: initialState
  });

  return await consumeStreamAndExtractText(stream);
}

async function consumeStreamAndExtractText(stream) {
  let finalText = '';
  // Iterar sobre los eventos para obtener el resultado final del modelo
  for await (const event of stream) {
    console.log('[ADK] Event received from author:', event.author);
    if (event.errorMessage) {
      throw new Error(`Error en agente ${event.author}: ${event.errorMessage}`);
    }
    // Solo recolectamos la salida del agente final (document-agent)
    if (event.author === 'document-agent' && event.content?.parts) {
      for (const part of event.content.parts) {
        if (part.text) finalText += part.text;
      }
    }
  }
  return finalText;
}
