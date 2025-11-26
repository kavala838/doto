import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import type { AppData, Goal, Tag } from '../types';
import { loadData, saveData, fetchGistData, getGitHubToken } from '../utils/storageUtils';

// Import storage key constant
const STORAGE_KEY = 'doto_app_data';

// Default tags
const defaultTags: Tag[] = [
  { id: 'tag_1', name: 'Important', color: '#ef4444', isHot: true },
  { id: 'tag_2', name: 'Work', color: '#3b82f6', isHot: false },
  { id: 'tag_3', name: 'Personal', color: '#10b981', isHot: false },
  { id: 'tag_4', name: 'Health', color: '#8b5cf6', isHot: false },
  { id: 'tag_5', name: 'Learning', color: '#f59e0b', isHot: false },
];

interface AppContextType {
  data: AppData;
  loading: boolean;
  error: string | null;
  updateGoals: (goals: Goal[]) => void;
  addGoal: (goal: Goal) => void;
  setData: (data: AppData, skipGistUpdate?: boolean) => void;
  saveData: () => Promise<void>;
  isSaving: boolean;
  lastSaved: Date | null;
}

const defaultContext: AppContextType = {
  data: { goals: [], tags: defaultTags },
  loading: true,
  error: null,
  updateGoals: () => {},
  addGoal: () => {},
  setData: () => {},
  saveData: () => Promise.resolve(),
  isSaving: false,
  lastSaved: null,
};

const AppContext = createContext<AppContextType>(defaultContext);

