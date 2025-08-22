import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({});

const scheduleMeetingFunctionDeclaration = {
  name: 'schedule_meeting',
  description: 'Schedules a meeting with specified attendees at a given time and date.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      attendees: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'List of people attending the meeting.',
      },
      date: {
        type: Type.STRING,
        description: 'Date of the meeting (e.g., "2024-07-29")',
      },
      time: {
        type: Type.STRING,
        description: 'Time of the meeting (e.g., "15:00")',
      },
      topic: {
        type: Type.STRING,
        description: 'The subject or topic of the meeting.',
      },
    },
    required: ['attendees', 'date', 'time', 'topic'],
  },
};

// ✅ Netlify function entry point
export async function handler(event, context) {
  try {
    // Send request with function declarations
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Schedule a meeting with Bob and Alice for 03/27/2025 at 10:00 AM about the Q3 planning.',
      config: {
        tools: [{
          functionDeclarations: [scheduleMeetingFunctionDeclaration]
        }],
      },
    });

    let result;
    if (response.functionCalls && response.functionCalls.length > 0) {
      const functionCall = response.functionCalls[0];
      result = {
        message: "Function call detected",
        function: functionCall.name,
        args: functionCall.args,
      };
    } else {
      result = {
        message: "No function call found in the response.",
        text: response.text,
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result, null, 2),
    };

  } catch (error) {
    console.error("Error in gemini-enrich-data:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
