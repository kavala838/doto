import type { Child } from '../types';
import { enhanceGoalDescription as openaiEnhanceGoalDescription } from './openaiService';
import { callOpenAI } from './openaiService';

// System prompt for subtask generation
export const SUBTASK_GENERATION_SYSTEM_PROMPT = `
You are a task breakdown assistant. Your job is to help users break down a goal or task into smaller, actionable subtasks.

When given a goal description, analyze it and create a list of specific subtasks that would help achieve the goal.
Each subtask should be:
1. Clear and actionable
2. Specific enough to be completed in a reasonable timeframe
3. Directly related to the parent goal

Respond with only the subtasks, formatted as a JSON array of objects with 'title' and 'description' properties.
For example:
[
  {
    "title": "Research existing solutions",
    "description": "Investigate current approaches to this problem and identify strengths and weaknesses."
  },
  {
    "title": "Create project plan",
    "description": "Develop a detailed timeline with milestones and resource requirements."
  }
]

Do not include any explanations, introductions, or additional text outside of the JSON array.
`;

// User prompt template for subtask generation
export const SUBTASK_GENERATION_USER_PROMPT = (description: string, count: number) => `
Please break down the following goal into ${count} subtasks:

${description.trim()}

Return only the JSON array of subtasks.
`;

// OpenAI API integration for generating subtasks
export const generateSubtasks = async (
  description: string,
  count: number = 3
): Promise<Child[]> => {
  try {
    // Call OpenAI API to generate subtasks
    const systemPrompt = SUBTASK_GENERATION_SYSTEM_PROMPT;
    const userPrompt = SUBTASK_GENERATION_USER_PROMPT(description, count);
    
    const response = await callOpenAI(systemPrompt, userPrompt);
    
    try {
      // Parse the JSON response
      const subtasksData = JSON.parse(response);
      
      // Generate a unique ID prefix based on timestamp
      const idPrefix = `ai_${Date.now()}`;
      
      // Map the parsed data to Child objects
      const subtasks: Child[] = subtasksData.map((item: any, index: number) => {
        const subtaskId = `${idPrefix}_${index}`;
        return {
          id: subtaskId,
          title: item.title || `Subtask ${index + 1}`,
          description: item.description || `Generated subtask ${index + 1} for the goal.`,
          childs: [],
          done: 0
        };
      });
      
      // Ensure we have the requested number of subtasks
      while (subtasks.length < count) {
        const index = subtasks.length;
        const subtaskId = `${idPrefix}_${index}`;
        subtasks.push({
          id: subtaskId,
          title: `Subtask ${index + 1}`,
          description: `Additional subtask ${index + 1} for the goal.`,
          childs: [],
          done: 0
        });
      }
      
      return subtasks.slice(0, count); // Ensure we return exactly the requested count
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      // Fall back to generating mock subtasks
      return generateMockSubtasks(description, count);
    }
  } catch (error) {
    console.error('Error generating subtasks:', error);
    // Fall back to generating mock subtasks
    return generateMockSubtasks(description, count);
  }
};

// Fallback function to generate mock subtasks
const generateMockSubtasks = (description: string, count: number): Child[] => {
  // Generate a unique ID prefix based on timestamp
  const idPrefix = `ai_${Date.now()}`;
  
  // Create simple subtasks based on the description
  const subtasks: Child[] = [];
  
  // Extract keywords from description
  const words = description.split(' ').filter(word => word.length > 3);
  const uniqueWords = Array.from(new Set(words));
  
  for (let i = 0; i < count; i++) {
    const subtaskId = `${idPrefix}_${i}`;
    
    // Generate a simple title based on the parent description
    const randomWord = uniqueWords.length > i 
      ? uniqueWords[i]
      : `Task ${i + 1}`;
    
    // Generate more meaningful mock subtasks based on common project phases
    const phases = [
      { title: "Research", desc: "Gather information and analyze requirements" },
      { title: "Design", desc: "Create a detailed plan and specifications" },
      { title: "Implement", desc: "Execute the plan and build the solution" },
      { title: "Test", desc: "Verify functionality and identify issues" },
      { title: "Deploy", desc: "Release the solution to production" },
      { title: "Document", desc: "Create comprehensive documentation" },
      { title: "Review", desc: "Evaluate results and gather feedback" }
    ];
    
    const phase = phases[i % phases.length];
    
    subtasks.push({
      id: subtaskId,
      title: `${phase.title} ${randomWord.charAt(0).toUpperCase() + randomWord.slice(1)}`,
      description: `${phase.desc} for the ${randomWord} component.`,
      childs: [],
      done: 0
    });
  }
  
  return subtasks;
};

// OpenAI API integration for enhancing goal descriptions
export const enhanceGoalDescription = async (
  description: string
): Promise<string> => {
  try {
    // Call the OpenAI service for the enhanced description
    return await openaiEnhanceGoalDescription(description);
  } catch (error) {
    console.error('Error enhancing description:', error);
    throw new Error('Failed to enhance goal description');
  }
};

// System prompt for goal description enhancement
export const GOAL_ENHANCEMENT_SYSTEM_PROMPT = `
You are a goal planner assistant. The user will give you a natural-language description of what they want to achieve — this could be a project to build, a skill to learn, a task to complete, or anything else.

Based only on this user-provided description, analyze it and produce an output in two plain-text paragraphs, each beginning with a heading. These are the required sections:

Summary: A short paragraph that clearly describes what the user wants to accomplish, rewritten in clean, clear language. Focus on their intent.

Topics: A single paragraph listing all the major subjects, tools, sub-skills, or concepts involved in achieving the goal. Use commas to separate items. Write this as flowing text — no bullet points, no grouping, no markdown, and no extra commentary.

Respond only with these two paragraphs. Do not include anything else.

Example:

User description: "I want to learn data science using Python, especially focusing on analysis, ML, and visualization so I can work on real-world datasets."

Summary:
The user aims to become proficient in data science using Python, with a strong focus on data analysis, machine learning, and visualization. The ultimate goal is to apply these skills to real-world datasets for meaningful insights and project work.

Topics:
This learning path includes Python basics, NumPy, pandas for data manipulation, data cleaning and preprocessing techniques, data wrangling, matplotlib and seaborn for visualization, exploratory data analysis, probability and statistics, scikit-learn for supervised and unsupervised learning, model evaluation metrics, cross-validation, hyperparameter tuning, using real-world datasets from sources like Kaggle, data storytelling, Jupyter notebooks, version control using Git, and possibly integrating models into simple applications using Flask or Streamlit.
`;

// User prompt template for goal description enhancement
export const GOAL_ENHANCEMENT_USER_PROMPT = (description: string) => `
${description.trim()}
`; 