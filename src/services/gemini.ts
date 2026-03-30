// Archivo transformado para actuar solo como CLIENTE
// La lógica compleja y las API Keys ahora viven protegidas en /api/chat.ts de Vercel.

const API_URL = import.meta.env.VITE_API_URL || '/api/chat';

class PoliticalChatService {
  private isDebateMode: boolean = false;

  constructor(isDebateMode: boolean = false) {
    this.isDebateMode = isDebateMode;
  }

  async *sendMessageStream(params: { message: string, history?: any[] }) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Opcional: si el servidor es muy lento, se podría configurar un timeout.
        body: JSON.stringify({
          message: params.message,
          history: params.history,
          isDebateMode: this.isDebateMode
        })
      });

      if (!response.ok) {
        throw new Error(`Error en el servidor: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No se recibió stream del servidor');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');

          // El último elemento podría ser un string parcial que no ha acabado con \n
          // Lo dejamos en el buffer para la próxima iteración.
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                // Respetamos la estructura que espera la UI (App.tsx): chunk as GenerateContentResponse
                if (data && data.text) {
                  yield { text: data.text };
                }
              } catch (err) {
                console.error('Error parseando fragmento (chunk) del servidor:', err, "Línea conflictiva:", line);
              }
            }
          }
        }

        if (done) {
          // Procesar cualquier remanente final en el buffer
          if (buffer.trim()) {
            try {
              const data = JSON.parse(buffer);
              if (data && data.text) {
                yield { text: data.text };
              }
            } catch (err) {
              // Ignorar errores en el caso borde del último bit si no es JSON
            }
          }
          break;
        }
      }

    } catch (error) {
      console.error("Error contactando al servidor central:", error);
      yield { text: "\n\n*(Error: El servidor central no está disponible. Revisa tu conexión a internet o verifica que el backend de Vercel esté vivo)*" };
    }
  }
}

export function createPoliticalChat(isDebateMode: boolean = false): any {
  return new PoliticalChatService(isDebateMode);
}
