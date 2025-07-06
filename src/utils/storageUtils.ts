import axios from 'axios';
import type { AppData, Tag } from '../types';

const STORAGE_KEY = 'doto_app_data';
const GIST_ID = '9743a632b1053d80be721f0f41004daa';
const GITHUB_TOKEN_KEY = 'github_token';
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
 * Get GitHub token from localStorage
 */
export const getGitHubToken = (): string | null => {
  return localStorage.getItem(GITHUB_TOKEN_KEY);
};

/**
 * Set GitHub token in localStorage
 */
export const setGitHubToken = (token: string): void => {
  localStorage.setItem(GITHUB_TOKEN_KEY, token);
};

/**
 * Load data from localStorage or GitHub Gist
 */
export const loadData = async (): Promise<AppData> => {
  try {
    console.log("Loading data...");
    // Try to get data from local storage first
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
      
      // Try to fetch from Gist in the background to get latest data
      fetchGistData().catch(err => console.error("Background Gist fetch failed:", err));
      
      return parsedData;
    }
    
    // If not in local storage, fetch from GitHub Gist
    return await fetchGistData();
  } catch (error) {
    console.error("Error loading data:", error);
    // Return default data if nothing found or error
    return { goals: [], tags: defaultTags };
  }
};

/**
 * Fetch data from GitHub Gist
 */
export const fetchGistData = async (): Promise<AppData> => {
  try {
    console.log("Fetching data from Gist...");
    
    const token = getGitHubToken();
    const headers: Record<string, string> = {};
    
    // Add authorization header if token exists
    if (token) {
      headers.Authorization = `token ${token}`;
      headers.Accept = 'application/vnd.github.v3+json';
    }
    
    const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
      headers
    });
    
    const fileKey = Object.keys(response.data.files)[0];
    const content = response.data.files[fileKey].content;
    const data = JSON.parse(content) as AppData;
    
    console.log("Successfully fetched data from Gist");
    
    // Ensure tags exist
    if (!data.tags) {
      console.log("Adding default tags to Gist data");
      data.tags = defaultTags;
    }
    
    // Ensure each goal has a tags array
    if (data.goals) {
      data.goals = data.goals.map(goal => ({
        ...goal,
        tags: goal.tags || []
      }));
    }
    
    // Store in local storage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    
    return data;
  } catch (error) {
    console.error("Error fetching from Gist:", error);
    
    // If Gist fetch fails, use default data or existing localStorage data
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      return JSON.parse(storedData) as AppData;
    }
    
    // If nothing in localStorage either, return default data
    return { goals: [], tags: defaultTags };
  }
};

/**
 * Save data to localStorage and GitHub Gist
 */
export const saveData = async (data: AppData, forceGistUpdate = false): Promise<void> => {
  try {
    console.log("Saving data...");
    
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
    const token = getGitHubToken();
    
    if (!token) {
      console.log("No GitHub token found, skipping Gist update");
      return;
    }
    
    console.log("Updating GitHub Gist...");
    
    const content = JSON.stringify(data, null, 2);
    
    await axios.patch(
      `https://api.github.com/gists/${GIST_ID}`,
      {
        files: {
          'doto_data.json': {
            content
          }
        }
      },
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );
    
    console.log("GitHub Gist updated successfully");
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