import { Type } from '@google/genai'

export const QUIZ_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      description: 'The quiz questions',
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING, description: 'The quiz question text' },
          options: {
            type: Type.ARRAY,
            description: 'Exactly 4 answer options',
            items: { type: Type.STRING },
          },
          correctIndex: {
            type: Type.INTEGER,
            description: '0-based index of the correct option (0, 1, 2, or 3)',
          },
          explanation: {
            type: Type.STRING,
            description: 'Detailed explanation of why the correct answer is correct and why the other options are wrong',
          },
          topic: {
            type: Type.STRING,
            description: 'Which topic this question covers (must match one of the requested topics)',
          },
        },
        required: ['question', 'options', 'correctIndex', 'explanation', 'topic'],
        propertyOrdering: ['question', 'options', 'correctIndex', 'explanation', 'topic'],
      },
    },
  },
  required: ['questions'],
  propertyOrdering: ['questions'],
}
