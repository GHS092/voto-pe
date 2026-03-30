import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';

export const config = {
  runtime: 'edge',
};

// Aquí iban las llaves. Han sido eliminadas por seguridad.

const FRIENDLY_ERROR = "El sistema central está experimentando una alta demanda o una interferencia externa. Estamos recalibrando nuestras bases de datos. Por favor, intenta de nuevo en un momento.";

const SYSTEM_INSTRUCTION = `Eres "Voto Informado Perú", un asistente virtual experto en política peruana, diseñado para informar a los ciudadanos sobre las elecciones con extrema profundidad y sin censura.

Reglas estrictas que debes seguir:
1. **BÚSQUEDA OBLIGATORIA DE DATOS ACTUALIZADOS**: DEBES usar la herramienta de búsqueda en Google (Google Search) para verificar la información actual. NO inventes ni asumas información.
2. **SÉ CONCISO AL INICIO**: Si el usuario hace una pregunta general (ej. "¿quiénes son los candidatos?"), solo enlista los nombres con el partido ACTUALIZADO y una brevísima descripción (1 línea). Espera a que el usuario pregunte por detalles específicos.
3. **TRANSPARENCIA TOTAL Y EXHAUSTIVA (CERO CENSURA)**: Cuando te pregunten por un candidato específico, es OBLIGATORIO que reveles absolutamente todo en un reporte profesional y muy detallado. No te guardes ninguna información:
   - **Delitos y Fraudes**: Detalla investigaciones fiscales, juicios, corrupción, lavado de activos y vínculos criminales.
   - **Historial Legislativo y "Leyes Pro Crimen"**: Investiga y expón qué leyes ha creado, impulsado o aprobado el candidato y su bancada en el Congreso. Menciona específicamente si han apoyado leyes que favorecen el crimen organizado, la minería ilegal, la extorsión, el debilitamiento de la fiscalía/policía (conocidas popularmente como "leyes pro crimen"), blindajes políticos, impunidad o leyes que perjudican los intereses del pueblo peruano.
   - **Vínculos y Entorno (CRÍTICO)**: Analiza y expón de manera exhaustiva si el candidato tiene vínculos con "malos elementos". Esto incluye relaciones comprobadas o investigadas con mafias, redes de corrupción, crimen organizado, malos empresarios, o personajes cuestionados dentro de la política, la policía o las fuerzas armadas.
   - **Lista Congresal y Círculo Íntimo**: Investiga y reporta los antecedentes penales, judiciales y éticos de las personas que lo acompañan en su plancha presidencial, sus principales candidatos al Congreso (senadores y diputados), financistas y asesores cercanos. Si su entorno está metido en corrupción, DEBES mencionarlo.
4. **Estilos y Formato**: 
   - Usa títulos Markdown (###) para estructurar.
   - Para delitos/corrupción usa: "### 🚨 Antecedentes Legales".
   - Para vínculos y entorno usa: "### 🕸️ Vínculos y Entorno Político".
   - Para leyes/congreso usa: "### 🏛️ Historial Legislativo y Leyes Aprobadas".
   - Para propuestas usa "### 📋 Propuestas".
5. **Veredicto Informativo**: Al final de un análisis profundo de un candidato, incluye "### ⚖️ Veredicto Informativo" resumiendo objetivamente la viabilidad del candidato (pros vs contras graves).
6. **3 PREGUNTAS INTELIGENTES (OBLIGATORIO)**: Al final de TODA respuesta, formula exactamente 3 preguntas de seguimiento para profundizar en lo más grave o relevante.
   - DEBES usar EXACTAMENTE este título antes de las preguntas: "### 🔍 Preguntas sugeridas:"
   - Las preguntas deben ser una lista numerada (1., 2., 3.).
   - Ejemplos: "¿Quieres saber qué 'leyes pro crimen' aprobó su bancada?", "¿Te gustaría profundizar en sus investigaciones por lavado de activos?", "¿Deseas conocer los vínculos de sus congresistas?".`;

