// OpenAI service for API calls
// This is a placeholder for the actual OpenAI integration
// To use real OpenAI API, replace this with actual API calls

import { GOAL_ENHANCEMENT_SYSTEM_PROMPT, GOAL_ENHANCEMENT_USER_PROMPT } from './aiService';
import { callSecureApi } from '../lib/secureApiClient';

// Fallback function to generate a mock response
const generateFallbackResponse = (description: string): string => {
  // Generate a simple structured response
  const words = description.split(' ').filter(w => w.length > 3);
  const uniqueWords = Array.from(new Set(words)).slice(0, 10);
  
  // Simple extraction of potential goal keywords
  const keywords = uniqueWords.map(w => w.charAt(0).toUpperCase() + w.slice(1));
  
  return `
Summary:
${description.length > 100 ? description.substring(0, 100) + '...' : description} This goal aims to achieve a well-structured outcome that meets the user's requirements and provides value to stakeholders.

Topics:
The key areas involved in this goal include ${keywords[0] || 'planning'}, ${keywords[1] || 'design'}, ${keywords[2] || 'implementation'}, ${keywords[3] || 'testing'}, ${keywords[4] || 'documentation'}, ${keywords[5] || 'user experience'}, ${keywords[6] || 'performance optimization'}, ${keywords[7] || 'quality assurance'}, ${keywords[8] || 'deployment'}, and ${keywords[9] || 'maintenance'}. Each of these components will need careful consideration and execution to ensure the overall success of the goal.
`.trim();
};

// Function to call OpenAI API to enhance descriptions
export const callOpenAI = async (
  systemPrompt: string,
  userPrompt: string
): Promise<string> => {
  try {
    const data = await callSecureApi<any>({
      service: 'openai',
      path: '/v1/chat/completions',
      method: 'POST',
      body: {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      }
    });

    return data.choices[0].message.content;
    
  } catch (error) {
    console.error('OpenAI API call failed:', error);
    console.warn('Using fallback response generator.');
    return generateFallbackResponse(userPrompt.trim());
  }
};

// Function to enhance goal descriptions using OpenAI
export const enhanceGoalDescription = async (description: string): Promise<string> => {
  try {
    const systemPrompt = GOAL_ENHANCEMENT_SYSTEM_PROMPT;
    const userPrompt = GOAL_ENHANCEMENT_USER_PROMPT(description);
    
    return await callOpenAI(systemPrompt, userPrompt);
  } catch (error) {
    console.error('Failed to enhance goal description:', error);
    throw new Error('Failed to enhance goal description with AI');
  }
}; 