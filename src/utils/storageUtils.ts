import { callSecureApi } from '../lib/secureApiClient';
import type { AppData, Tag } from '../types';

const STORAGE_KEY = 'doto_app_data';
const LAST_GIST_UPDATE_KEY = 'last_gist_update';

// Default tags
const defaultTags: Tag[] = [
  { id: 'tag_1', name: 'Important', color: '#ef4444', isHot: true },
  { id: 'tag_2', name: 'Work', color: '#3b82f6', isHot: false },
  { id: 'tag_3', name: 'Personal', color: '#10b981', isHot: false },
  { id: 'tag_4', name: 'Health', color: '#8b5cf6', isHot: false },
  { id: 'tag_5', name: 'Learning', color: '#f59e0b', isHot: false },
];

/**
 * Get GitHub token from environment variable
 */
export const getGitHubToken = (): string | null => {
  console.log("%c TOKEN DEBUG: Tokens are now handled server-side via Firebase Functions.", "background: #9c27b0; color: white; padding: 2px 5px; border-radius: 3px;");
  return null;
};

/**
 * Get Gist ID - either from environment variable or default
 */
export const getGistId = (): string => {
  console.log("%c GIST DEBUG: Gist ID is now managed in Firebase Functions config.", "background: #ff0000; color: white; padding: 2px 5px; border-radius: 3px;");
  return '';
};

/**
 * Set GitHub token in localStorage - No longer used, kept for compatibility
 * @deprecated Use VITE_GIST_KEY environment variable instead
 */
export const setGitHubToken = (_token: string): void => {
  console.log("%c TOKEN DEBUG: Setting GitHub token is disabled. Using environment variable VITE_GIST_KEY instead.", "background: #9c27b0; color: white; padding: 2px 5px; border-radius: 3px;");
  // No longer storing token in localStorage
};

/**
 * Load data from GitHub Gist first, then fallback to localStorage
 * This function is used as a fallback when direct Gist fetching fails in AppContext
 */
export const loadData = async (): Promise<AppData> => {
  try {
    console.log("Loading data (fallback flow)...");
    
    // Check if we have a token
    const token = getGitHubToken();
    
    // If we have a token, try GitHub Gist first
    if (token) {
      try {
        console.log("Token found, trying to fetch from GitHub Gist...");
        const gistData = await fetchGistData();
        console.log("Successfully loaded data from GitHub Gist");
        return gistData;
      } catch (gistError) {
        console.error("Failed to fetch from Gist despite having token, falling back to localStorage:", gistError);
      }
    } else {
      console.log("No GitHub token found, skipping Gist fetch");
    }
    
    // If Gist fetch fails or no token, try to get data from local storage
    const storedData = localStorage.getItem(STORAGE_KEY);
    
    if (storedData) {
      console.log("Found data in localStorage");
      const parsedData = JSON.parse(storedData) as AppData;
      
      // Ensure tags exist
      if (!parsedData.tags) {
        console.log("Adding default tags to localStorage data");
        parsedData.tags = defaultTags;
      }
      
      // Ensure each goal has a tags array
      if (parsedData.goals) {
        parsedData.goals = parsedData.goals.map(goal => ({
          ...goal,
          tags: goal.tags || []
        }));
      }
      
      return parsedData;
    }
    
    // If nothing in localStorage either, return default data
    console.log("No data found in localStorage, using default data");
    return { goals: [], tags: defaultTags };
  } catch (error) {
    console.error("Error loading data:", error);
    // Return default data if nothing found or error
    return { goals: [], tags: defaultTags };
  }
};

/**
 * Fetch data from GitHub Gist
 * This function will throw an error if it fails to fetch from Gist
 */