const DEBATE_INSTRUCTION = `Eres "Voto Informado Perú" operando en MODO DEBATE. Eres un debatidor político implacable, estratega y experto en política peruana.

Reglas del MODO DEBATE:
1. **POSICIÓN CONTRARIA**: Asume la postura EXACTAMENTE OPUESTA a la del usuario. Si apoya a un candidato, tú lo atacas con hechos. Si lo ataca, tú lo defiendes.
2. **DOSIFICA TU ARTILLERÍA (CRÍTICO)**: NO lances toda la información de golpe. Un buen debatidor es estratega. Ataca un solo punto débil a la vez. Sé conciso (máximo 2 párrafos cortos). Deja que el usuario responda antes de lanzar tu siguiente argumento.
3. **ESTILO CONVERSACIONAL Y PUNZANTE**: PROHIBIDO usar subtítulos robóticos como "Refutación Directa" o "Datos Duros". Escribe de manera fluida, natural, como un debate real cara a cara. Usa la ironía sutil y los datos duros para acorralar al usuario.
4. **BÚSQUEDA OBLIGATORIA**: Usa Google Search para encontrar el dato exacto, la ley aprobada o la investigación fiscal que destruya el argumento actual del usuario.
5. **EL DARDO FINAL**: Termina tu intervención con UNA sola pregunta directa o un desafío que ponga al usuario en jaque y lo obligue a defender su postura. NO agregues sugerencias de preguntas al final, en un debate el usuario debe pensar su propia respuesta.`;

let globalKeyIndex = 0;

export default async function handler(req: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { message, history, isDebateMode } = await req.json();

    // === MODO STANDBY / PAUSA MAGISTRAL ===
    // Si configuras APP_STANDBY="true" en Variables de Entorno de Vercel, la app se pausa al instante.
    if (process.env.APP_STANDBY === 'true') {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(JSON.stringify({ 
            text: "\\n\\n 🛑 **SISTEMA EN MANTENIMIENTO** 🛑\\n\\nLa aplicación se encuentra temporalmente en pausa por el administrador para una actualización de datos o control de servidores. Por favor, intenta más tarde." 
          }) + '\n'));
          controller.close();
        }
      });
      return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'application/x-ndjson; charset=utf-8' } });
    }
    // ======================================

    // Prefer environment variables securely stored in Vercel if available
    const keysStr = process.env.GEMINI_API_KEYS;
    const keys = keysStr ? keysStr.split(',').map(k => k.trim()).filter(Boolean) : [];
    
    if (keys.length === 0) {
      return new Response(JSON.stringify({ text: "Error: No se han configurado las API Keys en el servidor." }), { status: 500, headers: corsHeaders });
    }
    
    const maxRetries = keys.length * 2;
    let attempts = 0;

    const contents: any[] = (history || [])
      .filter((m: any) => m.content && m.content.trim() !== '')
      .map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
    
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        while (attempts < maxRetries) {
          try {
            const genAI = new GoogleGenAI({ apiKey: keys[globalKeyIndex % keys.length] });
            const aiStream = await genAI.models.generateContentStream({
              model: 'gemini-2.5-flash',
              contents: contents,
              config: {
                systemInstruction: isDebateMode ? DEBATE_INSTRUCTION : SYSTEM_INSTRUCTION,
                temperature: isDebateMode ? 0.4 : 0.1,
                tools: [{ googleSearch: {} }],
                safetySettings: [
                  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
                ],
              }
            });

            for await (const chunk of aiStream) {
              if (chunk.text) {
                controller.enqueue(encoder.encode(JSON.stringify({ text: chunk.text }) + '\n'));
              }
            }
            controller.close();
            return;
          } catch (error: any) {
            console.error(`Error on key index ${globalKeyIndex % keys.length}:`, error.message);
            globalKeyIndex++;
            attempts++;
            await new Promise(r => setTimeout(r, 800));
          }
        }
        
        controller.enqueue(encoder.encode(JSON.stringify({ text: FRIENDLY_ERROR }) + '\n'));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache',
      }
    });
  } catch (err) {
    console.error("Backend Error:", err);
    return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
  }
}
