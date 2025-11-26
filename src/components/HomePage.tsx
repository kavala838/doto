import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import GoalCard from './GoalCard';
import NewGoalModal from './NewGoalModal';
import JSONEditorModal from './JSONEditorModal';
import { fetchGistData } from '../utils/storageUtils';

const HomePage: React.FC = () => {
  const { data, loading, error, saveData, isSaving, lastSaved, setData } = useAppContext();
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  
  // Sort goals to show important ones first
  const sortedGoals = useMemo(() => {
    if (!data.goals || data.goals.length === 0) return [];
    
    // Find the "Important" tag ID
    const importantTag = data.tags?.find(tag => 
      tag.name.toLowerCase() === 'important' || tag.isHot
    );
    
    const importantTagId = importantTag?.id;
    
    // Sort goals: important first, then by creation date (newest first)
    return [...data.goals].sort((a, b) => {
      const aIsImportant = importantTagId && a.tags?.includes(importantTagId);
      const bIsImportant = importantTagId && b.tags?.includes(importantTagId);
      
      if (aIsImportant && !bIsImportant) return -1;
      if (!aIsImportant && bIsImportant) return 1;
      
      // If both have same importance, sort by creation date (newest first)
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [data.goals, data.tags]);
  
  useEffect(() => {
    // Tokens are now managed server-side; no frontend token check needed.
  }, []);
  
  const handleFetchFromGist = async () => {
    setIsFetching(true);
    try {
      const gistData = await fetchGistData();
      // Pass true as second argument to skipGistUpdate since we just got this data from the Gist
      setData(gistData, true);
      alert('Data refreshed successfully from GitHub Gist!');
    } catch (error) {
      console.error('Error fetching from Gist:', error);
      alert('Failed to refresh data from GitHub Gist. Check console for details.');
    } finally {
      setIsFetching(false);
    }
  };
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '100vh'
      }}>
        <p>Loading...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '100vh',
        color: 'red'
      }}>
        <p>Error: {error}</p>
      </div>
    );
  }
  
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1 style={{ margin: 0 }}>Goals</h1>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          {lastSaved && (
            <div style={{
              fontSize: '12px',
              color: '#666',
              fontStyle: 'italic',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
            </div>
          )}
          
          {/* Refresh Button */}
          <button
            onClick={handleFetchFromGist}
            disabled={isFetching}
            style={{
              background: '#3b82f6',
              border: '1px solid #2563eb',
              borderRadius: '4px',
              padding: '5px 10px',
              cursor: isFetching ? 'not-allowed' : 'pointer',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s ease',
              opacity: isFetching ? 0.6 : 1
            }}
            title="Refresh data from GitHub Gist"
          >
            {isFetching ? (
              <>
                <span className="loading-spinner" style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderRadius: '50%',
                  borderTopColor: 'white',
                  animation: 'spin 1s ease-in-out infinite'
                }}></span>
                Refreshing...
              </>
            ) : (
              <>
                {/* Refresh icon */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6"></path>
                  <path d="M1 20v-6h6"></path>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                  <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
                </svg>
                Refresh
              </>
            )}
          </button>
          
          <button 
            onClick={saveData}
            disabled={isSaving}
            style={{
              background: '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '5px 10px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s ease'
            }}
            title="Save to Gist"
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.currentTarget.style.backgroundColor = '#e0e0e0';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f0f0';
            }}
          >
            {isSaving ? (
              <>
                <span className="loading-spinner" style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  border: '2px solid rgba(0,0,0,0.1)',
                  borderRadius: '50%',
                  borderTopColor: '#333',
                  animation: 'spin 1s ease-in-out infinite'
                }}></span>
                <style>{`
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
                Saving...
              </>
            ) : (
              <>
                {/* Save icon */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                Save
              </>
            )}
          </button>
          
          <button 
            onClick={() => setShowJsonEditor(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '24px'
            }}
            title="Edit JSON"
          >
            {/* JSON icon */}
            <span style={{ fontFamily: 'monospace' }}>{ '{' } { '}' }</span>
          </button>
        </div>
      </div>
      
      <div style={{ 
        display: 'flex',
        flexWrap: 'wrap'
      }}>
        {sortedGoals.map(goal => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
        
        {/* Add new goal card */}
        <div 
          onClick={() => setShowNewGoalModal(true)}
          style={{
            border: '1px dashed #CBD5E1',
            borderRadius: '12px',
            padding: '20px',
            margin: '12px',
            width: '320px',
            height: '200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backgroundColor: '#F8FAFC',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.05)';
            e.currentTarget.style.backgroundColor = '#F1F5F9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.backgroundColor = '#F8FAFC';
          }}
        >
          <div style={{ 
            fontSize: '64px', 
            color: '#94A3B8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            +
          </div>
        </div>
      </div>
      
      {showNewGoalModal && (
        <NewGoalModal onClose={() => setShowNewGoalModal(false)} />
      )}
      
      {showJsonEditor && (
        <JSONEditorModal onClose={() => setShowJsonEditor(false)} />
      )}
    </div>
  );
};

export default HomePage; 