export const fetchGistData = async (): Promise<AppData> => {
  console.log("%c GIST DATA FLOW: Fetching data from Gist...", "background: #4caf50; color: white; padding: 2px 5px; border-radius: 3px;");

  try {
    const response = await callSecureApi<any>({
      service: 'gist',
      method: 'GET'
    });

    console.log("%c GIST DEBUG: Raw Gist response:", "background: #ff0000; color: white; padding: 2px 5px; border-radius: 3px;", response);

    const fileKeys = Object.keys(response.files || {});
    console.log("%c GIST DEBUG: Available files in Gist:", "background: #ff0000; color: white; padding: 2px 5px; border-radius: 3px;", fileKeys);

    if (fileKeys.length === 0) {
      throw new Error("No files found in the Gist");
    }

    const fileKey = fileKeys[0];
    console.log("%c GIST DEBUG: Using file:", "background: #ff0000; color: white; padding: 2px 5px; border-radius: 3px;", fileKey);

    const content = response.files[fileKey].content as string;
    console.log("%c GIST DEBUG: File content length:", "background: #ff0000; color: white; padding: 2px 5px; border-radius: 3px;", content.length);

    try {
      const data = JSON.parse(content) as AppData;
      console.log("%c GIST DEBUG: Successfully parsed JSON data:", "background: #ff0000; color: white; padding: 2px 5px; border-radius: 3px;", {
        hasGoals: !!data.goals,
        goalCount: data.goals?.length || 0,
        hasTags: !!data.tags,
        tagCount: data.tags?.length || 0
      });

      console.log("%c GIST DATA FLOW: Successfully fetched data from Gist", "background: #4caf50; color: white; padding: 2px 5px; border-radius: 3px;");

      // Ensure tags exist
      if (!data.tags) {
        console.log("Adding default tags to Gist data");
        data.tags = defaultTags;
      }

      // Ensure each goal has a tags array
      if (data.goals) {
        data.goals = data.goals.map((goal: any) => ({
          ...goal,
          tags: goal.tags || []
        }));
      }

      // Store in local storage and update timestamp
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(LAST_GIST_UPDATE_KEY, Date.now().toString());
      console.log("%c GIST DATA FLOW: Updated localStorage with data from Gist", "background: #4caf50; color: white; padding: 2px 5px; border-radius: 3px;");

      return data;
    } catch (parseError) {
      console.error("%c GIST DEBUG: Failed to parse JSON content:", "background: #ff0000; color: white; padding: 2px 5px; border-radius: 3px;", parseError);
      console.log("%c GIST DEBUG: Raw content preview:", "background: #ff0000; color: white; padding: 2px 5px; border-radius: 3px;", content.substring(0, 100) + "...");
      throw new Error("Failed to parse Gist content as JSON");
    }
  } catch (error: any) {
    console.error("Error fetching from Gist:", error);
    throw error;
  }
};

/**
 * Save data to localStorage and GitHub Gist
 * @param data The data to save
 * @param forceGistUpdate Whether to force an update to the Gist
 * @param skipGistUpdate Whether to skip updating the Gist entirely (used during initialization)
 */
export const saveData = async (
  data: AppData, 
  forceGistUpdate = false, 
  skipGistUpdate = false
): Promise<void> => {
  try {
    console.log("Saving data...", skipGistUpdate ? "(skipping Gist update)" : "");
    
    // Ensure tags exist
    const dataToSave = { 
      ...data,
      tags: data.tags || defaultTags
    };
    
    // Ensure each goal has a tags array
    if (dataToSave.goals) {
      dataToSave.goals = dataToSave.goals.map(goal => ({
        ...goal,
        tags: goal.tags || []
      }));
    }
    
    // Stringify the data
    const jsonData = JSON.stringify(dataToSave);
    console.log("JSON data size:", jsonData.length, "bytes");
    
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, jsonData);
    console.log("Data saved to localStorage successfully");
    
    // Skip Gist update if requested
    if (skipGistUpdate) {
      console.log("Skipping Gist update as requested");
      return;
    }
    
    // Check if we should update the Gist
    const now = Date.now();
    const lastGistUpdate = parseInt(localStorage.getItem(LAST_GIST_UPDATE_KEY) || '0', 10);
    const fiveMinutes = 5 * 60 * 1000;
    
    if (forceGistUpdate || (now - lastGistUpdate > fiveMinutes)) {
      await updateGist(dataToSave);
      localStorage.setItem(LAST_GIST_UPDATE_KEY, now.toString());
    }
  } catch (error) {
    console.error("Error saving data:", error);
  }
};