export const useAppContext = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>(defaultContext.data);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);
  
  // Use a ref to keep track of the latest data for auto-save
  const dataRef = useRef<AppData>(data);
  
  // Update the ref whenever data changes
  useEffect(() => {
    console.log("Data changed in AppContext", { 
      goals: data.goals.length, 
      tags: data.tags?.length,
      goalIds: data.goals.map(g => g.id)
    });
    dataRef.current = data;
    
    // Save data to localStorage immediately when it changes
    // But only if it's not the initial load
    if (!loading && initialLoadComplete) {
      console.log("Saving data after change");
      saveData(data).catch(err => {
        console.error("Error saving data:", err);
      });
      setLastSaved(new Date());
    }
  }, [data, loading, initialLoadComplete]);
  
  // Save data manually with force update to Gist
  const manualSaveData = useCallback(async () => {
    setIsSaving(true);
    console.log("Manual save triggered");
    try {
      await saveData(dataRef.current, true); // Force Gist update
      setLastSaved(new Date());
      console.log("Manual save completed");
    } catch (err) {
      console.error('Failed to save data:', err);
    } finally {
      setIsSaving(false);
    }
  }, []);
  
  // Auto-save every 5 minutes
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (dataRef.current.goals.length > 0) {
        console.log("Auto-save triggered");
        saveData(dataRef.current, true) // Force Gist update
          .then(() => {
            setLastSaved(new Date());
            console.log("Auto-save completed");
          })
          .catch(err => {
            console.error("Auto-save failed:", err);
          });
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(autoSaveInterval);
  }, []);

  useEffect(() => {
    const initializeData = async () => {
      try {
        console.log("%c STARTUP DATA FLOW: Initializing data...", "background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px;");
        
        // Force a fresh fetch from GitHub Gist on every app load/reload
        console.log("%c STARTUP DATA FLOW: Forcing fetch from GitHub Gist on application start/reload", "background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px;");
        
        try {
          // Try to get GitHub token from environment variable
          const token = getGitHubToken();
          
          if (token) {
            console.log("%c STARTUP DATA FLOW: GitHub token found from environment variable, fetching from Gist directly", "background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px;");
            
            // Clear any existing data in localStorage to ensure we start fresh
            localStorage.removeItem(STORAGE_KEY);
            console.log("%c STARTUP DATA FLOW: Cleared localStorage to ensure fresh start", "background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px;");
            
            // Directly fetch from Gist if we have a token
            const gistData = await fetchGistData();
            
            // Ensure tags exist in the fetched data
            const dataWithTags = {
              ...gistData,
              tags: gistData.tags || defaultTags
            };
            
            // Ensure each goal has a tags array
            if (dataWithTags.goals) {
              dataWithTags.goals = dataWithTags.goals.map((goal: Goal) => ({
                ...goal,
                tags: goal.tags || []
              }));
            }
            
            console.log("%c STARTUP DATA FLOW: Setting initial data from Gist", "background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px;", { 
              goals: dataWithTags.goals.length, 
              tags: dataWithTags.tags.length 
            });
            
            // Use direct setState to avoid any potential circular updates
            setData(dataWithTags);
            dataRef.current = dataWithTags;
            setLoading(false);
            // Mark initial load as complete after a short delay
            setTimeout(() => setInitialLoadComplete(true), 500);
            return;
          } else {
            console.log("%c STARTUP DATA FLOW: No GitHub token found in environment variable VITE_GIST_KEY, falling back to regular loading flow", "background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px;");
          }
        } catch (gistError) {
          console.error("%c STARTUP DATA FLOW: Direct Gist fetch failed, continuing with regular flow:", "background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px;", gistError);
        }
        
        // If direct Gist fetch failed or no token, fall back to regular loading flow
        console.log("%c STARTUP DATA FLOW: Attempting to load data from GitHub Gist first, then falling back to localStorage...", "background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px;");
        const fetchedData = await loadData();
        
        // Ensure tags exist in the fetched data
        const dataWithTags = {
          ...fetchedData,
          tags: fetchedData.tags || defaultTags
        };
        
        // Ensure each goal has a tags array
        if (dataWithTags.goals) {
          dataWithTags.goals = dataWithTags.goals.map(goal => ({
            ...goal,
            tags: goal.tags || []
          }));
        }
        
        console.log("%c STARTUP DATA FLOW: Setting initial data from fallback flow", "background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px;", { 
          goals: dataWithTags.goals.length, 
          tags: dataWithTags.tags.length 
        });
        
        // Use direct setState to avoid any potential circular updates
        setData(dataWithTags);
        dataRef.current = dataWithTags;
      } catch (err) {
        setError('Failed to load data from both GitHub Gist and localStorage');
        console.error("%c STARTUP DATA FLOW: Error loading data:", "background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px;", err);
      } finally {
        setLoading(false);
        // Mark initial load as complete after a short delay
        console.log("%c STARTUP DATA FLOW: Initial load complete, enabling auto-save after delay", "background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px;");
        setTimeout(() => {
          setInitialLoadComplete(true);
          console.log("%c STARTUP DATA FLOW: Auto-save enabled", "background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px;");
        }, 1000);
      }
    };

    initializeData();
  }, []);

  // Custom setData wrapper to ensure we always update localStorage
  const setDataWithSave = useCallback((newData: AppData, skipGistUpdate = false) => {
    console.log("Setting data with save", { 
      goals: newData.goals.length, 
      tags: newData.tags?.length,
      skipGistUpdate
    });
    
    // Create a deep copy of the data to ensure React detects the change
    const dataCopy = JSON.parse(JSON.stringify(newData));
    
    // Ensure each goal has a tags array
    if (dataCopy.goals) {
      dataCopy.goals = dataCopy.goals.map((goal: Goal) => ({
        ...goal,
        tags: goal.tags || []
      }));
    }
    
    // Ensure tags array exists
    if (!dataCopy.tags) {
      dataCopy.tags = defaultTags;
    }
    
    // Update state
    setData(dataCopy);
    
    // Force save to localStorage immediately
    saveData(dataCopy, false, skipGistUpdate).catch(err => {
      console.error("Error saving data:", err);
    });
    setLastSaved(new Date());
    
    console.log("Data saved immediately");
  }, []);

  const updateGoals = useCallback((goals: Goal[]) => {
    console.log("Updating goals", { count: goals.length });
    const updatedData = { ...data, goals };
    // Use setDataWithSave directly to avoid type errors
    setDataWithSave(updatedData, false); // Allow Gist update for user-initiated changes
  }, [data, setDataWithSave]);

  const addGoal = useCallback((goal: Goal) => {
    console.log("Adding goal", { id: goal.id });
    const updatedGoals = [...data.goals, goal];
    const updatedData = { ...data, goals: updatedGoals };
    // Use setDataWithSave directly to avoid type errors
    setDataWithSave(updatedData, false); // Allow Gist update for user-initiated changes
  }, [data, setDataWithSave]);

  return (
    <AppContext.Provider value={{ 
      data, 
      loading, 
      error, 
      updateGoals, 
      addGoal, 
      setData: setDataWithSave, 
      saveData: manualSaveData,
      isSaving,
      lastSaved
    }}>
      {children}
    </AppContext.Provider>
  );
}; 