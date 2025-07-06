import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import type { AppData, Goal, Tag } from '../types';
import { loadData, saveData } from '../utils/storageUtils';

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
  setData: (data: AppData) => void;
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
    if (!loading) {
      console.log("Saving data after change");
      saveData(data).catch(err => {
        console.error("Error saving data:", err);
      });
      setLastSaved(new Date());
    }
  }, [data, loading]);
  
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
        console.log("Initializing data...");
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
        
        console.log("Setting initial data", { 
          goals: dataWithTags.goals.length, 
          tags: dataWithTags.tags.length 
        });
        
        setData(dataWithTags);
        dataRef.current = dataWithTags;
      } catch (err) {
        setError('Failed to load data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  const updateGoals = useCallback((goals: Goal[]) => {
    console.log("Updating goals", { count: goals.length });
    const updatedData = { ...data, goals };
    setData(updatedData);
  }, [data]);

  const addGoal = useCallback((goal: Goal) => {
    console.log("Adding goal", { id: goal.id });
    const updatedGoals = [...data.goals, goal];
    const updatedData = { ...data, goals: updatedGoals };
    setData(updatedData);
  }, [data]);

  // Custom setData wrapper to ensure we always update localStorage
  const setDataWithSave = useCallback((newData: AppData) => {
    console.log("Setting data with save", { 
      goals: newData.goals.length, 
      tags: newData.tags?.length 
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
    saveData(dataCopy, false).catch(err => {
      console.error("Error saving data:", err);
    });
    setLastSaved(new Date());
    
    console.log("Data saved immediately");
  }, []);

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