/**
 * Update GitHub Gist with current data
 */
export const updateGist = async (data: AppData): Promise<void> => {
  try {
    console.log("%c GIST UPDATE DEBUG: Updating GitHub Gist...", "background: #ff0000; color: white; padding: 2px 5px; border-radius: 3px;");
    console.log("%c GIST UPDATE DEBUG: Data summary:", "background: #ff0000; color: white; padding: 2px 5px; border-radius: 3px;", {
      hasGoals: !!data.goals,
      goalCount: data.goals?.length || 0,
      hasTags: !!data.tags,
      tagCount: data.tags?.length || 0
    });
    
    const content = JSON.stringify(data, null, 2);
    console.log("%c GIST UPDATE DEBUG: Content length:", "background: #ff0000; color: white; padding: 2px 5px; border-radius: 3px;", content.length);
    
    await callSecureApi({
      service: 'gist',
      method: 'PATCH',
      body: {
        files: {
          'doto_data.json': {
            content
          }
        }
      }
    });
    console.log("%c GIST UPDATE DEBUG: GitHub Gist updated successfully", "background: #ff0000; color: white; padding: 2px 5px; border-radius: 3px;");
  } catch (error) {
    console.error("Error updating GitHub Gist:", error);
    throw error;
  }
};

/**
 * Save raw JSON string to localStorage and GitHub Gist
 */
export const saveRawJson = async (jsonString: string, forceGistUpdate = true): Promise<boolean> => {
  try {
    // Parse to validate
    const parsedData = JSON.parse(jsonString) as AppData;
    
    // Save directly to localStorage
    localStorage.setItem(STORAGE_KEY, jsonString);
    console.log("Raw JSON saved to localStorage successfully");
    
    // Update GitHub Gist if token exists
    try {
      if (forceGistUpdate) {
        await updateGist(parsedData);
        localStorage.setItem(LAST_GIST_UPDATE_KEY, Date.now().toString());
      }
    } catch (gistError) {
      console.error("Failed to update Gist, but localStorage was updated:", gistError);
    }
    
    return true;
  } catch (error) {
    console.error("Error saving raw JSON:", error);
    return false;
  }
};

/**
 * Get raw JSON string from localStorage
 */
export const getRawJson = (): string => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return data;
    }
  } catch (error) {
    console.error("Error getting raw JSON from localStorage:", error);
  }
  
  return JSON.stringify({ goals: [], tags: defaultTags }, null, 2);
};

/**
 * Clear all data from localStorage
 */
export const clearData = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log("Data cleared from localStorage");
  } catch (error) {
    console.error("Error clearing data from localStorage:", error);
  }
};

/**
 * Create a new Gist with default data
 * This is useful when a user has a token but no Gist yet
 */
export const createNewGist = async (): Promise<string> => {
  try {
    console.log("%c GIST CREATE: Creating new GitHub Gist...", "background: #9c27b0; color: white; padding: 2px 5px; border-radius: 3px;");
    
    // Create initial data with default tags
    const initialData: AppData = {
      goals: [],
      tags: defaultTags
    };
    
    const content = JSON.stringify(initialData, null, 2);
    
    const response = await callSecureApi<any>({
      service: 'gist',
      path: '/gists',
      method: 'POST',
      body: {
        description: 'Doto App Data',
        public: false,
        files: {
          'doto_data.json': {
            content
          }
        }
      }
    });
    
    const newGistId = response.id;
    console.log("%c GIST CREATE: Created new Gist with ID:", "background: #9c27b0; color: white; padding: 2px 5px; border-radius: 3px;", newGistId);
    console.log("%c GIST CREATE: Gist ID managed via Firebase Functions config.", "background: #9c27b0; color: white; padding: 2px 5px; border-radius: 3px;");
    
    // Store the initial data in localStorage
    localStorage.setItem(STORAGE_KEY, content);
    localStorage.setItem(LAST_GIST_UPDATE_KEY, Date.now().toString());
    
    return newGistId;
  } catch (error: any) {
    console.error("Error creating new Gist:", error);
    throw error;
  }
}; 