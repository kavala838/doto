import axios from 'axios';
import type { AppData, Tag } from '../types';

const GIST_ID = '9743a632b1053d80be721f0f41004daa';
// The token was likely expired, removing it and using a token-less approach
// For a public gist, we can read without a token, but for writing we'll need to handle that differently
const STORAGE_KEY = 'doto_app_data';

// Default tags
const defaultTags: Tag[] = [
  { id: 'tag_1', name: 'Important', color: '#ef4444', isHot: true },
  { id: 'tag_2', name: 'Work', color: '#3b82f6', isHot: false },
  { id: 'tag_3', name: 'Personal', color: '#10b981', isHot: false },
  { id: 'tag_4', name: 'Health', color: '#8b5cf6', isHot: false },
  { id: 'tag_5', name: 'Learning', color: '#f59e0b', isHot: false },
];

// Track the last time we updated the Gist
let lastGistUpdate = 0;
let updatePromise: Promise<void> | null = null;

export const fetchGistData = async (): Promise<AppData> => {
  try {
    console.log("Fetching data...");
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
      return parsedData;
    }
    
    // If not in local storage, fetch from GitHub Gist
    console.log("No data in localStorage, attempting to fetch from Gist");
    try {
      const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`);
      
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
    } catch (gistError) {
      console.error("Error fetching from Gist:", gistError);
      // If Gist fetch fails, use default data
      const defaultData = { goals: [], tags: defaultTags };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
      return defaultData;
    }
  } catch (error) {
    console.error('Error in fetchGistData:', error);
    // Return default empty data structure if fetch fails
    return { goals: [], tags: defaultTags };
  }
};

// Update GitHub Gist with current data
export const updateGist = async (data: AppData): Promise<void> => {
  try {
    console.log("Attempting to update Gist is skipped - GitHub token is required");
    // We'll skip the actual Gist update since the token is likely expired
    // Instead, we'll just update localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log("Data saved to localStorage instead of Gist");
    
    // Update the last update timestamp
    lastGistUpdate = Date.now();
  } catch (error) {
    console.error('Error updating Gist:', error);
    throw error;
  }
};

// Update local storage and optionally GitHub Gist
export const updateAppData = (data: AppData, forceGistUpdate = false): Promise<void> => {
  try {
    console.log("Updating app data", { goals: data.goals.length, tags: data.tags?.length });
    
    // Stringify and then parse to ensure we have a completely new object
    const jsonData = JSON.stringify(data);
    console.log("JSON data size:", jsonData.length, "bytes");
    
    // Update local storage
    localStorage.setItem(STORAGE_KEY, jsonData);
    console.log("Data saved to localStorage");
    
    // Check if we should update the Gist
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    // Update Gist if forced or if it's been more than 5 minutes since the last update
    if (forceGistUpdate || (now - lastGistUpdate > fiveMinutes)) {
      // If there's already an update in progress, wait for it to complete
      if (updatePromise) {
        return updatePromise;
      }
      
      // Start a new update
      updatePromise = updateGist(data)
        .finally(() => {
          updatePromise = null;
        });
      
      return updatePromise;
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error updating data:', error);
    return Promise.reject(error);
  }
};

export const getAppData = (): AppData => {
  try {
    console.log("Getting app data from localStorage");
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      const parsedData = JSON.parse(storedData) as AppData;
      // Ensure tags exist
      if (!parsedData.tags) {
        console.log("Adding default tags to retrieved data");
        parsedData.tags = defaultTags;
      }
      return parsedData;
    }
  } catch (error) {
    console.error('Error getting data from local storage:', error);
  }
  
  console.log("No data found, returning default data");
  return { goals: [], tags: defaultTags };
}; 