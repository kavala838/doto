import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import GoalCard from './GoalCard';
import NewGoalModal from './NewGoalModal';
import JSONEditorModal from './JSONEditorModal';
import { getGitHubToken, setGitHubToken, fetchGistData } from '../utils/storageUtils';

const HomePage: React.FC = () => {
  const { data, loading, error, saveData, isSaving, lastSaved, setData } = useAppContext();
  const [showNewGoalModal, setShowNewGoalModal] = useState(false);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
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
    // Check if GitHub token exists
    const token = getGitHubToken();
    setHasToken(!!token);
  }, []);
  
  const handleSetToken = () => {
    if (token.trim()) {
      setGitHubToken(token.trim());
      setHasToken(true);
      setShowTokenInput(false);
      setToken('');
      alert('GitHub token saved successfully!');
    }
  };
  
  const handleFetchFromGist = async () => {
    setIsFetching(true);
    try {
      const gistData = await fetchGistData();
      setData(gistData);
      alert('Data fetched successfully from GitHub Gist!');
    } catch (error) {
      console.error('Error fetching from Gist:', error);
      alert('Failed to fetch data from GitHub Gist. Check console for details.');
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
              fontStyle: 'italic'
            }}>
              Last saved: {lastSaved.toLocaleTimeString()}
            </div>
          )}
          
          {/* GitHub Token Button */}
          <button
            onClick={() => setShowTokenInput(!showTokenInput)}
            style={{
              background: hasToken ? '#4caf50' : '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '5px 10px',
              cursor: 'pointer',
              color: hasToken ? 'white' : 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s ease'
            }}
            title={hasToken ? 'GitHub Token is set' : 'Set GitHub Token'}
          >
            {/* GitHub icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
            </svg>
            {hasToken ? 'Token Set' : 'Set Token'}
          </button>
          
          {/* Fetch Button */}
          <button
            onClick={handleFetchFromGist}
            disabled={isFetching || !hasToken}
            style={{
              background: '#3b82f6',
              border: '1px solid #2563eb',
              borderRadius: '4px',
              padding: '5px 10px',
              cursor: (isFetching || !hasToken) ? 'not-allowed' : 'pointer',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s ease',
              opacity: (isFetching || !hasToken) ? 0.6 : 1
            }}
            title={!hasToken ? 'Set GitHub token first' : 'Fetch data from GitHub Gist'}
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
                Fetching...
              </>
            ) : (
              <>
                {/* Download icon */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Fetch
              </>
            )}
          </button>
          
          {showTokenInput && (
            <div style={{
              position: 'absolute',
              top: '60px',
              right: '20px',
              backgroundColor: 'white',
              padding: '15px',
              borderRadius: '4px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              width: '300px'
            }}>
              <div>Enter your GitHub token:</div>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ccc'
                }}
                placeholder="GitHub personal access token"
              />
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
              }}>
                <button
                  onClick={() => setShowTokenInput(false)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    background: '#f0f0f0'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetToken}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    background: '#4caf50',
                    color: 'white'
                  }}
                >
                  Save Token
                </button>
              </div>
              <div style={{
                fontSize: '12px',
                color: '#666',
                marginTop: '5px'
              }}>
                Note: Token needs 'gist' scope permission
              </div>
            </div>
          )}
          
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